import { Router } from 'express';
import { MediaController } from '../controllers/mediaController.js';
import { requireAuth } from '../middleware/auth.js';
import { TokenService } from '../services/tokenService.js';
export function createMediaRouter(controller: MediaController, tokenService: TokenService): Router {
  const router = Router(); router.use(requireAuth(tokenService)); router.post('/upload-target', controller.createUploadTarget); router.delete('/', controller.remove); return router;
}
