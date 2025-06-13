import { 
  companies, users, clients, tenants, formTemplates, formSubmissions, shifts, staffAvailability, caseNotes, activityLogs, hourlyObservations,
  medicationPlans, medicationRecords,
  type Company, type InsertCompany, type User, type InsertUser, type Client, type InsertClient, type Tenant, type InsertTenant,
  type FormTemplate, type InsertFormTemplate, type FormSubmission, type InsertFormSubmission,
  type Shift, type InsertShift, type StaffAvailability, type InsertStaffAvailability,
  type CaseNote, type InsertCaseNote, type ActivityLog, type InsertActivityLog,
  type HourlyObservation, type InsertHourlyObservation,
  type MedicationPlan, type InsertMedicationPlan, type MedicationRecord, type InsertMedicationRecord
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // Companies
  getCompany(id: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  getCompanies(): Promise<Company[]>;

  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsersByTenant(tenantId: number): Promise<User[]>;

  // Tenants
  getTenant(id: number): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  getTenants(): Promise<Tenant[]>;

  // Clients
  getClients(tenantId: number): Promise<Client[]>;
  getClient(id: number, tenantId: number): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, client: Partial<InsertClient>, tenantId: number): Promise<Client | undefined>;
  deleteClient(id: number, tenantId: number): Promise<boolean>;

  // Form Templates
  getFormTemplates(tenantId: number): Promise<FormTemplate[]>;
  getFormTemplate(id: number, tenantId: number): Promise<FormTemplate | undefined>;
  createFormTemplate(template: InsertFormTemplate): Promise<FormTemplate>;
  updateFormTemplate(id: number, template: Partial<InsertFormTemplate>, tenantId: number): Promise<FormTemplate | undefined>;

  // Form Submissions
  getFormSubmissions(tenantId: number): Promise<FormSubmission[]>;
  createFormSubmission(submission: InsertFormSubmission): Promise<FormSubmission>;
  getFormSubmissionsByClient(clientId: number, tenantId: number): Promise<FormSubmission[]>;

  // Shifts
  getActiveShifts(tenantId: number): Promise<Shift[]>;
  getAllShifts(tenantId: number): Promise<Shift[]>;
  getShift(id: number, tenantId: number): Promise<Shift | undefined>;
  createShift(shift: InsertShift): Promise<Shift>;
  updateShift(id: number, shift: Partial<InsertShift>, tenantId: number): Promise<Shift | undefined>;
  deleteShift(id: number, tenantId: number): Promise<boolean>;
  endShift(id: number, endTime: Date, tenantId: number): Promise<Shift | undefined>;
  getShiftsByUser(userId: number, tenantId: number): Promise<Shift[]>;

  // Staff Availability
  getStaffAvailability(tenantId: number): Promise<StaffAvailability[]>;
  getUserAvailability(userId: number, tenantId: number): Promise<StaffAvailability | undefined>;
  createStaffAvailability(availability: InsertStaffAvailability): Promise<StaffAvailability>;
  updateStaffAvailability(id: number, availability: Partial<InsertStaffAvailability>, tenantId: number): Promise<StaffAvailability | undefined>;

  // Case Notes
  getCaseNotes(clientId: number, tenantId: number): Promise<CaseNote[]>;
  getCaseNote(id: number, tenantId: number): Promise<CaseNote | undefined>;
  createCaseNote(caseNote: InsertCaseNote): Promise<CaseNote>;
  updateCaseNote(id: number, caseNote: Partial<InsertCaseNote>, tenantId: number): Promise<CaseNote | undefined>;
  deleteCaseNote(id: number, tenantId: number): Promise<boolean>;
  getCaseNotesByType(clientId: number, type: string, tenantId: number): Promise<CaseNote[]>;
  searchCaseNotes(searchTerm: string, clientId: number, tenantId: number): Promise<CaseNote[]>;

  // Hourly Observations
  getObservations(tenantId: number): Promise<HourlyObservation[]>;
  getObservationsByClient(clientId: number, tenantId: number): Promise<HourlyObservation[]>;
  getObservation(id: number, tenantId: number): Promise<HourlyObservation | undefined>;
  createObservation(observation: InsertHourlyObservation): Promise<HourlyObservation>;
  updateObservation(id: number, observation: Partial<InsertHourlyObservation>, tenantId: number): Promise<HourlyObservation | undefined>;
  deleteObservation(id: number, tenantId: number): Promise<boolean>;

  // Activity Logs
  getActivityLogs(tenantId: number, limit?: number): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;

  // Medication Plans
  getMedicationPlans(clientId: number, tenantId: number): Promise<MedicationPlan[]>;
  getMedicationPlan(id: number, tenantId: number): Promise<MedicationPlan | undefined>;
  createMedicationPlan(plan: InsertMedicationPlan): Promise<MedicationPlan>;
  updateMedicationPlan(id: number, plan: Partial<InsertMedicationPlan>, tenantId: number): Promise<MedicationPlan | undefined>;
  deleteMedicationPlan(id: number, tenantId: number): Promise<boolean>;

  // Medication Records
  getMedicationRecords(clientId: number, tenantId: number): Promise<MedicationRecord[]>;
  getMedicationRecord(id: number, tenantId: number): Promise<MedicationRecord | undefined>;
  createMedicationRecord(record: InsertMedicationRecord): Promise<MedicationRecord>;
  updateMedicationRecord(id: number, record: Partial<InsertMedicationRecord>, tenantId: number): Promise<MedicationRecord | undefined>;
  deleteMedicationRecord(id: number, tenantId: number): Promise<boolean>;
  getMedicationRecordsByPlan(planId: number, tenantId: number): Promise<MedicationRecord[]>;

  // Session store
  sessionStore: any;
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  // Company methods
  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company || undefined;
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const [company] = await db
      .insert(companies)
      .values({
        ...insertCompany,
        id: crypto.randomUUID()
      })
      .returning();
    return company;
  }

  async getCompanies(): Promise<Company[]> {
    return await db.select().from(companies);
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getUsersByTenant(tenantId: number): Promise<User[]> {
    return await db.select().from(users).where(eq(users.tenantId, tenantId));
  }

  // Tenants
  async getTenant(id: number): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant || undefined;
  }

  async createTenant(insertTenant: InsertTenant): Promise<Tenant> {
    const [tenant] = await db
      .insert(tenants)
      .values(insertTenant)
      .returning();
    return tenant;
  }

  async getTenants(): Promise<Tenant[]> {
    return await db.select().from(tenants);
  }

  // Clients
  async getClients(tenantId: number): Promise<Client[]> {
    return await db.select().from(clients)
      .where(and(eq(clients.tenantId, tenantId), eq(clients.isActive, true)))
      .orderBy(desc(clients.createdAt));
  }

  async getClient(id: number, tenantId: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients)
      .where(and(eq(clients.id, id), eq(clients.tenantId, tenantId)));
    return client || undefined;
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const [client] = await db
      .insert(clients)
      .values({ ...insertClient, updatedAt: new Date() })
      .returning();
    return client;
  }

  async updateClient(id: number, updateClient: Partial<InsertClient>, tenantId: number): Promise<Client | undefined> {
    const [client] = await db
      .update(clients)
      .set({ ...updateClient, updatedAt: new Date() })
      .where(and(eq(clients.id, id), eq(clients.tenantId, tenantId)))
      .returning();
    return client || undefined;
  }

  async deleteClient(id: number, tenantId: number): Promise<boolean> {
    const result = await db
      .update(clients)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(clients.id, id), eq(clients.tenantId, tenantId)));
    return (result.rowCount || 0) > 0;
  }

  // Form Templates
  async getFormTemplates(tenantId: number): Promise<FormTemplate[]> {
    return await db.select().from(formTemplates)
      .where(and(eq(formTemplates.tenantId, tenantId), eq(formTemplates.isActive, true)))
      .orderBy(desc(formTemplates.createdAt));
  }

  async getFormTemplate(id: number, tenantId: number): Promise<FormTemplate | undefined> {
    const [template] = await db.select().from(formTemplates)
      .where(and(eq(formTemplates.id, id), eq(formTemplates.tenantId, tenantId)));
    return template || undefined;
  }

  async createFormTemplate(insertTemplate: InsertFormTemplate): Promise<FormTemplate> {
    const [template] = await db
      .insert(formTemplates)
      .values(insertTemplate)
      .returning();
    return template;
  }

  async updateFormTemplate(id: number, updateTemplate: Partial<InsertFormTemplate>, tenantId: number): Promise<FormTemplate | undefined> {
    const [template] = await db
      .update(formTemplates)
      .set(updateTemplate)
      .where(and(eq(formTemplates.id, id), eq(formTemplates.tenantId, tenantId)))
      .returning();
    return template || undefined;
  }

  // Form Submissions
  async getFormSubmissions(tenantId: number): Promise<FormSubmission[]> {
    return await db.select().from(formSubmissions)
      .where(eq(formSubmissions.tenantId, tenantId))
      .orderBy(desc(formSubmissions.createdAt));
  }

  async createFormSubmission(insertSubmission: InsertFormSubmission): Promise<FormSubmission> {
    const [submission] = await db
      .insert(formSubmissions)
      .values(insertSubmission)
      .returning();
    return submission;
  }

  async getFormSubmissionsByClient(clientId: number, tenantId: number): Promise<FormSubmission[]> {
    return await db.select().from(formSubmissions)
      .where(and(eq(formSubmissions.clientId, clientId), eq(formSubmissions.tenantId, tenantId)))
      .orderBy(desc(formSubmissions.createdAt));
  }

  // Shifts
  async getActiveShifts(tenantId: number): Promise<Shift[]> {
    return await db.select().from(shifts)
      .where(and(eq(shifts.tenantId, tenantId), eq(shifts.isActive, true)))
      .orderBy(desc(shifts.startTime));
  }

  async getAllShifts(tenantId: number): Promise<Shift[]> {
    return await db.select().from(shifts)
      .where(eq(shifts.tenantId, tenantId))
      .orderBy(desc(shifts.startTime));
  }

  async createShift(insertShift: InsertShift): Promise<Shift> {
    const [shift] = await db
      .insert(shifts)
      .values(insertShift)
      .returning();
    return shift;
  }

  async getShift(id: number, tenantId: number): Promise<Shift | undefined> {
    const [shift] = await db
      .select()
      .from(shifts)
      .where(and(eq(shifts.id, id), eq(shifts.tenantId, tenantId)));
    return shift || undefined;
  }

  async updateShift(id: number, updateShift: Partial<InsertShift>, tenantId: number): Promise<Shift | undefined> {
    const [shift] = await db
      .update(shifts)
      .set(updateShift)
      .where(and(eq(shifts.id, id), eq(shifts.tenantId, tenantId)))
      .returning();
    return shift || undefined;
  }

  async deleteShift(id: number, tenantId: number): Promise<boolean> {
    const result = await db
      .delete(shifts)
      .where(and(eq(shifts.id, id), eq(shifts.tenantId, tenantId)));
    return (result.rowCount || 0) > 0;
  }

  async endShift(id: number, endTime: Date, tenantId: number): Promise<Shift | undefined> {
    const [shift] = await db
      .update(shifts)
      .set({ endTime, isActive: false })
      .where(and(eq(shifts.id, id), eq(shifts.tenantId, tenantId)))
      .returning();
    return shift || undefined;
  }

  async getShiftsByUser(userId: number, tenantId: number): Promise<Shift[]> {
    return await db.select().from(shifts)
      .where(and(eq(shifts.userId, userId), eq(shifts.tenantId, tenantId)))
      .orderBy(desc(shifts.startTime));
  }

  // Staff Availability
  async getStaffAvailability(tenantId: number): Promise<StaffAvailability[]> {
    return await db.select().from(staffAvailability)
      .where(and(eq(staffAvailability.companyId, tenantId), eq(staffAvailability.isActive, true)))
      .orderBy(desc(staffAvailability.createdAt));
  }

  async getUserAvailability(userId: number, tenantId: number): Promise<StaffAvailability | undefined> {
    const [availability] = await db.select().from(staffAvailability)
      .where(and(
        eq(staffAvailability.userId, userId), 
        eq(staffAvailability.companyId, tenantId),
        eq(staffAvailability.isActive, true)
      ));
    return availability || undefined;
  }

  async createStaffAvailability(insertAvailability: InsertStaffAvailability): Promise<StaffAvailability> {
    const [availability] = await db
      .insert(staffAvailability)
      .values(insertAvailability)
      .returning();
    return availability;
  }

  async updateStaffAvailability(id: number, updateAvailability: Partial<InsertStaffAvailability>, tenantId: number): Promise<StaffAvailability | undefined> {
    const [availability] = await db
      .update(staffAvailability)
      .set(updateAvailability)
      .where(and(eq(staffAvailability.id, id), eq(staffAvailability.companyId, tenantId)))
      .returning();
    return availability || undefined;
  }

  // Activity Logs
  async getActivityLogs(tenantId: number, limit: number = 50): Promise<ActivityLog[]> {
    return await db.select().from(activityLogs)
      .where(eq(activityLogs.tenantId, tenantId))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
  }

  async createActivityLog(insertLog: InsertActivityLog): Promise<ActivityLog> {
    const [log] = await db
      .insert(activityLogs)
      .values(insertLog)
      .returning();
    return log;
  }

  async getCaseNotes(clientId: number, tenantId: number): Promise<CaseNote[]> {
    return await db.select().from(caseNotes)
      .where(and(eq(caseNotes.clientId, clientId), eq(caseNotes.tenantId, tenantId)))
      .orderBy(desc(caseNotes.createdAt));
  }

  async getCaseNote(id: number, tenantId: number): Promise<CaseNote | undefined> {
    const [caseNote] = await db.select().from(caseNotes)
      .where(and(eq(caseNotes.id, id), eq(caseNotes.tenantId, tenantId)));
    return caseNote;
  }

  async createCaseNote(insertCaseNote: InsertCaseNote): Promise<CaseNote> {
    const [caseNote] = await db.insert(caseNotes).values(insertCaseNote).returning();
    return caseNote;
  }

  async updateCaseNote(id: number, updateCaseNote: Partial<InsertCaseNote>, tenantId: number): Promise<CaseNote | undefined> {
    const [caseNote] = await db.update(caseNotes)
      .set({ ...updateCaseNote, updatedAt: new Date() })
      .where(and(eq(caseNotes.id, id), eq(caseNotes.tenantId, tenantId)))
      .returning();
    return caseNote;
  }

  async deleteCaseNote(id: number, tenantId: number): Promise<boolean> {
    const result = await db.delete(caseNotes)
      .where(and(eq(caseNotes.id, id), eq(caseNotes.tenantId, tenantId)));
    return (result.rowCount || 0) > 0;
  }

  async getCaseNotesByType(clientId: number, type: string, tenantId: number): Promise<CaseNote[]> {
    return await db.select().from(caseNotes)
      .where(and(
        eq(caseNotes.clientId, clientId),
        eq(caseNotes.type, type),
        eq(caseNotes.tenantId, tenantId)
      ))
      .orderBy(desc(caseNotes.createdAt));
  }

  async searchCaseNotes(searchTerm: string, clientId: number, tenantId: number): Promise<CaseNote[]> {
    return await db.select().from(caseNotes)
      .where(and(
        eq(caseNotes.clientId, clientId),
        eq(caseNotes.tenantId, tenantId)
      ))
      .orderBy(desc(caseNotes.createdAt));
  }

  // Hourly Observations methods
  async getObservations(tenantId: number): Promise<HourlyObservation[]> {
    return await db.select().from(hourlyObservations)
      .where(eq(hourlyObservations.tenantId, tenantId))
      .orderBy(desc(hourlyObservations.timestamp));
  }

  async getObservationsByClient(clientId: number, tenantId: number): Promise<HourlyObservation[]> {
    return await db.select().from(hourlyObservations)
      .where(and(
        eq(hourlyObservations.clientId, clientId),
        eq(hourlyObservations.tenantId, tenantId)
      ))
      .orderBy(desc(hourlyObservations.timestamp));
  }

  async getObservation(id: number, tenantId: number): Promise<HourlyObservation | undefined> {
    const [observation] = await db.select().from(hourlyObservations)
      .where(and(
        eq(hourlyObservations.id, id),
        eq(hourlyObservations.tenantId, tenantId)
      ));
    return observation || undefined;
  }

  async createObservation(insertObservation: InsertHourlyObservation): Promise<HourlyObservation> {
    const [observation] = await db
      .insert(hourlyObservations)
      .values(insertObservation)
      .returning();
    return observation;
  }

  async updateObservation(id: number, updateObservation: Partial<InsertHourlyObservation>, tenantId: number): Promise<HourlyObservation | undefined> {
    const [observation] = await db
      .update(hourlyObservations)
      .set({ ...updateObservation, updatedAt: new Date() })
      .where(and(
        eq(hourlyObservations.id, id),
        eq(hourlyObservations.tenantId, tenantId)
      ))
      .returning();
    return observation || undefined;
  }

  async deleteObservation(id: number, tenantId: number): Promise<boolean> {
    const result = await db
      .delete(hourlyObservations)
      .where(and(
        eq(hourlyObservations.id, id),
        eq(hourlyObservations.tenantId, tenantId)
      ));
    return (result.rowCount || 0) > 0;
  }

  // Medication Plans methods
  async getMedicationPlans(clientId: number, tenantId: number): Promise<MedicationPlan[]> {
    return await db.select().from(medicationPlans)
      .where(and(
        eq(medicationPlans.clientId, clientId),
        eq(medicationPlans.tenantId, tenantId)
      ))
      .orderBy(desc(medicationPlans.createdAt));
  }

  async getMedicationPlan(id: number, tenantId: number): Promise<MedicationPlan | undefined> {
    const [plan] = await db.select().from(medicationPlans)
      .where(and(
        eq(medicationPlans.id, id),
        eq(medicationPlans.tenantId, tenantId)
      ));
    return plan;
  }

  async createMedicationPlan(insertPlan: InsertMedicationPlan): Promise<MedicationPlan> {
    const [plan] = await db.insert(medicationPlans).values(insertPlan).returning();
    return plan;
  }

  async updateMedicationPlan(id: number, updatePlan: Partial<InsertMedicationPlan>, tenantId: number): Promise<MedicationPlan | undefined> {
    const [plan] = await db.update(medicationPlans)
      .set({ ...updatePlan, updatedAt: new Date() })
      .where(and(
        eq(medicationPlans.id, id),
        eq(medicationPlans.tenantId, tenantId)
      ))
      .returning();
    return plan;
  }

  async deleteMedicationPlan(id: number, tenantId: number): Promise<boolean> {
    const result = await db.delete(medicationPlans)
      .where(and(
        eq(medicationPlans.id, id),
        eq(medicationPlans.tenantId, tenantId)
      ));
    return (result.rowCount || 0) > 0;
  }

  // Medication Records methods
  async getMedicationRecords(clientId: number, tenantId: number): Promise<MedicationRecord[]> {
    return await db.select().from(medicationRecords)
      .where(and(
        eq(medicationRecords.clientId, clientId),
        eq(medicationRecords.tenantId, tenantId)
      ))
      .orderBy(desc(medicationRecords.createdAt));
  }

  async getMedicationRecord(id: number, tenantId: number): Promise<MedicationRecord | undefined> {
    const [record] = await db.select().from(medicationRecords)
      .where(and(
        eq(medicationRecords.id, id),
        eq(medicationRecords.tenantId, tenantId)
      ));
    return record;
  }

  async createMedicationRecord(insertRecord: InsertMedicationRecord): Promise<MedicationRecord> {
    const [record] = await db.insert(medicationRecords).values(insertRecord).returning();
    return record;
  }

  async updateMedicationRecord(id: number, updateRecord: Partial<InsertMedicationRecord>, tenantId: number): Promise<MedicationRecord | undefined> {
    const [record] = await db.update(medicationRecords)
      .set(updateRecord)
      .where(and(
        eq(medicationRecords.id, id),
        eq(medicationRecords.tenantId, tenantId)
      ))
      .returning();
    return record;
  }

  async deleteMedicationRecord(id: number, tenantId: number): Promise<boolean> {
    const result = await db.delete(medicationRecords)
      .where(and(
        eq(medicationRecords.id, id),
        eq(medicationRecords.tenantId, tenantId)
      ));
    return (result.rowCount || 0) > 0;
  }

  async getMedicationRecordsByPlan(planId: number, tenantId: number): Promise<MedicationRecord[]> {
    return await db.select().from(medicationRecords)
      .where(and(
        eq(medicationRecords.medicationPlanId, planId),
        eq(medicationRecords.tenantId, tenantId)
      ))
      .orderBy(desc(medicationRecords.createdAt));
  }
}

export const storage = new DatabaseStorage();
