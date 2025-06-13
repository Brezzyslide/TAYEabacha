import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { type Shift } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import ShiftViewToggle from "./ShiftViewToggle";
import ShiftCalendarView from "./ShiftCalendarView";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, MapPin } from "lucide-react";
import { format, isToday, isTomorrow, isYesterday } from "date-fns";

export default function ShiftCalendarTab() {
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  
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
            // Only handle unassigned shifts - request them
            if (!shift.userId && (shift as any).status !== "requested") {
              requestShiftMutation.mutate(shift.id);
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
    </div>
  );
}