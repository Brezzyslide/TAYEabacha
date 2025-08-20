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

// Create pool with improved configuration for development stability
export const pool = new Pool({ 
  connectionString: databaseUrl,
  // Replit databases don't use SSL by default
  ssl: false,
  max: 20,                      // Increased pool size
  min: 2,                       // Minimum connections
  idleTimeoutMillis: 60000,     // Longer idle timeout (1 minute)
  connectionTimeoutMillis: 10000, // Longer connection timeout (10 seconds)
  allowExitOnIdle: false,       // Don't exit on idle
});

console.log('[DATABASE] SSL configuration: disabled (Replit database)');
console.log('[DATABASE] Connection pool configured for Replit environment');

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