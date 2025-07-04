/**
 * TENANT PROVISIONING VALIDATOR
 * Comprehensive validation system for ensuring tenant setup completeness
 */

import { storage } from "./storage";
import { EMPLOYMENT_TYPES } from "@shared/employmentTypes";

interface ProvisioningExpectations {
  hasAtLeast: {
    taxBrackets?: number;
    hourAllocations?: number;
    employmentTypes?: number;
    clients?: number;
    users?: number;
    payScales?: number;
    ndisPricing?: number;
    timesheets?: number;
  };
  hasExactly?: {
    [key: string]: number;
  };
}

interface ProvisioningCheckOptions {
  tenantId: string | number;
  expect: ProvisioningExpectations;
}

interface ProvisioningResult {
  tenantId: string | number;
  passed: boolean;
  results: {
    [key: string]: {
      expected: number;
      actual: number;
      passed: boolean;
    };
  };
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
  };
  errors: string[];
}

export async function checkProvisioning(options: ProvisioningCheckOptions): Promise<ProvisioningResult> {
  const { tenantId, expect } = options;
  const tenantIdNum = typeof tenantId === 'string' ? parseInt(tenantId) : tenantId;
  
  const result: ProvisioningResult = {
    tenantId,
    passed: false,
    results: {},
    summary: {
      totalChecks: 0,
      passedChecks: 0,
      failedChecks: 0
    },
    errors: []
  };

  try {
    console.log(`[PROVISIONING CHECK] Starting validation for tenant ${tenantId}`);

    // Check tax brackets (system-wide)
    if (expect.hasAtLeast?.taxBrackets !== undefined) {
      try {
        const taxBrackets = await storage.getTaxBrackets(2025);
        const count = taxBrackets.length;
        const expected = expect.hasAtLeast.taxBrackets;
        const passed = count >= expected;
        
        result.results.taxBrackets = { expected, actual: count, passed };
        result.summary.totalChecks++;
        if (passed) result.summary.passedChecks++;
        else result.summary.failedChecks++;
        
        console.log(`[PROVISIONING CHECK] Tax brackets: ${count}/${expected} ${passed ? '✓' : '✗'}`);
      } catch (error) {
        result.errors.push(`Tax brackets check failed: ${error}`);
      }
    }

    // Check hour allocations
    if (expect.hasAtLeast?.hourAllocations !== undefined) {
      try {
        const hourAllocations = await storage.getHourAllocations(tenantIdNum);
        const count = hourAllocations.length;
        const expected = expect.hasAtLeast.hourAllocations;
        const passed = count >= expected;
        
        result.results.hourAllocations = { expected, actual: count, passed };
        result.summary.totalChecks++;
        if (passed) result.summary.passedChecks++;
        else result.summary.failedChecks++;
        
        console.log(`[PROVISIONING CHECK] Hour allocations: ${count}/${expected} ${passed ? '✓' : '✗'}`);
      } catch (error) {
        result.errors.push(`Hour allocations check failed: ${error}`);
      }
    }

    // Check employment types (constant validation)
    if (expect.hasAtLeast?.employmentTypes !== undefined) {
      const count = EMPLOYMENT_TYPES.length;
      const expected = expect.hasAtLeast.employmentTypes;
      const passed = count >= expected;
      
      result.results.employmentTypes = { expected, actual: count, passed };
      result.summary.totalChecks++;
      if (passed) result.summary.passedChecks++;
      else result.summary.failedChecks++;
      
      console.log(`[PROVISIONING CHECK] Employment types: ${count}/${expected} ${passed ? '✓' : '✗'}`);
    }

    // Check clients
    if (expect.hasAtLeast?.clients !== undefined) {
      try {
        const clients = await storage.getClients(tenantIdNum);
        const count = clients.length;
        const expected = expect.hasAtLeast.clients;
        const passed = count >= expected;
        
        result.results.clients = { expected, actual: count, passed };
        result.summary.totalChecks++;
        if (passed) result.summary.passedChecks++;
        else result.summary.failedChecks++;
        
        console.log(`[PROVISIONING CHECK] Clients: ${count}/${expected} ${passed ? '✓' : '✗'}`);
      } catch (error) {
        result.errors.push(`Clients check failed: ${error}`);
      }
    }

    // Check users
    if (expect.hasAtLeast?.users !== undefined) {
      try {
        const users = await storage.getUsersByTenant(tenantIdNum);
        const count = users.length;
        const expected = expect.hasAtLeast.users;
        const passed = count >= expected;
        
        result.results.users = { expected, actual: count, passed };
        result.summary.totalChecks++;
        if (passed) result.summary.passedChecks++;
        else result.summary.failedChecks++;
        
        console.log(`[PROVISIONING CHECK] Users: ${count}/${expected} ${passed ? '✓' : '✗'}`);
      } catch (error) {
        result.errors.push(`Users check failed: ${error}`);
      }
    }

    // Check pay scales
    if (expect.hasAtLeast?.payScales !== undefined) {
      try {
        const payScales = await storage.getPayScales(tenantIdNum);
        const count = payScales.length;
        const expected = expect.hasAtLeast.payScales;
        const passed = count >= expected;
        
        result.results.payScales = { expected, actual: count, passed };
        result.summary.totalChecks++;
        if (passed) result.summary.passedChecks++;
        else result.summary.failedChecks++;
        
        console.log(`[PROVISIONING CHECK] Pay scales: ${count}/${expected} ${passed ? '✓' : '✗'}`);
      } catch (error) {
        result.errors.push(`Pay scales check failed: ${error}`);
      }
    }

    // Determine overall pass/fail
    result.passed = result.summary.failedChecks === 0 && result.summary.totalChecks > 0;
    
    console.log(`[PROVISIONING CHECK] Tenant ${tenantId} validation complete: ${result.passed ? 'PASSED' : 'FAILED'}`);
    console.log(`[PROVISIONING CHECK] Summary: ${result.summary.passedChecks}/${result.summary.totalChecks} checks passed`);
    
    if (result.errors.length > 0) {
      console.log(`[PROVISIONING CHECK] Errors encountered:`, result.errors);
    }

  } catch (error) {
    result.errors.push(`Provisioning check failed: ${error}`);
    console.error(`[PROVISIONING CHECK] Critical error for tenant ${tenantId}:`, error);
  }

  return result;
}

