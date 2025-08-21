/**
 * Comprehensive NDIS Referral Management System
 * Features: View, Assessment, PDF Export, Search/Filter, Decision Workflow
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { 
  CalendarIcon, 
  Eye, 
  Download, 
  Search, 
  Filter, 
  CheckCircle, 
  XCircle, 
  ArrowRight,
  FileText,
  Users,
  AlertTriangle,
  Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Assessment form schema
const AssessmentSchema = z.object({
  organizationalCapacity: z.enum(["yes", "no"]),
  skillsetCapacity: z.enum(["yes", "no"]),
  fundingSufficient: z.enum(["yes", "no"]),
  restrictivePractice: z.enum(["yes", "no"]),
  manualHandling: z.enum(["yes", "no"]),
  medicationManagement: z.enum(["yes", "no"]),
  supportOverview: z.string().min(10, "Please provide detailed overview"),
  decision: z.enum(["proceed", "decline", "referral", "training"]),
  declineReason: z.string().optional(),
  referralPathway: z.string().optional(),
});

type AssessmentData = z.infer<typeof AssessmentSchema>;

interface ReferralSubmission {
  id: string;
  clientName: string;
  referrerName: string;
  referrerOrg?: string;
  submittedAt: string;
  status: string;
  dateOfReferral: string;
  supportCategories: string[];
  howWeSupport: string[];
  aboutParticipant?: string;
  medicalConditions?: string;
  behaviours?: any[];
  ndisNumber?: string;
  planStart?: string;
  planEnd?: string;
  assessment?: AssessmentData;
}

export default function ReferralManagementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedReferral, setSelectedReferral] = useState<ReferralSubmission | null>(null);
  const [showAssessment, setShowAssessment] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<Date | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [referralToDelete, setReferralToDelete] = useState<ReferralSubmission | null>(null);

  const assessmentForm = useForm<AssessmentData>({
    resolver: zodResolver(AssessmentSchema),
    defaultValues: {
      organizationalCapacity: "yes",
      skillsetCapacity: "yes",
      fundingSufficient: "yes",
      restrictivePractice: "no",
      manualHandling: "no",
      medicationManagement: "no",
      decision: "proceed",
    },
  });

  // Fetch referral submissions
  const { data: referrals = [], isLoading } = useQuery<ReferralSubmission[]>({
    queryKey: ["/api/referrals"],
  });

  // Assessment submission mutation
  const assessmentMutation = useMutation({
    mutationFn: async (data: AssessmentData & { referralId: string }) => {
      const response = await apiRequest("POST", `/api/referrals/${data.referralId}/assessment`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Assessment Completed",
        description: "Referral assessment has been saved successfully.",
      });
      setShowAssessment(false);
      queryClient.invalidateQueries({ queryKey: ["/api/referrals"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save assessment",
        variant: "destructive",
      });
    },
  });

  // PDF export mutation
  const pdfExportMutation = useMutation({
    mutationFn: async (referralId: string) => {
      const response = await apiRequest("GET", `/api/referrals/${referralId}/pdf`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `referral-${referralId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
    onError: (error: any) => {
      toast({
        title: "PDF Export Failed",
        description: error.message || "Could not generate PDF",
        variant: "destructive",
      });
    },
  });

  // Delete referral mutation
  const deleteReferralMutation = useMutation({
    mutationFn: async (referralId: string) => {
      const response = await apiRequest("DELETE", `/api/referrals/${referralId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Referral Deleted",
        description: "The referral form has been permanently deleted.",
      });
      setDeleteDialogOpen(false);
      setReferralToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["/api/referrals"] });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Could not delete referral form",
        variant: "destructive",
      });
    },
  });

  // Filter referrals based on search and filters
  const filteredReferrals = referrals.filter(referral => {
    const matchesSearch = 
      referral.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      referral.referrerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (referral.referrerOrg || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || referral.status === statusFilter;
    
    const matchesDate = !dateFilter || 
      format(new Date(referral.submittedAt), "yyyy-MM-dd") === format(dateFilter, "yyyy-MM-dd");
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  const onAssessmentSubmit = (data: AssessmentData) => {
    if (!selectedReferral) return;
    assessmentMutation.mutate({ ...data, referralId: selectedReferral.id });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "secondary";
      case "under-review": return "outline";
      case "approved": return "default";
      case "declined": return "destructive";
      default: return "secondary";
    }
  };

  return (
    <div className="container max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Referral Management</h1>
          <p className="text-muted-foreground">
            Review, assess, and process NDIS participant referrals
          </p>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Search & Filter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by client or referrer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="under-review">Under Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFilter ? format(dateFilter, "PPP") : "Filter by date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFilter}
                  onSelect={setDateFilter}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Button 
              variant="outline" 
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("all");
                setDateFilter(undefined);
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Referrals List */}
      <Card>
        <CardHeader>
          <CardTitle>Referral Submissions ({filteredReferrals.length})</CardTitle>
          <CardDescription>
            Review and process NDIS participant referrals
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading referrals...</div>
          ) : filteredReferrals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {referrals.length === 0 
                ? "No referrals received yet."
                : "No referrals match your current filters."
              }
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReferrals.map((referral) => (
                <div
                  key={referral.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="font-medium text-lg">{referral.clientName}</div>
                      <Badge variant={getStatusColor(referral.status)}>
                        {referral.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <div>Referred by: {referral.referrerName} {referral.referrerOrg ? `(${referral.referrerOrg})` : ""}</div>
                      <div>Submitted: {format(new Date(referral.submittedAt), "PPP p")}</div>
                      <div>NDIS: {referral.ndisNumber || "Not provided"}</div>
                    </div>
                    <div className="flex gap-2">
                      {referral.supportCategories?.map((category) => (
                        <Badge key={category} variant="outline" className="text-xs">
                          {category}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedReferral(referral)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Referral Details - {referral.clientName}</DialogTitle>
                          <DialogDescription>
                            Complete referral information and assessment
                          </DialogDescription>
                        </DialogHeader>
                        {selectedReferral && <ReferralDetailsView referral={selectedReferral} />}
                      </DialogContent>
                    </Dialog>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => pdfExportMutation.mutate(referral.id)}
                      disabled={pdfExportMutation.isPending}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </Button>

                    {referral.status === "pending" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedReferral(referral);
                          setShowAssessment(true);
                        }}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Assess
                      </Button>
                    )}

                    <AlertDialog open={deleteDialogOpen && referralToDelete?.id === referral.id} onOpenChange={setDeleteDialogOpen}>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setReferralToDelete(referral);
                            setDeleteDialogOpen(true);
                          }}
                          className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Referral Form</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to permanently delete this referral form for <strong>{referral.clientName}</strong>?
                            <br /><br />
                            This action cannot be undone. All data associated with this referral will be permanently removed from the system.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteReferralMutation.mutate(referral.id)}
                            disabled={deleteReferralMutation.isPending}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            {deleteReferralMutation.isPending ? "Deleting..." : "Delete Permanently"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assessment Dialog */}
      <Dialog open={showAssessment} onOpenChange={setShowAssessment}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assessment & Decision - {selectedReferral?.clientName}</DialogTitle>
            <DialogDescription>
              Complete the organizational capacity assessment and make a decision
            </DialogDescription>
          </DialogHeader>
          
          <Form {...assessmentForm}>
            <form onSubmit={assessmentForm.handleSubmit(onAssessmentSubmit)} className="space-y-6">
              {/* Assessment Questions */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Organizational Assessment</h3>
                
                <FormField
                  control={assessmentForm.control}
                  name="organizationalCapacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Is the support need compatible with organizational capacity?</FormLabel>
                      <FormControl>
                        <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-6">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id="org-yes" />
                            <Label htmlFor="org-yes">Yes</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id="org-no" />
                            <Label htmlFor="org-no">No</Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={assessmentForm.control}
                  name="skillsetCapacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Does the organization have the skill set and capacity to manage complexity?</FormLabel>
                      <FormControl>
                        <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-6">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id="skill-yes" />
                            <Label htmlFor="skill-yes">Yes</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id="skill-no" />
                            <Label htmlFor="skill-no">No</Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={assessmentForm.control}
                  name="fundingSufficient"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Is NDIS funded support and available funding sufficient to cater to support needs as requested?</FormLabel>
                      <FormControl>
                        <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-6">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id="fund-yes" />
                            <Label htmlFor="fund-yes">Yes</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id="fund-no" />
                            <Label htmlFor="fund-no">No</Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={assessmentForm.control}
                  name="restrictivePractice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Is implementation of restrictive practice required?</FormLabel>
                      <FormControl>
                        <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-6">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id="restrict-yes" />
                            <Label htmlFor="restrict-yes">Yes</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id="restrict-no" />
                            <Label htmlFor="restrict-no">No</Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={assessmentForm.control}
                  name="manualHandling"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Does support provision include manual handling?</FormLabel>
                      <FormControl>
                        <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-6">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id="manual-yes" />
                            <Label htmlFor="manual-yes">Yes</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id="manual-no" />
                            <Label htmlFor="manual-no">No</Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={assessmentForm.control}
                  name="medicationManagement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Does support provision require medication management?</FormLabel>
                      <FormControl>
                        <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-6">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id="med-yes" />
                            <Label htmlFor="med-yes">Yes</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id="med-no" />
                            <Label htmlFor="med-no">No</Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={assessmentForm.control}
                  name="supportOverview"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Provide overview of support provision</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the proposed support provision plan..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Decision Options */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Decision</h3>
                
                <FormField
                  control={assessmentForm.control}
                  name="decision"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select decision path</FormLabel>
                      <FormControl>
                        <RadioGroup value={field.value} onValueChange={field.onChange} className="space-y-3">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="proceed" id="proceed" />
                            <Label htmlFor="proceed" className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              Proceed to intake and support provision
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="decline" id="decline" />
                            <Label htmlFor="decline" className="flex items-center gap-2">
                              <XCircle className="h-4 w-4 text-red-600" />
                              Decline support
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="referral" id="referral" />
                            <Label htmlFor="referral" className="flex items-center gap-2">
                              <ArrowRight className="h-4 w-4 text-blue-600" />
                              Provide referral pathway
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="training" id="training" />
                            <Label htmlFor="training" className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-orange-600" />
                              Proceed to staff training
                            </Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {assessmentForm.watch("decision") === "decline" && (
                  <FormField
                    control={assessmentForm.control}
                    name="declineReason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reason for declining support</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Explain why support is being declined..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {assessmentForm.watch("decision") === "referral" && (
                  <FormField
                    control={assessmentForm.control}
                    name="referralPathway"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Referral pathway details</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Provide details of alternative referral pathway..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAssessment(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={assessmentMutation.isPending}
                >
                  {assessmentMutation.isPending ? "Saving..." : "Complete Assessment"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Detailed referral view component
function ReferralDetailsView({ referral }: { referral: ReferralSubmission }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold">Client Information</h4>
            <div className="space-y-1 text-sm">
              <div><strong>Name:</strong> {referral.clientName}</div>
              <div><strong>NDIS Number:</strong> {referral.ndisNumber || "Not provided"}</div>
              {referral.planStart && (
                <div><strong>Plan Period:</strong> {format(new Date(referral.planStart), "PPP")} - {referral.planEnd ? format(new Date(referral.planEnd), "PPP") : "Ongoing"}</div>
              )}
            </div>
          </div>

          <div>
            <h4 className="font-semibold">Referrer Information</h4>
            <div className="space-y-1 text-sm">
              <div><strong>Name:</strong> {referral.referrerName}</div>
              {referral.referrerOrg && <div><strong>Organization:</strong> {referral.referrerOrg}</div>}
              <div><strong>Submitted:</strong> {format(new Date(referral.submittedAt), "PPP p")}</div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="font-semibold">Support Categories</h4>
            <div className="flex flex-wrap gap-1 mt-2">
              {referral.supportCategories?.map((category) => (
                <Badge key={category} variant="outline" className="text-xs">
                  {category}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold">How We Support</h4>
            <div className="flex flex-wrap gap-1 mt-2">
              {referral.howWeSupport?.map((support) => (
                <Badge key={support} variant="secondary" className="text-xs">
                  {support}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      {referral.aboutParticipant && (
        <div>
          <h4 className="font-semibold">About Participant</h4>
          <p className="text-sm mt-2">{referral.aboutParticipant}</p>
        </div>
      )}

      {referral.medicalConditions && (
        <div>
          <h4 className="font-semibold">Medical Conditions</h4>
          <p className="text-sm mt-2">{referral.medicalConditions}</p>
        </div>
      )}

      {referral.behaviours && referral.behaviours.length > 0 && (
        <div>
          <h4 className="font-semibold">Behaviours of Concern</h4>
          <div className="space-y-2 mt-2">
            {referral.behaviours.map((behaviour, index) => (
              <div key={index} className="p-3 bg-muted rounded-lg text-sm">
                <div><strong>Behaviour:</strong> {behaviour.behaviour}</div>
                {behaviour.trigger && <div><strong>Trigger:</strong> {behaviour.trigger}</div>}
                {behaviour.management && <div><strong>Management:</strong> {behaviour.management}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {referral.assessment && (
        <div>
          <h4 className="font-semibold">Assessment Results</h4>
          <div className="p-4 bg-muted rounded-lg mt-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><strong>Organizational Capacity:</strong> {referral.assessment.organizationalCapacity}</div>
              <div><strong>Skillset Capacity:</strong> {referral.assessment.skillsetCapacity}</div>
              <div><strong>Funding Sufficient:</strong> {referral.assessment.fundingSufficient}</div>
              <div><strong>Restrictive Practice:</strong> {referral.assessment.restrictivePractice}</div>
              <div><strong>Manual Handling:</strong> {referral.assessment.manualHandling}</div>
              <div><strong>Medication Management:</strong> {referral.assessment.medicationManagement}</div>
            </div>
            <div className="mt-4">
              <div><strong>Support Overview:</strong></div>
              <p className="mt-1">{referral.assessment.supportOverview}</p>
            </div>
            <div className="mt-4">
              <div><strong>Decision:</strong> <Badge variant={referral.assessment.decision === "proceed" ? "default" : "secondary"}>{referral.assessment.decision}</Badge></div>
              {referral.assessment.declineReason && (
                <div className="mt-2"><strong>Decline Reason:</strong> {referral.assessment.declineReason}</div>
              )}
              {referral.assessment.referralPathway && (
                <div className="mt-2"><strong>Referral Pathway:</strong> {referral.assessment.referralPathway}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}