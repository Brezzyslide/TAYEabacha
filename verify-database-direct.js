#!/usr/bin/env node

/**
 * DIRECT DATABASE VERIFICATION SYSTEM
 * Uses same database connection as the application to verify demo data
 */

import { pool } from './server/lib/dbClient.js';

async function verifyDatabaseDirect() {
  console.log('🔍 [DIRECT DB VERIFICATION] Starting direct database verification...\n');
  
  try {
    // Direct SQL query using application's database connection
    const clientsQuery = `
      SELECT 
        id,
        first_name,
        last_name,
        tenant_id,
        created_at,
        ndis_number
      FROM clients 
      WHERE first_name IN ('Sarah', 'Michael', 'Emma', 'John', 'Jane')
         OR last_name IN ('Johnson', 'Chen', 'Williams', 'Doe', 'Smith')
         OR ndis_number LIKE 'NDIS001%'
      ORDER BY tenant_id, id
    `;
    
    console.log('🔍 [QUERY] Executing direct demo client search...');
    const result = await pool.query(clientsQuery);
    
    console.log(`📊 [RESULTS] Found ${result.rows.length} demo clients in database`);
    
    if (result.rows.length === 0) {
      console.log('✅ [SUCCESS] DATABASE IS COMPLETELY CLEAN!');
      console.log('   🎉 No demo clients found in actual database');
      console.log('   🚀 All demo data elimination successful');
    } else {
      console.log('⚠️ [WARNING] Demo clients still exist:');
      console.table(result.rows);
    }
    
    // Check total clients per tenant
    const tenantsQuery = `
      SELECT 
        tenant_id,
        COUNT(*) as client_count,
        string_agg(first_name || ' ' || last_name, ', ') as client_names
      FROM clients 
      GROUP BY tenant_id
      ORDER BY tenant_id
    `;
    
    console.log('\n📈 [TENANT SUMMARY] Client distribution across tenants:');
    const tenantResult = await pool.query(tenantsQuery);
    console.table(tenantResult.rows);
    
    // Check database info
    const dbInfoQuery = `SELECT current_database(), current_user, inet_server_addr(), inet_server_port()`;
    const dbInfo = await pool.query(dbInfoQuery);
    console.log('\n🔗 [DATABASE INFO]', dbInfo.rows[0]);
    
  } catch (error) {
    console.error('❌ [ERROR]:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

verifyDatabaseDirect();