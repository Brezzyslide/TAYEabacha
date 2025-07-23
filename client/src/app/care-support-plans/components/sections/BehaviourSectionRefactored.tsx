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
  const { planData, updateField, state, clientData, selectedClient } = useCarePlan();
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
  
  // View details state
  const [viewingBehaviour, setViewingBehaviour] = useState<SavedBehaviour | null>(null);

  // Field-Specific Strategy AI Generation
  const generateSpecificStrategyMutation = useMutation({
    mutationFn: async (strategyType: 'proactive' | 'reactive' | 'protective') => {
      setIsGeneratingBehaviour(true);

      const strategyPrompts = {
        proactive: `Based on the client's specific diagnosis and the behaviour described (${currentBehaviour.description}) with the triggers identified (${currentBehaviour.triggers}), generate detailed proactive/preventative strategies. Write evidence-based strategies specific to their condition that focus on preventing this behaviour before it occurs. Include environmental modifications, routine adjustments, early warning signs, and targeted interventions that work for their diagnosis. Write as flowing paragraphs without headers or bullet points, 150-200 words.`,
        reactive: `Based on the client's specific diagnosis and the behaviour described (${currentBehaviour.description}) with the triggers identified (${currentBehaviour.triggers}), generate detailed reactive/immediate response strategies. Write evidence-based strategies specific to their condition for responding during the behaviour. Include safety protocols, communication approaches, de-escalation techniques, and immediate interventions that work for their diagnosis. Write as flowing paragraphs without headers or bullet points, 150-200 words.`,
        protective: `Based on the client's specific diagnosis and the behaviour described (${currentBehaviour.description}) with the triggers identified (${currentBehaviour.triggers}), generate detailed protective/post-behaviour strategies. Write evidence-based strategies specific to their condition for actions after the behaviour occurs. Include safety assessments, recovery support, documentation requirements, and follow-up procedures that work for their diagnosis. Write as flowing paragraphs without headers or bullet points, 150-200 words.`
      };

      // Enhanced payload structure
      const payload = {
        section: "behaviour",
        userInput: `Behaviour: ${currentBehaviour.description}\nTriggers: ${currentBehaviour.triggers}\nExisting Strategy: ${currentBehaviour[`${strategyType}Strategy`] || 'None'}`,
        targetField: `${strategyType}_strategy`,
        planId: planData?.id || state?.id,
        clientName: clientData?.fullName || "Client",
        clientDiagnosis: planData?.aboutMeData?.diagnosis || clientData?.primaryDiagnosis || "Not specified",
        existingContent: {
          description: currentBehaviour.description,
          triggers: currentBehaviour.triggers,
          existingStrategy: currentBehaviour[`${strategyType}Strategy`] || ''
        },
        promptOverride: strategyPrompts[strategyType]
      };
      
      const response = await apiRequest("POST", "/api/care-support-plans/generate-ai", payload);
      return { strategyType, content: await response.json() };
    },
    onSuccess: ({ strategyType, content }) => {
      const generatedContent = content.generatedContent || content.content || "";
      const existingStrategy = currentBehaviour[`${strategyType}Strategy`];
      const combinedStrategy = existingStrategy ? 
        `${existingStrategy}\n\n${generatedContent}` : 
        generatedContent;
      
      setCurrentBehaviour(prev => ({
        ...prev,
        [`${strategyType}Strategy`]: combinedStrategy
      }));
      
      setIsGeneratingBehaviour(false);
      toast({
        title: "Strategy Generated",
        description: `${strategyType.charAt(0).toUpperCase() + strategyType.slice(1)} strategy content has been added to the field.`,
      });
    },
    onError: (error: any) => {
      setIsGeneratingBehaviour(false);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate strategy content",
        variant: "destructive",
      });
    },
  });

  // Handler function for field-specific generation
  const handleGenerateSpecificStrategy = (strategyType: 'proactive' | 'reactive' | 'protective') => {
    generateSpecificStrategyMutation.mutate(strategyType);
  };

  // De-escalation Techniques AI Generation
  const generateDeescalationMutation = useMutation({
    mutationFn: async () => {
      setIsGeneratingDeescalation(true);

      const allBehaviours = behaviourData.behaviours || [];
      const behavioursList = allBehaviours.map((b: any) => 
        `Behaviour: ${b.description}\nTriggers: ${b.triggers}`
      ).join('\n\n');

      // Enhanced payload structure
      const payload = {
        section: "behaviour",
        userInput: behavioursList,
        targetField: "deescalation_techniques",
        planId: planData?.id || state?.id,
        clientName:
          selectedClient?.fullName || planData?.clientName || clientData?.fullName || "Client",
        clientDiagnosis:
          planData?.aboutMeData?.diagnosis ||
          selectedClient?.primaryDiagnosis ||
          clientData?.primaryDiagnosis ||
          "Not specified",
        existingContent: {
          behaviours: allBehaviours
        },
        promptOverride: `Based on all the behaviours listed above, generate comprehensive de-escalation techniques that staff can use across all these behaviours. Write as flowing paragraphs without asterisks, bullet points, or headers.

Write about universal de-escalation principles, communication techniques, environmental modifications, timing and approach strategies, safety protocols, and crisis intervention steps. Focus on techniques that work across multiple behaviours and provide clear guidance for staff. Keep under 200 words total as flowing text without formatting.`
      };
      
      const response = await apiRequest("POST", "/api/care-support-plans/generate-ai", payload);

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

      // Enhanced payload structure
      const payload = {
        section: "behaviour",
        userInput: behavioursList,
        targetField: "pbs_tips",
        planId: planData?.id || state?.id,
        clientName:
          selectedClient?.fullName || planData?.clientName || clientData?.fullName || "Client",
        clientDiagnosis:
          planData?.aboutMeData?.diagnosis ||
          selectedClient?.primaryDiagnosis ||
          clientData?.primaryDiagnosis ||
          "Not specified",
        existingContent: {
          behaviours: allBehaviours
        },
        promptOverride: `Based on all the behaviours listed above, generate Positive Behaviour Support (PBS) tips that promote positive behaviours and prevent challenging ones. Write as flowing paragraphs without asterisks, bullet points, or headers.

Write about positive reinforcement strategies, environmental design for success, skill building opportunities, replacement behaviour teaching, proactive support systems, and quality of life improvements. Focus on evidence-based PBS principles that support the person's dignity and autonomy while reducing challenging behaviours. Keep under 200 words total as flowing text without formatting.`
      };
      
      const response = await apiRequest("POST", "/api/care-support-plans/generate-ai", payload);

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

          {/* Field-Specific AI Generation Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Button 
              onClick={() => handleGenerateSpecificStrategy('proactive')}
              disabled={isGeneratingBehaviour || !currentBehaviour.description.trim() || !currentBehaviour.triggers.trim()}
              variant="outline"
              size="sm"
            >
              {isGeneratingBehaviour ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Target className="h-4 w-4 mr-2 text-green-600" />
                  Add to Proactive Strategy
                </>
              )}
            </Button>
            
            <Button 
              onClick={() => handleGenerateSpecificStrategy('reactive')}
              disabled={isGeneratingBehaviour || !currentBehaviour.description.trim() || !currentBehaviour.triggers.trim()}
              variant="outline"
              size="sm"
            >
              {isGeneratingBehaviour ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2 text-yellow-600" />
                  Add to Reactive Strategy
                </>
              )}
            </Button>
            
            <Button 
              onClick={() => handleGenerateSpecificStrategy('protective')}
              disabled={isGeneratingBehaviour || !currentBehaviour.description.trim() || !currentBehaviour.triggers.trim()}
              variant="outline"
              size="sm"
            >
              {isGeneratingBehaviour ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2 text-red-600" />
                  Add to Protective Strategy
                </>
              )}
            </Button>
          </div>



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