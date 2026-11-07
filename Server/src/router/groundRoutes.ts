import { Router } from 'express';
import { GroundController } from '../controllers/groundController.js';
import { requireAuth } from '../middleware/auth.js';
import { TokenService } from '../services/tokenService.js';

export function createGroundRouter(controller: GroundController, tokenService: TokenService): Router {
  const router = Router();
  router.get('/', controller.listPublic);
  router.get('/vendor/mine', requireAuth(tokenService), controller.listMine);
  router.get('/vendor/mine/:id/slots', requireAuth(tokenService), controller.vendorSlots);
  router.get('/:id/metadata', controller.getPublicMetadata);
  router.get('/:id', controller.getPublic);
  router.get('/:id/slots', controller.listSlots);
  router.use(requireAuth(tokenService));
  router.post('/location/resolve', controller.resolveLocation);
  router.get('/:id/verification', controller.verification);
  router.get('/:id/pitches', controller.listPitches);
  router.post('/:id/pitches', controller.createPitch);
  router.patch('/:id/pitches/:pitchId', controller.updatePitch);
  router.put('/:id/verification', controller.saveVerification);
  router.post('/:id/verification/submit', controller.submitVerification);
  router.post('/', controller.create);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove);
  router.put('/:id/schedule', controller.saveSchedule);
  router.get('/:id/blackouts', controller.listBlackouts);
  router.post('/:id/blackouts', controller.createBlackouts);
  router.delete('/:id/blackouts/:date', controller.removeBlackout);
  router.post('/:id/slots', controller.createSlot);
  router.post('/:id/slots/recurring', controller.createRecurringSlots);
  router.patch('/:id/slots/bulk', controller.bulkUpdateSlots);
  router.patch('/:groundId/slots/:slotId', controller.updateSlot);
  router.delete('/:groundId/slots/:slotId', controller.removeSlot);
  return router;
}
