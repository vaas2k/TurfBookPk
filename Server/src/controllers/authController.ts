import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AuthService } from '../services/authService.js';
import { TokenService } from '../services/tokenService.js';
import { AppError } from '../helpers/errors.js';

function bodyString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
  ) {}

  requestOtp = async (request: Request, response: Response): Promise<void> => {
    await this.authService.requestOtp(bodyString(request.body?.phone));
    response.status(202).json({ message: 'Verification code sent' });
  };

  verifyOtp = async (request: Request, response: Response): Promise<void> => {
    const result = await this.authService.verifyOtp(
      bodyString(request.body?.phone),
      bodyString(request.body?.code),
    );
    response.json(result);
  };

  refresh = async (request: Request, response: Response): Promise<void> => {
    const refreshToken = bodyString(request.body?.refreshToken);
    if (!refreshToken) throw new AppError('unauthorized', 'Refresh token is required', 401);
    const result = await this.tokenService.refresh(refreshToken);
    response.json({
      user: { id: result.user.id, phone: result.user.phone, email: result.user.email },
      profile: result.user,
      session: result.session,
    });
  };

  logout = async (request: Request, response: Response): Promise<void> => {
    const refreshToken = bodyString(request.body?.refreshToken);
    if (refreshToken) await this.tokenService.revoke(refreshToken);
    response.status(204).send();
  };

  me = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const profile = await this.authService.getProfile(request.auth.userId);
    response.json({ user: { id: profile.id, phone: profile.phone, email: profile.email }, profile });
  };

  updateMe = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const profile = await this.authService.updateProfile(request.auth.userId, request.body || {});
    response.json({ user: { id: profile.id, phone: profile.phone, email: profile.email }, profile });
  };
}