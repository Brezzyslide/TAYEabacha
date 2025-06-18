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
import { StructureSectionComplete } from "./sections/StructureSectionComplete";
import { CommunicationSectionComplete } from "./sections/CommunicationSectionComplete";
import { BehaviourSectionComplete } from "./sections/BehaviourSectionComplete";
import { DisasterSectionComplete } from "./sections/DisasterSectionComplete";
import { MealtimeSectionComplete } from "./sections/MealtimeSectionComplete";
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
  { id: 'client', title: 'Client Selection', component: ClientLockSectionRefactored, description: 'Select and lock client information' },
  { id: 'aboutMe', title: 'About Me', component: AboutMeSectionRefactored, description: 'Personal background and preferences' },
  { id: 'goals', title: 'Goals & Outcomes', component: GoalsSectionRefactored, description: 'NDIS goals and personal objectives' },
  { id: 'adl', title: 'ADL Support', component: ADLSectionRefactored, description: 'Activities of Daily Living assessment' },
  { id: 'structure', title: 'Structure & Routine', component: StructureSection, description: 'Daily schedules and routines' },
  { id: 'communication', title: 'Communication', component: CommunicationSection, description: 'Communication strategies and support' },
  { id: 'behaviour', title: 'Behaviour Support', component: BehaviourSection, description: 'Positive behaviour support strategies' },
  { id: 'disaster', title: 'Disaster Management', component: DisasterSection, description: 'Emergency and disaster preparedness' },
  { id: 'mealtime', title: 'Mealtime Management', component: MealtimeSection, description: 'Nutrition and mealtime risk assessment' },
  { id: 'review', title: 'Review & Export', component: null, description: 'Final review and export options' },
];

function WizardContent({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { planData, savePlan, getSectionStatus, isNextSectionUnlocked } = useCarePlan();
  
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
        return <StructureSectionComplete 
          data={data}
          updateData={updateData}
          selectedClient={selectedClient}
          planData={data}
        />;
      case 'communication':
        return <CommunicationSectionComplete 
          data={data}
          updateData={updateData}
          selectedClient={selectedClient}
          planData={data}
        />;
      case 'behaviour':
        return <BehaviourSectionComplete 
          data={data}
          updateData={updateData}
          selectedClient={selectedClient}
          planData={data}
        />;
      case 'disaster':
        return <DisasterSectionComplete 
          data={data}
          updateData={updateData}
          selectedClient={selectedClient}
          planData={data}
        />;
      case 'mealtime':
        return <MealtimeSectionComplete 
          data={data}
          updateData={updateData}
          selectedClient={selectedClient}
          planData={data}
        />;
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
      {/* Header with progress - more compact */}
      <div className="border-b bg-white dark:bg-gray-900 px-6 py-4">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h2 className="text-xl font-bold">Care Support Plan</h2>
            <p className="text-sm text-muted-foreground">
              Step {currentStep + 1} of {WIZARD_STEPS.length}: {WIZARD_STEPS[currentStep].title}
            </p>
          </div>
          <SaveStatusIndicator />
        </div>
        
        <Progress value={progress} className="mb-3 h-1.5" />
        
        {/* Step navigation - horizontal scroll with progressive unlocking */}
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
                className={`whitespace-nowrap text-xs px-3 py-1.5 h-auto ${
                  isLocked ? 'opacity-50 cursor-not-allowed text-gray-400' : ''
                } ${
                  isCompleted ? 'bg-green-100 text-green-800 border-green-200' : ''
                }`}
                title={isLocked ? 'Complete previous sections to unlock' : step.description}
              >
                {isLocked && '🔒 '}
                {isCompleted && '✓ '}
                {index + 1}. {step.title}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Content area with centered cards */}
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950">
        <div className="max-w-6xl mx-auto p-6">
          {/* Section header centered */}
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold mb-2">{WIZARD_STEPS[currentStep].title}</h3>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {WIZARD_STEPS[currentStep].description}
            </p>
          </div>
          
          {/* Content with proper padding */}
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border">
            <div className="p-8">
              {renderStepContent()}
            </div>
          </div>
        </div>
      </div>

      {/* Footer navigation - cleaner design */}
      <div className="border-t bg-white dark:bg-gray-900 px-6 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Button 
            variant="outline" 
            onClick={handlePrevious} 
            disabled={isFirstStep}
            size="sm"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          
          <div className="text-xs text-muted-foreground bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
            {currentStep + 1} of {WIZARD_STEPS.length}
          </div>
          
          {isLastStep ? (
            <Button onClick={handleSave} size="sm">
              <Save className="h-4 w-4 mr-1" />
              Complete Plan
            </Button>
          ) : (
            <Button onClick={handleNext} size="sm">
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
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