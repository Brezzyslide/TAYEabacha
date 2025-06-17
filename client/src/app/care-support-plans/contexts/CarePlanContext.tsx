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
    aiAttempts: number;
  };
  structureData: {
    routines: any[];
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
  planData: CarePlanData;
  updateSection: (section: string, data: any) => void;
  updateField: (section: string, field: string, value: any) => void;
  updateBasicInfo: (field: string, value: any) => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSaveTime: Date | null;
  savePlan: () => void;
  resetPlan: () => void;
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
    aiAttempts: 0
  },
  structureData: {
    routines: []
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

  const resetPlan = useCallback(() => {
    dispatch({ type: 'RESET_PLAN' });
    setCurrentPlanId(null);
    setLastSaveTime(null);
    setSaveStatus('idle');
  }, []);

  const contextValue: CarePlanContextType = {
    planData,
    updateSection,
    updateField,
    updateBasicInfo,
    saveStatus,
    lastSaveTime,
    savePlan,
    resetPlan
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