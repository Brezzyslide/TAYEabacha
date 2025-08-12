import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// Use AWS production database
const databaseUrl = process.env.AWS_DATABASE_URL || "postgres://postgres:mypassword@54.80.195.220:5430/mydb";

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

console.log(`[DATABASE] Connecting to: ${databaseUrl.replace(/:[^:]*@/, ':***@')}`);

// Create pool with Linux-compatible SSL configuration
export const pool = new Pool({ 
  connectionString: databaseUrl,
  // Adaptive SSL configuration for Linux/Docker deployment
  // First tries SSL, falls back to non-SSL if server doesn't support it
  ssl: (() => {
    if (process.env.DATABASE_SSL_DISABLED === 'true') return false;
    if (databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')) return false;
    // For cloud providers that support SSL but may have self-signed certs
    return { rejectUnauthorized: false };
  })(),
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const sslConfig = (() => {
  if (process.env.DATABASE_SSL_DISABLED === 'true') return 'disabled';
  if (databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')) return 'disabled (localhost)';
  return 'enabled with self-signed cert support';
})();

console.log(`[DATABASE] SSL configuration: ${sslConfig}`);
console.log('[DATABASE] Connection pool configured for Linux/Docker compatibility');

export const db = drizzle(pool, { schema });

// Verify compliance tables are included in schema
console.log("[SCHEMA DEBUG] Compliance tables in schema:", {
  downloadableForms: !!schema.downloadableForms,
  completedMedicationAuthorityForms: !!schema.completedMedicationAuthorityForms,
  evacuationDrills: !!schema.evacuationDrills
});