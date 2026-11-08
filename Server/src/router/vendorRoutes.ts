import { Router } from 'express';
import { VendorController } from '../controllers/vendorController.js';
import { requireAuth } from '../middleware/auth.js';
import { TokenService } from '../services/tokenService.js';
import { ManagerController } from '../controllers/managerController.js';

export function createVendorRouter(controller: VendorController, tokenService: TokenService): Router {
  const router = Router();
  router.use(requireAuth(tokenService));
  const managerController = new ManagerController();
  router.get('/manager-assignments', managerController.mine);
  router.get('/manager-grounds/:groundId/slots', managerController.slotsForDay);
  router.patch('/manager-grounds/:groundId/slots/:slotId', managerController.changeSlot);
  router.post('/manager-assignments/:id/accept', managerController.accept);
  router.get('/managers', managerController.list);
  router.post('/managers', managerController.add);
  router.delete('/managers/:id', managerController.revoke);
  router.get('/me', controller.me);
  router.get('/verification', controller.verification);
  router.put('/verification/:step', controller.saveVerificationStep);
  router.post('/verification/submit', controller.submitVerification);
  router.get('/earnings', controller.earnings);
  router.patch('/mode', controller.activateMode);
  router.patch('/me', controller.update);
  router.post('/', controller.create);
  return router;
}
