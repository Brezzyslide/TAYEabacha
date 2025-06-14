import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, User } from "lucide-react";
import { HourAllocation } from "@shared/schema";

interface MyAllocationCardProps {
  userId: number;
}

export default function MyAllocationCard({ userId }: MyAllocationCardProps) {
  const { data: allocations = [], isLoading } = useQuery<HourAllocation[]>({
    queryKey: ['/api/hour-allocations'],
  });

  const userAllocation = allocations.find(allocation => allocation.staffId === userId && allocation.isActive);

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!userAllocation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4" />
            My Hour Allocation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-gray-600 dark:text-gray-400">
            <Clock className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">No hour allocation assigned</p>
            <p className="text-xs">Contact your team leader to set up your working hours</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxHours = parseFloat(userAllocation.maxHours);
  const hoursUsed = parseFloat(userAllocation.hoursUsed);
  const remainingHours = parseFloat(userAllocation.remainingHours);
  const usagePercentage = maxHours > 0 ? (hoursUsed / maxHours) * 100 : 0;

  const getStatusColor = () => {
    if (usagePercentage >= 100) return "text-red-600 dark:text-red-400";
    if (usagePercentage >= 80) return "text-amber-600 dark:text-amber-400";
    return "text-green-600 dark:text-green-400";
  };

  const getStatusMessage = () => {
    if (usagePercentage >= 100) {
      return `Over allocated by ${(hoursUsed - maxHours).toFixed(1)}h`;
    }
    if (usagePercentage >= 80) {
      return `Approaching limit (${remainingHours.toFixed(1)}h remaining)`;
    }
    return `Within allocation (${remainingHours.toFixed(1)}h available)`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <User className="h-4 w-4" />
          My Hour Allocation
        </CardTitle>
        <div className="flex items-center gap-2">
          <Calendar className="h-3 w-3 text-gray-500" />
          <Badge variant="outline" className="text-xs">
            {userAllocation.allocationPeriod === "weekly" ? "Weekly" : "Fortnightly"}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {userAllocation.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Hours Overview */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {hoursUsed.toFixed(1)}h
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Used</div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {maxHours.toFixed(1)}h
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Max</div>
          </div>
          <div>
            <div className={`text-lg font-bold ${getStatusColor()}`}>
              {remainingHours.toFixed(1)}h
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Remaining</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600 dark:text-gray-400">Progress</span>
            <span className={`font-medium ${getStatusColor()}`}>
              {usagePercentage.toFixed(1)}%
            </span>
          </div>
          <div className="relative">
            <Progress value={Math.min(usagePercentage, 100)} className="h-2" />
            {usagePercentage > 100 && (
              <div className="absolute top-0 left-0 w-full h-2 bg-red-500 rounded-full opacity-75" />
            )}
          </div>
        </div>

        {/* Status Message */}
        <div className="text-center">
          <div className={`text-xs font-medium ${getStatusColor()}`}>
            {usagePercentage >= 100 ? "⚠" : usagePercentage >= 80 ? "→" : "✓"} {getStatusMessage()}
          </div>
        </div>

        {/* Additional Info */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>
                {userAllocation.allocationPeriod === "weekly" ? "Weekly limit" : "Fortnightly limit"}
              </span>
            </div>
            <div>
              Updated {new Date(userAllocation.updatedAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}