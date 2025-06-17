import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { ChevronLeft, ChevronRight, Save, FileDown, CheckCircle } from "lucide-react";

// Import context and components
import { CarePlanProvider, useCarePlan } from "../contexts/CarePlanContext";
import { SaveStatusIndicator } from "./SaveStatusIndicator";
import { ClientLockSection } from "./sections/ClientLockSection";
import { AboutMeSectionRefactored } from "./sections/AboutMeSectionRefactored";
import { GoalsSection } from "./sections/GoalsSection";
import { ADLSection } from "./sections/ADLSection";
import { StructureSection } from "./sections/StructureSection";
import { CommunicationSection } from "./sections/CommunicationSection";
import { BehaviourSection } from "./sections/BehaviourSection";
import { DisasterSection } from "./sections/DisasterSection";
import { MealtimeSection } from "./sections/MealtimeSection";

interface ComprehensiveCarePlanWizardRefactoredProps {
  open: boolean;
  onClose: () => void;
  existingPlan?: any;
}

const WIZARD_STEPS = [
  { id: 'client', title: 'Client Selection', component: ClientLockSection, description: 'Select and lock client information' },
  { id: 'aboutMe', title: 'About Me', component: AboutMeSectionRefactored, description: 'Personal background and preferences' },
  { id: 'goals', title: 'Goals & Outcomes', component: GoalsSection, description: 'NDIS goals and personal objectives' },
  { id: 'adl', title: 'ADL Support', component: ADLSection, description: 'Activities of Daily Living assessment' },
  { id: 'structure', title: 'Structure & Routine', component: StructureSection, description: 'Daily schedules and routines' },
  { id: 'communication', title: 'Communication', component: CommunicationSection, description: 'Communication strategies and support' },
  { id: 'behaviour', title: 'Behaviour Support', component: BehaviourSection, description: 'Positive behaviour support strategies' },
  { id: 'disaster', title: 'Disaster Management', component: DisasterSection, description: 'Emergency and disaster preparedness' },
  { id: 'mealtime', title: 'Mealtime Management', component: MealtimeSection, description: 'Nutrition and mealtime risk assessment' },
  { id: 'review', title: 'Review & Export', component: null, description: 'Final review and export options' },
];

function WizardContent({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { planData, savePlan } = useCarePlan();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const handleNext = () => {
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
    setCurrentStep(stepIndex);
  };

  const handleSave = () => {
    savePlan();
    onClose();
  };

  const renderStepContent = () => {
    const currentStepData = WIZARD_STEPS[currentStep];
    
    if (currentStepData.id === 'review') {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Plan Review
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Plan Details</h4>
                <p><strong>Title:</strong> {planData.planTitle || 'Untitled Plan'}</p>
                <p><strong>Client:</strong> {planData.clientData?.fullName || 'No client selected'}</p>
                <p><strong>Status:</strong> {planData.status}</p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Completion Status</h4>
                <p>Completed sections: {completedSteps.size} of {WIZARD_STEPS.length - 1}</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                Save Care Plan
              </Button>
              <Button variant="outline">
                <FileDown className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    const Component = currentStepData.component;
    if (!Component) return null;

    return <Component />;
  };

  const progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === WIZARD_STEPS.length - 1;

  return (
    <div className="flex flex-col h-full max-h-[90vh]">
      {/* Header with progress */}
      <div className="border-b p-6 pb-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold">Care Support Plan</h2>
            <p className="text-muted-foreground">
              Step {currentStep + 1} of {WIZARD_STEPS.length}: {WIZARD_STEPS[currentStep].title}
            </p>
          </div>
          <SaveStatusIndicator />
        </div>
        
        <Progress value={progress} className="mb-4" />
        
        {/* Step navigation */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {WIZARD_STEPS.map((step, index) => (
            <Button
              key={step.id}
              variant={index === currentStep ? "default" : completedSteps.has(index) ? "secondary" : "outline"}
              size="sm"
              onClick={() => handleStepClick(index)}
              className="whitespace-nowrap"
            >
              {index + 1}. {step.title}
            </Button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">{WIZARD_STEPS[currentStep].title}</h3>
            <p className="text-muted-foreground">{WIZARD_STEPS[currentStep].description}</p>
          </div>
          
          {renderStepContent()}
        </div>
      </div>

      {/* Footer navigation */}
      <div className="border-t p-6 pt-4">
        <div className="flex justify-between items-center max-w-4xl mx-auto">
          <Button 
            variant="outline" 
            onClick={handlePrevious} 
            disabled={isFirstStep}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          
          <div className="text-sm text-muted-foreground">
            {currentStep + 1} of {WIZARD_STEPS.length}
          </div>
          
          {isLastStep ? (
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Save Plan
            </Button>
          ) : (
            <Button onClick={handleNext}>
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ComprehensiveCarePlanWizardRefactored({ 
  open, 
  onClose, 
  existingPlan 
}: ComprehensiveCarePlanWizardRefactoredProps) {
  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-full h-[90vh] p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Care Support Plan Wizard</DialogTitle>
          <DialogDescription>
            Create a comprehensive care support plan with step-by-step guidance
          </DialogDescription>
        </DialogHeader>
        
        <CarePlanProvider existingPlan={existingPlan} clients={clients}>
          <WizardContent onClose={onClose} />
        </CarePlanProvider>
      </DialogContent>
    </Dialog>
  );
}