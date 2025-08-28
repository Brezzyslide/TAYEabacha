// Case Note Schema and Types
import { z } from "zod";

export interface CaseNote {
  id: number;
  clientId: number;
  userId: number;
  tenantId: number;
  title: string;
  content: string;
  category: string;
  priority: string;
  tags: string[];
  linkedShiftId?: number;
  attachments: any[];
  caseNoteTags: any;
  spellCheckCount: number;
  incidentData?: any;
  medicationData?: any;
  createdAt: Date;
  updatedAt: Date;
}

export const caseNoteSchema = z.object({
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
  
  // Progress note sections
  progressSections: z.array(z.object({
    id: z.string(),
    content: z.string()
  })).default([]),
  
  additionalNotes: z.string().optional(),
  
  attachments: z.array(z.object({
    name: z.string(),
    url: z.string(),
    type: z.string(),
    size: z.number()
  })).default([])
});

export type CreateCaseNoteData = z.infer<typeof caseNoteSchema>;

export const CASE_NOTE_CATEGORIES = [
  "Progress Note",
  "Incident Report", 
  "Medication Administration",
  "Observation",
  "Assessment",
  "Care Plan Update"
] as const;