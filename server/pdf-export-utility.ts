import { format } from 'date-fns';

export class PDFExportUtility {
  
  constructor() {
    // No initialization needed - we'll create docs per method
  }

  async generatePayslipPDF(payslipData: {
    companyName: string;
    staffName: string;
    staffEmail: string;
    employmentType: string;
    payPeriod: string;
    totalHours: string;
    grossPay: string;
    taxWithheld: string;
    superContribution: string;
    netPay: string;
    leaveBalances?: {
      annual: number;
      sick: number;
    } | null;
  }): Promise<Buffer> {
    
    // Dynamic import for ES module compatibility
    const jsPDF = (await import('jspdf')).default;
    const doc = new jsPDF('portrait', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Header with company branding
    this.addPayslipHeader(doc, payslipData.companyName, 'PAYSLIP', pageWidth);
    
    let yPosition = 40;
    
    // Staff Information Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Employee Information', 20, yPosition);
    yPosition += 10;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${payslipData.staffName}`, 20, yPosition);
    doc.text(`Email: ${payslipData.staffEmail}`, 20, yPosition + 6);
    doc.text(`Employment Type: ${payslipData.employmentType}`, 20, yPosition + 12);
    doc.text(`Pay Period: ${payslipData.payPeriod}`, 20, yPosition + 18);
    
    yPosition += 35;
    
    // Earnings Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Earnings & Deductions', 20, yPosition);
    yPosition += 10;
    
    // Create earnings table
    const earnings = [
      ['Description', 'Hours', 'Amount'],
      ['Gross Pay', payslipData.totalHours + 'h', '$' + payslipData.grossPay],
      ['Tax Withheld', '', '-$' + payslipData.taxWithheld],
      ['Superannuation', '', '$' + payslipData.superContribution]
    ];
    
    this.createTable(doc, earnings, 20, yPosition, pageWidth - 40);
    yPosition += (earnings.length * 8) + 15;
    
    // Net Pay
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`NET PAY: $${payslipData.netPay}`, 20, yPosition);
    yPosition += 20;
    
    // Leave Balances (only for eligible staff)
    if (payslipData.leaveBalances) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Leave Balances', 20, yPosition);
      yPosition += 10;
      
      const leaveData = [
        ['Leave Type', 'Balance'],
        ['Annual Leave', payslipData.leaveBalances.annual + ' hours'],
        ['Sick Leave', payslipData.leaveBalances.sick + ' hours']
      ];
      
      this.createTable(doc, leaveData, 20, yPosition, (pageWidth - 40) / 2);
      yPosition += (leaveData.length * 8) + 15;
    } else {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('Leave entitlements: Not applicable (Casual employment)', 20, yPosition);
      yPosition += 15;
    }
    
    // Footer
    this.addPayslipFooter(doc, pageWidth, pageHeight);
    
    return Buffer.from(doc.output('arraybuffer'));
  }

  private addPayslipHeader(doc: any, companyName: string, title: string, pageWidth: number) {
    // Blue gradient header background (TUSK Deep Navy)
    doc.setFillColor(43, 75, 115); // Deep navy
    doc.rect(0, 0, pageWidth, 25, 'F');
    
    // Company name and document title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, pageWidth / 2, 12, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text(title, pageWidth / 2, 20, { align: 'center' });
    
    // Reset text color
    doc.setTextColor(0, 0, 0);
  }

  private addPayslipFooter(doc: any, pageWidth: number, pageHeight: number) {
    const yPos = pageHeight - 15;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')} - NeedsCareAI+ Payroll System`, pageWidth / 2, yPos, { align: 'center' });
  }
  
  private addHeader(doc: any, companyName: string, documentTitle: string, pageWidth: number): void {
    // Blue gradient header background
    doc.setFillColor(43, 75, 115); // Deep navy
    doc.rect(0, 0, pageWidth, 25, 'F');
    
    // Company name and document title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, pageWidth / 2, 12, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text(documentTitle, pageWidth / 2, 20, { align: 'center' });
    
    // Reset text color
    doc.setTextColor(0, 0, 0);
  }
  
  private addFooter(doc: any, pageHeight: number): void {
    const yPos = pageHeight - 15;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')} - NeedsCareAI+ Payroll System`, 105, yPos, { align: 'center' });
  }
  
  private createTable(doc: any, data: string[][], x: number, y: number, width: number): void {
    const cellHeight = 8;
    const colWidth = width / data[0].length;
    
    data.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        const cellX = x + (colIndex * colWidth);
        const cellY = y + (rowIndex * cellHeight);
        
        // Header row styling
        if (rowIndex === 0) {
          doc.setFillColor(240, 240, 240);
          doc.rect(cellX, cellY - 6, colWidth, cellHeight, 'F');
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setFont('helvetica', 'normal');
        }
        
        // Cell border
        doc.rect(cellX, cellY - 6, colWidth, cellHeight);
        
        // Cell text
        doc.text(cell, cellX + 2, cellY - 1);
      });
    });
  }
}