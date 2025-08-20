import { db } from '../../../../server/db';
import { serviceAgreementSharingTokens, serviceAgreementSignatures, serviceAgreements } from '@shared/schema';
import { eq, and, lt, gte } from 'drizzle-orm';
import crypto from 'crypto';

export class ServiceAgreementSharingService {
  /**
   * Generate a secure sharing token for third-party signing
   */
  async createSharingToken(
    agreementId: string,
    signerRole: string,
    createdByUserId: string,
    expirationDays: number = 7,
    maxUses: number = 1,
    recipientEmail?: string
  ) {
    try {
      // Generate secure random token (URL-safe)
      const token = crypto.randomBytes(32).toString('base64url');
      
      // Generate 6-digit access code
      const accessCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Set expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expirationDays);
      
      const tokenData = {
        agreementId,
        token,
        accessCode,
        createdByUserId,
        expiresAt,
        maxUses,
        signerRole,
        recipientEmail,
      };
      
      const result = await db
        .insert(serviceAgreementSharingTokens)
        .values(tokenData)
        .returning();
      
      console.log(`[SHARING SERVICE] Created sharing token for agreement ${agreementId}, role: ${signerRole}`);
      
      return result[0];
    } catch (error) {
      console.error('[SHARING SERVICE] Error creating sharing token:', error);
      throw new Error('Failed to create sharing token');
    }
  }
  
  /**
   * Validate sharing token and access code
   */
  async validateToken(token: string, accessCode: string) {
    try {
      const sharingToken = await db
        .select()
        .from(serviceAgreementSharingTokens)
        .where(and(
          eq(serviceAgreementSharingTokens.token, token),
          eq(serviceAgreementSharingTokens.accessCode, accessCode),
          eq(serviceAgreementSharingTokens.isActive, true),
          gte(serviceAgreementSharingTokens.expiresAt, new Date())
        ))
        .limit(1);
      
      if (sharingToken.length === 0) {
        return null;
      }
      
      const tokenRecord = sharingToken[0];
      
      // Check if token has been used up
      if ((tokenRecord.usedCount || 0) >= (tokenRecord.maxUses || 1)) {
        return null;
      }
      
      return tokenRecord;
    } catch (error) {
      console.error('[SHARING SERVICE] Error validating token:', error);
      throw new Error('Failed to validate sharing token');
    }
  }
  
  /**
   * Get agreement details for external signing (without authentication)
   */
  async getAgreementForExternalSigning(token: string) {
    try {
      const sharingToken = await db
        .select()
        .from(serviceAgreementSharingTokens)
        .where(and(
          eq(serviceAgreementSharingTokens.token, token),
          eq(serviceAgreementSharingTokens.isActive, true),
          gte(serviceAgreementSharingTokens.expiresAt, new Date())
        ))
        .limit(1);
      
      if (sharingToken.length === 0) {
        return null;
      }
      
      const tokenRecord = sharingToken[0];
      
      // Get the associated agreement
      const agreement = await db
        .select()
        .from(serviceAgreements)
        .where(eq(serviceAgreements.id, tokenRecord.agreementId))
        .limit(1);
      
      if (agreement.length === 0) {
        return null;
      }
      
      return {
        agreement: agreement[0],
        token: tokenRecord,
      };
    } catch (error) {
      console.error('[SHARING SERVICE] Error getting agreement for external signing:', error);
      throw new Error('Failed to retrieve agreement for signing');
    }
  }
  
  /**
   * Record external signature
   */
  async recordExternalSignature(
    tokenId: string,
    signerName: string,
    signerEmail: string,
    ipAddress: string,
    userAgent: string
  ) {
    try {
      // Get the sharing token
      const sharingToken = await db
        .select()
        .from(serviceAgreementSharingTokens)
        .where(eq(serviceAgreementSharingTokens.id, tokenId))
        .limit(1);
      
      if (sharingToken.length === 0) {
        throw new Error('Sharing token not found');
      }
      
      const token = sharingToken[0];
      
      // Create signature record
      const signatureData = {
        agreementId: token.agreementId,
        signerRole: token.signerRole,
        signerName,
        signerEmail,
        signedByUserId: null, // External signer - no user ID
        ipAddress,
        userAgent,
        isExternalSigner: true,
        sharingTokenId: tokenId,
      };
      
      const signature = await db
        .insert(serviceAgreementSignatures)
        .values(signatureData)
        .returning();
      
      // Update token usage count
      await db
        .update(serviceAgreementSharingTokens)
        .set({
          usedCount: (token.usedCount || 0) + 1,
          // Deactivate token if it's reached max uses
          isActive: (token.usedCount || 0) + 1 < (token.maxUses || 1)
        })
        .where(eq(serviceAgreementSharingTokens.id, tokenId));
      
      // Update agreement status to active if it has signatures
      await db
        .update(serviceAgreements)
        .set({
          status: 'active',
          updatedAt: new Date()
        })
        .where(eq(serviceAgreements.id, token.agreementId));
      
      console.log(`[SHARING SERVICE] External signature recorded for agreement ${token.agreementId} by ${signerName}`);
      
      return signature[0];
    } catch (error) {
      console.error('[SHARING SERVICE] Error recording external signature:', error);
      throw new Error('Failed to record external signature');
    }
  }
  
  /**
   * Get sharing tokens for an agreement
   */
  async getSharingTokensForAgreement(agreementId: string) {
    try {
      return await db
        .select()
        .from(serviceAgreementSharingTokens)
        .where(eq(serviceAgreementSharingTokens.agreementId, agreementId))
        .orderBy(serviceAgreementSharingTokens.createdAt);
    } catch (error) {
      console.error('[SHARING SERVICE] Error getting sharing tokens:', error);
      throw new Error('Failed to retrieve sharing tokens');
    }
  }
  
  /**
   * Deactivate a sharing token
   */
  async deactivateToken(tokenId: string) {
    try {
      await db
        .update(serviceAgreementSharingTokens)
        .set({ isActive: false })
        .where(eq(serviceAgreementSharingTokens.id, tokenId));
      
      console.log(`[SHARING SERVICE] Deactivated sharing token ${tokenId}`);
    } catch (error) {
      console.error('[SHARING SERVICE] Error deactivating token:', error);
      throw new Error('Failed to deactivate sharing token');
    }
  }
}

export const serviceAgreementSharingService = new ServiceAgreementSharingService();