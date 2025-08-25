/**
 * Comprehensive NDIS Referral Form API Routes
 * Handles JWT-secured public referral links and form submissions
 */

import { Router } from "express";
import { z } from "zod";
import { signReferralToken, verifyReferralToken } from "../lib/referralToken";
import { db } from "../lib/dbClient";
import { referralLinks, referralSubmissions } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

// Temporary in-memory storage for referral links and submissions
import { storage } from "../storage";

// Initialize with sample data
const initializeSampleData = () => {
  // Sample referral submissions for testing
  const sampleSubmissions = [
    {
      id: "ref-001",
      tenantId: 19, // Fred's tenant
      clientName: "Sarah Johnson",
      referrerName: "Dr. Michael Chen",
      referrerOrg: "Melbourne Health Services",
      submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      status: "pending",
      dateOfReferral: new Date().toISOString().split('T')[0],
      supportCategories: ["Personal Care", "Community Access", "Daily Living Skills"],
      howWeSupport: ["1:1 Support", "Group Activities", "Skill Development"],
      aboutParticipant: "Sarah is a 28-year-old woman with intellectual disability seeking support to develop independent living skills and community participation. She enjoys art and music activities.",
      medicalConditions: "Mild intellectual disability, epilepsy (well controlled with medication)",
      ndisNumber: "430012345678",
      planStart: "2025-01-01",
      planEnd: "2025-12-31",
      behaviours: [
        {
          behaviour: "Anxiety in new environments",
          trigger: "Large crowds or loud noises",
          management: "Provide advance notice, use calming techniques, gradual exposure"
        }
      ]
    },
    {
      id: "ref-002", 
      tenantId: 19,
      clientName: "James Mitchell",
      referrerName: "Lisa Thompson",
      referrerOrg: "NDIS Support Coordinator",
      submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      status: "under-review",
      dateOfReferral: new Date().toISOString().split('T')[0],
      supportCategories: ["Community Access", "Employment Support", "Transport"],
      howWeSupport: ["Job Coaching", "Community Participation", "Travel Training"],
      aboutParticipant: "James is a 35-year-old man with autism who is looking to gain employment and increase his independence in the community.",
      medicalConditions: "Autism Spectrum Disorder, anxiety disorder",
      ndisNumber: "430098765432",
      planStart: "2025-02-01",
      planEnd: "2026-01-31",
      assessment: {
        organizationalCapacity: "yes",
        skillsetCapacity: "yes", 
        fundingSufficient: "yes",
        restrictivePractice: "no",
        manualHandling: "no",
        medicationManagement: "no",
        supportOverview: "James will benefit from structured employment support and community access programs. Our team has experience working with individuals with autism and can provide the specialized support he needs.",
        decision: "training",
        referralPathway: "Recommend additional autism-specific training for support workers before proceeding to full intake."
      }
    },
    {
      id: "ref-003",
      tenantId: 19, 
      clientName: "Emma Williams",
      referrerName: "Dr. Amanda Foster",
      referrerOrg: "Royal Children's Hospital",
      submittedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      status: "approved",
      dateOfReferral: new Date().toISOString().split('T')[0],
      supportCategories: ["Personal Care", "Respite Care", "Therapy Support"],
      howWeSupport: ["Personal Care Assistance", "Family Respite", "Allied Health Support"],
      aboutParticipant: "Emma is a 16-year-old with cerebral palsy requiring personal care support and respite for her family.",
      medicalConditions: "Cerebral palsy (spastic quadriplegia), intellectual disability, gastrostomy tube feeding",
      ndisNumber: "430034567890",
      planStart: "2025-03-01",
      planEnd: "2025-02-28",
      behaviours: [],
      assessment: {
        organizationalCapacity: "yes",
        skillsetCapacity: "yes",
        fundingSufficient: "yes", 
        restrictivePractice: "no",
        manualHandling: "yes",
        medicationManagement: "yes",
        supportOverview: "Emma requires complex care including manual handling and gastrostomy care. Our nursing staff are qualified to provide this level of support safely.",
        decision: "proceed",
      }
    }
  ];

  // Sample data now stored in database instead of memory
  console.log('[REFERRAL] Sample data initialization disabled - using database storage');
};

