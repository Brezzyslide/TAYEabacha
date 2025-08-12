import { Request, Response } from 'express';

// Extended Request interface with auth details
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
    tenantId: number;
    companyId: string;
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
import { ZodError } from 'zod';

/**
 * Check if user has write permissions (Admin or TeamLeader)
 */
const hasWritePermission = (role: string): boolean => {
  return ['Admin', 'TeamLeader'].includes(role);
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
      const { companyId } = req.user!;
      
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
      const { companyId, role, id: userId } = req.user!;
      
      // Check permissions
      if (!hasWritePermission(role)) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }
      
      // Validate request body
      const validation = serviceAgreementCreateSchema.safeParse(req.body);
      if (!validation.success) {
        return handleError(res, validation.error, 'Invalid request data');
      }
      
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
      const { companyId } = req.user!;
      const { id } = req.params;
      
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
      const { companyId, role } = req.user!;
      const { id } = req.params;
      
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
      const { companyId, role } = req.user!;
      const { id } = req.params;
      
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
      const { companyId, role } = req.user!;
      const { id } = req.params;
      
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
      const { companyId, role } = req.user!;
      const { id, itemId } = req.params;
      
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
      const { companyId, role } = req.user!;
      const { id, itemId } = req.params;
      
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
      const { companyId, role, id: userId } = req.user!;
      const { id } = req.params;
      
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
      const { companyId } = req.user!;
      const { id } = req.params;
      
      // Get the agreement with all details
      const agreement = await serviceAgreementService.getAgreementById(id, companyId);
      
      if (!agreement) {
        return res.status(404).json({ message: 'Service agreement not found' });
      }
      
      // TODO: Implement PDF generation
      // For now, return a stub response
      res.status(501).json({ 
        message: 'PDF generation not yet implemented',
        agreementId: id 
      });
    } catch (error) {
      handleError(res, error, 'Failed to generate PDF');
    }
  }

  /**
   * GET /:id/calculate-total - Calculate agreement total with precise decimal math
   */
  async calculateAgreementTotal(req: AuthenticatedRequest, res: Response) {
    try {
      const { companyId } = req.user!;
      const { id } = req.params;
      
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
}

export const serviceAgreementController = new ServiceAgreementController();