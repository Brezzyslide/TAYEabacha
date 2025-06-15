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
  // Debug logging for staff module
  const isStaffModule = module === "staff" && (action === "edit" || action === "reset-password");
  
  // Null checks
  if (!user || !user.role) {
    if (isStaffModule) console.log(`[hasPermission] FAIL: No user or role`);
    return false;
  }

  // Get role definition
  const role = getRoleByName(user.role);
  if (!role) {
    if (isStaffModule) console.log(`[hasPermission] FAIL: Role not found for ${user.role}`);
    return false;
  }

  // ConsoleManager has global access
  if (role.name === "ConsoleManager") {
    if (isStaffModule) console.log(`[hasPermission] PASS: ConsoleManager global access`);
    return true;
  }

  // Tenant boundary enforcement  
  // For multi-tenant system, we use tenantId for data isolation
  // No cross-tenant access allowed except for ConsoleManager
  if (targetCompanyId && user.tenantId.toString() !== targetCompanyId) {
    // Only ConsoleManager can cross tenant boundaries
    if (role.name !== "ConsoleManager") {
      if (isStaffModule) console.log(`[hasPermission] FAIL: Tenant boundary violation`, { userTenant: user.tenantId, targetCompany: targetCompanyId });
      return false;
    }
  }

  // Get permissions for this role and module
  const permission = getPermissions(role.name, module);
  if (!permission) {
    if (isStaffModule) console.log(`[hasPermission] FAIL: No permission found for role ${role.name} module ${module}`);
    return false;
  }

  // Check if action is allowed
  const hasActionPermission = permission.actions.includes("*") || permission.actions.includes(action);
  if (!hasActionPermission) {
    if (isStaffModule) console.log(`[hasPermission] FAIL: Action ${action} not in permissions`, permission.actions);
    return false;
  }

  // Scope-based access control
  switch (permission.scope) {
    case SCOPES.GLOBAL:
      if (isStaffModule) console.log(`[hasPermission] PASS: Global scope`);
      return true;

    case SCOPES.COMPANY:
      // Admin has full company access without targetCompanyId restrictions
      if (role.name === "Admin") {
        if (isStaffModule) console.log(`[hasPermission] PASS: Admin company access`);
        return true;
      }
      // User must belong to the same tenant
      const tenantResult = !targetCompanyId || user.tenantId.toString() === targetCompanyId;
      if (isStaffModule) console.log(`[hasPermission] Tenant scope result:`, tenantResult, { userTenant: user.tenantId, targetCompany: targetCompanyId });
      return tenantResult;

    case SCOPES.ASSIGNED:
      // User must be assigned to the specific client
      if (!targetClientId) {
        if (isStaffModule) console.log(`[hasPermission] FAIL: Assigned scope requires targetClientId`);
        return false;
      }
      const assignedResult = user.clientAssignments?.includes(targetClientId) ?? false;
      if (isStaffModule) console.log(`[hasPermission] Assigned scope result:`, assignedResult);
      return assignedResult;

    default:
      if (isStaffModule) console.log(`[hasPermission] FAIL: Unknown scope ${permission.scope}`);
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