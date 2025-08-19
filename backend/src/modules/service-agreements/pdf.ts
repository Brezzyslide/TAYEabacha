import { format } from 'date-fns';
import { db } from '../../../../server/db';
import { companies, clients } from '../../../../shared/schema';
import { eq } from 'drizzle-orm';
import { serviceAgreementService } from './service';
import { getLineItemTotal, itemToRateSet, formatCurrency } from '../../../../shared/utils/calc';

export class ServiceAgreementPDFService {
  /**
   * Generate PDF for a service agreement
   */
  async renderAgreementPdf(agreementId: string, companyId: string): Promise<Buffer> {
    // Dynamic import for ES module compatibility
    const jsPDF = (await import('jspdf')).default;
    
    // Fetch agreement data with items and signatures
    const agreement = await serviceAgreementService.getAgreementById(agreementId, companyId);
    if (!agreement) {
      throw new Error('Service agreement not found');
    }

    // Fetch company/tenant details
    const [tenantData] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!tenantData) {
      throw new Error('Company details not found');
    }

    // Fetch client details
    const [clientData] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, agreement.clientId))
      .limit(1);

    if (!clientData) {
      throw new Error('Client details not found');
    }

    // Initialize PDF document
    const doc = new jsPDF('portrait', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Add header
    this.addAgreementHeader(doc, tenantData.name, 'NDIS SERVICE AGREEMENT', pageWidth);

    let yPosition = 35;

    // Agreement Summary Section
    yPosition = this.addAgreementSummary(doc, agreement, clientData, tenantData, yPosition);

    // Service Items Section
    yPosition = this.addServiceItems(doc, agreement.items || [], yPosition, pageWidth);

    // Grand Total Section
    yPosition = this.addGrandTotal(doc, agreement.items || [], yPosition);

    // Terms & Conditions Section
    yPosition = this.addTermsAndConditions(doc, agreement, tenantData, yPosition, pageWidth, pageHeight);

    // Signatures Section
    yPosition = this.addSignatures(doc, agreement.signatures || [], yPosition, pageWidth, pageHeight);

    // Add footer
    this.addAgreementFooter(doc, pageWidth, pageHeight);

    // Return PDF buffer
    return Buffer.from(doc.output('arraybuffer'));
  }

  /**
   * Add header to the PDF
   */
  private addAgreementHeader(doc: any, companyName: string, title: string, pageWidth: number): void {
    // TUSK Deep Navy header background
    doc.setFillColor(43, 75, 115);
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

  /**
   * Add agreement summary section
   */
  private addAgreementSummary(doc: any, agreement: any, clientData: any, tenantData: any, yPosition: number): number {
    // Agreement Information Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Service Agreement Details', 20, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    // Agreement details in two columns
    const leftColumn = [
      `Agreement ID: ${agreement.id}`,
      `Client: ${clientData.firstName} ${clientData.lastName}`,
      `NDIS Number: ${clientData.ndisNumber || 'Not specified'}`,
      `Start Date: ${agreement.startDate ? format(new Date(agreement.startDate), 'dd/MM/yyyy') : 'Not specified'}`
    ];

    const rightColumn = [
      `Status: ${(agreement.status || 'draft').toUpperCase()}`,
      `Provider: ${tenantData.name}`,
      `ABN: ${tenantData.registrationNumber || 'Not specified'}`,
      `End Date: ${agreement.endDate ? format(new Date(agreement.endDate), 'dd/MM/yyyy') : 'Not specified'}`
    ];

    // Left column
    leftColumn.forEach((line, index) => {
      doc.text(line, 20, yPosition + (index * 6));
    });

    // Right column
    rightColumn.forEach((line, index) => {
      doc.text(line, 110, yPosition + (index * 6));
    });

    yPosition += 35;

    // Contact Information
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Provider Contact Information', 20, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Address: ${tenantData.businessAddress || 'Not specified'}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Contact: ${tenantData.primaryContactName || 'Not specified'}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Email: ${tenantData.primaryContactEmail || 'Not specified'}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Phone: ${tenantData.primaryContactPhone || 'Not specified'}`, 20, yPosition);
    yPosition += 15;

    return yPosition;
  }

  /**
   * Add service items section with calculations
   */
  private addServiceItems(doc: any, items: any[], yPosition: number, pageWidth: number): number {
    if (!items || items.length === 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('No service items added to this agreement.', 20, yPosition);
      return yPosition + 15;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Service Items', 20, yPosition);
    yPosition += 10;

    // Table headers
    const headers = ['Description', 'NDIS Code', 'Hours/Week', 'Rate/Hour', 'Weeks', 'Total'];
    const tableX = 20;
    const tableWidth = pageWidth - 40;
    const colWidth = tableWidth / headers.length;

    // Header row
    doc.setFillColor(240, 240, 240);
    doc.rect(tableX, yPosition - 6, tableWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);

    headers.forEach((header, index) => {
      doc.text(header, tableX + (index * colWidth) + 2, yPosition);
    });

    yPosition += 8;

    // Item rows
    doc.setFont('helvetica', 'normal');
    items.forEach((item, index) => {
      // Calculate total for this item using precise decimal math
      const rateSet = itemToRateSet(item);
      const itemTotal = formatCurrency(getLineItemTotal(rateSet));
      
      const rowData = [
        item.description || 'Service',
        item.ndisCode || 'N/A',
        (parseFloat(item.hoursDay || '0') + parseFloat(item.hoursEvening || '0') + 
         parseFloat(item.hoursActiveNight || '0') + parseFloat(item.hoursSleepover || '0') +
         parseFloat(item.hoursSaturday || '0') + parseFloat(item.hoursSunday || '0') + 
         parseFloat(item.hoursPublicHoliday || '0')).toFixed(1),
        `$${(parseFloat(item.unitDay || '0')).toFixed(2)}`,
        (item.weeks || 1).toString(),
        itemTotal
      ];

      // Alternate row background
      if (index % 2 === 1) {
        doc.setFillColor(250, 250, 250);
        doc.rect(tableX, yPosition - 6, tableWidth, 8, 'F');
      }

      rowData.forEach((cell, colIndex) => {
        const cellX = tableX + (colIndex * colWidth) + 2;
        doc.text(cell.toString(), cellX, yPosition);
      });

      yPosition += 8;
    });

    // Table border
    doc.setDrawColor(0, 0, 0);
    doc.rect(tableX, yPosition - (items.length + 1) * 8 - 6, tableWidth, (items.length + 1) * 8);

    return yPosition + 10;
  }

  /**
   * Add grand total section
   */
  private addGrandTotal(doc: any, items: any[], yPosition: number): number {
    // Calculate grand total using precise decimal math
    let grandTotal = getLineItemTotal({ 
      hoursDay: "0", hoursEvening: "0", hoursActiveNight: "0", hoursSleepover: "0",
      hoursSaturday: "0", hoursSunday: "0", hoursPublicHoliday: "0",
      unitDay: "0", unitEvening: "0", unitActiveNight: "0", unitSleepover: "0",
      unitSaturday: "0", unitSunday: "0", unitPublicHoliday: "0", weeks: 0
    });
    
    items.forEach(item => {
      const rateSet = itemToRateSet(item);
      grandTotal = grandTotal.plus(getLineItemTotal(rateSet));
    });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL AGREEMENT VALUE: ${formatCurrency(grandTotal)}`, 20, yPosition);
    yPosition += 15;

    return yPosition;
  }

  /**
   * Add terms and conditions section
   */
  private addTermsAndConditions(doc: any, agreement: any, tenantData: any, yPosition: number, pageWidth: number, pageHeight: number): number {
    // Check if we need a new page
    if (yPosition > pageHeight - 80) {
      doc.addPage();
      this.addAgreementHeader(doc, tenantData.name, 'NDIS SERVICE AGREEMENT', pageWidth);
      yPosition = 35;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Terms & Conditions', 20, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    // Standard NDIS terms
    const standardTerms = [
      '1. This agreement is governed by the NDIS Practice Standards and Quality and Safeguards Commission requirements.',
      '2. Services will be delivered in accordance with the participant\'s NDIS plan and goals.',
      '3. All support workers are appropriately qualified and undergo regular training updates.',
      '4. The participant has the right to choose their support workers and request changes if needed.',
      '5. Privacy and confidentiality will be maintained in accordance with Australian Privacy Principles.',
      '6. Incidents will be reported in accordance with NDIS incident management requirements.',
      '7. Feedback and complaints processes are available and will be communicated to participants.',
      '8. This agreement may be reviewed and updated as required to meet changing needs.'
    ];

    standardTerms.forEach((term) => {
      const lines = doc.splitTextToSize(term, pageWidth - 40);
      doc.text(lines, 20, yPosition);
      yPosition += lines.length * 4 + 2;

      // Check if we need a new page
      if (yPosition > pageHeight - 40) {
        doc.addPage();
        this.addAgreementHeader(doc, tenantData.name, 'NDIS SERVICE AGREEMENT', pageWidth);
        yPosition = 35;
      }
    });

    // Custom terms from agreement
    if (agreement.termsAndConditions) {
      yPosition += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('Additional Terms:', 20, yPosition);
      yPosition += 8;
      
      doc.setFont('helvetica', 'normal');
      const customTermsLines = doc.splitTextToSize(agreement.termsAndConditions, pageWidth - 40);
      doc.text(customTermsLines, 20, yPosition);
      yPosition += customTermsLines.length * 4 + 10;
    }

    return yPosition;
  }

  /**
   * Add signatures section
   */
  private addSignatures(doc: any, signatures: any[], yPosition: number, pageWidth: number, pageHeight: number): number {
    // Check if we need a new page for signatures
    if (yPosition > pageHeight - 60) {
      doc.addPage();
      yPosition = 35;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Signatures', 20, yPosition);
    yPosition += 15;

    // Signature boxes
    const signatureBoxes = [
      { label: 'Participant/Guardian Signature', x: 20 },
      { label: 'Service Provider Signature', x: pageWidth / 2 + 10 }
    ];

    signatureBoxes.forEach((box) => {
      // Signature box
      doc.rect(box.x, yPosition, 80, 20);
      
      // Label
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(box.label, box.x, yPosition - 3);
      
      // Date line
      doc.text('Date: ________________', box.x, yPosition + 30);
      
      // Check if we have actual signatures
      const relevantSignature = signatures.find(sig => 
        sig.signerRole?.toLowerCase().includes(box.label.toLowerCase().includes('participant') ? 'participant' : 'provider')
      );
      
      if (relevantSignature) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text(`Signed digitally on ${format(new Date(relevantSignature.signedAt), 'dd/MM/yyyy HH:mm')}`, box.x, yPosition + 15);
        doc.text(`By: ${relevantSignature.signerName}`, box.x, yPosition + 18);
      }
    });

    return yPosition + 40;
  }

  /**
   * Add footer to the PDF
   */
  private addAgreementFooter(doc: any, pageWidth: number, pageHeight: number): void {
    const yPos = pageHeight - 15;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')} - CareConnect NDIS Service Agreement System`, pageWidth / 2, yPos, { align: 'center' });
  }
}

export const serviceAgreementPDFService = new ServiceAgreementPDFService();