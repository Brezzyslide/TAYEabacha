/**
 * STANDALONE BILLING SYSTEM
 * Tiered per-staff billing with 28-day cycles
 * Handles company subscriptions, usage tracking, and billing calculations
 */

import { db } from './lib/dbClient';
import { companies, tenants, users, billingConfiguration } from '../shared/schema';
import { eq, and, gte, lte, count } from 'drizzle-orm';
import { storage } from './storage';

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
  
  for (const row of companyData) {
    if (!companyMap.has(row.companyId)) {
      const now = new Date();
      const currentCycleStart = getCurrentCycleStart(now);
      const nextBillingDate = new Date(currentCycleStart);
      nextBillingDate.setDate(nextBillingDate.getDate() + billingConfig.cycleDays);

      companyMap.set(row.companyId, {
        companyId: row.companyId,
        companyName: row.companyName,
        tenantId: row.tenantId,
        activeStaff: [],
        totalMonthlyRevenue: 0,
        currentCycleStart,
        nextBillingDate,
        status: 'active'
      });
    }

    const company = companyMap.get(row.companyId)!;
    const monthlyRate = billingConfig.rates[row.role || 'Unknown'] || 0;
    const totalMonthly = monthlyRate * row.userCount;

    company.activeStaff.push({
      role: row.role,
      count: row.userCount,
      monthlyRate,
      totalMonthly
    });

    company.totalMonthlyRevenue += totalMonthly;
  }

  const companyBreakdown = Array.from(companyMap.values());

  // Calculate overall analytics
  const totalActiveStaff = companyBreakdown.reduce((sum, company) => 
    sum + company.activeStaff.reduce((roleSum, role) => roleSum + role.count, 0), 0);
  
  const totalMonthlyRevenue = companyBreakdown.reduce((sum, company) => 
    sum + company.totalMonthlyRevenue, 0);

  // Role distribution across all companies
  const roleMap = new Map<string, { count: number; revenue: number }>();
  for (const company of companyBreakdown) {
    for (const staff of company.activeStaff) {
      if (!roleMap.has(staff.role)) {
        roleMap.set(staff.role, { count: 0, revenue: 0 });
      }
      const existing = roleMap.get(staff.role)!;
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