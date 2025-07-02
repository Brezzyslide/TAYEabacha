/**
 * SMART TIMESHEET SERVICE
 * Implements intelligent payroll calculations based on submission timing:
 * - Early submission (before scheduled end): Pay actual worked time
 * - Late submission (after scheduled end): Cap payment at booked hours
 */

import { db } from "./db";
import { timesheets, timesheetEntries, shifts, users, payScales } from "@shared/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { calculatePayPeriod } from "./payroll-calculator";

export interface SmartTimesheetCalculation {
  totalHours: number;
  grossPay: number;
  paymentMethod: 'actual' | 'scheduled';
  submissionTimestamp: Date;
  scheduledEndTime: Date;
  actualEndTime: Date;
  explanation: string;
}

/**
 * Calculate timesheet hours with smart submission timing logic
 */
export async function calculateSmartTimesheetHours(
  shiftId: number,
  submissionTimestamp: Date = new Date()
): Promise<SmartTimesheetCalculation> {
  
  // Get shift details
  const shift = await db
    .select()
    .from(shifts)
    .where(eq(shifts.id, shiftId))
    .limit(1);

  if (!shift.length || !shift[0].startTime || !shift[0].endTime) {
    throw new Error("Shift not found or missing scheduled times");
  }

  const shiftData = shift[0];
  
  if (!shiftData.startTime || !shiftData.endTime) {
    throw new Error("Shift missing start or end time");
  }
  
  const scheduledStartTime = new Date(shiftData.startTime);
  const scheduledEndTime = new Date(shiftData.endTime);
  
  // Get user's hourly rate
  if (!shiftData.userId) {
    throw new Error("Shift has no assigned user");
  }
  
  const hourlyRate = await getUserHourlyRate(shiftData.userId, shiftData.tenantId);
  
  // Determine if submission is early or late
  const isEarlySubmission = submissionTimestamp < scheduledEndTime;
  
  let actualEndTime: Date;
  let totalHours: number;
  let paymentMethod: 'actual' | 'scheduled';
  let explanation: string;
  
  if (isEarlySubmission) {
    // EARLY SUBMISSION: Pay actual worked time based on submission
    actualEndTime = submissionTimestamp;
    const actualMinutes = (actualEndTime.getTime() - scheduledStartTime.getTime()) / (1000 * 60);
    const breakMinutes = calculateBreakTime(actualMinutes);
    const workedMinutes = Math.max(0, actualMinutes - breakMinutes);
    totalHours = Math.round((workedMinutes / 60) * 100) / 100;
    paymentMethod = 'actual';
    explanation = `Early submission - paid for actual worked time (${totalHours}h)`;
    
    console.log(`[SMART TIMESHEET] Early submission for shift ${shiftId}: ${totalHours}h actual work`);
    
  } else {
    // LATE SUBMISSION: Cap payment at scheduled hours to prevent overtime abuse
    actualEndTime = scheduledEndTime;
    const scheduledMinutes = (scheduledEndTime.getTime() - scheduledStartTime.getTime()) / (1000 * 60);
    const breakMinutes = calculateBreakTime(scheduledMinutes);
    const workedMinutes = Math.max(0, scheduledMinutes - breakMinutes);
    totalHours = Math.round((workedMinutes / 60) * 100) / 100;
    paymentMethod = 'scheduled';
    explanation = `Late submission - capped at scheduled hours (${totalHours}h) to prevent overtime abuse`;
    
    console.log(`[SMART TIMESHEET] Late submission for shift ${shiftId}: Capped at ${totalHours}h scheduled duration`);
  }
  
  const grossPay = Math.round(totalHours * hourlyRate * 100) / 100;
  
  return {
    totalHours,
    grossPay,
    paymentMethod,
    submissionTimestamp,
    scheduledEndTime,
    actualEndTime,
    explanation
  };
}

/**
 * Create smart timesheet entry from shift with submission timing logic
 */
