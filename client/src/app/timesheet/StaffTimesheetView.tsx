import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { 
  Clock, 
  DollarSign, 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  Calendar,
  TrendingUp,
  User,
  Briefcase,
  Coffee,
  Eye,
  Download
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

interface TimesheetEntry {
  id: number;
  shiftId: number;
  totalHours: number;
  createdAt: string;
  shiftTitle?: string;
  shiftDate: string;
  clientName?: string;
}

interface Timesheet {
  id: number;
  payPeriodStart: string;
  payPeriodEnd: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  totalHours: number;
  totalEarnings: number;
  totalTax: number;
  totalSuper: number;
  netPay: number;
  createdAt: string;
  updatedAt: string;
}

interface TimesheetSummary {
  timesheet: Timesheet;
  entries: TimesheetEntry[];
  totalHours: number;
  totalEarnings: number;
  periodStatus: 'current' | 'previous' | 'future';
}

interface LeaveBalance {
  annualLeave: number;
  sickLeave: number;
  personalLeave: number;
  longServiceLeave: number;
}

export default function StaffTimesheetView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Staff timesheet state  
  const [selectedEntry, setSelectedEntry] = useState<TimesheetEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Get current timesheet
  const { data: currentTimesheet, isLoading } = useQuery({
    queryKey: ['/api/timesheet/current'],
    enabled: !!user
  });

  // Get timesheet history
  const { data: timesheetHistory = [] } = useQuery({
    queryKey: ['/api/timesheet/history'],
    enabled: !!user
  });

  // Get user leave balances (for non-casual staff)
  const { data: leaveBalances } = useQuery<LeaveBalance>({
    queryKey: ['/api/leave-balances'],
    enabled: !!user && user.employmentType !== 'casual',
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

  // Download payslip mutation
  const downloadPayslipMutation = useMutation({
    mutationFn: async (timesheetId: number) => {
      const response = await fetch(`/api/payslips/${timesheetId}/pdf`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate payslip');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `payslip-${timesheetId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({ 
        title: "Payslip Downloaded", 
        description: "Your payslip PDF has been downloaded successfully." 
      });
    },
    onError: (error) => {
      toast({
        title: "Download Failed",
        description: "Failed to download payslip. Please try again.",
        variant: "destructive"
      });
    }
  });

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: "secondary",
      submitted: "outline",
      approved: "default",
      rejected: "destructive"
    } as const;
    
    const labels = {
      draft: "Draft",
      submitted: "Submitted",
      approved: "Approved",
      rejected: "Rejected"
    };

    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(isNaN(num) ? 0 : num);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '-';
      return format(date, 'dd/MM/yyyy');
    } catch (error) {
      console.error('Date formatting error:', error, 'for dateString:', dateString);
      return '-';
    }
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '-';
      return format(date, 'dd/MM/yyyy HH:mm');
    } catch (error) {
      console.error('DateTime formatting error:', error, 'for dateString:', dateString);
      return '-';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-slate-600 mt-2">Loading timesheet...</p>
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
            <h1 className="text-3xl font-bold text-slate-900">My Timesheet</h1>
            <p className="text-slate-600 mt-1">Track your hours, earnings, and submit timesheets for approval</p>
          </div>
        </div>

        <Tabs defaultValue="current" className="space-y-6">
          <TabsList className="bg-white border-2 border-slate-200 p-1 rounded-xl shadow-sm">
            <TabsTrigger value="current" className="px-6 py-3 rounded-lg font-medium">
              Current Period
            </TabsTrigger>
            <TabsTrigger value="history" className="px-6 py-3 rounded-lg font-medium">
              History
            </TabsTrigger>
            {leaveBalances && (
              <TabsTrigger value="leave" className="px-6 py-3 rounded-lg font-medium">
                Leave Balances
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="current" className="space-y-6">
            {!currentTimesheet ? (
              <Card className="border-2 border-slate-200 shadow-sm">
                <CardContent className="p-8 text-center">
                  <Clock className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No Active Timesheet</h3>
                  <p className="text-slate-600">A timesheet will be created automatically when you start working shifts.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Current Timesheet Overview */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-blue-600">Period Status</p>
                          <div className="mt-2">
                            {getStatusBadge(currentTimesheet.status)}
                          </div>
                        </div>
                        <FileText className="h-8 w-8 text-blue-500" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-emerald-600">Total Hours</p>
                          <p className="text-2xl font-bold text-emerald-700 mt-1">
                            {currentTimesheet.totalHours || 0}h
                          </p>
                        </div>
                        <Clock className="h-8 w-8 text-emerald-500" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-amber-600">Gross Pay</p>
                          <p className="text-2xl font-bold text-amber-700 mt-1">
                            {formatCurrency(currentTimesheet.totalEarnings || 0)}
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
                          <p className="text-sm font-medium text-purple-600">Net Pay</p>
                          <p className="text-2xl font-bold text-purple-700 mt-1">
                            {formatCurrency(currentTimesheet.netPay || 0)}
                          </p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-purple-500" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Pay Period Info */}
                <Card className="border-2 border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Pay Period: {formatDate(currentTimesheet.payPeriodStart)} - {formatDate(currentTimesheet.payPeriodEnd)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="font-medium text-slate-700">Gross Pay</p>
                        <p className="text-lg font-bold text-slate-900">{formatCurrency(currentTimesheet.totalEarnings)}</p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-700">Tax Withheld</p>
                        <p className="text-lg font-bold text-red-600">-{formatCurrency(currentTimesheet.totalTax)}</p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-700">Net Pay</p>
                        <p className="text-lg font-bold text-emerald-600">{formatCurrency(currentTimesheet.netPay)}</p>
                      </div>
                    </div>
                    
                    {currentTimesheet.status === 'draft' && (
                      <div className="mt-6 pt-4 border-t border-slate-200">
                        <Button
                          onClick={() => submitMutation.mutate(currentTimesheet.id)}
                          disabled={submitMutation.isPending}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          {submitMutation.isPending ? 'Submitting...' : 'Submit Timesheet'}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Timesheet Entries */}
                {currentTimesheet.entries && currentTimesheet.entries.length > 0 && (
                  <Card className="border-2 border-slate-200 shadow-sm">
                    <CardHeader>
                      <CardTitle>Timesheet Entries</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Shift</TableHead>
                              <TableHead>Client</TableHead>
                              <TableHead>Hours</TableHead>
                              <TableHead>Created</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {currentTimesheet.entries.map((entry) => (
                              <TableRow key={entry.id}>
                                <TableCell>{entry.shiftDate ? formatDate(entry.shiftDate) : '-'}</TableCell>
                                <TableCell>{entry.shiftTitle || 'General Shift'}</TableCell>
                                <TableCell>{entry.clientName || '-'}</TableCell>
                                <TableCell>{entry.totalHours || 0}h</TableCell>
                                <TableCell>{entry.createdAt ? formatDateTime(entry.createdAt) : '-'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card className="border-2 border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Timesheet History</CardTitle>
              </CardHeader>
              <CardContent>
                {timesheetHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-600">No previous timesheets found.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {timesheetHistory.map((timesheet) => (
                      <Card key={timesheet.id} className="border border-slate-200">
                        <CardContent className="p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-medium text-slate-900">
                                  Pay Period: {formatDate(timesheet.payPeriodStart)} - {formatDate(timesheet.payPeriodEnd)}
                                </h3>
                                {getStatusBadge(timesheet.status)}
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-slate-600">
                                <div>
                                  <p className="font-medium">Hours: {timesheet.totalHours}</p>
                                </div>
                                <div>
                                  <p className="font-medium">Gross: {formatCurrency(timesheet.totalEarnings)}</p>
                                </div>
                                <div>
                                  <p className="font-medium">Tax: {formatCurrency(timesheet.totalTax)}</p>
                                </div>
                                <div>
                                  <p className="font-medium">Net: {formatCurrency(timesheet.netPay)}</p>
                                </div>
                              </div>
                              
                              {/* Leave Accrual for non-casual staff */}
                              {user?.employmentType !== 'casual' && (timesheet.annualLeaveAccrued || timesheet.sickLeaveAccrued) && (
                                <div className="mt-3 pt-3 border-t border-slate-200">
                                  <p className="text-sm text-slate-600 mb-1">Leave Accrued This Period:</p>
                                  <div className="flex gap-4 text-sm">
                                    {timesheet.annualLeaveAccrued && (
                                      <span className="text-emerald-600 font-medium">
                                        Annual: {timesheet.annualLeaveAccrued}h
                                      </span>
                                    )}
                                    {timesheet.sickLeaveAccrued && (
                                      <span className="text-blue-600 font-medium">
                                        Sick: {timesheet.sickLeaveAccrued}h
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  // View timesheet details functionality
                                  toast({
                                    title: "Timesheet Details",
                                    description: `Viewing timesheet for ${formatDate(timesheet.payPeriodStart)} - ${formatDate(timesheet.payPeriodEnd)}`
                                  });
                                }}
                                className="flex items-center gap-2"
                              >
                                <Eye className="h-4 w-4" />
                                View
                              </Button>
                              
                              {(timesheet.status === 'approved' || timesheet.status === 'paid') && (
                                <Button
                                  size="sm"
                                  onClick={() => downloadPayslipMutation.mutate(timesheet.id)}
                                  disabled={downloadPayslipMutation.isPending}
                                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                                >
                                  <Download className="h-4 w-4" />
                                  {downloadPayslipMutation.isPending ? 'Downloading...' : 'Payslip'}
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {leaveBalances && (
            <TabsContent value="leave" className="space-y-6">
              <Card className="border-2 border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Coffee className="h-5 w-5" />
                    Leave Balances
                  </CardTitle>
                  <p className="text-sm text-slate-600">
                    Your current leave entitlements (updated after each pay period)
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="border border-emerald-200 bg-emerald-50">
                      <CardContent className="p-4 text-center">
                        <div className="flex items-center justify-center mb-2">
                          <Calendar className="h-6 w-6 text-emerald-600" />
                        </div>
                        <p className="text-sm font-medium text-emerald-700">Annual Leave</p>
                        <p className="text-2xl font-bold text-emerald-800 mt-1">
                          {leaveBalances.annualLeave.toFixed(1)}h
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border border-red-200 bg-red-50">
                      <CardContent className="p-4 text-center">
                        <div className="flex items-center justify-center mb-2">
                          <AlertCircle className="h-6 w-6 text-red-600" />
                        </div>
                        <p className="text-sm font-medium text-red-700">Sick Leave</p>
                        <p className="text-2xl font-bold text-red-800 mt-1">
                          {leaveBalances.sickLeave.toFixed(1)}h
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border border-blue-200 bg-blue-50">
                      <CardContent className="p-4 text-center">
                        <div className="flex items-center justify-center mb-2">
                          <User className="h-6 w-6 text-blue-600" />
                        </div>
                        <p className="text-sm font-medium text-blue-700">Personal Leave</p>
                        <p className="text-2xl font-bold text-blue-800 mt-1">
                          {leaveBalances.personalLeave.toFixed(1)}h
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border border-purple-200 bg-purple-50">
                      <CardContent className="p-4 text-center">
                        <div className="flex items-center justify-center mb-2">
                          <Briefcase className="h-6 w-6 text-purple-600" />
                        </div>
                        <p className="text-sm font-medium text-purple-700">Long Service</p>
                        <p className="text-2xl font-bold text-purple-800 mt-1">
                          {leaveBalances.longServiceLeave.toFixed(1)}h
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-medium text-slate-900 mb-2">Leave Accrual Information</h4>
                    <div className="text-sm text-slate-600 space-y-1">
                      <p>• Annual Leave: 4 weeks per year (accrued based on hours worked)</p>
                      <p>• Sick/Personal Leave: 10 days per year (combined entitlement)</p>
                      <p>• Long Service Leave: Accrues after 7 years of service</p>
                      <p>• Leave balances are updated after each approved timesheet</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}