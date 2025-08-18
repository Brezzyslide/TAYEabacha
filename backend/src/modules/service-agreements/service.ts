import { db } from '../../../../server/db';
import { serviceAgreements, serviceAgreementItems, serviceAgreementSignatures, clients } from '../../../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { convertToDecimalStrings, convertFromDecimalStrings } from './validators';
import { lineTotals, grandTotal, getLineItemTotal, itemToRateSet } from '../../../../shared/utils/calc';

export class ServiceAgreementService {
  
  /**
   * Validate that a client belongs to the specified company
   */
  async validateClientAccess(clientId: number, companyId: string): Promise<boolean> {
    try {
      console.log('[SERVICE AGREEMENT SERVICE] Validating client access:', { clientId, clientIdType: typeof clientId, companyId });
      
      const client = await db
        .select({ id: clients.id })
        .from(clients)
        .where(and(
          eq(clients.id, clientId),
          eq(clients.companyId, companyId)
        ))
        .limit(1);
      
      console.log('[SERVICE AGREEMENT SERVICE] Client lookup result:', client);
      return client.length > 0;
    } catch (error) {
      console.error('[SERVICE AGREEMENT SERVICE] Error validating client access:', error);
      return false;
    }
  }

  /**
   * Get all service agreements for a company, optionally filtered by client
   */
  async getAgreements(companyId: string, clientId?: number) {
    try {
      const conditions = [eq(serviceAgreements.companyId, companyId)];
      
      if (clientId) {
        conditions.push(eq(serviceAgreements.clientId, clientId));
      }

      const agreements = await db
        .select()
        .from(serviceAgreements)
        .where(and(...conditions))
        .orderBy(serviceAgreements.createdAt);

      // Get items and signatures for each agreement
      const agreementsWithDetails = await Promise.all(
        agreements.map(async (agreement: any) => {
          const [items, signatures] = await Promise.all([
            this.getAgreementItems(agreement.id),
            this.getAgreementSignatures(agreement.id)
          ]);

          return {
            ...agreement,
            items: items.map(convertFromDecimalStrings),
            signatures
          };
        })
      );

      return agreementsWithDetails;
    } catch (error) {
      console.error('[SERVICE AGREEMENT SERVICE] Error getting agreements:', error);
      throw new Error('Failed to retrieve service agreements');
    }
  }

  /**
   * Get a specific service agreement by ID
   */
  async getAgreementById(agreementId: string, companyId: string) {
    try {
      const agreement = await db
        .select()
        .from(serviceAgreements)
        .where(and(
          eq(serviceAgreements.id, agreementId),
          eq(serviceAgreements.companyId, companyId)
        ))
        .limit(1);

      if (agreement.length === 0) {
        return null;
      }

      const [items, signatures] = await Promise.all([
        this.getAgreementItems(agreementId),
        this.getAgreementSignatures(agreementId)
      ]);

      return {
        ...agreement[0],
        items: items.map(convertFromDecimalStrings),
        signatures
      };
    } catch (error) {
      console.error('[SERVICE AGREEMENT SERVICE] Error getting agreement by ID:', error);
      throw new Error('Failed to retrieve service agreement');
    }
  }

