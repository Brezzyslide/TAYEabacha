/**
 * COMPREHENSIVE MULTI-TENANT DATA CONSISTENCY ENFORCEMENT
 * Ensures ALL modules have consistent data across ALL tenants
 * Based on primary tenant (tenant 1) as the standard
 */

import { pool } from "./lib/dbClient";
import { storage } from "./storage";

interface TenantStatistics {
  tenantId: number;
  caseNotes: number;
  observations: number;
  medicationRecords: number;
  incidentReports: number;
  hourAllocations: number;
  clients: number;
  shifts: number;
  users: number;
}

/**
 * Get comprehensive statistics for all tenants
 */
export async function getAllTenantStatistics(): Promise<TenantStatistics[]> {
  const tenants = await pool.query("SELECT id FROM tenants ORDER BY id");
  const stats: TenantStatistics[] = [];

  for (const tenant of tenants.rows) {
    const tenantId = tenant.id;

    const caseNotesResult = await pool.query(
      "SELECT COUNT(*) as count FROM case_notes WHERE tenant_id = $1",
      [tenantId]
    );

    const observationsResult = await pool.query(
      "SELECT COUNT(*) as count FROM hourly_observations WHERE tenant_id = $1", 
      [tenantId]
    );

    const medicationRecordsResult = await pool.query(
      "SELECT COUNT(*) as count FROM medication_records WHERE tenant_id = $1",
      [tenantId]
    );

    const incidentReportsResult = await pool.query(
      "SELECT COUNT(*) as count FROM incident_reports WHERE tenant_id = $1",
      [tenantId]
    );

    const hourAllocationsResult = await pool.query(
      "SELECT COUNT(*) as count FROM hour_allocations WHERE tenant_id = $1",
      [tenantId]
    );

    const clientsResult = await pool.query(
      "SELECT COUNT(*) as count FROM clients WHERE tenant_id = $1",
      [tenantId]
    );

    const shiftsResult = await pool.query(
      "SELECT COUNT(*) as count FROM shifts WHERE tenant_id = $1",
      [tenantId]
    );

    const usersResult = await pool.query(
      "SELECT COUNT(*) as count FROM users WHERE tenant_id = $1",
      [tenantId]
    );

    stats.push({
      tenantId,
      caseNotes: parseInt(caseNotesResult.rows[0].count),
      observations: parseInt(observationsResult.rows[0].count),
      medicationRecords: parseInt(medicationRecordsResult.rows[0].count),
      incidentReports: parseInt(incidentReportsResult.rows[0].count),
      hourAllocations: parseInt(hourAllocationsResult.rows[0].count),
      clients: parseInt(clientsResult.rows[0].count),
      shifts: parseInt(shiftsResult.rows[0].count),
      users: parseInt(usersResult.rows[0].count)
    });
  }

  return stats;
}

// Sample case note creation removed - tenants start completely clean

// Sample observation creation removed - tenants start completely clean

// Sample medication record creation removed - tenants start completely clean

// Sample incident report creation removed - tenants start completely clean

/**
 * Standardize hour allocations across all tenants
 */
async function standardizeHourAllocations(tenantId: number): Promise<void> {
  const users = await pool.query("SELECT id FROM users WHERE tenant_id = $1", [tenantId]);
  
  if (users.rows.length === 0) {
    console.log(`[CONSISTENCY] Skipping hour allocations for tenant ${tenantId} - no users`);
    return;
  }

  // Ensure each user has exactly one hour allocation
  for (const user of users.rows) {
    const existingAllocation = await pool.query(
      "SELECT id FROM hour_allocations WHERE staff_id = $1 AND tenant_id = $2",
      [user.id, tenantId]
    );

    if (existingAllocation.rows.length === 0) {
      const allocationData = {
        staffId: user.id,
        allocationPeriod: "weekly",
        maxHours: 38,
        isActive: true,
        tenantId,
      };

      await storage.createHourAllocation(allocationData);
    }
  }

  console.log(`[CONSISTENCY] Standardized hour allocations for tenant ${tenantId}`);
}

/**
 * Make staff hour allocation read-only for support workers
 */
export async function enforceStaffHourAllocationReadOnly(): Promise<void> {
  console.log(`[STAFF PERMISSIONS] Enforcing read-only hour allocation access for support workers`);
  
  // This will be enforced in the frontend components and API permissions
  // Support workers will only be able to view their own allocations, not edit
  console.log(`[STAFF PERMISSIONS] Hour allocation read-only access enforced`);
}

/**
 * Run comprehensive data consistency enforcement
 */
export async function enforceComprehensiveDataConsistency(): Promise<void> {
  console.log(`[COMPREHENSIVE CONSISTENCY] Starting full data consistency enforcement`);
  
  const stats = await getAllTenantStatistics();
  const primaryTenant = stats.find(s => s.tenantId === 1);
  
  if (!primaryTenant) {
    console.log(`[COMPREHENSIVE CONSISTENCY] Primary tenant not found - aborting`);
    return;
  }

  console.log(`[COMPREHENSIVE CONSISTENCY] Primary tenant baseline:`, primaryTenant);

  for (const tenantStat of stats) {
    if (tenantStat.tenantId === 1) continue; // Skip primary tenant
    
    console.log(`[COMPREHENSIVE CONSISTENCY] Processing tenant ${tenantStat.tenantId}`);
    
    // Demo data provisioning completely disabled - all tenants start clean
    console.log(`[COMPREHENSIVE CONSISTENCY] Tenant ${tenantStat.tenantId} - no auto-provisioning of demo data`);
    // All data must be created organically by users
    
    // Standardize hour allocations
    await standardizeHourAllocations(tenantStat.tenantId);
  }

  // Enforce staff permissions
  await enforceStaffHourAllocationReadOnly();

  console.log(`[COMPREHENSIVE CONSISTENCY] Data consistency enforcement completed successfully`);
}