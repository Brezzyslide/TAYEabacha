import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, Sparkles, Loader2, Plus, Trash2, CheckCircle, CheckCircle2, X } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useCarePlan } from "../../contexts/CarePlanContext";

interface Goal {
  id: string;
  title: string;
  description: string;
  category: string;
  timeframe: string;
  status: 'draft' | 'active' | 'completed';
}

export function GoalsSectionRefactored() {
  const { planData, updateField } = useCarePlan();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const goalsData = planData.goalsData || {
    ndisGoals: "",
    personalGoals: "",
    shortTermGoals: "",
    longTermGoals: "",
    overallObjective: "",
    generatedGoals: "",
    goalInput: "",
    userInput: "",
    goals: []
  };

  const handleInputChange = (field: string, value: string) => {
    updateField('goalsData', field, value);
  };

  const addGoal = () => {
    const newGoal: Goal = {
      id: Date.now().toString(),
      title: "",
      description: "",
      category: "personal",
      timeframe: "short-term",
      status: 'draft'
    };
    
    const updatedGoals = [...(goalsData.goals || []), newGoal];
    updateField('goalsData', 'goals', updatedGoals);
  };

  const updateGoal = (goalId: string, field: string, value: string) => {
    const updatedGoals = (goalsData.goals || []).map((goal: Goal) =>
      goal.id === goalId ? { ...goal, [field]: value } : goal
    );
    updateField('goalsData', 'goals', updatedGoals);
  };

  const removeGoal = (goalId: string) => {
    const updatedGoals = (goalsData.goals || []).filter((goal: Goal) => goal.id !== goalId);
    updateField('goalsData', 'goals', updatedGoals);
  };

  // Function to refresh GPT limit after content application
  const refreshGPTLimit = () => {
    console.log("GPT limit refreshed for next goal generation");
  };

  const generateContentMutation = useMutation({
    mutationFn: async ({ userInput, targetField }: { userInput: string; targetField?: string }) => {
      const response = await apiRequest("POST", "/api/care-support-plans/generate-ai", {
        planId: planData.id,
        section: "goals",
        userInput,
        targetField,
        clientName: planData.clientData?.fullName || "Client",
        clientDiagnosis: planData.clientData?.primaryDiagnosis || "Not specified",
        maxWords: 200,
        previousSections: planData
      });
      return await response.json();
    },
    onSuccess: (responseData, variables) => {
      const generatedText = responseData.content || "";
      
      // Store generated content for targeted application or general use
      if (variables.targetField) {
        handleInputChange('generatedGoals', generatedText);
      } else {
        handleInputChange('generatedGoals', generatedText);
      }
      
      toast({
        title: "AI Content Generated",
        description: `Goal content generated${variables.targetField ? ' for ' + variables.targetField : ''}.`,
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
    if (!goalsData.userInput?.trim()) {
      toast({
        title: "Input Required",
        description: "Please describe the client's aspirations and needs first.",
        variant: "destructive",
      });
      return;
    }

    generateContentMutation.mutate({ userInput: goalsData.userInput });
  };

  // Field-specific generation function
  const generateFieldContent = (targetField: string) => {
    // Map frontend field names to backend field names if needed
    const backendFieldMap = {
      personalGoals: 'personalAspirations'
    };
    
    const backendTargetField = backendFieldMap[targetField] || targetField;
    
    const fieldPrompts = {
      ndisGoals: "Generate NDIS-aligned goals focused on capacity building, independence, and community participation",
      personalGoals: "Generate personal aspirations and life goals based on client's documented preferences",
      shortTermGoals: "Generate specific, measurable short-term goals achievable in 3-6 months",
      longTermGoals: "Generate broader long-term goals for 6+ months based on client's diagnosis and aspirations",
      overallObjective: "Generate an overall objective statement summarizing the client's main life aspirations"
    };

    const userInput = fieldPrompts[targetField] || `Generate content for ${targetField}`;
    generateContentMutation.mutate({ userInput, targetField: backendTargetField });
  };

  // Function to apply generated content to specific field
  const applyToField = (targetField: string) => {
    if (goalsData.generatedGoals) {
      handleInputChange(targetField, goalsData.generatedGoals);
      // Clear generated content after application
      handleInputChange('generatedGoals', '');
      refreshGPTLimit();
      
      toast({
        title: "Content Applied",
        description: `Generated content added to ${targetField.replace(/([A-Z])/g, ' $1').toLowerCase()}`,
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* NDIS Goals Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h4 className="text-lg font-semibold">NDIS Goals & Outcomes</h4>
            <p className="text-sm text-muted-foreground">
              Define NDIS-aligned goals that support the person's aspirations and independence
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="ndisGoals" className="text-base font-medium">NDIS Support Goals</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => generateFieldContent('ndisGoals')}
                disabled={generateContentMutation.isPending}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-3 w-3" />
                Add to NDIS Goals
              </Button>
            </div>
            <Textarea
              id="ndisGoals"
              value={goalsData.ndisGoals || ''}
              onChange={(e) => handleInputChange('ndisGoals', e.target.value)}
              placeholder="Describe NDIS goals related to capacity building, independence, and community participation..."
              className="min-h-[120px] resize-none"
            />
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="personalGoals" className="text-base font-medium">Personal Aspirations</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => generateFieldContent('personalGoals')}
                disabled={generateContentMutation.isPending}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-3 w-3" />
                Add to Personal Goals
              </Button>
            </div>
            <Textarea
              id="personalGoals"
              value={goalsData.personalGoals || goalsData.overallObjective || ''}
              onChange={(e) => {
                handleInputChange('personalGoals', e.target.value);
                handleInputChange('overallObjective', e.target.value);
              }}
              placeholder="What are the person's personal dreams, aspirations, and life goals?"
              className="min-h-[120px] resize-none"
            />
          </div>
        </div>
      </div>

      {/* Timeframe Goals Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h4 className="text-lg font-semibold">Goal Timeframes</h4>
            <p className="text-sm text-muted-foreground">
              Break down goals into achievable short-term and long-term objectives
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="shortTermGoals" className="text-base font-medium">Short-Term Goals (3-6 months)</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => generateFieldContent('shortTermGoals')}
                disabled={generateContentMutation.isPending}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-3 w-3" />
                Add to Short-Term
              </Button>
            </div>
            <Textarea
              id="shortTermGoals"
              value={goalsData.shortTermGoals || goalsData.goalInput || ''}
              onChange={(e) => handleInputChange('shortTermGoals', e.target.value)}
              placeholder="Specific, measurable goals achievable in the next 3-6 months..."
              className="min-h-[100px] resize-none"
            />
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="longTermGoals" className="text-base font-medium">Long-Term Goals (6+ months)</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => generateFieldContent('longTermGoals')}
                disabled={generateContentMutation.isPending}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-3 w-3" />
                Add to Long-Term
              </Button>
            </div>
            <Textarea
              id="longTermGoals"
              value={goalsData.longTermGoals || goalsData.generatedGoals || ''}
              onChange={(e) => handleInputChange('longTermGoals', e.target.value)}
              placeholder="Broader aspirations and goals for the next 6-12 months and beyond..."
              className="min-h-[100px] resize-none"
            />
          </div>
        </div>
      </div>

      {/* Overall Objective Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
            <CheckCircle2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h4 className="text-lg font-semibold">Overall Objective</h4>
            <p className="text-sm text-muted-foreground">
              Summarize the client's main life aspirations and support outcomes
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="overallObjective" className="text-base font-medium">Overall Objective Statement</Label>
            <Button
              size="sm"
              variant="outline"
              onClick={() => generateFieldContent('overallObjective')}
              disabled={generateContentMutation.isPending}
              className="flex items-center gap-2"
            >
              <Sparkles className="h-3 w-3" />
              Add to Overall Objective
            </Button>
          </div>
          <Textarea
            id="overallObjective"
            value={goalsData.overallObjective || ''}
            onChange={(e) => handleInputChange('overallObjective', e.target.value)}
            placeholder="Write a comprehensive statement summarizing the client's main life aspirations and how NDIS support will help achieve them..."
            className="min-h-[100px] resize-none"
          />
        </div>
      </div>

      {/* Individual Goals Management */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Plus className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h4 className="text-lg font-semibold">Individual Goals</h4>
              <p className="text-sm text-muted-foreground">
                Create specific, trackable goals with clear outcomes
              </p>
            </div>
          </div>
          <Button onClick={addGoal} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Goal
          </Button>
        </div>

        <div className="space-y-4">
          {(goalsData.goals || []).map((goal: Goal, index: number) => (
            <div key={goal.id} className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center justify-between mb-3">
                <Badge variant="outline" className="text-xs">
                  Goal {index + 1}
                </Badge>
                <Button
                  onClick={() => removeGoal(goal.id)}
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Goal Title</Label>
                  <Textarea
                    value={goal.title}
                    onChange={(e) => updateGoal(goal.id, 'title', e.target.value)}
                    placeholder="Brief, clear goal statement..."
                    className="min-h-[60px] resize-none"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Detailed Description</Label>
                  <Textarea
                    value={goal.description}
                    onChange={(e) => updateGoal(goal.id, 'description', e.target.value)}
                    placeholder="Specific steps, measures, and expected outcomes..."
                    className="min-h-[60px] resize-none"
                  />
                </div>
              </div>
            </div>
          ))}
          
          {(!goalsData.goals || goalsData.goals.length === 0) && (
            <div className="text-center p-8 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
              <p className="text-muted-foreground">No individual goals added yet</p>
              <p className="text-sm text-muted-foreground mt-1">Click "Add Goal" to create specific, trackable objectives</p>
            </div>
          )}
        </div>
      </div>

      {/* AI Generated Content Preview */}
      {goalsData.generatedGoals && (
        <div className="bg-blue-50 dark:bg-blue-950 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
          <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            AI Generated Content:
          </h4>
          
          <div className="bg-white dark:bg-gray-900 p-4 rounded-md border mb-4">
            <p className="text-sm whitespace-pre-wrap">{goalsData.generatedGoals}</p>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-blue-600 dark:text-blue-400">
              Content limited to 200 words for focused sections
            </p>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => handleInputChange('generatedGoals', '')}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4 mr-1" />
              Dismiss
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => applyToField('ndisGoals')}
              className="text-xs"
            >
              Add to NDIS Goals
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => applyToField('personalGoals')}
              className="text-xs"
            >
              Add to Personal Goals
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => applyToField('shortTermGoals')}
              className="text-xs"
            >
              Add to Short-Term
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => applyToField('longTermGoals')}
              className="text-xs"
            >
              Add to Long-Term
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => applyToField('overallObjective')}
              className="text-xs"
            >
              Add to Overall Objective
            </Button>
          </div>
        </div>
      )}

      {/* AI-Powered Goal Generation */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
            <Sparkles className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h4 className="text-lg font-semibold">AI-Powered Goal Generation</h4>
            <p className="text-sm text-muted-foreground">
              Generate personalized goals based on client information and best practices
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              AI Goal Content Generator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="goalUserInput">Client Aspirations & Needs</Label>
              <Textarea
                id="goalUserInput"
                value={goalsData.userInput || ""}
                onChange={(e) => handleInputChange("userInput", e.target.value)}
                placeholder="Describe the client's aspirations, strengths, challenges, and areas where they want to grow or achieve independence..."
                rows={4}
              />
            </div>

            <Button 
              onClick={handleGenerateGoals}
              disabled={generateContentMutation.isPending || !goalsData.userInput?.trim()}
              className="w-full"
            >
              {generateContentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Goal Content...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Goal Content
                </>
              )}
            </Button>

            {goalsData.generatedGoals && (
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">AI Generated Goal Content:</h4>
                  <Button 
                    onClick={() => {
                      handleInputChange("ndisGoals", goalsData.generatedGoals || "");
                      toast({
                        title: "Content Applied",
                        description: "AI-generated content has been added to NDIS Goals field.",
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
                  {goalsData.generatedGoals}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Button 
                    onClick={() => {
                      handleInputChange("ndisGoals", goalsData.generatedGoals || "");
                      refreshGPTLimit();
                      toast({
                        title: "Content Applied",
                        description: "Added to NDIS Goals field. GPT limit refreshed.",
                      });
                    }}
                    variant="outline" 
                    size="sm"
                    className="text-blue-700 border-blue-300 hover:bg-blue-100"
                  >
                    Add to NDIS Goals
                  </Button>
                  <Button 
                    onClick={() => {
                      handleInputChange("personalGoals", goalsData.generatedGoals || "");
                      handleInputChange("overallObjective", goalsData.generatedGoals || "");
                      refreshGPTLimit();
                      toast({
                        title: "Content Applied", 
                        description: "Added to Personal Goals field. GPT limit refreshed.",
                      });
                    }}
                    variant="outline" 
                    size="sm"
                    className="text-blue-700 border-blue-300 hover:bg-blue-100"
                  >
                    Add to Personal Goals
                  </Button>
                  <Button 
                    onClick={() => {
                      handleInputChange("shortTermGoals", goalsData.generatedGoals || "");
                      handleInputChange("goalInput", goalsData.generatedGoals || "");
                      refreshGPTLimit();
                      toast({
                        title: "Content Applied", 
                        description: "Added to Short-term Goals field. GPT limit refreshed.",
                      });
                    }}
                    variant="outline" 
                    size="sm"
                    className="text-blue-700 border-blue-300 hover:bg-blue-100"
                  >
                    Add to Short-term Goals
                  </Button>
                  <Button 
                    onClick={() => {
                      handleInputChange("longTermGoals", goalsData.generatedGoals || "");
                      refreshGPTLimit();
                      toast({
                        title: "Content Applied", 
                        description: "Added to Long-term Goals field. GPT limit refreshed.",
                      });
                    }}
                    variant="outline" 
                    size="sm"
                    className="text-blue-700 border-blue-300 hover:bg-blue-100"
                  >
                    Add to Long-term Goals
                  </Button>
                </div>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                  <div className="text-xs text-blue-600 dark:text-blue-400">
                    Content limited to 200 words for focused goal sections
                  </div>
                  <Button 
                    onClick={() => {
                      handleInputChange("generatedGoals", "");
                      toast({
                        title: "Content Dismissed",
                        description: "AI-generated content cleared.",
                      });
                    }}
                    variant="ghost" 
                    size="sm"
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Dismiss
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}