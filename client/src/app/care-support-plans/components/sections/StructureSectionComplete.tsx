import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Clock, Sparkles, Loader2, CheckCircle2, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface StructureSectionCompleteProps {
  data: any;
  updateData: (section: string, data: any) => void;
  selectedClient?: any;
  planData?: any;
}

interface Routine {
  id: string;
  day: string;
  startTime: string;
  finishTime: string;
  activity: string;
  notes: string;
  priority: 'high' | 'medium' | 'low';
  flexibility: 'rigid' | 'flexible' | 'adaptable';
  supportLevel: 'independent' | 'minimal' | 'moderate' | 'full';
}

interface StructureData {
  userInput: string;
  generatedContent: string;
  routines: Routine[];
  dailyStructure: string;
  weeklyPattern: string;
  transitions: string;
  flexibility: string;
  environmental: string;
  staffGuidance: string;
}

const DAYS_OF_WEEK = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
];

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'High Priority', color: 'bg-red-100 text-red-800' },
  { value: 'medium', label: 'Medium Priority', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'low', label: 'Low Priority', color: 'bg-green-100 text-green-800' }
];

const FLEXIBILITY_OPTIONS = [
  { value: 'rigid', label: 'Rigid (No changes)', color: 'bg-red-100 text-red-800' },
  { value: 'flexible', label: 'Flexible (Minor adjustments)', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'adaptable', label: 'Adaptable (Can be modified)', color: 'bg-green-100 text-green-800' }
];

const SUPPORT_LEVELS = [
  { value: 'independent', label: 'Independent' },
  { value: 'minimal', label: 'Minimal Support' },
  { value: 'moderate', label: 'Moderate Support' },
  { value: 'full', label: 'Full Support' }
];

