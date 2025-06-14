import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, 
  Users, 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  UserCheck,
  Lock,
  Key,
  Building,
  Info
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CustomRole, CustomPermission, UserRoleAssignment } from "@shared/schema";
import CreateRoleModal from "./components/CreateRoleModal";
import PermissionOverrideModal from "./components/PermissionOverrideModal";
import AssignRoleModal from "./components/AssignRoleModal";

interface RoleStats {
  totalCustomRoles: number;
  totalPermissionOverrides: number;
  totalUserAssignments: number;
  builtInRoles: number;
}

export default function RolesPermissionsDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<CustomRole | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedBuiltInRole, setSelectedBuiltInRole] = useState<{ name: string; displayName: string } | null>(null);

  // Fetch data
  const { data: customRoles = [], isLoading: rolesLoading } = useQuery<CustomRole[]>({
    queryKey: ['/api/custom-roles'],
  });

  const { data: customPermissions = [], isLoading: permissionsLoading } = useQuery<CustomPermission[]>({
    queryKey: ['/api/custom-permissions'],
  });

  const { data: userAssignments = [], isLoading: assignmentsLoading } = useQuery<UserRoleAssignment[]>({
    queryKey: ['/api/user-role-assignments'],
  });

  // Calculate stats
  const stats: RoleStats = {
    totalCustomRoles: customRoles.length,
    totalPermissionOverrides: customPermissions.filter(p => p.isOverride).length,
    totalUserAssignments: userAssignments.length,
    builtInRoles: 5, // SupportWorker, TeamLeader, Coordinator, Admin, ConsoleManager
  };

  // Delete mutations
  const deleteRoleMutation = useMutation({
    mutationFn: (roleId: number) => apiRequest(`/api/custom-roles/${roleId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/custom-roles'] });
      toast({ title: "Role deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete role", variant: "destructive" });
    },
  });

  const deletePermissionMutation = useMutation({
    mutationFn: (permissionId: number) => apiRequest(`/api/custom-permissions/${permissionId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/custom-permissions'] });
      toast({ title: "Permission deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete permission", variant: "destructive" });
    },
  });

  const revokeAssignmentMutation = useMutation({
    mutationFn: (assignmentId: number) => apiRequest(`/api/user-role-assignments/${assignmentId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-role-assignments'] });
      toast({ title: "Role assignment revoked successfully" });
    },
    onError: () => {
      toast({ title: "Failed to revoke role assignment", variant: "destructive" });
    },
  });

  // Built-in roles data
  const builtInRoles = [
    { 
      name: "SupportWorker", 
      displayName: "Support Worker", 
      description: "Front-line care staff with assigned client access",
      scope: "assigned",
      userCount: 0 // Would need actual count from API
    },
    { 
      name: "TeamLeader", 
      displayName: "Team Leader", 
      description: "Senior care staff with extended assigned client management",
      scope: "assigned+",
      userCount: 0
    },
    { 
      name: "Coordinator", 
      displayName: "Coordinator", 
      description: "Mid-management with company-wide operational access",
      scope: "company",
      userCount: 0
    },
    { 
      name: "Admin", 
      displayName: "Administrator", 
      description: "Full company management including staff administration",
      scope: "company",
      userCount: 0
    },
    { 
      name: "ConsoleManager", 
      displayName: "Console Manager", 
      description: "System-wide access across all companies and tenants",
      scope: "global",
      userCount: 1
    },
  ];

  if (rolesLoading || permissionsLoading || assignmentsLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold">Roles & Permissions</h1>
            <p className="text-gray-600 dark:text-gray-400">Loading role management system...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold">Roles & Permissions</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage custom roles, permissions, and user assignments
            </p>
          </div>
        </div>
        <Button 
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => setIsCreateModalOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Custom Role
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Built-in Roles</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.builtInRoles}</div>
            <p className="text-xs text-muted-foreground">System-defined roles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custom Roles</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCustomRoles}</div>
            <p className="text-xs text-muted-foreground">Organization-specific roles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Permission Overrides</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPermissionOverrides}</div>
            <p className="text-xs text-muted-foreground">Custom permission rules</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Assignments</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUserAssignments}</div>
            <p className="text-xs text-muted-foreground">Users with custom roles</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="built-in-roles" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="built-in-roles">Built-in Roles</TabsTrigger>
          <TabsTrigger value="custom-roles">Custom Roles</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="assignments">User Assignments</TabsTrigger>
        </TabsList>

        {/* Built-in Roles Tab */}
        <TabsContent value="built-in-roles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Built-in Role Hierarchy
              </CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                System-defined roles with default permissions. These cannot be deleted but can be overridden with custom permissions.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {builtInRoles.map((role) => (
                  <Card key={role.name} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{role.displayName}</CardTitle>
                        <Badge variant={role.scope === "global" ? "default" : role.scope === "company" ? "secondary" : "outline"}>
                          {role.scope}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {role.description}
                      </p>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Users: {role.userCount}</span>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedBuiltInRole({ name: role.name, displayName: role.displayName });
                            setIsOverrideModalOpen(true);
                          }}
                        >
                          <Settings className="h-3 w-3 mr-1" />
                          Override
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Custom Roles Tab */}
        <TabsContent value="custom-roles" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Custom Roles
                </CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Organization-specific roles that extend or modify built-in permissions
                </p>
              </div>
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Role
              </Button>
            </CardHeader>
            <CardContent>
              {customRoles.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No Custom Roles
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Create custom roles to extend built-in functionality for specific organizational needs.
                  </p>
                  <Button onClick={() => setIsCreateModalOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Role
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {customRoles.map((role) => (
                    <Card key={role.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{role.displayName}</CardTitle>
                          <Badge variant="outline">Custom</Badge>
                        </div>
                        {role.basedOnRole && (
                          <p className="text-xs text-gray-500">Based on {role.basedOnRole}</p>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {role.description || "No description provided"}
                        </p>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" disabled>
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => deleteRoleMutation.mutate(role.id)}
                            disabled={deleteRoleMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Permission Matrix
                </CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Custom permission overrides and role-specific permissions
                </p>
              </div>
              <Button disabled>
                <Plus className="h-4 w-4 mr-2" />
                Add Permission
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-200">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-200 p-3 text-left font-medium">Module</th>
                      <th className="border border-gray-200 p-3 text-center font-medium">Support Worker</th>
                      <th className="border border-gray-200 p-3 text-center font-medium">Team Leader</th>
                      <th className="border border-gray-200 p-3 text-center font-medium">Coordinator</th>
                      <th className="border border-gray-200 p-3 text-center font-medium">Admin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { module: "Client Management", sw: "View (Assigned)", tl: "View, Edit (Assigned)", coord: "View, Create, Edit", admin: "Full Access" },
                      { module: "Shift Management", sw: "View (Own)", tl: "View, Create (Team)", coord: "View, Create, Edit", admin: "Full Access" },
                      { module: "Medications", sw: "View, Record (Assigned)", tl: "View, Record (Assigned)", coord: "View, Create, Edit", admin: "Full Access" },
                      { module: "Case Notes", sw: "View, Create (Assigned)", tl: "View, Create, Edit (Assigned)", coord: "View, Create, Edit", admin: "Full Access" },
                      { module: "Incident Reports", sw: "View, Create (Assigned)", tl: "View, Create, Edit (Assigned)", coord: "View, Create, Edit", admin: "Full Access" },
                      { module: "Staff Management", sw: "View (Limited)", tl: "View (Team)", coord: "View, Create, Edit", admin: "Full Access" },
                      { module: "Hour Allocation", sw: "View (Own)", tl: "View (Team)", coord: "View, Create, Edit", admin: "Full Access" },
                      { module: "Internal Messaging", sw: "View, Create", tl: "View, Create", coord: "View, Create, Edit", admin: "Full Access" },
                      { module: "Roles & Permissions", sw: "None", tl: "None", coord: "None", admin: "Full Access" },
                    ].map((row, index) => (
                      <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="border border-gray-200 p-3 font-medium">{row.module}</td>
                        <td 
                          className="border border-gray-200 p-3 text-center text-sm cursor-pointer hover:bg-blue-50 transition-colors"
                          onClick={() => {
                            setSelectedBuiltInRole({ name: "SupportWorker", displayName: "Support Worker" });
                            setIsOverrideModalOpen(true);
                          }}
                        >
                          {row.sw}
                        </td>
                        <td 
                          className="border border-gray-200 p-3 text-center text-sm cursor-pointer hover:bg-blue-50 transition-colors"
                          onClick={() => {
                            setSelectedBuiltInRole({ name: "TeamLeader", displayName: "Team Leader" });
                            setIsOverrideModalOpen(true);
                          }}
                        >
                          {row.tl}
                        </td>
                        <td 
                          className="border border-gray-200 p-3 text-center text-sm cursor-pointer hover:bg-blue-50 transition-colors"
                          onClick={() => {
                            setSelectedBuiltInRole({ name: "Coordinator", displayName: "Coordinator" });
                            setIsOverrideModalOpen(true);
                          }}
                        >
                          {row.coord}
                        </td>
                        <td 
                          className="border border-gray-200 p-3 text-center text-sm cursor-pointer hover:bg-blue-50 transition-colors"
                          onClick={() => {
                            setSelectedBuiltInRole({ name: "Admin", displayName: "Admin" });
                            setIsOverrideModalOpen(true);
                          }}
                        >
                          {row.admin}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  <Key className="h-4 w-4 inline mr-2" />
                  Click any cell to override permissions for that role and module. Custom overrides will be highlighted.
                </p>
              </div>
              
              {/* Show existing custom permissions below the matrix */}
              {customPermissions.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-md font-medium mb-4">Active Permission Overrides</h4>
                  <div className="space-y-2">
                    {customPermissions.map((permission) => (
                      <div key={permission.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded border-l-4 border-yellow-400">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{permission.module}</Badge>
                          <span className="text-sm">
                            {Array.isArray(permission.actions) ? (permission.actions as string[]).join(", ") : "None"}
                          </span>
                          <Badge variant="secondary">{permission.scope}</Badge>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => deletePermissionMutation.mutate(permission.id)}
                          disabled={deletePermissionMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Assignments Tab */}
        <TabsContent value="assignments" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  User Role Assignments
                </CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Manage custom role assignments for individual users
                </p>
              </div>
              <Button onClick={() => setIsAssignModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Assign Role
              </Button>
            </CardHeader>
            <CardContent>
              {userAssignments.length === 0 ? (
                <div className="text-center py-8">
                  <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No Role Assignments
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Assign custom roles to users to override their default built-in role permissions.
                  </p>
                  <Button onClick={() => setIsAssignModalOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Assignment
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {userAssignments.map((assignment) => (
                    <Card key={assignment.id} className="hover:shadow-sm transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">User ID: {assignment.userId}</span>
                              {assignment.roleId && <Badge>Custom Role ID: {assignment.roleId}</Badge>}
                              {assignment.builtInRole && <Badge variant="outline">Built-in: {assignment.builtInRole}</Badge>}
                            </div>
                            <p className="text-xs text-gray-500">
                              Assigned: {new Date(assignment.assignedAt).toLocaleDateString()}
                            </p>
                            {assignment.expiresAt && (
                              <p className="text-xs text-gray-500">
                                Expires: {new Date(assignment.expiresAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => revokeAssignmentMutation.mutate(assignment.id)}
                            disabled={revokeAssignmentMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Revoke
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Role Modal */}
      <CreateRoleModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* Permission Override Modal */}
      {selectedBuiltInRole && (
        <PermissionOverrideModal
          isOpen={isOverrideModalOpen}
          onClose={() => {
            setIsOverrideModalOpen(false);
            setSelectedBuiltInRole(null);
          }}
          roleName={selectedBuiltInRole.name}
          roleDisplayName={selectedBuiltInRole.displayName}
        />
      )}

      {/* Assign Role Modal */}
      <AssignRoleModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
      />
    </div>
  );
}