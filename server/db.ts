import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// AWS Production Database Override
const AWS_DATABASE_URL = "postgres://postgres:mypassword@54.80.195.220:5430/mydb";

// Use AWS database instead of Replit's database
const databaseUrl = AWS_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

console.log(`[DATABASE] Connecting to: ${databaseUrl.replace(/:[^:]*@/, ':***@')}`);

// Create pool with AWS database configuration using standard pg
export const pool = new Pool({ 
  connectionString: databaseUrl,
  ssl: false, // AWS database doesn't require SSL
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool, { schema });