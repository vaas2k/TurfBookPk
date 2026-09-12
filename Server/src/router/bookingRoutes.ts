import { Router } from 'express';
import { BookingController } from '../controllers/bookingController.js';
import { requireAuth } from '../middleware/auth.js';
import { TokenService } from '../services/tokenService.js';

export function createBookingRouter(controller: BookingController, tokenService: TokenService): Router {
  const router = Router();
  router.use(requireAuth(tokenService));
  router.post('/', controller.create);
  router.post('/orders', controller.createOrder);
  router.post('/orders/:id/mock-confirm', controller.confirmOrderMock);
  router.post('/:id/mock-confirm', controller.confirmMock);
  router.get('/notifications', controller.notifications);
  router.get('/mine', controller.playerList);
  router.get('/vendor', controller.vendorList);
  router.get('/:id', controller.detail);
  router.patch('/:id/cancel', controller.cancel);
  router.patch('/:id/no-show', controller.markNoShow);
  return router;
}
