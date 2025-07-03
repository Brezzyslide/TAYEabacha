/**
 * FIX TIMESHEET SUBMIT BUTTON VISIBILITY
 * Resets current pay period timesheets to 'draft' status across all tenants
 * Ensures submit buttons are visible for staff to submit timesheets
 */

import { db } from "./db";
import { timesheets as timesheetsTable } from "../shared/schema";
import { eq, and, gte, lte } from "drizzle-orm";

export async function fixTimesheetSubmitButtons(): Promise<void> {
  console.log("[TIMESHEET FIX] Starting timesheet submit button fix across all tenants...");
  
  try {
    // Get current pay period dates (fortnightly cycle)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDate = now.getDate();
    
    // Calculate current fortnightly period
    let payPeriodStart: Date;
    let payPeriodEnd: Date;
    
    // Use 14-day cycles starting from a known Monday
    const baseDate = new Date(2025, 5, 23); // Monday June 23, 2025
    const daysSinceBase = Math.floor((now.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
    const cycleNumber = Math.floor(daysSinceBase / 14);
    
    payPeriodStart = new Date(baseDate.getTime() + (cycleNumber * 14 * 24 * 60 * 60 * 1000));
    payPeriodEnd = new Date(payPeriodStart.getTime() + (14 * 24 * 60 * 60 * 1000) - 1);
    
    console.log(`[TIMESHEET FIX] Current pay period: ${payPeriodStart.toISOString()} to ${payPeriodEnd.toISOString()}`);
    
    // Get all tenants
    const allTenants = await db.select({ tenantId: timesheetsTable.tenantId })
      .from(timesheetsTable)
      .groupBy(timesheetsTable.tenantId);
    
    for (const tenant of allTenants) {
      console.log(`[TIMESHEET FIX] Processing tenant ${tenant.tenantId}...`);
      
      // Reset current pay period timesheets to 'draft' status
      // This ensures staff can submit their timesheets
      const result = await db.update(timesheetsTable)
        .set({ 
          status: 'draft',
          submittedAt: null,
          approvedAt: null,
          updatedAt: new Date()
        })
        .where(and(
          eq(timesheetsTable.tenantId, tenant.tenantId),
          gte(timesheetsTable.payPeriodStart, payPeriodStart),
          lte(timesheetsTable.payPeriodEnd, payPeriodEnd)
        ));
      
      console.log(`[TIMESHEET FIX] Tenant ${tenant.tenantId}: Reset ${result.rowCount || 0} timesheets to draft status`);
    }
    
    console.log("[TIMESHEET FIX] ✅ Successfully fixed timesheet submit buttons across all tenants");
    
  } catch (error) {
    console.error("[TIMESHEET FIX] ❌ Error fixing timesheet submit buttons:", error);
    throw error;
  }
}

// Auto-run fix when this module is imported
fixTimesheetSubmitButtons().catch(console.error);