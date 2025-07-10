/**
 * SIMPLIFIED MULTI-TENANT CONSISTENCY ENFORCEMENT
 * Ensures ALL features work uniformly across ALL tenants (existing and new)
 */

import { storage } from './storage';
import { provisionTenant } from './tenant-provisioning';
import { provisionScHADSRates } from './schads-provisioning';
import { db } from './db';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';
import { calculatePayPeriod } from './payroll-calculator';

export interface TenantConsistencyReport {
  tenantId: number;
  hasClients: boolean;
  hasBudgets: boolean;
  hasShifts: boolean;
  hasPayScales: boolean;
  hasTimesheets: boolean;
  isConsistent: boolean;
  fixes: string[];
}

/**
 * Comprehensive multi-tenant consistency enforcement
 */
export async function enforceMultiTenantConsistency(): Promise<void> {
  console.log("[MULTI-TENANT FIX] Starting comprehensive consistency enforcement");
  
  try {
    // Get all tenants
    const tenants = await db.select({ tenantId: schema.users.tenantId })
      .from(schema.users)
      .groupBy(schema.users.tenantId)
      .orderBy(schema.users.tenantId);
    
    console.log(`[MULTI-TENANT FIX] Found ${tenants.length} tenants to process`);
    
    for (const tenant of tenants) {
      const tenantId = tenant.tenantId;
      console.log(`[MULTI-TENANT FIX] Processing tenant ${tenantId}`);
      
      try {
        const report = await checkTenantConsistency(tenantId);
        
        if (!report.isConsistent) {
          console.log(`[MULTI-TENANT FIX] Tenant ${tenantId} needs fixes: ${report.fixes.join(', ')}`);
          await fixTenantInconsistencies(tenantId, report);
        } else {
          console.log(`[MULTI-TENANT FIX] Tenant ${tenantId} is consistent`);
        }
        
      } catch (error) {
        console.error(`[MULTI-TENANT FIX] Error processing tenant ${tenantId}:`, error);
      }
    }
    
    // Ensure tax brackets exist system-wide
    await ensureTaxBrackets();
    
    console.log("[MULTI-TENANT FIX] Consistency enforcement completed");
    
  } catch (error) {
    console.error("[MULTI-TENANT FIX] Critical error:", error);
    throw error;
  }
}

/**
 * Check if tenant has consistent feature coverage
 */
async function checkTenantConsistency(tenantId: number): Promise<TenantConsistencyReport> {
  const report: TenantConsistencyReport = {
    tenantId,
    hasClients: false,
    hasBudgets: false,
    hasShifts: false,
    hasPayScales: false,
    hasTimesheets: false,
    isConsistent: false,
    fixes: []
  };
  
  try {
    // Check clients
    const clients = await db.select().from(schema.clients)
      .where(eq(schema.clients.tenantId, tenantId))
      .limit(1);
    report.hasClients = clients.length > 0;
    
    // Check NDIS budgets
    const budgets = await db.select().from(schema.ndisBudgets)
      .where(eq(schema.ndisBudgets.tenantId, tenantId))
      .limit(1);
    report.hasBudgets = budgets.length > 0;
    
    // Check shifts
    const shifts = await db.select().from(schema.shifts)
      .where(eq(schema.shifts.tenantId, tenantId))
      .limit(1);
    report.hasShifts = shifts.length > 0;
    
    // Check pay scales
    const payScales = await db.select().from(schema.payScales)
      .where(eq(schema.payScales.tenantId, tenantId))
      .limit(1);
    report.hasPayScales = payScales.length > 0;
    
    // Check timesheets
    const timesheets = await db.select().from(schema.timesheets)
      .where(eq(schema.timesheets.tenantId, tenantId))
      .limit(1);
    report.hasTimesheets = timesheets.length > 0;
    
    // Determine fixes needed
    if (!report.hasClients) report.fixes.push("clients");
    if (!report.hasBudgets) report.fixes.push("budgets");
    if (!report.hasShifts) report.fixes.push("shifts");
    if (!report.hasPayScales) report.fixes.push("pay_scales");
    if (!report.hasTimesheets) report.fixes.push("timesheets");
    
    report.isConsistent = report.fixes.length === 0;
    
  } catch (error) {
    console.error(`[CONSISTENCY CHECK] Error checking tenant ${tenantId}:`, error);
    report.fixes.push("error_during_check");
  }
  
  return report;
}