/**
 * Validate all active tenants
 */
export async function validateAllTenants(expectations: ProvisioningExpectations): Promise<ProvisioningResult[]> {
  try {
    const tenants = await storage.getTenants();
    const results: ProvisioningResult[] = [];
    
    for (const tenant of tenants) {
      const result = await checkProvisioning({
        tenantId: tenant.id,
        expect: expectations
      });
      results.push(result);
    }
    
    return results;
  } catch (error) {
    console.error('[PROVISIONING CHECK] Failed to validate all tenants:', error);
    return [];
  }
}

/**
 * Quick health check for essential provisioning
 */
export async function quickHealthCheck(tenantId: string | number): Promise<boolean> {
  const result = await checkProvisioning({
    tenantId,
    expect: {
      hasAtLeast: {
        taxBrackets: 3,
        hourAllocations: 1,
        employmentTypes: 3,
        users: 1,
        payScales: 1
      }
    }
  });
  
  return result.passed;
}

/**
 * Generate provisioning report
 */
export function generateProvisioningReport(results: ProvisioningResult[]): string {
  let report = "\n=== TENANT PROVISIONING REPORT ===\n\n";
  
  const totalTenants = results.length;
  const passedTenants = results.filter(r => r.passed).length;
  const failedTenants = totalTenants - passedTenants;
  
  report += `Overall Status: ${passedTenants}/${totalTenants} tenants fully provisioned\n`;
  report += `Success Rate: ${((passedTenants / totalTenants) * 100).toFixed(1)}%\n\n`;
  
  for (const result of results) {
    report += `Tenant ${result.tenantId}: ${result.passed ? '✓ PASSED' : '✗ FAILED'}\n`;
    
    for (const [check, data] of Object.entries(result.results)) {
      const status = data.passed ? '✓' : '✗';
      report += `  ${status} ${check}: ${data.actual}/${data.expected}\n`;
    }
    
    if (result.errors.length > 0) {
      report += `  Errors: ${result.errors.join(', ')}\n`;
    }
    
    report += '\n';
  }
  
  return report;
}