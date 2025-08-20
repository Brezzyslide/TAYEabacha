import { Request, Response } from 'express';
import { db } from '../../../../server/lib/dbClient';
import { referralForms, referralSubmissions, referralLinks, referralAccessLog, users } from '@shared/schema';
import { eq, and, desc, count, sql } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';

// Generate unique access code
function generateAccessCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// Create referral form
export async function createReferralForm(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user || !user.tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { formType, title, description, fieldsSchema, requiresApproval, allowMultipleSubmissions, customBranding } = req.body;

    const newForm = await db.insert(referralForms).values({
      tenantId: user.tenantId,
      formType,
      title,
      description,
      fieldsSchema,
      requiresApproval: requiresApproval || false,
      allowMultipleSubmissions: allowMultipleSubmissions || false,
      customBranding,
      createdBy: user.id
    }).returning();

    console.log(`[REFERRAL FORMS] Created form: ${title} for tenant ${user.tenantId}`);
    res.status(201).json(newForm[0]);
  } catch (error) {
    console.error('[REFERRAL FORMS] Error creating form:', error);
    res.status(500).json({ error: 'Failed to create referral form' });
  }
}

// Get all referral forms for tenant
export async function getReferralForms(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user || !user.tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const forms = await db
      .select({
        id: referralForms.id,
        formType: referralForms.formType,
        title: referralForms.title,
        description: referralForms.description,
        isActive: referralForms.isActive,
        requiresApproval: referralForms.requiresApproval,
        allowMultipleSubmissions: referralForms.allowMultipleSubmissions,
        createdAt: referralForms.createdAt,
        updatedAt: referralForms.updatedAt,
        createdBy: users.fullName
      })
      .from(referralForms)
      .leftJoin(users, eq(referralForms.createdBy, users.id))
      .where(eq(referralForms.tenantId, user.tenantId))
      .orderBy(desc(referralForms.createdAt));

    res.json(forms);
  } catch (error) {
    console.error('[REFERRAL FORMS] Error fetching forms:', error);
    res.status(500).json({ error: 'Failed to fetch referral forms' });
  }
}

// Get single referral form
export async function getReferralForm(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user || !user.tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;

    const form = await db
      .select()
      .from(referralForms)
      .where(and(
        eq(referralForms.id, parseInt(id)),
        eq(referralForms.tenantId, user.tenantId)
      ))
      .limit(1);

    if (!form.length) {
      return res.status(404).json({ error: 'Referral form not found' });
    }

    res.json(form[0]);
  } catch (error) {
    console.error('[REFERRAL FORMS] Error fetching form:', error);
    res.status(500).json({ error: 'Failed to fetch referral form' });
  }
}

// Update referral form
export async function updateReferralForm(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user || !user.tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const updates = req.body;

    const updatedForm = await db
      .update(referralForms)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(and(
        eq(referralForms.id, parseInt(id)),
        eq(referralForms.tenantId, user.tenantId)
      ))
      .returning();

    if (!updatedForm.length) {
      return res.status(404).json({ error: 'Referral form not found' });
    }

    console.log(`[REFERRAL FORMS] Updated form ${id} for tenant ${user.tenantId}`);
    res.json(updatedForm[0]);
  } catch (error) {
    console.error('[REFERRAL FORMS] Error updating form:', error);
    res.status(500).json({ error: 'Failed to update referral form' });
  }
}

// Delete referral form (soft delete)
export async function deleteReferralForm(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user || !user.tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;

    const deletedForm = await db
      .update(referralForms)
      .set({
        isActive: false,
        updatedAt: new Date()
      })
      .where(and(
        eq(referralForms.id, parseInt(id)),
        eq(referralForms.tenantId, user.tenantId)
      ))
      .returning();

    if (!deletedForm.length) {
      return res.status(404).json({ error: 'Referral form not found' });
    }

    console.log(`[REFERRAL FORMS] Deactivated form ${id} for tenant ${user.tenantId}`);
    res.json({ message: 'Referral form deactivated successfully' });
  } catch (error) {
    console.error('[REFERRAL FORMS] Error deleting form:', error);
    res.status(500).json({ error: 'Failed to delete referral form' });
  }
}

