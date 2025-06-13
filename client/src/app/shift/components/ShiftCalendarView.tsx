import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar, Clock, User } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { type Shift } from "@shared/schema";
import ShiftStatusTag from "./ShiftStatusTag";

interface ShiftCalendarViewProps {
  shifts: Shift[];
  onShiftClick: (shift: Shift) => void;
  getClientName: (clientId: number | null) => string;
}

export default function ShiftCalendarView({ shifts, onShiftClick, getClientName }: ShiftCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd
  });

  const getShiftsForDay = (date: Date) => {
    return shifts.filter(shift => isSameDay(new Date(shift.startTime), date));
  };

  const nextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const prevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {format(currentDate, "MMMM yyyy")}
          </h3>
          <Button onClick={goToToday} variant="outline" size="sm">
            Today
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Button onClick={prevMonth} variant="outline" size="sm">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button onClick={nextMonth} variant="outline" size="sm">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-4">
          {/* Week Days Header */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-gray-500 dark:text-gray-400 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map(day => {
              const dayShifts = getShiftsForDay(day);
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const isDayToday = isToday(day);

              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[120px] p-2 border rounded-lg ${
                    isCurrentMonth 
                      ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700' 
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-800'
                  } ${isDayToday ? 'ring-2 ring-blue-500' : ''}`}
                >
                  <div className={`text-sm font-medium mb-2 ${
                    isDayToday 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : isCurrentMonth 
                        ? 'text-gray-900 dark:text-white' 
                        : 'text-gray-400 dark:text-gray-600'
                  }`}>
                    {format(day, 'd')}
                  </div>
                  
                  <div className="space-y-1">
                    {dayShifts.map(shift => {
                      // Determine shift colors based on status and assignment
                      const isUnassigned = !shift.userId;
                      const isRequested = (shift as any).status === "requested";
                      
                      let shiftColors = "";
                      if (isUnassigned && !isRequested) {
                        // Unassigned shifts - green (available to request)
                        shiftColors = "bg-green-50 dark:bg-green-950 hover:bg-green-100 dark:hover:bg-green-900 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100";
                      } else if (isRequested) {
                        // Requested shifts - orange (pending approval)
                        shiftColors = "bg-orange-50 dark:bg-orange-950 hover:bg-orange-100 dark:hover:bg-orange-900 border-orange-200 dark:border-orange-800 text-orange-900 dark:text-orange-100";
                      } else {
                        // Assigned shifts - blue (your shifts)
                        shiftColors = "bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100";
                      }

                      return (
                        <div
                          key={shift.id}
                          onClick={() => onShiftClick(shift)}
                          className={`cursor-pointer p-1 rounded text-xs border ${shiftColors} ${
                            isUnassigned && !isRequested ? 'ring-1 ring-green-300 dark:ring-green-700' : ''
                          }`}
                          title={isUnassigned && !isRequested ? "Click to request this shift" : ""}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium truncate">
                              {shift.title}
                            </span>
                            <ShiftStatusTag 
                              status={isUnassigned && !isRequested ? "available" : (shift as any).status || "assigned"} 
                              className="text-xs px-1 py-0" 
                            />
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{format(new Date(shift.startTime), "h:mm a")}</span>
                          </div>
                          
                          {shift.clientId && (
                            <div className="flex items-center gap-1 mt-1">
                              <User className="h-3 w-3" />
                              <span className="truncate">{getClientName(shift.clientId)}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-100 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded"></div>
          <span>Your Shifts</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-100 dark:bg-green-900 border border-green-200 dark:border-green-800 rounded"></div>
          <span>Available (Click to Request)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-orange-100 dark:bg-orange-900 border border-orange-200 dark:border-orange-800 rounded"></div>
          <span>Requested (Pending Approval)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-blue-500 rounded"></div>
          <span>Today</span>
        </div>
      </div>
    </div>
  );
}