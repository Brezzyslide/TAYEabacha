// shared/timezone.ts
import { toZonedTime, fromZonedTime, format } from "date-fns-tz";

export const AU_TZ = "Australia/Sydney";
const TZ_FALLBACK = "UTC";

export function getBrowserTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz || TZ_FALLBACK;
  } catch {
    return TZ_FALLBACK;
  }
}

export function resolveBusinessTimeZone(explicit?: string, preferBrowser = false): string {
  if (explicit) return explicit;
  if (preferBrowser) return getBrowserTimeZone() || AU_TZ;
  return AU_TZ;
}

/** UTC instant -> wall-time in zone (for reasoning and display) */
export function toLocal(utcDate: Date | string, zone: string): Date {
  const d = typeof utcDate === "string" ? new Date(utcDate) : utcDate;
  return toZonedTime(d, zone);
}

/** Local wall-time parts -> true UTC instant for storage */
export function fromLocalPartsToUtc(
  parts: { year: number; month: number; day: number; hour: number; minute: number; second?: number },
  zone: string
): Date {
  const { year, month, day, hour, minute, second = 0 } = parts;
  const local = new Date(year, month, day, hour, minute, second, 0); // month is 0-based
  return fromZonedTime(local, zone);
}

/** Format a UTC instant for display in the zone */
export function formatInZone(
  utcDate: Date | string,
  zone: string,
  pattern = "dd/MM/yyyy HH:mm"
): string {
  const d = typeof utcDate === "string" ? new Date(utcDate) : utcDate;
  return format(d, pattern, { timeZone: zone });
}

/** Local weekday (0..6) from a UTC instant, in the zone */
export function localWeekday(utcDate: Date | string, zone: string): number {
  return toLocal(utcDate, zone).getDay();
}

/** Move a UTC instant to the next target weekday in the zone, preserving time-of-day */
export function moveToNextWeekday(
  utcDate: Date | string,
  targetDow: 0 | 1 | 2 | 3 | 4 | 5 | 6,
  zone: string
): Date {
  const local = toLocal(utcDate, zone);
  const cur = local.getDay();
  const add = (targetDow - cur + 7) % 7;
  const hopped = new Date(
    local.getFullYear(),
    local.getMonth(),
    local.getDate() + add,
    local.getHours(),
    local.getMinutes(),
    local.getSeconds(),
    0
  );
  return fromZonedTime(hopped, zone);
}

/** Ensure end > start in the zone, bump a day if needed (overnight) */
export function normalizeEndLocal(startUtc: Date, endUtcCand: Date, zone: string): Date {
  const sL = toLocal(startUtc, zone);
  const eL = toLocal(endUtcCand, zone);
  if (eL <= sL) {
    const bumped = new Date(eL);
    bumped.setDate(bumped.getDate() + 1); // handles month/year rollover safely
    return fromZonedTime(bumped, zone);
  }
  return endUtcCand;
}