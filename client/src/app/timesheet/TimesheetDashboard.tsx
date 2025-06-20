import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Clock, 
  DollarSign, 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  Download,
  Calendar,
  TrendingUp,
  Settings
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

  // Submit timesheet mutation
  const submitMutation = useMutation({
    mutationFn: async (timesheetId: number) => {
      return apiRequest('POST', `/api/timesheet/${timesheetId}/submit`);
    },
    onSuccess: (data) => {
      const wasAutoApproved = data.autoApproved;
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
        <TabsList className={`grid w-full ${user?.role === 'Admin' || user?.role === 'ConsoleManager' ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <TabsTrigger value="current">Current Period</TabsTrigger>
          <TabsTrigger value="history">Timesheet History</TabsTrigger>
          <TabsTrigger value="payslips">Payslips</TabsTrigger>
          {(user?.role === 'Admin' || user?.role === 'ConsoleManager') && (
            <TabsTrigger value="pay-scales">Pay Scales</TabsTrigger>
          )}
        </TabsList>

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
          <TabsContent value="pay-scales" className="space-y-4">
            <PayScaleManagement />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}