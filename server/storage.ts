import { 
  companies, users, clients, tenants, formTemplates, formSubmissions, shifts, staffAvailability, caseNotes, activityLogs, hourlyObservations,
  medicationPlans, medicationRecords, medicationSchedules, incidentReports, incidentClosures, staffMessages, hourAllocations,
  customRoles, customPermissions, userRoleAssignments, taskBoardTasks, ndisPricing, ndisBudgets, budgetTransactions, careSupportPlans,
  shiftCancellations, cancellationRequests, payScales, notifications, timesheets, timesheetEntries, leaveBalances, taxBrackets,
  downloadableForms, completedMedicationAuthorityForms, evacuationDrills, billingConfiguration,
  serviceAgreements, serviceAgreementItems, serviceAgreementSignatures, tenantTermsTemplates,
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
  type PayScale, type Notification, type InsertNotification, type TaxBracket,
  type DownloadableForm, type InsertDownloadableForm, type CompletedMedicationAuthorityForm, type InsertCompletedMedicationAuthorityForm,
  type EvacuationDrill, type InsertEvacuationDrill,
  type ServiceAgreement, type InsertServiceAgreement, type ServiceAgreementItem, type InsertServiceAgreementItem,
  type ServiceAgreementSignature, type InsertServiceAgreementSignature, type TenantTermsTemplate, type InsertTenantTermsTemplate
} from "@shared/schema";
import { db, pool } from "./lib/dbClient";
import { and, eq, desc, gte, lte, isNull, ne, or, count, sum, asc, sql, isNotNull, inArray, exists, like, ilike } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { randomUUID } from "crypto";

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
  getUserByUsernameAndTenant(username: string, tenantId: number): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>, tenantId: number): Promise<User | undefined>;
  getUsersByTenant(tenantId: number): Promise<User[]>;

  // Tenants
  getTenant(id: number): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  getTenants(): Promise<Tenant[]>;

  // Billing Configuration
  getBillingConfiguration(): Promise<any>;
  updateBillingConfiguration(config: any): Promise<any>;
  getAllStaffTypes(): Promise<string[]>;
  getStaffStatistics(): Promise<any[]>;

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
  getShiftsBySeries(seriesId: string, tenantId: number): Promise<Shift[]>;

  // Staff Availability
  getStaffAvailability(tenantId: number): Promise<StaffAvailability[]>;
  getUserAvailability(userId: number, tenantId: number): Promise<StaffAvailability | undefined>;
  getUserAllAvailabilities(userId: number, tenantId: number): Promise<StaffAvailability[]>;
  getStaffAvailabilityById(id: number, tenantId: number): Promise<StaffAvailability | undefined>;
  createStaffAvailability(availability: InsertStaffAvailability): Promise<StaffAvailability>;
  updateStaffAvailability(id: number, availability: Partial<InsertStaffAvailability>, tenantId: number): Promise<StaffAvailability | undefined>;
  deleteStaffAvailability(id: number, tenantId: number): Promise<boolean>;
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

  // Incident Reports
  getIncidentReports(tenantId: number): Promise<IncidentReport[]>;
  getIncidentReportsWithClosures(tenantId: number): Promise<any[]>;
  getIncidentReport(incidentId: string, tenantId: number): Promise<IncidentReport | undefined>;
  generateIncidentId(tenantId: number): Promise<string>;
  createIncidentReport(report: InsertIncidentReport): Promise<IncidentReport>;
  updateIncidentReport(incidentId: string, report: Partial<InsertIncidentReport>, tenantId: number): Promise<IncidentReport | undefined>;
  deleteIncidentReport(incidentId: string, tenantId: number): Promise<boolean>;

  // Incident Closures
  getIncidentClosure(incidentId: string, tenantId: number): Promise<IncidentClosure | undefined>;
  createIncidentClosure(closure: InsertIncidentClosure): Promise<IncidentClosure>;
  updateIncidentClosure(incidentId: string, closure: Partial<InsertIncidentClosure>, tenantId: number): Promise<IncidentClosure | undefined>;

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

  // Notifications
  getNotifications(userId: number, tenantId: number): Promise<Notification[]>;
  getUnreadNotificationCount(userId: number, tenantId: number): Promise<number>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number, userId: number, tenantId: number): Promise<boolean>;
  markAllNotificationsAsRead(userId: number, tenantId: number): Promise<boolean>;
  deleteNotification(id: number, userId: number, tenantId: number): Promise<boolean>;

  // Admin Timesheet Management
  getAdminTimesheets(tenantId: number, status: string | string[]): Promise<any[]>;
  approveTimesheet(timesheetId: number, adminUserId: number, tenantId: number): Promise<any>;
  rejectTimesheet(timesheetId: number, adminUserId: number, tenantId: number, reason?: string): Promise<any>;
  getTimesheetById(timesheetId: number, tenantId: number): Promise<any>;
  getTimesheetEntries(timesheetId: number, tenantId: number): Promise<any[]>;
  updateTimesheetEntry(entryId: number, updateData: any, tenantId: number): Promise<any>;
  getTimesheetEntryById(entryId: number, tenantId: number): Promise<any>;
  markTimesheetAsPaid(timesheetId: number, adminUserId: number, tenantId: number): Promise<any>;
  createBulkNotifications(notifications: InsertNotification[]): Promise<Notification[]>;

  // Tax Brackets
  getTaxBrackets(taxYear: number): Promise<any[]>;
  createTaxBracket(bracket: any): Promise<any>;

  // Compliance Centre
  getDownloadableForms(tenantId: number): Promise<DownloadableForm[]>;
  getDownloadableForm(id: number, tenantId: number): Promise<DownloadableForm | undefined>;
  createDownloadableForm(form: InsertDownloadableForm): Promise<DownloadableForm>;
  updateDownloadableForm(id: number, form: Partial<InsertDownloadableForm>, tenantId: number): Promise<DownloadableForm | undefined>;
  deleteDownloadableForm(id: number, tenantId: number): Promise<boolean>;
  
  getCompletedMedicationForms(tenantId: number): Promise<CompletedMedicationAuthorityForm[]>;
  getCompletedMedicationFormsByClient(clientId: number, tenantId: number): Promise<CompletedMedicationAuthorityForm[]>;
  createCompletedMedicationForm(form: InsertCompletedMedicationAuthorityForm): Promise<CompletedMedicationAuthorityForm>;
  deleteCompletedMedicationForm(id: number, tenantId: number): Promise<boolean>;
  
  getEvacuationDrills(tenantId: number): Promise<EvacuationDrill[]>;
  getEvacuationDrill(id: number, tenantId: number): Promise<EvacuationDrill | undefined>;
  createEvacuationDrill(drill: InsertEvacuationDrill): Promise<EvacuationDrill>;
  updateEvacuationDrill(id: number, drill: Partial<InsertEvacuationDrill>, tenantId: number): Promise<EvacuationDrill | undefined>;
  deleteEvacuationDrill(id: number, tenantId: number): Promise<boolean>;

  // NDIS Service Agreements
  getServiceAgreements(companyId: string, clientId?: number): Promise<ServiceAgreement[]>;
  getServiceAgreement(id: string, companyId: string): Promise<ServiceAgreement | undefined>;
  createServiceAgreement(agreement: InsertServiceAgreement): Promise<ServiceAgreement>;
  updateServiceAgreement(id: string, agreement: Partial<InsertServiceAgreement>, companyId: string): Promise<ServiceAgreement | undefined>;
  deleteServiceAgreement(id: string, companyId: string): Promise<boolean>;

  // Service Agreement Items
  getServiceAgreementItems(agreementId: string): Promise<ServiceAgreementItem[]>;
  createServiceAgreementItem(item: InsertServiceAgreementItem): Promise<ServiceAgreementItem>;
  updateServiceAgreementItem(id: string, item: Partial<InsertServiceAgreementItem>): Promise<ServiceAgreementItem | undefined>;
  deleteServiceAgreementItem(id: string): Promise<boolean>;

  // Service Agreement Signatures
  getServiceAgreementSignatures(agreementId: string): Promise<ServiceAgreementSignature[]>;
  createServiceAgreementSignature(signature: InsertServiceAgreementSignature): Promise<ServiceAgreementSignature>;

  // Tenant Terms Templates
  getTenantTermsTemplates(companyId: string): Promise<TenantTermsTemplate[]>;
  getDefaultTermsTemplate(companyId: string): Promise<TenantTermsTemplate | undefined>;
  createTenantTermsTemplate(template: InsertTenantTermsTemplate): Promise<TenantTermsTemplate>;
  updateTenantTermsTemplate(id: string, template: Partial<InsertTenantTermsTemplate>, companyId: string): Promise<TenantTermsTemplate | undefined>;

  // Session store
  sessionStore: any;
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    // Enhanced PostgreSQL session store for AWS production
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true,
      tableName: 'session',           // Explicit table name
      pruneSessionInterval: 60,       // Clean expired sessions every 60 seconds
      errorLog: (error: any) => {     // Enhanced error logging
        console.error('[SESSION STORE] Error:', error);
      }
    });
    
    console.log('[SESSION STORE] PostgreSQL session store initialized');
    console.log('[SESSION STORE] Using database pool connection');
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

  async getUserByUsernameAndTenant(username: string, tenantId: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(
      and(eq(users.username, username), eq(users.tenantId, tenantId))
    );
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

  // Companies section - getCompanyByTenantId already defined above

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
    // 🚨 PERMANENT DEMO DATA PREVENTION SAFEGUARD
    const demoFirstNames = ['Sarah', 'Michael', 'Emma', 'John', 'Jane', 'Test', 'Demo'];
    const demoLastNames = ['Johnson', 'Chen', 'Williams', 'Doe', 'Smith', 'Test', 'Demo'];
    
    if (demoFirstNames.includes(insertClient.firstName) || demoLastNames.includes(insertClient.lastName)) {
      console.error(`🚨 [DEMO DATA BLOCKED] Rejected client creation attempt: ${insertClient.firstName} ${insertClient.lastName}`);
      console.error(`🚨 [DEMO DATA BLOCKED] Tenant: ${insertClient.tenantId}, CreatedBy: ${insertClient.createdBy}`);
      throw new Error(`BLOCKED: Demo client names (${insertClient.firstName} ${insertClient.lastName}) are permanently prohibited. Use real client names only.`);
    }
    
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
    
    console.log(`✅ [CLIENT CREATED] Real client: ${fullName} (ID: ${client.id}, Tenant: ${client.tenantId})`);
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
    try {
      console.log(`[STORAGE CREATE SHIFT] Attempting to create shift with data:`, JSON.stringify(insertShift, null, 2));
      
      // Validate required fields before insertion
      if (!insertShift.startTime) {
        throw new Error("startTime is required but missing");
      }
      if (!insertShift.tenantId) {
        throw new Error("tenantId is required but missing");
      }
      
      console.log(`[STORAGE CREATE SHIFT] Required fields validated: startTime=${insertShift.startTime}, tenantId=${insertShift.tenantId}`);
      
      const [shift] = await db
        .insert(shifts)
        .values(insertShift)
        .returning();
        
      console.log(`[STORAGE CREATE SHIFT] Successfully created shift with ID: ${shift.id}`);
      return shift;
    } catch (error) {
      console.error(`[STORAGE CREATE SHIFT] Database insertion failed:`, error);
      console.error(`[STORAGE CREATE SHIFT] Failed data:`, JSON.stringify(insertShift, null, 2));
      throw error;
    }
  }

  async getShift(id: number, tenantId: number): Promise<Shift | undefined> {
    const [shift] = await db
      .select()
      .from(shifts)
      .where(and(eq(shifts.id, id), eq(shifts.tenantId, tenantId)));
    return shift || undefined;
  }

  async updateShift(id: number, updateShift: Partial<InsertShift>, tenantId: number): Promise<Shift | undefined> {
    
    try {
      
      // Check if shift exists before updating
      const existingShift = await db
        .select()
        .from(shifts)
        .where(and(eq(shifts.id, id), eq(shifts.tenantId, tenantId)))
        .limit(1);
      
      if (existingShift.length === 0) {
        return undefined;
      }
      
      
      const [shift] = await db
        .update(shifts)
        .set(updateShift)
        .where(and(eq(shifts.id, id), eq(shifts.tenantId, tenantId)))
        .returning();
      
      if (shift) {
      } else {
      }
      
      return shift || undefined;
    } catch (error) {
      
      // Re-throw to maintain error handling chain
      throw error;
    }
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
      .set({ endTime, isActive: false, status: "completed" })
      .where(and(eq(shifts.id, id), eq(shifts.tenantId, tenantId)))
      .returning();
    return shift || undefined;
  }

  async getShiftsByUser(userId: number, tenantId: number): Promise<Shift[]> {
    return await db.select().from(shifts)
      .where(and(eq(shifts.userId, userId), eq(shifts.tenantId, tenantId)))
      .orderBy(desc(shifts.startTime));
  }

  async getShiftsBySeries(seriesId: string, tenantId: number): Promise<Shift[]> {
    return await db.select().from(shifts)
      .where(and(
        eq(shifts.seriesId, seriesId), 
        eq(shifts.tenantId, tenantId)
      ))
      .orderBy(shifts.startTime);
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

  async getUserAllAvailabilities(userId: number, tenantId: number): Promise<StaffAvailability[]> {
    return await db.select().from(staffAvailability)
      .where(and(
        eq(staffAvailability.userId, userId),
        eq(staffAvailability.tenantId, tenantId),
        eq(staffAvailability.isActive, true)
      ))
      .orderBy(desc(staffAvailability.createdAt));
  }

  async getStaffAvailabilityById(id: number, tenantId: number): Promise<StaffAvailability | undefined> {
    const [availability] = await db.select().from(staffAvailability)
      .where(and(
        eq(staffAvailability.id, id),
        eq(staffAvailability.tenantId, tenantId)
      ));
    return availability;
  }

  async deleteStaffAvailability(id: number, tenantId: number): Promise<boolean> {
    const result = await db.update(staffAvailability)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(staffAvailability.id, id),
        eq(staffAvailability.tenantId, tenantId)
      ));
    return result.rowCount! > 0;
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
    // Return empty array - no demo data, real conflicts would be calculated based on actual staff availability and shift requirements
    // When staff availability and shift patterns are configured, this would analyze:
    // 1. Staff availability by day/shift type
    // 2. Minimum staffing requirements per shift
    // 3. Identify understaffed periods
    return [];
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

  async generateIncidentId(tenantId: number): Promise<string> {
    try {
      // Get company information to extract first 3 letters
      const company = await this.getCompanyByTenantId(tenantId);
      const businessName = company?.name || 'DEFAULT';
      const businessPrefix = businessName.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase();
      
      // Get the count of existing incident reports for this tenant
      const [countResult] = await db.select({ count: count() })
        .from(incidentReports)
        .where(eq(incidentReports.tenantId, tenantId));
      
      const incidentCount = countResult.count + 1;
      const paddedCount = incidentCount.toString().padStart(3, '0');
      
      return `IR_${businessPrefix}_${paddedCount}`;
    } catch (error) {
      console.error('Error generating incident ID:', error);
      // Fallback to timestamp-based ID if generation fails
      return `IR_DEFAULT_${Date.now()}`;
    }
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
    try {
      console.log(`[AWS STORAGE DEBUG] Fetching incident reports with closures for tenant ${tenantId}`);
      
      // First, check if we have basic incident reports
      const basicCheck = await db.select({ count: sql`count(*)` })
        .from(incidentReports)
        .where(eq(incidentReports.tenantId, tenantId));
      
      console.log(`[AWS STORAGE DEBUG] Basic incident count for tenant ${tenantId}: ${basicCheck[0].count}`);
      
      const reports = await db.select({
        id: incidentReports.id,
        incidentId: incidentReports.incidentId,
        clientId: incidentReports.clientId,
        staffId: incidentReports.staffId,
        dateTime: incidentReports.dateTime,
        location: incidentReports.location,
        witnessName: incidentReports.witnessName,
        witnessPhone: incidentReports.witnessPhone,
        types: incidentReports.types,
        isNDISReportable: incidentReports.isNDISReportable,
        triggers: incidentReports.triggers,
        intensityRating: incidentReports.intensityRating,
        staffResponses: incidentReports.staffResponses,
        description: incidentReports.description,
        externalRef: incidentReports.externalRef,
        status: incidentReports.status,
        tenantId: incidentReports.tenantId,
        createdAt: incidentReports.createdAt,
        updatedAt: incidentReports.updatedAt,
        // Client information
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        clientIdNumber: clients.clientId,
        // Staff information
        staffUsername: users.username,
        staffFullName: users.fullName,
        // Closure information with new standardized fields
        closureId: incidentClosures.id,
        closureDate: incidentClosures.closureDate,
        findings: incidentClosures.findings,
        rootCause: incidentClosures.rootCause,
        recommendations: incidentClosures.recommendations,
        outcomes: incidentClosures.outcomes,
        controls: incidentClosures.controls,
        externalReporting: incidentClosures.externalReporting,
        externalReference: incidentClosures.externalReference,
        followUpDate: incidentClosures.followUpDate,
        closureStatus: incidentClosures.status,
        closureCreatedAt: incidentClosures.createdAt
      })
      .from(incidentReports)
      .leftJoin(clients, eq(incidentReports.clientId, clients.id))
      .leftJoin(users, eq(incidentReports.staffId, users.id))
      .leftJoin(incidentClosures, eq(incidentReports.incidentId, incidentClosures.incidentId))
      .where(eq(incidentReports.tenantId, tenantId))
      .orderBy(desc(incidentReports.createdAt));
      
      console.log(`[AWS STORAGE DEBUG] Query executed successfully, got ${reports.length} reports`);

      // Transform the data to match the expected frontend structure
      const transformedReports = reports.map(report => ({
        ...report,
        closure: report.closureId ? {
          id: report.closureId,
          closureDate: report.closureDate,
          findings: report.findings,
          rootCause: report.rootCause,
          recommendations: report.recommendations,
          outcomes: report.outcomes,
          controls: report.controls,
          externalReporting: report.externalReporting,
          externalReference: report.externalReference,
          followUpDate: report.followUpDate,
          status: report.closureStatus,
          createdAt: report.closureCreatedAt
        } : null,
        // Remove the flattened closure fields from the main object
        closureId: undefined,
        closureDate: undefined,
        findings: undefined,
        rootCause: undefined,
        recommendations: undefined,
        outcomes: undefined,
        controls: undefined,
        externalReporting: undefined,
        externalReference: undefined,
        followUpDate: undefined,
        closureStatus: undefined,
        closureCreatedAt: undefined
      }));
      
      console.log(`[AWS STORAGE DEBUG] Successfully transformed ${transformedReports.length} reports`);
      return transformedReports;
    } catch (error) {
      console.error("Error fetching incident reports with closures:", error);
      console.error("Error details:", error.message);
      console.error("Error stack:", error.stack);
      
      // Fallback: return basic incident reports if the complex join fails
      console.log(`[AWS STORAGE DEBUG] Falling back to basic incident reports for tenant ${tenantId}`);
      try {
        const basicReports = await this.getIncidentReports(tenantId);
        console.log(`[AWS STORAGE DEBUG] Fallback successful: ${basicReports.length} basic reports`);
        return basicReports;
      } catch (fallbackError) {
        console.error("Fallback also failed:", fallbackError);
        return [];
      }
    }
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
    const maxHours = insertAllocation.maxHours || 0;
    const processedData = {
      ...insertAllocation,
      maxHours: maxHours.toString(),
      hoursUsed: "0",
      remainingHours: maxHours.toString(),
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



  // Timesheet Entry Management methods

  async createTimesheetEntry(entryData: any): Promise<number> {
    const [entry] = await db.insert(timesheetEntries).values(entryData).returning();
    return entry.id;
  }

  async updateTimesheetEntry(entryId: number, updates: any, tenantId: number): Promise<any> {
    const [updatedEntry] = await db.update(timesheetEntries)
      .set(updates)
      .where(and(
        eq(timesheetEntries.id, entryId),
        exists(
          db.select({ id: timesheets.id })
            .from(timesheets)
            .where(and(
              eq(timesheets.id, timesheetEntries.timesheetId),
              eq(timesheets.tenantId, tenantId)
            ))
        )
      ))
      .returning();
    
    return updatedEntry;
  }

  async deleteTimesheetEntry(entryId: number, tenantId: number): Promise<void> {
    await db.delete(timesheetEntries)
      .where(and(
        eq(timesheetEntries.id, entryId),
        exists(
          db.select({ id: timesheets.id })
            .from(timesheets)
            .where(and(
              eq(timesheets.id, timesheetEntries.timesheetId),
              eq(timesheets.tenantId, tenantId)
            ))
        )
      ));
  }

  // Pay Scale Management methods
  async getPayScales(tenantId: number, employmentType?: string): Promise<PayScale[]> {
    const conditions = [eq(payScales.tenantId, tenantId)];
    if (employmentType) {
      conditions.push(eq(payScales.employmentType, employmentType));
    }
    
    return await db.select().from(payScales)
      .where(and(...conditions))
      .orderBy(payScales.employmentType, payScales.level, payScales.payPoint);
  }

  async getPayScalesByTenant(tenantId: number): Promise<PayScale[]> {
    return await db.select().from(payScales)
      .where(eq(payScales.tenantId, tenantId))
      .orderBy(payScales.employmentType, payScales.level, payScales.payPoint);
  }

  async updatePayScale(tenantId: number, level: number, payPoint: number, hourlyRate: number, employmentType: string = "fulltime"): Promise<PayScale> {
    const [updated] = await db.update(payScales)
      .set({
        hourlyRate: hourlyRate.toString(),
        effectiveDate: new Date(),
      })
      .where(and(
        eq(payScales.tenantId, tenantId),
        eq(payScales.level, level),
        eq(payScales.payPoint, payPoint),
        eq(payScales.employmentType, employmentType)
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
    try {
      console.log(`[STORAGE] Starting shift cancellations query for tenant ${tenantId}`);
      console.log(`[STORAGE] Database connection status:`, !!db);
      console.log(`[STORAGE] Table reference:`, !!shiftCancellations);
      
      const results = await db.select().from(shiftCancellations)
        .where(eq(shiftCancellations.tenantId, tenantId))
        .orderBy(desc(shiftCancellations.createdAt));
        
      console.log(`[STORAGE] Successfully fetched ${results.length} shift cancellations`);
      console.log(`[STORAGE] Sample result:`, results[0] ? JSON.stringify(results[0], null, 2) : 'No results');
      return results;
    } catch (error: any) {
      console.error(`[STORAGE] Critical error in getShiftCancellations:`, {
        tenantId,
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
        errorCode: error.code
      });
      throw new Error(`Database query failed: ${error.message}`);
    }
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

  // Notification methods
  async getNotifications(userId: number, tenantId: number): Promise<Notification[]> {
    return await db.select().from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.tenantId, tenantId)
      ))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
  }

  async getUnreadNotificationCount(userId: number, tenantId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.tenantId, tenantId),
        eq(notifications.isRead, false)
      ));
    
    return result[0]?.count || 0;
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async markNotificationAsRead(id: number, userId: number, tenantId: number): Promise<boolean> {
    const result = await db.update(notifications)
      .set({ 
        isRead: true, 
        readAt: new Date() 
      })
      .where(and(
        eq(notifications.id, id),
        eq(notifications.userId, userId),
        eq(notifications.tenantId, tenantId)
      ));
    
    return (result.rowCount || 0) > 0;
  }

  async markAllNotificationsAsRead(userId: number, tenantId: number): Promise<boolean> {
    const result = await db.update(notifications)
      .set({ 
        isRead: true, 
        readAt: new Date() 
      })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.tenantId, tenantId),
        eq(notifications.isRead, false)
      ));
    
    return (result.rowCount || 0) > 0;
  }

  async deleteNotification(id: number, userId: number, tenantId: number): Promise<boolean> {
    const result = await db.delete(notifications)
      .where(and(
        eq(notifications.id, id),
        eq(notifications.userId, userId),
        eq(notifications.tenantId, tenantId)
      ));
    
    return (result.rowCount || 0) > 0;
  }

  async createBulkNotifications(notificationList: InsertNotification[]): Promise<Notification[]> {
    if (notificationList.length === 0) return [];
    
    const created = await db.insert(notifications).values(notificationList).returning();
    return created;
  }

  // Atomic budget deduction to prevent race conditions
  async atomicBudgetDeduction(params: {
    budgetId: number;
    budgetField: string;
    deductionAmount: number;
    tenantId: number;
    transactionData: {
      budgetId: number;
      category: string;
      shiftType: string;
      ratio: string;
      hours: number;
      rate: number;
      amount: number;
      shiftId?: number;
      description?: string;
      companyId: string;
      createdByUserId: number;
    }
  }): Promise<{ success: boolean; error?: string; updatedBudget?: NdisBudget; transaction?: BudgetTransaction }> {
    return await db.transaction(async (tx) => {
      try {
        // Step 1: Atomic budget update with fund validation
        const updateSql = sql`
          UPDATE ${ndisBudgets} 
          SET ${sql.raw(params.budgetField)} = ${sql.raw(params.budgetField)} - ${params.deductionAmount},
              updated_at = NOW()
          WHERE id = ${params.budgetId} 
            AND tenant_id = ${params.tenantId}
            AND ${sql.raw(params.budgetField)} >= ${params.deductionAmount}
          RETURNING *
        `;
        
        const updateResult = await tx.execute(updateSql);
        
        if (updateResult.rowCount === 0) {
          return { 
            success: false, 
            error: "Insufficient funds or budget not found" 
          };
        }

        // Step 2: Create transaction record
        const [transaction] = await tx.insert(budgetTransactions).values({
          budgetId: params.transactionData.budgetId,
          shiftId: params.transactionData.shiftId,
          companyId: params.transactionData.companyId,
          category: params.transactionData.category,
          shiftType: params.transactionData.shiftType,
          ratio: params.transactionData.ratio,
          hours: params.transactionData.hours.toString(),
          rate: params.transactionData.rate.toString(),
          amount: params.transactionData.amount.toString(),
          description: params.transactionData.description,
          transactionType: "deduction",
          createdByUserId: params.transactionData.createdByUserId,
        }).returning();

        // Step 3: Get updated budget
        const [updatedBudget] = await tx.select()
          .from(ndisBudgets)
          .where(and(
            eq(ndisBudgets.id, params.budgetId),
            eq(ndisBudgets.tenantId, params.tenantId)
          ));

        return {
          success: true,
          updatedBudget,
          transaction
        };

      } catch (error) {
        console.error("[ATOMIC BUDGET DEDUCTION] Transaction failed:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown database error"
        };
      }
    });
  }

  // Admin Timesheet Management Methods - CORRECTED VERSION  
  async getAdminTimesheets(tenantId: number, status: string | string[]): Promise<any[]> {
    const statusArray = Array.isArray(status) ? status : [status];
    
    try {
      console.log(`[ADMIN TIMESHEETS] CORRECTED - Starting query for tenant ${tenantId}, statuses: ${JSON.stringify(statusArray)}`);
      
      // FIXED QUERY: Use proper tenant filtering with users table constraint
      const result = await db.select({
        id: timesheets.id,
        userId: timesheets.userId,
        staffName: users.fullName,
        staffUsername: users.username,
        staffEmail: users.email,
        payPeriodStart: timesheets.payPeriodStart,
        payPeriodEnd: timesheets.payPeriodEnd,
        status: timesheets.status,
        totalHours: timesheets.totalHours,
        totalEarnings: timesheets.totalEarnings,
        totalTax: timesheets.totalTax,
        totalSuper: timesheets.totalSuper,
        netPay: timesheets.netPay,
        submittedAt: timesheets.submittedAt,
        approvedAt: timesheets.approvedAt,
        createdAt: timesheets.createdAt,
        annualLeave: leaveBalances.annualLeave,
        sickLeave: leaveBalances.sickLeave,
        personalLeave: leaveBalances.personalLeave,
        longServiceLeave: leaveBalances.longServiceLeave
      })
      .from(timesheets)
      .innerJoin(users, and(
        eq(timesheets.userId, users.id),
        eq(users.tenantId, tenantId) // CRITICAL FIX: Use users.tenantId for filtering
      ))
      .leftJoin(leaveBalances, and(
        eq(users.id, leaveBalances.userId),
        eq(users.tenantId, leaveBalances.tenantId)
      ))
      .where(and(
        eq(timesheets.tenantId, tenantId), // Keep this for double-safety
        or(...statusArray.map(s => eq(timesheets.status, s as any)))
      ))
      .orderBy(desc(timesheets.createdAt));

      console.log(`[ADMIN TIMESHEETS] CORRECTED - Query successful, found ${result.length} timesheets`);
      console.log(`[ADMIN TIMESHEETS] CORRECTED - Results:`, result.map(t => ({
        id: t.id,
        userId: t.userId,
        status: t.status,
        staffName: t.staffName
      })));

      return result;
    } catch (error) {
      console.error("[ADMIN TIMESHEETS] CORRECTED - Query error:", error);
      return [];
    }
  }

  async approveTimesheet(timesheetId: number, adminUserId: number, tenantId: number): Promise<any> {
    const [updated] = await db.update(timesheets)
      .set({
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: adminUserId,
        updatedAt: new Date()
      })
      .where(and(
        eq(timesheets.id, timesheetId),
        eq(timesheets.tenantId, tenantId)
      ))
      .returning();
    
    return updated;
  }

  async rejectTimesheet(timesheetId: number, adminUserId: number, tenantId: number, reason?: string): Promise<any> {
    const [updated] = await db.update(timesheets)
      .set({
        status: 'rejected',
        updatedAt: new Date()
      })
      .where(and(
        eq(timesheets.id, timesheetId),
        eq(timesheets.tenantId, tenantId)
      ))
      .returning();
    
    return updated;
  }

  async getTimesheetById(timesheetId: number, tenantId: number): Promise<any> {
    const query = sql`
      SELECT 
        t.id,
        t.user_id as "userId",
        t.tenant_id as "tenantId",
        t.pay_period_start as "payPeriodStart",
        t.pay_period_end as "payPeriodEnd",
        t.status,
        t.total_hours as "totalHours",
        t.total_earnings as "totalEarnings",
        t.total_tax as "totalTax",
        t.total_super as "totalSuper",
        t.net_pay as "netPay",
        t.submitted_at as "submittedAt",
        t.approved_at as "approvedAt",
        t.approved_by as "approvedBy",
        t.paid_at as "paidAt",
        t.paid_by as "paidBy",
        t.created_at as "createdAt",
        t.updated_at as "updatedAt",
        u.full_name as "staffName",
        u.username as "staffUsername",
        u.email as "staffEmail"
      FROM timesheets t
      INNER JOIN users u ON t.user_id = u.id AND t.tenant_id = u.tenant_id
      WHERE t.id = ${timesheetId} AND t.tenant_id = ${tenantId}
    `;
    
    const result = await db.execute(query);
    return result.rows[0] as any;
  }

  async getTimesheetEntries(timesheetId: number, tenantId: number): Promise<any[]> {
    try {
      // First verify timesheet belongs to the tenant
      const timesheet = await db.select()
        .from(timesheets)
        .where(and(
          eq(timesheets.id, timesheetId),
          eq(timesheets.tenantId, tenantId)
        ))
        .limit(1);
      
      if (!timesheet.length) {
        console.log(`Timesheet ${timesheetId} not found for tenant ${tenantId}`);
        return [];
      }

      // Get timesheet entries with shift and client details
      const entries = await db.select({
        id: timesheetEntries.id,
        timesheetId: timesheetEntries.timesheetId,
        shiftId: timesheetEntries.shiftId,
        entryDate: timesheetEntries.entryDate,
        startTime: timesheetEntries.startTime,
        endTime: timesheetEntries.endTime,
        breakMinutes: timesheetEntries.breakMinutes,
        totalHours: timesheetEntries.totalHours,
        hourlyRate: timesheetEntries.hourlyRate,
        grossPay: timesheetEntries.grossPay,
        notes: timesheetEntries.notes,
        isAutoGenerated: timesheetEntries.isAutoGenerated,
        createdAt: timesheetEntries.createdAt,
        // Get shift details
        shiftTitle: shifts.title,
        clientName: clients.fullName
      })
      .from(timesheetEntries)
      .leftJoin(shifts, eq(timesheetEntries.shiftId, shifts.id))
      .leftJoin(clients, eq(shifts.clientId, clients.id))
      .where(eq(timesheetEntries.timesheetId, timesheetId))
      .orderBy(desc(timesheetEntries.entryDate));

      return entries;
    } catch (error) {
      console.error("Get timesheet entries error:", error);
      return [];
    }
  }



  async markTimesheetAsPaid(timesheetId: number, adminUserId: number, tenantId: number): Promise<any> {
    const [updated] = await db.update(timesheets)
      .set({
        status: 'paid',
        paidAt: new Date(),
        paidBy: adminUserId,
        updatedAt: new Date()
      })
      .where(and(
        eq(timesheets.id, timesheetId),
        eq(timesheets.tenantId, tenantId)
      ))
      .returning();
    
    return updated;
  }

  async getTimesheetEntryById(entryId: number, tenantId: number): Promise<any> {
    const result = await db
      .select()
      .from(timesheetEntries)
      .where(and(
        eq(timesheetEntries.id, entryId),
        exists(
          db.select({ id: timesheets.id })
            .from(timesheets)
            .where(and(
              eq(timesheets.id, timesheetEntries.timesheetId),
              eq(timesheets.tenantId, tenantId)
            ))
        )
      ))
      .limit(1);
    
    return result[0];
  }

  // Tax Brackets
  async getTaxBrackets(taxYear: number): Promise<any[]> {
    const result = await db
      .select()
      .from(taxBrackets)
      .where(eq(taxBrackets.taxYear, taxYear))
      .orderBy(taxBrackets.minIncome);
    
    return result;
  }

  async createTaxBracket(bracket: any): Promise<any> {
    const [created] = await db.insert(taxBrackets).values(bracket).returning();
    return created;
  }

  // Compliance Centre methods

  // Downloadable Forms - Global forms library accessible to all tenants
  async getDownloadableForms(): Promise<DownloadableForm[]> {
    return await db.select().from(downloadableForms)
      .orderBy(desc(downloadableForms.uploadedAt));
  }

  async getDownloadableForm(id: number): Promise<DownloadableForm | undefined> {
    const [form] = await db.select().from(downloadableForms)
      .where(eq(downloadableForms.id, id));
    return form || undefined;
  }

  async createDownloadableForm(form: InsertDownloadableForm): Promise<DownloadableForm> {
    const [created] = await db
      .insert(downloadableForms)
      .values(form)
      .returning();
    return created;
  }

  async updateDownloadableForm(id: number, form: Partial<InsertDownloadableForm>): Promise<DownloadableForm | undefined> {
    const [updated] = await db
      .update(downloadableForms)
      .set(form)
      .where(eq(downloadableForms.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteDownloadableForm(id: number): Promise<boolean> {
    const result = await db
      .delete(downloadableForms)
      .where(eq(downloadableForms.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Completed Medication Forms
  async getCompletedMedicationForms(tenantId: number): Promise<CompletedMedicationAuthorityForm[]> {
    return await db.select({
      id: completedMedicationAuthorityForms.id,
      tenantId: completedMedicationAuthorityForms.tenantId,
      clientId: completedMedicationAuthorityForms.clientId,
      fileName: completedMedicationAuthorityForms.fileName,
      fileUrl: completedMedicationAuthorityForms.fileUrl,
      uploadedBy: completedMedicationAuthorityForms.uploadedBy,
      uploadedAt: completedMedicationAuthorityForms.uploadedAt,
      clientName: clients.fullName,
      uploaderName: users.fullName,
    })
    .from(completedMedicationAuthorityForms)
    .leftJoin(clients, eq(completedMedicationAuthorityForms.clientId, clients.id))
    .leftJoin(users, eq(completedMedicationAuthorityForms.uploadedBy, users.id))
    .where(eq(completedMedicationAuthorityForms.tenantId, tenantId))
    .orderBy(desc(completedMedicationAuthorityForms.uploadedAt));
  }

  async getCompletedMedicationFormsByClient(clientId: number, tenantId: number): Promise<CompletedMedicationAuthorityForm[]> {
    return await db.select().from(completedMedicationAuthorityForms)
      .where(and(
        eq(completedMedicationAuthorityForms.clientId, clientId),
        eq(completedMedicationAuthorityForms.tenantId, tenantId)
      ))
      .orderBy(desc(completedMedicationAuthorityForms.uploadedAt));
  }

  async createCompletedMedicationForm(form: InsertCompletedMedicationAuthorityForm): Promise<CompletedMedicationAuthorityForm> {
    const [created] = await db
      .insert(completedMedicationAuthorityForms)
      .values(form)
      .returning();
    return created;
  }

  async deleteCompletedMedicationForm(id: number, tenantId: number): Promise<boolean> {
    const result = await db
      .delete(completedMedicationAuthorityForms)
      .where(and(eq(completedMedicationAuthorityForms.id, id), eq(completedMedicationAuthorityForms.tenantId, tenantId)));
    return (result.rowCount || 0) > 0;
  }

  // Evacuation Drills
  async getEvacuationDrills(tenantId: number): Promise<EvacuationDrill[]> {
    return await db.select({
      id: evacuationDrills.id,
      tenantId: evacuationDrills.tenantId,
      siteName: evacuationDrills.siteName,
      drillDate: evacuationDrills.drillDate,
      participants: evacuationDrills.participants,
      issuesFound: evacuationDrills.issuesFound,
      signedBy: evacuationDrills.signedBy,
      createdBy: evacuationDrills.createdBy,
      createdAt: evacuationDrills.createdAt,
      creatorName: users.fullName,
    })
    .from(evacuationDrills)
    .leftJoin(users, eq(evacuationDrills.createdBy, users.id))
    .where(eq(evacuationDrills.tenantId, tenantId))
    .orderBy(desc(evacuationDrills.drillDate));
  }

  async getEvacuationDrill(id: number, tenantId: number): Promise<EvacuationDrill | undefined> {
    const [drill] = await db.select().from(evacuationDrills)
      .where(and(eq(evacuationDrills.id, id), eq(evacuationDrills.tenantId, tenantId)));
    return drill || undefined;
  }

  async createEvacuationDrill(drill: InsertEvacuationDrill): Promise<EvacuationDrill> {
    const [created] = await db
      .insert(evacuationDrills)
      .values(drill)
      .returning();
    return created;
  }

  async updateEvacuationDrill(id: number, drill: Partial<InsertEvacuationDrill>, tenantId: number): Promise<EvacuationDrill | undefined> {
    const [updated] = await db
      .update(evacuationDrills)
      .set(drill)
      .where(and(eq(evacuationDrills.id, id), eq(evacuationDrills.tenantId, tenantId)))
      .returning();
    return updated || undefined;
  }

  async deleteEvacuationDrill(id: number, tenantId: number): Promise<boolean> {
    const result = await db
      .delete(evacuationDrills)
      .where(and(eq(evacuationDrills.id, id), eq(evacuationDrills.tenantId, tenantId)));
    return (result.rowCount || 0) > 0;
  }

  // Medication Schedules
  async getMedicationSchedules(tenantId: number, date?: string): Promise<any[]> {
    const query = db.select({
      id: medicationSchedules.id,
      planId: medicationSchedules.planId,
      clientId: medicationSchedules.clientId,
      timeSlot: medicationSchedules.timeSlot,
      scheduledDate: medicationSchedules.scheduledDate,
      medicationName: medicationSchedules.medicationName,
      dosage: medicationSchedules.dosage,
      route: medicationSchedules.route,
      status: medicationSchedules.status,
      administeredBy: medicationSchedules.administeredBy,
      administeredAt: medicationSchedules.administeredAt,
      notes: medicationSchedules.notes,
      tenantId: medicationSchedules.tenantId,
      createdAt: medicationSchedules.createdAt,
      updatedAt: medicationSchedules.updatedAt,
      clientName: clients.fullName,
      administeringStaff: users.fullName,
    })
    .from(medicationSchedules)
    .leftJoin(clients, eq(medicationSchedules.clientId, clients.id))
    .leftJoin(users, eq(medicationSchedules.administeredBy, users.id))
    .where(eq(medicationSchedules.tenantId, tenantId));

    if (date) {
      // Get schedules for the week containing the date
      const targetDate = new Date(date);
      const startOfWeek = new Date(targetDate);
      startOfWeek.setDate(targetDate.getDate() - targetDate.getDay() + 1); // Monday
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday

      return db.select({
        id: medicationSchedules.id,
        planId: medicationSchedules.planId,
        clientId: medicationSchedules.clientId,
        timeSlot: medicationSchedules.timeSlot,
        scheduledDate: medicationSchedules.scheduledDate,
        medicationName: medicationSchedules.medicationName,
        dosage: medicationSchedules.dosage,
        route: medicationSchedules.route,
        status: medicationSchedules.status,
        administeredBy: medicationSchedules.administeredBy,
        administeredAt: medicationSchedules.administeredAt,
        notes: medicationSchedules.notes,
        tenantId: medicationSchedules.tenantId,
        createdAt: medicationSchedules.createdAt,
        updatedAt: medicationSchedules.updatedAt,
        clientName: clients.fullName,
        administeringStaff: users.fullName,
      })
      .from(medicationSchedules)
      .leftJoin(clients, eq(medicationSchedules.clientId, clients.id))
      .leftJoin(users, eq(medicationSchedules.administeredBy, users.id))
      .where(and(
        eq(medicationSchedules.tenantId, tenantId),
        gte(medicationSchedules.scheduledDate, startOfWeek),
        lte(medicationSchedules.scheduledDate, endOfWeek)
      ))
      .orderBy(medicationSchedules.scheduledDate, medicationSchedules.timeSlot);
    }

    return query.orderBy(medicationSchedules.scheduledDate, medicationSchedules.timeSlot);
  }

  async createMedicationSchedule(schedule: any): Promise<any> {
    const [created] = await db
      .insert(medicationSchedules)
      .values({
        planId: schedule.planId,
        clientId: schedule.clientId,
        timeSlot: schedule.timeSlot,
        scheduledDate: new Date(schedule.scheduledDate),
        medicationName: schedule.medicationName,
        dosage: schedule.dosage,
        route: schedule.route,
        status: schedule.status || 'scheduled',
        tenantId: schedule.tenantId,
      })
      .returning();
    return created;
  }

  async updateMedicationSchedule(id: number, updates: any, tenantId: number): Promise<any> {
    const updateData: any = {};
    
    if (updates.status) updateData.status = updates.status;
    if (updates.administeredBy) updateData.administeredBy = updates.administeredBy;
    if (updates.administeredAt) updateData.administeredAt = new Date(updates.administeredAt);
    if (updates.notes) updateData.notes = updates.notes;
    
    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(medicationSchedules)
      .set(updateData)
      .where(and(
        eq(medicationSchedules.id, id),
        eq(medicationSchedules.tenantId, tenantId)
      ))
      .returning();
    return updated;
  }

  async deleteMedicationSchedule(id: number, tenantId: number): Promise<boolean> {
    const result = await db
      .delete(medicationSchedules)
      .where(and(
        eq(medicationSchedules.id, id),
        eq(medicationSchedules.tenantId, tenantId)
      ));
    return (result.rowCount || 0) > 0;
  }

  // Shift-based data access methods for SupportWorkers
  async getAssignedClientIds(userId: number, tenantId: number): Promise<number[]> {
    const assignedShifts = await db.select({
      clientId: shifts.clientId
    })
    .from(shifts)
    .where(and(
      eq(shifts.userId, userId),
      eq(shifts.tenantId, tenantId),
      // Only current and future shifts
      gte(shifts.startTime, new Date(new Date().setHours(0, 0, 0, 0)))
    ))
    .groupBy(shifts.clientId);

    return assignedShifts.map(shift => shift.clientId).filter(id => id !== null) as number[];
  }

  async getClientsForSupportWorker(userId: number, tenantId: number): Promise<Client[]> {
    const assignedClientIds = await this.getAssignedClientIds(userId, tenantId);
    
    if (assignedClientIds.length === 0) {
      return [];
    }

    return db.select()
      .from(clients)
      .where(and(
        eq(clients.tenantId, tenantId),
        inArray(clients.id, assignedClientIds)
      ));
  }

  async getCaseNotesForSupportWorker(userId: number, tenantId: number): Promise<any[]> {
    const assignedClientIds = await this.getAssignedClientIds(userId, tenantId);
    
    if (assignedClientIds.length === 0) {
      return [];
    }

    return db.select({
      id: caseNotes.id,
      title: caseNotes.title,
      content: caseNotes.content,
      type: caseNotes.type,
      clientId: caseNotes.clientId,
      shiftId: caseNotes.linkedShiftId,
      userId: caseNotes.userId,
      createdAt: caseNotes.createdAt,
      clientName: clients.fullName,
      authorName: users.fullName,
    })
    .from(caseNotes)
    .leftJoin(clients, eq(caseNotes.clientId, clients.id))
    .leftJoin(users, eq(caseNotes.userId, users.id))
    .where(and(
      eq(caseNotes.tenantId, tenantId),
      inArray(caseNotes.clientId, assignedClientIds)
    ))
    .orderBy(desc(caseNotes.createdAt));
  }

  async getIncidentReportsForSupportWorker(userId: number, tenantId: number): Promise<any[]> {
    const assignedClientIds = await this.getAssignedClientIds(userId, tenantId);
    
    if (assignedClientIds.length === 0) {
      return [];
    }

    return db.select({
      id: incidentReports.id,
      incidentId: incidentReports.incidentId,
      description: incidentReports.description,
      clientId: incidentReports.clientId,
      userId: incidentReports.staffId,
      dateTime: incidentReports.dateTime,
      types: incidentReports.types,
      status: incidentReports.status,
      clientName: clients.fullName,
      reporterName: users.fullName,
    })
    .from(incidentReports)
    .leftJoin(clients, eq(incidentReports.clientId, clients.id))
    .leftJoin(users, eq(incidentReports.staffId, users.id))
    .where(and(
      eq(incidentReports.tenantId, tenantId),
      inArray(incidentReports.clientId, assignedClientIds)
    ))
    .orderBy(desc(incidentReports.dateTime));
  }

  async getMedicationPlansForSupportWorker(userId: number, tenantId: number): Promise<any[]> {
    const assignedClientIds = await this.getAssignedClientIds(userId, tenantId);
    
    if (assignedClientIds.length === 0) {
      return [];
    }

    return db.select({
      id: medicationPlans.id,
      clientId: medicationPlans.clientId,
      medicationName: medicationPlans.medicationName,
      dosage: medicationPlans.dosage,
      route: medicationPlans.route,
      frequency: medicationPlans.frequency,
      timeOfDay: medicationPlans.timeOfDay,
      startDate: medicationPlans.startDate,
      endDate: medicationPlans.endDate,
      status: medicationPlans.status,
      clientName: clients.fullName,
    })
    .from(medicationPlans)
    .leftJoin(clients, eq(medicationPlans.clientId, clients.id))
    .where(and(
      eq(medicationPlans.tenantId, tenantId),
      inArray(medicationPlans.clientId, assignedClientIds)
    ));
  }

  // Billing Configuration Methods
  async getBillingConfiguration(): Promise<any> {
    const [config] = await db.select().from(billingConfiguration).limit(1);
    
    if (!config) {
      // Create default configuration if none exists
      const defaultConfig = {
        rates: {
          'SupportWorker': 45.00,
          'TeamLeader': 65.00,
          'Coordinator': 85.00,
          'Admin': 95.00,
          'ConsoleManager': 150.00,
          'Unknown': 45.00
        },
        cycleDays: 28,
        nextBillingDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
        isActive: true
      };
      
      const [created] = await db.insert(billingConfiguration).values(defaultConfig).returning();
      return created;
    }
    
    return config;
  }

  async updateBillingConfiguration(configData: any): Promise<any> {
    const existingConfig = await this.getBillingConfiguration();
    
    const updateData = {
      ...configData,
      updatedAt: new Date()
    };
    
    // Convert nextBillingDate string to Date object if it exists
    if (updateData.nextBillingDate && typeof updateData.nextBillingDate === 'string') {
      updateData.nextBillingDate = new Date(updateData.nextBillingDate);
    }
    
    const [updated] = await db
      .update(billingConfiguration)
      .set(updateData)
      .where(eq(billingConfiguration.id, existingConfig.id))
      .returning();
    
    return updated;
  }

  async getAllStaffTypes(): Promise<string[]> {
    const result = await db
      .selectDistinct({ role: users.role })
      .from(users)
      .where(eq(users.isActive, true));
    
    return result.map(r => r.role).filter(Boolean);
  }

  async getStaffStatistics(): Promise<any[]> {
    const result = await db
      .select({
        tenantId: users.tenantId,
        role: users.role,
        count: count(users.id)
      })
      .from(users)
      .where(eq(users.isActive, true))
      .groupBy(users.tenantId, users.role)
      .orderBy(users.tenantId, users.role);
    
    return result;
  }

  // NDIS Service Agreements
  async getServiceAgreements(companyId: string, clientId?: number): Promise<ServiceAgreement[]> {
    const query = db.select().from(serviceAgreements)
      .where(eq(serviceAgreements.companyId, companyId));

    if (clientId) {
      return await query.where(and(
        eq(serviceAgreements.companyId, companyId),
        eq(serviceAgreements.clientId, clientId)
      )).orderBy(desc(serviceAgreements.createdAt));
    }

    return await query.orderBy(desc(serviceAgreements.createdAt));
  }

  async getServiceAgreement(id: string, companyId: string): Promise<ServiceAgreement | undefined> {
    const [agreement] = await db.select().from(serviceAgreements)
      .where(and(
        eq(serviceAgreements.id, id),
        eq(serviceAgreements.companyId, companyId)
      ));
    return agreement || undefined;
  }

  async createServiceAgreement(agreement: InsertServiceAgreement): Promise<ServiceAgreement> {
    // Generate unique agreement number for this company
    const agreementNumber = `SA-${Date.now().toString().slice(-8)}`;
    
    const [created] = await db
      .insert(serviceAgreements)
      .values({
        ...agreement,
        agreementNumber,
        id: randomUUID()
      })
      .returning();
    return created;
  }

  async updateServiceAgreement(id: string, agreement: Partial<InsertServiceAgreement>, companyId: string): Promise<ServiceAgreement | undefined> {
    const [updated] = await db
      .update(serviceAgreements)
      .set({ ...agreement, updatedAt: new Date() })
      .where(and(
        eq(serviceAgreements.id, id),
        eq(serviceAgreements.companyId, companyId)
      ))
      .returning();
    return updated || undefined;
  }

  async deleteServiceAgreement(id: string, companyId: string): Promise<boolean> {
    const result = await db
      .delete(serviceAgreements)
      .where(and(
        eq(serviceAgreements.id, id),
        eq(serviceAgreements.companyId, companyId)
      ));
    return (result.rowCount || 0) > 0;
  }

  // Service Agreement Items
  async getServiceAgreementItems(agreementId: string): Promise<ServiceAgreementItem[]> {
    return await db.select().from(serviceAgreementItems)
      .where(eq(serviceAgreementItems.agreementId, agreementId))
      .orderBy(serviceAgreementItems.createdAt);
  }

  async createServiceAgreementItem(item: InsertServiceAgreementItem): Promise<ServiceAgreementItem> {
    const [created] = await db
      .insert(serviceAgreementItems)
      .values({
        ...item,
        id: randomUUID()
      })
      .returning();
    return created;
  }

  async updateServiceAgreementItem(id: string, item: Partial<InsertServiceAgreementItem>): Promise<ServiceAgreementItem | undefined> {
    const [updated] = await db
      .update(serviceAgreementItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(serviceAgreementItems.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteServiceAgreementItem(id: string): Promise<boolean> {
    const result = await db
      .delete(serviceAgreementItems)
      .where(eq(serviceAgreementItems.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Service Agreement Signatures
  async getServiceAgreementSignatures(agreementId: string): Promise<ServiceAgreementSignature[]> {
    return await db.select().from(serviceAgreementSignatures)
      .where(eq(serviceAgreementSignatures.agreementId, agreementId))
      .orderBy(serviceAgreementSignatures.signedAt);
  }

  async createServiceAgreementSignature(signature: InsertServiceAgreementSignature): Promise<ServiceAgreementSignature> {
    const [created] = await db
      .insert(serviceAgreementSignatures)
      .values({
        ...signature,
        id: randomUUID()
      })
      .returning();
    return created;
  }

  // Tenant Terms Templates
  async getTenantTermsTemplates(companyId: string): Promise<TenantTermsTemplate[]> {
    return await db.select().from(tenantTermsTemplates)
      .where(eq(tenantTermsTemplates.companyId, companyId))
      .orderBy(desc(tenantTermsTemplates.createdAt));
  }

  async getDefaultTermsTemplate(companyId: string): Promise<TenantTermsTemplate | undefined> {
    const [template] = await db.select().from(tenantTermsTemplates)
      .where(and(
        eq(tenantTermsTemplates.companyId, companyId),
        eq(tenantTermsTemplates.isDefault, true)
      ));
    return template || undefined;
  }

  async createTenantTermsTemplate(template: InsertTenantTermsTemplate): Promise<TenantTermsTemplate> {
    const [created] = await db
      .insert(tenantTermsTemplates)
      .values({
        ...template,
        id: randomUUID()
      })
      .returning();
    return created;
  }

  async updateTenantTermsTemplate(id: string, template: Partial<InsertTenantTermsTemplate>, companyId: string): Promise<TenantTermsTemplate | undefined> {
    const [updated] = await db
      .update(tenantTermsTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(and(
        eq(tenantTermsTemplates.id, id),
        eq(tenantTermsTemplates.companyId, companyId)
      ))
      .returning();
    return updated || undefined;
  }
}

export const storage = new DatabaseStorage();
