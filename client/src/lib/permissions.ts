/**
 * CENTRALIZED PERMISSION SYSTEM
 * Eliminates case sensitivity issues and provides consistent role-based access control
 * across ALL current and future components
 */

export interface User {
  id: number;
  role?: string;
  tenantId: number;
  [key: string]: any;
}

/**
 * Standardized role names (lowercase for consistency)
 */
export const ROLES = {
  SUPPORT_WORKER: 'supportworker',
  TEAM_LEADER: 'teamleader', 
  COORDINATOR: 'coordinator',
  ADMIN: 'admin',
  CONSOLE_MANAGER: 'consolemanager'
} as const;

/**
 * Role hierarchy for permission inheritance
 */
const ROLE_HIERARCHY: Record<string, string[]> = {
  [ROLES.CONSOLE_MANAGER]: [ROLES.ADMIN, ROLES.COORDINATOR, ROLES.TEAM_LEADER, ROLES.SUPPORT_WORKER],
  [ROLES.ADMIN]: [ROLES.COORDINATOR, ROLES.TEAM_LEADER, ROLES.SUPPORT_WORKER],
  [ROLES.COORDINATOR]: [ROLES.TEAM_LEADER, ROLES.SUPPORT_WORKER],
  [ROLES.TEAM_LEADER]: [ROLES.SUPPORT_WORKER],
  [ROLES.SUPPORT_WORKER]: []
};

/**
 * Permission definitions for different actions
 */
