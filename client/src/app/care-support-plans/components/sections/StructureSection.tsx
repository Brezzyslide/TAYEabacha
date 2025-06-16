import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Save, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StructureSectionProps {
  data: any;
  updateData: (section: string, data: any) => void;
}

interface Routine {
  id: string;
  day: string;
  startTime: string;
  finishTime: string;
  activity: string;
  notes: string;
}

const DAYS_OF_WEEK = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
];

export function StructureSection({ data, updateData }: StructureSectionProps) {
  const { toast } = useToast();
  const structureData = data.structureData || { routines: [] };
  
  const [newRoutine, setNewRoutine] = useState<Routine>({
    id: '',
    day: '',
    startTime: '',
    finishTime: '',
    activity: '',
    notes: ''
  });

  const addRoutine = () => {
    if (!newRoutine.day || !newRoutine.startTime || !newRoutine.finishTime || !newRoutine.activity) {
      toast({
        title: "Missing Information",
        description: "Please fill in day, times, and activity before adding.",
        variant: "destructive",
      });
      return;
    }

    const routine = {
      ...newRoutine,
      id: Date.now().toString()
    };

    const updatedRoutines = [...structureData.routines, routine];
    updateData('structureData', { routines: updatedRoutines });

    // Reset form
    setNewRoutine({
      id: '',
      day: '',
      startTime: '',
      finishTime: '',
      activity: '',
      notes: ''
    });

    toast({
      title: "Routine Added",
      description: "New routine has been added successfully.",
    });
  };

  const deleteRoutine = (routineId: string) => {
    const updatedRoutines = structureData.routines.filter((r: Routine) => r.id !== routineId);
    updateData('structureData', { routines: updatedRoutines });
    
    toast({
      title: "Routine Deleted",
      description: "Routine has been removed successfully.",
    });
  };

  const updateRoutine = (routineId: string, field: string, value: string) => {
    const updatedRoutines = structureData.routines.map((r: Routine) => 
      r.id === routineId ? { ...r, [field]: value } : r
    );
    updateData('structureData', { routines: updatedRoutines });
  };

  const handleSaveSection = () => {
    toast({
      title: "Section Saved",
      description: "Structure & Routine section has been saved.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Section Instructions</h4>
        <p className="text-sm text-blue-800 dark:text-blue-200">
          Create a structured routine for the client by adding daily activities with specific times. 
          This helps establish consistency and predictability in their care support.
        </p>
      </div>

      {/* Add New Routine Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Add New Routine
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="day">Day of Week *</Label>
              <Select value={newRoutine.day} onValueChange={(value) => setNewRoutine({...newRoutine, day: value})}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((day) => (
                    <SelectItem key={day} value={day}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="startTime">Start Time *</Label>
              <Input
                id="startTime"
                type="time"
                value={newRoutine.startTime}
                onChange={(e) => setNewRoutine({...newRoutine, startTime: e.target.value})}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="finishTime">Finish Time *</Label>
              <Input
                id="finishTime"
                type="time"
                value={newRoutine.finishTime}
                onChange={(e) => setNewRoutine({...newRoutine, finishTime: e.target.value})}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="activity">Activity *</Label>
              <Input
                id="activity"
                value={newRoutine.activity}
                onChange={(e) => setNewRoutine({...newRoutine, activity: e.target.value})}
                placeholder="e.g., Personal Care"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={newRoutine.notes}
              onChange={(e) => setNewRoutine({...newRoutine, notes: e.target.value})}
              placeholder="Additional notes about this routine..."
              rows={2}
              className="mt-1"
            />
          </div>

          <Button onClick={addRoutine} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Routine
          </Button>
        </CardContent>
      </Card>

      {/* Existing Routines Table */}
      {structureData.routines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Current Routines ({structureData.routines.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>Finish Time</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {structureData.routines.map((routine: Routine) => (
                    <TableRow key={routine.id}>
                      <TableCell>
                        <Select 
                          value={routine.day} 
                          onValueChange={(value) => updateRoutine(routine.id, 'day', value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DAYS_OF_WEEK.map((day) => (
                              <SelectItem key={day} value={day}>{day}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="time"
                          value={routine.startTime}
                          onChange={(e) => updateRoutine(routine.id, 'startTime', e.target.value)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="time"
                          value={routine.finishTime}
                          onChange={(e) => updateRoutine(routine.id, 'finishTime', e.target.value)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={routine.activity}
                          onChange={(e) => updateRoutine(routine.id, 'activity', e.target.value)}
                          className="min-w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={routine.notes}
                          onChange={(e) => updateRoutine(routine.id, 'notes', e.target.value)}
                          className="min-w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteRoutine(routine.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {structureData.routines.length === 0 && (
        <Card className="border-dashed border-2 border-muted-foreground/25">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold text-lg mb-2">No Routines Added</h3>
            <p className="text-muted-foreground max-w-md">
              Add daily routines to help structure the client's care support. 
              Start by filling out the form above to create the first routine.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSaveSection} className="flex items-center gap-2">
          <Save className="h-4 w-4" />
          Save Section
        </Button>
      </div>
    </div>
  );
}