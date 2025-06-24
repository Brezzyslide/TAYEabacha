import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { ChevronLeft, ChevronRight, Save, FileDown } from "lucide-react";

// Import section components
import { ClientLockSection } from "./sections/ClientLockSection";
import { AboutMeSection } from "./sections/AboutMeSection";
import { GoalsSection } from "./sections/GoalsSection";
import { ADLSection } from "./sections/ADLSection";
import { StructureSection } from "./sections/StructureSection";
import { CommunicationSection } from "./sections/CommunicationSection";
import { BehaviourSection } from "./sections/BehaviourSection";
import { DisasterSection } from "./sections/DisasterSection";
import { MealtimeSection } from "./sections/MealtimeSection";

interface CarePlanWizardProps {
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
  { id: 'client', title: 'Select Client', component: ClientLockSection },
  { id: 'about', title: 'About Me', component: AboutMeSection },
  { id: 'goals', title: 'NDIS Goals', component: GoalsSection },
  { id: 'adl', title: 'ADL Assessment', component: ADLSection },
  { id: 'structure', title: 'Structure & Routine', component: StructureSection },
  { id: 'communication', title: 'Communication', component: CommunicationSection },
  { id: 'behaviour', title: 'Behaviour Support', component: BehaviourSection },
  { id: 'disaster', title: 'Disaster Management', component: DisasterSection },
  { id: 'mealtime', title: 'Mealtime Risk', component: MealtimeSection },
];

export function CarePlanWizard({ open, onClose, existingPlan }: CarePlanWizardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [currentStep, setCurrentStep] = useState(0);
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
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
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

  const handleExportPDF = () => {
    // TODO: Implement PDF export functionality
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

  const progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100;
  const CurrentStepComponent = WIZARD_STEPS[currentStep].component;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[98vw] max-w-[1400px] h-[96vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-4 lg:px-6 py-3 lg:py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <DialogTitle className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg lg:text-xl font-bold text-slate-900 truncate">
                {existingPlan ? 'Edit' : 'Create'} Care Support Plan
              </h2>
              {planData.clientData && (
                <p className="text-sm text-slate-600 mt-1">
                  {planData.clientData.fullName}
                </p>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={handleSave} disabled={savePlanMutation.isPending} className="text-xs lg:text-sm">
                <Save className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Save Draft</span>
                <span className="sm:hidden">Save</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF} className="text-xs lg:text-sm">
                <FileDown className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Export PDF</span>
                <span className="sm:hidden">Export</span>
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Progress Bar */}
          <div className="px-4 lg:px-6 py-3 bg-white border-b">
            <div className="flex justify-between text-xs lg:text-sm text-muted-foreground mb-2">
              <span>Step {currentStep + 1} of {WIZARD_STEPS.length}</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Step Navigation */}
          <div className="px-4 lg:px-6 py-2 bg-slate-50 border-b">
            <div className="flex gap-1 lg:gap-2 overflow-x-auto scrollbar-hide">
              {WIZARD_STEPS.map((step, index) => (
                <Button
                  key={step.id}
                  variant={index === currentStep ? "default" : index < currentStep ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setCurrentStep(index)}
                  className="whitespace-nowrap text-xs flex-shrink-0 min-w-fit px-2 lg:px-3"
                >
                  <span className="font-medium">{index + 1}</span>
                  <span className="hidden sm:inline ml-1">{step.title}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Current Step Content */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full p-4 lg:p-6 overflow-y-auto">
              <Card className="w-full bg-white shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg lg:text-xl">{WIZARD_STEPS[currentStep].title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CurrentStepComponent
                    data={planData}
                    updateData={updatePlanData}
                    clients={clients}
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="px-4 lg:px-6 py-3 lg:py-4 bg-white border-t">
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 0}
                className="text-sm"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Previous</span>
                <span className="sm:hidden">Prev</span>
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} className="text-sm">
                  Cancel
                </Button>
                {currentStep === WIZARD_STEPS.length - 1 ? (
                  <Button
                    onClick={handleSave}
                    disabled={!planData.clientId || savePlanMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white text-sm"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Complete Plan</span>
                    <span className="sm:hidden">Complete</span>
                  </Button>
                ) : (
                  <Button
                    onClick={handleNext}
                    className="text-sm"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <span className="sm:hidden">Next</span>
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}