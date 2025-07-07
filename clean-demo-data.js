/**
 * EMERGENCY DEMO DATA CLEANUP SCRIPT
 * Use this to clean up tenants that received demo data when they shouldn't have
 * 
 * Usage: node clean-demo-data.js <tenantId>
 * Example: node clean-demo-data.js 10
 */

const { Pool } = require('pg');
require('dotenv').config();

async function cleanDemoData(tenantId) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log(`[CLEANUP] Starting demo data cleanup for tenant ${tenantId}`);
    
    // Delete in proper order to avoid foreign key constraint violations
    const deletions = [
      'case_notes',
      'medication_records', 
      'ndis_budgets',
      'shifts',
      'incident_reports',
      'hourly_observations',
      'clients'
    ];

    let totalDeleted = 0;
    
    for (const table of deletions) {
      const result = await pool.query(`DELETE FROM ${table} WHERE tenant_id = $1`, [tenantId]);
      console.log(`[CLEANUP] Deleted ${result.rowCount} records from ${table}`);
      totalDeleted += result.rowCount;
    }
    
    console.log(`[CLEANUP] Successfully removed ${totalDeleted} demo records from tenant ${tenantId}`);
    console.log(`[CLEANUP] Tenant ${tenantId} is now clean and ready for real data`);
    
  } catch (error) {
    console.error(`[CLEANUP] Error cleaning tenant ${tenantId}:`, error);
  } finally {
    await pool.end();
  }
}

// Get tenant ID from command line argument
const tenantId = process.argv[2];
if (!tenantId) {
  console.error('Usage: node clean-demo-data.js <tenantId>');
  process.exit(1);
}

cleanDemoData(parseInt(tenantId));