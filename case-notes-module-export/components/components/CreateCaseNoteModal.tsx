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
import ProgressNoteSections from "./ProgressNoteSections";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import type { Client, Shift, CaseNote } from "@shared/schema";
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
  
  // Progress note sections (for structured approach)
  progressSections: z.array(z.object({
    id: z.string(),
    content: z.string()
  })).default([]),
  
  // Additional notes for progress notes
  additionalNotes: z.string().optional(),
  
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
  // If incident didn't occur, must confirm with "Yes" (meaning confirmed no incident)
  if (!data.incidentOccurred) {
    return data.incidentConfirmation === "Yes";
  }
  return true;
}, {
  message: "Please complete all incident reporting fields",
  path: ["incidentConfirmation"]
}).refine((data) => {
  // If medication administered, must confirm record logged
  if (data.medicationStatus === "yes") {
    return typeof data.medicationRecordLogged === "boolean";
  }
  return true;
}, {
  message: "Please confirm if medication record has been logged",
  path: ["medicationRecordLogged"]
}).refine((data) => {
  // If medication refused, must have incident reference number (only if incident occurred)
  if (data.medicationStatus === "refused" && data.incidentOccurred) {
    return data.incidentRefNumber && data.incidentRefNumber.trim().length > 0;
  }
  return true;
}, {
  message: "Incident report number is required for medication refusal when incident occurred",
  path: ["incidentRefNumber"]
}).refine((data) => {
  // Progress Notes must have a linked shift
  if (data.category === "Progress Note") {
    return data.linkedShiftId && data.linkedShiftId > 0;
  }
  return true;
}, {
  message: "Progress Notes must be linked to a specific shift",
  path: ["linkedShiftId"]
});

