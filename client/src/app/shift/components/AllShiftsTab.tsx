import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, User, MapPin, Plus, Filter } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay, addDays, subDays } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { type Shift } from "@shared/schema";
import ShiftViewToggle from "./ShiftViewToggle";
import ShiftStatusTag from "./ShiftStatusTag";
import NewShiftModal from "./NewShiftModal";
import EditShiftModal from "./EditShiftModal";

type FilterPeriod = "daily" | "weekly" | "fortnightly";

export default function AllShiftsTab() {
  const [viewMode, setViewMode] = useState<"calendar" | "list">("list");
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>("weekly");
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [isNewShiftModalOpen, setIsNewShiftModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const { user } = useAuth();

  const { data: shifts = [], isLoading } = useQuery<Shift[]>({
    queryKey: ["/api/shifts"],
    refetchInterval: 30000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
  });

  // Filter shifts by period
  const filteredShifts = useMemo(() => {
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
        startDate = subDays(startOfWeek(now), 7);
        endDate = addDays(endOfWeek(now), 7);
        break;
      default:
        return shifts;
    }

    return shifts.filter(shift => {
      const shiftDate = new Date(shift.startTime);
      return shiftDate >= startDate && shiftDate <= endDate;
    });
  }, [shifts, filterPeriod]);

  const getStaffName = (userId: number | null) => {
    if (!userId) return "Unassigned";
    const staff = (users as any[]).find(u => u.id === userId);
    return staff?.username || "Unknown staff";
  };

  const getClientName = (clientId: number | null) => {
    if (!clientId) return "No client assigned";
    const client = (clients as any[]).find(c => c.id === clientId);
    return client?.fullName || "Unknown client";
  };

  const handleEditShift = (shift: Shift) => {
    setSelectedShift(shift);
    setIsEditModalOpen(true);
  };

  const getShiftStats = () => {
    const total = filteredShifts.length;
    const assigned = filteredShifts.filter(s => s.userId).length;
    const unassigned = total - assigned;
    const inProgress = filteredShifts.filter(s => (s as any).status === "in-progress").length;
    const completed = filteredShifts.filter(s => (s as any).status === "completed").length;

    return { total, assigned, unassigned, inProgress, completed };
  };

  const stats = getShiftStats();

  const renderShiftCard = (shift: Shift) => (
    <Card key={shift.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleEditShift(shift)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">{shift.title}</CardTitle>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-1">
              <Calendar className="h-4 w-4" />
              {format(new Date(shift.startTime), "MMM d, yyyy")}
            </div>
          </div>
          <ShiftStatusTag status={(shift as any).status || "assigned"} />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <span>{format(new Date(shift.startTime), "h:mm a")} - {shift.endTime ? format(new Date(shift.endTime), "h:mm a") : "TBD"}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-500" />
            <span>{getStaffName(shift.userId)}</span>
          </div>

          {shift.clientId && (
            <div className="flex items-center gap-2 md:col-span-2">
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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">All Shifts</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Manage all shifts across your organization
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={filterPeriod} onValueChange={(value: FilterPeriod) => setFilterPeriod(value)}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="fortnightly">Fortnightly</SelectItem>
            </SelectContent>
          </Select>
          
          <ShiftViewToggle viewMode={viewMode} onViewChange={setViewMode} />
          
          {/* Only show New Shift button for roles with shift creation permissions */}
          {user && (user.role === "Coordinator" || user.role === "Admin" || user.role === "ConsoleManager") && (
            <Button onClick={() => setIsNewShiftModalOpen(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Shift
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.assigned}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Assigned</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">{stats.unassigned}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Unassigned</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.inProgress}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">In Progress</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.completed}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
          </CardContent>
        </Card>
      </div>

      {filteredShifts.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No shifts found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              No shifts found for the selected time period. Create a new shift to get started.
            </p>
            <Button onClick={() => setIsNewShiftModalOpen(true)} className="mt-4">
              Create First Shift
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className={viewMode === "list" ? "space-y-4" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"}>
          {filteredShifts.map(renderShiftCard)}
        </div>
      )}

      <NewShiftModal
        open={isNewShiftModalOpen}
        onOpenChange={setIsNewShiftModalOpen}
      />

      {selectedShift && (
        <EditShiftModal
          shiftId={selectedShift.id}
          open={isEditModalOpen}
          onOpenChange={(open) => {
            setIsEditModalOpen(open);
            if (!open) setSelectedShift(null);
          }}
        />
      )}
    </div>
  );
}