// shared/timezone.ts
import { toZonedTime, fromZonedTime, format } from "date-fns-tz";

export const AU_TZ = "Australia/Sydney";
const TZ_FALLBACK = "UTC";

// Detect browser zone if available
export function getBrowserTimeZone(): string {
  try {
    // Works in browsers; on Node this throws
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz || TZ_FALLBACK;
  } catch {
    return TZ_FALLBACK;
  }
}

/**
 * Pick a timezone for business logic.
 * Priority:
 *   1) explicit tz argument (e.g., header/query/body from client)
 *   2) browser tz (frontend)
 *   3) Australia/Sydney (tenant default)
 *   4) UTC
 */
export function resolveBusinessTimeZone(explicit?: string, preferBrowser = false): string {
  if (explicit) return explicit;
  if (preferBrowser) return getBrowserTimeZone() || AU_TZ;
  return AU_TZ;
}

/** Convert a UTC Date to a wall-time Date in the zone (no offset added) */
export function toLocal(utcDate: Date | string, zone: string): Date {
  const d = typeof utcDate === "string" ? new Date(utcDate) : utcDate;
  return toZonedTime(d, zone);
}

/** Convert a local wall-time Date (or parts) to a true UTC instant for storage */
export function fromLocalPartsToUtc(
  parts: { year: number; month: number; day: number; hour: number; minute: number; second?: number },
  zone: string
): Date {
  const { year, month, day, hour, minute, second = 0 } = parts;
  // Build a local wall-time Date (JS months are 0-based)
  const local = new Date(year, month, day, hour, minute, second, 0);
  return fromZonedTime(local, zone);
}

/** Convenience: format a UTC instant for display in the zone */
export function formatInZone(
  utcDate: Date | string,
  zone: string,
  pattern = "dd/MM/yyyy HH:mm"
): string {
  const d = typeof utcDate === "string" ? new Date(utcDate) : utcDate;
  return format(d, pattern, { timeZone: zone });
}

/** Local weekday (0 Sun..6 Sat) from a UTC instant, in the zone */
export function localWeekday(utcDate: Date | string, zone: string): number {
  return toLocal(utcDate, zone).getDay();
}

/** Move a UTC instant to the next occurrence of target weekday in the zone, preserving time-of-day */
export function moveToNextWeekday(
  utcDate: Date | string,
  targetDow: 0 | 1 | 2 | 3 | 4 | 5 | 6,
  zone: string
): Date {
  const local = toLocal(utcDate, zone);
  const cur = local.getDay();
  const add = (targetDow - cur + 7) % 7;
  const hopped = new Date(local.getFullYear(), local.getMonth(), local.getDate() + add, local.getHours(), local.getMinutes(), local.getSeconds(), 0);
  return fromZonedTime(hopped, zone);
}

/** Normalize end that crosses midnight in the zone (ensures end > start) */
export function normalizeEndLocal(startUtc: Date, endUtcCand: Date, zone: string): Date {
  const sL = toLocal(startUtc, zone);
  const eL = toLocal(endUtcCand, zone);
  if (eL <= sL) {
    const bumped = new Date(eL);
    bumped.setDate(bumped.getDate() + 1);
    return fromZonedTime(bumped, zone);
  }
  return endUtcCand;
}