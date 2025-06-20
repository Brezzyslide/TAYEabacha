import { 
  companies, users, clients, tenants, formTemplates, formSubmissions, shifts, staffAvailability, caseNotes, activityLogs, hourlyObservations,
  medicationPlans, medicationRecords, incidentReports, incidentClosures, staffMessages, hourAllocations,
  customRoles, customPermissions, userRoleAssignments, taskBoardTasks, ndisPricing, ndisBudgets, budgetTransactions, careSupportPlans,
  shiftCancellations, cancellationRequests, payScales,
  type Company, type InsertCompany, type User, type InsertUser, type Client, type InsertClient, type Tenant, type InsertTenant,
  type FormTemplate, type InsertFormTemplate, type FormSubmission, type InsertFormSubmission,
  type Shift, type InsertShift, type StaffAvailability, type InsertStaffAvailability,
  type CaseNote, type InsertCaseNote, type ActivityLog, type InsertActivityLog,
  type HourlyObservation, type InsertHourlyObservation,
  type MedicationPlan, type InsertMedicationPlan, type MedicationRecord, type InsertMedicationRecord,
  type IncidentReport, type InsertIncidentReport, type IncidentClosure, type InsertIncidentClosure,
  type StaffMessage, type InsertStaffMessage, type HourAllocation, type InsertHourAllocation,
  type CustomRole, type InsertCustomRole, type CustomPermission, type InsertCustomPermission,
  type UserRoleAssignment, type InsertUserRoleAssignment, type TaskBoardTask, type InsertTaskBoardTask,
  type NdisPricing, type InsertNdisPricing, type NdisBudget, type InsertNdisBudget,
  type BudgetTransaction, type InsertBudgetTransaction, type CareSupportPlan, type InsertCareSupportPlan,
  type ShiftCancellation, type InsertShiftCancellation, type CancellationRequest, type InsertCancellationRequest,
  type PayScale
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // Companies
  getCompany(id: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  getCompanies(): Promise<Company[]>;
  getCompanyByTenantId(tenantId: number): Promise<Company | undefined>;

  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>, tenantId: number): Promise<User | undefined>;
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
  getQuickPatterns(userId: number, tenantId: number): Promise<StaffAvailability[]>;
  getAllStaffAvailability(tenantId: number, showArchived: boolean): Promise<any[]>;
  getAllStaffAvailabilities(tenantId: number): Promise<any[]>;
  updateStaffAvailabilityApproval(id: number, isApproved: boolean, tenantId: number): Promise<StaffAvailability | undefined>;
  archiveStaffAvailability(id: number, tenantId: number): Promise<StaffAvailability | undefined>;
  getAvailabilityConflicts(tenantId: number): Promise<any[]>;

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
  getAllObservations(tenantId: number): Promise<HourlyObservation[]>;
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

  // Staff Messages
  getStaffMessages(tenantId: number): Promise<StaffMessage[]>;
  getStaffMessage(id: number, tenantId: number): Promise<StaffMessage | undefined>;
  createStaffMessage(message: InsertStaffMessage): Promise<StaffMessage>;
  updateStaffMessage(id: number, message: Partial<InsertStaffMessage>, tenantId: number): Promise<StaffMessage | undefined>;
  deleteStaffMessage(id: number, tenantId: number): Promise<boolean>;
  getStaffMessagesByRecipient(userId: number, tenantId: number): Promise<StaffMessage[]>;
  getStaffMessagesBySender(userId: number, tenantId: number): Promise<StaffMessage[]>;
  markMessageAsRead(messageId: number, userId: number, tenantId: number): Promise<boolean>;

  // Hour Allocations
  getHourAllocations(tenantId: number): Promise<HourAllocation[]>;
  getAllHourAllocations(): Promise<HourAllocation[]>;
  getHourAllocation(id: number, tenantId: number): Promise<HourAllocation | undefined>;
  createHourAllocation(allocation: InsertHourAllocation): Promise<HourAllocation>;
  updateHourAllocation(id: number, allocation: Partial<InsertHourAllocation>, tenantId: number): Promise<HourAllocation | undefined>;
  deleteHourAllocation(id: number, tenantId: number): Promise<boolean>;
  getHourAllocationStats(tenantId: number): Promise<any>;

  // Custom Roles
  getCustomRoles(tenantId: number): Promise<CustomRole[]>;
  getCustomRole(id: number, tenantId: number): Promise<CustomRole | undefined>;
  createCustomRole(role: InsertCustomRole): Promise<CustomRole>;
  updateCustomRole(id: number, role: Partial<InsertCustomRole>, tenantId: number): Promise<CustomRole | undefined>;
  deleteCustomRole(id: number, tenantId: number): Promise<boolean>;

  // Custom Permissions
  getCustomPermissions(tenantId: number): Promise<CustomPermission[]>;
  getCustomPermissionsByRole(roleId: number, tenantId: number): Promise<CustomPermission[]>;
  createCustomPermission(permission: InsertCustomPermission): Promise<CustomPermission>;
  updateCustomPermission(id: number, permission: Partial<InsertCustomPermission>, tenantId: number): Promise<CustomPermission | undefined>;
  deleteCustomPermission(id: number, tenantId: number): Promise<boolean>;

  // User Role Assignments
  getUserRoleAssignments(tenantId: number): Promise<UserRoleAssignment[]>;
  getUserRoleAssignment(userId: number, tenantId: number): Promise<UserRoleAssignment | undefined>;
  createUserRoleAssignment(assignment: InsertUserRoleAssignment): Promise<UserRoleAssignment>;
  updateUserRoleAssignment(id: number, assignment: Partial<InsertUserRoleAssignment>, tenantId: number): Promise<UserRoleAssignment | undefined>;
  deleteUserRoleAssignment(id: number, tenantId: number): Promise<boolean>;

  // Care Support Plans
  getCareSupportPlans(tenantId: number): Promise<CareSupportPlan[]>;
  getCareSupportPlan(id: number, tenantId: number): Promise<CareSupportPlan | undefined>;
  getCareSupportPlansByClient(clientId: number, tenantId: number): Promise<CareSupportPlan[]>;
  createCareSupportPlan(plan: InsertCareSupportPlan): Promise<CareSupportPlan>;
  updateCareSupportPlan(id: number, plan: Partial<InsertCareSupportPlan>, tenantId: number): Promise<CareSupportPlan | undefined>;
  deleteCareSupportPlan(id: number, tenantId: number): Promise<boolean>;

  // Shift Cancellations
  getShiftCancellations(tenantId: number): Promise<ShiftCancellation[]>;
  getShiftCancellation(id: number, tenantId: number): Promise<ShiftCancellation | undefined>;
  createShiftCancellation(cancellation: InsertShiftCancellation): Promise<ShiftCancellation>;
  getShiftCancellationsForExport(tenantId: number, filters: {
    staffId?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<ShiftCancellation[]>;

  // Cancellation Requests
  getCancellationRequests(tenantId: number): Promise<CancellationRequest[]>;
  getCancellationRequest(id: number, tenantId: number): Promise<CancellationRequest | undefined>;
  createCancellationRequest(request: InsertCancellationRequest): Promise<CancellationRequest>;
  updateCancellationRequest(id: number, request: Partial<InsertCancellationRequest>, tenantId: number): Promise<CancellationRequest | undefined>;

  // Pay Scale Management
  getPayScales(tenantId: number): Promise<PayScale[]>;
  updatePayScale(tenantId: number, level: number, payPoint: number, hourlyRate: number): Promise<PayScale>;
  resetPayScalesToDefault(tenantId: number): Promise<void>;

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

  async getCompanyByTenantId(tenantId: number): Promise<Company | undefined> {
    const [result] = await db
      .select({
        id: companies.id,
        name: companies.name,
        businessAddress: companies.businessAddress,
        registrationNumber: companies.registrationNumber,
        primaryContactName: companies.primaryContactName,
        primaryContactEmail: companies.primaryContactEmail,
        primaryContactPhone: companies.primaryContactPhone,
        customLogo: companies.customLogo,
        logoUploadedAt: companies.logoUploadedAt,
        createdAt: companies.createdAt
      })
      .from(companies)
      .innerJoin(tenants, eq(tenants.companyId, companies.id))
      .where(eq(tenants.id, tenantId));
    return result || undefined;
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

  async updateUser(id: number, updateUser: Partial<InsertUser>, tenantId: number): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updateUser)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
      .returning();
    return user || undefined;
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

  // Companies
  async getCompanyByTenantId(tenantId: number): Promise<Company | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant || !tenant.companyId) return undefined;
    
    const [company] = await db.select().from(companies).where(eq(companies.id, tenant.companyId));
    return company || undefined;
  }

  async updateCompanyLogo(tenantId: number, logoUrl: string): Promise<Company | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant || !tenant.companyId) return undefined;
    
    const [company] = await db
      .update(companies)
      .set({ 
        customLogo: logoUrl,
        logoUploadedAt: new Date()
      })
      .where(eq(companies.id, tenant.companyId))
      .returning();
    return company || undefined;
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
    // Generate unique client ID
    const clientId = `CLT${Date.now().toString().slice(-6)}`;
    const fullName = `${insertClient.firstName} ${insertClient.lastName}`;
    
    const clientData = {
      ...insertClient,
      clientId,
      fullName,
      companyId: insertClient.companyId || 'COMP001'
    };
    
    const [client] = await db
      .insert(clients)
      .values(clientData)
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

  // Staff Availability (updated implementation)
  async getStaffAvailability(tenantId: number): Promise<StaffAvailability[]> {
    return await db.select().from(staffAvailability)
      .where(and(eq(staffAvailability.tenantId, tenantId), eq(staffAvailability.isActive, true)))
      .orderBy(desc(staffAvailability.createdAt));
  }

  async getUserAvailability(userId: number, tenantId: number): Promise<StaffAvailability | undefined> {
    const [availability] = await db.select().from(staffAvailability)
      .where(and(
        eq(staffAvailability.userId, userId),
        eq(staffAvailability.tenantId, tenantId),
        eq(staffAvailability.isActive, true)
      ))
      .orderBy(desc(staffAvailability.createdAt))
      .limit(1);
    return availability;
  }

  async createStaffAvailability(insertAvailability: InsertStaffAvailability): Promise<StaffAvailability> {
    try {
      // Generate unique availability ID
      const availabilityId = `AV${Date.now()}${Math.random().toString(36).substr(2, 4)}`;
      
      const availabilityData = {
        ...insertAvailability,
        availabilityId,
        // Both companyId and tenantId should have the same value for consistency
        tenantId: insertAvailability.companyId || insertAvailability.tenantId,
      };

      const [availability] = await db.insert(staffAvailability).values(availabilityData).returning();
      return availability;
    } catch (error) {
      console.error("Error creating staff availability:", error);
      throw error;
    }
  }

  async updateStaffAvailability(id: number, updateAvailability: Partial<InsertStaffAvailability>, tenantId: number): Promise<StaffAvailability | undefined> {
    const [availability] = await db.update(staffAvailability)
      .set({ ...updateAvailability, updatedAt: new Date() })
      .where(and(
        eq(staffAvailability.id, id),
        eq(staffAvailability.tenantId, tenantId)
      ))
      .returning();
    return availability;
  }

  async getQuickPatterns(userId: number, tenantId: number): Promise<StaffAvailability[]> {
    return await db.select().from(staffAvailability)
      .where(and(
        eq(staffAvailability.userId, userId),
        eq(staffAvailability.tenantId, tenantId),
        eq(staffAvailability.isQuickPattern, true),
        eq(staffAvailability.isActive, true)
      ))
      .orderBy(desc(staffAvailability.createdAt));
  }

  async getAllStaffAvailability(tenantId: number, showArchived: boolean): Promise<any[]> {
    const query = db.select({
      id: staffAvailability.id,
      userId: staffAvailability.userId,
      userName: users.username,
      userRole: users.role,
      availability: staffAvailability.availability,
      patternName: staffAvailability.patternName,
      isActive: staffAvailability.isActive,
      overrideByManager: staffAvailability.overrideByManager,
      createdAt: staffAvailability.createdAt,
      updatedAt: staffAvailability.updatedAt,
    })
    .from(staffAvailability)
    .leftJoin(users, eq(staffAvailability.userId, users.id))
    .where(and(
      eq(staffAvailability.tenantId, tenantId),
      showArchived ? undefined : eq(staffAvailability.isActive, true)
    ))
    .orderBy(desc(staffAvailability.createdAt));

    return await query;
  }

  async getAllStaffAvailabilities(tenantId: number): Promise<any[]> {
    const query = db.select({
      id: staffAvailability.id,
      availabilityId: staffAvailability.availabilityId,
      userId: staffAvailability.userId,
      username: users.username,
      userFullName: users.fullName,
      availability: staffAvailability.availability,
      patternName: staffAvailability.patternName,
      isQuickPattern: staffAvailability.isQuickPattern,
      overrideByManager: staffAvailability.overrideByManager,
      isActive: staffAvailability.isActive,
      createdAt: staffAvailability.createdAt,
      updatedAt: staffAvailability.updatedAt,
    })
    .from(staffAvailability)
    .leftJoin(users, eq(staffAvailability.userId, users.id))
    .where(and(
      eq(staffAvailability.tenantId, tenantId),
      eq(staffAvailability.isActive, true)
    ))
    .orderBy(desc(staffAvailability.createdAt));

    return await query;
  }

  async updateStaffAvailabilityApproval(id: number, isApproved: boolean, tenantId: number): Promise<StaffAvailability | undefined> {
    const [availability] = await db.update(staffAvailability)
      .set({ 
        overrideByManager: isApproved,
        updatedAt: new Date() 
      })
      .where(and(
        eq(staffAvailability.id, id),
        eq(staffAvailability.tenantId, tenantId)
      ))
      .returning();
    return availability;
  }

  async archiveStaffAvailability(id: number, tenantId: number): Promise<StaffAvailability | undefined> {
    const [availability] = await db.update(staffAvailability)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(staffAvailability.id, id),
        eq(staffAvailability.tenantId, tenantId)
      ))
      .returning();
    return availability;
  }

  async getAvailabilityConflicts(tenantId: number): Promise<any[]> {
    // Mock conflict analysis - in production this would analyze actual staffing requirements
    const conflicts = [
      {
        day: "Monday",
        shiftType: "AM",
        staffCount: 2,
        minRequired: 4,
        isUnderStaffed: true
      },
      {
        day: "Friday",
        shiftType: "Active Night",
        staffCount: 1,
        minRequired: 3,
        isUnderStaffed: true
      }
    ];
    return conflicts;
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

  async getAllObservations(tenantId: number): Promise<HourlyObservation[]> {
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

  // Incident Reports methods
  async getIncidentReports(tenantId: number): Promise<IncidentReport[]> {
    return await db.select().from(incidentReports)
      .where(eq(incidentReports.tenantId, tenantId))
      .orderBy(desc(incidentReports.createdAt));
  }

  async getIncidentReport(incidentId: string, tenantId: number): Promise<IncidentReport | undefined> {
    const [report] = await db.select().from(incidentReports)
      .where(and(
        eq(incidentReports.incidentId, incidentId),
        eq(incidentReports.tenantId, tenantId)
      ));
    return report;
  }

  async createIncidentReport(insertReport: InsertIncidentReport): Promise<IncidentReport> {
    const [report] = await db.insert(incidentReports).values(insertReport).returning();
    return report;
  }

  async updateIncidentReport(incidentId: string, updateReport: Partial<InsertIncidentReport>, tenantId: number): Promise<IncidentReport | undefined> {
    const [report] = await db.update(incidentReports)
      .set({ ...updateReport, updatedAt: new Date() })
      .where(and(
        eq(incidentReports.incidentId, incidentId),
        eq(incidentReports.tenantId, tenantId)
      ))
      .returning();
    return report;
  }

  async deleteIncidentReport(incidentId: string, tenantId: number): Promise<boolean> {
    const result = await db.delete(incidentReports)
      .where(and(
        eq(incidentReports.incidentId, incidentId),
        eq(incidentReports.tenantId, tenantId)
      ));
    return (result.rowCount || 0) > 0;
  }

  // Incident Closures methods
  async getIncidentClosure(incidentId: string, tenantId: number): Promise<IncidentClosure | undefined> {
    const [closure] = await db.select().from(incidentClosures)
      .where(and(
        eq(incidentClosures.incidentId, incidentId),
        eq(incidentClosures.tenantId, tenantId)
      ));
    return closure;
  }

  async createIncidentClosure(insertClosure: InsertIncidentClosure): Promise<IncidentClosure> {
    const [closure] = await db.insert(incidentClosures).values(insertClosure).returning();
    return closure;
  }

  async updateIncidentClosure(incidentId: string, updateClosure: Partial<InsertIncidentClosure>, tenantId: number): Promise<IncidentClosure | undefined> {
    const [closure] = await db.update(incidentClosures)
      .set(updateClosure)
      .where(and(
        eq(incidentClosures.incidentId, incidentId),
        eq(incidentClosures.tenantId, tenantId)
      ))
      .returning();
    return closure;
  }



  async getIncidentReportsWithClosures(tenantId: number): Promise<any[]> {
    return await db.select({
      report: incidentReports,
      closure: incidentClosures,
      client: {
        id: clients.id,
        firstName: clients.firstName,
        lastName: clients.lastName,
        clientId: clients.clientId
      },
      staff: {
        id: users.id,
        username: users.username
      }
    })
    .from(incidentReports)
    .leftJoin(incidentClosures, eq(incidentReports.incidentId, incidentClosures.incidentId))
    .leftJoin(clients, eq(incidentReports.clientId, clients.id))
    .leftJoin(users, eq(incidentReports.staffId, users.id))
    .where(eq(incidentReports.tenantId, tenantId))
    .orderBy(desc(incidentReports.createdAt));
  }

  // Staff Messages methods
  async getStaffMessages(tenantId: number): Promise<StaffMessage[]> {
    return await db.select().from(staffMessages)
      .where(eq(staffMessages.tenantId, tenantId))
      .orderBy(desc(staffMessages.createdAt));
  }

  async getStaffMessage(id: number, tenantId: number): Promise<StaffMessage | undefined> {
    const [message] = await db.select().from(staffMessages)
      .where(and(
        eq(staffMessages.id, id),
        eq(staffMessages.tenantId, tenantId)
      ));
    return message;
  }

  async createStaffMessage(insertMessage: InsertStaffMessage): Promise<StaffMessage> {
    const [message] = await db.insert(staffMessages).values(insertMessage).returning();
    return message;
  }

  async updateStaffMessage(id: number, updateMessage: Partial<InsertStaffMessage>, tenantId: number): Promise<StaffMessage | undefined> {
    const [message] = await db.update(staffMessages)
      .set({ ...updateMessage, updatedAt: new Date() })
      .where(and(
        eq(staffMessages.id, id),
        eq(staffMessages.tenantId, tenantId)
      ))
      .returning();
    return message;
  }

  async deleteStaffMessage(id: number, tenantId: number): Promise<boolean> {
    const result = await db.delete(staffMessages)
      .where(and(
        eq(staffMessages.id, id),
        eq(staffMessages.tenantId, tenantId)
      ));
    return (result.rowCount || 0) > 0;
  }

  async getStaffMessagesByRecipient(userId: number, tenantId: number): Promise<StaffMessage[]> {
    return await db.select().from(staffMessages)
      .where(and(
        sql`${userId} = ANY(${staffMessages.recipientIds})`,
        eq(staffMessages.tenantId, tenantId)
      ))
      .orderBy(desc(staffMessages.createdAt));
  }

  async getStaffMessagesBySender(userId: number, tenantId: number): Promise<StaffMessage[]> {
    return await db.select().from(staffMessages)
      .where(and(
        eq(staffMessages.senderId, userId),
        eq(staffMessages.tenantId, tenantId)
      ))
      .orderBy(desc(staffMessages.createdAt));
  }

  async markMessageAsRead(messageId: number, userId: number, tenantId: number): Promise<boolean> {
    const message = await this.getStaffMessage(messageId, tenantId);
    if (!message) return false;

    const currentReadStatus = message.isRead as Record<string, boolean> || {};
    currentReadStatus[userId.toString()] = true;

    const result = await db.update(staffMessages)
      .set({ 
        isRead: currentReadStatus,
        updatedAt: new Date()
      })
      .where(and(
        eq(staffMessages.id, messageId),
        eq(staffMessages.tenantId, tenantId)
      ));
    
    return (result.rowCount || 0) > 0;
  }

  // Hour Allocations methods
  async getHourAllocations(tenantId: number): Promise<HourAllocation[]> {
    return await db.select().from(hourAllocations)
      .where(and(
        eq(hourAllocations.tenantId, tenantId),
        eq(hourAllocations.isActive, true)
      ))
      .orderBy(desc(hourAllocations.createdAt));
  }

  async getAllHourAllocations(): Promise<HourAllocation[]> {
    return await db.select().from(hourAllocations)
      .where(eq(hourAllocations.isActive, true))
      .orderBy(desc(hourAllocations.createdAt));
  }

  async getHourAllocation(id: number, tenantId: number): Promise<HourAllocation | undefined> {
    const [allocation] = await db.select().from(hourAllocations)
      .where(and(
        eq(hourAllocations.id, id),
        eq(hourAllocations.tenantId, tenantId)
      ));
    return allocation;
  }

  async createHourAllocation(insertAllocation: InsertHourAllocation): Promise<HourAllocation> {
    // Convert number fields to strings for decimal columns
    const processedData = {
      ...insertAllocation,
      maxHours: insertAllocation.maxHours.toString(),
      hoursUsed: "0",
      remainingHours: insertAllocation.maxHours.toString(),
    };
    const [allocation] = await db.insert(hourAllocations).values(processedData).returning();
    return allocation;
  }

  async updateHourAllocation(id: number, updateAllocation: Partial<InsertHourAllocation>, tenantId: number): Promise<HourAllocation | undefined> {
    // Convert number fields to strings for decimal columns
    const processedData: any = { ...updateAllocation, updatedAt: new Date() };
    if (updateAllocation.maxHours !== undefined) {
      processedData.maxHours = updateAllocation.maxHours.toString();
      // Recalculate remaining hours
      const currentAllocation = await this.getHourAllocation(id, tenantId);
      if (currentAllocation) {
        const currentUsed = parseFloat(currentAllocation.hoursUsed);
        processedData.remainingHours = (updateAllocation.maxHours - currentUsed).toString();
      }
    }
    
    const [allocation] = await db.update(hourAllocations)
      .set(processedData)
      .where(and(
        eq(hourAllocations.id, id),
        eq(hourAllocations.tenantId, tenantId)
      ))
      .returning();
    return allocation;
  }

  async deleteHourAllocation(id: number, tenantId: number): Promise<boolean> {
    const result = await db.update(hourAllocations)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(hourAllocations.id, id),
        eq(hourAllocations.tenantId, tenantId)
      ));
    return (result.rowCount || 0) > 0;
  }

  async getHourAllocationStats(tenantId: number): Promise<any> {
    const allocations = await this.getHourAllocations(tenantId);
    const totalAllocations = allocations.length;
    const weeklyAllocations = allocations.filter(a => a.allocationPeriod === 'weekly').length;
    const fortnightlyAllocations = allocations.filter(a => a.allocationPeriod === 'fortnightly').length;
    
    const totalMaxHours = allocations.reduce((sum, a) => sum + parseFloat(a.maxHours), 0);
    const totalUsedHours = allocations.reduce((sum, a) => sum + parseFloat(a.hoursUsed), 0);
    const totalRemainingHours = allocations.reduce((sum, a) => sum + parseFloat(a.remainingHours), 0);
    
    const allocationRate = totalMaxHours > 0 ? Math.round((totalUsedHours / totalMaxHours) * 100) : 0;

    // Get shift stats for this week
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const shiftsThisWeek = await db.select().from(shifts)
      .where(and(
        eq(shifts.tenantId, tenantId),
        sql`${shifts.startTime} >= ${oneWeekAgo}`
      ));

    const totalShifts = shiftsThisWeek.length;
    const totalShiftHours = shiftsThisWeek.reduce((sum, shift) => {
      if (shift.startTime && shift.endTime) {
        const duration = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60);
        return sum + duration;
      }
      return sum;
    }, 0);

    return {
      totalAllocations,
      weeklyAllocations,
      fortnightlyAllocations,
      totalShifts,
      totalShiftHours: Math.round(totalShiftHours * 10) / 10,
      allocatedHours: Math.round(totalUsedHours * 10) / 10,
      unallocatedHours: Math.round(totalRemainingHours * 10) / 10,
      allocationRate,
    };
  }

  // Custom Roles methods
  async getCustomRoles(tenantId: number): Promise<CustomRole[]> {
    return await db.select().from(customRoles)
      .where(and(
        eq(customRoles.tenantId, tenantId),
        eq(customRoles.isActive, true)
      ))
      .orderBy(desc(customRoles.createdAt));
  }

  async getCustomRole(id: number, tenantId: number): Promise<CustomRole | undefined> {
    const [role] = await db.select().from(customRoles)
      .where(and(
        eq(customRoles.id, id),
        eq(customRoles.tenantId, tenantId),
        eq(customRoles.isActive, true)
      ));
    return role;
  }

  async createCustomRole(insertRole: any): Promise<CustomRole> {
    const [role] = await db.insert(customRoles).values(insertRole).returning();
    return role;
  }

  async updateCustomRole(id: number, updateRole: any, tenantId: number): Promise<CustomRole | undefined> {
    const [role] = await db.update(customRoles)
      .set({ ...updateRole, updatedAt: new Date() })
      .where(and(
        eq(customRoles.id, id),
        eq(customRoles.tenantId, tenantId)
      ))
      .returning();
    return role;
  }

  async deleteCustomRole(id: number, tenantId: number): Promise<boolean> {
    const result = await db.update(customRoles)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(customRoles.id, id),
        eq(customRoles.tenantId, tenantId)
      ));
    return result.rowCount! > 0;
  }

  // Custom Permissions methods
  async getCustomPermissions(tenantId: number): Promise<CustomPermission[]> {
    return await db.select().from(customPermissions)
      .where(eq(customPermissions.tenantId, tenantId))
      .orderBy(desc(customPermissions.createdAt));
  }

  async getCustomPermissionsByRole(roleId: number, tenantId: number): Promise<CustomPermission[]> {
    return await db.select().from(customPermissions)
      .where(and(
        eq(customPermissions.roleId, roleId),
        eq(customPermissions.tenantId, tenantId)
      ));
  }

  async createCustomPermission(insertPermission: InsertCustomPermission): Promise<CustomPermission> {
    const [permission] = await db.insert(customPermissions).values(insertPermission).returning();
    return permission;
  }

  async updateCustomPermission(id: number, updatePermission: Partial<InsertCustomPermission>, tenantId: number): Promise<CustomPermission | undefined> {
    const [permission] = await db.update(customPermissions)
      .set({ ...updatePermission, updatedAt: new Date() })
      .where(and(
        eq(customPermissions.id, id),
        eq(customPermissions.tenantId, tenantId)
      ))
      .returning();
    return permission;
  }

  async deleteCustomPermission(id: number, tenantId: number): Promise<boolean> {
    const result = await db.delete(customPermissions)
      .where(and(
        eq(customPermissions.id, id),
        eq(customPermissions.tenantId, tenantId)
      ));
    return result.rowCount! > 0;
  }

  // User Role Assignments methods
  async getUserRoleAssignments(tenantId: number): Promise<UserRoleAssignment[]> {
    return await db.select().from(userRoleAssignments)
      .where(and(
        eq(userRoleAssignments.tenantId, tenantId),
        eq(userRoleAssignments.isActive, true)
      ))
      .orderBy(desc(userRoleAssignments.assignedAt));
  }

  async getUserRoleAssignment(userId: number, tenantId: number): Promise<UserRoleAssignment | undefined> {
    const [assignment] = await db.select().from(userRoleAssignments)
      .where(and(
        eq(userRoleAssignments.userId, userId),
        eq(userRoleAssignments.tenantId, tenantId),
        eq(userRoleAssignments.isActive, true)
      ));
    return assignment;
  }

  async createUserRoleAssignment(insertAssignment: InsertUserRoleAssignment): Promise<UserRoleAssignment> {
    const [assignment] = await db.insert(userRoleAssignments).values(insertAssignment).returning();
    return assignment;
  }

  async updateUserRoleAssignment(id: number, updateAssignment: Partial<InsertUserRoleAssignment>, tenantId: number): Promise<UserRoleAssignment | undefined> {
    const [assignment] = await db.update(userRoleAssignments)
      .set(updateAssignment)
      .where(and(
        eq(userRoleAssignments.id, id),
        eq(userRoleAssignments.tenantId, tenantId)
      ))
      .returning();
    return assignment;
  }

  async deleteUserRoleAssignment(id: number, tenantId: number): Promise<boolean> {
    const result = await db.update(userRoleAssignments)
      .set({ isActive: false })
      .where(and(
        eq(userRoleAssignments.id, id),
        eq(userRoleAssignments.tenantId, tenantId)
      ));
    return result.rowCount! > 0;
  }

  // Task Board Tasks methods
  async getTaskBoardTasks(tenantId: number): Promise<TaskBoardTask[]> {
    return await db.select().from(taskBoardTasks)
      .where(eq(taskBoardTasks.tenantId, tenantId))
      .orderBy(desc(taskBoardTasks.createdAt));
  }

  async getTaskBoardTask(id: number, tenantId: number): Promise<TaskBoardTask | undefined> {
    const [task] = await db.select().from(taskBoardTasks)
      .where(and(
        eq(taskBoardTasks.id, id),
        eq(taskBoardTasks.tenantId, tenantId)
      ));
    return task;
  }

  async createTaskBoardTask(insertTask: any): Promise<TaskBoardTask> {
    console.log("Storage: Creating task with data:", insertTask);
    const [task] = await db.insert(taskBoardTasks).values(insertTask).returning();
    console.log("Storage: Created task:", task);
    return task;
  }

  async updateTaskBoardTask(id: number, updateTask: any, tenantId: number): Promise<TaskBoardTask | undefined> {
    const [task] = await db.update(taskBoardTasks)
      .set({ ...updateTask, updatedAt: new Date() })
      .where(and(
        eq(taskBoardTasks.id, id),
        eq(taskBoardTasks.tenantId, tenantId)
      ))
      .returning();
    return task;
  }

  async deleteTaskBoardTask(id: number, tenantId: number): Promise<boolean> {
    const result = await db.delete(taskBoardTasks)
      .where(and(
        eq(taskBoardTasks.id, id),
        eq(taskBoardTasks.tenantId, tenantId)
      ));
    return result.rowCount! > 0;
  }

  // NDIS Pricing methods
  async getNdisPricing(tenantId: number): Promise<NdisPricing[]> {
    return await db.select().from(ndisPricing)
      .where(and(
        eq(ndisPricing.tenantId, tenantId),
        eq(ndisPricing.isActive, true)
      ))
      .orderBy(ndisPricing.shiftType, ndisPricing.ratio);
  }

  async createNdisPricing(insertPricing: any): Promise<NdisPricing> {
    const [pricing] = await db.insert(ndisPricing).values(insertPricing).returning();
    return pricing;
  }

  async updateNdisPricing(id: number, updatePricing: any, tenantId: number): Promise<NdisPricing | undefined> {
    const [pricing] = await db.update(ndisPricing)
      .set({ ...updatePricing, updatedAt: new Date() })
      .where(and(
        eq(ndisPricing.id, id),
        eq(ndisPricing.tenantId, tenantId)
      ))
      .returning();
    return pricing;
  }

  async deleteNdisPricing(id: number, tenantId: number): Promise<boolean> {
    const result = await db.update(ndisPricing)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(ndisPricing.id, id),
        eq(ndisPricing.tenantId, tenantId)
      ));
    return result.rowCount! > 0;
  }

  async getNdisPricingByTypeAndRatio(shiftType: string, ratio: string, tenantId: number): Promise<NdisPricing | undefined> {
    const [pricing] = await db.select().from(ndisPricing)
      .where(and(
        eq(ndisPricing.shiftType, shiftType),
        eq(ndisPricing.ratio, ratio),
        eq(ndisPricing.tenantId, tenantId),
        eq(ndisPricing.isActive, true)
      ));
    return pricing;
  }

  // NDIS Budget methods
  async getNdisBudgets(tenantId: number): Promise<NdisBudget[]> {
    return await db.select().from(ndisBudgets)
      .where(and(
        eq(ndisBudgets.tenantId, tenantId),
        eq(ndisBudgets.isActive, true)
      ))
      .orderBy(desc(ndisBudgets.createdAt));
  }

  async getNdisBudgetByClient(clientId: number, tenantId: number): Promise<NdisBudget | undefined> {
    const [budget] = await db.select().from(ndisBudgets)
      .where(and(
        eq(ndisBudgets.clientId, clientId),
        eq(ndisBudgets.tenantId, tenantId),
        eq(ndisBudgets.isActive, true)
      ));
    return budget;
  }

  async createNdisBudget(insertBudget: any): Promise<NdisBudget> {
    const [budget] = await db.insert(ndisBudgets).values(insertBudget).returning();
    return budget;
  }

  async updateNdisBudget(id: number, updateBudget: any, tenantId: number): Promise<NdisBudget | undefined> {
    const [budget] = await db.update(ndisBudgets)
      .set({ ...updateBudget, updatedAt: new Date() })
      .where(and(
        eq(ndisBudgets.id, id),
        eq(ndisBudgets.tenantId, tenantId)
      ))
      .returning();
    return budget;
  }

  async deactivateNdisBudget(id: number, tenantId: number): Promise<boolean> {
    const result = await db.update(ndisBudgets)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(ndisBudgets.id, id),
        eq(ndisBudgets.tenantId, tenantId)
      ));
    return result.rowCount! > 0;
  }

  // Budget Transaction methods
  async getBudgetTransactions(budgetId: number, companyId: string): Promise<BudgetTransaction[]> {
    return await db.select().from(budgetTransactions)
      .where(and(
        eq(budgetTransactions.budgetId, budgetId),
        eq(budgetTransactions.companyId, companyId)
      ))
      .orderBy(desc(budgetTransactions.createdAt));
  }

  async getAllBudgetTransactions(tenantId: number): Promise<any[]> {
    return await db.select({
      id: budgetTransactions.id,
      budgetId: budgetTransactions.budgetId,
      shiftId: budgetTransactions.shiftId,
      caseNoteId: budgetTransactions.caseNoteId,
      category: budgetTransactions.category,
      shiftType: budgetTransactions.shiftType,
      ratio: budgetTransactions.ratio,
      hours: budgetTransactions.hours,
      rate: budgetTransactions.rate,
      amount: budgetTransactions.amount,
      description: budgetTransactions.description,
      transactionType: budgetTransactions.transactionType,
      createdAt: budgetTransactions.createdAt,
      createdBy: {
        id: users.id,
        fullName: users.fullName,
        username: users.username,
      }
    })
    .from(budgetTransactions)
    .leftJoin(users, eq(budgetTransactions.createdByUserId, users.id))
    .leftJoin(ndisBudgets, eq(budgetTransactions.budgetId, ndisBudgets.id))
    .where(eq(ndisBudgets.tenantId, tenantId))
    .orderBy(desc(budgetTransactions.createdAt));
  }

  async createBudgetTransaction(insertTransaction: any): Promise<BudgetTransaction> {
    const [transaction] = await db.insert(budgetTransactions).values(insertTransaction).returning();
    return transaction;
  }

  async getTenant(tenantId: number): Promise<any> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    return tenant;
  }

  async getAllTenants(): Promise<any[]> {
    return await db.select().from(tenants);
  }

  async getCompletedShiftsWithoutBudgetTransactions(tenantId: number): Promise<any[]> {
    const results = await db.select({
      id: shifts.id,
      title: shifts.title,
      userId: shifts.userId,
      clientId: shifts.clientId,
      startTime: shifts.startTime,
      endTime: shifts.endTime,
      staffRatio: shifts.staffRatio,
      tenantId: shifts.tenantId,
      isActive: shifts.isActive
    })
      .from(shifts)
      .leftJoin(budgetTransactions, eq(shifts.id, budgetTransactions.shiftId))
      .where(and(
        eq(shifts.tenantId, tenantId),
        eq(shifts.isActive, false),
        sql`${shifts.endTime} IS NOT NULL`,
        sql`${budgetTransactions.shiftId} IS NULL`
      ));
    
    return results;
  }

  async processBudgetDeduction(params: {
    budgetId: number;
    category: string;
    shiftType: string;
    ratio: string;
    hours: number;
    rate: number;
    amount: number;
    shiftId?: number;
    caseNoteId?: number;
    description?: string;
    companyId: string;
    createdByUserId: number;
    tenantId: number;
  }): Promise<{ transaction: BudgetTransaction; updatedBudget: NdisBudget }> {
    return await db.transaction(async (tx) => {
      // Create the transaction record
      const [transaction] = await tx.insert(budgetTransactions).values({
        budgetId: params.budgetId,
        shiftId: params.shiftId,
        caseNoteId: params.caseNoteId,
        companyId: params.companyId,
        category: params.category,
        shiftType: params.shiftType,
        ratio: params.ratio,
        hours: params.hours.toString(),
        rate: params.rate.toString(),
        amount: params.amount.toString(),
        description: params.description,
        transactionType: "deduction",
        createdByUserId: params.createdByUserId,
      }).returning();

      // Update the budget remaining amount
      let updateField;
      switch (params.category) {
        case "SIL":
          updateField = { silRemaining: sql`${ndisBudgets.silRemaining} - ${params.amount}` };
          break;
        case "CommunityAccess":
          updateField = { communityAccessRemaining: sql`${ndisBudgets.communityAccessRemaining} - ${params.amount}` };
          break;
        case "CapacityBuilding":
          updateField = { capacityBuildingRemaining: sql`${ndisBudgets.capacityBuildingRemaining} - ${params.amount}` };
          break;
        default:
          throw new Error(`Invalid category: ${params.category}`);
      }

      const [updatedBudget] = await tx.update(ndisBudgets)
        .set({ ...updateField, updatedAt: new Date() })
        .where(and(
          eq(ndisBudgets.id, params.budgetId),
          eq(ndisBudgets.tenantId, params.tenantId)
        ))
        .returning();

      return { transaction, updatedBudget };
    });
  }

  // Care Support Plans
  async getCareSupportPlans(tenantId: number): Promise<CareSupportPlan[]> {
    return await db.select().from(careSupportPlans)
      .where(eq(careSupportPlans.tenantId, tenantId))
      .orderBy(desc(careSupportPlans.updatedAt));
  }

  async getCareSupportPlan(id: number, tenantId: number): Promise<CareSupportPlan | undefined> {
    const [plan] = await db.select().from(careSupportPlans)
      .where(and(eq(careSupportPlans.id, id), eq(careSupportPlans.tenantId, tenantId)));
    return plan || undefined;
  }

  async getCareSupportPlansByClient(clientId: number, tenantId: number): Promise<CareSupportPlan[]> {
    return await db.select().from(careSupportPlans)
      .where(and(eq(careSupportPlans.clientId, clientId), eq(careSupportPlans.tenantId, tenantId)))
      .orderBy(desc(careSupportPlans.updatedAt));
  }

  async createCareSupportPlan(insertPlan: InsertCareSupportPlan): Promise<CareSupportPlan> {
    const [plan] = await db
      .insert(careSupportPlans)
      .values([insertPlan])
      .returning();
    return plan;
  }

  async updateCareSupportPlan(id: number, updatePlan: Partial<InsertCareSupportPlan>, tenantId: number): Promise<CareSupportPlan | undefined> {
    const [plan] = await db
      .update(careSupportPlans)
      .set({ ...updatePlan, updatedAt: new Date() })
      .where(and(eq(careSupportPlans.id, id), eq(careSupportPlans.tenantId, tenantId)))
      .returning();
    return plan || undefined;
  }

  async deleteCareSupportPlan(id: number, tenantId: number): Promise<boolean> {
    const result = await db
      .delete(careSupportPlans)
      .where(and(eq(careSupportPlans.id, id), eq(careSupportPlans.tenantId, tenantId)));
    return (result.rowCount || 0) > 0;
  }

  // Tenant provisioning methods
  async getAllTenants(): Promise<Array<{ id: number; companyId?: string }>> {
    const tenantData = await db.select({ 
      tenantId: users.tenantId 
    }).from(users)
    .groupBy(users.tenantId)
    .orderBy(users.tenantId);
    
    return tenantData.map(t => ({ id: t.tenantId, companyId: `company-${t.tenantId}` }));
  }

  async getClientCountByTenant(tenantId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(clients)
      .where(eq(clients.tenantId, tenantId));
    
    return result[0]?.count || 0;
  }

  async getClientsByTenant(tenantId: number): Promise<Client[]> {
    return await db.select().from(clients)
      .where(eq(clients.tenantId, tenantId))
      .orderBy(clients.createdAt);
  }

  async getUsersByTenant(tenantId: number): Promise<User[]> {
    return await db.select().from(users)
      .where(eq(users.tenantId, tenantId))
      .orderBy(users.createdAt);
  }

  async createNdisBudget(budgetData: any): Promise<NdisBudget> {
    const [budget] = await db.insert(ndisBudgets).values(budgetData).returning();
    return budget;
  }

  // Pay Scale Management methods
  async getPayScales(tenantId: number): Promise<PayScale[]> {
    return await db.select().from(payScales)
      .where(eq(payScales.tenantId, tenantId))
      .orderBy(payScales.level, payScales.payPoint);
  }

  async getPayScalesByTenant(tenantId: number): Promise<PayScale[]> {
    return await db.select().from(payScales)
      .where(eq(payScales.tenantId, tenantId))
      .orderBy(payScales.level, payScales.payPoint);
  }

  async updatePayScale(tenantId: number, level: number, payPoint: number, hourlyRate: number): Promise<PayScale> {
    const [updated] = await db.update(payScales)
      .set({
        hourlyRate: hourlyRate.toString(),
        effectiveDate: new Date(),
      })
      .where(and(
        eq(payScales.tenantId, tenantId),
        eq(payScales.level, level),
        eq(payScales.payPoint, payPoint)
      ))
      .returning();
    
    return updated;
  }

  async resetPayScalesToDefault(tenantId: number): Promise<void> {
    // ScHADS default rates for 2024-25
    const defaultRates = [
      { level: 1, payPoint: 1, rate: 25.41 },
      { level: 1, payPoint: 2, rate: 26.02 },
      { level: 1, payPoint: 3, rate: 26.63 },
      { level: 1, payPoint: 4, rate: 27.24 },
      { level: 2, payPoint: 1, rate: 27.85 },
      { level: 2, payPoint: 2, rate: 28.46 },
      { level: 2, payPoint: 3, rate: 29.07 },
      { level: 2, payPoint: 4, rate: 29.68 },
      { level: 3, payPoint: 1, rate: 30.29 },
      { level: 3, payPoint: 2, rate: 30.90 },
      { level: 3, payPoint: 3, rate: 31.51 },
      { level: 3, payPoint: 4, rate: 32.12 },
      { level: 4, payPoint: 1, rate: 32.73 },
      { level: 4, payPoint: 2, rate: 33.34 },
      { level: 4, payPoint: 3, rate: 33.95 },
      { level: 4, payPoint: 4, rate: 34.31 },
    ];

    for (const defaultRate of defaultRates) {
      await db.update(payScales)
        .set({
          hourlyRate: defaultRate.rate.toString(),
          effectiveDate: new Date(),
        })
        .where(and(
          eq(payScales.tenantId, tenantId),
          eq(payScales.level, defaultRate.level),
          eq(payScales.payPoint, defaultRate.payPoint)
        ));
    }
  }

  // Shift Cancellation methods
  async getShiftCancellations(tenantId: number): Promise<ShiftCancellation[]> {
    return await db.select().from(shiftCancellations)
      .where(eq(shiftCancellations.tenantId, tenantId))
      .orderBy(desc(shiftCancellations.createdAt));
  }

  async getShiftCancellation(id: number, tenantId: number): Promise<ShiftCancellation | undefined> {
    const [cancellation] = await db.select().from(shiftCancellations)
      .where(and(eq(shiftCancellations.id, id), eq(shiftCancellations.tenantId, tenantId)));
    return cancellation;
  }

  async createShiftCancellation(cancellation: InsertShiftCancellation): Promise<ShiftCancellation> {
    const [newCancellation] = await db.insert(shiftCancellations).values(cancellation).returning();
    return newCancellation;
  }

  async getShiftCancellationsForExport(tenantId: number, filters: {
    staffId?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<ShiftCancellation[]> {
    const conditions = [eq(shiftCancellations.tenantId, tenantId)];

    if (filters.staffId) {
      conditions.push(eq(shiftCancellations.cancelledByUserId, filters.staffId));
    }

    if (filters.startDate) {
      conditions.push(sql`${shiftCancellations.createdAt} >= ${filters.startDate}`);
    }

    if (filters.endDate) {
      conditions.push(sql`${shiftCancellations.createdAt} <= ${filters.endDate}`);
    }

    return await db.select().from(shiftCancellations)
      .where(and(...conditions))
      .orderBy(desc(shiftCancellations.createdAt));
  }

  // Cancellation Request methods
  async getCancellationRequests(tenantId: number): Promise<CancellationRequest[]> {
    return await db.select().from(cancellationRequests)
      .where(eq(cancellationRequests.tenantId, tenantId))
      .orderBy(desc(cancellationRequests.createdAt));
  }

  async getCancellationRequest(id: number, tenantId: number): Promise<CancellationRequest | undefined> {
    const [request] = await db.select().from(cancellationRequests)
      .where(and(eq(cancellationRequests.id, id), eq(cancellationRequests.tenantId, tenantId)));
    return request;
  }

  async createCancellationRequest(request: InsertCancellationRequest): Promise<CancellationRequest> {
    const [newRequest] = await db.insert(cancellationRequests).values(request).returning();
    return newRequest;
  }

  async updateCancellationRequest(id: number, request: Partial<InsertCancellationRequest>, tenantId: number): Promise<CancellationRequest | undefined> {
    const [updatedRequest] = await db.update(cancellationRequests)
      .set({ ...request, updatedAt: new Date() })
      .where(and(eq(cancellationRequests.id, id), eq(cancellationRequests.tenantId, tenantId)))
      .returning();
    return updatedRequest;
  }
}

export const storage = new DatabaseStorage();
