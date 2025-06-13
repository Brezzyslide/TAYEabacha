import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Shift, User, Client } from "@shared/schema";
import { cn } from "@/lib/utils";
import { generateRecurringShifts, validateRecurringShiftInput } from "@/lib/utils/generateRecurringShifts";

// Form schema
const editShiftSchema = z.object({
  title: z.string().optional(),
  startDateTime: z.date(),
  endDateTime: z.date().optional(),
  userId: z.number().optional(),
  clientId: z.number().optional(),
  isRecurring: z.boolean().default(false),
  recurrenceType: z.enum(["weekly", "fortnightly", "monthly"]).optional(),
  endConditionType: z.enum(["occurrences", "endDate"]).optional(),
  numberOfOccurrences: z.number().min(1).optional(),
  recurrenceEndDate: z.date().optional(),
}).refine((data) => {
  if (data.endDateTime && data.startDateTime) {
    return data.endDateTime > data.startDateTime;
  }
  return true;
}, {
  message: "End time must be after start time",
  path: ["endDateTime"],
}).refine((data) => {
  if (data.isRecurring && !data.recurrenceType) {
    return false;
  }
  return true;
}, {
  message: "Recurrence type is required when making recurring",
  path: ["recurrenceType"],
}).refine((data) => {
  if (data.isRecurring && !data.endConditionType) {
    return false;
  }
  return true;
}, {
  message: "End condition is required when making recurring",
  path: ["endConditionType"],
}).refine((data) => {
  if (data.isRecurring && data.endConditionType === "occurrences" && !data.numberOfOccurrences) {
    return false;
  }
  return true;
}, {
  message: "Number of occurrences is required",
  path: ["numberOfOccurrences"],
}).refine((data) => {
  if (data.isRecurring && data.endConditionType === "endDate" && !data.recurrenceEndDate) {
    return false;
  }
  return true;
}, {
  message: "End date is required",
  path: ["recurrenceEndDate"],
});

type EditShiftFormData = z.infer<typeof editShiftSchema>;

interface EditShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  shiftId: number | null;
}

