import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  User,
  Eye,
  Check,
  X,
  Users,
  DollarSign,
  TrendingUp,
  Calendar
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

interface PendingTimesheet {
  id: number;
  userId: number;
  staffName: string;
  staffEmail: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  status: 'submitted' | 'approved' | 'rejected';
  totalHours: string;
  totalEarnings: string;
  submittedAt: string;
  autoSubmitted?: boolean;
}

interface ReviewStats {
  pendingCount: number;
  totalHours: number;
  totalEarnings: number;
  autoSubmittedCount: number;
}

export default function TimesheetReviewDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTimesheets, setSelectedTimesheets] = useState<number[]>([]);
  const [selectedTimesheet, setSelectedTimesheet] = useState<PendingTimesheet | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  const { data: pendingTimesheets = [], isLoading } = useQuery<PendingTimesheet[]>({
    queryKey: ["/api/admin/timesheets/pending"],
  });

  const { data: stats } = useQuery<ReviewStats>({
    queryKey: ["/api/admin/timesheets/stats"],
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async (timesheetIds: number[]) => {
      return apiRequest("POST", "/api/admin/timesheets/bulk-approve", {
        timesheetIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/timesheets/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/timesheets/stats"] });
      setSelectedTimesheets([]);
      toast({
        title: "Timesheets Approved",
        description: `Successfully approved ${selectedTimesheets.length} timesheets`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve timesheets",
        variant: "destructive",
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (timesheetId: number) => {
      return apiRequest("POST", `/api/admin/timesheets/${timesheetId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/timesheets/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/timesheets/stats"] });
      toast({
        title: "Timesheet Approved",
        description: "Timesheet has been approved successfully",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (timesheetId: number) => {
      return apiRequest("POST", `/api/admin/timesheets/${timesheetId}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/timesheets/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/timesheets/stats"] });
      toast({
        title: "Timesheet Rejected",
        description: "Timesheet has been rejected",
      });
    },
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTimesheets(pendingTimesheets.map(t => t.id));
    } else {
      setSelectedTimesheets([]);
    }
  };

  const handleSelectTimesheet = (timesheetId: number, checked: boolean) => {
    if (checked) {
      setSelectedTimesheets(prev => [...prev, timesheetId]);
    } else {
      setSelectedTimesheets(prev => prev.filter(id => id !== timesheetId));
    }
  };

  const getStatusBadge = (status: string, autoSubmitted?: boolean) => {
    const baseClass = "inline-flex items-center gap-1";
    
    switch (status) {
      case 'submitted':
        return (
          <Badge variant="outline" className={`${baseClass} text-blue-700 border-blue-200 bg-blue-50`}>
            <Clock className="h-3 w-3" />
            {autoSubmitted ? 'Auto-Submitted' : 'Submitted'}
          </Badge>
        );
      case 'approved':
        return (
          <Badge variant="outline" className={`${baseClass} text-green-700 border-green-200 bg-green-50`}>
            <CheckCircle className="h-3 w-3" />
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="outline" className={`${baseClass} text-red-700 border-red-200 bg-red-50`}>
            <X className="h-3 w-3" />
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

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
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <AlertCircle className="h-6 w-6 text-blue-600 dark:text-blue-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending Review</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats?.pendingCount || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <Clock className="h-6 w-6 text-green-600 dark:text-green-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Hours</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats?.totalHours?.toFixed(1) || '0.0'}h
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <DollarSign className="h-6 w-6 text-purple-600 dark:text-purple-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Payroll</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  ${stats?.totalEarnings?.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center">
              <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
                <TrendingUp className="h-6 w-6 text-amber-600 dark:text-amber-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Auto-Submitted</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats?.autoSubmittedCount || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Timesheets */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Timesheets Awaiting Review
            </CardTitle>
            {selectedTimesheets.length > 0 && (
              <Button
                onClick={() => bulkApproveMutation.mutate(selectedTimesheets)}
                disabled={bulkApproveMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="h-4 w-4 mr-2" />
                Approve Selected ({selectedTimesheets.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {pendingTimesheets.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">All Caught Up!</h3>
              <p className="text-gray-600">No timesheets pending review at the moment.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedTimesheets.length === pendingTimesheets.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Staff Member</TableHead>
                    <TableHead>Pay Period</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Gross Pay</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingTimesheets.map((timesheet) => (
                    <TableRow key={timesheet.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedTimesheets.includes(timesheet.id)}
                          onCheckedChange={(checked) => 
                            handleSelectTimesheet(timesheet.id, checked as boolean)
                          }
                        />
                      </TableCell>
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
                      <TableCell>{getStatusBadge(timesheet.status, timesheet.autoSubmitted)}</TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {format(new Date(timesheet.submittedAt), "MMM dd, HH:mm")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedTimesheet(timesheet);
                              setIsViewDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => approveMutation.mutate(timesheet.id)}
                            disabled={approveMutation.isPending}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Check className="h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => rejectMutation.mutate(timesheet.id)}
                            disabled={rejectMutation.isPending}
                          >
                            <X className="h-4 w-4" />
                            Reject
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

      {/* View Timesheet Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Timesheet Details - {selectedTimesheet?.staffName}
            </DialogTitle>
          </DialogHeader>
          {selectedTimesheet && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <span className="text-sm text-slate-600">Pay Period:</span>
                  <div className="font-medium">
                    {format(new Date(selectedTimesheet.payPeriodStart), "MMM dd")} - {format(new Date(selectedTimesheet.payPeriodEnd), "MMM dd, yyyy")}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-slate-600">Total Hours:</span>
                  <div className="font-medium">{selectedTimesheet.totalHours}h</div>
                </div>
                <div>
                  <span className="text-sm text-slate-600">Gross Pay:</span>
                  <div className="font-medium">${selectedTimesheet.totalEarnings}</div>
                </div>
                <div>
                  <span className="text-sm text-slate-600">Status:</span>
                  <div>{getStatusBadge(selectedTimesheet.status, selectedTimesheet.autoSubmitted)}</div>
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => {
                    approveMutation.mutate(selectedTimesheet.id);
                    setIsViewDialogOpen(false);
                  }}
                  disabled={approveMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Approve Timesheet
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    rejectMutation.mutate(selectedTimesheet.id);
                    setIsViewDialogOpen(false);
                  }}
                  disabled={rejectMutation.isPending}
                >
                  <X className="h-4 w-4 mr-2" />
                  Reject Timesheet
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}