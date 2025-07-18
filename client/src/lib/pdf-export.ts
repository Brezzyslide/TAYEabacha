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
  type?: 'text' | 'list' | 'table' | 'html' | 'behaviour_support' | 'about_me' | 'adl_support' | 'communication_support' | 'structure_routine' | 'disaster_management' | 'mealtime_management';
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
    } else if (section.type === 'about_me' && typeof section.content === 'object') {
      this.addAboutMeBoxes(section.content);
    } else if (section.type === 'adl_support' && typeof section.content === 'object') {
      this.addADLSupportBoxes(section.content);
    } else if (section.type === 'communication_support' && typeof section.content === 'object') {
      this.addCommunicationSupportBoxes(section.content);
    } else if (section.type === 'structure_routine' && typeof section.content === 'object') {
      this.addStructureRoutineBoxes(section.content);
    } else if (section.type === 'disaster_management' && typeof section.content === 'object') {
      this.addDisasterManagementBoxes(section.content);
    } else if (section.type === 'mealtime_management' && typeof section.content === 'object') {
      this.addMealtimeManagementBoxes(section.content);
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
    
    // Add saved behaviors with colored strategy boxes - use 'behaviours' array
    if (behaviourData.behaviours && Array.isArray(behaviourData.behaviours)) {
      for (const behavior of behaviourData.behaviours) {
        this.checkPageBreak(20);
        
        // Add behavior name and description
        this.pdf.setFontSize(12);
        this.pdf.setFont('helvetica', 'bold');
        this.pdf.setTextColor(0, 0, 0);
        this.pdf.text(`Behaviour: ${behavior.name || 'Unnamed'}`, this.margin + 5, this.currentY);
        this.currentY += 8;
        
        if (behavior.description) {
          this.pdf.setFontSize(10);
          this.pdf.setFont('helvetica', 'normal');
          this.addText(`Description: ${behavior.description}`);
          this.currentY += 5;
        }
        
        if (behavior.triggers) {
          this.addText(`Triggers: ${behavior.triggers}`);
          this.currentY += 8;
        }
        
        // Add colored strategy boxes with enhanced visual separation
        if (behavior.proactiveStrategy) {
          this.addColoredStrategyBox('🟢 PROACTIVE STRATEGIES - Prevention & Early Intervention', behavior.proactiveStrategy, 'proactive');
        }
        
        if (behavior.reactiveStrategy) {
          this.addColoredStrategyBox('🟡 REACTIVE STRATEGIES - Immediate Response During Behavior', behavior.reactiveStrategy, 'reactive');
        }
        
        if (behavior.protectiveStrategy) {
          this.addColoredStrategyBox('🔴 PROTECTIVE STRATEGIES - Post-Behavior Safety & Recovery', behavior.protectiveStrategy, 'protective');
        }
        
        this.currentY += 12; // Extra spacing between behaviors
      }
    }
    
    // Add global strategies
    if (behaviourData.deEscalationTechniques) {
      this.checkPageBreak(15);
      this.addColoredStrategyBox('💡 GENERAL DE-ESCALATION TECHNIQUES', behaviourData.deEscalationTechniques, 'reactive');
    }
    
    if (behaviourData.positiveBehaviourSupport) {
      this.checkPageBreak(15);
      this.addColoredStrategyBox('⭐ POSITIVE BEHAVIOUR SUPPORT (PBS) APPROACH', behaviourData.positiveBehaviourSupport, 'proactive');
    }
    
    // Add any additional general content
    if (behaviourData.generatedContent) {
      this.checkPageBreak(10);
      this.pdf.setFontSize(10);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(0, 0, 0);
      this.addText(`Additional Guidance: ${behaviourData.generatedContent}`);
      this.currentY += 5;
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
        fillColor = [255, 251, 235]; // Very light yellow background
        borderColor = [245, 158, 11]; // Yellow/amber border
        titleBgColor = [217, 119, 6]; // Dark yellow/amber title background
        titleTextColor = [255, 255, 255]; // White title text
        break;
      case 'protective':
        fillColor = [255, 241, 242]; // Very light red background
        borderColor = [239, 68, 68]; // Red border
        titleBgColor = [220, 38, 38]; // Dark red title background
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

  private addAboutMeBoxes(aboutMeData: any) {
    const sections = [
      { key: 'personalHistory', title: '📝 Personal History', color: 'proactive' as const },
      { key: 'interests', title: '💝 Interests', color: 'reactive' as const },
      { key: 'preferences', title: '⭐ Preferences', color: 'proactive' as const },
      { key: 'strengths', title: '💪 Strengths', color: 'reactive' as const },
      { key: 'challenges', title: '🎯 Challenges', color: 'protective' as const },
      { key: 'familyBackground', title: '👨‍👩‍👧‍👦 Family Background', color: 'proactive' as const },
      { key: 'culturalConsiderations', title: '🌍 Cultural Considerations', color: 'reactive' as const }
    ];

    sections.forEach((section) => {
      const content = aboutMeData[section.key];
      if (content) {
        this.addColoredStrategyBox(section.title, content, section.color);
      }
    });
  }

  private addADLSupportBoxes(adlData: any) {
    const sections = [
      { key: 'personalCare', title: '🚿 Personal Care', color: 'proactive' as const },
      { key: 'mobility', title: '🚶 Mobility', color: 'proactive' as const },
      { key: 'household', title: '🏠 Household Tasks', color: 'reactive' as const },
      { key: 'community', title: '🌆 Community Access', color: 'reactive' as const },
      { key: 'safety', title: '🛡️ Safety Considerations', color: 'protective' as const },
      { key: 'independence', title: '⭐ Independence Level', color: 'proactive' as const }
    ];

    sections.forEach((section) => {
      const content = adlData[section.key];
      if (content) {
        this.addColoredStrategyBox(section.title, content, section.color);
      }
    });
  }

  private addCommunicationSupportBoxes(communicationData: any) {
    const sections = [
      { key: 'primaryMethods', title: '💬 Primary Methods', color: 'proactive' as const },
      { key: 'comprehensionLevel', title: '🧠 Comprehension Level', color: 'proactive' as const },
      { key: 'expressionAbilities', title: '🗣️ Expression Abilities', color: 'reactive' as const },
      { key: 'receptiveStrategies', title: '👂 Receptive Strategies', color: 'reactive' as const },
      { key: 'expressiveStrategies', title: '💭 Expressive Strategies', color: 'proactive' as const }
    ];

    sections.forEach((section) => {
      let content = communicationData[section.key];
      if (Array.isArray(content)) {
        content = content.join(', ');
      }
      if (content) {
        this.addColoredStrategyBox(section.title, content, section.color);
      }
    });
  }

  private addStructureRoutineBoxes(structureData: any) {
    // Weekly Schedule
    if (structureData.routines && Array.isArray(structureData.routines)) {
      // Group routines by day
      const routinesByDay: { [key: string]: any[] } = {};
      structureData.routines.forEach((routine: any) => {
        if (!routinesByDay[routine.day]) {
          routinesByDay[routine.day] = [];
        }
        routinesByDay[routine.day].push(routine);
      });
      
      // Display each day as a colored box
      Object.entries(routinesByDay).forEach(([day, routines]) => {
        const routineText = routines.map((routine: any) => {
          const timeRange = `${routine.startTime} - ${routine.endTime}`;
          return `${timeRange}: ${routine.description} (${routine.category})`;
        }).join('\n');
        
        this.addColoredStrategyBox(`📅 ${day}`, routineText, 'proactive');
      });
    }
  }

  private addDisasterManagementBoxes(disasterData: any) {
    const sections = [
      { key: 'evacuationPlan', title: '🚪 Evacuation Plan', color: 'protective' as const },
      { key: 'emergencyContacts', title: '📞 Emergency Contacts', color: 'protective' as const },
      { key: 'communicationMethod', title: '📢 Communication Method', color: 'reactive' as const },
      { key: 'medicalInformation', title: '🏥 Medical Information', color: 'protective' as const },
      { key: 'recoveryPlan', title: '🔄 Recovery Plan', color: 'proactive' as const }
    ];

    sections.forEach((section) => {
      const content = disasterData[section.key];
      if (content) {
        this.addColoredStrategyBox(section.title, content, section.color);
      }
    });
  }

  private addMealtimeManagementBoxes(mealtimeData: any) {
    const sections = [
      { key: 'chokingRisk', title: '🚨 Choking Risk Management', color: 'protective' as const },
      { key: 'aspirationRisk', title: '🫁 Aspiration Risk Management', color: 'protective' as const },
      { key: 'swallowingRisk', title: '💧 Swallowing Assessment', color: 'reactive' as const },
      { key: 'dietaryRisk', title: '🥗 Dietary Requirements', color: 'proactive' as const },
      { key: 'assistanceRisk', title: '🤝 Assistance Level', color: 'reactive' as const },
      { key: 'environmentalRisk', title: '🍽️ Environmental Setup', color: 'proactive' as const }
    ];

    sections.forEach((section) => {
      const content = mealtimeData[section.key];
      if (content) {
        this.addColoredStrategyBox(section.title, content, section.color);
      }
    });
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

  // Section 1: About Me with colored boxes
  sections.push({
    title: 'About Me',
    content: plan.aboutMeData || {},
    type: 'about_me'
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

  // Section 3: Activities of Daily Living Support with colored boxes
  sections.push({
    title: 'Activities of Daily Living Support',
    content: plan.adlData || {},
    type: 'adl_support'
  });

  // Section 4: Structure & Routine with colored boxes
  sections.push({
    title: 'Structure & Routine',
    content: plan.structureData || {},
    type: 'structure_routine'
  });

  // Section 5: Communication Support with colored boxes
  sections.push({
    title: 'Communication Support',
    content: plan.communicationData || {},
    type: 'communication_support'
  });

  // Section 6: Behaviour Support - Custom handling with colored boxes
  sections.push({
    title: 'Behaviour Support',
    content: plan.behaviourData || {},
    type: 'behaviour_support'
  });

  // Section 7: Disaster Management with colored boxes
  sections.push({
    title: 'Disaster Management',
    content: plan.disasterData || {},
    type: 'disaster_management'
  });

  // Section 8: Mealtime Management with colored boxes
  sections.push({
    title: 'Mealtime Management',
    content: plan.mealtimeData || {},
    type: 'mealtime_management'
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