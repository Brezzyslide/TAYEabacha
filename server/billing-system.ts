/**
 * STANDALONE BILLING SYSTEM
 * Tiered per-staff billing with 28-day cycles
 * Handles company subscriptions, usage tracking, and billing calculations
 */

import { db } from './lib/dbClient';
import { companies, tenants, users, billingConfiguration, paymentHistory, companyPaymentInfo } from '../shared/schema';
import { eq, and, gte, lte, count, lt } from 'drizzle-orm';
import { storage } from './storage';
import { normalizeRole } from './role-utils';

// Dynamic billing rates and cycles - will be fetched from database
export interface BillingConfiguration {
  rates: Record<string, number>;
  cycleDays: number;
  nextBillingDate: Date;
  isActive: boolean;
}

// Get dynamic billing configuration from database
async function getBillingConfig(): Promise<BillingConfiguration> {
  try {
    const config = await storage.getBillingConfiguration();
    return {
      rates: config.rates || {
        'SupportWorker': 45.00,
        'TeamLeader': 65.00,
        'Coordinator': 85.00,
        'Admin': 95.00,
        'ConsoleManager': 150.00,
        'Unknown': 45.00
      },
      cycleDays: config.cycleDays || 28,
      nextBillingDate: config.nextBillingDate || new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
      isActive: config.isActive !== false
    };
  } catch (error) {
    console.error('[BILLING] Failed to get configuration, using defaults:', error);
    // Fallback to defaults if database read fails
    return {
      rates: {
        'SupportWorker': 45.00,
        'TeamLeader': 65.00,
        'Coordinator': 85.00,
        'Admin': 95.00,
        'ConsoleManager': 150.00,
        'Unknown': 45.00
      },
      cycleDays: 28,
      nextBillingDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
      isActive: true
    };
  }
}

export interface CompanyBilling {
  companyId: string;
  companyName: string;
  tenantId: number;
  activeStaff: {
    role: string;
    count: number;
    monthlyRate: number;
    totalMonthly: number;
  }[];
  totalMonthlyRevenue: number;
  currentCycleStart: Date;
  nextBillingDate: Date;
  status: 'active' | 'suspended' | 'cancelled';
}

export interface UsageAnalytics {
  totalCompanies: number;
  totalActiveStaff: number;
  totalMonthlyRevenue: number;
  roleDistribution: { role: string; count: number; revenue: number }[];
  companyBreakdown: CompanyBilling[];
}

/**
 * Calculate current billing for a specific tenant using dynamic rates
 */
