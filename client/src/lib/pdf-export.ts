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
  type?: 'text' | 'list' | 'table' | 'html' | 'behaviour_support';
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
  private headerAdded: boolean = false;

  constructor() {
    this.pdf = new jsPDF('l', 'mm', 'a4'); // 'l' for landscape
    this.contentWidth = this.pageWidth - (this.margin * 2);
  }

  async generateStructuredPDF(options: PDFExportOptions, sections: PDFSection[]): Promise<void> {
    // Add header only on first page
    this.addHeaderFirstPageOnly(options);
    this.currentY = this.headerHeight + 10;

    this.pdf.setFontSize(18);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(options.title, this.margin, this.currentY);
    this.currentY += 15;

    for (const section of sections) {
      this.addSection(section);
    }

    // Add footers to all pages
    this.addFooterAllPages(options);
    this.savePDF(options.filename || `${options.title.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
  }

  private addHeaderFirstPageOnly(options: PDFExportOptions): void {
    // Ensure we're on the first page
    this.pdf.setPage(1);
    
    // Professional gradient-style header background
    this.pdf.setFillColor(37, 99, 235); // Professional blue
    this.pdf.rect(this.margin, 10, this.contentWidth, this.headerHeight, 'F');
    
    // Add subtle accent bar at bottom of header
    this.pdf.setFillColor(59, 130, 246); // Lighter blue accent
    this.pdf.rect(this.margin, 10 + this.headerHeight - 5, this.contentWidth, 5, 'F');

    // Company name with white text - CENTERED
    this.pdf.setFontSize(18);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(255, 255, 255);
    const companyNameWidth = this.pdf.getTextWidth(options.companyName);
    const companyNameX = (this.pageWidth - companyNameWidth) / 2;
    this.pdf.text(options.companyName, companyNameX, 23);
    
    // Document title - CENTERED
    this.pdf.setFontSize(11);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(219, 234, 254); // Light blue text
    const titleWidth = this.pdf.getTextWidth(options.title);
    const titleX = (this.pageWidth - titleWidth) / 2;
    this.pdf.text(options.title, titleX, 31);
    
    // Staff and dates with lighter text
    this.pdf.setFontSize(9);
    this.pdf.setTextColor(191, 219, 254); // Very light blue
    this.pdf.text(`Staff: ${options.staffName}`, this.margin + 8, 38);
    this.pdf.text(`Submission Date: ${options.submissionDate}`, this.margin + 8, 43);

    const now = new Date();
    const exportTime = now.toLocaleString('en-AU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    this.pdf.text(`Exported: ${exportTime}`, this.pageWidth - this.margin - 55, 38);
    
    this.headerAdded = true;
  }

  private addFooterAllPages(options: PDFExportOptions): void {
    const pageCount = this.pdf.getNumberOfPages();
    
    for (let i = 1; i <= pageCount; i++) {
      this.pdf.setPage(i);
      
      const footerY = this.pageHeight - this.footerHeight;
      
      this.pdf.setFontSize(8);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(100, 100, 100);
      
      const now = new Date();
      const timestamp = now.toISOString().split('T')[0] + ' ' + 
                       now.toTimeString().split(' ')[0].substring(0, 5);
      
      // Footer with company name on each page
      this.pdf.text(`${options.companyName} | Generated: ${timestamp}`, this.margin + 5, footerY + 8);
      this.pdf.text(`Page ${i} of ${pageCount}`, this.pageWidth - this.margin - 20, footerY + 8);
    }
  }

  private addSection(section: PDFSection): void {
    this.checkPageBreak(25);

    // Professional section header with background
    this.pdf.setFillColor(37, 99, 235); // Professional blue
    this.pdf.rect(this.margin, this.currentY - 4, this.contentWidth, 16, 'F');
    
    this.pdf.setFontSize(14);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(255, 255, 255); // White text on blue background
    this.pdf.text(section.title, this.margin + 5, this.currentY + 6);
    this.currentY += 18;

    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(0, 0, 0); // Reset to black text

    if (section.type === 'list' && Array.isArray(section.content)) {
      this.addList(section.content);
    } else if (section.type === 'table' && typeof section.content === 'object') {
      this.addTable(section.content);
    } else if (section.type === 'behaviour_support' && typeof section.content === 'object') {
      this.addBehaviourSupport(section.content);
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
      this.pdf.addPage();
      this.currentY = this.margin + 15; // No header on additional pages
    }
  }

  private addBehaviourSupport(behaviourData: any): void {
    // Add general behavior information first
    if (behaviourData.overallApproach) {
      this.addText(`Overall Approach: ${behaviourData.overallApproach}`);
      this.currentY += 5;
    }
    
    if (behaviourData.environmentalFactors) {
      this.addText(`Environmental Factors: ${behaviourData.environmentalFactors}`);
      this.currentY += 5;
    }
    
    // Add saved behaviors with colored strategy boxes
    if (behaviourData.savedBehaviours && Array.isArray(behaviourData.savedBehaviours)) {
      for (const behavior of behaviourData.savedBehaviours) {
        this.checkPageBreak(15);
        
        // Add behavior name and description
        this.pdf.setFontSize(12);
        this.pdf.setFont('helvetica', 'bold');
        this.pdf.text(`Behavior: ${behavior.name || 'Unnamed'}`, this.margin + 5, this.currentY);
        this.currentY += 8;
        
        if (behavior.description) {
          this.pdf.setFontSize(10);
          this.pdf.setFont('helvetica', 'normal');
          this.addText(`Description: ${behavior.description}`);
          this.currentY += 5;
        }
        
        if (behavior.triggers) {
          this.addText(`Triggers: ${behavior.triggers}`);
          this.currentY += 5;
        }
        
        // Add colored strategy boxes with enhanced visual separation
        if (behavior.proactiveStrategies) {
          this.addColoredStrategyBox('🟢 PROACTIVE STRATEGIES - Prevention & Early Intervention', behavior.proactiveStrategies, 'proactive');
        }
        
        if (behavior.reactiveStrategies) {
          this.addColoredStrategyBox('🔴 REACTIVE STRATEGIES - Immediate Response During Behavior', behavior.reactiveStrategies, 'reactive');
        }
        
        if (behavior.protectiveStrategies) {
          this.addColoredStrategyBox('🔵 PROTECTIVE STRATEGIES - Post-Behavior Safety & Recovery', behavior.protectiveStrategies, 'protective');
        }
        
        this.currentY += 10; // Extra spacing between behaviors
      }
    }
    
    // Add global strategies
    if (behaviourData.deEscalationTechniques) {
      this.addColoredStrategyBox('De-escalation Techniques', behaviourData.deEscalationTechniques, 'reactive');
    }
    
    if (behaviourData.positiveBehaviourSupport) {
      this.addColoredStrategyBox('PBS Approach', behaviourData.positiveBehaviourSupport, 'proactive');
    }
  }

  private addColoredStrategyBox(title: string, content: string, color: 'proactive' | 'reactive' | 'protective'): void {
    const contentLines = this.pdf.splitTextToSize(content, this.contentWidth - 25);
    const requiredSpace = 25 + (contentLines.length * 5);
    this.checkPageBreak(requiredSpace);
    
    // Enhanced colors with better contrast and professional appearance
    let fillColor: [number, number, number] = [245, 245, 245];
    let borderColor: [number, number, number] = [200, 200, 200];
    let titleBgColor: [number, number, number] = [100, 100, 100];
    let titleTextColor: [number, number, number] = [255, 255, 255];
    
    switch (color) {
      case 'proactive':
        fillColor = [240, 253, 244]; // Very light green background
        borderColor = [34, 197, 94]; // Green border
        titleBgColor = [22, 163, 74]; // Dark green title background
        titleTextColor = [255, 255, 255]; // White title text
        break;
      case 'reactive':
        fillColor = [255, 241, 242]; // Very light red background
        borderColor = [239, 68, 68]; // Red border
        titleBgColor = [220, 38, 38]; // Dark red title background
        titleTextColor = [255, 255, 255]; // White title text
        break;
      case 'protective':
        fillColor = [240, 249, 255]; // Very light blue background
        borderColor = [59, 130, 246]; // Blue border
        titleBgColor = [37, 99, 235]; // Dark blue title background
        titleTextColor = [255, 255, 255]; // White title text
        break;
    }
    
    const boxHeight = 18 + (contentLines.length * 5);
    
    // Draw main colored background box
    this.pdf.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
    this.pdf.rect(this.margin + 5, this.currentY - 2, this.contentWidth - 10, boxHeight, 'F');
    
    // Draw colored border
    this.pdf.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    this.pdf.setLineWidth(0.8);
    this.pdf.rect(this.margin + 5, this.currentY - 2, this.contentWidth - 10, boxHeight, 'S');
    
    // Draw title background bar
    this.pdf.setFillColor(titleBgColor[0], titleBgColor[1], titleBgColor[2]);
    this.pdf.rect(this.margin + 5, this.currentY - 2, this.contentWidth - 10, 12, 'F');
    
    // Add title with white text
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(titleTextColor[0], titleTextColor[1], titleTextColor[2]);
    this.pdf.text(title, this.margin + 10, this.currentY + 6);
    this.currentY += 15;
    
    // Add content with better formatting
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(60, 60, 60); // Dark gray for better readability
    
    for (const line of contentLines) {
      this.checkPageBreak(6);
      this.pdf.text(line, this.margin + 10, this.currentY);
      this.currentY += 5;
    }
    
    this.currentY += 8; // Extra spacing after box
    
    // Reset drawing properties
    this.pdf.setDrawColor(0, 0, 0);
    this.pdf.setLineWidth(0.2);
    this.pdf.setTextColor(0, 0, 0);
  }

  private savePDF(filename: string): void {
    this.pdf.save(filename);
  }
}

export async function exportCarePlanToPDF(plan: any, client: any, user: any): Promise<void> {
  // Always fetch fresh company name from API to ensure we have the latest data
  let companyName = 'CareConnect'; // Default fallback
  
  try {
    const response = await fetch('/api/user');
    if (response.ok) {
      const userData = await response.json();
      if (userData?.companyName) {
        companyName = userData.companyName;
      }
    } else {
      console.warn('API user endpoint returned:', response.status);
    }
  } catch (error) {
    console.warn('Could not fetch company name, using default:', error);
  }

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

  // Section 6: Behaviour Support - Custom handling with colored boxes
  sections.push({
    title: 'Behaviour Support',
    content: plan.behaviourData || {},
    type: 'behaviour_support'
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
    companyName: companyName,
    staffName: user?.username || 'Unknown Staff',
    submissionDate: plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : new Date().toLocaleDateString(),
    filename: `care-plan-${plan.planTitle?.replace(/[^a-zA-Z0-9]/g, '-') || 'untitled'}.pdf`
  };

  const pdfUtil = new PDFExportUtility();
  await pdfUtil.generateStructuredPDF(options, sections);
}