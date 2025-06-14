import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Camera, Upload, X, CheckCircle, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const medicationAdministrationSchema = z.object({
  planId: z.number().min(1, "Please select a medication"),
  timeOfDay: z.enum(["Morning", "Afternoon", "Night"], {
    required_error: "Please select time of day",
  }),
  status: z.enum(["Administered", "Refused", "Missed"], {
    required_error: "Please select administration status",
  }),
  route: z.enum(["Oral", "Injection", "Topical", "Other"], {
    required_error: "Please select administration route",
  }),
  dateTime: z.string().min(1, "Date and time is required"),
  notes: z.string().optional(),
  wasWitnessed: z.boolean(),
  medicationName: z.string().min(1, "Medication name is required"),
});

type MedicationAdministrationForm = z.infer<typeof medicationAdministrationSchema>;

interface MedicationPlan {
  id: number;
  clientId: number;
  medicationName: string;
  dosage: string;
  frequency: string;
  isActive: boolean;
}

interface RecordAdministrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: number;
  clientName: string;
}

export default function RecordAdministrationModal({
  isOpen,
  onClose,
  clientId,
  clientName,
}: RecordAdministrationModalProps) {
  const [beforePhoto, setBeforePhoto] = useState<File | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<File | null>(null);
  const [beforePreview, setBeforePreview] = useState<string | null>(null);
  const [afterPreview, setAfterPreview] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch active medication plans for this client
  const { data: medicationPlans = [] } = useQuery({
    queryKey: ["/api/medication-plans", clientId],
    queryFn: async () => {
      const response = await fetch(`/api/medication-plans?clientId=${clientId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch medication plans");
      return response.json();
    },
    enabled: isOpen && !!clientId,
  });

  const form = useForm<MedicationAdministrationForm>({
    resolver: zodResolver(medicationAdministrationSchema),
    defaultValues: {
      planId: 0,
      timeOfDay: "Morning",
      status: "Administered",
      route: "Oral",
      dateTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      notes: "",
      wasWitnessed: false,
      medicationName: "",
    },
  });

  // Create medication record mutation
  const createRecordMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/medication-records", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medication-records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/medication-plans"] });
      toast({
        title: "Administration Recorded",
        description: "Medication administration has been successfully recorded.",
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record medication administration.",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    onClose();
    form.reset();
    setBeforePhoto(null);
    setAfterPhoto(null);
    setBeforePreview(null);
    setAfterPreview(null);
  };

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    type: "before" | "after"
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = e.target?.result as string;
      if (type === "before") {
        setBeforePhoto(file);
        setBeforePreview(preview);
      } else {
        setAfterPhoto(file);
        setAfterPreview(preview);
      }
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = (type: "before" | "after") => {
    if (type === "before") {
      setBeforePhoto(null);
      setBeforePreview(null);
    } else {
      setAfterPhoto(null);
      setAfterPreview(null);
    }
  };

  const uploadPhoto = async (file: File): Promise<string> => {
    // Create a unique filename with timestamp
    const timestamp = Date.now();
    const fileName = `medication-${timestamp}-${file.name}`;
    
    // In production, implement actual file upload to cloud storage
    // For now, return a mock URL that represents where the file would be stored
    return `https://storage.careconnect.app/medications/${fileName}`;
  };

  const onSubmit = async (data: MedicationAdministrationForm) => {
    // Validate that both photos are present
    if (!beforePhoto || !afterPhoto) {
      toast({
        title: "Photos Required",
        description: "Both before and after photos must be uploaded before submitting.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Upload photos
      const beforeUrl = await uploadPhoto(beforePhoto);
      const afterUrl = await uploadPhoto(afterPhoto);

      // Create medication record
      const recordData = {
        clientId,
        planId: data.planId,
        medicationName: data.medicationName,
        status: data.status,
        route: data.route,
        timeOfDay: data.timeOfDay,
        dateTime: data.dateTime,
        notes: data.notes,
        wasWitnessed: data.wasWitnessed,
        attachmentBeforeUrl: beforeUrl,
        attachmentAfterUrl: afterUrl,
      };

      await createRecordMutation.mutateAsync(recordData);

      // Create case note if medication was refused
      if (data.status === "Refused") {
        const caseNoteData = {
          clientId,
          type: "Medication",
          content: `Medication "${data.medicationName}" was refused. Route: ${data.route}. Time: ${data.timeOfDay}. ${data.notes ? `Notes: ${data.notes}` : ""}`,
          priority: "medium",
        };
        
        await apiRequest("/api/case-notes", "POST", caseNoteData);
      }

    } catch (error) {
      console.error("Error submitting medication record:", error);
    }
  };

  const activePlans = medicationPlans.filter((plan: MedicationPlan) => plan.isActive);
  const bothPhotosUploaded = beforePhoto && afterPhoto;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Camera className="h-5 w-5" />
            <span>Record Medication Administration</span>
          </DialogTitle>
          <p className="text-sm text-gray-600">
            Recording medication administration for{" "}
            <span className="font-semibold">{clientName}</span>
          </p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Medication Selection */}
            <FormField
              control={form.control}
              name="planId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Medication *</FormLabel>
                  <Select
                    value={field.value?.toString() || ""}
                    onValueChange={(value) => {
                      const planId = parseInt(value);
                      const selectedPlan = activePlans.find((p: MedicationPlan) => p.id === planId);
                      field.onChange(planId);
                      if (selectedPlan) {
                        form.setValue("medicationName", selectedPlan.medicationName);
                      }
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select medication from active plans" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activePlans.length === 0 ? (
                        <div className="p-3 text-sm text-gray-500">
                          No active medication plans for this client
                        </div>
                      ) : (
                        activePlans.map((plan: MedicationPlan) => (
                          <SelectItem key={plan.id} value={plan.id.toString()}>
                            <div className="flex flex-col">
                              <span className="font-medium">{plan.medicationName}</span>
                              <span className="text-xs text-gray-500">
                                {plan.dosage} • {plan.frequency}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Time of Day */}
              <FormField
                control={form.control}
                name="timeOfDay"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time of Day *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Morning">Morning (AM)</SelectItem>
                        <SelectItem value="Afternoon">Afternoon (PM)</SelectItem>
                        <SelectItem value="Night">Night</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Status */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Administered">Administered</SelectItem>
                        <SelectItem value="Refused">Refused</SelectItem>
                        <SelectItem value="Missed">Missed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Route */}
              <FormField
                control={form.control}
                name="route"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Route *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Oral">Oral</SelectItem>
                        <SelectItem value="Injection">Injection</SelectItem>
                        <SelectItem value="Topical">Topical</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Date & Time */}
              <FormField
                control={form.control}
                name="dateTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date & Time *</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Administration Witnessed */}
            <FormField
              control={form.control}
              name="wasWitnessed"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Administration Witnessed</FormLabel>
                    <div className="text-sm text-gray-600">
                      Was this medication administration witnessed by another staff member?
                    </div>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Photo Attachments */}
            <div className="space-y-4">
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-4">Required Photo Attachments</h3>
                
                {/* Before Photo */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    Photo of Medication Before Administration *
                  </Label>
                  {beforePreview ? (
                    <div className="relative inline-block">
                      <img
                        src={beforePreview}
                        alt="Before administration"
                        className="w-32 h-32 object-cover rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                        onClick={() => removePhoto("before")}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                      <div className="absolute bottom-0 left-0 right-0 bg-green-500 text-white text-xs p-1 rounded-b-lg flex items-center justify-center">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Uploaded
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileChange(e, "before")}
                        className="hidden"
                        id="before-photo"
                      />
                      <Label htmlFor="before-photo" className="cursor-pointer">
                        <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-600">
                          Click to upload photo before administration
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          PNG, JPG up to 5MB
                        </p>
                      </Label>
                    </div>
                  )}
                </div>

                {/* After Photo */}
                <div className="space-y-3 mt-4">
                  <Label className="text-sm font-medium">
                    Photo of Webster Pack After Administration *
                  </Label>
                  {afterPreview ? (
                    <div className="relative inline-block">
                      <img
                        src={afterPreview}
                        alt="After administration"
                        className="w-32 h-32 object-cover rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                        onClick={() => removePhoto("after")}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                      <div className="absolute bottom-0 left-0 right-0 bg-green-500 text-white text-xs p-1 rounded-b-lg flex items-center justify-center">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Uploaded
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileChange(e, "after")}
                        className="hidden"
                        id="after-photo"
                      />
                      <Label htmlFor="after-photo" className="cursor-pointer">
                        <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-600">
                          Click to upload photo of Webster pack post-administration
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          PNG, JPG up to 5MB
                        </p>
                      </Label>
                    </div>
                  )}
                </div>

                {/* Photo Requirements Status */}
                <div className="mt-4 p-3 rounded-lg bg-gray-50">
                  <div className="flex items-center space-x-2">
                    {bothPhotosUploaded ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className={`text-sm font-medium ${bothPhotosUploaded ? 'text-green-700' : 'text-red-700'}`}>
                      {bothPhotosUploaded 
                        ? "Both required photos uploaded" 
                        : "Both before and after photos must be uploaded"
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter any additional notes about the medication administration..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createRecordMutation.isPending || !bothPhotosUploaded}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {createRecordMutation.isPending ? "Recording..." : "Record Administration"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}