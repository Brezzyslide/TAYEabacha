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
import { cn } from "@/lib/utils";

const shiftFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  startDateTime: z.date(),
  endDateTime: z.date().optional(),
  userId: z.number().optional(),
  clientId: z.number().optional(),
  isRecurring: z.boolean().default(false),
  recurrenceType: z.enum(["daily", "weekly", "fortnightly", "monthly"]).optional(),
  numberOfOccurrences: z.number().min(1).max(52).optional(),
  recurrenceEndDate: z.date().optional(),
  endConditionType: z.enum(["occurrences", "endDate"]).optional(),
});

type ShiftFormData = z.infer<typeof shiftFormSchema>;

interface NewShiftModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function NewShiftModal({ open, onOpenChange }: NewShiftModalProps) {
  const [isRecurring, setIsRecurring] = useState(false);
  const [endConditionType, setEndConditionType] = useState<"occurrences" | "endDate">("occurrences");
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ShiftFormData>({
    resolver: zodResolver(shiftFormSchema),
    defaultValues: {
      title: "",
      startDateTime: new Date(),
      isRecurring: false,
      numberOfOccurrences: 1,
      recurrenceType: "weekly",
      endConditionType: "occurrences",
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
  });

  const createShiftMutation = useMutation({
    mutationFn: async (data: ShiftFormData) => {
      if (!user?.tenantId) throw new Error("No tenant ID available");
      
      if (data.isRecurring) {
        // Generate recurring shifts
        const shifts = generateRecurringShifts(data);
        const promises = shifts.map(shift => 
          apiRequest("POST", "/api/shifts", {
            ...shift,
            tenantId: user.tenantId,
          })
        );
        return Promise.all(promises);
      } else {
        // Single shift creation
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
    onSuccess: (data) => {
      const count = Array.isArray(data) ? data.length : 1;
      toast({
        title: "Shifts Created",
        description: `Successfully created ${count} shift${count > 1 ? 's' : ''}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      onOpenChange(false);
      form.reset();
      setIsRecurring(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create Shift",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateRecurringShifts = (data: ShiftFormData) => {
    const shifts = [];
    const startDate = new Date(data.startDateTime);
    const endDate = data.endDateTime ? new Date(data.endDateTime) : null;
    const duration = endDate ? endDate.getTime() - startDate.getTime() : 60 * 60 * 1000; // 1 hour default

    let currentDate = new Date(startDate);
    let count = 0;
    const maxOccurrences = data.endConditionType === "occurrences" ? (data.numberOfOccurrences || 1) : 52;
    const endByDate = data.endConditionType === "endDate" ? data.recurrenceEndDate : null;

    while (count < maxOccurrences && (!endByDate || currentDate <= endByDate)) {
      const shiftStart = new Date(currentDate);
      const shiftEnd = new Date(currentDate.getTime() + duration);
      
      shifts.push({
        title: data.title,
        startTime: shiftStart.toISOString(),
        endTime: shiftEnd.toISOString(),
        userId: data.userId,
        clientId: data.clientId,
        seriesId: `series_${Date.now()}`,
      });

      // Calculate next occurrence
      switch (data.recurrenceType) {
        case "daily":
          currentDate.setDate(currentDate.getDate() + 1);
          break;
        case "weekly":
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case "fortnightly":
          currentDate.setDate(currentDate.getDate() + 14);
          break;
        case "monthly":
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
      }
      
      count++;
    }

    return shifts;
  };

  const onSubmit = (data: ShiftFormData) => {
    createShiftMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Shift</DialogTitle>
          <DialogDescription>
            Create a new shift and optionally set up recurring schedules
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Basic Information</h3>
              
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shift Title *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter shift title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDateTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date & Time *</FormLabel>
                      <Popover>
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
                                format(field.value, "PPP HH:mm")
                              ) : (
                                <span>Pick a date</span>
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
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                          <div className="p-3 border-t">
                            <Input
                              type="time"
                              value={field.value ? format(field.value, "HH:mm") : ""}
                              onChange={(e) => {
                                const [hours, minutes] = e.target.value.split(":");
                                const newDate = new Date(field.value || new Date());
                                newDate.setHours(parseInt(hours), parseInt(minutes));
                                field.onChange(newDate);
                              }}
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDateTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date & Time</FormLabel>
                      <Popover>
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
                                format(field.value, "PPP HH:mm")
                              ) : (
                                <span>Pick a date</span>
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
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                          <div className="p-3 border-t">
                            <Input
                              type="time"
                              value={field.value ? format(field.value, "HH:mm") : ""}
                              onChange={(e) => {
                                const [hours, minutes] = e.target.value.split(":");
                                const newDate = new Date(field.value || new Date());
                                newDate.setHours(parseInt(hours), parseInt(minutes));
                                field.onChange(newDate);
                              }}
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="userId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign to Staff</FormLabel>
                      <Select onValueChange={(value) => field.onChange(value === "unassigned" ? undefined : parseInt(value))}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select staff member" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {(users as any[])?.map((user: any) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.username}
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
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client</FormLabel>
                      <Select onValueChange={(value) => field.onChange(value === "none" ? undefined : parseInt(value))}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select client" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No Client</SelectItem>
                          {(clients as any[])?.map((client: any) => (
                            <SelectItem key={client.id} value={client.id.toString()}>
                              {client.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Recurring Options */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isRecurring"
                  checked={isRecurring}
                  onCheckedChange={(checked) => {
                    setIsRecurring(checked as boolean);
                    form.setValue("isRecurring", checked as boolean);
                  }}
                />
                <label htmlFor="isRecurring" className="text-lg font-medium">
                  Recurring Shift
                </label>
              </div>

              {isRecurring && (
                <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                  <FormField
                    control={form.control}
                    name="recurrenceType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Recurrence Pattern</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select pattern" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
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
                    name="endConditionType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Condition</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            setEndConditionType(value as "occurrences" | "endDate");
                          }} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="How should this end?" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="occurrences">After number of occurrences</SelectItem>
                            <SelectItem value="endDate">On specific date</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {endConditionType === "occurrences" && (
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
                              max="52"
                              placeholder="Enter number of shifts"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {endConditionType === "endDate" && (
                    <FormField
                      control={form.control}
                      name="recurrenceEndDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Date</FormLabel>
                          <Popover>
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
                                    <span>Pick an end date</span>
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
                                disabled={(date) => date < new Date()}
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
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createShiftMutation.isPending}>
                {createShiftMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  `Create ${isRecurring ? 'Recurring ' : ''}Shift${isRecurring ? 's' : ''}`
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}