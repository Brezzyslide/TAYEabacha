// Client Schema and Types for Create Client Module
import { z } from "zod";

// Client data structure
export interface Client {
  id: number;
  clientId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  ndisNumber: string;
  dateOfBirth: Date;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  ndisGoals: string;
  likesPreferences: string;
  dislikesAversions: string;
  allergiesMedicalAlerts: string;
  primaryDiagnosis: string;
  careLevel: string;
  isActive: boolean;
  tenantId: number;
  companyId: string;
  createdBy: number;
  createdAt: Date;
}

// Client creation form schema
export const clientFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  ndisNumber: z.string().min(1, "NDIS number is required"),
  dateOfBirth: z.date(),
  address: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  primaryDiagnosis: z.string().optional(),
  careLevel: z.string().min(1, "Care level is required"),
  ndisGoals: z.string().optional(),
  likesPreferences: z.string().optional(),
  dislikesAversions: z.string().optional(),
  allergiesMedicalAlerts: z.string().optional(),
  isActive: z.boolean(),
});

// Insert schema for creating new clients
export const insertClientSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  ndisNumber: z.string().min(1, "NDIS number is required"),
  dateOfBirth: z.date(),
  address: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  ndisGoals: z.string().optional(),
  likesPreferences: z.string().optional(),
  dislikesAversions: z.string().optional(),
  allergiesMedicalAlerts: z.string().optional(),
  primaryDiagnosis: z.string().optional(),
  careLevel: z.string().optional(),
  isActive: z.boolean().default(true),
});

// Type inference
export type CreateClientFormData = z.infer<typeof clientFormSchema>;
export type InsertClient = z.infer<typeof insertClientSchema>;

// Care level options
export const CARE_LEVELS = [
  { value: "Low", label: "Low Support" },
  { value: "Medium", label: "Medium Support" },
  { value: "High", label: "High Support" },
  { value: "Complex", label: "Complex Support" },
] as const;

// API response type
export interface CreateClientResponse {
  id: number;
  clientId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  message?: string;
}