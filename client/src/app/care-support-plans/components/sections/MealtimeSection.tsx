import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Save, AlertCircle, Utensils } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface MealtimeSectionProps {
  data: any;
  updateData: (section: string, data: any) => void;
}

const MEALTIME_RISKS = [
  { id: 'choking', name: 'Choking', category: 'Physical' },
  { id: 'aspiration', name: 'Aspiration', category: 'Physical' },
  { id: 'swallowing', name: 'Swallowing difficulties', category: 'Physical' },
  { id: 'texture_modification', name: 'Texture modification needs', category: 'Dietary' },
  { id: 'allergies', name: 'Food allergies', category: 'Medical' },
  { id: 'diabetes', name: 'Diabetes management', category: 'Medical' },
  { id: 'medication_timing', name: 'Medication timing with meals', category: 'Medical' },
  { id: 'behavioral_eating', name: 'Behavioral eating issues', category: 'Behavioral' },
  { id: 'food_refusal', name: 'Food refusal', category: 'Behavioral' },
  { id: 'overeating', name: 'Overeating/binge eating', category: 'Behavioral' },
  { id: 'utensil_use', name: 'Difficulty using utensils', category: 'Physical' },
  { id: 'positioning', name: 'Positioning requirements', category: 'Physical' },
  { id: 'supervision', name: 'Level of supervision needed', category: 'Support' },
  { id: 'cultural_dietary', name: 'Cultural/religious dietary needs', category: 'Cultural' },
  { id: 'weight_management', name: 'Weight management', category: 'Medical' },
  { id: 'hydration', name: 'Hydration concerns', category: 'Medical' },
  { id: 'sensory_issues', name: 'Sensory food aversions', category: 'Sensory' },
  { id: 'social_eating', name: 'Social eating challenges', category: 'Social' },
];

const RISK_LEVELS = ['High', 'Medium', 'N/A'];

