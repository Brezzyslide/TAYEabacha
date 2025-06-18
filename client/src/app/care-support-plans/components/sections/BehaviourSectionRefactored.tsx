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
import { Plus, Trash2, Sparkles, Loader2, CheckCircle2, Brain, Shield, Heart, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useCarePlan } from "../../contexts/CarePlanContext";

interface BehaviourStrategy {
  id: string;
  behaviour: string;
  triggers: string;
  frequency: string;
  intensity: 'low' | 'medium' | 'high';
  proactiveStrategy: string;
  reactiveStrategy: string;
  protectiveStrategy: string;
  successIndicators: string;
}

const FREQUENCY_OPTIONS = [
  'Multiple times daily', 'Daily', 'Several times weekly', 'Weekly', 
  'Occasional', 'Rare', 'As needed', 'Situational'
];

const INTENSITY_OPTIONS = [
  { value: 'low', label: 'Low Intensity', color: 'bg-green-100 text-green-800' },
  { value: 'medium', label: 'Medium Intensity', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'high', label: 'High Intensity', color: 'bg-red-100 text-red-800' }
];

export function BehaviourSectionRefactored() {
  const { planData, dispatch } = useCarePlan();
  const { toast } = useToast();
  
  const behaviourData = planData?.behaviourData || {
    userInput: '',
    generatedContent: '',
    behaviours: [],
    overallApproach: '',
    environmentalFactors: '',
    preventativeStrategies: '',
    deEscalationTechniques: '',
    positiveBehaviourSupport: '',
    staffGuidance: '',
    riskAssessment: '',
    communicationStrategies: ''
  };

  const [newBehaviour, setNewBehaviour] = useState<BehaviourStrategy>({
    id: '',
    behaviour: '',
    triggers: '',
    frequency: '',
    intensity: 'medium',
    proactiveStrategy: '',
    reactiveStrategy: '',
    protectiveStrategy: '',
    successIndicators: ''
  });

  const [isGenerating, setIsGenerating] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    dispatch({
      type: 'UPDATE_SECTION',
      section: 'behaviourData',
      data: {
        ...behaviourData,
        [field]: value
      }
    });
  };

  const handleBehaviourChange = (field: string, value: string) => {
    setNewBehaviour(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addBehaviour = () => {
    if (!newBehaviour.behaviour || !newBehaviour.triggers) {
      toast({
        title: "Missing Information",
        description: "Please enter behaviour and triggers before adding.",
        variant: "destructive",
      });
      return;
    }

    const behaviour: BehaviourStrategy = {
      ...newBehaviour,
      id: Date.now().toString()
    };

    const updatedBehaviours = [...behaviourData.behaviours, behaviour];
    
    dispatch({
      type: 'UPDATE_SECTION',
      section: 'behaviourData',
      data: {
        ...behaviourData,
        behaviours: updatedBehaviours
      }
    });
    
    setNewBehaviour({
      id: '',
      behaviour: '',
      triggers: '',
      frequency: '',
      intensity: 'medium',
      proactiveStrategy: '',
      reactiveStrategy: '',
      protectiveStrategy: '',
      successIndicators: ''
    });

    toast({
      title: "Behaviour Strategy Added",
      description: `Strategy for ${newBehaviour.behaviour} has been added`,
    });
  };

  const removeBehaviour = (behaviourId: string) => {
    const updatedBehaviours = behaviourData.behaviours.filter((b: any) => b.id !== behaviourId);
    
    dispatch({
      type: 'UPDATE_SECTION',
      section: 'behaviourData',
      data: {
        ...behaviourData,
        behaviours: updatedBehaviours
      }
    });

    toast({
      title: "Behaviour Strategy Removed",
      description: "Strategy has been deleted from the plan.",
    });
  };

  // AI Content Generation Mutation
  const generateContentMutation = useMutation({
    mutationFn: async ({ targetField }: { targetField: string }) => {
      if (!behaviourData.userInput?.trim()) {
        throw new Error("Please enter behaviour assessment information first.");
      }

      setIsGenerating(true);
      const userInput = behaviourData.userInput;

      const existingContent = {
        overallApproach: behaviourData.overallApproach || "",
        environmentalFactors: behaviourData.environmentalFactors || "",
        preventativeStrategies: behaviourData.preventativeStrategies || "",
        deEscalationTechniques: behaviourData.deEscalationTechniques || "",
        positiveBehaviourSupport: behaviourData.positiveBehaviourSupport || "",
        staffGuidance: behaviourData.staffGuidance || "",
        riskAssessment: behaviourData.riskAssessment || "",
        communicationStrategies: behaviourData.communicationStrategies || ""
      };

      const behaviourContext = behaviourData.behaviours.length > 0 
        ? `Current behaviour strategies: ${behaviourData.behaviours.map((b: any) => `${b.behaviour} (triggers: ${b.triggers})`).join('; ')}`
        : "No specific behaviour strategies documented yet";

      const response = await apiRequest("POST", "/api/care-support-plans/generate-ai", {
        section: "behaviour",
        userInput: `${userInput}\n\n${behaviourContext}`,
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
          overallApproach: "Overall Approach",
          environmentalFactors: "Environmental Factors",
          preventativeStrategies: "Preventative Strategies",
          deEscalationTechniques: "De-escalation Techniques",
          positiveBehaviourSupport: "Positive Behaviour Support",
          staffGuidance: "Staff Guidance",
          riskAssessment: "Risk Assessment",
          communicationStrategies: "Communication Strategies"
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
    generateContentMutation.mutate({ targetField: 'preview' });
  };

  const handleGenerateTargetedContent = (targetField: string) => {
    generateContentMutation.mutate({ targetField });
  };

  const getIntensityBadge = (intensity: string) => {
    const option = INTENSITY_OPTIONS.find(i => i.value === intensity);
    return <Badge className={option?.color}>{option?.label}</Badge>;
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Behaviour Support Assessment Input
          </CardTitle>
          <CardDescription>
            Describe the client's behaviours, triggers, and support strategies needed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="behaviourInput">Behaviour Assessment Information</Label>
            <Textarea
              id="behaviourInput"
              placeholder="Enter details about challenging behaviours, triggers, current strategies, environmental factors, etc..."
              value={behaviourData.userInput || ""}
              onChange={(e) => handleInputChange("userInput", e.target.value)}
              rows={4}
            />
          </div>

          <Button 
            onClick={handleGenerateInitialContent}
            disabled={isGenerating || !behaviourData.userInput?.trim()}
            className="w-full mb-4"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Behaviour Support Content...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Behaviour Support Content
              </>
            )}
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleGenerateTargetedContent('overallApproach')}
              disabled={isGenerating || !behaviourData.userInput?.trim()}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Add to Overall Approach
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleGenerateTargetedContent('preventativeStrategies')}
              disabled={isGenerating || !behaviourData.userInput?.trim()}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Add to Preventative
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleGenerateTargetedContent('deEscalationTechniques')}
              disabled={isGenerating || !behaviourData.userInput?.trim()}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Add to De-escalation
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleGenerateTargetedContent('positiveBehaviourSupport')}
              disabled={isGenerating || !behaviourData.userInput?.trim()}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Add to PBS
            </Button>
          </div>

          {behaviourData.generatedContent && (
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-blue-900 dark:text-blue-100">AI Generated Content:</h4>
                <Button 
                  onClick={() => {
                    handleInputChange("overallApproach", behaviourData.generatedContent || "");
                    handleInputChange('generatedContent', '');
                    toast({
                      title: "Content Applied",
                      description: "AI-generated content has been added to Overall Approach field.",
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
                {behaviourData.generatedContent}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Behaviour Strategy Builder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            Behaviour Strategy Builder
          </CardTitle>
          <CardDescription>
            Create specific strategies for individual behaviours
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="behaviour">Behaviour Description</Label>
              <Input
                placeholder="e.g., Verbal outbursts when routine changes"
                value={newBehaviour.behaviour}
                onChange={(e) => handleBehaviourChange('behaviour', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="triggers">Triggers</Label>
              <Input
                placeholder="e.g., Unexpected changes, loud noises"
                value={newBehaviour.triggers}
                onChange={(e) => handleBehaviourChange('triggers', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={newBehaviour.frequency} onValueChange={(value) => handleBehaviourChange('frequency', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map(freq => (
                    <SelectItem key={freq} value={freq}>{freq}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Intensity</Label>
              <Select value={newBehaviour.intensity} onValueChange={(value) => handleBehaviourChange('intensity', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select intensity" />
                </SelectTrigger>
                <SelectContent>
                  {INTENSITY_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-600" />
                Proactive Strategy
              </Label>
              <Textarea
                placeholder="What to do BEFORE the behaviour occurs (prevention)..."
                value={newBehaviour.proactiveStrategy}
                onChange={(e) => handleBehaviourChange('proactiveStrategy', e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                Reactive Strategy
              </Label>
              <Textarea
                placeholder="What to do DURING the behaviour (response)..."
                value={newBehaviour.reactiveStrategy}
                onChange={(e) => handleBehaviourChange('reactiveStrategy', e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-red-600" />
                Protective Strategy
              </Label>
              <Textarea
                placeholder="Safety measures if behaviour escalates (protection)..."
                value={newBehaviour.protectiveStrategy}
                onChange={(e) => handleBehaviourChange('protectiveStrategy', e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Success Indicators</Label>
              <Textarea
                placeholder="How will you know the strategy is working..."
                value={newBehaviour.successIndicators}
                onChange={(e) => handleBehaviourChange('successIndicators', e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <Button onClick={addBehaviour} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Behaviour Strategy
          </Button>

          {behaviourData.behaviours.length > 0 && (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Behaviour</TableHead>
                    <TableHead>Triggers</TableHead>
                    <TableHead>Intensity</TableHead>
                    <TableHead>Strategies</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {behaviourData.behaviours.map((behaviour: any) => (
                    <TableRow key={behaviour.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{behaviour.behaviour}</div>
                          {behaviour.frequency && <div className="text-xs text-gray-500">{behaviour.frequency}</div>}
                        </div>
                      </TableCell>
                      <TableCell>{behaviour.triggers}</TableCell>
                      <TableCell>{getIntensityBadge(behaviour.intensity)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {behaviour.proactiveStrategy && (
                            <div className="text-xs">
                              <Badge variant="outline" className="mr-1">Proactive</Badge>
                              {behaviour.proactiveStrategy.slice(0, 50)}...
                            </div>
                          )}
                          {behaviour.reactiveStrategy && (
                            <div className="text-xs">
                              <Badge variant="outline" className="mr-1">Reactive</Badge>
                              {behaviour.reactiveStrategy.slice(0, 50)}...
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeBehaviour(behaviour.id)}
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

      {/* Behaviour Support Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Overall Approach</CardTitle>
            <CardDescription>General behaviour support philosophy</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document the overall behaviour support approach, philosophy, and principles..."
              value={behaviourData.overallApproach || ""}
              onChange={(e) => handleInputChange("overallApproach", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Environmental Factors</CardTitle>
            <CardDescription>Environmental triggers and modifications</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document environmental factors affecting behaviour and necessary modifications..."
              value={behaviourData.environmentalFactors || ""}
              onChange={(e) => handleInputChange("environmentalFactors", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preventative Strategies</CardTitle>
            <CardDescription>Proactive behaviour prevention</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document preventative strategies and early intervention approaches..."
              value={behaviourData.preventativeStrategies || ""}
              onChange={(e) => handleInputChange("preventativeStrategies", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">De-escalation Techniques</CardTitle>
            <CardDescription>Active de-escalation methods</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document de-escalation techniques and calming strategies..."
              value={behaviourData.deEscalationTechniques || ""}
              onChange={(e) => handleInputChange("deEscalationTechniques", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Positive Behaviour Support</CardTitle>
            <CardDescription>PBS principles and reinforcement</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document positive behaviour support strategies and reinforcement approaches..."
              value={behaviourData.positiveBehaviourSupport || ""}
              onChange={(e) => handleInputChange("positiveBehaviourSupport", e.target.value)}
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
              placeholder="Document specific staff guidance for behaviour support implementation..."
              value={behaviourData.staffGuidance || ""}
              onChange={(e) => handleInputChange("staffGuidance", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>
      </div>

      {/* Additional Support Areas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Risk Assessment</CardTitle>
            <CardDescription>Safety and risk considerations</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document risk assessment, safety considerations, and protective measures..."
              value={behaviourData.riskAssessment || ""}
              onChange={(e) => handleInputChange("riskAssessment", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Communication Strategies</CardTitle>
            <CardDescription>Communication during challenging behaviours</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document communication strategies during challenging behaviours and crisis situations..."
              value={behaviourData.communicationStrategies || ""}
              onChange={(e) => handleInputChange("communicationStrategies", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}