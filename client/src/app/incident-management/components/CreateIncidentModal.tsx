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
import { format } from "date-fns";

const incidentSchema = z.object({
  clientId: z.number({ required_error: "Please select a client" }),
  dateTime: z.string().min(1, "Date and time is required"),
  types: z.array(z.string()).min(1, "At least one incident type is required"),
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

export function CreateIncidentModal({ open, onOpenChange, onSuccess, defaultClientId }: CreateIncidentModalProps) {

  const { toast } = useToast();

  const form = useForm<IncidentFormData>({
    resolver: zodResolver(incidentSchema),
    defaultValues: {
      clientId: defaultClientId,
      types: [],
      description: "",
      dateTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"), // Auto-set to current time
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: () => fetch("/api/clients").then(res => res.json()),
  });

  const createIncidentMutation = useMutation({
    mutationFn: (data: IncidentFormData) => 
      apiRequest("POST", "/api/incident-reports", {
        ...data,
        dateTime: new Date(data.dateTime).toISOString(),
      }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Incident report created successfully",
      });
      onSuccess();
      form.reset();
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
    // Prevent duplicate submissions
    if (createIncidentMutation.isPending) {
      return;
    }
    
    // Auto-populate timestamp with current time for immediate reporting
    const submissionData = {
      ...data,
      dateTime: format(new Date(), "yyyy-MM-dd'T'HH:mm")
    };
    
    createIncidentMutation.mutate(submissionData);
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