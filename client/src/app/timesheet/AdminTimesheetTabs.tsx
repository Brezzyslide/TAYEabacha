import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Edit,
  Search,
  User,
  Users,
  FileDown
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

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
  totalTax: string;
  totalSuper: string;
  netPay: string;
  submittedAt?: string;
  approvedAt?: string;
  createdAt: string;
  annualLeave?: number;
  sickLeave?: number;
  personalLeave?: number;
  longServiceLeave?: number;
}

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

export default function AdminTimesheetTabs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [selectedTimesheet, setSelectedTimesheet] = useState<AdminTimesheet | null>(null);
  const [editingEntry, setEditingEntry] = useState<TimesheetEntry | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Current Period Timesheets
  const { data: currentTimesheets = [], isLoading: loadingCurrent } = useQuery({
    queryKey: ["/api/admin/timesheets/current"],
    enabled: !!user && (user.role === "Admin" || user.role === "ConsoleManager")
  });

  // Historical Timesheets
  const { data: historicalTimesheets = [], isLoading: loadingHistory } = useQuery({
    queryKey: ["/api/admin/timesheets/history"],
    enabled: !!user && (user.role === "Admin" || user.role === "ConsoleManager")
  });

  // Payslip Ready Timesheets
  const { data: payslipTimesheets = [], isLoading: loadingPayslips } = useQuery({
    queryKey: ["/api/admin/payslips"],
    enabled: !!user && (user.role === "Admin" || user.role === "ConsoleManager")
  });

  // Analytics Data
  const { data: analyticsData } = useQuery({
    queryKey: ["/api/admin/timesheet-analytics"],
    enabled: !!user && (user.role === "Admin" || user.role === "ConsoleManager")
  });

  // Get timesheet entries for editing
  const { data: timesheetEntries = [] } = useQuery({
    queryKey: ["/api/admin/timesheet-entries", selectedTimesheet?.id],
    enabled: !!selectedTimesheet
  });

  // Approve timesheet
  const approveTimesheet = useMutation({
    mutationFn: (timesheetId: number) => 
      apiRequest("POST", `/api/admin/timesheets/${timesheetId}/approve`),
    onSuccess: () => {
      toast({ title: "Timesheet approved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/timesheets/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/timesheets/history"] });
    }
  });

  // Reject timesheet
  const rejectTimesheet = useMutation({
    mutationFn: (timesheetId: number) => 
      apiRequest("POST", `/api/admin/timesheets/${timesheetId}/reject`),
    onSuccess: () => {
      toast({ title: "Timesheet rejected" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/timesheets/current"] });
    }
  });

  // Update timesheet entry
  const updateEntry = useMutation({
    mutationFn: ({ entryId, data }: { entryId: number; data: Partial<TimesheetEntry> }) => 
      apiRequest("PATCH", `/api/admin/timesheet-entries/${entryId}`, data),
    onSuccess: () => {
      toast({ title: "Entry updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/timesheet-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/timesheets/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/timesheets/history"] });
      setIsEditDialogOpen(false);
      setEditingEntry(null);
    }
  });

  // Generate PDF payslip
  const generatePayslipPDF = useMutation({
    mutationFn: (timesheetId: number) => 
      apiRequest("POST", `/api/admin/timesheets/${timesheetId}/generate-payslip-pdf`),
    onSuccess: (data) => {
      // Create download link for PDF
      const blob = new Blob([data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip-${selectedTimesheet?.staffName}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "Payslip PDF generated successfully" });
    }
  });

  const filterTimesheets = (timesheets: AdminTimesheet[]) => {
    return timesheets.filter(timesheet => {
      const matchesSearch = timesheet.staffName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           timesheet.staffUsername.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || timesheet.status === statusFilter;
      const matchesStaff = staffFilter === "all" || timesheet.userId.toString() === staffFilter;
      
      // Period filter logic
      const periodStart = new Date(timesheet.payPeriodStart);
      const now = new Date();
      const currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);
      const matchesPeriod = periodFilter === "all" || 
        (periodFilter === "current" && periodStart >= currentPeriodStart) ||
        (periodFilter === "previous" && periodStart < currentPeriodStart);
      
      return matchesSearch && matchesStatus && matchesStaff && matchesPeriod;
    });
  };

  // Calculate analytics from filtered data
  const calculateAnalytics = (timesheets: AdminTimesheet[]) => {
    const filtered = filterTimesheets(timesheets);
    return {
      totalTimesheets: filtered.length,
      totalStaff: new Set(filtered.map(t => t.userId)).size,
      totalHours: filtered.reduce((sum, t) => sum + parseFloat(t.totalHours || '0'), 0),
      totalEarnings: filtered.reduce((sum, t) => sum + parseFloat(t.totalEarnings || '0'), 0),
      avgHoursPerStaff: filtered.length > 0 ? 
        filtered.reduce((sum, t) => sum + parseFloat(t.totalHours || '0'), 0) / new Set(filtered.map(t => t.userId)).size : 0,
      statusBreakdown: {
        draft: filtered.filter(t => t.status === 'draft').length,
        submitted: filtered.filter(t => t.status === 'submitted').length,
        approved: filtered.filter(t => t.status === 'approved').length,
        rejected: filtered.filter(t => t.status === 'rejected').length,
        paid: filtered.filter(t => t.status === 'paid').length
      }
    };
  };

  // Check if staff member is eligible for leave (non-casual as per Fair Work)
  const isLeaveEligible = (employmentType?: string) => {
    return employmentType === 'full-time' || employmentType === 'part-time';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft": return <Badge variant="outline">Draft</Badge>;
      case "submitted": return <Badge className="bg-amber-500 text-white">Submitted</Badge>;
      case "approved": return <Badge className="bg-emerald-500 text-white">Approved</Badge>;
      case "rejected": return <Badge variant="destructive">Rejected</Badge>;
      case "paid": return <Badge className="bg-blue-500 text-white">Paid</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const uniqueStaff = [...new Set([...currentTimesheets, ...historicalTimesheets, ...payslipTimesheets]
    .map(t => ({ id: t.userId, name: t.staffName })))];

  const allTimesheets = [...(currentTimesheets || []), ...(historicalTimesheets || []), ...(payslipTimesheets || [])];
  const analytics = calculateAnalytics(allTimesheets);

  return (
    <div className="space-y-6">
      {/* Analytics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Timesheets</p>
                <p className="text-2xl font-bold text-navy-700">{analytics.totalTimesheets}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Active Staff</p>
                <p className="text-2xl font-bold text-navy-700">{analytics.totalStaff}</p>
              </div>
              <Users className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Hours</p>
                <p className="text-2xl font-bold text-navy-700">{analytics.totalHours.toFixed(1)}h</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Earnings</p>
                <p className="text-2xl font-bold text-navy-700">${analytics.totalEarnings.toFixed(2)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-teal-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-slate-50">
          <CardContent className="p-3 text-center">
            <p className="text-sm text-slate-600">Draft</p>
            <p className="text-xl font-bold">{analytics.statusBreakdown.draft}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50">
          <CardContent className="p-3 text-center">
            <p className="text-sm text-amber-700">Submitted</p>
            <p className="text-xl font-bold text-amber-700">{analytics.statusBreakdown.submitted}</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50">
          <CardContent className="p-3 text-center">
            <p className="text-sm text-emerald-700">Approved</p>
            <p className="text-xl font-bold text-emerald-700">{analytics.statusBreakdown.approved}</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50">
          <CardContent className="p-3 text-center">
            <p className="text-sm text-red-700">Rejected</p>
            <p className="text-xl font-bold text-red-700">{analytics.statusBreakdown.rejected}</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50">
          <CardContent className="p-3 text-center">
            <p className="text-sm text-blue-700">Paid</p>
            <p className="text-xl font-bold text-blue-700">{analytics.statusBreakdown.paid}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Search by staff name or username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
            <Select value={staffFilter} onValueChange={setStaffFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Staff</SelectItem>
                {uniqueStaff.map(staff => (
                  <SelectItem key={staff.id} value={staff.id.toString()}>{staff.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Periods</SelectItem>
                <SelectItem value="current">Current Period</SelectItem>
                <SelectItem value="previous">Previous Periods</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-4 flex items-center gap-4 text-sm text-slate-600">
            <span>Showing {analytics.totalTimesheets} timesheets</span>
            <Separator orientation="vertical" className="h-4" />
            <span>Avg hours per staff: {analytics.avgHoursPerStaff.toFixed(1)}h</span>
            <Separator orientation="vertical" className="h-4" />
            <span>Total payroll: ${analytics.totalEarnings.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="current" className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="current">Current Period</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="payslips">Payslips</TabsTrigger>
        </TabsList>

        {/* Current Period Tab */}
        <TabsContent value="current">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Current Period Timesheets
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingCurrent ? (
                <div className="text-center py-8 text-slate-500">Loading timesheets...</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff Member</TableHead>
                        <TableHead>Pay Period</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Gross Pay</TableHead>
                        <TableHead>Leave Accrued</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filterTimesheets(currentTimesheets).map((timesheet) => (
                        <TableRow key={timesheet.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-slate-400" />
                              <div>
                                <div className="font-medium">{timesheet.staffName}</div>
                                <div className="text-sm text-slate-500">{timesheet.staffEmail}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {format(new Date(timesheet.payPeriodStart), "MMM dd")} - {format(new Date(timesheet.payPeriodEnd), "MMM dd, yyyy")}
                            </div>
                          </TableCell>
                          <TableCell>{timesheet.totalHours}h</TableCell>
                          <TableCell>${timesheet.totalEarnings}</TableCell>
                          <TableCell>
                            {(timesheet.annualLeave || timesheet.sickLeave) ? (
                              <div className="text-sm">
                                <div>Annual: {timesheet.annualLeave || 0}h</div>
                                <div>Sick: {timesheet.sickLeave || 0}h</div>
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(timesheet.status)}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedTimesheet(timesheet);
                                  setIsEditDialogOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              {timesheet.status === "submitted" && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => approveTimesheet.mutate(timesheet.id)}
                                    disabled={approveTimesheet.isPending}
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => rejectTimesheet.mutate(timesheet.id)}
                                    disabled={rejectTimesheet.isPending}
                                  >
                                    <AlertCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Historical Timesheets
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="text-center py-8 text-slate-500">Loading history...</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff Member</TableHead>
                        <TableHead>Pay Period</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Gross Pay</TableHead>
                        <TableHead>Leave Accrued</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filterTimesheets(historicalTimesheets).map((timesheet) => (
                        <TableRow key={timesheet.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-slate-400" />
                              <div>
                                <div className="font-medium">{timesheet.staffName}</div>
                                <div className="text-sm text-slate-500">{timesheet.staffEmail}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {format(new Date(timesheet.payPeriodStart), "MMM dd")} - {format(new Date(timesheet.payPeriodEnd), "MMM dd, yyyy")}
                            </div>
                          </TableCell>
                          <TableCell>{timesheet.totalHours}h</TableCell>
                          <TableCell>${timesheet.totalEarnings}</TableCell>
                          <TableCell>
                            {(timesheet.annualLeave || timesheet.sickLeave) ? (
                              <div className="text-sm">
                                <div>Annual: {timesheet.annualLeave || 0}h</div>
                                <div>Sick: {timesheet.sickLeave || 0}h</div>
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(timesheet.status)}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedTimesheet(timesheet);
                                  setIsEditDialogOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              {timesheet.status === "approved" && (
                                <Button
                                  size="sm"
                                  onClick={() => generatePayslipPDF.mutate(timesheet.id)}
                                  disabled={generatePayslipPDF.isPending}
                                >
                                  <FileDown className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payslips Tab */}
        <TabsContent value="payslips">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Payslip Generation
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPayslips ? (
                <div className="text-center py-8 text-slate-500">Loading payslips...</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff Member</TableHead>
                        <TableHead>Pay Period</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Gross Pay</TableHead>
                        <TableHead>Tax</TableHead>
                        <TableHead>Super</TableHead>
                        <TableHead>Net Pay</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filterTimesheets(payslipTimesheets).map((timesheet) => (
                        <TableRow key={timesheet.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-slate-400" />
                              <div>
                                <div className="font-medium">{timesheet.staffName}</div>
                                <div className="text-sm text-slate-500">{timesheet.staffEmail}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {format(new Date(timesheet.payPeriodStart), "MMM dd")} - {format(new Date(timesheet.payPeriodEnd), "MMM dd, yyyy")}
                            </div>
                          </TableCell>
                          <TableCell>{timesheet.totalHours}h</TableCell>
                          <TableCell>${timesheet.totalEarnings}</TableCell>
                          <TableCell>${timesheet.totalTax}</TableCell>
                          <TableCell>${timesheet.totalSuper}</TableCell>
                          <TableCell className="font-medium">${timesheet.netPay}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => generatePayslipPDF.mutate(timesheet.id)}
                              disabled={generatePayslipPDF.isPending}
                              className="flex items-center gap-2"
                            >
                              <Download className="h-4 w-4" />
                              Generate PDF
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Timesheet Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit Timesheet - {selectedTimesheet?.staffName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedTimesheet && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <span className="text-sm text-slate-600">Pay Period:</span>
                  <div className="font-medium">
                    {format(new Date(selectedTimesheet.payPeriodStart), "MMM dd")} - {format(new Date(selectedTimesheet.payPeriodEnd), "MMM dd, yyyy")}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-slate-600">Current Status:</span>
                  <div>{getStatusBadge(selectedTimesheet.status)}</div>
                </div>
              </div>
            )}

            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>End Time</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Gross Pay</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timesheetEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{format(new Date(entry.entryDate), "MMM dd")}</TableCell>
                      <TableCell>{format(new Date(entry.startTime), "HH:mm")}</TableCell>
                      <TableCell>{format(new Date(entry.endTime), "HH:mm")}</TableCell>
                      <TableCell>{entry.totalHours}h</TableCell>
                      <TableCell>${entry.grossPay}</TableCell>
                      <TableCell>{entry.notes || "-"}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingEntry(entry)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}