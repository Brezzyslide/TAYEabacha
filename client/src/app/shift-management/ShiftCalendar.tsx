import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Clock, Users, Plus, TrendingUp, AlertCircle, Grid, List, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { isAdmin } from "@/lib/auth";
import { Shift } from "@shared/schema";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { EditShiftModal } from "./components/EditShiftModal";

interface ShiftAnalytics {
  totalShifts: number;
  assignedShifts: number;
  unassignedShifts: number;
}

type ViewMode = "card" | "list" | "calendar";

export default function ShiftCalendar() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);

  // Fetch all shifts for the current company (tenant)
  const { data: shifts = [], isLoading } = useQuery<Shift[]>({
    queryKey: ["/api/shifts", user?.tenantId],
    enabled: !!user,
  });

  // Calculate analytics for admin users
  const analytics: ShiftAnalytics = useMemo(() => {
    if (!shifts.length) {
      return { totalShifts: 0, assignedShifts: 0, unassignedShifts: 0 };
    }

    const totalShifts = shifts.length;
    const assignedShifts = shifts.filter(shift => shift.userId !== null).length;
    const unassignedShifts = totalShifts - assignedShifts;

    return { totalShifts, assignedShifts, unassignedShifts };
  }, [shifts]);

  const userIsAdmin = user && isAdmin(user as any);

  // Filter shifts based on user role
  const filteredShifts = useMemo(() => {
    if (!user || !shifts.length) return [];
    
    if (userIsAdmin) {
      // Admins see all company shifts
      return shifts;
    } else {
      // Staff see only their assigned shifts or unassigned ones
      return shifts.filter(shift => 
        shift.userId === user.id || shift.userId === null
      );
    }
  }, [shifts, user, userIsAdmin]);

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (date: Date | string) => {
    return new Date(date).toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getShiftStatus = (shift: Shift) => {
    if (shift.endTime) return 'completed';
    if (shift.userId === null) return 'unassigned';
    if (shift.startTime && !shift.endTime) return 'in-progress';
    return 'assigned';
  };

  // Calendar utility functions
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getMonthName = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  };

  const getShiftsForDate = (date: Date) => {
    return filteredShifts.filter(shift => {
      const shiftDate = new Date(shift.startTime);
      return isSameDay(shiftDate, date);
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDayOfMonth = getFirstDayOfMonth(currentDate);
    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
    }

    return days;
  };

  const handleEditShift = (shiftId: number) => {
    // Only allow Coordinator, Admin, or ConsoleManager to edit shifts
    if (user && ["Coordinator", "Admin", "ConsoleManager"].includes(user.role)) {
      setSelectedShiftId(shiftId);
      setEditModalOpen(true);
    }
  };

  const handleCloseEditModal = () => {
    setEditModalOpen(false);
    setSelectedShiftId(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'unassigned': return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'assigned': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'in-progress': return 'bg-green-100 text-green-700 border-green-300';
      case 'completed': return 'bg-purple-100 text-purple-700 border-purple-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <Header />
        
        <main className="flex-1 p-6">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Shift Calendar</h1>
                <p className="text-gray-600 mt-1">
                  {userIsAdmin ? "Manage all company shifts" : "View your assigned shifts"}
                </p>
              </div>
              
              {userIsAdmin && (
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Shift
                </Button>
              )}
            </div>

            {/* Analytics Panel - Admin Only */}
            {userIsAdmin && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total Shifts */}
                <Card className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-gray-600">
                        Total Shifts
                      </CardTitle>
                      <Calendar className="h-4 w-4 text-blue-500" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900">
                      {analytics.totalShifts}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      All shifts in company
                    </p>
                  </CardContent>
                </Card>

                {/* Assigned Shifts */}
                <Card className="border-l-4 border-l-green-500">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-gray-600">
                        Assigned Shifts
                      </CardTitle>
                      <Users className="h-4 w-4 text-green-500" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900">
                      {analytics.assignedShifts}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {analytics.totalShifts > 0 
                        ? `${Math.round((analytics.assignedShifts / analytics.totalShifts) * 100)}% of total`
                        : "No shifts yet"
                      }
                    </p>
                  </CardContent>
                </Card>

                {/* Unassigned Shifts */}
                <Card className="border-l-4 border-l-orange-500">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-gray-600">
                        Unassigned Shifts
                      </CardTitle>
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900">
                      {analytics.unassignedShifts}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {analytics.unassignedShifts > 0 
                        ? "Require staff assignment"
                        : "All shifts assigned"
                      }
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* View Controls and Content */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <Calendar className="h-5 w-5" />
                      <span>Shifts Overview</span>
                    </CardTitle>
                    <CardDescription>
                      {userIsAdmin 
                        ? "All company shifts organized by date" 
                        : "Your assigned shifts and available opportunities"
                      }
                    </CardDescription>
                  </div>
                  
                  {/* View Toggle Controls */}
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-700">View:</span>
                    <div className="flex items-center border rounded-md">
                      <Toggle
                        pressed={viewMode === "card"}
                        onPressedChange={() => setViewMode("card")}
                        className="rounded-r-none border-r"
                        size="sm"
                      >
                        <Grid className="h-4 w-4" />
                      </Toggle>
                      <Toggle
                        pressed={viewMode === "list"}
                        onPressedChange={() => setViewMode("list")}
                        className="rounded-none border-r"
                        size="sm"
                      >
                        <List className="h-4 w-4" />
                      </Toggle>
                      <Toggle
                        pressed={viewMode === "calendar"}
                        onPressedChange={() => setViewMode("calendar")}
                        className="rounded-l-none"
                        size="sm"
                      >
                        <CalendarDays className="h-4 w-4" />
                      </Toggle>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : filteredShifts.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No shifts found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {userIsAdmin 
                        ? "Create your first shift to get started" 
                        : "No shifts have been assigned to you yet"
                      }
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Card View */}
                    {viewMode === "card" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredShifts.map((shift) => {
                          const status = getShiftStatus(shift);
                          return (
                            <Card
                              key={shift.id}
                              className={`border-l-4 hover:shadow-md transition-shadow cursor-pointer ${
                                status === 'unassigned' ? 'border-l-gray-400' :
                                status === 'assigned' ? 'border-l-blue-500' :
                                status === 'in-progress' ? 'border-l-green-500' : 'border-l-purple-500'
                              }`}
                            >
                              <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-lg">Shift #{shift.id}</CardTitle>
                                  <Badge 
                                    variant={status === 'unassigned' ? 'secondary' : 'default'}
                                    className="capitalize"
                                  >
                                    {status.replace('-', ' ')}
                                  </Badge>
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-2">
                                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                                    <Calendar className="h-4 w-4" />
                                    <span>{formatDate(shift.startTime)}</span>
                                  </div>
                                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                                    <Clock className="h-4 w-4" />
                                    <span>
                                      {formatTime(shift.startTime)} - {shift.endTime ? formatTime(shift.endTime) : 'Ongoing'}
                                    </span>
                                  </div>
                                  {shift.userId && (
                                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                                      <Users className="h-4 w-4" />
                                      <span>Staff ID: {shift.userId}</span>
                                    </div>
                                  )}
                                  <div className="pt-2 flex space-x-2">
                                    {status === 'unassigned' && !userIsAdmin && (
                                      <Button size="sm" variant="outline" className="w-full">
                                        Request Shift
                                      </Button>
                                    )}
                                    {status === 'assigned' && shift.userId === user?.id && (
                                      <Button size="sm" className="w-full">
                                        Start Shift
                                      </Button>
                                    )}
                                    {status === 'in-progress' && shift.userId === user?.id && (
                                      <Button size="sm" variant="destructive" className="w-full">
                                        End Shift
                                      </Button>
                                    )}
                                    {userIsAdmin && (
                                      <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        className="w-full"
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
                    )}

                    {/* List View */}
                    {viewMode === "list" && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Shift ID</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Time</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Assigned To</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredShifts.map((shift) => {
                            const status = getShiftStatus(shift);
                            return (
                              <TableRow key={shift.id} className="hover:bg-gray-50">
                                <TableCell className="font-medium">#{shift.id}</TableCell>
                                <TableCell>{formatDate(shift.startTime)}</TableCell>
                                <TableCell>
                                  {formatTime(shift.startTime)} - {shift.endTime ? formatTime(shift.endTime) : 'Ongoing'}
                                </TableCell>
                                <TableCell>
                                  <Badge 
                                    variant={status === 'unassigned' ? 'secondary' : 'default'}
                                    className="capitalize"
                                  >
                                    {status.replace('-', ' ')}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {shift.userId ? `Staff ID: ${shift.userId}` : 'Unassigned'}
                                </TableCell>
                                <TableCell>
                                  <div className="flex space-x-2">
                                    {status === 'unassigned' && !userIsAdmin && (
                                      <Button size="sm" variant="outline">
                                        Request
                                      </Button>
                                    )}
                                    {status === 'assigned' && shift.userId === user?.id && (
                                      <Button size="sm">
                                        Start
                                      </Button>
                                    )}
                                    {status === 'in-progress' && shift.userId === user?.id && (
                                      <Button size="sm" variant="destructive">
                                        End
                                      </Button>
                                    )}
                                    {userIsAdmin && (
                                      <Button 
                                        size="sm" 
                                        variant="ghost"
                                        onClick={() => handleEditShift(shift.id)}
                                      >
                                        Edit
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}

                    {/* Calendar View */}
                    {viewMode === "calendar" && (
                      <div className="space-y-4">
                        {/* Calendar Header */}
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-gray-900">{getMonthName(currentDate)}</h3>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigateMonth('prev')}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigateMonth('next')}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Calendar Grid */}
                        <div className="border rounded-lg overflow-hidden">
                          {/* Day Headers */}
                          <div className="grid grid-cols-7 bg-gray-50 border-b">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                              <div key={day} className="p-3 text-center text-sm font-medium text-gray-700 border-r last:border-r-0">
                                {day}
                              </div>
                            ))}
                          </div>

                          {/* Calendar Days */}
                          <div className="grid grid-cols-7">
                            {generateCalendarDays().map((date, index) => {
                              const dayShifts = date ? getShiftsForDate(date) : [];
                              const isToday = date && isSameDay(date, new Date());
                              
                              return (
                                <div
                                  key={index}
                                  className={`min-h-[120px] p-2 border-r border-b last:border-r-0 ${
                                    date ? 'bg-white hover:bg-gray-50' : 'bg-gray-100'
                                  } ${isToday ? 'bg-blue-50' : ''}`}
                                >
                                  {date && (
                                    <>
                                      {/* Date Number */}
                                      <div className={`text-sm font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                                        {date.getDate()}
                                      </div>

                                      {/* Shift Cards */}
                                      <div className="space-y-1">
                                        {dayShifts.slice(0, 3).map(shift => {
                                          const status = getShiftStatus(shift);
                                          return (
                                            <div
                                              key={shift.id}
                                              className={`text-xs p-1 rounded border cursor-pointer ${getStatusColor(status)}`}
                                              title={`Shift #${shift.id} - ${formatTime(shift.startTime)} ${shift.endTime ? `to ${formatTime(shift.endTime)}` : '(Ongoing)'}`}
                                              onClick={() => handleEditShift(shift.id)}
                                            >
                                              <div className="font-medium truncate">
                                                #{shift.id}
                                              </div>
                                              <div className="truncate">
                                                {formatTime(shift.startTime)}
                                              </div>
                                              {shift.userId && (
                                                <div className="truncate text-xs opacity-75">
                                                  Staff: {shift.userId}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                        
                                        {/* Show overflow indicator */}
                                        {dayShifts.length > 3 && (
                                          <div className="text-xs text-gray-500 p-1">
                                            +{dayShifts.length - 3} more
                                          </div>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Legend */}
                        <div className="flex items-center justify-center space-x-6 text-sm">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded border bg-gray-100 border-gray-300"></div>
                            <span>Unassigned</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded border bg-blue-100 border-blue-300"></div>
                            <span>Assigned</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded border bg-green-100 border-green-300"></div>
                            <span>In Progress</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded border bg-purple-100 border-purple-300"></div>
                            <span>Completed</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
      
      {/* Edit Shift Modal */}
      <EditShiftModal
        isOpen={editModalOpen}
        onClose={handleCloseEditModal}
        shiftId={selectedShiftId}
      />
    </div>
  );
}