export async function calculateTenantBilling(tenantId: number): Promise<UsageAnalytics> {
  const billingConfig = await getBillingConfig();
  
  // Get the specific tenant's staff counts by role
  const companyData = await db
    .select({
      companyId: companies.id,
      companyName: companies.name,
      tenantId: tenants.id,
      role: users.role,
      userCount: count(users.id)
    })
    .from(companies)
    .innerJoin(tenants, eq(tenants.companyId, companies.id))
    .innerJoin(users, and(
      eq(users.tenantId, tenants.id),
      eq(users.isActive, true)
    ))
    .where(and(
      eq(users.isActive, true),
      eq(tenants.id, tenantId)
    ))
    .groupBy(companies.id, companies.name, tenants.id, users.role);

  // Process into company billing structure (single company for tenant)
  const companyMap = new Map<string, CompanyBilling>();
  
  // First, aggregate by normalized role to consolidate mixed-case entries
  const roleAggregationMap = new Map<string, Map<string, number>>(); // companyId -> normalizedRole -> count
  
  for (const row of companyData) {
    if (!roleAggregationMap.has(row.companyId)) {
      roleAggregationMap.set(row.companyId, new Map());
    }
    
    const normalizedRole = normalizeRole(row.role) || 'Unknown';
    const companyRoles = roleAggregationMap.get(row.companyId)!;
    
    if (!companyRoles.has(normalizedRole)) {
      companyRoles.set(normalizedRole, 0);
    }
    companyRoles.set(normalizedRole, companyRoles.get(normalizedRole)! + row.userCount);
  }
  
  // Now build the company billing structure with aggregated role counts
  for (const [companyId, roleMap] of roleAggregationMap.entries()) {
    const companyInfo = companyData.find(row => row.companyId === companyId)!;
    
    const now = new Date();
    const currentCycleStart = getCurrentCycleStart(now);
    // Due date should be billing period start + 14 days (payment terms), not next cycle start
    const nextBillingDate = new Date(currentCycleStart);
    nextBillingDate.setDate(nextBillingDate.getDate() + 14); // Payment due 14 days after cycle start

    const company: CompanyBilling = {
      companyId,
      companyName: companyInfo.companyName,
      tenantId: companyInfo.tenantId,
      activeStaff: [],
      totalMonthlyRevenue: 0,
      currentCycleStart,
      nextBillingDate,
      status: 'active'
    };

    for (const [normalizedRole, count] of roleMap.entries()) {
      const monthlyRate = billingConfig.rates[normalizedRole] || 0;
      const totalMonthly = monthlyRate * count;

      company.activeStaff.push({
        role: normalizedRole,
        count,
        monthlyRate,
        totalMonthly
      });

      company.totalMonthlyRevenue += totalMonthly;
    }
    
    companyMap.set(companyId, company);
  }

  const companyBreakdown = Array.from(companyMap.values());

  // Calculate analytics for this tenant only
  const totalActiveStaff = companyBreakdown.reduce((sum, company) => 
    sum + company.activeStaff.reduce((roleSum, role) => roleSum + role.count, 0), 0);
  
  const totalMonthlyRevenue = companyBreakdown.reduce((sum, company) => 
    sum + company.totalMonthlyRevenue, 0);

  // Role distribution for this tenant only - aggregate by normalized role
  const roleMap = new Map<string, { count: number; revenue: number }>();
  for (const company of companyBreakdown) {
    for (const staff of company.activeStaff) {
      const normalizedRole = staff.role; // Already normalized in the processing above
      if (!roleMap.has(normalizedRole)) {
        roleMap.set(normalizedRole, { count: 0, revenue: 0 });
      }
      const existing = roleMap.get(normalizedRole)!;
      existing.count += staff.count;
      existing.revenue += staff.totalMonthly;
    }
  }

  const roleDistribution = Array.from(roleMap.entries()).map(([role, data]) => ({
    role,
    count: data.count,
    revenue: data.revenue
  }));

  return {
    totalCompanies: companyBreakdown.length,
    totalActiveStaff,
    totalMonthlyRevenue,
    roleDistribution,
    companyBreakdown
  };
}

/**
 * Calculate current billing for all companies using dynamic rates
 */
