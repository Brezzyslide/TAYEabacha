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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon, Plus, Minus, Check, AlertCircle } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Individual behavior item schema (legacy - kept for compatibility)
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
  // New behavior fields
  behaviourTypes: z.array(z.string()).optional(), // Changed from single to multiple
  behaviourTriggers: z.array(z.string()).optional(),
  behaviourOverview: z.string().optional(),
  // Legacy behavior array (kept for compatibility)
  behaviours: z.array(BehaviourSchema).optional(),
  
  // Funding
  ndisNumber: z.string().optional(),
  ndisPlanStartDate: z.date().optional(),
  ndisPlanEndDate: z.date().optional(),
  fundManagementType: z.enum(["NDIA","Self","Plan"]).optional(),
  
  // Fund Details with current balances
  coreCurrentBalance: z.string().optional(),
  coreFundedAmount: z.string().optional(),
  silCurrentBalance: z.string().optional(),
  silFundedAmount: z.string().optional(),
  irregularSilCurrentBalance: z.string().optional(),
  irregularSilFundedAmount: z.string().optional(),
  otherCurrentBalance: z.string().optional(),
  otherFundedAmount: z.string().optional(),
  
  // Invoice
  invoiceName: z.string().optional(),
  invoiceEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  invoicePhone: z.string().optional(),
  invoiceAddress: z.string().optional(),
});

type FormData = z.infer<typeof ReferralFormSchema>;

