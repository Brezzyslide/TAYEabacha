import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Play, Square, User } from "lucide-react";
import { format, isToday, isTomorrow, isYesterday, isAfter } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { type Shift } from "@shared/schema";
import ShiftStatusTag from "./ShiftStatusTag";
import StartShiftModal from "./StartShiftModal";
import EndShiftModal from "./EndShiftModal";

export default function MyShiftsTab() {
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [isEndModalOpen, setIsEndModalOpen] = useState(false);
  
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
    console.log("[MY SHIFTS] User ID:", user.id);
    console.log("[MY SHIFTS] Total shifts:", shifts.length);
    const filteredShifts = shifts.filter(shift => {
      const isAssignedToUser = shift.userId === user.id;
      const isNotRequested = shift.status !== "requested";
      console.log(`[MY SHIFTS] Shift ${shift.id}: userId=${shift.userId}, status=${shift.status}, assignedToUser=${isAssignedToUser}, notRequested=${isNotRequested}`);
      return isAssignedToUser && isNotRequested;
    });
    console.log("[MY SHIFTS] Filtered shifts count:", filteredShifts.length);
    return filteredShifts;
  }, [shifts, user]);

  // Get the next upcoming shift
  const nextUpcomingShift = useMemo(() => {
    const now = new Date();
    const upcomingShifts = myShifts
      .filter(shift => isAfter(new Date(shift.startTime), now))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    
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

  const handleShiftCardClick = (shift: Shift) => {
    const status = (shift as any).status;
    if (status === "assigned") {
      handleStartShift(shift);
    } else if (status === "in-progress") {
      handleEndShift(shift);
    }
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

      {!nextUpcomingShift ? (
        <Card className="text-center py-12">
          <CardContent>
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No upcoming shifts
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              You don't have any upcoming shifts assigned. Check the calendar for available shifts to request.
            </p>
          </CardContent>
        </Card>
      ) : (
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
                  {formatShiftDate(nextUpcomingShift.startTime)}
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
                  {format(new Date(nextUpcomingShift.startTime), "h:mm a")} - {
                    nextUpcomingShift.endTime ? 
                    format(new Date(nextUpcomingShift.endTime), "h:mm a") : 
                    "TBD"
                  }
                </span>
              </div>
              
              {nextUpcomingShift.clientId && (
                <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                  <User className="h-4 w-4" />
                  <span className="font-medium">{getClientName(nextUpcomingShift.clientId)}</span>
                </div>
              )}
            </div>

            {(nextUpcomingShift as any).description && (
              <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  {(nextUpcomingShift as any).description}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                <MapPin className="h-4 w-4" />
                <span>Click card to manage shift</span>
              </div>
              <Badge 
                variant="outline" 
                className="bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700"
              >
                Next Up
              </Badge>
            </div>
          </CardContent>
        </Card>
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
            client={selectedShift.clientId ? 
              (clients as any[]).find(c => c.id === selectedShift.clientId) : 
              null
            }
          />

          <EndShiftModal
            isOpen={isEndModalOpen}
            onClose={() => {
              setIsEndModalOpen(false);
              setSelectedShift(null);
            }}
            shift={selectedShift}
            client={selectedShift.clientId ? 
              (clients as any[]).find(c => c.id === selectedShift.clientId) : 
              null
            }
          />
        </>
      )}
    </div>
  );
}