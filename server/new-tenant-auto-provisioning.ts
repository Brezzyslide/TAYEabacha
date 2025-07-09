/**
 * NEW TENANT AUTO-PROVISIONING SYSTEM
 * Ensures all new tenants automatically receive complete feature sets
 * CRITICAL: Integrates with user registration to prevent feature gaps
 */

import { storage } from './storage';
import { provisionTenant } from './tenant-provisioning';
import { provisionScHADSRates } from './schads-provisioning';
import { db } from './db';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';
import { calculatePayPeriod } from './payroll-calculator';

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
  console.log(`[NEW TENANT SETUP] AUTO-PROVISIONING DISABLED - No demo data will be created for tenant ${tenantId}`);
  console.log(`[NEW TENANT SETUP] Only essential system features (pay scales, tax brackets, NDIS pricing) will be provisioned`);
  
  try {
    // Only provision essential system features - NO DEMO DATA
    console.log(`[NEW TENANT SETUP] Provisioning essential ScHADS pay scales for tenant ${tenantId}`);
    await provisionScHADSRates(tenantId);
    
    console.log(`[NEW TENANT SETUP] Provisioning essential NDIS pricing for tenant ${tenantId}`);
    await createNdisPricingForTenant(tenantId);
    
    console.log(`[NEW TENANT SETUP] Ensuring Australian tax brackets exist`);
    await ensureTaxBrackets();
    
    console.log(`[NEW TENANT SETUP] Essential features provisioned successfully for tenant ${tenantId} - NO DEMO DATA CREATED`);
    
  } catch (error) {
    console.error(`[NEW TENANT SETUP] Failed to provision essential features for tenant ${tenantId}:`, error);
    throw error;
  }
}

/**
 * Creates NDIS pricing structure for new tenant
 */
async function createNdisPricingForTenant(tenantId: number): Promise<void> {
  const standardRates = [
    { shiftType: "AM", ratio: "1:1", rate: "40.00" },
    { shiftType: "PM", ratio: "1:1", rate: "60.00" },
    { shiftType: "ActiveNight", ratio: "1:1", rate: "80.00" },
    { shiftType: "Sleepover", ratio: "1:1", rate: "100.00" },
    { shiftType: "AM", ratio: "1:2", rate: "25.00" },
    { shiftType: "PM", ratio: "1:2", rate: "35.00" },
    { shiftType: "ActiveNight", ratio: "1:2", rate: "45.00" },
    { shiftType: "Sleepover", ratio: "1:2", rate: "55.00" }
  ];
  
  for (const rate of standardRates) {
    await storage.createNdisPricing({
      tenantId,
      shiftType: rate.shiftType,
      ratio: rate.ratio,
      rate: rate.rate
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
        maxHours: weeklyHours,
        allocationPeriod: 'weekly',
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
    const existingBrackets = await storage.getTaxBrackets(2025);
    if (existingBrackets.length === 0) {
      const australianTaxBrackets = [
        { taxYear: 2025, minIncome: "0", maxIncome: "18200", taxRate: "0", baseTax: "0" },
        { taxYear: 2025, minIncome: "18201", maxIncome: "45000", taxRate: "0.19", baseTax: "0" },
        { taxYear: 2025, minIncome: "45001", maxIncome: "120000", taxRate: "0.325", baseTax: "5092" },
        { taxYear: 2025, minIncome: "120001", maxIncome: "180000", taxRate: "0.37", baseTax: "29467" },
        { taxYear: 2025, minIncome: "180001", maxIncome: "999999999", taxRate: "0.45", baseTax: "51667" }
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
 * Creates timesheet data for new tenant
 */
async function createTimesheetsForTenant(tenantId: number): Promise<void> {
  try {
    // Get all staff from this tenant
    const staff = await db.select().from(schema.users)
      .where(eq(schema.users.tenantId, tenantId));
    
    if (staff.length === 0) {
      console.log(`[NEW TENANT SETUP] No staff found for tenant ${tenantId} - skipping timesheet creation`);
      return;
    }

    // Calculate current pay period
    const payPeriod = calculatePayPeriod(new Date());
    
    // Create initial timesheet for each staff member
    for (const staffMember of staff) {
      await db.insert(schema.timesheets).values({
        userId: staffMember.id,
        tenantId: tenantId,
        payPeriodStart: payPeriod.start,
        payPeriodEnd: payPeriod.end,
        status: 'draft' as const,
        totalHours: 0,
        grossPay: 0,
        taxWithheld: 0,
        netPay: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`[NEW TENANT SETUP] Created timesheet for staff ${staffMember.id} in tenant ${tenantId}`);
    }
    
  } catch (error) {
    console.error(`[NEW TENANT SETUP] Error creating timesheets for tenant ${tenantId}:`, error);
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