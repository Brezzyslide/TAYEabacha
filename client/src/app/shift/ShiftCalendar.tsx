import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, Plus, Users, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { type Shift } from "@shared/schema";
import NewShiftModal from "./components/NewShiftModal";
import EditShiftModal from "./components/EditShiftModal";
import ShiftActionButtons from "./components/ShiftActionButtons";

interface ShiftAnalytics {
  totalShifts: number;
  assignedShifts: number;
  unassignedShifts: number;
  inProgressShifts: number;
  completedShifts: number;
}

type ViewMode = "calendar" | "list" | "kanban";

export default function ShiftCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);
  const [isNewShiftModalOpen, setIsNewShiftModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const { user } = useAuth();

  const { data: shifts = [], isLoading } = useQuery<Shift[]>({
    queryKey: ["/api/shifts"],
    refetchInterval: 10000, // Reduced to 10 seconds for better responsiveness
  });

  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
  });

  // Role-based filtering
  const filteredShifts = useMemo(() => {
    if (!user) return [];
    
    switch (user.role) {
      case "Staff":
        return shifts.filter(shift => shift.userId === user.id);
      case "TeamLeader":
        return shifts.filter(shift => 
          shift.clientId && clients.some(client => client.assignedStaff?.includes(user.id))
        );
      case "Coordinator":
      case "Admin":
      case "ConsoleManager":
        return shifts;
      default:
        return [];
    }
  }, [shifts, user, clients]);

  const analytics: ShiftAnalytics = useMemo(() => {
    return {
      totalShifts: filteredShifts.length,
      assignedShifts: filteredShifts.filter(shift => shift.userId).length,
      unassignedShifts: filteredShifts.filter(shift => !shift.userId).length,
      inProgressShifts: filteredShifts.filter(shift => shift.isActive).length,
      completedShifts: filteredShifts.filter(shift => !shift.isActive && shift.endTime).length,
    };
  }, [filteredShifts]);

  const getShiftStatus = (shift: Shift) => {
    if (!shift.userId) return "unassigned";
    if (shift.isActive) return "in-progress";
    if (shift.endTime) return "completed";
    return "assigned";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "unassigned": return "bg-gray-100 text-gray-700 border-gray-300";
      case "assigned": return "bg-blue-100 text-blue-700 border-blue-300";
      case "in-progress": return "bg-green-100 text-green-700 border-green-300";
      case "completed": return "bg-purple-100 text-purple-700 border-purple-300";
      default: return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  const formatTime = (dateTime: string | Date) => {
    return format(new Date(dateTime), "HH:mm");
  };

  const formatDate = (dateTime: string | Date) => {
    return format(new Date(dateTime), "MMM dd, yyyy");
  };

  const getDaysInMonth = (date: Date) => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    return eachDayOfInterval({ start, end });
  };

  const getShiftsForDate = (date: Date) => {
    return filteredShifts.filter(shift => 
      isSameDay(new Date(shift.startTime), date)
    );
  };

  const getUserName = (userId: number | null) => {
    if (!userId) return "Unassigned";
    const user = users.find(u => u.id === userId);
    return user ? user.username : "Unknown User";
  };

  const getClientName = (clientId: number | null) => {
    if (!clientId) return "No Client";
    const client = clients.find(c => c.id === clientId);
    return client ? client.fullName : "Unknown Client";
  };

  const handleEditShift = (shiftId: number) => {
    setSelectedShiftId(shiftId);
    setIsEditModalOpen(true);
  };

  const canManageShifts = user?.role === "Coordinator" || user?.role === "Admin" || user?.role === "ConsoleManager";

  const renderCalendarView = () => {
    const days = getDaysInMonth(currentDate);
    
    return (
      <div className="grid grid-cols-7 gap-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
          <div key={day} className="p-2 text-center font-medium text-gray-600 bg-gray-50">
            {day}
          </div>
        ))}
        {days.map(day => {
          const dayShifts = getShiftsForDate(day);
          const isCurrentDay = isToday(day);
          
          return (
            <div
              key={day.toISOString()}
              className={`min-h-24 p-1 border border-gray-200 ${
                isCurrentDay ? "bg-blue-50 border-blue-300" : "bg-white"
              }`}
            >
              <div className={`text-sm font-medium mb-1 ${isCurrentDay ? "text-blue-600" : "text-gray-900"}`}>
                {format(day, "d")}
              </div>
              <div className="space-y-1">
                {dayShifts.slice(0, 3).map(shift => {
                  const status = getShiftStatus(shift);
                  return (
                    <div
                      key={shift.id}
                      className={`text-xs p-1 rounded cursor-pointer hover:opacity-80 ${getStatusColor(status)}`}
                      onClick={() => canManageShifts ? handleEditShift(shift.id) : undefined}
                    >
                      <div className="font-medium truncate">{shift.title || "Untitled Shift"}</div>
                      <div className="truncate">{formatTime(shift.startTime)}</div>
                    </div>
                  );
                })}
                {dayShifts.length > 3 && (
                  <div className="text-xs text-gray-500 text-center">
                    +{dayShifts.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderListView = () => {
    return (
      <div className="space-y-4">
        {filteredShifts.map(shift => {
          const status = getShiftStatus(shift);
          return (
            <Card key={shift.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="font-semibold text-lg">{shift.title || "Untitled Shift"}</h3>
                      <Badge className={getStatusColor(status)}>
                        {status.replace("-", " ")}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm text-gray-600">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(shift.startTime)}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4" />
                        <span>
                          {formatTime(shift.startTime)} - {shift.endTime ? formatTime(shift.endTime) : 'Ongoing'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4" />
                        <span>{getUserName(shift.userId)}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4" />
                        <span>{getClientName(shift.clientId)}</span>
                      </div>
                    </div>
                    {shift.location && (
                      <div className="flex items-center space-x-2 mt-2 text-sm text-gray-600">
                        <MapPin className="h-4 w-4" />
                        <span>{shift.location}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col space-y-2">
                    <ShiftActionButtons shift={shift} />
                    {canManageShifts && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditShift(shift.id)}
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderKanbanView = () => {
    const columns = [
      { status: "unassigned", title: "Unassigned", shifts: filteredShifts.filter(s => !s.userId) },
      { status: "assigned", title: "Assigned", shifts: filteredShifts.filter(s => s.userId && !s.isActive && !s.endTime) },
      { status: "in-progress", title: "In Progress", shifts: filteredShifts.filter(s => s.isActive) },
      { status: "completed", title: "Completed", shifts: filteredShifts.filter(s => !s.isActive && s.endTime) },
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {columns.map(column => (
          <div key={column.status} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">{column.title}</h3>
              <Badge variant="secondary">{column.shifts.length}</Badge>
            </div>
            <div className="space-y-3">
              {column.shifts.map(shift => (
                <Card key={shift.id} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-3">
                    <div className="space-y-2">
                      <h4 className="font-medium">{shift.title || "Untitled Shift"}</h4>
                      <div className="text-sm text-gray-600">
                        <div>{formatDate(shift.startTime)}</div>
                        <div>{formatTime(shift.startTime)} - {shift.endTime ? formatTime(shift.endTime) : 'Ongoing'}</div>
                        <div>{getUserName(shift.userId)}</div>
                        <div>{getClientName(shift.clientId)}</div>
                      </div>
                      <div className="pt-2">
                        <ShiftActionButtons shift={shift} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">Loading shifts...</div>
    );
  }

  return (
    <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Shift Management</h1>
                <p className="text-gray-600 mt-1">Manage and track all shifts across your organization</p>
              </div>
              {canManageShifts && (
                <Button onClick={() => setIsNewShiftModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Shift
                </Button>
              )}
            </div>

            {/* Analytics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Shifts</p>
                      <p className="text-2xl font-bold">{analytics.totalShifts}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">Assigned</p>
                      <p className="text-2xl font-bold">{analytics.assignedShifts}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-orange-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">Unassigned</p>
                      <p className="text-2xl font-bold">{analytics.unassignedShifts}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">In Progress</p>
                      <p className="text-2xl font-bold">{analytics.inProgressShifts}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-purple-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">Completed</p>
                      <p className="text-2xl font-bold">{analytics.completedShifts}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* View Toggle */}
            <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
              <TabsList>
                <TabsTrigger value="calendar">Calendar</TabsTrigger>
                <TabsTrigger value="list">List</TabsTrigger>
                <TabsTrigger value="kanban">Kanban</TabsTrigger>
              </TabsList>

              {/* Calendar Navigation */}
              {viewMode === "calendar" && (
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentDate(new Date(currentDate.getFullYear() - 1, currentDate.getMonth()))}
                    >
                      &lt;&lt;
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                    >
                      Previous
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <h2 className="text-xl font-semibold">
                      {format(currentDate, "MMMM yyyy")}
                    </h2>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCurrentDate(new Date())}
                    >
                      Today
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCurrentDate(new Date(2025, 5, 30))} // June 2025
                    >
                      June 2025
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                    >
                      Next
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentDate(new Date(currentDate.getFullYear() + 1, currentDate.getMonth()))}
                    >
                      &gt;&gt;
                    </Button>
                  </div>
                </div>
              )}

              <TabsContent value="calendar" className="mt-6">
                {renderCalendarView()}
              </TabsContent>

              <TabsContent value="list" className="mt-6">
                {renderListView()}
              </TabsContent>

              <TabsContent value="kanban" className="mt-6">
                {renderKanbanView()}
              </TabsContent>
          </Tabs>

          {/* Modals */}
          <NewShiftModal
            open={isNewShiftModalOpen}
            onOpenChange={setIsNewShiftModalOpen}
          />

          {selectedShiftId && (
            <EditShiftModal
              open={isEditModalOpen}
              onOpenChange={setIsEditModalOpen}
              shiftId={selectedShiftId}
            />
          )}
        </div>
  );
}