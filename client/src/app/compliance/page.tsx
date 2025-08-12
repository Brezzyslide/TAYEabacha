import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileText, Upload, Calendar, AlertTriangle, Plus, Trash2, Edit, Eye, Users, DollarSign, Clock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const uploadFormSchema = z.object({
  formType: z.string().min(1, "Form type is required"),
  file: z.any().refine((files) => files?.length > 0, "File is required"),
});

const serviceAgreementSchema = z.object({
  clientId: z.number().min(1, "Client is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  planNomineeName: z.string().optional(),
  planNomineeContact: z.string().optional(),
  billingDetails: z.object({
    participantNumber: z.string().optional(),
    planNumber: z.string().optional(),
    planManager: z.string().optional(),
    planManagerContact: z.string().optional(),
  }).optional(),
  customTerms: z.string().optional(),
});

const serviceAgreementItemSchema = z.object({
  ndisCode: z.string().min(1, "NDIS code is required"),
  supportDescription: z.string().min(1, "Support description is required"),
  weeks: z.number().min(1, "Number of weeks is required"),
  hoursDay: z.number().min(0, "Hours must be positive").optional(),
  hoursEvening: z.number().min(0, "Hours must be positive").optional(),
  hoursActiveNight: z.number().min(0, "Hours must be positive").optional(),
  hoursSleepover: z.number().min(0, "Hours must be positive").optional(),
  hoursSaturday: z.number().min(0, "Hours must be positive").optional(),
  hoursSunday: z.number().min(0, "Hours must be positive").optional(),
  hoursPublicHoliday: z.number().min(0, "Hours must be positive").optional(),
  unitDay: z.number().min(0, "Rate must be positive").optional(),
  unitEvening: z.number().min(0, "Rate must be positive").optional(),
  unitActiveNight: z.number().min(0, "Rate must be positive").optional(),
  unitSleepover: z.number().min(0, "Rate must be positive").optional(),
  unitSaturday: z.number().min(0, "Rate must be positive").optional(),
  unitSunday: z.number().min(0, "Rate must be positive").optional(),
  unitPublicHoliday: z.number().min(0, "Rate must be positive").optional(),
  notes: z.string().optional(),
});

const FORM_TYPES = [
  { value: "med_authority", label: "Medication Authority Form" },
  { value: "med_administration", label: "Medication Administration Consent Form" },
  { value: "med_purpose", label: "Medication Purpose Form" },
  { value: "rp_consent", label: "Restrictive Practice Consent Form" },
  { value: "rp_guide", label: "Restrictive Practice Guide" },
  { value: "incident_report", label: "Incident Report Template" },
  { value: "care_plan", label: "Care Plan Template" },
  { value: "assessment", label: "Assessment Form" },
];

// Sample forms data when API fails
const SAMPLE_FORMS = [
  {
    id: 1,
    formType: "med_purpose",
    fileName: "Medication Purpose Form - Office Professional Practice.pdf",
    fileUrl: "/sample-forms/medication-purpose-form.pdf",
    uploadedAt: "2025-07-14T10:00:00Z"
  },
  {
    id: 2,
    formType: "med_administration", 
    fileName: "Medication Administration Record (Treatment Sheet).pdf",
    fileUrl: "/sample-forms/medication-treatment-sheet.pdf",
    uploadedAt: "2025-07-14T10:00:00Z"
  },
  {
    id: 3,
    formType: "rp_consent",
    fileName: "Restrictive Practice Consent Form.pdf",
    fileUrl: "/sample-forms/restrictive-practice-consent.pdf",
    uploadedAt: "2025-07-14T10:00:00Z"
  },
  {
    id: 4,
    formType: "rp_guide",
    fileName: "Restrictive Practice Implementation Guide.pdf",
    fileUrl: "/sample-forms/restrictive-practice-guide.pdf",
    uploadedAt: "2025-07-14T10:00:00Z"
  }
];

export default function CompliancePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showAgreementDialog, setShowAgreementDialog] = useState(false);
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [selectedAgreement, setSelectedAgreement] = useState<any>(null);
  const [editingAgreement, setEditingAgreement] = useState<any>(null);

  // Query for downloadable forms (global library) - fallback to sample data if API fails
  const { data: downloadableForms = [], isLoading: formsLoading, error: formsError } = useQuery<any[]>({
    queryKey: ["/api/compliance/forms"],
    retry: false,
  });

  // Use sample data if API fails
  const formsToDisplay: any[] = formsError ? SAMPLE_FORMS : downloadableForms;

  // Query for completed medication forms (tenant-specific)
  const { data: medicationForms = [], isLoading: medicationLoading } = useQuery<any[]>({
    queryKey: ["/api/compliance/medication-forms"],
    retry: false,
  });

  // Query for evacuation drills (tenant-specific)
  const { data: evacuationDrills = [], isLoading: drillsLoading } = useQuery<any[]>({
    queryKey: ["/api/compliance/evacuation-drills"],
    retry: false,
  });

  // Query for NDIS service agreements
  const { data: serviceAgreements = [], isLoading: agreementsLoading } = useQuery<any[]>({
    queryKey: ["/api/compliance/service-agreements"],
    retry: false,
  });

  // Query for clients (for creating new agreements)
  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
    retry: false,
  });

  const canUploadForms = user?.role === "Admin" || user?.role === "ConsoleManager";

  const form = useForm({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: {
      formType: "",
      file: undefined,
    },
  });

  const agreementForm = useForm({
    resolver: zodResolver(serviceAgreementSchema),
    defaultValues: {
      clientId: 0,
      startDate: "",
      endDate: "",
      planNomineeName: "",
      planNomineeContact: "",
      billingDetails: {
        participantNumber: "",
        planNumber: "",
        planManager: "",
        planManagerContact: "",
      },
      customTerms: "",
    },
  });

  const itemForm = useForm({
    resolver: zodResolver(serviceAgreementItemSchema),
    defaultValues: {
      ndisCode: "",
      supportDescription: "",
      weeks: 1,
      hoursDay: 0,
      hoursEvening: 0,
      hoursActiveNight: 0,
      hoursSleepover: 0,
      hoursSaturday: 0,
      hoursSunday: 0,
      hoursPublicHoliday: 0,
      unitDay: 0,
      unitEvening: 0,
      unitActiveNight: 0,
      unitSleepover: 0,
      unitSaturday: 0,
      unitSunday: 0,
      unitPublicHoliday: 0,
      notes: "",
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: any) => {
      const formData = new FormData();
      formData.append('file', data.file[0]);
      formData.append('formType', data.formType);
      
      return apiRequest('POST', '/api/compliance/forms/upload', formData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Form uploaded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/forms"] });
      setShowUploadDialog(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload form",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (formId: number) => {
      return apiRequest('DELETE', `/api/compliance/forms/${formId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Form deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/forms"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete form",
        variant: "destructive",
      });
    },
  });

  // Service Agreement mutations
  const createAgreementMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/compliance/service-agreements', data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Service agreement created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/service-agreements"] });
      setShowAgreementDialog(false);
      agreementForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create service agreement",
        variant: "destructive",
      });
    },
  });

  const updateAgreementMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest('PUT', `/api/compliance/service-agreements/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Service agreement updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/service-agreements"] });
      setShowAgreementDialog(false);
      setEditingAgreement(null);
      agreementForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update service agreement",
        variant: "destructive",
      });
    },
  });

  const deleteAgreementMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/compliance/service-agreements/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Service agreement deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/service-agreements"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete service agreement",
        variant: "destructive",
      });
    },
  });

  const createItemMutation = useMutation({
    mutationFn: async ({ agreementId, data }: { agreementId: string; data: any }) => {
      return apiRequest('POST', `/api/compliance/service-agreements/${agreementId}/items`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Service item added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/service-agreements"] });
      setShowItemDialog(false);
      itemForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add service item",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    uploadMutation.mutate(data);
  };

  const onAgreementSubmit = (data: any) => {
    if (editingAgreement) {
      updateAgreementMutation.mutate({ id: editingAgreement.id, data });
    } else {
      createAgreementMutation.mutate(data);
    }
  };

  const onItemSubmit = (data: any) => {
    if (selectedAgreement) {
      createItemMutation.mutate({ agreementId: selectedAgreement.id, data });
    }
  };

  const openEditAgreement = (agreement: any) => {
    setEditingAgreement(agreement);
    agreementForm.reset({
      clientId: agreement.clientId,
      startDate: agreement.startDate?.split('T')[0] || "",
      endDate: agreement.endDate?.split('T')[0] || "",
      planNomineeName: agreement.planNomineeName || "",
      planNomineeContact: agreement.planNomineeContact || "",
      billingDetails: agreement.billingDetails || {
        participantNumber: "",
        planNumber: "",
        planManager: "",
        planManagerContact: "",
      },
      customTerms: agreement.customTerms || "",
    });
    setShowAgreementDialog(true);
  };

  const calculateItemTotal = (item: any) => {
    const hours = (item.hoursDay || 0) + (item.hoursEvening || 0) + (item.hoursActiveNight || 0) + 
                 (item.hoursSleepover || 0) + (item.hoursSaturday || 0) + (item.hoursSunday || 0) + 
                 (item.hoursPublicHoliday || 0);
    const rates = (item.unitDay || 0) + (item.unitEvening || 0) + (item.unitActiveNight || 0) + 
                 (item.unitSleepover || 0) + (item.unitSaturday || 0) + (item.unitSunday || 0) + 
                 (item.unitPublicHoliday || 0);
    return hours * rates * (item.weeks || 1);
  };

  const getClientName = (clientId: number) => {
    const client = clients.find((c: any) => c.id === clientId);
    return client ? `${client.firstName} ${client.lastName}` : "Unknown Client";
  };

  const getAgreementStatus = (agreement: any) => {
    const now = new Date();
    const startDate = new Date(agreement.startDate);
    const endDate = new Date(agreement.endDate);
    
    if (now < startDate) return "Pending";
    if (now > endDate) return "Expired";
    return "Active";
  };

  const handleDownload = (form: any) => {
    // In a real implementation, this would download from the server
    const link = document.createElement('a');
    link.href = form.fileUrl;
    link.download = form.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getFormTypeLabel = (formType: string) => {
    const type = FORM_TYPES.find(t => t.value === formType);
    return type ? type.label : formType.replace('_', ' ');
  };

  const handleExportPDF = async (agreementId: string) => {
    try {
      const response = await fetch(`/api/compliance/service-agreements/${agreementId}/pdf`, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `service-agreement-${agreementId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "PDF Export Successful",
        description: "Service agreement PDF has been downloaded.",
      });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        title: "Export Failed",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Compliance Centre
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Manage compliance documents, medication forms, and safety records
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="service-agreements">NDIS Service Agreements</TabsTrigger>
          <TabsTrigger value="medication-forms">Medication Forms</TabsTrigger>
          <TabsTrigger value="evacuation-drills">Evacuation Drills</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Stats Cards */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">NDIS Agreements</CardTitle>
                <Users className="h-4 w-4 text-slate-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{serviceAgreements?.length || 0}</div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Active service agreements
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Available Forms</CardTitle>
                <FileText className="h-4 w-4 text-slate-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formsToDisplay?.length || 0}</div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Global forms library
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Medication Records</CardTitle>
                <AlertTriangle className="h-4 w-4 text-slate-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{medicationForms?.length || 0}</div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Completed forms
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Safety Drills</CardTitle>
                <Calendar className="h-4 w-4 text-slate-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{evacuationDrills?.length || 0}</div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  This year
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Downloadable Forms Library */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Downloadable Forms Library</CardTitle>
                  <CardDescription>
                    Manage global compliance forms available to all tenants
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {formsError && (
                    <span className="text-sm text-amber-600">Using sample data</span>
                  )}
                  {canUploadForms && (
                    <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                      <DialogTrigger asChild>
                        <Button>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload Form
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle>Upload Compliance Form</DialogTitle>
                          <DialogDescription>
                            Upload a new compliance form to make it available to all tenants.
                          </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                              control={form.control}
                              name="formType"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Form Type</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select a form type" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {FORM_TYPES.map((type) => (
                                        <SelectItem key={type.value} value={type.value}>
                                          {type.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormDescription>
                                    Choose the type of compliance form you're uploading.
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="file"
                              render={({ field: { onChange, value, ...field } }) => (
                                <FormItem>
                                  <FormLabel>File</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="file"
                                      accept=".pdf,.doc,.docx"
                                      onChange={(e) => onChange(e.target.files)}
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    Upload a PDF, DOC, or DOCX file (max 10MB).
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowUploadDialog(false)}
                              >
                                Cancel
                              </Button>
                              <Button type="submit" disabled={uploadMutation.isPending}>
                                {uploadMutation.isPending ? "Uploading..." : "Upload"}
                              </Button>
                            </div>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {formsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-slate-600">Loading forms...</div>
                </div>
              ) : formsToDisplay?.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {formsToDisplay.map((form: any) => (
                    <Card key={form.id} className="relative">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-1">
                              {form.fileName}
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400 capitalize mb-2">
                              {getFormTypeLabel(form.formType)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {new Date(form.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleDownload(form)}
                            className="flex-1"
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                          {canUploadForms && !formsError && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => deleteMutation.mutate(form.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="mx-auto h-12 w-12 text-slate-400" />
                  <h3 className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                    No forms uploaded yet
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Upload compliance forms to make them available for staff to download.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="service-agreements" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">NDIS Service Agreements</h2>
              <p className="text-slate-600 dark:text-slate-400">
                Manage service agreements with line items, pricing, and electronic signatures
              </p>
            </div>
            <Dialog open={showAgreementDialog} onOpenChange={setShowAgreementDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Service Agreement
                </Button>
              </DialogTrigger>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingAgreement ? "Edit Service Agreement" : "Create New Service Agreement"}
                    </DialogTitle>
                    <DialogDescription>
                      Set up a comprehensive NDIS service agreement with billing details and terms.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...agreementForm}>
                    <form onSubmit={agreementForm.handleSubmit(onAgreementSubmit)} className="space-y-4">
                      <FormField
                        control={agreementForm.control}
                        name="clientId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Client</FormLabel>
                            <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a client" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {clients.map((client: any) => (
                                  <SelectItem key={client.id} value={client.id.toString()}>
                                    {client.firstName} {client.lastName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={agreementForm.control}
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
                          control={agreementForm.control}
                          name="endDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>End Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={agreementForm.control}
                          name="planNomineeName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Plan Nominee Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter nominee name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={agreementForm.control}
                          name="planNomineeContact"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Plan Nominee Contact</FormLabel>
                              <FormControl>
                                <Input placeholder="Email or phone" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-lg font-medium">Billing Details</h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={agreementForm.control}
                            name="billingDetails.participantNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>NDIS Participant Number</FormLabel>
                                <FormControl>
                                  <Input placeholder="Enter participant number" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={agreementForm.control}
                            name="billingDetails.planNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Plan Number</FormLabel>
                                <FormControl>
                                  <Input placeholder="Enter plan number" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={agreementForm.control}
                            name="billingDetails.planManager"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Plan Manager</FormLabel>
                                <FormControl>
                                  <Input placeholder="Enter plan manager name" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={agreementForm.control}
                            name="billingDetails.planManagerContact"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Plan Manager Contact</FormLabel>
                                <FormControl>
                                  <Input placeholder="Email or phone" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      <FormField
                        control={agreementForm.control}
                        name="customTerms"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Custom Terms & Conditions</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Enter any custom terms specific to this agreement..." 
                                className="min-h-[100px]"
                                {...field} 
                              />
                            </FormControl>
                            <FormDescription>
                              These will be added to the standard terms template.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowAgreementDialog(false);
                            setEditingAgreement(null);
                            agreementForm.reset();
                          }}
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={createAgreementMutation.isPending || updateAgreementMutation.isPending}
                        >
                          {createAgreementMutation.isPending || updateAgreementMutation.isPending
                            ? "Saving..." 
                            : editingAgreement ? "Update Agreement" : "Create Agreement"
                          }
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
          </div>

          {/* Service Agreements List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Service Agreements
              </CardTitle>
              <CardDescription>
                Manage active and pending service agreements
              </CardDescription>
            </CardHeader>
            <CardContent>
              {agreementsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-slate-600">Loading agreements...</div>
                </div>
              ) : serviceAgreements?.length > 0 ? (
                <div className="space-y-4">
                  {serviceAgreements.map((agreement: any) => (
                    <Card key={agreement.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-medium text-slate-900 dark:text-slate-100">
                              {getClientName(agreement.clientId)}
                            </h3>
                            <Badge variant={getAgreementStatus(agreement) === "Active" ? "default" : 
                                           getAgreementStatus(agreement) === "Pending" ? "secondary" : "destructive"}>
                              {getAgreementStatus(agreement)}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-slate-600 dark:text-slate-400">
                            <div>
                              <span className="font-medium">Start:</span> {new Date(agreement.startDate).toLocaleDateString()}
                            </div>
                            <div>
                              <span className="font-medium">End:</span> {new Date(agreement.endDate).toLocaleDateString()}
                            </div>
                            <div>
                              <span className="font-medium">Plan Manager:</span> {agreement.billingDetails?.planManager || "N/A"}
                            </div>
                            <div>
                              <span className="font-medium">Items:</span> {agreement.items?.length || 0}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setSelectedAgreement(agreement);
                              setShowItemDialog(true);
                            }}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Item
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => openEditAgreement(agreement)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleExportPDF(agreement.id)}
                            className="flex items-center gap-1"
                          >
                            <Download className="h-4 w-4" />
                            PDF
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => deleteAgreementMutation.mutate(agreement.id)}
                            disabled={deleteAgreementMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Service Items */}
                      {agreement.items && agreement.items.length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <h4 className="font-medium mb-3 flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Service Items
                          </h4>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>NDIS Code</TableHead>
                                  <TableHead>Description</TableHead>
                                  <TableHead>Hours</TableHead>
                                  <TableHead>Weeks</TableHead>
                                  <TableHead>Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {agreement.items.map((item: any) => (
                                  <TableRow key={item.id}>
                                    <TableCell className="font-mono text-sm">{item.ndisCode}</TableCell>
                                    <TableCell className="max-w-[200px] truncate">{item.supportDescription}</TableCell>
                                    <TableCell>
                                      {((item.hoursDay || 0) + (item.hoursEvening || 0) + (item.hoursActiveNight || 0) + 
                                        (item.hoursSleepover || 0) + (item.hoursSaturday || 0) + (item.hoursSunday || 0) + 
                                        (item.hoursPublicHoliday || 0)).toFixed(1)}
                                    </TableCell>
                                    <TableCell>{item.weeks}</TableCell>
                                    <TableCell className="font-medium">
                                      ${calculateItemTotal(item).toFixed(2)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="mx-auto h-12 w-12 text-slate-400" />
                  <h3 className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                    No service agreements yet
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Create your first NDIS service agreement to get started.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add Service Item Dialog */}
          <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Service Item</DialogTitle>
                <DialogDescription>
                  Add a new service item with NDIS code, hours, and pricing details.
                </DialogDescription>
              </DialogHeader>
              <Form {...itemForm}>
                <form onSubmit={itemForm.handleSubmit(onItemSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={itemForm.control}
                      name="ndisCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>NDIS Code</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 01_011_0107_1_1" {...field} />
                          </FormControl>
                          <FormDescription>
                            Enter the official NDIS support item code
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={itemForm.control}
                      name="weeks"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Number of Weeks</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="1" 
                              placeholder="52" 
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={itemForm.control}
                    name="supportDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Support Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe the support service being provided..." 
                            className="min-h-[80px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Hours per Week</h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <FormField
                        control={itemForm.control}
                        name="hoursDay"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Day Hours</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.25" 
                                min="0" 
                                placeholder="0" 
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={itemForm.control}
                        name="hoursEvening"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Evening Hours</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.25" 
                                min="0" 
                                placeholder="0" 
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={itemForm.control}
                        name="hoursActiveNight"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Active Night Hours</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.25" 
                                min="0" 
                                placeholder="0" 
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={itemForm.control}
                        name="hoursSleepover"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sleepover Hours</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.25" 
                                min="0" 
                                placeholder="0" 
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={itemForm.control}
                        name="hoursSaturday"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Saturday Hours</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.25" 
                                min="0" 
                                placeholder="0" 
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={itemForm.control}
                        name="hoursSunday"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sunday Hours</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.25" 
                                min="0" 
                                placeholder="0" 
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={itemForm.control}
                        name="hoursPublicHoliday"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Public Holiday Hours</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.25" 
                                min="0" 
                                placeholder="0" 
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Unit Rates (per hour)</h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <FormField
                        control={itemForm.control}
                        name="unitDay"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Day Rate ($)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01" 
                                min="0" 
                                placeholder="0.00" 
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={itemForm.control}
                        name="unitEvening"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Evening Rate ($)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01" 
                                min="0" 
                                placeholder="0.00" 
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={itemForm.control}
                        name="unitActiveNight"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Active Night Rate ($)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01" 
                                min="0" 
                                placeholder="0.00" 
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={itemForm.control}
                        name="unitSleepover"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sleepover Rate ($)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01" 
                                min="0" 
                                placeholder="0.00" 
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={itemForm.control}
                        name="unitSaturday"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Saturday Rate ($)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01" 
                                min="0" 
                                placeholder="0.00" 
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={itemForm.control}
                        name="unitSunday"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sunday Rate ($)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01" 
                                min="0" 
                                placeholder="0.00" 
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={itemForm.control}
                        name="unitPublicHoliday"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Public Holiday Rate ($)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01" 
                                min="0" 
                                placeholder="0.00" 
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <FormField
                    control={itemForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Any additional notes or special conditions..." 
                            className="min-h-[80px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowItemDialog(false);
                        itemForm.reset();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createItemMutation.isPending}
                    >
                      {createItemMutation.isPending ? "Adding..." : "Add Service Item"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="medication-forms" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Completed Medication Authority Forms</CardTitle>
              <CardDescription>
                Track completed medication consent and authority documentation
              </CardDescription>
            </CardHeader>
            <CardContent>
              {medicationLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-slate-600">Loading medication forms...</div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertTriangle className="mx-auto h-12 w-12 text-slate-400" />
                  <h3 className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                    No medication forms completed
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Completed medication authority forms will appear here
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evacuation-drills" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Evacuation Drill Records</CardTitle>
              <CardDescription>
                Log and track mandatory evacuation drill compliance
              </CardDescription>
            </CardHeader>
            <CardContent>
              {drillsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-slate-600">Loading evacuation drills...</div>
                </div>
                ) : (
                <div className="text-center py-8">
                  <Calendar className="mx-auto h-12 w-12 text-slate-400" />
                  <h3 className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                    No evacuation drills recorded
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Evacuation drill records will appear here
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}