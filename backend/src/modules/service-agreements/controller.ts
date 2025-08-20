import { Request, Response } from 'express';
import { db } from '../../../../server/db';
import { companies, tenants } from '../../../../shared/schema';
import { eq } from 'drizzle-orm';

// Extended Request interface with auth details
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
    tenantId: number;
    companyId: string;
    password?: string;
    email?: string | null;
    fullName?: string;
    phone?: string | null;
    address?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
    lastLogin?: Date | null;
    isActive?: boolean;
    accountExpiryDate?: Date | null;
    passwordExpiryDate?: Date | null;
    jobTitle?: string | null;
    startDate?: Date | null;
    emergencyContact?: string | null;
    emergencyPhone?: string | null;
    profilePicture?: string | null;
    clockNumber?: string | null;
    hourlyRate?: string | null;
    lastBillingSync?: Date | null;
  };
}
import { serviceAgreementService } from './service';
import { 
  serviceAgreementCreateSchema, 
  serviceAgreementUpdateSchema,
  serviceAgreementItemCreateSchema,
  serviceAgreementItemUpdateSchema,
  signatureCreateSchema,
  clientIdQuerySchema
} from './validators';
import { serviceAgreementSharingService } from './sharing';
import { ZodError } from 'zod';

/**
 * Check if user has write permissions (Admin, TeamLeader, or Coordinator)
 */
const hasWritePermission = (role: string): boolean => {
  const normalizedRole = role.toLowerCase().replace(/\s+/g, '');
  return ['admin', 'teamleader', 'coordinator', 'consolemanager'].includes(normalizedRole);
};

/**
 * Handle validation errors and other errors
 */
const handleError = (res: Response, error: any, defaultMessage: string) => {
  console.error('[SERVICE AGREEMENT CONTROLLER] Error:', error);
  
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }))
    });
  }
  
  if (error.message) {
    return res.status(400).json({ message: error.message });
  }
  
  return res.status(500).json({ message: defaultMessage });
};

export class ServiceAgreementController {
  
  /**
   * GET / - List service agreements with optional client filter
   */
  async getAgreements(req: AuthenticatedRequest, res: Response) {
    try {
      const { tenantId } = req.user!;
      
      // Get company info for this tenant (same pattern as createAgreement)
      const company = await db
        .select({ id: companies.id })
        .from(companies)
        .innerJoin(tenants, eq(companies.id, tenants.companyId))
        .where(eq(tenants.id, tenantId))
        .limit(1);
      
      if (company.length === 0) {
        return res.status(404).json({ message: 'Company not found for tenant' });
      }
      
      const companyId = company[0].id;
      
      // Validate query parameters
      const queryValidation = clientIdQuerySchema.safeParse(req.query);
      if (!queryValidation.success) {
        return handleError(res, queryValidation.error, 'Invalid query parameters');
      }
      
      const { clientId } = queryValidation.data;
      
      const agreements = await serviceAgreementService.getAgreements(companyId, clientId);
      
      res.json(agreements);
    } catch (error) {
      handleError(res, error, 'Failed to retrieve service agreements');
    }
  }

