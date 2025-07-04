import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertClientSchema, type InsertClient } from "@shared/schema";
import { User, Calendar } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { z } from "zod";

// Create a custom form schema that handles nullable fields properly
const clientFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  ndisNumber: z.string().min(1, "NDIS number is required"),
  dateOfBirth: z.date(),
  address: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  primaryDiagnosis: z.string().optional(),
  ndisGoals: z.string().optional(),
  likesPreferences: z.string().optional(),
  dislikesAversions: z.string().optional(),
  allergiesMedicalAlerts: z.string().optional(),
  companyId: z.string(),
  isActive: z.boolean(),
});

type CreateClientFormData = z.infer<typeof clientFormSchema>;

interface SimpleCreateClientFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function SimpleCreateClientForm({ onSuccess, onCancel }: SimpleCreateClientFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreateClientFormData>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      ndisNumber: "",
      dateOfBirth: new Date(),
      address: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      primaryDiagnosis: "",
      ndisGoals: "",
      likesPreferences: "",
      dislikesAversions: "",
      allergiesMedicalAlerts: "",

      isActive: true,
    },
  });

  const createClientMutation = useMutation({
    mutationFn: async (data: any) => {
      // Server will add tenantId and createdBy from auth context
      const response = await apiRequest("POST", "/api/clients", data);
      return response.json();
    },
    onSuccess: (newClient) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      form.reset(); // Reset the form after successful creation
      toast({
        title: "Success",
        description: "Client created successfully",
      });
      
      // Redirect to the new client's profile page
      setLocation(`/support-work/client-profile/${newClient.id}`);
      
      onSuccess?.();
    },
    onError: (error: any) => {
      console.error("Client creation error:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to create client",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: CreateClientFormData) => {
    console.log("SimpleCreateClientForm - Form submission started");
    console.log("Form data received:", data);
    console.log("Form validation state:", form.formState);
    console.log("Form errors:", form.formState.errors);
    
    setIsSubmitting(true);
    try {
      // Prepare data for server - convert empty strings to null for database
      const submissionData = {
        firstName: data.firstName,
        lastName: data.lastName,
        ndisNumber: data.ndisNumber,
        dateOfBirth: data.dateOfBirth, // Already a Date object from the input handler
        address: data.address || null,
        emergencyContactName: data.emergencyContactName || null,
        emergencyContactPhone: data.emergencyContactPhone || null,
        primaryDiagnosis: data.primaryDiagnosis || null,
        ndisGoals: data.ndisGoals || null,
        likesPreferences: data.likesPreferences || null,
        dislikesAversions: data.dislikesAversions || null,
        allergiesMedicalAlerts: data.allergiesMedicalAlerts || null,
        companyId: data.companyId,
        isActive: data.isActive,
      };
      console.log("Submitting client data:", submissionData);
      const result = await createClientMutation.mutateAsync(submissionData);
      console.log("Client creation successful:", result);
    } catch (error: any) {
      console.error("SimpleCreateClientForm - Client creation error:", error);
      console.error("Error details:", error?.response?.data);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Client</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Add a new client to the system
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter first name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter last name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="ndisNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NDIS Number *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 43000012345" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth *</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          value={field.value ? format(field.value, "yyyy-MM-dd") : ""}
                          onChange={(e) => {
                            if (e.target.value) {
                              // Create a new Date object from the input value
                              const newDate = new Date(e.target.value + "T00:00:00.000Z");
                              field.onChange(newDate);
                            } else {
                              field.onChange(undefined);
                            }
                          }}
                          max={format(new Date(), "yyyy-MM-dd")}
                          min="1920-01-01"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter full address" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="emergencyContactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emergency Contact Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter emergency contact name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="emergencyContactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emergency Contact Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter emergency contact phone" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="primaryDiagnosis"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Diagnosis</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter primary diagnosis" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>NDIS Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="ndisGoals"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NDIS Goals</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter NDIS goals and objectives" 
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

          <Card>
            <CardHeader>
              <CardTitle>Care Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="likesPreferences"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Likes & Preferences</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter client's likes, preferences, and things they enjoy" 
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dislikesAversions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dislikes & Aversions</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter client's dislikes, aversions, and things to avoid" 
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

          <Card>
            <CardHeader>
              <CardTitle>Medical Information</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="allergiesMedicalAlerts"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Allergies & Medical Alerts</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter allergies, medical alerts, and important medical information" 
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

          <div className="flex justify-end space-x-4">
            {onCancel && (
              <Button variant="outline" onClick={onCancel} type="button">
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting || createClientMutation.isPending}>
              {isSubmitting || createClientMutation.isPending ? "Creating..." : "Create Client"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}