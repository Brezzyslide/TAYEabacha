import { roles, getRoleByName } from "./roles";
import { permissions, getPermissions } from "./permissions";
import { SCOPES } from "./scopes";
import type { User } from "@shared/schema";

/**
 * Extended user interface for permission checking
 */
interface UserWithPermissions extends User {
  companyId?: string;
  clientAssignments?: number[];
}

/**
 * Check if a user has permission to perform an action on a module
 * 
 * @param user - User object with role and company information
 * @param module - Module name (e.g., "clients", "shifts", "forms")
 * @param action - Action to perform (e.g., "view", "create", "edit", "delete")
 * @param targetCompanyId - Company ID of the target resource (optional)
 * @param targetClientId - Client ID of the target resource (optional for assigned scope)
 * @returns boolean indicating if user has permission
 */
export function hasPermission(
  user: UserWithPermissions,
  module: string,
  action: string,
  targetCompanyId?: string,
  targetClientId?: number
): boolean {
  // Null checks
  if (!user || !user.role) return false;

  // Get role definition
  const role = getRoleByName(user.role);
  if (!role) return false;

  // ConsoleManager has global access
  if (role.name === "ConsoleManager") return true;

  // Company boundary enforcement (except for ConsoleManager)
  if (targetCompanyId && user.companyId !== targetCompanyId) {
    return false;
  }

  // Get permissions for this role and module
  const permission = getPermissions(role.name, module);
  if (!permission) return false;

  // Check if action is allowed
  const hasActionPermission = permission.actions.includes("*") || permission.actions.includes(action);
  if (!hasActionPermission) return false;

  // Scope-based access control
  switch (permission.scope) {
    case SCOPES.GLOBAL:
      return true;

    case SCOPES.COMPANY:
      // User must belong to the same company
      return !targetCompanyId || user.companyId === targetCompanyId;

    case SCOPES.ASSIGNED:
      // User must be assigned to the specific client
      if (!targetClientId) return false;
      return user.clientAssignments?.includes(targetClientId) ?? false;

    default:
      return false;
  }
}

/**
 * Check if user can access a specific module (any action)
 */
export function canAccessModule(user: UserWithPermissions, module: string): boolean {
  if (!user || !user.role) return false;
  
  const role = getRoleByName(user.role);
  if (!role) return false;

  if (role.name === "ConsoleManager") return true;

  const permission = getPermissions(role.name, module);
  return !!permission && permission.actions.length > 0;
}

/**
 * Get all available actions for a user on a module
 */
export function getAvailableActions(user: UserWithPermissions, module: string): string[] {
  if (!user || !user.role) return [];
  
  const role = getRoleByName(user.role);
  if (!role) return [];

  const permission = getPermissions(role.name, module);
  if (!permission) return [];

  return permission.actions.includes("*") 
    ? ["view", "create", "edit", "delete", "export"]
    : permission.actions;
}

/**
 * Check if user has admin-level permissions
 */
export function isAdmin(user: UserWithPermissions): boolean {
  if (!user || !user.role) return false;
  
  const role = getRoleByName(user.role);
  return role ? role.level >= 4 : false;
}

/**
 * Check if user can manage companies (ConsoleManager only)
 */
export function canManageCompanies(user: UserWithPermissions): boolean {
  return user?.role === "ConsoleManager";
}