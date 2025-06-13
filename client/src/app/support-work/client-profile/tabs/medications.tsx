import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Pill, Download, Plus, Edit, Trash2, Clock, Calendar, 
  User, AlertTriangle, CheckCircle, XCircle, BarChart3,
  Loader2, FileText, Target
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const medicationPlanSchema = z.object({
  medicationName: z.string().min(1, "Medication name is required"),
  dosage: z.string().min(1, "Dosage is required"),
  frequency: z.string().min(1, "Frequency is required"),
  route: z.string().min(1, "Route is required"),
  timeOfDay: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  prescribedBy: z.string().min(1, "Prescriber is required"),
  instructions: z.string().optional(),
  sideEffects: z.string().optional(),
});

const medicationRecordSchema = z.object({
  medicationPlanId: z.number(),
  scheduledTime: z.string().min(1, "Scheduled time is required"),
  actualTime: z.string().optional(),
  result: z.enum(["administered", "refused", "missed", "delayed"]),
  notes: z.string().optional(),
  refusalReason: z.string().optional(),
});

interface MedicationPlan {
  id: number;
  medicationName: string;
  dosage: string;
  frequency: string;
  route: string;
  timeOfDay?: string;
  startDate: string;
  endDate?: string;
  prescribedBy: string;
  instructions?: string;
  sideEffects: string[];
  status: string;
  createdAt: string;
}

interface MedicationRecord {
  id: number;
  medicationPlanId: number;
  scheduledTime: string;
  actualTime?: string;
  result: string;
  notes?: string;
  refusalReason?: string;
  createdAt: string;
}

