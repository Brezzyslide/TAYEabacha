import { format, parse } from "date-fns";

export type ShiftType = "AM" | "PM" | "ActiveNight" | "Sleepover";

/**
 * Determines shift type based on start and end times
 * 
 * Shift Types:
 * - AM: 06:00-20:00 (6 AM to 8 PM)
 * - PM: 20:00-00:00 (8 PM to 12 AM)
 * - ActiveNight: 00:00-06:00 (12 AM to 6 AM)
 * - Sleepover: Overnight shifts with sleep component
 */
export function getShiftTypeByTime(startTime: string | Date, endTime: string | Date): ShiftType {
  const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
  const end = typeof endTime === 'string' ? new Date(endTime) : endTime;
  
  const startHour = start.getHours();
  const endHour = end.getHours();
  
  // Check for sleepover shift (spans multiple shift periods, typically 8+ hours)
  const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60); // hours
  if (duration >= 8) {
    // If it's a long shift that spans night hours, it's likely a sleepover
    if (startHour >= 18 || startHour <= 10) {
      return "Sleepover";
    }
  }
  
  // Determine primary shift type based on start time
  if (startHour >= 6 && startHour < 20) {
    return "AM"; // 6 AM to 8 PM
  } else if (startHour >= 20 || startHour < 24) {
    return "PM"; // 8 PM to 12 AM
  } else {
    return "ActiveNight"; // 12 AM to 6 AM
  }
}

/**
 * Calculates shift duration in hours
 */
export function calculateShiftHours(startTime: string | Date, endTime: string | Date): number {
  const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
  const end = typeof endTime === 'string' ? new Date(endTime) : endTime;
  
  const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  return Math.max(0, Math.round(duration * 100) / 100); // Round to 2 decimal places
}

/**
 * Formats time for display
 */
export function formatShiftTime(time: string | Date): string {
  const date = typeof time === 'string' ? new Date(time) : time;
  return format(date, "h:mm a");
}

/**
 * Gets shift type display information
 */
export function getShiftTypeInfo(shiftType: ShiftType) {
  const shiftInfo = {
    AM: {
      label: "AM Shift",
      timeRange: "6:00 AM - 8:00 PM",
      description: "Day shift",
      color: "bg-blue-100 text-blue-800"
    },
    PM: {
      label: "PM Shift", 
      timeRange: "8:00 PM - 12:00 AM",
      description: "Evening shift",
      color: "bg-green-100 text-green-800"
    },
    ActiveNight: {
      label: "Active Night",
      timeRange: "12:00 AM - 6:00 AM", 
      description: "Night shift",
      color: "bg-purple-100 text-purple-800"
    },
    Sleepover: {
      label: "Sleepover",
      timeRange: "Overnight",
      description: "Sleepover shift",
      color: "bg-orange-100 text-orange-800"
    }
  };
  
  return shiftInfo[shiftType];
}