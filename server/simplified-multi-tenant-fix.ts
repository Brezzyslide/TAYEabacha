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

export interface TenantConsistencyReport {
  tenantId: number;
  hasClients: boolean;
  hasBudgets: boolean;
  hasShifts: boolean;
  hasPayScales: boolean;
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
    
    // Determine fixes needed
    if (!report.hasClients) report.fixes.push("clients");
    if (!report.hasBudgets) report.fixes.push("budgets");
    if (!report.hasShifts) report.fixes.push("shifts");
    if (!report.hasPayScales) report.fixes.push("pay_scales");
    
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
    // If missing multiple core features, do full provisioning
    if (report.fixes.includes("clients") || report.fixes.includes("budgets") || report.fixes.includes("shifts")) {
      console.log(`[TENANT FIX] Full provisioning needed for tenant ${tenantId}`);
      await provisionTenant(tenantId, `company-${tenantId}`);
    }
    
    // Ensure pay scales exist
    if (report.fixes.includes("pay_scales")) {
      console.log(`[TENANT FIX] Provisioning pay scales for tenant ${tenantId}`);
      await provisionScHADSRates(tenantId);
    }
    
    console.log(`[TENANT FIX] Completed fixes for tenant ${tenantId}`);
    
  } catch (error) {
    console.error(`[TENANT FIX] Error fixing tenant ${tenantId}:`, error);
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