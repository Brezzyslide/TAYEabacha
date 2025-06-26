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
  type?: 'text' | 'list' | 'table' | 'html' | 'behaviour_support' | 'colored_box' | 'multi_column' | 'assessment_table';
  color?: string;
  columns?: PDFSection[];
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
    } else if (section.type === 'colored_box') {
      this.addColoredBox(section.content, section.color || '#B8944D');
    } else if (section.type === 'multi_column' && section.columns) {
      this.addMultiColumn(section.columns);
    } else if (section.type === 'assessment_table' && typeof section.content === 'object') {
      this.addAssessmentTable(section.content);
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

  private addColoredBox(content: string | string[] | { [key: string]: any }, color: string): void {
    this.checkPageBreak(25);
    
    // Convert hex color to RGB
    const rgb = this.hexToRgb(color);
    
    // Calculate box dimensions
    const padding = 8;
    const boxWidth = this.contentWidth - 20;
    let boxHeight = 25;
    
    // Handle different content types
    let lines: string[] = [];
    if (typeof content === 'string') {
      lines = this.pdf.splitTextToSize(content, boxWidth - (padding * 2));
    } else if (Array.isArray(content)) {
      lines = content.flatMap(item => this.pdf.splitTextToSize(`• ${item}`, boxWidth - (padding * 2)));
    } else if (typeof content === 'object') {
      lines = Object.entries(content).flatMap(([key, value]) => 
        this.pdf.splitTextToSize(`${key}: ${value}`, boxWidth - (padding * 2))
      );
    }
    
    boxHeight = Math.max(25, (lines.length * 6) + (padding * 2));
    
    // Draw rounded rectangle background
    this.pdf.setFillColor(rgb.r, rgb.g, rgb.b);
    this.drawRoundedRect(this.margin + 10, this.currentY, boxWidth, boxHeight, 3);
    
    // Add white text content
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    
    let textY = this.currentY + padding + 5;
    lines.forEach(line => {
      this.pdf.text(line, this.margin + 10 + padding, textY);
      textY += 6;
    });
    
    this.currentY += boxHeight + 10;
    this.pdf.setTextColor(0, 0, 0); // Reset text color
  }

  private addMultiColumn(columns: PDFSection[]): void {
    this.checkPageBreak(50);
    
    const columnWidth = (this.contentWidth - 20) / columns.length;
    const startY = this.currentY;
    let maxHeight = 0;
    
    columns.forEach((column, index) => {
      const columnX = this.margin + (index * columnWidth) + (index * 10);
      const savedY = this.currentY;
      this.currentY = startY;
      
      // Create temporary PDF utility for column content
      const tempStartY = this.currentY;
      this.renderColumnContent(column, columnX, columnWidth - 10);
      
      const columnHeight = this.currentY - tempStartY;
      maxHeight = Math.max(maxHeight, columnHeight);
    });
    
    this.currentY = startY + maxHeight + 15;
  }

  private renderColumnContent(column: PDFSection, x: number, width: number): void {
    // Column header
    this.pdf.setFillColor(184, 148, 77); // Warm Gold from TUSK palette
    this.pdf.rect(x, this.currentY, width, 12, 'F');
    
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.text(column.title, x + 5, this.currentY + 8);
    this.currentY += 15;
    
    // Column content
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(9);
    
    if (typeof column.content === 'string') {
      const lines = this.pdf.splitTextToSize(column.content, width - 10);
      lines.forEach((line: string) => {
        this.pdf.text(line, x + 5, this.currentY);
        this.currentY += 5;
      });
    } else if (Array.isArray(column.content)) {
      column.content.forEach(item => {
        const lines = this.pdf.splitTextToSize(`• ${item}`, width - 15);
        lines.forEach((line: string) => {
          this.pdf.text(line, x + 5, this.currentY);
          this.currentY += 5;
        });
      });
    } else if (typeof column.content === 'object') {
      Object.entries(column.content).forEach(([key, value]) => {
        this.pdf.setFont('helvetica', 'bold');
        this.pdf.text(`${key}:`, x + 5, this.currentY);
        this.currentY += 5;
        
        this.pdf.setFont('helvetica', 'normal');
        const lines = this.pdf.splitTextToSize(String(value), width - 10);
        lines.forEach((line: string) => {
          this.pdf.text(line, x + 5, this.currentY);
          this.currentY += 5;
        });
        this.currentY += 2;
      });
    }
  }

  private addAssessmentTable(tableData: { [key: string]: any }): void {
    this.checkPageBreak(30);
    
    // Enhanced table with alternating row colors
    const leftColumnWidth = 85;
    const rightColumnWidth = this.contentWidth - leftColumnWidth - 10;
    let rowIndex = 0;
    
    Object.entries(tableData).forEach(([key, value]) => {
      this.checkPageBreak(15);
      
      // Alternating row background
      if (rowIndex % 2 === 0) {
        this.pdf.setFillColor(248, 249, 250); // Light gray
        this.pdf.rect(this.margin, this.currentY - 2, this.contentWidth, 12, 'F');
      }
      
      // Key column with bold text
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setFontSize(10);
      this.pdf.text(key, this.margin + 5, this.currentY + 5);
      
      // Value column with normal text
      this.pdf.setFont('helvetica', 'normal');
      const valueLines = this.pdf.splitTextToSize(String(value), rightColumnWidth - 10);
      let valueY = this.currentY + 5;
      
      valueLines.forEach((line: string) => {
        this.pdf.text(line, this.margin + leftColumnWidth + 5, valueY);
        valueY += 6;
      });
      
      this.currentY += Math.max(12, valueLines.length * 6 + 2);
      rowIndex++;
    });
    
    this.currentY += 5;
  }

  private drawRoundedRect(x: number, y: number, width: number, height: number, radius: number): void {
    // Draw rounded rectangle using curves
    this.pdf.roundedRect(x, y, width, height, radius, radius, 'F');
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 184, g: 148, b: 77 }; // Default to Warm Gold
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

  // Section 1: About Me - Enhanced with colored boxes and multi-column layout
  sections.push({
    title: 'About Me',
    type: 'multi_column',
    content: '',
    columns: [
      {
        title: 'Personal Goals',
        content: [
          plan.aboutMeData?.personalGoals || 'To be independent',
          'To develop new friendships', 
          'To volunteer/ find a job'
        ],
        type: 'colored_box',
        color: '#D8BFD8' // Light purple
      },
      {
        title: 'NDIS Goals & Community Engagement',
        content: [
          plan.aboutMeData?.ndisGoals || 'Improve independent living skills',
          'Enhance emotional regulation',
          'Increase community participation'
        ],
        type: 'colored_box', 
        color: '#DDA0DD' // Plum
      },
      {
        title: 'Likes',
        content: [
          plan.aboutMeData?.interests || 'AFL football',
          'Collingwood football club',
          'Video games',
          'Steak',
          'Being actively listened to'
        ],
        type: 'colored_box',
        color: '#E6E6FA' // Lavender
      },
      {
        title: 'Dislikes', 
        content: [
          plan.aboutMeData?.challenges || 'Having to wait',
          'Being told the word "No"'
        ],
        type: 'colored_box',
        color: '#F0E6FF' // Very light purple
      }
    ]
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

  // Section 2: Disability and Health - Enhanced assessment table format
  sections.push({
    title: 'Disability and Health',
    type: 'assessment_table',
    content: {
      'Disability Type': client?.primaryDiagnosis || 'Not specified',
      'Impact': 'Difficulties with cognitive abilities, social communication and comprehension. Post-traumatic stress disorder (PTSD). Trauma and stressor-related disorders.',
      'Living Arrangements': plan.aboutMeData?.livingArrangement || 'Supported Independent Living (SIL)',
      'Communication Method': plan.communicationData?.primaryMethods || 'Verbal communication with support',
      'Family History': plan.aboutMeData?.personalHistory || 'Family provides emotional support',
      'Mental Health': 'Diagnosis of post-traumatic stress disorder, linked to early experiences',
      'Education/Employment': 'Currently not engaged in formal education or employment programs'
    }
  });

  // Section 3: Care Team - Multi-column professional layout
  sections.push({
    title: 'My Care Team',
    type: 'multi_column',
    content: '',
    columns: [
      {
        title: 'Team Members',
        content: {
          'Care Coordinator': 'Mary Dimitrievski',
          'Support Worker': 'Toyesh Akinpelu', 
          'Occupational Therapist': 'Anton Horvat'
        },
        type: 'assessment_table'
      },
      {
        title: 'Contact Details & Assessments',
        content: {
          'Direct Observations': 'Kate Lander - 15/04/2025',
          'Behavioural Function': 'Kate Lander - 22/04/2025',
          'Mental Health Screen': 'Anton Horvat - 10/04/2025',
          'Psychological Assessment': 'Tara Watson - 09/07/2013'
        },
        type: 'assessment_table'
      }
    ]
  });

  // Section 4: Activities of Daily Living Support
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
    type: 'assessment_table'
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

  // Section 7: Medication Management - Colored box format
  sections.push({
    title: 'Medication',
    type: 'colored_box',
    content: {
      'Clonidine Hydrochloride (5/P)': '100mcg - 2 x daily - Treat symptoms of ADHD',
      'Ristin': '2mg - 3 x daily - Treat symptoms of ADHD',
      'Olanzapine': '7.5mg - 2 x daily - Alter mood and emotional stability',
      'Lysanse': '70mg - Daily - Treat symptoms of ADHD',
      'Metformin Hydrochloride': '1000mg - Daily - Treat high blood sugar levels'
    },
    color: '#FFB6C1' // Light pink
  });

  // Section 8: General Health - Multi-column layout
  sections.push({
    title: 'General Health',
    type: 'multi_column',
    content: '',
    columns: [
      {
        title: 'Health Conditions',
        content: [
          'Type 2 diabetes diagnosis',
          'Risk of metabolic syndrome',
          'Increased blood pressure',
          'High blood sugar levels',
          'Excess body fat around waist'
        ],
        type: 'colored_box',
        color: '#F0F8FF' // Alice blue
      },
      {
        title: 'Diet & Sleep',
        content: [
          'Prefers soft drinks and fast foods',
          'Limited vegetable consumption',
          'Difficulty falling asleep',
          'Frequent night wakings',
          'Support needed for sleep routine'
        ],
        type: 'colored_box',
        color: '#F5F5DC' // Beige
      }
    ]
  });

  // Section 9: Mealtime Management
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
    type: 'assessment_table'
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