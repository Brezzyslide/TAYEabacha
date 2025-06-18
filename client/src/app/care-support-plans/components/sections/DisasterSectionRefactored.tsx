import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Sparkles, Loader2, CheckCircle2, AlertTriangle, Flame, Waves, Home, Activity, Sun, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useCarePlan } from "../../contexts/CarePlanContext";

interface DisasterPlan {
  id: string;
  type: 'fire' | 'flood' | 'earthquake' | 'medical' | 'heatwave';
  preparation: string;
  evacuation: string;
  postEvent: string;
  clientNeeds: string;
}

const DISASTER_TYPES = [
  { value: 'fire', label: 'Fire/Bushfire', icon: Flame, color: 'text-red-600' },
  { value: 'flood', label: 'Flood', icon: Waves, color: 'text-blue-600' },
  { value: 'earthquake', label: 'Earthquake', icon: Home, color: 'text-orange-600' },
  { value: 'medical', label: 'Medical Emergency', icon: Activity, color: 'text-green-600' },
  { value: 'heatwave', label: 'Heatwave', icon: Sun, color: 'text-yellow-600' }
];

export function DisasterSectionRefactored() {
  const { planData, dispatch } = useCarePlan();
  const { toast } = useToast();
  
  const disasterData = planData?.disasterData || {
    userInput: '',
    disasterPlans: [],
    shelterArrangements: '',
    postDisasterSupport: '',
    evacuationPlanAudit: ''
  };

  const [currentDisaster, setCurrentDisaster] = useState<DisasterPlan>({
    id: '',
    type: 'fire',
    preparation: '',
    evacuation: '',
    postEvent: '',
    clientNeeds: ''
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingField, setGeneratingField] = useState<string>('');

  const handleInputChange = (field: string, value: string) => {
    dispatch({
      type: 'UPDATE_SECTION',
      section: 'disasterData',
      data: {
        ...disasterData,
        [field]: value
      }
    });
  };

  const handleDisasterInputChange = (field: string, value: string) => {
    setCurrentDisaster(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addDisasterPlan = () => {
    if (!currentDisaster.type || !currentDisaster.preparation) {
      toast({
        title: "Missing Information",
        description: "Please add some preparation details before saving the disaster plan.",
        variant: "destructive",
      });
      return;
    }

    const newPlan: DisasterPlan = {
      ...currentDisaster,
      id: Date.now().toString()
    };

    const updatedPlans = [...(disasterData.disasterPlans || []), newPlan];
    
    dispatch({
      type: 'UPDATE_SECTION',
      section: 'disasterData',
      data: {
        ...disasterData,
        disasterPlans: updatedPlans
      }
    });
    
    setCurrentDisaster({
      id: '',
      type: 'fire',
      preparation: '',
      evacuation: '',
      postEvent: '',
      clientNeeds: ''
    });

    const disasterLabel = DISASTER_TYPES.find(d => d.value === newPlan.type)?.label || newPlan.type;
    toast({
      title: "Disaster Plan Added",
      description: `${disasterLabel} plan has been saved`,
    });
  };

  const removeDisasterPlan = (planId: string) => {
    const updatedPlans = (disasterData.disasterPlans || []).filter((p: any) => p.id !== planId);
    
    dispatch({
      type: 'UPDATE_SECTION',
      section: 'disasterData',
      data: {
        ...disasterData,
        disasterPlans: updatedPlans
      }
    });

    toast({
      title: "Disaster Plan Removed",
      description: "Plan has been deleted.",
    });
  };

  // AI Content Generation for Disaster-Specific Fields
  const generateDisasterContentMutation = useMutation({
    mutationFn: async ({ disasterType, targetField }: { disasterType: string, targetField: string }) => {
      if (!disasterData.userInput?.trim()) {
        throw new Error("Please enter disaster management information first.");
      }

      setIsGenerating(true);
      setGeneratingField(targetField);
      
      const disasterLabel = DISASTER_TYPES.find(d => d.value === disasterType)?.label || disasterType;
      const userInput = disasterData.userInput;

      const existingPlans = disasterData.disasterPlans || [];
      const existingPlanContext = existingPlans.length > 0 
        ? `Existing disaster plans: ${existingPlans.map((p: any) => DISASTER_TYPES.find(d => d.value === p.type)?.label).join(', ')}`
        : "No existing disaster plans";

      const clientDiagnosis = planData?.clientData?.primaryDiagnosis || "Not specified";
      const diagnosisGuidance = clientDiagnosis !== "Not specified" 
        ? `\n\nIMPORTANT: Factor in the client's diagnosis (${clientDiagnosis}) when generating recommendations. Consider specific needs, vulnerabilities, medications, mobility requirements, communication challenges, and safety considerations related to this condition during ${disasterLabel.toLowerCase()} scenarios.`
        : "";

      const response = await apiRequest("POST", "/api/care-support-plans/generate-ai", {
        section: "disaster",
        userInput: `Client Info: ${userInput}\n\nDisaster Type: ${disasterLabel}\nTarget Field: ${targetField}\n\n${existingPlanContext}${diagnosisGuidance}`,
        clientName: planData?.clientData?.fullName || "Client",
        clientDiagnosis: clientDiagnosis,
        maxWords: 200,
        targetField: `${disasterType}_${targetField}`,
        existingContent: {}
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
        handleDisasterInputChange(targetField, generatedText);
        
        const fieldLabels: { [key: string]: string } = {
          preparation: "Preparation Phase",
          evacuation: "Evacuation Procedure", 
          postEvent: "Post-Event Action",
          clientNeeds: "Specific Client Needs"
        };
        
        toast({
          title: "AI Content Generated",
          description: `${fieldLabels[targetField]} content has been generated.`,
        });
      }
      
      setIsGenerating(false);
      setGeneratingField('');
    },
    onError: (error: any) => {
      setIsGenerating(false);
      setGeneratingField('');
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate content. Please try again.",
        variant: "destructive",
      });
    },
  });

  // AI Content Generation for Global Centre
  const generateGlobalContentMutation = useMutation({
    mutationFn: async ({ targetField }: { targetField: string }) => {
      if (!disasterData.userInput?.trim()) {
        throw new Error("Please enter disaster management information first.");
      }

      setIsGenerating(true);
      setGeneratingField(targetField);
      
      const userInput = disasterData.userInput;
      const existingPlans = disasterData.disasterPlans || [];
      const planContext = existingPlans.length > 0 
        ? `Current disaster plans: ${existingPlans.map((p: any) => `${DISASTER_TYPES.find(d => d.value === p.type)?.label} - ${p.preparation?.substring(0, 50)}...`).join('; ')}`
        : "No disaster plans created yet";

      const clientDiagnosis = planData?.clientData?.primaryDiagnosis || "Not specified";
      const diagnosisContext = clientDiagnosis !== "Not specified" 
        ? `\n\nDIAGNOSIS CONSIDERATIONS: Client has ${clientDiagnosis}. Generate recommendations that specifically address how this condition affects disaster management needs, including medication requirements, mobility limitations, communication challenges, sensory sensitivities, cognitive considerations, and specialized equipment or support staff requirements during emergencies.`
        : "";

      const response = await apiRequest("POST", "/api/care-support-plans/generate-ai", {
        section: "disaster",
        userInput: `${userInput}\n\n${planContext}${diagnosisContext}`,
        clientName: planData?.clientData?.fullName || "Client",
        clientDiagnosis: clientDiagnosis,
        maxWords: 200,
        targetField: `global_${targetField}`,
        existingContent: {}
      });
      return await response.json();
    },
    onSuccess: (responseData, { targetField }) => {
      const generatedText = responseData.generatedContent || "";
      handleInputChange(targetField, generatedText);
      
      const fieldLabels: { [key: string]: string } = {
        shelterArrangements: "Shelter Arrangements",
        postDisasterSupport: "Post-Disaster Support",
        evacuationPlanAudit: "Evacuation Plan Audit"
      };
      
      toast({
        title: "AI Content Generated",
        description: `${fieldLabels[targetField]} has been populated with global planning content.`,
      });
      
      setIsGenerating(false);
      setGeneratingField('');
    },
    onError: (error: any) => {
      setIsGenerating(false);
      setGeneratingField('');
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate content. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGenerateDisasterContent = (disasterType: string, targetField: string) => {
    generateDisasterContentMutation.mutate({ disasterType, targetField });
  };

  const handleGenerateGlobalContent = (targetField: string) => {
    generateGlobalContentMutation.mutate({ targetField });
  };

  return (
    <div className="space-y-8">
      {/* Client Assessment Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Disaster Management Assessment
          </CardTitle>
          <CardDescription>
            Describe the client's disaster management needs, mobility, medical requirements, and communication abilities
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="disasterInput">Client Disaster Management Information</Label>
            <Textarea
              id="disasterInput"
              placeholder="Enter details about the client's mobility needs, medical conditions, communication abilities, support requirements during emergencies..."
              value={disasterData.userInput || ""}
              onChange={(e) => handleInputChange("userInput", e.target.value)}
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Individual Disaster Builder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-green-600" />
            Individual Disaster Plan Builder
          </CardTitle>
          <CardDescription>
            Create specific plans for different disaster types with AI assistance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Disaster Type Selection */}
          <div>
            <Label htmlFor="disaster-type">Select Disaster Type</Label>
            <Select value={currentDisaster.type} onValueChange={(value: any) => handleDisasterInputChange('type', value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose disaster type" />
              </SelectTrigger>
              <SelectContent>
                {DISASTER_TYPES.map((disaster) => {
                  const IconComponent = disaster.icon;
                  return (
                    <SelectItem key={disaster.value} value={disaster.value}>
                      <div className="flex items-center gap-2">
                        <IconComponent className={`h-4 w-4 ${disaster.color}`} />
                        {disaster.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* AI Preview Section */}
          {disasterData.generatedContent && (
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-blue-900 dark:text-blue-100">AI Generated Content Preview:</h4>
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">{disasterData.generatedContent}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    handleDisasterInputChange('preparation', disasterData.generatedContent || '');
                    handleInputChange('generatedContent', '');
                    toast({ title: "Content Applied", description: "Content added to Preparation Phase" });
                  }}
                >
                  Add to Preparation
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    handleDisasterInputChange('evacuation', disasterData.generatedContent || '');
                    handleInputChange('generatedContent', '');
                    toast({ title: "Content Applied", description: "Content added to Evacuation" });
                  }}
                >
                  Add to Evacuation
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    handleDisasterInputChange('postEvent', disasterData.generatedContent || '');
                    handleInputChange('generatedContent', '');
                    toast({ title: "Content Applied", description: "Content added to Post-Event" });
                  }}
                >
                  Add to Post-Event
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    handleDisasterInputChange('clientNeeds', disasterData.generatedContent || '');
                    handleInputChange('generatedContent', '');
                    toast({ title: "Content Applied", description: "Content added to Client Needs" });
                  }}
                >
                  Add to Client Needs
                </Button>
              </div>
            </div>
          )}

          {/* General AI Generation */}
          <div className="flex gap-2">
            <Button 
              onClick={() => generateDisasterContentMutation.mutate({ disasterType: currentDisaster.type, targetField: 'preview' })}
              disabled={isGenerating || !disasterData.userInput?.trim()}
              className="flex-1"
            >
              {isGenerating && generatingField === 'preview' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating {DISASTER_TYPES.find(d => d.value === currentDisaster.type)?.label} Content...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate {DISASTER_TYPES.find(d => d.value === currentDisaster.type)?.label} Content
                </>
              )}
            </Button>
          </div>

          {/* Disaster-Specific Fields with AI Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="preparation">Preparation Phase</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateDisasterContent(currentDisaster.type, 'preparation')}
                  disabled={isGenerating || !disasterData.userInput?.trim()}
                >
                  {isGenerating && generatingField === 'preparation' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Textarea
                id="preparation"
                placeholder="Preparation steps before disaster occurs..."
                value={currentDisaster.preparation}
                onChange={(e) => handleDisasterInputChange('preparation', e.target.value)}
                rows={4}
                className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="evacuation">Evacuation Procedure</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateDisasterContent(currentDisaster.type, 'evacuation')}
                  disabled={isGenerating || !disasterData.userInput?.trim()}
                >
                  {isGenerating && generatingField === 'evacuation' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Textarea
                id="evacuation"
                placeholder="Evacuation steps and procedures..."
                value={currentDisaster.evacuation}
                onChange={(e) => handleDisasterInputChange('evacuation', e.target.value)}
                rows={4}
                className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="postEvent">Post-Event Action</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateDisasterContent(currentDisaster.type, 'postEvent')}
                  disabled={isGenerating || !disasterData.userInput?.trim()}
                >
                  {isGenerating && generatingField === 'postEvent' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Textarea
                id="postEvent"
                placeholder="Actions after the disaster event..."
                value={currentDisaster.postEvent}
                onChange={(e) => handleDisasterInputChange('postEvent', e.target.value)}
                rows={4}
                className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="clientNeeds">Specific Client Needs</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateDisasterContent(currentDisaster.type, 'clientNeeds')}
                  disabled={isGenerating || !disasterData.userInput?.trim()}
                >
                  {isGenerating && generatingField === 'clientNeeds' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Textarea
                id="clientNeeds"
                placeholder="Client-specific needs and considerations..."
                value={currentDisaster.clientNeeds}
                onChange={(e) => handleDisasterInputChange('clientNeeds', e.target.value)}
                rows={4}
                className="bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800"
              />
            </div>
          </div>

          <Button onClick={addDisasterPlan} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Disaster Plan
          </Button>
        </CardContent>
      </Card>

      {/* Saved Disaster Plans */}
      {disasterData.disasterPlans && disasterData.disasterPlans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Saved Disaster Plans ({disasterData.disasterPlans.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Disaster Type</TableHead>
                  <TableHead>Preparation</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disasterData.disasterPlans.map((plan: any) => {
                  const disasterType = DISASTER_TYPES.find(d => d.value === plan.type);
                  const IconComponent = disasterType?.icon || AlertTriangle;
                  return (
                    <TableRow key={plan.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <IconComponent className={`h-4 w-4 ${disasterType?.color || 'text-gray-600'}`} />
                          {disasterType?.label || plan.type}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{plan.preparation}</TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4 mr-1" />
                              View Details
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <IconComponent className={`h-5 w-5 ${disasterType?.color || 'text-gray-600'}`} />
                                {disasterType?.label || plan.type} Plan
                              </DialogTitle>
                              <DialogDescription>
                                Detailed disaster management plan for {disasterType?.label?.toLowerCase() || plan.type}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                              <div>
                                <Label className="text-sm font-medium">Preparation Phase</Label>
                                <div className="text-sm text-gray-700 dark:text-gray-300 mt-1 p-2 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded">
                                  {plan.preparation || 'Not specified'}
                                </div>
                              </div>
                              <div>
                                <Label className="text-sm font-medium">Evacuation Procedure</Label>
                                <div className="text-sm text-gray-700 dark:text-gray-300 mt-1 p-2 bg-orange-50 dark:bg-orange-900 border border-orange-200 dark:border-orange-800 rounded">
                                  {plan.evacuation || 'Not specified'}
                                </div>
                              </div>
                              <div>
                                <Label className="text-sm font-medium">Post-Event Action</Label>
                                <div className="text-sm text-gray-700 dark:text-gray-300 mt-1 p-2 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-800 rounded">
                                  {plan.postEvent || 'Not specified'}
                                </div>
                              </div>
                              <div>
                                <Label className="text-sm font-medium">Specific Client Needs</Label>
                                <div className="text-sm text-gray-700 dark:text-gray-300 mt-1 p-2 bg-purple-50 dark:bg-purple-900 border border-purple-200 dark:border-purple-800 rounded">
                                  {plan.clientNeeds || 'Not specified'}
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeDisasterPlan(plan.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Global AI Centre */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Global Disaster Management Centre
          </CardTitle>
          <CardDescription>
            AI-powered global planning tools based on all disaster plans
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Shelter Arrangements</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateGlobalContent('shelterArrangements')}
                  disabled={isGenerating || !disasterData.userInput?.trim()}
                >
                  {isGenerating && generatingField === 'shelterArrangements' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Textarea
                placeholder="Temporary housing and shelter coordination..."
                value={disasterData.shelterArrangements || ""}
                onChange={(e) => handleInputChange("shelterArrangements", e.target.value)}
                rows={6}
                className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Post-Disaster Support</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateGlobalContent('postDisasterSupport')}
                  disabled={isGenerating || !disasterData.userInput?.trim()}
                >
                  {isGenerating && generatingField === 'postDisasterSupport' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Textarea
                placeholder="Recovery support and follow-up care coordination..."
                value={disasterData.postDisasterSupport || ""}
                onChange={(e) => handleInputChange("postDisasterSupport", e.target.value)}
                rows={6}
                className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Evacuation Plan Audit</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateGlobalContent('evacuationPlanAudit')}
                  disabled={isGenerating || !disasterData.userInput?.trim()}
                >
                  {isGenerating && generatingField === 'evacuationPlanAudit' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Textarea
                placeholder="Comprehensive evacuation plan review and recommendations..."
                value={disasterData.evacuationPlanAudit || ""}
                onChange={(e) => handleInputChange("evacuationPlanAudit", e.target.value)}
                rows={6}
                className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}