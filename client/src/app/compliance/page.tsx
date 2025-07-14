import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Download, FileText, Upload, Calendar, AlertTriangle, Plus, Trash2 } from "lucide-react";
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

  // Query for downloadable forms (global library) - fallback to sample data if API fails
  const { data: downloadableForms = [], isLoading: formsLoading, error: formsError } = useQuery({
    queryKey: ["/api/compliance/forms"],
    retry: false,
  });

  // Use sample data if API fails
  const formsToDisplay = formsError ? SAMPLE_FORMS : downloadableForms;

  // Query for completed medication forms (tenant-specific)
  const { data: medicationForms = [], isLoading: medicationLoading } = useQuery({
    queryKey: ["/api/compliance/medication-forms"],
    retry: false,
  });

  // Query for evacuation drills (tenant-specific)
  const { data: evacuationDrills = [], isLoading: drillsLoading } = useQuery({
    queryKey: ["/api/compliance/evacuation-drills"],
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

  const onSubmit = (data: any) => {
    uploadMutation.mutate(data);
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="medication-forms">Medication Forms</TabsTrigger>
          <TabsTrigger value="evacuation-drills">Evacuation Drills</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Stats Cards */}
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