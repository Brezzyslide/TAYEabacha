import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { FileText, Download, Search, Building2, Calendar, DollarSign, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateInvoicePDF } from '@/lib/invoice-pdf-generator';

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  period: {
    start: Date;
    end: Date;
  };
}

interface Invoice {
  invoiceNumber: string;
  companyId: string;
  company: {
    name: string;
    businessAddress: string;
    primaryContactName: string;
    primaryContactEmail: string;
  };
  invoiceDate: Date;
  dueDate: Date;
  billingPeriod: {
    start: Date;
    end: Date;
  };
  lineItems: InvoiceLineItem[];
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  status: 'pending' | 'paid' | 'overdue';
  paymentTerms: string;
  notes?: string;
  companyName?: string;
  type?: 'current' | 'historical';
}

interface UniversalInvoiceData {
  totalInvoices: number;
  totalCompanies: number;
  invoices: Invoice[];
}

const UniversalInvoiceViewer: React.FC = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { 
    data: invoiceData, 
    isLoading, 
    error,
    refetch 
  } = useQuery<UniversalInvoiceData>({
    queryKey: ['universal-invoices'],
    queryFn: async () => {
      console.log('[UNIVERSAL INVOICES] Fetching universal invoices...');
      const response = await fetch('/api/console/invoices/all', {
        credentials: 'include' // Ensure cookies are sent
      });
      
      console.log('[UNIVERSAL INVOICES] Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[UNIVERSAL INVOICES] Error response:', errorText);
        throw new Error(`Failed to fetch universal invoices: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[UNIVERSAL INVOICES] Retrieved data:', data);
      
      // Convert date strings to Date objects
      return {
        ...data,
        invoices: data.invoices.map((invoice: any) => ({
          ...invoice,
          invoiceDate: new Date(invoice.invoiceDate),
          dueDate: new Date(invoice.dueDate),
          billingPeriod: {
            start: new Date(invoice.billingPeriod.start),
            end: new Date(invoice.billingPeriod.end),
          },
          lineItems: invoice.lineItems.map((item: any) => ({
            ...item,
            period: {
              start: new Date(item.period.start),
              end: new Date(item.period.end),
            }
          }))
        }))
      };
    },
    enabled: true,
    retry: 1
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'overdue':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'pending':
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'current':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'historical':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  const handleDownloadInvoice = (invoice: Invoice) => {
    try {
      generateInvoicePDF(invoice);
      toast({
        title: "Success",
        description: `Invoice ${invoice.invoiceNumber} PDF downloaded successfully.`,
      });
    } catch (error: any) {
      console.error('PDF generation error:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Filter invoices based on search and filters
  const filteredInvoices = invoiceData?.invoices.filter((invoice) => {
    const matchesSearch = 
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.companyName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    const matchesType = typeFilter === 'all' || invoice.type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  }) || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Universal Invoice Management
          </CardTitle>
          <CardDescription>Access all tenant invoices across the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !invoiceData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Universal Invoice Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Unable to load universal invoices</p>
            <p className="text-sm">Please check your permissions or try again.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-6 h-6" />
            Universal Invoice Management
          </CardTitle>
          <CardDescription>
            Console Manager access to all tenant invoices across the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-muted-foreground">Total Invoices</span>
              <span className="text-2xl font-bold">{invoiceData.totalInvoices}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-muted-foreground">Total Companies</span>
              <span className="text-2xl font-bold">{invoiceData.totalCompanies}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-muted-foreground">Current Invoices</span>
              <span className="text-2xl font-bold">
                {invoiceData.invoices.filter(inv => inv.type === 'current').length}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-muted-foreground">Total Revenue</span>
              <span className="text-2xl font-bold text-green-600">
                ${invoiceData.invoices.reduce((sum, inv) => sum + inv.totalAmount, 0).toFixed(2)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="w-5 h-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by invoice number or company name..."
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
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="current">Current</SelectItem>
                <SelectItem value="historical">Historical</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setTypeFilter('all');
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Invoices ({filteredInvoices.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No invoices found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <TableRow key={`${invoice.invoiceNumber}-${invoice.companyId}`}>
                      <TableCell className="font-medium">
                        {invoice.invoiceNumber}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          {invoice.companyName || invoice.company.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getTypeColor(invoice.type || 'unknown')}>
                          {invoice.type || 'unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {format(invoice.invoiceDate, 'MMM dd, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {format(invoice.dueDate, 'MMM dd, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 font-medium">
                          <DollarSign className="w-4 h-4 text-muted-foreground" />
                          ${invoice.totalAmount.toFixed(2)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(invoice.status)}>
                          {invoice.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDownloadInvoice(invoice)}
                          className="gap-2"
                        >
                          <Download className="w-4 h-4" />
                          PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UniversalInvoiceViewer;