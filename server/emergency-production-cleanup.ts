/**
 * EMERGENCY PRODUCTION DEMO DATA CLEANUP
 * One-time script to remove demo data from production database
 * This addresses the gap where production DB has old demo data despite code elimination
 */

import { db } from './lib/dbClient';

interface CleanupResult {
  budgetTransactions: number;
  timesheetEntries: number;
  caseNotes: number;
  medicationRecords: number;
  incidentReports: number;
  observations: number;
  ndisBudgets: number;
  shifts: number;
  clients: number;
}

/**
 * CRITICAL: This function removes ALL demo data from production database
 * Execute with extreme caution and only in production emergency
 */
export async function executeProductionDemoDataCleanup(): Promise<CleanupResult> {
  console.log('🚨 EMERGENCY PRODUCTION DEMO DATA CLEANUP STARTING...');
  
  const result: CleanupResult = {
    budgetTransactions: 0,
    timesheetEntries: 0,
    caseNotes: 0,
    medicationRecords: 0,
    incidentReports: 0,
    observations: 0,
    ndisBudgets: 0,
    shifts: 0,
    clients: 0
  };

  try {
    // Start transaction for safety
    await db.query('BEGIN');

    // 1. Identify demo clients first
    const demoClientsResult = await db.query(`
      SELECT id, firstName, lastName, email, tenantId 
      FROM clients 
      WHERE firstName ILIKE '%test%' 
         OR firstName ILIKE '%demo%' 
         OR lastName ILIKE '%sample%'
         OR email ILIKE '%test%'
         OR email ILIKE '%demo%'
         OR firstName = 'John'
         OR firstName = 'Jane'
         OR firstName = 'Sarah'
    `);

    const demoClientIds = demoClientsResult.rows.map(row => row.id);
    console.log(`Found ${demoClientIds.length} demo clients to remove:`, demoClientsResult.rows);

    if (demoClientIds.length === 0) {
      console.log('✅ No demo clients found - database already clean');
      await db.query('ROLLBACK');
      return result;
    }

    // 2. Remove dependent records in correct order (respecting foreign key constraints)
    
    // Budget transactions
    const budgetTxResult = await db.query(`
      DELETE FROM budget_transactions 
      WHERE "clientId" = ANY($1)
    `, [demoClientIds]);
    result.budgetTransactions = budgetTxResult.rowCount || 0;

    // Timesheet entries (via shifts)
    const timesheetResult = await db.query(`
      DELETE FROM timesheet_entries 
      WHERE shift_id IN (
        SELECT id FROM shifts WHERE "clientId" = ANY($1)
      )
    `, [demoClientIds]);
    result.timesheetEntries = timesheetResult.rowCount || 0;

    // Case notes
    const caseNotesResult = await db.query(`
      DELETE FROM case_notes 
      WHERE "clientId" = ANY($1)
    `, [demoClientIds]);
    result.caseNotes = caseNotesResult.rowCount || 0;

    // Medication records
    const medicationResult = await db.query(`
      DELETE FROM medication_records 
      WHERE "clientId" = ANY($1)
    `, [demoClientIds]);
    result.medicationRecords = medicationResult.rowCount || 0;

    // Incident reports
    const incidentResult = await db.query(`
      DELETE FROM incident_reports 
      WHERE "clientId" = ANY($1)
    `, [demoClientIds]);
    result.incidentReports = incidentResult.rowCount || 0;

    // Observations
    const observationsResult = await db.query(`
      DELETE FROM observations 
      WHERE "clientId" = ANY($1)
    `, [demoClientIds]);
    result.observations = observationsResult.rowCount || 0;

    // NDIS budgets
    const budgetsResult = await db.query(`
      DELETE FROM ndis_budgets 
      WHERE "clientId" = ANY($1)
    `, [demoClientIds]);
    result.ndisBudgets = budgetsResult.rowCount || 0;

    // Shifts
    const shiftsResult = await db.query(`
      DELETE FROM shifts 
      WHERE "clientId" = ANY($1)
    `, [demoClientIds]);
    result.shifts = shiftsResult.rowCount || 0;

    // Finally, remove demo clients
    const clientsResult = await db.query(`
      DELETE FROM clients 
      WHERE id = ANY($1)
    `, [demoClientIds]);
    result.clients = clientsResult.rowCount || 0;

    // Commit transaction
    await db.query('COMMIT');

    console.log('✅ PRODUCTION DEMO DATA CLEANUP COMPLETED:', result);
    return result;

  } catch (error) {
    // Rollback on error
    await db.query('ROLLBACK');
    console.error('❌ CLEANUP FAILED - ROLLED BACK:', error);
    throw error;
  }
}

/**
 * Verification function to check if demo data still exists
 */
export async function verifyProductionCleanup(): Promise<{ isClean: boolean; remainingDemo: any[] }> {
  try {
    const remainingDemo = await db.query(`
      SELECT id, firstName, lastName, email, tenantId 
      FROM clients 
      WHERE firstName ILIKE '%test%' 
         OR firstName ILIKE '%demo%' 
         OR lastName ILIKE '%sample%'
         OR email ILIKE '%test%'
         OR email ILIKE '%demo%'
    `);

    return {
      isClean: remainingDemo.rows.length === 0,
      remainingDemo: remainingDemo.rows
    };
  } catch (error) {
    console.error('Verification failed:', error);
    throw error;
  }
}