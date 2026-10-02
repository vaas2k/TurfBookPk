import { Router } from 'express';
import { AdminController } from '../controllers/adminController.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { TokenService } from '../services/tokenService.js';

export function createAdminRouter(controller: AdminController, tokenService: TokenService): Router {
  const router = Router();
  router.use(requireAuth(tokenService), requireAdmin());
  router.get('/dashboard', controller.dashboard);
  router.get('/vendors', controller.listVendors);
  router.get('/vendors/:id/verification', controller.vendorVerification);
  router.patch('/vendors/:id/verification/:area', controller.reviewVendorVerification);
  router.get('/verification-documents/:id/download', controller.vendorDocumentDownload);
  router.get('/grounds', controller.listGrounds);
  router.get('/users', controller.listUsers);
  router.get('/transactions', controller.listTransactions);
  router.get('/operations', controller.operations);
  router.get('/refunds', controller.listRefunds);
  router.patch('/vendors/:id/verification', controller.setVendorVerification);
  router.patch('/grounds/:id/verification', controller.setGroundVerification);
  router.patch('/grounds/:id/activation', controller.setGroundActivation);
  router.get('/review-reports', controller.listReports);
  router.patch('/review-reports/:id', controller.resolveReport);
  router.patch('/users/:id/suspension', controller.setUserSuspension);
  return router;
}
