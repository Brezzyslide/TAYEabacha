import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { ChevronLeft, ChevronRight, Save, FileDown, CheckCircle } from "lucide-react";

// Import all section components
import { ClientLockSection } from "./sections/ClientLockSection";
import { AboutMeSection } from "./sections/AboutMeSection";
import { GoalsSection } from "./sections/GoalsSection";
import { ADLSection } from "./sections/ADLSection";
import { StructureSection } from "./sections/StructureSection";
import { CommunicationSection } from "./sections/CommunicationSection";
import { BehaviourSection } from "./sections/BehaviourSection";
import { DisasterSection } from "./sections/DisasterSection";
import { MealtimeSection } from "./sections/MealtimeSection";

interface ComprehensiveCarePlanWizardProps {
  open: boolean;
  onClose: () => void;
  existingPlan?: any;
}

interface CarePlanData {
  planTitle: string;
  clientId: number | null;
  clientData: any;
  aboutMeData: any;
  goalsData: any;
  adlData: any;
  structureData: any;
  communicationData: any;
  behaviourData: any;
  disasterData: any;
  mealtimeData: any;
}

const WIZARD_STEPS = [
  { id: 'client', title: 'Client Selection', component: ClientLockSection, description: 'Select and lock client information' },
  { id: 'aboutMe', title: 'About Me', component: AboutMeSection, description: 'Personal background and preferences' },
  { id: 'goals', title: 'Goals & Outcomes', component: GoalsSection, description: 'NDIS goals and personal objectives' },
  { id: 'adl', title: 'ADL Support', component: ADLSection, description: 'Activities of Daily Living assessment' },
  { id: 'structure', title: 'Structure & Routine', component: StructureSection, description: 'Daily schedules and routines' },
  { id: 'communication', title: 'Communication', component: CommunicationSection, description: 'Communication strategies and support' },
  { id: 'behaviour', title: 'Behaviour Support', component: BehaviourSection, description: 'Positive behaviour support strategies' },
  { id: 'disaster', title: 'Disaster Management', component: DisasterSection, description: 'Emergency and disaster preparedness' },
  { id: 'mealtime', title: 'Mealtime Management', component: MealtimeSection, description: 'Nutrition and mealtime risk assessment' },
  { id: 'review', title: 'Review & Export', component: null, description: 'Final review and export options' },
];

