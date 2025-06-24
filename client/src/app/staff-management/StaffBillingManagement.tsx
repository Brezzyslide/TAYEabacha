import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { 
  UserCheck, 
  UserX, 
  DollarSign, 
  Users, 
  Search,
  AlertCircle,
  TrendingUp
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface StaffMember {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  billingStatus: string;
  billingRate: number;
  lastBillingSync: string;
  createdAt: string;
}

interface CompanyBilling {
  companyId: string;
  companyName: string;
  tenantId: number;
  activeStaff: {
    role: string;
    count: number;
    monthlyRate: number;
    totalMonthly: number;
  }[];
  totalMonthlyRevenue: number;
  currentCycleStart: string;
  nextBillingDate: string;
  status: string;
}

interface BillingRates {
  [key: string]: number;
}

export default function StaffBillingManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  // Get staff data
  const { data: staff = [], isLoading } = useQuery<StaffMember[]>({
    queryKey: ['/api/staff'],
    enabled: !!user && (user.role === 'Admin' || user.role === 'ConsoleManager')
  });

  // Get company billing (for Admins - their own company only)
  const { data: companyBilling } = useQuery<CompanyBilling>({
    queryKey: ['/api/billing/company', user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return null;
      // Get company ID from tenant
      const company = await apiRequest('GET', '/api/company');
      if (company?.id) {
        return apiRequest('GET', `/api/billing/company/${company.id}`);
      }
      return null;
    },
    enabled: !!user && user.role === 'Admin'
  });

  // Get billing rates
  const { data: billingRates } = useQuery<BillingRates>({
    queryKey: ['/api/billing/rates'],
    enabled: !!user
  });

  // Activate staff mutation
  const activateStaffMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest('POST', `/api/staff/${userId}/activate`);
    },
    onSuccess: (data, userId) => {
      toast({
        title: "Staff Activated",
        description: "Staff member has been activated and billing enabled.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/staff'] });
      queryClient.invalidateQueries({ queryKey: ['/api/billing/company'] });
    },
    onError: (error) => {
      toast({
        title: "Activation Failed",
        description: "Failed to activate staff member. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Deactivate staff mutation
  const deactivateStaffMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest('POST', `/api/staff/${userId}/deactivate`);
    },
    onSuccess: (data, userId) => {
      toast({
        title: "Staff Deactivated",
        description: "Staff member has been deactivated and billing stopped.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/staff'] });
      queryClient.invalidateQueries({ queryKey: ['/api/billing/company'] });
    },
    onError: (error) => {
      toast({
        title: "Deactivation Failed",
        description: "Failed to deactivate staff member. Please try again.",
        variant: "destructive"
      });
    }
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount || 0);
  };

  const getStatusBadge = (isActive: boolean, billingStatus: string) => {
    if (!isActive) {
      return <Badge variant="destructive">Inactive</Badge>;
    }
    if (billingStatus === 'suspended') {
      return <Badge variant="secondary">Suspended</Badge>;
    }
    return <Badge variant="default">Active</Badge>;
  };

  const getRoleRate = (role: string): number => {
    return billingRates?.[role] || 0;
  };

  // Filter staff based on search
  const filteredStaff = staff.filter(member => 
    member.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate summary stats
  const activeStaffCount = filteredStaff.filter(s => s.isActive).length;
  const totalMonthlyBilling = filteredStaff
    .filter(s => s.isActive)
    .reduce((sum, s) => sum + getRoleRate(s.role), 0);

  if (!user || (user.role !== 'Admin' && user.role !== 'ConsoleManager')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Access Denied</h3>
              <p className="text-slate-600">Only Admins and Console Managers can access staff billing management.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-slate-600 mt-2">Loading staff data...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Staff Billing Management</h2>
          <p className="text-slate-600 mt-1">Manage staff activation and billing status</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-600">Active Staff</p>
                <p className="text-2xl font-bold text-emerald-700 mt-1">{activeStaffCount}</p>
              </div>
              <Users className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-600">Monthly Billing</p>
                <p className="text-2xl font-bold text-amber-700 mt-1">
                  {formatCurrency(totalMonthlyBilling)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Avg per Staff</p>
                <p className="text-2xl font-bold text-purple-700 mt-1">
                  {activeStaffCount > 0 
                    ? formatCurrency(totalMonthlyBilling / activeStaffCount)
                    : '$0.00'
                  }
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card className="border-2 border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Staff Directory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Search staff by name, username, email, or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Monthly Rate</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{member.fullName}</p>
                        <p className="text-sm text-slate-600">{member.email || member.username}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{member.role}</Badge>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(member.isActive, member.billingStatus)}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(getRoleRate(member.role))}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-600">
                        {member.lastBillingSync 
                          ? new Date(member.lastBillingSync).toLocaleDateString()
                          : 'Never'
                        }
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {member.isActive ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline">
                                <UserX className="h-4 w-4 mr-1" />
                                Deactivate
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Deactivate Staff Member</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will deactivate {member.fullName} and stop billing for their account. 
                                  They will lose access to the platform immediately.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deactivateStaffMutation.mutate(member.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Deactivate
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="default">
                                <UserCheck className="h-4 w-4 mr-1" />
                                Activate
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Activate Staff Member</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will activate {member.fullName} and resume billing at {formatCurrency(getRoleRate(member.role))} per month. 
                                  They will regain access to the platform immediately.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => activateStaffMutation.mutate(member.id)}
                                >
                                  Activate
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredStaff.length === 0 && (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">No staff members found matching your search.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}