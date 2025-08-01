import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Calendar, Clock } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const observationSchema = z.object({
  clientId: z.string().min(1, "Please select a client"),
  observationType: z.string().min(1, "Please select an observation type"),
  subtype: z.string().optional(),
  notes: z.string().optional(),
  timestamp: z.string().min(1, "Please select a date and time"),
  // Behaviour-specific star chart fields (matching server schema)
  settings: z.string().optional(),
  settingsRating: z.number().min(1).max(5).optional(),
  time: z.string().optional(),
  timeRating: z.number().min(1).max(5).optional(),
  antecedents: z.string().optional(),
  antecedentsRating: z.number().min(1).max(5).optional(),
  response: z.string().optional(),
  responseRating: z.number().min(1).max(5).optional(),
  // Additional fields for compatibility
  intensity: z.number().min(1).max(5).optional(),
  adlDetails: z.string().optional(),
}).refine((data) => {
  // For behaviour observations, require all star chart fields
  if (data.observationType === "behaviour") {
    if (!data.settings || !data.settingsRating || !data.time || !data.timeRating || 
        !data.antecedents || !data.antecedentsRating || !data.response || !data.responseRating) {
      return false;
    }
  }
  return true;
}, {
  message: "All star chart fields are required for behaviour observations",
  path: ["settings"]
}).refine((data) => {
  // For ADL observations, require subtype and notes
  if (data.observationType === "adl") {
    if (!data.subtype || data.subtype.trim() === "" || !data.notes || data.notes.trim() === "") {
      return false;
    }
  }
  return true;
}, {
  message: "Subtype and notes are required for ADL observations",
  path: ["subtype"]
});

type ObservationFormData = z.infer<typeof observationSchema>;

interface ObservationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  observation?: any;
  clientId?: number;
}

const OBSERVATION_TYPES = {
  behaviour: {
    label: "Behaviour",
    subtypes: ["Aggression", "Self-harm", "Verbal outburst", "Physical resistance", "Compliance", "Positive interaction"],
    hasIntensity: true
  },
  adl: {
    label: "ADL (Activities of Daily Living)",
    subtypes: ["Personal hygiene", "Meal preparation", "Medication", "Mobility", "Communication", "Household tasks"],
    hasIntensity: false
  },
  health: {
    label: "Health",
    subtypes: ["Physical symptoms", "Vital signs", "Medication effects", "Sleep patterns", "Appetite", "Pain levels"],
    hasIntensity: false
  },
  social: {
    label: "Social",
    subtypes: ["Peer interaction", "Staff interaction", "Family contact", "Community participation", "Social skills", "Isolation"],
    hasIntensity: false
  },
  communication: {
    label: "Communication",
    subtypes: ["Verbal communication", "Non-verbal cues", "Technology use", "Sign language", "Written communication", "Understanding"],
    hasIntensity: false
  }
};

