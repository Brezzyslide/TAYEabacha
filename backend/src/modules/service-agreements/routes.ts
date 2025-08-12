import { Router } from 'express';
import { serviceAgreementController } from './controller';

export const serviceAgreementRouter = Router();

// GET / - List service agreements with optional client filter
serviceAgreementRouter.get('/', (req, res) => {
  serviceAgreementController.getAgreements(req as any, res);
});

// POST / - Create a new service agreement
serviceAgreementRouter.post('/', (req, res) => {
  serviceAgreementController.createAgreement(req as any, res);
});

// GET /:id - Get a specific service agreement
serviceAgreementRouter.get('/:id', (req, res) => {
  serviceAgreementController.getAgreementById(req as any, res);
});

// PUT /:id - Update a service agreement
serviceAgreementRouter.put('/:id', (req, res) => {
  serviceAgreementController.updateAgreement(req as any, res);
});

// DELETE /:id - Delete a service agreement
serviceAgreementRouter.delete('/:id', (req, res) => {
  serviceAgreementController.deleteAgreement(req as any, res);
});

// POST /:id/items - Add an item to a service agreement
serviceAgreementRouter.post('/:id/items', (req, res) => {
  serviceAgreementController.createAgreementItem(req as any, res);
});

// PUT /:id/items/:itemId - Update a service agreement item
serviceAgreementRouter.put('/:id/items/:itemId', (req, res) => {
  serviceAgreementController.updateAgreementItem(req as any, res);
});

// DELETE /:id/items/:itemId - Delete a service agreement item
serviceAgreementRouter.delete('/:id/items/:itemId', (req, res) => {
  serviceAgreementController.deleteAgreementItem(req as any, res);
});

// POST /:id/sign - Add a signature to a service agreement
serviceAgreementRouter.post('/:id/sign', (req, res) => {
  serviceAgreementController.addSignature(req as any, res);
});

// GET /:id/pdf - Generate PDF for a service agreement
serviceAgreementRouter.get('/:id/pdf', (req, res) => {
  serviceAgreementController.generatePDF(req as any, res);
});