/**
 * COMPOSITE FOREIGN KEY MIGRATION UTILITY
 * Applies database-level tenant isolation through composite foreign keys
 * Addresses critical security gap in multi-tenant architecture
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

export async function applyCompositeForeignKeys(): Promise<void> {
  const pool = new Pool({ connectionString: DATABASE_URL });
  
  try {
    console.log('[COMPOSITE FK MIGRATION] Starting database-level tenant isolation enforcement...');
    
    // Read the migration SQL file
    const migrationPath = join(__dirname, 'composite-foreign-key-migration.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    // Execute the migration in a transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      console.log('[COMPOSITE FK MIGRATION] Step 1: Adding composite unique constraints...');
      
      // Split the migration into logical chunks for better error reporting
      const sqlChunks = migrationSQL.split('-- =======================');
      
      for (let i = 0; i < sqlChunks.length; i++) {
        const chunk = sqlChunks[i].trim();
        if (chunk && !chunk.startsWith('--')) {
          try {
            console.log(`[COMPOSITE FK MIGRATION] Executing chunk ${i + 1}/${sqlChunks.length}...`);
            await client.query(chunk);
          } catch (error: any) {
            console.error(`[COMPOSITE FK MIGRATION] Error in chunk ${i + 1}:`, error.message);
            // Continue with other chunks for non-critical errors
            if (error.message.includes('already exists') || error.message.includes('does not exist')) {
              console.log(`[COMPOSITE FK MIGRATION] Skipping non-critical error in chunk ${i + 1}`);
              continue;
            }
            throw error;
          }
        }
      }
      
      await client.query('COMMIT');
      console.log('[COMPOSITE FK MIGRATION] ✅ Migration completed successfully!');
      
      // Verify the constraints were applied
      await verifyCompositeConstraints(client);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[COMPOSITE FK MIGRATION] ❌ Migration failed, rolling back:', error);
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('[COMPOSITE FK MIGRATION] Fatal error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

async function verifyCompositeConstraints(client: any): Promise<void> {
  console.log('[COMPOSITE FK MIGRATION] Verifying composite foreign key constraints...');
  
  const verificationQuery = `
    SELECT 
      tc.table_name, 
      tc.constraint_name, 
      string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns,
      ccu.table_name AS referenced_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_schema = 'public'
      AND kcu.column_name LIKE '%tenant%'
    GROUP BY tc.table_name, tc.constraint_name, ccu.table_name
    ORDER BY tc.table_name;
  `;
  
  try {
    const result = await client.query(verificationQuery);
    console.log(`[COMPOSITE FK MIGRATION] ✅ Found ${result.rows.length} composite foreign key constraints:`);
    
    result.rows.forEach((row: any) => {
      console.log(`  - ${row.table_name}.${row.columns} → ${row.referenced_table}`);
    });
    
    if (result.rows.length === 0) {
      console.warn('[COMPOSITE FK MIGRATION] ⚠️  No composite foreign keys found. Migration may need manual review.');
    }
    
  } catch (error) {
    console.error('[COMPOSITE FK MIGRATION] Error verifying constraints:', error);
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  applyCompositeForeignKeys()
    .then(() => {
      console.log('[COMPOSITE FK MIGRATION] Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[COMPOSITE FK MIGRATION] Migration failed:', error);
      process.exit(1);
    });
}