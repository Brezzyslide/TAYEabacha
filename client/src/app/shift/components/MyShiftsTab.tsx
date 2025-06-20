import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Play, Square, User, X } from "lucide-react";
import { format, isToday, isTomorrow, isYesterday, isAfter } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { type Shift } from "@shared/schema";
import ShiftStatusTag from "./ShiftStatusTag";
import StartShiftModal from "./StartShiftModal";
import EndShiftModal from "./EndShiftModal";
import { CancelShiftModal } from "./CancelShiftModal";
import CaseNoteStatusBadge, { CaseNoteStatusBanner } from "./CaseNoteStatusBadge";

export default function MyShiftsTab() {
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [isEndModalOpen, setIsEndModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [shiftToCancel, setShiftToCancel] = useState<Shift | null>(null);
  
  const { user } = useAuth();

  const { data: shifts = [], isLoading } = useQuery<Shift[]>({
    queryKey: ["/api/shifts"],
    refetchInterval: 30000,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
  });

  // Filter shifts assigned to current user that are approved (not just requested)
  const myShifts = useMemo(() => {
    if (!user) return [];
    return shifts.filter(shift => 
      shift.userId === user.id && 
      shift.status !== "requested" // Exclude pending requests
    );
  }, [shifts, user]);

  // Get the next upcoming shift
  const nextUpcomingShift = useMemo(() => {
    const now = new Date();
    
    const upcomingShifts = myShifts
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
  }, [myShifts]);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">My Assigned Shifts</h2>
        <p className="text-gray-600 dark:text-gray-400">
          View and manage shifts assigned to you. Use Start/End buttons for GPS check-in with handover notes.
        </p>
      </div>

      {myShifts.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No shifts assigned
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              You don't have any shifts assigned. Check the calendar for available shifts to request.
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShiftCardClick(nextUpcomingShift);
                        }}
                      >
                        {((nextUpcomingShift as any).status === "in-progress") ? (
                          <>
                            <Square className="h-4 w-4" />
                            End Shift
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4" />
                            Start Shift
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
            <h3 className="text-lg font-semibold mb-4">All My Shifts ({myShifts.length})</h3>
            <div className="space-y-4">
              {myShifts
                .sort((a, b) => {
                  if (!a.startTime && !b.startTime) return 0;
                  if (!a.startTime) return 1;
                  if (!b.startTime) return -1;
                  return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
                })
                .map((shift) => (
                  <Card 
                    key={shift.id}
                    className="hover:shadow-md transition-all cursor-pointer"
                    onClick={() => handleShiftCardClick(shift)}
                  >
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
                          <ShiftStatusTag 
                            status={(shift as any).status || "assigned"} 
                            className="text-sm px-2 py-1" 
                          />
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
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShiftCardClick(shift);
                              }}
                            >
                              {((shift as any).status === "in-progress") ? (
                                <>
                                  <Square className="h-4 w-4" />
                                  End
                                </>
                              ) : (
                                <>
                                  <Play className="h-4 w-4" />
                                  Start
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