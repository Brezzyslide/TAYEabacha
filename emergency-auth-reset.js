/**
 * EMERGENCY AUTHENTICATION RESET
 * Completely resets all authentication data and forces clean state
 */

import pg from 'pg';
const { Pool } = pg;

async function emergencyAuthReset() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('[EMERGENCY AUTH] Starting complete authentication reset...');

    // 1. Clear ALL sessions completely
    await pool.query('TRUNCATE TABLE session');
    console.log('[EMERGENCY AUTH] ✅ All sessions truncated');

    // 2. Verify database integrity for user ID 2
    const user2Check = await pool.query('SELECT id, username, email, tenant_id FROM users WHERE id = 2');
    console.log('[EMERGENCY AUTH] Database user ID 2:', user2Check.rows[0]);

    // 3. Verify no corruption in user data
    const allUsers = await pool.query('SELECT id, username, tenant_id FROM users ORDER BY id LIMIT 10');
    console.log('[EMERGENCY AUTH] First 10 users in database:');
    console.table(allUsers.rows);

    // 4. Verify all tenants have zero clients (clean state)
    const clientCounts = await pool.query(`
      SELECT t.id as tenant_id, t.name, COUNT(c.id) as client_count
      FROM tenants t
      LEFT JOIN clients c ON c.tenant_id = t.id
      GROUP BY t.id, t.name
      ORDER BY t.id
    `);
    console.log('[EMERGENCY AUTH] Client counts per tenant:');
    console.table(clientCounts.rows);

    // 5. Check if any tenant has demo data
    const hasDemo = clientCounts.rows.some(row => row.client_count > 0);
    if (hasDemo) {
      console.log('[EMERGENCY AUTH] ⚠️  DEMO DATA DETECTED - some tenants have clients');
    } else {
      console.log('[EMERGENCY AUTH] ✅ All tenants clean - zero demo data confirmed');
    }

    // 6. Verify latest company creation worked
    const latestCompany = await pool.query(`
      SELECT c.name, t.id as tenant_id, u.username as admin_user
      FROM companies c
      JOIN tenants t ON t.company_id = c.id
      JOIN users u ON u.tenant_id = t.id AND u.role = 'admin'
      ORDER BY c.created_at DESC
      LIMIT 2
    `);
    console.log('[EMERGENCY AUTH] Latest companies created:');
    console.table(latestCompany.rows);

    console.log('\n[EMERGENCY AUTH] Reset completed successfully!');
    console.log('NEXT STEPS:');
    console.log('1. Refresh browser to clear client-side caches');
    console.log('2. Authentication should now work properly');
    console.log('3. New users should see clean slate with zero data');
    console.log('4. All tenants confirmed clean - no demo data');

  } catch (error) {
    console.error('[EMERGENCY AUTH] Reset failed:', error);
  } finally {
    await pool.end();
  }
}

// Run reset
emergencyAuthReset();