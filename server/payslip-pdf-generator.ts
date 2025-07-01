import { storage } from "./storage";
import { format } from "date-fns";

export async function generatePayslipPDF(timesheet: any, tenantId: number): Promise<Buffer> {
  try {
    // Dynamic import for jsPDF to avoid ESM issues
    const { jsPDF } = await import('jspdf');
    
    // Get company information for branding
    const companyName = await getCompanyName(tenantId);
    
    // Create new PDF document
    const doc = new jsPDF();
    
    // Set up colors (TUSK design palette)
    const primaryBlue = [43, 75, 115] as [number, number, number]; // Deep Navy #2B4B73
    const goldAccent = [184, 148, 77] as [number, number, number]; // Warm Gold #B8944D
    
    // Header with company branding
    doc.setFillColor(...primaryBlue);
    doc.rect(0, 0, 210, 35, 'F');
    
    // Company name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, 105, 15, { align: 'center' });
    
    // Payslip title
    doc.setFontSize(14);
    doc.text('PAYSLIP', 105, 25, { align: 'center' });
    
    // Reset text color
    doc.setTextColor(0, 0, 0);
    
    // Employee and pay period information
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Employee Information', 20, 50);
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${timesheet.staffName}`, 20, 60);
    doc.text(`Employee ID: ${timesheet.staffId}`, 20, 68);
    doc.text(`Pay Period: ${format(new Date(timesheet.payPeriodStart), 'dd/MM/yyyy')} - ${format(new Date(timesheet.payPeriodEnd), 'dd/MM/yyyy')}`, 20, 76);
    doc.text(`Pay Date: ${format(new Date(), 'dd/MM/yyyy')}`, 20, 84);
    
    // Earnings section
    doc.setFont('helvetica', 'bold');
    doc.text('Earnings', 20, 100);
    
    // Draw table headers
    doc.setFillColor(...goldAccent);
    doc.rect(20, 105, 170, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text('Description', 25, 110);
    doc.text('Hours', 80, 110);
    doc.text('Rate', 110, 110);
    doc.text('Amount', 150, 110);
    
    // Reset text color and add earnings data
    doc.setTextColor(0, 0, 0);
    let yPos = 120;
    
    doc.text('Regular Hours', 25, yPos);
    doc.text(`${timesheet.totalHours || 0}`, 80, yPos);
    doc.text(`$${(timesheet.hourlyRate || 0).toFixed(2)}`, 110, yPos);
    doc.text(`$${(timesheet.totalEarnings || 0).toFixed(2)}`, 150, yPos);
    
    yPos += 8;
    doc.text('Superannuation (11%)', 25, yPos);
    doc.text('-', 80, yPos);
    doc.text('-', 110, yPos);
    doc.text(`$${(timesheet.superContribution || 0).toFixed(2)}`, 150, yPos);
    
    // Deductions section
    yPos += 20;
    doc.setFont('helvetica', 'bold');
    doc.text('Deductions', 20, yPos);
    
    yPos += 5;
    doc.setFillColor(...goldAccent);
    doc.rect(20, yPos, 170, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('Description', 25, yPos + 5);
    doc.text('Amount', 150, yPos + 5);
    
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    yPos += 15;
    doc.text('Income Tax', 25, yPos);
    doc.text(`$${(timesheet.incomeTax || 0).toFixed(2)}`, 150, yPos);
    
    // Summary section
    yPos += 25;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Summary', 20, yPos);
    
    yPos += 10;
    doc.setFillColor(240, 240, 240);
    doc.rect(20, yPos, 170, 25, 'F');
    
    doc.setFont('helvetica', 'normal');
    doc.text('Gross Pay:', 25, yPos + 8);
    doc.text(`$${(timesheet.totalEarnings || 0).toFixed(2)}`, 150, yPos + 8);
    
    doc.text('Total Deductions:', 25, yPos + 16);
    doc.text(`$${(timesheet.incomeTax || 0).toFixed(2)}`, 150, yPos + 16);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Net Pay:', 25, yPos + 24);
    doc.text(`$${(timesheet.netPay || 0).toFixed(2)}`, 150, yPos + 24);
    
    // Footer
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('This payslip is computer generated and does not require a signature.', 105, 280, { align: 'center' });
    doc.text(`Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 105, 285, { align: 'center' });
    
    // Convert to buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    return pdfBuffer;
    
  } catch (error: any) {
    console.error('PDF Generation Error:', error);
    throw new Error(`Failed to generate payslip PDF: ${error.message}`);
  }
}

async function getCompanyName(tenantId: number): Promise<string> {
  try {
    // Simple company name based on tenant ID
    return `NeedsCareAI+ Company ${tenantId}`;
  } catch (error) {
    console.error('Error getting company name:', error);
    return `NeedsCareAI+ Company ${tenantId}`;
  }
}