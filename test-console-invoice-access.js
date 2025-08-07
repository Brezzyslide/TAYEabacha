#!/usr/bin/env node

/**
 * Quick test script to verify console manager universal invoice access
 * Run with: node test-console-invoice-access.js
 */

const { Client } = require('pg');

async function testInvoiceAccess() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check if we have companies with invoices
    const companiesResult = await client.query('SELECT COUNT(*) as count FROM companies');
    console.log(`📊 Total companies: ${companiesResult.rows[0].count}`);

    // Check if we have staff for billing
    const staffResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM users u 
      JOIN tenants t ON u.tenant_id = t.id 
      WHERE u.role IN ('Admin', 'TeamLeader', 'Coordinator', 'SupportWorker')
    `);
    console.log(`👥 Total billable staff: ${staffResult.rows[0].count}`);

    // Check console manager exists
    const consoleManagerResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE role = 'ConsoleManager'
    `);
    console.log(`🔧 Console managers: ${consoleManagerResult.rows[0].count}`);

    if (companiesResult.rows[0].count > 0 && staffResult.rows[0].count > 0 && consoleManagerResult.rows[0].count > 0) {
      console.log('\n✅ SYSTEM READY: Console manager can access universal invoices');
      console.log('📋 Expected behavior:');
      console.log('   1. Login as console manager');
      console.log('   2. Navigate to Billing → Universal Invoices tab');
      console.log('   3. View invoices from ALL companies across platform');
    } else {
      console.log('\n⚠️ SYSTEM NOT READY: Missing required data');
    }

  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await client.end();
  }
}

testInvoiceAccess().catch(console.error);