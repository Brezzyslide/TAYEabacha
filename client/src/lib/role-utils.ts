/**
 * Standardized role checking utilities for consistent case-insensitive role management
 */

export type UserRole = 'SupportWorker' | 'TeamLeader' | 'Coordinator' | 'Admin' | 'ConsoleManager';

export type RoleLevel = 'SupportWorker' | 'TeamLeader' | 'Coordinator' | 'Admin' | 'ConsoleManager';

/**
 * Normalize role to standard case
 */
export function normalizeRole(role: string | undefined | null): UserRole | null {
  if (!role) return null;
  
  const normalized = role.toLowerCase().trim();
  
  switch (normalized) {
    case 'supportworker':
    case 'staff':
      return 'SupportWorker';
    case 'teamleader':
      return 'TeamLeader';
    case 'coordinator':
      return 'Coordinator';
    case 'admin':
      return 'Admin';
    case 'consolemanager':
      return 'ConsoleManager';
    default:
      return null;
  }
}

/**
 * Check if user has specific role (case-insensitive)
 */
export function hasRole(userRole: string | undefined | null, targetRole: UserRole): boolean {
  const normalized = normalizeRole(userRole);
  return normalized === targetRole;
}

/**
 * Check if user has any of the specified roles (case-insensitive)
 */
export function hasAnyRole(userRole: string | undefined | null, targetRoles: UserRole[]): boolean {
  const normalized = normalizeRole(userRole);
  return normalized ? targetRoles.includes(normalized) : false;
}

/**
 * Check if user role meets minimum level requirement
 * Role hierarchy: SupportWorker < TeamLeader < Coordinator < Admin < ConsoleManager
 */
export function hasMinimumRole(userRole: string | undefined | null, minimumRole: UserRole): boolean {
  const normalized = normalizeRole(userRole);
  if (!normalized) return false;
  
  const hierarchy: Record<UserRole, number> = {
    'SupportWorker': 1,
    'TeamLeader': 2,
    'Coordinator': 3,
    'Admin': 4,
    'ConsoleManager': 5
  };
  
  return hierarchy[normalized] >= hierarchy[minimumRole];
}

/**
 * Check if user can manage companies (ConsoleManager only)
 */
export function canManageCompanies(user: any): boolean {
  return hasRole(user?.role, 'ConsoleManager');
}

/**
 * Check if user can view billing analytics
 */
export function canViewBilling(user: any): boolean {
  return hasAnyRole(user?.role, ['Admin', 'TeamLeader', 'Coordinator', 'ConsoleManager']);
}

/**
 * Check if user is admin level (Admin or ConsoleManager)
 */
export function isAdminLevel(user: any): boolean {
  return hasAnyRole(user?.role, ['Admin', 'ConsoleManager']);
}

/**
 * Check if user can manage staff
 */
export function canManageStaff(user: any): boolean {
  return hasAnyRole(user?.role, ['Admin', 'ConsoleManager', 'TeamLeader', 'Coordinator']);
}

/**
 * Role display names for UI
 */
export function getRoleDisplayName(role: string | undefined | null): string {
  const normalized = normalizeRole(role);
  if (!normalized) return 'Unknown';
  
  switch (normalized) {
    case 'SupportWorker':
      return 'Support Worker';
    case 'TeamLeader':
      return 'Team Leader';
    case 'Coordinator':
      return 'Coordinator';
    case 'Admin':
      return 'Administrator';
    case 'ConsoleManager':
      return 'Console Manager';
    default:
      return 'Unknown';
  }
}