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
  notes: z.string().min(10, "Notes must be at least 10 characters"),
  timestamp: z.string().min(1, "Please select a date and time"),
  intensity: z.number().min(1).max(5).optional(),
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
      intensity: undefined,
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
          notes: observation.notes,
          timestamp: format(new Date(observation.timestamp), "yyyy-MM-dd'T'HH:mm"),
          intensity: observation.intensity,
        });
        setSelectedType(observation.observationType);
      } else {
        form.reset({
          clientId: clientId?.toString() || "",
          observationType: "",
          subtype: "",
          notes: "",
          timestamp: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
          intensity: undefined,
        });
        setSelectedType("");
      }
    }
  }, [isOpen, observation, clientId, form]);

  const createMutation = useMutation({
    mutationFn: async (data: ObservationFormData) => {
      const payload = {
        clientId: parseInt(data.clientId),
        observationType: data.observationType,
        subtype: data.subtype || null,
        notes: data.notes,
        timestamp: new Date(data.timestamp).toISOString(),
        intensity: data.intensity || null,
        createdBy: user?.id,
        tenantId: user?.tenantId,
      };

      if (isEditing) {
        return apiRequest(`/api/observations/${observation.id}`, "PATCH", payload);
      } else {
        return apiRequest("/api/observations", "POST", payload);
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
      toast({
        title: "Error",
        description: error.message || "Failed to save observation.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: ObservationFormData) => {
    createMutation.mutate(data);
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

  const renderIntensitySelector = () => {
    if (!selectedTypeConfig?.hasIntensity) return null;

    return (
      <FormField
        control={form.control}
        name="intensity"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              Intensity Level
            </FormLabel>
            <FormControl>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => field.onChange(level)}
                    className={`p-2 rounded-lg border transition-colors ${
                      field.value === level
                        ? "bg-yellow-50 border-yellow-300 text-yellow-700"
                        : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    <Star
                      className={`h-5 w-5 ${
                        field.value === level
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }`}
                    />
                  </button>
                ))}
                <div className="ml-2 text-sm text-gray-600">
                  {field.value ? `Level ${field.value}` : "Select intensity"}
                </div>
              </div>
            </FormControl>
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

            {/* Intensity (for Behaviour observations) */}
            {renderIntensitySelector()}

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
                disabled={createMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {createMutation.isPending 
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