import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Save, AlertCircle, Shield, Flame, Droplets, Bomb, Heart, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface DisasterSectionProps {
  data: any;
  updateData: (section: string, data: any) => void;
}

const DISASTER_SCENARIOS = [
  { id: 'fire', name: 'Fire', icon: Flame, color: 'text-red-500' },
  { id: 'flood', name: 'Flood', icon: Droplets, color: 'text-blue-500' },
  { id: 'bomb', name: 'Bomb Threat', icon: Bomb, color: 'text-orange-500' },
  { id: 'medical', name: 'Medical Emergency', icon: Heart, color: 'text-pink-500' },
  { id: 'earthquake', name: 'Earthquake', icon: Zap, color: 'text-yellow-500' },
];

export function DisasterSection({ data, updateData }: DisasterSectionProps) {
  const { toast } = useToast();
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  const disasterData = data.disasterData || { scenarios: {} };

  const updateScenarioField = (scenarioId: string, field: string, value: string) => {
    const updatedScenarios = {
      ...disasterData.scenarios,
      [scenarioId]: {
        ...disasterData.scenarios[scenarioId],
        [field]: value,
      }
    };
    updateData('disasterData', { scenarios: updatedScenarios });
  };

  const generateDisasterPlan = async (scenarioId: string) => {
    const scenario = disasterData.scenarios[scenarioId] || {};
    
    if (scenario.aiAttempts >= 2) {
      toast({
        title: "AI Generation Limit Reached",
        description: "Maximum 2 AI generation attempts allowed per scenario.",
        variant: "destructive",
      });
      return;
    }

    setGeneratingFor(scenarioId);
    try {
      const scenarioName = DISASTER_SCENARIOS.find(s => s.id === scenarioId)?.name || scenarioId;
      
      const response = await apiRequest("POST", "/api/care-support-plans/generate-ai", {
        section: "disaster",
        userInput: `Disaster Scenario: ${scenarioName}`,
        clientDiagnosis: data.clientData?.primaryDiagnosis || null,
        clientName: data.clientData?.fullName || null,
        maxWords: 400,
      });

      const generatedContent = (response as any).generatedContent;
      
      // Parse the AI response to extract the three sections
      const sections = parseDisasterPlanFromAI(generatedContent);
      
      const updatedScenarios = {
        ...disasterData.scenarios,
        [scenarioId]: {
          preparation: sections.preparation,
          evacuation: sections.evacuation,
          postEvent: sections.postEvent,
          aiAttempts: (scenario.aiAttempts || 0) + 1,
        }
      };
      
      updateData('disasterData', { scenarios: updatedScenarios });

      toast({
        title: "Disaster Plan Generated",
        description: `AI has generated a comprehensive ${scenarioName.toLowerCase()} emergency plan.`,
      });
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate disaster plan.",
        variant: "destructive",
      });
    } finally {
      setGeneratingFor(null);
    }
  };

  const parseDisasterPlanFromAI = (content: string) => {
    // Simple parsing - in a real implementation, you'd have more sophisticated parsing
    const sections = content.split(/(?:Preparation|Evacuation|Post-Event)/i);
    return {
      preparation: sections[1]?.trim() || '',
      evacuation: sections[2]?.trim() || '',
      postEvent: sections[3]?.trim() || ''
    };
  };

  const handleSaveSection = () => {
    toast({
      title: "Section Saved",
      description: "Disaster Management section has been saved.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Section Instructions</h4>
        <p className="text-sm text-blue-800 dark:text-blue-200">
          Create comprehensive disaster management plans for five emergency scenarios. AI will generate detailed 
          preparation, evacuation, and post-event care procedures tailored to the client's specific needs.
        </p>
      </div>

      <Tabs defaultValue="fire" className="w-full">
        <TabsList className="grid grid-cols-5 w-full">
          {DISASTER_SCENARIOS.map((scenario) => {
            const Icon = scenario.icon;
            return (
              <TabsTrigger key={scenario.id} value={scenario.id} className="flex items-center gap-1">
                <Icon className={`h-4 w-4 ${scenario.color}`} />
                <span className="hidden sm:inline">{scenario.name}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {DISASTER_SCENARIOS.map((scenario) => {
          const Icon = scenario.icon;
          const scenarioData = disasterData.scenarios[scenario.id] || {};
          const isGenerating = generatingFor === scenario.id;

          return (
            <TabsContent key={scenario.id} value={scenario.id} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${scenario.color}`} />
                    {scenario.name} Emergency Plan
                  </CardTitle>
                  <CardDescription>
                    Comprehensive emergency procedures for {scenario.name.toLowerCase()} situations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={(scenarioData.aiAttempts || 0) >= 2 ? "destructive" : "secondary"}>
                        {scenarioData.aiAttempts || 0}/2 AI Attempts Used
                      </Badge>
                      {data.clientData?.primaryDiagnosis && (
                        <Badge variant="outline">
                          Using: {data.clientData.primaryDiagnosis}
                        </Badge>
                      )}
                    </div>
                    <Button
                      onClick={() => generateDisasterPlan(scenario.id)}
                      disabled={isGenerating || (scenarioData.aiAttempts || 0) >= 2}
                      className="flex items-center gap-2"
                    >
                      <Sparkles className="h-4 w-4" />
                      {isGenerating ? "Generating..." : "Generate Plan"}
                    </Button>
                  </div>

                  {(scenarioData.aiAttempts || 0) >= 2 && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        Maximum AI generation attempts reached for this scenario. You can still edit manually.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor={`${scenario.id}-preparation`}>Preparation</Label>
                      <Textarea
                        id={`${scenario.id}-preparation`}
                        value={scenarioData.preparation || ''}
                        onChange={(e) => updateScenarioField(scenario.id, 'preparation', e.target.value)}
                        placeholder="Preparation procedures and preventive measures..."
                        rows={8}
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Pre-event planning and preparation steps
                      </p>
                    </div>

                    <div>
                      <Label htmlFor={`${scenario.id}-evacuation`}>Evacuation</Label>
                      <Textarea
                        id={`${scenario.id}-evacuation`}
                        value={scenarioData.evacuation || ''}
                        onChange={(e) => updateScenarioField(scenario.id, 'evacuation', e.target.value)}
                        placeholder="Evacuation procedures and safety protocols..."
                        rows={8}
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Emergency response and evacuation procedures
                      </p>
                    </div>

                    <div>
                      <Label htmlFor={`${scenario.id}-postEvent`}>Post-Event Care</Label>
                      <Textarea
                        id={`${scenario.id}-postEvent`}
                        value={scenarioData.postEvent || ''}
                        onChange={(e) => updateScenarioField(scenario.id, 'postEvent', e.target.value)}
                        placeholder="Post-event care and recovery procedures..."
                        rows={8}
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        After-event care and support procedures
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSaveSection} className="flex items-center gap-2">
          <Save className="h-4 w-4" />
          Save Section
        </Button>
      </div>
    </div>
  );
}