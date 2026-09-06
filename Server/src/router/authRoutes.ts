import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { TokenService } from '../services/tokenService.js';

export function createAuthRouter(controller: AuthController, tokenService: TokenService): Router {
  const router = Router();
  router.post('/otp/request', controller.requestOtp);
  router.post('/otp/verify', controller.verifyOtp);
  router.post('/refresh', controller.refresh);
  router.post('/logout', controller.logout);
  router.get('/me', requireAuth(tokenService), controller.me);
  router.patch('/me', requireAuth(tokenService), controller.updateMe);
  return router;
}