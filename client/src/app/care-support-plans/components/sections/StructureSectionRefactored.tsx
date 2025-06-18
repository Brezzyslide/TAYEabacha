import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Calendar, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCarePlan } from "../../contexts/CarePlanContext";

interface Routine {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
}

const DAYS_OF_WEEK = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

const ROUTINE_CATEGORIES = [
  'Personal Care', 'Meals', 'Activities', 'Therapy', 'Social', 'Exercise', 'Rest', 'Community', 'Work', 'Other'
];

const PRIORITY_LEVELS = [
  { value: 'low', label: 'Low Priority', color: 'bg-gray-100 text-gray-800' },
  { value: 'medium', label: 'Medium Priority', color: 'bg-blue-100 text-blue-800' },
  { value: 'high', label: 'High Priority', color: 'bg-red-100 text-red-800' }
];

export function StructureSectionRefactored() {
  const { planData, dispatch } = useCarePlan();
  const { toast } = useToast();
  
  const structureData = planData?.structureData || {
    routines: []
  };

  const [newRoutine, setNewRoutine] = useState<Routine>({
    id: '',
    day: '',
    startTime: '',
    endTime: '',
    description: '',
    category: '',
    priority: 'medium'
  });

  const handleRoutineChange = (field: string, value: string) => {
    setNewRoutine(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addRoutine = () => {
    if (!newRoutine.day || !newRoutine.startTime || !newRoutine.endTime || !newRoutine.description) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields before adding the routine.",
        variant: "destructive",
      });
      return;
    }

    const routine: Routine = {
      ...newRoutine,
      id: Date.now().toString()
    };

    const updatedRoutines = [...structureData.routines, routine];
    
    dispatch({
      type: 'UPDATE_SECTION',
      section: 'structureData',
      data: {
        ...structureData,
        routines: updatedRoutines
      }
    });

    setNewRoutine({
      id: '',
      day: '',
      startTime: '',
      endTime: '',
      description: '',
      category: '',
      priority: 'medium'
    });

    toast({
      title: "Routine Added",
      description: `${newRoutine.day} routine has been added to the weekly schedule`,
    });
  };

  const removeRoutine = (routineId: string) => {
    const updatedRoutines = structureData.routines.filter((r: any) => r.id !== routineId);
    
    dispatch({
      type: 'UPDATE_SECTION',
      section: 'structureData',
      data: {
        ...structureData,
        routines: updatedRoutines
      }
    });

    toast({
      title: "Routine Removed",
      description: "Routine has been deleted from the schedule.",
    });
  };

  const getPriorityBadge = (priority: string) => {
    const option = PRIORITY_LEVELS.find(p => p.value === priority);
    return <Badge className={option?.color}>{option?.label}</Badge>;
  };

  const getCategoryBadge = (category: string) => {
    const colors: { [key: string]: string } = {
      'Personal Care': 'bg-purple-100 text-purple-800',
      'Meals': 'bg-orange-100 text-orange-800',
      'Activities': 'bg-green-100 text-green-800',
      'Therapy': 'bg-blue-100 text-blue-800',
      'Social': 'bg-pink-100 text-pink-800',
      'Exercise': 'bg-red-100 text-red-800',
      'Rest': 'bg-gray-100 text-gray-800',
      'Community': 'bg-yellow-100 text-yellow-800',
      'Work': 'bg-indigo-100 text-indigo-800',
      'Other': 'bg-slate-100 text-slate-800'
    };
    return <Badge className={colors[category] || 'bg-gray-100 text-gray-800'}>{category}</Badge>;
  };

  // Sort routines by day and time for display
  const sortedRoutines = structureData.routines.sort((a: any, b: any) => {
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dayDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
    if (dayDiff !== 0) return dayDiff;
    return a.startTime.localeCompare(b.startTime);
  });

  return (
    <div className="space-y-8">
      {/* Weekly Schedule Builder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-green-600" />
            Weekly Schedule Builder
          </CardTitle>
          <CardDescription>
            Build the client's weekly routine by adding activities for each day
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Day of Week</Label>
              <Select value={newRoutine.day} onValueChange={(value) => handleRoutineChange('day', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map(day => (
                    <SelectItem key={day} value={day}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={newRoutine.category} onValueChange={(value) => handleRoutineChange('category', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {ROUTINE_CATEGORIES.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Input
                type="time"
                value={newRoutine.startTime}
                onChange={(e) => handleRoutineChange('startTime', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>End Time</Label>
              <Input
                type="time"
                value={newRoutine.endTime}
                onChange={(e) => handleRoutineChange('endTime', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={newRoutine.priority} onValueChange={(value) => handleRoutineChange('priority', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_LEVELS.map(priority => (
                    <SelectItem key={priority.value} value={priority.value}>{priority.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Activity Description</Label>
            <Textarea
              placeholder="Describe the activity, including any specific requirements or instructions..."
              value={newRoutine.description}
              onChange={(e) => handleRoutineChange('description', e.target.value)}
              rows={3}
            />
          </div>

          <Button onClick={addRoutine} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Activity
          </Button>

          {structureData.routines.length > 0 && (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRoutines.map((routine: any) => (
                    <TableRow key={routine.id}>
                      <TableCell>
                        <div className="font-medium">{routine.day}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span className="text-sm">
                            {routine.startTime} - {routine.endTime}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          <div className="font-medium truncate">{routine.description}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {routine.category && getCategoryBadge(routine.category)}
                      </TableCell>
                      <TableCell>
                        {getPriorityBadge(routine.priority)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeRoutine(routine.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {structureData.routines.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No activities scheduled yet. Add activities to build the weekly schedule.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}