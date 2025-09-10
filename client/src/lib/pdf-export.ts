import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface PDFExportOptions {
  title: string;
  contentHtml: string;
  companyName: string;
  staffName: string;
  submissionDate: string;
  planId?: string;
  filename?: string;
}

export interface PDFSection {
  title: string;
  content: string | { [key: string]: any };
  type?: 'text' | 'list' | 'table' | 'html' | 'behaviour_support' | 'about_me' | 'goals_outcomes' | 'adl_support' | 'communication_support' | 'structure_routine' | 'disaster_management' | 'mealtime_management';
}

// TUSK-inspired color palette from replit.md (matching invoice styling)
const COLORS = {
  deepNavy: '#2B4C7E',     // Deep Navy
  warmGold: '#D4AF37',     // Warm Gold
  sageGreen: '#87A96B',    // Sage Green
  cream: '#F5F5DC',        // Cream
  lightGray: '#F8F9FA',
  darkGray: '#6B7280',
  black: '#1F2937'
};

export class PDFExportUtility {
  private pdf: jsPDF;
  private currentY: number = 0;
  private pageHeight: number = 210; // A4 landscape height in mm
  private pageWidth: number = 297; // A4 landscape width in mm
  private margin: number = 15; // Professional margins
  private contentWidth: number;
  private headerHeight: number = 50; // Taller header like invoice
  private footerHeight: number = 20;
  private headerAdded: boolean = false;

  constructor() {
    this.pdf = new jsPDF('l', 'mm', 'a4'); // 'l' for landscape
    this.contentWidth = this.pageWidth - (this.margin * 2);
    
    // Set cream background for professional look
    this.pdf.setFillColor(COLORS.cream);
    this.pdf.rect(0, 0, this.pageWidth, this.pageHeight, 'F');
  }

  async generateStructuredPDF(options: PDFExportOptions, sections: PDFSection[]): Promise<void> {
    // Add header only on first page
    this.addHeaderFirstPageOnly(options);
    this.currentY = this.headerHeight + 5; // Reduced spacing after header

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
    
    // Header Section - Deep Navy background (matching invoice style)
    this.pdf.setFillColor(COLORS.deepNavy);
    this.pdf.rect(0, 0, this.pageWidth, this.headerHeight, 'F');

    // Company Logo/Name - NeedCareAI+ (matching invoice)
    this.pdf.setTextColor('#FFFFFF');
    this.pdf.setFontSize(20);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(options.companyName || 'NeedCareAI+', this.margin, 20);
    
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.text('Advanced Workforce Management Platform', this.margin, 27);
    this.pdf.text('Multi-Tenant Healthcare Solutions', this.margin, 32);

    // Document title and company name - Right aligned
    this.pdf.setFontSize(16);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(`CARE SUPPORT PLAN`, this.pageWidth - this.margin, 20, { align: 'right' });
    
    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.text(options.companyName, this.pageWidth - this.margin, 28, { align: 'right' });

    // Plan ID and export date - Right aligned
    this.pdf.setFontSize(9);
    if (options.planId) {
      this.pdf.text(`Plan ID: ${options.planId}`, this.pageWidth - this.margin, 35, { align: 'right' });
    }
    
    const exportDate = new Date().toLocaleDateString('en-AU');
    this.pdf.text(`Generated: ${exportDate}`, this.pageWidth - this.margin, 42, { align: 'right' });

    // Staff information - Left aligned
    this.pdf.text(`Staff: ${options.staffName}`, this.margin, 42);
    this.pdf.text(`Submission: ${options.submissionDate}`, this.margin, 47);
    
    this.headerAdded = true;
  }

  private addFooterAllPages(options: PDFExportOptions): void {
    const pageCount = this.pdf.getNumberOfPages();
    
    for (let i = 1; i <= pageCount; i++) {
      this.pdf.setPage(i);
      
      const footerY = this.pageHeight - this.footerHeight;
      
      this.pdf.setFontSize(8);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(COLORS.darkGray);
      
      const now = new Date();
      const timestamp = now.toLocaleDateString('en-AU') + ' ' + 
                       now.toLocaleTimeString('en-AU', { hour12: false, hour: '2-digit', minute: '2-digit' });
      
      // Professional footer format (matching invoice style)
      const footerText = `${options.companyName} | Generated: ${timestamp} | Page ${i} of ${pageCount}`;
      const footerWidth = this.pdf.getTextWidth(footerText);
      const footerX = (this.pageWidth - footerWidth) / 2;
      this.pdf.text(footerText, footerX, footerY + 10);
      
      // Staff and Plan ID info
      if (options.planId) {
        const staffText = `Staff: ${options.staffName} | Plan ID: ${options.planId}`;
        const staffWidth = this.pdf.getTextWidth(staffText);
        const staffX = (this.pageWidth - staffWidth) / 2;
        this.pdf.text(staffText, staffX, footerY + 16);
      }
    }
  }