export async function calculateAllCompanyBilling(): Promise<UsageAnalytics> {
  const billingConfig = await getBillingConfig();
  // Get all companies with their staff counts by role
  const companyData = await db
    .select({
      companyId: companies.id,
      companyName: companies.name,
      tenantId: tenants.id,
      role: users.role,
      userCount: count(users.id)
    })
    .from(companies)
    .innerJoin(tenants, eq(tenants.companyId, companies.id))
    .innerJoin(users, and(
      eq(users.tenantId, tenants.id),
      eq(users.isActive, true)
    ))
    .where(and(
      eq(users.isActive, true)
    ))
    .groupBy(companies.id, companies.name, tenants.id, users.role);

  // Process into company billing structure
  const companyMap = new Map<string, CompanyBilling>();
  
  // First, aggregate by normalized role to consolidate mixed-case entries
  const roleAggregationMap = new Map<string, Map<string, number>>(); // companyId -> normalizedRole -> count
  
  for (const row of companyData) {
    if (!roleAggregationMap.has(row.companyId)) {
      roleAggregationMap.set(row.companyId, new Map());
    }
    
    const normalizedRole = normalizeRole(row.role) || 'Unknown';
    const companyRoles = roleAggregationMap.get(row.companyId)!;
    
    if (!companyRoles.has(normalizedRole)) {
      companyRoles.set(normalizedRole, 0);
    }
    companyRoles.set(normalizedRole, companyRoles.get(normalizedRole)! + row.userCount);
  }
  
  // Now build the company billing structure with aggregated role counts
  for (const [companyId, roleMap] of roleAggregationMap.entries()) {
    const companyInfo = companyData.find(row => row.companyId === companyId)!;
    
    const now = new Date();
    const currentCycleStart = getCurrentCycleStart(now);
    // Due date should be billing period start + 14 days (payment terms), not next cycle start
    const nextBillingDate = new Date(currentCycleStart);
    nextBillingDate.setDate(nextBillingDate.getDate() + 14); // Payment due 14 days after cycle start

    const company: CompanyBilling = {
      companyId,
      companyName: companyInfo.companyName,
      tenantId: companyInfo.tenantId,
      activeStaff: [],
      totalMonthlyRevenue: 0,
      currentCycleStart,
      nextBillingDate,
      status: 'active'
    };

    for (const [normalizedRole, count] of roleMap.entries()) {
      const monthlyRate = billingConfig.rates[normalizedRole] || 0;
      const totalMonthly = monthlyRate * count;

      company.activeStaff.push({
        role: normalizedRole,
        count,
        monthlyRate,
        totalMonthly
      });

      company.totalMonthlyRevenue += totalMonthly;
    }
    
    companyMap.set(companyId, company);
  }

  const companyBreakdown = Array.from(companyMap.values());

  // Calculate overall analytics
  const totalActiveStaff = companyBreakdown.reduce((sum, company) => 
    sum + company.activeStaff.reduce((roleSum, role) => roleSum + role.count, 0), 0);
  
  const totalMonthlyRevenue = companyBreakdown.reduce((sum, company) => 
    sum + company.totalMonthlyRevenue, 0);

  // Role distribution across all companies - aggregate by normalized role
  const roleMap = new Map<string, { count: number; revenue: number }>();
  for (const company of companyBreakdown) {
    for (const staff of company.activeStaff) {
      const normalizedRole = staff.role; // Already normalized in the processing above
      if (!roleMap.has(normalizedRole)) {
        roleMap.set(normalizedRole, { count: 0, revenue: 0 });
      }
      const existing = roleMap.get(normalizedRole)!;
      existing.count += staff.count;
      existing.revenue += staff.totalMonthly;
    }
  }

  const roleDistribution = Array.from(roleMap.entries()).map(([role, data]) => ({
    role,
    count: data.count,
    revenue: data.revenue
  }));

  return {
    totalCompanies: companyBreakdown.length,
    totalActiveStaff,
    totalMonthlyRevenue,
    roleDistribution,
    companyBreakdown
  };
}

/**
 * Calculate billing for specific company
 */
export async function calculateCompanyBilling(companyId: string): Promise<CompanyBilling | null> {
  const analytics = await calculateAllCompanyBilling();
  return analytics.companyBreakdown.find(c => c.companyId === companyId) || null;
}

/**
 * Get current billing cycle start date
 * Billing cycles start on the 1st and 15th of each month for simplified processing
 */
export function getCurrentCycleStart(date: Date = new Date()): Date {
  const cycleStart = new Date(date);
  
  // Determine if we're in first half (1st-14th) or second half (15th-end) of month
  if (date.getDate() < 15) {
    cycleStart.setDate(1);
  } else {
    cycleStart.setDate(15);
  }
  
  cycleStart.setHours(0, 0, 0, 0);
  return cycleStart;
}

/**
 * Calculate pro-rated billing for mid-cycle changes
 */
export function calculateProRatedAmount(
  dailyRate: number, 
  changeDate: Date, 
  cycleEndDate: Date
): number {
  const remainingDays = Math.ceil((cycleEndDate.getTime() - changeDate.getTime()) / (1000 * 60 * 60 * 24));
  return dailyRate * Math.max(0, remainingDays);
}

/**
 * Handle staff activation/deactivation for billing
 */
export async function updateStaffBillingStatus(
  userId: number, 
  isActive: boolean, 
  effectiveDate: Date = new Date()
): Promise<void> {
  // Update user status
  await db
    .update(users)
    .set({ 
      isActive,
      lastBillingSync: new Date()
    })
    .where(eq(users.id, userId));

  // Log billing change for audit
  console.log(`[BILLING] Staff ${userId} ${isActive ? 'activated' : 'deactivated'} on ${effectiveDate.toISOString()}`);
  
  // In a full implementation, this would create billing adjustment records
  // For now, we'll handle this in the monthly billing calculation
}

