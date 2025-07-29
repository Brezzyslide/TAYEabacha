import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { type Shift } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import ShiftViewToggle from "./ShiftViewToggle";
import ShiftCalendarView from "./ShiftCalendarView";
import ShiftRequestConfirmDialog from "./ShiftRequestConfirmDialog";
import NewShiftModal from "./NewShiftModal";
import EditShiftModal from "./EditShiftModal";
import EditRecurringShiftModal from "./EditRecurringShiftModal";
import RecurringEditChoiceDialog from "./RecurringEditChoiceDialog";
import { CaseNoteCornerIndicator, CaseNoteStatusBorder } from "./CaseNoteStatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, MapPin, Users, UserCheck, UserX, TrendingUp, CheckCircle, PlayCircle, Plus, Filter } from "lucide-react";
import { format, isToday, isTomorrow, isYesterday, startOfWeek, endOfWeek, startOfDay, endOfDay, addDays, subDays } from "date-fns";

type FilterPeriod = "daily" | "weekly" | "fortnightly" | "monthly" | "yearly";

export default function ShiftCalendarTab() {
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [selectedShiftForRequest, setSelectedShiftForRequest] = useState<Shift | null>(null);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [isNewShiftModalOpen, setIsNewShiftModalOpen] = useState(false);
  const [isEditShiftModalOpen, setIsEditShiftModalOpen] = useState(false);
  const [isRecurringEditModalOpen, setIsRecurringEditModalOpen] = useState(false);
  const [selectedShiftForEdit, setSelectedShiftForEdit] = useState<Shift | null>(null);
  const [isRecurringChoiceDialogOpen, setIsRecurringChoiceDialogOpen] = useState(false);
  const [editType, setEditType] = useState<"single" | "future" | "series">("single");
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>("monthly");
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shifts = [], isLoading } = useQuery<Shift[]>({
    queryKey: ["/api/shifts"],
    refetchInterval: 10000, // Reduced to 10 seconds for better responsiveness
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
  });

  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
  });

  const { data: caseNotes = [] } = useQuery({
    queryKey: ["/api/case-notes"],
    refetchInterval: 60000,
  });

  // Mutation for requesting shifts
  const requestShiftMutation = useMutation({
    mutationFn: async (shiftId: number) => {
      return apiRequest("PATCH", `/api/shifts/${shiftId}`, {
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

  // Filter shifts by period - strict filtering with complete date collapse
  const filteredShifts = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (filterPeriod) {
      case "daily":
        // Only today's shifts
        startDate = startOfDay(now);
        endDate = endOfDay(now);
        break;
      case "weekly":
        // Only this week's shifts
        startDate = startOfWeek(now);
        endDate = endOfWeek(now);
        break;
      case "fortnightly":
        // Only next 2 weeks from today
        startDate = startOfDay(now);
        endDate = addDays(now, 14);
        break;
      case "monthly":
        // Expanded range for recurring shifts - show 6 months from current month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 6, 0);
        break;
      case "yearly":
        // Full year range for long-term recurring shifts (like 52-week schedules)
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear() + 1, 11, 31);
        break;
      default:
        return shifts;
    }

    console.log(`[FILTER DEBUG] Period: ${filterPeriod}, Range: ${startDate.toDateString()} to ${endDate.toDateString()}`);
    
    const filtered = shifts.filter(shift => {
      if (!shift.startTime) return false;
      try {
        const shiftDate = new Date(shift.startTime);
        const isInRange = shiftDate >= startDate && shiftDate <= endDate;
        
        // Debug filtering for "6" shifts specifically
        if (shift.title === "6") {
          console.log(`[FILTER DEBUG] Shift "${shift.title}" (${shift.id}): date=${shiftDate.toDateString()}, inRange=${isInRange}`);
        }
        
        return isInRange;
      } catch (error) {
        console.warn('Invalid shift date:', shift);
        return false;
      }
    });
    
    console.log(`[FILTER DEBUG] Filtered from ${shifts.length} to ${filtered.length} shifts`);
    return filtered;
  }, [shifts, filterPeriod]);

  // All shifts to display in calendar (filtered)
  const allViewableShifts = useMemo(() => {
    return filteredShifts;
  }, [filteredShifts]);

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

  const hasCaseNoteForShift = (shiftId: number) => {
    return (caseNotes as any[]).some(note => note.shiftId === shiftId);
  };

  const getStaffName = (userId: number | null) => {
    if (!userId) return "Unassigned";
    const staff = (users as any[]).find(u => u.id === userId);
    return staff?.username || "Unknown staff";
  };

  const renderShiftCard = (shift: Shift) => (
    <Card key={shift.id} className="hover:shadow-md transition-shadow cursor-pointer" 
          onClick={() => {
            // BULLETPROOF ADMIN ROLE CHECK: Case-insensitive with comprehensive role coverage
            const userRole = user?.role?.toLowerCase();
            const isAdminRole = userRole === "admin" || userRole === "consolemanager" || userRole === "coordinator" || userRole === "teamleader";
            
            if (isAdminRole) {
              console.log(`[ADMIN CARD CLICK] Admin user ${user.role} clicked shift ${shift.id}, opening edit modal`);
              setSelectedShiftForEdit(shift);
              setIsEditShiftModalOpen(true);
              return;
            }
            
            // For staff - only handle unassigned shifts for requesting
            if (!shift.userId && (shift as any).status !== "requested") {
              console.log(`[STAFF CARD CLICK] Staff user clicked unassigned shift ${shift.id}`);
              setSelectedShiftForRequest(shift);
              setIsRequestDialogOpen(true);
              return;
            }
          }}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold">{shift.title}</CardTitle>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-1">
              <Calendar className="h-4 w-4" />
              {formatShiftDate(shift.startTime)} - {format(new Date(shift.startTime), "h:mm a")} to {shift.endTime ? format(new Date(shift.endTime), "h:mm a") : "TBD"}
            </div>
          </div>
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
            shift.userId ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
            'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          }`}>
            {shift.userId ? 'Assigned' : 'Available'}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-500" />
            <span className="font-medium">Staff:</span>
            <span className={shift.userId ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
              {getStaffName(shift.userId)}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-500" />
            <span className="font-medium">Client:</span>
            <span>{getClientName(shift.clientId)}</span>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <span className="font-medium">Duration:</span>
            <span>{format(new Date(shift.startTime), "MMM d, h:mm a")} - {shift.endTime ? format(new Date(shift.endTime), "h:mm a") : "TBD"}</span>
          </div>
        </div>

        {(shift as any).description && (
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {(shift as any).description}
            </p>
          </div>
        )}

        {!shift.userId && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Click to request this shift
            </p>
          </div>
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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Shift Calendar</h2>
          <p className="text-gray-600 dark:text-gray-400">
            View all shifts and request available ones
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Calendar View Options */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
              <Calendar className="h-4 w-4" />
              <span>View:</span>
            </div>
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <button
                onClick={() => setFilterPeriod("daily")}
                className={`px-3 py-1.5 text-sm font-medium rounded-l-lg transition-colors ${
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
          filterPeriod={filterPeriod}
          onShiftClick={(shift) => {
            // BULLETPROOF ADMIN ROLE CHECK: Case-insensitive with comprehensive role coverage
            const userRole = user?.role?.toLowerCase();
            const isAdminRole = userRole === "admin" || userRole === "consolemanager" || userRole === "coordinator" || userRole === "teamleader";
            
            if (isAdminRole) {
              console.log(`[ADMIN SHIFT CLICK] Admin user ${user.role} clicked shift ${shift.id}, checking if recurring`);
              setSelectedShiftForEdit(shift);
              
              // Check if this is a recurring shift
              if (shift.isRecurring && shift.seriesId) {
                console.log(`[RECURRING SHIFT] Opening choice dialog for recurring shift series ${shift.seriesId}`);
                setIsRecurringChoiceDialogOpen(true);
              } else {
                console.log(`[SINGLE SHIFT] Opening edit modal directly for single shift`);
                setEditType("single");
                setIsEditShiftModalOpen(true);
              }
              return;
            }
            
            // For staff - only handle unassigned shifts for requesting
            if (!shift.userId && (shift as any).status !== "requested") {
              console.log(`[STAFF SHIFT CLICK] Staff user clicked unassigned shift ${shift.id}`);
              setSelectedShiftForRequest(shift);
              setIsRequestDialogOpen(true);
              return;
            }
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

      <NewShiftModal
        open={isNewShiftModalOpen}
        onOpenChange={setIsNewShiftModalOpen}
      />

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

      {selectedShiftForEdit && (
        <>
          <RecurringEditChoiceDialog
            isOpen={isRecurringChoiceDialogOpen}
            onClose={() => {
              setIsRecurringChoiceDialogOpen(false);
              setSelectedShiftForEdit(null);
            }}
            shift={selectedShiftForEdit}
            onEditSingle={() => {
              setEditType("single");
              setIsRecurringChoiceDialogOpen(false);
              setIsEditShiftModalOpen(true);
            }}
            onEditFuture={() => {
              setEditType("future");
              setIsRecurringChoiceDialogOpen(false);
              setIsRecurringEditModalOpen(true);
            }}
            onEditSeries={() => {
              setEditType("series");
              setIsRecurringChoiceDialogOpen(false);
              setIsRecurringEditModalOpen(true);
            }}
          />
          
          <EditShiftModal
            isOpen={isEditShiftModalOpen && editType === "single"}
            onClose={() => {
              setIsEditShiftModalOpen(false);
              setSelectedShiftForEdit(null);
            }}
            shift={selectedShiftForEdit}
            editType={editType}
          />
          
          <EditRecurringShiftModal
            isOpen={isRecurringEditModalOpen}
            onClose={() => {
              setIsRecurringEditModalOpen(false);
              setSelectedShiftForEdit(null);
            }}
            shift={selectedShiftForEdit}
            editType={editType === "future" || editType === "series" ? editType : "series"}
          />
        </>
      )}
    </div>
  );
}