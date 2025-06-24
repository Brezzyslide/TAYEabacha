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
import { ClientLockSectionRefactored } from "./sections/ClientLockSectionRefactored";
import { AboutMeSectionRefactored } from "./sections/AboutMeSectionRefactored";
import { GoalsSectionRefactored } from "./sections/GoalsSectionRefactored";
import { ADLSectionRefactored } from "./sections/ADLSectionRefactored";
import { StructureSectionRefactored } from "./sections/StructureSectionRefactored";
import { CommunicationSectionRefactored } from "./sections/CommunicationSectionRefactored";
import { BehaviourSectionRefactored } from "./sections/BehaviourSectionRefactored";
import { DisasterSectionRefactored } from "./sections/DisasterSectionRefactored";
import { MealtimeSectionRefactored } from "./sections/MealtimeSectionRefactored";
import { ReviewSectionRefactored } from "./sections/ReviewSectionRefactored";

interface ComprehensiveCarePlanWizardRefactoredProps {
  open: boolean;
  onClose: () => void;
  existingPlan?: any;
}

const WIZARD_STEPS = [
  { id: 'client', title: 'Client Selection', component: ClientLockSectionRefactored, description: 'Select and lock client information' },
  { id: 'aboutMe', title: 'About Me', component: AboutMeSectionRefactored, description: 'Personal background and preferences' },
  { id: 'goals', title: 'Goals & Outcomes', component: GoalsSectionRefactored, description: 'NDIS goals and personal objectives' },
  { id: 'adl', title: 'ADL Support', component: ADLSectionRefactored, description: 'Activities of Daily Living assessment' },
  { id: 'structure', title: 'Structure & Routine', component: StructureSectionRefactored, description: 'Daily schedules and routines' },
  { id: 'communication', title: 'Communication', component: CommunicationSectionRefactored, description: 'Communication strategies and support' },
  { id: 'behaviour', title: 'Behaviour Support', component: BehaviourSectionRefactored, description: 'Positive behaviour support strategies' },
  { id: 'disaster', title: 'Disaster Management', component: DisasterSectionRefactored, description: 'Emergency and disaster preparedness' },
  { id: 'mealtime', title: 'Mealtime Management', component: MealtimeSectionRefactored, description: 'Nutrition and mealtime risk assessment' },
  { id: 'review', title: 'Review & Export', component: ReviewSectionRefactored, description: 'Final review and export options' },
];

