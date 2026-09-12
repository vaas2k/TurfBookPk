import { Router } from 'express';
import { VendorController } from '../controllers/vendorController.js';
import { requireAuth } from '../middleware/auth.js';
import { TokenService } from '../services/tokenService.js';

export function createVendorRouter(controller: VendorController, tokenService: TokenService): Router {
  const router = Router();
  router.use(requireAuth(tokenService));
  router.get('/me', controller.me);
  router.get('/earnings', controller.earnings);
  router.patch('/mode', controller.activateMode);
  router.patch('/me', controller.update);
  router.post('/', controller.create);
  return router;
}
