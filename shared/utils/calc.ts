import Decimal from "decimal.js";

export type RateSet = {
  hoursDay: string; 
  hoursEvening: string; 
  hoursActiveNight: string;
  hoursSleepover: string; 
  hoursSaturday: string; 
  hoursSunday: string; 
  hoursPublicHoliday: string;
  unitDay: string; 
  unitEvening: string; 
  unitActiveNight: string;
  unitSleepover: string; 
  unitSaturday: string; 
  unitSunday: string; 
  unitPublicHoliday: string;
  weeks: number;
};

export function lineTotals(x: RateSet) {
  const w = new Decimal(x.weeks || 0);
  const amount = (h: string, u: string) => new Decimal(h || 0).mul(new Decimal(u || 0)).mul(w);
  
  return {
    day: amount(x.hoursDay, x.unitDay),
    evening: amount(x.hoursEvening, x.unitEvening),
    activeNight: amount(x.hoursActiveNight, x.unitActiveNight),
    sleepover: amount(x.hoursSleepover, x.unitSleepover),
    saturday: amount(x.hoursSaturday, x.unitSaturday),
    sunday: amount(x.hoursSunday, x.unitSunday),
    publicHoliday: amount(x.hoursPublicHoliday, x.unitPublicHoliday),
  };
}

export function grandTotal(lines: ReturnType<typeof lineTotals>[]) {
  return lines.reduce((acc, t) =>
    acc.plus(t.day).plus(t.evening).plus(t.activeNight).plus(t.sleepover)
       .plus(t.saturday).plus(t.sunday).plus(t.publicHoliday), new Decimal(0));
}

// Helper function to get line item total
export function getLineItemTotal(item: RateSet): Decimal {
  const totals = lineTotals(item);
  return totals.day.plus(totals.evening).plus(totals.activeNight).plus(totals.sleepover)
    .plus(totals.saturday).plus(totals.sunday).plus(totals.publicHoliday);
}

// Helper function to format decimal as currency string
export function formatCurrency(amount: Decimal): string {
  return `$${amount.toFixed(2)}`;
}

// Helper function to convert item with decimal strings to RateSet
export function itemToRateSet(item: any): RateSet {
  return {
    hoursDay: item.hoursDay || "0",
    hoursEvening: item.hoursEvening || "0", 
    hoursActiveNight: item.hoursActiveNight || "0",
    hoursSleepover: item.hoursSleepover || "0",
    hoursSaturday: item.hoursSaturday || "0",
    hoursSunday: item.hoursSunday || "0",
    hoursPublicHoliday: item.hoursPublicHoliday || "0",
    unitDay: item.unitDay || "0",
    unitEvening: item.unitEvening || "0",
    unitActiveNight: item.unitActiveNight || "0", 
    unitSleepover: item.unitSleepover || "0",
    unitSaturday: item.unitSaturday || "0",
    unitSunday: item.unitSunday || "0",
    unitPublicHoliday: item.unitPublicHoliday || "0",
    weeks: item.weeks || 1,
  };
}