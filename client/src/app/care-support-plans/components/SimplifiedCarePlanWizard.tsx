import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { ChevronLeft, ChevronRight, Save, FileDown } from "lucide-react";

// Import existing working section components
import { ClientLockSection } from "./sections/ClientLockSection";
import { StructureSection } from "./sections/StructureSection";
import { ADLSection } from "./sections/ADLSection";

interface CarePlanWizardProps {
  open: boolean;
  onClose: () => void;
  existingPlan?: any;
}

interface CarePlanData {
  planTitle: string;
  clientId: number | null;
  clientData: any;
  structureData: any;
  adlData: any;
  // Simplified for now - will expand to all 10 sections
}

const WIZARD_STEPS = [
  { id: 'client', title: 'Select Client', component: ClientLockSection },
  { id: 'structure', title: 'Structure & Routine', component: StructureSection },
  { id: 'adl', title: 'ADL Assessment', component: ADLSection },
];

export function SimplifiedCarePlanWizard({ open, onClose, existingPlan }: CarePlanWizardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [planData, setPlanData] = useState<CarePlanData>({
    planTitle: '',
    clientId: null,
    clientData: null,
    structureData: { routines: [] },
    adlData: { userInput: '', generatedContent: '', aiAttempts: 0 },
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
        structureData: existingPlan.structureData || { routines: [] },
        adlData: existingPlan.adlData || { userInput: '', generatedContent: '', aiAttempts: 0 },
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
      structureData: planData.structureData,
      adlData: planData.adlData,
      // Default empty values for other sections
      aboutMeData: { bulletPoints: '', generatedText: '', aiAttempts: 0 },
      goalsData: { ndisGoals: '', generalGoals: '', generatedGoals: '', aiAttempts: 0 },
      communicationData: { expressive: '', receptive: '', generatedStrategy: '', aiAttempts: 0 },
      behaviourData: { behaviours: [] },
      disasterData: { scenarios: {} },
      mealtimeData: { riskParameters: [], generatedPlan: '', aiAttempts: 0 },
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

  const progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100;
  const CurrentStepComponent = WIZARD_STEPS[currentStep].component;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>
              {existingPlan ? 'Edit' : 'Create'} Care Support Plan
              {planData.clientData && ` - ${planData.clientData.fullName}`}
            </span>
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
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>Step {currentStep + 1} of {WIZARD_STEPS.length}</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Step Navigation */}
          <div className="flex gap-2 mb-4 overflow-x-auto">
            {WIZARD_STEPS.map((step, index) => (
              <Button
                key={step.id}
                variant={index === currentStep ? "default" : index < currentStep ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setCurrentStep(index)}
                className="whitespace-nowrap text-xs"
              >
                {index + 1}. {step.title}
              </Button>
            ))}
          </div>

          {/* Current Step Content */}
          <Card className="flex-1 min-h-0">
            <CardHeader>
              <CardTitle>{WIZARD_STEPS[currentStep].title}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-y-auto max-h-[50vh]">
              <CurrentStepComponent
                data={planData}
                updateData={updatePlanData}
                clients={clients}
              />
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
              <Button
                onClick={handleNext}
                disabled={currentStep === WIZARD_STEPS.length - 1}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}