export function ComprehensiveCarePlanWizard({ open, onClose, existingPlan }: ComprehensiveCarePlanWizardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [planData, setPlanData] = useState<CarePlanData>({
    planTitle: '',
    clientId: null,
    clientData: null,
    aboutMeData: { bulletPoints: '', generatedText: '', aiAttempts: 0 },
    goalsData: { ndisGoals: '', generalGoals: '', generatedGoals: '', aiAttempts: 0 },
    adlData: { userInput: '', generatedContent: '', aiAttempts: 0 },
    structureData: { routines: [] },
    communicationData: { expressive: '', receptive: '', generatedStrategy: '', aiAttempts: 0 },
    behaviourData: { behaviours: [] },
    disasterData: { scenarios: {} },
    mealtimeData: { riskParameters: [], generatedPlan: '', aiAttempts: 0 },
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
    enabled: !!user && open,
  });

  // Auto-save mutation for drafts
  const autoSaveMutation = useMutation({
    mutationFn: async (data: CarePlanData) => {
      const response = await apiRequest('POST', `/api/care-support-plans/auto-save`, {
        ...data,
        status: 'draft',
        planTitle: data.planTitle || `Draft - ${new Date().toLocaleDateString()}`,
      });
      return await response.json();
    },
    onSuccess: (savedPlan) => {
      setLastSaveTime(new Date());
      // Silently update the plan ID if this is a new plan
      if (!existingPlan && savedPlan.id) {
        // Update URL or plan reference if needed
      }
    },
    onError: () => {
      // Silent fail for auto-save
    }
  });

  // Auto-save effect - saves every 10 seconds if there's content
  useEffect(() => {
    if (!autoSaveEnabled || !planData.clientId) return;
    
    const autoSaveInterval = setInterval(() => {
      const hasContent = planData.planTitle || 
                        planData.aboutMeData.bulletPoints || 
                        planData.goalsData.ndisGoals ||
                        planData.adlData.userInput ||
                        planData.communicationData.expressive;
      
      if (hasContent && !autoSaveMutation.isPending) {
        autoSaveMutation.mutate(planData);
      }
    }, 10000); // Auto-save every 10 seconds

    return () => clearInterval(autoSaveInterval);
  }, [planData, autoSaveEnabled, autoSaveMutation]);

  // Save on data change with debounce
  useEffect(() => {
    if (!planData.clientId) return;
    
    const saveTimeout = setTimeout(() => {
      const hasContent = planData.planTitle || 
                        planData.aboutMeData.bulletPoints || 
                        planData.goalsData.ndisGoals ||
                        planData.adlData.userInput ||
                        planData.communicationData.expressive;
      
      if (hasContent && autoSaveEnabled && !autoSaveMutation.isPending) {
        autoSaveMutation.mutate(planData);
      }
    }, 3000); // Save 3 seconds after changes

    return () => clearTimeout(saveTimeout);
  }, [planData]);

  // Load existing plan data if editing
  useEffect(() => {
    if (existingPlan && open) {
      setPlanData({
        planTitle: existingPlan.planTitle || '',
        clientId: existingPlan.clientId || null,
        clientData: clients.find(c => c.id === existingPlan.clientId) || null,
        aboutMeData: existingPlan.aboutMeData || { bulletPoints: '', generatedText: '', aiAttempts: 0 },
        goalsData: existingPlan.goalsData || { ndisGoals: '', generalGoals: '', generatedGoals: '', aiAttempts: 0 },
        adlData: existingPlan.adlData || { userInput: '', generatedContent: '', aiAttempts: 0 },
        structureData: existingPlan.structureData || { routines: [] },
        communicationData: existingPlan.communicationData || { expressive: '', receptive: '', generatedStrategy: '', aiAttempts: 0 },
        behaviourData: existingPlan.behaviourData || { behaviours: [] },
        disasterData: existingPlan.disasterData || { scenarios: {} },
        mealtimeData: existingPlan.mealtimeData || { riskParameters: [], generatedPlan: '', aiAttempts: 0 },
      });
    }
  }, [existingPlan, open, clients]);

  const savePlanMutation = useMutation({
    mutationFn: async (data: any) => {
      if (existingPlan) {
        return apiRequest("PUT", `/api/care-support-plans/${existingPlan.id}`, data);
      } else {
        return apiRequest("POST", "/api/care-support-plans", data);
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Care support plan ${existingPlan ? 'updated' : 'created'} successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/care-support-plans"] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save care support plan",
        variant: "destructive",
      });
    },
  });

  const handleNext = () => {
    // Mark current step as completed
    setCompletedSteps(prev => new Set([...prev, currentStep]));
    
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepClick = (stepIndex: number) => {
    // Allow navigation to any step after client selection
    if (stepIndex === 0 || planData.clientId) {
      setCurrentStep(stepIndex);
    }
  };

  const handleSave = () => {
    if (!planData.clientId) {
      toast({
        title: "Error",
        description: "Please select a client before saving",
        variant: "destructive",
      });
      return;
    }

    const saveData = {
      planTitle: planData.planTitle || `Care Plan for ${planData.clientData?.fullName || 'Client'}`,
      clientId: planData.clientId,
      status: "draft",
      ...planData,
    };

    savePlanMutation.mutate(saveData);
  };

  const handleFinalize = () => {
    if (!planData.clientId) {
      toast({
        title: "Error",
        description: "Please select a client before finalizing",
        variant: "destructive",
      });
      return;
    }

    const saveData = {
      planTitle: planData.planTitle || `Care Plan for ${planData.clientData?.fullName || 'Client'}`,
      clientId: planData.clientId,
      status: "active",
      ...planData,
    };

    savePlanMutation.mutate(saveData);
  };

  const handleExportPDF = () => {
    toast({
      title: "PDF Export",
      description: "PDF export functionality will be implemented next",
    });
  };

  const updatePlanData = (section: string, data: any) => {
    setPlanData(prev => ({
      ...prev,
      [section]: data,
    }));
  };

  const progress = ((completedSteps.size) / WIZARD_STEPS.length) * 100;
  const currentStepInfo = WIZARD_STEPS[currentStep];
  const CurrentStepComponent = currentStepInfo.component;

  const isStepComplete = (stepIndex: number) => completedSteps.has(stepIndex);
  const canNavigateToStep = (stepIndex: number) => stepIndex === 0 || planData.clientId;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div>
              <span>
                {existingPlan ? 'Edit' : 'Create'} NDIS Care Support Plan
                {planData.clientData && ` - ${planData.clientData.fullName}`}
              </span>
              {lastSaveTime && (
                <div className="mt-1 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Auto-saved at {lastSaveTime.toLocaleTimeString()}
                </div>
              )}
              {autoSaveMutation.isPending && (
                <div className="mt-1 text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  Saving draft...
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSave} disabled={savePlanMutation.isPending}>
                <Save className="h-4 w-4 mr-1" />
                Save Draft
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF}>
                <FileDown className="h-4 w-4 mr-1" />
                Export PDF
              </Button>
            </div>
          </DialogTitle>
          <DialogDescription>
            Complete all sections to create a comprehensive NDIS-compliant care support plan with AI assistance
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>Step {currentStep + 1} of {WIZARD_STEPS.length}</span>
              <span>{completedSteps.size} of {WIZARD_STEPS.length} sections completed</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Step Navigation */}
          <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
            {WIZARD_STEPS.map((step, index) => (
              <Button
                key={step.id}
                variant={
                  index === currentStep 
                    ? "default" 
                    : isStepComplete(index) 
                      ? "secondary" 
                      : canNavigateToStep(index) 
                        ? "ghost" 
                        : "ghost"
                }
                size="sm"
                onClick={() => handleStepClick(index)}
                disabled={!canNavigateToStep(index)}
                className={`whitespace-nowrap text-xs min-w-fit px-3 ${
                  !canNavigateToStep(index) ? 'opacity-50 cursor-not-allowed' : ''
                } ${isStepComplete(index) ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : ''}`}
              >
                {isStepComplete(index) && <CheckCircle className="h-3 w-3 mr-1" />}
                {index + 1}. {step.title}
              </Button>
            ))}
          </div>

          {/* Current Step Content */}
          <Card className="flex-1 min-h-0">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {isStepComplete(currentStep) && <CheckCircle className="h-5 w-5 text-green-600" />}
                    {currentStepInfo.title}
                  </div>
                  <p className="text-sm text-muted-foreground font-normal mt-1">
                    {currentStepInfo.description}
                  </p>
                </div>
                {currentStep === WIZARD_STEPS.length - 1 && (
                  <Button onClick={handleFinalize} disabled={savePlanMutation.isPending} className="ml-4">
                    Finalize Plan
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-y-auto max-h-[55vh]">
              {CurrentStepComponent ? (
                (() => {
                  // Special handling for ClientLockSection (first step)
                  if (currentStep === 0) {
                    return <CurrentStepComponent
                      data={planData}
                      updateData={(field: string, value: any) => {
                        setPlanData(prev => ({
                          ...prev,
                          [field]: value
                        }));
                      }}
                      clients={clients}
                    />;
                  }
                  
                  // Handle other sections normally
                  const sectionDataKey = currentStepInfo.id + 'Data';
                  const sectionData = planData[sectionDataKey as keyof CarePlanData] || {};
                  
                  const commonProps = {
                    data: sectionData,
                    onChange: (data: any) => updatePlanData(sectionDataKey, data),
                    selectedClient: planData.clientData,
                    planData: planData,
                    clients: clients,
                    updateData: updatePlanData
                  };

                  return <CurrentStepComponent {...commonProps} />;
                })()
              ) : (
                // Review Step
                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold mb-2">Care Support Plan Summary</h3>
                    <p className="text-muted-foreground">
                      Review all sections and finalize your comprehensive care support plan
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {WIZARD_STEPS.slice(0, -1).map((step, index) => (
                      <Card key={step.id} className={`p-4 cursor-pointer hover:bg-muted/50 ${
                        isStepComplete(index) ? 'border-green-500' : 'border-orange-300'
                      }`} onClick={() => setCurrentStep(index)}>
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{step.title}</h4>
                            <p className="text-sm text-muted-foreground">{step.description}</p>
                          </div>
                          {isStepComplete(index) ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-orange-300" />
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                  
                  <div className="text-center pt-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      {completedSteps.size} of {WIZARD_STEPS.length - 1} sections completed
                    </p>
                    <div className="flex gap-4 justify-center">
                      <Button variant="outline" onClick={handleExportPDF}>
                        <FileDown className="h-4 w-4 mr-2" />
                        Export as PDF
                      </Button>
                      <Button onClick={handleFinalize} disabled={savePlanMutation.isPending}>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Finalize Care Plan
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-4">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              {currentStep < WIZARD_STEPS.length - 1 ? (
                <Button onClick={handleNext}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleFinalize} disabled={savePlanMutation.isPending}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Complete Plan
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}