// Behaviour item schema for validation - defensive with field mapping
const BehaviourItem = z.object({
  behaviour: z.string().transform(s => s.trim()),
  trigger: z.string().optional(),
  management: z.string().optional(),
  managementStrategy: z.string().optional(), // Accept both field names
}).passthrough() // Allow extra keys without failing
.transform(b => ({
  behaviour: (b.behaviour ?? "").trim(),
  trigger: (b.trigger ?? "").trim() || undefined,
  management: (b.management ?? b.managementStrategy ?? "").trim() || undefined,
}));

// Comprehensive NDIS referral form schema
export const ReferralFormSchema = z.object({
  // Header + flags
  dateOfReferral: z.string().transform((s) => new Date(s)),
  clientStatus: z.enum(["New", "Returning"]),
  
  // Referrer
  referrerName: z.string().min(1, "Referrer name is required"),
  referrerOrg: z.string().optional(),
  referrerPosition: z.string().optional(),
  referrerPhoneEmail: z.string().optional(),
  
  // Participant basics
  clientName: z.string().min(1, "Client name is required"),
  dob: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  
  // Emergency
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
  emergencyAddress: z.string().optional(),
  emergencyEmail: z.string().optional(),
  
  // Type of support required
  supportCategories: z.array(z.enum([
    "MultipleComplexDisability",
    "ForensicsSDAFunded",
    "ForensicsOutreach",
    "NonComplexSupport",
    "ForensicsPrivateRental"
  ])).nullable().optional(),
  planManagement: z.array(z.enum(["PlanManagement"])).nullable().optional(),
  howWeSupport: z.array(z.enum([
    "ADL",
    "HandsOnSupervision",
    "LegalOrderCompliance",
    "PersonalCare",
    "CommunityAccess",
    "TransportTraining",
    "SocialGroupActivity",
    "BehaviouralManagement",
    "CompanionshipMentorship",
    "RestrictivePracticeImplementation"
  ])).nullable().optional(),
  
  // Strengths and profile
  participantStrengths: z.string().optional(),
  ndisSupportAsFunded: z.string().optional(),
  shiftDays: z.string().optional(),
  shiftTimes: z.string().optional(),
  preferredGender: z.enum(["Male","Female","Other","No"]).optional(),
  requiredSkillSet: z.string().optional(),
  aboutParticipant: z.string().optional(),
  likes: z.string().optional(),
  dislikes: z.string().optional(),
  
  // Medical
  medicalConditions: z.string().optional(),
  medications: z.array(z.object({
    name: z.string().transform(s => s.trim()),
    dosage: z.string().optional(),
    frequency: z.string().optional()
  })).nullable().optional()
    .transform(medications => 
      Array.isArray(medications) 
        ? medications.filter(m => m.name.length > 0) // Filter out empty medications
        : medications
    ),
  medicationSideEffects: z.string().optional(),
  
  // New behavior structure
  behaviourTypes: z.array(z.string()).optional(),
  behaviourTriggers: z.array(z.string()).optional(),
  behaviourOverview: z.string().nullable().optional(),
  
  // Legacy behavior array (kept for compatibility)
  behaviours: z.array(BehaviourItem).nullable().optional()
    .transform(behaviours => 
      Array.isArray(behaviours) 
        ? behaviours.filter(b => b.behaviour.length > 0) // Filter out empty behaviours
        : behaviours
    ),
  
  // Funding
  ndisNumber: z.string().optional(),
  planStart: z.string().optional(),
  planEnd: z.string().optional(),
  fundManagementType: z.enum(["NDIA","Self","Plan"]).optional(),
  
  // Fund Details with current balances
  coreCurrentBalance: z.string().optional(),
  coreFundedAmount: z.string().optional(),
  silCurrentBalance: z.string().optional(),
  silFundedAmount: z.string().optional(),
  irregularSilCurrentBalance: z.string().optional(),
  irregularSilFundedAmount: z.string().optional(),
  otherCurrentBalance: z.string().optional(),
  otherFundedAmount: z.string().optional(),
  
  // Invoice details
  invoiceName: z.string().optional(),
  invoiceEmail: z.string().email().optional().or(z.literal("")),
  invoicePhone: z.string().optional(),
  invoiceAddress: z.string().optional(),
});