// Generate shareable link
export async function generateShareableLink(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user || !user.tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const { expiresAt, maxUses } = req.body;

    // Verify form exists and belongs to tenant
    const form = await db
      .select()
      .from(referralForms)
      .where(and(
        eq(referralForms.id, parseInt(id)),
        eq(referralForms.tenantId, user.tenantId),
        eq(referralForms.isActive, true)
      ))
      .limit(1);

    if (!form.length) {
      return res.status(404).json({ error: 'Referral form not found' });
    }

    // Generate unique access code
    let accessCode: string;
    let attempts = 0;
    do {
      accessCode = generateAccessCode();
      attempts++;
      
      // Check if code already exists
      const existing = await db
        .select()
        .from(referralLinks)
        .where(eq(referralLinks.accessCode, accessCode))
        .limit(1);
      
      if (!existing.length) break;
      
      if (attempts > 10) {
        throw new Error('Failed to generate unique access code');
      }
    } while (true);

    const newLink = await db.insert(referralLinks).values({
      referralFormId: parseInt(id),
      accessCode,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      maxUses: maxUses || null,
      createdBy: user.id
    }).returning();

    console.log(`[REFERRAL FORMS] Generated link ${accessCode} for form ${id}`);
    res.status(201).json(newLink[0]);
  } catch (error) {
    console.error('[REFERRAL FORMS] Error generating link:', error);
    res.status(500).json({ error: 'Failed to generate shareable link' });
  }
}

// Get form submissions
export async function getFormSubmissions(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user || !user.tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;

    // Verify form belongs to tenant
    const form = await db
      .select()
      .from(referralForms)
      .where(and(
        eq(referralForms.id, parseInt(id)),
        eq(referralForms.tenantId, user.tenantId)
      ))
      .limit(1);

    if (!form.length) {
      return res.status(404).json({ error: 'Referral form not found' });
    }

    const submissions = await db
      .select()
      .from(referralSubmissions)
      .where(eq(referralSubmissions.referralFormId, parseInt(id)))
      .orderBy(desc(referralSubmissions.submittedAt));

    res.json(submissions);
  } catch (error) {
    console.error('[REFERRAL FORMS] Error fetching submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
}

// Get form links
export async function getFormLinks(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user || !user.tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;

    // Verify form belongs to tenant
    const form = await db
      .select()
      .from(referralForms)
      .where(and(
        eq(referralForms.id, parseInt(id)),
        eq(referralForms.tenantId, user.tenantId)
      ))
      .limit(1);

    if (!form.length) {
      return res.status(404).json({ error: 'Referral form not found' });
    }

    const links = await db
      .select()
      .from(referralLinks)
      .where(eq(referralLinks.referralFormId, parseInt(id)))
      .orderBy(desc(referralLinks.createdAt));

    res.json(links);
  } catch (error) {
    console.error('[REFERRAL FORMS] Error fetching links:', error);
    res.status(500).json({ error: 'Failed to fetch links' });
  }
}

// Deactivate link
export async function deactivateLink(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user || !user.tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { linkId } = req.params;

    // Verify link belongs to tenant's form
    const linkWithForm = await db
      .select({
        linkId: referralLinks.id,
        formTenantId: referralForms.tenantId
      })
      .from(referralLinks)
      .leftJoin(referralForms, eq(referralLinks.referralFormId, referralForms.id))
      .where(eq(referralLinks.id, parseInt(linkId)))
      .limit(1);

    if (!linkWithForm.length || linkWithForm[0].formTenantId !== user.tenantId) {
      return res.status(404).json({ error: 'Link not found' });
    }

    await db
      .update(referralLinks)
      .set({ isActive: false })
      .where(eq(referralLinks.id, parseInt(linkId)));

    console.log(`[REFERRAL FORMS] Deactivated link ${linkId} for tenant ${user.tenantId}`);
    res.json({ message: 'Link deactivated successfully' });
  } catch (error) {
    console.error('[REFERRAL FORMS] Error deactivating link:', error);
    res.status(500).json({ error: 'Failed to deactivate link' });
  }
}