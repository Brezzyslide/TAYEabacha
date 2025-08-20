import { Router } from 'express';
import {
  createReferralForm,
  getReferralForms,
  getReferralForm,
  updateReferralForm,
  deleteReferralForm,
  generateShareableLink,
  getFormSubmissions,
  getFormLinks,
  deactivateLink
} from './controller';

const router = Router();

// Authentication is handled at the route mounting level in server/routes.ts

// CRUD operations for referral forms
router.post('/', createReferralForm);
router.get('/', getReferralForms);
router.get('/:id', getReferralForm);
router.put('/:id', updateReferralForm);
router.delete('/:id', deleteReferralForm);

// Link management
router.post('/:id/generate-link', generateShareableLink);
router.get('/:id/links', getFormLinks);
router.patch('/links/:linkId/deactivate', deactivateLink);

// Submissions
router.get('/:id/submissions', getFormSubmissions);

export { router as referralFormRouter };