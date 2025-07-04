/**
 * Employment Type Constants
 * Shared across frontend and backend to ensure consistency
 */

export const EMPLOYMENT_TYPES = [
  { label: "Full-Time", value: "full-time" },
  { label: "Part-Time", value: "part-time" },
  { label: "Casual", value: "casual" },
] as const;

export const EMPLOYMENT_TYPE_VALUES = EMPLOYMENT_TYPES.map(type => type.value);

export type EmploymentType = typeof EMPLOYMENT_TYPE_VALUES[number];

// Validation helper
export const isValidEmploymentType = (value: string): value is EmploymentType => {
  return EMPLOYMENT_TYPE_VALUES.includes(value as EmploymentType);
};