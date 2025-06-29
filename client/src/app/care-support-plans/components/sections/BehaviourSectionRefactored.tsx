import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Sparkles, Loader2, CheckCircle2, Brain, Shield, Heart, AlertTriangle, Target, Zap, Users, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useCarePlan } from "../../contexts/CarePlanContext";

interface SavedBehaviour {
  id: string;
  name: string;
  description: string;
  triggers: string;
  proactiveStrategy: string;
  reactiveStrategy: string;
  protectiveStrategy: string;
}

export function BehaviourSectionRefactored() {
  const { planData, updateField } = useCarePlan();
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

  // Current behaviour being built
  const [currentBehaviour, setCurrentBehaviour] = useState({
    name: '',
    description: '',
    triggers: '',
    proactiveStrategy: '',
    reactiveStrategy: '',
    protectiveStrategy: ''
  });

  // AI states
  const [isGeneratingBehaviour, setIsGeneratingBehaviour] = useState(false);
  const [isGeneratingDeescalation, setIsGeneratingDeescalation] = useState(false);
  const [isGeneratingPBS, setIsGeneratingPBS] = useState(false);
  const [behaviourAIContent, setBehaviourAIContent] = useState('');
  
  // View details state
  const [viewingBehaviour, setViewingBehaviour] = useState<SavedBehaviour | null>(null);

  // Individual Behaviour AI Generation
  const generateBehaviourContentMutation = useMutation({
    mutationFn: async ({ description, triggers }: { description: string; triggers: string }) => {
      setIsGeneratingBehaviour(true);

      const response = await apiRequest("POST", "/api/care-support-plans/generate-ai", {
        section: "behaviour",
        userInput: `Behaviour: ${description}\nTriggers: ${triggers}`,
        targetField: "behaviour_strategies",
        planId: planId,
        existingContent: {
          description,
          triggers
        },
        promptOverride: `Based on the client's specific diagnosis and the behaviour described (${description}) with triggers (${triggers}), generate three detailed staff instruction paragraphs. Use the diagnosis to inform evidence-based strategies specific to their condition.

PROACTIVE STRATEGIES: Write a detailed paragraph about preventing this behaviour based on their diagnosis. Include specific early warning signs related to their condition, evidence-based environmental modifications, targeted preventative interventions that work for their diagnosis, and routine adjustments that support their specific needs.

REACTIVE STRATEGIES: Write a detailed paragraph about immediate response during the behaviour, considering their diagnosis. Include specific response protocols that work for their condition, safety considerations relevant to their diagnosis, evidence-based communication approaches for their specific needs, and de-escalation steps that are effective for their condition.

PROTECTIVE STRATEGIES: Write a detailed paragraph about post-behaviour procedures based on their diagnosis. Include specific safety assessment procedures relevant to their condition, recovery support methods that work for their diagnosis, documentation requirements, and follow-up actions that address their specific needs.

Format as three clear paragraphs of flowing text. Each paragraph should be 150-250 words and directly reference their diagnosis and condition-specific strategies.`
      });

      return await response.json();
    },
    onSuccess: (responseData) => {
      setBehaviourAIContent(responseData.generatedContent || responseData.content || "");
      setIsGeneratingBehaviour(false);
      toast({
        title: "AI Content Generated",
        description: "Staff instructions for behaviour management strategies generated successfully",
      });
    },
    onError: (error: any) => {
      setIsGeneratingBehaviour(false);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate behaviour strategies",
        variant: "destructive",
      });
    },
  });

  // De-escalation Techniques AI Generation
  const generateDeescalationMutation = useMutation({
    mutationFn: async () => {
      setIsGeneratingDeescalation(true);

      const allBehaviours = behaviourData.behaviours || [];
      const behavioursList = allBehaviours.map((b: any) => 
        `Behaviour: ${b.description}\nTriggers: ${b.triggers}`
      ).join('\n\n');

      const response = await apiRequest("POST", "/api/care-support-plans/generate-ai", {
        section: "behaviour",
        userInput: behavioursList,
        targetField: "deescalation_techniques",
        existingContent: {
          behaviours: allBehaviours
        },
        promptOverride: `Based on all the behaviours listed above, generate comprehensive de-escalation techniques that staff can use across all these behaviours. Write as flowing paragraphs without asterisks, bullet points, or headers.

Write about universal de-escalation principles, communication techniques, environmental modifications, timing and approach strategies, safety protocols, and crisis intervention steps. Focus on techniques that work across multiple behaviours and provide clear guidance for staff. Keep under 200 words total as flowing text without formatting.`
      });

      return await response.json();
    },
    onSuccess: (responseData) => {
      updateField('behaviourData', 'deEscalationTechniques', responseData.generatedContent || "");
      setIsGeneratingDeescalation(false);
      toast({
        title: "De-escalation Techniques Generated",
        description: "Universal de-escalation techniques generated successfully",
      });
    },
    onError: (error: any) => {
      setIsGeneratingDeescalation(false);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate de-escalation techniques",
        variant: "destructive",
      });
    },
  });

  // PBS Tips AI Generation
  const generatePBSMutation = useMutation({
    mutationFn: async () => {
      setIsGeneratingPBS(true);

      const allBehaviours = behaviourData.behaviours || [];
      const behavioursList = allBehaviours.map((b: any) => 
        `Behaviour: ${b.name || b.description}\nDescription: ${b.description}\nTriggers: ${b.triggers}`
      ).join('\n\n');

      const response = await apiRequest("POST", "/api/care-support-plans/generate-ai", {
        section: "behaviour",
        userInput: behavioursList,
        targetField: "pbs_tips",
        existingContent: {
          behaviours: allBehaviours
        },
        promptOverride: `Based on all the behaviours listed above, generate Positive Behaviour Support (PBS) tips that promote positive behaviours and prevent challenging ones. Write as flowing paragraphs without asterisks, bullet points, or headers.

Write about positive reinforcement strategies, environmental design for success, skill building opportunities, replacement behaviour teaching, proactive support systems, and quality of life improvements. Focus on evidence-based PBS principles that support the person's dignity and autonomy while reducing challenging behaviours. Keep under 200 words total as flowing text without formatting.`
      });

      return await response.json();
    },
    onSuccess: (responseData) => {
      updateField('behaviourData', 'positiveBehaviourSupport', responseData.generatedContent || "");
      setIsGeneratingPBS(false);
      toast({
        title: "PBS Tips Generated",
        description: "Positive Behaviour Support tips generated successfully",
      });
    },
    onError: (error: any) => {
      setIsGeneratingPBS(false);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate PBS tips",
        variant: "destructive",
      });
    },
  });

  const handleBehaviourInputChange = (field: string, value: string) => {
    setCurrentBehaviour(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleGenerateBehaviourStrategies = () => {
    if (!currentBehaviour.description.trim() || !currentBehaviour.triggers.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter both behaviour description and triggers first.",
        variant: "destructive",
      });
      return;
    }

    generateBehaviourContentMutation.mutate({
      description: currentBehaviour.description,
      triggers: currentBehaviour.triggers
    });
  };

  const populateStrategy = (strategyType: 'proactiveStrategy' | 'reactiveStrategy' | 'protectiveStrategy') => {
    if (!behaviourAIContent) {
      toast({
        title: "No AI Content",
        description: "Please generate AI content first.",
        variant: "destructive",
      });
      return;
    }

    // Extract the relevant strategy from AI content
    const strategyMap = {
      proactiveStrategy: 'PROACTIVE STRATEGIES',
      reactiveStrategy: 'REACTIVE STRATEGIES', 
      protectiveStrategy: 'PROTECTIVE STRATEGIES'
    };

    const sectionName = strategyMap[strategyType];
    const content = extractStrategyFromAI(behaviourAIContent, sectionName);

    setCurrentBehaviour(prev => ({
      ...prev,
      [strategyType]: content
    }));

    toast({
      title: "Strategy Populated",
      description: `${sectionName.toLowerCase()} has been populated from AI content`,
    });
  };

  const extractStrategyFromAI = (content: string, sectionName: string): string => {
    const sections = content.split(/(?=PROACTIVE STRATEGIES|REACTIVE STRATEGIES|PROTECTIVE STRATEGIES)/);
    const targetSection = sections.find(section => section.includes(sectionName));
    
    if (targetSection) {
      return targetSection.replace(sectionName, '').replace(/:/g, '').trim();
    }
    
    return content.substring(0, 200) + '...'; // Fallback
  };

  const addBehaviour = () => {
    if (!currentBehaviour.description.trim() || !currentBehaviour.triggers.trim()) {
      toast({
        title: "Required Fields Missing",
        description: "Please enter behaviour description and triggers.",
        variant: "destructive",
      });
      return;
    }

    const newBehaviour: SavedBehaviour = {
      id: Date.now().toString(),
      name: currentBehaviour.name,
      description: currentBehaviour.description,
      triggers: currentBehaviour.triggers,
      proactiveStrategy: currentBehaviour.proactiveStrategy,
      reactiveStrategy: currentBehaviour.reactiveStrategy,
      protectiveStrategy: currentBehaviour.protectiveStrategy
    };

    const updatedBehaviours = [...(behaviourData.behaviours || []), newBehaviour];
    updateField('behaviourData', 'behaviours', updatedBehaviours);

    // Reset form
    setCurrentBehaviour({
      name: '',
      description: '',
      triggers: '',
      proactiveStrategy: '',
      reactiveStrategy: '',
      protectiveStrategy: ''
    });
    setBehaviourAIContent('');

    toast({
      title: "Behaviour Added",
      description: "Behaviour has been saved. You can now add another behaviour or generate de-escalation techniques.",
    });
  };

  const removeBehaviour = (behaviourId: string) => {
    const updatedBehaviours = (behaviourData.behaviours || []).filter((b: any) => b.id !== behaviourId);
    updateField('behaviourData', 'behaviours', updatedBehaviours);

    toast({
      title: "Behaviour Removed",
      description: "Behaviour has been deleted from the plan.",
    });
  };

  const handleGenerateDeescalation = () => {
    if (!behaviourData.behaviours || behaviourData.behaviours.length === 0) {
      toast({
        title: "No Behaviours Found",
        description: "Please add behaviours first before generating de-escalation techniques.",
        variant: "destructive",
      });
      return;
    }

    generateDeescalationMutation.mutate();
  };

  const handleGeneratePBS = () => {
    if (!behaviourData.behaviours || behaviourData.behaviours.length === 0) {
      toast({
        title: "No Behaviours Found",
        description: "Please add behaviours first before generating PBS tips.",
        variant: "destructive",
      });
      return;
    }

    generatePBSMutation.mutate();
  };

  return (
    <div className="space-y-6">
      {/* Individual Behaviour Builder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            Individual Behaviour Builder
          </CardTitle>
          <CardDescription>
            Build each behaviour individually with AI-generated staff management strategies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Behaviour Name */}
          <div>
            <Label htmlFor="behaviour-name">Behaviour Name</Label>
            <Input
              id="behaviour-name"
              placeholder="Give this behaviour a clear name (e.g., Verbal Outbursts, Physical Aggression, Social Withdrawal)..."
              value={currentBehaviour.name}
              onChange={(e) => handleBehaviourInputChange('name', e.target.value)}
            />
          </div>

          {/* Behaviour Description */}
          <div>
            <Label htmlFor="behaviour-description">Behaviour Description</Label>
            <Textarea
              id="behaviour-description"
              placeholder="Describe the specific behaviour (e.g., verbal outbursts, physical aggression, withdrawal)..."
              value={currentBehaviour.description}
              onChange={(e) => handleBehaviourInputChange('description', e.target.value)}
              rows={2}
            />
          </div>

          {/* Triggers */}
          <div>
            <Label htmlFor="behaviour-triggers">Triggers</Label>
            <Textarea
              id="behaviour-triggers"
              placeholder="Describe what triggers this behaviour (e.g., loud noises, changes in routine, specific requests)..."
              value={currentBehaviour.triggers}
              onChange={(e) => handleBehaviourInputChange('triggers', e.target.value)}
              rows={2}
            />
          </div>

          {/* AI Generation Button */}
          <Button 
            onClick={handleGenerateBehaviourStrategies}
            disabled={isGeneratingBehaviour || !currentBehaviour.description.trim() || !currentBehaviour.triggers.trim()}
            className="w-full"
          >
            {isGeneratingBehaviour ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Staff Instructions...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Staff Instructions for This Behaviour
              </>
            )}
          </Button>

          {/* AI Preview and Populate Buttons */}
          {behaviourAIContent && (
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                AI Generated Staff Instructions
              </h4>
              <div className="text-sm mb-4 max-h-32 overflow-y-auto bg-white dark:bg-gray-900 p-3 rounded border">
                {behaviourAIContent}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => populateStrategy('proactiveStrategy')}
                >
                  <Target className="h-3 w-3 mr-1" />
                  Populate Proactive
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => populateStrategy('reactiveStrategy')}
                >
                  <Zap className="h-3 w-3 mr-1" />
                  Populate Reactive
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => populateStrategy('protectiveStrategy')}
                >
                  <Shield className="h-3 w-3 mr-1" />
                  Populate Protective
                </Button>
              </div>
            </div>
          )}

          {/* Strategy Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="proactive-strategy">Proactive Strategy</Label>
              <Textarea
                id="proactive-strategy"
                placeholder="Preventative measures and early interventions..."
                value={currentBehaviour.proactiveStrategy}
                onChange={(e) => handleBehaviourInputChange('proactiveStrategy', e.target.value)}
                rows={3}
                className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
              />
            </div>
            <div>
              <Label htmlFor="reactive-strategy">Reactive Strategy</Label>
              <Textarea
                id="reactive-strategy"
                placeholder="Immediate response during the behaviour..."
                value={currentBehaviour.reactiveStrategy}
                onChange={(e) => handleBehaviourInputChange('reactiveStrategy', e.target.value)}
                rows={3}
                className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800"
              />
            </div>
            <div>
              <Label htmlFor="protective-strategy">Protective Strategy</Label>
              <Textarea
                id="protective-strategy"
                placeholder="Safety and recovery procedures after the behaviour..."
                value={currentBehaviour.protectiveStrategy}
                onChange={(e) => handleBehaviourInputChange('protectiveStrategy', e.target.value)}
                rows={3}
                className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
              />
            </div>
          </div>

          {/* Add Behaviour Button */}
          <Button 
            onClick={addBehaviour}
            className="w-full"
            variant="secondary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Behaviour to Plan
          </Button>
        </CardContent>
      </Card>

      {/* Saved Behaviours Table */}
      {behaviourData.behaviours && behaviourData.behaviours.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Saved Behaviours ({behaviourData.behaviours.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Triggers</TableHead>
                  <TableHead>Strategies</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {behaviourData.behaviours.map((behaviour: any) => (
                  <TableRow key={behaviour.id}>
                    <TableCell className="max-w-[150px]">
                      <div className="truncate font-medium" title={behaviour.name}>
                        {behaviour.name || 'Unnamed Behaviour'}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="truncate" title={behaviour.description}>
                        {behaviour.description}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="truncate" title={behaviour.triggers}>
                        {behaviour.triggers}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {behaviour.proactiveStrategy && <Badge variant="outline" className="text-xs">Proactive</Badge>}
                        {behaviour.reactiveStrategy && <Badge variant="outline" className="text-xs">Reactive</Badge>}
                        {behaviour.protectiveStrategy && <Badge variant="outline" className="text-xs">Protective</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="View full strategy details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <Brain className="h-5 w-5" />
                                {behaviour.name || 'Behaviour'} - Strategy Details
                              </DialogTitle>
                              <DialogDescription>
                                Complete behaviour management strategies (included in exports)
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label className="text-sm font-medium">Description</Label>
                                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{behaviour.description}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium">Triggers</Label>
                                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{behaviour.triggers}</p>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <Label className="text-sm font-medium flex items-center gap-1">
                                    <Target className="h-4 w-4 text-green-600" />
                                    Proactive Strategy
                                  </Label>
                                  <div className="text-sm text-gray-700 dark:text-gray-300 mt-1 p-2 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-800 rounded">
                                    {behaviour.proactiveStrategy || 'Not specified'}
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-sm font-medium flex items-center gap-1">
                                    <Zap className="h-4 w-4 text-yellow-600" />
                                    Reactive Strategy
                                  </Label>
                                  <div className="text-sm text-gray-700 dark:text-gray-300 mt-1 p-2 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-800 rounded">
                                    {behaviour.reactiveStrategy || 'Not specified'}
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-sm font-medium flex items-center gap-1">
                                    <Shield className="h-4 w-4 text-red-600" />
                                    Protective Strategy
                                  </Label>
                                  <div className="text-sm text-gray-700 dark:text-gray-300 mt-1 p-2 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-800 rounded">
                                    {behaviour.protectiveStrategy || 'Not specified'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeBehaviour(behaviour.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Global AI Centre - De-escalation & PBS Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-orange-600" />
            Global AI Centre - De-escalation & PBS Tips
          </CardTitle>
          <CardDescription>
            Generate universal techniques and PBS tips based on all behaviours above
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="font-medium text-amber-800 dark:text-amber-200">Requirements</span>
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Add behaviours above first, then generate comprehensive techniques and PBS tips that work across all behaviours.
            </p>
          </div>

          {/* AI Generation Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button 
              onClick={handleGenerateDeescalation}
              disabled={isGeneratingDeescalation || !behaviourData.behaviours || behaviourData.behaviours.length === 0}
              className="w-full"
            >
              {isGeneratingDeescalation ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating De-escalation...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate De-escalation Techniques
                </>
              )}
            </Button>

            <Button 
              onClick={handleGeneratePBS}
              disabled={isGeneratingPBS || !behaviourData.behaviours || behaviourData.behaviours.length === 0}
              className="w-full"
              variant="secondary"
            >
              {isGeneratingPBS ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating PBS Tips...
                </>
              ) : (
                <>
                  <Heart className="h-4 w-4 mr-2" />
                  Generate PBS Tips
                </>
              )}
            </Button>
          </div>

          {/* Output Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="deescalation-techniques">De-escalation Techniques</Label>
              <Textarea
                id="deescalation-techniques"
                placeholder="Universal de-escalation techniques will appear here after generation..."
                value={behaviourData.deEscalationTechniques || ""}
                onChange={(e) => updateField('behaviourData', 'deEscalationTechniques', e.target.value)}
                rows={6}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="pbs-tips">PBS Tips</Label>
              <Textarea
                id="pbs-tips"
                placeholder="Positive Behaviour Support tips will appear here after generation..."
                value={behaviourData.positiveBehaviourSupport || ""}
                onChange={(e) => updateField('behaviourData', 'positiveBehaviourSupport', e.target.value)}
                rows={6}
                className="mt-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}