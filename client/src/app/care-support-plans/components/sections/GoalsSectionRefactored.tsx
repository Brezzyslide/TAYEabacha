import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

  const generateAIGoals = async () => {
    if (!planData.clientData) {
      toast({
        title: "Client Required",
        description: "Please select a client first to generate AI-powered goals.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/ai/generate-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientData: planData.clientData,
          aboutMeData: planData.aboutMeData,
          existingGoals: goalsData
        }),
      });

      if (!response.ok) throw new Error('Failed to generate goals');

      const aiGoals = await response.json();
      
      // Update the goals data with AI-generated content
      Object.keys(aiGoals).forEach(key => {
        if (aiGoals[key]) {
          handleInputChange(key, aiGoals[key]);
        }
      });

      toast({
        title: "Goals Generated",
        description: "AI-powered goals have been generated based on client information.",
      });
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: "Failed to generate AI-powered goals. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
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
            <Label htmlFor="ndisGoals" className="text-base font-medium">NDIS Support Goals</Label>
            <Textarea
              id="ndisGoals"
              value={goalsData.ndisGoals || ''}
              onChange={(e) => handleInputChange('ndisGoals', e.target.value)}
              placeholder="Describe NDIS goals related to capacity building, independence, and community participation..."
              className="min-h-[120px] resize-none"
            />
          </div>
          
          <div className="space-y-3">
            <Label htmlFor="personalGoals" className="text-base font-medium">Personal Aspirations</Label>
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
            <Label htmlFor="shortTermGoals" className="text-base font-medium">Short-Term Goals (3-6 months)</Label>
            <Textarea
              id="shortTermGoals"
              value={goalsData.shortTermGoals || goalsData.goalInput || ''}
              onChange={(e) => handleInputChange('shortTermGoals', e.target.value)}
              placeholder="Specific, measurable goals achievable in the next 3-6 months..."
              className="min-h-[100px] resize-none"
            />
          </div>
          
          <div className="space-y-3">
            <Label htmlFor="longTermGoals" className="text-base font-medium">Long-Term Goals (6+ months)</Label>
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

        <div className="bg-gradient-to-r from-orange-50 to-purple-50 dark:from-orange-950 dark:to-purple-950 p-6 rounded-xl border border-orange-200 dark:border-orange-800">
          <Button 
            onClick={generateAIGoals} 
            disabled={isGenerating || !planData.clientData}
            className="w-full h-12 text-base"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Generating personalized goals...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 mr-2" />
                Generate AI-Powered Goals & Outcomes
              </>
            )}
          </Button>
          
          {!planData.clientData && (
            <div className="text-center mt-4 p-4 bg-white dark:bg-gray-900 rounded-lg border border-dashed border-orange-300 dark:border-orange-700">
              <p className="text-sm text-muted-foreground">
                Select a client first to enable AI goal generation
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}