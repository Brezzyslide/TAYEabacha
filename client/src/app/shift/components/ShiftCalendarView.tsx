import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar, Clock, User } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths, addYears, subYears, startOfWeek, endOfWeek, startOfDay, endOfDay, addDays, addWeeks, subWeeks } from "date-fns";
import { type Shift } from "@shared/schema";
import ShiftStatusTag from "./ShiftStatusTag";

interface ShiftCalendarViewProps {
  shifts: Shift[];
  filterPeriod: "daily" | "weekly" | "fortnightly" | "monthly";
  onShiftClick: (shift: Shift) => void;
  getClientName: (clientId: number | null) => string;
}

export default function ShiftCalendarView({ shifts, filterPeriod, onShiftClick, getClientName }: ShiftCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Dynamic calendar range based on filter period
  const getCalendarRange = () => {
    switch (filterPeriod) {
      case "daily":
        return {
          start: startOfDay(currentDate),
          end: endOfDay(currentDate)
        };
      case "weekly":
        return {
          start: startOfWeek(currentDate),
          end: endOfWeek(currentDate)
        };
      case "fortnightly":
        return {
          start: startOfWeek(currentDate),
          end: addDays(endOfWeek(currentDate), 7)
        };
      case "monthly":
      default:
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        return {
          start: startOfWeek(monthStart),
          end: endOfWeek(monthEnd)
        };
    }
  };

  const { start: calendarStart, end: calendarEnd } = getCalendarRange();
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getShiftsForDay = (date: Date) => {
    const dayShifts = shifts.filter(shift => {
      if (!shift.startTime) return false;
      try {
        // Parse the stored date (already in the correct timezone when created)
        const shiftDate = new Date(shift.startTime);
        
        // Use isSameDay from date-fns which handles timezone conversion properly
        const isSame = isSameDay(shiftDate, date);
        

        
        return isSame;
      } catch (error) {
        console.warn('Invalid date in shift:', shift);
        return false;
      }
    });
    
    return dayShifts;
  };

  const nextWeek = () => {
    setCurrentDate(addWeeks(currentDate, 1));
  };

  const prevWeek = () => {
    setCurrentDate(subWeeks(currentDate, 1));
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
      {/* Calendar Header with Year Navigation */}
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
          {/* Week and Month Navigation */}
          <Button 
            onClick={prevMonth} 
            variant="outline" 
            size="sm"
            title="Previous Month"
          >
            <ChevronLeft className="h-4 w-4" />
            <ChevronLeft className="h-4 w-4 -ml-2" />
          </Button>
          <Button onClick={prevWeek} variant="outline" size="sm" title="Previous Week">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button onClick={nextWeek} variant="outline" size="sm" title="Next Week">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button 
            onClick={nextMonth} 
            variant="outline" 
            size="sm"
            title="Next Month"
          >
            <ChevronRight className="h-4 w-4" />
            <ChevronRight className="h-4 w-4 -ml-2" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-4">
          {filterPeriod === "daily" ? (
            /* Single Day View */
            <div className="space-y-4">
              <div className="text-center text-lg font-semibold text-gray-900 dark:text-white">
                {format(currentDate, 'EEEE, MMMM d, yyyy')}
              </div>
              <div className="max-w-md mx-auto">
                {(() => {
                  const dayShifts = getShiftsForDay(currentDate);
                  const isDayToday = isToday(currentDate);
                  
                  return (
                    <div className={`p-4 rounded-lg border-2 min-h-[200px] ${
                      isDayToday 
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
                        : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
                    }`}>
                      <div className="space-y-3">
                        {dayShifts.length === 0 ? (
                          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                            <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>No shifts scheduled for this day</p>
                          </div>
                        ) : (
                          dayShifts.map(shift => {
                            const isAssigned = shift.userId !== null;
                            const clientName = getClientName(shift.clientId);
                            
                            return (
                              <div
                                key={shift.id}
                                onClick={() => onShiftClick(shift)}
                                className={`p-2 rounded-xl cursor-pointer hover:scale-[1.02] transform transition-all duration-300 shadow-sm border backdrop-blur-sm ${
                                  shift.status === 'completed'
                                    ? 'bg-gradient-to-r from-emerald-500/90 to-emerald-600/90 text-white border-emerald-400/30'
                                    : shift.status === 'in-progress'
                                    ? 'bg-gradient-to-r from-orange-500/90 to-orange-600/90 text-white border-orange-400/30'
                                    : shift.status === 'requested'
                                    ? 'bg-gradient-to-r from-yellow-500/90 to-yellow-600/90 text-white border-yellow-400/30'
                                    : isAssigned 
                                    ? 'bg-gradient-to-r from-green-500/90 to-green-600/90 text-white border-green-400/30' 
                                    : 'bg-gradient-to-r from-red-500/90 to-red-600/90 text-white border-red-400/30'
                                }`}
                              >
                                <div className="font-semibold text-xs truncate">
                                  {shift.title || 'Untitled Shift'}
                                </div>
                                <div className="text-xs opacity-80 truncate">
                                  {clientName}
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                  <span className="flex items-center gap-1 text-xs">
                                    <Clock className="h-3 w-3" />
                                    {shift.startTime && format(new Date(shift.startTime), 'HH:mm')}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            /* Multi-Day Grid View */
            <>
              {/* Week Days Header */}
              <div className="grid grid-cols-7 gap-2 mb-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-sm font-medium text-gray-500 dark:text-gray-400 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Collapsed Calendar Grid */}
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
                            className={`p-1 rounded-lg text-xs cursor-pointer hover:scale-[1.02] transform transition-all duration-300 shadow-sm border-0 backdrop-blur-sm mb-1 ${
                              shift.status === 'completed'
                                ? 'bg-gradient-to-r from-emerald-500/80 to-emerald-600/80 text-white'
                                : shift.status === 'in-progress'
                                ? 'bg-gradient-to-r from-orange-500/80 to-orange-600/80 text-white'
                                : shift.status === 'requested'
                                ? 'bg-gradient-to-r from-yellow-500/80 to-yellow-600/80 text-white'
                                : isAssigned 
                                ? 'bg-gradient-to-r from-green-500/80 to-green-600/80 text-white' 
                                : 'bg-gradient-to-r from-red-500/80 to-red-600/80 text-white'
                            }`}
                          >
                            <div className="font-semibold truncate text-[10px] leading-tight">
                              {shift.title}
                            </div>
                            
                            <div className="flex items-center gap-1 text-[10px] opacity-90 mt-0.5">
                              <Clock className="h-2.5 w-2.5" />
                              <span>
                                {shift.startTime ? format(new Date(shift.startTime), 'HH:mm') : 'TBD'}
                              </span>
                            </div>
                            
                            {clientName && clientName !== 'Unknown Client' && (
                              <div className="text-[9px] opacity-80 truncate leading-tight">
                                {clientName}
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
            </>
          )}
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