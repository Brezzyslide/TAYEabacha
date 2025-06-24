/**
 * ENHANCED TENANT SECURITY SYSTEM
 * Implements advanced multi-tenant security recommendations
 */

import { db } from "./db";
import { storage } from "./storage";
import { eq, and } from "drizzle-orm";
import * as schema from "@shared/schema";

// 1. COMPOSITE FOREIGN KEY VALIDATION
// ===================================

export async function validateCompositeReferences(): Promise<void> {
  console.log("[SECURITY] Validating composite foreign key constraints");
  
  // Check for cross-tenant reference violations
  const violations = await detectCrossTenantViolations();
  
  if (violations.length > 0) {
    console.error("[SECURITY] CRITICAL: Cross-tenant reference violations detected:", violations);
    throw new Error(`Found ${violations.length} cross-tenant data integrity violations`);
  }
  
  console.log("[SECURITY] All composite references validated successfully");
}

async function detectCrossTenantViolations(): Promise<any[]> {
  const violations: any[] = [];
  
  // Check shifts -> clients tenant consistency
  const shiftClientViolations = await db
    .select({
      shiftId: schema.shifts.id,
      shiftTenant: schema.shifts.tenantId,
      clientTenant: schema.clients.tenantId
    })
    .from(schema.shifts)
    .innerJoin(schema.clients, eq(schema.shifts.clientId, schema.clients.id))
    .where(ne(schema.shifts.tenantId, schema.clients.tenantId));
    
  violations.push(...shiftClientViolations.map(v => ({
    type: 'shift_client_tenant_mismatch',
    shiftId: v.shiftId,
    issue: `Shift tenant ${v.shiftTenant} != client tenant ${v.clientTenant}`
  })));
  
  // Check timesheet_entries -> shifts tenant consistency
  const timesheetShiftViolations = await db
    .select({
      entryId: schema.timesheetEntries.id,
      entryTenant: schema.timesheetEntries.tenantId,
      shiftTenant: schema.shifts.tenantId
    })
    .from(schema.timesheetEntries)
    .innerJoin(schema.shifts, eq(schema.timesheetEntries.shiftId, schema.shifts.id))
    .where(ne(schema.timesheetEntries.tenantId, schema.shifts.tenantId));
    
  violations.push(...timesheetShiftViolations.map(v => ({
    type: 'timesheet_shift_tenant_mismatch',
    entryId: v.entryId,
    issue: `Entry tenant ${v.entryTenant} != shift tenant ${v.shiftTenant}`
  })));
  
  return violations;
}

// 2. CONSOLE MANAGER ENHANCED AUDITING
// ====================================

interface ConsoleManagerAction {
  userId: number;
  action: string;
  targetTenantId: number;
  resourceType: string;
  resourceId?: number;
  description: string;
  requiresConfirmation: boolean;
  timestamp: Date;
}

export class ConsoleManagerAudit {
  /**
   * Log all ConsoleManager cross-tenant actions
   */
  static async logCrossTenantAction(action: ConsoleManagerAction): Promise<void> {
    console.log(`[CONSOLE MANAGER AUDIT] User ${action.userId} performing cross-tenant action: ${action.action} on tenant ${action.targetTenantId}`);
    
    // Store in enhanced activity log
    await storage.createActivityLog({
      userId: action.userId,
      tenantId: action.targetTenantId,
      type: 'console_manager_cross_tenant',
      action: action.action,
      resourceType: action.resourceType,
      resourceId: action.resourceId,
      description: `CROSS-TENANT: ${action.description}`,
      metadata: {
        requiresConfirmation: action.requiresConfirmation,
        timestamp: action.timestamp,
        securityLevel: 'elevated'
      }
    });
  }
  
  /**
   * Check if action requires confirmation
   */
  static requiresConfirmation(action: string): boolean {
    const highRiskActions = [
      'delete_tenant',
      'modify_tenant_data',
      'bulk_data_migration',
      'cross_tenant_user_transfer',
      'tenant_merge',
      'emergency_data_access'
    ];
    
    return highRiskActions.includes(action);
  }
  
  /**
   * Generate impersonation context for UI
   */
  static generateImpersonationContext(consoleManagerId: number, targetTenantId: number): string {
    return `ConsoleManager(${consoleManagerId}) acting as Tenant ${targetTenantId} context`;
  }
}

// 3. ENHANCED MIDDLEWARE FOR CONSOLE MANAGER
// ==========================================

export function requireConsoleManagerConfirmation(action: string) {
  return async (req: any, res: any, next: any) => {
    if (req.user.role !== 'ConsoleManager') {
      return next(); // Skip for non-ConsoleManager users
    }
    
    const requiresConfirmation = ConsoleManagerAudit.requiresConfirmation(action);
    
    if (requiresConfirmation && !req.headers['x-console-manager-confirmed']) {
      return res.status(403).json({
        message: "High-risk cross-tenant action requires explicit confirmation",
        action,
        confirmationRequired: true,
        instructions: "Add 'X-Console-Manager-Confirmed: true' header to proceed"
      });
    }
    
    // Log the action
    await ConsoleManagerAudit.logCrossTenantAction({
      userId: req.user.id,
      action,
      targetTenantId: req.body.tenantId || req.query.tenantId || req.user.tenantId,
      resourceType: req.route?.path?.split('/')[2] || 'unknown',
      resourceId: req.params.id,
      description: `${req.method} ${req.originalUrl}`,
      requiresConfirmation,
      timestamp: new Date()
    });
    
    next();
  };
}

