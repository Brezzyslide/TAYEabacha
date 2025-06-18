import { createContext, useContext, useReducer, useCallback, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CarePlanData {
  id?: number;
  planTitle: string;
  clientId: number | null;
  clientData: any;
  status: string;
  aboutMeData: {
    personalHistory: string;
    interests: string;
    preferences: string;
    strengths: string;
    challenges: string;
    familyBackground: string;
    culturalConsiderations: string;
    generatedContent: string;
    bulletPoints: string;
    userInput: string;
  };
  goalsData: {
    ndisGoals: string;
    overallObjective: string;
    goals: any[];
    generatedGoals: string;
    goalInput: string;
    userInput: string;
  };
  adlData: {
    userInput: string;
    generatedContent: string;
    personalCare: string;
    mobility: string;
    household: string;
    community: string;
    safety: string;
    independence: string;
    assistiveTechnology: string;
    recommendations: string;
  };
  structureData: {
    userInput: string;
    generatedContent: string;
    routines: any[];
    dailyStructure: string;
    weeklyPattern: string;
    transitions: string;
    flexibility: string;
    environmental: string;
    staffGuidance: string;
  };
  communicationData: {
    expressive: string;
    receptive: string;
    generatedStrategy: string;
    aiAttempts: number;
  };
  behaviourData: {
    behaviours: any[];
  };
  disasterData: {
    scenarios: Record<string, any>;
  };
  mealtimeData: {
    riskParameters: any[];
    generatedPlan: string;
    aiAttempts: number;
  };
}

type CarePlanAction = 
  | { type: 'SET_PLAN_DATA'; payload: CarePlanData }
  | { type: 'UPDATE_SECTION'; section: string; data: any }
  | { type: 'UPDATE_FIELD'; section: string; field: string; value: any }
  | { type: 'UPDATE_BASIC_INFO'; field: string; value: any }
  | { type: 'RESET_PLAN' };

interface CarePlanContextType {
  state: CarePlanData;
  planData: CarePlanData;
  clientData: any;
  dispatch: React.Dispatch<CarePlanAction>;
  updateSection: (section: string, data: any) => void;
  updateField: (section: string, field: string, value: any) => void;
  updateBasicInfo: (field: string, value: any) => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSaveTime: Date | null;
  savePlan: () => void;
  resetPlan: () => void;
  getSectionStatus: (sectionName: string) => 'locked' | 'available' | 'completed';
  isNextSectionUnlocked: (currentSection: string) => boolean;
}

const initialPlanData: CarePlanData = {
  planTitle: '',
  clientId: null,
  clientData: null,
  status: 'draft',
  aboutMeData: {
    personalHistory: '',
    interests: '',
    preferences: '',
    strengths: '',
    challenges: '',
    familyBackground: '',
    culturalConsiderations: '',
    generatedContent: '',
    bulletPoints: '',
    userInput: ''
  },
  goalsData: {
    ndisGoals: '',
    overallObjective: '',
    goals: [],
    generatedGoals: '',
    goalInput: '',
    userInput: ''
  },
  adlData: {
    userInput: '',
    generatedContent: '',
    personalCare: '',
    mobility: '',
    household: '',
    community: '',
    safety: '',
    independence: '',
    assistiveTechnology: '',
    recommendations: ''
  },
  structureData: {
    userInput: '',
    generatedContent: '',
    routines: [],
    dailyStructure: '',
    weeklyPattern: '',
    transitions: '',
    flexibility: '',
    environmental: '',
    staffGuidance: ''
  },
  communicationData: {
    expressive: '',
    receptive: '',
    generatedStrategy: '',
    aiAttempts: 0
  },
  behaviourData: {
    behaviours: []
  },
  disasterData: {
    scenarios: {}
  },
  mealtimeData: {
    riskParameters: [],
    generatedPlan: '',
    aiAttempts: 0
  }
};

function carePlanReducer(state: CarePlanData, action: CarePlanAction): CarePlanData {
  switch (action.type) {
    case 'SET_PLAN_DATA':
      return { ...action.payload };
    
    case 'UPDATE_SECTION':
      return {
        ...state,
        [action.section]: { ...state[action.section as keyof CarePlanData], ...action.data }
      };
    
    case 'UPDATE_FIELD':
      return {
        ...state,
        [action.section]: {
          ...state[action.section as keyof CarePlanData],
          [action.field]: action.value
        }
      };
    
    case 'UPDATE_BASIC_INFO':
      return {
        ...state,
        [action.field]: action.value
      };
    
    case 'RESET_PLAN':
      return { ...initialPlanData };
    
    default:
      return state;
  }
}

const CarePlanContext = createContext<CarePlanContextType | null>(null);

export function CarePlanProvider({ 
  children, 
  existingPlan, 
  clients 
}: { 
  children: React.ReactNode;
  existingPlan?: any;
  clients?: any[];
}) {
  const [planData, dispatch] = useReducer(carePlanReducer, initialPlanData);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [currentPlanId, setCurrentPlanId] = useState<number | null>(existingPlan?.id || null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load existing plan data
  useEffect(() => {
    if (existingPlan) {
      setCurrentPlanId(existingPlan.id);
      const clientData = clients?.find(c => c.id === existingPlan.clientId) || null;
      
      dispatch({
        type: 'SET_PLAN_DATA',
        payload: {
          id: existingPlan.id,
          planTitle: existingPlan.planTitle || '',
          clientId: existingPlan.clientId || null,
          clientData,
          status: existingPlan.status || 'draft',
          aboutMeData: {
            ...initialPlanData.aboutMeData,
            ...existingPlan.aboutMeData
          },
          goalsData: {
            ...initialPlanData.goalsData,
            ...existingPlan.goalsData
          },
          adlData: {
            ...initialPlanData.adlData,
            ...existingPlan.adlData
          },
          structureData: {
            ...initialPlanData.structureData,
            ...existingPlan.structureData
          },
          communicationData: {
            ...initialPlanData.communicationData,
            ...existingPlan.communicationData
          },
          behaviourData: {
            ...initialPlanData.behaviourData,
            ...existingPlan.behaviourData
          },
          disasterData: {
            ...initialPlanData.disasterData,
            ...existingPlan.disasterData
          },
          mealtimeData: {
            ...initialPlanData.mealtimeData,
            ...existingPlan.mealtimeData
          }
        }
      });
    }
  }, [existingPlan, clients]);

  // Auto-save mutation
  const autoSaveMutation = useMutation({
    mutationFn: async (data: CarePlanData) => {
      const { clientData, ...saveData } = data;
      
      const response = await apiRequest('POST', '/api/care-support-plans/auto-save', {
        ...saveData,
        id: currentPlanId,
        status: 'draft',
        planTitle: data.planTitle || `Draft - ${new Date().toLocaleDateString()}`,
      });
      
      return await response.json();
    },
    onMutate: () => {
      setSaveStatus('saving');
    },
    onSuccess: (savedPlan) => {
      setSaveStatus('saved');
      setLastSaveTime(new Date());
      
      if (!currentPlanId && savedPlan?.id) {
        setCurrentPlanId(savedPlan.id);
        dispatch({ type: 'UPDATE_BASIC_INFO', field: 'id', value: savedPlan.id });
      }
      
      // Reset to idle after 2 seconds
      setTimeout(() => setSaveStatus('idle'), 2000);
    },
    onError: () => {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  });

  // Manual save mutation
  const savePlanMutation = useMutation({
    mutationFn: async (data: CarePlanData) => {
      const { clientData, ...saveData } = data;
      
      if (currentPlanId) {
        return apiRequest("PUT", `/api/care-support-plans/${currentPlanId}`, saveData);
      } else {
        return apiRequest("POST", "/api/care-support-plans", saveData);
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Care support plan ${currentPlanId ? 'updated' : 'created'} successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/care-support-plans"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save care support plan",
        variant: "destructive",
      });
    },
  });

  // Auto-save effect with debounce
  useEffect(() => {
    if (!planData.clientId) return;
    
    const hasContent = planData.planTitle || 
                      planData.aboutMeData.bulletPoints || 
                      planData.goalsData.ndisGoals ||
                      planData.adlData.userInput ||
                      planData.communicationData.expressive;
    
    if (!hasContent) return;

    const saveTimeout = setTimeout(() => {
      if (!autoSaveMutation.isPending) {
        autoSaveMutation.mutate(planData);
      }
    }, 3000);

    return () => clearTimeout(saveTimeout);
  }, [planData]);

  // Auto-save interval
  useEffect(() => {
    if (!planData.clientId) return;
    
    const autoSaveInterval = setInterval(() => {
      const hasContent = planData.planTitle || 
                        planData.aboutMeData.bulletPoints || 
                        planData.goalsData.ndisGoals ||
                        planData.adlData.userInput ||
                        planData.communicationData.expressive;
      
      if (hasContent && !autoSaveMutation.isPending) {
        autoSaveMutation.mutate(planData);
      }
    }, 10000);

    return () => clearInterval(autoSaveInterval);
  }, [planData]);

  const updateSection = useCallback((section: string, data: any) => {
    dispatch({ type: 'UPDATE_SECTION', section, data });
  }, []);

  const updateField = useCallback((section: string, field: string, value: any) => {
    dispatch({ type: 'UPDATE_FIELD', section, field, value });
  }, []);

  const updateBasicInfo = useCallback((field: string, value: any) => {
    dispatch({ type: 'UPDATE_BASIC_INFO', field, value });
  }, []);

  const savePlan = useCallback(() => {
    savePlanMutation.mutate(planData);
  }, [planData, savePlanMutation]);

  // Progressive form logic - sections unlock as previous ones are completed
  const getSectionStatus = useCallback((sectionName: string): 'locked' | 'available' | 'completed' => {
    const sectionOrder = [
      'aboutMe',
      'goals', 
      'adl',
      'structure',
      'communication',
      'behaviour',
      'disaster',
      'mealtime'
    ];

    const currentIndex = sectionOrder.indexOf(sectionName);
    if (currentIndex === -1) return 'available'; // Unknown sections are always available
    
    // First section (About Me) is always available
    if (currentIndex === 0) {
      const aboutMeComplete = planData.aboutMeData.bulletPoints?.trim() || 
                             planData.aboutMeData.personalHistory?.trim() ||
                             planData.aboutMeData.interests?.trim();
      return aboutMeComplete ? 'completed' : 'available';
    }

    // Check if previous sections are completed
    for (let i = 0; i < currentIndex; i++) {
      const prevSection = sectionOrder[i];
      const prevStatus = getSectionCompletionStatus(prevSection);
      if (!prevStatus) {
        return 'locked'; // Previous section not completed
      }
    }

    // Current section is unlocked, check if completed
    const isCompleted = getSectionCompletionStatus(sectionName);
    return isCompleted ? 'completed' : 'available';
  }, [planData]);

  const getSectionCompletionStatus = useCallback((sectionName: string): boolean => {
    switch (sectionName) {
      case 'aboutMe':
        return !!(planData.aboutMeData.bulletPoints?.trim() || 
                 planData.aboutMeData.personalHistory?.trim() ||
                 planData.aboutMeData.interests?.trim());
      
      case 'goals':
        return !!(planData.goalsData.ndisGoals?.trim() || 
                 planData.goalsData.userInput?.trim() ||
                 (planData.goalsData.goals && planData.goalsData.goals.length > 0));
      
      case 'adl':
        return !!(planData.adlData.userInput?.trim() || 
                 planData.adlData.personalCare?.trim() ||
                 planData.adlData.mobility?.trim() ||
                 planData.adlData.household?.trim() ||
                 planData.adlData.community?.trim() ||
                 planData.adlData.safety?.trim() ||
                 planData.adlData.independence?.trim() ||
                 planData.adlData.assistiveTechnology?.trim() ||
                 planData.adlData.recommendations?.trim());
      
      case 'structure':
        return !!(planData.structureData.routines && planData.structureData.routines.length > 0);
      
      case 'communication':
        return !!(planData.communicationData.expressive?.trim() || 
                 planData.communicationData.receptive?.trim());
      
      case 'behaviour':
        return !!(planData.behaviourData.behaviours && planData.behaviourData.behaviours.length > 0);
      
      case 'disaster':
        return !!(planData.disasterData.scenarios && Object.keys(planData.disasterData.scenarios).length > 0);
      
      case 'mealtime':
        return !!(planData.mealtimeData.riskParameters && planData.mealtimeData.riskParameters.length > 0);
      
      default:
        return false;
    }
  }, [planData]);

  const isNextSectionUnlocked = useCallback((currentSection: string): boolean => {
    return getSectionStatus(currentSection) !== 'locked';
  }, [getSectionStatus]);

  const resetPlan = useCallback(() => {
    dispatch({ type: 'RESET_PLAN' });
    setCurrentPlanId(null);
    setLastSaveTime(null);
    setSaveStatus('idle');
  }, []);

  const contextValue: CarePlanContextType = {
    state: planData,
    planData,
    clientData: planData.clientData,
    dispatch,
    updateSection,
    updateField,
    updateBasicInfo,
    saveStatus,
    lastSaveTime,
    savePlan,
    resetPlan,
    getSectionStatus,
    isNextSectionUnlocked
  };

  return (
    <CarePlanContext.Provider value={contextValue}>
      {children}
    </CarePlanContext.Provider>
  );
}

export function useCarePlan() {
  const context = useContext(CarePlanContext);
  if (!context) {
    throw new Error('useCarePlan must be used within a CarePlanProvider');
  }
  return context;
}