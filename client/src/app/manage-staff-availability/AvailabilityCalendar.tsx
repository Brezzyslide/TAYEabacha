import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, AlertTriangle, Users } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, addMonths, subMonths, addYears, subYears } from "date-fns";

interface StaffAvailability {
  id: number;
  userId: number;
  userName: string;
  userRole: string;
  availability: Record<string, string[]>;
  isActive: boolean;
}

interface ConflictData {
  day: string;
  shiftType: string;
  staffCount: number;
  minRequired: number;
  isUnderStaffed: boolean;
}

interface AvailabilityCalendarProps {
  staffAvailability: StaffAvailability[];
  conflicts: ConflictData[];
  selectedMonth: Date;
  onMonthChange: (date: Date) => void;
}

const SHIFT_TYPES = [
  { value: "AM", label: "AM", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "PM", label: "PM", color: "bg-green-100 text-green-800 border-green-200" },
  { value: "Active Night", label: "AN", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "Sleepover Night", label: "SN", color: "bg-orange-100 text-orange-800 border-orange-200" }
];

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function AvailabilityCalendar({
  staffAvailability,
  conflicts,
  selectedMonth,
  onMonthChange,
}: AvailabilityCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad calendar to start on Sunday
  const startDay = getDay(monthStart);
  const paddedDays = Array(startDay).fill(null).concat(calendarDays);

  // Calculate coverage for each day
  const getDayCoverage = (date: Date) => {
    const dayName = format(date, 'EEEE');
    const coverage: Record<string, number> = {
      "AM": 0,
      "PM": 0,
      "Active Night": 0,
      "Sleepover Night": 0
    };

    staffAvailability.forEach(staff => {
      const dayAvailability = staff.availability[dayName] || [];
      dayAvailability.forEach(shift => {
        if (coverage[shift] !== undefined) {
          coverage[shift]++;
        }
      });
    });

    return coverage;
  };

  // Get conflicts for a specific day
  const getDayConflicts = (date: Date) => {
    const dayName = format(date, 'EEEE');
    return conflicts.filter(conflict => conflict.day === dayName);
  };

  // Get staff available on a specific day
  const getDayStaff = (date: Date) => {
    const dayName = format(date, 'EEEE');
    return staffAvailability.filter(staff => 
      staff.availability[dayName] && staff.availability[dayName].length > 0
    );
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = direction === 'prev' ? subMonths(selectedMonth, 1) : addMonths(selectedMonth, 1);
    onMonthChange(newMonth);
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center space-x-2">
              <span>Staff Availability Calendar - {format(selectedMonth, 'MMMM yyyy')}</span>
            </CardTitle>
            <div className="flex space-x-2">
              {/* Year Navigation */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onMonthChange(subYears(selectedMonth, 1))}
                title="Previous Year"
              >
                <ChevronLeft className="h-4 w-4" />
                <ChevronLeft className="h-4 w-4 -ml-2" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigateMonth('prev')} title="Previous Month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigateMonth('next')} title="Next Month">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onMonthChange(addYears(selectedMonth, 1))}
                title="Next Year"
              >
                <ChevronRight className="h-4 w-4" />
                <ChevronRight className="h-4 w-4 -ml-2" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Legend */}
          <div className="flex flex-wrap gap-2 mb-4 p-3 bg-gray-50 rounded">
            <div className="text-sm font-medium">Legend:</div>
            {SHIFT_TYPES.map(shift => (
              <Badge key={shift.value} className={shift.color} variant="outline">
                {shift.label} = {shift.value}
              </Badge>
            ))}
            <Badge className="bg-red-100 text-red-800 border-red-200" variant="outline">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Conflict
            </Badge>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {DAYS_OF_WEEK.map(day => (
              <div key={day} className="p-2 text-center font-medium text-sm bg-gray-100 rounded">
                {day.slice(0, 3)}
              </div>
            ))}

            {/* Calendar days */}
            {paddedDays.map((day, index) => {
              if (!day) {
                return <div key={index} className="h-24 border rounded bg-gray-50"></div>;
              }

              const coverage = getDayCoverage(day);
              const dayConflicts = getDayConflicts(day);
              const dayStaff = getDayStaff(day);
              const hasConflicts = dayConflicts.length > 0;
              const isSelected = selectedDate && isSameDay(day, selectedDate);

              return (
                <div
                  key={day.toISOString()}
                  className={`h-24 border rounded p-1 cursor-pointer hover:bg-gray-50 ${
                    isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                  } ${hasConflicts ? 'border-red-300 bg-red-50' : ''}`}
                  onClick={() => setSelectedDate(day)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-medium">{format(day, 'd')}</span>
                    {hasConflicts && (
                      <AlertTriangle className="h-3 w-3 text-red-600" />
                    )}
                  </div>
                  
                  <div className="space-y-0.5">
                    {SHIFT_TYPES.map(shift => {
                      const count = coverage[shift.value];
                      if (count === 0) return null;
                      
                      const isConflicted = dayConflicts.some(c => c.shiftType === shift.value);
                      
                      return (
                        <div
                          key={shift.value}
                          className={`text-xs px-1 py-0.5 rounded text-center ${
                            isConflicted ? 'bg-red-100 text-red-800' : shift.color
                          }`}
                        >
                          {shift.label}: {count}
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

      {/* Selected Day Details */}
      {selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Staff Details - {format(selectedDate, 'EEEE, MMMM d, yyyy')}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const dayStaff = getDayStaff(selectedDate);
              const dayConflicts = getDayConflicts(selectedDate);
              const coverage = getDayCoverage(selectedDate);

              if (dayStaff.length === 0) {
                return (
                  <div className="text-center py-4 text-gray-500">
                    No staff available on this day
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {/* Coverage Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {SHIFT_TYPES.map(shift => {
                      const count = coverage[shift.value];
                      const conflict = dayConflicts.find(c => c.shiftType === shift.value);
                      
                      return (
                        <div key={shift.value} className="text-center p-3 border rounded">
                          <div className={`text-2xl font-bold ${conflict ? 'text-red-600' : 'text-green-600'}`}>
                            {count}
                          </div>
                          <div className="text-sm text-gray-600">{shift.value}</div>
                          {conflict && (
                            <div className="text-xs text-red-600 mt-1">
                              Need {conflict.minRequired}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Conflicts Alert */}
                  {dayConflicts.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded p-3">
                      <h4 className="font-medium text-red-800 mb-2">Staffing Conflicts</h4>
                      <div className="space-y-1">
                        {dayConflicts.map((conflict, index) => (
                          <div key={index} className="text-sm text-red-700">
                            {conflict.shiftType}: Need {conflict.minRequired - conflict.staffCount} more staff
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Staff List */}
                  <div>
                    <h4 className="font-medium mb-3">Available Staff ({dayStaff.length})</h4>
                    <div className="space-y-2">
                      {dayStaff.map(staff => {
                        const dayName = format(selectedDate, 'EEEE');
                        const shifts = staff.availability[dayName] || [];
                        
                        return (
                          <div key={staff.id} className="flex justify-between items-center p-3 border rounded">
                            <div>
                              <span className="font-medium">{staff.userName}</span>
                              <Badge variant="outline" className="ml-2">
                                {staff.userRole}
                              </Badge>
                            </div>
                            <div className="flex space-x-1">
                              {shifts.map(shift => {
                                const shiftConfig = SHIFT_TYPES.find(s => s.value === shift);
                                return (
                                  <Badge
                                    key={shift}
                                    className={shiftConfig?.color}
                                    variant="outline"
                                  >
                                    {shiftConfig?.label}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}