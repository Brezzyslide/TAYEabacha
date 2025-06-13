/**
 * Auth module exports
 * Centralized exports for role-based access control system
 */

// Core types and constants
export { SCOPES, type Scope } from "./scopes";
export { roles, getRoleByName, getRoleById, type Role } from "./roles";
export { permissions, getPermissions, hasAction, type Permission } from "./permissions";

// Permission checking functions
export {
  hasPermission,
  canAccessModule,
  getAvailableActions,
  isAdmin,
  canManageCompanies
} from "./hasPermission";