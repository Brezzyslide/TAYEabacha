import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { 
  DollarSign, 
  Users, 
  Building2, 
  TrendingUp, 
  UserCheck, 
  UserX, 
  AlertCircle,
  Download,
  Shield,
  PauseCircle,
  PlayCircle,
  Calendar
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import CreateBillingButton from "@/components/billing/CreateBillingButton";

interface BillingAnalytics {
  totalCompanies: number;
  totalActiveStaff: number;
  totalMonthlyRevenue: number;
  roleDistribution: { role: string; count: number; revenue: number }[];
  companyBreakdown: CompanyBilling[];
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
  status: 'active' | 'suspended' | 'cancelled';
}

interface BillingRates {
  [key: string]: number;
}

export default function BillingDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);

  // Get billing analytics
  const { data: analytics, isLoading } = useQuery<BillingAnalytics>({
    queryKey: ['/api/billing/analytics'],
    enabled: !!user && user.role === 'ConsoleManager'
  });

  // Get billing rates
  const { data: billingRates } = useQuery<BillingRates>({
    queryKey: ['/api/billing/rates'],
    enabled: !!user
  });

  // Suspend company mutation
  const suspendCompanyMutation = useMutation({
    mutationFn: async (companyId: string) => {
      return apiRequest('POST', `/api/billing/company/${companyId}/suspend`);
    },
    onSuccess: (data, companyId) => {
      toast({
        title: "Company Suspended",
        description: `Company access has been suspended for non-payment.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/billing/analytics'] });
    },
    onError: (error) => {
      toast({
        title: "Suspension Failed",
        description: "Failed to suspend company access. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Restore company mutation
  const restoreCompanyMutation = useMutation({
    mutationFn: async (companyId: string) => {
      return apiRequest('POST', `/api/billing/company/${companyId}/restore`);
    },
    onSuccess: (data, companyId) => {
      toast({
        title: "Company Restored",
        description: `Company access has been restored after payment.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/billing/analytics'] });
    },
    onError: (error) => {
      toast({
        title: "Restoration Failed",
        description: "Failed to restore company access. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Download billing summary mutation
  const downloadSummaryMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('GET', '/api/billing/summary');
    },
    onSuccess: (data: any) => {
      // Create downloadable file
      const blob = new Blob([data.report], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `billing-summary-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Summary Downloaded",
        description: "Billing summary has been downloaded successfully."
      });
    },
    onError: (error) => {
      toast({
        title: "Download Failed",
        description: "Failed to download billing summary. Please try again.",
        variant: "destructive"
      });
    }
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy');
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: "default",
      suspended: "destructive",
      cancelled: "secondary"
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (!user || user.role !== 'ConsoleManager') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="p-8 text-center">
              <Shield className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Access Denied</h3>
              <p className="text-slate-600">Only Console Managers can access billing management.</p>
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
              <p className="text-slate-600 mt-2">Loading billing analytics...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Billing Management</h1>
            <p className="text-slate-600 mt-1">Platform-wide billing analytics and company management</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => downloadSummaryMutation.mutate()}
              disabled={downloadSummaryMutation.isPending}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {downloadSummaryMutation.isPending ? 'Generating...' : 'Download Report'}
            </Button>
            <CreateBillingButton />
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Total Companies</p>
                  <p className="text-2xl font-bold text-blue-700 mt-1">
                    {analytics?.totalCompanies || 0}
                  </p>
                </div>
                <Building2 className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-600">Active Staff</p>
                  <p className="text-2xl font-bold text-emerald-700 mt-1">
                    {analytics?.totalActiveStaff || 0}
                  </p>
                </div>
                <Users className="h-8 w-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-600">Monthly Revenue</p>
                  <p className="text-2xl font-bold text-amber-700 mt-1">
                    {analytics ? formatCurrency(analytics.totalMonthlyRevenue) : '$0.00'}
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
                  <p className="text-sm font-medium text-purple-600">Avg per Company</p>
                  <p className="text-2xl font-bold text-purple-700 mt-1">
                    {analytics && analytics.totalCompanies > 0 
                      ? formatCurrency(analytics.totalMonthlyRevenue / analytics.totalCompanies)
                      : '$0.00'
                    }
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="companies" className="space-y-6">
          <TabsList className="bg-white border-2 border-slate-200 p-1 rounded-xl shadow-sm">
            <TabsTrigger value="companies" className="px-6 py-3 rounded-lg font-medium">
              Company Management
            </TabsTrigger>
            <TabsTrigger value="analytics" className="px-6 py-3 rounded-lg font-medium">
              Role Analytics
            </TabsTrigger>
            <TabsTrigger value="rates" className="px-6 py-3 rounded-lg font-medium">
              Billing Rates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="companies" className="space-y-6">
            <Card className="border-2 border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Company Billing Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Active Staff</TableHead>
                        <TableHead>Monthly Revenue</TableHead>
                        <TableHead>Next Billing</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics?.companyBreakdown.map((company) => (
                        <TableRow key={company.companyId}>
                          <TableCell className="font-medium">{company.companyName}</TableCell>
                          <TableCell>{getStatusBadge(company.status)}</TableCell>
                          <TableCell>
                            {company.activeStaff.reduce((sum, staff) => sum + staff.count, 0)} staff
                          </TableCell>
                          <TableCell>{formatCurrency(company.totalMonthlyRevenue)}</TableCell>
                          <TableCell>{formatDate(company.nextBillingDate)}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {company.status === 'active' ? (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="destructive">
                                      <PauseCircle className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Suspend Company Access</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will immediately suspend access for all staff at {company.companyName}. 
                                        This action should only be taken for non-payment or policy violations.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => suspendCompanyMutation.mutate(company.companyId)}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        Suspend Access
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              ) : (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="default">
                                      <PlayCircle className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Restore Company Access</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will restore access for all staff at {company.companyName}. 
                                        Ensure payment has been received before restoring access.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => restoreCompanyMutation.mutate(company.companyId)}
                                      >
                                        Restore Access
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card className="border-2 border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Role Distribution Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {analytics?.roleDistribution.map((role) => (
                    <Card key={role.role} className="border border-slate-200">
                      <CardContent className="p-4 text-center">
                        <h3 className="font-medium text-slate-900 mb-2">{role.role}</h3>
                        <p className="text-2xl font-bold text-blue-600 mb-1">{role.count}</p>
                        <p className="text-sm text-slate-600">{formatCurrency(role.revenue)}/month</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rates" className="space-y-6">
            <Card className="border-2 border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Current Billing Rates</CardTitle>
                <p className="text-sm text-slate-600">28-day billing cycle rates per staff member</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {billingRates && Object.entries(billingRates).map(([role, rate]) => (
                    <Card key={role} className="border border-slate-200">
                      <CardContent className="p-4 text-center">
                        <h3 className="font-medium text-slate-900 mb-2">{role}</h3>
                        <p className="text-2xl font-bold text-emerald-600">{formatCurrency(rate)}</p>
                        <p className="text-sm text-slate-600">per 28 days</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}