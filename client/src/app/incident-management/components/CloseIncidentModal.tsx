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
  findings: z.string().min(1, "Findings are required"),
  rootCause: z.string().optional(),
  recommendations: z.string().min(1, "Recommendations are required"),
  outcomes: z.array(z.string()).default([]),
  controls: z.array(z.string()).default([]),
  externalReporting: z.array(z.string()).default([]),
  externalReference: z.string().optional(),
  followUpDate: z.string().optional(),
  status: z.enum([
    "Closed – All actions complete",
    "Closed – Monitoring required", 
    "Escalated – Senior management review",
    "Pending – Awaiting documentation",
    "In Progress – Follow-up underway"
  ]),
});

type ClosureFormData = z.infer<typeof closureSchema>;

interface IncidentReport {
  id: number;
  incidentId: string;
  dateTime: string;
  location: string;
  types: string[];
  isNDISReportable: boolean;
  intensityRating: number;
  description: string;
  status: string;
  clientFirstName: string;
  clientLastName: string;
  clientIdNumber: string;
  staffFullName: string;
}

interface CloseIncidentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incident: IncidentReport;
  onSuccess: () => void;
}

export function CloseIncidentModal({ open, onOpenChange, incident, onSuccess }: CloseIncidentModalProps) {
  const { toast } = useToast();
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>(undefined);

  const OUTCOME_OPTIONS = [
    "Staff debrief conducted",
    "Client debrief/check-in", 
    "Supervisor follow-up",
    "Support or Safety Plan updated",
    "Risk rating updated",
    "Staff training scheduled",
    "Communication method revised",
    "Shift handover/team briefing",
    "External referral made",
    "PBS practitioner engaged",
  ];

  const CONTROL_OPTIONS = [
    "Environmental modification",
    "Policy or procedure updated",
    "Hazard removed/addressed", 
    "Supervision level adjusted",
    "Routine or schedule modified",
    "Strategy added to Behaviour Plan",
    "Other",
  ];

  const EXTERNAL_ORGS = [
    "WorkCover",
    "NDIS Quality & Safeguards Commission",
    "Victoria Police", 
    "Other",
  ];

  const form = useForm<ClosureFormData>({
    resolver: zodResolver(closureSchema),
    defaultValues: {
      incidentId: incident.incidentId,
      findings: "",
      rootCause: "",
      recommendations: "",
      outcomes: [],
      controls: [],
      externalReporting: [],
      externalReference: "",
      followUpDate: undefined,
      status: "Closed – All actions complete",
    },
  });

  const closeIncidentMutation = useMutation({
    mutationFn: (data: ClosureFormData) => 
      apiRequest("POST", "/api/incident-closures", data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Incident closed successfully",
      });
      // Invalidate incident queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/incident-reports"] });
      onSuccess();
      form.reset();
    },
    onError: (error: any) => {
      console.error("Close incident error:", error);
      
      // Check if it's a duplicate closure error
      if (error?.message?.includes("already been closed")) {
        toast({
          title: "Incident Already Closed",
          description: "This incident has already been closed by another user.",
          variant: "destructive",
        });
        onSuccess(); // Refresh the incident view
      } else {
        toast({
          title: "Error",
          description: error?.message || "Failed to close incident",
          variant: "destructive",
        });
      }
    },
  });

  const onSubmit = (data: ClosureFormData) => {
    if (!data.findings.trim() || !data.recommendations.trim()) {
      alert("Please fill out all required fields.");
      return;
    }

    const payload = {
      ...data,
      followUpDate: followUpDate ? followUpDate.toISOString().split('T')[0] : "",
    };
    closeIncidentMutation.mutate(payload);
  };

  const toggleArrayItem = (item: string, currentArray: string[], setArray: (arr: string[]) => void) => {
    if (currentArray.includes(item)) {
      setArray(currentArray.filter(i => i !== item));
    } else {
      setArray([...currentArray, item]);
    }
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
            Close Incident: {incident.incidentId}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Complete the incident closure process with detailed review and documentation
          </p>
        </DialogHeader>

        {/* Lodged Incident Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-4 w-4" />
              🔎 Lodged Incident Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <span className="font-medium">Client:</span> {incident.clientFirstName} {incident.clientLastName} ({incident.clientIdNumber})
              </div>
              <div>
                <span className="font-medium">Staff:</span> {incident.staffFullName}
              </div>
              <div>
                <span className="font-medium">Location:</span> {incident.location}
              </div>
              <div>
                <span className="font-medium">Intensity:</span> {incident.intensityRating}/10
              </div>
              <div className="md:col-span-2">
                <span className="font-medium">Types:</span>
                <div className="flex gap-1 mt-1">
                  {incident.types.map((type, index) => (
                    <Badge key={index} variant="outline" className="text-xs">{type}</Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-muted text-sm p-3 rounded-md whitespace-pre-wrap">
              {incident.description || "No description available"}
            </div>
          </CardContent>
        </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Findings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Findings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="findings"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Findings *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the key findings from the incident investigation..."
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

            {/* Root Cause */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Root Cause Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="rootCause"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Root Cause (if known)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Identify the underlying root cause of the incident..."
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="recommendations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recommendations *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Provide recommendations to prevent similar incidents..."
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

            {/* Outcome Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Outcome Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {OUTCOME_OPTIONS.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <Checkbox
                        checked={form.watch("outcomes").includes(option)}
                        onCheckedChange={() => 
                          toggleArrayItem(option, form.watch("outcomes"), (arr) => form.setValue("outcomes", arr))
                        }
                      />
                      <Label className="text-sm">{option}</Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Controls Achieved */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Controls Achieved
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {CONTROL_OPTIONS.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <Checkbox
                        checked={form.watch("controls").includes(option)}
                        onCheckedChange={() => 
                          toggleArrayItem(option, form.watch("controls"), (arr) => form.setValue("controls", arr))
                        }
                      />
                      <Label className="text-sm">{option}</Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* External Reporting */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  External Reporting
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">External Reporting Required?</Label>
                  <div className="flex space-x-4 mt-2">
                    <Button
                      type="button"
                      variant={form.watch("externalReporting").length > 0 ? "default" : "outline"}
                      onClick={() => {
                        if (form.watch("externalReporting").length === 0) {
                          form.setValue("externalReporting", ["WorkCover"]);
                        }
                      }}
                    >
                      Yes
                    </Button>
                    <Button
                      type="button"
                      variant={form.watch("externalReporting").length === 0 ? "default" : "outline"}
                      onClick={() => {
                        form.setValue("externalReporting", []);
                        form.setValue("externalReference", "");
                      }}
                    >
                      No
                    </Button>
                  </div>
                </div>

                {form.watch("externalReporting").length > 0 && (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      {EXTERNAL_ORGS.map((org) => (
                        <div key={org} className="flex items-center space-x-2">
                          <Checkbox
                            checked={form.watch("externalReporting").includes(org)}
                            onCheckedChange={() => 
                              toggleArrayItem(org, form.watch("externalReporting"), (arr) => form.setValue("externalReporting", arr))
                            }
                          />
                          <Label className="text-sm">{org}</Label>
                        </div>
                      ))}
                    </div>
                    <FormField
                      control={form.control}
                      name="externalReference"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>External Reference Number</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. NDIS-12345" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Follow-up Date */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Follow-up
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <Label className="text-sm font-medium">Follow-Up Date (if required)</Label>
                  <div className="mt-2">
                    <Input
                      type="date"
                      value={followUpDate ? followUpDate.toISOString().split('T')[0] : ''}
                      onChange={(e) => setFollowUpDate(e.target.value ? new Date(e.target.value) : undefined)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Final Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Final Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Final Status *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select final status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Closed – All actions complete">Closed – All actions complete</SelectItem>
                          <SelectItem value="Closed – Monitoring required">Closed – Monitoring required</SelectItem>
                          <SelectItem value="Escalated – Senior management review">Escalated – Senior management review</SelectItem>
                          <SelectItem value="Pending – Awaiting documentation">Pending – Awaiting documentation</SelectItem>
                          <SelectItem value="In Progress – Follow-up underway">In Progress – Follow-up underway</SelectItem>
                        </SelectContent>
                      </Select>
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