export function MealtimeSection({ data, updateData }: MealtimeSectionProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const mealtimeData = data.mealtimeData || { 
    riskParameters: [], 
    generatedPlan: '', 
    aiAttempts: 0 
  };

  const updateRiskParameter = (riskId: string, field: string, value: any) => {
    const updatedParameters = mealtimeData.riskParameters.map((param: any) => 
      param.riskId === riskId ? { ...param, [field]: value } : param
    );
    
    // If risk doesn't exist, add it
    if (!updatedParameters.find((p: any) => p.riskId === riskId)) {
      updatedParameters.push({
        riskId,
        isRisk: field === 'isRisk' ? value : false,
        riskLevel: field === 'riskLevel' ? value : 'N/A',
        implications: field === 'implications' ? value : '',
      });
    }

    updateData('mealtimeData', {
      ...mealtimeData,
      riskParameters: updatedParameters,
    });
  };

  const getRiskParameter = (riskId: string, field: string) => {
    const param = mealtimeData.riskParameters.find((p: any) => p.riskId === riskId);
    return param ? param[field] : (field === 'isRisk' ? false : field === 'riskLevel' ? 'N/A' : '');
  };

  const generateMealtimePlan = async () => {
    if (mealtimeData.aiAttempts >= 2) {
      toast({
        title: "AI Generation Limit Reached",
        description: "Maximum 2 AI generation attempts allowed per section.",
        variant: "destructive",
      });
      return;
    }

    const selectedRisks = mealtimeData.riskParameters.filter((param: any) => param.isRisk);
    
    if (selectedRisks.length === 0) {
      toast({
        title: "No Risks Selected",
        description: "Please select at least one risk before generating a plan.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const risksDescription = selectedRisks.map((param: any) => {
        const risk = MEALTIME_RISKS.find(r => r.id === param.riskId);
        return `${risk?.name} (${param.riskLevel} risk): ${param.implications}`;
      }).join('\n');

      const response = await apiRequest("POST", "/api/care-support-plans/generate-ai", {
        section: "mealtime",
        userInput: risksDescription,
        clientDiagnosis: data.clientData?.primaryDiagnosis || null,
        clientName: data.clientData?.fullName || null,
        maxWords: 500,
      });

      const { generatedContent } = response;
      
      updateData('mealtimeData', {
        ...mealtimeData,
        generatedPlan: generatedContent,
        aiAttempts: mealtimeData.aiAttempts + 1,
      });

      toast({
        title: "Mealtime Plan Generated",
        description: "AI has generated a comprehensive mealtime management plan.",
      });
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate mealtime plan.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGeneratedPlanChange = (value: string) => {
    updateData('mealtimeData', {
      ...mealtimeData,
      generatedPlan: value,
    });
  };

  const handleSaveSection = () => {
    toast({
      title: "Section Saved",
      description: "Mealtime Risk Assessment section has been saved.",
    });
  };

  const groupedRisks = MEALTIME_RISKS.reduce((acc, risk) => {
    if (!acc[risk.category]) acc[risk.category] = [];
    acc[risk.category].push(risk);
    return acc;
  }, {} as Record<string, typeof MEALTIME_RISKS>);

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Section Instructions</h4>
        <p className="text-sm text-blue-800 dark:text-blue-200">
          Assess 18 potential mealtime risks across different categories. For each identified risk, specify the level 
          and implications. AI will generate a comprehensive mealtime management plan based on selected risks.
        </p>
      </div>

      {/* Risk Assessment Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Utensils className="h-5 w-5 text-primary" />
            Mealtime Risk Assessment
          </CardTitle>
          <CardDescription>
            Review each risk category and mark applicable risks for this client
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(groupedRisks).map(([category, risks]) => (
            <div key={category} className="space-y-3">
              <h4 className="font-semibold text-sm text-primary border-b pb-1">
                {category} Risks
              </h4>
              <div className="space-y-3">
                {risks.map((risk) => {
                  const isRisk = getRiskParameter(risk.id, 'isRisk');
                  
                  return (
                    <div key={risk.id} className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={risk.id}
                          checked={isRisk}
                          onCheckedChange={(checked) => 
                            updateRiskParameter(risk.id, 'isRisk', checked)
                          }
                        />
                        <Label htmlFor={risk.id} className="flex-1 font-medium">
                          {risk.name}
                        </Label>
                      </div>
                      
                      {isRisk && (
                        <div className="ml-6 grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">Risk Level</Label>
                            <Select
                              value={getRiskParameter(risk.id, 'riskLevel')}
                              onValueChange={(value) => 
                                updateRiskParameter(risk.id, 'riskLevel', value)
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {RISK_LEVELS.map((level) => (
                                  <SelectItem key={level} value={level}>
                                    {level}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="md:col-span-2">
                            <Label className="text-xs text-muted-foreground">Implications</Label>
                            <Textarea
                              value={getRiskParameter(risk.id, 'implications')}
                              onChange={(e) => 
                                updateRiskParameter(risk.id, 'implications', e.target.value)
                              }
                              placeholder="Describe the implications and specific considerations..."
                              rows={2}
                              className="text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* AI Generation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI-Generated Mealtime Management Plan
          </CardTitle>
          <CardDescription>
            Generate a comprehensive plan based on identified risks and strategies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={mealtimeData.aiAttempts >= 2 ? "destructive" : "secondary"}>
                {mealtimeData.aiAttempts}/2 AI Attempts Used
              </Badge>
              {data.clientData?.primaryDiagnosis && (
                <Badge variant="outline">
                  Using: {data.clientData.primaryDiagnosis}
                </Badge>
              )}
              <Badge variant="outline">
                {mealtimeData.riskParameters.filter((p: any) => p.isRisk).length} Risks Selected
              </Badge>
            </div>
            <Button
              onClick={generateMealtimePlan}
              disabled={isGenerating || mealtimeData.aiAttempts >= 2}
              className="flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {isGenerating ? "Generating..." : "Generate Mealtime Plan"}
            </Button>
          </div>

          {mealtimeData.aiAttempts >= 2 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Maximum AI generation attempts reached. You can still edit the plan manually.
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="generatedPlan">Generated Mealtime Plan (Editable)</Label>
            <Textarea
              id="generatedPlan"
              value={mealtimeData.generatedPlan}
              onChange={(e) => handleGeneratedPlanChange(e.target.value)}
              placeholder="AI-generated mealtime management plan will appear here and can be edited..."
              rows={12}
              className="mt-1"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Edit the generated plan as needed before saving (up to 500 words)
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSaveSection} className="flex items-center gap-2">
          <Save className="h-4 w-4" />
          Save Section
        </Button>
      </div>
    </div>
  );
}