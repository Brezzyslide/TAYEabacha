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
import { Badge } from "@/components/ui/badge";
import { X, Plus, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { CaseNote, Shift } from "@shared/schema";
import SpellCheckModal from "./SpellCheckModal";

const caseNoteSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(10, "Content must be at least 10 characters"),
  type: z.enum(["standard", "incident", "medication"]),
  category: z.string().min(1, "Category is required"),
  priority: z.enum(["normal", "high", "urgent"]),
  tags: z.array(z.string()).default([]),
  linkedShiftId: z.number().optional(),
  incidentData: z.object({
    severity: z.string().optional(),
    actionTaken: z.string().optional(),
    followUpRequired: z.boolean().optional(),
  }).optional(),
  medicationData: z.object({
    medicationName: z.string().optional(),
    dosage: z.string().optional(),
    timeAdministered: z.string().optional(),
    reaction: z.string().optional(),
  }).optional(),
});

type CaseNoteFormData = z.infer<typeof caseNoteSchema>;

interface CaseNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CaseNoteFormData) => Promise<void>;
  caseNote?: CaseNote;
  recentShifts: Shift[];
  userRole: string;
}

export default function CaseNoteModal({
  isOpen,
  onClose,
  onSubmit,
  caseNote,
  recentShifts,
  userRole,
}: CaseNoteModalProps) {
  const [newTag, setNewTag] = useState("");
  const [isSpellCheckOpen, setIsSpellCheckOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<CaseNoteFormData>({
    resolver: zodResolver(caseNoteSchema),
    defaultValues: {
      title: "",
      content: "",
      type: "standard",
      category: "Progress Note",
      priority: "normal",
      tags: [],
      linkedShiftId: undefined,
      incidentData: undefined,
      medicationData: undefined,
    },
  });

  const watchedType = form.watch("type");
  const watchedContent = form.watch("content");

  useEffect(() => {
    if (caseNote) {
      form.reset({
        title: caseNote.title,
        content: caseNote.content,
        type: caseNote.type as "standard" | "incident" | "medication",
        category: caseNote.category,
        priority: caseNote.priority as "normal" | "high" | "urgent",
        tags: caseNote.tags || [],
        linkedShiftId: caseNote.linkedShiftId || undefined,
        incidentData: caseNote.incidentData as any,
        medicationData: caseNote.medicationData as any,
      });
    } else {
      form.reset({
        title: "",
        content: "",
        type: "standard",
        category: "Progress Note",
        priority: "normal",
        tags: [],
        linkedShiftId: undefined,
        incidentData: undefined,
        medicationData: undefined,
      });
    }
  }, [caseNote, form]);

  const handleSubmit = async (data: CaseNoteFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      onClose();
      toast({
        title: caseNote ? "Case Note Updated" : "Case Note Created",
        description: `Case note "${data.title}" has been ${caseNote ? "updated" : "created"} successfully.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${caseNote ? "update" : "create"} case note. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addTag = () => {
    if (newTag.trim() && !form.getValues("tags").includes(newTag.trim())) {
      const currentTags = form.getValues("tags");
      form.setValue("tags", [...currentTags, newTag.trim()]);
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    const currentTags = form.getValues("tags");
    form.setValue("tags", currentTags.filter(tag => tag !== tagToRemove));
  };

  const handleSpellCheckApply = (correctedText: string) => {
    form.setValue("content", correctedText);
  };

  const canUseSpellCheck = ["TeamLeader", "Coordinator", "Admin"].includes(userRole);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {caseNote ? "Edit Case Note" : "Create New Case Note"}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Case note title..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="incident">Incident</SelectItem>
                          <SelectItem value="medication">Medication</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Progress Note">Progress Note</SelectItem>
                          <SelectItem value="Medication Note">Medication Note</SelectItem>
                          <SelectItem value="Incident Report">Incident Report</SelectItem>
                          <SelectItem value="Activity Note">Activity Note</SelectItem>
                          <SelectItem value="Care Plan Note">Care Plan Note</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Shift Linking */}
              <FormField
                control={form.control}
                name="linkedShiftId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link to Recent Shift (Optional)</FormLabel>
                    <Select onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)} 
                            value={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={recentShifts.length > 0 ? "Select a recent shift..." : "No recent shifts available"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {recentShifts.length > 0 ? (
                          recentShifts.map((shift) => (
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

              {/* Content with Spell Check */}
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center justify-between">
                      Content
                      {canUseSpellCheck && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsSpellCheckOpen(true)}
                          disabled={!watchedContent?.trim()}
                          className="flex items-center gap-2"
                        >
                          <Sparkles className="w-4 h-4" />
                          AI Spell Check
                        </Button>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Detailed case note content..."
                        className="min-h-[150px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tags */}
              <div>
                <FormLabel>Tags</FormLabel>
                <div className="flex flex-wrap gap-2 mb-2">
                  {form.watch("tags").map((tag, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {tag}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() => removeTag(tag)}
                      />
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add tag..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                  />
                  <Button type="button" onClick={addTag} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Incident-specific fields */}
              {watchedType === "incident" && (
                <div className="space-y-4 p-4 border rounded-lg bg-orange-50">
                  <h3 className="font-medium text-orange-800">Incident Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="incidentData.severity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Severity</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select severity" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="minor">Minor</SelectItem>
                              <SelectItem value="moderate">Moderate</SelectItem>
                              <SelectItem value="major">Major</SelectItem>
                              <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="incidentData.followUpRequired"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Follow-up Required</FormLabel>
                          <Select onValueChange={(value) => field.onChange(value === "true")} 
                                  value={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select option" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="true">Yes</SelectItem>
                              <SelectItem value="false">No</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="incidentData.actionTaken"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Action Taken</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Describe actions taken..." {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Medication-specific fields */}
              {watchedType === "medication" && (
                <div className="space-y-4 p-4 border rounded-lg bg-blue-50">
                  <h3 className="font-medium text-blue-800">Medication Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="medicationData.medicationName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Medication Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Fluoxetine 20mg" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="medicationData.dosage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dosage</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 20mg" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="medicationData.timeAdministered"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time Administered</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="medicationData.reaction"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Patient Reaction</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., No adverse effects" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : caseNote ? "Update Note" : "Create Note"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <SpellCheckModal
        isOpen={isSpellCheckOpen}
        onClose={() => setIsSpellCheckOpen(false)}
        originalText={watchedContent || ""}
        onApplySuggestions={handleSpellCheckApply}
      />
    </>
  );
}