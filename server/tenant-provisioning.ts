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

// Demo data creation completely removed - all tenants start with clean slate

/**
 * Provisions comprehensive features for a new tenant
 */
export async function provisionTenant(tenantId: number, companyId: string, adminUserId?: number): Promise<void> {
  console.log(`[TENANT PROVISIONING] DISABLED - No demo data will be created for tenant ${tenantId}`);
  console.log(`[TENANT PROVISIONING] All new tenants start with completely clean slate - no sample clients, shifts, or other demo data`);
  return;
}

// Sample client creation removed - tenants start completely clean

// NDIS budget creation removed - budgets created only when users add clients

// Sample shift creation removed - tenants start completely clean

// Sample care plan creation removed - tenants start completely clean

// Sample medication plan creation removed - tenants start completely clean

// Sample observation creation removed - tenants start completely clean

// Sample case note creation removed - tenants start completely clean

// Sample custom role creation removed - tenants start completely clean

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
        
        // Demo data provisioning disabled - all tenants start clean
        console.log(`[TENANT PROVISIONING] Tenant ${tenant.id} starts with clean slate (no demo data auto-provisioning)`);
        // No automatic provisioning of demo data
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