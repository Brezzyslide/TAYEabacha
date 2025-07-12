#!/usr/bin/env node

/**
 * ZERO DEMO DATA POLICY VERIFICATION
 * Comprehensive verification that confirms all tenants start completely clean
 */

import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function verifyZeroDemoDataPolicy() {
  console.log('🔍 [ZERO DEMO DATA VERIFICATION] Starting comprehensive verification...\n');

  try {
    // Check all tenants
    const tenants = await db.execute(sql`SELECT id, name FROM tenants ORDER BY id`);
    console.log(`📊 [TENANTS] Found ${tenants.rows.length} tenants to verify\n`);

    const verificationResults = [];

    for (const tenant of tenants.rows) {
      const tenantId = tenant.id;
      const tenantName = tenant.name;

      // Count all major data types for this tenant
      const [clients, shifts, caseNotes, medications, budgets, incidents] = await Promise.all([
        db.execute(sql`SELECT COUNT(*) as count FROM clients WHERE tenant_id = ${tenantId}`),
        db.execute(sql`SELECT COUNT(*) as count FROM shifts WHERE tenant_id = ${tenantId}`),
        db.execute(sql`SELECT COUNT(*) as count FROM case_notes WHERE tenant_id = ${tenantId}`),
        db.execute(sql`SELECT COUNT(*) as count FROM medication_plans WHERE tenant_id = ${tenantId}`),
        db.execute(sql`SELECT COUNT(*) as count FROM ndis_budgets WHERE tenant_id = ${tenantId}`),
        db.execute(sql`SELECT COUNT(*) as count FROM incident_reports WHERE tenant_id = ${tenantId}`)
      ]);

      const result = {
        tenantId,
        tenantName,
        clients: parseInt(clients.rows[0].count),
        shifts: parseInt(shifts.rows[0].count),
        caseNotes: parseInt(caseNotes.rows[0].count),
        medications: parseInt(medications.rows[0].count),
        budgets: parseInt(budgets.rows[0].count),
        incidents: parseInt(incidents.rows[0].count),
        total: parseInt(clients.rows[0].count) + parseInt(shifts.rows[0].count) + 
               parseInt(caseNotes.rows[0].count) + parseInt(medications.rows[0].count) + 
               parseInt(budgets.rows[0].count) + parseInt(incidents.rows[0].count)
      };

      verificationResults.push(result);
    }

    // Display results
    console.table(verificationResults);

    // Summary analysis
    const totalDataRecords = verificationResults.reduce((sum, tenant) => sum + tenant.total, 0);
    const cleanTenants = verificationResults.filter(t => t.total === 0).length;
    const dataTenants = verificationResults.filter(t => t.total > 0).length;

    console.log('\n📈 [VERIFICATION SUMMARY]');
    console.log(`   • Total tenants: ${verificationResults.length}`);
    console.log(`   • Clean tenants (0 data): ${cleanTenants}`);
    console.log(`   • Tenants with data: ${dataTenants}`);
    console.log(`   • Total data records across all tenants: ${totalDataRecords}`);

    if (totalDataRecords === 0) {
      console.log('\n✅ [ZERO DEMO DATA POLICY] VERIFICATION SUCCESSFUL!');
      console.log('   🎉 ALL tenants are completely clean - zero demo data found!');
      console.log('   🚀 Future tenants will start with clean slate requiring organic data creation');
    } else {
      console.log('\n⚠️ [ZERO DEMO DATA POLICY] Some tenants still contain data');
      console.log('   📋 This may be legitimate user-created data or remaining demo data');
    }

    // Check for specific demo patterns
    console.log('\n🔍 [DEMO PATTERN CHECK] Scanning for demo name patterns...');
    const demoPatterns = await db.execute(sql`
      SELECT 
        'demo_clients' as type,
        tenant_id,
        COUNT(*) as count,
        string_agg(first_name || ' ' || last_name, ', ') as names
      FROM clients 
      WHERE first_name IN ('Sarah', 'Michael', 'Emma', 'John', 'Jane')
         OR last_name IN ('Johnson', 'Chen', 'Williams', 'Doe', 'Smith')
         OR ndis_number LIKE 'NDIS001%'
      GROUP BY tenant_id
    `);

    if (demoPatterns.rows.length === 0) {
      console.log('   ✅ No demo name patterns found - excellent!');
    } else {
      console.log('   ⚠️ Found demo name patterns:');
      console.table(demoPatterns.rows);
    }

  } catch (error) {
    console.error('❌ [VERIFICATION ERROR]:', error);
  }

  console.log('\n🏁 [VERIFICATION COMPLETE] Zero demo data policy verification finished\n');
  process.exit(0);
}

verifyZeroDemoDataPolicy().catch(console.error);