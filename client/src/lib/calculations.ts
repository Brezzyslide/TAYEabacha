import Decimal from "decimal.js";
import { lineTotals, grandTotal, getLineItemTotal, itemToRateSet, formatCurrency, type RateSet } from "../../../shared/utils/calc";

// Re-export calculation utilities for frontend use
export {
  lineTotals,
  grandTotal, 
  getLineItemTotal,
  itemToRateSet,
  formatCurrency,
  type RateSet
};

// Frontend-specific calculation helpers
export function calculateServiceAgreementTotal(items: any[]): string {
  if (!items || items.length === 0) return "$0.00";
  
  try {
    const itemRateSets = items.map(item => itemToRateSet(item));
    const lineBreakdowns = itemRateSets.map(rateSet => lineTotals(rateSet));
    const total = grandTotal(lineBreakdowns);
    return formatCurrency(total);
  } catch (error) {
    console.error('[CALC] Error calculating service agreement total:', error);
    return "$0.00";
  }
}

export function calculateItemTotal(item: any): string {
  if (!item) return "$0.00";
  
  try {
    const rateSet = itemToRateSet(item);
    const total = getLineItemTotal(rateSet);
    return formatCurrency(total);
  } catch (error) {
    console.error('[CALC] Error calculating item total:', error);
    return "$0.00";
  }
}

export function getItemLineBreakdown(item: any) {
  if (!item) return null;
  
  try {
    const rateSet = itemToRateSet(item);
    const breakdown = lineTotals(rateSet);
    
    return {
      day: formatCurrency(breakdown.day),
      evening: formatCurrency(breakdown.evening),
      activeNight: formatCurrency(breakdown.activeNight),
      sleepover: formatCurrency(breakdown.sleepover),
      saturday: formatCurrency(breakdown.saturday),
      sunday: formatCurrency(breakdown.sunday),
      publicHoliday: formatCurrency(breakdown.publicHoliday),
      total: formatCurrency(
        breakdown.day.plus(breakdown.evening).plus(breakdown.activeNight)
          .plus(breakdown.sleepover).plus(breakdown.saturday)
          .plus(breakdown.sunday).plus(breakdown.publicHoliday)
      )
    };
  } catch (error) {
    console.error('[CALC] Error getting item line breakdown:', error);
    return null;
  }
}

// Validation helpers
export function validateNumericInput(value: string): boolean {
  if (!value || value === "") return true; // Empty is valid
  try {
    new Decimal(value);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeNumericInput(value: string): string {
  if (!value || value === "") return "0";
  try {
    return new Decimal(value).toString();
  } catch {
    return "0";
  }
}