// 4. BACKGROUND JOB TENANT SAFETY
// ===============================

export async function runForEachTenant<T>(
  jobFunction: (tenantId: number) => Promise<T>,
  options: {
    parallel?: boolean;
    skipTenants?: number[];
    includeTenants?: number[];
  } = {}
): Promise<Map<number, T | Error>> {
  console.log("[BACKGROUND JOB] Starting tenant-scoped job execution");
  
  // Get all active tenants
  const allTenants = await db
    .select({ tenantId: schema.users.tenantId })
    .from(schema.users)
    .groupBy(schema.users.tenantId);
  
  let targetTenants = allTenants.map(t => t.tenantId);
  
  // Apply filters
  if (options.includeTenants) {
    targetTenants = targetTenants.filter(id => options.includeTenants!.includes(id));
  }
  
  if (options.skipTenants) {
    targetTenants = targetTenants.filter(id => !options.skipTenants!.includes(id));
  }
  
  const results = new Map<number, T | Error>();
  
  if (options.parallel) {
    // Parallel execution
    const promises = targetTenants.map(async (tenantId) => {
      try {
        const result = await jobFunction(tenantId);
        results.set(tenantId, result);
      } catch (error) {
        console.error(`[BACKGROUND JOB] Error processing tenant ${tenantId}:`, error);
        results.set(tenantId, error as Error);
      }
    });
    
    await Promise.allSettled(promises);
  } else {
    // Sequential execution
    for (const tenantId of targetTenants) {
      try {
        console.log(`[BACKGROUND JOB] Processing tenant ${tenantId}`);
        const result = await jobFunction(tenantId);
        results.set(tenantId, result);
      } catch (error) {
        console.error(`[BACKGROUND JOB] Error processing tenant ${tenantId}:`, error);
        results.set(tenantId, error as Error);
      }
    }
  }
  
  console.log(`[BACKGROUND JOB] Completed for ${targetTenants.length} tenants`);
  return results;
}

// 5. FEATURE FLAG MANAGEMENT SYSTEM
// =================================

interface FeatureFlag {
  feature: string;
  isEnabled: boolean;
  tenantId: number | 'all';
  description?: string;
  rolloutPercentage?: number;
}

export class FeatureFlagManager {
  /**
   * Check if feature is enabled for tenant
   */
  static async isFeatureEnabled(feature: string, tenantId: number): Promise<boolean> {
    // Check tenant-specific flag first
    const tenantFlag = await storage.getFeatureFlag(feature, tenantId);
    if (tenantFlag !== null) return tenantFlag;
    
    // Check global flag
    const globalFlag = await storage.getFeatureFlag(feature, 'all');
    return globalFlag ?? false;
  }
  
  /**
   * Sync feature flags across all tenants
   */
  static async syncFeatureFlagsAcrossTenants(feature: string, isEnabled: boolean): Promise<void> {
    console.log(`[FEATURE FLAGS] Syncing ${feature} = ${isEnabled} across all tenants`);
    
    await runForEachTenant(async (tenantId) => {
      await storage.setFeatureFlag(feature, tenantId, isEnabled);
    }, { parallel: true });
    
    console.log(`[FEATURE FLAGS] Successfully synced ${feature} across all tenants`);
  }
}

// 6. STARTUP SECURITY VALIDATION
// ==============================

export async function runStartupSecurityChecks(): Promise<void> {
  console.log("[SECURITY] Running enhanced startup security validation");
  
  try {
    // 1. Validate composite foreign key integrity
    await validateCompositeReferences();
    
    // 2. Check for orphaned records
    await validateOrphanedRecords();
    
    // 3. Verify tenant isolation integrity
    await validateTenantIsolationIntegrity();
    
    console.log("[SECURITY] All enhanced security checks passed");
    
  } catch (error) {
    console.error("[SECURITY] CRITICAL: Security validation failed:", error);
    throw error;
  }
}

async function validateOrphanedRecords(): Promise<void> {
  // Check for shifts without valid clients
  const orphanedShifts = await db
    .select({ id: schema.shifts.id })
    .from(schema.shifts)
    .leftJoin(schema.clients, eq(schema.shifts.clientId, schema.clients.id))
    .where(isNull(schema.clients.id));
    
  if (orphanedShifts.length > 0) {
    throw new Error(`Found ${orphanedShifts.length} orphaned shifts without valid clients`);
  }
}

async function validateTenantIsolationIntegrity(): Promise<void> {
  // Run comprehensive tenant boundary checks
  const violations = await detectCrossTenantViolations();
  
  if (violations.length > 0) {
    throw new Error(`Tenant isolation integrity compromised: ${violations.length} violations found`);
  }
}