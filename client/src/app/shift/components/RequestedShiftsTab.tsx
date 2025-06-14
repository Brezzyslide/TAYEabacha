import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, User } from "lucide-react";
import { format, isToday, isTomorrow, isYesterday } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { type Shift } from "@shared/schema";
import ShiftViewToggle from "./ShiftViewToggle";
import ShiftStatusTag from "./ShiftStatusTag";
import ShiftCalendarView from "./ShiftCalendarView";

export default function RequestedShiftsTab() {
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  
  const { user } = useAuth();

  const { data: shifts = [], isLoading } = useQuery<Shift[]>({
    queryKey: ["/api/shifts"],
    refetchInterval: 30000,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
  });

  // Filter available unassigned shifts that staff can request
  const availableShifts = useMemo(() => {
    if (!user) return [];
    return shifts.filter(shift => 
      !shift.userId && (shift as any).status !== "completed" && (shift as any).status !== "cancelled"
    );
  }, [shifts, user]);

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
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
            Pending Approval
          </Badge>
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

        {(shift as any).description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
            {(shift as any).description}
          </p>
        )}

        <div className="flex items-center gap-2 text-sm text-orange-600">
          <User className="h-4 w-4" />
          <span>Request submitted - awaiting admin approval</span>
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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Available Shifts</h2>
          <p className="text-gray-600 dark:text-gray-400">
            {availableShifts.length} unassigned shift{availableShifts.length !== 1 ? 's' : ''} available to request
          </p>
        </div>
        
        <ShiftViewToggle viewMode={viewMode} onViewChange={setViewMode} />
      </div>

      {availableShifts.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No available shifts
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              All shifts are currently assigned. Check back later for new opportunities.
            </p>
          </CardContent>
        </Card>
      ) : viewMode === "calendar" ? (
        <ShiftCalendarView
          shifts={availableShifts}
          onShiftClick={() => {}} // TODO: Add shift request functionality
          getClientName={getClientName}
        />
      ) : (
        <div className="space-y-4">
          {availableShifts.map(renderShiftCard)}
        </div>
      )}
    </div>
  );
}