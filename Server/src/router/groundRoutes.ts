import { Router } from 'express';
import { GroundController } from '../controllers/groundController.js';
import { requireAuth } from '../middleware/auth.js';
import { TokenService } from '../services/tokenService.js';

export function createGroundRouter(controller: GroundController, tokenService: TokenService): Router {
  const router = Router();
  router.get('/', controller.listPublic);
  router.get('/vendor/mine', requireAuth(tokenService), controller.listMine);
  router.get('/:id', controller.getPublic);
  router.get('/:id/slots', controller.listSlots);
  router.use(requireAuth(tokenService));
  router.post('/', controller.create);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove);
  router.post('/:id/slots', controller.createSlot);
  router.patch('/:groundId/slots/:slotId', controller.updateSlot);
  router.delete('/:groundId/slots/:slotId', controller.removeSlot);
  return router;
}