type CaseNoteFormData = z.infer<typeof caseNoteSchema> & {
  progressSections?: Array<{ id: string; content: string }>;
};

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
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      incidentConfirmation: editingNote?.incidentConfirmation || undefined,
      medicationStatus: editingNote?.medicationStatus || undefined,
      progressSections: editingNote?.progressSections || [],
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
        incidentConfirmation: editingNote.incidentConfirmation || undefined,
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
        incidentConfirmation: undefined,
        medicationStatus: undefined,
        attachments: []
      });
    }
  }, [editingNote, clientId, form]);

  const selectedClientId = form.watch("clientId");
  const contentValue = form.watch("content");
  const incidentOccurred = form.watch("incidentOccurred");
  const incidentRefNumber = form.watch("incidentRefNumber");
  const medicationStatus = form.watch("medicationStatus");
  const selectedCategory = form.watch("category");
  const progressSections = form.watch("progressSections");
  const additionalNotesValue = form.watch("additionalNotes");
  
  // Auto-set incidentLodged to true when incident reference number is provided
  useEffect(() => {
    if (incidentOccurred && incidentRefNumber && incidentRefNumber.trim().length > 0) {
      console.log(`[CASE NOTE] Auto-setting incidentLodged to true for incident ref: ${incidentRefNumber}`);
      form.setValue("incidentLodged", true);
    }
  }, [incidentRefNumber, incidentOccurred, form]);

  // Fetch selected client data for auto-population
  const { data: selectedClient } = useQuery<Client>({
    queryKey: [`/api/clients/${selectedClientId}`],
    enabled: !!selectedClientId,
  });

  // Fetch pending case notes to validate completion restrictions
  const { data: pendingCaseNotes = [] } = useQuery<CaseNote[]>({
    queryKey: [`/api/case-notes/pending/${selectedClientId}`],
    enabled: !!selectedClientId && selectedCategory === "Progress Note",
  });

  // Auto-fetch shifts when client is selected
  const { data: availableShifts = [], isLoading: shiftsLoading, error: shiftsError } = useQuery<Shift[]>({
    queryKey: ["/api/shifts-by-client-staff", selectedClientId, user?.id],
    queryFn: async () => {
      console.log(`[CASE NOTE] Fetching shifts for client ${selectedClientId}, staff ${user?.id}`);
      const shifts = await apiRequest("GET", `/api/shifts-by-client-staff?clientId=${selectedClientId}&staffId=${user?.id}`);
      console.log(`[CASE NOTE] Received ${shifts.length} shifts:`, shifts);
      return shifts;
    },
    enabled: !!selectedClientId && !!user?.id,
  });
  
  // Fetch existing case notes to check for pending ones
  const { data: existingCaseNotes = [] } = useQuery<CaseNote[]>({
    queryKey: ["/api/case-notes", { clientId: selectedClientId, staffId: user?.id }],
    queryFn: async () => {
      return await apiRequest("GET", `/api/case-notes?clientId=${selectedClientId}&staffId=${user?.id}`);
    },
    enabled: !!selectedClientId && !!user?.id,
  });

  console.log(`[CASE NOTE] Shift fetch state:`, {
    selectedClientId,
    userId: user?.id,
    shiftsLoading,
    shiftsError,
    availableShiftsCount: availableShifts.length,
    selectedCategory,
    existingCaseNotesCount: existingCaseNotes.length
  });

  // Word count calculation (excluding HTML tags and considering progress sections)
  const wordCount = useMemo(() => {
    let text = contentValue;
    
    // For Progress Notes, include content from structured sections and additional notes
    if (selectedCategory === "Progress Note") {
      if (progressSections && progressSections.length > 0) {
        const sectionsText = progressSections.map(s => s.content).join(' ');
        text += ' ' + sectionsText;
      }
      if (additionalNotesValue) {
        text += ' ' + additionalNotesValue;
      }
    }
    
    const plainText = text.replace(/<[^>]*>/g, '').trim();
    if (!plainText) return 0;
    return plainText.split(/\s+/).filter(word => word.length > 0).length;
  }, [contentValue, selectedCategory, progressSections]);

  // Smart filtering logic for shift suggestions
  const filteredShifts = useMemo(() => {
    if (!availableShifts || availableShifts.length === 0) return [];
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const filtered = availableShifts.filter((shift: Shift) => {
      const shiftDate = new Date(shift.startTime);
      const shiftDateOnly = new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate());
      
      // Check if this shift already has a case note
      const hasExistingCaseNote = existingCaseNotes.some(note => note.linkedShiftId === shift.id);
      if (hasExistingCaseNote) {
        return false; // Exclude shifts that already have case notes
      }
      
      // Include shifts for today (any status for current documentation)
      if (shiftDateOnly.getTime() === today.getTime()) {
        return true;
      }
      
      // For Progress Notes, be more flexible to include relevant shifts
      if (selectedCategory === "Progress Note") {
        // Include shifts from the last 30 days regardless of status (for retrospective documentation)
        if (shiftDateOnly >= thirtyDaysAgo && shiftDateOnly <= today) {
          return true; // Include any shift in the last 30 days for progress notes
        }
        
        // Include future shifts that are assigned (for upcoming documentation)
        const twoWeeksFromNow = new Date(today);
        twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
        
        if (shiftDateOnly > today && shiftDateOnly <= twoWeeksFromNow) {
          const shiftStatus = (shift as any).status;
          return shiftStatus === "assigned" || shiftStatus === "in-progress";
        }
      } else {
        // For other case note types, include past shifts within 30 days (completed only)
        if (shiftDateOnly < today && shiftDateOnly >= thirtyDaysAgo) {
          const shiftStatus = (shift as any).status;
          return shiftStatus === "completed";
        }
      }
      
      return false;
    });
    
    // PRODUCTION FIX: Remove fallback logic that shows non-existent or irrelevant shifts
    // Only show shifts that meet strict criteria - no "closest proximity" fallbacks
    // This prevents phantom shift dates from appearing
    
    console.log(`[CASE NOTE] Filtered ${filtered.length} shifts from ${availableShifts.length} total for ${selectedCategory}`);
    
    return filtered;
  }, [availableShifts, existingCaseNotes, selectedCategory]);

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
    
    // Second priority: Most recent past completed shift (within last 30 days)
    const pastShifts = filteredShifts.filter((shift: Shift) => {
      const shiftDate = new Date(shift.startTime);
      const shiftDateOnly = new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate());
      return shiftDateOnly < today && (shift as any).status === "completed";
    });
    
    if (pastShifts.length > 0) {
      return pastShifts.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];
    }
    
    // Third priority: Recent past shifts (last 7 days) regardless of status
    const recentPastShifts = filteredShifts.filter((shift: Shift) => {
      const shiftDate = new Date(shift.startTime);
      const shiftDateOnly = new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate());
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return shiftDateOnly >= sevenDaysAgo && shiftDateOnly < today;
    });
    
    if (recentPastShifts.length > 0) {
      return recentPastShifts.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];
    }
    
    // Fourth priority: Near future shifts (next 7 days) that are assigned
    const nearFutureShifts = filteredShifts.filter((shift: Shift) => {
      const shiftDate = new Date(shift.startTime);
      const shiftDateOnly = new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate());
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      const shiftStatus = (shift as any).status;
      return shiftDateOnly > today && shiftDateOnly <= nextWeek && 
             (shiftStatus === "assigned" || shiftStatus === "in-progress");
    });
    
    if (nearFutureShifts.length > 0) {
      return nearFutureShifts.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];
    }
    
    // Last resort: Most recent shift by date (avoid distant future)
    return filteredShifts.sort((a, b) => {
      const aDate = new Date(a.startTime);
      const bDate = new Date(b.startTime);
      const aDiff = Math.abs(aDate.getTime() - now.getTime());
      const bDiff = Math.abs(bDate.getTime() - now.getTime());
      return aDiff - bDiff;
    })[0];
  }, [filteredShifts]);



  // Clear content when category changes to non-Progress Note types
  useEffect(() => {
    if (selectedCategory !== "Progress Note") {
      // Clear content for all non-Progress Note types to leave text boxes blank
      form.setValue("content", "");
    }
  }, [selectedCategory, form]);

  // Auto-select suggested shift and populate content
  useEffect(() => {
    if (suggestedShift && !form.getValues("linkedShiftId")) {
      form.setValue("linkedShiftId", suggestedShift.id);
      
      // Auto-populate case note title and initial content for progress notes
      if (selectedCategory === "Progress Note") {
        const shiftDate = format(new Date(suggestedShift.startTime), "MMM d, yyyy");
        const shiftTime = format(new Date(suggestedShift.startTime), "h:mm a");
        const endTime = suggestedShift.endTime ? format(new Date(suggestedShift.endTime), "h:mm a") : "ongoing";
        
        form.setValue("title", `Progress Note - ${suggestedShift.title} (${shiftDate})`);
        
        // Auto-populate initial content template with client name
        const clientName = selectedClient ? `${selectedClient.firstName} ${selectedClient.lastName}` : "[Client Name]";
        const initialContent = `📋 SHIFT SUMMARY
═══════════════════════════════════════════════════════════
📅 Date: ${shiftDate}
⏰ Time: ${shiftTime} - ${endTime}
👤 Client: ${clientName}
🏷️ Shift: ${suggestedShift.title}

🌟 PROGRESS NOTES
═══════════════════════════════════════════════════════════

💭 CLIENT PRESENTATION & MOOD:
• Current emotional state and demeanor:
• Notable behavioral observations:
• Communication patterns observed:

🎯 ACTIVITIES COMPLETED DURING SHIFT:
• Scheduled activities accomplished:
• Spontaneous activities engaged in:
• Client participation level:

📈 GOALS WORKED ON:
• NDIS goals addressed:
• Progress made toward objectives:
• Skills developed or practiced:

⚠️ CHALLENGES OR CONCERNS NOTED:
• Difficulties encountered:
• Areas requiring additional support:
• Safety considerations:

🤝 SUPPORT PROVIDED:
• Assistance given throughout shift:
• Teaching or coaching moments:
• Adaptive strategies used:

💡 RECOMMENDATIONS FOR FUTURE SHIFTS:
• Strategies to continue:
• Areas to focus on next time:
• Adjustments needed:

📝 ADDITIONAL NOTES:
• Any other relevant observations:
• Important communications with family/carers:
• Follow-up actions required:
`;
        
        if (!form.getValues("content")) {
          form.setValue("content", initialContent);
        }
      }
    }
  }, [suggestedShift, form, selectedCategory, selectedClient]);

  const spellCheckMutation = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest("POST", "/api/spellcheck-gpt", { content });
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
    console.log("[CASE NOTE SUBMIT] Starting submission with data:", data);
    
    // Prevent duplicate submissions
    if (isSubmitting) {
      console.log("[CASE NOTE SUBMIT] Already submitting, skipping");
      return;
    }
    
    try {
      setIsSubmitting(true);
      console.log("[CASE NOTE SUBMIT] Set isSubmitting to true");
      
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

      // For Progress Notes, convert structured sections into content
      let finalContent = data.content;
      if (data.category === "Progress Note" && data.progressSections && data.progressSections.length > 0) {
        // Section titles mapping
        const sectionTitles = {
          "presentation_mood": "Client Presentation & Mood",
          "activities_completed": "Activities Completed",
          "goals_worked_on": "Goals Worked On",
          "challenges_concerns": "Challenges or Concerns",
          "support_provided": "Support Provided",
          "recommendations": "Recommendations for Future"
        };
        
        // Build content from structured sections
        const sectionsContent = data.progressSections.map(section => {
          const title = sectionTitles[section.id] || section.id;
          return `${title}:\n${section.content || '[No content provided]'}\n`;
        }).join('\n');
        
        // Combine sections with additional notes
        finalContent = sectionsContent;
        if (data.additionalNotes && data.additionalNotes.trim()) {
          finalContent += `\nADDITIONAL NOTES:\n${data.additionalNotes}`;
        }
      }

      // Auto-populate timestamp with current time for case note creation
      const submissionData = {
        ...data,
        content: finalContent, // Use the processed content
        attachments,
        caseNoteTags,
        spellCheckCount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      console.log("[CASE NOTE SUBMIT] Built submission data:", submissionData);
      console.log("[CASE NOTE SUBMIT] Calling onSubmit function");

      await onSubmit(submissionData);
      
      console.log("[CASE NOTE SUBMIT] onSubmit completed successfully");
      
      // Reset form
      form.reset();
      setSpellCheckCount(0);
      setAttachments([]);
      setSpellCheckResult(null);
      setShowSpellCheckPreview(false);
      onClose();
      
      console.log("[CASE NOTE SUBMIT] Form reset and modal closed");
    } catch (error) {
      console.error("[CASE NOTE SUBMIT] Form submission error:", error);
    } finally {
      setIsSubmitting(false);
      console.log("[CASE NOTE SUBMIT] Set isSubmitting to false");
    }
  };



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
                    <FormLabel>
                      Related Shift
                      {selectedCategory === "Progress Note" && (
                        <span className="text-red-600 ml-1">*</span>
                      )}
                    </FormLabel>
                    
                    {/* Warning for Progress Note without shifts */}
                    {selectedCategory === "Progress Note" && filteredShifts?.length === 0 && selectedClientId && (
                      <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-center gap-2 text-amber-800">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="font-medium">Progress Note Requires Shift</span>
                        </div>
                        <p className="text-sm text-amber-700 mt-1">
                          Progress Notes must be linked to a specific shift to document care provided during that period. No eligible shifts are available for this client.
                        </p>
                      </div>
                    )}

                    {/* Warning about pending case notes */}
                    {selectedCategory === "Progress Note" && pendingCaseNotes?.length > 0 && (
                      <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center gap-2 text-red-800">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="font-medium">Pending Case Notes Detected</span>
                        </div>
                        <p className="text-sm text-red-700 mt-1">
                          {pendingCaseNotes.length} completed shift(s) require Progress Notes before creating new ones. Please complete pending documentation first.
                        </p>
                      </div>
                    )}
                    
                    <Select 
                      onValueChange={(value) => field.onChange(value === "0" ? undefined : parseInt(value))}
                      value={field.value?.toString() || "0"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={
                            selectedCategory === "Progress Note" 
                              ? "Select shift (required for Progress Notes)" 
                              : "Select shift (optional)"
                          } />
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
                      {selectedCategory === "Progress Note" ? (
                        filteredShifts?.length === 0 && selectedClientId ? 
                          availableShifts?.length > 0 ? 
                            `Found ${availableShifts.length} total shifts, but none are eligible (need today's or past completed shifts)` :
                            "Progress Notes require a linked shift. No shifts found for this client." :
                          "Progress Notes must document care provided during a specific shift period."
                      ) : (
                        filteredShifts?.length === 0 && selectedClientId ? 
                          availableShifts?.length > 0 ? 
                            `Found ${availableShifts.length} total shifts, but none are eligible for case notes` :
                            "No shifts available for case notes" :
                          suggestedShift ? `Suggested: ${format(new Date(suggestedShift.startTime), "MMM d 'at' h:mm a")}` : 
                          "Showing today's shifts and past completed shifts without case notes"
                      )}
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
                    <FormItem>
                      <FormLabel className="text-base">
                        Did an incident occur during this shift?
                      </FormLabel>
                      <FormDescription>
                        Select whether any incident or unusual event occurred
                      </FormDescription>
                      <div className="flex gap-4 mt-2">
                        <Button
                          type="button"
                          variant={field.value === false ? "default" : "outline"}
                          onClick={() => field.onChange(false)}
                          className="flex-1"
                        >
                          No
                        </Button>
                        <Button
                          type="button"
                          variant={field.value === true ? "default" : "outline"}
                          onClick={() => field.onChange(true)}
                          className="flex-1"
                        >
                          Yes
                        </Button>
                      </div>
                      <FormMessage />
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

                    {/* Only show incident lodged field if no incident reference number is provided */}
                    {!incidentRefNumber && (
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
                    )}
                    
                    {/* Show confirmation when incident number is provided */}
                    {incidentRefNumber && (
                      <div className="rounded-lg border p-4 bg-green-50 dark:bg-green-900/20">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm font-medium text-green-700 dark:text-green-300">
                            Incident report lodged with reference: {incidentRefNumber}
                          </span>
                        </div>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          No further incident reporting action required
                        </p>
                      </div>
                    )}
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

                {/* Medication Administration Record - only for administered medication */}
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

                {/* Medication Refusal Incident Reporting - mandatory for refused medication */}
                {medicationStatus === "refused" && (
                  <div className="space-y-4">
                    <div className="rounded-lg border p-4 bg-orange-50 dark:bg-orange-900/20">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        <span className="font-medium text-orange-800 dark:text-orange-200">
                          Medication Refusal Incident Report Required
                        </span>
                      </div>
                      <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                        Client medication refusal must be documented with an incident report number
                      </p>
                    </div>

                    <FormField
                      control={form.control}
                      name="incidentRefNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Medication Refusal Incident Report Number *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="e.g., INC-2024-001" 
                              {...field}
                              className="border-orange-200 focus:border-orange-400"
                            />
                          </FormControl>
                          <FormDescription>
                            Enter the incident report number for this medication refusal
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Progress Note Sections - Interactive Checkbox Approach */}
            {selectedCategory === "Progress Note" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Structured Progress Documentation
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant={wordCount >= 130 ? "default" : "destructive"}>
                        {wordCount} words
                      </Badge>
                      {wordCount >= 130 && <CheckCircle className="h-4 w-4 text-green-600" />}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="progressSections"
                    render={({ field }) => (
                      <FormItem>
                        <ProgressNoteSections
                          value={field.value || []}
                          onChange={(sections, additionalNotes) => {
                            field.onChange(sections);
                            form.setValue("additionalNotes", additionalNotes || "");
                          }}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}

            {/* Traditional Case Note Content for non-Progress Notes */}
            {selectedCategory !== "Progress Note" && (
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
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={(() => {
                  const isDisabled = isSubmitting || 
                    (selectedCategory === "Progress Note" && wordCount < 130) ||
                    (selectedCategory !== "Progress Note" && 
                      (!contentValue || contentValue.trim().split(/\s+/).filter(w => w.length > 0).length < 30)
                    );
                  
                  console.log("[SUBMIT BUTTON] Debug:", {
                    isSubmitting,
                    selectedCategory,
                    wordCount,
                    contentValue: contentValue?.length || 0,
                    contentWords: contentValue?.trim().split(/\s+/).filter(w => w.length > 0).length || 0,
                    isDisabled
                  });
                  
                  return isDisabled;
                })()}
                className="flex items-center gap-2"
                onClick={(e) => {
                  // Prevent rapid double-clicking
                  if (isSubmitting) {
                    e.preventDefault();
                    return;
                  }
                }}
              >
                <CheckCircle className="h-4 w-4" />
                {isSubmitting ? "Submitting..." : "Submit Case Note"}
              </Button>
              

            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}