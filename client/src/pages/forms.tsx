import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, FileText, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertFormTemplateSchema, type FormTemplate } from "@shared/schema";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

const formTemplateFormSchema = insertFormTemplateSchema.omit({ tenantId: true, createdBy: true });

type FormTemplateFormData = z.infer<typeof formTemplateFormSchema>;

const defaultFields = [
  {
    id: "1",
    type: "text",
    label: "Full Name",
    required: true,
    placeholder: "Enter full name",
  },
  {
    id: "2",
    type: "email",
    label: "Email Address",
    required: false,
    placeholder: "Enter email address",
  },
  {
    id: "3",
    type: "date",
    label: "Date of Birth",
    required: false,
  },
  {
    id: "4",
    type: "select",
    label: "Care Level",
    required: true,
    options: ["Independent", "Assisted", "Memory Care"],
  },
  {
    id: "5",
    type: "textarea",
    label: "Notes",
    required: false,
    placeholder: "Additional notes or comments",
    rows: 3,
  },
];

export default function Forms() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewingTemplate, setViewingTemplate] = useState<FormTemplate | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: templates, isLoading } = useQuery<FormTemplate[]>({
    queryKey: ["/api/form-templates"],
  });

  const { data: submissions } = useQuery({
    queryKey: ["/api/form-submissions"],
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: FormTemplateFormData) => {
      const res = await apiRequest("POST", "/api/form-templates", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/form-templates"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Form template created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const form = useForm<FormTemplateFormData>({
    resolver: zodResolver(formTemplateFormSchema),
    defaultValues: {
      name: "",
      description: "",
      fields: defaultFields,
      isActive: true,
    },
  });

  const onSubmit = (data: FormTemplateFormData) => {
    createTemplateMutation.mutate(data);
  };

  const getSubmissionCount = (templateId: number) => {
    if (!submissions) return 0;
    return (submissions as any[]).filter(s => s.templateId === templateId).length;
  };

  const isAdmin = user?.role === "admin";

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <Header />
        
        <main className="flex-1 p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Dynamic Forms</h1>
                <p className="text-gray-600 mt-1">Create and manage custom forms for assessments and intake</p>
              </div>
              
              {isAdmin && (
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Form Template
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Create Form Template</DialogTitle>
                    </DialogHeader>
                    
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <div>
                        <Label htmlFor="name">Template Name *</Label>
                        <Input
                          id="name"
                          {...form.register("name")}
                          placeholder="e.g., Client Intake Form"
                        />
                        {form.formState.errors.name && (
                          <p className="text-sm text-destructive mt-1">
                            {form.formState.errors.name.message}
                          </p>
                        )}
                      </div>
                      
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          {...form.register("description")}
                          placeholder="Describe the purpose of this form"
                          rows={3}
                        />
                      </div>
                      
                      <div>
                        <Label>Form Preview</Label>
                        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
                          <p className="text-sm text-gray-600 mb-3">
                            This template includes the following fields:
                          </p>
                          {defaultFields.map((field, index) => (
                            <div key={field.id} className="flex items-center justify-between text-sm">
                              <span className="font-medium">{field.label}</span>
                              <div className="flex items-center space-x-2">
                                <Badge variant="outline">{field.type}</Badge>
                                {field.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Advanced form builder with custom fields coming soon!
                        </p>
                      </div>
                      
                      <div className="flex justify-end space-x-2 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={createTemplateMutation.isPending}
                        >
                          Create Template
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Form Templates</p>
                      <p className="text-3xl font-bold text-gray-900">{templates?.length || 0}</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Submissions</p>
                      <p className="text-3xl font-bold text-gray-900">{(submissions as any[])?.length || 0}</p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <Edit className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Completion Rate</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {submissions ? Math.round(((submissions as any[]).filter((s: any) => s.status === 'completed').length / Math.max((submissions as any[]).length, 1)) * 100) : 0}%
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Eye className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Form Templates</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Loading templates...</div>
                ) : !templates || templates.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {isAdmin ? "No form templates found. Create your first template to get started." : "No form templates available."}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Template Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Submissions</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templates.map((template) => (
                        <TableRow key={template.id}>
                          <TableCell>
                            <div className="font-medium">{template.name}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-gray-500 max-w-xs truncate">
                              {template.description || "No description"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {getSubmissionCount(template.id)} submissions
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={template.isActive ? "default" : "secondary"}>
                              {template.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(template.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setViewingTemplate(template)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    toast({
                                      title: "Coming Soon",
                                      description: "Form editing will be available in the next update",
                                    });
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* View Template Dialog */}
      <Dialog open={!!viewingTemplate} onOpenChange={() => setViewingTemplate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewingTemplate?.name}</DialogTitle>
          </DialogHeader>
          
          {viewingTemplate && (
            <div className="space-y-4">
              <div>
                <Label>Description</Label>
                <p className="text-sm text-gray-600">
                  {viewingTemplate.description || "No description provided"}
                </p>
              </div>
              
              <div>
                <Label>Form Fields</Label>
                <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                  {((viewingTemplate.fields as any[]) || []).map((field: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div>
                        <p className="font-medium">{field.label}</p>
                        {field.placeholder && (
                          <p className="text-xs text-gray-500">{field.placeholder}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{field.type}</Badge>
                        {field.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={() => setViewingTemplate(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
