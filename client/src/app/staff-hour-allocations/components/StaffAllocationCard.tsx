import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, User, Clock, Calendar } from "lucide-react";
import { HourAllocation, User as UserType } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import CreateAllocationModal from "./CreateAllocationModal";

interface StaffAllocationCardProps {
  allocation: HourAllocation & {
    staff?: UserType;
  };
}

export default function StaffAllocationCard({ allocation }: StaffAllocationCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Fetch staff details if not included
  const { data: staff } = useQuery<UserType>({
    queryKey: ['/api/users', allocation.staffId],
    enabled: !allocation.staff,
  });

  const staffData = allocation.staff || staff;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/hour-allocations/${allocation.id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hour-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/hour-allocations/stats'] });
      toast({
        title: "Allocation deleted",
        description: "Staff hour allocation has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete allocation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this allocation? This action cannot be undone.")) {
      deleteMutation.mutate();
    }
  };

  const maxHours = parseFloat(allocation.maxHours);
  const hoursUsed = parseFloat(allocation.hoursUsed);
  const remainingHours = parseFloat(allocation.remainingHours);
  const usagePercentage = maxHours > 0 ? (hoursUsed / maxHours) * 100 : 0;

  const getStatusColor = () => {
    if (usagePercentage >= 100) return "text-red-600 dark:text-red-400";
    if (usagePercentage >= 80) return "text-amber-600 dark:text-amber-400";
    return "text-green-600 dark:text-green-400";
  };

  const getProgressColor = () => {
    if (usagePercentage >= 100) return "bg-red-500";
    if (usagePercentage >= 80) return "bg-amber-500";
    return "bg-green-500";
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              {staffData?.username || `Staff ID: ${allocation.staffId}`}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditModalOpen(true)}
                className="h-8 w-8 p-0"
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Calendar className="h-3 w-3" />
            <Badge variant="outline" className="text-xs">
              {allocation.allocationPeriod === "weekly" ? "Weekly" : "Fortnightly"}
            </Badge>
            {staffData?.role && (
              <Badge variant="secondary" className="text-xs">
                {staffData.role}
              </Badge>
            )}
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
          <div className="text-xs text-center">
            {usagePercentage >= 100 ? (
              <span className="text-red-600 dark:text-red-400 font-medium">
                ⚠ Over allocated by {(hoursUsed - maxHours).toFixed(1)}h
              </span>
            ) : usagePercentage >= 80 ? (
              <span className="text-amber-600 dark:text-amber-400">
                → Approaching limit ({remainingHours.toFixed(1)}h remaining)
              </span>
            ) : (
              <span className="text-green-600 dark:text-green-400">
                ✓ Within allocation ({remainingHours.toFixed(1)}h available)
              </span>
            )}
          </div>

          {/* Allocation Details */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>
                  {allocation.allocationPeriod === "weekly" ? "Weekly cap" : "Fortnightly cap"}
                </span>
              </div>
              <div>
                {allocation.isActive ? (
                  <Badge variant="default" className="text-xs">Active</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">Inactive</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <CreateAllocationModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        allocationToEdit={allocation}
      />
    </>
  );
}