import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Users, Plus, TrendingUp, AlertCircle } from "lucide-react";
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

export default function ShiftCalendar() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Fetch all shifts for the current company
  const { data: shifts = [], isLoading } = useQuery<Shift[]>({
    queryKey: ["/api/shifts"],
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

            {/* Calendar View */}
            <Card>
              <CardHeader>
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
                    {/* Shift List */}
                    <div className="grid gap-4">
                      {filteredShifts.map((shift) => {
                        const status = getShiftStatus(shift);
                        return (
                          <div
                            key={shift.id}
                            className={`p-4 rounded-lg border-2 ${getStatusColor(status)} hover:shadow-md transition-shadow cursor-pointer`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <h4 className="font-medium text-gray-900">
                                    Shift #{shift.id}
                                  </h4>
                                  <Badge 
                                    variant={status === 'unassigned' ? 'secondary' : 'default'}
                                    className="capitalize"
                                  >
                                    {status.replace('-', ' ')}
                                  </Badge>
                                </div>
                                <div className="mt-1 flex items-center space-x-4 text-sm text-gray-600">
                                  <div className="flex items-center space-x-1">
                                    <Calendar className="h-3 w-3" />
                                    <span>{formatDate(shift.startTime)}</span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <Clock className="h-3 w-3" />
                                    <span>
                                      {formatTime(shift.startTime)} - {shift.endTime ? formatTime(shift.endTime) : 'Ongoing'}
                                    </span>
                                  </div>
                                  {shift.userId && (
                                    <div className="flex items-center space-x-1">
                                      <Users className="h-3 w-3" />
                                      <span>Staff ID: {shift.userId}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                {status === 'unassigned' && !userIsAdmin && (
                                  <Button size="sm" variant="outline">
                                    Request Shift
                                  </Button>
                                )}
                                {status === 'assigned' && shift.userId === user?.id && (
                                  <Button size="sm">
                                    Start Shift
                                  </Button>
                                )}
                                {status === 'in-progress' && shift.userId === user?.id && (
                                  <Button size="sm" variant="destructive">
                                    End Shift
                                  </Button>
                                )}
                                {userIsAdmin && (
                                  <Button size="sm" variant="ghost">
                                    Edit
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
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