/**
 * COMPLETE DEMO DATA CLEANUP SCRIPT
 * Removes ALL demo data from ALL tenants ensuring clean start
 * Use this to enforce zero demo data policy across all tenants
 */

import { pool } from "./lib/dbClient";

export async function completeCleanupAllDemoData(): Promise<void> {
  console.log("[DEMO CLEANUP] Starting complete demo data removal from ALL tenants");
  
  try {
    // Get all tenants
    const tenants = await pool.query("SELECT id FROM tenants ORDER BY id");
    console.log(`[DEMO CLEANUP] Found ${tenants.rows.length} tenants to clean`);
    
    for (const tenant of tenants.rows) {
      const tenantId = tenant.id;
      console.log(`[DEMO CLEANUP] Cleaning tenant ${tenantId}`);
      
      await cleanTenantDemoData(tenantId);
    }
    
    console.log("[DEMO CLEANUP] All demo data removed from all tenants successfully");
  } catch (error) {
    console.error("[DEMO CLEANUP] Error during cleanup:", error);
    throw error;
  }
}

async function cleanTenantDemoData(tenantId: number): Promise<void> {
  const cleanupActions: string[] = [];
  
  try {
    // CRITICAL: Delete in correct order to respect foreign key constraints
    // Children first, then parents to prevent constraint violations
    
    // 1. Delete demo budget transactions first (uses company_id, not tenant_id)
    const companyResult = await pool.query("SELECT company_id FROM tenants WHERE id = $1", [tenantId]);
    const companyId = companyResult.rows[0]?.company_id;
    
    if (companyId) {
      // Delete all budget transactions for this company from demo period
      const transactionsResult = await pool.query(
        "DELETE FROM budget_transactions WHERE company_id = $1 AND created_at < '2025-07-08'",
        [companyId]
      );
      
      // Also delete budget transactions that reference demo NDIS budgets we're about to delete
      const budgetTransactionsResult2 = await pool.query(
        `DELETE FROM budget_transactions 
         WHERE budget_id IN (
           SELECT id FROM ndis_budgets 
           WHERE tenant_id = $1 AND created_at < '2025-07-08'
         )`,
        [tenantId]
      );
      
      const totalTransactions = (transactionsResult.rowCount || 0) + (budgetTransactionsResult2.rowCount || 0);
      if (totalTransactions > 0) {
        cleanupActions.push(`Removed ${totalTransactions} demo budget transactions`);
      }
    }
    
    // 2. Delete timesheet entries (must delete before shifts due to FK constraint)
    // First delete by timesheet reference
    const timesheetEntriesResult1 = await pool.query(
      `DELETE FROM timesheet_entries 
       WHERE timesheet_id IN (
         SELECT id FROM timesheets WHERE tenant_id = $1
       ) 
       AND created_at < '2025-07-08'`,
      [tenantId]
    );
    
    // Also delete by shift reference (for demo shifts we're about to delete)
    const timesheetEntriesResult2 = await pool.query(
      `DELETE FROM timesheet_entries 
       WHERE shift_id IN (
         SELECT id FROM shifts 
         WHERE tenant_id = $1 
         AND (title LIKE '%Sample%' OR title LIKE '%Demo%' OR created_at < '2025-07-08')
       )`,
      [tenantId]
    );
    
    const totalTimesheetEntries = (timesheetEntriesResult1.rowCount || 0) + (timesheetEntriesResult2.rowCount || 0);
    if (totalTimesheetEntries > 0) {
      cleanupActions.push(`Removed ${totalTimesheetEntries} demo timesheet entries`);
    }
    
    // 3. Delete shift cancellations
    const cancellationsResult = await pool.query(
      "DELETE FROM shift_cancellations WHERE tenant_id = $1 AND created_at < '2025-07-08'",
      [tenantId]
    );
    if (cancellationsResult.rowCount > 0) {
      cleanupActions.push(`Removed ${cancellationsResult.rowCount} demo shift cancellations`);
    }
    
    // 4. Delete ALL case notes that reference demo clients
    const caseNotesResult = await pool.query(
      `DELETE FROM case_notes 
       WHERE tenant_id = $1 
       AND (
         created_at < '2025-07-08' 
         OR client_id IN (
           SELECT id FROM clients 
           WHERE tenant_id = $1 
           AND (client_id LIKE '%_T%' OR client_id LIKE 'CLT%' OR created_at < '2025-07-08')
         )
       )`,
      [tenantId]
    );
    if (caseNotesResult.rowCount > 0) {
      cleanupActions.push(`Removed ${caseNotesResult.rowCount} demo case notes`);
    }
    
    // 5. Delete ALL observations that reference demo clients
    const observationsResult = await pool.query(
      `DELETE FROM hourly_observations 
       WHERE tenant_id = $1 
       AND (
         created_at < '2025-07-08' 
         OR client_id IN (
           SELECT id FROM clients 
           WHERE tenant_id = $1 
           AND (client_id LIKE '%_T%' OR client_id LIKE 'CLT%' OR created_at < '2025-07-08')
         )
       )`,
      [tenantId]
    );
    if (observationsResult.rowCount > 0) {
      cleanupActions.push(`Removed ${observationsResult.rowCount} demo observations`);
    }
    
    // 6. Delete ALL medication records that reference demo clients
    const medicationRecordsResult = await pool.query(
      `DELETE FROM medication_records 
       WHERE tenant_id = $1 
       AND (
         created_at < '2025-07-08' 
         OR client_id IN (
           SELECT id FROM clients 
           WHERE tenant_id = $1 
           AND (client_id LIKE '%_T%' OR client_id LIKE 'CLT%' OR created_at < '2025-07-08')
         )
       )`,
      [tenantId]
    );
    if (medicationRecordsResult.rowCount > 0) {
      cleanupActions.push(`Removed ${medicationRecordsResult.rowCount} demo medication records`);
    }
    
    // 7. Delete ALL medication plans that reference demo clients
    const medicationPlansResult = await pool.query(
      `DELETE FROM medication_plans 
       WHERE tenant_id = $1 
       AND (
         created_at < '2025-07-08' 
         OR client_id IN (
           SELECT id FROM clients 
           WHERE tenant_id = $1 
           AND (client_id LIKE '%_T%' OR client_id LIKE 'CLT%' OR created_at < '2025-07-08')
         )
       )`,
      [tenantId]
    );
    if (medicationPlansResult.rowCount > 0) {
      cleanupActions.push(`Removed ${medicationPlansResult.rowCount} demo medication plans`);
    }
    
    // 8. Delete ALL incident reports that reference demo clients
    const incidentReportsResult = await pool.query(
      `DELETE FROM incident_reports 
       WHERE tenant_id = $1 
       AND (
         created_at < '2025-07-08' 
         OR client_id IN (
           SELECT id FROM clients 
           WHERE tenant_id = $1 
           AND (client_id LIKE '%_T%' OR client_id LIKE 'CLT%' OR created_at < '2025-07-08')
         )
       )`,
      [tenantId]
    );
    if (incidentReportsResult.rowCount > 0) {
      cleanupActions.push(`Removed ${incidentReportsResult.rowCount} demo incident reports`);
    }
    
    // 9. Delete ALL NDIS budgets that reference demo clients
    const budgetsResult = await pool.query(
      `DELETE FROM ndis_budgets 
       WHERE tenant_id = $1 
       AND (
         created_at < '2025-07-08' 
         OR client_id IN (
           SELECT id FROM clients 
           WHERE tenant_id = $1 
           AND (client_id LIKE '%_T%' OR client_id LIKE 'CLT%' OR created_at < '2025-07-08')
         )
       )`,
      [tenantId]
    );
    if (budgetsResult.rowCount > 0) {
      cleanupActions.push(`Removed ${budgetsResult.rowCount} demo NDIS budgets`);
    }
    
    // 10. Delete ALL care support plans that reference demo clients we're about to delete
    const carePlansResult = await pool.query(
      `DELETE FROM care_support_plans 
       WHERE tenant_id = $1 
       AND (
         created_at < '2025-07-08' 
         OR client_id IN (
           SELECT id FROM clients 
           WHERE tenant_id = $1 
           AND (client_id LIKE '%_T%' OR client_id LIKE 'CLT%' OR created_at < '2025-07-08')
         )
       )`,
      [tenantId]
    );
    if (carePlansResult.rowCount > 0) {
      cleanupActions.push(`Removed ${carePlansResult.rowCount} demo care plans`);
    }
    
    // 11. Delete ALL shifts that reference demo clients or are demo shifts
    const shiftResult = await pool.query(
      `DELETE FROM shifts 
       WHERE tenant_id = $1 
       AND (
         title LIKE '%Sample%' 
         OR title LIKE '%Demo%' 
         OR created_at < '2025-07-08'
         OR client_id IN (
           SELECT id FROM clients 
           WHERE tenant_id = $1 
           AND (client_id LIKE '%_T%' OR client_id LIKE 'CLT%' OR created_at < '2025-07-08')
         )
       )`,
      [tenantId]
    );
    if (shiftResult.rowCount > 0) {
      cleanupActions.push(`Removed ${shiftResult.rowCount} demo shifts`);
    }
    
    // 12. FINALLY delete demo clients (parent records - delete LAST)
    const clientResult = await pool.query(
      "DELETE FROM clients WHERE tenant_id = $1 AND (client_id LIKE '%_T%' OR client_id LIKE 'CLT%' OR created_at < '2025-07-08')",
      [tenantId]
    );
    if (clientResult.rowCount > 0) {
      cleanupActions.push(`Removed ${clientResult.rowCount} demo clients`);
    }
    
    console.log(`[DEMO CLEANUP] Tenant ${tenantId}: ${cleanupActions.length > 0 ? cleanupActions.join(', ') : 'No demo data found'}`);
    
  } catch (error) {
    console.error(`[DEMO CLEANUP] Error cleaning tenant ${tenantId}:`, error);
    throw error;
  }
}

/**
 * Run cleanup immediately if called directly
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  completeCleanupAllDemoData().catch(console.error);
}