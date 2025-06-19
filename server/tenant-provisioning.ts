import { storage } from "./storage";

/**
 * Automatic Tenant Provisioning System
 * Ensures all tenants have consistent access to comprehensive features
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
export async function provisionTenant(tenantId: number, companyId: string): Promise<void> {
  console.log(`[TENANT PROVISIONING] Starting provisioning for tenant ${tenantId}`);

  try {
    // 1. Create sample clients
    await provisionSampleClients(tenantId, companyId);
    
    // 2. Create NDIS budgets for clients
    await provisionNdisBudgets(tenantId);
    
    // 3. Create sample shifts
    await provisionSampleShifts(tenantId);
    
    // 4. Create sample care support plans
    await provisionCarePlans(tenantId);
    
    console.log(`[TENANT PROVISIONING] Successfully provisioned tenant ${tenantId}`);
  } catch (error) {
    console.error(`[TENANT PROVISIONING] Error provisioning tenant ${tenantId}:`, error);
    throw error;
  }
}

/**
 * Creates sample clients for the tenant
 */
async function provisionSampleClients(tenantId: number, companyId: string): Promise<void> {
  for (const template of SAMPLE_CLIENT_TEMPLATES) {
    const clientData = {
      ...template,
      clientId: `${template.clientId}_T${tenantId}`, // Make unique per tenant
      ndisNumber: `${template.ndisNumber}_T${tenantId}`,
      tenantId,
      companyId,
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
 * Automatically provisions all existing tenants that don't have comprehensive data
 */
export async function provisionAllExistingTenants(): Promise<void> {
  console.log(`[TENANT PROVISIONING] Starting automatic provisioning for all existing tenants`);
  
  try {
    // Get all existing tenants
    const tenants = await storage.getAllTenants();
    
    for (const tenant of tenants) {
      const clientCount = await storage.getClientCountByTenant(tenant.id);
      
      // Only provision if tenant has fewer than 3 clients (indicating incomplete setup)
      if (clientCount < 3) {
        console.log(`[TENANT PROVISIONING] Tenant ${tenant.id} needs provisioning (${clientCount} clients)`);
        await provisionTenant(tenant.id, tenant.companyId || `company-${tenant.id}`);
      } else {
        console.log(`[TENANT PROVISIONING] Tenant ${tenant.id} already has comprehensive data (${clientCount} clients)`);
      }
    }
    
    console.log(`[TENANT PROVISIONING] Completed automatic provisioning for all existing tenants`);
  } catch (error) {
    console.error(`[TENANT PROVISIONING] Error in automatic provisioning:`, error);
    throw error;
  }
}