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

          {/* Rectangular Calendar Grid */}
          <div className="grid grid-cols-7 gap-0 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {calendarDays.map(day => {
              const dayShifts = getShiftsForDay(day);
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const isDayToday = isToday(day);

              return (
                <div
                  key={day.toISOString()}
                  className={`aspect-square min-h-[140px] p-2 border-r border-b border-gray-200 dark:border-gray-700 last:border-r-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                    isCurrentMonth 
                      ? isDayToday 
                        ? 'bg-blue-50 dark:bg-blue-900/20' 
                        : 'bg-white dark:bg-gray-900'
                      : 'bg-gray-50 dark:bg-gray-800'
                  }`}
                >
                  <div className="h-full flex flex-col">
                    <div className={`text-sm font-medium mb-2 ${
                      isDayToday 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : isCurrentMonth 
                          ? 'text-gray-900 dark:text-gray-100'
                          : 'text-gray-400 dark:text-gray-600'
                    }`}>
                      {format(day, 'd')}
                    </div>
                    
                    <div className="flex-1 space-y-1 overflow-y-auto">
                      {dayShifts.map(shift => {
                        const isAssigned = shift.userId !== null;
                        const clientName = getClientName(shift.clientId);
                        
                        return (
                          <div
                            key={shift.id}
                            onClick={() => onShiftClick(shift)}
                            className={`p-1.5 rounded text-xs cursor-pointer hover:scale-105 transform transition-all duration-200 shadow-sm ${
                              isAssigned 
                                ? 'bg-green-500 text-white border border-green-600' 
                                : 'bg-red-500 text-white border border-red-600'
                            }`}
                          >
                            <div className="font-medium truncate mb-1">
                              {shift.title}
                            </div>
                            
                            <div className="flex items-center gap-1 text-xs opacity-90">
                              <Clock className="h-3 w-3" />
                              <span>
                                {shift.startTime ? format(new Date(shift.startTime), 'HH:mm') : 'TBD'}
                              </span>
                            </div>
                            
                            {isAssigned && (
                              <div className="flex items-center gap-1 text-xs opacity-90 mt-1">
                                <User className="h-3 w-3" />
                                <span className="truncate">Assigned</span>
                              </div>
                            )}
                            
                            {clientName && clientName !== 'Unknown Client' && (
                              <div className="text-xs opacity-90 mt-1 truncate">
                                🏠 {clientName}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
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
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span>Assigned Shifts</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span>Unassigned Shifts</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-blue-500 rounded"></div>
          <span>Today</span>
        </div>
      </div>
    </div>
  );
}