#!/usr/bin/env node

/**
 * EMERGENCY CLEANUP ENDPOINT IMPLEMENTATION
 * Creates an API endpoint for ConsoleManager users to eliminate demo data
 */

// This would be added to server/routes.ts
const emergencyCleanupCode = `
  // Emergency demo data cleanup endpoint (ConsoleManager only)
  app.post("/api/emergency-cleanup", requireAuth, async (req: any, res) => {
    try {
      // Only ConsoleManager users can execute emergency cleanup
      if (req.user.role !== 'ConsoleManager') {
        return res.status(403).json({ 
          message: "Emergency cleanup requires ConsoleManager access",
          userRole: req.user.role 
        });
      }
      
      console.log(\`🚨 [EMERGENCY CLEANUP] Initiated by \${req.user.username} (Tenant: \${req.user.tenantId})\`);
      
      // Start transaction for safe cleanup
      await pool.query('BEGIN');
      
      // Get all demo client IDs
      const demoClientsResult = await pool.query(\`
        SELECT id, first_name, last_name, tenant_id
        FROM clients 
        WHERE first_name IN ('Sarah', 'Michael', 'Emma', 'John', 'Jane', 'Test', 'Demo')
           OR last_name IN ('Johnson', 'Chen', 'Williams', 'Doe', 'Smith', 'Test', 'Demo')
           OR ndis_number LIKE 'NDIS001%'
        ORDER BY id
      \`);
      
      const demoClientIds = demoClientsResult.rows.map(row => row.id);
      
      if (demoClientIds.length === 0) {
        await pool.query('ROLLBACK');
        return res.json({ 
          success: true, 
          message: "Database already clean - no demo data found",
          eliminated: { clients: 0, total: 0 }
        });
      }
      
      console.log(\`🎯 [EMERGENCY CLEANUP] Found \${demoClientIds.length} demo clients to eliminate\`);
      
      // Delete dependent records in correct order
      const budgetTxResult = await pool.query(\`DELETE FROM budget_transactions WHERE shift_id IN (SELECT id FROM shifts WHERE client_id = ANY($1))\`, [demoClientIds]);
      const timesheetResult = await pool.query(\`DELETE FROM timesheet_entries WHERE shift_id IN (SELECT id FROM shifts WHERE client_id = ANY($1))\`, [demoClientIds]);
      const carePlansResult = await pool.query(\`DELETE FROM care_support_plans WHERE client_id = ANY($1)\`, [demoClientIds]);
      const caseNotesResult = await pool.query(\`DELETE FROM case_notes WHERE client_id = ANY($1)\`, [demoClientIds]);
      const medicationResult = await pool.query(\`DELETE FROM medication_records WHERE client_id = ANY($1)\`, [demoClientIds]);
      const medPlansResult = await pool.query(\`DELETE FROM medication_plans WHERE client_id = ANY($1)\`, [demoClientIds]);
      const incidentResult = await pool.query(\`DELETE FROM incident_reports WHERE client_id = ANY($1)\`, [demoClientIds]);
      const observationsResult = await pool.query(\`DELETE FROM hourly_observations WHERE client_id = ANY($1)\`, [demoClientIds]);
      const budgetsResult = await pool.query(\`DELETE FROM ndis_budgets WHERE client_id = ANY($1)\`, [demoClientIds]);
      const shiftsResult = await pool.query(\`DELETE FROM shifts WHERE client_id = ANY($1)\`, [demoClientIds]);
      const clientsResult = await pool.query(\`DELETE FROM clients WHERE id = ANY($1)\`, [demoClientIds]);
      
      await pool.query('COMMIT');
      
      const result = {
        clients: clientsResult.rowCount || 0,
        shifts: shiftsResult.rowCount || 0,
        caseNotes: caseNotesResult.rowCount || 0,
        medications: medPlansResult.rowCount || 0,
        budgets: budgetsResult.rowCount || 0,
        carePlans: carePlansResult.rowCount || 0,
        total: (clientsResult.rowCount || 0) + (shiftsResult.rowCount || 0) + (caseNotesResult.rowCount || 0)
      };
      
      console.log(\`✅ [EMERGENCY CLEANUP] Successfully eliminated \${result.total} demo records\`);
      
      res.json({ 
        success: true, 
        message: "Emergency demo data cleanup completed successfully",
        eliminated: result
      });
      
    } catch (error) {
      await pool.query('ROLLBACK');
      console.error('❌ [EMERGENCY CLEANUP] Failed:', error);
      res.status(500).json({ 
        success: false, 
        message: "Emergency cleanup failed", 
        error: error.message 
      });
    }
  });
`;

console.log("Emergency cleanup endpoint code ready for implementation:");
console.log(emergencyCleanupCode);