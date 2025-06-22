// Australian timezone utilities for consistent time handling

export const AUSTRALIAN_TIMEZONE = 'Australia/Sydney';

/**
 * Format date to Australian Eastern time with specified format
 */
export function formatAustralianTime(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: AUSTRALIAN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...options
  };
  
  return dateObj.toLocaleString('en-AU', defaultOptions);
}

/**
 * Format date to Australian date only (DD/MM/YYYY)
 */
export function formatAustralianDate(date: Date | string): string {
  return formatAustralianTime(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false
  }).split(',')[0];
}

/**
 * Format time to Australian time only (HH:MM AM/PM)
 */
export function formatAustralianTimeOnly(date: Date | string): string {
  return formatAustralianTime(date, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Get current Australian time
 */
export function getCurrentAustralianTime(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: AUSTRALIAN_TIMEZONE }));
}

/**
 * Convert UTC timestamp to Australian timezone
 */
export function convertToAustralianTime(utcDate: Date | string): Date {
  const dateObj = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  return new Date(dateObj.toLocaleString('en-US', { timeZone: AUSTRALIAN_TIMEZONE }));
}

/**
 * Check if a shift should be available to start (within 15 minutes of scheduled time)
 */
export function canStartShift(scheduledStartTime: Date | string): { canStart: boolean; minutesUntil: number } {
  const now = getCurrentAustralianTime();
  const startTime = convertToAustralianTime(scheduledStartTime);
  const timeDiff = startTime.getTime() - now.getTime();
  const minutesDiff = Math.floor(timeDiff / (1000 * 60));
  
  return {
    canStart: minutesDiff <= 15 && minutesDiff >= 0, // Can start up to 15 minutes early
    minutesUntil: Math.max(0, minutesDiff - 15) // Minutes until start button becomes available
  };
}

/**
 * Get relative time description in Australian context
 */
export function getRelativeTimeAustralian(date: Date | string): string {
  const now = getCurrentAustralianTime();
  const targetDate = convertToAustralianTime(date);
  const diffMs = targetDate.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) {
    return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
  } else if (diffDays < 0) {
    return `${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''} ago`;
  } else if (diffHours > 0) {
    return `in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  } else if (diffHours < 0) {
    return `${Math.abs(diffHours)} hour${Math.abs(diffHours) > 1 ? 's' : ''} ago`;
  } else if (diffMins > 0) {
    return `in ${diffMins} minute${diffMins > 1 ? 's' : ''}`;
  } else if (diffMins < 0) {
    return `${Math.abs(diffMins)} minute${Math.abs(diffMins) > 1 ? 's' : ''} ago`;
  } else {
    return 'now';
  }
}

/**
 * Format shift time range for display
 */
export function formatShiftTimeRange(startTime: Date | string, endTime: Date | string): string {
  const start = formatAustralianTimeOnly(startTime);
  const end = formatAustralianTimeOnly(endTime);
  return `${start} - ${end}`;
}

/**
 * Get Australian timezone offset info
 */
export function getAustralianTimezoneInfo(): { offset: string; isDST: boolean } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-AU', {
    timeZone: AUSTRALIAN_TIMEZONE,
    timeZoneName: 'short'
  });
  
  const parts = formatter.formatToParts(now);
  const timeZoneName = parts.find(part => part.type === 'timeZoneName')?.value || 'AEST';
  
  // Check if we're in daylight saving time (AEDT vs AEST)
  const isDST = timeZoneName.includes('EDT') || timeZoneName.includes('DT');
  const offset = isDST ? '+11:00' : '+10:00';
  
  return { offset, isDST };
}