import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { type Shift } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import ShiftViewToggle from "./ShiftViewToggle";
import ShiftCalendarView from "./ShiftCalendarView";
import ShiftRequestConfirmDialog from "./ShiftRequestConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, MapPin, Users, UserCheck, UserX, TrendingUp, CheckCircle, PlayCircle } from "lucide-react";
import { format, isToday, isTomorrow, isYesterday } from "date-fns";

export default function ShiftCalendarTab() {
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [selectedShiftForRequest, setSelectedShiftForRequest] = useState<Shift | null>(null);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shifts = [], isLoading } = useQuery<Shift[]>({
    queryKey: ["/api/shifts"],
    refetchInterval: 30000,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
  });

  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
  });

  // Mutation for requesting shifts
  const requestShiftMutation = useMutation({
    mutationFn: async (shiftId: number) => {
      return apiRequest(`/api/shifts/${shiftId}`, "PATCH", {
        userId: user?.id,
        status: "requested"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({
        title: "Shift Requested",
        description: "Your shift request has been submitted for approval.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to request shift.",
        variant: "destructive",
      });
    },
  });

  // Filter shifts assigned to current user and unassigned shifts
  const myShifts = useMemo(() => {
    if (!user) return [];
    return shifts.filter(shift => shift.userId === user.id);
  }, [shifts, user]);

  // Filter unassigned shifts that staff can request
  const unassignedShifts = useMemo(() => {
    return shifts.filter(shift => !shift.userId && (shift as any).status !== "requested");
  }, [shifts]);

  // All shifts to display in calendar (assigned + unassigned)
  const allViewableShifts = useMemo(() => {
    return [...myShifts, ...unassignedShifts];
  }, [myShifts, unassignedShifts]);

  // Calculate organizational shift analytics from real database data
  const shiftAnalytics = useMemo(() => {
    const total = shifts.length;
    const assigned = shifts.filter(shift => shift.userId !== null).length;
    const unassigned = shifts.filter(shift => shift.userId === null).length;
    const allocated = shifts.filter(shift => 
      shift.userId !== null || (shift as any).status === "requested"
    ).length;
    const completed = shifts.filter(shift => (shift as any).status === "completed").length;
    const inProgress = shifts.filter(shift => (shift as any).status === "in-progress").length;
    const requested = shifts.filter(shift => (shift as any).status === "requested").length;

    return {
      total,
      assigned,
      unassigned,
      allocated,
      completed,
      inProgress,
      requested
    };
  }, [shifts]);

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

  const renderShiftCard = (shift: Shift) => (
    <Card key={shift.id} className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">{shift.title}</CardTitle>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-1">
              <Calendar className="h-4 w-4" />
              {formatShiftDate(shift.startTime)}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <span>{format(new Date(shift.startTime), "h:mm a")} - {shift.endTime ? format(new Date(shift.endTime), "h:mm a") : "TBD"}</span>
          </div>
          
          {shift.clientId && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-500" />
              <span>{getClientName(shift.clientId)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Shift Calendar</h2>
          <p className="text-gray-600 dark:text-gray-400">
            View all shifts and request available ones
          </p>
        </div>
        
        <ShiftViewToggle viewMode={viewMode} onViewChange={setViewMode} />
      </div>

      {allViewableShifts.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No shifts available
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              There are no shifts to display at the moment.
            </p>
          </CardContent>
        </Card>
      ) : viewMode === "calendar" ? (
        <ShiftCalendarView
          shifts={allViewableShifts}
          onShiftClick={(shift) => {
            // Only handle unassigned shifts - show confirmation dialog
            if (!shift.userId && (shift as any).status !== "requested") {
              setSelectedShiftForRequest(shift);
              setIsRequestDialogOpen(true);
              return;
            }
            // For assigned shifts, do nothing (viewing only)
          }}
          getClientName={getClientName}
        />
      ) : (
        <div className="space-y-4">
          {allViewableShifts.map(renderShiftCard)}
        </div>
      )}

      {/* Organizational Shift Analytics */}
      <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Organizational Shift Analytics</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Real-time statistics from database</p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-blue-600">{shiftAnalytics.total}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Total Shifts</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <UserCheck className="h-5 w-5 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-green-600">{shiftAnalytics.assigned}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Assigned</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <UserX className="h-5 w-5 text-red-600" />
              </div>
              <div className="text-2xl font-bold text-red-600">{shiftAnalytics.unassigned}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Unassigned</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-purple-600">{shiftAnalytics.allocated}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Allocated</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <PlayCircle className="h-5 w-5 text-orange-600" />
              </div>
              <div className="text-2xl font-bold text-orange-600">{shiftAnalytics.inProgress}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">In Progress</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-emerald-600">{shiftAnalytics.completed}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Completed</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div className="text-2xl font-bold text-yellow-600">{shiftAnalytics.requested}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Requested</div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Analytics Summary */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-blue-700 dark:text-blue-300">Coverage Rate</div>
                  <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {shiftAnalytics.total > 0 ? Math.round((shiftAnalytics.assigned / shiftAnalytics.total) * 100) : 0}%
                  </div>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-green-700 dark:text-green-300">Active Staff</div>
                  <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                    {new Set(shifts.filter(s => s.userId).map(s => s.userId)).size}
                  </div>
                </div>
                <Users className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-purple-700 dark:text-purple-300">Open Positions</div>
                  <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                    {shiftAnalytics.unassigned}
                  </div>
                </div>
                <UserX className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ShiftRequestConfirmDialog
        isOpen={isRequestDialogOpen}
        onClose={() => {
          setIsRequestDialogOpen(false);
          setSelectedShiftForRequest(null);
        }}
        onConfirm={() => {
          if (selectedShiftForRequest) {
            requestShiftMutation.mutate(selectedShiftForRequest.id);
            setIsRequestDialogOpen(false);
            setSelectedShiftForRequest(null);
          }
        }}
        shift={selectedShiftForRequest}
        clientName={selectedShiftForRequest ? getClientName(selectedShiftForRequest.clientId) : ""}
        isLoading={requestShiftMutation.isPending}
      />
    </div>
  );
}