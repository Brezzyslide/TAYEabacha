import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Pill, 
  Clock, 
  User, 
  Calendar, 
  Plus, 
  AlertTriangle, 
  CheckCircle,
  X,
  Calendar as CalendarIcon
} from "lucide-react";
import { format, addDays, startOfWeek, isSameDay, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface MedicationPlan {
  id: number;
  clientId: number;
  medicationName: string;
  dosage: string;
  frequency: string;
  route: string;
  timeOfDay: string;
  startDate: string;
  endDate?: string;
  instructions: string;
  status: string;
  client?: {
    id: number;
    firstName: string;
    lastName: string;
    fullName: string;
  };
}

interface ScheduledSlot {
  id: string;
  time: string;
  date: string;
  clientId: number;
  planId: number;
  medicationName: string;
  dosage: string;
  route: string;
  clientName: string;
  status: 'scheduled' | 'administered' | 'missed' | 'refused';
}

interface TimeSlot {
  id: string;
  time: string;
  label: string;
}

const TIME_SLOTS: TimeSlot[] = [
  { id: "morning", time: "08:00", label: "Morning (8:00 AM)" },
  { id: "midday", time: "12:00", label: "Midday (12:00 PM)" },
  { id: "afternoon", time: "16:00", label: "Afternoon (4:00 PM)" },
  { id: "evening", time: "20:00", label: "Evening (8:00 PM)" },
  { id: "night", time: "22:00", label: "Night (10:00 PM)" },
];

export default function MedicationScheduler() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekDates, setWeekDates] = useState<Date[]>([]);
  const [scheduledSlots, setScheduledSlots] = useState<ScheduledSlot[]>([]);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('week');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ timeSlot: string; date: Date } | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Generate week dates
  useEffect(() => {
    const startDate = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Monday start
    const dates = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));
    setWeekDates(dates);
  }, [selectedDate]);

  // Fetch medication plans
  const { data: medicationPlans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["/api/medication-plans"],
  });

  // Fetch scheduled medications for the week
  const { data: scheduledMedications = [], isLoading: scheduledLoading } = useQuery({
    queryKey: ["/api/medication-schedules", format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      try {
        const result = await apiRequest("GET", `/api/medication-schedules?date=${format(selectedDate, 'yyyy-MM-dd')}`);
        // Ensure we always return an array
        return Array.isArray(result) ? result : [];
      } catch (error) {
        console.error("Error fetching medication schedules:", error);
        return [];
      }
    },
  });

  // Create medication schedule mutation
  const createScheduleMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/medication-schedules", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medication-schedules"] });
      toast({
        title: "Success",
        description: "Medication scheduled successfully",
      });
      setShowScheduleModal(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to schedule medication",
        variant: "destructive",
      });
    },
  });

  // Update schedule mutation
  const updateScheduleMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/medication-schedules/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medication-schedules"] });
      toast({
        title: "Success",
        description: "Schedule updated successfully",
      });
    },
  });

  // Delete schedule mutation
  const deleteScheduleMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/medication-schedules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medication-schedules"] });
      toast({
        title: "Success",
        description: "Schedule removed successfully",
      });
    },
  });

  // Handle drag end
  const handleDragEnd = (result: any) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    // Parse the destination (timeSlot_date format)
    const [timeSlot, dateStr] = destination.droppableId.split('_');
    const plan = medicationPlans.find((p: MedicationPlan) => p.id.toString() === draggableId);

    if (!plan) return;

    const scheduleData = {
      planId: plan.id,
      clientId: plan.clientId,
      timeSlot,
      scheduledDate: dateStr,
      medicationName: plan.medicationName,
      dosage: plan.dosage,
      route: plan.route,
      status: 'scheduled'
    };

    createScheduleMutation.mutate(scheduleData);
  };

  // Get scheduled slots for a specific time and date
  const getScheduledSlots = (timeSlot: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    // Ensure scheduledMedications is an array before filtering
    const medications = Array.isArray(scheduledMedications) ? scheduledMedications : [];
    return medications.filter((slot: any) => 
      slot.timeSlot === timeSlot && slot.scheduledDate === dateStr
    );
  };

  // Handle status update
  const handleStatusUpdate = (scheduleId: string, newStatus: string) => {
    updateScheduleMutation.mutate({ id: scheduleId, status: newStatus });
  };

  // Handle removing scheduled medication
  const handleRemoveSchedule = (scheduleId: string) => {
    deleteScheduleMutation.mutate(scheduleId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'administered': return 'bg-green-100 text-green-800 border-green-200';
      case 'missed': return 'bg-red-100 text-red-800 border-red-200';
      case 'refused': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'administered': return <CheckCircle className="h-3 w-3" />;
      case 'missed': return <X className="h-3 w-3" />;
      case 'refused': return <AlertTriangle className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  if (plansLoading || scheduledLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Medication Scheduler
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Drag medication plans to schedule them across the week
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Tabs value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
            <TabsList>
              <TabsTrigger value="day">Day View</TabsTrigger>
              <TabsTrigger value="week">Week View</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <Button
            variant="outline"
            onClick={() => setSelectedDate(new Date())}
            className="flex items-center gap-2"
          >
            <CalendarIcon className="h-4 w-4" />
            Today
          </Button>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Medication Plans Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Pill className="h-5 w-5" />
                  Available Medications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Droppable droppableId="medication-plans">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-2"
                    >
                      {medicationPlans.map((plan: MedicationPlan, index: number) => (
                        <Draggable
                          key={plan.id}
                          draggableId={plan.id.toString()}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`p-3 rounded-lg border transition-all ${
                                snapshot.isDragging
                                  ? 'shadow-lg bg-white dark:bg-gray-800 rotate-2'
                                  : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="font-medium text-sm">
                                  {plan.medicationName}
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                  {plan.client?.fullName}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {plan.dosage} • {plan.route}
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {plan.frequency}
                                </Badge>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
                
                {medicationPlans.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Pill className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No medication plans available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Schedule Grid */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {viewMode === 'week' ? 'Weekly Schedule' : 'Daily Schedule'}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDate(addDays(selectedDate, -7))}
                    >
                      Previous Week
                    </Button>
                    <span className="text-sm font-medium px-3">
                      {format(weekDates[0] || selectedDate, 'MMM d')} - {format(weekDates[6] || selectedDate, 'MMM d, yyyy')}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDate(addDays(selectedDate, 7))}
                    >
                      Next Week
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <div className="grid grid-cols-8 gap-2 min-w-[800px]">
                    {/* Header Row */}
                    <div className="p-2 font-medium text-sm text-gray-600 dark:text-gray-400">
                      Time
                    </div>
                    {weekDates.map((date) => (
                      <div key={date.toISOString()} className="p-2 text-center">
                        <div className="font-medium text-sm">
                          {format(date, 'EEE')}
                        </div>
                        <div className={`text-xs mt-1 ${
                          isSameDay(date, new Date()) 
                            ? 'text-blue-600 font-bold' 
                            : 'text-gray-500'
                        }`}>
                          {format(date, 'd')}
                        </div>
                      </div>
                    ))}

                    {/* Time Slot Rows */}
                    {TIME_SLOTS.map((timeSlot) => (
                      <div key={timeSlot.id} className="contents">
                        {/* Time Label */}
                        <div className="p-3 text-sm font-medium text-gray-600 dark:text-gray-400 border-r">
                          {timeSlot.label}
                        </div>
                        
                        {/* Day Columns */}
                        {weekDates.map((date) => {
                          const dateStr = format(date, 'yyyy-MM-dd');
                          const droppableId = `${timeSlot.id}_${dateStr}`;
                          const scheduledSlots = getScheduledSlots(timeSlot.id, date);
                          
                          return (
                            <Droppable key={droppableId} droppableId={droppableId}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className={`min-h-[80px] p-2 border rounded-lg transition-colors ${
                                    snapshot.isDraggedOver
                                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300'
                                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                                  }`}
                                >
                                  <div className="space-y-1">
                                    {scheduledSlots.map((slot: any) => (
                                      <div
                                        key={slot.id}
                                        className={`p-2 rounded border text-xs ${getStatusColor(slot.status)}`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1">
                                            {getStatusIcon(slot.status)}
                                            <span className="font-medium">
                                              {slot.medicationName}
                                            </span>
                                          </div>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-4 w-4 p-0 hover:bg-red-100"
                                            onClick={() => handleRemoveSchedule(slot.id)}
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </div>
                                        <div className="text-xs opacity-75">
                                          {slot.clientName} • {slot.dosage}
                                        </div>
                                        <div className="flex gap-1 mt-1">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 text-xs px-1"
                                            onClick={() => handleStatusUpdate(slot.id, 'administered')}
                                          >
                                            ✓
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 text-xs px-1"
                                            onClick={() => handleStatusUpdate(slot.id, 'missed')}
                                          >
                                            ✗
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 text-xs px-1"
                                            onClick={() => handleStatusUpdate(slot.id, 'refused')}
                                          >
                                            !
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  {provided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DragDropContext>
    </div>
  );
}