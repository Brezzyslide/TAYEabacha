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
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import type { Client, Shift, CaseNote } from "@shared/schema";

const caseNoteSchema = z.object({
  clientId: z.number().min(1, "Client is required"),
  title: z.string().min(1, "Title is required"),
  content: z.string().min(130, "Case note must be at least 130 words"),
  category: z.string().default("Progress Note"),
  priority: z.enum(["normal", "high", "urgent"]).default("normal"),
  type: z.enum(["standard", "incident", "medication"]).default("standard"),
  linkedShiftId: z.number().optional(),
  tags: z.array(z.string()).default([])
});

type CaseNoteFormData = z.infer<typeof caseNoteSchema>;

interface CaseNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CaseNoteFormData) => Promise<void>;
  caseNote?: CaseNote;
  recentShifts?: Shift[];
  userRole: string;
}

export default function CaseNoteModal({
  isOpen,
  onClose,
  onSubmit,
  caseNote,
  recentShifts = [],
  userRole
}: CaseNoteModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
    select: (data: Client[]) => data.filter(client => client.tenantId === user?.tenantId)
  });

  const form = useForm<CaseNoteFormData>({
    resolver: zodResolver(caseNoteSchema),
    defaultValues: {
      clientId: caseNote?.clientId || 0,
      title: caseNote?.title || "",
      content: caseNote?.content || "",
      category: caseNote?.category || "Progress Note",
      priority: (caseNote?.priority as "normal" | "high" | "urgent") || "normal",
      type: (caseNote?.type as "standard" | "incident" | "medication") || "standard",
      linkedShiftId: caseNote?.linkedShiftId || undefined,
      tags: caseNote?.tags || []
    }
  });

  // Reset form when caseNote changes (ensure original content is loaded)
  useEffect(() => {
    if (caseNote) {
      form.reset({
        clientId: caseNote.clientId,
        title: caseNote.title,
        content: caseNote.content,
        category: caseNote.category,
        priority: (caseNote.priority as "normal" | "high" | "urgent"),
        type: (caseNote.type as "standard" | "incident" | "medication"),
        linkedShiftId: caseNote.linkedShiftId,
        tags: caseNote.tags || []
      });
    }
  }, [caseNote, form]);

  const watchedContent = form.watch("content");
  const wordCount = watchedContent?.split(/\s+/).filter(word => word.length > 0).length || 0;

  const handleSubmit = async (data: CaseNoteFormData) => {
    setIsSubmitting(true);
    try {
      // Auto-populate timestamp with current time for case note creation
      const submissionData = {
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await onSubmit(submissionData);
      form.reset();
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save case note",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {caseNote ? "Edit Case Note" : "Create Case Note"}
            {caseNote && (
              <div className="text-sm text-gray-500 font-normal mt-1">
                Created on {new Date(caseNote.createdAt).toLocaleDateString()} 
                {caseNote.createdAt !== caseNote.updatedAt && (
                  <span> • Last updated {new Date(caseNote.updatedAt).toLocaleDateString()}</span>
                )}
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Client Selection - Read-only when editing */}
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client *</FormLabel>
                  {caseNote ? (
                    // Show client name as read-only when editing
                    <div className="flex items-center p-2 border rounded-md bg-gray-50 dark:bg-gray-800">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {clients.find(c => c.id === field.value)?.fullName || 'Unknown Client'}
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
                            {client.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter case note title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Content */}
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center justify-between">
                    Case Note Content *
                    <Badge variant={wordCount >= 130 ? "default" : "destructive"}>
                      {wordCount} words
                    </Badge>
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

            {/* Category and Priority */}
            <div className="grid grid-cols-2 gap-4">
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
                        <SelectItem value="Behavioral Note">Behavioral Note</SelectItem>
                        <SelectItem value="Medical Note">Medical Note</SelectItem>
                        <SelectItem value="Incident Report">Incident Report</SelectItem>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
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

            {/* Type */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
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

            {/* Link to Shift */}
            {recentShifts.length > 0 && (
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
                        {recentShifts.map((shift) => (
                          <SelectItem key={shift.id} value={shift.id.toString()}>
                            {shift.title} - {new Date(shift.startTime).toLocaleDateString()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : caseNote ? "Update Case Note" : "Create Case Note"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}