export const PERMISSIONS = {
  // Shift Management
  CREATE_SHIFT: [ROLES.COORDINATOR, ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  VIEW_SHIFTS: [ROLES.SUPPORT_WORKER, ROLES.TEAM_LEADER, ROLES.COORDINATOR, ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  EDIT_SHIFTS: [ROLES.COORDINATOR, ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  
  // Task Management
  CREATE_TASK: [ROLES.TEAM_LEADER, ROLES.COORDINATOR, ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  VIEW_TASKS: [ROLES.SUPPORT_WORKER, ROLES.TEAM_LEADER, ROLES.COORDINATOR, ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  EDIT_TASKS: [ROLES.TEAM_LEADER, ROLES.COORDINATOR, ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  DELETE_TASKS: [ROLES.TEAM_LEADER, ROLES.COORDINATOR, ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  
  // Care Plans
  CREATE_CARE_PLAN: [ROLES.TEAM_LEADER, ROLES.COORDINATOR, ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  VIEW_CARE_PLANS: [ROLES.SUPPORT_WORKER, ROLES.TEAM_LEADER, ROLES.COORDINATOR, ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  EDIT_CARE_PLANS: [ROLES.TEAM_LEADER, ROLES.COORDINATOR, ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  DELETE_CARE_PLANS: [ROLES.COORDINATOR, ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  
  // Case Notes  
  CREATE_CASE_NOTE: [ROLES.SUPPORT_WORKER, ROLES.TEAM_LEADER, ROLES.COORDINATOR, ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  VIEW_ALL_CASE_NOTES: [ROLES.TEAM_LEADER, ROLES.COORDINATOR, ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  VIEW_ASSIGNED_CASE_NOTES: [ROLES.SUPPORT_WORKER], // Only for their assigned clients
  EDIT_CASE_NOTES: [ROLES.TEAM_LEADER, ROLES.COORDINATOR, ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  
  // Staff Management
  CREATE_STAFF: [ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  VIEW_STAFF: [ROLES.TEAM_LEADER, ROLES.COORDINATOR, ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  EDIT_STAFF: [ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  RESET_PASSWORD: [ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  
  // Client Management
  CREATE_CLIENT: [ROLES.COORDINATOR, ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  VIEW_ALL_CLIENTS: [ROLES.TEAM_LEADER, ROLES.COORDINATOR, ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  VIEW_ASSIGNED_CLIENTS: [ROLES.SUPPORT_WORKER], // Only clients in their shifts
  EDIT_CLIENT: [ROLES.COORDINATOR, ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  
  // Budget Management
  VIEW_ALL_BUDGETS: [ROLES.TEAM_LEADER, ROLES.COORDINATOR, ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  VIEW_ASSIGNED_BUDGETS: [ROLES.SUPPORT_WORKER], // Only for their assigned clients
  EDIT_BUDGETS: [ROLES.TEAM_LEADER, ROLES.COORDINATOR, ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  
  // Incident Reports
  CREATE_INCIDENT: [ROLES.SUPPORT_WORKER, ROLES.TEAM_LEADER, ROLES.COORDINATOR, ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  VIEW_ALL_INCIDENTS: [ROLES.TEAM_LEADER, ROLES.COORDINATOR, ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  VIEW_ASSIGNED_INCIDENTS: [ROLES.SUPPORT_WORKER], // Only for their assigned clients
  
  // Medication Management
  VIEW_ALL_MEDICATIONS: [ROLES.TEAM_LEADER, ROLES.COORDINATOR, ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  VIEW_ASSIGNED_MEDICATIONS: [ROLES.SUPPORT_WORKER], // Only for their assigned clients
  ADMINISTER_MEDICATION: [ROLES.SUPPORT_WORKER, ROLES.TEAM_LEADER, ROLES.COORDINATOR, ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  MANAGE_PRICING: [ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  
  // Compliance Module - Only Admin and Coordinator can access
  ACCESS_COMPLIANCE: [ROLES.COORDINATOR, ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  CREATE_SERVICE_AGREEMENT: [ROLES.COORDINATOR, ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  VIEW_SERVICE_AGREEMENTS: [ROLES.COORDINATOR, ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  EDIT_SERVICE_AGREEMENTS: [ROLES.COORDINATOR, ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  DELETE_SERVICE_AGREEMENTS: [ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
  EXPORT_SERVICE_AGREEMENTS: [ROLES.COORDINATOR, ROLES.ADMIN, ROLES.CONSOLE_MANAGER],
} as const;

/**
 * Normalize role name to lowercase for consistent comparison
 */
function normalizeRole(role?: string): string {
  if (!role) return '';
  return role.toLowerCase().replace(/\s+/g, '');
}

/**
 * Check if user has specific permission
 * CASE-INSENSITIVE and BULLETPROOF
 */
export function hasPermission(user: User | null | undefined, permission: keyof typeof PERMISSIONS): boolean {
  if (!user?.role) return false;
  
  const normalizedUserRole = normalizeRole(user.role);
  const allowedRoles = PERMISSIONS[permission];
  
  // Check direct permission
  if ((allowedRoles as readonly string[]).includes(normalizedUserRole)) {
    return true;
  }
  
  // Check inherited permissions through hierarchy
  const userHierarchy = ROLE_HIERARCHY[normalizedUserRole] || [];
  return allowedRoles.some(allowedRole => userHierarchy.includes(allowedRole));
}

/**
 * Check if user has any of the specified roles
 * CASE-INSENSITIVE replacement for scattered role checks
 */
export function hasRole(user: User | null | undefined, roles: string[]): boolean {
  if (!user?.role) return false;
  
  const normalizedUserRole = normalizeRole(user.role);
  const normalizedRoles = roles.map(role => normalizeRole(role));
  
  return normalizedRoles.includes(normalizedUserRole);
}

/**
 * Check if user has minimum role level
 */
export function hasMinimumRole(user: User | null | undefined, minimumRole: string): boolean {
  if (!user?.role) return false;
  
  const normalizedUserRole = normalizeRole(user.role);
  const normalizedMinRole = normalizeRole(minimumRole);
  
  // Check if user has the exact role
  if (normalizedUserRole === normalizedMinRole) return true;
  
  // Check if user has higher role through hierarchy
  const userHierarchy = ROLE_HIERARCHY[normalizedUserRole] || [];
  return userHierarchy.includes(normalizedMinRole as any);
}

/**
 * Get user's permission level for display
 */
export function getUserPermissionLevel(user: User | null | undefined): string {
  if (!user?.role) return 'No Access';
  
  const normalizedRole = normalizeRole(user.role);
  
  switch (normalizedRole) {
    case ROLES.CONSOLE_MANAGER: return 'Console Manager';
    case ROLES.ADMIN: return 'Administrator';
    case ROLES.COORDINATOR: return 'Coordinator';
    case ROLES.TEAM_LEADER: return 'Team Leader';
    case ROLES.SUPPORT_WORKER: return 'Support Worker';
    default: return 'Unknown Role';
  }
}

/**
 * Legacy compatibility functions
 * These ensure existing code continues to work while migration happens
 */
export const canCreateTasks = (user: User | null | undefined) => hasPermission(user, 'CREATE_TASK');
export const canCreateShifts = (user: User | null | undefined) => hasPermission(user, 'CREATE_SHIFT');
export const canCreateCarePlans = (user: User | null | undefined) => hasPermission(user, 'CREATE_CARE_PLAN');
export const canEditCarePlans = (user: User | null | undefined) => hasPermission(user, 'EDIT_CARE_PLANS');
export const canManageStaff = (user: User | null | undefined) => hasPermission(user, 'EDIT_STAFF');
export const canCreateClients = (user: User | null | undefined) => hasPermission(user, 'CREATE_CLIENT');