export async function createSmartTimesheetEntry(
  shiftId: number,
  submissionTimestamp: Date = new Date()
): Promise<void> {
  
  const calculation = await calculateSmartTimesheetHours(shiftId, submissionTimestamp);
  
  // Get shift details for timesheet creation
  const shift = await db
    .select()
    .from(shifts)
    .where(eq(shifts.id, shiftId))
    .limit(1);

  if (!shift.length || !shift[0].userId) {
    throw new Error("Shift not found or no assigned user");
  }

  const shiftData = shift[0];
  
  if (!shiftData.userId) {
    throw new Error("Shift has no assigned user");
  }
  
  const userId = shiftData.userId;
  const tenantId = shiftData.tenantId;
  
  // Find or create timesheet for the pay period
  const payPeriod = calculatePayPeriod(new Date(shiftData.startTime));
  let timesheet = await findOrCreateTimesheet(userId, tenantId, payPeriod);
  
  // Check if entry already exists for this shift
  const existingEntry = await db
    .select()
    .from(timesheetEntries)
    .where(and(
      eq(timesheetEntries.timesheetId, timesheet.id),
      eq(timesheetEntries.shiftId, shiftId)
    ))
    .limit(1);

  const hourlyRate = await getUserHourlyRate(userId, tenantId);
  
  if (existingEntry.length) {
    // Update existing entry with smart calculation
    await db
      .update(timesheetEntries)
      .set({
        startTime: new Date(shiftData.startTime),
        endTime: calculation.actualEndTime,
        totalHours: String(calculation.totalHours),
        hourlyRate: String(hourlyRate),
        grossPay: String(calculation.grossPay),
        submissionTimestamp: calculation.submissionTimestamp,
        scheduledEndTime: calculation.scheduledEndTime,
        paymentMethod: calculation.paymentMethod,
        notes: calculation.explanation
      })
      .where(eq(timesheetEntries.id, existingEntry[0].id));
      
    console.log(`[SMART TIMESHEET] Updated existing entry for shift ${shiftId}: ${calculation.paymentMethod} payment`);
    
  } else {
    // Create new smart timesheet entry
    await db.insert(timesheetEntries).values({
      timesheetId: timesheet.id,
      shiftId,
      entryDate: new Date(shiftData.startTime),
      startTime: new Date(shiftData.startTime),
      endTime: calculation.actualEndTime,
      breakMinutes: calculateBreakTime((calculation.actualEndTime.getTime() - new Date(shiftData.startTime).getTime()) / (1000 * 60)),
      totalHours: String(calculation.totalHours),
      hourlyRate: String(hourlyRate),
      grossPay: String(calculation.grossPay),
      submissionTimestamp: calculation.submissionTimestamp,
      scheduledEndTime: calculation.scheduledEndTime,
      paymentMethod: calculation.paymentMethod,
      isAutoGenerated: true,
      notes: calculation.explanation
    });
    
    console.log(`[SMART TIMESHEET] Created new entry for shift ${shiftId}: ${calculation.paymentMethod} payment`);
  }

  // Update timesheet totals
  await updateTimesheetTotals(timesheet.id);
}

/**
 * Calculate break time based on shift duration (Australian award compliance)
 */
function calculateBreakTime(totalMinutes: number): number {
  if (totalMinutes <= 240) return 0; // No break for shifts 4 hours or less
  if (totalMinutes > 480) return 60;  // 1 hour for 8+ hour shifts  
  if (totalMinutes > 360) return 45;  // 45 minutes for 6-8 hour shifts
  return 30; // 30 minutes for 4-6 hour shifts
}

/**
 * Get user's hourly rate from pay scale system
 */
async function getUserHourlyRate(userId: number, tenantId: number): Promise<number> {
  const user = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .limit(1);

  if (!user.length) {
    throw new Error(`User ${userId} not found`);
  }

  const { payLevel, payPoint, employmentType } = user[0];
  
  if (!payLevel || !payPoint || !employmentType) {
    console.warn(`[SMART TIMESHEET] User ${userId} missing pay scale data, using minimum rate`);
    return 25.41; // Minimum ScHADS Level 1, Point 1 rate
  }

  // Get rate from pay scales table
  const payScale = await db
    .select()
    .from(payScales)
    .where(and(
      eq(payScales.tenantId, tenantId),
      eq(payScales.level, payLevel),
      eq(payScales.payPoint, payPoint),
      eq(payScales.employmentType, employmentType)
    ))
    .limit(1);

  if (!payScale.length) {
    console.warn(`[SMART TIMESHEET] Pay scale not found for user ${userId}, using minimum rate`);
    return 25.41;
  }

  return parseFloat(payScale[0].hourlyRate.toString());
}

/**
 * Find or create timesheet for pay period
 */
async function findOrCreateTimesheet(userId: number, tenantId: number, payPeriod: any): Promise<any> {
  // Try to find existing timesheet
  let timesheet = await db
    .select()
    .from(timesheets)
    .where(and(
      eq(timesheets.userId, userId),
      eq(timesheets.tenantId, tenantId),
      eq(timesheets.payPeriodStart, payPeriod.start)
    ))
    .limit(1);

  if (timesheet.length) {
    return timesheet[0];
  }

  // Create new timesheet
  const [newTimesheet] = await db.insert(timesheets).values({
    userId,
    tenantId,
    payPeriodStart: payPeriod.start,
    payPeriodEnd: payPeriod.end,
    status: 'draft',
    totalHours: '0',
    totalEarnings: '0'
  }).returning();

  return newTimesheet;
}

/**
 * Update timesheet totals after entry changes
 */
async function updateTimesheetTotals(timesheetId: number): Promise<void> {
  const entries = await db
    .select()
    .from(timesheetEntries)
    .where(eq(timesheetEntries.timesheetId, timesheetId));

  const totalHours = entries.reduce((sum, entry) => {
    return sum + parseFloat(entry.totalHours || '0');
  }, 0);

  const totalEarnings = entries.reduce((sum, entry) => {
    return sum + parseFloat(entry.grossPay || '0');
  }, 0);

  await db
    .update(timesheets)
    .set({
      totalHours: totalHours.toFixed(2),
      totalEarnings: totalEarnings.toFixed(2),
      updatedAt: new Date()
    })
    .where(eq(timesheets.id, timesheetId));
}