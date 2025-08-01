import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Calendar, Clock, AlertTriangle, Save, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import ConflictDetectionBanner from "./components/ConflictDetectionBanner";
import MyAvailabilityList from "./MyAvailabilityList";

const daysOfWeek = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
];

const availabilityFormSchema = z.object({
  availableDays: z.array(z.string()).min(1, "Select at least one day"),
  timeSlots: z.record(z.object({
    start: z.string().min(1, "Start time is required"),
    end: z.string().min(1, "End time is required"),
  })),
  recurrencePattern: z.enum(["weekly", "fortnightly", "monthly"]),
});

type AvailabilityFormData = z.infer<typeof availabilityFormSchema>;

interface TimeSlot {
  start: string;
  end: string;
}

interface StaffAvailability {
  id: number;
  availabilityId: string;
  userId: number;
  companyId: number;
  availableDays: string[];
  timeSlots: Record<string, TimeSlot>;
  recurrencePattern: string;
  overrideByManager: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function MyAvailabilityPage() {
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [timeSlots, setTimeSlots] = useState<Record<string, TimeSlot>>({});
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AvailabilityFormData>({
    resolver: zodResolver(availabilityFormSchema),
    defaultValues: {
      availableDays: [],
      timeSlots: {},
      recurrencePattern: "weekly",
    },
  });

  const { data: availability, isLoading } = useQuery<StaffAvailability[]>({
    queryKey: ["/api/staff-availability"],
    queryFn: async () => {
      const response = await fetch("/api/staff-availability");
      if (!response.ok) throw new Error("Failed to fetch availability");
      return response.json();
    },
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ["/api/shifts"],
  });

  const userAvailability = useMemo(() => {
    return availability?.find(a => a.userId === user?.id && a.isActive);
  }, [availability, user?.id]);

  const availabilityConflicts = useMemo(() => {
    if (!userAvailability || !shifts) return [];
    
    return (shifts as any[]).filter(shift => {
      if (shift.userId !== user?.id) return false;
      
      const shiftDate = new Date(shift.startTime);
      const dayName = shiftDate.toLocaleDateString('en-US', { weekday: 'long' });
      
      if (!userAvailability.availableDays.includes(dayName)) return true;
      
      const daySlot = userAvailability.timeSlots[dayName];
      if (!daySlot) return true;
      
      const shiftStart = shiftDate.toTimeString().slice(0, 5);
      const shiftEnd = shift.endTime ? new Date(shift.endTime).toTimeString().slice(0, 5) : "23:59";
      
      return shiftStart < daySlot.start || shiftEnd > daySlot.end;
    });
  }, [userAvailability, shifts, user?.id]);

  const saveAvailabilityMutation = useMutation({
    mutationFn: async (data: AvailabilityFormData) => {
      if (!user?.tenantId) throw new Error("No tenant ID available");
      
      const availabilityData = {
        availabilityId: `avail_${Date.now()}`,
        userId: user.id,
        companyId: user.tenantId,
        availableDays: data.availableDays,
        timeSlots: data.timeSlots,
        recurrencePattern: data.recurrencePattern,
        overrideByManager: false,
        isActive: true,
      };

      if (userAvailability) {
        const response = await apiRequest("PUT", `/api/staff-availability/${userAvailability.id}`, availabilityData);
        return response.json();
      } else {
        const response = await apiRequest("POST", "/api/staff-availability", availabilityData);
        return response.json();
      }
    },
    onSuccess: () => {
      toast({
        title: "Availability Updated",
        description: "Your availability has been saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/staff-availability"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Save Availability",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDayToggle = (day: string, checked: boolean) => {
    let newSelectedDays: string[];
    
    if (checked) {
      newSelectedDays = [...selectedDays, day];
      // Set default time slot for new day
      setTimeSlots(prev => ({
        ...prev,
        [day]: { start: "09:00", end: "17:00" }
      }));
    } else {
      newSelectedDays = selectedDays.filter(d => d !== day);
      // Remove time slot for unchecked day
      setTimeSlots(prev => {
        const { [day]: removed, ...rest } = prev;
        return rest;
      });
    }
    
    setSelectedDays(newSelectedDays);
    form.setValue("availableDays", newSelectedDays);
    form.setValue("timeSlots", timeSlots);
  };

  const handleTimeChange = (day: string, type: "start" | "end", value: string) => {
    const newTimeSlots = {
      ...timeSlots,
      [day]: {
        ...timeSlots[day],
        [type]: value
      }
    };
    setTimeSlots(newTimeSlots);
    form.setValue("timeSlots", newTimeSlots);
  };

  const loadExistingAvailability = () => {
    if (userAvailability) {
      setSelectedDays(userAvailability.availableDays);
      setTimeSlots(userAvailability.timeSlots);
      form.setValue("availableDays", userAvailability.availableDays);
      form.setValue("timeSlots", userAvailability.timeSlots);
      form.setValue("recurrencePattern", userAvailability.recurrencePattern as any);
    }
  };

  // Load existing availability on component mount
  useEffect(() => {
    if (userAvailability && selectedDays.length === 0) {
      loadExistingAvailability();
    }
  }, [userAvailability]);

  const onSubmit = (data: AvailabilityFormData) => {
    saveAvailabilityMutation.mutate(data);
  };

  const renderQuickPatterns = () => {
    const patterns = [
      { name: "Mon-Fri 9-5", days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], time: { start: "09:00", end: "17:00" } },
      { name: "Weekends", days: ["Saturday", "Sunday"], time: { start: "10:00", end: "18:00" } },
      { name: "Mon-Wed-Fri", days: ["Monday", "Wednesday", "Friday"], time: { start: "08:00", end: "16:00" } },
      { name: "Night Shift", days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], time: { start: "22:00", end: "06:00" } },
    ];

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Patterns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {patterns.map(pattern => (
              <Button
                key={pattern.name}
                variant="outline"
                onClick={() => {
                  setSelectedDays(pattern.days);
                  const newTimeSlots: Record<string, TimeSlot> = {};
                  pattern.days.forEach(day => {
                    newTimeSlots[day] = pattern.time;
                  });
                  setTimeSlots(newTimeSlots);
                  form.setValue("availableDays", pattern.days);
                  form.setValue("timeSlots", newTimeSlots);
                }}
                className="h-auto py-3 px-4 text-left"
              >
                <div>
                  <div className="font-medium">{pattern.name}</div>
                  <div className="text-sm text-gray-500">{pattern.time.start} - {pattern.time.end}</div>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 p-6">
            <div className="text-center py-8">Loading availability...</div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6">
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Availability</h1>
              <p className="text-gray-600 mt-1">Manage your work schedule and availability patterns</p>
            </div>

            {/* Conflict Detection */}
            {availabilityConflicts.length > 0 && (
              <ConflictDetectionBanner conflicts={availabilityConflicts} />
            )}

            {/* Current Availability Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5" />
                  <span>Current Availability Status</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {userAvailability ? (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Badge variant="default">Active</Badge>
                      <span className="text-sm text-gray-600">
                        Pattern: {userAvailability.recurrencePattern}
                      </span>
                      {userAvailability.overrideByManager && (
                        <Badge variant="destructive">Manager Override</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                      {daysOfWeek.map(day => {
                        const isAvailable = userAvailability.availableDays.includes(day);
                        const timeSlot = userAvailability.timeSlots[day];
                        return (
                          <div key={day} className={`p-2 rounded-lg text-center text-sm ${
                            isAvailable ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
                          }`}>
                            <div className="font-medium">{day.slice(0, 3)}</div>
                            {isAvailable && timeSlot && (
                              <div className="text-xs">
                                {timeSlot.start}-{timeSlot.end}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="mx-auto h-12 w-12 mb-4" />
                    <p>No availability set yet. Define your schedule below.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Tabs defaultValue="edit" className="space-y-6">
              <TabsList>
                <TabsTrigger value="edit">Edit Availability</TabsTrigger>
                <TabsTrigger value="submissions">My Submissions</TabsTrigger>
                <TabsTrigger value="patterns">Quick Patterns</TabsTrigger>
              </TabsList>

              <TabsContent value="submissions">
                <MyAvailabilityList />
              </TabsContent>

              <TabsContent value="patterns">
                {renderQuickPatterns()}
              </TabsContent>

              <TabsContent value="edit">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* Day Selection */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Available Days</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {daysOfWeek.map(day => (
                            <div key={day} className="flex items-center space-x-4 p-3 border rounded-lg">
                              <Checkbox
                                id={day}
                                checked={selectedDays.includes(day)}
                                onCheckedChange={(checked) => handleDayToggle(day, checked as boolean)}
                              />
                              <Label htmlFor={day} className="flex-1 font-medium">
                                {day}
                              </Label>
                              {selectedDays.includes(day) && (
                                <div className="flex items-center space-x-2">
                                  <Input
                                    type="time"
                                    value={timeSlots[day]?.start || "09:00"}
                                    onChange={(e) => handleTimeChange(day, "start", e.target.value)}
                                    className="w-24"
                                  />
                                  <span>to</span>
                                  <Input
                                    type="time"
                                    value={timeSlots[day]?.end || "17:00"}
                                    onChange={(e) => handleTimeChange(day, "end", e.target.value)}
                                    className="w-24"
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Recurrence Pattern */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Recurrence Pattern</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <FormField
                          control={form.control}
                          name="recurrencePattern"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>How often does this pattern repeat?</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select pattern" />
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
                      </CardContent>
                    </Card>

                    {/* Actions */}
                    <div className="flex justify-end space-x-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setSelectedDays([]);
                          setTimeSlots({});
                          form.reset();
                        }}
                      >
                        Clear All
                      </Button>
                      <Button
                        type="submit"
                        disabled={saveAvailabilityMutation.isPending || selectedDays.length === 0}
                      >
                        {saveAvailabilityMutation.isPending ? (
                          <>
                            <Save className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Save Availability
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}