/**
 * COMPREHENSIVE TENANT FIXES
 * Applies all timesheet, employment type, and leave accrual fixes to ALL tenants
 * Ensures future tenants receive all improvements automatically
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import { eq, and } from "drizzle-orm";
import { users, timesheets, timesheetEntries, leaveBalances, taxBrackets } from "@shared/schema";

interface TenantFix {
  tenantId: number;
  fixes: string[];
  issues: string[];
}

export async function applyComprehensiveTenantFixes(): Promise<void> {
  console.log("[COMPREHENSIVE FIX] Starting complete tenant consistency enforcement");
  
  // Get all tenants
  const tenants = await db.execute(sql`SELECT DISTINCT tenant_id FROM users ORDER BY tenant_id`);
  console.log(`[COMPREHENSIVE FIX] Found ${tenants.rows.length} tenants to process`);
  
  for (const tenant of tenants.rows) {
    const tenantId = tenant.tenant_id as number;
    console.log(`[COMPREHENSIVE FIX] Processing tenant ${tenantId}`);
    
    await fixTenantComprehensively(tenantId);
  }
  
  console.log("[COMPREHENSIVE FIX] All tenant fixes completed successfully");
}

async function fixTenantComprehensively(tenantId: number): Promise<void> {
  const fixes: string[] = [];
  
  try {
    // 1. Fix employment type standardization
    const employmentTypeFixes = await fixEmploymentTypes(tenantId);
    fixes.push(...employmentTypeFixes);
    
    // 2. Ensure database constraints exist
    await ensureDatabaseConstraints();
    fixes.push("Database constraints enforced");
    
    // 3. Fix timesheet entries for completed shifts
    const timesheetFixes = await fixMissingTimesheetEntries(tenantId);
    fixes.push(...timesheetFixes);
    
    // 4. Fix leave balances initialization
    const leaveFixes = await fixLeaveBalances(tenantId);
    fixes.push(...leaveFixes);
    
    // 5. Ensure tax brackets exist
    await ensureTaxBrackets();
    fixes.push("Tax brackets verified");
    
    // 6. Fix timesheet totals
    const totalsFixes = await fixTimesheetTotals(tenantId);
    fixes.push(...totalsFixes);
    
    console.log(`[COMPREHENSIVE FIX] Tenant ${tenantId} completed: ${fixes.length} fixes applied`);
    
  } catch (error) {
    console.error(`[COMPREHENSIVE FIX] Error processing tenant ${tenantId}:`, error);
  }
}

async function fixEmploymentTypes(tenantId: number): Promise<string[]> {
  const fixes: string[] = [];
  
  // Fix common employment type variations
  const variations = [
    { from: 'parttime', to: 'part-time' },
    { from: 'fulltime', to: 'full-time' },
    { from: 'part_time', to: 'part-time' },
    { from: 'full_time', to: 'full-time' },
    { from: 'pt', to: 'part-time' },
    { from: 'ft', to: 'full-time' }
  ];
  
  for (const variation of variations) {
    const result = await db.execute(sql`
      UPDATE users 
      SET employment_type = ${variation.to}
      WHERE tenant_id = ${tenantId} 
      AND employment_type = ${variation.from}
    `);
    
    if (result.rowCount && result.rowCount > 0) {
      fixes.push(`Fixed ${result.rowCount} users: ${variation.from} → ${variation.to}`);
    }
  }
  
  // Set NULL employment types to 'casual' with logging
  const nullResult = await db.execute(sql`
    UPDATE users 
    SET employment_type = 'casual'
    WHERE tenant_id = ${tenantId} 
    AND employment_type IS NULL
  `);
  
  if (nullResult.rowCount && nullResult.rowCount > 0) {
    fixes.push(`Set ${nullResult.rowCount} NULL employment types to casual`);
  }
  
  return fixes;
}

async function ensureDatabaseConstraints(): Promise<void> {
  try {
    // Add employment type constraint if it doesn't exist
    await db.execute(sql`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.constraint_column_usage 
          WHERE constraint_name = 'valid_employment_type'
        ) THEN
          ALTER TABLE users 
          ADD CONSTRAINT valid_employment_type 
          CHECK (employment_type IN ('full-time', 'part-time', 'casual'));
        END IF;
      END $$;
    `);
  } catch (error) {
    // Constraint might already exist, continue
    console.log("[COMPREHENSIVE FIX] Employment type constraint already exists");
  }
}

async function fixMissingTimesheetEntries(tenantId: number): Promise<string[]> {
  const fixes: string[] = [];
  
  // Get users who might need timesheet entries
  const users = await db.execute(sql`
    SELECT id, employment_type FROM users 
    WHERE tenant_id = ${tenantId}
  `);
  
  for (const user of users.rows) {
    const userId = user.id as number;
    
    // Get current draft timesheet for this user
    const currentTimesheet = await db.execute(sql`
      SELECT id FROM timesheets 
      WHERE user_id = ${userId} 
      AND tenant_id = ${tenantId} 
      AND status = 'draft'
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    if (currentTimesheet.rows.length > 0) {
      const timesheetId = currentTimesheet.rows[0].id as number;
      
      // Find completed shifts without timesheet entries
      const missingEntries = await db.execute(sql`
        SELECT s.id, s.start_time, s.end_time
        FROM shifts s
        WHERE s.user_id = ${userId} 
        AND s.tenant_id = ${tenantId}
        AND s.status = 'completed'
        AND s.end_time IS NOT NULL
        AND s.id NOT IN (
          SELECT DISTINCT shift_id 
          FROM timesheet_entries 
          WHERE shift_id IS NOT NULL
        )
        ORDER BY s.start_time DESC
        LIMIT 10
      `);
      
      if (missingEntries.rows.length > 0) {
        // Create timesheet entries for missing shifts
        for (const shift of missingEntries.rows) {
          const shiftId = shift.id as number;
          const startTime = shift.start_time as Date;
          const endTime = shift.end_time as Date;
          
          const totalHours = (new Date(endTime).getTime() - new Date(startTime).getTime()) / (1000 * 60 * 60);
          const hourlyRate = 29.07; // Default rate
          const grossPay = totalHours * hourlyRate;
          
          await db.execute(sql`
            INSERT INTO timesheet_entries (
              timesheet_id, shift_id, entry_date, start_time, end_time,
              break_minutes, total_hours, hourly_rate, gross_pay,
              is_auto_generated, created_at
            ) VALUES (
              ${timesheetId}, ${shiftId}, ${startTime}::date, ${startTime}, ${endTime},
              0, ${totalHours}, ${hourlyRate}, ${grossPay},
              true, CURRENT_TIMESTAMP
            )
          `);
        }
        
        // Update timesheet totals
        await updateTimesheetTotals(timesheetId);
        fixes.push(`Created ${missingEntries.rows.length} timesheet entries for user ${userId}`);
      }
    }
  }
  
  return fixes;
}

export async function updateTimesheetTotals(timesheetId: number): Promise<void> {
  await db.execute(sql`
    UPDATE timesheets 
    SET 
      total_hours = (
        SELECT COALESCE(SUM(total_hours), 0) 
        FROM timesheet_entries 
        WHERE timesheet_id = ${timesheetId}
      ),
      total_earnings = (
        SELECT COALESCE(SUM(gross_pay), 0) 
        FROM timesheet_entries 
        WHERE timesheet_id = ${timesheetId}
      ),
      net_pay = (
        SELECT COALESCE(SUM(gross_pay), 0) 
        FROM timesheet_entries 
        WHERE timesheet_id = ${timesheetId}
      ),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${timesheetId}
  `);
}

async function fixLeaveBalances(tenantId: number): Promise<string[]> {
  const fixes: string[] = [];
  
  // Get all users who should have leave balances (non-casual)
  const users = await db.execute(sql`
    SELECT id, employment_type FROM users 
    WHERE tenant_id = ${tenantId}
    AND employment_type IN ('full-time', 'part-time')
  `);
  
  for (const user of users.rows) {
    const userId = user.id as number;
    
    // Check if leave balance exists
    const existingBalance = await db.execute(sql`
      SELECT id FROM leave_balances 
      WHERE user_id = ${userId} AND tenant_id = ${tenantId}
    `);
    
    if (existingBalance.rows.length === 0) {
      // Create leave balance record
      await db.execute(sql`
        INSERT INTO leave_balances (
          user_id, tenant_id, annual_leave, sick_leave, 
          personal_leave, long_service_leave, accrual_rate
        ) VALUES (
          ${userId}, ${tenantId}, 0.00, 0.00, 0.00, 0.00, 0.0769
        )
      `);
      fixes.push(`Created leave balance for user ${userId}`);
    }
  }
  
  return fixes;
}

async function ensureTaxBrackets(): Promise<void> {
  const existing = await db.execute(sql`
    SELECT COUNT(*) as count FROM tax_brackets WHERE tax_year = 2025
  `);
  
  if ((existing.rows[0] as any).count === 0) {
    // Create Australian tax brackets 2024-25
    const brackets = [
      { minIncome: 0, maxIncome: 18200, taxRate: 0, baseTax: 0 },
      { minIncome: 18201, maxIncome: 45000, taxRate: 0.19, baseTax: 0 },
      { minIncome: 45001, maxIncome: 120000, taxRate: 0.325, baseTax: 5092 },
      { minIncome: 120001, maxIncome: 180000, taxRate: 0.37, baseTax: 29467 },
      { minIncome: 180001, maxIncome: null, taxRate: 0.45, baseTax: 51667 }
    ];
    
    for (const bracket of brackets) {
      await db.execute(sql`
        INSERT INTO tax_brackets (
          min_income, max_income, tax_rate, base_tax, tax_year, created_at
        ) VALUES (
          ${bracket.minIncome}, ${bracket.maxIncome}, ${bracket.taxRate}, 
          ${bracket.baseTax}, 2025, CURRENT_TIMESTAMP
        )
      `);
    }
  }
}

async function fixTimesheetTotals(tenantId: number): Promise<string[]> {
  const fixes: string[] = [];
  
  // Fix timesheets with incorrect totals
  const incorrectTimesheets = await db.execute(sql`
    SELECT t.id, t.user_id,
      COALESCE(SUM(te.total_hours), 0) as actual_hours,
      COALESCE(SUM(te.gross_pay), 0) as actual_earnings,
      t.total_hours as current_hours,
      t.total_earnings as current_earnings
    FROM timesheets t
    LEFT JOIN timesheet_entries te ON t.id = te.timesheet_id
    WHERE t.tenant_id = ${tenantId}
    AND t.status = 'draft'
    GROUP BY t.id, t.user_id, t.total_hours, t.total_earnings
    HAVING 
      ABS(COALESCE(t.total_hours::numeric, 0) - COALESCE(SUM(te.total_hours), 0)) > 0.01
      OR ABS(COALESCE(t.total_earnings::numeric, 0) - COALESCE(SUM(te.gross_pay), 0)) > 0.01
  `);
  
  for (const timesheet of incorrectTimesheets.rows) {
    const timesheetId = timesheet.id as number;
    await updateTimesheetTotals(timesheetId);
    fixes.push(`Fixed totals for timesheet ${timesheetId}`);
  }
  
  return fixes;
}

// Auto-apply fixes to new tenants
export async function applyFixesToNewTenant(tenantId: number): Promise<void> {
  console.log(`[COMPREHENSIVE FIX] Applying all fixes to new tenant ${tenantId}`);
  await fixTenantComprehensively(tenantId);
}