// POST /api/referrals/links - Create a new shareable link (internal, auth required)
router.post("/links", async (req, res) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { expiresAt, maxUses } = req.body;
    const tenantId = user.tenantId;

    // Generate a simple incremental link ID for the token
    const tempLinkId = Math.floor(Math.random() * 1000000);

    // Generate JWT token with temporary link ID and tenant ID
    const token = signReferralToken({ 
      linkId: tempLinkId.toString(), 
      tenantId 
    });

    // Create link record in database with the generated token
    const link = await storage.createReferralLink({
      tenantId,
      accessCode: token,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      maxUses: maxUses || null,
      currentUses: 0,
      isActive: true,
      createdBy: user.id
    });

    // Return the shareable URL using Replit's public domain
    const baseUrl = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS}` 
      : `https://${process.env.REPL_SLUG || 'app'}.${process.env.REPL_OWNER || 'replit'}.replit.dev`;
    
    res.json({
      id: link.id,
      url: `${baseUrl}/share/referral/${token}`,
      token,
      expiresAt: link.expiresAt,
      maxUses: link.maxUses,
    });
  } catch (error) {
    console.error("Create referral link error:", error);
    res.status(500).json({ error: "Failed to create referral link" });
  }
});

// GET /api/referrals/links/:token - Validate link (public)
router.get("/links/:token", async (req, res) => {
  try {
    const payload = verifyReferralToken(req.params.token);
    
    // Get link from database by token
    const link = await storage.getReferralLinkByToken(req.params.token);
    
    if (!link) {
      return res.status(404).json({ error: "invalid-link" });
    }
    
    if (link.expiresAt && new Date() > link.expiresAt) {
      return res.status(410).json({ error: "expired" });
    }
    
    if (link.maxUses && (link.currentUses || 0) >= link.maxUses) {
      return res.status(429).json({ error: "link-usage-exceeded" });
    }
    
    if (!link.isActive) {
      return res.status(403).json({ error: "link-disabled" });
    }
    
    res.json({ 
      ok: true,
      tenantId: payload.tenantId 
    });
  } catch (error) {
    console.error("Validate referral link error:", error);
    res.status(400).json({ error: "bad-token" });
  }
});