function MedicationPlanCard({ plan, onEdit, onDelete, userRole }: {
  plan: MedicationPlan;
  onEdit: (plan: MedicationPlan) => void;
  onDelete: (id: number) => void;
  userRole: string;
}) {
  const isEditable = ["Admin", "Coordinator"].includes(userRole);
  
  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Pill className="w-5 h-5 text-blue-600" />
            {plan.medicationName} {plan.dosage}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={plan.status === "active" ? "default" : "secondary"}>
              {plan.status}
            </Badge>
            {isEditable && (
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(plan)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(plan.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <p className="font-medium text-gray-700">Frequency & Route</p>
            <p className="text-sm text-gray-600">{plan.frequency} - {plan.route}</p>
          </div>
          <div>
            <p className="font-medium text-gray-700">Time of Day</p>
            <p className="text-sm text-gray-600">{plan.timeOfDay || "Not specified"}</p>
          </div>
          <div>
            <p className="font-medium text-gray-700">Prescribed By</p>
            <p className="text-sm text-gray-600">{plan.prescribedBy}</p>
          </div>
          <div>
            <p className="font-medium text-gray-700">Start Date</p>
            <p className="text-sm text-gray-600">{format(new Date(plan.startDate), "MMM dd, yyyy")}</p>
          </div>
          {plan.endDate && (
            <div>
              <p className="font-medium text-gray-700">End Date</p>
              <p className="text-sm text-gray-600">{format(new Date(plan.endDate), "MMM dd, yyyy")}</p>
            </div>
          )}
          {plan.instructions && (
            <div className="md:col-span-2 lg:col-span-3">
              <p className="font-medium text-gray-700">Instructions</p>
              <p className="text-sm text-gray-600">{plan.instructions}</p>
            </div>
          )}
          {plan.sideEffects.length > 0 && (
            <div className="md:col-span-2 lg:col-span-3">
              <p className="font-medium text-gray-700">Side Effects</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {plan.sideEffects.map((effect, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {effect}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MedicationRecordCard({ record }: { record: MedicationRecord }) {
  const getStatusIcon = (result: string) => {
    switch (result) {
      case "administered":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "refused":
        return <XCircle className="w-4 h-4 text-red-600" />;
      case "missed":
        return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      case "delayed":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (result: string) => {
    switch (result) {
      case "administered":
        return "bg-green-50 border-green-200";
      case "refused":
        return "bg-red-50 border-red-200";
      case "missed":
        return "bg-orange-50 border-orange-200";
      case "delayed":
        return "bg-yellow-50 border-yellow-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  return (
    <Card className={`mb-3 ${getStatusColor(record.result)}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {getStatusIcon(record.result)}
            <span className="font-medium capitalize">{record.result}</span>
          </div>
          <div className="text-sm text-gray-600">
            <Clock className="w-4 h-4 inline mr-1" />
            {format(new Date(record.scheduledTime), "MMM dd, HH:mm")}
          </div>
        </div>
        {record.actualTime && (
          <p className="text-sm text-gray-600 mb-1">
            <strong>Actual Time:</strong> {format(new Date(record.actualTime), "HH:mm")}
          </p>
        )}
        {record.notes && (
          <p className="text-sm text-gray-600 mb-1">
            <strong>Notes:</strong> {record.notes}
          </p>
        )}
        {record.refusalReason && (
          <p className="text-sm text-red-600">
            <strong>Refusal Reason:</strong> {record.refusalReason}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MedicationAnalytics({ clientId }: { clientId: number }) {
  const { data: plans = [] } = useQuery<MedicationPlan[]>({
    queryKey: [`/api/clients/${clientId}/medication-plans`],
  });

  const { data: records = [] } = useQuery<MedicationRecord[]>({
    queryKey: [`/api/clients/${clientId}/medication-records`],
  });

  // Calculate analytics
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentRecords = records.filter(record => 
    new Date(record.scheduledTime) >= thirtyDaysAgo
  );

  const administered = recentRecords.filter(r => r.result === "administered").length;
  const total = recentRecords.length;
  const complianceRate = total > 0 ? Math.round((administered / total) * 100) : 0;

  const todayRecords = records.filter(record =>
    format(new Date(record.scheduledTime), "yyyy-MM-dd") === format(today, "yyyy-MM-dd")
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Compliance Rate (30 days)</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{complianceRate}%</div>
          <p className="text-xs text-muted-foreground">
            {administered} of {total} doses administered
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Today's Schedule</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{todayRecords.length}</div>
          <p className="text-xs text-muted-foreground">
            Total doses scheduled today
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Medications</CardTitle>
          <Pill className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{plans.filter(p => p.status === "active").length}</div>
          <p className="text-xs text-muted-foreground">
            Currently prescribed
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

interface MedicationsTabProps {
  clientId?: string;
  companyId?: string;
}

export default function MedicationsTab({ clientId: propClientId }: MedicationsTabProps = {}) {
  const params = useParams();
  const clientId = propClientId || params.clientId || "1";
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MedicationPlan | null>(null);

  const { data: client } = useQuery({
    queryKey: [`/api/clients/${clientId}`],
  });

  // Default client data for testing
  const clientData = (client as any) || {
    fullName: "Sarah Johnson",
    ndisNumber: "43000012345"
  };

  const { data: plans = [], isLoading: plansLoading } = useQuery<MedicationPlan[]>({
    queryKey: [`/api/clients/${clientId}/medication-plans`],
  });

  const { data: records = [], isLoading: recordsLoading } = useQuery<MedicationRecord[]>({
    queryKey: [`/api/clients/${clientId}/medication-records`],
  });

  const planForm = useForm({
    resolver: zodResolver(medicationPlanSchema),
    defaultValues: {
      medicationName: "",
      dosage: "",
      frequency: "",
      route: "oral",
      timeOfDay: "",
      startDate: format(new Date(), "yyyy-MM-dd"),
      endDate: "",
      prescribedBy: "",
      instructions: "",
      sideEffects: "",
    },
  });

  const recordForm = useForm({
    resolver: zodResolver(medicationRecordSchema),
    defaultValues: {
      medicationPlanId: 0,
      scheduledTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      actualTime: "",
      result: "administered" as const,
      notes: "",
      refusalReason: "",
    },
  });

  const createPlanMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/clients/${clientId}/medication-plans`, "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/medication-plans`] });
      setShowPlanModal(false);
      planForm.reset();
      toast({ title: "Medication plan created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create medication plan", variant: "destructive" });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      apiRequest(`/api/medication-plans/${id}`, "PUT", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/medication-plans`] });
      setShowPlanModal(false);
      setEditingPlan(null);
      planForm.reset();
      toast({ title: "Medication plan updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update medication plan", variant: "destructive" });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/medication-plans/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/medication-plans`] });
      toast({ title: "Medication plan deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete medication plan", variant: "destructive" });
    },
  });

  const createRecordMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/clients/${clientId}/medication-records`, "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/medication-records`] });
      setShowRecordModal(false);
      recordForm.reset();
      toast({ title: "Medication record created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create medication record", variant: "destructive" });
    },
  });

  const handleEditPlan = (plan: MedicationPlan) => {
    setEditingPlan(plan);
    planForm.reset({
      medicationName: plan.medicationName,
      dosage: plan.dosage,
      frequency: plan.frequency,
      route: plan.route,
      timeOfDay: plan.timeOfDay || "",
      startDate: format(new Date(plan.startDate), "yyyy-MM-dd"),
      endDate: plan.endDate ? format(new Date(plan.endDate), "yyyy-MM-dd") : "",
      prescribedBy: plan.prescribedBy,
      instructions: plan.instructions || "",
      sideEffects: plan.sideEffects.join(", "),
    });
    setShowPlanModal(true);
  };

  const handleDeletePlan = (id: number) => {
    if (confirm("Are you sure you want to delete this medication plan?")) {
      deletePlanMutation.mutate(id);
    }
  };

  const onSubmitPlan = (data: any) => {
    const planData = {
      ...data,
      sideEffects: data.sideEffects ? data.sideEffects.split(",").map((s: string) => s.trim()) : [],
      endDate: data.endDate || null,
    };

    if (editingPlan) {
      updatePlanMutation.mutate({ id: editingPlan.id, data: planData });
    } else {
      createPlanMutation.mutate(planData);
    }
  };

  const onSubmitRecord = (data: any) => {
    createRecordMutation.mutate({
      ...data,
      actualTime: data.actualTime || null,
    });
  };

  if (plansLoading || recordsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const isEditable = user && ["Admin", "Coordinator"].includes(user.role);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Medication Management</h2>
          <p className="text-gray-600">
            {clientData.fullName} - NDIS: {clientData.ndisNumber}
          </p>
          <p className="text-sm text-gray-500">
            Manage and monitor this client's medication plans and records
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => console.log("Exporting...")}>
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          {isEditable && (
            <Dialog open={showPlanModal} onOpenChange={setShowPlanModal}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingPlan(null)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Medication
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingPlan ? "Edit Medication Plan" : "Create Medication Plan"}
                  </DialogTitle>
                </DialogHeader>
                <Form {...planForm}>
                  <form onSubmit={planForm.handleSubmit(onSubmitPlan)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={planForm.control}
                        name="medicationName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Medication Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Fluoxetine" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={planForm.control}
                        name="dosage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dosage</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 20mg" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={planForm.control}
                        name="frequency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Frequency</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Once daily" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={planForm.control}
                        name="route"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Route</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select route" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="oral">Oral</SelectItem>
                                <SelectItem value="injection">Injection</SelectItem>
                                <SelectItem value="topical">Topical</SelectItem>
                                <SelectItem value="inhaled">Inhaled</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={planForm.control}
                      name="timeOfDay"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time of Day</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Morning, Evening" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={planForm.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={planForm.control}
                        name="endDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End Date (Optional)</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={planForm.control}
                      name="prescribedBy"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prescribed By</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Dr. Sarah Williams" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={planForm.control}
                      name="instructions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Instructions</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Special instructions..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={planForm.control}
                      name="sideEffects"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Side Effects (comma-separated)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Nausea, Drowsiness" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setShowPlanModal(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createPlanMutation.isPending || updatePlanMutation.isPending}>
                        {(createPlanMutation.isPending || updatePlanMutation.isPending) && (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        )}
                        {editingPlan ? "Update" : "Create"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Analytics */}
      <MedicationAnalytics clientId={parseInt(clientId!)} />

      {/* Main Content */}
      <Tabs defaultValue="plans" className="w-full">
        <TabsList>
          <TabsTrigger value="plans">Active Plans</TabsTrigger>
          <TabsTrigger value="records">Records</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Medication Plans</h3>
            <Badge variant="outline">{plans.filter(p => p.status === "active").length} Active</Badge>
          </div>
          
          {plans.length === 0 ? (
            <div className="text-center py-8">
              <Pill className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No medication plans found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {plans.map((plan) => (
                <MedicationPlanCard
                  key={plan.id}
                  plan={plan}
                  onEdit={handleEditPlan}
                  onDelete={handleDeletePlan}
                  userRole={user?.role || ""}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="records" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Administration Records</h3>
            <Dialog open={showRecordModal} onOpenChange={setShowRecordModal}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Record Administration
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record Medication Administration</DialogTitle>
                </DialogHeader>
                <Form {...recordForm}>
                  <form onSubmit={recordForm.handleSubmit(onSubmitRecord)} className="space-y-4">
                    <FormField
                      control={recordForm.control}
                      name="medicationPlanId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Medication</FormLabel>
                          <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select medication" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {plans.filter(p => p.status === "active").map((plan) => (
                                <SelectItem key={plan.id} value={plan.id.toString()}>
                                  {plan.medicationName} {plan.dosage}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={recordForm.control}
                      name="scheduledTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Scheduled Time</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={recordForm.control}
                      name="actualTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Actual Time (if different)</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={recordForm.control}
                      name="result"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Result</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="administered">Administered</SelectItem>
                              <SelectItem value="refused">Refused</SelectItem>
                              <SelectItem value="missed">Missed</SelectItem>
                              <SelectItem value="delayed">Delayed</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={recordForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Additional notes..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={recordForm.control}
                      name="refusalReason"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Refusal Reason (if applicable)</FormLabel>
                          <FormControl>
                            <Input placeholder="Reason for refusal..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setShowRecordModal(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createRecordMutation.isPending}>
                        {createRecordMutation.isPending && (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        )}
                        Record
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {records.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No medication records found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((record) => (
                <MedicationRecordCard key={record.id} record={record} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="text-center py-8">
            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Detailed analytics coming soon.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}