export default function PublicReferralForm() {
  const [, params] = useRoute("/share/referral/:token") || useRoute("/referral/:token");
  const token = params?.token;
  
  const [linkStatus, setLinkStatus] = useState<"loading" | "valid" | "invalid" | "expired" | "exceeded">("loading");
  const [submissionStatus, setSubmissionStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const form = useForm<FormData>({
    resolver: zodResolver(ReferralFormSchema),
    defaultValues: {
      dateOfReferral: new Date(),
      clientStatus: "New",
      referrerName: "",
      referrerOrg: "",
      referrerPosition: "",
      referrerPhoneEmail: "",
      clientName: "",
      dob: undefined,
      address: "",
      phone: "",
      emergencyName: "",
      emergencyPhone: "",
      emergencyAddress: "",
      emergencyEmail: "",
      supportCategories: [],
      planManagement: [],
      howWeSupport: [],
      participantStrengths: "",
      ndisSupportAsFunded: "",
      shiftDays: "",
      shiftTimes: "",
      requiredSkillSet: "",
      aboutParticipant: "",
      likes: "",
      dislikes: "",
      medicalConditions: "",
      medications: [],
      medicationSideEffects: "",
      // New behavior structure
      behaviourTypes: [], // Changed from single to multiple
      behaviourTriggers: [],
      behaviourOverview: "",
      behaviours: [],
      ndisNumber: "",
      fundManagementType: undefined,
      coreCurrentBalance: "",
      coreFundedAmount: "",
      silCurrentBalance: "",
      silFundedAmount: "",
      irregularSilCurrentBalance: "",
      irregularSilFundedAmount: "",
      otherCurrentBalance: "",
      otherFundedAmount: "",
      invoiceName: "",
      invoiceEmail: "",
      invoicePhone: "",
      invoiceAddress: "",
      ndisPlanStartDate: undefined,
      ndisPlanEndDate: undefined,
      preferredGender: undefined,
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
      // Debug: Log the raw form data before processing
      console.log('[FORM DEBUG] Raw behaviour type:', data.behaviourType);
      console.log('[FORM DEBUG] Raw behaviour triggers:', JSON.stringify(data.behaviourTriggers, null, 2));
      console.log('[FORM DEBUG] Raw behaviour overview:', data.behaviourOverview);
      console.log('[FORM DEBUG] Raw medications from form:', JSON.stringify(data.medications, null, 2));
      
      // Process new behavior structure
      const behaviourData = {
        type: data.behaviourType?.trim() || undefined,
        triggers: data.behaviourTriggers && data.behaviourTriggers.length > 0 ? data.behaviourTriggers : undefined,
        overview: data.behaviourOverview?.trim() || undefined,
      };
      
      console.log('[FORM DEBUG] Processed behaviour data:', JSON.stringify(behaviourData, null, 2));

      // Clean and filter medications - remove empty entries
      const cleanMedications =
        (data.medications ?? [])
          .filter(m => (m?.name ?? "").trim().length > 0)
          .map(m => ({
            name: m.name.trim(),
            dosage: (m.dosage ?? "").trim() || undefined,
            frequency: (m.frequency ?? "").trim() || undefined,
          }));

      // Transform data for API - handle arrays properly for PostgreSQL
      const submitData = {
        ...data,
        dateOfReferral: data.dateOfReferral.toISOString().split('T')[0],
        dob: data.dob?.toISOString().split('T')[0],
        // Map to correct backend field names
        planStart: data.ndisPlanStartDate?.toISOString().split('T')[0],
        planEnd: data.ndisPlanEndDate?.toISOString().split('T')[0],
        referrerContact: data.referrerPhoneEmail,
        
        // Strip frontend-only keys so they don't get serialized at all
        ndisPlanStartDate: undefined,
        ndisPlanEndDate: undefined,
        referrerPhoneEmail: undefined,
        
        // Arrays: null when empty, otherwise cleaned data
        supportCategories: data.supportCategories?.length ? data.supportCategories : null,
        planManagement: data.planManagement?.length ? data.planManagement : null,
        howWeSupport: data.howWeSupport?.length ? data.howWeSupport : null,
        // NEW: Send new behavior structure
        behaviourType: behaviourData.type,
        behaviourTriggers: behaviourData.triggers,
        behaviourOverview: behaviourData.overview,
        // Legacy fields
        behaviours: null, // No longer using dynamic behavior array
        medications: cleanMedications.length ? cleanMedications : null,
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
        // Show validation issues in development for debugging
        if (errorData.issues && import.meta.env.DEV) {
          console.error("Validation issues:", errorData.issues);
          setErrorMessage(`Validation error: ${errorData.issues.map((i: any) => i.message).join(', ')}`);
        } else {
          setErrorMessage(errorData.error || "Submission failed");
        }
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
              <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6">
                
                {/* Header Section - Matching the design */}
                <div className="bg-amber-400 px-4 py-3 rounded-lg border-l-4 border-amber-600">
                  <h3 className="text-lg font-semibold text-black">Referral and participant details</h3>
                </div>
                
                {/* Date of Referral */}
                <div className="space-y-4">
                  <FormField
                    control={form.control as any}
                    name="dateOfReferral"
                    render={({ field }) => (
                      <FormItem className="w-full md:w-1/2">
                        <FormLabel>Date of Referral *</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : field.value}
                            onChange={(e) => field.onChange(new Date(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />
                
                {/* Basic Information */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900">Basic Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control as any}
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
                      control={form.control as any}
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
                      control={form.control as any}
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
                      control={form.control as any}
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
                      control={form.control as any}
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
                      control={form.control as any}
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
                      control={form.control as any}
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
                      control={form.control as any}
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
                    control={form.control as any}
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
                                checked={field.value?.includes(category.id as any) || false}
                                onCheckedChange={(checked) => {
                                  const currentValue = field.value || [];
                                  if (checked) {
                                    field.onChange([...currentValue, category.id as any]);
                                  } else {
                                    field.onChange(currentValue.filter((item: any) => item !== category.id));
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
                    control={form.control as any}
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
                    control={form.control as any}
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
                                checked={field.value?.includes(supportType.id as any) || false}
                                onCheckedChange={(checked) => {
                                  const currentValue = field.value || [];
                                  if (checked) {
                                    field.onChange([...currentValue, supportType.id as any]);
                                  } else {
                                    field.onChange(currentValue.filter((item: any) => item !== supportType.id));
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
                    control={form.control as any}
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
                    control={form.control as any}
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
                      control={form.control as any}
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
                      control={form.control as any}
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

                  {/* Behaviour of Concern - New Style */}
                  <div className="space-y-6">
                    <FormLabel className="text-lg font-medium">Behaviours of Concern</FormLabel>
                    
                    {/* Behavior Types */}
                    <div className="space-y-4">
                      <FormField
                        control={form.control as any}
                        name="behaviourTypes"
                        render={() => (
                          <FormItem>
                            <FormLabel className="text-base font-medium">Select Behavior Types *</FormLabel>
                            <FormDescription className="text-sm text-muted-foreground">
                              Choose all behavior types that apply. Multiple selections allowed.
                            </FormDescription>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {[
                                { id: "physical_aggression", label: "Physical aggression towards others" },
                                { id: "verbal_aggression", label: "Verbal aggression towards others" },
                                { id: "property_damage", label: "Property damage" },
                                { id: "self_harm", label: "Self-harm" },
                                { id: "medical_emergency", label: "Medical emergency" },
                                { id: "environmental_hazard", label: "Environmental hazard" },
                                { id: "medication_error", label: "Medication error" },
                                { id: "unauthorized_absence", label: "Unauthorized absence" },
                                { id: "sexual_misconduct", label: "Sexual misconduct" },
                                { id: "financial_exploitation", label: "Financial exploitation" },
                                { id: "neglect", label: "Neglect" },
                                { id: "other", label: "Other" }
                              ].map((type) => (
                                <FormField
                                  key={type.id}
                                  control={form.control as any}
                                  name="behaviourTypes"
                                  render={({ field }) => {
                                    return (
                                      <FormItem
                                        key={type.id}
                                        className="flex flex-row items-start space-x-3 space-y-0"
                                      >
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value?.includes(type.id)}
                                            onCheckedChange={(checked) => {
                                              return checked
                                                ? field.onChange([...field.value || [], type.id])
                                                : field.onChange(
                                                    field.value?.filter(
                                                      (value) => value !== type.id
                                                    )
                                                  )
                                            }}
                                          />
                                        </FormControl>
                                        <FormLabel className="text-sm font-normal cursor-pointer">
                                          {type.label}
                                        </FormLabel>
                                      </FormItem>
                                    )
                                  }}
                                />
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Behavior Triggers */}
                    <div className="space-y-4">
                      <FormField
                        control={form.control as any}
                        name="behaviourTriggers"
                        render={() => (
                          <FormItem>
                            <FormLabel className="text-base font-medium">Select Behavior Triggers *</FormLabel>
                            <FormDescription className="text-sm text-muted-foreground">
                              Choose all triggers that may contribute to this behavior. At least one trigger must be selected.
                            </FormDescription>
                            <div className="space-y-3">
                              {[
                                { id: "choice_control", label: "Lack of choice and control", description: "Individual is not offered options or autonomy in daily decisions (e.g. meals, activities, clothing)." },
                                { id: "change_routine", label: "Changes in routine", description: "Unplanned or unexplained disruptions to known schedules (e.g. missed outings, new support worker)." },
                                { id: "unmet_needs", label: "Unmet needs", description: "Delays or absence of support for basic needs (e.g. hunger, hygiene, rest, medical care, emotional regulation)." },
                                { id: "sensory", label: "Sensory overload or discomfort", description: "Exposure to overwhelming stimuli (e.g. loud noises, bright lights, strong smells, physical touch)." },
                                { id: "communication", label: "Poor communication or being misunderstood", description: "Limited access to AAC, complex instructions, or lack of validation leading to frustration." },
                                { id: "structure_loss", label: "Loss of predictability or structure", description: "Inconsistent support routines, unclear expectations, or lack of visual/temporal cues." },
                                { id: "disrespect", label: "Feeling disrespected or excluded", description: "Not being heard, ignored, spoken over, or left out of peer/staff interaction." },
                                { id: "unfamiliarity", label: "Unfamiliar environments or people", description: "Anxiety or distress from being in a new setting or interacting with unfamiliar staff/peers." },
                                { id: "health_discomfort", label: "Health discomfort or untreated pain", description: "Physical distress due to illness, pain, or side effects of medication not being identified or addressed." },
                                { id: "trauma_triggers", label: "Past trauma or distress triggers", description: "Exposure to reminders of past trauma (e.g. restraint, tone of voice, uniforms, confrontation)." },
                                { id: "other", label: "Other", description: "A trigger not covered by the above categories." }
                              ].map((trigger) => (
                                <FormField
                                  key={trigger.id}
                                  control={form.control as any}
                                  name="behaviourTriggers"
                                  render={({ field }) => {
                                    return (
                                      <FormItem
                                        key={trigger.id}
                                        className="flex flex-row items-start space-x-3 space-y-0"
                                      >
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value?.includes(trigger.id)}
                                            onCheckedChange={(checked) => {
                                              return checked
                                                ? field.onChange([...(field.value || []), trigger.id])
                                                : field.onChange(
                                                    field.value?.filter(
                                                      (value: string) => value !== trigger.id
                                                    )
                                                  )
                                            }}
                                          />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                          <FormLabel className="text-sm font-medium">
                                            {trigger.label}
                                          </FormLabel>
                                          <p className="text-xs text-muted-foreground">
                                            {trigger.description}
                                          </p>
                                        </div>
                                      </FormItem>
                                    )
                                  }}
                                />
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* General Overview */}
                    <div className="space-y-4">
                      <FormField
                        control={form.control as any}
                        name="behaviourOverview"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-medium">General Overview of Behavior of Concern</FormLabel>
                            <FormDescription className="text-sm text-muted-foreground">
                              Please provide a general overview describing the behavior of concern, including any additional context, patterns, or management strategies.
                            </FormDescription>
                            <FormControl>
                              <Textarea 
                                placeholder="Please describe the behavior of concern in detail, including how it presents, any patterns you've noticed, and any current management approaches..."
                                className="min-h-[100px]"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Medical Information */}
                <div className="space-y-4">
                  <div className="bg-green-50 px-4 py-3 rounded-lg border-l-4 border-green-400">
                    <h3 className="text-lg font-semibold text-green-900">Medical Information</h3>
                  </div>
                  
                  <FormField
                    control={form.control as any}
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
                            control={form.control as any}
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
                            control={form.control as any}
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
                            control={form.control as any}
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

                {/* Fund Details */}
                <div className="space-y-4">
                  <div className="bg-blue-50 px-4 py-3 rounded-lg border-l-4 border-blue-400">
                    <h3 className="text-lg font-semibold text-blue-900">Fund Details</h3>
                  </div>
                  
                  {/* NDIS Plan Dates */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control as any}
                      name="ndisPlanStartDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>NDIS Plan Start Date</FormLabel>
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
                                  {field.value ? format(field.value, "PPP") : "Select date"}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control as any}
                      name="ndisPlanEndDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>NDIS Plan End Date</FormLabel>
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
                                  {field.value ? format(field.value, "PPP") : "Select date"}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) => date < new Date()}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {/* Fund Management Type */}
                  <FormField
                    control={form.control as any}
                    name="fundManagementType"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Fund Management Type</FormLabel>
                        <FormControl>
                          <div className="flex flex-col space-y-2">
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="radio"
                                value="NDIA"
                                checked={field.value === "NDIA"}
                                onChange={() => field.onChange("NDIA")}
                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
                              />
                              <span className="text-sm font-medium text-gray-900">NDIA Managed</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="radio"
                                value="Self"
                                checked={field.value === "Self"}
                                onChange={() => field.onChange("Self")}
                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
                              />
                              <span className="text-sm font-medium text-gray-900">Self Managed</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="radio"
                                value="Plan"
                                checked={field.value === "Plan"}
                                onChange={() => field.onChange("Plan")}
                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
                              />
                              <span className="text-sm font-medium text-gray-900">Plan Managed</span>
                            </label>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Core Support Funding */}
                  <div className="border rounded-lg p-4 space-y-4 bg-blue-50">
                    <h4 className="font-medium text-sm text-blue-700">Core Support Funding</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control as any}
                        name="coreCurrentBalance"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Current Balance</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                                <Input 
                                  placeholder="0.00" 
                                  className="pl-8" 
                                  type="number"
                                  step="0.01"
                                  {...field} 
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control as any}
                        name="coreFundedAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Funded Support Core</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                                <Input 
                                  placeholder="0.00" 
                                  className="pl-8" 
                                  type="number"
                                  step="0.01"
                                  {...field} 
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  {/* SIL Support Funding */}
                  <div className="border rounded-lg p-4 space-y-4 bg-green-50">
                    <h4 className="font-medium text-sm text-green-700">SIL Support Funding</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control as any}
                        name="silCurrentBalance"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Current Balance</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                                <Input 
                                  placeholder="0.00" 
                                  className="pl-8" 
                                  type="number"
                                  step="0.01"
                                  {...field} 
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control as any}
                        name="silFundedAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Funded Support SIL</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                                <Input 
                                  placeholder="0.00" 
                                  className="pl-8" 
                                  type="number"
                                  step="0.01"
                                  {...field} 
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  {/* Irregular SIL Support Funding */}
                  <div className="border rounded-lg p-4 space-y-4 bg-yellow-50">
                    <h4 className="font-medium text-sm text-yellow-700">Irregular SIL Support Funding</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control as any}
                        name="irregularSilCurrentBalance"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Current Balance</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                                <Input 
                                  placeholder="0.00" 
                                  className="pl-8" 
                                  type="number"
                                  step="0.01"
                                  {...field} 
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control as any}
                        name="irregularSilFundedAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Funded Support Irregular SIL</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                                <Input 
                                  placeholder="0.00" 
                                  className="pl-8" 
                                  type="number"
                                  step="0.01"
                                  {...field} 
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  {/* Other Funding */}
                  <div className="border rounded-lg p-4 space-y-4 bg-purple-50">
                    <h4 className="font-medium text-sm text-purple-700">Other Funding</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control as any}
                        name="otherCurrentBalance"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Current Balance</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                                <Input 
                                  placeholder="0.00" 
                                  className="pl-8" 
                                  type="number"
                                  step="0.01"
                                  {...field} 
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control as any}
                        name="otherFundedAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Other Funded Support</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                                <Input 
                                  placeholder="0.00" 
                                  className="pl-8" 
                                  type="number"
                                  step="0.01"
                                  {...field} 
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Invoice Details */}
                <div className="space-y-4">
                  <div className="bg-gray-50 px-4 py-3 rounded-lg border-l-4 border-gray-400">
                    <h3 className="text-lg font-semibold text-gray-900">Invoice Details</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control as any}
                      name="invoiceEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="invoice@example.com" 
                              type="email"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control as any}
                      name="invoicePhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telephone Number</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="e.g., (03) 9123 4567" 
                              type="tel"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control as any}
                    name="invoiceAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter full postal address for invoicing" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                
                {/* Debug info - remove in production */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="mt-4 p-4 bg-gray-100 rounded text-xs">
                    <p>Form Valid: {form.formState.isValid ? 'Yes' : 'No'}</p>
                    <p>Submission Status: {submissionStatus}</p>
                    <p>Errors: {Object.keys(form.formState.errors).length}</p>
                    {Object.keys(form.formState.errors).length > 0 && (
                      <pre>{JSON.stringify(form.formState.errors, null, 2)}</pre>
                    )}
                  </div>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}