import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Plus, X, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { TriggerSelector } from "./TriggerSelector";
import { StaffResponseSelector } from "./StaffResponseSelector";

const incidentSchema = z.object({
  clientId: z.number({ required_error: "Please select a client" }),
  dateTime: z.string().min(1, "Date and time is required"),
  location: z.string().optional(),
  intensityRating: z.number().optional(),
  witnessName: z.string().optional(),
  witnessPhone: z.string().optional(),
  externalReference: z.string().optional(),
  types: z.array(z.string()).min(1, "At least one incident type is required"),
  triggers: z.array(z.object({
    id: z.string(),
    label: z.string(),
    details: z.string()
  })).min(1, "At least one trigger must be selected"),
  staffResponses: z.array(z.object({
    id: z.string(),
    label: z.string(),
    details: z.string()
  })).min(1, "At least one staff response must be selected"),
  description: z.string().min(10, "Description must be at least 10 characters"),
});

type IncidentFormData = z.infer<typeof incidentSchema>;

interface CreateIncidentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultClientId?: number;
}

const INCIDENT_TYPES = [
  "Physical aggression towards others",
  "Verbal aggression towards others", 
  "Property damage",
  "Self-harm",
  "Medical emergency",
  "Environmental hazard",
  "Medication error",
  "Unauthorized absence",
  "Sexual misconduct",
  "Financial exploitation",
  "Neglect",
  "Other"
];

// Note: Trigger and response options are now handled by dedicated selector components

export function CreateIncidentModal({ open, onOpenChange, onSuccess, defaultClientId }: CreateIncidentModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<IncidentFormData>({
    resolver: zodResolver(incidentSchema),
    defaultValues: {
      clientId: defaultClientId,
      types: [],
      triggers: [],
      staffResponses: [],
      description: "",
      dateTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"), // Auto-set to current time
      location: "",
      intensityRating: 1, // Default to 1 to prevent validation error
      witnessName: "",
      witnessPhone: "",
      externalReference: "",
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: () => apiRequest("GET", "/api/clients"),
  });

  const createIncidentMutation = useMutation({
    mutationFn: (data: IncidentFormData) => 
      apiRequest("POST", "/api/incident-reports", {
        ...data,
        dateTime: new Date(data.dateTime).toISOString(),
        triggers: data.triggers || [],
        staffResponses: data.staffResponses || [],
      }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Incident report created successfully",
      });
      // Invalidate queries to refresh the incident list
      queryClient.invalidateQueries({ queryKey: ["/api/incident-reports"] });
      onSuccess();
      form.reset();
    },
    onError: (error: any) => {
      console.error("Incident creation error:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to create incident report",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: IncidentFormData) => {
    // Prevent duplicate submissions
    if (createIncidentMutation.isPending) {
      return;
    }
    
    // CRITICAL FIX: Preserve the actual description field and ensure no contamination
    const preservedDescription = data.description || "";
    
    // DEBUG: Log form data to identify corruption source
    console.log("[INCIDENT FORM DEBUG] Raw form data:", data);
    console.log("[INCIDENT FORM DEBUG] Preserved description:", preservedDescription);
    console.log("[INCIDENT FORM DEBUG] Triggers count:", data.triggers?.length || 0);
    console.log("[INCIDENT FORM DEBUG] Staff Responses count:", data.staffResponses?.length || 0);
    console.log("[INCIDENT FORM DEBUG] Triggers details:", data.triggers?.map(t => ({ id: t.id, label: t.label, details: t.details })));
    console.log("[INCIDENT FORM DEBUG] Staff responses details:", data.staffResponses?.map(r => ({ id: r.id, label: r.label, details: r.details })));
    
    // Auto-populate timestamp with current time for immediate reporting
    const submissionData = {
      ...data,
      description: preservedDescription, // Explicitly preserve description
      dateTime: format(new Date(), "yyyy-MM-dd'T'HH:mm")
    };
    
    console.log("[INCIDENT FORM DEBUG] Final submission data with preserved description:", submissionData);
    
    createIncidentMutation.mutate(submissionData, {
      onSuccess: () => {
        console.log("[INCIDENT CREATION] Success - invalidating cache and refreshing data");
        // Force immediate cache invalidation
        queryClient.invalidateQueries({ queryKey: ["/api/incident-reports"] });
        queryClient.refetchQueries({ queryKey: ["/api/incident-reports"] });
      }
    });
  };



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="incident-form-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Create Incident Report
          </DialogTitle>
          <p id="incident-form-description" className="text-sm text-muted-foreground">
            Create a new incident report with basic details and description.
          </p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="clientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client *</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select client" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {clients.map((client: any) => (
                              <SelectItem key={client.id} value={client.id.toString()}>
                                {client.firstName} {client.lastName} ({client.clientId})
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
                    name="dateTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date & Time *</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input placeholder="Where did the incident occur?" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="intensityRating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Intensity Rating (1-10)</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select intensity" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {[1,2,3,4,5,6,7,8,9,10].map((num) => (
                              <SelectItem key={num} value={num.toString()}>
                                {num} - {num <= 3 ? 'Low' : num <= 6 ? 'Medium' : num <= 8 ? 'High' : 'Critical'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="witnessName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Witness Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Name of witness (if any)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="witnessPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Witness Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="Contact number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div>
                  <FormField
                    control={form.control}
                    name="externalReference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>External Reference</FormLabel>
                        <FormControl>
                          <Input placeholder="External system reference or ID" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Incident Types */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Incident Types *</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="types"
                  render={({ field }) => (
                    <FormItem>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {INCIDENT_TYPES.map((type) => (
                          <div key={type} className="flex items-center space-x-2">
                            <Checkbox
                              id={type}
                              checked={field.value?.includes(type)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange([...field.value, type]);
                                } else {
                                  field.onChange(field.value?.filter((t) => t !== type));
                                }
                              }}
                            />
                            <Label htmlFor={type} className="text-sm">{type}</Label>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Triggers Section */}
            <FormField
              control={form.control}
              name="triggers"
              render={({ field }) => (
                <FormItem>
                  <TriggerSelector
                    value={field.value || []}
                    onChange={field.onChange}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Staff Responses Section */}
            <FormField
              control={form.control}
              name="staffResponses"
              render={({ field }) => (
                <FormItem>
                  <StaffResponseSelector
                    value={field.value || []}
                    onChange={field.onChange}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />





            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Detailed Description *</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          placeholder="Provide a detailed description of the incident, including what happened before, during, and after..."
                          className="min-h-[120px]"
                          {...field}
                          onChange={(e) => {
                            console.log("[DESCRIPTION DEBUG] User typing in description:", e.target.value);
                            field.onChange(e);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createIncidentMutation.isPending}
                onClick={(e) => {
                  // Prevent rapid double-clicking
                  if (createIncidentMutation.isPending) {
                    e.preventDefault();
                    return;
                  }
                }}
              >
                {createIncidentMutation.isPending ? "Creating..." : "Create Report"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}