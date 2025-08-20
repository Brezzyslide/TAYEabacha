import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// Use the provisioned database URL from Replit
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

console.log(`[DATABASE] Connecting to: ${databaseUrl.replace(/:[^:]*@/, ':***@')}`);

// Determine if this is an external database (AWS RDS, etc.) or Replit database
const isExternalDatabase = databaseUrl.includes('rds.amazonaws.com') || 
                           databaseUrl.includes('neon.tech') || 
                           databaseUrl.includes('supabase.') ||
                           !databaseUrl.includes('replit.dev');

// Determine SSL configuration based on database type
// Start with SSL disabled as many databases don't require it
let sslConfig = false;

// For AWS RDS connections, enable SSL with proper configuration
if (isExternalDatabase && databaseUrl.includes('rds.amazonaws.com')) {
  sslConfig = { rejectUnauthorized: false }; // Allow self-signed certs for AWS RDS
}

// Create pool with configuration for external or Replit databases
export const pool = new Pool({ 
  connectionString: databaseUrl,
  ssl: sslConfig,
  max: 20,                      // Increased pool size
  min: 2,                       // Minimum connections
  idleTimeoutMillis: 60000,     // Longer idle timeout (1 minute)
  connectionTimeoutMillis: 15000, // Longer connection timeout for external DBs
  allowExitOnIdle: false,       // Don't exit on idle
});

console.log(`[DATABASE] SSL configuration: ${isExternalDatabase ? 'enabled (external database)' : 'disabled (Replit database)'}`);
console.log(`[DATABASE] Connection pool configured for ${isExternalDatabase ? 'external' : 'Replit'} database`);

// Add connection event handlers for better error monitoring
pool.on('error', (err) => {
  console.error('[DATABASE] Pool error:', err);
});

pool.on('connect', () => {
  console.log('[DATABASE] New client connected');
});

pool.on('remove', () => {
  console.log('[DATABASE] Client removed from pool');
});

// Add graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('[DATABASE] Gracefully shutting down pool...');
  await pool.end();
  process.exit(0);
});

export const db = drizzle(pool, { schema });

// Verify compliance tables are included in schema
console.log("[SCHEMA DEBUG] Compliance tables in schema:", {
  downloadableForms: !!schema.downloadableForms,
  completedMedicationAuthorityForms: !!schema.completedMedicationAuthorityForms,
  evacuationDrills: !!schema.evacuationDrills
});

// Test database connection on startup
pool.connect()
  .then(client => {
    console.log('[DATABASE] Initial connection test successful');
    client.release();
  })
  .catch(err => {
    console.error('[DATABASE] Initial connection test failed:', err);
  });