import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { hasPermission } from "@/lib/permissions";
import { apiRequest } from "@/lib/queryClient";
import { 
  Plus, 
  Minus, 
  Calculator, 
  Calendar,
  Clock,
  Users,
  FileText,
  ArrowLeft,
  Shield,
  Lock,
  AlertCircle,
} from "lucide-react";

const serviceTypes = [
  "Personal Care",
  "Domestic Assistance", 
  "Community Participation",
  "Transport",
  "Therapeutic Support",
  "Sleepover",
  "Respite Care",
  "Skill Development",
  "Employment Support",
  "Other"
];

const ratioOptions = [
  { value: "1:1", label: "1:1 (Standard)" },
  { value: "2:1", label: "2:1 (Enhanced)" },
  { value: "1:2", label: "1:2 (Group)" },
  { value: "1:3", label: "1:3 (Group)" },
  { value: "1:4", label: "1:4 (Group)" },
];

const invoiceLineSchema = z.object({
  dayISO: z.string().min(1, "Date is required"),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
  serviceType: z.string().min(1, "Service type is required"),
  ratio: z.string().min(1, "Ratio is required"),
  description: z.string().optional(),
});

const formSchema = z.object({
  participantName: z.string().min(1, "Participant name is required"),
  clientId: z.coerce.number().optional(),
  issueDateISO: z.string().min(1, "Issue date is required"),
  dueDateISO: z.string().min(1, "Due date is required"),
  notes: z.string().optional(),
  lines: z.array(invoiceLineSchema).min(1, "At least one service line is required"),
});

type FormData = z.infer<typeof formSchema>;

