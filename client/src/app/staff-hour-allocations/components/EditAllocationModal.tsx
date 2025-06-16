import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { HourAllocation } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface EditAllocationModalProps {
  allocation: HourAllocation | null;
  onClose: () => void;
}

export default function EditAllocationModal({ allocation, onClose }: EditAllocationModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    allocationPeriod: "weekly" as "weekly" | "fortnightly",
    maxHours: 40,
    isActive: true,
  });

  // Update form data when allocation changes
  useEffect(() => {
    if (allocation) {
      setFormData({
        allocationPeriod: allocation.allocationPeriod as "weekly" | "fortnightly",
        maxHours: parseFloat(allocation.maxHours),
        isActive: Boolean(allocation.isActive),
      });
    }
  }, [allocation]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!allocation) throw new Error("No allocation to update");
      return apiRequest("PUT", `/api/hour-allocations/${allocation.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hour-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/hour-allocations/stats'] });
      toast({
        title: "Success",
        description: "Allocation updated successfully",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update allocation",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!allocation) throw new Error("No allocation to delete");
      return apiRequest("DELETE", `/api/hour-allocations/${allocation.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hour-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/hour-allocations/stats'] });
      toast({
        title: "Success",
        description: "Allocation deleted successfully",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete allocation",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const remainingHours = formData.maxHours - parseFloat(allocation?.hoursUsed || "0");
    
    updateMutation.mutate({
      allocationPeriod: formData.allocationPeriod,
      maxHours: formData.maxHours,
      remainingHours: Math.max(0, remainingHours),
      isActive: formData.isActive,
    });
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this allocation? This action cannot be undone.")) {
      deleteMutation.mutate();
    }
  };

  if (!allocation) return null;

  return (
    <Dialog open={!!allocation} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Allocation</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Allocation Period</Label>
            <Select
              value={formData.allocationPeriod}
              onValueChange={(value) => setFormData({ ...formData, allocationPeriod: value as "weekly" | "fortnightly" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="fortnightly">Fortnightly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Maximum Hours</Label>
            <Input
              type="number"
              min="1"
              max="168"
              step="0.5"
              value={formData.maxHours}
              onChange={(e) => setFormData({ ...formData, maxHours: parseFloat(e.target.value) || 0 })}
              required
            />
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Hours used: {parseFloat(allocation.hoursUsed).toFixed(1)}h
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
            />
            <Label htmlFor="isActive">Active allocation</Label>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="flex-1"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex-1"
            >
              {updateMutation.isPending ? "Updating..." : "Update"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}