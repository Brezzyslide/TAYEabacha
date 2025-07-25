import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, MapPin, Play, Square, User, X, Filter } from "lucide-react";
import { format, isToday, isTomorrow, isYesterday, isAfter, startOfWeek, endOfWeek, startOfDay, endOfDay, addDays, startOfMonth, endOfMonth } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { type Shift } from "@shared/schema";
import ShiftStatusTag from "./ShiftStatusTag";
import StartShiftModal from "./StartShiftModal";
import EndShiftModal from "./EndShiftModal";
import { CancelShiftModal } from "./CancelShiftModal";
import CaseNoteStatusBadge, { CaseNoteCornerIndicator, CaseNoteStatusBorder } from "./CaseNoteStatusBadge";

type FilterPeriod = "all" | "daily" | "weekly" | "fortnightly" | "monthly";

export default function MyShiftsTab() {
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [isEndModalOpen, setIsEndModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [shiftToCancel, setShiftToCancel] = useState<Shift | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>("all");

  // Update current time every minute for real-time countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);
  
  const { user } = useAuth();

  const { data: shifts = [], isLoading } = useQuery<Shift[]>({
    queryKey: ["/api/shifts"],
    refetchInterval: 30000,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
  });

  const { data: caseNotes = [] } = useQuery({
    queryKey: ["/api/case-notes"],
    refetchInterval: 60000,
  });

  // Filter shifts assigned to current user that are approved (not just requested)
  const myShifts = useMemo(() => {
    if (!user) return [];
    return shifts.filter(shift => 
      shift.userId === user.id && 
      shift.status !== "requested" // Exclude pending requests
    );
  }, [shifts, user]);

  // Filter shifts by period
  const filteredMyShifts = useMemo(() => {
    if (filterPeriod === "all") return myShifts;
    
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (filterPeriod) {
      case "daily":
        startDate = startOfDay(now);
        endDate = endOfDay(now);
        break;
      case "weekly":
        startDate = startOfWeek(now);
        endDate = endOfWeek(now);
        break;
      case "fortnightly":
        startDate = startOfDay(now);
        endDate = addDays(now, 14);
        break;
      case "monthly":
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      default:
        return myShifts;
    }

    return myShifts.filter(shift => {
      if (!shift.startTime) return true; // Include shifts without start time
      try {
        const shiftDate = new Date(shift.startTime);
        return shiftDate >= startDate && shiftDate <= endDate;
      } catch (error) {
        return true; // Include if date parsing fails
      }
    });
  }, [myShifts, filterPeriod]);

  // Get the next upcoming shift
  const nextUpcomingShift = useMemo(() => {
    const now = new Date();
    
    const upcomingShifts = filteredMyShifts
      .filter(shift => {
        if (!shift.startTime) return true; // Include shifts without start time as upcoming
        return isAfter(new Date(shift.startTime), now);
      })
      .sort((a, b) => {
        if (!a.startTime && !b.startTime) return 0;
        if (!a.startTime) return -1; // Shifts without time come first
        if (!b.startTime) return 1;
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      });
    
    return upcomingShifts[0] || null;
  }, [filteredMyShifts]);

  const formatShiftDate = (date: Date | string) => {
    const shiftDate = new Date(date);
    if (isToday(shiftDate)) return "Today";
    if (isTomorrow(shiftDate)) return "Tomorrow";
    if (isYesterday(shiftDate)) return "Yesterday";
    return format(shiftDate, "MMM d, yyyy");
  };

  const getClientName = (clientId: number | null) => {
    if (!clientId) return "No client assigned";
    const client = (clients as any[]).find(c => c.id === clientId);
    return client?.fullName || "Unknown client";
  };

  const hasCaseNoteForShift = (shiftId: number) => {
    return (caseNotes as any[]).some(note => note.shiftId === shiftId);
  };

  const handleStartShift = (shift: Shift) => {
    setSelectedShift(shift);
    setIsStartModalOpen(true);
  };

  const handleEndShift = (shift: Shift) => {
    setSelectedShift(shift);
    setIsEndModalOpen(true);
  };

  const handleCancelShift = (shift: Shift) => {
    setShiftToCancel(shift);
    setIsCancelModalOpen(true);
  };

  const handleShiftCardClick = (shift: Shift) => {
    const status = (shift as any).status;
    if (status === "assigned") {
      handleStartShift(shift);
    } else if (status === "in-progress") {
      handleEndShift(shift);
    }
  };

  const canCancelShift = (shift: Shift) => {
    const status = (shift as any).status;
    return status === "assigned" || status === "cancellation_requested";
  };

  const canStartShift = (shift: Shift) => {
    if (!shift.startTime) return true; // Allow if no start time set
    
    const now = new Date();
    const shiftStart = new Date(shift.startTime);
    const timeDifferenceMinutes = (shiftStart.getTime() - now.getTime()) / (1000 * 60);
    
    // Allow starting 15 minutes before scheduled time
    return timeDifferenceMinutes <= 15;
  };

  const getStartButtonText = (shift: Shift) => {
    if (!shift.startTime) return "Start Shift";
    
    const now = new Date();
    const shiftStart = new Date(shift.startTime);
    const timeDifferenceMinutes = Math.ceil((shiftStart.getTime() - now.getTime()) / (1000 * 60));
    
    if (timeDifferenceMinutes > 15) {
      const hours = Math.floor(timeDifferenceMinutes / 60);
      const minutes = timeDifferenceMinutes % 60;
      if (hours > 0) {
        return `Available in ${hours}h ${minutes}m`;
      } else {
        return `Available in ${minutes}m`;
      }
    }
    
    return "Start Shift";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">My Assigned Shifts</h2>
          <p className="text-gray-600 dark:text-gray-400">
            View and manage shifts assigned to you. Use Start/End buttons for GPS check-in with handover notes.
          </p>
        </div>
        
        {/* Date Filter Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
              <Filter className="h-4 w-4" />
              <span>Filter:</span>
            </div>
            <Select value={filterPeriod} onValueChange={(value: FilterPeriod) => setFilterPeriod(value)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Shifts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Shifts</SelectItem>
                <SelectItem value="daily">Today</SelectItem>
                <SelectItem value="weekly">This Week</SelectItem>
                <SelectItem value="fortnightly">Next 2 Weeks</SelectItem>
                <SelectItem value="monthly">This Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {filteredMyShifts.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {filterPeriod === "all" ? "No shifts assigned" : 
               filterPeriod === "daily" ? "No shifts today" :
               filterPeriod === "weekly" ? "No shifts this week" :
               filterPeriod === "fortnightly" ? "No shifts in next 2 weeks" :
               "No shifts this month"}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {filterPeriod === "all" 
                ? "You don't have any shifts assigned. Check the calendar for available shifts to request."
                : "Try changing the filter to see shifts in other time periods."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {nextUpcomingShift && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Next Upcoming Shift</h3>
              <Card 
                className="hover:shadow-lg transition-all cursor-pointer border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950"
                onClick={() => handleShiftCardClick(nextUpcomingShift)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl font-bold text-blue-900 dark:text-blue-100">
                        {nextUpcomingShift.title}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300 mt-1">
                        <Calendar className="h-4 w-4" />
                        {nextUpcomingShift.startTime ? formatShiftDate(nextUpcomingShift.startTime) : "Date TBD"}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <ShiftStatusTag 
                        status={(nextUpcomingShift as any).status || "assigned"} 
                        className="text-sm px-3 py-1" 
                      />
                      <Button
                        variant={((nextUpcomingShift as any).status === "in-progress") ? "destructive" : "default"}
                        size="sm"
                        className="flex items-center gap-2"
                        disabled={((nextUpcomingShift as any).status === "assigned") && !canStartShift(nextUpcomingShift)}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShiftCardClick(nextUpcomingShift);
                        }}
                        title={
                          ((nextUpcomingShift as any).status === "assigned") && !canStartShift(nextUpcomingShift)
                            ? "Start button available 15 minutes before shift time"
                            : ""
                        }
                      >
                        {((nextUpcomingShift as any).status === "in-progress") ? (
                          <>
                            <Square className="h-4 w-4" />
                            End Shift
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4" />
                            {getStartButtonText(nextUpcomingShift)}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                      <Clock className="h-4 w-4" />
                      <span className="font-medium">
                        {nextUpcomingShift.startTime ? format(new Date(nextUpcomingShift.startTime), "h:mm a") : "Time TBD"} - {
                          nextUpcomingShift.endTime ? 
                          format(new Date(nextUpcomingShift.endTime), "h:mm a") : 
                          "TBD"
                        }
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                      <User className="h-4 w-4" />
                      <span className="font-medium">{getClientName(nextUpcomingShift.clientId)}</span>
                    </div>
                  </div>

                  {(nextUpcomingShift as any).description && (
                    <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-lg">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        {(nextUpcomingShift as any).description}
                      </p>
                    </div>
                  )}

                  <div className="flex justify-center">
                    <Badge 
                      variant="outline" 
                      className="bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700"
                    >
                      Next Up
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div>
            <h3 className="text-lg font-semibold mb-4">
              {filterPeriod === "all" ? `All My Shifts (${filteredMyShifts.length})` : 
               filterPeriod === "daily" ? `Today's Shifts (${filteredMyShifts.length})` :
               filterPeriod === "weekly" ? `This Week's Shifts (${filteredMyShifts.length})` :
               filterPeriod === "fortnightly" ? `Next 2 Weeks' Shifts (${filteredMyShifts.length})` :
               `This Month's Shifts (${filteredMyShifts.length})`}
            </h3>
            <div className="space-y-4">
              {filteredMyShifts
                .sort((a, b) => {
                  if (!a.startTime && !b.startTime) return 0;
                  if (!a.startTime) return -1; // Shifts without time come first
                  if (!b.startTime) return 1;
                  // FIXED: Changed to ascending order (earliest first)
                  return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
                })
                .map((shift) => (
                  <Card 
                    key={shift.id}
                    className="hover:shadow-md transition-all cursor-pointer relative"
                    onClick={() => handleShiftCardClick(shift)}
                  >
                    <CaseNoteStatusBorder 
                      shift={shift} 
                      caseNoteSubmitted={hasCaseNoteForShift(shift.id)} 
                    />
                    <CaseNoteCornerIndicator 
                      shift={shift} 
                      caseNoteSubmitted={hasCaseNoteForShift(shift.id)} 
                    />
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg font-semibold">
                            {shift.title}
                          </CardTitle>
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-1">
                            <Calendar className="h-4 w-4" />
                            {shift.startTime ? formatShiftDate(shift.startTime) : "Date TBD"}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex gap-2">
                            <CaseNoteStatusBadge 
                              shift={shift} 
                              caseNoteSubmitted={hasCaseNoteForShift(shift.id)}
                              className="text-xs"
                            />
                            <ShiftStatusTag 
                              status={(shift as any).status || "assigned"} 
                              className="text-sm px-2 py-1" 
                            />
                          </div>
                          <div className="flex gap-2">
                            {canCancelShift(shift) && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelShift(shift);
                                }}
                              >
                                <X className="h-4 w-4" />
                                Cancel
                              </Button>
                            )}
                            <Button
                              variant={((shift as any).status === "in-progress") ? "destructive" : "outline"}
                              size="sm"
                              className="flex items-center gap-2"
                              disabled={((shift as any).status === "assigned") && !canStartShift(shift)}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShiftCardClick(shift);
                              }}
                              title={
                                ((shift as any).status === "assigned") && !canStartShift(shift)
                                  ? "Start button available 15 minutes before shift time"
                                  : ""
                              }
                            >
                              {((shift as any).status === "in-progress") ? (
                                <>
                                  <Square className="h-4 w-4" />
                                  End
                                </>
                              ) : (
                                <>
                                  <Play className="h-4 w-4" />
                                  {canStartShift(shift) ? "Start" : getStartButtonText(shift)}
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                          <Clock className="h-4 w-4" />
                          <span>
                            {shift.startTime ? format(new Date(shift.startTime), "h:mm a") : "Time TBD"} - {
                              shift.endTime ? 
                              format(new Date(shift.endTime), "h:mm a") : 
                              "TBD"
                            }
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                          <User className="h-4 w-4" />
                          <span>{getClientName(shift.clientId)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        </div>
      )}

      {selectedShift && (
        <>
          <StartShiftModal
            isOpen={isStartModalOpen}
            onClose={() => {
              setIsStartModalOpen(false);
              setSelectedShift(null);
            }}
            shift={selectedShift}
          />

          <EndShiftModal
            isOpen={isEndModalOpen}
            onClose={() => {
              setIsEndModalOpen(false);
              setSelectedShift(null);
            }}
            shift={selectedShift}
          />
        </>
      )}

      <CancelShiftModal
        isOpen={isCancelModalOpen}
        onClose={() => {
          setIsCancelModalOpen(false);
          setShiftToCancel(null);
        }}
        shift={shiftToCancel}
      />
    </div>
  );
}