// POST /api/referrals/submit/:token - Submit referral (public)
router.post("/submit/:token", async (req, res) => {
  try {
    const payload = verifyReferralToken(req.params.token);
    
    // Get link from database by token, not by linkId
    const link = await storage.getReferralLinkByToken(req.params.token);
    
    if (!link) {
      return res.status(404).json({ error: "invalid-link" });
    }
    
    if (link.expiresAt && new Date() > link.expiresAt) {
      return res.status(410).json({ error: "expired" });
    }
    
    if (link.maxUses && (link.currentUses || 0) >= link.maxUses) {
      return res.status(429).json({ error: "link-usage-exceeded" });
    }
    
    if (!link.isActive) {
      return res.status(403).json({ error: "link-disabled" });
    }

    // Debug the incoming request data
    console.log('[REFERRAL] Raw behavior data received:', JSON.stringify(req.body.behaviours, null, 2));
    console.log('[REFERRAL] Raw medication data received:', JSON.stringify(req.body.medications, null, 2));
    
    // Validate the form data
    const parsed = ReferralFormSchema.parse(req.body);
    
    // Create the referral submission in database
    const referral = await storage.createReferralSubmission({
      tenantId: payload.tenantId,
      linkId: link.id,
      dateOfReferral: new Date(parsed.dateOfReferral),
      isNewClient: parsed.clientStatus === "New",
      isReturningClient: parsed.clientStatus === "Returning",
      referrerName: parsed.referrerName,
      referrerOrg: parsed.referrerOrg,
      referrerPosition: parsed.referrerPosition,
      referrerContact: parsed.referrerPhoneEmail,
      clientName: parsed.clientName,
      dob: parsed.dob ? new Date(parsed.dob) : null,
      address: parsed.address,
      phone: parsed.phone,
      emergencyName: parsed.emergencyName,
      emergencyPhone: parsed.emergencyPhone,
      emergencyAddress: parsed.emergencyAddress,
      emergencyEmail: parsed.emergencyEmail,
      supportCategories: Array.isArray(parsed.supportCategories) && parsed.supportCategories.length > 0 ? parsed.supportCategories : null,
      planManagement: Array.isArray(parsed.planManagement) && parsed.planManagement.length > 0 ? parsed.planManagement : null,
      howWeSupport: Array.isArray(parsed.howWeSupport) && parsed.howWeSupport.length > 0 ? parsed.howWeSupport : null,
      participantStrengths: parsed.participantStrengths,
      ndisSupportAsFunded: parsed.ndisSupportAsFunded,
      shiftDays: parsed.shiftDays,
      shiftTimes: parsed.shiftTimes,
      preferredGender: parsed.preferredGender,
      requiredSkillSet: parsed.requiredSkillSet,
      aboutParticipant: parsed.aboutParticipant,
      likes: parsed.likes,
      dislikes: parsed.dislikes,
      medicalConditions: parsed.medicalConditions,
      medications: parsed.medications,
      medicationSideEffects: parsed.medicationSideEffects,
      
      // NEW: Behavior fields - map correctly to database columns
      behaviourType: Array.isArray(parsed.behaviourTypes) && parsed.behaviourTypes.length > 0 ? parsed.behaviourTypes.join(', ') : null,
      behaviourTriggers: Array.isArray(parsed.behaviourTriggers) && parsed.behaviourTriggers.length > 0 ? parsed.behaviourTriggers : null,
      behaviourOverview: parsed.behaviourOverview,
      
      // Legacy behavior fields
      behaviours: Array.isArray(parsed.behaviours) && parsed.behaviours.length > 0 ? parsed.behaviours : null,
      ndisNumber: parsed.ndisNumber,
      planStart: parsed.planStart ? new Date(parsed.planStart) : null,
      planEnd: parsed.planEnd ? new Date(parsed.planEnd) : null,
      fundManagementType: parsed.fundManagementType,
      
      // Fund balance fields
      coreCurrentBalance: parsed.coreCurrentBalance,
      coreFundedAmount: parsed.coreFundedAmount,
      silCurrentBalance: parsed.silCurrentBalance,
      silFundedAmount: parsed.silFundedAmount,
      irregularSilCurrentBalance: parsed.irregularSilCurrentBalance,
      irregularSilFundedAmount: parsed.irregularSilFundedAmount,
      otherCurrentBalance: parsed.otherCurrentBalance,
      otherFundedAmount: parsed.otherFundedAmount,
      
      invoiceName: parsed.invoiceName,
      invoiceEmail: parsed.invoiceEmail,
      invoicePhone: parsed.invoicePhone,
      invoiceAddress: parsed.invoiceAddress,
      source: "web-form",
      status: "pending"
    });

    // Increment link usage
    await storage.incrementReferralLinkUsage(link.id);

    console.log(`[REFERRAL] New submission received for tenant ${payload.tenantId}: ${parsed.clientName}`);

    res.status(201).json({ 
      id: referral.id,
      message: "Referral submitted successfully" 
    });
  } catch (error) {
    console.error("Submit referral error:", error);
    
    if (error instanceof z.ZodError) {
      console.error("Validation errors:", error.issues);
      return res.status(400).json({ 
        error: "invalid-payload",
        issues: error.issues // Show validation details for debugging
      });
    }
    
    res.status(500).json({ error: "server-error" });
  }
});

