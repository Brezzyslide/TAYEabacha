import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, ChevronLeft, ChevronRight, User } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, isToday, isSameMonth } from "date-fns";

interface SchedulesTabProps {
  clientId: string;
  companyId: string;
}

export default function SchedulesTab({ clientId, companyId }: SchedulesTabProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedShift, setSelectedShift] = useState<any>(null);

  // Handle missing clientId
  if (!clientId) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Client ID Missing</h3>
          <p className="text-gray-600">Client ID is missing from URL.</p>
        </CardContent>
      </Card>
    );
  }

  // Fetch shifts for this client
  const { data: shifts = [], isLoading, error } = useQuery({
    queryKey: ["/api/shifts", { clientId }],
    queryFn: () => fetch(`/api/shifts?clientId=${clientId}`).then(res => {
      if (!res.ok) throw new Error('Failed to fetch shifts');
      return res.json();
    }),
    enabled: !!clientId,
  });

  // Generate calendar days for the current month
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Get shifts for a specific date
  const getShiftsForDate = (date: Date) => {
    return shifts.filter((shift: any) => {
      const shiftDate = new Date(shift.startTime);
      const isSame = isSameDay(date, shiftDate);
      
      // Debug logging for shift "6" to help locate it
      if (shift.title === "6") {
        console.log(`[CLIENT SCHEDULE DEBUG] Shift ${shift.id}: stored=${shift.startTime}, shiftDate=${shiftDate.toDateString()}, calendar=${date.toDateString()}, match=${isSame}`);
      }
      
      return isSame;
    });
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in-progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'scheduled':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Navigation functions
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading schedules...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold">
              Schedule Calendar - {format(currentDate, "MMMM yyyy")}
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={goToToday}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
              <div key={day} className="p-3 text-center font-medium text-sm text-gray-600 bg-gray-50 rounded-t">
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {calendarDays.map((day, index) => {
              const dayShifts = getShiftsForDate(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isCurrentDay = isToday(day);
              
              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-24 p-2 border border-gray-200 ${
                    isCurrentDay ? "bg-blue-50 border-blue-300" : "bg-white"
                  } ${!isCurrentMonth ? "bg-gray-50 text-gray-400" : ""}`}
                >
                  <div className={`text-sm font-medium mb-2 ${
                    isCurrentDay ? "text-blue-600" : isCurrentMonth ? "text-gray-900" : "text-gray-400"
                  }`}>
                    {format(day, "d")}
                  </div>
                  
                  {/* Shifts for this day */}
                  <div className="space-y-1">
                    {dayShifts.slice(0, 3).map((shift: any) => (
                      <div
                        key={shift.id}
                        className={`text-xs p-1 rounded cursor-pointer hover:opacity-80 border ${getStatusColor(shift.status)}`}
                        onClick={() => setSelectedShift(shift)}
                      >
                        <div className="font-medium truncate">
                          {shift.title || "Shift"}
                        </div>
                        <div className="truncate">
                          {format(new Date(shift.startTime), "HH:mm")} - {format(new Date(shift.endTime), "HH:mm")}
                        </div>
                      </div>
                    ))}
                    
                    {/* Show overflow indicator */}
                    {dayShifts.length > 3 && (
                      <div className="text-xs text-gray-500 font-medium">
                        +{dayShifts.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Shift Details Modal/Card */}
      {selectedShift && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Shift Details</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setSelectedShift(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3">Basic Information</h4>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">
                      {format(new Date(selectedShift.startTime), "EEEE, MMMM d, yyyy")}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">
                      {format(new Date(selectedShift.startTime), "HH:mm")} - {format(new Date(selectedShift.endTime), "HH:mm")}
                    </span>
                  </div>
                  {selectedShift.location && (
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">{selectedShift.location}</span>
                    </div>
                  )}
                  {selectedShift.userId && (
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">Staff ID: {selectedShift.userId}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Status & Timing</h4>
                <div className="space-y-2">
                  <div>
                    <span className={`px-2 py-1 rounded text-xs border ${getStatusColor(selectedShift.status)}`}>
                      {selectedShift.status}
                    </span>
                  </div>
                  {selectedShift.checkinTime && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Check-in: </span>
                      {format(new Date(selectedShift.checkinTime), "HH:mm")}
                    </div>
                  )}
                  {selectedShift.checkoutTime && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Check-out: </span>
                      {format(new Date(selectedShift.checkoutTime), "HH:mm")}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {selectedShift.notes && (
              <div className="mt-6 pt-6 border-t">
                <h4 className="font-medium mb-2">Notes</h4>
                <p className="text-sm text-gray-700">{selectedShift.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Monthly Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{shifts.length}</div>
              <div className="text-sm text-gray-600">Total Shifts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {shifts.filter((s: any) => s.status === 'completed').length}
              </div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {shifts.filter((s: any) => s.status === 'scheduled').length}
              </div>
              <div className="text-sm text-gray-600">Scheduled</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {shifts.filter((s: any) => s.status === 'cancelled').length}
              </div>
              <div className="text-sm text-gray-600">Cancelled</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Empty state when no shifts */}
      {shifts.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No shifts scheduled</h3>
            <p className="text-gray-600">
              No shifts scheduled for this client yet.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}