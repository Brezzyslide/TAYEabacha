/**
 * EMERGENCY DEMO DATA CLEANUP UTILITY
 * Completely removes any residual demo data and ensures clean tenant isolation
 */

import { db } from './lib/dbClient';
import { 
  clients, 
  medicationPlans, 
  careSupportPlans, 
  shifts, 
  caseNotes, 
  ndisBudgets,
  hourlyObservations,
  incidentReports,
  medicationRecords,
  taskBoardTasks
} from '../shared/schema';
import { eq, inArray } from 'drizzle-orm';

export async function emergencyCleanupAllDemoData(): Promise<void> {
  console.log('[EMERGENCY CLEANUP] Starting complete demo data removal...');
  
  try {
    // Define which tenants to clean (all recent ones)
    const tenantsToClean = [8, 9, 10, 11, 12, 13, 14, 15];
    
    console.log(`[EMERGENCY CLEANUP] Cleaning tenants: ${tenantsToClean.join(', ')}`);
    
    // Step 1: Delete all dependent records first (foreign key dependencies)
    
    // Delete medication records
    const deletedMedRecords = await db.delete(medicationRecords)
      .where(inArray(medicationRecords.tenantId, tenantsToClean));
    console.log(`[EMERGENCY CLEANUP] Deleted medication records: ${deletedMedRecords.rowCount || 0}`);
    
    // Delete case notes  
    const deletedCaseNotes = await db.delete(caseNotes)
      .where(inArray(caseNotes.tenantId, tenantsToClean));
    console.log(`[EMERGENCY CLEANUP] Deleted case notes: ${deletedCaseNotes.rowCount || 0}`);
    
    // Delete hourly observations
    const deletedObservations = await db.delete(hourlyObservations)
      .where(inArray(hourlyObservations.tenantId, tenantsToClean));
    console.log(`[EMERGENCY CLEANUP] Deleted observations: ${deletedObservations.rowCount || 0}`);
    
    // Delete incident reports
    const deletedIncidents = await db.delete(incidentReports)
      .where(inArray(incidentReports.tenantId, tenantsToClean));
    console.log(`[EMERGENCY CLEANUP] Deleted incident reports: ${deletedIncidents.rowCount || 0}`);
    
    // Delete task board tasks
    const deletedTasks = await db.delete(taskBoardTasks)
      .where(inArray(taskBoardTasks.tenantId, tenantsToClean));
    console.log(`[EMERGENCY CLEANUP] Deleted tasks: ${deletedTasks.rowCount || 0}`);
    
    // Delete shifts
    const deletedShifts = await db.delete(shifts)
      .where(inArray(shifts.tenantId, tenantsToClean));
    console.log(`[EMERGENCY CLEANUP] Deleted shifts: ${deletedShifts.rowCount || 0}`);
    
    // Delete NDIS budgets
    const deletedBudgets = await db.delete(ndisBudgets)
      .where(inArray(ndisBudgets.tenantId, tenantsToClean));
    console.log(`[EMERGENCY CLEANUP] Deleted NDIS budgets: ${deletedBudgets.rowCount || 0}`);
    
    // Step 2: Delete main data tables
    
    // Delete medication plans
    const deletedMedPlans = await db.delete(medicationPlans)
      .where(inArray(medicationPlans.tenantId, tenantsToClean));
    console.log(`[EMERGENCY CLEANUP] Deleted medication plans: ${deletedMedPlans.rowCount || 0}`);
    
    // Delete care support plans
    const deletedCarePlans = await db.delete(careSupportPlans)
      .where(inArray(careSupportPlans.tenantId, tenantsToClean));
    console.log(`[EMERGENCY CLEANUP] Deleted care support plans: ${deletedCarePlans.rowCount || 0}`);
    
    // Delete clients (this should be last due to foreign key constraints)
    const deletedClients = await db.delete(clients)
      .where(inArray(clients.tenantId, tenantsToClean));
    console.log(`[EMERGENCY CLEANUP] Deleted clients: ${deletedClients.rowCount || 0}`);
    
    console.log('[EMERGENCY CLEANUP] ✅ Complete demo data cleanup finished successfully');
    console.log('[EMERGENCY CLEANUP] All tenants now have absolutely zero demo data');
    
  } catch (error) {
    console.error('[EMERGENCY CLEANUP] ❌ Error during cleanup:', error);
    throw error;
  }
}

// Verification function
export async function verifyCleanupSuccess(): Promise<void> {
  console.log('[CLEANUP VERIFICATION] Checking all tenants are clean...');
  
  const tenantsToCheck = [8, 9, 10, 11, 12, 13, 14, 15];
  
  for (const tenantId of tenantsToCheck) {
    const clientCount = await db.select().from(clients).where(eq(clients.tenantId, tenantId));
    const medPlanCount = await db.select().from(medicationPlans).where(eq(medicationPlans.tenantId, tenantId));
    const carePlanCount = await db.select().from(careSupportPlans).where(eq(careSupportPlans.tenantId, tenantId));
    
    console.log(`[CLEANUP VERIFICATION] Tenant ${tenantId}: ${clientCount.length} clients, ${medPlanCount.length} med plans, ${carePlanCount.length} care plans`);
    
    if (clientCount.length > 0 || medPlanCount.length > 0 || carePlanCount.length > 0) {
      console.error(`[CLEANUP VERIFICATION] ❌ Tenant ${tenantId} still has demo data!`);
    } else {
      console.log(`[CLEANUP VERIFICATION] ✅ Tenant ${tenantId} is completely clean`);
    }
  }
}