  /**
   * POST / - Create a new service agreement
   */
  async createAgreement(req: AuthenticatedRequest, res: Response) {
    try {
      const { role, id: userId, tenantId } = req.user!;
      
      // Get company info for this tenant (same pattern as other routes)
      const company = await db
        .select({ id: companies.id })
        .from(companies)
        .innerJoin(tenants, eq(companies.id, tenants.companyId))
        .where(eq(tenants.id, tenantId))
        .limit(1);
      
      if (company.length === 0) {
        return res.status(404).json({ message: 'Company not found for tenant' });
      }
      
      const companyId = company[0].id;
      
      console.log('[SERVICE AGREEMENT CONTROLLER] Creating agreement with:', { 
        companyId, 
        companyIdType: typeof companyId, 
        userId, 
        role,
        tenantId
      });
      
      // Check permissions
      if (!hasWritePermission(role)) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }
      
      // Validate request body
      const validation = serviceAgreementCreateSchema.safeParse(req.body);
      if (!validation.success) {
        return handleError(res, validation.error, 'Invalid request data');
      }
      
      console.log('[SERVICE AGREEMENT CONTROLLER] Validated data:', validation.data);
      
      const agreement = await serviceAgreementService.createAgreement(
        validation.data, 
        companyId, 
        userId
      );
      
      res.status(201).json(agreement);
    } catch (error) {
      handleError(res, error, 'Failed to create service agreement');
    }
  }

  /**
   * GET /:id - Get a specific service agreement
   */
  async getAgreementById(req: AuthenticatedRequest, res: Response) {
    try {
      const { tenantId } = req.user!;
      const { id } = req.params;
      
      // Get company info for this tenant
      const company = await db
        .select({ id: companies.id })
        .from(companies)
        .innerJoin(tenants, eq(companies.id, tenants.companyId))
        .where(eq(tenants.id, tenantId))
        .limit(1);
      
      if (company.length === 0) {
        return res.status(404).json({ message: 'Company not found for tenant' });
      }
      
      const companyId = company[0].id;
      
      const agreement = await serviceAgreementService.getAgreementById(id, companyId);
      
      if (!agreement) {
        return res.status(404).json({ message: 'Service agreement not found' });
      }
      
      res.json(agreement);
    } catch (error) {
      handleError(res, error, 'Failed to retrieve service agreement');
    }
  }

  /**
   * PUT /:id - Update a service agreement
   */
  async updateAgreement(req: AuthenticatedRequest, res: Response) {
    try {
      const { role, tenantId } = req.user!;
      const { id } = req.params;
      
      // Get company info for this tenant
      const company = await db
        .select({ id: companies.id })
        .from(companies)
        .innerJoin(tenants, eq(companies.id, tenants.companyId))
        .where(eq(tenants.id, tenantId))
        .limit(1);
      
      if (company.length === 0) {
        return res.status(404).json({ message: 'Company not found for tenant' });
      }
      
      const companyId = company[0].id;
      
      // Check permissions
      if (!hasWritePermission(role)) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }
      
      // Validate request body
      const validation = serviceAgreementUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        return handleError(res, validation.error, 'Invalid request data');
      }
      
      const agreement = await serviceAgreementService.updateAgreement(
        id, 
        validation.data, 
        companyId
      );
      
      res.json(agreement);
    } catch (error) {
      handleError(res, error, 'Failed to update service agreement');
    }
  }

  /**
   * DELETE /:id - Delete a service agreement
   */
  async deleteAgreement(req: AuthenticatedRequest, res: Response) {
    try {
      const { role, tenantId } = req.user!;
      const { id } = req.params;
      
      // Get company info for this tenant
      const company = await db
        .select({ id: companies.id })
        .from(companies)
        .innerJoin(tenants, eq(companies.id, tenants.companyId))
        .where(eq(tenants.id, tenantId))
        .limit(1);
      
      if (company.length === 0) {
        return res.status(404).json({ message: 'Company not found for tenant' });
      }
      
      const companyId = company[0].id;
      
      // Check permissions
      if (!hasWritePermission(role)) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }
      
      await serviceAgreementService.deleteAgreement(id, companyId);
      
      res.status(204).send();
    } catch (error) {
      handleError(res, error, 'Failed to delete service agreement');
    }
  }

  /**
   * POST /:id/items - Add an item to a service agreement
   */
  async createAgreementItem(req: AuthenticatedRequest, res: Response) {
    try {
      const { role, id: userId, tenantId } = req.user!;
      const { id } = req.params;
      
      // Get company info for this tenant (same pattern as createAgreement)
      const company = await db
        .select({ id: companies.id })
        .from(companies)
        .innerJoin(tenants, eq(companies.id, tenants.companyId))
        .where(eq(tenants.id, tenantId))
        .limit(1);
      
      if (company.length === 0) {
        return res.status(404).json({ message: 'Company not found for tenant' });
      }
      
      const companyId = company[0].id;
      
      // Check permissions
      if (!hasWritePermission(role)) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }
      
      // Validate request body
      const validation = serviceAgreementItemCreateSchema.safeParse(req.body);
      if (!validation.success) {
        return handleError(res, validation.error, 'Invalid request data');
      }
      
      const item = await serviceAgreementService.createAgreementItem(
        id, 
        validation.data, 
        companyId
      );
      
      res.status(201).json(item);
    } catch (error) {
      handleError(res, error, 'Failed to create service agreement item');
    }
  }

  /**
   * PUT /:id/items/:itemId - Update a service agreement item
   */
  async updateAgreementItem(req: AuthenticatedRequest, res: Response) {
    try {
      const { role, tenantId } = req.user!;
      const { id, itemId } = req.params;
      
      // Get company info for this tenant
      const company = await db
        .select({ id: companies.id })
        .from(companies)
        .innerJoin(tenants, eq(companies.id, tenants.companyId))
        .where(eq(tenants.id, tenantId))
        .limit(1);
      
      if (company.length === 0) {
        return res.status(404).json({ message: 'Company not found for tenant' });
      }
      
      const companyId = company[0].id;
      
      // Check permissions
      if (!hasWritePermission(role)) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }
      
      // Validate request body
      const validation = serviceAgreementItemUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        return handleError(res, validation.error, 'Invalid request data');
      }
      
      const item = await serviceAgreementService.updateAgreementItem(
        id, 
        itemId, 
        validation.data, 
        companyId
      );
      
      res.json(item);
    } catch (error) {
      handleError(res, error, 'Failed to update service agreement item');
    }
  }

  /**
   * DELETE /:id/items/:itemId - Delete a service agreement item
   */
  async deleteAgreementItem(req: AuthenticatedRequest, res: Response) {
    try {
      const { role, tenantId } = req.user!;
      const { id, itemId } = req.params;
      
      // Get company info for this tenant
      const company = await db
        .select({ id: companies.id })
        .from(companies)
        .innerJoin(tenants, eq(companies.id, tenants.companyId))
        .where(eq(tenants.id, tenantId))
        .limit(1);
      
      if (company.length === 0) {
        return res.status(404).json({ message: 'Company not found for tenant' });
      }
      
      const companyId = company[0].id;
      
      // Check permissions
      if (!hasWritePermission(role)) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }
      
      await serviceAgreementService.deleteAgreementItem(id, itemId, companyId);
      
      res.status(204).send();
    } catch (error) {
      handleError(res, error, 'Failed to delete service agreement item');
    }
  }

  /**
   * POST /:id/sign - Add a signature to a service agreement
   */
  async addSignature(req: AuthenticatedRequest, res: Response) {
    try {
      const { role, id: userId, tenantId } = req.user!;
      const { id } = req.params;
      
      // Get company info for this tenant
      const company = await db
        .select({ id: companies.id })
        .from(companies)
        .innerJoin(tenants, eq(companies.id, tenants.companyId))
        .where(eq(tenants.id, tenantId))
        .limit(1);
      
      if (company.length === 0) {
        return res.status(404).json({ message: 'Company not found for tenant' });
      }
      
      const companyId = company[0].id;
      
      // Check permissions
      if (!hasWritePermission(role)) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }
      
      // Validate request body
      const validation = signatureCreateSchema.safeParse(req.body);
      if (!validation.success) {
        return handleError(res, validation.error, 'Invalid request data');
      }
      
      const signature = await serviceAgreementService.addSignature(
        id, 
        validation.data, 
        companyId, 
        userId
      );
      
      res.status(201).json(signature);
    } catch (error) {
      handleError(res, error, 'Failed to add signature');
    }
  }

  /**
   * GET /:id/pdf - Generate PDF for a service agreement
   */
  async generatePDF(req: AuthenticatedRequest, res: Response) {
    try {
      const { tenantId } = req.user!;
      const { id } = req.params;
      
      // Get company info for this tenant
      const company = await db
        .select({ id: companies.id })
        .from(companies)
        .innerJoin(tenants, eq(companies.id, tenants.companyId))
        .where(eq(tenants.id, tenantId))
        .limit(1);
      
      if (company.length === 0) {
        return res.status(404).json({ message: 'Company not found for tenant' });
      }
      
      const companyId = company[0].id;
      
      // Get the agreement with all details
      const agreement = await serviceAgreementService.getAgreementById(id, companyId);
      
      if (!agreement) {
        return res.status(404).json({ message: 'Service agreement not found' });
      }
      
      // Generate PDF using our PDF service
      const { serviceAgreementPDFService } = await import('./pdf');
      const pdfBuffer = await serviceAgreementPDFService.renderAgreementPdf(id, companyId);
      
      // Set appropriate headers for PDF response
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="service-agreement-${id}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      // Send the PDF buffer
      res.send(pdfBuffer);
    } catch (error) {
      handleError(res, error, 'Failed to generate PDF');
    }
  }

  /**
   * GET /:id/calculate-total - Calculate agreement total with precise decimal math
   */
  async calculateAgreementTotal(req: AuthenticatedRequest, res: Response) {
    try {
      const { tenantId } = req.user!;
      const { id } = req.params;
      
      // Get company info for this tenant
      const company = await db
        .select({ id: companies.id })
        .from(companies)
        .innerJoin(tenants, eq(companies.id, tenants.companyId))
        .where(eq(tenants.id, tenantId))
        .limit(1);
      
      if (company.length === 0) {
        return res.status(404).json({ message: 'Company not found for tenant' });
      }
      
      const companyId = company[0].id;
      
      // Verify agreement belongs to company first
      const agreement = await serviceAgreementService.getAgreementById(id, companyId);
      if (!agreement) {
        return res.status(404).json({ message: 'Service agreement not found' });
      }
      
      const calculation = await serviceAgreementService.calculateAgreementTotal(id);
      res.json(calculation);
    } catch (error) {
      handleError(res, error, 'Failed to calculate agreement total');
    }
  }

  /**
   * POST /:id/create-sharing-link - Create a shareable link for third-party signing
   */
  async createSharingLink(req: AuthenticatedRequest, res: Response) {
    try {
      const { tenantId, id: userId } = req.user!;
      const { id } = req.params;
      const { signerRole, recipientEmail, expirationDays = 7, maxUses = 1 } = req.body;
      
      // Verify user has write permissions
      if (!hasWritePermission(req.user!.role)) {
        return res.status(403).json({ message: 'Insufficient permissions to create sharing links' });
      }
      
      // Get company info for this tenant
      const company = await db
        .select({ id: companies.id })
        .from(companies)
        .innerJoin(tenants, eq(companies.id, tenants.companyId))
        .where(eq(tenants.id, tenantId))
        .limit(1);
      
      if (company.length === 0) {
        return res.status(404).json({ message: 'Company not found for tenant' });
      }
      
      const companyId = company[0].id;
      
      // Verify agreement belongs to company
      const agreement = await serviceAgreementService.getAgreementById(id, companyId);
      if (!agreement) {
        return res.status(404).json({ message: 'Service agreement not found' });
      }
      
      // Validate signer role
      if (!['client', 'organisation', 'nominee'].includes(signerRole)) {
        return res.status(400).json({ message: 'Invalid signer role' });
      }
      
      // Create sharing token
      const token = await serviceAgreementSharingService.createSharingToken(
        id,
        signerRole,
        userId.toString(),
        expirationDays,
        maxUses,
        recipientEmail
      );
      
      // Generate the public sharing URL
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
      const sharingUrl = `${baseUrl}/sign/${id}/${token.token}`;
      
      console.log(`[CONTROLLER] Created sharing link for agreement ${id}, role: ${signerRole}`);
      
      res.json({
        success: true,
        token: token,
        sharingUrl,
        accessCode: token.accessCode,
        expiresAt: token.expiresAt
      });
    } catch (error) {
      handleError(res, error, 'Failed to create sharing link');
    }
  }

  /**
   * GET /:id/sharing-tokens - Get all sharing tokens for an agreement
   */
  async getSharingTokens(req: AuthenticatedRequest, res: Response) {
    try {
      const { tenantId } = req.user!;
      const { id } = req.params;
      
      // Get company info for this tenant
      const company = await db
        .select({ id: companies.id })
        .from(companies)
        .innerJoin(tenants, eq(companies.id, tenants.companyId))
        .where(eq(tenants.id, tenantId))
        .limit(1);
      
      if (company.length === 0) {
        return res.status(404).json({ message: 'Company not found for tenant' });
      }
      
      const companyId = company[0].id;
      
      // Verify agreement belongs to company
      const agreement = await serviceAgreementService.getAgreementById(id, companyId);
      if (!agreement) {
        return res.status(404).json({ message: 'Service agreement not found' });
      }
      
      const tokens = await serviceAgreementSharingService.getSharingTokensForAgreement(id);
      
      res.json(tokens);
    } catch (error) {
      handleError(res, error, 'Failed to retrieve sharing tokens');
    }
  }

  /**
   * POST /sharing-tokens/:tokenId/deactivate - Deactivate a sharing token
   */
  async deactivateSharingToken(req: AuthenticatedRequest, res: Response) {
    try {
      const { tokenId } = req.params;
      
      // Verify user has write permissions
      if (!hasWritePermission(req.user!.role)) {
        return res.status(403).json({ message: 'Insufficient permissions to deactivate sharing tokens' });
      }
      
      await serviceAgreementSharingService.deactivateToken(tokenId);
      
      res.json({ success: true, message: 'Sharing token deactivated' });
    } catch (error) {
      handleError(res, error, 'Failed to deactivate sharing token');
    }
  }
}

export const serviceAgreementController = new ServiceAgreementController();