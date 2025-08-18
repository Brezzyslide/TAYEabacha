import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { insertClientSchema, type InsertClient } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { CalendarIcon, User, Heart, AlertTriangle, Target, ArrowLeft, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function EditClientForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const params = useParams();
  const clientId = params.clientId;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  // Fetch client data for editing
  const { data: clientData, isLoading: clientLoading, error } = useQuery({
    queryKey: ["/api/clients", clientId],
    queryFn: async () => {
      console.log("Fetching client data for editing, ID:", clientId);
      const response = await fetch(`/api/clients/${clientId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch client: ${response.status}`);
      }
      const data = await response.json();
      console.log("Client data received for editing:", data);
      return data;
    },
    enabled: !!clientId,
  });

  // Create a schema for update that makes the required fields optional
  const updateClientSchema = insertClientSchema.partial({
    tenantId: true,
    companyId: true,  
    createdBy: true
  });

  const form = useForm({
    resolver: zodResolver(updateClientSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      ndisNumber: "",
      dateOfBirth: new Date(),
      address: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      ndisGoals: "",
      likesPreferences: "",
      dislikesAversions: "",
      allergiesMedicalAlerts: "",
      primaryDiagnosis: "",
      careLevel: "",
      isActive: true
    },
  });

  // Update form when client data is loaded
  useEffect(() => {
    if (clientData) {
      form.reset({
        firstName: clientData.firstName || "",
        lastName: clientData.lastName || "",
        ndisNumber: clientData.ndisNumber || "",
        dateOfBirth: clientData.dateOfBirth ? new Date(clientData.dateOfBirth) : new Date(),
        address: clientData.address || "",
        emergencyContactName: clientData.emergencyContactName || "",
        emergencyContactPhone: clientData.emergencyContactPhone || "",
        ndisGoals: clientData.ndisGoals || "",
        likesPreferences: clientData.likesPreferences || "",
        dislikesAversions: clientData.dislikesAversions || "",
        allergiesMedicalAlerts: clientData.allergiesMedicalAlerts || "",
        primaryDiagnosis: clientData.primaryDiagnosis || "",
        careLevel: clientData.careLevel || "",
        isActive: clientData.isActive !== false
      });
    }
  }, [clientData, form]);

  const updateClientMutation = useMutation({
    mutationFn: async (data: InsertClient) => {
      const response = await apiRequest("PUT", `/api/clients/${clientId}`, data);
      return response.json();
    },
    onSuccess: (updatedClient) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
      toast({
        title: "Success",
        description: "Client updated successfully",
      });
      
      // Redirect to the client's profile page
      setLocation(`/support-work/client-profile/${updatedClient.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update client",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: any) => {
    console.log("Form submission started with data:", data);
    setIsSubmitting(true);
    
    try {
      // Only send the fields that can be updated
      const submitData = {
        firstName: data.firstName,
        lastName: data.lastName,
        ndisNumber: data.ndisNumber,
        dateOfBirth: data.dateOfBirth,
        address: data.address,
        emergencyContactName: data.emergencyContactName,
        emergencyContactPhone: data.emergencyContactPhone,
        ndisGoals: data.ndisGoals,
        likesPreferences: data.likesPreferences,
        dislikesAversions: data.dislikesAversions,
        allergiesMedicalAlerts: data.allergiesMedicalAlerts,
        primaryDiagnosis: data.primaryDiagnosis,
        careLevel: data.careLevel,
        isActive: data.isActive
      };
      
      console.log("Calling update mutation for client:", clientId, "with data:", submitData);
      const result = await updateClientMutation.mutateAsync(submitData);
      console.log("Update successful:", result);
    } catch (error) {
      console.error("Error updating client:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setLocation(`/support-work/client-profile/${clientId}`);
  };

  if (!clientId) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Invalid Client ID</h3>
            <p className="text-gray-600 mb-4">No client ID provided for editing.</p>
            <Button onClick={() => setLocation("/support-work/client-profile")} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Client List
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (clientLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading client data...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !clientData) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Client not found</h3>
            <p className="text-gray-600 mb-4">Unable to load client data for editing.</p>
            <Button onClick={() => setLocation("/support-work/client-profile")} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Client List
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button onClick={handleCancel} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Profile
          </Button>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Edit Client Profile</h1>
        <p className="text-gray-600 mt-2">Update client information and care preferences</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
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
                    <FormItem className="flex flex-col">
                      <FormLabel>Date of Birth *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
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
                      <Textarea
                        placeholder="Enter residential address"
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

          {/* Emergency Contact */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Emergency Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="emergencyContactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Emergency contact name" {...field} />
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
                      <FormLabel>Contact Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="Emergency contact phone" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Care Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="w-5 h-5" />
                Care Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="primaryDiagnosis"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Diagnosis</FormLabel>
                    <FormControl>
                      <Input placeholder="Primary diagnosis or condition" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="allergiesMedicalAlerts"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Allergies & Medical Alerts</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="List any allergies, medical alerts, or critical information"
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="careLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-blue-500" />
                      Care Level
                    </FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="grid grid-cols-1 gap-3 mt-2"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Low to Moderate" id="edit-care-low" />
                          <Label htmlFor="edit-care-low" className="cursor-pointer">Low to Moderate</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Complex" id="edit-care-complex" />
                          <Label htmlFor="edit-care-complex" className="cursor-pointer">Complex</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Multiple and Complex Need" id="edit-care-multiple" />
                          <Label htmlFor="edit-care-multiple" className="cursor-pointer">Multiple and Complex Need</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Forensic Disability" id="edit-care-forensic" />
                          <Label htmlFor="edit-care-forensic" className="cursor-pointer">Forensic Disability</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Preferences & Goals
              </CardTitle>
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
                        placeholder="Describe NDIS goals and objectives"
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
                name="likesPreferences"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Likes & Preferences</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="What does the client enjoy? Activities, food, environment preferences"
                        className="min-h-[80px]"
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
                        placeholder="What should be avoided? Triggers, dislikes, aversions"
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

          {/* Submit Buttons */}
          <div className="flex gap-4 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting || updateClientMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || updateClientMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
              onClick={(e) => {
                console.log("Update Client button clicked");
                console.log("Form valid:", form.formState.isValid);
                console.log("Form errors:", form.formState.errors);
              }}
            >
              {(isSubmitting || updateClientMutation.isPending) ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Client"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}