// GET /api/referrals - Get all referrals for tenant (internal, auth required)
router.get("/", async (req, res) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get submissions from database for this tenant
    const submissions = await storage.getReferralSubmissions(user.tenantId);
    res.json(submissions);
  } catch (error) {
    console.error("Get referrals error:", error);
    res.status(500).json({ error: "Failed to fetch referrals" });
  }
});

// GET /api/referrals/:id - Get specific referral (internal, auth required)
router.get("/:id", async (req, res) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get from database storage
    const referral = await storage.getReferralSubmission(parseInt(req.params.id), user.tenantId);
    
    if (!referral) {
      return res.status(404).json({ error: "Referral not found" });
    }

    res.json(referral);
  } catch (error) {
    console.error("Get referral error:", error);
    res.status(500).json({ error: "Failed to fetch referral" });
  }
});

// POST /api/referrals/:id/assessment - Submit assessment (internal, auth required)
router.post("/:id/assessment", async (req, res) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get referral from database
    const referral = await storage.getReferralSubmission(parseInt(req.params.id), user.tenantId);
    
    if (!referral) {
      return res.status(404).json({ error: "Referral not found" });
    }

    // Update referral with assessment data in database
    const assessmentData = req.body;
    console.log("Assessment data received:", assessmentData);

    // Determine status based on decision
    const newStatus = assessmentData.decision === "proceed" ? "approved" : 
                     assessmentData.decision === "decline" ? "declined" : "under-review";

    // Update the referral in the database with assessment and new status
    const updatedReferral = await storage.updateReferralSubmissionStatus(
      parseInt(req.params.id), 
      user.tenantId, 
      newStatus, 
      assessmentData
    );

    if (!updatedReferral) {
      return res.status(500).json({ error: "Failed to update referral assessment" });
    }

    console.log(`[REFERRAL] Assessment completed for referral ${req.params.id} by ${user.username}`);
    
    res.json({ 
      message: "Assessment saved successfully",
      referral: updatedReferral 
    });
  } catch (error) {
    console.error("Assessment submission error:", error);
    res.status(500).json({ error: "Failed to save assessment" });
  }
});

