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
  private pageHeight: number = 210; // A4 landscape height in mm
  private pageWidth: number = 297; // A4 landscape width in mm
  private margin: number = 20;
  private contentWidth: number;
  private headerHeight: number = 40;
  private footerHeight: number = 15;

  constructor() {
    this.pdf = new jsPDF('l', 'mm', 'a4'); // 'l' for landscape
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
      
      // Remove footer boxes - just add plain text
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
    this.checkPageBreak(25);

    this.pdf.setFontSize(14);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.text(section.title, this.margin, this.currentY);
    this.currentY += 12;

    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');

    if (section.type === 'list' && Array.isArray(section.content)) {
      this.addList(section.content);
    } else if (section.type === 'table' && typeof section.content === 'object') {
      this.addTable(section.content);
    } else {
      this.addText(String(section.content));
    }

    this.currentY += 15; // More spacing between sections
  }

  private addText(text: string): void {
    const lines = this.pdf.splitTextToSize(text, this.contentWidth - 10);
    
    for (const line of lines) {
      this.checkPageBreak(7);
      this.pdf.text(line, this.margin + 5, this.currentY);
      this.currentY += 6;
    }
  }

  private addList(items: string[]): void {
    for (const item of items) {
      this.checkPageBreak(7);
      const itemLines = this.pdf.splitTextToSize(`• ${item}`, this.contentWidth - 15);
      for (const line of itemLines) {
        this.pdf.text(line, this.margin + 5, this.currentY);
        this.currentY += 6;
        this.checkPageBreak(7);
      }
    }
  }

  private addTable(tableData: { [key: string]: any }): void {
    const leftColumnWidth = 80;
    const rightColumnWidth = this.contentWidth - leftColumnWidth - 10;
    
    for (const [key, value] of Object.entries(tableData)) {
      // Calculate required space for this row
      const valueLines = this.pdf.splitTextToSize(String(value), rightColumnWidth);
      const requiredSpace = Math.max(12, valueLines.length * 6 + 8);
      this.checkPageBreak(requiredSpace);
      
      // Add key (bold)
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text(`${key}:`, this.margin + 5, this.currentY);
      
      // Add value (normal, with text wrapping)
      this.pdf.setFont('helvetica', 'normal');
      
      let valueY = this.currentY;
      for (let i = 0; i < valueLines.length; i++) {
        if (i > 0) {
          valueY += 6;
          this.checkPageBreak(7);
        }
        this.pdf.text(valueLines[i], this.margin + leftColumnWidth + 5, valueY);
      }
      
      // Move currentY to the end of this row
      this.currentY = valueY + 10; // Extra spacing between table rows
    }
  }

  private checkPageBreak(requiredSpace: number): void {
    if (this.currentY + requiredSpace > this.pageHeight - this.footerHeight - 15) {
      this.addFooter();
      this.pdf.addPage();
      this.addHeader({
        title: 'Care Support Plan (Continued)',
        contentHtml: '',
        companyName: 'CareConnect',
        staffName: '',
        submissionDate: ''
      });
      this.currentY = this.headerHeight + 15;
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

  // Section 1: About Me
  sections.push({
    title: 'About Me',
    content: [
      plan.aboutMeData?.personalHistory ? `Personal History: ${plan.aboutMeData.personalHistory}` : 'Personal History: Not provided',
      plan.aboutMeData?.interests ? `Interests: ${plan.aboutMeData.interests}` : 'Interests: Not provided',
      plan.aboutMeData?.preferences ? `Preferences: ${plan.aboutMeData.preferences}` : 'Preferences: Not provided',
      plan.aboutMeData?.strengths ? `Strengths: ${plan.aboutMeData.strengths}` : 'Strengths: Not provided',
      plan.aboutMeData?.challenges ? `Challenges: ${plan.aboutMeData.challenges}` : 'Challenges: Not provided'
    ],
    type: 'list'
  });

  // Section 2: Goals & Outcomes
  sections.push({
    title: 'Goals & Outcomes',
    content: [
      plan.goalsData?.ndisGoals ? `NDIS Goals: ${plan.goalsData.ndisGoals}` : 'NDIS Goals: Not provided',
      plan.goalsData?.overallObjective ? `Overall Objective: ${plan.goalsData.overallObjective}` : 'Overall Objective: Not provided'
    ],
    type: 'list'
  });

  // Section 3: Activities of Daily Living Support
  sections.push({
    title: 'Activities of Daily Living Support',
    content: {
      'Personal Care': plan.adlData?.personalCare || 'Not specified',
      'Mobility': plan.adlData?.mobility || 'Not specified',
      'Household Tasks': plan.adlData?.household || 'Not specified',
      'Community Access': plan.adlData?.community || 'Not specified',
      'Safety Considerations': plan.adlData?.safety || 'Not specified',
      'Independence Level': plan.adlData?.independence || 'Not specified'
    },
    type: 'table'
  });

  // Section 5: Communication Support
  sections.push({
    title: 'Communication Support',
    content: {
      'Primary Methods': Array.isArray(plan.communicationData?.primaryMethods) 
        ? plan.communicationData.primaryMethods.join(', ') 
        : plan.communicationData?.primaryMethods || 'Not specified',
      'Comprehension Level': plan.communicationData?.comprehensionLevel || 'Not specified',
      'Expression Abilities': plan.communicationData?.expressionAbilities || 'Not specified',
      'Receptive Strategies': plan.communicationData?.receptiveStrategies || 'Not specified',
      'Expressive Strategies': plan.communicationData?.expressiveStrategies || 'Not specified'
    },
    type: 'table'
  });

  // Section 6: Behaviour Support
  sections.push({
    title: 'Behaviour Support',
    content: {
      'Overall Approach': plan.behaviourData?.overallApproach || 'Not specified',
      'Environmental Factors': plan.behaviourData?.environmentalFactors || 'Not specified',
      'Preventative Strategies': plan.behaviourData?.preventativeStrategies || 'Not specified',
      'De-escalation Techniques': plan.behaviourData?.deEscalationTechniques || 'Not specified',
      'PBS Approach': plan.behaviourData?.positiveBehaviourSupport || 'Not specified'
    },
    type: 'table'
  });

  // Section 4: Structure & Routine
  const scheduleContent: string[] = [];
  if (plan.structureData?.weeklySchedule) {
    try {
      const schedule = typeof plan.structureData.weeklySchedule === 'string' 
        ? JSON.parse(plan.structureData.weeklySchedule) 
        : plan.structureData.weeklySchedule;
      
      Object.entries(schedule).forEach(([day, activities]: [string, any]) => {
        if (Array.isArray(activities) && activities.length > 0) {
          scheduleContent.push(`${day}: ${activities.map((a: any) => `${a.time} - ${a.activity} (${a.category})`).join(', ')}`);
        }
      });
    } catch (error) {
      scheduleContent.push('Schedule data format error');
    }
  }
  
  sections.push({
    title: 'Structure & Routine',
    content: scheduleContent.length > 0 ? scheduleContent : ['No weekly schedule specified'],
    type: 'list'
  });

  // Section 7: Disaster Management
  sections.push({
    title: 'Disaster Management',
    content: {
      'Evacuation Plan': plan.disasterData?.evacuationPlan || 'Not specified',
      'Emergency Contacts': plan.disasterData?.emergencyContacts || 'Not specified',
      'Communication Method': plan.disasterData?.communicationMethod || 'Not specified',
      'Medical Information': plan.disasterData?.medicalInformation || 'Not specified',
      'Recovery Plan': plan.disasterData?.recoveryPlan || 'Not specified'
    },
    type: 'table'
  });

  // Section 8: Mealtime Management
  sections.push({
    title: 'Mealtime Management',
    content: {
      'Choking Risk Management': plan.mealtimeData?.chokingRisk || 'Not specified',
      'Aspiration Risk Management': plan.mealtimeData?.aspirationRisk || 'Not specified',
      'Swallowing Assessment': plan.mealtimeData?.swallowingRisk || 'Not specified',
      'Dietary Requirements': plan.mealtimeData?.dietaryRisk || 'Not specified',
      'Assistance Level': plan.mealtimeData?.assistanceRisk || 'Not specified',
      'Environmental Setup': plan.mealtimeData?.environmentalRisk || 'Not specified'
    },
    type: 'table'
  });

  // Section 9: Review & Summary
  sections.push({
    title: 'Review & Summary',
    content: [
      `Plan Created: ${plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : 'Unknown'}`,
      `Plan Status: ${plan.status || 'Draft'}`,
      `Last Updated: ${plan.updatedAt ? new Date(plan.updatedAt).toLocaleDateString() : 'Unknown'}`,
      `Total Sections: 9`,
      `Completion Status: ${plan.status === 'completed' ? 'All sections completed' : 'In progress'}`
    ],
    type: 'list'
  });

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