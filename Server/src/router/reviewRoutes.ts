import { Router } from 'express';
import { ReviewController } from '../controllers/reviewController.js';
import { requireAuth } from '../middleware/auth.js';
import { TokenService } from '../services/tokenService.js';
export function createReviewRouter(controller: ReviewController, tokenService: TokenService): Router { const router = Router(); router.get('/grounds/:groundId', controller.list); router.post('/bookings/:bookingId', requireAuth(tokenService), controller.create); return router; }
