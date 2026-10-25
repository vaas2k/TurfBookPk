import { Router, text } from 'express';
import { PaymentController } from '../controllers/paymentController.js';
import { requireAuth } from '../middleware/auth.js';
import { TokenService } from '../services/tokenService.js';

export function createPublicPaymentRouter(controller: PaymentController): Router {
  const router = Router();
  router.post('/clink/acknowledgment', text({ type: 'text/plain', limit: '32kb' }), controller.acknowledge);
  return router;
}
export function createPaymentRouter(controller: PaymentController, tokenService: TokenService): Router {
  const router = Router(); router.use(requireAuth(tokenService));
  router.get('/configuration', controller.configuration);
  router.get('/billing-profile', controller.billingProfile);
  router.put('/billing-profile', controller.updateBillingProfile);
  router.post('/references', controller.generateReference);
  router.get('/booking/:bookingId', controller.bookingPaymentStatus);
  router.get('/:id', controller.paymentStatus);
  return router;
}