/**
 * Fix inconsistencies for a specific tenant
 */
async function fixTenantInconsistencies(tenantId: number, report: TenantConsistencyReport): Promise<void> {
  console.log(`[TENANT FIX] Fixing inconsistencies for tenant ${tenantId}`);
  
  try {
    // DEMO DATA PROVISIONING PERMANENTLY DISABLED
    console.log(`[TENANT FIX] DEMO DATA PROVISIONING DISABLED - tenant ${tenantId} starts completely clean`);
    console.log(`[TENANT FIX] Missing features will be created organically by users, not auto-provisioned`);
    
    // Only provision essential system features (no demo data)
    if (report.fixes.includes("pay_scales")) {
      console.log(`[TENANT FIX] Provisioning essential pay scales for tenant ${tenantId}`);
      await provisionScHADSRates(tenantId);
    }
    
    // No automatic timesheet, client, shift, or budget provisioning
    // Users must create their own data organically
    
    console.log(`[TENANT FIX] Completed fixes for tenant ${tenantId}`);
    
  } catch (error) {
    console.error(`[TENANT FIX] Error fixing tenant ${tenantId}:`, error);
  }
}

/**
 * Provision timesheet data for a tenant
 */
async function provisionTimesheetsForTenant(tenantId: number): Promise<void> {
  try {
    // Get staff from this tenant
    const staff = await db.select().from(schema.users)
      .where(eq(schema.users.tenantId, tenantId))
      .limit(3);
    
    if (staff.length === 0) {
      console.log(`[TIMESHEET PROVISION] No staff found for tenant ${tenantId}`);
      return;
    }

    // Calculate current pay period
    const payPeriod = calculatePayPeriod(new Date());
    
    // Create essential timesheet for each staff member (no demo data)
    for (const staffMember of staff) {
      const existingTimesheet = await db.select().from(schema.timesheets)
        .where(eq(schema.timesheets.userId, staffMember.id))
        .limit(1);
      
      if (existingTimesheet.length === 0) {
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
        
        console.log(`[TIMESHEET PROVISION] Created timesheet for staff ${staffMember.id} in tenant ${tenantId}`);
      }
    }
    
  } catch (error) {
    console.error(`[TIMESHEET PROVISION] Error provisioning timesheets for tenant ${tenantId}:`, error);
  }
}

/**
 * Ensure Australian tax brackets exist (system-wide)
 */
async function ensureTaxBrackets(): Promise<void> {
  try {
    const existingBrackets = await db.select().from(schema.taxBrackets).limit(1);
    
    if (existingBrackets.length === 0) {
      console.log("[TAX BRACKETS] Creating Australian tax brackets");
      
      const australianTaxBrackets = [
        { 
          taxYear: 2025,
          minIncome: "0",
          maxIncome: "18200", 
          taxRate: "0",
          baseTax: "0"
        },
        { 
          taxYear: 2025,
          minIncome: "18201",
          maxIncome: "45000", 
          taxRate: "0.19",
          baseTax: "0"
        },
        { 
          taxYear: 2025,
          minIncome: "45001",
          maxIncome: "120000", 
          taxRate: "0.325",
          baseTax: "5092"
        },
        { 
          taxYear: 2025,
          minIncome: "120001",
          maxIncome: "180000", 
          taxRate: "0.37",
          baseTax: "29467"
        },
        { 
          taxYear: 2025,
          minIncome: "180001",
          maxIncome: "999999999", 
          taxRate: "0.45",
          baseTax: "51667"
        }
      ];
      
      for (const bracket of australianTaxBrackets) {
        await db.insert(schema.taxBrackets).values(bracket);
      }
      
      console.log("[TAX BRACKETS] Australian tax brackets created successfully");
    } else {
      console.log("[TAX BRACKETS] Tax brackets already exist");
    }
    
  } catch (error) {
    console.error("[TAX BRACKETS] Error ensuring tax brackets:", error);
  }
}

/**
 * Run complete multi-tenant consistency check
 */
export async function runCompleteConsistencyCheck(): Promise<void> {
  console.log("[MULTI-TENANT FIX] Running complete consistency check");
  await enforceMultiTenantConsistency();
}