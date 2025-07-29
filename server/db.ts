import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// Use local Replit database
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

console.log(`[DATABASE] Connecting to: ${databaseUrl.replace(/:[^:]*@/, ':***@')}`);

// Create pool with Neon database configuration using standard pg
export const pool = new Pool({ 
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool, { schema });

// Verify compliance tables are included in schema
console.log("[SCHEMA DEBUG] Compliance tables in schema:", {
  downloadableForms: !!schema.downloadableForms,
  completedMedicationAuthorityForms: !!schema.completedMedicationAuthorityForms,
  evacuationDrills: !!schema.evacuationDrills
});