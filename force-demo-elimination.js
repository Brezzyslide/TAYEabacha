#!/usr/bin/env node

/**
 * FORCE DEMO DATA ELIMINATION
 * Nuclear option to remove all demo data respecting foreign key constraints
 */

import { pool } from './server/lib/dbClient.js';

async function forceDemoElimination() {
  console.log('🚨 [FORCE DEMO ELIMINATION] Starting nuclear demo data removal...\n');
  
  try {
    await pool.query('BEGIN');
    console.log('🔒 [TRANSACTION] Started transaction for safe demo data removal');

    // Get all demo client IDs first
    const demoClientsResult = await pool.query(`
      SELECT id, first_name, last_name, tenant_id
      FROM clients 
      WHERE first_name IN ('Sarah', 'Michael', 'Emma', 'John', 'Jane', 'Test', 'Demo')
         OR last_name IN ('Johnson', 'Chen', 'Williams', 'Doe', 'Smith', 'Test', 'Demo')
         OR ndis_number LIKE 'NDIS001%'
      ORDER BY id
    `);
    
    const demoClientIds = demoClientsResult.rows.map(row => row.id);
    console.log(`🎯 [TARGET] Found ${demoClientIds.length} demo clients to eliminate:`, demoClientIds);
    
    if (demoClientIds.length === 0) {
      console.log('✅ [CLEAN] No demo clients found - database already clean');
      await pool.query('ROLLBACK');
      return;
    }

    // Delete dependent records in correct order (respecting foreign key constraints)
    console.log('🗑️ [CLEANUP] Removing dependent records...');
    
    // 1. Budget transactions
    const budgetResult = await pool.query(`
      DELETE FROM budget_transactions 
      WHERE shift_id IN (
        SELECT id FROM shifts WHERE client_id = ANY($1)
      )
    `, [demoClientIds]);
    console.log(`   - Budget transactions: ${budgetResult.rowCount || 0} deleted`);

    // 2. Timesheet entries 
    const timesheetResult = await pool.query(`
      DELETE FROM timesheet_entries 
      WHERE shift_id IN (
        SELECT id FROM shifts WHERE client_id = ANY($1)
      )
    `, [demoClientIds]);
    console.log(`   - Timesheet entries: ${timesheetResult.rowCount || 0} deleted`);

    // 3. Care support plans (NEW - this was missing!)
    const carePlansResult = await pool.query(`
      DELETE FROM care_support_plans WHERE client_id = ANY($1)
    `, [demoClientIds]);
    console.log(`   - Care support plans: ${carePlansResult.rowCount || 0} deleted`);

    // 4. Case notes
    const caseNotesResult = await pool.query(`
      DELETE FROM case_notes WHERE client_id = ANY($1)
    `, [demoClientIds]);
    console.log(`   - Case notes: ${caseNotesResult.rowCount || 0} deleted`);

    // 5. Medication records
    const medicationResult = await pool.query(`
      DELETE FROM medication_records WHERE client_id = ANY($1)
    `, [demoClientIds]);
    console.log(`   - Medication records: ${medicationResult.rowCount || 0} deleted`);

    // 6. Medication plans
    const medPlansResult = await pool.query(`
      DELETE FROM medication_plans WHERE client_id = ANY($1)
    `, [demoClientIds]);
    console.log(`   - Medication plans: ${medPlansResult.rowCount || 0} deleted`);

    // 7. Incident reports
    const incidentResult = await pool.query(`
      DELETE FROM incident_reports WHERE client_id = ANY($1)
    `, [demoClientIds]);
    console.log(`   - Incident reports: ${incidentResult.rowCount || 0} deleted`);

    // 8. Hourly observations
    const observationsResult = await pool.query(`
      DELETE FROM hourly_observations WHERE client_id = ANY($1)
    `, [demoClientIds]);
    console.log(`   - Hourly observations: ${observationsResult.rowCount || 0} deleted`);

    // 9. NDIS budgets
    const budgetsResult = await pool.query(`
      DELETE FROM ndis_budgets WHERE client_id = ANY($1)
    `, [demoClientIds]);
    console.log(`   - NDIS budgets: ${budgetsResult.rowCount || 0} deleted`);

    // 10. Shifts (must be after timesheet entries and budget transactions)
    const shiftsResult = await pool.query(`
      DELETE FROM shifts WHERE client_id = ANY($1)
    `, [demoClientIds]);
    console.log(`   - Shifts: ${shiftsResult.rowCount || 0} deleted`);

    // 11. Finally, remove demo clients themselves
    const clientsResult = await pool.query(`
      DELETE FROM clients WHERE id = ANY($1)
    `, [demoClientIds]);
    console.log(`   - Demo clients: ${clientsResult.rowCount || 0} deleted`);

    // Commit the transaction
    await pool.query('COMMIT');
    console.log('✅ [SUCCESS] All demo data eliminated successfully!');
    
    // Verify the cleanup
    const verifyResult = await pool.query(`
      SELECT COUNT(*) as remaining_demo_clients
      FROM clients 
      WHERE first_name IN ('Sarah', 'Michael', 'Emma', 'John', 'Jane', 'Test', 'Demo')
         OR last_name IN ('Johnson', 'Chen', 'Williams', 'Doe', 'Smith', 'Test', 'Demo')
         OR ndis_number LIKE 'NDIS001%'
    `);
    
    console.log(`🔍 [VERIFICATION] Remaining demo clients: ${verifyResult.rows[0].remaining_demo_clients}`);
    
    if (verifyResult.rows[0].remaining_demo_clients === '0') {
      console.log('🎉 [COMPLETE] Demo data elimination SUCCESSFUL! Database is clean.');
    } else {
      console.log('⚠️ [WARNING] Some demo data still remains - may need additional cleanup');
    }

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ [ERROR] Demo elimination failed:', error);
    throw error;
  } finally {
    await pool.end();
    process.exit(0);
  }
}

forceDemoElimination();