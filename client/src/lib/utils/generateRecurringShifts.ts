import { addWeeks, addMonths, isBefore, isAfter, parseISO } from "date-fns";

export type RecurringShiftInput = {
  title?: string;
  startDateTime: string | Date;
  endDateTime: string | Date;
  recurrenceType: "weekly" | "fortnightly" | "monthly";
  occurrenceCount?: number;
  endDate?: string | Date;
  staffId?: string;
  clientId: string;
  companyId: string;
};

export type Shift = {
  id: string;
  title?: string;
  startDateTime: Date;
  endDateTime: Date;
  staffId?: string;
  clientId: string;
  companyId: string;
  status: "unassigned" | "assigned";
};

/**
 * Generates recurring shifts based on the provided configuration
 * @param input - Configuration for generating recurring shifts
 * @returns Array of shift objects
 */
export function generateRecurringShifts(input: RecurringShiftInput): Shift[] {
  const {
    title,
    startDateTime,
    endDateTime,
    recurrenceType,
    occurrenceCount,
    endDate,
    staffId,
    clientId,
    companyId,
  } = input;

  // Convert string dates to Date objects
  const startDate = typeof startDateTime === "string" ? parseISO(startDateTime) : startDateTime;
  const originalEndDate = typeof endDateTime === "string" ? parseISO(endDateTime) : endDateTime;
  const finalEndDate = endDate ? (typeof endDate === "string" ? parseISO(endDate) : endDate) : null;

  // Validate input
  if (!startDate || !originalEndDate) {
    throw new Error("Start and end date/time are required");
  }

  if (isAfter(startDate, originalEndDate)) {
    throw new Error("Start date must be before end date");
  }

  if (!occurrenceCount && !finalEndDate) {
    throw new Error("Either occurrence count or end date must be specified");
  }

  const shifts: Shift[] = [];
  let currentStartDate = new Date(startDate);
  let currentEndDate = new Date(originalEndDate);
  let occurrenceIndex = 0;

  // Calculate the duration between start and end for each shift
  const shiftDuration = originalEndDate.getTime() - startDate.getTime();

  while (true) {
    // Check if we've reached the occurrence limit
    if (occurrenceCount && occurrenceIndex >= occurrenceCount) {
      break;
    }

    // Check if we've exceeded the end date
    if (finalEndDate && isAfter(currentStartDate, finalEndDate)) {
      break;
    }

    // Generate the shift
    const shift: Shift = {
      id: crypto.randomUUID(),
      title,
      startDateTime: new Date(currentStartDate),
      endDateTime: new Date(currentEndDate),
      staffId,
      clientId,
      companyId,
      status: staffId ? "assigned" : "unassigned",
    };

    shifts.push(shift);
    occurrenceIndex++;

    // Calculate next occurrence based on recurrence type
    switch (recurrenceType) {
      case "weekly":
        currentStartDate = addWeeks(currentStartDate, 1);
        break;
      case "fortnightly":
        currentStartDate = addWeeks(currentStartDate, 2);
        break;
      case "monthly":
        currentStartDate = addMonths(currentStartDate, 1);
        break;
      default:
        throw new Error(`Invalid recurrence type: ${recurrenceType}`);
    }

    // Update end date to maintain the same duration
    currentEndDate = new Date(currentStartDate.getTime() + shiftDuration);
  }

  return shifts;
}

/**
 * Validates recurring shift input parameters
 * @param input - Input to validate
 * @returns True if valid, throws error if invalid
 */
export function validateRecurringShiftInput(input: RecurringShiftInput): boolean {
  if (!input.startDateTime) {
    throw new Error("Start date/time is required");
  }

  if (!input.endDateTime) {
    throw new Error("End date/time is required");
  }

  if (!input.clientId) {
    throw new Error("Client ID is required");
  }

  if (!input.companyId) {
    throw new Error("Company ID is required");
  }

  if (!["weekly", "fortnightly", "monthly"].includes(input.recurrenceType)) {
    throw new Error("Invalid recurrence type. Must be weekly, fortnightly, or monthly");
  }

  if (!input.occurrenceCount && !input.endDate) {
    throw new Error("Either occurrence count or end date must be specified");
  }

  if (input.occurrenceCount && input.occurrenceCount <= 0) {
    throw new Error("Occurrence count must be greater than 0");
  }

  return true;
}

/**
 * Helper function to preview recurring shift dates without generating full objects
 * @param input - Configuration for generating recurring shifts
 * @returns Array of start dates for preview
 */
export function previewRecurringDates(input: RecurringShiftInput): Date[] {
  const shifts = generateRecurringShifts(input);
  return shifts.map(shift => shift.startDateTime);
}