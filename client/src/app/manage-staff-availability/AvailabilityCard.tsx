import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Archive, Edit, MoreVertical, Settings, User, Calendar, Clock } from "lucide-react";
import { format } from "date-fns";

interface StaffAvailability {
  id: number;
  userId: number;
  userName: string;
  userRole: string;
  availability: Record<string, string[]>;
  patternName?: string;
  isActive: boolean;
  overrideByManager: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AvailabilityCardProps {
  staff: StaffAvailability;
  onArchive: (id: number) => void;
  onOverride: (id: number, availability: Record<string, string[]>) => void;
  showArchived: boolean;
}

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SHIFT_TYPES = [
  { value: "AM", label: "AM", color: "bg-blue-100 text-blue-800" },
  { value: "PM", label: "PM", color: "bg-green-100 text-green-800" },
  { value: "Active Night", label: "AN", color: "bg-purple-100 text-purple-800" },
  { value: "Sleepover Night", label: "SN", color: "bg-orange-100 text-orange-800" }
];

export default function AvailabilityCard({ 
  staff, 
  onArchive, 
  onOverride, 
  showArchived 
}: AvailabilityCardProps) {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingAvailability, setEditingAvailability] = useState<Record<string, string[]>>(staff.availability);

  const handleDayShiftChange = (day: string, shifts: string[]) => {
    setEditingAvailability(prev => ({
      ...prev,
      [day]: shifts
    }));
  };

  const handleSaveChanges = () => {
    onOverride(staff.id, editingAvailability);
    setEditModalOpen(false);
  };

  const handleCancelEdit = () => {
    setEditingAvailability(staff.availability);
    setEditModalOpen(false);
  };

  // Calculate total availability statistics
  const totalDaysAvailable = Object.keys(staff.availability).length;
  const totalShifts = Object.values(staff.availability).reduce((total, shifts) => total + shifts.length, 0);
  const hasWeekendAvailability = staff.availability.Saturday?.length > 0 || staff.availability.Sunday?.length > 0;

  return (
    <>
      <Card className={`h-full ${!staff.isActive ? 'opacity-60 border-gray-300' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-gray-500" />
              <CardTitle className="text-lg">{staff.userName}</CardTitle>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditModalOpen(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Availability
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onArchive(staff.id)}>
                  <Archive className="h-4 w-4 mr-2" />
                  {showArchived ? "Restore" : "Archive"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{staff.userRole}</Badge>
            {staff.overrideByManager && (
              <Badge variant="secondary">
                <Settings className="h-3 w-3 mr-1" />
                Modified
              </Badge>
            )}
            {staff.patternName && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                {staff.patternName}
              </Badge>
            )}
            {!staff.isActive && (
              <Badge variant="secondary" className="bg-gray-100">
                Archived
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-50 rounded p-2">
              <div className="text-lg font-bold text-blue-600">{totalDaysAvailable}</div>
              <div className="text-xs text-gray-600">Days</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-lg font-bold text-green-600">{totalShifts}</div>
              <div className="text-xs text-gray-600">Shifts</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className={`text-lg font-bold ${hasWeekendAvailability ? 'text-purple-600' : 'text-gray-400'}`}>
                {hasWeekendAvailability ? '✓' : '×'}
              </div>
              <div className="text-xs text-gray-600">Weekend</div>
            </div>
          </div>

          {/* Weekly Availability Grid */}
          <div className="space-y-2">
            <div className="text-sm font-medium flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>Weekly Availability</span>
            </div>
            
            {totalDaysAvailable === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">
                No availability set
              </div>
            ) : (
              <div className="space-y-1">
                {DAYS_OF_WEEK.map(day => {
                  const dayShifts = staff.availability[day] || [];
                  if (dayShifts.length === 0) return null;
                  
                  return (
                    <div key={day} className="flex justify-between items-center text-sm">
                      <span className="font-medium text-gray-700 w-20">{day.slice(0, 3)}</span>
                      <div className="flex space-x-1 flex-1">
                        {dayShifts.map(shift => {
                          const shiftConfig = SHIFT_TYPES.find(s => s.value === shift);
                          return (
                            <Badge
                              key={shift}
                              className={`${shiftConfig?.color} text-xs px-2 py-0.5`}
                              variant="secondary"
                            >
                              {shiftConfig?.label || shift}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Last Updated */}
          <div className="text-xs text-gray-500 flex items-center space-x-1 pt-2 border-t">
            <Clock className="h-3 w-3" />
            <span>Updated: {format(new Date(staff.updatedAt), 'MMM d, yyyy')}</span>
          </div>
        </CardContent>
      </Card>

      {/* Edit Availability Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Availability - {staff.userName}</DialogTitle>
            <DialogDescription>
              Modify staff availability. Changes will be marked as manager override.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {DAYS_OF_WEEK.map(day => (
              <div key={day} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="font-medium">{day}</label>
                  <Badge variant="outline" className="text-xs">
                    {editingAvailability[day]?.length || 0} shifts
                  </Badge>
                </div>
                
                <ToggleGroup
                  type="multiple"
                  value={editingAvailability[day] || []}
                  onValueChange={(value) => handleDayShiftChange(day, value)}
                  className="justify-start flex-wrap gap-2"
                >
                  {SHIFT_TYPES.map(shiftType => (
                    <ToggleGroupItem
                      key={shiftType.value}
                      value={shiftType.value}
                      aria-label={shiftType.label}
                      className="data-[state=on]:bg-blue-100 data-[state=on]:text-blue-900"
                    >
                      {shiftType.value}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-lg p-3 mt-4">
            <h4 className="font-medium mb-2">Changes Summary:</h4>
            <div className="text-sm space-y-1">
              {Object.entries(editingAvailability).map(([day, shifts]) => (
                shifts.length > 0 && (
                  <div key={day} className="flex justify-between">
                    <span>{day}:</span>
                    <span>{shifts.join(", ")}</span>
                  </div>
                )
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="outline" onClick={handleCancelEdit}>
              Cancel
            </Button>
            <Button onClick={handleSaveChanges} className="bg-blue-600 hover:bg-blue-700">
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}