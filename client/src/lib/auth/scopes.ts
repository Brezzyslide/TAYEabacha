/**
 * Scope constants for permission levels
 */
export const SCOPES = {
  ASSIGNED: "assigned",    // Only assigned clients/resources
  COMPANY: "company",      // All resources within company
  GLOBAL: "global"         // System-wide access
} as const;

export type Scope = typeof SCOPES[keyof typeof SCOPES];