  private addSection(section: PDFSection): void {
    this.checkPageBreak(25);

    // Professional section header with TUSK styling (Deep Navy like invoice)
    this.pdf.setFillColor(COLORS.deepNavy);
    this.pdf.rect(this.margin, this.currentY - 4, this.contentWidth, 18, 'F');
    
    // Add warm gold accent bar at bottom of section header
    this.pdf.setFillColor(COLORS.warmGold);
    this.pdf.rect(this.margin, this.currentY + 10, this.contentWidth, 3, 'F');
    
    this.pdf.setFontSize(14);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(255, 255, 255); // White text on navy background
    this.pdf.text(section.title, this.margin + 5, this.currentY + 6);
    this.currentY += 22;

    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(COLORS.black); // Reset to dark text

    if (section.type === 'list' && Array.isArray(section.content)) {
      this.addList(section.content);
    } else if (section.type === 'table' && typeof section.content === 'object') {
      this.addTable(section.content);
    } else if (section.type === 'behaviour_support' && typeof section.content === 'object') {
      this.addBehaviourSupport(section.content);
    } else if (section.type === 'about_me' && typeof section.content === 'object') {
      this.addAboutMeBoxes(section.content);
    } else if (section.type === 'goals_outcomes' && typeof section.content === 'object') {
      this.addGoalsOutcomesBoxes(section.content);
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

    this.currentY += 8; // Reduced spacing between sections
  }

  private addText(text: string, isTitle = false): void {
    if (!text) return;
    
    const cleanText = this.sanitizeText(text);
    
    // Handle title formatting with bold fonts and horizontal lines
    if (isTitle) {
      this.pdf.setFontSize(12);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(50, 50, 50);
      this.checkPageBreak(12);
      this.pdf.text(cleanText, this.margin + 5, this.currentY);
      this.currentY += 8;
      
      // Add horizontal line after title
      this.pdf.setDrawColor(200, 200, 200);
      this.pdf.setLineWidth(0.5);
      this.pdf.line(this.margin + 5, this.currentY, this.margin + this.contentWidth - 5, this.currentY);
      this.currentY += 6;
      this.pdf.setDrawColor(0, 0, 0);
      
      // Reset to normal text style
      this.pdf.setFontSize(10);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(60, 60, 60);
      return;
    }
    
    // Regular paragraph text with proper spacing
    const lines = this.pdf.splitTextToSize(cleanText, this.contentWidth - 10);
    
    for (const line of lines) {
      this.checkPageBreak(7);
      this.pdf.text(line, this.margin + 8, this.currentY);
      this.currentY += 6;
    }
    
    // Add minimal paragraph spacing after regular text
    this.currentY += 2;
  }

  private addEmptyCalloutBox(title: string): void {
    // Skip empty sections entirely to reduce PDF length
    return;
  }

  private sanitizeText(text: string): string {
    if (!text || typeof text !== 'string') return '';
    
    // Check for debug content contamination and return empty if detected
    if (this.containsDebugContent(text)) {
      console.warn('Debug content detected in PDF export, filtering out:', text.substring(0, 100));
      return '';
    }
    
    return text
      // Remove specific problematic character sequences
      .replace(/Ø=Ü/g, '')
      .replace(/Ø<ß/g, '')
      .replace(/Ø>Ýþ/g, '')
      .replace(/Ø=ÜË/g, '')
      .replace(/Ø=ÜŠ/g, '')
      .replace(/\+P/g, '')
      // Replace smart quotes and dashes with standard ASCII
      .replace(/[\u2018\u2019]/g, "'") // Smart single quotes
      .replace(/[\u201C\u201D]/g, '"') // Smart double quotes
      .replace(/[\u2013\u2014]/g, '-') // En/em dashes
      .replace(/\u2026/g, '...') // Ellipsis
      // Standardize bullet points to simple dash
      .replace(/[•⦁▪▫◦‣⁃]/g, '-')
      // Remove control characters and non-printable characters
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      // Replace non-breaking space and other whitespace variants
      .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ')
      // Normalize multiple whitespace to single space
      .replace(/\s+/g, ' ')
      .trim();
  }

  private containsDebugContent(text: string): boolean {
    // Debug content patterns that should never appear in professional healthcare documentation
    const debugPatterns = [
      // Development instructions
      /Fix the following issues across modules/i,
      /Issue:/i,
      /Fix Requirements:/i,
      /Check if.*properly bound/i,
      /Confirm that.*API call/i,
      /Ensure.*error handling/i,
      /Add loading and error states/i,
      
      // Template/prompt content
      /GENERAL WRITING STYLE/i,
      /Clinical.*Objective.*Direct/i,
      /No asterisks, emojis, or markdown/i,
      /Maximum:.*words per section/i,
      /Copy Edit/i,
      /þ GENERAL/i,
      
      // Corrupted encoding markers
      /Ø[=<>][ÜßÝþË]/,
      /[þË]{2,}/,
      
      // API/technical references in user content
      /PDF export.*captures.*first page/i,
      /Export.*PDF.*button.*not working/i,
      /View Records.*not displaying/i,
      /clientId.*companyId.*filters/i,
      /TanStack Query/i,
      /DOM element refs/i,
      /html2pdf\.js|jsPDF|react-to-pdf/i,
      /page-break styles/i,
      
      // Development artifact patterns
      /^\s*\d+\.\s*(Case Note PDF Export Bug|Observation Module|View Records)/i,
      /records\.length.*undefined.*stale/i,
      /The.*button.*under.*tab.*does nothing/i,
      /Check if.*button.*properly bound/i,
      /Confirm.*API response.*TanStack/i,
      /Fix rendering logic/i,
      /Add loading and error states if not present/i,
      
      // Additional debug markers
      /^\s*Fix the following/i,
      /Issue:\s*$/i,
      /Fix Requirements:\s*$/i,
      /Ensure all.*content.*paginated/i,
      /Use.*with page breaks/i,
    ];
    
    return debugPatterns.some(pattern => pattern.test(text));
  }

  // Add comprehensive data validation and sanitization function
  public validateAndSanitizeData(data: any, section: string): any {
    if (!data || typeof data !== 'object') {
      return {};
    }

    const sanitizedData: any = {};

    // Deep sanitization of object properties
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        const cleanValue = this.sanitizeText(value);
        // Include all content, even if empty - important for care plan forms
        sanitizedData[key] = cleanValue;
      } else if (Array.isArray(value)) {
        // Sanitize array elements but preserve structure
        const cleanArray = value
          .map(item => {
            if (typeof item === 'string') {
              return this.sanitizeText(item);
            } else if (typeof item === 'object' && item !== null) {
              return this.validateAndSanitizeData(item, section);
            }
            return item;
          });
        
        // Always preserve arrays, even if empty
        sanitizedData[key] = cleanArray;
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects
        const cleanObject = this.validateAndSanitizeData(value, section);
        // Always preserve objects, even if empty - structure is important
        sanitizedData[key] = cleanObject;
      } else {
        // Keep other primitive values as-is
        sanitizedData[key] = value;
      }
    }

    // Only log actually problematic content, not empty fields
    const originalKeys = Object.keys(data);
    const sanitizedKeys = Object.keys(sanitizedData);
    const removedKeys = originalKeys.filter(key => !sanitizedKeys.includes(key));
    
    if (removedKeys.length > 0) {
      console.debug(`PDF Export: Processed ${section} section - preserved ${sanitizedKeys.length} fields`);
    }

    return sanitizedData;
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
      // Sanitize both key and value
      const cleanKey = this.sanitizeText(key);
      const cleanValue = this.sanitizeText(String(value));
      
      // Calculate required space for this row - reduced from original
      const valueLines = this.pdf.splitTextToSize(cleanValue, rightColumnWidth);
      const requiredSpace = Math.max(8, valueLines.length * 5 + 4);
      this.checkPageBreak(requiredSpace);
      
      // Add key (bold) - properly aligned
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setFontSize(10);
      this.pdf.text(`${cleanKey}:`, this.margin + 5, this.currentY);
      
      // Add value (normal, with text wrapping) - properly aligned
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setFontSize(10);
      
      let valueY = this.currentY;
      for (let i = 0; i < valueLines.length; i++) {
        if (i > 0) {
          valueY += 5;
          this.checkPageBreak(5);
        }
        this.pdf.text(valueLines[i], this.margin + leftColumnWidth + 5, valueY);
      }
      
