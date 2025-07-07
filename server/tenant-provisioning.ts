import { storage } from "./storage";
import { provisionScHADSRates } from "./schads-provisioning";

/**
 * Automatic Tenant Provisioning System
 * Ensures all tenants have consistent access to comprehensive features
 * CRITICAL: All new features must be automatically provisioned to ALL tenants
 */

export interface TenantProvisioningData {
  tenantId: number;
  companyId: string;
  sampleClients: any[];
  sampleShifts: any[];
  ndisBudgets: any[];
  carePlans: any[];
}

// Template data for new tenant provisioning
const SAMPLE_CLIENT_TEMPLATES = [
  {
    clientId: 'CLT001',
    firstName: 'Sarah',
    lastName: 'Johnson',
    fullName: 'Sarah Johnson',
    ndisNumber: 'NDIS001001',
    dateOfBirth: '2000-05-15',
    address: '123 Main Street, Melbourne VIC 3000',
    emergencyContactName: 'Mary Johnson',
    emergencyContactPhone: '0412345678',
    ndisGoals: 'Develop independent living skills and community participation',
    likesPreferences: 'Music, art therapy, outdoor activities',
    dislikesAversions: 'Loud noises, crowded spaces',
    allergiesMedicalAlerts: 'No known allergies',
    primaryDiagnosis: 'Autism Spectrum Disorder'
  },
  {
    clientId: 'CLT002',
    firstName: 'Michael',
    lastName: 'Chen',
    fullName: 'Michael Chen',
    ndisNumber: 'NDIS001002',
    dateOfBirth: '1995-08-22',
    address: '456 Oak Avenue, Melbourne VIC 3001',
    emergencyContactName: 'Linda Chen',
    emergencyContactPhone: '0423456789',
    ndisGoals: 'Improve mobility and social engagement',
    likesPreferences: 'Technology, reading, gentle exercise',
    dislikesAversions: 'Spicy foods, sudden movements',
    allergiesMedicalAlerts: 'Penicillin allergy',
    primaryDiagnosis: 'Cerebral Palsy'
  },
  {
    clientId: 'CLT003',
    firstName: 'Emma',
    lastName: 'Williams',
    fullName: 'Emma Williams',
    ndisNumber: 'NDIS001003',
    dateOfBirth: '1988-12-03',
    address: '789 Pine Road, Melbourne VIC 3002',
    emergencyContactName: 'David Williams',
    emergencyContactPhone: '0434567890',
    ndisGoals: 'Build communication skills and job readiness',
    likesPreferences: 'Sports, video games, group activities',
    dislikesAversions: 'Complex instructions, time pressure',
    allergiesMedicalAlerts: 'Shellfish allergy',
    primaryDiagnosis: 'Intellectual Disability'
  }
];

/**
 * Provisions comprehensive features for a new tenant
 */
export async function provisionTenant(tenantId: number, companyId: string, adminUserId?: number): Promise<void> {
  console.log(`[TENANT PROVISIONING] Starting provisioning for tenant ${tenantId}`);
  const createdByUserId = adminUserId || 1; // Default to 1 for backward compatibility

  try {
    // Check if tenant already has clients (avoid duplicate provisioning)
    const existingClients = await storage.getClientsByTenant(tenantId);
    if (existingClients.length > 0) {
      console.log(`[TENANT PROVISIONING] Tenant ${tenantId} already has ${existingClients.length} clients, skipping demo data provisioning`);
      return;
    }

    // 1. Create sample clients
    await provisionSampleClients(tenantId, companyId, createdByUserId);
    
    // 2. Create NDIS budgets for clients
    await provisionNdisBudgets(tenantId);
    
    // 3. Create sample shifts
    await provisionSampleShifts(tenantId);
    
    // 4. Create sample care support plans
    await provisionCarePlans(tenantId);
    
    // 5. Create standardized medication plans
    await provisionMedicationPlans(tenantId, createdByUserId);
    
    // 6. Create standardized hourly observations
    await provisionHourlyObservations(tenantId);
    
    // 7. Create standardized case notes
    await provisionCaseNotes(tenantId);
    
    // 8. Create standardized custom roles
    await provisionCustomRoles(tenantId);
    
    // 9. Provision ScHADS award wage rates
    await provisionPayScales(tenantId);
    
    console.log(`[TENANT PROVISIONING] Successfully provisioned tenant ${tenantId}`);
  } catch (error) {
    console.error(`[TENANT PROVISIONING] Error provisioning tenant ${tenantId}:`, error);
    throw error;
  }
}

