/**
 * Public NDIS Referral Form Page
 * Comprehensive referral form accessible via JWT-secured public links
 */

import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon, Plus, Minus, Check, AlertCircle } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Behaviour of Concern item schema
const BehaviourSchema = z.object({
  behaviour: z.string().min(1, "Behaviour is required"),
  description: z.string().optional(),
  howItPresents: z.string().optional(),
  trigger: z.string().optional(),
  managementStrategy: z.string().optional(),
});

// Medication item schema
const MedicationSchema = z.object({
  name: z.string().min(1, "Medication name is required"),
  frequency: z.string().min(1, "Frequency is required"),
  dosage: z.string().min(1, "Dosage is required"),
});

// Main form schema
const ReferralFormSchema = z.object({
  // Header + flags
  dateOfReferral: z.date({ required_error: "Date of referral is required" }),
  clientStatus: z.enum(["New", "Returning"], { required_error: "Please select client status" }),
  
  // Referrer
  referrerName: z.string().min(1, "Referrer name is required"),
  referrerOrg: z.string().optional(),
  referrerPosition: z.string().optional(),
  referrerPhoneEmail: z.string().optional(),
  
  // Participant basics
  clientName: z.string().min(1, "Client name is required"),
  dob: z.date().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  
  // Emergency
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
  emergencyAddress: z.string().optional(),
  emergencyEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  
  // Support categories
  supportCategories: z.array(z.enum([
    "MultipleComplexDisability",
    "ForensicsSDAFunded",
    "ForensicsOutreach", 
    "NonComplexSupport",
    "ForensicsPrivateRental"
  ])).optional(),
  planManagement: z.array(z.enum(["PlanManagement"])).optional(),
  howWeSupport: z.array(z.enum([
    "ADL",
    "HandsOnSupervision",
    "LegalOrderCompliance",
    "PersonalCare",
    "CommunityAccess",
    "TransportTraining",
    "SocialGroupActivity",
    "BehaviouralManagement",
    "CompanionshipMentorship",
    "RestrictivePracticeImplementation"
  ])).optional(),
  
  // Profile
  participantStrengths: z.string().optional(),
  ndisSupportAsFunded: z.string().optional(),
  shiftDays: z.string().optional(),
  shiftTimes: z.string().optional(),
  preferredGender: z.enum(["Male","Female","Other","No"]).optional(),
  requiredSkillSet: z.string().optional(),
  aboutParticipant: z.string().optional(),
  likes: z.string().optional(),
  dislikes: z.string().optional(),
  
  // Medical
  medicalConditions: z.string().optional(),
  medications: z.array(MedicationSchema).optional(),
  medicationSideEffects: z.string().optional(),
  behaviours: z.array(BehaviourSchema).optional(),
  
  // Funding
  ndisNumber: z.string().optional(),
  planStart: z.date().optional(),
  planEnd: z.date().optional(),
  fundManagementType: z.enum(["NDIA","Self","Plan"]).optional(),
  
  // Invoice
  invoiceName: z.string().optional(),
  invoiceEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  invoicePhone: z.string().optional(),
  invoiceAddress: z.string().optional(),
});

type FormData = z.infer<typeof ReferralFormSchema>;

