import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, FileText, Plus } from "lucide-react";
import { format, isToday, isTomorrow, isYesterday } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { type Shift } from "@shared/schema";
import ShiftViewToggle from "./ShiftViewToggle";
import ShiftStatusTag from "./ShiftStatusTag";
import StartShiftModal from "./StartShiftModal";
import EndShiftModal from "./EndShiftModal";

export default function MyShiftsTab() {
  const [viewMode, setViewMode] = useState<"calendar" | "list">("list");
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

  // Filter shifts assigned to current user
  const myShifts = useMemo(() => {
    if (!user) return [];
    return shifts.filter(shift => shift.userId === user.id);
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

  const handleStartShift = (shift: Shift) => {
    setSelectedShift(shift);
    setIsStartModalOpen(true);
  };

  const handleEndShift = (shift: Shift) => {
    setSelectedShift(shift);
    setIsEndModalOpen(true);
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
          <ShiftStatusTag status={shift.status || "assigned"} />
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

        <div className="flex flex-wrap gap-2 pt-2">
          {(shift as any).status === "assigned" && (
            <Button
              onClick={() => handleStartShift(shift)}
              size="sm"
              className="bg-green-600 hover:bg-green-700"
            >
              Start Shift
            </Button>
          )}
          
          {(shift as any).status === "in-progress" && (
            <Button
              onClick={() => handleEndShift(shift)}
              size="sm"
              variant="outline"
              className="border-orange-600 text-orange-600 hover:bg-orange-50"
            >
              End Shift
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="flex items-center gap-2"
            onClick={() => {
              // Navigate to case notes for this client
              if (shift.clientId) {
                window.location.href = `/support-work/client/${shift.clientId}?tab=case-notes`;
              }
            }}
          >
            <FileText className="h-4 w-4" />
            Case Notes
          </Button>
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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">My Shifts</h2>
          <p className="text-gray-600 dark:text-gray-400">
            {myShifts.length} shift{myShifts.length !== 1 ? 's' : ''} assigned to you
          </p>
        </div>
        
        <ShiftViewToggle viewMode={viewMode} onViewChange={setViewMode} />
      </div>

      {myShifts.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No shifts assigned
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              You don't have any shifts assigned yet. Check back later or contact your supervisor.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className={viewMode === "list" ? "space-y-4" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"}>
          {myShifts.map(renderShiftCard)}
        </div>
      )}

      {selectedShift && (
        <>
          <StartShiftModal
            shift={selectedShift}
            isOpen={isStartModalOpen}
            onClose={() => {
              setIsStartModalOpen(false);
              setSelectedShift(null);
            }}
          />
          
          <EndShiftModal
            shift={selectedShift}
            isOpen={isEndModalOpen}
            onClose={() => {
              setIsEndModalOpen(false);
              setSelectedShift(null);
            }}
          />
        </>
      )}
    </div>
  );
}