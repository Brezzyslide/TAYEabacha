/**
 * SCHADS AWARD AUTO-UPDATE SYSTEM
 * Automatically applies yearly wage increases to all pay scales
 * Triggered manually or via scheduled job (July 1st annually)
 */

import { db } from "./db";
import { payScales, tenants, activityLogs } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { storage } from "./storage";

export interface WageIncreaseConfig {
  effectiveDate: Date;
  increasePercentage: number;
  description: string;
  appliedBy: number; // User ID who triggered the update
}

export interface UpdateResult {
  tenantId: number;
  companyName: string;
  ratesUpdated: number;
  oldRates: Array<{ level: number; payPoint: number; employmentType: string; oldRate: number; newRate: number }>;
}

/**
 * Apply percentage increase to all ScHADS rates across all tenants
 */
export async function applyYearlyWageIncrease(config: WageIncreaseConfig): Promise<UpdateResult[]> {
  console.log(`[SCHADS AUTO-UPDATE] Starting ${config.increasePercentage}% wage increase for all tenants`);
  
  const results: UpdateResult[] = [];
  
  try {
    // Get all tenants
    const allTenants = await db.select().from(tenants);
    console.log(`[SCHADS AUTO-UPDATE] Found ${allTenants.length} tenants to update`);
    
    for (const tenant of allTenants) {
      console.log(`[SCHADS AUTO-UPDATE] Processing tenant ${tenant.id} (${tenant.name})`);
      
      const tenantResult = await updateTenantPayScales(tenant.id, tenant.name, config);
      results.push(tenantResult);
      
      // Log activity for audit trail
      await storage.createActivityLog({
        userId: config.appliedBy,
        action: "schads_wage_increase",
        resourceType: "pay_scales",
        resourceId: tenant.id,
        description: `Applied ${config.increasePercentage}% ScHADS wage increase - ${tenantResult.ratesUpdated} rates updated`,
        tenantId: tenant.id,
      });
    }
    
    console.log(`[SCHADS AUTO-UPDATE] Completed wage increase for all ${allTenants.length} tenants`);
    return results;
    
  } catch (error) {
    console.error("[SCHADS AUTO-UPDATE] Error during wage increase:", error);
    throw error;
  }
}

/**
 * Update pay scales for a specific tenant
 */
async function updateTenantPayScales(
  tenantId: number, 
  companyName: string, 
  config: WageIncreaseConfig
): Promise<UpdateResult> {
  
  const result: UpdateResult = {
    tenantId,
    companyName,
    ratesUpdated: 0,
    oldRates: []
  };
  
  // Get all current pay scales for this tenant
  const currentScales = await db.select()
    .from(payScales)
    .where(eq(payScales.tenantId, tenantId));
  
  for (const scale of currentScales) {
    const oldRate = parseFloat(scale.hourlyRate);
    const newRate = calculateNewRate(oldRate, config.increasePercentage);
    
    // Update the pay scale
    await db.update(payScales)
      .set({
        hourlyRate: newRate.toFixed(2),
        effectiveDate: config.effectiveDate,
      })
      .where(and(
        eq(payScales.tenantId, tenantId),
        eq(payScales.level, scale.level),
        eq(payScales.payPoint, scale.payPoint),
        eq(payScales.employmentType, scale.employmentType)
      ));
    
    result.oldRates.push({
      level: scale.level,
      payPoint: scale.payPoint,
      employmentType: scale.employmentType,
      oldRate,
      newRate
    });
    
    result.ratesUpdated++;
  }
  
  console.log(`[SCHADS AUTO-UPDATE] Tenant ${tenantId}: Updated ${result.ratesUpdated} pay scales`);
  return result;
}

/**
 * Calculate new rate with percentage increase
 */
function calculateNewRate(currentRate: number, increasePercentage: number): number {
  const increase = currentRate * (increasePercentage / 100);
  return Math.round((currentRate + increase) * 100) / 100; // Round to 2 decimal places
}

/**
 * Get upcoming wage increase date (July 1st of current or next year)
 */
export function getNextWageIncreaseDate(): Date {
  const now = new Date();
  const currentYear = now.getFullYear();
  const july1st = new Date(currentYear, 6, 1); // July 1st (month is 0-indexed)
  
  // If we're past July 1st this year, return next year's July 1st
  if (now > july1st) {
    return new Date(currentYear + 1, 6, 1);
  }
  
  return july1st;
}

/**
 * Check if wage increase is due (within 30 days of July 1st)
 */
export function isWageIncreaseDue(): boolean {
  const now = new Date();
  const nextIncrease = getNextWageIncreaseDate();
  const daysDiff = Math.ceil((nextIncrease.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  return daysDiff <= 30 && daysDiff >= 0;
}

/**
 * Get wage increase history for reporting
 */
export async function getWageIncreaseHistory(tenantId?: number): Promise<any[]> {
  const baseQuery = db.select({
    id: activityLogs.id,
    action: activityLogs.action,
    description: activityLogs.description,
    createdAt: activityLogs.createdAt,
    tenantId: activityLogs.tenantId,
    userId: activityLogs.userId
  })
  .from(activityLogs);
  
  if (tenantId) {
    return await baseQuery
      .where(and(
        eq(activityLogs.action, "schads_wage_increase"),
        eq(activityLogs.tenantId, tenantId)
      ))
      .orderBy(activityLogs.createdAt);
  }
  
  return await baseQuery
    .where(eq(activityLogs.action, "schads_wage_increase"))
    .orderBy(activityLogs.createdAt);
}

/**
 * Preview wage increase impact without applying changes
 */
export async function previewWageIncrease(increasePercentage: number): Promise<{
  totalTenants: number;
  totalRatesAffected: number;
  sampleCalculations: Array<{
    level: number;
    payPoint: number;
    employmentType: string;
    currentRate: number;
    newRate: number;
    increase: number;
  }>;
}> {
  
  const allTenants = await db.select().from(tenants);
  
  // Get sample rates from first tenant for preview
  const sampleScales = await db.select()
    .from(payScales)
    .where(eq(payScales.tenantId, allTenants[0]?.id || 1))
    .limit(6); // Show sample from each employment type
  
  const sampleCalculations = sampleScales.map(scale => {
    const currentRate = parseFloat(scale.hourlyRate);
    const newRate = calculateNewRate(currentRate, increasePercentage);
    const increase = newRate - currentRate;
    
    return {
      level: scale.level,
      payPoint: scale.payPoint,
      employmentType: scale.employmentType,
      currentRate,
      newRate,
      increase
    };
  });
  
  // Count total rates across all tenants
  const totalRatesResult = await db.select().from(payScales);
  
  return {
    totalTenants: allTenants.length,
    totalRatesAffected: totalRatesResult.length,
    sampleCalculations
  };
}

/**
 * Validate wage increase parameters
 */
export function validateWageIncrease(increasePercentage: number, effectiveDate: Date): string[] {
  const errors: string[] = [];
  
  if (increasePercentage <= 0 || increasePercentage > 50) {
    errors.push("Increase percentage must be between 0.1% and 50%");
  }
  
  if (effectiveDate < new Date()) {
    errors.push("Effective date cannot be in the past");
  }
  
  const expectedDate = getNextWageIncreaseDate();
  const daysDiff = Math.abs((effectiveDate.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDiff > 90) {
    errors.push("Effective date should be close to July 1st for ScHADS compliance");
  }
  
  return errors;
}