export function EditShiftModal({ isOpen, onClose, shiftId }: EditShiftModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);
  const [recurrenceEndDateOpen, setRecurrenceEndDateOpen] = useState(false);

  // Check if user has permission (Coordinator, Admin, or higher)
  const hasPermission = user && ["Coordinator", "Admin", "ConsoleManager"].includes(user.role);

  // Fetch shift data
  const { data: shift, isLoading: shiftLoading } = useQuery<Shift>({
    queryKey: ["/api/shifts", shiftId],
    enabled: !!shiftId && isOpen,
  });

  // Fetch staff members for the same company
  const { data: staff = [] } = useQuery<User[]>({
    queryKey: ["/api/users", user?.tenantId],
    enabled: !!user?.tenantId && isOpen,
  });

  // Fetch clients for the same company
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients", user?.tenantId],
    enabled: !!user?.tenantId && isOpen,
  });

  const form = useForm<EditShiftFormData>({
    resolver: zodResolver(editShiftSchema),
    defaultValues: {
      title: "",
      startDateTime: new Date(),
      endDateTime: undefined,
      userId: undefined,
      clientId: undefined,
      isRecurring: false,
      recurrenceType: undefined,
      endConditionType: undefined,
      numberOfOccurrences: undefined,
      recurrenceEndDate: undefined,
    },
  });

  // Update form when shift data is loaded
  useEffect(() => {
    if (shift) {
      form.reset({
        title: shift.title || "",
        startDateTime: new Date(shift.startTime),
        endDateTime: shift.endTime ? new Date(shift.endTime) : undefined,
        userId: shift.userId || undefined,
        clientId: shift.clientId || undefined,
        isRecurring: false, // Will be updated if we add recurrence data to schema
        recurrenceType: undefined,
        endConditionType: undefined,
        numberOfOccurrences: undefined,
        recurrenceEndDate: undefined,
      });
    }
  }, [shift, form]);

  // Create shift mutation
  const createShiftMutation = useMutation({
    mutationFn: async (data: EditShiftFormData) => {
      if (!user?.tenantId) throw new Error("No tenant ID available");
      
      // If this is a recurring shift, generate multiple shifts
      if (data.isRecurring) {
        try {
          // Validate recurring shift input
          const recurringInput = {
            title: data.title,
            startDateTime: data.startDateTime,
            endDateTime: data.endDateTime || data.startDateTime,
            recurrenceType: data.recurrenceType!,
            occurrenceCount: data.endConditionType === "occurrences" ? data.numberOfOccurrences : undefined,
            endDate: data.endConditionType === "endDate" ? data.recurrenceEndDate : undefined,
            staffId: data.userId?.toString(),
            clientId: data.clientId?.toString() || "",
            companyId: user.tenantId.toString(),
          };

          validateRecurringShiftInput(recurringInput);
          const recurringShifts = generateRecurringShifts(recurringInput);

          // Create all recurring shifts via API
          const promises = recurringShifts.map(shift => 
            apiRequest("POST", "/api/shifts", {
              title: shift.title,
              startTime: shift.startDateTime.toISOString(),
              endTime: shift.endDateTime.toISOString(),
              userId: shift.staffId ? parseInt(shift.staffId) : null,
              clientId: shift.clientId ? parseInt(shift.clientId) : null,
              tenantId: user.tenantId,
            })
          );

          await Promise.all(promises);
          return { recurring: true, count: recurringShifts.length };
        } catch (error) {
          throw new Error(`Failed to create recurring shifts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else {
        // Regular single shift creation
        const shiftData = {
          title: data.title,
          startTime: data.startDateTime.toISOString(),
          endTime: data.endDateTime?.toISOString(),
          userId: data.userId,
          clientId: data.clientId,
          tenantId: user.tenantId,
        };

        const response = await apiRequest("POST", "/api/shifts", shiftData);
        return response.json();
      }
    },
    onSuccess: (result) => {
      if (result?.recurring) {
        toast({
          title: "Success",
          description: `Created ${result.count} recurring shifts successfully`,
        });
      } else {
        toast({
          title: "Success",
          description: "Shift created successfully",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update shift mutation
  const updateShiftMutation = useMutation({
    mutationFn: async (data: EditShiftFormData) => {
      if (!shiftId) throw new Error("No shift ID provided");
      
      // If this is a recurring shift update, generate multiple shifts
      if (data.isRecurring && user?.tenantId) {
        try {
          // Validate recurring shift input
          const recurringInput = {
            title: data.title,
            startDateTime: data.startDateTime,
            endDateTime: data.endDateTime || data.startDateTime,
            recurrenceType: data.recurrenceType!,
            occurrenceCount: data.endConditionType === "occurrences" ? data.numberOfOccurrences : undefined,
            endDate: data.endConditionType === "endDate" ? data.recurrenceEndDate : undefined,
            staffId: data.userId?.toString(),
            clientId: data.clientId?.toString() || "",
            companyId: user.tenantId.toString(),
          };

          validateRecurringShiftInput(recurringInput);
          const recurringShifts = generateRecurringShifts(recurringInput);

          // Create all recurring shifts via API
          const promises = recurringShifts.map(shift => 
            apiRequest("POST", "/api/shifts", {
              title: shift.title,
              startTime: shift.startDateTime.toISOString(),
              endTime: shift.endDateTime.toISOString(),
              userId: shift.staffId ? parseInt(shift.staffId) : null,
              clientId: shift.clientId ? parseInt(shift.clientId) : null,
              tenantId: user.tenantId,
            })
          );

          await Promise.all(promises);
          
          // Delete the original shift since we're replacing it with recurring series
          await apiRequest("DELETE", `/api/shifts/${shiftId}`);
          
          return { recurring: true, count: recurringShifts.length };
        } catch (error) {
          throw new Error(`Failed to create recurring shifts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else {
        // Regular single shift update
        const updateData = {
          title: data.title,
          startTime: data.startDateTime.toISOString(),
          endTime: data.endDateTime?.toISOString(),
          userId: data.userId,
          clientId: data.clientId,
        };

        const response = await apiRequest("PUT", `/api/shifts/${shiftId}`, updateData);
        return response.json();
      }
    },
    onSuccess: (result) => {
      if (result?.recurring) {
        toast({
          title: "Success",
          description: `Created ${result.count} recurring shifts successfully`,
        });
      } else {
        toast({
          title: "Success", 
          description: "Shift updated successfully",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditShiftFormData) => {
    if (shiftId) {
      // Editing existing shift
      updateShiftMutation.mutate(data);
    } else {
      // Creating new shift
      createShiftMutation.mutate(data);
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  // Don't render if user doesn't have permission
  if (!hasPermission) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{shiftId ? "Edit Shift" : "Create New Shift"}</DialogTitle>
          <DialogDescription>
            {shiftId ? "Update shift details and manage recurring schedules." : "Create a new shift and configure recurring schedules."}
          </DialogDescription>
        </DialogHeader>

        {shiftLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading shift data...</span>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Title */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter shift title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Start Date & Time */}
              <FormField
                control={form.control}
                name="startDateTime"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start Date & Time</FormLabel>
                    <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP p")
                            ) : (
                              <span>Pick a date and time</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            if (date) {
                              const currentTime = field.value || new Date();
                              const newDateTime = new Date(date);
                              newDateTime.setHours(currentTime.getHours());
                              newDateTime.setMinutes(currentTime.getMinutes());
                              field.onChange(newDateTime);
                            }
                          }}
                          disabled={(date) => date < new Date("1900-01-01")}
                          initialFocus
                        />
                        <div className="p-3 border-t">
                          <Input
                            type="time"
                            value={field.value ? format(field.value, "HH:mm") : ""}
                            onChange={(e) => {
                              if (field.value && e.target.value) {
                                const [hours, minutes] = e.target.value.split(":");
                                const newDateTime = new Date(field.value);
                                newDateTime.setHours(parseInt(hours), parseInt(minutes));
                                field.onChange(newDateTime);
                              }
                            }}
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* End Date & Time */}
              <FormField
                control={form.control}
                name="endDateTime"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>End Date & Time (Optional)</FormLabel>
                    <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP p")
                            ) : (
                              <span>Pick a date and time</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            if (date) {
                              const currentTime = field.value || new Date();
                              const newDateTime = new Date(date);
                              newDateTime.setHours(currentTime.getHours());
                              newDateTime.setMinutes(currentTime.getMinutes());
                              field.onChange(newDateTime);
                            }
                          }}
                          disabled={(date) => date < new Date("1900-01-01")}
                          initialFocus
                        />
                        <div className="p-3 border-t">
                          <Input
                            type="time"
                            value={field.value ? format(field.value, "HH:mm") : ""}
                            onChange={(e) => {
                              if (e.target.value) {
                                const [hours, minutes] = e.target.value.split(":");
                                const newDateTime = field.value ? new Date(field.value) : new Date();
                                newDateTime.setHours(parseInt(hours), parseInt(minutes));
                                field.onChange(newDateTime);
                              } else {
                                field.onChange(undefined);
                              }
                            }}
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Assign to Staff */}
              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign to Staff (Optional)</FormLabel>
                    <Select
                      value={field.value?.toString()}
                      onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select staff member" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Unassigned</SelectItem>
                        {staff.map((member) => (
                          <SelectItem key={member.id} value={member.id.toString()}>
                            {member.username} ({member.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Assign to Client */}
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign to Client (Optional)</FormLabel>
                    <Select
                      value={field.value?.toString()}
                      onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select client" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">No client assigned</SelectItem>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id.toString()}>
                            {client.fullName}
                            {client.ndisNumber && ` (NDIS: ${client.ndisNumber})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Make Recurring Checkbox */}
              <FormField
                control={form.control}
                name="isRecurring"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Make Recurring</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              {/* Recurrence Options */}
              {form.watch("isRecurring") && (
                <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
                  <h4 className="font-medium">Recurrence Settings</h4>
                  
                  {/* Recurrence Type */}
                  <FormField
                    control={form.control}
                    name="recurrenceType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Recurrence Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select recurrence type" />
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

                  {/* End Condition Type */}
                  <FormField
                    control={form.control}
                    name="endConditionType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Condition</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select end condition" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="occurrences">Number of occurrences</SelectItem>
                            <SelectItem value="endDate">End date</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Number of Occurrences */}
                  {form.watch("endConditionType") === "occurrences" && (
                    <FormField
                      control={form.control}
                      name="numberOfOccurrences"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Number of Occurrences</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              placeholder="Enter number of occurrences"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Recurrence End Date */}
                  {form.watch("endConditionType") === "endDate" && (
                    <FormField
                      control={form.control}
                      name="recurrenceEndDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Recurrence End Date</FormLabel>
                          <Popover open={recurrenceEndDateOpen} onOpenChange={setRecurrenceEndDateOpen}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick end date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) => date <= new Date()}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateShiftMutation.isPending || createShiftMutation.isPending}
                >
                  {(updateShiftMutation.isPending || createShiftMutation.isPending) ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {shiftId ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    shiftId ? "Update Shift" : "Create Shift"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}