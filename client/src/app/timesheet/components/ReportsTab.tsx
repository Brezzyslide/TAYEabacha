import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  FileText, 
  Download,
  Calendar,
  User,
  BarChart3,
  TrendingUp,
  Clock,
  DollarSign,
  Search
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface HistoricalTimesheet {
  id: number;
  userId: number;
  staffName: string;
  staffEmail: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  status: string;
  totalHours: string;
  totalEarnings: string;
  submittedAt?: string;
  approvedAt?: string;
  createdAt: string;
}

interface ReportAnalytics {
  totalTimesheets: number;
  totalStaff: number;
  avgHoursPerStaff: number;
  totalEarnings: number;
  byStatus: {
    draft: number;
    submitted: number;
    approved: number;
    rejected: number;
  };
}

export default function ReportsTab() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");

  const { data: historicalTimesheets = [], isLoading } = useQuery<HistoricalTimesheet[]>({
    queryKey: ["/api/admin/timesheets/history"],
  });

  const { data: analytics } = useQuery<ReportAnalytics>({
    queryKey: ["/api/admin/timesheets/analytics"],
  });

  const filterTimesheets = (timesheets: HistoricalTimesheet[]) => {
    return timesheets.filter(timesheet => {
      const matchesSearch = 
        timesheet.staffName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        timesheet.staffEmail.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || timesheet.status === statusFilter;
      
      // Period filter logic would be implemented based on date ranges
      const matchesPeriod = periodFilter === "all"; // Simplified for now
      
      return matchesSearch && matchesStatus && matchesPeriod;
    });
  };

  const handleExportReport = async (format: 'csv' | 'excel') => {
    try {
      const response = await fetch(`/api/admin/timesheets/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          filters: { search: searchTerm, status: statusFilter, period: periodFilter }
        }),
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `timesheet-report.${format === 'excel' ? 'xlsx' : 'csv'}`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "Export Complete",
          description: `Report exported to ${format.toUpperCase()} format`,
        });
      } else {
        throw new Error("Export failed");
      }
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export report",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClass = "inline-flex items-center gap-1";
    
    switch (status) {
      case 'draft':
        return (
          <Badge variant="outline" className={`${baseClass} text-gray-700 border-gray-200 bg-gray-50`}>
            Draft
          </Badge>
        );
      case 'submitted':
        return (
          <Badge variant="outline" className={`${baseClass} text-blue-700 border-blue-200 bg-blue-50`}>
            <Clock className="h-3 w-3" />
            Submitted
          </Badge>
        );
      case 'approved':
        return (
          <Badge variant="outline" className={`${baseClass} text-green-700 border-green-200 bg-green-50`}>
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="outline" className={`${baseClass} text-red-700 border-red-200 bg-red-50`}>
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredTimesheets = filterTimesheets(historicalTimesheets);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600 dark:text-blue-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Timesheets</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {analytics?.totalTimesheets || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <User className="h-6 w-6 text-green-600 dark:text-green-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Staff</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {analytics?.totalStaff || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Clock className="h-6 w-6 text-purple-600 dark:text-purple-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Hours/Staff</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {analytics?.avgHoursPerStaff?.toFixed(1) || '0.0'}h
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center">
              <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
                <DollarSign className="h-6 w-6 text-amber-600 dark:text-amber-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Earnings</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  ${analytics?.totalEarnings?.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Export Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button onClick={() => handleExportReport('csv')} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button onClick={() => handleExportReport('excel')}>
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filter Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Search by staff name or email..."
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
              </SelectContent>
            </Select>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Periods</SelectItem>
                <SelectItem value="current">Current Period</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="last-quarter">Last Quarter</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Historical Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Timesheet History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Pay Period</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Earnings</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Approved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTimesheets.map((timesheet) => (
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
                        <Calendar className="h-4 w-4 inline mr-1" />
                        {format(new Date(timesheet.payPeriodStart), "MMM dd")} - {format(new Date(timesheet.payPeriodEnd), "MMM dd, yyyy")}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{timesheet.totalHours}h</TableCell>
                    <TableCell className="font-medium">${timesheet.totalEarnings}</TableCell>
                    <TableCell>{getStatusBadge(timesheet.status)}</TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {timesheet.submittedAt ? format(new Date(timesheet.submittedAt), "MMM dd, HH:mm") : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {timesheet.approvedAt ? format(new Date(timesheet.approvedAt), "MMM dd, HH:mm") : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredTimesheets.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              No timesheets found matching your criteria
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}