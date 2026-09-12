import { Router } from 'express';
import { NotificationController } from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/auth.js';
import { TokenService } from '../services/tokenService.js';

export function createNotificationRouter(controller: NotificationController, tokenService: TokenService): Router {
  const router = Router();
  router.use(requireAuth(tokenService));
  router.get('/', controller.list);
  router.patch('/read-all', controller.markAllRead);
  router.patch('/:id/read', controller.markRead);
  return router;
}
