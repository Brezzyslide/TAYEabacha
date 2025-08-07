import jsPDF from 'jspdf';
import { format } from 'date-fns';

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

// TUSK-inspired color palette from replit.md
const COLORS = {
  deepNavy: '#2B4C7E',     // Deep Navy
  warmGold: '#D4AF37',     // Warm Gold
  sageGreen: '#87A96B',    // Sage Green
  cream: '#F5F5DC',        // Cream
  lightGray: '#F8F9FA',
  darkGray: '#6B7280',
  black: '#1F2937'
};

export function generateInvoicePDF(invoice: Invoice): void {
  // Create PDF document
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  let yPosition = 20;

  // Helper function to add text with word wrapping
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize = 10): number => {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, y);
    return y + (lines.length * fontSize * 0.4);
  };

  // Set background color (light cream)
  doc.setFillColor('#F5F5DC');
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Header Section - Deep Navy background
  doc.setFillColor(COLORS.deepNavy);
  doc.rect(0, 0, pageWidth, 45, 'F');

  // Company Logo/Name - NeedCareAI+
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('NeedCareAI+', 20, 25);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Advanced Workforce Management Platform', 20, 32);
  doc.text('Multi-Tenant Healthcare Solutions', 20, 37);

  // Invoice Number and Date - Right aligned
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`INVOICE ${invoice.invoiceNumber}`, pageWidth - 20, 25, { align: 'right' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${format(invoice.invoiceDate, 'MMMM d, yyyy')}`, pageWidth - 20, 32, { align: 'right' });
  doc.text(`Due: ${format(invoice.dueDate, 'MMMM d, yyyy')}`, pageWidth - 20, 37, { align: 'right' });

  yPosition = 60;

  // Status Badge
  const statusColor = invoice.status === 'paid' ? COLORS.sageGreen : 
                     invoice.status === 'overdue' ? '#DC2626' : COLORS.warmGold;
  doc.setFillColor(statusColor);
  doc.rect(20, yPosition - 5, 30, 12, 'F');
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.status.toUpperCase(), 35, yPosition + 2, { align: 'center' });

  yPosition += 20;

  // Company Information Section
  doc.setTextColor(COLORS.black);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO:', 20, yPosition);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  yPosition += 8;
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.company.name, 20, yPosition);
  
  yPosition += 6;
  doc.setFont('helvetica', 'normal');
  const addressLines = invoice.company.businessAddress.split('\n');
  for (const line of addressLines) {
    doc.text(line, 20, yPosition);
    yPosition += 5;
  }
  
  yPosition += 3;
  doc.text(`Contact: ${invoice.company.primaryContactName}`, 20, yPosition);
  yPosition += 5;
  doc.text(`Email: ${invoice.company.primaryContactEmail}`, 20, yPosition);

  // Billing Period Information - Right side
  const rightStartY = 80;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('BILLING PERIOD:', pageWidth - 100, rightStartY);
  
  doc.setFont('helvetica', 'normal');
  doc.text(`${format(invoice.billingPeriod.start, 'MMM d, yyyy')} -`, pageWidth - 100, rightStartY + 8);
  doc.text(`${format(invoice.billingPeriod.end, 'MMM d, yyyy')}`, pageWidth - 100, rightStartY + 15);
  
  doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT TERMS:', pageWidth - 100, rightStartY + 25);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.paymentTerms, pageWidth - 100, rightStartY + 33);

  yPosition = Math.max(yPosition + 15, rightStartY + 50);

  // Line Items Table
  doc.setFillColor(COLORS.deepNavy);
  doc.rect(20, yPosition, pageWidth - 40, 15, 'F');
  
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('DESCRIPTION', 25, yPosition + 10);
  doc.text('QTY', pageWidth - 100, yPosition + 10);
  doc.text('UNIT PRICE', pageWidth - 75, yPosition + 10);
  doc.text('TOTAL', pageWidth - 35, yPosition + 10, { align: 'right' });

  yPosition += 20;

  // Line Items
  doc.setTextColor(COLORS.black);
  doc.setFont('helvetica', 'normal');
  
  for (const item of invoice.lineItems) {
    // Alternate row background
    if ((invoice.lineItems.indexOf(item) % 2) === 1) {
      doc.setFillColor(COLORS.lightGray);
      doc.rect(20, yPosition - 5, pageWidth - 40, 12, 'F');
    }

    // Description with period
    doc.text(item.description, 25, yPosition + 2);
    doc.setFontSize(8);
    doc.setTextColor(COLORS.darkGray);
    doc.text(`Period: ${format(item.period.start, 'MMM d')} - ${format(item.period.end, 'MMM d, yyyy')}`, 25, yPosition + 7);
    
    // Quantity, Unit Price, Total
    doc.setFontSize(10);
    doc.setTextColor(COLORS.black);
    doc.text(item.quantity.toString(), pageWidth - 100, yPosition + 2);
    doc.text(`$${item.unitPrice.toFixed(2)}`, pageWidth - 75, yPosition + 2);
    doc.text(`$${item.total.toFixed(2)}`, pageWidth - 35, yPosition + 2, { align: 'right' });

    yPosition += 15;
  }

  yPosition += 10;

  // Totals Section
  const totalsStartX = pageWidth - 100;
  
  // Subtotal
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', totalsStartX, yPosition);
  doc.text(`$${invoice.subtotal.toFixed(2)} AUD`, pageWidth - 25, yPosition, { align: 'right' });
  yPosition += 8;

  // GST
  doc.text('GST (10%):', totalsStartX, yPosition);
  doc.text(`$${invoice.gstAmount.toFixed(2)} AUD`, pageWidth - 25, yPosition, { align: 'right' });
  yPosition += 12;

  // Total - highlighted
  doc.setFillColor(COLORS.deepNavy);
  doc.rect(totalsStartX - 5, yPosition - 6, 85, 15, 'F');
  
  doc.setTextColor('#FFFFFF');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TOTAL:', totalsStartX, yPosition + 2);
  doc.text(`$${invoice.totalAmount.toFixed(2)} AUD`, pageWidth - 25, yPosition + 2, { align: 'right' });

  yPosition += 25;

  // Notes Section
  if (invoice.notes) {
    doc.setTextColor(COLORS.black);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('NOTES:', 20, yPosition);
    yPosition += 8;
    
    doc.setFont('helvetica', 'normal');
    yPosition = addWrappedText(invoice.notes, 20, yPosition, pageWidth - 40, 9);
  }

  // Footer
  if (yPosition > pageHeight - 40) {
    doc.addPage();
    yPosition = 20;
  }

  // Footer line
  doc.setDrawColor(COLORS.deepNavy);
  doc.setLineWidth(0.5);
  doc.line(20, pageHeight - 30, pageWidth - 20, pageHeight - 30);

  doc.setFontSize(8);
  doc.setTextColor(COLORS.darkGray);
  doc.text('Thank you for choosing NeedCareAI+ for your workforce management needs.', 20, pageHeight - 22);
  doc.text(`Generated on ${format(new Date(), 'MMMM d, yyyy')} | Page 1 of 1`, pageWidth - 20, pageHeight - 22, { align: 'right' });

  // Download the PDF
  const filename = `Invoice-${invoice.invoiceNumber}-${format(invoice.invoiceDate, 'yyyy-MM-dd')}.pdf`;
  doc.save(filename);
}