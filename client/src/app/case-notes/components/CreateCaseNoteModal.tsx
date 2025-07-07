import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, X, Sparkles, AlertTriangle, Pill, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import type { Client, Shift } from "@shared/schema";
import { format } from "date-fns";

const caseNoteSchema = z.object({
  clientId: z.number().min(1, "Client is required"),
  content: z.string().min(130, "Case note must be at least 130 words"),
  linkedShiftId: z.number().optional(),
  title: z.string().min(1, "Title is required"),
  category: z.string().default("Progress Note"),
  
  // Incident reporting
  incidentOccurred: z.boolean(),
  incidentConfirmation: z.string().optional(),
  incidentRefNumber: z.string().optional(),
  incidentLodged: z.boolean().optional(),
  
  // Medication administration  
  medicationStatus: z.enum(["yes", "none", "refused"]).optional(),
  medicationRecordLogged: z.boolean().optional(),
  
  attachments: z.array(z.object({
    name: z.string(),
    url: z.string(),
    type: z.string(),
    size: z.number()
  })).default([])
}).refine((data) => {
  // If incident occurred, must have ref number and lodged status
  if (data.incidentOccurred) {
    return data.incidentRefNumber && typeof data.incidentLodged === "boolean";
  }
  // If incident didn't occur, must confirm with "Yes"
  if (!data.incidentOccurred) {
    return data.incidentConfirmation === "Yes";
  }
  return true;
}, {
  message: "Please complete all incident reporting fields",
  path: ["incidentOccurred"]
}).refine((data) => {
  // If medication administered, must confirm record logged
  if (data.medicationStatus === "yes") {
    return typeof data.medicationRecordLogged === "boolean";
  }
  return true;
}, {
  message: "Please confirm if medication record has been logged",
  path: ["medicationRecordLogged"]
});

type CaseNoteFormData = z.infer<typeof caseNoteSchema>;

interface CreateCaseNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CaseNoteFormData & { caseNoteTags: any; spellCheckCount: number }) => Promise<void>;
  clientId?: number;
  editingNote?: any;
}

