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

// Behaviour item schema for validation
const BehaviourItem = z.object({
  behaviour: z.string().min(1),
  trigger: z.string().optional(),
  management: z.string().optional(),
});

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
  ])).optional().default([]),
  planManagement: z.array(z.enum(["PlanManagement"])).optional().default([]),
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
  ])).optional().default([]),
  
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
  medications: z.string().optional(),
  medicationSideEffects: z.string().optional(),
  behaviours: z.array(BehaviourItem).optional().default([]),
  
  // Funding
  ndisNumber: z.string().optional(),
  planStart: z.string().optional(),
  planEnd: z.string().optional(),
  fundManagementType: z.enum(["NDIA","Self","Plan"]).optional(),
  
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
    const linkId = randomUUID();
    const tenantId = user.tenantId;

    // Create the link record
    const [link] = await db.insert(referralLinks).values({
      tenantId,
      accessCode: "temp", // Will be updated with JWT
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      maxUses: maxUses || null,
      createdBy: user.id,
    }).returning();

    // Generate JWT token with link ID and tenant ID
    const token = signReferralToken({ 
      linkId: link.id.toString(), 
      tenantId 
    });

    // Update the link with the JWT token
    await db.update(referralLinks)
      .set({ accessCode: token })
      .where(eq(referralLinks.id, link.id));

    // Return the shareable URL
    const baseUrl = process.env.NODE_ENV === "production" 
      ? "https://your-domain.com" 
      : `http://localhost:5000`;
    
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
    
    const [link] = await db.select()
      .from(referralLinks)
      .where(eq(referralLinks.id, parseInt(payload.linkId)));
    
    if (!link) {
      return res.status(404).json({ error: "invalid-link" });
    }
    
    if (link.expiresAt && new Date() > link.expiresAt) {
      return res.status(410).json({ error: "expired" });
    }
    
    if (link.maxUses && link.currentUses >= link.maxUses) {
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
    
    const [link] = await db.select()
      .from(referralLinks)
      .where(eq(referralLinks.id, parseInt(payload.linkId)));
    
    if (!link) {
      return res.status(404).json({ error: "invalid-link" });
    }
    
    if (link.expiresAt && new Date() > link.expiresAt) {
      return res.status(410).json({ error: "expired" });
    }
    
    if (link.maxUses && link.currentUses >= link.maxUses) {
      return res.status(429).json({ error: "link-usage-exceeded" });
    }
    
    if (!link.isActive) {
      return res.status(403).json({ error: "link-disabled" });
    }

    // Validate the form data
    const parsed = ReferralFormSchema.parse(req.body);
    
    // Create the referral submission
    const [referral] = await db.insert(referralSubmissions).values({
      tenantId: payload.tenantId,
      linkId: link.id,
      dateOfReferral: parsed.dateOfReferral,
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
      supportCategories: parsed.supportCategories,
      planManagement: parsed.planManagement,
      howWeSupport: parsed.howWeSupport,
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
      behaviours: parsed.behaviours || [],
      ndisNumber: parsed.ndisNumber,
      planStart: parsed.planStart ? new Date(parsed.planStart) : null,
      planEnd: parsed.planEnd ? new Date(parsed.planEnd) : null,
      fundManagementType: parsed.fundManagementType,
      invoiceName: parsed.invoiceName,
      invoiceEmail: parsed.invoiceEmail,
      invoicePhone: parsed.invoicePhone,
      invoiceAddress: parsed.invoiceAddress,
      source: "web-form",
      status: "pending",
    }).returning();

    // Increment link usage
    await db.update(referralLinks)
      .set({ currentUses: link.currentUses + 1 })
      .where(eq(referralLinks.id, link.id));

    console.log(`[REFERRAL] New submission received for tenant ${payload.tenantId}: ${parsed.clientName}`);

    res.status(201).json({ 
      id: referral.id,
      message: "Referral submitted successfully" 
    });
  } catch (error) {
    console.error("Submit referral error:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "invalid-form-data",
        details: error.errors 
      });
    }
    
    res.status(400).json({ error: "invalid-payload-or-token" });
  }
});

// GET /api/referrals - Get all referrals for tenant (internal, auth required)
router.get("/", async (req, res) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const submissions = await db.select()
      .from(referralSubmissions)
      .where(eq(referralSubmissions.tenantId, user.tenantId))
      .orderBy(referralSubmissions.submittedAt);

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

    const [referral] = await db.select()
      .from(referralSubmissions)
      .where(and(
        eq(referralSubmissions.id, parseInt(req.params.id)),
        eq(referralSubmissions.tenantId, user.tenantId)
      ));

    if (!referral) {
      return res.status(404).json({ error: "Referral not found" });
    }

    res.json(referral);
  } catch (error) {
    console.error("Get referral error:", error);
    res.status(500).json({ error: "Failed to fetch referral" });
  }
});

export default router;