// GET /api/referrals/:id/pdf - Export referral as PDF (internal, auth required)
router.get("/:id/pdf", async (req, res) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get referral from database
    const referral = await storage.getReferralSubmission(parseInt(req.params.id), user.tenantId);
    
    if (!referral) {
      return res.status(404).json({ error: "Referral not found" });
    }

    // Generate proper PDF using jsPDF
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    
    // Generate PDF content
    generateReferralPDF(doc, referral);
    
    // Get PDF as buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="referral-${req.params.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("PDF generation error:", error);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

// Helper function to generate professional PDF using jsPDF (matching invoice style)
function generateReferralPDF(doc: any, referral: any): void {
  // TUSK-inspired color palette (matching invoice PDFs)
  const COLORS = {
    deepNavy: '#2B4C7E',     // Deep Navy
    warmGold: '#D4AF37',     // Warm Gold
    sageGreen: '#87A96B',    // Sage Green
    cream: '#F5F5DC',        // Cream
    lightGray: '#F8F9FA',
    darkGray: '#6B7280',
    black: '#1F2937'
  };

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  let yPosition = 20;

  // Helper function to check for page break and add new page
  const checkPageBreak = (requiredSpace: number = 20) => {
    if (yPosition > pageHeight - requiredSpace - 40) {
      addFooter();
      doc.addPage();
      yPosition = 20;
    }
  };

  // Helper function to add styled section header
  const addSectionHeader = (title: string) => {
    checkPageBreak(25);
    
    // Background rectangle for section header
    doc.setFillColor(COLORS.deepNavy);
    doc.rect(margin, yPosition - 3, pageWidth - 2 * margin, 18, 'F');
    
    // Section title text
    doc.setTextColor('#FFFFFF');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(title, margin + 5, yPosition + 8);
    
    yPosition += 25;
    doc.setTextColor(COLORS.black);
  };

  // Helper function to add regular text
  const addText = (label: string, value: string = '', isBold: boolean = false, indent: number = 0) => {
    checkPageBreak();
    
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(10);
    doc.setTextColor(COLORS.black);
    
    if (value) {
      // Label-value pair
      doc.setFont('helvetica', 'bold');
      doc.text(label, margin + indent, yPosition);
      doc.setFont('helvetica', 'normal');
      doc.text(value, margin + indent + 60, yPosition);
    } else {
      // Single text (value is empty, so label contains full text)
      doc.text(label, margin + indent, yPosition);
    }
    
    yPosition += 12;
  };

  // Helper function to add footer
  const addFooter = () => {
    // Footer line
    doc.setDrawColor(COLORS.deepNavy);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30);
    
    doc.setFontSize(8);
    doc.setTextColor(COLORS.darkGray);
    doc.text('Generated by CareConnect NDIS Management System', margin, pageHeight - 22);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth - margin, pageHeight - 22, { align: 'right' });
  };

  // === DOCUMENT HEADER ===
  // Header background
  doc.setFillColor(COLORS.deepNavy);
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  // Company name and title
  doc.setTextColor('#FFFFFF');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('NDIS PARTICIPANT REFERRAL', margin, 20);
  doc.setFontSize(12);
  doc.text('Professional Assessment & Management Report', margin, 35);
  
  yPosition = 60;

  // === REFERRAL OVERVIEW ===
  addSectionHeader('REFERRAL OVERVIEW');
  addText('Referral ID:', `REF-${referral.id}`, true);
  addText('Client Name:', referral.clientName, true);
  addText('Current Status:', referral.status || 'Pending Review', true);
  addText('Date Submitted:', new Date(referral.submittedAt).toLocaleDateString());
  if (referral.dateOfReferral) {
    addText('Referral Date:', new Date(referral.dateOfReferral).toLocaleDateString());
  }
  yPosition += 10;

  // === CLIENT INFORMATION ===
  addSectionHeader('CLIENT INFORMATION');
  addText('Full Name:', referral.clientName);
  if (referral.ndisNumber) addText('NDIS Number:', referral.ndisNumber);
  if (referral.dob) addText('Date of Birth:', new Date(referral.dob).toLocaleDateString());
  if (referral.phone) addText('Phone:', referral.phone);
  if (referral.address) addText('Address:', referral.address);
  
  if (referral.planStart || referral.planEnd) {
    addText('Plan Period:', `${referral.planStart ? new Date(referral.planStart).toLocaleDateString() : 'Not specified'} - ${referral.planEnd ? new Date(referral.planEnd).toLocaleDateString() : 'Ongoing'}`);
  }
  if (referral.fundManagementType) addText('Fund Management:', referral.fundManagementType);
  yPosition += 10;

  // === FUND BALANCES ===
  if (referral.coreCurrentBalance || referral.coreFundedAmount || referral.silCurrentBalance) {
    addSectionHeader('FUND BALANCES');
    if (referral.coreCurrentBalance) addText('Core Current Balance:', referral.coreCurrentBalance);
    if (referral.coreFundedAmount) addText('Core Funded Amount:', referral.coreFundedAmount);
    if (referral.silCurrentBalance) addText('SIL Current Balance:', referral.silCurrentBalance);
    if (referral.silFundedAmount) addText('SIL Funded Amount:', referral.silFundedAmount);
    if (referral.irregularSilCurrentBalance) addText('Irregular SIL Current:', referral.irregularSilCurrentBalance);
    if (referral.irregularSilFundedAmount) addText('Irregular SIL Funded:', referral.irregularSilFundedAmount);
    if (referral.otherCurrentBalance) addText('Other Current Balance:', referral.otherCurrentBalance);
    if (referral.otherFundedAmount) addText('Other Funded Amount:', referral.otherFundedAmount);
    yPosition += 10;
  }

  // === REFERRER INFORMATION ===
  addSectionHeader('REFERRER INFORMATION');
  addText('Referrer Name:', referral.referrerName);
  if (referral.referrerOrg) addText('Organization:', referral.referrerOrg);
  if (referral.referrerPosition) addText('Position:', referral.referrerPosition);
  if (referral.referrerContact) addText('Contact Details:', referral.referrerContact);
  yPosition += 10;

  // === SUPPORT REQUIREMENTS ===
  if (referral.supportCategories?.length || referral.howWeSupport?.length) {
    addSectionHeader('SUPPORT REQUIREMENTS');
    if (referral.supportCategories?.length) {
      addText('Support Categories:', '');
      referral.supportCategories.forEach((category: string) => {
        addText(`• ${category}`, '', false, 10);
      });
    }
    if (referral.howWeSupport?.length) {
      addText('How We Support:', '');
      referral.howWeSupport.forEach((support: string) => {
        addText(`• ${support}`, '', false, 10);
      });
    }
    yPosition += 10;
  }

  // === PARTICIPANT DETAILS ===
  if (referral.aboutParticipant || referral.participantStrengths || referral.likes || referral.dislikes) {
    addSectionHeader('PARTICIPANT DETAILS');
    if (referral.aboutParticipant) addText('About Participant:', referral.aboutParticipant);
    if (referral.participantStrengths) addText('Strengths:', referral.participantStrengths);
    if (referral.likes) addText('Likes/Interests:', referral.likes);
    if (referral.dislikes) addText('Dislikes/Concerns:', referral.dislikes);
    if (referral.preferredGender) addText('Preferred Gender:', referral.preferredGender);
    if (referral.requiredSkillSet) addText('Required Skill Set:', referral.requiredSkillSet);
    yPosition += 10;
  }

  // === BEHAVIOURS OF CONCERN ===
  if (referral.behaviourType || referral.behaviourTriggers || referral.behaviourOverview) {
    addSectionHeader('BEHAVIOURS OF CONCERN');
    if (referral.behaviourType) addText('Behaviour Types:', referral.behaviourType);
    if (referral.behaviourTriggers) {
      const triggers = Array.isArray(referral.behaviourTriggers) ? referral.behaviourTriggers.join(', ') : referral.behaviourTriggers;
      addText('Behaviour Triggers:', triggers);
    }
    if (referral.behaviourOverview) addText('Overview:', referral.behaviourOverview);
    yPosition += 10;
  }

  // === MEDICAL INFORMATION ===
  if (referral.medicalConditions || (referral.medications?.length > 0) || referral.medicationSideEffects) {
    addSectionHeader('MEDICAL INFORMATION');
    if (referral.medicalConditions) addText('Medical Conditions:', referral.medicalConditions);
    
    if (Array.isArray(referral.medications) && referral.medications.length > 0) {
      addText('Current Medications:', '');
      referral.medications.forEach((med: any) => {
        addText(`• ${med.name}${med.dosage ? ` - ${med.dosage}` : ''}${med.frequency ? ` - ${med.frequency}` : ''}`, '', false, 10);
      });
    }
    
    if (referral.medicationSideEffects) addText('Side Effects:', referral.medicationSideEffects);
    yPosition += 10;
  }

  // === EMERGENCY CONTACT ===
  if (referral.emergencyName || referral.emergencyPhone || referral.emergencyEmail) {
    addSectionHeader('EMERGENCY CONTACT');
    if (referral.emergencyName) addText('Name:', referral.emergencyName);
    if (referral.emergencyPhone) addText('Phone:', referral.emergencyPhone);
    if (referral.emergencyEmail) addText('Email:', referral.emergencyEmail);
    if (referral.emergencyAddress) addText('Address:', referral.emergencyAddress);
    yPosition += 10;
  }

  // === INVOICE DETAILS ===
  if (referral.invoiceName || referral.invoiceEmail || referral.invoicePhone) {
    addSectionHeader('BILLING INFORMATION');
    if (referral.invoiceName) addText('Invoice Name:', referral.invoiceName);
    if (referral.invoiceEmail) addText('Invoice Email:', referral.invoiceEmail);
    if (referral.invoicePhone) addText('Invoice Phone:', referral.invoicePhone);
    if (referral.invoiceAddress) addText('Invoice Address:', referral.invoiceAddress);
    yPosition += 10;
  }

  // === PROFESSIONAL ASSESSMENT ===
  if (referral.assessment) {
    addSectionHeader('PROFESSIONAL ASSESSMENT');
    
    // Decision - highlighted like invoice totals
    checkPageBreak(30);
    doc.setFillColor(referral.assessment.decision === 'proceed' ? COLORS.sageGreen : 
                     referral.assessment.decision === 'decline' ? '#DC2626' : COLORS.warmGold);
    doc.rect(margin, yPosition - 3, pageWidth - 2 * margin, 18, 'F');
    
    doc.setTextColor('#FFFFFF');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`ASSESSMENT DECISION: ${referral.assessment.decision?.toUpperCase()}`, margin + 5, yPosition + 8);
    yPosition += 25;
    
    doc.setTextColor(COLORS.black);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    // Assessment criteria
    if (referral.assessment.organizationalCapacity) addText('Organizational Capacity:', referral.assessment.organizationalCapacity);
    if (referral.assessment.skillsetCapacity) addText('Skillset Capacity:', referral.assessment.skillsetCapacity);
    if (referral.assessment.fundingSufficient) addText('Funding Sufficient:', referral.assessment.fundingSufficient);
    if (referral.assessment.restrictivePractice) addText('Restrictive Practice:', referral.assessment.restrictivePractice);
    if (referral.assessment.manualHandling) addText('Manual Handling:', referral.assessment.manualHandling);
    if (referral.assessment.medicationManagement) addText('Medication Management:', referral.assessment.medicationManagement);
    
    if (referral.assessment.declineReason) addText('Decline Reason:', referral.assessment.declineReason);
    if (referral.assessment.referralPathway) addText('Referral Pathway:', referral.assessment.referralPathway);
    if (referral.assessment.supportOverview && !referral.assessment.supportOverview.includes('http')) {
      addText('Support Overview:', referral.assessment.supportOverview);
    }
    
    yPosition += 10;
  }

  // Add final footer
  addFooter();
}