      // Move currentY to the end of this row with minimal spacing
      this.currentY = valueY + 4; // Further reduced spacing between table rows
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
          this.addColoredStrategyBox('PROACTIVE STRATEGIES - Prevention & Early Intervention', behavior.proactiveStrategy, 'proactive');
        }
        
        if (behavior.reactiveStrategy) {
          this.addColoredStrategyBox('REACTIVE STRATEGIES - Immediate Response During Behavior', behavior.reactiveStrategy, 'reactive');
        }
        
        if (behavior.protectiveStrategy) {
          this.addColoredStrategyBox('PROTECTIVE STRATEGIES - Post-Behavior Safety & Recovery', behavior.protectiveStrategy, 'protective');
        }
        
        this.currentY += 6; // Reduced spacing between behaviors
      }
    }
    
    // Add global strategies
    if (behaviourData.deEscalationTechniques) {
      this.checkPageBreak(15);
      this.addColoredStrategyBox('GENERAL DE-ESCALATION TECHNIQUES', behaviourData.deEscalationTechniques, 'reactive');
    }
    
    if (behaviourData.positiveBehaviourSupport) {
      this.checkPageBreak(15);
      this.addColoredStrategyBox('POSITIVE BEHAVIOUR SUPPORT (PBS) APPROACH', behaviourData.positiveBehaviourSupport, 'proactive');
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
    // Sanitize both title and content to prevent encoding issues
    const cleanTitle = this.sanitizeText(title);
    const cleanContent = this.sanitizeText(content);
    
    // Split content into paragraphs for better formatting
    const paragraphs = cleanContent.split(/\n\s*\n|\. (?=[A-Z])|(?<=\.)\s+(?=[A-Z])/).filter(p => p.trim());
    const allLines: string[] = [];
    
    paragraphs.forEach((paragraph, index) => {
      const paragraphLines = this.pdf.splitTextToSize(paragraph.trim(), this.contentWidth - 30);
      allLines.push(...paragraphLines);
      // Add spacing between paragraphs (except last one)
      if (index < paragraphs.length - 1) {
        allLines.push(''); // Empty line for paragraph spacing
      }
    });
    
    const requiredSpace = 25 + (allLines.length * 5) + (paragraphs.length * 3);
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
    
    const boxHeight = 18 + (allLines.length * 5);
    
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
    this.pdf.text(cleanTitle, this.margin + 10, this.currentY + 6);
    this.currentY += 15;
    
    // Add content with better formatting
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(60, 60, 60); // Dark gray for better readability
    
    for (const line of allLines) {
      this.checkPageBreak(6);
      if (line.trim() === '') {
        // Empty line for paragraph spacing
        this.currentY += 3;
      } else {
        this.pdf.text(line, this.margin + 10, this.currentY);
        this.currentY += 5;
      }
    }
    
    this.currentY += 5; // Minimal spacing after box
    
    // Reset drawing properties
    this.pdf.setDrawColor(0, 0, 0);
    this.pdf.setLineWidth(0.2);
    this.pdf.setTextColor(0, 0, 0);
  }

  private addAboutMeBoxes(aboutMeData: any) {
    // Clean section definitions without special characters that could cause encoding issues
    const sections = [
      { key: 'personalHistory', title: 'Personal History', color: 'proactive' as const },
      { key: 'interests', title: 'Interests', color: 'reactive' as const },
      { key: 'preferences', title: 'Preferences', color: 'proactive' as const },
      { key: 'strengths', title: 'Strengths', color: 'reactive' as const },
      { key: 'challenges', title: 'Challenges', color: 'protective' as const },
      { key: 'familyBackground', title: 'Family Background', color: 'proactive' as const },
      { key: 'culturalConsiderations', title: 'Cultural Considerations', color: 'reactive' as const }
    ];

    sections.forEach((section) => {
      const content = aboutMeData[section.key];
      if (content) {
        // Sanitize content before adding to PDF
        const cleanContent = this.sanitizeText(content);
        if (cleanContent.trim()) {
          this.addColoredStrategyBox(section.title, cleanContent, section.color);
        }
      }
    });

    // If no sections have content, add a placeholder message
    const hasContent = sections.some(section => aboutMeData[section.key]);
    if (!hasContent) {
      this.checkPageBreak(10);
      this.pdf.setFontSize(10);
      this.pdf.setFont('helvetica', 'italic');
      this.pdf.setTextColor(100, 100, 100);
      this.addText('No personal information recorded.');
      this.currentY += 5;
    }
  }

  private addGoalsOutcomesBoxes(goalsData: any) {
    // Check if there's any goals data to display
    const hasNdisGoals = goalsData.ndisGoals;
    const hasPersonalAspirations = goalsData.personalAspirations;
    const hasShortTermGoals = goalsData.shortTermGoals;
    const hasLongTermGoals = goalsData.longTermGoals;
    const hasOverallObjective = goalsData.overallObjective;
    
    if (!hasNdisGoals && !hasPersonalAspirations && !hasShortTermGoals && !hasLongTermGoals && !hasOverallObjective) {
      this.checkPageBreak(10);
      this.pdf.setFontSize(10);
      this.pdf.setFont('helvetica', 'italic');
      this.pdf.setTextColor(100, 100, 100);
      this.addText('No goals and outcomes data provided.');
      this.currentY += 5;
      return;
    }
    
    this.addGoalsOutcomesTable(goalsData);
  }

  private addGoalsOutcomesTable(goalsData: any) {
    this.checkPageBreak(30);
    
    // Table dimensions
    const tableStartX = this.margin;
    const tableWidth = this.contentWidth;
    const colWidths = {
      category: tableWidth * 0.25,
      content: tableWidth * 0.75
    };
    
    let currentX = tableStartX;
    const rowHeight = 12;
    const headerHeight = 10;
    
    // Draw table header with blue background
    this.pdf.setFillColor(43, 75, 115); // Deep navy blue
    this.pdf.rect(currentX, this.currentY, tableWidth, headerHeight, 'F');
    
    // Header text in white
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(255, 255, 255);
    
    // Header columns
    this.pdf.text('Goal Category', currentX + 2, this.currentY + 6);
    currentX += colWidths.category;
    this.pdf.text('Details', currentX + 2, this.currentY + 6);
    
    this.currentY += headerHeight;
    
    // Draw table border
    this.pdf.setDrawColor(43, 75, 115);
    this.pdf.setLineWidth(0.5);
    this.pdf.rect(tableStartX, this.currentY - headerHeight, tableWidth, headerHeight, 'S');
    
    // Table rows
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(60, 60, 60);
    this.pdf.setFontSize(8);
    
    const goalCategories = [
      { key: 'ndisGoals', label: 'NDIS Support Goals', color: [34, 197, 94] }, // Green
      { key: 'personalAspirations', label: 'Personal Aspirations', color: [245, 158, 11] }, // Amber
      { key: 'shortTermGoals', label: 'Short-Term Goals (3-6 months)', color: [59, 130, 246] }, // Blue
      { key: 'longTermGoals', label: 'Long-Term Goals (6+ months)', color: [16, 185, 129] }, // Emerald
      { key: 'overallObjective', label: 'Overall Objective', color: [34, 197, 94] } // Green
    ];
    
    // Track added content to prevent repetition
    const addedContent = new Set<string>();
    
    let rowIndex = 0;
    goalCategories.forEach((category) => {
      const content = goalsData[category.key];
      if (content) {
        const cleanContent = this.sanitizeText(content);
        
        // Skip if this exact content was already added
        if (addedContent.has(cleanContent)) {
          return;
        }
        addedContent.add(cleanContent);
        
        this.checkPageBreak(rowHeight + 2);
        
        const isEvenRow = rowIndex % 2 === 0;
        if (isEvenRow) {
          this.pdf.setFillColor(248, 250, 252); // Very light blue background
          this.pdf.rect(tableStartX, this.currentY, tableWidth, rowHeight, 'F');
        }
        
        currentX = tableStartX;
        const textY = this.currentY + 6;
        
        // Category column with colored indicator
        this.pdf.setFillColor(category.color[0], category.color[1], category.color[2]);
        this.pdf.rect(currentX + 1, this.currentY + 2, 3, rowHeight - 4, 'F');
        
        this.pdf.setFontSize(8);
        this.pdf.setFont('helvetica', 'bold');
        this.pdf.setTextColor(60, 60, 60);
        this.pdf.text(category.label, currentX + 6, textY);
        currentX += colWidths.category;
        
        // Content column with text wrapping
        this.pdf.setFont('helvetica', 'normal');
        const contentLines = this.pdf.splitTextToSize(content, colWidths.content - 4);
        
        if (contentLines.length > 1) {
          // Handle multi-line content
          let lineY = textY;
          contentLines.forEach((line: string, lineIndex: number) => {
            if (lineIndex > 0) {
              this.checkPageBreak(5);
              lineY += 4;
              // Extend row height for multi-line content
              if (isEvenRow) {
                this.pdf.setFillColor(248, 250, 252);
                this.pdf.rect(tableStartX, this.currentY + (lineIndex * 4), tableWidth, 4, 'F');
              }
            }
            this.pdf.text(line, currentX + 2, lineY);
          });
          // Adjust current Y for multi-line content
          this.currentY += (contentLines.length - 1) * 4;
        } else {
          this.pdf.text(content, currentX + 2, textY);
        }
        
        // Draw row border
        this.pdf.setDrawColor(200, 200, 200);
        this.pdf.setLineWidth(0.2);
        const actualRowHeight = rowHeight + ((contentLines.length - 1) * 4);
        this.pdf.rect(tableStartX, this.currentY, tableWidth, actualRowHeight, 'S');
        
        this.currentY += rowHeight;
        rowIndex++;
      }
    });
    
    // Draw final table border
    this.pdf.setDrawColor(43, 75, 115);
    this.pdf.setLineWidth(0.5);
    const totalRows = rowIndex;
    this.pdf.rect(tableStartX, this.currentY - (totalRows * rowHeight) - headerHeight, tableWidth, (totalRows * rowHeight) + headerHeight, 'S');
    
    this.currentY += 10; // Extra spacing after table
    
    // Reset styles
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.setDrawColor(0, 0, 0);
    this.pdf.setLineWidth(0.2);
  }

  private addADLSupportBoxes(adlData: any) {
    // Clean section definitions without special characters
    const sections = [
      { key: 'personalCare', title: 'Personal Care', color: 'proactive' as const },
      { key: 'mobility', title: 'Mobility', color: 'proactive' as const },
      { key: 'household', title: 'Household Tasks', color: 'reactive' as const },
      { key: 'community', title: 'Community Access', color: 'reactive' as const },
      { key: 'safety', title: 'Safety Considerations', color: 'protective' as const },
      { key: 'independence', title: 'Independence Level', color: 'proactive' as const }
    ];

    sections.forEach((section) => {
      const content = adlData[section.key];
      if (content) {
        const cleanContent = this.sanitizeText(content);
        if (cleanContent.trim()) {
          this.addColoredStrategyBox(section.title, cleanContent, section.color);
        }
      }
    });

    // If no sections have content, add a placeholder message
    const hasContent = sections.some(section => adlData[section.key]);
    if (!hasContent) {
      this.addEmptyCalloutBox('Activities of Daily Living');
    }
  }

  private addCommunicationSupportBoxes(communicationData: any) {
    // Clean section definitions without special characters
    const sections = [
      { key: 'primaryMethods', title: 'Primary Methods', color: 'proactive' as const },
      { key: 'comprehensionLevel', title: 'Comprehension Level', color: 'proactive' as const },
      { key: 'expressionAbilities', title: 'Expression Abilities', color: 'reactive' as const },
      { key: 'receptiveStrategies', title: 'Receptive Strategies', color: 'reactive' as const },
      { key: 'expressiveStrategies', title: 'Expressive Strategies', color: 'proactive' as const }
    ];

    sections.forEach((section) => {
      let content = communicationData[section.key];
      if (Array.isArray(content)) {
        content = content.join(', ');
      }
      if (content) {
        const cleanContent = this.sanitizeText(content);
        if (cleanContent.trim()) {
          this.addColoredStrategyBox(section.title, cleanContent, section.color);
        }
      }
    });

    // If no sections have content, add a placeholder message
    const hasContent = sections.some(section => {
      let content = communicationData[section.key];
      if (Array.isArray(content)) {
        content = content.join(', ');
      }
      return content && content.trim();
    });
    
    if (!hasContent) {
      this.addEmptyCalloutBox('Communication Support');
    }
  }

  private addStructureRoutineBoxes(structureData: any) {
    // Check for routine_entries or routines array
    const routineEntries = structureData.routine_entries || structureData.routines;
    
    if (routineEntries && Array.isArray(routineEntries) && routineEntries.length > 0) {
      this.addStructureRoutineTable(routineEntries);
    } else {
      this.addEmptyCalloutBox('Structure & Routine');
    }
  }

  private addStructureRoutineTable(routineEntries: any[]) {
    this.checkPageBreak(30);
    
    // Table dimensions
    const tableStartX = this.margin;
    const tableWidth = this.contentWidth;
    const colWidths = {
      day: tableWidth * 0.15,
      time: tableWidth * 0.20,
      activity: tableWidth * 0.40,
      category: tableWidth * 0.15,
      priority: tableWidth * 0.10
    };
    
    let currentX = tableStartX;
    const rowHeight = 8;
    const headerHeight = 10;
    
    // Draw table header with blue background
    this.pdf.setFillColor(43, 75, 115); // Deep navy blue
    this.pdf.rect(currentX, this.currentY, tableWidth, headerHeight, 'F');
    
    // Header text in white
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(255, 255, 255);
    
    // Header columns
    this.pdf.text('Day', currentX + 2, this.currentY + 6);
    currentX += colWidths.day;
    this.pdf.text('Time', currentX + 2, this.currentY + 6);
    currentX += colWidths.time;
    this.pdf.text('Activity Description', currentX + 2, this.currentY + 6);
    currentX += colWidths.activity;
    this.pdf.text('Category', currentX + 2, this.currentY + 6);
    currentX += colWidths.category;
    this.pdf.text('Priority', currentX + 2, this.currentY + 6);
    
    this.currentY += headerHeight;
    
    // Draw table border
    this.pdf.setDrawColor(43, 75, 115);
    this.pdf.setLineWidth(0.5);
    this.pdf.rect(tableStartX, this.currentY - headerHeight, tableWidth, headerHeight, 'S');
    
    // Table rows
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(60, 60, 60);
    this.pdf.setFontSize(8);
    
    routineEntries.forEach((entry, index) => {
      this.checkPageBreak(rowHeight + 2);
      
      const isEvenRow = index % 2 === 0;
      if (isEvenRow) {
        this.pdf.setFillColor(248, 250, 252); // Very light blue background
        this.pdf.rect(tableStartX, this.currentY, tableWidth, rowHeight, 'F');
      }
      
      currentX = tableStartX;
      const textY = this.currentY + 5;
      
      // Day
      const day = entry.day || 'N/A';
      this.pdf.text(day, currentX + 2, textY);
      currentX += colWidths.day;
      
      // Time Range
      let timeRange = 'N/A';
      if (entry.startTime && entry.endTime) {
        timeRange = `${entry.startTime}-${entry.endTime}`;
      } else if (entry.time) {
        timeRange = entry.time;
      }
      this.pdf.text(timeRange, currentX + 2, textY);
      currentX += colWidths.time;
      
      // Activity Description (with text wrapping)
      const activity = entry.description || entry.activity || 'No description';
      const activityLines = this.pdf.splitTextToSize(activity, colWidths.activity - 4);
      if (activityLines.length > 1) {
        // Handle multi-line activities
        activityLines.forEach((line: string, lineIndex: number) => {
          if (lineIndex > 0) {
            this.checkPageBreak(5);
            this.currentY += 4;
          }
          this.pdf.text(line, currentX + 2, textY + (lineIndex * 4));
        });
      } else {
        this.pdf.text(activity, currentX + 2, textY);
      }
      currentX += colWidths.activity;
      
      // Category
      const category = entry.category || '';
      this.pdf.text(category, currentX + 2, textY);
      currentX += colWidths.category;
      
      // Priority
      const priority = entry.priority || '';
      this.pdf.text(priority, currentX + 2, textY);
      
      // Draw row border
      this.pdf.setDrawColor(200, 200, 200);
      this.pdf.setLineWidth(0.2);
      this.pdf.rect(tableStartX, this.currentY, tableWidth, rowHeight, 'S');
      
      this.currentY += rowHeight;
    });
    
    // Draw final table border
    this.pdf.setDrawColor(43, 75, 115);
    this.pdf.setLineWidth(0.5);
    this.pdf.rect(tableStartX, this.currentY - (routineEntries.length * rowHeight) - headerHeight, tableWidth, (routineEntries.length * rowHeight) + headerHeight, 'S');
    
    this.currentY += 10; // Extra spacing after table
    
    // Reset styles
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.setDrawColor(0, 0, 0);
    this.pdf.setLineWidth(0.2);
  }

  private addDisasterManagementBoxes(disasterData: any) {
    // Check if there are any disaster plans to display
    const disasterPlans = disasterData.disasterPlans || [];
    const hasDisasterPlans = Array.isArray(disasterPlans) && disasterPlans.length > 0;
    
    // Check for actual field names used by the forms
    const hasEvacuationProcedures = disasterData.evacuationProcedures;
    const hasEmergencyContacts = disasterData.emergencyContacts;
    const hasCommunicationPlan = disasterData.communicationPlan;
    const hasMedicationManagement = disasterData.medicationManagement;
    const hasPostDisasterSupport = disasterData.postDisasterSupport;
    const hasGeneralPreparedness = disasterData.generalPreparedness;
    const hasSpecialEquipment = disasterData.specialEquipment;
    const hasShelterArrangements = disasterData.shelterArrangements;
    const hasUserInput = disasterData.userInput;
    const hasGeneratedContent = disasterData.generatedContent;
    
    if (!hasDisasterPlans && !hasEvacuationProcedures && !hasEmergencyContacts && !hasCommunicationPlan && 
        !hasMedicationManagement && !hasPostDisasterSupport && !hasGeneralPreparedness && !hasSpecialEquipment && 
        !hasShelterArrangements && !hasUserInput && !hasGeneratedContent) {
      this.addEmptyCalloutBox('Disaster Management');
      return;
    }
    
    this.addDisasterManagementTable(disasterData);
  }

  // Removed contamination detection - was too aggressive and prevented valid content from displaying

  private addDisasterManagementTable(disasterData: any) {
    this.checkPageBreak(30);
    
    // Table dimensions
    const tableStartX = this.margin;
    const tableWidth = this.contentWidth;
    const colWidths = {
      category: tableWidth * 0.25,
      content: tableWidth * 0.75
    };
    
    let currentX = tableStartX;
    const rowHeight = 12;
    const headerHeight = 10;
    
    // Draw table header with blue background
    this.pdf.setFillColor(43, 75, 115); // Deep navy blue
    this.pdf.rect(currentX, this.currentY, tableWidth, headerHeight, 'F');
    
    // Header text in white
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(255, 255, 255);
    
    // Header columns
    this.pdf.text('Emergency Category', currentX + 2, this.currentY + 6);
    currentX += colWidths.category;
    this.pdf.text('Procedures & Details', currentX + 2, this.currentY + 6);
    
    this.currentY += headerHeight;
    
    // Draw table border
    this.pdf.setDrawColor(43, 75, 115);
    this.pdf.setLineWidth(0.5);
    this.pdf.rect(tableStartX, this.currentY - headerHeight, tableWidth, headerHeight, 'S');
    
    // Table rows
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(60, 60, 60);
    this.pdf.setFontSize(8);
    
    let rowIndex = 0;
    
    // First, handle disaster plans array (new format)
    const disasterPlans = disasterData.disasterPlans || [];
    if (Array.isArray(disasterPlans) && disasterPlans.length > 0) {
      disasterPlans.forEach((plan: any) => {
        if (plan.preparation || plan.evacuation || plan.postEvent || plan.clientNeeds) {
          this.checkPageBreak(rowHeight + 2);
          
          // Store the row start position
          const rowStartY = this.currentY;
          
          // Calculate actual content height first
          this.pdf.setFont('helvetica', 'normal');
          let contentText = '';
          if (plan.preparation) contentText += `Preparation: ${plan.preparation}`;
          if (plan.evacuation) contentText += (contentText ? ' | ' : '') + `Evacuation: ${plan.evacuation}`;
          if (plan.postEvent) contentText += (contentText ? ' | ' : '') + `Post-Event: ${plan.postEvent}`;
          if (plan.clientNeeds) contentText += (contentText ? ' | ' : '') + `Client Needs: ${plan.clientNeeds}`;
          
          const contentLines = this.pdf.splitTextToSize(contentText, colWidths.content - 4);
          const actualRowHeight = rowHeight + ((contentLines.length - 1) * 4);
          
          const isEvenRow = rowIndex % 2 === 0;
          if (isEvenRow) {
            this.pdf.setFillColor(248, 250, 252); // Very light blue background
            this.pdf.rect(tableStartX, rowStartY, tableWidth, actualRowHeight, 'F');
          }
          
          currentX = tableStartX;
          const textY = rowStartY + 6;
          
          // Category column with colored indicator
          const disasterTypeColors = {
            'fire': [220, 38, 127], // Red/Protective
            'flood': [34, 197, 94], // Green/Proactive  
            'earthquake': [245, 158, 11], // Amber/Reactive
            'medical': [220, 38, 127], // Red/Protective
            'heatwave': [245, 158, 11] // Amber/Reactive
          };
          
          const categoryColor = disasterTypeColors[plan.type as keyof typeof disasterTypeColors] || [220, 38, 127];
          this.pdf.setFillColor(categoryColor[0], categoryColor[1], categoryColor[2]);
          this.pdf.rect(currentX + 1, rowStartY + 2, 3, actualRowHeight - 4, 'F');
          
          this.pdf.setFontSize(8);
          this.pdf.setFont('helvetica', 'bold');
          this.pdf.setTextColor(60, 60, 60);
          
          const disasterTypeLabels = {
            'fire': 'Fire/Bushfire',
            'flood': 'Flood',
            'earthquake': 'Earthquake', 
            'medical': 'Medical Emergency',
            'heatwave': 'Heatwave'
          };
          
          const categoryLabel = disasterTypeLabels[plan.type as keyof typeof disasterTypeLabels] || plan.type;
          this.pdf.text(categoryLabel, currentX + 6, textY);
          currentX += colWidths.category;
          
          // Content column with text wrapping
          this.pdf.setFont('helvetica', 'normal');
          
          if (contentLines.length > 1) {
            // Handle multi-line content
            let lineY = textY;
            contentLines.forEach((line: string, lineIndex: number) => {
              if (lineIndex > 0) {
                this.checkPageBreak(5);
                lineY += 4;
                // Extend row height for multi-line content
                if (isEvenRow) {
                  this.pdf.setFillColor(248, 250, 252);
                  this.pdf.rect(tableStartX, this.currentY + (lineIndex * 4), tableWidth, 4, 'F');
                }
              }
              this.pdf.text(line, currentX + 2, lineY);
            });

          } else {
            this.pdf.text(contentText, currentX + 2, textY);
          }
          
          // Draw row border
          this.pdf.setDrawColor(200, 200, 200);
          this.pdf.setLineWidth(0.2);
          this.pdf.rect(tableStartX, rowStartY, tableWidth, actualRowHeight, 'S');
          
          this.currentY = rowStartY + actualRowHeight;
          rowIndex++;
        }
      });
    }
    
    // Then handle legacy individual fields (old format)
    const disasterCategories = [
      { key: 'evacuationProcedures', label: 'Evacuation Procedures', color: [220, 38, 127] }, // Red/Protective
      { key: 'emergencyContacts', label: 'Emergency Contacts', color: [220, 38, 127] }, // Red/Protective
      { key: 'communicationPlan', label: 'Communication Plan', color: [245, 158, 11] }, // Amber/Reactive
      { key: 'medicationManagement', label: 'Medication Management', color: [220, 38, 127] }, // Red/Protective
      { key: 'postDisasterSupport', label: 'Post-Disaster Support', color: [34, 197, 94] } // Green/Proactive
    ];
    
    disasterCategories.forEach((category) => {
      const content = disasterData[category.key];
      if (content) {
        this.checkPageBreak(rowHeight + 2);
        
        // Store the row start position
        const rowStartY = this.currentY;
        
        // Calculate actual content height first
        this.pdf.setFont('helvetica', 'normal');
        const contentLines = this.pdf.splitTextToSize(content, colWidths.content - 4);
        const actualRowHeight = rowHeight + ((contentLines.length - 1) * 4);
        
        const isEvenRow = rowIndex % 2 === 0;
        if (isEvenRow) {
          this.pdf.setFillColor(248, 250, 252); // Very light blue background
          this.pdf.rect(tableStartX, rowStartY, tableWidth, actualRowHeight, 'F');
        }
        
        currentX = tableStartX;
        const textY = rowStartY + 6;
        
        // Category column with colored indicator
        this.pdf.setFillColor(category.color[0], category.color[1], category.color[2]);
        this.pdf.rect(currentX + 1, rowStartY + 2, 3, actualRowHeight - 4, 'F');
        
        this.pdf.setFontSize(8);
        this.pdf.setFont('helvetica', 'bold');
        this.pdf.setTextColor(60, 60, 60);
        this.pdf.text(category.label, currentX + 6, textY);
        currentX += colWidths.category;
        
        // Content column with text wrapping
        this.pdf.setFont('helvetica', 'normal');
        
        if (contentLines.length > 1) {
          // Handle multi-line content
          let lineY = textY;
          contentLines.forEach((line: string, lineIndex: number) => {
            if (lineIndex > 0) {
              this.checkPageBreak(5);
              lineY += 4;
            }
            this.pdf.text(line, currentX + 2, lineY);
          });
        } else {
          this.pdf.text(content, currentX + 2, textY);
        }
        
        // Draw row border
        this.pdf.setDrawColor(200, 200, 200);
        this.pdf.setLineWidth(0.2);
        this.pdf.rect(tableStartX, rowStartY, tableWidth, actualRowHeight, 'S');
        
        this.currentY = rowStartY + actualRowHeight;
        rowIndex++;
      }
    });
    
    // Draw final table border
    this.pdf.setDrawColor(43, 75, 115);
    this.pdf.setLineWidth(0.5);
    const totalRows = rowIndex;
    this.pdf.rect(tableStartX, this.currentY - (totalRows * rowHeight) - headerHeight, tableWidth, (totalRows * rowHeight) + headerHeight, 'S');
    
    this.currentY += 10; // Extra spacing after table
    
    // Reset styles
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.setDrawColor(0, 0, 0);
    this.pdf.setLineWidth(0.2);
  }

  private addMealtimeManagementBoxes(mealtimeData: any) {
    // Check if there are any risk parameters to display (new format)
    const riskParameters = mealtimeData.riskParameters || [];
    const hasRiskParameters = Array.isArray(riskParameters) && riskParameters.length > 0;
    
    // Check for actual field names used by the forms
    const hasDietaryRequirements = mealtimeData.dietaryRequirements;
    const hasTextureModifications = mealtimeData.textureModifications;
    const hasAssistanceLevel = mealtimeData.assistanceLevel;
    const hasMealtimeEnvironment = mealtimeData.mealtimeEnvironment;
    const hasEmergencyProcedures = mealtimeData.emergencyProcedures;
    const hasStaffGuidance = mealtimeData.staffGuidance;
    const hasMonitoringRequirements = mealtimeData.monitoringRequirements;
    const hasEquipmentNeeds = mealtimeData.equipmentNeeds;
    const hasSocialAspects = mealtimeData.socialAspects;
    const hasNutritionalConsiderations = mealtimeData.nutritionalConsiderations;
    const hasUserInput = mealtimeData.userInput;
    const hasGeneratedContent = mealtimeData.generatedContent;
    
    if (!hasRiskParameters && !hasDietaryRequirements && !hasTextureModifications && !hasAssistanceLevel && 
        !hasMealtimeEnvironment && !hasEmergencyProcedures && !hasStaffGuidance && !hasMonitoringRequirements && 
        !hasEquipmentNeeds && !hasSocialAspects && !hasNutritionalConsiderations && !hasUserInput && !hasGeneratedContent) {
      this.addEmptyCalloutBox('Mealtime Management');
      return;
    }
    
    this.addMealtimeManagementTable(mealtimeData);
  }

  private addMealtimeManagementTable(mealtimeData: any) {
    this.checkPageBreak(30);
    
    // Table dimensions
    const tableStartX = this.margin;
    const tableWidth = this.contentWidth;
    const colWidths = {
      category: tableWidth * 0.25,
      content: tableWidth * 0.75
    };
    
    let currentX = tableStartX;
    const rowHeight = 12;
    const headerHeight = 10;
    
    // Draw table header with blue background
    this.pdf.setFillColor(43, 75, 115); // Deep navy blue
    this.pdf.rect(currentX, this.currentY, tableWidth, headerHeight, 'F');
    
    // Header text in white
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(255, 255, 255);
    
    // Header columns
    this.pdf.text('Risk Category', currentX + 2, this.currentY + 6);
    currentX += colWidths.category;
    this.pdf.text('Management Strategies & Requirements', currentX + 2, this.currentY + 6);
    
    this.currentY += headerHeight;
    
    // Draw table border
    this.pdf.setDrawColor(43, 75, 115);
    this.pdf.setLineWidth(0.5);
    this.pdf.rect(tableStartX, this.currentY - headerHeight, tableWidth, headerHeight, 'S');
    
    // Table rows
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(60, 60, 60);
    this.pdf.setFontSize(8);
    
    let rowIndex = 0;
    
    // First, handle risk parameters array (new format)
    const riskParameters = mealtimeData.riskParameters || [];
    if (Array.isArray(riskParameters) && riskParameters.length > 0) {
      riskParameters.forEach((risk: any) => {
        if (risk.preventionStrategy || risk.responseStrategy || risk.equipmentNeeded || risk.staffTraining) {
          this.checkPageBreak(rowHeight + 2);
          
          const isEvenRow = rowIndex % 2 === 0;
          if (isEvenRow) {
            this.pdf.setFillColor(248, 250, 252); // Very light blue background
            this.pdf.rect(tableStartX, this.currentY, tableWidth, rowHeight, 'F');
          }
          
          currentX = tableStartX;
          const textY = this.currentY + 6;
          
          // Category column with colored indicator based on severity
          const severityColors = {
            'low': [34, 197, 94], // Green/Low
            'medium': [245, 158, 11], // Amber/Medium
            'high': [220, 38, 127] // Red/High
          };
          
          const categoryColor = severityColors[risk.severity as keyof typeof severityColors] || [245, 158, 11];
          this.pdf.setFillColor(categoryColor[0], categoryColor[1], categoryColor[2]);
          this.pdf.rect(currentX + 1, this.currentY + 2, 3, rowHeight - 4, 'F');
          
          this.pdf.setFontSize(8);
          this.pdf.setFont('helvetica', 'bold');
          this.pdf.setTextColor(60, 60, 60);
          
          const riskTypeLabels = {
            'choking': 'Choking Risk',
            'aspiration': 'Aspiration Risk',
            'swallowing': 'Swallowing Difficulties',
            'allergies': 'Food Allergies',
            'medications': 'Medication Interactions',
            'behavioral': 'Behavioral Concerns',
            'cultural': 'Cultural/Religious',
            'texture': 'Texture Intolerance'
          };
          
          const categoryLabel = riskTypeLabels[risk.type as keyof typeof riskTypeLabels] || risk.type || 'Risk Management';
          this.pdf.text(categoryLabel, currentX + 6, textY);
          currentX += colWidths.category;
          
          // Content column with combined risk management details
          this.pdf.setFont('helvetica', 'normal');
          let contentText = '';
          if (risk.preventionStrategy) contentText += `Prevention: ${risk.preventionStrategy}`;
          if (risk.responseStrategy) contentText += (contentText ? ' | ' : '') + `Response: ${risk.responseStrategy}`;
          if (risk.equipmentNeeded) contentText += (contentText ? ' | ' : '') + `Equipment: ${risk.equipmentNeeded}`;
          if (risk.staffTraining) contentText += (contentText ? ' | ' : '') + `Training: ${risk.staffTraining}`;
          
          const contentLines = this.pdf.splitTextToSize(contentText, colWidths.content - 4);
          
          if (contentLines.length > 1) {
            // Handle multi-line content
            let lineY = textY;
            contentLines.forEach((line: string, lineIndex: number) => {
              if (lineIndex > 0) {
                this.checkPageBreak(5);
                lineY += 4;
                // Extend row height for multi-line content
                if (isEvenRow) {
                  this.pdf.setFillColor(248, 250, 252);
                  this.pdf.rect(tableStartX, this.currentY + (lineIndex * 4), tableWidth, 4, 'F');
                }
              }
              this.pdf.text(line, currentX + 2, lineY);
            });

          } else {
            this.pdf.text(contentText, currentX + 2, textY);
          }
          
          // Draw row border
          this.pdf.setDrawColor(200, 200, 200);
          this.pdf.setLineWidth(0.2);
          this.pdf.rect(tableStartX, rowStartY, tableWidth, actualRowHeight, 'S');
          
          this.currentY = rowStartY + actualRowHeight;
          rowIndex++;
        }
      });
    }

    // CRITICAL FIX: Handle new riskAssessments object format (my implementation)
    const riskAssessments = mealtimeData.riskAssessments || {};
    if (typeof riskAssessments === 'object' && Object.keys(riskAssessments).length > 0) {
      Object.entries(riskAssessments).forEach(([riskType, riskData]: [string, any]) => {
        if (riskData && (riskData.preventionStrategy || riskData.responseStrategy || riskData.equipmentNeeded || riskData.staffTraining)) {
          this.checkPageBreak(rowHeight + 2);
          
          const isEvenRow = rowIndex % 2 === 0;
          if (isEvenRow) {
            this.pdf.setFillColor(248, 250, 252); // Very light blue background
            this.pdf.rect(tableStartX, this.currentY, tableWidth, rowHeight, 'F');
          }
          
          currentX = tableStartX;
          const textY = this.currentY + 6;
          
          // Category column with colored indicator based on severity
          const severityColors = {
            'low': [34, 197, 94], // Green/Low
            'medium': [245, 158, 11], // Amber/Medium
            'high': [220, 38, 127] // Red/High
          };
          
          const categoryColor = severityColors[riskData.severity as keyof typeof severityColors] || [245, 158, 11];
          this.pdf.setFillColor(categoryColor[0], categoryColor[1], categoryColor[2]);
          this.pdf.rect(currentX + 1, this.currentY + 2, 3, rowHeight - 4, 'F');
          
          this.pdf.setFontSize(8);
          this.pdf.setFont('helvetica', 'bold');
          this.pdf.setTextColor(60, 60, 60);
          
          const riskTypeLabels = {
            'choking': 'Choking Risk',
            'aspiration': 'Aspiration Risk',
            'swallowing': 'Swallowing Difficulties',
            'allergies': 'Food Allergies',
            'medications': 'Medication Interactions',
            'behavioral': 'Behavioral Concerns',
            'cultural': 'Cultural/Religious',
            'texture': 'Texture Intolerance'
          };
          
          const categoryLabel = riskTypeLabels[riskType as keyof typeof riskTypeLabels] || riskType || 'Risk Management';
          this.pdf.text(categoryLabel, currentX + 6, textY);
          currentX += colWidths.category;
          
          // Content column with combined risk management details
          this.pdf.setFont('helvetica', 'normal');
          let contentText = '';
          if (riskData.preventionStrategy) contentText += `Prevention: ${riskData.preventionStrategy}`;
          if (riskData.responseStrategy) contentText += (contentText ? ' | ' : '') + `Response: ${riskData.responseStrategy}`;
          if (riskData.equipmentNeeded) contentText += (contentText ? ' | ' : '') + `Equipment: ${riskData.equipmentNeeded}`;
          if (riskData.staffTraining) contentText += (contentText ? ' | ' : '') + `Training: ${riskData.staffTraining}`;
          
          const contentLines = this.pdf.splitTextToSize(contentText, colWidths.content - 4);
          
          if (contentLines.length > 1) {
            // Handle multi-line content
            let lineY = textY;
            contentLines.forEach((line: string, lineIndex: number) => {
              if (lineIndex > 0) {
                this.checkPageBreak(5);
                lineY += 4;
                // Extend row height for multi-line content
                if (isEvenRow) {
                  this.pdf.setFillColor(248, 250, 252);
                  this.pdf.rect(tableStartX, this.currentY + (lineIndex * 4), tableWidth, 4, 'F');
                }
              }
              this.pdf.text(line, currentX + 2, lineY);
            });

          } else {
            this.pdf.text(contentText, currentX + 2, textY);
          }
          
          // Draw row border
          this.pdf.setDrawColor(200, 200, 200);
          this.pdf.setLineWidth(0.2);
          this.pdf.rect(tableStartX, rowStartY, tableWidth, actualRowHeight, 'S');
          
          this.currentY = rowStartY + actualRowHeight;
          rowIndex++;
        }
      });
    }
    
    // Add general mealtime fields as separate rows if they exist
    const generalMealtimeFields = [
      { key: 'dietaryRequirements', label: 'Dietary Requirements', color: [34, 197, 94] },
      { key: 'textureModifications', label: 'Texture Modifications', color: [245, 158, 11] },
      { key: 'assistanceLevel', label: 'Assistance Level', color: [245, 158, 11] },
      { key: 'mealtimeEnvironment', label: 'Mealtime Environment', color: [34, 197, 94] },
      { key: 'emergencyProcedures', label: 'Emergency Procedures', color: [220, 38, 127] }
    ];
    
    generalMealtimeFields.forEach((field) => {
      const content = mealtimeData[field.key];
      if (content && content.trim()) {
        this.checkPageBreak(rowHeight + 2);
        
        const isEvenRow = rowIndex % 2 === 0;
        if (isEvenRow) {
          this.pdf.setFillColor(248, 250, 252);
          this.pdf.rect(tableStartX, this.currentY, tableWidth, rowHeight, 'F');
        }
        
        currentX = tableStartX;
        const textY = this.currentY + 6;
        
        // Category column with colored indicator
        this.pdf.setFillColor(field.color[0], field.color[1], field.color[2]);
        this.pdf.rect(currentX + 1, this.currentY + 2, 3, rowHeight - 4, 'F');
        
        this.pdf.setFontSize(8);
        this.pdf.setFont('helvetica', 'bold');
        this.pdf.setTextColor(60, 60, 60);
        this.pdf.text(field.label, currentX + 6, textY);
        currentX += colWidths.category;
        
        // Content column with text wrapping
        this.pdf.setFont('helvetica', 'normal');
        const contentLines = this.pdf.splitTextToSize(content, colWidths.content - 4);
        
        if (contentLines.length > 1) {
          let lineY = textY;
          contentLines.forEach((line: string, lineIndex: number) => {
            if (lineIndex > 0) {
              this.checkPageBreak(5);
              lineY += 4;
              if (isEvenRow) {
                this.pdf.setFillColor(248, 250, 252);
                this.pdf.rect(tableStartX, this.currentY + (lineIndex * 4), tableWidth, 4, 'F');
              }
            }
            this.pdf.text(line, currentX + 2, lineY);
          });
          this.currentY += (contentLines.length - 1) * 4;
        } else {
          this.pdf.text(content, currentX + 2, textY);
        }
        
        // Draw row border
        this.pdf.setDrawColor(200, 200, 200);
        this.pdf.setLineWidth(0.2);
        const actualRowHeight = rowHeight + ((contentLines.length - 1) * 4);
        this.pdf.rect(tableStartX, this.currentY, tableWidth, actualRowHeight, 'S');
        
        this.currentY += rowHeight;
        rowIndex++;
      }
    });
    
    // Then handle legacy individual fields (old format)
    const mealtimeCategories = [
      { key: 'dietaryRequirements', label: 'Dietary Requirements', color: [220, 38, 127] }, // Red/Protective
      { key: 'textureModifications', label: 'Texture Modifications', color: [245, 158, 11] }, // Amber/Reactive
      { key: 'assistanceLevel', label: 'Assistance Level', color: [34, 197, 94] }, // Green/Proactive
      { key: 'mealtimeEnvironment', label: 'Mealtime Environment', color: [168, 85, 247] }, // Purple
      { key: 'emergencyProcedures', label: 'Emergency Procedures', color: [220, 38, 127] }, // Red/Protective
      { key: 'staffGuidance', label: 'Staff Guidance', color: [99, 102, 241] }, // Blue
      { key: 'monitoringRequirements', label: 'Monitoring Requirements', color: [14, 165, 233] }, // Light Blue
      { key: 'equipmentNeeds', label: 'Equipment Needs', color: [245, 158, 11] }, // Amber
      { key: 'socialAspects', label: 'Social Aspects', color: [99, 102, 241] }, // Blue
      { key: 'nutritionalConsiderations', label: 'Nutritional Considerations', color: [14, 165, 233] } // Light Blue
    ];
    
    mealtimeCategories.forEach((category) => {
      const content = mealtimeData[category.key];
      if (content) {
        this.checkPageBreak(rowHeight + 2);
        
        // Store the row start position
        const rowStartY = this.currentY;
        
        // Calculate actual content height first
        this.pdf.setFont('helvetica', 'normal');
        const contentLines = this.pdf.splitTextToSize(content, colWidths.content - 4);
        const actualRowHeight = rowHeight + ((contentLines.length - 1) * 4);
        
        const isEvenRow = rowIndex % 2 === 0;
        if (isEvenRow) {
          this.pdf.setFillColor(248, 250, 252); // Very light blue background
          this.pdf.rect(tableStartX, rowStartY, tableWidth, actualRowHeight, 'F');
        }
        
        currentX = tableStartX;
        const textY = rowStartY + 6;
        
        // Category column with colored indicator
        this.pdf.setFillColor(category.color[0], category.color[1], category.color[2]);
        this.pdf.rect(currentX + 1, rowStartY + 2, 3, actualRowHeight - 4, 'F');
        
        this.pdf.setFontSize(8);
        this.pdf.setFont('helvetica', 'bold');
        this.pdf.setTextColor(60, 60, 60);
        this.pdf.text(category.label, currentX + 6, textY);
        currentX += colWidths.category;
        
        // Content column with text wrapping
        this.pdf.setFont('helvetica', 'normal');
        
        if (contentLines.length > 1) {
          // Handle multi-line content
          let lineY = textY;
          contentLines.forEach((line: string, lineIndex: number) => {
            if (lineIndex > 0) {
              this.checkPageBreak(5);
              lineY += 4;
            }
            this.pdf.text(line, currentX + 2, lineY);
          });
        } else {
          this.pdf.text(content, currentX + 2, textY);
        }
        
        // Draw row border
        this.pdf.setDrawColor(200, 200, 200);
        this.pdf.setLineWidth(0.2);
        this.pdf.rect(tableStartX, rowStartY, tableWidth, actualRowHeight, 'S');
        
        this.currentY = rowStartY + actualRowHeight;
        rowIndex++;
      }
    });
    
    // Draw final table border
    this.pdf.setDrawColor(43, 75, 115);
    this.pdf.setLineWidth(0.5);
    const totalRows = rowIndex;
    this.pdf.rect(tableStartX, this.currentY - (totalRows * rowHeight) - headerHeight, tableWidth, (totalRows * rowHeight) + headerHeight, 'S');
    
    this.currentY += 10; // Extra spacing after table
    
    // Reset styles
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.setDrawColor(0, 0, 0);
    this.pdf.setLineWidth(0.2);
  }

  private savePDF(filename: string): void {
    this.pdf.save(filename);
  }
}

