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
  router.post('/:id/recurring-reservation/mock-confirm', controller.confirmRecurringReservationMock);
  router.get('/notifications', controller.notifications);
  router.get('/refund-bank-profile', controller.refundBankProfile);
  router.put('/refund-bank-profile', controller.saveRefundBankProfile);
  router.get('/mine', controller.playerList);
  router.get('/vendor', controller.vendorList);
  router.get('/manager', controller.managerList);
  router.get('/manager/:id', controller.managerDetail);
  router.get('/manager/:id/dispute', controller.managerDispute);
  router.post('/check-in/scan', controller.scanCheckIn);
  router.post('/:id/check-in-token', controller.issueCheckInToken);
  router.post('/manager/:id/check-in-code', controller.manualCheckIn);
  router.get('/:id', controller.detail);
  router.get('/:id/dispute', controller.dispute);
  router.post('/:id/disputes', controller.openDispute);
  router.post('/:id/disputes/:disputeId/respond', controller.respondToDispute);
  router.post('/:id/disputes/:disputeId/appeal', controller.appealDispute);
  router.get('/:id/cancellation-preview', controller.cancellationPreview);
  router.patch('/:id/cancel', controller.cancel);
  router.patch('/:id/no-show', controller.markNoShow);
  router.patch('/:id/delayed-start', controller.recordDelayedStart);
  router.patch('/:id/complete', controller.markCompleted);
  return router;
}
