import { db } from "./lib/dbClient";
import { tenants, taxBrackets, hourAllocations, users, payScales } from "@shared/schema";
import { eq, count } from "drizzle-orm";

export interface ProvisioningExpectation {
  hasAtLeast: {
    taxBrackets?: number;
    hourAllocations?: number;
    employmentTypes?: number;
    users?: number;
    payScales?: number;
  };
}

export interface ProvisioningResult {
  tenantId: number;
  tenantName: string;
  passed: boolean;
  issues: string[];
  details: Record<string, any>;
}

export async function checkProvisioning(options: { tenantId: number; expect: ProvisioningExpectation }): Promise<ProvisioningResult> {
  const { tenantId, expect } = options;
  
  try {
    // Get tenant info
    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    if (!tenant.length) {
      return {
        tenantId,
        tenantName: "Unknown",
        passed: false,
        issues: ["Tenant not found"],
        details: {}
      };
    }

    const issues: string[] = [];
    const details: Record<string, any> = {};

    // Check tax brackets (tax brackets are global, not tenant-specific)
    if (expect.hasAtLeast.taxBrackets) {
      const taxBracketCount = await db.select({ count: count() }).from(taxBrackets);
      details.taxBrackets = taxBracketCount[0]?.count || 0;
      if (details.taxBrackets < expect.hasAtLeast.taxBrackets) {
        issues.push(`Expected at least ${expect.hasAtLeast.taxBrackets} tax brackets, found ${details.taxBrackets}`);
      }
    }

    // Check hour allocations
    if (expect.hasAtLeast.hourAllocations) {
      const hourAllocationCount = await db.select({ count: count() }).from(hourAllocations).where(eq(hourAllocations.tenantId, tenantId));
      details.hourAllocations = hourAllocationCount[0]?.count || 0;
      if (details.hourAllocations < expect.hasAtLeast.hourAllocations) {
        issues.push(`Expected at least ${expect.hasAtLeast.hourAllocations} hour allocations, found ${details.hourAllocations}`);
      }
    }

    // Check users
    if (expect.hasAtLeast.users) {
      const userCount = await db.select({ count: count() }).from(users).where(eq(users.tenantId, tenantId));
      details.users = userCount[0]?.count || 0;
      if (details.users < expect.hasAtLeast.users) {
        issues.push(`Expected at least ${expect.hasAtLeast.users} users, found ${details.users}`);
      }
    }

    // Check pay scales
    if (expect.hasAtLeast.payScales) {
      const payScaleCount = await db.select({ count: count() }).from(payScales).where(eq(payScales.tenantId, tenantId));
      details.payScales = payScaleCount[0]?.count || 0;
      if (details.payScales < expect.hasAtLeast.payScales) {
        issues.push(`Expected at least ${expect.hasAtLeast.payScales} pay scales, found ${details.payScales}`);
      }
    }

    return {
      tenantId,
      tenantName: tenant[0].name,
      passed: issues.length === 0,
      issues,
      details
    };
  } catch (error) {
    console.error(`Provisioning check failed for tenant ${tenantId}:`, error);
    return {
      tenantId,
      tenantName: "Error",
      passed: false,
      issues: [`Database error: ${error}`],
      details: {}
    };
  }
}

export async function validateAllTenants(expect: ProvisioningExpectation): Promise<ProvisioningResult[]> {
  try {
    const allTenants = await db.select().from(tenants);
    const results: ProvisioningResult[] = [];

    for (const tenant of allTenants) {
      const result = await checkProvisioning({ tenantId: tenant.id, expect });
      results.push(result);
    }

    return results;
  } catch (error) {
    console.error("Failed to validate all tenants:", error);
    return [];
  }
}

export function generateProvisioningReport(results: ProvisioningResult[]): string {
  const totalTenants = results.length;
  const passedTenants = results.filter(r => r.passed).length;
  const failedTenants = results.filter(r => !r.passed).length;

  let report = `Tenant Provisioning Report\n`;
  report += `========================\n`;
  report += `Total Tenants: ${totalTenants}\n`;
  report += `Passed: ${passedTenants}\n`;
  report += `Failed: ${failedTenants}\n\n`;

  if (failedTenants > 0) {
    report += `Failed Tenants:\n`;
    results.filter(r => !r.passed).forEach(result => {
      report += `- ${result.tenantName} (ID: ${result.tenantId})\n`;
      result.issues.forEach(issue => {
        report += `  * ${issue}\n`;
      });
    });
  }

  return report;
}