export default function CreateCaseNoteModal({ 
  isOpen, 
  onClose, 
  onSubmit,
  clientId,
  editingNote
}: CreateCaseNoteModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [spellCheckCount, setSpellCheckCount] = useState(0);
  const [spellCheckResult, setSpellCheckResult] = useState<{ original: string; corrected: string } | null>(null);
  const [showSpellCheckPreview, setShowSpellCheckPreview] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const form = useForm<CaseNoteFormData>({
    resolver: zodResolver(caseNoteSchema),
    defaultValues: {
      clientId: editingNote?.clientId || clientId || 0,
      content: editingNote?.content || "",
      title: editingNote?.title || "",
      category: editingNote?.category || "Progress Note",
      incidentOccurred: editingNote?.incidentOccurred || false,
      medicationStatus: editingNote?.medicationStatus || undefined,
      attachments: editingNote?.attachments || []
    },
  });

  // Reset form when editingNote changes (ensure original content is loaded)
  useEffect(() => {
    if (editingNote) {
      form.reset({
        clientId: editingNote.clientId,
        title: editingNote.title,
        content: editingNote.content,
        category: editingNote.category || "Progress Note",
        incidentOccurred: editingNote.incidentOccurred || false,
        medicationStatus: editingNote.medicationStatus || undefined,
        attachments: editingNote.attachments || []
      });
    } else if (clientId) {
      form.reset({
        clientId: clientId,
        content: "",
        title: "",
        category: "Progress Note",
        incidentOccurred: false,
        medicationStatus: undefined,
        attachments: []
      });
    }
  }, [editingNote, clientId, form]);

  const selectedClientId = form.watch("clientId");
  const contentValue = form.watch("content");
  const incidentOccurred = form.watch("incidentOccurred");
  const medicationStatus = form.watch("medicationStatus");

  // Auto-fetch shifts when client is selected
  const { data: availableShifts = [] } = useQuery<Shift[]>({
    queryKey: ["/api/shifts-by-client-staff", selectedClientId, user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/shifts-by-client-staff?clientId=${selectedClientId}&staffId=${user?.id}`);
      if (!response.ok) throw new Error('Failed to fetch shifts');
      return response.json();
    },
    enabled: !!selectedClientId && !!user?.id,
  });

  // Word count calculation
  const wordCount = useMemo(() => {
    return contentValue.trim().split(/\s+/).filter(word => word.length > 0).length;
  }, [contentValue]);

  // Smart filtering logic for shift suggestions
  const filteredShifts = useMemo(() => {
    if (!availableShifts || availableShifts.length === 0) return [];
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return availableShifts.filter((shift: Shift) => {
      const shiftDate = new Date(shift.startTime);
      const shiftDateOnly = new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate());
      
      // Include shifts for today
      if (shiftDateOnly.getTime() === today.getTime()) {
        return true;
      }
      
      // Include past completed shifts that don't have case notes yet
      if (shiftDateOnly < today) {
        const shiftStatus = (shift as any).status;
        // Only show completed shifts without case notes
        return shiftStatus === "completed";
      }
      
      // Exclude future shifts
      return false;
    });
  }, [availableShifts]);

  // Suggest most relevant shift (prioritize today's shifts, then most recent past shift)
  const suggestedShift = useMemo(() => {
    if (!filteredShifts || filteredShifts.length === 0) return null;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // First priority: Today's shifts
    const todayShifts = filteredShifts.filter((shift: Shift) => {
      const shiftDate = new Date(shift.startTime);
      const shiftDateOnly = new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate());
      return shiftDateOnly.getTime() === today.getTime();
    });
    
    if (todayShifts.length > 0) {
      // Return the most recent today's shift
      return todayShifts.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];
    }
    
    // Second priority: Most recent past completed shift
    const pastShifts = filteredShifts.filter((shift: Shift) => {
      const shiftDate = new Date(shift.startTime);
      const shiftDateOnly = new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate());
      return shiftDateOnly < today;
    });
    
    if (pastShifts.length > 0) {
      return pastShifts.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];
    }
    
    return filteredShifts[0];
  }, [filteredShifts]);

  // Auto-select suggested shift if only one or set suggestion
  useEffect(() => {
    if (suggestedShift && !form.getValues("linkedShiftId")) {
      form.setValue("linkedShiftId", suggestedShift.id);
    }
  }, [suggestedShift, form]);

  const spellCheckMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch("/api/spellcheck-gpt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error('Spell check failed');
      return response.json();
    },
    onSuccess: (data: { original: string; corrected: string }) => {
      setSpellCheckResult(data);
      setShowSpellCheckPreview(true);
      toast({
        title: "Spell Check Complete",
        description: "Review the suggested corrections below.",
      });
    },
    onError: () => {
      toast({
        title: "Spell Check Failed",
        description: "Unable to perform spell check. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSpellCheck = () => {
    if (spellCheckCount >= 2) {
      toast({
        title: "Spell Check Limit Reached",
        description: "You have used all 2 spell checks for this submission.",
        variant: "destructive",
      });
      return;
    }

    if (!contentValue.trim()) {
      toast({
        title: "No Content",
        description: "Please enter some content before spell checking.",
        variant: "destructive",
      });
      return;
    }

    setSpellCheckCount(prev => prev + 1);
    spellCheckMutation.mutate(contentValue);
  };

  const acceptSpellCheck = () => {
    if (spellCheckResult) {
      form.setValue("content", spellCheckResult.corrected);
      setShowSpellCheckPreview(false);
      setSpellCheckResult(null);
      toast({
        title: "Corrections Applied",
        description: "Spell check corrections have been applied to your case note.",
      });
    }
  };

  const rejectSpellCheck = () => {
    setShowSpellCheckPreview(false);
    setSpellCheckResult(null);
  };

  const handleSubmit = async (data: CaseNoteFormData) => {
    try {
      // Build case note tags structure
      const caseNoteTags = {
        incident: {
          occurred: data.incidentOccurred,
          ...(data.incidentOccurred && {
            refNumber: data.incidentRefNumber,
            lodged: data.incidentLodged
          }),
          ...((!data.incidentOccurred && data.incidentConfirmation === "Yes") && {
            confirmed: true
          })
        },
        medication: data.medicationStatus ? {
          status: data.medicationStatus,
          ...(data.medicationStatus === "yes" && {
            recordLogged: data.medicationRecordLogged
          })
        } : undefined
      };

      await onSubmit({
        ...data,
        attachments,
        caseNoteTags,
        spellCheckCount
      });
      
      // Reset form
      form.reset();
      setSpellCheckCount(0);
      setAttachments([]);
      setSpellCheckResult(null);
      setShowSpellCheckPreview(false);
      onClose();
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5" />
            {editingNote ? "Edit Case Note" : "Create Case Note"}
            {editingNote && (
              <div className="text-sm text-gray-500 font-normal mt-1">
                Created on {new Date(editingNote.createdAt).toLocaleDateString()} 
                {editingNote.createdAt !== editingNote.updatedAt && (
                  <span> • Last updated {new Date(editingNote.updatedAt).toLocaleDateString()}</span>
                )}
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Client and Shift Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client *</FormLabel>
                    {editingNote ? (
                      // Show client name as read-only when editing
                      <div className="flex items-center p-2 border rounded-md bg-gray-50 dark:bg-gray-800">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {selectedClient ? `${selectedClient.firstName} ${selectedClient.lastName} (${selectedClient.clientId})` : 'Unknown Client'}
                        </span>
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Cannot be changed
                        </Badge>
                      </div>
                    ) : (
                      // Editable dropdown for new case notes
                      <Select 
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select client" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id.toString()}>
                              {client.firstName} {client.lastName} ({client.clientId})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="linkedShiftId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Related Shift</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value === "0" ? undefined : parseInt(value))}
                      value={field.value?.toString() || "0"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select shift (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">No shift selected</SelectItem>
                        {filteredShifts?.map((shift: Shift) => (
                          <SelectItem key={shift.id} value={shift.id.toString()}>
                            {format(new Date(shift.startTime), "MMM d, yyyy 'at' h:mm a")} - {shift.title}
                            {shift.id === suggestedShift?.id && (
                              <Badge variant="outline" className="ml-2 text-xs">Suggested</Badge>
                            )}
                          </SelectItem>
                        )) || []}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {(filteredShifts?.length === 0) && selectedClientId ? 
                        "No shifts available for case notes (showing today's shifts and past completed shifts only)" :
                        suggestedShift ? `Suggested: ${format(new Date(suggestedShift.startTime), "MMM d 'at' h:mm a")}` : 
                        "Showing today's shifts and past completed shifts without case notes"
                      }
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Title and Category */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Case Note Title *</FormLabel>
                    <FormControl>
                      <Input placeholder="Brief description of this case note" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Progress Note">Progress Note</SelectItem>
                        <SelectItem value="Incident Follow-up">Incident Follow-up</SelectItem>
                        <SelectItem value="Medication Review">Medication Review</SelectItem>
                        <SelectItem value="Support Review">Support Review</SelectItem>
                        <SelectItem value="General Update">General Update</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Incident Reporting Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-4 w-4" />
                  Incident Reporting
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="incidentOccurred"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Did an incident occur during this shift?
                        </FormLabel>
                        <FormDescription>
                          Toggle if any incident or unusual event occurred
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

                {!incidentOccurred && (
                  <FormField
                    control={form.control}
                    name="incidentConfirmation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Are you sure no incident occurred? *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-32">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Yes">Yes</SelectItem>
                            <SelectItem value="No">No</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>Please confirm no incident occurred</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {incidentOccurred && (
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="incidentRefNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Incident Report Number *</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., INC-2024-001" {...field} />
                          </FormControl>
                          <FormDescription>Enter the incident report reference number</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="incidentLodged"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">
                              Has the incident report been lodged? *
                            </FormLabel>
                            <FormDescription>
                              Confirm if the incident has been officially reported
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Medication Administration Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Pill className="h-4 w-4" />
                  Medication Administration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="medicationStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Was medication administered?</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select medication status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="yes">Yes – Medication was administered</SelectItem>
                          <SelectItem value="none">No – No medication required</SelectItem>
                          <SelectItem value="refused">Refused – Client refused medication</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {medicationStatus === "yes" && (
                  <FormField
                    control={form.control}
                    name="medicationRecordLogged"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Has a Medication Administration record been submitted? *
                          </FormLabel>
                          <FormDescription>
                            Confirm if the medication record has been logged separately
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value || false}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>

            {/* Case Note Content */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Case Note Content
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant={wordCount >= 130 ? "default" : "destructive"}>
                      {wordCount} words
                    </Badge>
                    {wordCount >= 130 && <CheckCircle className="h-4 w-4 text-green-600" />}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Case Note Details *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter detailed case note content (minimum 130 words)..."
                          className="min-h-[200px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Minimum 130 words required. Current: {wordCount} words
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSpellCheck}
                      disabled={spellCheckCount >= 2 || spellCheckMutation.isPending || !contentValue.trim()}
                      className="flex items-center gap-2"
                    >
                      <Sparkles className="h-4 w-4" />
                      Check Spelling
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {2 - spellCheckCount} checks remaining
                    </span>
                  </div>
                  
                  {spellCheckMutation.isPending && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                      Checking spelling...
                    </div>
                  )}
                </div>

                {/* Spell Check Preview */}
                {showSpellCheckPreview && spellCheckResult && (
                  <Card className="border-blue-200 bg-blue-50">
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Spell Check Results
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Corrected Version:</p>
                          <div className="bg-white p-3 rounded border text-sm">
                            {spellCheckResult.corrected}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" size="sm" onClick={acceptSpellCheck}>
                            Accept Changes
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={rejectSpellCheck}>
                            Keep Original
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={wordCount < 130}
                className="flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                Submit Case Note
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}