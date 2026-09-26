import { Router } from 'express';
import { EngagementController } from '../controllers/engagementController.js';
import { requireAuth } from '../middleware/auth.js';
import { TokenService } from '../services/tokenService.js';
export function createEngagementRouter(controller: EngagementController, tokenService: TokenService): Router { const router = Router(); router.use(requireAuth(tokenService)); router.get('/favorites', controller.favorites); router.get('/recent', controller.recent); router.post('/grounds/:groundId/favorite', controller.addFavorite); router.delete('/grounds/:groundId/favorite', controller.removeFavorite); router.post('/grounds/:groundId/view', controller.viewGround); return router; }
