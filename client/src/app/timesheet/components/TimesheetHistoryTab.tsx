import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, Eye, Calendar, User, DollarSign, Clock, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TimesheetHistoryItem {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  status: string;
  totalHours: string;
  totalEarnings: string;
  totalTax: string;
  netPay: string;
  submittedAt: string;
  approvedAt: string;
  employmentType: string;
  payLevel: string;
  payPoint: string;
}

export default function TimesheetHistoryTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTimesheet, setSelectedTimesheet] = useState<TimesheetHistoryItem | null>(null);
  const [viewingDetails, setViewingDetails] = useState(false);
  const { toast } = useToast();

  // Fetch all timesheets history
  const { data: timesheetHistory = [], isLoading } = useQuery<TimesheetHistoryItem[]>({
    queryKey: ["/api/admin/timesheets/history"],
  });

  // Individual timesheet PDF export
  const exportTimesheetMutation = useMutation({
    mutationFn: async (timesheetId: number) => {
      const response = await fetch(`/api/admin/timesheets/${timesheetId}/export-pdf`);
      if (!response.ok) throw new Error("Failed to export timesheet");
      
      const data = await response.json();
      
      // Generate PDF using the data (simplified for now - returns JSON data)
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timesheet-${data.timesheet.userName}-${data.timesheet.payPeriodStart}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Timesheet exported successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to export timesheet",
        variant: "destructive",
      });
    },
  });

  // Bulk export functionality  
  const bulkExportMutation = useMutation({
    mutationFn: async (filters: { status?: string; dateRange?: string }) => {
      const params = new URLSearchParams();
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.dateRange) params.append('dateRange', filters.dateRange);
      
      const response = await fetch(`/api/admin/timesheets/bulk-export?${params}`);
      if (!response.ok) throw new Error("Failed to export timesheets");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timesheets-bulk-export-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Bulk export completed successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error", 
        description: "Failed to export timesheets",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: "bg-gray-100 text-gray-800",
      submitted: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
      paid: "bg-blue-100 text-blue-800"
    };
    
    return (
      <Badge className={variants[status as keyof typeof variants] || "bg-gray-100 text-gray-800"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(parseFloat(amount.toString()));
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'dd/MM/yyyy');
  };

  // Filter timesheets based on search and status
  const filteredTimesheets = (timesheetHistory as TimesheetHistoryItem[]).filter((timesheet: TimesheetHistoryItem) => {
    const matchesSearch = searchTerm === "" || 
      timesheet.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      timesheet.userEmail.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || timesheet.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading timesheet history...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Timesheet History
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                View and export all historical timesheets across your organization
              </p>
            </div>
            
            {/* Bulk Export Button */}
            <Button
              onClick={() => bulkExportMutation.mutate({ status: statusFilter })}
              disabled={bulkExportMutation.isPending}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              {bulkExportMutation.isPending ? 'Exporting...' : 'Bulk Export'}
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by staff name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Results Summary */}
          <div className="mb-4 text-sm text-gray-600">
            Showing {filteredTimesheets.length} of {(timesheetHistory as TimesheetHistoryItem[]).length} timesheets
          </div>

          {/* Timesheets Table */}
          {filteredTimesheets.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No timesheets found matching your criteria.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Member</TableHead>
                    <TableHead>Pay Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Gross Pay</TableHead>
                    <TableHead className="text-right">Net Pay</TableHead>
                    <TableHead>Employment</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTimesheets.map((timesheet: TimesheetHistoryItem) => (
                    <TableRow key={timesheet.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{timesheet.userName}</div>
                          <div className="text-sm text-gray-600">{timesheet.userEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {formatDate(timesheet.payPeriodStart)} - {formatDate(timesheet.payPeriodEnd)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(timesheet.status)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {parseFloat(timesheet.totalHours).toFixed(1)}h
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(timesheet.totalEarnings)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(timesheet.netPay)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{timesheet.employmentType}</div>
                          <div className="text-gray-600">{timesheet.payLevel}.{timesheet.payPoint}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 justify-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedTimesheet(timesheet);
                              setViewingDetails(true);
                            }}
                            className="flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </Button>
                          
                          <Button
                            size="sm"
                            onClick={() => exportTimesheetMutation.mutate(timesheet.id)}
                            disabled={exportTimesheetMutation.isPending}
                            className="flex items-center gap-1 bg-green-600 hover:bg-green-700"
                          >
                            <Download className="h-3 w-3" />
                            PDF
                          </Button>
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
    </div>
  );
}