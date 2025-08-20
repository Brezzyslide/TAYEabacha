import { Router, Request, Response } from 'express';
import { db } from '../../../../server/lib/dbClient';
import { referralForms, referralSubmissions, referralLinks, referralAccessLog } from '@shared/schema';
import { eq, and, or, lt, gte } from 'drizzle-orm';

const router = Router();

// Get public form by access code
router.get('/:accessCode', async (req: Request, res: Response) => {
  try {
    const { accessCode } = req.params;

    // Get link and form data
    const linkData = await db
      .select({
        linkId: referralLinks.id,
        formId: referralForms.id,
        formType: referralForms.formType,
        title: referralForms.title,
        description: referralForms.description,
        fieldsSchema: referralForms.fieldsSchema,
        customBranding: referralForms.customBranding,
        allowMultipleSubmissions: referralForms.allowMultipleSubmissions,
        expiresAt: referralLinks.expiresAt,
        maxUses: referralLinks.maxUses,
        currentUses: referralLinks.currentUses,
        isActive: referralLinks.isActive
      })
      .from(referralLinks)
      .leftJoin(referralForms, eq(referralLinks.referralFormId, referralForms.id))
      .where(eq(referralLinks.accessCode, accessCode.toUpperCase()))
      .limit(1);

    if (!linkData.length) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const link = linkData[0];

    // Check if link is active
    if (!link.isActive) {
      return res.status(410).json({ error: 'This link has been deactivated' });
    }

    // Check if link has expired
    if (link.expiresAt && new Date() > new Date(link.expiresAt)) {
      return res.status(410).json({ error: 'This link has expired' });
    }

    // Check if max uses exceeded
    if (link.maxUses && link.currentUses && link.currentUses >= link.maxUses) {
      return res.status(410).json({ error: 'This link has reached its maximum uses' });
    }

    // Log access
    await db.insert(referralAccessLog).values({
      referralLinkId: link.linkId,
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown'
    }).catch(err => {
      console.warn('[REFERRAL FORMS] Failed to log access:', err);
    });

    // Return form data (without sensitive info)
    const formData = {
      id: link.formId,
      type: link.formType,
      title: link.title,
      description: link.description,
      fields: link.fieldsSchema,
      branding: link.customBranding,
      allowMultipleSubmissions: link.allowMultipleSubmissions
    };

    console.log(`[REFERRAL FORMS] Public access to form ${link.formId} via code ${accessCode}`);
    res.json(formData);
  } catch (error) {
    console.error('[REFERRAL FORMS] Error accessing public form:', error);
    res.status(500).json({ error: 'Failed to load form' });
  }
});

// Submit public form
router.post('/:accessCode/submit', async (req: Request, res: Response) => {
  try {
    const { accessCode } = req.params;
    const { submissionData, submitterInfo } = req.body;

    if (!submissionData || !submitterInfo) {
      return res.status(400).json({ error: 'Submission data and submitter info are required' });
    }

    // Get link and form data
    const linkData = await db
      .select({
        linkId: referralLinks.id,
        formId: referralForms.id,
        formTitle: referralForms.title,
        allowMultipleSubmissions: referralForms.allowMultipleSubmissions,
        expiresAt: referralLinks.expiresAt,
        maxUses: referralLinks.maxUses,
        currentUses: referralLinks.currentUses,
        isActive: referralLinks.isActive
      })
      .from(referralLinks)
      .leftJoin(referralForms, eq(referralLinks.referralFormId, referralForms.id))
      .where(eq(referralLinks.accessCode, accessCode.toUpperCase()))
      .limit(1);

    if (!linkData.length) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const link = linkData[0];

    // Validation checks
    if (!link.isActive) {
      return res.status(410).json({ error: 'This form is no longer accepting submissions' });
    }

    if (link.expiresAt && new Date() > new Date(link.expiresAt)) {
      return res.status(410).json({ error: 'This form has expired' });
    }

    if (link.maxUses && link.currentUses && link.currentUses >= link.maxUses) {
      return res.status(410).json({ error: 'This form has reached its maximum submissions' });
    }

    // Check for duplicate submissions if not allowed
    if (!link.allowMultipleSubmissions && submitterInfo.email) {
      const existingSubmission = await db
        .select()
        .from(referralSubmissions)
        .where(and(
          eq(referralSubmissions.referralFormId, link.formId),
          eq(referralSubmissions.submitterInfo, submitterInfo)
        ))
        .limit(1);

      if (existingSubmission.length) {
        return res.status(409).json({ error: 'You have already submitted this form' });
      }
    }

    // Create submission
    const submission = await db.insert(referralSubmissions).values({
      referralFormId: link.formId,
      submissionData,
      submitterInfo
    }).returning();

    // Update link usage count
    await db
      .update(referralLinks)
      .set({
        currentUses: (link.currentUses || 0) + 1
      })
      .where(eq(referralLinks.id, link.linkId));

    // Log successful submission
    await db.insert(referralAccessLog).values({
      referralLinkId: link.linkId,
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      submissionId: submission[0].id
    }).catch(err => {
      console.warn('[REFERRAL FORMS] Failed to log submission:', err);
    });

    console.log(`[REFERRAL FORMS] New submission for form ${link.formId} from ${submitterInfo.email || 'anonymous'}`);
    
    res.status(201).json({
      id: submission[0].id,
      message: 'Thank you! Your submission has been received.',
      submittedAt: submission[0].submittedAt
    });
  } catch (error) {
    console.error('[REFERRAL FORMS] Error submitting form:', error);
    res.status(500).json({ error: 'Failed to submit form' });
  }
});

export { router as publicReferralFormRouter };