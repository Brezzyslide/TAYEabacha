import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  FileText, 
  Download, 
  Edit, 
  Search,
  Filter,
  Shield,
  Lock
} from "lucide-react";
import { formatCurrency, itemToRateSet, getLineItemTotal } from "@shared/utils/calc";
import Decimal from "decimal.js";

export default function ServiceAgreementsList() {
  const [clientFilter, setClientFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Get current user data for permission checking
  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  // Check if user has access to compliance module
  if (user && !hasPermission(user, "ACCESS_COMPLIANCE")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="flex items-center gap-3 p-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
          <Lock className="h-8 w-8 text-red-600 dark:text-red-400" />
          <div>
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">
              Access Restricted
            </h3>
            <p className="text-sm text-red-600 dark:text-red-400">
              Only Admin and Program Coordinators can access the Compliance module.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
          <Shield className="h-3 w-3 mr-1" />
          Your role: {user?.role || "Unknown"}
        </Badge>
      </div>
    );
  }

  const { data: agreements = [], isLoading } = useQuery({
    queryKey: ["/api/compliance/service-agreements"],
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
  });

  const filteredAgreements = Array.isArray(agreements) ? agreements.filter((agreement: any) => {
    const matchesClient = clientFilter === "all" || agreement.clientId?.toString() === clientFilter;
    const matchesStatus = statusFilter === "all" || getAgreementStatus(agreement) === statusFilter;
    const matchesSearch = !searchTerm || 
      agreement.agreementNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getClientName(agreement.clientId).toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesClient && matchesStatus && matchesSearch;
  }) : [];

  const getClientName = (clientId: number) => {
    const client = Array.isArray(clients) ? clients.find((c: any) => c.id === clientId) : null;
    return client ? client.fullName || `${client.firstName} ${client.lastName}` : "Unknown Client";
  };

  const getAgreementStatus = (agreement: any) => {
    const now = new Date();
    const startDate = new Date(agreement.startDate);
    const endDate = new Date(agreement.endDate);
    
    if (now < startDate) return "Pending";
    if (now > endDate) return "Expired";
    return "Active";
  };

  const calculateAgreementTotal = (agreement: any) => {
    const items = agreement.items || [];
    return items.reduce((total: Decimal, item: any) => {
      const rateSet = itemToRateSet(item);
      const itemTotal = getLineItemTotal(rateSet);
      return total.plus(itemTotal);
    }, new Decimal(0));
  };

  const handleExportPDF = async (agreementId: string) => {
    try {
      const response = await fetch(`/api/compliance/service-agreements/${agreementId}/pdf`, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `service-agreement-${agreementId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('PDF export error:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            NDIS Service Agreements
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Manage service agreements with detailed line items and pricing
          </p>
        </div>
        <Link href="/compliance/service-agreements/create">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Agreement
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search agreements..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {Array.isArray(clients) && clients.map((client: any) => (
                  <SelectItem key={client.id} value={client.id.toString()}>
                    {client.fullName || `${client.firstName} ${client.lastName}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Agreements Table */}
      <Card>
        <CardHeader>
          <CardTitle>Service Agreements</CardTitle>
          <CardDescription>
            {filteredAgreements.length} agreement{filteredAgreements.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-slate-600">Loading agreements...</div>
            </div>
          ) : filteredAgreements.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agreement #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAgreements.map((agreement: any) => (
                  <TableRow key={agreement.id}>
                    <TableCell className="font-medium">
                      {agreement.agreementNumber || `SA-${agreement.id}`}
                    </TableCell>
                    <TableCell>{getClientName(agreement.clientId)}</TableCell>
                    <TableCell>
                      {new Date(agreement.startDate).toLocaleDateString()} - {new Date(agreement.endDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          getAgreementStatus(agreement) === "Active" ? "default" : 
                          getAgreementStatus(agreement) === "Pending" ? "secondary" : "destructive"
                        }
                      >
                        {getAgreementStatus(agreement)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(calculateAgreementTotal(agreement))}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/compliance/service-agreements/edit/${agreement.id}`}>
                          <Button size="sm" variant="outline">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleExportPDF(agreement.id)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-slate-400" />
              <h3 className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                No service agreements found
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {searchTerm || clientFilter || statusFilter !== "all" 
                  ? "Try adjusting your filters or search terms."
                  : "Create your first service agreement to get started."
                }
              </p>
              {!searchTerm && !clientFilter && statusFilter === "all" && (
                <Link href="/compliance/service-agreements/create" className="mt-4 inline-block">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Agreement
                  </Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}