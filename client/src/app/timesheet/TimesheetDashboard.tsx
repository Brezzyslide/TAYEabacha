import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { 
  Clock, 
  DollarSign, 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  Download,
  Calendar,
  TrendingUp,
  Settings,
  XCircle,
  Search,
  Filter,
  User,
  Users
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import PayScaleManagement from "@/app/admin/PayScaleManagement";

interface TimesheetEntry {
  id: number;
  entryDate: string;
  startTime: string;
  endTime: string;
  totalHours: number;
  grossPay: number;
  notes?: string;
  shiftTitle?: string;
}

interface Timesheet {
  id: number;
  payPeriodStart: string;
  payPeriodEnd: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';
  totalHours: number;
  totalEarnings: number;
  totalTax: number;
  totalSuper: number;
  netPay: number;
  submittedAt?: string;
  approvedAt?: string;
}

interface AdminTimesheet {
  id: number;
  userId: number;
  staffName: string;
  staffUsername: string;
  staffEmail: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  totalHours: string;
  totalEarnings: string;
  submittedAt?: string;
  approvedAt?: string;
  createdAt: string;
}

interface AdminPayslip {
  timesheetId: number;
  userId: number;
  staffName: string;
  staffUsername: string;
  staffEmail: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  status: 'approved' | 'paid';
  totalHours: string;
  totalEarnings: string;
  totalTax: string;
  totalSuper: string;
  netPay: string;
  approvedAt: string;
  createdAt: string;
}

interface TimesheetSummary {
  timesheet: Timesheet;
  entries: TimesheetEntry[];
  totalHours: number;
  totalEarnings: number;
  periodStatus: 'current' | 'previous' | 'future';
}

export default function TimesheetDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  

  
  // Admin timesheet management state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [staffFilter, setStaffFilter] = useState('all');
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedTimesheet, setSelectedTimesheet] = useState<AdminTimesheet | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('current');

  // Get current timesheet
  const { data: currentTimesheet, isLoading } = useQuery<TimesheetSummary>({
    queryKey: ['/api/timesheet/current'],
    enabled: !!user
  });

  // Get timesheet history
  const { data: timesheetHistory = [] } = useQuery<Timesheet[]>({
    queryKey: ['/api/timesheet/history'],
    enabled: !!user
  });

  // Admin queries
  const { data: adminTimesheets = [], isLoading: isLoadingAdminTimesheets } = useQuery({
    queryKey: ['/api/admin/timesheets', statusFilter, staffFilter, searchTerm],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (staffFilter !== 'all') params.append('staffId', staffFilter);
      if (searchTerm) params.append('search', searchTerm);
      
      return apiRequest('GET', `/api/admin/timesheets?${params.toString()}`);
    },
    enabled: (user?.role === 'Admin' || user?.role === 'ConsoleManager')
  });

  // Submit timesheet mutation
  const submitMutation = useMutation({
    mutationFn: async (timesheetId: number) => {
      return apiRequest('POST', `/api/timesheet/${timesheetId}/submit`);
    },
    onSuccess: (data: any) => {
      const wasAutoApproved = data?.autoApproved;
      toast({
        title: "Timesheet Submitted",
        description: wasAutoApproved 
          ? "Your timesheet has been automatically approved!" 
          : "Your timesheet has been submitted for approval.",
        variant: wasAutoApproved ? "default" : "default"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/timesheet'] });
    },
    onError: (error) => {
      toast({
        title: "Submission Failed",
        description: "Failed to submit timesheet. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Admin approval mutation
  const approveMutation = useMutation({
    mutationFn: (timesheetId: number) => 
      apiRequest('POST', `/api/admin/timesheets/${timesheetId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/timesheets'] });
      setSelectedTimesheet(null);
      toast({
        title: "Timesheet Approved",
        description: "The timesheet has been successfully approved.",
      });
    }
  });

  // Admin rejection mutation
  const rejectMutation = useMutation({
    mutationFn: ({ timesheetId, reason }: { timesheetId: number; reason: string }) => 
      apiRequest('POST', `/api/admin/timesheets/${timesheetId}/reject`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/timesheets'] });
      setSelectedTimesheet(null);
      setRejectionReason('');
      toast({
        title: "Timesheet Rejected",
        description: "The timesheet has been rejected and staff will be notified.",
      });
    }
  });

  // Admin payslip queries and state
  const [payslipSearchTerm, setPayslipSearchTerm] = useState('');
  const [payslipStatusFilter, setPayslipStatusFilter] = useState('all');
  const [payslipStaffFilter, setPayslipStaffFilter] = useState('all');

  const { data: adminPayslips, isLoading: isLoadingAdminPayslips } = useQuery({
    queryKey: ['/api/admin/payslips', payslipSearchTerm, payslipStatusFilter, payslipStaffFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (payslipStatusFilter !== 'all') params.append('status', payslipStatusFilter);
      if (payslipStaffFilter !== 'all') params.append('staffId', payslipStaffFilter);
      if (payslipSearchTerm) params.append('search', payslipSearchTerm);
      
      return apiRequest('GET', `/api/admin/payslips?${params.toString()}`);
    },
    enabled: (user?.role === 'Admin' || user?.role === 'ConsoleManager')
  });

  // Generate payslip mutation
  const generatePayslipMutation = useMutation({
    mutationFn: (timesheetId: number) => 
      apiRequest('POST', `/api/admin/payslips/${timesheetId}/generate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/payslips'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/timesheets'] });
      toast({
        title: "Payslip Generated",
        description: "The payslip has been successfully generated and marked as paid.",
      });
    }
  });

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: "secondary",
      submitted: "outline",
      approved: "default",
      rejected: "destructive",
      paid: "default"
    } as const;
    
    const labels = {
      draft: "Draft",
      submitted: "Submitted",
      approved: "Approved",
      rejected: "Rejected",
      paid: "Paid"
    };

    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  const formatCurrency = (amount: number | string) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(typeof amount === 'string' ? parseFloat(amount) : amount);
  };

  const formatHours = (hours: number | string) => {
    const h = typeof hours === 'string' ? parseFloat(hours) : hours;
    return `${h.toFixed(2)}h`;
  };

  // Admin helper functions
  const getAdminStatusBadge = (status: string) => {
    const colors = {
      draft: 'bg-slate-100 text-slate-700 border-slate-300',
      submitted: 'bg-amber-100 text-amber-800 border-amber-300',
      approved: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      rejected: 'bg-red-100 text-red-800 border-red-300'
    };

    return (
      <Badge className={`${colors[status as keyof typeof colors]} font-medium`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Export timesheets
  const handleExport = (format: 'csv' | 'excel') => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.append('status', statusFilter);
    if (staffFilter !== 'all') params.append('staffId', staffFilter);
    params.append('format', format);
    
    window.open(`/api/admin/timesheets/export?${params.toString()}`, '_blank');
  };

  // Export payslips
  const handlePayslipExport = (format: 'csv' | 'excel') => {
    const params = new URLSearchParams();
    if (payslipStatusFilter !== 'all') params.append('status', payslipStatusFilter);
    if (payslipStaffFilter !== 'all') params.append('staffId', payslipStaffFilter);
    if (payslipSearchTerm) params.append('search', payslipSearchTerm);
    params.append('format', format);
    
    window.open(`/api/admin/payslips/export?${params.toString()}`, '_blank');
  };

  // Get unique staff members for filter
  const staffMembers = Array.isArray(adminTimesheets) ? Array.from(
    new Map(adminTimesheets.map((ts: AdminTimesheet) => [ts.userId, { id: ts.userId, name: ts.staffName }]))
      .values()
  ) : [];

  // Filter timesheets based on search, status, and staff
  const filteredTimesheets = Array.isArray(adminTimesheets) ? adminTimesheets.filter((timesheet: AdminTimesheet) => {
    const matchesSearch = timesheet.staffName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         timesheet.staffEmail?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || timesheet.status === statusFilter;
    const matchesStaff = staffFilter === 'all' || timesheet.userId.toString() === staffFilter;
    
    return matchesSearch && matchesStatus && matchesStaff;
  }) : [];

  // Analytics calculations
  const adminAnalytics = {
    total: filteredTimesheets.length,
    submitted: filteredTimesheets.filter((ts: AdminTimesheet) => ts.status === 'submitted').length,
    approved: filteredTimesheets.filter((ts: AdminTimesheet) => ts.status === 'approved').length,
    rejected: filteredTimesheets.filter((ts: AdminTimesheet) => ts.status === 'rejected').length,
    totalHours: filteredTimesheets.reduce((sum: number, ts: AdminTimesheet) => sum + parseFloat(ts.totalHours || '0'), 0),
    totalEarnings: filteredTimesheets.reduce((sum: number, ts: AdminTimesheet) => sum + parseFloat(ts.totalEarnings || '0'), 0)
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-slate-700 bg-clip-text text-transparent">
            My Timesheet
          </h1>
          <p className="text-slate-600 mt-2">
            Track your hours, earnings, and submit timesheets for approval
          </p>
        </div>
        {currentTimesheet?.timesheet && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            {currentTimesheet.timesheet.status === 'draft' && (
              <Button 
                onClick={() => submitMutation.mutate(currentTimesheet.timesheet.id)}
                disabled={submitMutation.isPending}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {submitMutation.isPending ? "Submitting..." : "Submit Timesheet"}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Current Pay Period Summary */}
      {currentTimesheet && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">Total Hours</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {formatHours(currentTimesheet.totalHours)}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-green-100 border border-emerald-200/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-emerald-600 font-medium">Gross Pay</p>
                  <p className="text-2xl font-bold text-emerald-900">
                    {formatCurrency(currentTimesheet.totalEarnings)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-violet-100 border border-purple-200/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-medium">Net Pay</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {formatCurrency(currentTimesheet.timesheet.netPay)}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-600 font-medium">Status</p>
                  <div className="mt-1">
                    {getStatusBadge(currentTimesheet.timesheet.status)}
                  </div>
                </div>
                <FileText className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={selectedPeriod} onValueChange={setSelectedPeriod} className="w-full">
        <div className="flex flex-col space-y-2">
          <TabsList className="flex flex-wrap w-full gap-1 h-auto p-1">
            <TabsTrigger value="current" className="text-xs md:text-sm">Current Period</TabsTrigger>
            <TabsTrigger value="history" className="text-xs md:text-sm">History</TabsTrigger>
            <TabsTrigger value="payslips" className="text-xs md:text-sm">Payslips</TabsTrigger>
            {(user?.role === 'Admin' || user?.role === 'ConsoleManager') && (
              <>
                <TabsTrigger value="admin-review" className="text-xs md:text-sm">Staff Timesheets</TabsTrigger>
                <TabsTrigger value="admin-payslips" className="text-xs md:text-sm">Staff Payslips</TabsTrigger>
                <TabsTrigger value="pay-scales" className="text-xs md:text-sm">Pay Scales</TabsTrigger>
              </>
            )}
          </TabsList>
        </div>

        <TabsContent value="current" className="space-y-4">
          {currentTimesheet ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>
                    Pay Period: {format(new Date(currentTimesheet.timesheet.payPeriodStart), 'MMM d')} - {format(new Date(currentTimesheet.timesheet.payPeriodEnd), 'MMM d, yyyy')}
                  </span>
                  {getStatusBadge(currentTimesheet.timesheet.status)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {currentTimesheet.entries.length > 0 ? (
                  <div className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Shift</TableHead>
                          <TableHead>Start Time</TableHead>
                          <TableHead>End Time</TableHead>
                          <TableHead>Hours</TableHead>
                          <TableHead>Gross Pay</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentTimesheet.entries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>
                              {format(new Date(entry.entryDate), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell>{entry.shiftTitle || 'Manual Entry'}</TableCell>
                            <TableCell>
                              {format(new Date(entry.startTime), 'h:mm a')}
                            </TableCell>
                            <TableCell>
                              {format(new Date(entry.endTime), 'h:mm a')}
                            </TableCell>
                            <TableCell>{formatHours(entry.totalHours)}</TableCell>
                            <TableCell>{formatCurrency(entry.grossPay)}</TableCell>
                            <TableCell className="text-sm text-slate-500">
                              {entry.notes}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Pay Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Gross Pay:</span>
                          <span className="font-semibold">{formatCurrency(currentTimesheet.timesheet.totalEarnings)}</span>
                        </div>
                        <div className="flex justify-between text-red-600">
                          <span>Tax Withheld:</span>
                          <span>-{formatCurrency(currentTimesheet.timesheet.totalTax)}</span>
                        </div>
                        <div className="flex justify-between text-red-600">
                          <span>Superannuation:</span>
                          <span>-{formatCurrency(currentTimesheet.timesheet.totalSuper)}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-lg font-bold text-emerald-600">
                          <span>Net Pay:</span>
                          <span>{formatCurrency(currentTimesheet.timesheet.netPay)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-600 mb-2">No Hours Recorded</h3>
                    <p className="text-slate-500">
                      Your timesheet will be automatically populated when you complete shifts.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <Clock className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-600 mb-2">No Active Timesheet</h3>
                <p className="text-slate-500">
                  A timesheet will be created automatically when you start working shifts.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Timesheet History</CardTitle>
            </CardHeader>
            <CardContent>
              {timesheetHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pay Period</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Gross Pay</TableHead>
                      <TableHead>Net Pay</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timesheetHistory.map((timesheet) => (
                      <TableRow key={timesheet.id}>
                        <TableCell>
                          {format(new Date(timesheet.payPeriodStart), 'MMM d')} - {format(new Date(timesheet.payPeriodEnd), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>{getStatusBadge(timesheet.status)}</TableCell>
                        <TableCell>{formatHours(timesheet.totalHours)}</TableCell>
                        <TableCell>{formatCurrency(timesheet.totalEarnings)}</TableCell>
                        <TableCell>{formatCurrency(timesheet.netPay)}</TableCell>
                        <TableCell>
                          {timesheet.submittedAt ? format(new Date(timesheet.submittedAt), 'MMM d, yyyy') : '-'}
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4 mr-2" />
                            PDF
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-600 mb-2">No History</h3>
                  <p className="text-slate-500">Your timesheet history will appear here.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payslips" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payslips</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Settings className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-600 mb-2">Payslips Coming Soon</h3>
                <p className="text-slate-500">
                  Digital payslips will be available once timesheets are processed.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {(user?.role === 'Admin' || user?.role === 'ConsoleManager') && (
          <>
            <TabsContent value="admin-review" className="space-y-6">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Staff Timesheet Management</h2>
                  <p className="text-slate-600">Review and approve staff timesheets for your organization</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    onClick={() => handleExport('csv')} 
                    variant="outline"
                    size="sm"
                    className="bg-white"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button 
                    onClick={() => handleExport('excel')} 
                    variant="outline"
                    size="sm"
                    className="bg-white"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Excel
                  </Button>
                </div>
              </div>

              {/* Analytics Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Calendar className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Total Timesheets</p>
                        <p className="text-xl font-bold text-slate-900">{adminAnalytics.total}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-100 rounded-lg">
                        <Clock className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Pending Review</p>
                        <p className="text-xl font-bold text-amber-600">{adminAnalytics.submitted}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-100 rounded-lg">
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Approved</p>
                        <p className="text-xl font-bold text-emerald-600">{adminAnalytics.approved}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-100 rounded-lg">
                        <XCircle className="h-4 w-4 text-red-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Rejected</p>
                        <p className="text-xl font-bold text-red-600">{adminAnalytics.rejected}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-100 rounded-lg">
                        <Clock className="h-4 w-4 text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Total Hours</p>
                        <p className="text-xl font-bold text-indigo-600">{adminAnalytics.totalHours.toFixed(1)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <DollarSign className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Total Earnings</p>
                        <p className="text-xl font-bold text-green-600">{formatCurrency(adminAnalytics.totalEarnings.toString())}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Filters */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Search by staff name or email..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full sm:w-48">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="submitted">Pending Review</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={staffFilter} onValueChange={setStaffFilter}>
                      <SelectTrigger className="w-full sm:w-48">
                        <User className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Filter by staff" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Staff</SelectItem>
                        {Array.isArray(adminTimesheets) && staffMembers.map((staff: any) => (
                          <SelectItem key={staff.id} value={staff.id.toString()}>
                            {staff.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Timesheets List */}
              <div className="space-y-4">
                {isLoadingAdminTimesheets ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-slate-600 mt-2">Loading timesheets...</p>
                    </CardContent>
                  </Card>
                ) : Array.isArray(adminTimesheets) && filteredTimesheets.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Clock className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-slate-900 mb-2">No timesheets found</h3>
                      <p className="text-slate-600">No timesheets match your current filters.</p>
                    </CardContent>
                  </Card>
                ) : (
                  Array.isArray(adminTimesheets) && filteredTimesheets.map((timesheet: AdminTimesheet) => (
                    <Card key={timesheet.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-6">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-3">
                              <h3 className="text-lg font-semibold text-slate-900">
                                {timesheet.staffName || 'Unknown Staff'}
                              </h3>
                              {getAdminStatusBadge(timesheet.status)}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
                              <div>
                                <p><strong>Pay Period:</strong></p>
                                <p>{formatDate(timesheet.payPeriodStart)} - {formatDate(timesheet.payPeriodEnd)}</p>
                              </div>
                              <div>
                                <p><strong>Hours:</strong> {timesheet.totalHours}</p>
                                <p><strong>Earnings:</strong> {formatCurrency(timesheet.totalEarnings)}</p>
                              </div>
                              <div>
                                {timesheet.submittedAt && (
                                  <p><strong>Submitted:</strong> {formatDate(timesheet.submittedAt)}</p>
                                )}
                                {timesheet.approvedAt && (
                                  <p><strong>Approved:</strong> {formatDate(timesheet.approvedAt)}</p>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {timesheet.status === 'submitted' && (
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Button
                                onClick={() => approveMutation.mutate(timesheet.id)}
                                disabled={approveMutation.isPending}
                                className="bg-emerald-600 hover:bg-emerald-700"
                                size="sm"
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Approve
                              </Button>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => setSelectedTimesheet(timesheet)}
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Reject
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Reject Timesheet</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <p className="text-sm text-slate-600">
                                      Please provide a reason for rejecting this timesheet:
                                    </p>
                                    <Textarea
                                      value={rejectionReason}
                                      onChange={(e) => setRejectionReason(e.target.value)}
                                      placeholder="Enter rejection reason..."
                                      rows={3}
                                    />
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="outline"
                                        onClick={() => {
                                          setSelectedTimesheet(null);
                                          setRejectionReason('');
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        variant="destructive"
                                        onClick={() => 
                                          selectedTimesheet && 
                                          rejectMutation.mutate({ 
                                            timesheetId: selectedTimesheet.id, 
                                            reason: rejectionReason 
                                          })
                                        }
                                        disabled={!rejectionReason.trim() || rejectMutation.isPending}
                                      >
                                        Reject Timesheet
                                      </Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="admin-payslips" className="space-y-6">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Staff Payslip Management</h2>
                  <p className="text-slate-600">Generate and manage payslips for approved timesheets</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    onClick={() => handlePayslipExport('csv')} 
                    variant="outline"
                    size="sm"
                    className="bg-white"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button 
                    onClick={() => handlePayslipExport('excel')} 
                    variant="outline"
                    size="sm"
                    className="bg-white"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Excel
                  </Button>
                </div>
              </div>

              {/* Analytics Cards */}
              {Array.isArray(adminPayslips) && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <FileText className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm text-slate-600">Ready for Payment</p>
                          <p className="text-xl font-bold text-slate-900">
                            {adminPayslips.filter((p: AdminPayslip) => p.status === 'approved').length}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 rounded-lg">
                          <CheckCircle className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm text-slate-600">Paid</p>
                          <p className="text-xl font-bold text-emerald-600">
                            {adminPayslips.filter((p: AdminPayslip) => p.status === 'paid').length}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                          <Clock className="h-4 w-4 text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-sm text-slate-600">Total Hours</p>
                          <p className="text-xl font-bold text-indigo-600">
                            {adminPayslips.reduce((sum: number, p: AdminPayslip) => sum + parseFloat(p.totalHours || '0'), 0).toFixed(1)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <DollarSign className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm text-slate-600">Total Payroll</p>
                          <p className="text-xl font-bold text-green-600">
                            {formatCurrency(adminPayslips.reduce((sum: number, p: AdminPayslip) => sum + parseFloat(p.netPay || '0'), 0).toString())}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Filters */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Search by staff name or email..."
                          value={payslipSearchTerm}
                          onChange={(e) => setPayslipSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <Select value={payslipStatusFilter} onValueChange={setPayslipStatusFilter}>
                      <SelectTrigger className="w-full sm:w-48">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="approved">Ready for Payment</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={payslipStaffFilter} onValueChange={setPayslipStaffFilter}>
                      <SelectTrigger className="w-full sm:w-48">
                        <User className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Filter by staff" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Staff</SelectItem>
                        {Array.isArray(adminPayslips) && Array.from(
                          new Map(adminPayslips.map((p: AdminPayslip) => [p.userId, { id: p.userId, name: p.staffName }]))
                            .values()
                        ).map((staff: any) => (
                          <SelectItem key={staff.id} value={staff.id.toString()}>
                            {staff.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Payslips List */}
              <div className="space-y-4">
                {isLoadingAdminPayslips ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-slate-600 mt-2">Loading payslips...</p>
                    </CardContent>
                  </Card>
                ) : Array.isArray(adminPayslips) && adminPayslips.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-slate-900 mb-2">No payslips available</h3>
                      <p className="text-slate-600">Approved timesheets will appear here for payslip generation.</p>
                    </CardContent>
                  </Card>
                ) : (
                  Array.isArray(adminPayslips) && adminPayslips
                    .filter((payslip: AdminPayslip) => {
                      const matchesSearch = payslip.staffName?.toLowerCase().includes(payslipSearchTerm.toLowerCase()) ||
                                           payslip.staffEmail?.toLowerCase().includes(payslipSearchTerm.toLowerCase());
                      const matchesStatus = payslipStatusFilter === 'all' || payslip.status === payslipStatusFilter;
                      const matchesStaff = payslipStaffFilter === 'all' || payslip.userId.toString() === payslipStaffFilter;
                      return matchesSearch && matchesStatus && matchesStaff;
                    })
                    .map((payslip: AdminPayslip) => (
                    <Card key={payslip.timesheetId} className="border-l-4 border-l-green-500">
                      <CardContent className="p-6">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-3">
                              <h3 className="text-lg font-semibold text-slate-900">
                                {payslip.staffName || 'Unknown Staff'}
                              </h3>
                              {getStatusBadge(payslip.status)}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
                              <div>
                                <p><strong>Pay Period:</strong></p>
                                <p>{formatDate(payslip.payPeriodStart)} - {formatDate(payslip.payPeriodEnd)}</p>
                              </div>
                              <div>
                                <p><strong>Hours:</strong> {payslip.totalHours}</p>
                                <p><strong>Gross:</strong> {formatCurrency(payslip.totalEarnings)}</p>
                              </div>
                              <div>
                                <p><strong>Tax:</strong> {formatCurrency(payslip.totalTax)}</p>
                                <p><strong>Net Pay:</strong> {formatCurrency(payslip.netPay)}</p>
                              </div>
                            </div>
                          </div>
                          
                          {payslip.status === 'approved' && (
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Button
                                onClick={() => generatePayslipMutation.mutate(payslip.timesheetId)}
                                disabled={generatePayslipMutation.isPending}
                                className="bg-emerald-600 hover:bg-emerald-700"
                                size="sm"
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Generate Payslip
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="pay-scales" className="space-y-4">
              <PayScaleManagement />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}