import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { hasPermission } from "@/lib/permissions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  ArrowLeft,
  Download,
  FileText,
  Calendar,
  DollarSign,
  Clock,
  User,
  Lock,
  Shield,
  Eye,
} from "lucide-react";

export default function ViewInvoice() {
  const { id } = useParams();
  const [, setLocation] = useLocation();

  // Get current user data for permission checking
  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  // Check if user has access to view invoices
  if (user && !hasPermission(user as any, "ACCESS_COMPLIANCE")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="flex items-center gap-3 p-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
          <Lock className="h-8 w-8 text-red-600 dark:text-red-400" />
          <div>
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">
              Access Restricted
            </h3>
            <p className="text-sm text-red-600 dark:text-red-400">
              Only Admin and Program Coordinators can view invoices.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
          <Shield className="h-3 w-3 mr-1" />
          Your role: {(user as any)?.role || "Unknown"}
        </Badge>
      </div>
    );
  }

  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ["/api/invoices", id],
    queryFn: async () => {
      return await apiRequest("GET", `/api/invoices/${id}`);
    },
    enabled: !!id,
  });

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "draft":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
      case "sent":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "paid":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "overdue":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const handleDownloadPDF = () => {
    window.open(`/api/invoices/${id}/pdf`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <h3 className="text-lg font-semibold">Invoice not found</h3>
          <p className="text-muted-foreground">
            The requested invoice could not be found or you don't have permission to view it.
          </p>
        </div>
        <Button onClick={() => setLocation("/compliance/invoices")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Invoices
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => setLocation("/compliance/invoices")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Invoices
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Invoice {invoice.invoiceNumber}</h1>
            <p className="text-muted-foreground">
              Created {format(new Date(invoice.createdAt), "dd MMM yyyy 'at' HH:mm")}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleDownloadPDF} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          <Badge className={getStatusColor(invoice.status)}>
            {invoice.status}
          </Badge>
        </div>
      </div>

      {/* Invoice Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Participant</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoice.participantName}</div>
            <p className="text-xs text-muted-foreground">
              NDIS Participant
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Due Date</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {format(new Date(invoice.dueDate), "dd MMM yyyy")}
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(invoice.dueDate) < new Date() ? "Overdue" : "Payment due"}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${parseFloat(invoice.total || "0").toLocaleString('en-AU', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              Subtotal: ${parseFloat(invoice.subtotal || "0").toLocaleString('en-AU', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Invoice Details */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Service Lines */}
          <Card>
            <CardHeader>
              <CardTitle>Service Lines</CardTitle>
              <CardDescription>
                Detailed breakdown of services provided
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Ratio</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.lines?.map((line: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell>
                        {format(new Date(line.dayISO + "T00:00:00"), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{line.serviceType}</div>
                          {line.description && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {line.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {line.startTime} - {line.endTime}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{line.ratio}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{line.category}</Badge>
                      </TableCell>
                      <TableCell className="font-mono">
                        {line.hours}h
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${Number(line.amount).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Notes */}
          {invoice.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Invoice Information */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Invoice Number</label>
                <p className="font-mono">{invoice.invoiceNumber}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Issue Date</label>
                <p>{format(new Date(invoice.issueDate), "dd MMMM yyyy")}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Due Date</label>
                <p>{format(new Date(invoice.dueDate), "dd MMMM yyyy")}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <div className="mt-1">
                  <Badge className={getStatusColor(invoice.status)}>
                    {invoice.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button onClick={handleDownloadPDF} className="w-full" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
              
              <Button onClick={() => window.print()} className="w-full" variant="outline">
                <Eye className="h-4 w-4 mr-2" />
                Print Preview
              </Button>
            </CardContent>
          </Card>

          {/* Payment Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span className="font-mono">${parseFloat(invoice.subtotal || "0").toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>GST:</span>
                <span className="font-mono">$0.00</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Total:</span>
                <span className="font-mono">${parseFloat(invoice.total || "0").toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}