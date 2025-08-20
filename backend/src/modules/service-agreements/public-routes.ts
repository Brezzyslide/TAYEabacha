import { Router, Request, Response } from 'express';
import { serviceAgreementSharingService } from './sharing';
import { serviceAgreementService } from './service';

export const publicServiceAgreementRouter = Router();

/**
 * GET /sign/:agreementId/:token - Get agreement details for external signing
 * This route is public and does not require authentication
 */
publicServiceAgreementRouter.get('/sign/:agreementId/:token', async (req: Request, res: Response) => {
  try {
    const { agreementId, token } = req.params;
    
    // Get agreement for external signing
    const data = await serviceAgreementSharingService.getAgreementForExternalSigning(token);
    
    if (!data) {
      return res.status(404).json({ 
        error: 'Invalid or expired sharing link',
        message: 'This signing link is no longer valid or has expired.'
      });
    }
    
    // Verify the agreement ID matches
    if (data.agreement.id !== agreementId) {
      return res.status(400).json({ 
        error: 'Invalid link',
        message: 'The signing link does not match the agreement.'
      });
    }
    
    // Get agreement details with items for display
    const fullAgreement = await serviceAgreementService.getAgreementById(agreementId, data.agreement.companyId);
    
    if (!fullAgreement) {
      return res.status(404).json({ 
        error: 'Agreement not found',
        message: 'The service agreement could not be found.'
      });
    }
    
    console.log(`[PUBLIC ROUTES] External user accessing agreement ${agreementId} via token`);
    
    res.json({
      agreement: fullAgreement,
      sharingToken: {
        id: data.token.id,
        signerRole: data.token.signerRole,
        expiresAt: data.token.expiresAt,
        maxUses: data.token.maxUses,
        usedCount: data.token.usedCount
      }
    });
  } catch (error) {
    console.error('[PUBLIC ROUTES] Error getting agreement for signing:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Unable to load agreement for signing. Please try again later.'
    });
  }
});

/**
 * POST /sign/verify-access - Verify access code for external signing
 * This route validates the access code before allowing external signing
 */
publicServiceAgreementRouter.post('/sign/verify-access', async (req: Request, res: Response) => {
  try {
    const { token, accessCode } = req.body;
    
    if (!token || !accessCode) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'Token and access code are required.'
      });
    }
    
    // Validate token and access code
    const sharingToken = await serviceAgreementSharingService.validateToken(token, accessCode);
    
    if (!sharingToken) {
      return res.status(401).json({ 
        error: 'Invalid access code',
        message: 'The access code is incorrect or the link has expired.'
      });
    }
    
    console.log(`[PUBLIC ROUTES] Access code verified for token ${token}`);
    
    res.json({
      success: true,
      tokenId: sharingToken.id,
      agreementId: sharingToken.agreementId,
      signerRole: sharingToken.signerRole
    });
  } catch (error) {
    console.error('[PUBLIC ROUTES] Error verifying access code:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Unable to verify access code. Please try again later.'
    });
  }
});

/**
 * POST /sign/submit-signature - Submit external signature
 * This route records the external signature without requiring authentication
 */
publicServiceAgreementRouter.post('/sign/submit-signature', async (req: Request, res: Response) => {
  try {
    const { tokenId, signerName, signerEmail } = req.body;
    
    if (!tokenId || !signerName || !signerEmail) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'Token ID, signer name, and email are required.'
      });
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(signerEmail)) {
      return res.status(400).json({ 
        error: 'Invalid email',
        message: 'Please provide a valid email address.'
      });
    }
    
    // Get client IP and user agent
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    
    // Record external signature
    const signature = await serviceAgreementSharingService.recordExternalSignature(
      tokenId,
      signerName.trim(),
      signerEmail.trim(),
      ipAddress,
      userAgent
    );
    
    console.log(`[PUBLIC ROUTES] External signature recorded by ${signerName} (${signerEmail})`);
    
    res.json({
      success: true,
      message: 'Signature recorded successfully',
      signature: {
        id: signature.id,
        signerName: signature.signerName,
        signedAt: signature.signedAt
      }
    });
  } catch (error) {
    console.error('[PUBLIC ROUTES] Error recording external signature:', error);
    
    // Check if this is a token usage error
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({ 
        error: 'Invalid token',
        message: 'The signing token is no longer valid.'
      });
    }
    
    res.status(500).json({ 
      error: 'Server error',
      message: 'Unable to record signature. Please try again later.'
    });
  }
});