  /**
   * Create a new service agreement
   */
  async createAgreement(data: any, companyId: string, createdBy: number) {
    try {
      // Validate client access
      const hasAccess = await this.validateClientAccess(data.clientId, companyId);
      if (!hasAccess) {
        throw new Error('Client not found or access denied');
      }

      const agreementData = {
        ...data,
        companyId,
        createdBy,
        status: 'draft' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db
        .insert(serviceAgreements)
        .values(agreementData)
        .returning();

      return result[0];
    } catch (error) {
      console.error('[SERVICE AGREEMENT SERVICE] Error creating agreement:', error);
      throw new Error('Failed to create service agreement');
    }
  }

  /**
   * Update a service agreement
   */
  async updateAgreement(agreementId: string, data: any, companyId: string) {
    try {
      // Validate client access if clientId is being updated
      if (data.clientId) {
        const hasAccess = await this.validateClientAccess(data.clientId, companyId);
        if (!hasAccess) {
          throw new Error('Client not found or access denied');
        }
      }

      const updateData = {
        ...data,
        updatedAt: new Date()
      };

      const result = await db
        .update(serviceAgreements)
        .set(updateData)
        .where(and(
          eq(serviceAgreements.id, agreementId),
          eq(serviceAgreements.companyId, companyId)
        ))
        .returning();

      if (result.length === 0) {
        throw new Error('Service agreement not found');
      }

      return result[0];
    } catch (error) {
      console.error('[SERVICE AGREEMENT SERVICE] Error updating agreement:', error);
      throw new Error('Failed to update service agreement');
    }
  }

  /**
   * Delete a service agreement
   */
  async deleteAgreement(agreementId: string, companyId: string) {
    try {
      // Delete related items and signatures first
      await Promise.all([
        db.delete(serviceAgreementItems)
          .where(eq(serviceAgreementItems.serviceAgreementId, agreementId)),
        db.delete(serviceAgreementSignatures)
          .where(eq(serviceAgreementSignatures.serviceAgreementId, agreementId))
      ]);

      const result = await db
        .delete(serviceAgreements)
        .where(and(
          eq(serviceAgreements.id, agreementId),
          eq(serviceAgreements.companyId, companyId)
        ))
        .returning();

      if (result.length === 0) {
        throw new Error('Service agreement not found');
      }

      return result[0];
    } catch (error) {
      console.error('[SERVICE AGREEMENT SERVICE] Error deleting agreement:', error);
      throw new Error('Failed to delete service agreement');
    }
  }

  /**
   * Get items for a service agreement
   */
  async getAgreementItems(agreementId: string) {
    try {
      return await db
        .select()
        .from(serviceAgreementItems)
        .where(eq(serviceAgreementItems.serviceAgreementId, agreementId))
        .orderBy(serviceAgreementItems.createdAt);
    } catch (error) {
      console.error('[SERVICE AGREEMENT SERVICE] Error getting agreement items:', error);
      throw new Error('Failed to retrieve service agreement items');
    }
  }

  /**
   * Calculate total amount for a service agreement using precise decimal math
   */
  async calculateAgreementTotal(agreementId: string) {
    try {
      const items = await this.getAgreementItems(agreementId);
      const itemRateSets = items.map(item => itemToRateSet(convertFromDecimalStrings(item)));
      const lineBreakdowns = itemRateSets.map(rateSet => lineTotals(rateSet));
      const total = grandTotal(lineBreakdowns);
      
      console.log(`[CALC] Agreement ${agreementId} total: $${total.toFixed(2)} from ${items.length} items`);
      
      return {
        total: total.toFixed(2),
        itemCount: items.length,
        lineBreakdowns: lineBreakdowns.map((breakdown, index) => ({
          itemId: items[index].id,
          ...Object.fromEntries(
            Object.entries(breakdown).map(([key, value]) => [key, value.toFixed(2)])
          )
        }))
      };
    } catch (error) {
      console.error('[SERVICE AGREEMENT SERVICE] Error calculating agreement total:', error);
      throw new Error('Failed to calculate agreement total');
    }
  }

  /**
   * Create a service agreement item
   */
  async createAgreementItem(agreementId: string, data: any, companyId: string) {
    try {
      // Verify agreement exists and belongs to company
      const agreement = await this.getAgreementById(agreementId, companyId);
      if (!agreement) {
        throw new Error('Service agreement not found');
      }

      const itemData = convertToDecimalStrings({
        ...data,
        serviceAgreementId: agreementId,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Calculate totals using precise decimal math before saving
      const rateSet = itemToRateSet(itemData);
      const calculatedTotal = getLineItemTotal(rateSet);
      const lineBreakdown = lineTotals(rateSet);
      
      console.log(`[CALC] Item total calculated: $${calculatedTotal.toFixed(2)} for agreement ${agreementId}`);
      console.log(`[CALC] Line breakdown:`, {
        day: lineBreakdown.day.toFixed(2),
        evening: lineBreakdown.evening.toFixed(2),
        activeNight: lineBreakdown.activeNight.toFixed(2),
        sleepover: lineBreakdown.sleepover.toFixed(2),
        saturday: lineBreakdown.saturday.toFixed(2),
        sunday: lineBreakdown.sunday.toFixed(2),
        publicHoliday: lineBreakdown.publicHoliday.toFixed(2)
      });

      const result = await db
        .insert(serviceAgreementItems)
        .values(itemData)
        .returning();

      return convertFromDecimalStrings(result[0]);
    } catch (error) {
      console.error('[SERVICE AGREEMENT SERVICE] Error creating agreement item:', error);
      throw new Error('Failed to create service agreement item');
    }
  }

  /**
   * Update a service agreement item
   */
  async updateAgreementItem(agreementId: string, itemId: string, data: any, companyId: string) {
    try {
      // Verify agreement exists and belongs to company
      const agreement = await this.getAgreementById(agreementId, companyId);
      if (!agreement) {
        throw new Error('Service agreement not found');
      }

      const updateData = convertToDecimalStrings({
        ...data,
        updatedAt: new Date()
      });

      // Calculate totals using precise decimal math before saving
      const rateSet = itemToRateSet(updateData);
      const calculatedTotal = getLineItemTotal(rateSet);
      const lineBreakdown = lineTotals(rateSet);
      
      console.log(`[CALC] Updated item total: $${calculatedTotal.toFixed(2)} for item ${itemId} in agreement ${agreementId}`);
      console.log(`[CALC] Updated line breakdown:`, {
        day: lineBreakdown.day.toFixed(2),
        evening: lineBreakdown.evening.toFixed(2),
        activeNight: lineBreakdown.activeNight.toFixed(2),
        sleepover: lineBreakdown.sleepover.toFixed(2),
        saturday: lineBreakdown.saturday.toFixed(2),
        sunday: lineBreakdown.sunday.toFixed(2),
        publicHoliday: lineBreakdown.publicHoliday.toFixed(2)
      });

      const result = await db
        .update(serviceAgreementItems)
        .set(updateData)
        .where(and(
          eq(serviceAgreementItems.id, itemId),
          eq(serviceAgreementItems.serviceAgreementId, agreementId)
        ))
        .returning();

      if (result.length === 0) {
        throw new Error('Service agreement item not found');
      }

      return convertFromDecimalStrings(result[0]);
    } catch (error) {
      console.error('[SERVICE AGREEMENT SERVICE] Error updating agreement item:', error);
      throw new Error('Failed to update service agreement item');
    }
  }

  /**
   * Delete a service agreement item
   */
  async deleteAgreementItem(agreementId: string, itemId: string, companyId: string) {
    try {
      // Verify agreement exists and belongs to company
      const agreement = await this.getAgreementById(agreementId, companyId);
      if (!agreement) {
        throw new Error('Service agreement not found');
      }

      const result = await db
        .delete(serviceAgreementItems)
        .where(and(
          eq(serviceAgreementItems.id, itemId),
          eq(serviceAgreementItems.serviceAgreementId, agreementId)
        ))
        .returning();

      if (result.length === 0) {
        throw new Error('Service agreement item not found');
      }

      return convertFromDecimalStrings(result[0]);
    } catch (error) {
      console.error('[SERVICE AGREEMENT SERVICE] Error deleting agreement item:', error);
      throw new Error('Failed to delete service agreement item');
    }
  }

  /**
   * Get signatures for a service agreement
   */
  async getAgreementSignatures(agreementId: string) {
    try {
      return await db
        .select()
        .from(serviceAgreementSignatures)
        .where(eq(serviceAgreementSignatures.serviceAgreementId, agreementId))
        .orderBy(serviceAgreementSignatures.signedAt);
    } catch (error) {
      console.error('[SERVICE AGREEMENT SERVICE] Error getting agreement signatures:', error);
      throw new Error('Failed to retrieve service agreement signatures');
    }
  }

  /**
   * Add a signature to a service agreement
   */
  async addSignature(agreementId: string, data: any, companyId: string, signedBy: number) {
    try {
      // Verify agreement exists and belongs to company
      const agreement = await this.getAgreementById(agreementId, companyId);
      if (!agreement) {
        throw new Error('Service agreement not found');
      }

      const signatureData = {
        ...data,
        serviceAgreementId: agreementId,
        signedBy,
        signedAt: new Date()
      };

      const result = await db
        .insert(serviceAgreementSignatures)
        .values(signatureData)
        .returning();

      return result[0];
    } catch (error) {
      console.error('[SERVICE AGREEMENT SERVICE] Error adding signature:', error);
      throw new Error('Failed to add signature to service agreement');
    }
  }
}

export const serviceAgreementService = new ServiceAgreementService();