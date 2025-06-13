import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Clock, Users, Plus, TrendingUp, AlertCircle, Grid, List, CalendarDays } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { isAdmin } from "@/lib/auth";
import { Shift } from "@shared/schema";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

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
                                      <Button size="sm" variant="ghost" className="w-full">
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
                                      <Button size="sm" variant="ghost">
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
                      <div className="space-y-6">
                        {/* Calendar Header */}
                        <div className="text-center">
                          <h3 className="text-lg font-semibold text-gray-900">Shift Calendar</h3>
                          <p className="text-sm text-gray-500">Shifts organized by date</p>
                        </div>
                        
                        {/* Calendar Grid */}
                        <div className="space-y-6">
                          {Object.entries(
                            filteredShifts
                              .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                              .reduce((groups: { [key: string]: Shift[] }, shift) => {
                                const date = formatDate(shift.startTime);
                                if (!groups[date]) groups[date] = [];
                                groups[date].push(shift);
                                return groups;
                              }, {} as { [key: string]: Shift[] })
                          ).map(([date, dateShifts]: [string, Shift[]]) => (
                            <div key={date} className="bg-white border rounded-lg shadow-sm">
                              {/* Date Header */}
                              <div className="bg-gray-50 px-4 py-3 border-b rounded-t-lg">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-semibold text-gray-900 flex items-center space-x-2">
                                    <Calendar className="h-4 w-4" />
                                    <span>{date}</span>
                                  </h4>
                                  <span className="text-sm text-gray-600">
                                    {dateShifts.length} shift{dateShifts.length !== 1 ? 's' : ''}
                                  </span>
                                </div>
                              </div>
                              
                              {/* Shifts for this date */}
                              <div className="p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {dateShifts.map((shift) => {
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
                                            <CardTitle className="text-base">Shift #{shift.id}</CardTitle>
                                            <Badge 
                                              variant={status === 'unassigned' ? 'secondary' : 'default'}
                                              className="capitalize text-xs"
                                            >
                                              {status.replace('-', ' ')}
                                            </Badge>
                                          </div>
                                        </CardHeader>
                                        <CardContent className="space-y-2">
                                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                                            <Clock className="h-3 w-3" />
                                            <span>
                                              {formatTime(shift.startTime)} - {shift.endTime ? formatTime(shift.endTime) : 'Ongoing'}
                                            </span>
                                          </div>
                                          {shift.userId && (
                                            <div className="flex items-center space-x-2 text-sm text-gray-600">
                                              <Users className="h-3 w-3" />
                                              <span>Staff ID: {shift.userId}</span>
                                            </div>
                                          )}
                                          
                                          {/* Action buttons */}
                                          <div className="pt-2">
                                            {status === 'unassigned' && !userIsAdmin && (
                                              <Button size="sm" variant="outline" className="w-full text-xs">
                                                Request Shift
                                              </Button>
                                            )}
                                            {status === 'assigned' && shift.userId === user?.id && (
                                              <Button size="sm" className="w-full text-xs">
                                                Start Shift
                                              </Button>
                                            )}
                                            {status === 'in-progress' && shift.userId === user?.id && (
                                              <Button size="sm" variant="destructive" className="w-full text-xs">
                                                End Shift
                                              </Button>
                                            )}
                                            {userIsAdmin && (
                                              <Button size="sm" variant="ghost" className="w-full text-xs">
                                                Edit Shift
                                              </Button>
                                            )}
                                          </div>
                                        </CardContent>
                                      </Card>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          {/* Empty state for calendar view */}
                          {filteredShifts.length === 0 && (
                            <div className="text-center py-12">
                              <CalendarDays className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                              <h3 className="text-lg font-medium text-gray-900 mb-2">No shifts scheduled</h3>
                              <p className="text-sm text-gray-500 mb-4">
                                {userIsAdmin 
                                  ? "Create new shifts to see them organized by date in the calendar view." 
                                  : "No shifts have been assigned to you yet."
                                }
                              </p>
                              {userIsAdmin && (
                                <Button className="mt-2">
                                  <Plus className="h-4 w-4 mr-2" />
                                  Create New Shift
                                </Button>
                              )}
                            </div>
                          )}
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
    </div>
  );
}