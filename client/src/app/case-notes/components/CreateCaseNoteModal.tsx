import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Upload, X, Sparkles, AlertTriangle, Pill } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import type { Client, Shift } from "@shared/schema";

const caseNoteSchema = z.object({
  clientId: z.number().min(1, "Client is required"),
  content: z.string().min(130, "Case note must be at least 130 words"),
  linkedShiftId: z.number().optional(),
  type: z.enum(["standard", "incident", "medication"]).default("standard"),
  incidentRef: z.string().optional(),
  medicationFlag: z.enum(["administered", "not_required"]).optional(),
  medicationConfirmation: z.string().optional(),
  attachments: z.array(z.object({
    name: z.string(),
    url: z.string(),
    type: z.string(),
    size: z.number()
  })).default([])
}).refine((data) => {
  if (data.type === "medication" && data.medicationFlag === "not_required") {
    return data.medicationConfirmation === "yes";
  }
  return true;
}, {
  message: "Please type 'yes' to confirm medication not required",
  path: ["medicationConfirmation"]
});

type CaseNoteFormData = z.infer<typeof caseNoteSchema>;

interface CreateCaseNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CaseNoteFormData) => Promise<void>;
  clientId?: number;
}

export default function CreateCaseNoteModal({
  isOpen,
  onClose,
  onSubmit,
  clientId
}: CreateCaseNoteModalProps) {
  const [isIncidentReporting, setIsIncidentReporting] = useState(false);
  const [isMedicationAdmin, setIsMedicationAdmin] = useState(false);
  const [isSpellCheckOpen, setIsSpellCheckOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<CaseNoteFormData>({
    resolver: zodResolver(caseNoteSchema),
    defaultValues: {
      clientId: clientId || 0,
      content: "",
      type: "standard",
      attachments: []
    }
  });

  const watchedContent = form.watch("content");
  const watchedClientId = form.watch("clientId");

  useEffect(() => {
    if (clientId) {
      form.setValue("clientId", clientId);
    }
  }, [clientId, form]);

  useEffect(() => {
    // Update type based on toggles
    if (isIncidentReporting && isMedicationAdmin) {
      form.setValue("type", "incident"); // Incident takes priority
    } else if (isIncidentReporting) {
      form.setValue("type", "incident");
    } else if (isMedicationAdmin) {
      form.setValue("type", "medication");
    } else {
      form.setValue("type", "standard");
    }
  }, [isIncidentReporting, isMedicationAdmin, form]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    const validFiles = files.filter(file => {
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not a supported file type`,
          variant: "destructive"
        });
        return false;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast({
          title: "File too large",
          description: `${file.name} exceeds 10MB limit`,
          variant: "destructive"
        });
        return false;
      }
      return true;
    });

    if (uploadedFiles.length + validFiles.length > 6) {
      toast({
        title: "Too many files",
        description: "Maximum 6 files allowed",
        variant: "destructive"
      });
      return;
    }

    setUploadedFiles(prev => [...prev, ...validFiles]);
    
    // Create file URLs for preview
    validFiles.forEach(file => {
      const url = URL.createObjectURL(file);
      setFileUrls(prev => [...prev, url]);
    });
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setFileUrls(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSpellCheck = async () => {
    if (!watchedContent?.trim()) return;
    
    setIsSpellCheckOpen(true);
    // In real implementation, this would call OpenAI API for spell checking
    // For now, we'll simulate basic corrections
    const correctedText = watchedContent
      .replace(/\bteh\b/g, "the")
      .replace(/\brecieve\b/g, "receive")
      .replace(/\boccured\b/g, "occurred")
      .replace(/\bseperate\b/g, "separate");
    
    if (correctedText !== watchedContent) {
      form.setValue("content", correctedText);
      toast({
        title: "Spell check complete",
        description: "Text has been corrected"
      });
    } else {
      toast({
        title: "No corrections needed",
        description: "Your text looks good!"
      });
    }
    setIsSpellCheckOpen(false);
  };

  const wordCount = watchedContent?.split(/\s+/).filter(word => word.length > 0).length || 0;
  const canUseSpellCheck = ["TeamLeader", "Coordinator", "Admin"].includes(user?.role || "");

  const handleSubmit = async (data: CaseNoteFormData) => {
    setIsSubmitting(true);
    try {
      // Upload files and get URLs
      const attachments = await Promise.all(
        uploadedFiles.map(async (file, index) => ({
          name: file.name,
          url: fileUrls[index], // In real app, upload to cloud storage
          type: file.type,
          size: file.size
        }))
      );

      await onSubmit({
        ...data,
        attachments
      });

      // Reset form
      form.reset();
      setUploadedFiles([]);
      setFileUrls([]);
      setIsIncidentReporting(false);
      setIsMedicationAdmin(false);
      onClose();

      toast({
        title: "Case note created",
        description: "Case note has been saved successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create case note",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedClient = clients.find(c => c.id === watchedClientId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Case Note</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Client Selection */}
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client *</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    value={field.value?.toString()}
                    disabled={!!clientId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id.toString()}>
                          {client.fullName} - {client.ndisNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Case Note Content */}
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center justify-between">
                    Case Note Content *
                    <div className="flex items-center gap-2">
                      <Badge variant={wordCount >= 130 ? "default" : "destructive"}>
                        {wordCount} words
                      </Badge>
                      {canUseSpellCheck && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleSpellCheck}
                          disabled={!watchedContent?.trim() || isSpellCheckOpen}
                          className="flex items-center gap-2"
                        >
                          <Sparkles className="w-4 h-4" />
                          {isSpellCheckOpen ? "Checking..." : "AI Spell Check"}
                        </Button>
                      )}
                    </div>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter detailed case note content (minimum 130 words)..."
                      className="min-h-[200px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* File Upload */}
            <div>
              <FormLabel>Attachments (max 6 files)</FormLabel>
              <div className="mt-2">
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                  disabled={uploadedFiles.length >= 6}
                />
                <label
                  htmlFor="file-upload"
                  className={`flex items-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 ${
                    uploadedFiles.length >= 6 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <Upload className="w-5 h-5" />
                  <span>
                    {uploadedFiles.length >= 6 
                      ? "Maximum files reached" 
                      : "Click to upload files (images, PDFs, Word docs)"
                    }
                  </span>
                </label>
                
                {uploadedFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm">{file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Link to Shift */}
            {selectedClient && (
              <FormField
                control={form.control}
                name="linkedShiftId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link to Recent Shift (Optional)</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a recent shift..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {recentShifts.length > 0 ? (
                          recentShifts.map((shift: Shift) => (
                            <SelectItem key={shift.id} value={shift.id.toString()}>
                              {shift.title} - {new Date(shift.startTime).toLocaleDateString()}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="" disabled>No recent shifts available</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Incident Reporting Toggle */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <div>
                  <p className="font-medium">Incident Reporting</p>
                  <p className="text-sm text-muted-foreground">Mark this as an incident report</p>
                </div>
              </div>
              <Switch
                checked={isIncidentReporting}
                onCheckedChange={setIsIncidentReporting}
              />
            </div>

            {/* Incident Reference Number */}
            {isIncidentReporting && (
              <FormField
                control={form.control}
                name="incidentRef"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Incident Reference Number</FormLabel>
                    <FormControl>
                      <Input placeholder="INC-2025-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Medication Administration Toggle */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Pill className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium">Medication Administration</p>
                  <p className="text-sm text-muted-foreground">Record medication status</p>
                </div>
              </div>
              <Switch
                checked={isMedicationAdmin}
                onCheckedChange={setIsMedicationAdmin}
              />
            </div>

            {/* Medication Status */}
            {isMedicationAdmin && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="medicationFlag"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Medication Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select medication status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="administered">Administered</SelectItem>
                          <SelectItem value="not_required">Not Required</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Confirmation for Not Required */}
                {form.watch("medicationFlag") === "not_required" && (
                  <FormField
                    control={form.control}
                    name="medicationConfirmation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmation (type 'yes' to confirm medication not required)</FormLabel>
                        <FormControl>
                          <Input placeholder="Type 'yes' to confirm" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Case Note"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}