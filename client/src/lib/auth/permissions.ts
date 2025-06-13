import { Scope } from "./scopes";

/**
 * Permission definition interface
 */
export interface Permission {
  roleName: string;
  module: string;
  actions: string[];
  scope: Scope;
}

/**
 * Comprehensive permission matrix for all roles and modules
 */
export const permissions: Permission[] = [
  // SupportWorker permissions - view only assigned content
  { roleName: "SupportWorker", module: "clients", actions: ["view"], scope: "assigned" },
  { roleName: "SupportWorker", module: "shifts", actions: ["view"], scope: "assigned" },
  { roleName: "SupportWorker", module: "forms", actions: ["view", "create"], scope: "assigned" },
  { roleName: "SupportWorker", module: "reports", actions: ["view"], scope: "assigned" },
  { roleName: "SupportWorker", module: "case-notes", actions: ["view", "create"], scope: "assigned" },
  { roleName: "SupportWorker", module: "observations", actions: ["view", "create"], scope: "assigned" },
  { roleName: "SupportWorker", module: "medications", actions: ["view"], scope: "assigned" },
  { roleName: "SupportWorker", module: "care-plans", actions: ["view"], scope: "assigned" },
  { roleName: "SupportWorker", module: "incidents", actions: ["create"], scope: "assigned" },

  // TeamLeader permissions - edit assigned content
  { roleName: "TeamLeader", module: "clients", actions: ["view", "edit"], scope: "assigned" },
  { roleName: "TeamLeader", module: "shifts", actions: ["view", "edit"], scope: "assigned" },
  { roleName: "TeamLeader", module: "forms", actions: ["view", "create", "edit"], scope: "assigned" },
  { roleName: "TeamLeader", module: "reports", actions: ["view", "create"], scope: "assigned" },
  { roleName: "TeamLeader", module: "case-notes", actions: ["view", "create", "edit"], scope: "assigned" },
  { roleName: "TeamLeader", module: "observations", actions: ["view", "create", "edit"], scope: "assigned" },
  { roleName: "TeamLeader", module: "medications", actions: ["view", "edit"], scope: "assigned" },
  { roleName: "TeamLeader", module: "care-plans", actions: ["view", "edit"], scope: "assigned" },
  { roleName: "TeamLeader", module: "incidents", actions: ["view", "create", "edit"], scope: "assigned" },
  { roleName: "TeamLeader", module: "staff", actions: ["view"], scope: "company" },

  // Coordinator permissions - full company access for shifts & staff
  { roleName: "Coordinator", module: "clients", actions: ["view", "create", "edit"], scope: "company" },
  { roleName: "Coordinator", module: "shifts", actions: ["view", "create", "edit", "delete"], scope: "company" },
  { roleName: "Coordinator", module: "staff", actions: ["view", "edit"], scope: "company" },
  { roleName: "Coordinator", module: "forms", actions: ["view", "create", "edit"], scope: "company" },
  { roleName: "Coordinator", module: "reports", actions: ["view", "create", "export"], scope: "company" },
  { roleName: "Coordinator", module: "case-notes", actions: ["view", "create", "edit"], scope: "company" },
  { roleName: "Coordinator", module: "observations", actions: ["view", "create", "edit"], scope: "company" },
  { roleName: "Coordinator", module: "medications", actions: ["view", "edit"], scope: "company" },
  { roleName: "Coordinator", module: "care-plans", actions: ["view", "edit"], scope: "company" },
  { roleName: "Coordinator", module: "incidents", actions: ["view", "create", "edit"], scope: "company" },
  { roleName: "Coordinator", module: "dashboard", actions: ["view"], scope: "company" },

  // Admin permissions - full company access
  { roleName: "Admin", module: "*", actions: ["*"], scope: "company" },

  // ConsoleManager permissions - global system access
  { roleName: "ConsoleManager", module: "*", actions: ["*"], scope: "global" },
  { roleName: "ConsoleManager", module: "companies", actions: ["view", "create", "edit", "delete"], scope: "global" },
  { roleName: "ConsoleManager", module: "tenants", actions: ["view", "create", "edit", "delete"], scope: "global" },
];

/**
 * Get permissions for a specific role and module
 */
export const getPermissions = (roleName: string, module: string): Permission | undefined => {
  return permissions.find(p => 
    (p.roleName === roleName && p.module === module) ||
    (p.roleName === roleName && p.module === "*")
  );
};

/**
 * Check if a role has a specific action on a module
 */
export const hasAction = (roleName: string, module: string, action: string): boolean => {
  const permission = getPermissions(roleName, module);
  if (!permission) return false;
  
  return permission.actions.includes("*") || permission.actions.includes(action);
};