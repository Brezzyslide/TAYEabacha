import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Clock, User, MapPin, Download } from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns";

interface SchedulesTabProps {
  clientId: string;
  companyId: string;
}

export default function SchedulesTab({ clientId, companyId }: SchedulesTabProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: scheduleData, isLoading } = useQuery({
    queryKey: [`/api/clients/${clientId}/schedules`, companyId, selectedDate],
    queryFn: () => Promise.resolve({
      shifts: [
        {
          id: 1,
          date: "2024-06-13",
          startTime: "09:00",
          endTime: "13:00",
          duration: 4,
          supportWorker: "Jane Smith",
          supportWorkerId: 101,
          status: "scheduled",
          type: "morning-support",
          location: "Client Home",
          activities: ["Personal care", "Meal preparation", "Medication administration"],
          notes: "Regular morning support session"
        },
        {
          id: 2,
          date: "2024-06-13",
          startTime: "15:00",
          endTime: "17:00",
          duration: 2,
          supportWorker: "Tom Wilson",
          supportWorkerId: 102,
          status: "completed",
          type: "community-access",
          location: "Shopping Center",
          activities: ["Community outing", "Shopping assistance"],
          notes: "Weekly grocery shopping trip"
        },
        {
          id: 3,
          date: "2024-06-14",
          startTime: "10:00",
          endTime: "14:00",
          duration: 4,
          supportWorker: "Sarah Brown",
          supportWorkerId: 103,
          status: "in-progress",
          type: "skills-development",
          location: "Client Home",
          activities: ["Cooking skills", "Life skills training"],
          notes: "Focus on meal preparation independence"
        },
        {
          id: 4,
          date: "2024-06-14",
          startTime: "19:00",
          endTime: "21:00",
          duration: 2,
          supportWorker: "Mike Johnson",
          supportWorkerId: 104,
          status: "scheduled",
          type: "evening-support",
          location: "Client Home",
          activities: ["Evening routine", "Medication administration"],
          notes: "Evening medication and personal care"
        },
        {
          id: 5,
          date: "2024-06-15",
          startTime: "09:00",
          endTime: "12:00",
          duration: 3,
          supportWorker: "Jane Smith",
          supportWorkerId: 101,
          status: "scheduled",
          type: "health-appointment",
          location: "Medical Center",
          activities: ["GP appointment", "Transport support"],
          notes: "Quarterly health check-up"
        },
        {
          id: 6,
          date: "2024-06-16",
          startTime: "14:00",
          endTime: "16:00",
          duration: 2,
          supportWorker: "Tom Wilson",
          supportWorkerId: 102,
          status: "cancelled",
          type: "community-access",
          location: "Library",
          activities: ["Library visit", "Reading support"],
          notes: "Cancelled due to client illness"
        },
        {
          id: 7,
          date: "2024-06-17",
          startTime: "11:00",
          endTime: "15:00",
          duration: 4,
          supportWorker: "Sarah Brown",
          supportWorkerId: 103,
          status: "scheduled",
          type: "social-activities",
          location: "Community Center",
          activities: ["Social group", "Recreational activities"],
          notes: "Weekly social skills group session"
        }
      ]
    })
  });

  if (isLoading) {
    return <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <Card key={i} className="animate-pulse">
          <CardHeader>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded"></div>
              <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>;
  }

  const data = scheduleData!;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-500";
      case "in-progress": return "bg-blue-500";
      case "scheduled": return "bg-gray-500";
      case "cancelled": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "in-progress": return "secondary";
      case "scheduled": return "outline";
      case "cancelled": return "destructive";
      default: return "outline";
    }
  };

  const filteredShifts = data.shifts.filter(shift => 
    statusFilter === "all" || shift.status === statusFilter
  );

  const getWeekDays = (date: Date) => {
    const start = startOfWeek(date, { weekStartsOn: 1 });
    const end = endOfWeek(date, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  };

  const getShiftsForDate = (date: Date) => {
    return filteredShifts.filter(shift => 
      isSameDay(new Date(shift.date), date)
    );
  };

  const weekDays = getWeekDays(selectedDate);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2">
          <Select value={viewMode} onValueChange={(value: "week" | "month") => setViewMode(value)}>
            <SelectTrigger className="w-32">
              <CalendarIcon className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Week View</SelectItem>
              <SelectItem value="month">Month View</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setSelectedDate(new Date())}
          >
            Today
          </Button>
          <Button onClick={() => console.log("Exporting schedule...")}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {viewMode === "week" ? (
        <div className="space-y-4">
          {/* Week Navigation */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Week of {format(weekDays[0], "MMM dd")} - {format(weekDays[6], "MMM dd, yyyy")}
            </h3>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedDate(addDays(selectedDate, -7))}
              >
                Previous
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedDate(addDays(selectedDate, 7))}
              >
                Next
              </Button>
            </div>
          </div>

          {/* Week Calendar */}
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            {weekDays.map((day) => {
              const dayShifts = getShiftsForDate(day);
              const isToday = isSameDay(day, new Date());
              
              return (
                <Card key={day.toISOString()} className={isToday ? "ring-2 ring-blue-500" : ""}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-center">
                      {format(day, "EEE")}
                      <div className="text-lg font-bold">{format(day, "dd")}</div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {dayShifts.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No shifts
                      </p>
                    ) : (
                      dayShifts.map((shift) => (
                        <div 
                          key={shift.id}
                          className="p-2 border rounded text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">
                              {shift.startTime} - {shift.endTime}
                            </span>
                            <div className={`w-2 h-2 rounded-full ${getStatusColor(shift.status)}`} />
                          </div>
                          <p className="text-muted-foreground">{shift.supportWorker}</p>
                          <p className="text-muted-foreground">{shift.type.replace("-", " ")}</p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Month Calendar */}
          <Card>
            <CardHeader>
              <CardTitle>Calendar</CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                className="rounded-md border"
              />
            </CardContent>
          </Card>

          {/* Selected Date Details */}
          <Card>
            <CardHeader>
              <CardTitle>
                {format(selectedDate, "EEEE, MMMM dd, yyyy")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {getShiftsForDate(selectedDate).length === 0 ? (
                <p className="text-muted-foreground">No shifts scheduled for this date.</p>
              ) : (
                getShiftsForDate(selectedDate).map((shift) => (
                  <div key={shift.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {shift.startTime} - {shift.endTime} ({shift.duration}h)
                      </span>
                      <Badge variant={getStatusBadge(shift.status) as any}>
                        {shift.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {shift.supportWorker}
                      </p>
                      <p className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {shift.location}
                      </p>
                      <p>{shift.type.replace("-", " ").toUpperCase()}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium">Activities:</p>
                      <ul className="text-xs text-muted-foreground">
                        {shift.activities.map((activity, index) => (
                          <li key={index}>• {activity}</li>
                        ))}
                      </ul>
                    </div>
                    {shift.notes && (
                      <p className="text-xs text-muted-foreground border-t pt-2">
                        <strong>Notes:</strong> {shift.notes}
                      </p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Schedule Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Schedule Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {data.shifts.length}
              </div>
              <p className="text-sm text-muted-foreground">Total Shifts</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {data.shifts.filter(s => s.status === "completed").length}
              </div>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                {data.shifts.filter(s => s.status === "scheduled").length}
              </div>
              <p className="text-sm text-muted-foreground">Scheduled</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {data.shifts.filter(s => s.status === "in-progress").length}
              </div>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {data.shifts.reduce((total, shift) => total + shift.duration, 0)}h
              </div>
              <p className="text-sm text-muted-foreground">Total Hours</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}