/**
 * Creates sample clients for the tenant
 */
async function provisionSampleClients(tenantId: number, companyId: string, createdByUserId: number = 1): Promise<void> {
  for (const template of SAMPLE_CLIENT_TEMPLATES) {
    const clientData = {
      ...template,
      clientId: `${template.clientId}_T${tenantId}`, // Make unique per tenant
      ndisNumber: `${template.ndisNumber}_T${tenantId}`,
      dateOfBirth: new Date(template.dateOfBirth),
      tenantId,
      companyId,
      createdBy: createdByUserId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await storage.createClient(clientData);
  }
  
  console.log(`[TENANT PROVISIONING] Created ${SAMPLE_CLIENT_TEMPLATES.length} sample clients for tenant ${tenantId}`);
}

/**
 * Creates NDIS budgets for the tenant's clients
 */
async function provisionNdisBudgets(tenantId: number): Promise<void> {
  const clients = await storage.getClientsByTenant(tenantId);
  
  for (const client of clients) {
    const budgetData = {
      clientId: client.id,
      tenantId,
      silTotal: "50000.00",
      silRemaining: "50000.00",
      silAllowedRatios: ["1:1", "1:2", "1:3"],
      communityAccessTotal: "25000.00",
      communityAccessRemaining: "25000.00",
      communityAccessAllowedRatios: ["1:1", "1:2", "1:3", "1:4"],
      capacityBuildingTotal: "15000.00",
      capacityBuildingRemaining: "15000.00",
      capacityBuildingAllowedRatios: ["1:1", "1:2"],
      priceOverrides: {
        AM: 40,
        PM: 60,
        ActiveNight: 80,
        Sleepover: 100
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await storage.createNdisBudget(budgetData);
  }
  
  console.log(`[TENANT PROVISIONING] Created NDIS budgets for ${clients.length} clients in tenant ${tenantId}`);
}

/**
 * Creates sample shifts for the tenant
 */
async function provisionSampleShifts(tenantId: number): Promise<void> {
  const clients = await storage.getClientsByTenant(tenantId);
  const users = await storage.getUsersByTenant(tenantId);
  
  const today = new Date();
  const shifts = [];
  
  // Create shifts for the next 7 days
  for (let day = 0; day < 7; day++) {
    const shiftDate = new Date(today);
    shiftDate.setDate(today.getDate() + day);
    
    for (const client of clients.slice(0, 2)) { // Create shifts for first 2 clients
      const shiftData = {
        title: `${client.firstName} ${client.lastName} - Daily Support`,
        startTime: new Date(shiftDate.setHours(9, 0, 0, 0)),
        endTime: new Date(shiftDate.setHours(17, 0, 0, 0)),
        clientId: client.id,
        userId: users.find(u => u.role === 'SupportWorker')?.id || null,
        shiftType: 'AM' as const,
        status: 'assigned' as const,
        location: client.address,
        notes: 'Regular daily support services',
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      shifts.push(shiftData);
    }
  }
  
  for (const shift of shifts) {
    await storage.createShift(shift);
  }
  
  console.log(`[TENANT PROVISIONING] Created ${shifts.length} sample shifts for tenant ${tenantId}`);
}

/**
 * Creates sample care support plans for the tenant
 */
async function provisionCarePlans(tenantId: number): Promise<void> {
  const clients = await storage.getClientsByTenant(tenantId);
  const admin = await storage.getUsersByTenant(tenantId).then(users => 
    users.find(u => u.role.toLowerCase() === 'admin')
  );
  
  for (const client of clients.slice(0, 1)) { // Create plan for first client
    const planData = {
      clientId: client.id,
      planTitle: `Comprehensive Care Plan - ${client.firstName} ${client.lastName}`,
      status: 'active' as const,
      tenantId,
      createdByUserId: admin?.id || 1,
      planData: {
        clientLock: {
          clientId: client.id,
          clientName: client.fullName,
          ndisNumber: client.ndisNumber,
          dateOfBirth: client.dateOfBirth,
          primaryDiagnosis: client.primaryDiagnosis
        },
        aboutMe: {
          likes: client.likesPreferences,
          dislikes: client.dislikesAversions,
          medicalInfo: client.allergiesMedicalAlerts,
          goals: client.ndisGoals
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await storage.createCareSupportPlan(planData);
  }
  
  console.log(`[TENANT PROVISIONING] Created care support plan for tenant ${tenantId}`);
}

/**
 * Creates standardized medication plans for the tenant
 */
async function provisionMedicationPlans(tenantId: number, createdByUserId: number = 1): Promise<void> {
  const clients = await storage.getClientsByTenant(tenantId);
  
  for (const client of clients.slice(0, 3)) { // Create plans for first 3 clients
    const medicationData = {
      clientId: client.id,
      medicationName: client.firstName === 'Sarah' ? 'Vitamin D3' : 
                    client.firstName === 'Michael' ? 'Calcium Supplement' : 'Multivitamin',
      dosage: client.firstName === 'Sarah' ? '1000 IU' : 
              client.firstName === 'Michael' ? '600mg' : '1 tablet',
      route: 'Oral',
      frequency: 'Daily',
      timeOfDay: client.firstName === 'Sarah' ? 'Morning' : 
                 client.firstName === 'Michael' ? 'Evening' : 'Morning',
      startDate: new Date(),
      prescribedBy: 'Dr. Smith',
      instructions: 'Take with food',
      status: 'active',
      tenantId,
      createdBy: createdByUserId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await storage.createMedicationPlan(medicationData);
  }
  
  console.log(`[TENANT PROVISIONING] Created medication plans for tenant ${tenantId}`);
}

/**
 * Creates standardized hourly observations for the tenant
 */
async function provisionHourlyObservations(tenantId: number): Promise<void> {
  const clients = await storage.getClientsByTenant(tenantId);
  const users = await storage.getUsersByTenant(tenantId);
  const supportWorker = users.find(u => u.role === 'SupportWorker');
  
  for (const client of clients.slice(0, 3)) { // Create observations for first 3 clients
    const observationData = {
      clientId: client.id,
      userId: supportWorker?.id || 1,
      observationType: client.firstName === 'Sarah' ? 'ADL' : 
                      client.firstName === 'Michael' ? 'Behaviour' : 'ADL',
      subtype: client.firstName === 'Sarah' ? 'Personal Care' : 
               client.firstName === 'Michael' ? 'Social Interaction' : 'Daily Tasks',
      notes: client.firstName === 'Sarah' ? 'Good engagement with daily activities' :
             client.firstName === 'Michael' ? 'Positive social interaction observed' :
             'Assistance required with task completion',
      settingsRating: client.firstName === 'Sarah' ? 4 : client.firstName === 'Michael' ? 5 : 3,
      timeRating: client.firstName === 'Sarah' ? 4 : client.firstName === 'Michael' ? 5 : 3,
      antecedentsRating: client.firstName === 'Sarah' ? 4 : client.firstName === 'Michael' ? 5 : 3,
      responseRating: client.firstName === 'Sarah' ? 4 : client.firstName === 'Michael' ? 5 : 3,
      tenantId,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
    };
    
    await storage.createObservation(observationData);
  }
  
  console.log(`[TENANT PROVISIONING] Created hourly observations for tenant ${tenantId}`);
}

/**
 * Creates standardized case notes for the tenant
 */
async function provisionCaseNotes(tenantId: number): Promise<void> {
  const clients = await storage.getClientsByTenant(tenantId);
  const users = await storage.getUsersByTenant(tenantId);
  const supportWorker = users.find(u => u.role === 'SupportWorker');
  
  for (const client of clients.slice(0, 3)) { // Create notes for first 3 clients
    const caseNoteData = {
      clientId: client.id,
      userId: supportWorker?.id || 1,
      title: client.firstName === 'Sarah' ? 'Daily Routine Progress Update' :
             client.firstName === 'Michael' ? 'Community Access Session' : 
             'Daily Living Skills Development',
      content: client.firstName === 'Sarah' ? 'Client engaged well in morning routine. Demonstrated independence with personal care tasks. Positive mood throughout the session.' :
               client.firstName === 'Michael' ? 'Participated actively in community access activity. Good social interaction with peers. No concerns noted during support period.' :
               'Required moderate assistance with daily living tasks. Responded positively to verbal prompts. Progress noted in communication skills.',
      caseNoteTags: client.firstName === 'Sarah' ? '["daily_routine", "independence", "positive_progress"]' :
                    client.firstName === 'Michael' ? '["community_access", "social_skills", "peer_interaction"]' :
                    '["daily_living", "communication", "skill_development"]',
      tenantId,
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
    };
    
    await storage.createCaseNote(caseNoteData);
  }
  
  console.log(`[TENANT PROVISIONING] Created case notes for tenant ${tenantId}`);
}

/**
 * Creates standardized custom roles for the tenant
 */
async function provisionCustomRoles(tenantId: number): Promise<void> {
  const users = await storage.getUsersByTenant(tenantId);
  const admin = users.find(u => u.role.toLowerCase() === 'admin');
  
  const roleData = {
    name: 'Senior Support Worker',
    displayName: 'Senior Support Worker',
    description: 'Enhanced support worker role with additional responsibilities',
    basedOnRole: 'SupportWorker',
    isActive: true,
    tenantId,
    createdBy: admin?.id || 1,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  await storage.createCustomRole(roleData);
  console.log(`[TENANT PROVISIONING] Created custom role for tenant ${tenantId}`);
}

/**
 * Provisions ScHADS award wage rates for the tenant
 */
async function provisionPayScales(tenantId: number): Promise<void> {
  await provisionScHADSRates(tenantId);
  console.log(`[TENANT PROVISIONING] Created ScHADS pay scales for tenant ${tenantId}`);
}

/**
 * Automatically provisions all existing tenants that don't have comprehensive data
 */
export async function provisionAllExistingTenants(): Promise<void> {
  console.log(`[TENANT PROVISIONING] Starting automatic provisioning for all existing tenants`);
  
  try {
    // Test database connection first
    await storage.getAllTenants();
    
    // Get all existing tenants with retry logic
    const tenants = await withRetry(() => storage.getAllTenants(), 3);
    
    for (const tenant of tenants) {
      try {
        const clientCount = await withRetry(() => storage.getClientCountByTenant(tenant.id), 2);
        
        // Only provision if tenant has fewer than 3 clients (indicating incomplete setup)
        if (clientCount < 3) {
          console.log(`[TENANT PROVISIONING] Tenant ${tenant.id} needs provisioning (${clientCount} clients)`);
          await provisionTenant(tenant.id, tenant.companyId || `company-${tenant.id}`);
        } else {
          console.log(`[TENANT PROVISIONING] Tenant ${tenant.id} already has comprehensive data (${clientCount} clients)`);
        }
      } catch (tenantError) {
        console.error(`[TENANT PROVISIONING] Error provisioning tenant ${tenant.id}:`, tenantError);
        // Continue with other tenants
      }
    }
    
    console.log(`[TENANT PROVISIONING] Completed automatic provisioning for all existing tenants`);
  } catch (error) {
    console.error(`[TENANT PROVISIONING] Critical error in automatic provisioning:`, error);
    throw error;
  }
}

/**
 * Retry helper function for database operations
 */
async function withRetry<T>(operation: () => Promise<T>, maxRetries: number): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.log(`[RETRY] Attempt ${attempt}/${maxRetries} failed:`, error);
      
      if (attempt < maxRetries) {
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  
  throw lastError!;
}