/**
 * Role definitions for the multi-tenant CRM system
 */
export interface Role {
  id: number;
  name: string;
  level: number;
  description: string;
}

export const roles: Role[] = [
  {
    id: 1,
    name: "SupportWorker",
    level: 1,
    description: "View assigned content only"
  },
  {
    id: 2,
    name: "TeamLeader",
    level: 2,
    description: "Edit content for assigned clients"
  },
  {
    id: 3,
    name: "Coordinator",
    level: 3,
    description: "Full access to shifts & staff"
  },
  {
    id: 4,
    name: "Admin",
    level: 4,
    description: "All access in company"
  },
  {
    id: 5,
    name: "ConsoleManager",
    level: 5,
    description: "Global system access"
  }
];

export const getRoleByName = (name: string): Role | undefined => {
  // Handle case-insensitive role matching for database compatibility
  const normalizedName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  
  // Map legacy database role names to proper role names
  const roleMapping: { [key: string]: string } = {
    "admin": "Admin",
    "consolemanager": "ConsoleManager",
    "coordinator": "Coordinator",
    "teamleader": "TeamLeader", 
    "supportworker": "SupportWorker",
    "staff": "SupportWorker", // Legacy mapping
    "viewer": "SupportWorker" // Legacy mapping
  };
  
  const mappedRole = roleMapping[name.toLowerCase()] || normalizedName;
  return roles.find(role => role.name === mappedRole);
};

export const getRoleById = (id: number): Role | undefined => {
  return roles.find(role => role.id === id);
};