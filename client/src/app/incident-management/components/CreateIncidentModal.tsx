import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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

const incidentSchema = z.object({
  clientId: z.number({ required_error: "Please select a client" }),
  dateTime: z.string().min(1, "Date and time is required"),
  location: z.string().min(1, "Location is required"),
  witnessName: z.string().optional(),
  witnessPhone: z.string().optional(),
  types: z.array(z.string()).min(1, "At least one incident type is required"),
  isNDISReportable: z.boolean().default(false),
  triggers: z.array(z.object({
    label: z.string(),
    notes: z.string().optional(),
  })).default([]),
  intensityRating: z.number().min(1).max(10),
  staffResponses: z.array(z.object({
    label: z.string(),
    notes: z.string().optional(),
  })).default([]),
  description: z.string().min(10, "Description must be at least 10 characters"),
  externalRef: z.string().optional(),
});

type IncidentFormData = z.infer<typeof incidentSchema>;

interface CreateIncidentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
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

const TRIGGER_OPTIONS = [
  "Denied request",
  "Change in routine",
  "Sensory overload",
  "Social conflict",
  "Medical condition",
  "Medication change",
  "Environmental factors",
  "Communication breakdown",
  "Unmet needs",
  "Past trauma",
  "Other"
];

const RESPONSE_OPTIONS = [
  "De-escalation techniques",
  "Physical intervention",
  "Redirection",
  "Environmental modification",
  "Medication administration",
  "Medical attention",
  "Emergency services called",
  "Supervisor notified",
  "Family contacted",
  "Documentation completed",
  "Other"
];

export function CreateIncidentModal({ open, onOpenChange, onSuccess }: CreateIncidentModalProps) {
  const [selectedTriggers, setSelectedTriggers] = useState<Array<{ label: string; notes?: string }>>([]);
  const [selectedResponses, setSelectedResponses] = useState<Array<{ label: string; notes?: string }>>([]);
  const [newTrigger, setNewTrigger] = useState("");
  const [newResponse, setNewResponse] = useState("");

  const { toast } = useToast();

  const form = useForm<IncidentFormData>({
    resolver: zodResolver(incidentSchema),
    defaultValues: {
      types: [],
      isNDISReportable: false,
      triggers: [],
      intensityRating: 5,
      staffResponses: [],
      description: "",
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: () => fetch("/api/clients").then(res => res.json()),
  });

  const createIncidentMutation = useMutation({
    mutationFn: (data: IncidentFormData) => 
      apiRequest("/api/incident-reports", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          dateTime: new Date(data.dateTime).toISOString(),
          triggers: selectedTriggers,
          staffResponses: selectedResponses,
        }),
      }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Incident report created successfully",
      });
      onSuccess();
      form.reset();
      setSelectedTriggers([]);
      setSelectedResponses([]);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create incident report",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: IncidentFormData) => {
    createIncidentMutation.mutate(data);
  };

  const addTrigger = () => {
    if (newTrigger && !selectedTriggers.find(t => t.label === newTrigger)) {
      setSelectedTriggers([...selectedTriggers, { label: newTrigger, notes: "" }]);
      setNewTrigger("");
    }
  };

  const removeTrigger = (index: number) => {
    setSelectedTriggers(selectedTriggers.filter((_, i) => i !== index));
  };

  const updateTriggerNotes = (index: number, notes: string) => {
    const updated = [...selectedTriggers];
    updated[index].notes = notes;
    setSelectedTriggers(updated);
  };

  const addResponse = () => {
    if (newResponse && !selectedResponses.find(r => r.label === newResponse)) {
      setSelectedResponses([...selectedResponses, { label: newResponse, notes: "" }]);
      setNewResponse("");
    }
  };

  const removeResponse = (index: number) => {
    setSelectedResponses(selectedResponses.filter((_, i) => i !== index));
  };

  const updateResponseNotes = (index: number, notes: string) => {
    const updated = [...selectedResponses];
    updated[index].notes = notes;
    setSelectedResponses(updated);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Create Incident Report
          </DialogTitle>
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

                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Living room, Kitchen, Community area" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                          <Input placeholder="Witness contact number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="externalRef"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>External Reference</FormLabel>
                        <FormControl>
                          <Input placeholder="Police report, medical record, etc." {...field} />
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

            {/* NDIS Reportable */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">NDIS Reportable Incident</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="isNDISReportable"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          This incident is reportable to the NDIS Commission
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Check this if the incident involves serious injury, death, abuse, neglect, or exploitation
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Triggers */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Triggers/Contributing Factors</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Select value={newTrigger} onValueChange={setNewTrigger}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a trigger" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRIGGER_OPTIONS.map((trigger) => (
                        <SelectItem key={trigger} value={trigger}>{trigger}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" onClick={addTrigger} disabled={!newTrigger}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {selectedTriggers.length > 0 && (
                  <div className="space-y-2">
                    {selectedTriggers.map((trigger, index) => (
                      <div key={index} className="flex items-start gap-2 p-3 border rounded">
                        <Badge variant="outline" className="mt-1">{trigger.label}</Badge>
                        <Input
                          placeholder="Additional notes (optional)"
                          value={trigger.notes || ""}
                          onChange={(e) => updateTriggerNotes(index, e.target.value)}
                          className="flex-1"
                        />
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={() => removeTrigger(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Intensity Rating */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Intensity Rating *</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="intensityRating"
                  render={({ field }) => (
                    <FormItem>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label>Intensity Level: {field.value}/10</Label>
                          <Badge variant={field.value >= 8 ? "destructive" : field.value >= 5 ? "default" : "secondary"}>
                            {field.value >= 8 ? "High" : field.value >= 5 ? "Medium" : "Low"}
                          </Badge>
                        </div>
                        <Slider
                          min={1}
                          max={10}
                          step={1}
                          value={[field.value]}
                          onValueChange={(value) => field.onChange(value[0])}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>1 - Minor</span>
                          <span>5 - Moderate</span>
                          <span>10 - Severe</span>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Staff Responses */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Staff Responses</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Select value={newResponse} onValueChange={setNewResponse}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a response" />
                    </SelectTrigger>
                    <SelectContent>
                      {RESPONSE_OPTIONS.map((response) => (
                        <SelectItem key={response} value={response}>{response}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" onClick={addResponse} disabled={!newResponse}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {selectedResponses.length > 0 && (
                  <div className="space-y-2">
                    {selectedResponses.map((response, index) => (
                      <div key={index} className="flex items-start gap-2 p-3 border rounded">
                        <Badge variant="outline" className="mt-1">{response.label}</Badge>
                        <Input
                          placeholder="Additional notes (optional)"
                          value={response.notes || ""}
                          onChange={(e) => updateResponseNotes(index, e.target.value)}
                          className="flex-1"
                        />
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={() => removeResponse(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

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
              <Button type="submit" disabled={createIncidentMutation.isPending}>
                {createIncidentMutation.isPending ? "Creating..." : "Create Report"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}