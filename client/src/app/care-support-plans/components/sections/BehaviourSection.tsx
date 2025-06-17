import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Save, AlertCircle, Plus, Trash2, Shield, Loader2, CheckCircle2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface BehaviourSectionProps {
  data: any;
  updateData: (section: string, data: any) => void;
}

interface BehaviourEntry {
  id: string;
  behaviour: string;
  trigger: string;
  proactiveStrategy: string;
  reactiveStrategy: string;
  protectiveStrategy: string;
  aiAttempts: number;
}

export function BehaviourSection({ data, updateData }: BehaviourSectionProps) {
  const { toast } = useToast();
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  const behaviourData = data.behaviourData || { behaviours: [] };
  
  const [newBehaviour, setNewBehaviour] = useState({
    behaviour: '',
    trigger: ''
  });

  const addNewBehaviour = () => {
    if (!newBehaviour.behaviour.trim() || !newBehaviour.trigger.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both behaviour and trigger before adding.",
        variant: "destructive",
      });
      return;
    }

    const behaviourEntry: BehaviourEntry = {
      id: Date.now().toString(),
      behaviour: newBehaviour.behaviour,
      trigger: newBehaviour.trigger,
      proactiveStrategy: '',
      reactiveStrategy: '',
      protectiveStrategy: '',
      aiAttempts: 0
    };

    const updatedBehaviours = [...behaviourData.behaviours, behaviourEntry];
    updateData('behaviourData', { behaviours: updatedBehaviours });

    setNewBehaviour({ behaviour: '', trigger: '' });

    toast({
      title: "Behaviour Added",
      description: "New behaviour entry has been added successfully.",
    });
  };

  const deleteBehaviour = (behaviourId: string) => {
    const updatedBehaviours = behaviourData.behaviours.filter((b: BehaviourEntry) => b.id !== behaviourId);
    updateData('behaviourData', { behaviours: updatedBehaviours });
    
    toast({
      title: "Behaviour Deleted",
      description: "Behaviour entry has been removed successfully.",
    });
  };

  const updateBehaviourField = (behaviourId: string, field: string, value: string) => {
    const updatedBehaviours = behaviourData.behaviours.map((b: BehaviourEntry) => 
      b.id === behaviourId ? { ...b, [field]: value } : b
    );
    updateData('behaviourData', { behaviours: updatedBehaviours });
  };

  const generateStrategies = async (behaviourId: string) => {
    const behaviour = behaviourData.behaviours.find((b: BehaviourEntry) => b.id === behaviourId);
    
    if (!behaviour) return;

    if (behaviour.aiAttempts >= 2) {
      toast({
        title: "AI Generation Limit Reached",
        description: "Maximum 2 AI generation attempts allowed per behaviour.",
        variant: "destructive",
      });
      return;
    }

    setGeneratingFor(behaviourId);
    try {
      const response = await apiRequest("POST", "/api/care-support-plans/generate-ai", {
        section: "behaviour",
        userInput: `Behaviour: ${behaviour.behaviour}\nTrigger: ${behaviour.trigger}`,
        clientDiagnosis: data.clientData?.primaryDiagnosis || null,
        clientName: data.clientData?.fullName || null,
        maxWords: 150,
      });

      const generatedContent = (response as any).generatedContent;
      
      // Parse the AI response to extract the three strategies
      const strategies = parseStrategiesFromAI(generatedContent);
      
      const updatedBehaviours = behaviourData.behaviours.map((b: BehaviourEntry) => 
        b.id === behaviourId ? { 
          ...b, 
          proactiveStrategy: strategies.proactive,
          reactiveStrategy: strategies.reactive,
          protectiveStrategy: strategies.protective,
          aiAttempts: b.aiAttempts + 1 
        } : b
      );
      
      updateData('behaviourData', { behaviours: updatedBehaviours });

      toast({
        title: "Strategies Generated",
        description: "AI has generated behaviour support strategies.",
      });
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate strategies.",
        variant: "destructive",
      });
    } finally {
      setGeneratingFor(null);
    }
  };

  const parseStrategiesFromAI = (content: string) => {
    // Simple parsing - in a real implementation, you'd have more sophisticated parsing
    const sections = content.split(/(?:Proactive|Reactive|Protective)/i);
    return {
      proactive: sections[1]?.trim() || '',
      reactive: sections[2]?.trim() || '',
      protective: sections[3]?.trim() || ''
    };
  };

  const handleSaveSection = () => {
    toast({
      title: "Section Saved",
      description: "Behaviour Support section has been saved.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Section Instructions</h4>
        <p className="text-sm text-blue-800 dark:text-blue-200">
          Document challenging behaviours and their triggers. AI will generate three types of support strategies: 
          Proactive (prevention), Reactive (response), and Protective (safety) for each behaviour.
        </p>
      </div>

      {/* Add New Behaviour Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Add New Behaviour
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="newBehaviour">Behaviour *</Label>
              <Input
                id="newBehaviour"
                value={newBehaviour.behaviour}
                onChange={(e) => setNewBehaviour({...newBehaviour, behaviour: e.target.value})}
                placeholder="e.g., Aggressive outbursts, Self-harm, Withdrawal"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="newTrigger">Trigger *</Label>
              <Input
                id="newTrigger"
                value={newBehaviour.trigger}
                onChange={(e) => setNewBehaviour({...newBehaviour, trigger: e.target.value})}
                placeholder="e.g., Loud noises, Changes in routine, Frustration"
                className="mt-1"
              />
            </div>
          </div>

          <Button onClick={addNewBehaviour} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Behaviour
          </Button>
        </CardContent>
      </Card>

      {/* Existing Behaviours */}
      {behaviourData.behaviours.length > 0 && (
        <div className="space-y-4">
          {behaviourData.behaviours.map((behaviour: BehaviourEntry) => (
            <Card key={behaviour.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    {behaviour.behaviour}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={behaviour.aiAttempts >= 2 ? "destructive" : "secondary"}>
                      {behaviour.aiAttempts}/2 AI Attempts
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteBehaviour(behaviour.id)}
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  <strong>Trigger:</strong> {behaviour.trigger}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Generate AI-powered strategies for this behaviour
                  </p>
                  <Button
                    onClick={() => generateStrategies(behaviour.id)}
                    disabled={generatingFor === behaviour.id || behaviour.aiAttempts >= 2}
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    {generatingFor === behaviour.id ? "Generating..." : "Generate Strategies"}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor={`proactive-${behaviour.id}`}>Proactive Strategy</Label>
                    <Textarea
                      id={`proactive-${behaviour.id}`}
                      value={behaviour.proactiveStrategy}
                      onChange={(e) => updateBehaviourField(behaviour.id, 'proactiveStrategy', e.target.value)}
                      placeholder="Prevention strategies..."
                      rows={4}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">How to prevent the behaviour</p>
                  </div>

                  <div>
                    <Label htmlFor={`reactive-${behaviour.id}`}>Reactive Strategy</Label>
                    <Textarea
                      id={`reactive-${behaviour.id}`}
                      value={behaviour.reactiveStrategy}
                      onChange={(e) => updateBehaviourField(behaviour.id, 'reactiveStrategy', e.target.value)}
                      placeholder="Response strategies..."
                      rows={4}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">How to respond when it occurs</p>
                  </div>

                  <div>
                    <Label htmlFor={`protective-${behaviour.id}`}>Protective Strategy</Label>
                    <Textarea
                      id={`protective-${behaviour.id}`}
                      value={behaviour.protectiveStrategy}
                      onChange={(e) => updateBehaviourField(behaviour.id, 'protectiveStrategy', e.target.value)}
                      placeholder="Safety strategies..."
                      rows={4}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">How to ensure safety</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {behaviourData.behaviours.length === 0 && (
        <Card className="border-dashed border-2 border-muted-foreground/25">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Shield className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold text-lg mb-2">No Behaviours Added</h3>
            <p className="text-muted-foreground max-w-md">
              Add challenging behaviours and their triggers to generate comprehensive support strategies. 
              Start by filling out the form above.
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