export default function ObservationFormModal({ 
  isOpen, 
  onClose, 
  observation,
  clientId 
}: ObservationFormModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<string>("");

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
  });

  const form = useForm<ObservationFormData>({
    resolver: zodResolver(observationSchema),
    defaultValues: {
      clientId: clientId?.toString() || "",
      observationType: "",
      subtype: "",
      notes: "",
      timestamp: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      // Star chart fields for behaviour observations
      settings: "",
      settingsRating: undefined,
      time: "",
      timeRating: undefined,
      antecedents: "",
      antecedentsRating: undefined,
      response: "",
      responseRating: undefined,
      // Additional fields
      intensity: undefined,
      adlDetails: "",
    },
  });

  const isEditing = !!observation;
  const isAdmin = user?.role === "Admin";

  // Reset form when modal opens/closes or observation changes
  useEffect(() => {
    if (isOpen) {
      if (observation) {
        form.reset({
          clientId: observation.clientId.toString(),
          observationType: observation.observationType,
          subtype: observation.subtype || "",
          notes: observation.notes || "",
          timestamp: format(new Date(observation.timestamp), "yyyy-MM-dd'T'HH:mm"),
          // Load star chart fields
          settings: observation.settings || "",
          settingsRating: observation.settingsRating || undefined,
          time: observation.time || "",
          timeRating: observation.timeRating || undefined,
          antecedents: observation.antecedents || "",
          antecedentsRating: observation.antecedentsRating || undefined,
          response: observation.response || "",
          responseRating: observation.responseRating || undefined,
          // Load additional fields
          intensity: observation.intensity || undefined,
          adlDetails: observation.adlDetails || "",
        });
        setSelectedType(observation.observationType);
      } else {
        form.reset({
          clientId: clientId?.toString() || "",
          observationType: "",
          subtype: "",
          notes: "",
          timestamp: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
          // Reset star chart fields
          settings: "",
          settingsRating: undefined,
          time: "",
          timeRating: undefined,
          antecedents: "",
          antecedentsRating: undefined,
          response: "",
          responseRating: undefined,
          // Reset additional fields
          intensity: undefined,
          adlDetails: "",
        });
        setSelectedType("");
      }
    }
  }, [isOpen, observation, clientId, form]);

  const createMutation = useMutation({
    mutationFn: async (data: ObservationFormData) => {
      const payload: any = {
        clientId: parseInt(data.clientId),
        observationType: data.observationType,
        subtype: data.subtype || null,
        notes: data.notes || null,
        timestamp: new Date(data.timestamp).toISOString(),
        createdBy: user?.id,
        tenantId: user?.tenantId,
      };

      // Include star chart fields for behavior observations
      if (data.observationType === "behaviour") {
        payload.settings = data.settings;
        payload.settingsRating = data.settingsRating;
        payload.time = data.time;
        payload.timeRating = data.timeRating;
        payload.antecedents = data.antecedents;
        payload.antecedentsRating = data.antecedentsRating;
        payload.response = data.response;
        payload.responseRating = data.responseRating;
      }

      if (isEditing) {
        return apiRequest("PATCH", `/api/observations/${observation.id}`, payload);
      } else {
        return apiRequest("POST", "/api/observations", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/observations"] });
      toast({
        title: isEditing ? "Observation Updated" : "Observation Created",
        description: isEditing 
          ? "The observation has been successfully updated."
          : "The observation has been successfully recorded.",
      });
      onClose();
    },
    onError: (error: any) => {
      console.error("[OBSERVATION FORM] Submission error details:", error);
      
      // Enhanced error messaging for validation failures
      let errorMessage = "Failed to save observation.";
      if (error.message) {
        if (error.message.includes("star chart fields") || error.message.includes("behaviour observations")) {
          errorMessage = "Please fill out all star chart fields (text descriptions and 1-5 star ratings) for behavior observations.";
        } else if (error.message.includes("validation")) {
          errorMessage = "Please check all required fields are completed correctly.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Validation Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: ObservationFormData) => {
    // Prevent duplicate submissions with multiple checks
    if (createMutation.isPending || isSubmitting) {
      console.log("[OBSERVATION FORM] Submission blocked - already in progress");
      return;
    }
    
    console.log("[OBSERVATION FORM] Starting submission:", data);
    
    // Enhanced validation for behavior observations before submission
    if (data.observationType === "behaviour") {
      const missingFields = [];
      if (!data.settings || data.settings.trim().length === 0) missingFields.push("Settings description");
      if (!data.settingsRating || data.settingsRating < 1 || data.settingsRating > 5) missingFields.push("Settings rating");
      if (!data.time || data.time.trim().length === 0) missingFields.push("Time description");
      if (!data.timeRating || data.timeRating < 1 || data.timeRating > 5) missingFields.push("Time rating");
      if (!data.antecedents || data.antecedents.trim().length === 0) missingFields.push("Antecedents description");
      if (!data.antecedentsRating || data.antecedentsRating < 1 || data.antecedentsRating > 5) missingFields.push("Antecedents rating");
      if (!data.response || data.response.trim().length === 0) missingFields.push("Response description");
      if (!data.responseRating || data.responseRating < 1 || data.responseRating > 5) missingFields.push("Response rating");
      
      if (missingFields.length > 0) {
        toast({
          title: "Missing Required Fields",
          description: `Please complete: ${missingFields.join(", ")}`,
          variant: "destructive",
        });
        return;
      }
      
      console.log("[OBSERVATION FORM] Behavior validation passed:", {
        settings: data.settings?.length,
        settingsRating: data.settingsRating,
        time: data.time?.length,
        timeRating: data.timeRating,
        antecedents: data.antecedents?.length,
        antecedentsRating: data.antecedentsRating,
        response: data.response?.length,
        responseRating: data.responseRating
      });
    }
    
    setIsSubmitting(true);
    
    // Auto-populate timestamp with current time if not manually changed
    const submissionData = {
      ...data,
      timestamp: format(new Date(), "yyyy-MM-dd'T'HH:mm")
    };
    
    try {
      await createMutation.mutateAsync(submissionData);
    } catch (error) {
      console.error("[OBSERVATION FORM] Submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTypeChange = (value: string) => {
    setSelectedType(value);
    form.setValue("observationType", value);
    form.setValue("subtype", "");
    
    // Reset intensity if not a behaviour observation
    if (value !== "behaviour") {
      form.setValue("intensity", undefined);
    }
  };

  const selectedTypeConfig = selectedType ? OBSERVATION_TYPES[selectedType as keyof typeof OBSERVATION_TYPES] : null;

  const renderBehaviorStarChart = () => {
    if (selectedType !== "behaviour") return null;

    const behaviorCategories = [
      { key: 'settings', ratingKey: 'settingsRating', label: 'Setting', description: 'Environmental factors and location appropriateness' },
      { key: 'time', ratingKey: 'timeRating', label: 'Time', description: 'Duration and timing of behavior occurrence' },
      { key: 'antecedents', ratingKey: 'antecedentsRating', label: 'Antecedents', description: 'Triggers and events preceding the behavior' },
      { key: 'response', ratingKey: 'responseRating', label: 'Response', description: 'How the participant responded and strategies used' },
    ];

    const StarRating = ({ categoryKey, ratingKey, label, description }: { categoryKey: string; ratingKey: string; label: string; description: string }) => (
      <div className="space-y-3 p-4 bg-white rounded-lg border border-gray-200">
        <div>
          <h4 className="font-medium text-gray-900">{label}</h4>
          <p className="text-xs text-gray-600">{description}</p>
        </div>
        
        {/* Star Rating */}
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((level) => {
            const currentValue = form.watch(ratingKey as any);
            return (
              <button
                key={level}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log(`Clicking star ${level} for ${ratingKey}`);
                  form.setValue(ratingKey as any, level, { shouldValidate: true, shouldDirty: true });
                }}
                className={`p-2 rounded-lg border-2 transition-all hover:scale-110 cursor-pointer ${
                  currentValue === level 
                    ? "bg-yellow-50 border-yellow-400 shadow-md" 
                    : "bg-white border-gray-200 hover:border-gray-300"
                }`}
                style={{ pointerEvents: 'auto' }}
              >
                <Star
                  className={`h-5 w-5 ${
                    currentValue === level
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300 hover:text-gray-400"
                  }`}
                />
              </button>
            );
          })}
          <span className="ml-3 text-sm font-medium text-gray-700">
            {form.watch(ratingKey as any) ? 
              `${form.watch(ratingKey as any)}/5` : 
              "Not rated"}
          </span>
        </div>

        {/* Text Box underneath each rating */}
        <div className="mt-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label} Notes
          </label>
          <input
            type="text"
            placeholder={`Describe ${label.toLowerCase()} details...`}
            value={form.watch(categoryKey as any) || ""}
            onChange={(e) => {
              form.setValue(categoryKey as any, e.target.value);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
      </div>
    );

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Behavioral Assessment Star Chart</h3>
        </div>
        
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-900 mb-2">Rating Scale:</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-blue-800">
            <div>⭐ 1 Star: Poor/Concerning</div>
            <div>⭐⭐ 2 Stars: Below Average</div>
            <div>⭐⭐⭐ 3 Stars: Average/Neutral</div>
            <div>⭐⭐⭐⭐ 4 Stars: Good</div>
            <div>⭐⭐⭐⭐⭐ 5 Stars: Excellent</div>
          </div>
        </div>

        <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
          {behaviorCategories.map((category) => (
            <StarRating
              key={category.key}
              categoryKey={category.key}
              ratingKey={category.ratingKey}
              label={category.label}
              description={category.description}
            />
          ))}
        </div>

        {/* Overall Intensity Rating */}
        <FormField
          control={form.control}
          name="intensity"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                Overall Behavior Intensity
              </FormLabel>
              <FormControl>
                <div className="flex items-center gap-2 p-3 bg-white rounded-lg border">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => field.onChange(level)}
                      className={`p-2 rounded-lg border-2 transition-all hover:scale-105 ${
                        field.value === level
                          ? "bg-red-50 border-red-400 shadow-md"
                          : "bg-white border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <Star
                        className={`h-6 w-6 ${
                          field.value === level
                            ? "fill-red-400 text-red-400"
                            : "text-gray-300"
                        }`}
                      />
                    </button>
                  ))}
                  <div className="ml-4 text-sm text-gray-600">
                    {field.value ? (
                      <span className="font-medium text-gray-800">
                        Overall Intensity: {field.value}/5
                      </span>
                    ) : (
                      <span>Rate overall behavior intensity</span>
                    )}
                  </div>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    );
  };

  const renderADLTextInput = () => {
    if (selectedType !== "adl") return null;

    return (
      <FormField
        control={form.control}
        name="adlDetails"
        render={({ field }) => (
          <FormItem>
            <FormLabel>ADL Assessment Details</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g., Independent with prompting, Requires full assistance, etc."
                {...field}
              />
            </FormControl>
            <p className="text-xs text-gray-500">
              Describe the level of assistance required or independence demonstrated
            </p>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📝 {isEditing ? "Edit Observation" : "Create New Observation"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Client Selection */}
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a client" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(clients as any[]).map((client) => (
                        <SelectItem key={client.id} value={client.id.toString()}>
                          <div className="flex items-center gap-2">
                            <span>{client.fullName}</span>
                            {client.ndisNumber && (
                              <Badge variant="outline" className="text-xs">
                                {client.ndisNumber}
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Observation Type */}
            <FormField
              control={form.control}
              name="observationType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observation Type</FormLabel>
                  <Select onValueChange={handleTypeChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select observation type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(OBSERVATION_TYPES).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Subtype */}
            {selectedTypeConfig && (
              <FormField
                control={form.control}
                name="subtype"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subtype</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select subtype (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {selectedTypeConfig.subtypes.map((subtype) => (
                          <SelectItem key={subtype} value={subtype}>
                            {subtype}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Date and Time */}
            <FormField
              control={form.control}
              name="timestamp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Date and Time
                    {!isAdmin && (
                      <Badge variant="outline" className="text-xs">
                        Auto-filled
                      </Badge>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      {...field}
                      disabled={!isAdmin && !isEditing}
                      className={!isAdmin && !isEditing ? "bg-gray-50" : ""}
                    />
                  </FormControl>
                  {!isAdmin && (
                    <p className="text-xs text-gray-500">
                      Only administrators can modify the timestamp
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Behavior Star Chart (for Behaviour observations) */}
            {renderBehaviorStarChart()}
            
            {/* ADL Details Input (for ADL observations) */}
            {renderADLTextInput()}

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observation Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the observation in detail..."
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-gray-500">
                    Minimum 10 characters required. Be specific and objective.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
                onClick={(e) => {
                  // Prevent rapid double-clicking
                  if (createMutation.isPending || isSubmitting) {
                    e.preventDefault();
                    return;
                  }
                }}
              >
                {(createMutation.isPending || isSubmitting)
                  ? (isEditing ? "Updating..." : "Creating...") 
                  : (isEditing ? "Update Observation" : "Create Observation")
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}