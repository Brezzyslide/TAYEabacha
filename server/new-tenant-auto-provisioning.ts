/**
 * NEW TENANT AUTO-PROVISIONING SYSTEM
 * Ensures all new tenants automatically receive complete feature sets
 * CRITICAL: Integrates with user registration to prevent feature gaps
 */

import { storage } from './storage';
import { provisionTenant } from './tenant-provisioning';
import { provisionScHADSRates } from './schads-provisioning';

export interface NewTenantSetup {
  tenantId: number;
  companyId: string;
  adminUserId: number;
  features: string[];
}

/**
 * Automatically provisions new tenant with complete feature set
 * Called during company/tenant creation process
 */
export async function autoProvisionNewTenant(
  tenantId: number, 
  companyId: string, 
  adminUserId: number
): Promise<void> {
  console.log(`[NEW TENANT SETUP] Starting auto-provisioning for tenant ${tenantId}`);
  
  try {
    // 1. Core tenant provisioning (clients, shifts, budgets, care plans)
    console.log(`[NEW TENANT SETUP] Provisioning core features`);
    await provisionTenant(tenantId, companyId);
    
    // 2. ScHADS pay scales
    console.log(`[NEW TENANT SETUP] Setting up ScHADS pay scales`);
    await provisionScHADSRates(tenantId);
    
    // 3. NDIS pricing structure
    console.log(`[NEW TENANT SETUP] Creating NDIS pricing`);
    await createNdisPricingForTenant(tenantId);
    
    // 4. Tax brackets (system-wide, ensure exists)
    console.log(`[NEW TENANT SETUP] Ensuring tax brackets exist`);
    await ensureTaxBrackets();
    
    // 5. Hour allocations for all staff
    console.log(`[NEW TENANT SETUP] Creating hour allocations`);
    await createHourAllocationsForTenant(tenantId);
    
    // 6. Activity logging
    await storage.createActivityLog({
      tenantId,
      userId: adminUserId,
      type: 'tenant_provisioned',
      description: `New tenant ${tenantId} fully provisioned with all features`,
      metadata: { companyId, features: 'all' }
    });
    
    console.log(`[NEW TENANT SETUP] Successfully auto-provisioned tenant ${tenantId} with complete feature set`);
    
  } catch (error) {
    console.error(`[NEW TENANT SETUP] Failed to auto-provision tenant ${tenantId}:`, error);
    throw error;
  }
}

/**
 * Creates NDIS pricing structure for new tenant
 */
async function createNdisPricingForTenant(tenantId: number): Promise<void> {
  const standardPricing = [
    { category: 'SIL', subcategory: 'Standard', unitPrice: '65.00', description: 'Supported Independent Living' },
    { category: 'CapacityBuilding', subcategory: 'SocialSkills', unitPrice: '75.00', description: 'Social and community participation' },
    { category: 'CommunityAccess', subcategory: 'Transport', unitPrice: '55.00', description: 'Community access and transport' },
    { category: 'CommunityAccess', subcategory: 'Recreation', unitPrice: '60.00', description: 'Recreation and leisure activities' }
  ];
  
  for (const pricing of standardPricing) {
    await storage.createNdisPricing({
      tenantId,
      category: pricing.category,
      subcategory: pricing.subcategory,
      unitPrice: pricing.unitPrice,
      description: pricing.description
    });
  }
}

/**
 * Creates hour allocations for all staff in new tenant
 */
async function createHourAllocationsForTenant(tenantId: number): Promise<void> {
  const staff = await storage.getUsersByTenant(tenantId);
  
  // Create standard allocations for non-admin staff
  for (const user of staff) {
    if (user.role !== 'Admin' && user.role !== 'ConsoleManager') {
      const weeklyHours = user.role === 'SupportWorker' ? 35 : 
                         user.role === 'TeamLeader' ? 38 : 30;
      
      await storage.createHourAllocation({
        staffId: user.id,
        tenantId,
        allocatedHours: weeklyHours,
        period: 'weekly',
        startDate: new Date(),
        isActive: true
      });
    }
  }
}

/**
 * Ensures Australian tax brackets exist (system-wide)
 */
async function ensureTaxBrackets(): Promise<void> {
  try {
    const existingBrackets = await storage.getTaxBrackets();
    if (existingBrackets.length === 0) {
      const australianTaxBrackets = [
        { minIncome: 0, maxIncome: 18200, rate: 0, taxYear: '2024-25' },
        { minIncome: 18201, maxIncome: 45000, rate: 0.19, taxYear: '2024-25' },
        { minIncome: 45001, maxIncome: 120000, rate: 0.325, taxYear: '2024-25' },
        { minIncome: 120001, maxIncome: 180000, rate: 0.37, taxYear: '2024-25' },
        { minIncome: 180001, maxIncome: 999999999, rate: 0.45, taxYear: '2024-25' }
      ];
      
      for (const bracket of australianTaxBrackets) {
        await storage.createTaxBracket(bracket);
      }
    }
  } catch (error) {
    console.error('[NEW TENANT SETUP] Failed to ensure tax brackets:', error);
  }
}

/**
 * Validates new tenant has all required features
 */
export async function validateNewTenantSetup(tenantId: number): Promise<boolean> {
  try {
    const clients = await storage.getClientsByTenant(tenantId);
    const budgets = await storage.getNdisBudgetsByTenant(tenantId);
    const shifts = await storage.getShiftsByTenant(tenantId);
    const payScales = await storage.getPayScalesByTenant(tenantId);
    
    const hasClients = clients.length > 0;
    const hasBudgets = budgets.length > 0;
    const hasShifts = shifts.length > 0;
    const hasPayScales = payScales.length > 0;
    
    console.log(`[VALIDATION] Tenant ${tenantId}: clients=${hasClients}, budgets=${hasBudgets}, shifts=${hasShifts}, payScales=${hasPayScales}`);
    
    return hasClients && hasBudgets && hasShifts && hasPayScales;
  } catch (error) {
    console.error(`[VALIDATION] Failed to validate tenant ${tenantId}:`, error);
    return false;
  }
}