/**
 * Suspend company access for non-payment
 */
export async function suspendCompanyAccess(companyId: string): Promise<void> {
  // Get tenant ID for company
  const tenantData = await db
    .select({ tenantId: tenants.id })
    .from(tenants)
    .where(eq(tenants.companyId, companyId))
    .limit(1);

  if (tenantData.length === 0) {
    throw new Error(`Company ${companyId} not found`);
  }

  // Deactivate all staff in the company
  await db
    .update(users)
    .set({ 
      isActive: false,
      lastBillingSync: new Date()
    })
    .where(eq(users.tenantId, tenantData[0].tenantId));

  console.log(`[BILLING] Company ${companyId} suspended for non-payment`);
}

/**
 * Restore company access after payment
 */
export async function restoreCompanyAccess(companyId: string): Promise<void> {
  // Get tenant ID for company
  const tenantData = await db
    .select({ tenantId: tenants.id })
    .from(tenants)
    .where(eq(tenants.companyId, companyId))
    .limit(1);

  if (tenantData.length === 0) {
    throw new Error(`Company ${companyId} not found`);
  }

  // Reactivate all staff in the company
  await db
    .update(users)
    .set({ 
      isActive: true,
      lastBillingSync: new Date()
    })
    .where(eq(users.tenantId, tenantData[0].tenantId));

  console.log(`[BILLING] Company ${companyId} access restored after payment`);
}

/**
 * Configuration for automatic suspension policies
 */
export const defaultSuspensionConfig = {
  gracePeriodDays: 60,       // Days after due date before suspension (60 days)
  warningDays: [30, 14, 7],  // Send warnings at 30, 14, and 7 days before suspension  
  autoSuspendEnabled: true,   // Toggle automatic suspension
  maxOverdueDays: 90,        // Maximum days overdue before suspension (safety limit)
};

/**
 * Get all companies with overdue invoices that should be suspended
 */
export async function getCompaniesForAutoSuspension(): Promise<{
  companyId: string;
  companyName: string;
  daysOverdue: number;
  overdueAmount: number;
  invoiceCount: number;
}[]> {
  const now = new Date();
  const cutoffDate = new Date(now);
  cutoffDate.setDate(cutoffDate.getDate() - defaultSuspensionConfig.gracePeriodDays);

  console.log(`[AUTO SUSPENSION] Checking for companies with payments overdue since ${cutoffDate.toISOString()}`);

  // Get companies with failed payments or no recent successful payments
  // We'll look at payment history and company payment info to determine overdue status
  const overdueCompanies = await db
    .select({
      companyId: companies.id,
      companyName: companies.name,
      paymentStatus: companyPaymentInfo.paymentStatus,
      nextPaymentDate: companyPaymentInfo.nextPaymentDate,
      lastPaymentDate: companyPaymentInfo.lastPaymentDate,
      isActive: users.isActive
    })
    .from(companies)
    .innerJoin(tenants, eq(companies.id, tenants.companyId))
    .innerJoin(users, eq(users.tenantId, tenants.id))
    .leftJoin(companyPaymentInfo, eq(companies.id, companyPaymentInfo.companyId))
    .where(and(
      eq(users.isActive, true), // Only check active companies
      // Companies with past_due status OR no payment info OR payments overdue
      and(
        // Has payment info but is past due, OR no payment info at all
        // OR next payment date is in the past beyond grace period
        eq(companyPaymentInfo.paymentStatus, 'past_due')
      )
    ))
    .groupBy(
      companies.id, 
      companies.name, 
      companyPaymentInfo.paymentStatus,
      companyPaymentInfo.nextPaymentDate,
      companyPaymentInfo.lastPaymentDate,
      users.isActive
    );

  // For now, return a simplified result since we don't have actual invoice data
  // This is a stub implementation that would work with the existing payment infrastructure
  const results: {
    companyId: string;
    companyName: string;
    daysOverdue: number;
    overdueAmount: number;
    invoiceCount: number;
  }[] = [];

  console.log(`[AUTO SUSPENSION] Found ${overdueCompanies.length} companies to check`);
  
  for (const company of overdueCompanies) {
    // Calculate days overdue based on next payment date or last payment date
    let daysOverdue = 0;
    const paymentDate = company.nextPaymentDate || company.lastPaymentDate;
    
    if (paymentDate) {
      daysOverdue = Math.floor((now.getTime() - new Date(paymentDate).getTime()) / (1000 * 60 * 60 * 24));
    } else {
      // If no payment date, assume 90 days overdue for companies with past_due status
      daysOverdue = 90;
    }

    if (daysOverdue >= defaultSuspensionConfig.gracePeriodDays) {
      results.push({
        companyId: company.companyId,
        companyName: company.companyName,
        daysOverdue,
        overdueAmount: 150.00, // Placeholder amount - would be calculated from billing rates
        invoiceCount: 1
      });
    }
  }

  console.log(`[AUTO SUSPENSION] ${results.length} companies qualify for suspension`);
  return results;
}