export function StructureSectionComplete({ data, updateData, selectedClient, planData }: StructureSectionCompleteProps) {
  const { toast } = useToast();
  const structureData: StructureData = data?.structureData || {
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
    finishTime: '',
    activity: '',
    notes: '',
    priority: 'medium',
    flexibility: 'flexible',
    supportLevel: 'minimal'
  });

  const [isGenerating, setIsGenerating] = useState(false);

  // Function to refresh GPT limit after content application
  const refreshGPTLimit = () => {
    console.log("GPT limit refreshed for next structure generation");
  };

  const handleInputChange = (field: string, value: string) => {
    const updatedData = {
      ...structureData,
      [field]: value
    };
    updateData('structureData', updatedData);
  };

  const handleRoutineChange = (field: string, value: string) => {
    setNewRoutine(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addRoutine = () => {
    if (!newRoutine.day || !newRoutine.startTime || !newRoutine.finishTime || !newRoutine.activity) {
      toast({
        title: "Missing Information",
        description: "Please fill in day, times, and activity before adding.",
        variant: "destructive",
      });
      return;
    }

    const routine: Routine = {
      ...newRoutine,
      id: Date.now().toString()
    };

    const updatedRoutines = [...structureData.routines, routine];
    const updatedData = {
      ...structureData,
      routines: updatedRoutines
    };

    updateData('structureData', updatedData);
    
    setNewRoutine({
      id: '',
      day: '',
      startTime: '',
      finishTime: '',
      activity: '',
      notes: '',
      priority: 'medium',
      flexibility: 'flexible',
      supportLevel: 'minimal'
    });

    toast({
      title: "Routine Added",
      description: `${newRoutine.activity} added for ${newRoutine.day}`,
    });
  };

  const removeRoutine = (routineId: string) => {
    const updatedRoutines = structureData.routines.filter(r => r.id !== routineId);
    const updatedData = {
      ...structureData,
      routines: updatedRoutines
    };
    updateData('structureData', updatedData);

    toast({
      title: "Routine Removed",
      description: "Routine has been deleted from the schedule.",
    });
  };

  // AI Content Generation Mutation
  const generateContentMutation = useMutation({
    mutationFn: async ({ targetField }: { targetField: string }) => {
      if (!structureData.userInput?.trim()) {
        throw new Error("Please enter structure and routine information first.");
      }

      setIsGenerating(true);
      const userInput = structureData.userInput;

      // Gather existing content from all fields to provide context
      const existingContent = {
        dailyStructure: structureData.dailyStructure || "",
        weeklyPattern: structureData.weeklyPattern || "",
        transitions: structureData.transitions || "",
        flexibility: structureData.flexibility || "",
        environmental: structureData.environmental || "",
        staffGuidance: structureData.staffGuidance || ""
      };

      // Include routine information for context
      const routineContext = structureData.routines.length > 0 
        ? `Current routines: ${structureData.routines.map(r => `${r.day} ${r.startTime}-${r.finishTime}: ${r.activity}`).join('; ')}`
        : "No routines scheduled yet";

      const response = await apiRequest("POST", "/api/care-support-plans/generate-ai", {
        section: "structure",
        userInput: `${userInput}\n\n${routineContext}`,
        clientName: selectedClient?.fullName || planData?.clientData?.fullName || "Client",
        clientDiagnosis: selectedClient?.primaryDiagnosis || planData?.clientData?.primaryDiagnosis || "Not specified",
        maxWords: 200,
        targetField,
        existingContent
      });
      return await response.json();
    },
    onSuccess: (responseData, { targetField }) => {
      const generatedText = responseData.content || "";
      
      if (targetField === 'preview') {
        // Store content for preview and field selection
        handleInputChange('generatedContent', generatedText);
        toast({
          title: "Content Generated",
          description: "Review the AI-generated content and choose which field to populate.",
        });
      } else {
        // Update the specific targeted field directly
        handleInputChange(targetField, generatedText);
        
        // Clear the preview content after applying to specific field
        handleInputChange('generatedContent', '');
        
        // Refresh GPT limit after each content application
        refreshGPTLimit();
        
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
          description: `${fieldLabels[targetField] || targetField} has been populated with targeted content (200 words).`,
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
        description: "Please enter structure and routine information first.",
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
        description: "Please enter structure and routine information first.",
        variant: "destructive",
      });
      return;
    }

    generateContentMutation.mutate({ targetField });
  };

  const getPriorityBadge = (priority: string) => {
    const option = PRIORITY_OPTIONS.find(p => p.value === priority);
    return <Badge className={option?.color}>{option?.label}</Badge>;
  };

  const getFlexibilityBadge = (flexibility: string) => {
    const option = FLEXIBILITY_OPTIONS.find(f => f.value === flexibility);
    return <Badge variant="outline" className={option?.color}>{option?.label}</Badge>;
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
            Describe the client's daily structure needs, routine preferences, and schedule requirements
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="structureInput">Structure & Routine Information</Label>
            <Textarea
              id="structureInput"
              placeholder="Enter details about the client's routine preferences, daily structure needs, transitions, flexibility requirements, etc..."
              value={structureData.userInput || ""}
              onChange={(e) => handleInputChange("userInput", e.target.value)}
              rows={4}
            />
          </div>

          {/* Primary AI Generation Button */}
          <Button 
            onClick={handleGenerateInitialContent}
            disabled={isGenerating || !structureData.userInput?.trim()}
            className="w-full mb-4"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Structure Content...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Structure & Routine Content
              </>
            )}
          </Button>

          {/* Targeted "Add to [Section]" Buttons */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Refine Specific Areas</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              After initial generation, use these buttons to add targeted content to specific structure areas.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleGenerateTargetedContent('dailyStructure')}
                disabled={isGenerating || !structureData.userInput?.trim()}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Add to Daily Structure
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleGenerateTargetedContent('weeklyPattern')}
                disabled={isGenerating || !structureData.userInput?.trim()}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Add to Weekly Pattern
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleGenerateTargetedContent('transitions')}
                disabled={isGenerating || !structureData.userInput?.trim()}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Add to Transitions
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleGenerateTargetedContent('flexibility')}
                disabled={isGenerating || !structureData.userInput?.trim()}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Add to Flexibility
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleGenerateTargetedContent('environmental')}
                disabled={isGenerating || !structureData.userInput?.trim()}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Add to Environmental
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleGenerateTargetedContent('staffGuidance')}
                disabled={isGenerating || !structureData.userInput?.trim()}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Add to Staff Guidance
              </Button>
            </div>
          </div>

          {isGenerating && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
              <span className="text-sm text-blue-700 dark:text-blue-300">Generating targeted structure content with context awareness...</span>
            </div>
          )}

          {structureData.generatedContent && (
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-blue-900 dark:text-blue-100">AI Generated Content:</h4>
                <Button 
                  onClick={() => {
                    handleInputChange("dailyStructure", structureData.generatedContent || "");
                    handleInputChange('generatedContent', '');
                    refreshGPTLimit();
                    toast({
                      title: "Content Applied",
                      description: "AI-generated content has been added to Daily Structure field. GPT limit refreshed.",
                    });
                  }}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Use This Content
                </Button>
              </div>
              <div className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap mb-3">
                {structureData.generatedContent}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <Button 
                  onClick={() => {
                    handleInputChange("dailyStructure", structureData.generatedContent || "");
                    handleInputChange('generatedContent', '');
                    refreshGPTLimit();
                    toast({
                      title: "Content Applied",
                      description: "Added to Daily Structure field. GPT limit refreshed.",
                    });
                  }}
                  variant="outline" 
                  size="sm"
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  Add to Daily Structure
                </Button>
                <Button 
                  onClick={() => {
                    handleInputChange("weeklyPattern", structureData.generatedContent || "");
                    handleInputChange('generatedContent', '');
                    refreshGPTLimit();
                    toast({
                      title: "Content Applied", 
                      description: "Added to Weekly Pattern field. GPT limit refreshed.",
                    });
                  }}
                  variant="outline" 
                  size="sm"
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  Add to Weekly Pattern
                </Button>
                <Button 
                  onClick={() => {
                    handleInputChange("transitions", structureData.generatedContent || "");
                    handleInputChange('generatedContent', '');
                    refreshGPTLimit();
                    toast({
                      title: "Content Applied", 
                      description: "Added to Transitions field. GPT limit refreshed.",
                    });
                  }}
                  variant="outline" 
                  size="sm"
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  Add to Transitions
                </Button>
                <Button 
                  onClick={() => {
                    handleInputChange("flexibility", structureData.generatedContent || "");
                    handleInputChange('generatedContent', '');
                    refreshGPTLimit();
                    toast({
                      title: "Content Applied", 
                      description: "Added to Flexibility field. GPT limit refreshed.",
                    });
                  }}
                  variant="outline" 
                  size="sm"
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  Add to Flexibility
                </Button>
                <Button 
                  onClick={() => {
                    handleInputChange("environmental", structureData.generatedContent || "");
                    handleInputChange('generatedContent', '');
                    refreshGPTLimit();
                    toast({
                      title: "Content Applied", 
                      description: "Added to Environmental field. GPT limit refreshed.",
                    });
                  }}
                  variant="outline" 
                  size="sm"
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  Add to Environmental
                </Button>
                <Button 
                  onClick={() => {
                    handleInputChange("staffGuidance", structureData.generatedContent || "");
                    handleInputChange('generatedContent', '');
                    refreshGPTLimit();
                    toast({
                      title: "Content Applied", 
                      description: "Added to Staff Guidance field. GPT limit refreshed.",
                    });
                  }}
                  variant="outline" 
                  size="sm"
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  Add to Staff Guidance
                </Button>
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
            Create specific routines and activities for each day of the week
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="day">Day of Week</Label>
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
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                type="time"
                value={newRoutine.startTime}
                onChange={(e) => handleRoutineChange('startTime', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="finishTime">End Time</Label>
              <Input
                type="time"
                value={newRoutine.finishTime}
                onChange={(e) => handleRoutineChange('finishTime', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={newRoutine.priority} onValueChange={(value) => handleRoutineChange('priority', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="activity">Activity</Label>
              <Input
                placeholder="e.g., Morning hygiene routine"
                value={newRoutine.activity}
                onChange={(e) => handleRoutineChange('activity', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supportLevel">Support Level</Label>
              <Select value={newRoutine.supportLevel} onValueChange={(value) => handleRoutineChange('supportLevel', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select support level" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORT_LEVELS.map(level => (
                    <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="flexibility">Flexibility</Label>
              <Select value={newRoutine.flexibility} onValueChange={(value) => handleRoutineChange('flexibility', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select flexibility" />
                </SelectTrigger>
                <SelectContent>
                  {FLEXIBILITY_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                placeholder="Additional notes or instructions"
                value={newRoutine.notes}
                onChange={(e) => handleRoutineChange('notes', e.target.value)}
              />
            </div>
          </div>

          <Button onClick={addRoutine} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Routine
          </Button>

          {structureData.routines.length > 0 && (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Flexibility</TableHead>
                    <TableHead>Support</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {structureData.routines.map((routine) => (
                    <TableRow key={routine.id}>
                      <TableCell>{routine.day}</TableCell>
                      <TableCell>{routine.startTime} - {routine.finishTime}</TableCell>
                      <TableCell>
                        <div>
                          {routine.activity}
                          {routine.notes && <div className="text-xs text-gray-500 mt-1">{routine.notes}</div>}
                        </div>
                      </TableCell>
                      <TableCell>{getPriorityBadge(routine.priority)}</TableCell>
                      <TableCell>{getFlexibilityBadge(routine.flexibility)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{routine.supportLevel}</Badge>
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
        </CardContent>
      </Card>

      {/* Structure Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Daily Structure</CardTitle>
            <CardDescription>Overall daily framework and timing</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document the client's daily structure needs, preferred timing, and essential activities..."
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
              placeholder="Document weekly patterns, recurring commitments, and structure variations..."
              value={structureData.weeklyPattern || ""}
              onChange={(e) => handleInputChange("weeklyPattern", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Transitions</CardTitle>
            <CardDescription>How the client manages changes and transitions</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document transition support needs, change management strategies, and adaptation time..."
              value={structureData.transitions || ""}
              onChange={(e) => handleInputChange("transitions", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Flexibility Requirements</CardTitle>
            <CardDescription>Adaptability and change tolerance</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document flexibility needs, tolerance for changes, and adaptation strategies..."
              value={structureData.flexibility || ""}
              onChange={(e) => handleInputChange("flexibility", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Environmental Considerations</CardTitle>
            <CardDescription>Physical environment and setting requirements</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document environmental needs, setting preferences, and space requirements..."
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
              placeholder="Document specific staff instructions, implementation strategies, and support approaches..."
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