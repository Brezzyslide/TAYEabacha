import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Download, Upload, Plus, Eye, Trash2, AlertTriangle, FileText, Shield, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// Form Types
const FORM_TYPES = {
  med_authority: "Medication Authority",
  rp_consent: "Restrictive Practice Consent",
  med_purpose: "Medication Purpose Statement"
};

interface DownloadableForm {
  id: number;
  formType: string;
  fileName: string;
  fileUrl: string;
  uploadedBy: number;
  uploadedAt: string;
}

interface CompletedMedicationForm {
  id: number;
  clientId: number;
  fileName: string;
  fileUrl: string;
  uploadedBy: number;
  uploadedAt: string;
  clientName?: string;
  uploaderName?: string;
}

interface EvacuationDrill {
  id: number;
  siteName: string;
  drillDate: string;
  participants: string;
  issuesFound?: string;
  signedBy: string;
  createdBy: number;
  createdAt: string;
  creatorName?: string;
}

function ComplianceOverview() {
  const { data: forms = [] } = useQuery<DownloadableForm[]>({
    queryKey: ["/api/compliance/forms"],
  });

  const { data: medicationForms = [] } = useQuery<CompletedMedicationForm[]>({
    queryKey: ["/api/compliance/medication-forms"],
  });

  const { data: evacuationDrills = [] } = useQuery<EvacuationDrill[]>({
    queryKey: ["/api/compliance/evacuation-drills"],
  });

  const stats = [
    {
      title: "Downloadable Forms",
      value: forms.length,
      icon: FileText,
      description: "Available compliance forms",
      color: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
    },
    {
      title: "Completed Med Forms",
      value: medicationForms.length,
      icon: Shield,
      description: "Client medication authorities",
      color: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400"
    },
    {
      title: "Evacuation Drills",
      value: evacuationDrills.length,
      icon: Users,
      description: "Safety drill records",
      color: "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400"
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="glass-card border-slate-200 dark:border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      {stat.title}
                    </p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {stat.value}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500">
                      {stat.description}
                    </p>
                  </div>
                  <div className={`p-3 rounded-full ${stat.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="glass-card border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-900 dark:text-slate-100">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {medicationForms.slice(0, 5).map((form) => (
              <div key={form.id} className="flex items-center justify-between py-2">
                <div className="flex items-center space-x-3">
                  <Shield className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {form.fileName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {form.clientName && `Client: ${form.clientName} • `}
                      {format(new Date(form.uploadedAt), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">
                  Medication Form
                </Badge>
              </div>
            ))}
            
            {evacuationDrills.slice(0, 3).map((drill) => (
              <div key={drill.id} className="flex items-center justify-between py-2">
                <div className="flex items-center space-x-3">
                  <Users className="h-4 w-4 text-orange-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {drill.siteName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {format(new Date(drill.drillDate), "MMM d, yyyy")} • Signed by {drill.signedBy}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  Evacuation Drill
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UploadFormDialog() {
  const [open, setOpen] = useState(false);
  const [formType, setFormType] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (data: { file: File; formType: string }) => {
      const formData = new FormData();
      formData.append('file', data.file);
      formData.append('formType', data.formType);

      const response = await fetch('/api/compliance/forms/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Form uploaded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/forms"] });
      setOpen(false);
      setFormType("");
      setFile(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to upload form",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !formType) {
      toast({
        title: "Error",
        description: "Please select a file and form type",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate({ file, formType });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-tusk-600 hover:bg-tusk-700 text-white">
          <Upload className="h-4 w-4 mr-2" />
          Upload Form
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Compliance Form</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="formType">Form Type</Label>
            <Select value={formType} onValueChange={setFormType}>
              <SelectTrigger>
                <SelectValue placeholder="Select form type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="med_authority">Medication Authority</SelectItem>
                <SelectItem value="rp_consent">Restrictive Practice Consent</SelectItem>
                <SelectItem value="med_purpose">Medication Purpose Statement</SelectItem>
                <SelectItem value="incident_report">Incident Report Template</SelectItem>
                <SelectItem value="care_plan">Care Plan Template</SelectItem>
                <SelectItem value="assessment">Assessment Form</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="file">File</Label>
            <Input
              id="file"
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
            />
            <p className="text-xs text-slate-500">
              Supported formats: PDF, DOC, DOCX (max 10MB)
            </p>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={uploadMutation.isPending}
              className="bg-tusk-600 hover:bg-tusk-700 text-white"
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DownloadableFormsTab() {
  const { data: forms = [], refetch } = useQuery<DownloadableForm[]>({
    queryKey: ["/api/compliance/forms"],
  });
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Downloadable Forms Library
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {user?.role?.toLowerCase() === 'consolemanager' 
              ? "Manage global compliance forms available to all tenants"
              : "Download compliance forms for your organization"
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-green-600">Debug: Role={user?.role}</div>
          <UploadFormDialog />
        </div>
      </div>

      <div className="grid gap-4">
        {forms.map((form) => (
          <Card key={form.id} className="glass-card border-slate-200 dark:border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileText className="h-8 w-8 text-blue-600" />
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-slate-100">
                      {form.fileName}
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {FORM_TYPES[form.formType as keyof typeof FORM_TYPES] || form.formType}
                    </p>
                    <p className="text-xs text-slate-500">
                      Uploaded {format(new Date(form.uploadedAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(form.fileUrl, '_blank')}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(form.fileUrl, '_blank')}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {forms.length === 0 && (
        <Card className="glass-card border-slate-200 dark:border-slate-700">
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              No forms uploaded yet
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Upload compliance forms to make them available for staff to download.
            </p>
            <UploadFormDialog />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MedicationFormsTab() {
  const { data: forms = [] } = useQuery<CompletedMedicationForm[]>({
    queryKey: ["/api/compliance/medication-forms"],
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Completed Medication Forms
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Client-specific medication authority forms
          </p>
        </div>
        <Button className="bg-green-600 hover:bg-green-700 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Add Medication Form
        </Button>
      </div>

      <div className="grid gap-4">
        {forms.map((form) => (
          <Card key={form.id} className="glass-card border-slate-200 dark:border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Shield className="h-8 w-8 text-green-600" />
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-slate-100">
                      {form.fileName}
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Client: {form.clientName || `Client ID ${form.clientId}`}
                    </p>
                    <p className="text-xs text-slate-500">
                      Uploaded by {form.uploaderName || 'Unknown'} • {format(new Date(form.uploadedAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(form.fileUrl, '_blank')}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(form.fileUrl, '_blank')}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {forms.length === 0 && (
        <Card className="glass-card border-slate-200 dark:border-slate-700">
          <CardContent className="p-8 text-center">
            <Shield className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              No medication forms uploaded yet
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Upload client-specific medication authority forms for compliance tracking.
            </p>
            <Button className="bg-green-600 hover:bg-green-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Form
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EvacuationDrillsTab() {
  const { data: drills = [] } = useQuery<EvacuationDrill[]>({
    queryKey: ["/api/compliance/evacuation-drills"],
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Evacuation Drills
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Safety evacuation drill records and documentation
          </p>
        </div>
        <Button className="bg-orange-600 hover:bg-orange-700 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Log New Drill
        </Button>
      </div>

      <div className="grid gap-4">
        {drills.map((drill) => (
          <Card key={drill.id} className="glass-card border-slate-200 dark:border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Users className="h-8 w-8 text-orange-600" />
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-slate-100">
                      {drill.siteName}
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {format(new Date(drill.drillDate), "EEEE, MMMM d, yyyy")}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Participants: {drill.participants}
                    </p>
                    <p className="text-xs text-slate-500">
                      Signed by {drill.signedBy} • Created by {drill.creatorName || 'Unknown'}
                    </p>
                    {drill.issuesFound && (
                      <div className="flex items-center mt-2 text-amber-600">
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        <span className="text-xs">Issues identified</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View Details
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {drill.issuesFound && (
                <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Issues Found:</strong> {drill.issuesFound}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {drills.length === 0 && (
        <Card className="glass-card border-slate-200 dark:border-slate-700">
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              No evacuation drills recorded yet
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Log evacuation drills to maintain safety compliance records.
            </p>
            <Button className="bg-orange-600 hover:bg-orange-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Log Your First Drill
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function CompliancePage() {
  const { user } = useAuth();
  
  // Check if user has admin access (case-insensitive)
  const userRole = user?.role?.toLowerCase();
  const hasAdminAccess = userRole === "admin" || userRole === "consolemanager";
  
  if (!hasAdminAccess) {
    return (
      <div className="p-6">
        <Card className="glass-card border-slate-200 dark:border-slate-700">
          <CardContent className="p-8 text-center">
            <Shield className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              Access Restricted
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              Only administrators can access the Compliance Centre.
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Current role: {user?.role || 'Unknown'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Compliance Centre
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Manage compliance documents, medication forms, and safety records
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-slate-100 dark:bg-slate-800">
          <TabsTrigger 
            value="overview"
            className="data-[state=active]:bg-tusk-600 data-[state=active]:text-white"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger 
            value="forms"
            className="data-[state=active]:bg-tusk-600 data-[state=active]:text-white"
          >
            Forms Library
          </TabsTrigger>
          <TabsTrigger 
            value="medication"
            className="data-[state=active]:bg-tusk-600 data-[state=active]:text-white"
          >
            Medication Forms
          </TabsTrigger>
          <TabsTrigger 
            value="drills"
            className="data-[state=active]:bg-tusk-600 data-[state=active]:text-white"
          >
            Evacuation Drills
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ComplianceOverview />
        </TabsContent>

        <TabsContent value="forms">
          <DownloadableFormsTab />
        </TabsContent>

        <TabsContent value="medication">
          <MedicationFormsTab />
        </TabsContent>

        <TabsContent value="drills">
          <EvacuationDrillsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}