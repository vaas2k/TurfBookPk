import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { TokenService } from '../services/tokenService.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { requireJsonBody } from '../middleware/requestValidation.js';

export function createAuthRouter(controller: AuthController, tokenService: TokenService): Router {
  const router = Router();
  const otpRequestLimit = createRateLimiter({ windowMs: 60_000, maxRequests: 5, code: 'too_many_otp_requests', message: 'Too many verification codes requested. Please try again later.' });
  const otpVerifyLimit = createRateLimiter({ windowMs: 60_000, maxRequests: 15, code: 'too_many_otp_attempts', message: 'Too many verification attempts. Please try again in one minute.' });
  router.post('/otp/request', requireJsonBody, controller.requestOtp);
  router.post('/otp/verify', requireJsonBody, controller.verifyOtp);
  router.post('/refresh', requireJsonBody, controller.refresh);
  router.post('/logout', requireJsonBody, controller.logout);
  router.get('/me', requireAuth(tokenService), controller.me);
  router.patch('/me', requireAuth(tokenService), controller.updateMe);
  return router;
}
