import { getShiftTypeByTime, calculateShiftHours } from "./getShiftTypeByTime";

export interface BudgetDeductionParams {
  shiftStartTime: string | Date;
  shiftEndTime: string | Date;
  ratio: "1:1" | "1:2" | "1:3" | "1:4";
  fundingCategory: "SIL" | "CommunityAccess" | "CapacityBuilding";
  customRate?: number;
  defaultRates?: Record<string, Record<string, number>>;
}

export interface BudgetDeductionResult {
  shiftType: string;
  hours: number;
  ratio: string;
  rate: number;
  amount: number;
  category: string;
  ratioMultiplier: number;
}

/**
 * Calculates the budget deduction amount for a shift
 */
export function calculateFundingDeduction(params: BudgetDeductionParams): BudgetDeductionResult {
  const {
    shiftStartTime,
    shiftEndTime,
    ratio,
    fundingCategory,
    customRate,
    defaultRates = {}
  } = params;

  // Calculate shift details
  const shiftType = getShiftTypeByTime(shiftStartTime, shiftEndTime);
  const hours = calculateShiftHours(shiftStartTime, shiftEndTime);

  // Get ratio multiplier - higher ratios mean lower per-client cost
  const ratioMultiplier = getRatioMultiplier(ratio);

  // Determine the base rate
  let rate = customRate;
  if (!rate && defaultRates[shiftType] && defaultRates[shiftType][ratio]) {
    rate = defaultRates[shiftType][ratio];
  }
  if (!rate) {
    rate = getDefaultRate(shiftType, ratio);
  }

  // Calculate total amount
  const amount = rate * hours * ratioMultiplier;

  return {
    shiftType,
    hours,
    ratio,
    rate,
    amount: Math.round(amount * 100) / 100, // Round to 2 decimal places
    category: fundingCategory,
    ratioMultiplier,
  };
}

/**
 * Gets the cost multiplier for different staff ratios
 * Lower ratios (1:1) cost more per client, higher ratios (1:4) cost less
 */
function getRatioMultiplier(ratio: string): number {
  const multipliers = {
    "1:1": 1.0,   // Full cost
    "1:2": 0.6,   // 60% of full cost per client
    "1:3": 0.4,   // 40% of full cost per client
    "1:4": 0.3,   // 30% of full cost per client
  };
  
  return multipliers[ratio as keyof typeof multipliers] || 1.0;
}

/**
 * Default NDIS rates - these should come from the database in a real implementation
 */
function getDefaultRate(shiftType: string, ratio: string): number {
  const defaultRates = {
    AM: {
      "1:1": 65.00,
      "1:2": 65.00,
      "1:3": 65.00,
      "1:4": 65.00,
    },
    PM: {
      "1:1": 72.00,
      "1:2": 72.00,
      "1:3": 72.00,
      "1:4": 72.00,
    },
    ActiveNight: {
      "1:1": 85.00,
      "1:2": 85.00,
      "1:3": 85.00,
      "1:4": 85.00,
    },
    Sleepover: {
      "1:1": 320.00,
      "1:2": 320.00,
      "1:3": 320.00,
      "1:4": 320.00,
    },
  };

  return defaultRates[shiftType as keyof typeof defaultRates]?.[ratio as keyof typeof defaultRates.AM] || 65.00;
}

/**
 * Validates if a budget has sufficient funds for a deduction
 */
export function validateBudgetSufficiency(
  budget: any,
  deduction: BudgetDeductionResult
): { isValid: boolean; remaining: number; message?: string } {
  let remaining = 0;
  
  switch (deduction.category) {
    case "SIL":
      remaining = parseFloat(budget.silRemaining || "0");
      break;
    case "CommunityAccess":
      remaining = parseFloat(budget.communityAccessRemaining || "0");
      break;
    case "CapacityBuilding":
      remaining = parseFloat(budget.capacityBuildingRemaining || "0");
      break;
    default:
      return { isValid: false, remaining: 0, message: "Invalid funding category" };
  }

  const isValid = remaining >= deduction.amount;
  
  return {
    isValid,
    remaining,
    message: isValid ? undefined : `Insufficient ${deduction.category} funds. Available: $${remaining.toFixed(2)}, Required: $${deduction.amount.toFixed(2)}`
  };
}

/**
 * Checks if a ratio is allowed for a specific budget category
 */
export function isRatioAllowed(budget: any, category: string, ratio: string): boolean {
  switch (category) {
    case "SIL":
      return budget.silAllowedRatios?.includes(ratio) || false;
    case "CommunityAccess":
      return budget.communityAccessAllowedRatios?.includes(ratio) || false;
    case "CapacityBuilding":
      return budget.capacityBuildingAllowedRatios?.includes(ratio) || false;
    default:
      return false;
  }
}