/**
 * Process automatic suspensions for all qualifying overdue companies
 */
export async function processAutoSuspensions(): Promise<{
  suspended: number;
  errors: string[];
}> {
  if (!defaultSuspensionConfig.autoSuspendEnabled) {
    console.log(`[AUTO SUSPENSION] Auto suspension is disabled`);
    return { suspended: 0, errors: [] };
  }

  console.log('[AUTO SUSPENSION] Processing automatic suspensions');
  
  const companiesToSuspend = await getCompaniesForAutoSuspension();
  let suspended = 0;
  const errors: string[] = [];

  for (const company of companiesToSuspend) {
    try {
      // Only suspend if within reasonable overdue limits (prevent accidental mass suspension)
      if (company.daysOverdue <= defaultSuspensionConfig.maxOverdueDays) {
        await suspendCompanyAccess(company.companyId);
        suspended++;
        console.log(`[AUTO SUSPENSION] Successfully suspended ${company.companyName} (${company.daysOverdue} days overdue, $${company.overdueAmount})`);
      } else {
        const errorMsg = `Company ${company.companyName} is ${company.daysOverdue} days overdue (exceeds max ${defaultSuspensionConfig.maxOverdueDays} days) - manual review required`;
        errors.push(errorMsg);
        console.log(`[AUTO SUSPENSION SKIP] ${errorMsg}`);
      }
    } catch (error) {
      const errorMsg = `Failed to suspend ${company.companyName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      console.error(`[AUTO SUSPENSION ERROR] ${errorMsg}`);
    }
  }

  console.log(`[AUTO SUSPENSION COMPLETE] Suspended: ${suspended}, Errors: ${errors.length}`);
  return { suspended, errors };
}

/**
 * Generate billing summary report
 */
export async function generateBillingSummary(): Promise<string> {
  const analytics = await calculateAllCompanyBilling();
  
  let report = `
=== NeedsCareAI+ Billing Summary ===
Generated: ${new Date().toISOString()}

PLATFORM OVERVIEW:
- Total Companies: ${analytics.totalCompanies}
- Total Active Staff: ${analytics.totalActiveStaff}
- Monthly Revenue: $${analytics.totalMonthlyRevenue.toFixed(2)}

ROLE DISTRIBUTION:
${analytics.roleDistribution.map(role => 
  `- ${role.role}: ${role.count} staff ($${role.revenue.toFixed(2)}/month)`
).join('\n')}

COMPANY BREAKDOWN:
${analytics.companyBreakdown.map(company => `
Company: ${company.companyName} (${company.companyId})
- Monthly Revenue: $${company.totalMonthlyRevenue.toFixed(2)}
- Next Billing: ${company.nextBillingDate.toISOString().split('T')[0]}
- Staff: ${company.activeStaff.map(s => `${s.count} ${s.role}`).join(', ')}
`).join('\n')}
`;

  return report;
}

// Exports already declared above - no need to re-export