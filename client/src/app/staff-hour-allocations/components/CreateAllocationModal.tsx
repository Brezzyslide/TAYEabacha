import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { insertHourAllocationSchema, User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface CreateAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  allocationToEdit?: any;
}

const formSchema = z.object({
  staffId: z.number({ required_error: "Please select a staff member" }),
  allocationPeriod: z.enum(["weekly", "fortnightly", "monthly"]),
  maxHours: z.number().min(1, "Max hours must be at least 1").max(744, "Max hours cannot exceed 744 hours per month"),
  isActive: z.boolean().optional().default(true),
});

type FormData = z.infer<typeof formSchema>;

export default function CreateAllocationModal({ 
  isOpen, 
  onClose, 
  allocationToEdit 
}: CreateAllocationModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  console.log("[CreateAllocationModal] Props received:", { isOpen, allocationToEdit });

  // Fetch staff members
  const { data: staffMembers = [], isLoading: staffLoading, error: staffError } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: isOpen,
  });

  console.log("[CreateAllocationModal] Staff data:", { staffMembers, staffLoading, staffError });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: allocationToEdit ? {
      staffId: allocationToEdit.staffId,
      allocationPeriod: allocationToEdit.allocationPeriod,
      maxHours: parseFloat(allocationToEdit.maxHours),
    } : {
      allocationPeriod: "weekly",
      maxHours: 40,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const url = allocationToEdit 
        ? `/api/hour-allocations/${allocationToEdit.id}`
        : '/api/hour-allocations';
      const method = allocationToEdit ? 'PUT' : 'POST';
      
      const requestPayload = {
        staffId: data.staffId,
        allocationPeriod: data.allocationPeriod,
        maxHours: data.maxHours,
        remainingHours: data.maxHours, // Set remaining hours equal to max hours initially
        // tenantId will be set by server from req.user.tenantId
      };
      
      console.log("[CreateAllocationModal] API Request:", { method, url, payload: requestPayload });
      
      const response = await apiRequest(method, url, requestPayload);
      const result = await response.json();
      
      console.log("[CreateAllocationModal] API Response:", result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hour-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/hour-allocations/stats'] });
      toast({
        title: allocationToEdit ? "Allocation updated" : "Allocation created",
        description: allocationToEdit 
          ? "Staff hour allocation has been updated successfully."
          : "New staff hour allocation has been created successfully.",
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save allocation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    form.reset();
    setIsSubmitting(false);
    onClose();
  };

  const onSubmit = async (data: FormData) => {
    console.log("[CreateAllocationModal] Form submitted with data:", data);
    console.log("[CreateAllocationModal] Form validation errors:", form.formState.errors);
    setIsSubmitting(true);
    try {
      console.log("[CreateAllocationModal] Calling API mutation...");
      const result = await createMutation.mutateAsync(data);
      console.log("[CreateAllocationModal] API mutation successful:", result);
    } catch (error) {
      console.error("[CreateAllocationModal] Form submission error:", error);
      setIsSubmitting(false);
    }
  };

  // Filter staff members to exclude those who already have active allocations
  const { data: existingAllocations = [] } = useQuery({
    queryKey: ['/api/hour-allocations'],
    enabled: isOpen && !allocationToEdit,
  });

  const availableStaff = staffMembers.filter(staff => 
    allocationToEdit?.staffId === staff.id || 
    !Array.isArray(existingAllocations) || 
    !existingAllocations.some((allocation: any) => 
      allocation.staffId === staff.id && allocation.isActive
    )
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md z-50">
        <DialogHeader>
          <DialogTitle>
            {allocationToEdit ? "Edit Hour Allocation" : "Create Hour Allocation"}
          </DialogTitle>
          <DialogDescription>
            {allocationToEdit 
              ? "Update the staff member's working hour allocation and period settings."
              : "Set working hour limits for a staff member to prevent overscheduling and manage workload."
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
            console.log("[CreateAllocationModal] Form validation failed:", errors);
          })} className="space-y-4">
            <FormField
              control={form.control}
              name="staffId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Staff Member</FormLabel>
                  <Select
                    value={field.value?.toString()}
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    disabled={!!allocationToEdit}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a staff member" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableStaff.map((staff) => (
                        <SelectItem key={staff.id} value={staff.id.toString()}>
                          {staff.username} ({staff.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="allocationPeriod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Allocation Period</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select period" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="fortnightly">Fortnightly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="maxHours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Maximum Hours</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max={form.watch("allocationPeriod") === "monthly" ? "744" : form.watch("allocationPeriod") === "fortnightly" ? "336" : "168"}
                      step="0.5"
                      placeholder="e.g., 40"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-gray-500">
                    {form.watch("allocationPeriod") === "weekly" 
                      ? "Maximum hours per week (1-168)"
                      : form.watch("allocationPeriod") === "fortnightly"
                      ? "Maximum hours per fortnight (1-336)"
                      : form.watch("allocationPeriod") === "monthly"
                      ? "Maximum hours per month (1-744)"
                      : "Select allocation period first"
                    }
                  </p>
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                onClick={() => console.log("[CreateAllocationModal] Submit button clicked")}
              >
                {isSubmitting 
                  ? (allocationToEdit ? "Updating..." : "Creating...") 
                  : (allocationToEdit ? "Update Allocation" : "Create Allocation")
                }
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}