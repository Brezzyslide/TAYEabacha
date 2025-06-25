import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building, Users, UserCheck, UserX } from "lucide-react";

interface StaffStatistic {
  tenantId: number;
  companyName: string;
  role: string;
  activeCount: number;
  inactiveCount: number;
  totalCount: number;
}

export default function TenantStaffOverview() {
  const { data: staffStats = [], isLoading } = useQuery<StaffStatistic[]>({
    queryKey: ["/api/billing/staff-statistics"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Multi-Tenant Staff Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            Loading staff statistics...
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group by tenant
  const tenantGroups = staffStats.reduce((acc, stat) => {
    if (!acc[stat.tenantId]) {
      acc[stat.tenantId] = {
        tenantId: stat.tenantId,
        companyName: stat.companyName,
        roles: []
      };
    }
    acc[stat.tenantId].roles.push(stat);
    return acc;
  }, {} as Record<number, { tenantId: number; companyName: string; roles: StaffStatistic[] }>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5" />
          Multi-Tenant Staff Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.values(tenantGroups).map(tenant => {
          const totalActive = tenant.roles.reduce((sum, role) => sum + role.activeCount, 0);
          const totalInactive = tenant.roles.reduce((sum, role) => sum + role.inactiveCount, 0);
          const totalStaff = totalActive + totalInactive;

          return (
            <div key={tenant.tenantId} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-lg">
                    {tenant.companyName || `Tenant ${tenant.tenantId}`}
                  </h3>
                  <Badge variant="outline">
                    Tenant ID: {tenant.tenantId}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 text-green-600">
                    <UserCheck className="h-4 w-4" />
                    <span>{totalActive} active</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-500">
                    <UserX className="h-4 w-4" />
                    <span>{totalInactive} inactive</span>
                  </div>
                  <div className="flex items-center gap-1 font-medium">
                    <Users className="h-4 w-4" />
                    <span>{totalStaff} total</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {tenant.roles.map(role => (
                  <div key={role.role} className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary">{role.role}</Badge>
                      <span className="text-sm font-medium">{role.totalCount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600">{role.activeCount} active</span>
                      <span className="text-gray-500">{role.inactiveCount} inactive</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {Object.keys(tenantGroups).length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            No staff data found across tenants
          </div>
        )}
      </CardContent>
    </Card>
  );
}