export default function PublicReferralForm() {
  const [, params] = useRoute("/share/referral/:token");
  const token = params?.token;
  
  const [linkStatus, setLinkStatus] = useState<"loading" | "valid" | "invalid" | "expired" | "exceeded">("loading");
  const [submissionStatus, setSubmissionStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const form = useForm<FormData>({
    resolver: zodResolver(ReferralFormSchema),
    defaultValues: {
      dateOfReferral: new Date(),
      supportCategories: [],
      planManagement: [],
      howWeSupport: [],
      behaviours: [],
      medications: [],
    },
  });

  const { fields: behaviourFields, append: appendBehaviour, remove: removeBehaviour } = useFieldArray({
    control: form.control,
    name: "behaviours",
  });

  const { fields: medicationFields, append: appendMedication, remove: removeMedication } = useFieldArray({
    control: form.control,
    name: "medications",
  });

  // Validate the referral link on mount
  useEffect(() => {
    if (!token) {
      setLinkStatus("invalid");
      return;
    }

    async function validateLink() {
      try {
        const response = await fetch(`/api/referrals/links/${token}`);
        const data = await response.json();
        
        if (response.ok && data.ok) {
          setLinkStatus("valid");
        } else {
          setLinkStatus(data.error === "expired" ? "expired" : 
                      data.error === "link-usage-exceeded" ? "exceeded" : "invalid");
        }
      } catch (error) {
        console.error("Link validation error:", error);
        setLinkStatus("invalid");
      }
    }

    validateLink();
  }, [token]);

  const onSubmit = async (data: FormData) => {
    if (!token) return;
    
    setSubmissionStatus("submitting");
    setErrorMessage("");

    try {
      // Transform dates to strings for API
      const submitData = {
        ...data,
        dateOfReferral: data.dateOfReferral.toISOString().split('T')[0],
        dob: data.dob?.toISOString().split('T')[0],
        planStart: data.planStart?.toISOString().split('T')[0],
        planEnd: data.planEnd?.toISOString().split('T')[0],
      };

      const response = await fetch(`/api/referrals/submit/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      });

      if (response.ok) {
        setSubmissionStatus("success");
      } else {
        const errorData = await response.json();
        setErrorMessage(errorData.error || "Submission failed");
        setSubmissionStatus("error");
      }
    } catch (error) {
      console.error("Submission error:", error);
      setErrorMessage("Network error - please try again");
      setSubmissionStatus("error");
    }
  };

  // Loading state
  if (linkStatus === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <div className="animate-pulse">Validating referral link...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid/expired link states
  if (linkStatus !== "valid") {
    const messages = {
      invalid: "This referral link is invalid or has been disabled.",
      expired: "This referral link has expired.",
      exceeded: "This referral link has reached its usage limit."
    };

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Link Unavailable</h2>
            <p className="text-gray-600">{messages[linkStatus]}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (submissionStatus === "success") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <Check className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Referral Submitted</h2>
            <p className="text-gray-600">
              Thank you for your referral. We will review the information and contact you soon.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main form - simplified version for better usability
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container max-w-4xl mx-auto px-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">NDIS Participant Referral Form</CardTitle>
            <CardDescription>
              Please complete this referral form to help us understand the participant's needs.
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                {/* Header Section - Matching the design */}
                <div className="bg-amber-400 px-4 py-3 rounded-lg border-l-4 border-amber-600">
                  <h3 className="text-lg font-semibold text-black">Referral and participant details</h3>
                </div>
                
                {/* Basic Information */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900">Basic Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="referrerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Your Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Your full name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="referrerPosition"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role</FormLabel>
                          <FormControl>
                            <Input placeholder="Your role or position" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="clientName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Participant Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Participant's full name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="clientStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client Status *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="New">New Client</SelectItem>
                              <SelectItem value="Returning">Returning Client</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="referrerPhoneEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Your Contact Details</FormLabel>
                          <FormControl>
                            <Input placeholder="Phone and/or email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                {/* Participant Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Participant Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="ndisNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>NDIS Number</FormLabel>
                          <FormControl>
                            <Input placeholder="NDIS participant number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Participant's phone" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Address</FormLabel>
                          <FormControl>
                            <Input placeholder="Full address" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                {/* Support Information */}
                <div className="space-y-4">
                  <div className="bg-blue-50 px-4 py-3 rounded-lg border-l-4 border-blue-400">
                    <h3 className="text-lg font-semibold text-blue-900">Support Information</h3>
                  </div>
                  
                  {/* Support Categories */}
                  <FormField
                    control={form.control}
                    name="supportCategories"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Support Categories</FormLabel>
                        <div className="space-y-3">
                          {[
                            { id: "MultipleComplexDisability", label: "Multiple Complex Disability" },
                            { id: "ForensicsSDAFunded", label: "Disability Forensics SDA Funded" },
                            { id: "ForensicsOutreach", label: "Disability Forensics Outreach" },
                            { id: "NonComplexSupport", label: "Non-Complex Support" },
                            { id: "ForensicsPrivateRental", label: "Disability Forensics Private Rental" }
                          ].map((category) => (
                            <div key={category.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={category.id}
                                checked={field.value?.includes(category.id) || false}
                                onCheckedChange={(checked) => {
                                  const currentValue = field.value || [];
                                  if (checked) {
                                    field.onChange([...currentValue, category.id]);
                                  } else {
                                    field.onChange(currentValue.filter((item: string) => item !== category.id));
                                  }
                                }}
                              />
                              <label
                                htmlFor={category.id}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {category.label}
                              </label>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Plan Management */}
                  <FormField
                    control={form.control}
                    name="planManagement"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Plan Management</FormLabel>
                        <div className="space-y-3">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="PlanManagement"
                              checked={field.value?.includes("PlanManagement") || false}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange(["PlanManagement"]);
                                } else {
                                  field.onChange([]);
                                }
                              }}
                            />
                            <label
                              htmlFor="PlanManagement"
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              Plan Management Required
                            </label>
                          </div>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* How We Support */}
                  <FormField
                    control={form.control}
                    name="howWeSupport"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Types of Support Needed</FormLabel>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {[
                            { id: "ADL", label: "Activities of Daily Living (ADL)" },
                            { id: "HandsOnSupervision", label: "Hands-On Supervision" },
                            { id: "LegalOrderCompliance", label: "Legal Order Compliance" },
                            { id: "PersonalCare", label: "Personal Care" },
                            { id: "CommunityAccess", label: "Community Access" },
                            { id: "TransportTraining", label: "Transport Training" },
                            { id: "SocialGroupActivity", label: "Social Group Activity" },
                            { id: "BehaviouralManagement", label: "Behavioural Management" },
                            { id: "CompanionshipMentorship", label: "Companionship/Mentorship" },
                            { id: "RestrictivePracticeImplementation", label: "Restrictive Practice Implementation" }
                          ].map((supportType) => (
                            <div key={supportType.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={supportType.id}
                                checked={field.value?.includes(supportType.id) || false}
                                onCheckedChange={(checked) => {
                                  const currentValue = field.value || [];
                                  if (checked) {
                                    field.onChange([...currentValue, supportType.id]);
                                  } else {
                                    field.onChange(currentValue.filter((item: string) => item !== supportType.id));
                                  }
                                }}
                              />
                              <label
                                htmlFor={supportType.id}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {supportType.label}
                              </label>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="participantStrengths"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Participant Strengths</FormLabel>
                        <FormControl>
                          <Textarea placeholder="What are the participant's strengths and abilities?" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="aboutParticipant"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>About the Participant</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Tell us about the participant's needs and situation" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="likes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Likes/Interests</FormLabel>
                          <FormControl>
                            <Textarea placeholder="What does the participant enjoy?" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="dislikes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dislikes/Concerns</FormLabel>
                          <FormControl>
                            <Textarea placeholder="What should we be aware of?" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Behaviour of Concern */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-lg font-medium">Behaviours of Concern</FormLabel>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => appendBehaviour({ 
                          behaviour: "", 
                          description: "", 
                          howItPresents: "", 
                          trigger: "", 
                          managementStrategy: "" 
                        })}
                        className="flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add Behaviour
                      </Button>
                    </div>
                    
                    {behaviourFields.length === 0 && (
                      <p className="text-sm text-muted-foreground italic">No behaviours of concern added yet. Click "Add Behaviour" to start.</p>
                    )}
                    
                    {behaviourFields.map((field, index) => (
                      <div key={field.id} className="border rounded-lg p-4 space-y-4 bg-orange-50">
                        <div className="flex justify-between items-center">
                          <h4 className="font-medium text-sm text-orange-700">Behaviour of Concern #{index + 1}</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeBehaviour(index)}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-4">
                          <FormField
                            control={form.control}
                            name={`behaviours.${index}.behaviour`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Behaviour *</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., Verbal aggression" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name={`behaviours.${index}.description`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                  <Textarea placeholder="Describe the behaviour in detail" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name={`behaviours.${index}.howItPresents`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>How it Presents</FormLabel>
                                <FormControl>
                                  <Textarea placeholder="How does this behaviour manifest or appear?" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name={`behaviours.${index}.trigger`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Trigger</FormLabel>
                                  <FormControl>
                                    <Textarea placeholder="What triggers this behaviour?" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name={`behaviours.${index}.managementStrategy`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Management Strategy</FormLabel>
                                  <FormControl>
                                    <Textarea placeholder="How should this behaviour be managed?" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Medical Information */}
                <div className="space-y-4">
                  <div className="bg-green-50 px-4 py-3 rounded-lg border-l-4 border-green-400">
                    <h3 className="text-lg font-semibold text-green-900">Medical Information</h3>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="medicalConditions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Medical Conditions</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Any relevant medical conditions or diagnoses" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Current Medications */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-lg font-medium">Current Medications</FormLabel>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => appendMedication({ name: "", frequency: "", dosage: "" })}
                        className="flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add Medication
                      </Button>
                    </div>
                    
                    {medicationFields.length === 0 && (
                      <p className="text-sm text-muted-foreground italic">No medications added yet. Click "Add Medication" to start.</p>
                    )}
                    
                    {medicationFields.map((field, index) => (
                      <div key={field.id} className="border rounded-lg p-4 space-y-4 bg-gray-50">
                        <div className="flex justify-between items-center">
                          <h4 className="font-medium text-sm text-gray-700">Medication #{index + 1}</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMedication(index)}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name={`medications.${index}.name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Medication Name *</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., Paracetamol" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name={`medications.${index}.frequency`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Frequency *</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., Twice daily" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name={`medications.${index}.dosage`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Dosage *</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., 500mg" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Submit Section */}
                {submissionStatus === "error" && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-end space-x-4">
                  <Button
                    type="submit"
                    disabled={submissionStatus === "submitting"}
                    className="min-w-[120px]"
                  >
                    {submissionStatus === "submitting" ? "Submitting..." : "Submit Referral"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}