function WizardContent({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { planData, savePlan, getSectionStatus, isNextSectionUnlocked } = useCarePlan();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Helper function to update section data using Context dispatch
  const updateSectionData = (section: string, data: any) => {
    // This will be handled by the section components directly using the Context
    // For now, just log the update
    console.log(`Updating section ${section} with data:`, data);
  };

  const handleNext = () => {
    setCompletedSteps(prev => {
      const newSet = new Set(prev);
      newSet.add(currentStep);
      return newSet;
    });
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

    // Check if current section is locked
    const currentSectionStatus = getSectionStatus(currentStepData.id);
    const isCurrentSectionLocked = currentSectionStatus === 'locked';

    // If section is locked, show locked state
    if (isCurrentSectionLocked) {
      return (
        <Card className="opacity-50">
          <CardContent className="p-8 text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h3 className="text-xl font-semibold mb-2 text-gray-500">Section Locked</h3>
            <p className="text-muted-foreground mb-4">
              Complete the previous sections to unlock {currentStepData.title}
            </p>
            <div className="text-sm text-gray-500">
              <p>Required: Complete previous sections in order</p>
              <p>This ensures proper context building for AI generation</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Render the appropriate component based on step
    switch(currentStepData.id) {
      case 'client':
        return <ClientLockSectionRefactored />;
      case 'aboutMe':
        return <AboutMeSectionRefactored />;
      case 'goals':
        return <GoalsSectionRefactored />;
      case 'adl':
        return <ADLSectionRefactored />;
      case 'structure':
        return <StructureSectionRefactored />;
      case 'communication':
        return <CommunicationSectionRefactored />;
      case 'behaviour':
        return <BehaviourSectionRefactored />;
      case 'disaster':
        return <DisasterSectionRefactored />;
      case 'mealtime':
        return <MealtimeSectionRefactored />;
      case 'review':
        return <ReviewSectionRefactored />;
      default:
        return (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                Section not implemented yet
              </p>
            </CardContent>
          </Card>
        );
    }
  };

  const progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === WIZARD_STEPS.length - 1;

  return (
    <div className="flex flex-col h-full max-h-[95vh]">
      {/* Header with progress - mobile optimized */}
      <div className="border-b bg-white dark:bg-gray-900 px-2 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-0 mb-3">
          <div className="flex-1">
            <h2 className="text-lg sm:text-xl font-bold">Care Support Plan</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Step {currentStep + 1} of {WIZARD_STEPS.length}: {WIZARD_STEPS[currentStep].title}
            </p>
          </div>
          <div className="flex justify-end">
            <SaveStatusIndicator />
          </div>
        </div>
        
        <Progress value={progress} className="mb-3 h-1.5" />
        
        {/* Step navigation - mobile optimized horizontal scroll */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {WIZARD_STEPS.map((step, index) => {
            const sectionStatus = getSectionStatus(step.id);
            const isLocked = sectionStatus === 'locked';
            const isCompleted = sectionStatus === 'completed';
            const isCurrentActive = index === currentStep;
            
            return (
              <Button
                key={step.id}
                variant={
                  isCurrentActive ? "default" : 
                  isCompleted ? "secondary" : 
                  isLocked ? "ghost" : "outline"
                }
                size="sm"
                onClick={() => !isLocked && handleStepClick(index)}
                disabled={isLocked}
                className={`whitespace-nowrap text-xs px-2 sm:px-3 py-1.5 h-auto min-w-fit ${
                  isLocked ? 'opacity-50 cursor-not-allowed text-gray-400' : ''
                } ${
                  isCompleted ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-100' : ''
                }`}
                title={isLocked ? 'Complete previous sections to unlock' : step.description}
              >
                {isLocked && '🔒 '}
                {isCompleted && '✓ '}
                <span className="sm:hidden">{index + 1}</span>
                <span className="hidden sm:inline">{index + 1}. {step.title}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Content area - mobile optimized */}
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950">
        <div className="max-w-6xl mx-auto p-2 sm:p-6">
          {/* Section header - mobile responsive */}
          <div className="text-center mb-4 sm:mb-8">
            <h3 className="text-xl sm:text-2xl font-bold mb-2">{WIZARD_STEPS[currentStep].title}</h3>
            <p className="text-muted-foreground text-sm sm:text-lg max-w-2xl mx-auto px-2">
              {WIZARD_STEPS[currentStep].description}
            </p>
          </div>
          
          {/* Content with responsive padding */}
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border">
            <div className="p-3 sm:p-6 lg:p-8">
              {renderStepContent()}
            </div>
          </div>
        </div>
      </div>

      {/* Footer navigation - mobile optimized */}
      <div className="border-t bg-white dark:bg-gray-900 px-2 sm:px-6 py-3 sm:py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={handlePrevious} 
              disabled={isFirstStep}
              size="sm"
              className="w-full sm:w-auto order-2 sm:order-1"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            
            <div className="text-xs text-muted-foreground bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full text-center order-1 sm:order-2">
              {currentStep + 1} of {WIZARD_STEPS.length}
            </div>
            
            {isLastStep ? (
              <Button 
                onClick={handleSave} 
                size="sm"
                className="w-full sm:w-auto order-3"
              >
                <Save className="h-4 w-4 mr-1" />
                Complete Plan
              </Button>
            ) : (
              <Button 
                onClick={handleNext} 
                size="sm"
                className="w-full sm:w-auto order-3"
                disabled={!isNextSectionUnlocked(WIZARD_STEPS[currentStep + 1]?.id || '')}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
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
    <>
      <style>{scrollbarStyles}</style>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="w-[98vw] max-w-[1400px] h-[96vh] p-0 overflow-hidden">
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
    </>;
  );
}