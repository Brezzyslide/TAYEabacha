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
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Loader2, Info } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { Shift, Client, User } from "@shared/schema";

const recurringShiftFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  shiftStartDate: z.date(),
  shiftStartTime: z.string(),
  shiftEndTime: z.string(),
  userId: z.number().optional(),
  clientId: z.number().optional(),
  fundingCategory: z.enum(["SIL", "CommunityAccess", "CapacityBuilding"]).optional(),
  staffRatio: z.enum(["1:1", "1:2", "1:3", "1:4", "2:1"]).optional(),
  recurrenceType: z.enum(["daily", "weekly", "fortnightly", "monthly"]),
  selectedWeekdays: z.array(z.string()),
  numberOfOccurrences: z.number().min(1).max(104),
  endConditionType: z.enum(["occurrences", "endDate"]),
  recurrenceEndDate: z.date().optional(),
});

type RecurringShiftFormData = z.infer<typeof recurringShiftFormSchema>;

interface EditRecurringShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: Shift;
  editType: "future" | "series";
}

export default function EditRecurringShiftModal({ isOpen, onClose, shift, editType }: EditRecurringShiftModalProps) {
  const [endConditionType, setEndConditionType] = useState<"occurrences" | "endDate">("occurrences");
  const [selectedWeekdays, setSelectedWeekdays] = useState<string[]>([]);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<RecurringShiftFormData>({
    resolver: zodResolver(recurringShiftFormSchema),
    defaultValues: {
      title: "",
      shiftStartDate: new Date(),
      shiftStartTime: "09:00",
      shiftEndTime: "17:00",
      userId: undefined,
      clientId: undefined,
      fundingCategory: undefined,
      staffRatio: undefined,
      selectedWeekdays: [],
      numberOfOccurrences: 1, // Not used in edit mode
      recurrenceType: "weekly",
      endConditionType: "occurrences",
      recurrenceEndDate: undefined,
    },
  });

  // Load shift data into form when modal opens
  useEffect(() => {
    if (isOpen && shift) {
      console.log("[RECURRING EDIT] Loading shift data:", shift);
      
      // Parse existing recurring days or use the shift's day
      const existingDays = shift.recurringDays || [format(new Date(shift.startTime), "EEEE")];
      console.log("[RECURRING EDIT] Existing recurring days:", existingDays);
      
      setSelectedWeekdays(existingDays);
      
      form.reset({
        title: shift.title || "",
        shiftStartDate: shift.shiftStartDate ? new Date(shift.shiftStartDate) : new Date(shift.startTime),
        shiftStartTime: shift.shiftStartTime || format(new Date(shift.startTime), "HH:mm"),
        shiftEndTime: shift.shiftEndTime || format(new Date(shift.endTime || shift.startTime), "HH:mm"),
        userId: shift.userId || undefined,
        clientId: shift.clientId || undefined,
        fundingCategory: shift.fundingCategory as any,
        staffRatio: shift.staffRatio as any,
        recurrenceType: (shift.recurringPattern as any) || "weekly",
        selectedWeekdays: existingDays,
        numberOfOccurrences: 1, // Not used in edit mode - we edit existing shifts only
        endConditionType: "occurrences",
        recurrenceEndDate: undefined,
      });
    }
  }, [isOpen, shift, form]);

  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
  });

  const updateRecurringShiftMutation = useMutation({
    mutationFn: async (data: RecurringShiftFormData) => {
      if (!user?.tenantId) throw new Error("No tenant ID available");
      
      console.log("[RECURRING EDIT] Updating existing recurring shifts in series:", shift.seriesId, data);
      
      // Send update request to edit existing shifts in place
      return await apiRequest("PUT", `/api/shifts/series/${shift.seriesId}/edit-existing`, {
        updateData: {
          title: data.title,
          shiftStartTime: data.shiftStartTime,
          shiftEndTime: data.shiftEndTime,
          userId: data.userId,
          clientId: data.clientId,
          fundingCategory: data.fundingCategory,
          staffRatio: data.staffRatio,
          selectedWeekdays: data.selectedWeekdays,
          recurrenceType: data.recurrenceType,
        },
        editType: editType, // "future" or "series"
        fromShiftId: editType === "future" ? shift.id : undefined
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      const updatedCount = Array.isArray(data) ? data.length : (typeof data === 'object' && data && 'count' in data) ? data.count : 0;
      toast({
        title: "Recurring Shifts Updated",
        description: `Successfully updated recurring shift series. Modified ${updatedCount} shifts.`,
      });
      onClose();
    },
    onError: (error: Error) => {
      console.error("[RECURRING EDIT ERROR] Full error:", error);
      toast({
        title: "Failed to Update Recurring Shifts",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateRecurringShifts = (data: RecurringShiftFormData): any[] => {
    const shifts: any[] = [];
    
    const startDate = data.shiftStartDate || new Date();
    const startTime = data.shiftStartTime || "09:00";
    const endTime = data.shiftEndTime || "17:00";
    
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    
    const nextDay = endHours < startHours || (endHours === startHours && endMinutes <= startMinutes);
    
    const maxOccurrences = data.endConditionType === "occurrences" ? (data.numberOfOccurrences || 30) : 100;
    const endByDate = data.endConditionType === "endDate" ? data.recurrenceEndDate : null;
    
    console.log(`[RECURRING EDIT DEBUG] Generating ${maxOccurrences} shifts, pattern: ${data.recurrenceType}, endDate: ${endByDate}`);

    if (data.recurrenceType === "daily") {
      let currentDate = new Date(startDate);
      let totalShiftsGenerated = 0;

      while (totalShiftsGenerated < maxOccurrences && (!endByDate || currentDate <= endByDate)) {
        const shiftStart = new Date(currentDate);
        shiftStart.setHours(startHours, startMinutes, 0, 0);
        
        const shiftEnd = new Date(currentDate);
        if (nextDay) {
          shiftEnd.setDate(shiftEnd.getDate() + 1);
        }
        shiftEnd.setHours(endHours, endMinutes, 0, 0);
        
        shifts.push({
          title: data.title,
          startTime: shiftStart,
          endTime: shiftEnd,
          userId: data.userId,
          clientId: data.clientId,
          fundingCategory: data.fundingCategory,
          staffRatio: data.staffRatio,
          status: data.userId ? "assigned" : "unassigned",
          isRecurring: true,
          recurringPattern: data.recurrenceType,
          recurringDays: ["Daily"],
          shiftStartDate: data.shiftStartDate,
          shiftStartTime: data.shiftStartTime,
          shiftEndTime: data.shiftEndTime,
        });
        
        totalShiftsGenerated++;
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else if (data.recurrenceType === "monthly") {
      let currentDate = new Date(startDate);
      let totalShiftsGenerated = 0;

      while (totalShiftsGenerated < maxOccurrences && (!endByDate || currentDate <= endByDate)) {
        const shiftStart = new Date(currentDate);
        shiftStart.setHours(startHours, startMinutes, 0, 0);
        
        const shiftEnd = new Date(currentDate);
        if (nextDay) {
          shiftEnd.setDate(shiftEnd.getDate() + 1);
        }
        shiftEnd.setHours(endHours, endMinutes, 0, 0);
        
        shifts.push({
          title: data.title,
          startTime: shiftStart,
          endTime: shiftEnd,
          userId: data.userId,
          clientId: data.clientId,
          fundingCategory: data.fundingCategory,
          staffRatio: data.staffRatio,
          status: data.userId ? "assigned" : "unassigned",
          isRecurring: true,
          recurringPattern: data.recurrenceType,
          recurringDays: ["Monthly"],
          shiftStartDate: data.shiftStartDate,
          shiftStartTime: data.shiftStartTime,
          shiftEndTime: data.shiftEndTime,
        });
        
        totalShiftsGenerated++;
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    } else {
      // Weekly/Fortnightly recurrence
      const selectedWeekdays = data.selectedWeekdays || [];
      if (selectedWeekdays.length === 0) return shifts;

      const weekdayMap = {
        "Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4,
        "Friday": 5, "Saturday": 6, "Sunday": 0
      };

      let intervalDays = 1;
      if (data.recurrenceType === "weekly") intervalDays = 7;
      if (data.recurrenceType === "fortnightly") intervalDays = 14;
      
      console.log(`[RECURRING EDIT DEBUG] Creating ${maxOccurrences} shifts with ${data.recurrenceType} pattern (${intervalDays} day intervals)`);
      
      for (const weekday of selectedWeekdays) {
        const dayOfWeek = weekdayMap[weekday as keyof typeof weekdayMap];
        const startDayOfWeek = startDate.getDay();
        
        let daysToAdd = (dayOfWeek - startDayOfWeek + 7) % 7;
        
        if (daysToAdd === 0 && dayOfWeek === startDayOfWeek) {
          daysToAdd = 0;
        }
        
        for (let occurrence = 0; occurrence < maxOccurrences; occurrence++) {
          const shiftDate = new Date(startDate);
          shiftDate.setDate(startDate.getDate() + daysToAdd + (occurrence * intervalDays));
          
          if (endByDate && shiftDate > endByDate) {
            console.log(`[RECURRING EDIT DEBUG] Stopping at occurrence ${occurrence + 1} - reached end date`);
            break;
          }
          
          const shiftStart = new Date(shiftDate);
          shiftStart.setHours(startHours, startMinutes, 0, 0);
          
          const shiftEnd = new Date(shiftDate);
          if (nextDay) {
            shiftEnd.setDate(shiftEnd.getDate() + 1);
          }
          shiftEnd.setHours(endHours, endMinutes, 0, 0);
          
          shifts.push({
            title: data.title,
            startTime: shiftStart,
            endTime: shiftEnd,
            userId: data.userId,
            clientId: data.clientId,
            fundingCategory: data.fundingCategory,
            staffRatio: data.staffRatio,
            status: data.userId ? "assigned" : "unassigned",
            isRecurring: true,
            recurringPattern: data.recurrenceType,
            recurringDays: [weekday],
            shiftStartDate: data.shiftStartDate,
            shiftStartTime: data.shiftStartTime,
            shiftEndTime: data.shiftEndTime,
          });
          
          console.log(`[RECURRING EDIT DEBUG] ${weekday} shift ${occurrence + 1}/${maxOccurrences}: ${shiftDate.toDateString()}`);
        }
      }
    }
    
    console.log(`[RECURRING EDIT DEBUG] Generated ${shifts.length} total shifts`);
    return shifts;
  };

  const onSubmit = (data: RecurringShiftFormData) => {
    updateRecurringShiftMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Recurring Shift Series</DialogTitle>
          <DialogDescription>
            Modify the recurring shift pattern. This will update all future shifts in the series.
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

              {/* Staff and Client Assignment */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="userId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign to Staff</FormLabel>
                      <Select onValueChange={(value) => field.onChange(value === "unassigned" ? undefined : parseInt(value))} value={field.value?.toString() || "unassigned"}>
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
                      <Select onValueChange={(value) => field.onChange(value === "unassigned" ? undefined : parseInt(value))} value={field.value?.toString() || "unassigned"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select client" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="unassigned">No Client</SelectItem>
                          {(clients as any[])?.map((client: any) => (
                            <SelectItem key={client.id} value={client.id.toString()}>
                              {client.firstName} {client.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Funding and Staff Ratio */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fundingCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Funding Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select funding category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="SIL">SIL (Supported Independent Living)</SelectItem>
                          <SelectItem value="CommunityAccess">Community Access</SelectItem>
                          <SelectItem value="CapacityBuilding">Capacity Building</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="staffRatio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Staff to Client Ratio</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select staff ratio" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1:1">1:1 (One-on-One)</SelectItem>
                          <SelectItem value="1:2">1:2 (One to Two)</SelectItem>
                          <SelectItem value="1:3">1:3 (One to Three)</SelectItem>
                          <SelectItem value="1:4">1:4 (One to Four)</SelectItem>
                          <SelectItem value="2:1">2:1 (Two to One)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Recurring Pattern Configuration */}
            <div className="space-y-6 p-6 border-2 border-blue-200 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">Recurring Pattern Configuration</h3>
              
              {/* Shift Schedule */}
              <div className="space-y-4 p-4 border border-amber-200 rounded-lg bg-amber-50/50">
                <h4 className="text-md font-semibold text-amber-800">Shift Schedule</h4>
                
                <FormField
                  control={form.control}
                  name="shiftStartDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shift Start Date *</FormLabel>
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
                                <span>Pick start date for recurring shifts</span>
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="shiftStartTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shift Start Time *</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            {...field}
                            className="w-full"
                            placeholder="09:00"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="shiftEndTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shift End Time *</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            {...field}
                            className="w-full"
                            placeholder="17:00"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              {/* Frequency Selection */}
              <FormField
                control={form.control}
                name="recurrenceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "weekly"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="fortnightly">Fortnightly (Every 2 weeks)</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Weekday Selection */}
              <div className="space-y-3">
                <FormLabel>Repeat On Days <span className="text-red-500">*</span></FormLabel>
                <p className="text-sm text-gray-600 dark:text-gray-400">Select which days of the week this shift should repeat</p>
                <ToggleGroup
                  type="multiple"
                  value={selectedWeekdays}
                  onValueChange={(value) => {
                    setSelectedWeekdays(value);
                    form.setValue("selectedWeekdays", value);
                  }}
                  className="grid grid-cols-7 gap-2"
                >
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                    <ToggleGroupItem
                      key={day}
                      value={day}
                      className="h-12 data-[state=on]:bg-blue-600 data-[state=on]:text-white data-[state=on]:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900"
                      size="sm"
                    >
                      <span className="text-xs font-medium">
                        {day.slice(0, 3)}
                      </span>
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                {selectedWeekdays.length === 0 && (
                  <p className="text-sm text-red-500">Please select at least one day</p>
                )}
              </div>

              {/* Edit Mode Information */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-blue-800 mb-2">
                  <Info className="h-4 w-4" />
                  <span className="font-medium">Edit Mode</span>
                </div>
                <p className="text-blue-700 text-sm">
                  You are editing existing recurring shifts. Changes will be applied to {editType === "series" ? "all shifts in the series" : "future shifts from the selected date"}.
                  The number of shifts will remain the same - only their properties will be updated.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateRecurringShiftMutation.isPending || selectedWeekdays.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {updateRecurringShiftMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Update Recurring Shifts
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}