// DELETE /api/referrals/:id - Hard delete referral form (internal, auth required)
router.delete("/:id", async (req, res) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Check if user has admin role
    const userRole = user.role?.toLowerCase();
    if (!["admin", "consolemanager"].includes(userRole)) {
      return res.status(403).json({ error: "Insufficient permissions. Only Admin and Console Manager roles can delete referral forms." });
    }

    const referralId = parseInt(req.params.id);
    
    // Get the referral first to confirm it exists and belongs to this tenant
    const referral = await storage.getReferralSubmission(referralId, user.tenantId);
    
    if (!referral) {
      return res.status(404).json({ error: "Referral not found" });
    }

    // Perform hard delete from database
    const success = await storage.deleteReferralSubmission(referralId, user.tenantId);
    
    if (!success) {
      return res.status(500).json({ error: "Failed to delete referral" });
    }

    // Log the deletion activity
    await storage.createActivityLog({
      userId: user.id,
      action: "delete_referral_form",
      resourceType: "referral_submission",
      resourceId: referralId,
      description: `Hard deleted referral form for client: ${referral.clientName}`,
      tenantId: user.tenantId,
    });

    console.log(`[REFERRAL] Hard deleted referral ${referralId} by ${user.username} (tenant: ${user.tenantId})`);

    res.json({ 
      success: true,
      message: "Referral form has been permanently deleted" 
    });
  } catch (error) {
    console.error("Delete referral error:", error);
    res.status(500).json({ error: "Failed to delete referral" });
  }
});

export default router;