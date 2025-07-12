#!/usr/bin/env node

/**
 * PHANTOM CLIENT DEBUG SCRIPT
 * Tests for API layer phantom data responses vs actual database content
 * Helps isolate the source of demo data discrepancy
 */

import { db, pool } from './server/db.js';
import { sql } from 'drizzle-orm';

async function debugPhantomClients() {
  console.log('🔍 [PHANTOM DEBUG] Starting comprehensive client debugging...\n');

  // Test tenant 12 (TRUMP company)
  const tenantId = 12;
  
  console.log(`📊 [RAW DATABASE QUERY] Direct database queries for tenant ${tenantId}:`);
  
  try {
    // Direct database queries
    const clientCountRaw = await db.execute(sql`SELECT COUNT(*) as count FROM clients WHERE tenant_id = ${tenantId}`);
    console.log(`   • Total clients (including inactive): ${clientCountRaw.rows[0].count}`);
    
    const activeClientCountRaw = await db.execute(sql`SELECT COUNT(*) as count FROM clients WHERE tenant_id = ${tenantId} AND is_active = true`);
    console.log(`   • Active clients only: ${activeClientCountRaw.rows[0].count}`);
    
    const allClientsRaw = await db.execute(sql`SELECT id, first_name, last_name, ndis_number, tenant_id, is_active, created_at FROM clients WHERE tenant_id = ${tenantId} ORDER BY id`);
    console.log(`   • All client records for tenant ${tenantId}:`, allClientsRaw.rows);
    
    // Check if there are any clients with NULL tenant_id
    const nullTenantClients = await db.execute(sql`SELECT COUNT(*) as count FROM clients WHERE tenant_id IS NULL`);
    console.log(`   • Clients with NULL tenant_id: ${nullTenantClients.rows[0].count}`);
    
    // Check recent client creations
    const recentClients = await db.execute(sql`SELECT id, first_name, last_name, tenant_id, created_at FROM clients WHERE created_at > NOW() - INTERVAL '1 hour' ORDER BY created_at DESC`);
    console.log(`   • Clients created in last hour: ${recentClients.rows.length}`);
    if (recentClients.rows.length > 0) {
      console.table(recentClients.rows);
    }
    
  } catch (error) {
    console.error('❌ [DATABASE ERROR]:', error);
  }
  
  // Test storage layer
  console.log(`\n🏪 [STORAGE LAYER TEST] Testing storage.getClients(${tenantId}):`);
  try {
    const { DatabaseStorage } = await import('./server/storage.js');
    const storage = new DatabaseStorage();
    const storageClients = await storage.getClients(tenantId);
    console.log(`   • Storage layer returned ${storageClients.length} clients`);
    if (storageClients.length > 0) {
      console.table(storageClients.map(c => ({
        id: c.id,
        fullName: c.fullName,
        ndisNumber: c.ndisNumber,
        tenantId: c.tenantId,
        isActive: c.isActive
      })));
    }
  } catch (error) {
    console.error('❌ [STORAGE ERROR]:', error);
  }
  
  // Check database connection info
  console.log(`\n🔌 [CONNECTION INFO] Database connection details:`);
  try {
    const connInfo = await db.execute(sql`SELECT current_database(), current_user, inet_server_addr() as server_ip, version()`);
    console.log('   • Connection info:', connInfo.rows[0]);
  } catch (error) {
    console.error('❌ [CONNECTION ERROR]:', error);
  }
  
  // Check for database triggers or functions that might create demo data
  console.log(`\n⚡ [TRIGGER CHECK] Checking for database triggers that might create demo data:`);
  try {
    const triggers = await db.execute(sql`
      SELECT trigger_name, table_name, action_timing, event_manipulation, action_statement 
      FROM information_schema.triggers 
      WHERE table_name = 'clients' OR table_name = 'tenants'
    `);
    console.log(`   • Found ${triggers.rows.length} triggers on clients/tenants tables:`);
    if (triggers.rows.length > 0) {
      console.table(triggers.rows);
    }
  } catch (error) {
    console.error('❌ [TRIGGER ERROR]:', error);
  }
  
  console.log('\n✅ [PHANTOM DEBUG] Debug complete!\n');
  process.exit(0);
}

debugPhantomClients().catch(console.error);