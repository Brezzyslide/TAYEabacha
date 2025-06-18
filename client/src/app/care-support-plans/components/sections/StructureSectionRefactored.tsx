import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Sparkles, Loader2, CheckCircle2, Calendar, Clock, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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
    userInput: '',
    generatedContent: '',
    routines: [],
    dailyStructure: '',
    weeklyPattern: '',
    transitions: '',
    flexibility: '',
    environmental: '',
    staffGuidance: ''
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

  const [isGenerating, setIsGenerating] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    dispatch({
      type: 'UPDATE_SECTION',
      section: 'structureData',
      data: {
        ...structureData,
        [field]: value
      }
    });
  };

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

  // AI Content Generation Mutation
  const generateContentMutation = useMutation({
    mutationFn: async ({ targetField }: { targetField: string }) => {
      if (!structureData.userInput?.trim()) {
        throw new Error("Please enter structure assessment information first.");
      }

      setIsGenerating(true);
      const userInput = structureData.userInput;

      const existingContent = {
        dailyStructure: structureData.dailyStructure || "",
        weeklyPattern: structureData.weeklyPattern || "",
        transitions: structureData.transitions || "",
        flexibility: structureData.flexibility || "",
        environmental: structureData.environmental || "",
        staffGuidance: structureData.staffGuidance || ""
      };

      const routineContext = structureData.routines.length > 0 
        ? `Current routines: ${structureData.routines.map((r: any) => `${r.day} ${r.startTime}-${r.endTime}: ${r.description}`).join('; ')}`
        : "No specific routines documented yet";

      const response = await apiRequest("POST", "/api/care-support-plans/generate-ai", {
        section: "structure",
        userInput: `${userInput}\n\n${routineContext}`,
        clientName: planData?.clientData?.fullName || "Client",
        clientDiagnosis: planData?.clientData?.primaryDiagnosis || "Not specified",
        maxWords: 200,
        targetField,
        existingContent
      });
      return await response.json();
    },
    onSuccess: (responseData, { targetField }) => {
      const generatedText = responseData.generatedContent || "";
      
      if (targetField === 'preview') {
        handleInputChange('generatedContent', generatedText);
        toast({
          title: "Content Generated",
          description: "Review the AI-generated content and choose which field to populate.",
        });
      } else {
        handleInputChange(targetField, generatedText);
        handleInputChange('generatedContent', '');
        
        const fieldLabels: { [key: string]: string } = {
          dailyStructure: "Daily Structure",
          weeklyPattern: "Weekly Pattern",
          transitions: "Transitions",
          flexibility: "Flexibility",
          environmental: "Environmental",
          staffGuidance: "Staff Guidance"
        };
        
        toast({
          title: "AI Content Generated",
          description: `${fieldLabels[targetField] || targetField} has been populated with targeted content.`,
        });
      }
      setIsGenerating(false);
    },
    onError: (error: any) => {
      setIsGenerating(false);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate content. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGenerateInitialContent = () => {
    if (!structureData.userInput?.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter structure assessment information first.",
        variant: "destructive",
      });
      return;
    }

    generateContentMutation.mutate({ targetField: 'preview' });
  };

  const handleGenerateTargetedContent = (targetField: string) => {
    if (!structureData.userInput?.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter structure assessment information first.",
        variant: "destructive",
      });
      return;
    }

    generateContentMutation.mutate({ targetField });
  };

  const getPriorityBadge = (priority: string) => {
    const option = PRIORITY_LEVELS.find(p => p.value === priority);
    return <Badge className={option?.color}>{option?.label}</Badge>;
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Structure & Routine Assessment Input
          </CardTitle>
          <CardDescription>
            Describe the client's structure and routine needs, preferences, and support requirements
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="structureInput">Structure & Routine Information</Label>
            <Textarea
              id="structureInput"
              placeholder="Enter details about the client's routine needs, schedule preferences, transition support, flexibility requirements, etc..."
              value={structureData.userInput || ""}
              onChange={(e) => handleInputChange("userInput", e.target.value)}
              rows={4}
            />
          </div>

          <Button 
            onClick={handleGenerateInitialContent}
            disabled={isGenerating || !structureData.userInput?.trim()}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Structure Content...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Structure Content
              </>
            )}
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleGenerateTargetedContent('dailyStructure')}
              disabled={isGenerating || !structureData.userInput?.trim()}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Add to Daily Structure
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleGenerateTargetedContent('transitions')}
              disabled={isGenerating || !structureData.userInput?.trim()}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Add to Transitions
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleGenerateTargetedContent('flexibility')}
              disabled={isGenerating || !structureData.userInput?.trim()}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Add to Flexibility
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleGenerateTargetedContent('staffGuidance')}
              disabled={isGenerating || !structureData.userInput?.trim()}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Add to Staff Guidance
            </Button>
          </div>

          {structureData.generatedContent && (
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-blue-900 dark:text-blue-100">AI Generated Content:</h4>
                <Button 
                  onClick={() => {
                    handleInputChange("dailyStructure", structureData.generatedContent || "");
                    handleInputChange('generatedContent', '');
                    toast({
                      title: "Content Applied",
                      description: "AI-generated content has been added to Daily Structure field.",
                    });
                  }}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Use This Content
                </Button>
              </div>
              <div className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
                {structureData.generatedContent}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
                  {structureData.routines.map((routine: any) => (
                    <TableRow key={routine.id}>
                      <TableCell className="font-medium">{routine.day}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-gray-500" />
                          {routine.startTime} - {routine.endTime}
                        </div>
                      </TableCell>
                      <TableCell>{routine.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{routine.category}</Badge>
                      </TableCell>
                      <TableCell>{getPriorityBadge(routine.priority)}</TableCell>
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
        </CardContent>
      </Card>

      {/* Structure Support Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Daily Structure</CardTitle>
            <CardDescription>Daily routine framework and timing</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document daily structure needs, timing preferences, and routine frameworks..."
              value={structureData.dailyStructure || ""}
              onChange={(e) => handleInputChange("dailyStructure", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Weekly Pattern</CardTitle>
            <CardDescription>Weekly structure and recurring activities</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document weekly patterns, recurring commitments, and schedule variations..."
              value={structureData.weeklyPattern || ""}
              onChange={(e) => handleInputChange("weeklyPattern", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-orange-600" />
              Transitions
            </CardTitle>
            <CardDescription>Transition support and change management</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document transition support needs, change management strategies, and adaptation techniques..."
              value={structureData.transitions || ""}
              onChange={(e) => handleInputChange("transitions", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Flexibility</CardTitle>
            <CardDescription>Flexibility tolerance and adaptation strategies</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document flexibility levels, adaptation abilities, and schedule modification strategies..."
              value={structureData.flexibility || ""}
              onChange={(e) => handleInputChange("flexibility", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Environmental Structure</CardTitle>
            <CardDescription>Environmental setup and space requirements</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document environmental structure needs, space requirements, and setting preferences..."
              value={structureData.environmental || ""}
              onChange={(e) => handleInputChange("environmental", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Staff Guidance</CardTitle>
            <CardDescription>Instructions for support workers</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document specific staff guidance for structure implementation and routine maintenance..."
              value={structureData.staffGuidance || ""}
              onChange={(e) => handleInputChange("staffGuidance", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}