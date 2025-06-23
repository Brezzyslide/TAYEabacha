import { db } from "./db";
import { taxBrackets, payScales, leaveBalances, users } from "@shared/schema";
import { eq, and, gte, lte } from "drizzle-orm";

// Australian Tax Year 2024-25 rates
const CURRENT_TAX_YEAR = 2025;
const SUPER_RATE = 0.11; // 11% superannuation guarantee
const MEDICARE_LEVY = 0.02; // 2% Medicare levy

// Leave accrual rates per hour for different employment types
const LEAVE_ACCRUAL_RATES = {
  "full-time": {
    annual: 0.0769, // 4 weeks per year (160 hours / 2080 hours)
    sick: 0.0384,   // 2 weeks per year
    personal: 0.0192, // 1 week per year
    longService: 0.0065 // Long service after 7 years
  },
  "part-time": {
    annual: 0.0769,
    sick: 0.0384,
    personal: 0.0192,
    longService: 0.0065
  },
  "casual": {
    annual: 0,
    sick: 0,
    personal: 0,
    longService: 0
  }
};

export interface PayrollCalculation {
  grossPay: number;
  taxWithheld: number;
  medicareLevy: number;
  superContribution: number;
  netPay: number;
  leaveAccrued: {
    annual: number;
    sick: number;
    personal: number;
    longService: number;
  };
}

export async function calculatePayroll(
  userId: number,
  tenantId: number,
  grossPay: number,
  ytdGross: number = 0
): Promise<PayrollCalculation> {
  // Get user employment details
  const user = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .limit(1);

  if (!user.length) {
    throw new Error("User not found");
  }

  const employmentType = user[0].employmentType || "casual";

  // Calculate live YTD from approved timesheets (not trusting passed parameter)
  const actualYTDGross = await calculateLiveYTDGross(userId, tenantId);
  
  // Use integer math for all financial calculations (convert to cents)
  const grossPayCents = Math.round(grossPay * 100);
  const ytdCents = Math.round(actualYTDGross * 100);
  const totalYTDCents = ytdCents + grossPayCents;
  
  // Calculate tax withholding using accurate YTD
  const taxWithheld = await calculateTaxWithholding(totalYTDCents / 100, grossPay);
  
  // Calculate Medicare levy (only on Ordinary Time Earnings)
  const medicareLevy = toPrecision(grossPay * MEDICARE_LEVY);
  
  // Calculate superannuation (only on OTE - Ordinary Time Earnings)
  const ordinaryTimeEarnings = grossPay; // For now, all earnings are OTE
  const superContribution = toPrecision(ordinaryTimeEarnings * SUPER_RATE);
  
  // Calculate net pay with precision
  const netPay = toPrecision(grossPay - taxWithheld - medicareLevy);
  
  // Calculate leave accrual based on actual hours worked
  const hoursWorked = (grossPay / await getHourlyRate(userId, tenantId)) || 0;
  const leaveAccrued = calculateLeaveAccrual(employmentType, hoursWorked);

  return {
    grossPay: toPrecision(grossPay),
    taxWithheld: toPrecision(taxWithheld),
    medicareLevy,
    superContribution,
    netPay,
    leaveAccrued
  };
}

// Calculate live YTD gross from approved/paid timesheets
async function calculateLiveYTDGross(userId: number, tenantId: number): Promise<number> {
  const currentDate = new Date();
  // Australian financial year starts July 1
  const financialYearStart = new Date(
    currentDate.getMonth() >= 6 ? currentDate.getFullYear() : currentDate.getFullYear() - 1,
    6, // July (0-indexed)
    1
  );

  const ytdTimesheets = await db
    .select({
      totalEarnings: timesheets.totalEarnings
    })
    .from(timesheets)
    .where(and(
      eq(timesheets.userId, userId),
      eq(timesheets.tenantId, tenantId),
      gte(timesheets.payPeriodStart, financialYearStart),
      eq(timesheets.status, 'paid') // Only include paid timesheets
    ));

  return ytdTimesheets.reduce((sum, ts) => 
    sum + parseFloat(ts.totalEarnings || '0'), 0
  );
}

// Standardized precision handling for all financial calculations
function toPrecision(value: number): number {
  return Math.round(value * 100) / 100;
}

