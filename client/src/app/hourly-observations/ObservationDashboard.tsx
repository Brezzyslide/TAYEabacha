import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Search, Download, FileText, Grid3X3, List, Filter, Home, Eye, Star, Clock, User, X, ZoomIn } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";


type ViewMode = "card" | "list";
type FilterType = "all" | "behaviour" | "adl";

// Observation form schema with conditional validation
const observationSchema = z.object({
  clientId: z.number({ required_error: "Please select a client" }),
  observationType: z.enum(["behaviour", "adl"], {
    required_error: "Please select an observation type"
  }),
  subtype: z.string().optional(),
  notes: z.string().optional(),
  timestamp: z.date({ required_error: "Please select a date and time" }),
  // Behaviour-specific star chart fields
  settings: z.string().optional(),
  settingsRating: z.number().min(1).max(5).optional(),
  time: z.string().optional(),
  timeRating: z.number().min(1).max(5).optional(),
  antecedents: z.string().optional(),
  antecedentsRating: z.number().min(1).max(5).optional(),
  response: z.string().optional(),
  responseRating: z.number().min(1).max(5).optional(),
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

// ADL subtypes for Activities of Daily Living observations
const adlSubtypes = [
  "Sleep",
  "Eating/Nutrition",
  "Personal Hygiene",
  "Meal Preparation", 
  "Medication Administration",
  "Mobility Assistance",
  "Communication Support",
  "Household Tasks",
  "Toileting Assistance",
  "Dressing/Grooming",
  "Transportation",
  "Shopping/Errands"
];

type ObservationFormData = z.infer<typeof observationSchema>;

// Observation display components
const ObservationCard = ({ observation, clientName, onQuickView, onExportPDF }: { 
  observation: any; 
  clientName: string; 
  onQuickView: (obs: any) => void;
  onExportPDF?: (obs: any) => void;
}) => (
  <Card className="mb-4">
    <CardHeader>
      <div className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Eye className="w-5 h-5" />
          <span className={`px-2 py-1 rounded text-xs ${
            observation.observationType === 'behaviour' 
              ? 'bg-red-100 text-red-800' 
              : 'bg-blue-100 text-blue-800'
          }`}>
            {observation.observationType === 'behaviour' ? 'Behaviour' : 'ADL'}
          </span>
        </CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onQuickView(observation)}
            className="gap-1"
          >
            <ZoomIn className="w-4 h-4" />
            View
          </Button>
          {onExportPDF && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onExportPDF(observation)}
              className="gap-1"
            >
              <FileText className="w-4 h-4" />
              PDF
            </Button>
          )}
        </div>
      </div>
    </CardHeader>
    <CardContent>
      {/* ADL Observation */}
      {observation.observationType === 'adl' && (
        <div className="space-y-3">
          {observation.subtype && (
            <div>
              <span className="text-sm font-medium text-gray-700">Activity:</span>
              <p className="text-sm text-gray-900 mt-1">{observation.subtype}</p>
            </div>
          )}
          {observation.notes && (
            <div>
              <span className="text-sm font-medium text-gray-700">Notes:</span>
              <p className="text-sm text-gray-900 mt-1 line-clamp-3">{observation.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Behaviour Observation with Star Chart */}
      {observation.observationType === 'behaviour' && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Star Chart Assessment</h4>
          
          {/* Settings */}
          {observation.settings && (
            <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
              <div className="flex-1">
                <span className="text-xs font-medium text-gray-600">Settings</span>
                <p className="text-xs text-gray-800 line-clamp-2">{observation.settings}</p>
              </div>
              <div className="flex items-center ml-2">
                {[1,2,3,4,5].map(star => (
                  <span key={star} className={`text-sm ${
                    star <= (observation.settingsRating || 0) ? 'text-yellow-500' : 'text-gray-300'
                  }`}>★</span>
                ))}
              </div>
            </div>
          )}

          {/* Time */}
          {observation.time && (
            <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
              <div className="flex-1">
                <span className="text-xs font-medium text-gray-600">Time</span>
                <p className="text-xs text-gray-800 line-clamp-2">{observation.time}</p>
              </div>
              <div className="flex items-center ml-2">
                {[1,2,3,4,5].map(star => (
                  <span key={star} className={`text-sm ${
                    star <= (observation.timeRating || 0) ? 'text-yellow-500' : 'text-gray-300'
                  }`}>★</span>
                ))}
              </div>
            </div>
          )}

          {/* Antecedents */}
          {observation.antecedents && (
            <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
              <div className="flex-1">
                <span className="text-xs font-medium text-gray-600">Antecedents</span>
                <p className="text-xs text-gray-800 line-clamp-2">{observation.antecedents}</p>
              </div>
              <div className="flex items-center ml-2">
                {[1,2,3,4,5].map(star => (
                  <span key={star} className={`text-sm ${
                    star <= (observation.antecedentsRating || 0) ? 'text-yellow-500' : 'text-gray-300'
                  }`}>★</span>
                ))}
              </div>
            </div>
          )}

          {/* Response */}
          {observation.response && (
            <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
              <div className="flex-1">
                <span className="text-xs font-medium text-gray-600">Response</span>
                <p className="text-xs text-gray-800 line-clamp-2">{observation.response}</p>
              </div>
              <div className="flex items-center ml-2">
                {[1,2,3,4,5].map(star => (
                  <span key={star} className={`text-sm ${
                    star <= (observation.responseRating || 0) ? 'text-yellow-500' : 'text-gray-300'
                  }`}>★</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 text-sm text-gray-500 mt-4 pt-3 border-t">
        <Clock className="w-4 h-4" />
        <span>{observation.timestamp ? new Date(observation.timestamp).toLocaleString() : 'No date'}</span>
        <span>•</span>
        <User className="w-4 h-4" />
        <span>{clientName}</span>
      </div>
    </CardContent>
  </Card>
);

const ObservationRow = ({ observation, clientName, isLast, onQuickView, onExportPDF }: { 
  observation: any; 
  clientName: string; 
  isLast: boolean;
  onQuickView?: (obs: any) => void;
  onExportPDF?: (obs: any) => void;
}) => (
  <div className={`flex items-center justify-between p-4 ${!isLast ? 'border-b' : ''}`}>
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="font-medium">{observation.observationType || 'Observation'}</h3>
        {observation.intensity && (
          <Badge variant="secondary" className="text-xs">
            {observation.intensity}/5
          </Badge>
        )}
      </div>
      <p className="text-gray-600 text-sm mb-1">{observation.notes || 'No notes'}</p>
      <p className="text-xs text-gray-500">Client: {clientName}</p>
      {observation.subtype && (
        <p className="text-xs text-blue-600">Subtype: {observation.subtype}</p>
      )}
    </div>
    <div className="flex items-center gap-2">
      <div className="text-sm text-gray-500 text-right mr-4">
        <p>{observation.timestamp ? new Date(observation.timestamp).toLocaleDateString() : 'No date'}</p>
        <p className="text-xs">{observation.timestamp ? new Date(observation.timestamp).toLocaleTimeString() : ''}</p>
      </div>
      <div className="flex gap-2">
        {onQuickView && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onQuickView(observation)}
            className="gap-1"
          >
            <ZoomIn className="w-4 h-4" />
            View
          </Button>
        )}
        {onExportPDF && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onExportPDF(observation)}
            className="gap-1"
          >
            <FileText className="w-4 h-4" />
            PDF
          </Button>
        )}
      </div>
    </div>
  </div>
);

const ObservationFormModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<ObservationFormData>({
    resolver: zodResolver(observationSchema),
    defaultValues: {
      timestamp: new Date(),
      observationType: "behaviour",
      clientId: 0
    }
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: ObservationFormData) => {
      // Clean the data to match server expectations
      let cleanData: any = {
        clientId: data.clientId,
        observationType: data.observationType,
        timestamp: data.timestamp.toISOString(),
      };

      if (data.observationType === "behaviour") {
        // For behaviour observations, send star chart data
        cleanData = {
          ...cleanData,
          settings: data.settings,
          settingsRating: data.settingsRating,
          time: data.time,
          timeRating: data.timeRating,
          antecedents: data.antecedents,
          antecedentsRating: data.antecedentsRating,
          response: data.response,
          responseRating: data.responseRating,
        };
      } else {
        // For ADL observations, send subtype and notes
        cleanData = {
          ...cleanData,
          subtype: data.subtype,
          notes: data.notes,
        };
      }
      
      console.log("Sending observation data:", cleanData);
      
      const response = await fetch("/api/observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Server response error:", errorData);
        throw new Error(errorData.message || "Failed to create observation");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/observations"] });
      toast({
        title: "Success",
        description: "Observation created successfully",
      });
      form.reset();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create observation",
        variant: "destructive",
      });
    },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (data: ObservationFormData) => {
    // Prevent duplicate submissions
    if (createMutation.isPending || isSubmitting) {
      console.log("[OBSERVATION DASHBOARD] Submission blocked - already in progress");
      return;
    }
    
    console.log("[OBSERVATION DASHBOARD] Starting submission:", data);
    setIsSubmitting(true);
    
    try {
      await createMutation.mutateAsync(data);
    } catch (error) {
      console.error("[OBSERVATION DASHBOARD] Submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Observation</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {/* Client Selection */}
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client</FormLabel>
                    <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select client" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(clients as any[]).map((client) => (
                          <SelectItem key={client.id} value={client.id.toString()}>
                            {client.fullName} ({client.ndisNumber})
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="behaviour">Behaviour</SelectItem>
                        <SelectItem value="adl">Activities of Daily Living</SelectItem>

                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Timestamp */}
            <FormField
              control={form.control}
              name="timestamp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date & Time *</FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      value={field.value ? new Date(field.value.getTime() - field.value.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
                      onChange={(e) => field.onChange(new Date(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Conditional content based on observation type */}
            {form.watch("observationType") === "behaviour" ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Star Chart Assessment</h3>
                
                {/* Settings */}
                <div className="grid grid-cols-3 gap-4 items-end">
                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name="settings"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Settings</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Describe the environmental settings during the incident"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="settingsRating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contribution (1-5)</FormLabel>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <button
                              key={rating}
                              type="button"
                              onClick={() => field.onChange(rating)}
                              className={`w-8 h-8 ${
                                field.value >= rating ? 'text-yellow-400' : 'text-gray-300'
                              }`}
                            >
                              <Star className="w-full h-full fill-current" />
                            </button>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Time */}
                <div className="grid grid-cols-3 gap-4 items-end">
                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name="time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Describe the timing factors related to the incident"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="timeRating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contribution (1-5)</FormLabel>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <button
                              key={rating}
                              type="button"
                              onClick={() => field.onChange(rating)}
                              className={`w-8 h-8 ${
                                field.value >= rating ? 'text-yellow-400' : 'text-gray-300'
                              }`}
                            >
                              <Star className="w-full h-full fill-current" />
                            </button>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Antecedents */}
                <div className="grid grid-cols-3 gap-4 items-end">
                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name="antecedents"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Antecedents</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Describe what happened before the incident"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="antecedentsRating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contribution (1-5)</FormLabel>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <button
                              key={rating}
                              type="button"
                              onClick={() => field.onChange(rating)}
                              className={`w-8 h-8 ${
                                field.value >= rating ? 'text-yellow-400' : 'text-gray-300'
                              }`}
                            >
                              <Star className="w-full h-full fill-current" />
                            </button>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Response */}
                <div className="grid grid-cols-3 gap-4 items-end">
                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name="response"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Response</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Describe how the incident was handled"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="responseRating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contribution (1-5)</FormLabel>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <button
                              key={rating}
                              type="button"
                              onClick={() => field.onChange(rating)}
                              className={`w-8 h-8 ${
                                field.value >= rating ? 'text-yellow-400' : 'text-gray-300'
                              }`}
                            >
                              <Star className="w-full h-full fill-current" />
                            </button>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            ) : (
              /* ADL Form */
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="subtype"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ADL Activity Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select ADL activity" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {adlSubtypes.map((subtype) => (
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
                
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe the ADL activity and any observations"
                          className="min-h-[100px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Timestamp */}
            <FormField
              control={form.control}
              name="timestamp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date & Time</FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      value={field.value?.toISOString().slice(0, 16)}
                      onChange={(e) => field.onChange(new Date(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
              >
                {(createMutation.isPending || isSubmitting) ? "Creating..." : "Create Observation"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default function ObservationDashboard() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<FilterType>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [dateRangeStart, setDateRangeStart] = useState<string>("");
  const [dateRangeEnd, setDateRangeEnd] = useState<string>("");
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);
  const [selectedObservation, setSelectedObservation] = useState<any>(null);

  // Fetch observations
  const { data: observations = [], isLoading } = useQuery({
    queryKey: ["/api/observations"],
    refetchInterval: 30000,
  });

  // Fetch clients for filter dropdown
  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
  });

  // Filter observations based on search and filters
  const filteredObservations = useMemo(() => {
    let filtered = [...(observations as any[])];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter((obs: any) => {
        const client = (clients as any[]).find(c => c.id === obs.clientId);
        const clientName = client?.fullName || "";
        const ndisNumber = client?.ndisNumber || "";
        
        return (
          clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ndisNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          obs.notes.toLowerCase().includes(searchTerm.toLowerCase()) ||
          obs.observationType.toLowerCase().includes(searchTerm.toLowerCase())
        );
      });
    }

    // Client filter
    if (selectedClient !== "all") {
      filtered = filtered.filter((obs: any) => obs.clientId === parseInt(selectedClient));
    }

    // Type filter
    if (selectedType !== "all") {
      filtered = filtered.filter((obs: any) => 
        obs.observationType.toLowerCase() === selectedType
      );
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      
      switch (dateFilter) {
        case "today":
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayEnd = new Date();
          todayEnd.setHours(23, 59, 59, 999);
          filtered = filtered.filter((obs: any) => {
            const obsDate = new Date(obs.timestamp);
            return obsDate >= todayStart && obsDate <= todayEnd;
          });
          break;
        case "week":
          const weekStart = new Date();
          weekStart.setDate(now.getDate() - 7);
          weekStart.setHours(0, 0, 0, 0);
          filtered = filtered.filter((obs: any) => 
            new Date(obs.timestamp) >= weekStart
          );
          break;
        case "month":
          const monthStart = new Date();
          monthStart.setMonth(now.getMonth() - 1);
          monthStart.setHours(0, 0, 0, 0);
          filtered = filtered.filter((obs: any) => 
            new Date(obs.timestamp) >= monthStart
          );
          break;
        case "custom":
          if (dateRangeStart && dateRangeEnd) {
            const rangeStart = new Date(dateRangeStart);
            rangeStart.setHours(0, 0, 0, 0);
            const rangeEnd = new Date(dateRangeEnd);
            rangeEnd.setHours(23, 59, 59, 999);
            filtered = filtered.filter((obs: any) => {
              const obsDate = new Date(obs.timestamp);
              return obsDate >= rangeStart && obsDate <= rangeEnd;
            });
          }
          break;
      }
    }

    // Sort by timestamp (newest first)
    return filtered.sort((a: any, b: any) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [observations, clients, searchTerm, selectedClient, selectedType, dateFilter, dateRangeStart, dateRangeEnd]);

  const getClientName = (clientId: number) => {
    const client = (clients as any[]).find(c => c.id === clientId);
    return client?.fullName || "Unknown Client";
  };

  const handleQuickView = (observation: any) => {
    setSelectedObservation(observation);
    setIsQuickViewOpen(true);
  };

  const handleExportPDF = async () => {
    try {
      const response = await apiRequest("POST", "/api/observations/export/pdf", {
        clientId: selectedClient !== "all" ? parseInt(selectedClient) : null,
        observationType: selectedType !== "all" ? selectedType : null,
        dateFilter,
        dateRangeStart: dateFilter === "custom" ? dateRangeStart : null,
        dateRangeEnd: dateFilter === "custom" ? dateRangeEnd : null,
        searchTerm: searchTerm || null,
        observations: filteredObservations
      });
      
      // Convert base64 to blob and download
      const pdfBlob = new Blob([Uint8Array.from(atob(response.pdf), c => c.charCodeAt(0))], { type: 'application/pdf' });
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `observations-export-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("PDF export failed:", error);
    }
  };

  const handleExportExcel = async () => {
    try {
      console.log("[EXCEL EXPORT DEBUG] Starting Excel export...");
      console.log("[EXCEL EXPORT DEBUG] Filtered observations count:", filteredObservations.length);
      
      if (filteredObservations.length === 0) {
        console.error("[EXCEL EXPORT DEBUG] No observations to export");
        return;
      }
      
      const response = await apiRequest("POST", "/api/observations/export/excel", {
        clientId: selectedClient !== "all" ? parseInt(selectedClient) : null,
        observationType: selectedType !== "all" ? selectedType : null,
        dateFilter,
        dateRangeStart: dateFilter === "custom" ? dateRangeStart : null,
        dateRangeEnd: dateFilter === "custom" ? dateRangeEnd : null,
        searchTerm: searchTerm || null,
        observations: filteredObservations
      });
      
      console.log("[EXCEL EXPORT DEBUG] Response received:", !!response?.excel);
      
      if (!response?.excel) {
        throw new Error("No Excel data received from server");
      }
      
      // Convert base64 to blob and download
      const excelBlob = new Blob([Uint8Array.from(atob(response.excel), c => c.charCodeAt(0))], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = URL.createObjectURL(excelBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `observations-export-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log("[EXCEL EXPORT DEBUG] Excel download completed");
    } catch (error) {
      console.error("Excel export failed:", error);
    }
  };

  const handleIndividualPDF = async (observation: any) => {
    try {
      console.log("[OBSERVATION PDF DEBUG] Starting PDF export for observation:", observation.id);
      
      // Use fetch directly to handle binary response properly
      const response = await fetch(`/api/observations/${observation.id}/pdf`, {
        method: 'GET',
        credentials: 'include',
      });
      
      console.log("[OBSERVATION PDF DEBUG] Response status:", response.status);
      
      if (!response.ok) {
        console.error("[OBSERVATION PDF DEBUG] Response not ok:", response.statusText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Get PDF as blob directly from response
      const blob = await response.blob();
      console.log("[OBSERVATION PDF DEBUG] Blob created, size:", blob.size);
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const clientName = getClientName(observation.clientId);
      a.download = `observation-${observation.id}-${clientName}-${new Date(observation.timestamp).toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log("[OBSERVATION PDF DEBUG] PDF download completed");
    } catch (error) {
      console.error("[OBSERVATION PDF DEBUG] PDF export failed:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <Home className="w-4 h-4" />
              Dashboard
            </Button>
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">Hourly Observations</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Hourly Observations</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Track and manage client observations and behavioral data
          </p>
        </div>

        {/* Controls */}
        <div className="mb-6 space-y-4">
          {/* Top Row - Search and Actions */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by client name, NDIS number, or keywords..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Export PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export Excel
              </Button>
              <Button
                onClick={() => setIsFormModalOpen(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Create New Observation
              </Button>
            </div>
          </div>

          {/* Second Row - Filters and View Toggle */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>
              </div>

              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {(clients as any[]).map((client) => (
                    <SelectItem key={client.id} value={client.id.toString()}>
                      {client.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedType} onValueChange={(value: FilterType) => setSelectedType(value)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="behaviour">Behaviour</SelectItem>
                  <SelectItem value="adl">ADL</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Dates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Past Week</SelectItem>
                  <SelectItem value="month">Past Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Date Range Inputs for Custom Filter */}
              {dateFilter === "custom" && (
                <div className="flex gap-2 items-center">
                  <Input
                    type="date"
                    value={dateRangeStart}
                    onChange={(e) => setDateRangeStart(e.target.value)}
                    className="w-[140px]"
                    placeholder="Start Date"
                  />
                  <span className="text-sm text-gray-500">to</span>
                  <Input
                    type="date"
                    value={dateRangeEnd}
                    onChange={(e) => setDateRangeEnd(e.target.value)}
                    className="w-[140px]"
                    placeholder="End Date"
                  />
                </div>
              )}
            </div>

            {/* View Toggle */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <Button
                variant={viewMode === "card" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("card")}
                className="flex items-center gap-2"
              >
                <Grid3X3 className="h-4 w-4" />
                Cards
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="flex items-center gap-2"
              >
                <List className="h-4 w-4" />
                List
              </Button>
            </div>
          </div>

          {/* Results Summary */}
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-sm">
              {filteredObservations.length} observation{filteredObservations.length !== 1 ? 's' : ''} found
            </Badge>
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchTerm("")}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear search
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        {filteredObservations.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <div className="text-gray-400 mb-4">📝</div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No observations found
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {searchTerm || selectedClient !== "all" || selectedType !== "all" || dateFilter !== "all"
                  ? "Try adjusting your filters or search terms."
                  : "Get started by creating your first observation."
                }
              </p>
              <Button
                onClick={() => setIsFormModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Observation
              </Button>
            </CardContent>
          </Card>
        ) : viewMode === "card" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredObservations.map((observation: any) => (
              <ObservationCard
                key={observation.id}
                observation={observation}
                clientName={getClientName(observation.clientId)}
                onQuickView={handleQuickView}
                onExportPDF={handleIndividualPDF}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Observations List</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-0">
                {filteredObservations.map((observation: any, index: number) => (
                  <ObservationRow
                    key={observation.id}
                    observation={observation}
                    clientName={getClientName(observation.clientId)}
                    isLast={index === filteredObservations.length - 1}
                    onQuickView={handleQuickView}
                    onExportPDF={handleIndividualPDF}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <ObservationFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
      />

      {/* Quick View Modal */}
      <Dialog open={isQuickViewOpen} onOpenChange={setIsQuickViewOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Observation Details - {selectedObservation?.observationType === 'behaviour' ? 'Behaviour' : 'ADL'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedObservation && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-gray-700">Date & Time:</span>
                  <p className="text-sm text-gray-900 mt-1">
                    {new Date(selectedObservation.timestamp).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-700">Client:</span>
                  <p className="text-sm text-gray-900 mt-1">
                    {getClientName(selectedObservation.clientId)}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-700">Type:</span>
                  <p className="text-sm text-gray-900 mt-1">
                    <span className={`px-2 py-1 rounded text-xs ${
                      selectedObservation.observationType === 'behaviour' 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {selectedObservation.observationType === 'behaviour' ? 'Behaviour' : 'ADL'}
                    </span>
                  </p>
                </div>
              </div>

              {/* ADL Observation Details */}
              {selectedObservation.observationType === 'adl' && (
                <div className="space-y-4">
                  {selectedObservation.subtype && (
                    <div>
                      <span className="text-sm font-medium text-gray-700">Activity Type:</span>
                      <p className="text-sm text-gray-900 mt-1 p-3 bg-green-50 rounded">
                        {selectedObservation.subtype}
                      </p>
                    </div>
                  )}
                  {selectedObservation.notes && (
                    <div>
                      <span className="text-sm font-medium text-gray-700">Notes:</span>
                      <p className="text-sm text-gray-900 mt-1 p-3 bg-gray-50 rounded whitespace-pre-wrap">
                        {selectedObservation.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Behaviour Observation Details (Star Chart) */}
              {selectedObservation.observationType === 'behaviour' && (
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Star Chart Assessment</h4>
                  
                  {selectedObservation.settings && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-base font-medium text-gray-700">Settings</span>
                        <div className="flex items-center space-x-1">
                          {[1,2,3,4,5].map(star => (
                            <span key={star} className={`text-lg ${
                              star <= (selectedObservation.settingsRating || 0) ? 'text-yellow-500' : 'text-gray-300'
                            }`}>★</span>
                          ))}
                          <span className="text-sm text-gray-500 ml-2">({selectedObservation.settingsRating}/5)</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedObservation.settings}</p>
                    </div>
                  )}

                  {selectedObservation.time && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-base font-medium text-gray-700">Time</span>
                        <div className="flex items-center space-x-1">
                          {[1,2,3,4,5].map(star => (
                            <span key={star} className={`text-lg ${
                              star <= (selectedObservation.timeRating || 0) ? 'text-yellow-500' : 'text-gray-300'
                            }`}>★</span>
                          ))}
                          <span className="text-sm text-gray-500 ml-2">({selectedObservation.timeRating}/5)</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedObservation.time}</p>
                    </div>
                  )}

                  {selectedObservation.antecedents && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-base font-medium text-gray-700">Antecedents</span>
                        <div className="flex items-center space-x-1">
                          {[1,2,3,4,5].map(star => (
                            <span key={star} className={`text-lg ${
                              star <= (selectedObservation.antecedentsRating || 0) ? 'text-yellow-500' : 'text-gray-300'
                            }`}>★</span>
                          ))}
                          <span className="text-sm text-gray-500 ml-2">({selectedObservation.antecedentsRating}/5)</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedObservation.antecedents}</p>
                    </div>
                  )}

                  {selectedObservation.response && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-base font-medium text-gray-700">Response</span>
                        <div className="flex items-center space-x-1">
                          {[1,2,3,4,5].map(star => (
                            <span key={star} className={`text-lg ${
                              star <= (selectedObservation.responseRating || 0) ? 'text-yellow-500' : 'text-gray-300'
                            }`}>★</span>
                          ))}
                          <span className="text-sm text-gray-500 ml-2">({selectedObservation.responseRating}/5)</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedObservation.response}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}