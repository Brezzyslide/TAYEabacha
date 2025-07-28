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
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
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
  // For single shifts
  startDateTime: z.date().optional(),
  endDateTime: z.date().optional(),
  // For recurring shifts - dedicated calendar fields
  shiftStartDate: z.date().optional(),
  shiftStartTime: z.string().optional(),
  shiftEndTime: z.string().optional(),
  userId: z.number().optional(),
  clientId: z.number().optional(),
  fundingCategory: z.enum(["SIL", "CommunityAccess", "CapacityBuilding"]).optional(),
  staffRatio: z.enum(["1:1", "1:2", "1:3", "1:4", "2:1"]).optional(),
  isRecurring: z.boolean().default(false),
  recurrenceType: z.enum(["weekly", "fortnightly", "monthly"]).optional(),
  selectedWeekdays: z.array(z.string()).optional(),
  numberOfOccurrences: z.number().min(1).max(104).optional(),
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
  const [selectedWeekdays, setSelectedWeekdays] = useState<string[]>([]);
  
  // Preserve form data across modal sessions
  const [preservedFormData, setPreservedFormData] = useState<Partial<ShiftFormData>>({});
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ShiftFormData>({
    resolver: zodResolver(shiftFormSchema),
    defaultValues: {
      title: "",
      startDateTime: new Date(),
      endDateTime: undefined,
      shiftStartDate: new Date(),
      shiftStartTime: "09:00",
      shiftEndTime: "17:00",
      userId: undefined,
      clientId: undefined,
      fundingCategory: undefined,
      staffRatio: undefined,
      isRecurring: false,
      selectedWeekdays: [],
      numberOfOccurrences: 10,
      recurrenceType: "weekly",
      endConditionType: "occurrences",
      recurrenceEndDate: undefined,
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
      
      if (data.isRecurring && (data.recurrenceType === "daily" || data.recurrenceType === "monthly" || (data.selectedWeekdays && data.selectedWeekdays.length > 0))) {
        // Generate recurring shifts using dedicated calendar fields
        const shifts = generateRecurringShifts(data);
        
        // Generate a unique series ID for all shifts in this recurring series
        const seriesId = `series-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const promises = shifts.map(shift => 
          apiRequest("POST", "/api/shifts", {
            ...shift,
            isRecurring: true,
            seriesId: seriesId,
            recurringPattern: data.recurrenceType,
            recurringDays: data.selectedWeekdays,
            shiftStartDate: data.shiftStartDate?.toISOString(),
            shiftStartTime: data.shiftStartTime,
            shiftEndTime: data.shiftEndTime,
            tenantId: user.tenantId,
          })
        );
        return Promise.all(promises);
      } else {
        // Single shift creation
        const shiftData = {
          title: data.title,
          startTime: data.startDateTime?.toISOString(),
          endTime: data.endDateTime?.toISOString(),
          userId: data.userId,
          clientId: data.clientId,
          fundingCategory: data.fundingCategory,
          staffRatio: data.staffRatio,
          isRecurring: false,
          tenantId: user.tenantId,
        };
        const response = await apiRequest("POST", "/api/shifts", shiftData);
        return response.json();
      }
    },
    onSuccess: async (data) => {
      const count = Array.isArray(data) ? data.length : 1;
      toast({
        title: "Shifts Created",
        description: `Successfully created ${count} shift${count > 1 ? 's' : ''}`,
      });
      
      // Force immediate cache invalidation and refresh for all shift queries
      await queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      await queryClient.refetchQueries({ queryKey: ["/api/shifts"] });
      
      // Also invalidate related queries that might depend on shift data
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      
      // Close modal and reset form
      onOpenChange(false);
      
      // Clear preserved data only after successful creation
      setPreservedFormData({});
      
      // Reset form to default values
      form.reset({
        title: "",
        startDateTime: new Date(),
        endDateTime: undefined,
        shiftStartDate: new Date(),
        shiftStartTime: "09:00",
        shiftEndTime: "17:00",
        userId: undefined,
        clientId: undefined,
        fundingCategory: undefined,
        staffRatio: undefined,
        isRecurring: false,
        selectedWeekdays: [],
        numberOfOccurrences: 10,
        recurrenceType: "weekly",
        endConditionType: "occurrences",
        recurrenceEndDate: undefined,
      });
      
      setIsRecurring(false);
      setSelectedWeekdays([]);
      setEndConditionType("occurrences");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create Shift",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateRecurringShifts = (data: ShiftFormData): any[] => {
    const shifts: any[] = [];
    
    // Use dedicated recurring shift fields
    const startDate = data.shiftStartDate || new Date();
    const startTime = data.shiftStartTime || "09:00";
    const endTime = data.shiftEndTime || "17:00";
    
    // Parse time strings for recurring shifts
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    
    // Check if shift spans to next day
    const nextDay = endHours < startHours || (endHours === startHours && endMinutes <= startMinutes);
    
    const maxOccurrences = data.endConditionType === "occurrences" ? (data.numberOfOccurrences || 10) : 100;
    const endByDate = data.endConditionType === "endDate" ? data.recurrenceEndDate : null;
    
    console.log("[RECURRING DEBUG] Generating shifts with:", {
      endConditionType: data.endConditionType,
      numberOfOccurrences: data.numberOfOccurrences,
      maxOccurrences,
      selectedWeekdays: data.selectedWeekdays,
      recurrenceType: data.recurrenceType
    });

    // Handle different recurrence patterns
    if (data.recurrenceType === "daily") {
      // Daily recurrence - generate shifts every day
      let currentDate = new Date(startDate);
      let totalShiftsGenerated = 0;

      while (totalShiftsGenerated < maxOccurrences && (!endByDate || currentDate <= endByDate)) {
        // Create shift start datetime
        const shiftStart = new Date(currentDate);
        shiftStart.setHours(startHours, startMinutes, 0, 0);
        
        // Create shift end datetime
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
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else if (data.recurrenceType === "monthly") {
      // Monthly recurrence - generate shifts on the same day of each month
      let currentDate = new Date(startDate);
      let totalShiftsGenerated = 0;

      while (totalShiftsGenerated < maxOccurrences && (!endByDate || currentDate <= endByDate)) {
        // Create shift start datetime
        const shiftStart = new Date(currentDate);
        shiftStart.setHours(startHours, startMinutes, 0, 0);
        
        // Create shift end datetime
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
        // Move to next month
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    } else {
      // Weekly/Fortnightly recurrence - generate shifts on selected weekdays
      const selectedWeekdays = data.selectedWeekdays || [];
      if (selectedWeekdays.length === 0) return shifts;

      const weekdayMap = {
        "Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4,
        "Friday": 5, "Saturday": 6, "Sunday": 0
      };

      const frequencyWeeks = data.recurrenceType === "fortnightly" ? 2 : 1;
      
      // For each occurrence, generate shifts for all selected weekdays
      let occurrenceCount = 0;
      let currentWeekStart = new Date(startDate);
      
      // Move to the start of the week containing our start date
      const daysToStartOfWeek = currentWeekStart.getDay();
      currentWeekStart.setDate(currentWeekStart.getDate() - daysToStartOfWeek);

      while (occurrenceCount < maxOccurrences && (!endByDate || currentWeekStart <= endByDate)) {
        // Generate shifts for each selected weekday in this occurrence
        for (const weekday of selectedWeekdays) {
          if (occurrenceCount >= maxOccurrences) break;
          
          const dayOfWeek = weekdayMap[weekday as keyof typeof weekdayMap];
          const shiftDate = new Date(currentWeekStart);
          shiftDate.setDate(currentWeekStart.getDate() + dayOfWeek);
          
          // Skip if this date is before our start date
          if (shiftDate < startDate) continue;
          
          // Skip if this date is after our end date
          if (endByDate && shiftDate > endByDate) continue;
          
          // Create shift start datetime
          const shiftStart = new Date(shiftDate);
          shiftStart.setHours(startHours, startMinutes, 0, 0);
          
          // Create shift end datetime
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
            recurringDays: data.selectedWeekdays,
            shiftStartDate: data.shiftStartDate,
            shiftStartTime: data.shiftStartTime,
            shiftEndTime: data.shiftEndTime,
          });
          
          occurrenceCount++;
        }
        
        // Move to next occurrence (week or fortnight)
        currentWeekStart.setDate(currentWeekStart.getDate() + (7 * frequencyWeeks));
      }
    }
    
    console.log("[RECURRING DEBUG] Generated", shifts.length, "shifts. Expected", maxOccurrences);

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

              {/* Conditional DateTime Fields - Single vs Recurring */}
              <div>
                {!isRecurring ? (
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
                                  try {
                                    const timeValue = e.target.value;
                                    if (!timeValue || !timeValue.includes(":")) return;
                                    
                                    const [hours, minutes] = timeValue.split(":");
                                    const parsedHours = parseInt(hours, 10);
                                    const parsedMinutes = parseInt(minutes, 10);
                                    
                                    // Validate parsed values
                                    if (isNaN(parsedHours) || isNaN(parsedMinutes) || 
                                        parsedHours < 0 || parsedHours > 23 || 
                                        parsedMinutes < 0 || parsedMinutes > 59) {
                                      return;
                                    }
                                    
                                    const newDate = new Date(field.value || new Date());
                                    newDate.setHours(parsedHours, parsedMinutes, 0, 0);
                                    field.onChange(newDate);
                                  } catch (error) {
                                    console.warn("Invalid time input:", e.target.value);
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
                                try {
                                  const timeValue = e.target.value;
                                  if (!timeValue || !timeValue.includes(":")) return;
                                  
                                  const [hours, minutes] = timeValue.split(":");
                                  const parsedHours = parseInt(hours, 10);
                                  const parsedMinutes = parseInt(minutes, 10);
                                  
                                  // Validate parsed values
                                  if (isNaN(parsedHours) || isNaN(parsedMinutes) || 
                                      parsedHours < 0 || parsedHours > 23 || 
                                      parsedMinutes < 0 || parsedMinutes > 59) {
                                    return;
                                  }
                                  
                                  const newDate = new Date(field.value || new Date());
                                  newDate.setHours(parsedHours, parsedMinutes, 0, 0);
                                  field.onChange(newDate);
                                } catch (error) {
                                  console.warn("Invalid time input:", e.target.value);
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
                </div>
              ) : (
                /* Dedicated Recurring Shift Calendar Interface */
                <div className="space-y-4 p-4 border border-blue-200 rounded-lg bg-blue-50/50">
                  <h4 className="text-md font-semibold text-blue-800">Recurring Shift Schedule</h4>
                  
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
                                  <span>Pick start date</span>
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
                              value={field.value || "09:00"}
                              onChange={(e) => {
                                try {
                                  const timeValue = e.target.value;
                                  if (timeValue && timeValue.match(/^\d{2}:\d{2}$/)) {
                                    field.onChange(timeValue);
                                  }
                                } catch (error) {
                                  console.warn("Invalid start time input:", e.target.value);
                                }
                              }}
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
                              value={field.value || "17:00"}
                              onChange={(e) => {
                                try {
                                  const timeValue = e.target.value;
                                  if (timeValue && timeValue.match(/^\d{2}:\d{2}$/)) {
                                    field.onChange(timeValue);
                                  }
                                } catch (error) {
                                  console.warn("Invalid end time input:", e.target.value);
                                }
                              }}
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
              )}
              </div>
            </div>

            <div className="space-y-4">
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

              {/* NDIS Budget Information */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fundingCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NDIS Budget Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select budget category" />
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

            {/* 🔁 Recurring Shift Pattern */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isRecurring"
                  checked={isRecurring}
                  onCheckedChange={(checked) => {
                    const isRecurringMode = checked as boolean;
                    
                    // Preserve current form data before switching modes
                    const currentValues = form.getValues();
                    setPreservedFormData(currentValues);
                    
                    setIsRecurring(isRecurringMode);
                    form.setValue("isRecurring", isRecurringMode);
                    
                    // Restore preserved weekdays when switching to recurring mode
                    if (isRecurringMode && preservedFormData.selectedWeekdays) {
                      setSelectedWeekdays(preservedFormData.selectedWeekdays);
                      form.setValue("selectedWeekdays", preservedFormData.selectedWeekdays);
                    } else if (!isRecurringMode) {
                      setSelectedWeekdays([]);
                      form.setValue("selectedWeekdays", []);
                    }
                  }}
                />
                <label htmlFor="isRecurring" className="text-lg font-medium">
                  🔁 Recurring Shift Pattern
                </label>
              </div>

              {isRecurring && (
                <div className="space-y-6 p-6 border-2 border-blue-200 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
                  <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">Configure Recurring Pattern</h3>
                  
                  {/* Dedicated Recurring Shift Calendar Interface */}
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
                        <Select onValueChange={field.onChange} defaultValue={field.value || "weekly"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
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
                        >
                          <div className="text-center">
                            <div className="text-xs font-medium">{day.slice(0, 3)}</div>
                            <div className="text-xs opacity-75">{day.slice(3)}</div>
                          </div>
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                    {selectedWeekdays.length === 0 && isRecurring && (
                      <p className="text-sm text-red-600 dark:text-red-400">Please select at least one day to enable pattern generation</p>
                    )}
                  </div>

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
                              max="104"
                              placeholder="Enter number of shifts (max 104)"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : 10)}
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

                  {/* Pattern Preview */}
                  {selectedWeekdays.length > 0 && (
                    <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">Pattern Preview</h4>
                      <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
                        <p>
                          <strong>Frequency:</strong> {form.watch("recurrenceType") || "weekly"}
                        </p>
                        <p>
                          <strong>Weekdays:</strong> {selectedWeekdays.join(", ")}
                        </p>
                        <p>
                          <strong>Duration:</strong> {
                            endConditionType === "occurrences" 
                              ? `${form.watch("numberOfOccurrences") || 10} occurrences`
                              : form.watch("recurrenceEndDate")
                                ? `Until ${format(form.watch("recurrenceEndDate")!, "PPP")}`
                                : "Until end date selected"
                          }
                        </p>
                        <div className="mt-2 p-2 bg-white dark:bg-gray-900 rounded border">
                          <p className="text-xs font-medium">
                            This pattern will generate approximately{" "}
                            <span className="font-bold text-blue-600">
                              {(() => {
                                const formData = form.getValues();
                                if (formData.selectedWeekdays && formData.selectedWeekdays.length > 0) {
                                  const previewShifts = generateRecurringShifts(formData as ShiftFormData);
                                  return previewShifts.length;
                                }
                                return 0;
                              })()}
                            </span>{" "}
                            shifts starting from {format(form.watch("startDateTime") ?? new Date(), "PPP")}
                          </p>
                        </div>
                      </div>
                    </div>
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