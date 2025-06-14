import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Users, Clock, TrendingUp, Calendar } from "lucide-react";
import CreateAllocationModal from "./components/CreateAllocationModal";
import StaffAllocationCard from "./components/StaffAllocationCard";
import { HourAllocation } from "@shared/schema";

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

  // Fetch allocations
  const { data: allocations = [], isLoading: allocationsLoading } = useQuery<HourAllocation[]>({
    queryKey: ['/api/hour-allocations'],
  });

  // Fetch dashboard stats
  const { data: stats = {
    totalAllocations: 0,
    weeklyAllocations: 0,
    fortnightlyAllocations: 0,
    totalShifts: 0,
    totalShiftHours: 0,
    allocatedHours: 0,
    unallocatedHours: 0,
    allocationRate: 0,
  }, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/hour-allocations/stats'],
  });

  if (allocationsLoading || statsLoading) {
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Staff Hour Allocations
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage staff working hour caps and prevent overscheduling
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Allocation
        </Button>
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
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Allocation
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allocations.map((allocation) => (
                <StaffAllocationCard
                  key={allocation.id}
                  allocation={allocation}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Allocation Modal */}
      <CreateAllocationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}