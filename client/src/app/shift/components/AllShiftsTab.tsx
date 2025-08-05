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
import RecurringEditChoiceDialog from "./RecurringEditChoiceDialog";

type FilterPeriod = "all" | "daily" | "weekly" | "fortnightly" | "monthly" | "yearly";

export default function AllShiftsTab() {
  const [viewMode, setViewMode] = useState<"calendar" | "list">("list");
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>("all");
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [isNewShiftModalOpen, setIsNewShiftModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRecurringChoiceDialogOpen, setIsRecurringChoiceDialogOpen] = useState(false);
  const [editType, setEditType] = useState<"single" | "series">("single");
  
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

  // Filter and sort shifts by period and date
  const filteredShifts = useMemo(() => {
    let filteredData = shifts;

    // Apply period filter if not "all"
    if (filterPeriod !== "all") {
      const now = new Date();
      let startDate: Date | undefined;
      let endDate: Date | undefined;

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
        case "monthly":
          // Show 6 months for recurring shifts
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 6, 0);
          break;
        case "yearly":
          // Full year range for long-term recurring shifts
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date(now.getFullYear() + 1, 11, 31);
          break;
        default:
          break;
      }

      if (startDate && endDate) {
        filteredData = shifts.filter(shift => {
          const shiftDate = new Date(shift.startTime);
          return shiftDate >= startDate! && shiftDate <= endDate!;
        });
      }
    }

    // Sort all shifts by date and time (chronological order)
    return filteredData.sort((a, b) => {
      const dateA = new Date(a.startTime);
      const dateB = new Date(b.startTime);
      return dateA.getTime() - dateB.getTime();
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
    
    // Check if this is a recurring shift
    if (shift.isRecurring && shift.seriesId) {
      console.log(`[ALL SHIFTS] Opening choice dialog for recurring shift series ${shift.seriesId}`);
      setIsRecurringChoiceDialogOpen(true);
    } else {
      console.log(`[ALL SHIFTS] Opening edit modal directly for single shift`);
      setEditType("single");
      setIsEditModalOpen(true);
    }
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
    <Card key={shift.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => {
      // BULLETPROOF ADMIN ROLE CHECK: Case-insensitive with comprehensive role coverage
      const userRole = user?.role?.toLowerCase();
      const isAdminRole = userRole === "admin" || userRole === "consolemanager" || userRole === "coordinator" || userRole === "teamleader";
      
      if (isAdminRole && user) {
        console.log(`[ADMIN ALL-SHIFTS CLICK] Admin user ${user.role} clicked shift ${shift.id}, opening edit modal`);
        handleEditShift(shift);
        return;
      }
      
      // For staff - only handle unassigned shifts for requesting (placeholder for future implementation)
      console.log(`[STAFF ALL-SHIFTS CLICK] Staff user clicked shift ${shift.id} - no action defined`);
    }}>
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
          {/* Filter View Options */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
              <Filter className="h-4 w-4" />
              <span>Filter:</span>
            </div>
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <button
                onClick={() => setFilterPeriod("all")}
                className={`px-3 py-1.5 text-sm font-medium rounded-l-lg transition-colors ${
                  filterPeriod === "all"
                    ? "bg-blue-500 text-white"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                All Shifts
              </button>
              <button
                onClick={() => setFilterPeriod("daily")}
                className={`px-3 py-1.5 text-sm font-medium border-x border-gray-200 dark:border-gray-700 transition-colors ${
                  filterPeriod === "daily"
                    ? "bg-blue-500 text-white"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => setFilterPeriod("weekly")}
                className={`px-3 py-1.5 text-sm font-medium border-x border-gray-200 dark:border-gray-700 transition-colors ${
                  filterPeriod === "weekly"
                    ? "bg-blue-500 text-white"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                Weekly
              </button>
              <button
                onClick={() => setFilterPeriod("fortnightly")}
                className={`px-3 py-1.5 text-sm font-medium border-x border-gray-200 dark:border-gray-700 transition-colors ${
                  filterPeriod === "fortnightly"
                    ? "bg-blue-500 text-white"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                Fortnightly
              </button>
              <button
                onClick={() => setFilterPeriod("monthly")}
                className={`px-3 py-1.5 text-sm font-medium border-x border-gray-200 dark:border-gray-700 transition-colors ${
                  filterPeriod === "monthly"
                    ? "bg-blue-500 text-white"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setFilterPeriod("yearly")}
                className={`px-3 py-1.5 text-sm font-medium rounded-r-lg transition-colors ${
                  filterPeriod === "yearly"
                    ? "bg-blue-500 text-white"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                Yearly
              </button>
            </div>
          </div>
          
          <ShiftViewToggle viewMode={viewMode} onViewChange={setViewMode} />
          
          {/* Only show New Shift button for roles with shift creation permissions */}
          {(() => {
            const userRole = user?.role?.toLowerCase();
            const isAdminRole = userRole === "admin" || userRole === "consolemanager" || userRole === "coordinator" || userRole === "teamleader";
            return isAdminRole;
          })() && (
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
        <>
          <RecurringEditChoiceDialog
            isOpen={isRecurringChoiceDialogOpen}
            onClose={() => {
              setIsRecurringChoiceDialogOpen(false);
              setSelectedShift(null);
            }}
            shift={selectedShift}
            onEditSingle={() => {
              setEditType("single");
              setIsRecurringChoiceDialogOpen(false);
              setIsEditModalOpen(true);
            }}
            onEditSeries={() => {
              setEditType("series");
              setIsRecurringChoiceDialogOpen(false);
              setIsEditModalOpen(true);
            }}
            onEditFuture={() => {
              setEditType("single");
              setIsRecurringChoiceDialogOpen(false);
              setIsEditModalOpen(true);
            }}
          />
          
          <EditShiftModal
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false);
              setSelectedShift(null);
            }}
            shift={selectedShift}
            editType={editType}
          />
        </>
      )}
    </div>
  );
}