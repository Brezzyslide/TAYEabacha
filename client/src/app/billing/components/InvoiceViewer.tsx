import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { FileText, Download, Calendar, DollarSign, Building } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
}

interface InvoiceViewerProps {
  companyId?: string;
}

const InvoiceViewer: React.FC<InvoiceViewerProps> = ({ companyId }) => {
  const { toast } = useToast();

  const { 
    data: currentInvoice, 
    isLoading, 
    error,
    refetch 
  } = useQuery<Invoice>({
    queryKey: ['current-invoice', companyId],
    queryFn: async () => {
      const url = companyId 
        ? `/api/invoices/current/${companyId}`
        : '/api/invoices/current';
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch current invoice');
      }
      
      const data = await response.json();
      
      // Convert date strings to Date objects
      return {
        ...data,
        invoiceDate: new Date(data.invoiceDate),
        dueDate: new Date(data.dueDate),
        billingPeriod: {
          start: new Date(data.billingPeriod.start),
          end: new Date(data.billingPeriod.end),
        },
        lineItems: data.lineItems.map((item: any) => ({
          ...item,
          period: {
            start: new Date(item.period.start),
            end: new Date(item.period.end),
          }
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

  const handleDownloadInvoice = () => {
    toast({
      title: "Coming Soon",
      description: "PDF invoice download will be available soon.",
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Current Invoice
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !currentInvoice) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Current Invoice
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No invoice available</p>
            <p className="text-sm">An invoice will be generated once billing is active.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Invoice Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <FileText className="w-6 h-6" />
                Invoice {currentInvoice.invoiceNumber}
              </CardTitle>
              <CardDescription>
                Issued {format(currentInvoice.invoiceDate, 'MMMM d, yyyy')}
              </CardDescription>
            </div>
            <div className="text-right">
              <Badge className={getStatusColor(currentInvoice.status)}>
                {currentInvoice.status.toUpperCase()}
              </Badge>
              <div className="mt-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleDownloadInvoice}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Company Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">FROM</h3>
              <div className="space-y-1">
                <p className="font-semibold">NeedCareAI+</p>
                <p className="text-sm text-muted-foreground">
                  Advanced Workforce Management Platform<br />
                  Multi-Tenant Healthcare Solutions<br />
                  Australia
                </p>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">BILL TO</h3>
              <div className="space-y-1">
                <p className="font-semibold">{currentInvoice.company.name}</p>
                <p className="text-sm text-muted-foreground">
                  {currentInvoice.company.businessAddress.split('\n').map((line, i) => (
                    <span key={i}>{line}<br /></span>
                  ))}
                </p>
                <p className="text-sm text-muted-foreground">
                  Contact: {currentInvoice.company.primaryContactName}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Billing Period and Due Date */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Billing Period</p>
                <p className="text-sm text-muted-foreground">
                  {format(currentInvoice.billingPeriod.start, 'MMM d')} - {format(currentInvoice.billingPeriod.end, 'MMM d, yyyy')}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Due Date</p>
                <p className="text-sm text-muted-foreground">
                  {format(currentInvoice.dueDate, 'MMMM d, yyyy')}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Payment Terms</p>
                <p className="text-sm text-muted-foreground">{currentInvoice.paymentTerms}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Line Items */}
          <div>
            <h3 className="font-semibold mb-4">Services</h3>
            <div className="space-y-2">
              {currentInvoice.lineItems.map((item, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-border/50 last:border-b-0">
                  <div className="flex-1">
                    <p className="font-medium">{item.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(item.period.start, 'MMM d')} - {format(item.period.end, 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {item.quantity} × ${item.unitPrice.toFixed(2)} = ${item.total.toFixed(2)} AUD
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Totals */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>${currentInvoice.subtotal.toFixed(2)} AUD</span>
            </div>
            <div className="flex justify-between">
              <span>GST (10%):</span>
              <span>${currentInvoice.gstAmount.toFixed(2)} AUD</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-semibold">
              <span>Total Amount:</span>
              <span>${currentInvoice.totalAmount.toFixed(2)} AUD</span>
            </div>
          </div>

          {/* Notes */}
          {currentInvoice.notes && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">Notes</h3>
                <p className="text-sm text-muted-foreground">{currentInvoice.notes}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InvoiceViewer;