async function calculateTaxWithholding(annualIncome: number, payPeriodGross: number): Promise<number> {
  // Australian tax-free threshold is $18,200
  if (annualIncome <= 18200) {
    return 0; // No tax withheld below tax-free threshold
  }

  // Get current tax brackets
  const brackets = await db
    .select()
    .from(taxBrackets)
    .where(eq(taxBrackets.taxYear, CURRENT_TAX_YEAR))
    .orderBy(taxBrackets.minIncome);

  if (!brackets.length) {
    // Initialize default Australian tax brackets for 2024-25
    await initializeTaxBrackets();
    return calculateTaxWithholding(annualIncome, payPeriodGross);
  }

  let annualTax = 0;
  
  for (const bracket of brackets) {
    const minIncome = parseFloat(bracket.minIncome);
    const maxIncome = bracket.maxIncome ? parseFloat(bracket.maxIncome) : Infinity;
    const taxRate = parseFloat(bracket.taxRate);
    const baseTax = parseFloat(bracket.baseTax ?? "0");

    if (annualIncome > minIncome) {
      const taxableInThisBracket = Math.min(annualIncome, maxIncome) - minIncome;
      annualTax = baseTax + (taxableInThisBracket * taxRate);
      break; // Only apply the highest applicable bracket
    }
  }

  // Convert annual tax to pay period tax (fortnightly)
  return Math.round((annualTax / 26) * 100) / 100;
}

async function getHourlyRate(userId: number, tenantId: number): Promise<number> {
  const user = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .limit(1);

  if (!user.length) {
    throw new Error("User not found");
  }

  const { payLevel, payPoint } = user[0];

  const payScale = await db
    .select()
    .from(payScales)
    .where(
      and(
        eq(payScales.tenantId, tenantId),
        eq(payScales.level, payLevel || 1),
        eq(payScales.payPoint, payPoint || 1)
      )
    )
    .limit(1);

  if (!payScale.length) {
    // Default minimum wage fallback
    return 23.23; // Australian minimum wage 2024
  }

  return parseFloat(payScale[0].hourlyRate);
}

function calculateLeaveAccrual(employmentType: string | null, hoursWorked: number) {
  // Default to 'casual' if employmentType is undefined, null, or invalid
  const type = employmentType && LEAVE_ACCRUAL_RATES[employmentType as keyof typeof LEAVE_ACCRUAL_RATES] 
    ? employmentType as keyof typeof LEAVE_ACCRUAL_RATES
    : 'casual';
  
  const rates = LEAVE_ACCRUAL_RATES[type];
  
  return {
    annual: hoursWorked * rates.annual,
    sick: hoursWorked * rates.sick,
    personal: hoursWorked * rates.personal,
    longService: hoursWorked * rates.longService
  };
}

export async function updateLeaveBalances(
  userId: number,
  tenantId: number,
  leaveAccrued: PayrollCalculation["leaveAccrued"]
): Promise<void> {
  // Get existing leave balance
  const existing = await db
    .select()
    .from(leaveBalances)
    .where(and(eq(leaveBalances.userId, userId), eq(leaveBalances.tenantId, tenantId)))
    .limit(1);

  if (existing.length) {
    // Update existing balance
    await db
      .update(leaveBalances)
      .set({
        annualLeave: String(parseFloat(existing[0].annualLeave || "0") + leaveAccrued.annual),
        sickLeave: String(parseFloat(existing[0].sickLeave || "0") + leaveAccrued.sick),
        personalLeave: String(parseFloat(existing[0].personalLeave || "0") + leaveAccrued.personal),
        longServiceLeave: String(parseFloat(existing[0].longServiceLeave || "0") + leaveAccrued.longService),
        lastUpdated: new Date()
      })
      .where(eq(leaveBalances.id, existing[0].id));
  } else {
    // Create new leave balance record
    await db.insert(leaveBalances).values({
      userId,
      tenantId,
      annualLeave: String(leaveAccrued.annual),
      sickLeave: String(leaveAccrued.sick),
      personalLeave: String(leaveAccrued.personal),
      longServiceLeave: String(leaveAccrued.longService)
    });
  }
}

async function initializeTaxBrackets(): Promise<void> {
  // Australian tax brackets 2024-25
  const brackets = [
    { minIncome: 0, maxIncome: 18200, taxRate: 0, baseTax: 0 },
    { minIncome: 18201, maxIncome: 45000, taxRate: 0.19, baseTax: 0 },
    { minIncome: 45001, maxIncome: 120000, taxRate: 0.325, baseTax: 5092 },
    { minIncome: 120001, maxIncome: 180000, taxRate: 0.37, baseTax: 29467 },
    { minIncome: 180001, maxIncome: null, taxRate: 0.45, baseTax: 51667 }
  ];

  for (const bracket of brackets) {
    await db.insert(taxBrackets).values({
      taxYear: CURRENT_TAX_YEAR,
      minIncome: String(bracket.minIncome),
      maxIncome: bracket.maxIncome ? String(bracket.maxIncome) : null,
      taxRate: String(bracket.taxRate),
      baseTax: String(bracket.baseTax)
    });
  }
}

export function calculatePayPeriod(startDate: Date): { start: Date; end: Date } {
  // Calculate fortnightly pay period starting on Monday
  const start = new Date(startDate);
  const dayOfWeek = start.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  start.setDate(start.getDate() - daysToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 13); // 14 days total
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export function getNextPayPeriod(currentPeriodEnd: Date): { start: Date; end: Date } {
  const start = new Date(currentPeriodEnd);
  start.setDate(start.getDate() + 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 13);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}