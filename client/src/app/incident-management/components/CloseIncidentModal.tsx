import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { CheckCircle, AlertTriangle, FileText, Shield, Activity, Users } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const closureSchema = z.object({
  incidentId: z.string(),
  controlReview: z.boolean(),
  improvements: z.string().optional(),
  implemented: z.boolean(),
  controlLevel: z.enum(["Elimination", "Engineering", "Behavioural", "Admin", "PPE", "None"]),
  wasLTI: z.enum(["yes", "no", "NA"]),
  hazard: z.enum(["Behavioural", "Medical", "Environmental", "Other"]),
  severity: z.enum(["Low", "Medium", "High", "Critical"]),
  externalNotice: z.boolean(),
  participantContext: z.enum(["yes", "no", "NA"]),
  supportPlanAvailable: z.enum(["yes", "no", "NA"]),
  reviewType: z.enum(["Root Cause", "Case Conference", "Support Team Review", "Corrective Action", "No Further Action"]),
  outcome: z.string().optional(),
  attachments: z.array(z.any()).default([]),
});

type ClosureFormData = z.infer<typeof closureSchema>;

interface IncidentReport {
  report: {
    id: number;
    incidentId: string;
    dateTime: string;
    location: string;
    types: string[];
    isNDISReportable: boolean;
    intensityRating: number;
    description: string;
    status: string;
  };
  client: {
    id: number;
    firstName: string;
    lastName: string;
    clientId: string;
  };
  staff: {
    id: number;
    firstName: string;
    lastName: string;
  };
}

interface CloseIncidentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incident: IncidentReport;
  onSuccess: () => void;
}

export function CloseIncidentModal({ open, onOpenChange, incident, onSuccess }: CloseIncidentModalProps) {
  const { toast } = useToast();

  const form = useForm<ClosureFormData>({
    resolver: zodResolver(closureSchema),
    defaultValues: {
      incidentId: incident.report.incidentId,
      controlReview: false,
      implemented: false,
      controlLevel: "None",
      wasLTI: "NA",
      hazard: "Other",
      severity: "Low",
      externalNotice: false,
      participantContext: "NA",
      supportPlanAvailable: "NA",
      reviewType: "No Further Action",
      attachments: [],
    },
  });

  const closeIncidentMutation = useMutation({
    mutationFn: (data: ClosureFormData) => 
      apiRequest("/api/incident-closures", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Incident closed successfully",
      });
      onSuccess();
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to close incident",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ClosureFormData) => {
    closeIncidentMutation.mutate(data);
  };

  const getControlLevelDescription = (level: string) => {
    switch (level) {
      case "Elimination": return "Remove the hazard completely";
      case "Engineering": return "Isolate people from the hazard";
      case "Behavioural": return "Change the way people work";
      case "Admin": return "Administrative controls and training";
      case "PPE": return "Personal protective equipment";
      case "None": return "No control measures applied";
      default: return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Close Incident: {incident.report.incidentId}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Complete the incident closure process with detailed review and documentation
          </p>
        </DialogHeader>

        {/* Incident Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-4 w-4" />
              Incident Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Client:</span> {incident.client.firstName} {incident.client.lastName} ({incident.client.clientId})
              </div>
              <div>
                <span className="font-medium">Staff:</span> {incident.staff.firstName} {incident.staff.lastName}
              </div>
              <div>
                <span className="font-medium">Location:</span> {incident.report.location}
              </div>
              <div>
                <span className="font-medium">Intensity:</span> {incident.report.intensityRating}/10
              </div>
              <div className="md:col-span-2">
                <span className="font-medium">Types:</span>
                <div className="flex gap-1 mt-1">
                  {incident.report.types.map((type, index) => (
                    <Badge key={index} variant="outline" className="text-xs">{type}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Risk Assessment */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Risk Assessment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="severity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Severity Level *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select severity" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Low">Low - Minor impact</SelectItem>
                            <SelectItem value="Medium">Medium - Moderate impact</SelectItem>
                            <SelectItem value="High">High - Significant impact</SelectItem>
                            <SelectItem value="Critical">Critical - Severe impact</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="hazard"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hazard Type *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select hazard type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Behavioural">Behavioural</SelectItem>
                            <SelectItem value="Medical">Medical</SelectItem>
                            <SelectItem value="Environmental">Environmental</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="wasLTI"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lost Time Injury *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select LTI status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="yes">Yes</SelectItem>
                            <SelectItem value="no">No</SelectItem>
                            <SelectItem value="NA">Not Applicable</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="externalNotice"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 mt-6">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>External Notice Required</FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Authorities, insurers, or regulatory bodies need to be notified
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Control Measures */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Control Measures
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="controlLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Control Level Applied *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select control level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Elimination">Elimination</SelectItem>
                          <SelectItem value="Engineering">Engineering</SelectItem>
                          <SelectItem value="Behavioural">Behavioural</SelectItem>
                          <SelectItem value="Admin">Administrative</SelectItem>
                          <SelectItem value="PPE">Personal Protective Equipment</SelectItem>
                          <SelectItem value="None">None</SelectItem>
                        </SelectContent>
                      </Select>
                      {field.value && (
                        <p className="text-xs text-muted-foreground">
                          {getControlLevelDescription(field.value)}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="controlReview"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Control Review Conducted</FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Existing controls were reviewed for effectiveness
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="implemented"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Improvements Implemented</FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Control measures or improvements have been put in place
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="improvements"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Improvements/Actions Taken</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe any improvements, corrective actions, or control measures implemented..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Review Process */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Review Process
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="reviewType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Review Type *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select review type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Root Cause">Root Cause Analysis</SelectItem>
                          <SelectItem value="Case Conference">Case Conference</SelectItem>
                          <SelectItem value="Support Team Review">Support Team Review</SelectItem>
                          <SelectItem value="Corrective Action">Corrective Action Review</SelectItem>
                          <SelectItem value="No Further Action">No Further Action Required</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="participantContext"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Participant Context Considered *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select option" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="yes">Yes</SelectItem>
                            <SelectItem value="no">No</SelectItem>
                            <SelectItem value="NA">Not Applicable</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="supportPlanAvailable"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Support Plan Available *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select option" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="yes">Yes</SelectItem>
                            <SelectItem value="no">No</SelectItem>
                            <SelectItem value="NA">Not Applicable</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Final Outcome */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Final Outcome
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="outcome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Outcome Summary</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Summarize the final outcome, lessons learned, and any ongoing monitoring requirements..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Include any follow-up actions, monitoring requirements, or recommendations
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Warning Notice */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-800">Important Notice</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Closing this incident will change its status to "Closed" and create a permanent closure record. 
                    This action cannot be undone. Ensure all information is accurate and complete.
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={closeIncidentMutation.isPending}>
                {closeIncidentMutation.isPending ? "Closing..." : "Close Incident"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}