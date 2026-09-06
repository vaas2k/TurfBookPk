import { Router } from 'express';
import { VendorController } from '../controllers/vendorController.js';
import { requireAuth } from '../middleware/auth.js';
import { TokenService } from '../services/tokenService.js';

export function createVendorRouter(controller: VendorController, tokenService: TokenService): Router {
  const router = Router();
  router.use(requireAuth(tokenService));
  router.get('/me', controller.me);
  router.post('/', controller.create);
  return router;
}