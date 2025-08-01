import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  CheckCircle, 
  Download,
  FileText,
  User,
  Calendar,
  DollarSign,
  Users
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface ApprovedTimesheet {
  id: number;
  userId: number;
  staffName: string;
  staffEmail: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  totalHours: string;
  totalEarnings: string;
  totalTax: string;
  totalSuper: string;
  netPay: string;
  approvedAt: string;
}

interface PayrollStats {
  approvedCount: number;
  totalPayroll: number;
  totalTax: number;
  totalSuper: number;
}

export default function PayrollReadyTab() {
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState("current");

  const { data: approvedTimesheets = [], isLoading } = useQuery<ApprovedTimesheet[]>({
    queryKey: ["/api/admin/timesheets/approved", selectedPeriod],
  });

  const { data: stats } = useQuery<PayrollStats>({
    queryKey: ["/api/admin/timesheets/payroll-stats", selectedPeriod],
  });

  const handleExportPayroll = async () => {
    try {
      const response = await fetch("/api/admin/timesheets/export-payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: selectedPeriod }),
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payroll-export-${selectedPeriod}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "Export Complete",
          description: "Payroll data has been exported successfully",
        });
      } else {
        throw new Error("Export failed");
      }
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export payroll data",
        variant: "destructive",
      });
    }
  };

  const handleGeneratePayslips = async () => {
    try {
      const response = await fetch("/api/admin/timesheets/generate-payslips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: selectedPeriod }),
      });
      
      if (response.ok) {
        toast({
          title: "Payslips Generated",
          description: "All payslips have been generated and sent to staff",
        });
      } else {
        throw new Error("Generation failed");
      }
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: "Failed to generate payslips",
        variant: "destructive",
      });
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
      {/* Payroll Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Ready for Payroll</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats?.approvedCount || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Gross Payroll</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  ${stats?.totalPayroll?.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <FileText className="h-6 w-6 text-purple-600 dark:text-purple-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Tax</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  ${stats?.totalTax?.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center">
              <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
                <Users className="h-6 w-6 text-amber-600 dark:text-amber-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Superannuation</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  ${stats?.totalSuper?.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Payroll Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button onClick={handleExportPayroll} className="bg-blue-600 hover:bg-blue-700">
              <Download className="h-4 w-4 mr-2" />
              Export Payroll Data
            </Button>
            <Button onClick={handleGeneratePayslips} variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              Generate All Payslips
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Approved Timesheets Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Approved Timesheets
          </CardTitle>
        </CardHeader>
        <CardContent>
          {approvedTimesheets.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Approved Timesheets</h3>
              <p className="text-gray-600">No timesheets are ready for payroll processing.</p>
            </div>
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
                    <TableHead>Approved</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvedTimesheets.map((timesheet) => (
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
                      <TableCell>${timesheet.totalTax}</TableCell>
                      <TableCell>${timesheet.totalSuper}</TableCell>
                      <TableCell className="font-bold text-green-600">${timesheet.netPay}</TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {format(new Date(timesheet.approvedAt), "MMM dd, HH:mm")}
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