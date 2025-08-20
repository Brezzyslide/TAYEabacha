import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Plus, Trash2, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Form field types
const fieldTypes = [
  { value: "text", label: "Text Input" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone Number" },
  { value: "textarea", label: "Long Text" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
  { value: "radio", label: "Radio Buttons" },
  { value: "file", label: "File Upload" },
  { value: "date", label: "Date" },
  { value: "number", label: "Number" }
];

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  formType: z.enum(["medical", "therapy", "assessment", "support", "other"]),
  requiresApproval: z.boolean().default(false),
  allowMultipleSubmissions: z.boolean().default(false),
  fields: z.array(z.object({
    id: z.string(),
    type: z.string(),
    label: z.string().min(1, "Field label is required"),
    placeholder: z.string().optional(),
    required: z.boolean().default(false),
    options: z.array(z.string()).optional(),
    validationRules: z.object({
      minLength: z.number().optional(),
      maxLength: z.number().optional(),
      pattern: z.string().optional()
    }).optional()
  })).min(1, "At least one field is required")
});

type FormData = z.infer<typeof formSchema>;

export default function CreateReferralForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      formType: "medical",
      requiresApproval: false,
      allowMultipleSubmissions: false,
      fields: [
        {
          id: crypto.randomUUID(),
          type: "text",
          label: "Full Name",
          placeholder: "Enter your full name",
          required: true
        },
        {
          id: crypto.randomUUID(),
          type: "email",
          label: "Email Address",
          placeholder: "Enter your email",
          required: true
        }
      ]
    }
  });

  const createFormMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return await apiRequest("/api/compliance/referral-forms", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          fieldsSchema: { fields: data.fields }
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Form created successfully",
        description: "Your referral form has been created and is ready to use.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/referral-forms"] });
      setLocation("/compliance/referral-forms");
    },
    onError: (error: any) => {
      toast({
        title: "Error creating form",
        description: error.message || "Failed to create referral form",
        variant: "destructive",
      });
    },
  });

  const addField = () => {
    const currentFields = form.getValues("fields");
    form.setValue("fields", [
      ...currentFields,
      {
        id: crypto.randomUUID(),
        type: "text",
        label: "",
        placeholder: "",
        required: false
      }
    ]);
  };

  const removeField = (index: number) => {
    const currentFields = form.getValues("fields");
    if (currentFields.length > 1) {
      form.setValue("fields", currentFields.filter((_, i) => i !== index));
    }
  };

  const onSubmit = (data: FormData) => {
    createFormMutation.mutate(data);
  };

  const handleBack = () => {
    setLocation("/compliance/referral-forms");
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button variant="ghost" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Referral Form</h1>
          <p className="text-muted-foreground">
            Build a custom form that third parties can complete and submit
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Form Configuration */}
            <div className="lg:col-span-1 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Form Details</CardTitle>
                  <CardDescription>
                    Configure the basic information for your referral form
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Form Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Medical Referral Form" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Brief description of the form purpose..."
                            rows={3}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="formType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Form Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select form type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="medical">Medical</SelectItem>
                            <SelectItem value="therapy">Therapy</SelectItem>
                            <SelectItem value="assessment">Assessment</SelectItem>
                            <SelectItem value="support">Support</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />

                  <FormField
                    control={form.control}
                    name="requiresApproval"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Requires Approval</FormLabel>
                          <FormDescription>
                            Submissions need manual review before processing
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="allowMultipleSubmissions"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Multiple Submissions</FormLabel>
                          <FormDescription>
                            Allow the same person to submit multiple times
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Form Builder */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Form Fields</CardTitle>
                  <CardDescription>
                    Add and configure the fields for your referral form
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {form.watch("fields").map((field, index) => (
                    <div key={field.id} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center space-x-4">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name={`fields.${index}.label`}
                            render={({ field: fieldProps }) => (
                              <FormItem>
                                <FormLabel>Field Label</FormLabel>
                                <FormControl>
                                  <Input placeholder="Field label" {...fieldProps} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`fields.${index}.type`}
                            render={({ field: fieldProps }) => (
                              <FormItem>
                                <FormLabel>Field Type</FormLabel>
                                <Select 
                                  onValueChange={fieldProps.onChange} 
                                  value={fieldProps.value}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {fieldTypes.map((type) => (
                                      <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <FormField
                            control={form.control}
                            name={`fields.${index}.required`}
                            render={({ field: fieldProps }) => (
                              <FormItem className="flex items-center space-x-2">
                                <FormControl>
                                  <Switch
                                    checked={fieldProps.value}
                                    onCheckedChange={fieldProps.onChange}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm">Required</FormLabel>
                              </FormItem>
                            )}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeField(index)}
                            disabled={form.watch("fields").length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <FormField
                        control={form.control}
                        name={`fields.${index}.placeholder`}
                        render={({ field: fieldProps }) => (
                          <FormItem>
                            <FormLabel>Placeholder Text</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter placeholder text..." {...fieldProps} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={addField}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Field
                  </Button>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex justify-end space-x-4">
                <Button type="button" variant="outline" onClick={handleBack}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createFormMutation.isPending}
                >
                  {createFormMutation.isPending ? "Creating..." : "Create Form"}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}