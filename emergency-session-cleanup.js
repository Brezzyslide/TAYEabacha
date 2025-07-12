/**
 * EMERGENCY SESSION AND AUTHENTICATION CLEANUP
 * Fixes corrupted session data causing demo data display
 */

import pg from 'pg';
const { Pool } = pg;

async function emergencyCleanup() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('[EMERGENCY] Starting session and authentication cleanup...');

    // 1. Clear all corrupted sessions
    await pool.query('DELETE FROM session');
    console.log('[EMERGENCY] ✅ Cleared all sessions');

    // 2. Verify actual database state - check all tenants and users
    const tenants = await pool.query('SELECT id, name FROM tenants ORDER BY id');
    console.log(`[EMERGENCY] Found ${tenants.rows.length} tenants:`);
    console.table(tenants.rows);

    // 3. Check for any orphaned or duplicate data
    const users = await pool.query(`
      SELECT u.id, u.username, u.tenant_id, t.name as tenant_name
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      WHERE u.username = 'new@new.com'
    `);
    
    if (users.rows.length > 0) {
      console.log('[EMERGENCY] ⚠️  Found user "new@new.com":');
      console.table(users.rows);
    } else {
      console.log('[EMERGENCY] ✅ No user "new@new.com" found (correct)');
    }

    // 4. Check for any clients (should be 0 across all tenants)
    const allClients = await pool.query(`
      SELECT tenant_id, COUNT(*) as client_count 
      FROM clients 
      GROUP BY tenant_id
      ORDER BY tenant_id
    `);
    
    if (allClients.rows.length > 0) {
      console.log('[EMERGENCY] ⚠️  Found clients in database:');
      console.table(allClients.rows);
    } else {
      console.log('[EMERGENCY] ✅ No clients found in any tenant (correct)');
    }

    // 5. Reset sequences to prevent ID conflicts
    await pool.query(`
      SELECT setval('tenants_id_seq', COALESCE((SELECT MAX(id) FROM tenants), 1), false);
      SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1), false);
      SELECT setval('clients_id_seq', COALESCE((SELECT MAX(id) FROM clients), 1), false);
    `);
    console.log('[EMERGENCY] ✅ Reset database sequences');

    console.log('\n[EMERGENCY] Cleanup completed successfully!');
    console.log('Next steps:');
    console.log('1. Refresh browser to clear client-side cache');
    console.log('2. Try creating a new company again');
    console.log('3. User should see clean slate with no demo data');

  } catch (error) {
    console.error('[EMERGENCY] Cleanup failed:', error);
  } finally {
    await pool.end();
  }
}

// Run cleanup
emergencyCleanup();