export default function CreateInvoice() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Get current user data for permission checking
  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  // Check if user has access to create invoices
  if (user && !hasPermission(user, "ACCESS_COMPLIANCE")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="flex items-center gap-3 p-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
          <Lock className="h-8 w-8 text-red-600 dark:text-red-400" />
          <div>
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">
              Access Restricted
            </h3>
            <p className="text-sm text-red-600 dark:text-red-400">
              Only Admin and Program Coordinators can create invoices.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
          <Shield className="h-3 w-3 mr-1" />
          Your role: {user?.role || "Unknown"}
        </Badge>
      </div>
    );
  }

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      participantName: "",
      issueDateISO: format(new Date(), "yyyy-MM-dd"),
      dueDateISO: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"), // 30 days from now
      notes: "",
      lines: [{
        dayISO: format(new Date(), "yyyy-MM-dd"),
        startTime: "09:00",
        endTime: "17:00",
        serviceType: "",
        ratio: "1:1",
        description: "",
      }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const calculatePreview = async () => {
    const formData = form.getValues();
    
    if (formData.lines.length === 0) {
      setPreview(null);
      return;
    }

    // Validate lines first
    const validationErrors = formData.lines.some(line => 
      !line.dayISO || !line.startTime || !line.endTime || !line.serviceType || !line.ratio
    );
    
    if (validationErrors) {
      setPreview(null);
      return;
    }

    setIsCalculating(true);
    try {
      const response = await apiRequest("/api/invoices/preview", {
        method: "POST",
        body: JSON.stringify({
          lines: formData.lines,
        }),
      });
      setPreview(response);
    } catch (error: any) {
      console.error("Preview calculation error:", error);
      toast({
        title: "Calculation Error",
        description: error.message || "Failed to calculate preview",
        variant: "destructive",
      });
      setPreview(null);
    } finally {
      setIsCalculating(false);
    }
  };

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return await apiRequest("/api/invoices", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (invoice) => {
      toast({
        title: "Invoice created successfully",
        description: `Invoice ${invoice.invoiceNumber} has been created.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setLocation("/compliance/invoices");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create invoice",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createInvoiceMutation.mutate(data);
  };

  const addLine = () => {
    append({
      dayISO: format(new Date(), "yyyy-MM-dd"),
      startTime: "09:00",
      endTime: "17:00",
      serviceType: "",
      ratio: "1:1",
      description: "",
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={() => setLocation("/compliance/invoices")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Invoices
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Invoice</h1>
          <p className="text-muted-foreground">
            Create a new NDIS-compliant invoice with automated pricing
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Invoice Form */}
        <div className="lg:col-span-2 space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Invoice Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Invoice Details
                  </CardTitle>
                  <CardDescription>
                    Basic information about the invoice
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="participantName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Participant Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter participant name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="clientId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Link to Client (Optional)</FormLabel>
                          <Select 
                            value={field.value?.toString() || "none"} 
                            onValueChange={(value) => field.onChange(value === "none" ? undefined : parseInt(value))}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select client" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No client linked</SelectItem>
                              {clients.map((client: any) => (
                                <SelectItem key={client.id} value={client.id.toString()}>
                                  {client.fullName || `${client.firstName} ${client.lastName}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="issueDateISO"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Issue Date *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="dueDateISO"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Due Date *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Optional notes for this invoice"
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

              {/* Service Lines */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Service Lines
                      </CardTitle>
                      <CardDescription>
                        Add service delivery details with dates, times, and ratios
                      </CardDescription>
                    </div>
                    <Button type="button" onClick={addLine} variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Line
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {fields.map((field, index) => (
                    <Card key={field.id} className="p-4">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-medium">Service Line {index + 1}</h4>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      
                      <div className="grid gap-4">
                        <div className="grid gap-4 md:grid-cols-3">
                          <FormField
                            control={form.control}
                            name={`lines.${index}.dayISO`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Date *</FormLabel>
                                <FormControl>
                                  <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name={`lines.${index}.startTime`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Start Time *</FormLabel>
                                <FormControl>
                                  <Input type="time" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name={`lines.${index}.endTime`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>End Time *</FormLabel>
                                <FormControl>
                                  <Input type="time" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="grid gap-4 md:grid-cols-2">
                          <FormField
                            control={form.control}
                            name={`lines.${index}.serviceType`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Service Type *</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select service type" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {serviceTypes.map((type) => (
                                      <SelectItem key={type} value={type}>
                                        {type}
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
                            name={`lines.${index}.ratio`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Support Ratio *</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select ratio" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {ratioOptions.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <FormField
                          control={form.control}
                          name={`lines.${index}.description`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Optional description of services provided"
                                  className="min-h-[60px]"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </Card>
                  ))}
                </CardContent>
              </Card>

              {/* Submit Button */}
              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setLocation("/compliance/invoices")}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createInvoiceMutation.isPending}
                >
                  {createInvoiceMutation.isPending ? "Creating..." : "Create Invoice"}
                </Button>
              </div>
            </form>
          </Form>
        </div>

        {/* Preview Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Invoice Preview
              </CardTitle>
              <CardDescription>
                Real-time calculation of invoice totals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={calculatePreview}
                disabled={isCalculating}
                className="w-full mb-4"
                variant="outline"
              >
                {isCalculating ? "Calculating..." : "Calculate Preview"}
              </Button>
              
              {preview && (
                <div className="space-y-4">
                  <div className="border rounded-lg p-4 space-y-2">
                    <h4 className="font-medium">Cost Breakdown</h4>
                    {preview.lines.map((line: any, index: number) => (
                      <div key={index} className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span>{line.serviceType}</span>
                          <span className="font-mono">${line.amount.toFixed(2)}</span>
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {line.dayISO} • {line.startTime}-{line.endTime} • {line.ratio} • {line.hours}h • {line.category}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span className="font-mono">${preview.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Total:</span>
                      <span className="font-mono">${preview.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
              
              {!preview && !isCalculating && (
                <div className="text-center text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>Fill in service lines and click "Calculate Preview" to see costs</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* NDIS Pricing Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">NDIS Pricing Categories</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div><strong>Daytime:</strong> 6:00 AM - 8:00 PM</div>
              <div><strong>Evening:</strong> 8:00 PM - 12:00 AM</div>
              <div><strong>Night:</strong> 12:00 AM - 6:00 AM</div>
              <div><strong>Weekend:</strong> Saturday & Sunday</div>
              <div><strong>Holiday:</strong> Public holidays</div>
              <div><strong>Sleepover:</strong> Fixed rate overnight support</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}