export async function exportCarePlanToPDF(plan: any, client: any, user: any): Promise<void> {
  // Always fetch fresh company name from API to ensure we have the latest tenant-specific data
  let companyName = 'NeedCareAI+'; // Default fallback
  
  try {
    // Use the company API endpoint to get tenant-specific company name
    const response = await fetch('/api/company');
    if (response.ok) {
      const companyData = await response.json();
      if (companyData?.name) {
        companyName = companyData.name;
        console.log('PDF Export: Using tenant company name:', companyName);
      }
    } else {
      console.warn('API company endpoint returned:', response.status);
      // Fallback to user endpoint if company endpoint fails
      const userResponse = await fetch('/api/user');
      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData?.companyName) {
          companyName = userData.companyName;
        }
      }
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

  // Create PDF utility instance to access validation methods
  const pdfUtil = new PDFExportUtility();

  // Section 1: About Me with colored boxes
  sections.push({
    title: 'About Me',
    content: pdfUtil.validateAndSanitizeData(plan.aboutMeData || {}, 'about_me'),
    type: 'about_me'
  });

  // Section 2: Goals & Outcomes with colored boxes
  sections.push({
    title: 'Goals & Outcomes',
    content: pdfUtil.validateAndSanitizeData(plan.goalsData || {}, 'goals'),
    type: 'goals_outcomes'
  });

  // Section 3: Activities of Daily Living Support with colored boxes
  sections.push({
    title: 'Activities of Daily Living Support',
    content: pdfUtil.validateAndSanitizeData(plan.adlData || {}, 'adl'),
    type: 'adl_support'
  });

  // Section 4: Structure & Routine with colored boxes
  sections.push({
    title: 'Structure & Routine',
    content: pdfUtil.validateAndSanitizeData(plan.structureData || {}, 'structure'),
    type: 'structure_routine'
  });

  // Section 5: Communication Support with colored boxes
  sections.push({
    title: 'Communication Support',
    content: pdfUtil.validateAndSanitizeData(plan.communicationData || {}, 'communication'),
    type: 'communication_support'
  });

  // Section 6: Behaviour Support - Custom handling with colored boxes
  sections.push({
    title: 'Behaviour Support',
    content: pdfUtil.validateAndSanitizeData(plan.behaviourData || {}, 'behaviour'),
    type: 'behaviour_support'
  });

  // Section 7: Disaster Management with colored boxes
  // CRITICAL DATA INTEGRITY CHECK: Validate disaster data before PDF export
  const disasterDataForPDF = pdfUtil.validateAndSanitizeData(plan.disasterData || {}, 'disaster');
  
  sections.push({
    title: 'Disaster Management',
    content: disasterDataForPDF,
    type: 'disaster_management'
  });

  // Section 8: Mealtime Management with colored boxes
  // CRITICAL DATA INTEGRITY CHECK: Validate mealtime data before PDF export
  const mealtimeDataForPDF = pdfUtil.validateAndSanitizeData(plan.mealtimeData || {}, 'mealtime');
  
  sections.push({
    title: 'Mealtime Management',
    content: mealtimeDataForPDF,
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
    planId: plan.id || 'Unknown',
    filename: `care-plan-${plan.planTitle?.replace(/[^a-zA-Z0-9]/g, '-') || 'untitled'}.pdf`
  };

  await pdfUtil.generateStructuredPDF(options, sections);
}