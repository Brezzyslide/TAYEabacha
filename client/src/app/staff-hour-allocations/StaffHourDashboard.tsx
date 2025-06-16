import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Users, Clock, TrendingUp, Calendar, Grid, List, Download, Edit } from "lucide-react";
import CreateAllocationModal from "./components/CreateAllocationModal";
import EditAllocationModal from "./components/EditAllocationModal";
import StaffAllocationCard from "./components/StaffAllocationCard";
import { HourAllocation, User } from "@shared/schema";
import { PermissionGuard } from "@/components/auth/PermissionGuard";

interface DashboardStats {
  totalAllocations: number;
  weeklyAllocations: number;
  fortnightlyAllocations: number;
  totalShifts: number;
  totalShiftHours: number;
  allocatedHours: number;
  unallocatedHours: number;
  allocationRate: number;
}

export default function StaffHourDashboard() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [editingAllocation, setEditingAllocation] = useState<HourAllocation | null>(null);
  
  console.log("[StaffHourDashboard] Modal state:", isCreateModalOpen);

  // Fetch current user
  const { data: user } = useQuery<User>({
    queryKey: ['/api/user'],
  });

  // Fetch allocations
  const { data: allAllocations = [], isLoading: allocationsLoading } = useQuery<HourAllocation[]>({
    queryKey: ['/api/hour-allocations'],
  });

  // Filter allocations based on user role
  const allocations = user?.role === 'SupportWorker' 
    ? allAllocations.filter(allocation => allocation.staffId === user.id)
    : allAllocations;

  // Fetch staff members to map staff IDs to names
  const { data: staffMembers = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Helper function to get staff name by ID
  const getStaffName = (staffId: number) => {
    const staff = staffMembers.find(s => s.id === staffId);
    return staff ? staff.fullName || staff.username : `Staff ${staffId}`;
  };

  // Excel export function
  const exportToExcel = () => {
    const csvData = allocations.map(allocation => ({
      'Staff Name': getStaffName(allocation.staffId),
      'Allocation Period': allocation.allocationPeriod,
      'Max Hours': allocation.maxHours,
      'Hours Used': allocation.hoursUsed,
      'Remaining Hours': allocation.remainingHours,
      'Utilization %': Math.round((parseFloat(allocation.hoursUsed) / parseFloat(allocation.maxHours)) * 100),
      'Status': allocation.isActive ? 'Active' : 'Inactive',
      'Created Date': new Date(allocation.createdAt).toLocaleDateString()
    }));

    const csvContent = [
      Object.keys(csvData[0] || {}).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `staff-hour-allocations-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  // Calculate role-based stats from filtered allocations
  const stats = {
    totalAllocations: allocations.length,
    weeklyAllocations: allocations.filter(a => a.allocationPeriod === 'weekly').length,
    fortnightlyAllocations: allocations.filter(a => a.allocationPeriod === 'fortnightly').length,
    totalShifts: 0, // Would need shift data integration
    totalShiftHours: allocations.reduce((sum, a) => sum + parseFloat(a.hoursUsed), 0),
    allocatedHours: allocations.reduce((sum, a) => sum + parseFloat(a.maxHours), 0),
    unallocatedHours: allocations.reduce((sum, a) => sum + parseFloat(a.remainingHours), 0),
    allocationRate: allocations.length > 0 
      ? Math.round((allocations.reduce((sum, a) => sum + parseFloat(a.hoursUsed), 0) / 
         allocations.reduce((sum, a) => sum + parseFloat(a.maxHours), 0)) * 100)
      : 0,
  };

  // Get appropriate page title based on user role
  const getPageTitle = () => {
    if (user?.role === 'SupportWorker') {
      return "My Hour Allocation";
    }
    return "Staff Hour Allocations";
  };

  // Get appropriate description based on user role
  const getPageDescription = () => {
    if (user?.role === 'SupportWorker') {
      return "View your personal working hour allocation and usage";
    }
    return "Manage staff working hour caps and prevent overscheduling";
  };

  if (allocationsLoading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {getPageTitle()}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {getPageDescription()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === 'card' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('card')}
              className="rounded-r-none"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          {/* Export Button */}
          {allocations.length > 0 && (
            <Button variant="outline" onClick={exportToExcel}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}

          {/* Create Button */}
          <PermissionGuard module="hour-allocations" action="create">
            <Button onClick={() => {
              console.log("[StaffHourDashboard] New Allocation button clicked - setting modal to true");
              setIsCreateModalOpen(true);
              setTimeout(() => {
                console.log("[StaffHourDashboard] Modal state after timeout:", isCreateModalOpen);
              }, 100);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              New Allocation
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {/* Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Allocations</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAllocations}</div>
            <p className="text-xs text-muted-foreground">
              Active staff allocations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Allocations</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.weeklyAllocations}</div>
            <p className="text-xs text-muted-foreground">
              Weekly period allocations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fortnightly Allocations</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.fortnightlyAllocations}</div>
            <p className="text-xs text-muted-foreground">
              Fortnightly period allocations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Allocation Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.allocationRate}%</div>
            <p className="text-xs text-muted-foreground">
              Hours allocated vs available
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Shift Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Shift Analytics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Shifts</span>
              <Badge variant="outline">{stats.totalShifts} shifts</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Hours</span>
              <Badge variant="outline">{stats.totalShiftHours}h</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Allocated Hours</span>
              <Badge variant="secondary">{stats.allocatedHours}h</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Available Hours</span>
              <Badge variant="default">{stats.unallocatedHours}h</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Workforce Planning
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Coverage Status</span>
                <span className="font-medium">{stats.allocationRate}% utilized</span>
              </div>
              <Progress value={stats.allocationRate} className="h-2" />
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="text-center">
                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                  {stats.allocatedHours}h
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Allocated</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {stats.unallocatedHours}h
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Available</div>
              </div>
            </div>

            <div className="pt-2 text-sm text-gray-600 dark:text-gray-400">
              {stats.allocationRate > 90 ? (
                <span className="text-amber-600 dark:text-amber-400">⚠ High utilization - consider additional staff</span>
              ) : stats.allocationRate < 60 ? (
                <span className="text-green-600 dark:text-green-400">✓ Good capacity available</span>
              ) : (
                <span className="text-blue-600 dark:text-blue-400">→ Optimal utilization range</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Allocations */}
      <Card>
        <CardHeader>
          <CardTitle>Current Allocations</CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Manage individual staff hour allocations and monitor usage
          </p>
        </CardHeader>
        <CardContent>
          {allocations.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No allocations yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Create your first staff hour allocation to start managing working hours.
              </p>
              <PermissionGuard module="hour-allocations" action="create">
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Allocation
                </Button>
              </PermissionGuard>
            </div>
          ) : viewMode === 'card' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allocations.map((allocation) => (
                <Card key={allocation.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {getStaffName(allocation.staffId)}
                    </CardTitle>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Calendar className="h-3 w-3" />
                      <Badge variant="outline" className="text-xs">
                        {allocation.allocationPeriod === "weekly" ? "Weekly" : "Fortnightly"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white">
                          {parseFloat(allocation.hoursUsed).toFixed(1)}h
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Used</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white">
                          {parseFloat(allocation.maxHours).toFixed(1)}h
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Max</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-green-600 dark:text-green-400">
                          {parseFloat(allocation.remainingHours).toFixed(1)}h
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Remaining</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Progress</span>
                        <span className="font-medium">
                          {Math.round((parseFloat(allocation.hoursUsed) / parseFloat(allocation.maxHours)) * 100)}%
                        </span>
                      </div>
                      <Progress 
                        value={Math.min((parseFloat(allocation.hoursUsed) / parseFloat(allocation.maxHours)) * 100, 100)} 
                        className="h-2" 
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setEditingAllocation(allocation)}
                        className="flex-1"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            // List View
            <div className="space-y-2">
              <div className="grid grid-cols-7 gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300">
                <div>Staff Name</div>
                <div>Period</div>
                <div>Max Hours</div>
                <div>Used Hours</div>
                <div>Remaining</div>
                <div>Utilization</div>
                <div>Actions</div>
              </div>
              {allocations.map((allocation) => {
                const usedHours = parseFloat(allocation.hoursUsed);
                const maxHours = parseFloat(allocation.maxHours);
                const utilization = Math.round((usedHours / maxHours) * 100);
                
                return (
                  <div key={allocation.id} className="grid grid-cols-7 gap-4 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 items-center">
                    <div className="font-medium">{getStaffName(allocation.staffId)}</div>
                    <div>
                      <Badge variant="outline" className="text-xs">
                        {allocation.allocationPeriod === "weekly" ? "Weekly" : "Fortnightly"}
                      </Badge>
                    </div>
                    <div>{maxHours.toFixed(1)}h</div>
                    <div>{usedHours.toFixed(1)}h</div>
                    <div className="text-green-600 dark:text-green-400">
                      {parseFloat(allocation.remainingHours).toFixed(1)}h
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${utilization > 90 ? 'text-red-600' : utilization > 70 ? 'text-amber-600' : 'text-green-600'}`}>
                        {utilization}%
                      </span>
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all ${utilization > 90 ? 'bg-red-500' : utilization > 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                          style={{ width: `${Math.min(utilization, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setEditingAllocation(allocation)}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      
      <CreateAllocationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
      
      <EditAllocationModal
        allocation={editingAllocation}
        onClose={() => setEditingAllocation(null)}
      />
    </div>
  );
}