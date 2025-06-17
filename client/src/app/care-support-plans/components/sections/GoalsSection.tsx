import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Target, Plus, X, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Goal {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  timeframe: string;
  measurable: string;
  status: string;
}

interface GoalsSectionProps {
  data: any;
  updateData: (section: string, data: any) => void;
  clients: any[];
}

export function GoalsSection({ data, updateData, clients }: GoalsSectionProps) {
  const goalsData = data.goalsData || {};
  const selectedClient = data.clientData;
  
  const [formData, setFormData] = useState(() => ({
    ndisGoals: goalsData.ndisGoals || "",
    overallObjective: goalsData.overallObjective || "",
    goals: goalsData.goals || [],
    generatedGoals: goalsData.generatedGoals || "",
    goalInput: goalsData.goalInput || "",
    userInput: goalsData.userInput || ""
  }));

  // Update form data when section data changes (when loading existing plan)
  useEffect(() => {
    setFormData({
      ndisGoals: goalsData.ndisGoals || "",
      overallObjective: goalsData.overallObjective || "",
      goals: goalsData.goals || [],
      generatedGoals: goalsData.generatedGoals || "",
      goalInput: goalsData.goalInput || "",
      userInput: goalsData.userInput || ""
    });
  }, [data.goalsData]);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Only update if there are actual changes to avoid overwriting existing data
    const hasChanges = Object.keys(formData).some(key => 
      formData[key as keyof typeof formData] !== goalsData[key]
    );
    
    if (hasChanges) {
      updateData('goalsData', formData);
    }
  }, [formData]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const generateGoalsMutation = useMutation({
    mutationFn: async (userInput: string) => {
      const response = await apiRequest("POST", "/api/care-support-plans/generate-ai", {
        section: "goals",
        userInput,
        clientName: selectedClient?.fullName || "Client",
        clientDiagnosis: selectedClient?.primaryDiagnosis || "Not specified",
        maxWords: 400,
        previousSections: data
      });
      return await response.json();
    },
    onSuccess: (responseData) => {
      console.log("Goals AI Response:", responseData);
      // Populate the actual text fields instead of just storing generated content
      handleInputChange("generatedGoals", responseData.generatedContent || "");
      handleInputChange("overallObjective", responseData.generatedContent || "");
      handleInputChange("ndisGoals", formData.goalInput || ""); // Move input to NDIS goals field
      toast({
        title: "SMART Goals Generated",
        description: "AI has created prioritized SMART goals and populated the form fields.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate goals. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGenerateGoals = () => {
    if (!data.goalInput?.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter NDIS goals or objectives first.",
        variant: "destructive",
      });
      return;
    }

    generateGoalsMutation.mutate(data.goalInput);
  };

  const addNewGoal = () => {
    const newGoal: Goal = {
      id: Date.now().toString(),
      title: "",
      description: "",
      category: "daily-living",
      priority: "medium",
      timeframe: "6-months",
      measurable: "",
      status: "active"
    };

    setFormData(prev => ({
      ...prev,
      goals: [...prev.goals, newGoal]
    }));
  };

  const updateGoal = (goalId: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      goals: prev.goals.map((goal: Goal) => 
        goal.id === goalId ? { ...goal, [field]: value } : goal
      )
    }));
  };

  const removeGoal = (goalId: string) => {
    setFormData(prev => ({
      ...prev,
      goals: prev.goals.filter((goal: Goal) => goal.id !== goalId)
    }));
  };

  const handleCopyGoals = () => {
    if (data.generatedGoals) {
      navigator.clipboard.writeText(data.generatedGoals);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Goals Copied",
        description: "Generated goals have been copied to clipboard.",
      });
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      "daily-living": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      "social-community": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      "employment": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      "learning": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      "health": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      "mobility": "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200"
    };
    return colors[category as keyof typeof colors] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      "high": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      "medium": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      "low": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
    };
    return colors[priority as keyof typeof colors] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            AI SMART Goals Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="goalInput">NDIS Goals & Objectives</Label>
            <Textarea
              id="goalInput"
              value={data.goalInput || ""}
              onChange={(e) => handleInputChange("goalInput", e.target.value)}
              placeholder="Enter the client's NDIS plan goals, objectives, or desired outcomes. The AI will convert these into specific, measurable, achievable, relevant, and time-bound (SMART) goals."
              rows={4}
            />
          </div>

          <Button 
            onClick={handleGenerateGoals}
            disabled={generateGoalsMutation.isPending || !data.goalInput?.trim()}
            className="w-full"
          >
            {generateGoalsMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating SMART Goals...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate SMART Goals
              </>
            )}
          </Button>

          {data.generatedGoals && (
            <div className="space-y-3">
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">AI Generated SMART Goals:</h4>
                <div className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
                  {data.generatedGoals}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleCopyGoals}>
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Copied!" : "Copy Goals"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Plan Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="overallObjective">Overall Plan Objective</Label>
            <Textarea
              id="overallObjective"
              value={formData.overallObjective}
              onChange={(e) => handleInputChange("overallObjective", e.target.value)}
              placeholder="Describe the main objective or purpose of this care support plan."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ndisGoals">NDIS Plan Goals (Reference)</Label>
            <Textarea
              id="ndisGoals"
              value={formData.ndisGoals}
              onChange={(e) => handleInputChange("ndisGoals", e.target.value)}
              placeholder="Copy the exact goals from the client's NDIS plan for reference."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              SMART Goals ({formData.goals.length})
            </CardTitle>
            <Button onClick={addNewGoal} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Goal
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {formData.goals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No goals added yet. Click "Add Goal" to create your first SMART goal.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {formData.goals.map((goal: Goal, index: number) => (
                <Card key={goal.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Goal {index + 1}</span>
                        <Badge className={getCategoryColor(goal.category)}>
                          {goal.category.replace("-", " ")}
                        </Badge>
                        <Badge className={getPriorityColor(goal.priority)}>
                          {goal.priority} priority
                        </Badge>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => removeGoal(goal.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Goal Title</Label>
                        <Input
                          value={goal.title}
                          onChange={(e) => updateGoal(goal.id, "title", e.target.value)}
                          placeholder="Brief, clear goal title"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Timeframe</Label>
                        <Select value={goal.timeframe} onValueChange={(value) => updateGoal(goal.id, "timeframe", value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="3-months">3 months</SelectItem>
                            <SelectItem value="6-months">6 months</SelectItem>
                            <SelectItem value="12-months">12 months</SelectItem>
                            <SelectItem value="ongoing">Ongoing</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={goal.category} onValueChange={(value) => updateGoal(goal.id, "category", value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily-living">Daily Living</SelectItem>
                            <SelectItem value="social-community">Social & Community</SelectItem>
                            <SelectItem value="employment">Employment</SelectItem>
                            <SelectItem value="learning">Learning & Development</SelectItem>
                            <SelectItem value="health">Health & Wellbeing</SelectItem>
                            <SelectItem value="mobility">Mobility</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Priority</Label>
                        <Select value={goal.priority} onValueChange={(value) => updateGoal(goal.id, "priority", value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Goal Description</Label>
                      <Textarea
                        value={goal.description}
                        onChange={(e) => updateGoal(goal.id, "description", e.target.value)}
                        placeholder="Specific, detailed description of what the client will achieve"
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Measurable Outcomes</Label>
                      <Textarea
                        value={goal.measurable}
                        onChange={(e) => updateGoal(goal.id, "measurable", e.target.value)}
                        placeholder="How will progress be measured? What are the specific indicators of success?"
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedClient && (
        <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800">
          <p className="text-sm text-green-800 dark:text-green-200">
            <strong>SMART Goals Framework:</strong> Each goal should be Specific, Measurable, Achievable, Relevant, and Time-bound. 
            Use the AI generator to convert NDIS plan goals into structured SMART goals for {selectedClient.fullName}.
          </p>
        </div>
      )}
    </div>
  );
}