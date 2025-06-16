import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Save, Check, X, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BasicInfoSection } from "./sections/BasicInfoSection";
import { AboutMeSection } from "./sections/AboutMeSection";
import { GoalsSection } from "./sections/GoalsSection";
import { ADLSection } from "./sections/ADLSection";
import { StructureSection } from "./sections/StructureSection";
import { CommunicationSection } from "./sections/CommunicationSection";
import { SupportDeliverySection } from "./sections/SupportDeliverySection";
import { BehaviourSection } from "./sections/BehaviourSection";
import { DisasterPlanSection } from "./sections/DisasterPlanSection";
import { MealtimeRiskSection } from "./sections/MealtimeRiskSection";
import type { CareSupportPlan } from "@shared/schema";

interface CareSupportPlanWizardProps {
  existingPlan?: CareSupportPlan | null;
  onClose: () => void;
}

const SECTIONS = [
  { id: "basicInfo", title: "Basic Information", component: BasicInfoSection },
  { id: "aboutMe", title: "About Me", component: AboutMeSection },
  { id: "goals", title: "Goals & Objectives", component: GoalsSection },
  { id: "adl", title: "Activities of Daily Living", component: ADLSection },
  { id: "structure", title: "Structure & Routine", component: StructureSection },
  { id: "communication", title: "Communication", component: CommunicationSection },
  { id: "supportDelivery", title: "Support Delivery", component: SupportDeliverySection },
  { id: "behaviour", title: "Behaviour Support", component: BehaviourSection },
  { id: "disaster", title: "Disaster Management", component: DisasterPlanSection },
  { id: "mealtime", title: "Mealtime Risk", component: MealtimeRiskSection },
];

export function CareSupportPlanWizard({ existingPlan, onClose }: CareSupportPlanWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<any>({
    planTitle: "",
    clientId: null,
    status: "draft",
    basicInfoData: {},
    aboutMeData: {},
    goalsData: {},
    adlData: {},
    structureData: {},
    communicationData: {},
    supportDeliveryData: {},
    behaviourData: {},
    disasterData: {},
    mealtimeData: {},
  });
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
  });

  // Load existing plan data
  useEffect(() => {
    if (existingPlan) {
      setFormData({
        planTitle: existingPlan.planTitle || "",
        clientId: existingPlan.clientId || null,
        status: existingPlan.status || "draft",
        basicInfoData: existingPlan.basicInfoData || {},
        aboutMeData: existingPlan.aboutMeData || {},
        goalsData: existingPlan.goalsData || {},
        adlData: existingPlan.adlData || {},
        structureData: existingPlan.structureData || {},
        communicationData: existingPlan.communicationData || {},
        supportDeliveryData: existingPlan.supportDeliveryData || {},
        behaviourData: existingPlan.behaviourData || {},
        disasterData: existingPlan.disasterData || {},
        mealtimeData: existingPlan.mealtimeData || {},
      });
    }
  }, [existingPlan]);

  const createPlanMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/care-support-plans", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-support-plans"] });
      toast({
        title: "Success",
        description: "Care support plan created successfully",
      });
      setUnsavedChanges(false);
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create care support plan",
        variant: "destructive",
      });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/care-support-plans/${existingPlan?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-support-plans"] });
      toast({
        title: "Success",
        description: "Care support plan updated successfully",
      });
      setUnsavedChanges(false);
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update care support plan",
        variant: "destructive",
      });
    },
  });

  const autoSaveMutation = useMutation({
    mutationFn: (data: any) => {
      if (existingPlan) {
        return apiRequest("PUT", `/api/care-support-plans/${existingPlan.id}`, data);
      } else {
        return apiRequest("POST", "/api/care-support-plans", { ...data, status: "draft" });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-support-plans"] });
      setUnsavedChanges(false);
    },
  });

  const handleDataChange = (section: string, data: any) => {
    setFormData((prev: any) => ({
      ...prev,
      [`${section}Data`]: data,
    }));
    setUnsavedChanges(true);
  };

  const handleBasicInfoChange = (data: any) => {
    setFormData((prev: any) => ({
      ...prev,
      planTitle: data.planTitle || prev.planTitle,
      clientId: data.clientId || prev.clientId,
      status: data.status || prev.status,
      basicInfoData: data,
    }));
    setUnsavedChanges(true);
  };

  const handleAutoSave = () => {
    if (unsavedChanges && formData.clientId && formData.planTitle) {
      autoSaveMutation.mutate(formData);
    }
  };

  const handleNext = () => {
    if (currentStep < SECTIONS.length - 1) {
      handleAutoSave();
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = () => {
    if (!formData.clientId) {
      toast({
        title: "Error",
        description: "Please select a client before saving",
        variant: "destructive",
      });
      return;
    }

    if (!formData.planTitle) {
      toast({
        title: "Error",
        description: "Please enter a plan title before saving",
        variant: "destructive",
      });
      return;
    }

    if (existingPlan) {
      updatePlanMutation.mutate(formData);
    } else {
      createPlanMutation.mutate(formData);
    }
  };

  const handleComplete = () => {
    const completeData = { ...formData, status: "active" };
    if (existingPlan) {
      updatePlanMutation.mutate(completeData);
    } else {
      createPlanMutation.mutate(completeData);
    }
  };

  const progress = ((currentStep + 1) / SECTIONS.length) * 100;
  const currentSection = SECTIONS[currentStep];
  const CurrentComponent = currentSection.component;

  const selectedClient = clients.find((c: any) => c.id === formData.clientId);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold">
                  {existingPlan ? "Edit Care Support Plan" : "Create Care Support Plan"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {selectedClient ? `For ${selectedClient.fullName}` : "NDIS-compliant care planning"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {unsavedChanges && (
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4" />
                  Unsaved changes
                </div>
              )}
              <Button variant="outline" onClick={handleSave} disabled={createPlanMutation.isPending || updatePlanMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
              <Button onClick={handleComplete} disabled={createPlanMutation.isPending || updatePlanMutation.isPending}>
                <Check className="h-4 w-4 mr-2" />
                Complete Plan
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Progress</CardTitle>
                <Progress value={progress} className="w-full" />
                <p className="text-xs text-muted-foreground">
                  Step {currentStep + 1} of {SECTIONS.length}
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {SECTIONS.map((section, index) => (
                  <button
                    key={section.id}
                    onClick={() => setCurrentStep(index)}
                    className={`w-full text-left p-2 rounded-md text-sm transition-colors ${
                      index === currentStep
                        ? "bg-primary text-primary-foreground"
                        : index < currentStep
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {index < currentStep ? (
                        <Check className="h-4 w-4" />
                      ) : index === currentStep ? (
                        <div className="h-4 w-4 rounded-full bg-current" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-current" />
                      )}
                      {section.title}
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <Card className="min-h-[600px]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {currentSection.title}
                  <Sparkles className="h-4 w-4 text-blue-500" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CurrentComponent
                  data={currentStep === 0 ? formData : formData[`${currentSection.id}Data`]}
                  onChange={currentStep === 0 ? handleBasicInfoChange : (data: any) => handleDataChange(currentSection.id, data)}
                  clients={clients}
                  selectedClient={selectedClient}
                  planData={formData}
                />
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex justify-between mt-6">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              <Button
                onClick={handleNext}
                disabled={currentStep === SECTIONS.length - 1}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}