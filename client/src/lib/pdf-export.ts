import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface PDFExportOptions {
  title: string;
  contentHtml: string;
  companyName: string;
  staffName: string;
  submissionDate: string;
  filename?: string;
}

export interface PDFSection {
  title: string;
  content: string | { [key: string]: any };
  type?: 'text' | 'list' | 'table' | 'html';
}

export class PDFExportUtility {
  private pdf: jsPDF;
  private currentY: number = 0;
  private pageHeight: number = 297; // A4 height in mm
  private pageWidth: number = 210; // A4 width in mm
  private margin: number = 20;
  private contentWidth: number;
  private headerHeight: number = 40;
  private footerHeight: number = 15;

  constructor() {
    this.pdf = new jsPDF('p', 'mm', 'a4');
    this.contentWidth = this.pageWidth - (this.margin * 2);
  }

  async generateStructuredPDF(options: PDFExportOptions, sections: PDFSection[]): Promise<void> {
    this.addHeader(options);
    this.currentY = this.headerHeight + 10;

    this.pdf.setFontSize(18);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(options.title, this.margin, this.currentY);
    this.currentY += 15;

    for (const section of sections) {
      this.addSection(section);
    }

    this.addFooter();
    this.savePDF(options.filename || `${options.title.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
  }

  private addHeader(options: PDFExportOptions): void {
    this.pdf.setFillColor(245, 245, 245);
    this.pdf.rect(this.margin, 10, this.contentWidth, this.headerHeight, 'F');
    this.pdf.setDrawColor(200, 200, 200);
    this.pdf.rect(this.margin, 10, this.contentWidth, this.headerHeight, 'S');

    this.pdf.setFontSize(14);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.text(options.companyName, this.margin + 5, 20);

    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.text(`Staff: ${options.staffName}`, this.margin + 5, 28);
    this.pdf.text(`Submission Date: ${options.submissionDate}`, this.margin + 5, 35);

    const now = new Date();
    const exportTime = now.toLocaleString('en-AU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    this.pdf.text(`Exported: ${exportTime}`, this.pageWidth - this.margin - 40, 28);
  }

  private addFooter(): void {
    const pageCount = this.pdf.getNumberOfPages();
    
    for (let i = 1; i <= pageCount; i++) {
      this.pdf.setPage(i);
      
      const footerY = this.pageHeight - this.footerHeight;
      this.pdf.setFillColor(245, 245, 245);
      this.pdf.rect(this.margin, footerY, this.contentWidth, this.footerHeight, 'F');
      this.pdf.setDrawColor(200, 200, 200);
      this.pdf.rect(this.margin, footerY, this.contentWidth, this.footerHeight, 'S');

      this.pdf.setFontSize(8);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(100, 100, 100);
      
      const now = new Date();
      const timestamp = now.toISOString().split('T')[0] + ' ' + 
                       now.toTimeString().split(' ')[0].substring(0, 5);
      
      this.pdf.text(`Generated: ${timestamp}`, this.margin + 5, footerY + 8);
      this.pdf.text(`Page ${i} of ${pageCount}`, this.pageWidth - this.margin - 20, footerY + 8);
    }
  }

  private addSection(section: PDFSection): void {
    this.checkPageBreak(20);

    this.pdf.setFontSize(14);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.text(section.title, this.margin, this.currentY);
    this.currentY += 8;

    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');

    if (section.type === 'list' && Array.isArray(section.content)) {
      this.addList(section.content);
    } else if (section.type === 'table' && typeof section.content === 'object') {
      this.addTable(section.content);
    } else {
      this.addText(String(section.content));
    }

    this.currentY += 8;
  }

  private addText(text: string): void {
    const lines = this.pdf.splitTextToSize(text, this.contentWidth - 10);
    
    for (const line of lines) {
      this.checkPageBreak(6);
      this.pdf.text(line, this.margin + 5, this.currentY);
      this.currentY += 5;
    }
  }

  private addList(items: string[]): void {
    for (const item of items) {
      this.checkPageBreak(6);
      this.pdf.text(`• ${item}`, this.margin + 5, this.currentY);
      this.currentY += 5;
    }
  }

  private addTable(tableData: { [key: string]: any }): void {
    for (const [key, value] of Object.entries(tableData)) {
      this.checkPageBreak(6);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text(`${key}:`, this.margin + 5, this.currentY);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.text(String(value), this.margin + 50, this.currentY);
      this.currentY += 5;
    }
  }

  private checkPageBreak(requiredSpace: number): void {
    if (this.currentY + requiredSpace > this.pageHeight - this.footerHeight - 10) {
      this.pdf.addPage();
      this.addHeader({
        title: '',
        contentHtml: '',
        companyName: 'CareConnect',
        staffName: '',
        submissionDate: ''
      });
      this.currentY = this.headerHeight + 10;
    }
  }

  private savePDF(filename: string): void {
    this.pdf.save(filename);
  }
}

export async function exportCarePlanToPDF(plan: any, client: any, user: any): Promise<void> {
  const sections: PDFSection[] = [];

  sections.push({
    title: 'Client Information',
    content: {
      'Full Name': client ? `${client.firstName} ${client.lastName}` : 'Unknown',
      'Client ID': client?.clientId || 'Unknown',
      'NDIS Number': client?.ndisNumber || 'Not provided',
      'Date of Birth': client?.dateOfBirth ? new Date(client.dateOfBirth).toLocaleDateString() : 'Unknown',
      'Primary Diagnosis': client?.primaryDiagnosis || 'Not specified',
      'Plan Title': plan.planTitle || 'Untitled Plan',
      'Plan Status': plan.status || 'Draft'
    },
    type: 'table'
  });

  if (plan.aboutMeData && (plan.aboutMeData.personalHistory || plan.aboutMeData.interests)) {
    sections.push({
      title: 'About Me',
      content: [
        plan.aboutMeData.personalHistory && `Personal History: ${plan.aboutMeData.personalHistory}`,
        plan.aboutMeData.interests && `Interests: ${plan.aboutMeData.interests}`,
        plan.aboutMeData.preferences && `Preferences: ${plan.aboutMeData.preferences}`,
        plan.aboutMeData.strengths && `Strengths: ${plan.aboutMeData.strengths}`,
        plan.aboutMeData.challenges && `Challenges: ${plan.aboutMeData.challenges}`
      ].filter(Boolean),
      type: 'list'
    });
  }

  if (plan.goalsData && plan.goalsData.ndisGoals) {
    sections.push({
      title: 'Goals & Outcomes',
      content: [
        `NDIS Goals: ${plan.goalsData.ndisGoals}`,
        plan.goalsData.overallObjective && `Overall Objective: ${plan.goalsData.overallObjective}`
      ].filter(Boolean),
      type: 'list'
    });
  }

  if (plan.adlData && plan.adlData.personalCare) {
    sections.push({
      title: 'Activities of Daily Living Support',
      content: {
        'Personal Care': plan.adlData.personalCare || 'Not specified',
        'Mobility': plan.adlData.mobility || 'Not specified',
        'Household Tasks': plan.adlData.household || 'Not specified',
        'Community Access': plan.adlData.community || 'Not specified',
        'Safety Considerations': plan.adlData.safety || 'Not specified',
        'Independence Level': plan.adlData.independence || 'Not specified'
      },
      type: 'table'
    });
  }

  if (plan.communicationData && plan.communicationData.primaryMethods) {
    sections.push({
      title: 'Communication Support',
      content: {
        'Primary Methods': Array.isArray(plan.communicationData.primaryMethods) 
          ? plan.communicationData.primaryMethods.join(', ') 
          : plan.communicationData.primaryMethods || 'Not specified',
        'Comprehension Level': plan.communicationData.comprehensionLevel || 'Not specified',
        'Expression Abilities': plan.communicationData.expressionAbilities || 'Not specified',
        'Receptive Strategies': plan.communicationData.receptiveStrategies || 'Not specified',
        'Expressive Strategies': plan.communicationData.expressiveStrategies || 'Not specified'
      },
      type: 'table'
    });
  }

  if (plan.behaviourData && plan.behaviourData.overallApproach) {
    sections.push({
      title: 'Behaviour Support',
      content: {
        'Overall Approach': plan.behaviourData.overallApproach || 'Not specified',
        'Environmental Factors': plan.behaviourData.environmentalFactors || 'Not specified',
        'Preventative Strategies': plan.behaviourData.preventativeStrategies || 'Not specified',
        'De-escalation Techniques': plan.behaviourData.deEscalationTechniques || 'Not specified',
        'PBS Approach': plan.behaviourData.positiveBehaviourSupport || 'Not specified'
      },
      type: 'table'
    });
  }

  const options: PDFExportOptions = {
    title: 'NDIS Care Support Plan',
    contentHtml: '',
    companyName: 'CareConnect',
    staffName: user?.username || 'Unknown Staff',
    submissionDate: plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : new Date().toLocaleDateString(),
    filename: `care-plan-${plan.planTitle?.replace(/[^a-zA-Z0-9]/g, '-') || 'untitled'}.pdf`
  };

  const pdfUtil = new PDFExportUtility();
  await pdfUtil.generateStructuredPDF(options, sections);
}