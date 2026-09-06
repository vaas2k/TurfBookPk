import { createHash, randomBytes, randomUUID } from 'node:crypto';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { env } from '../configs/env.js';
import { AuthRepository } from '../database/authRepository.js';
import { AppError } from '../helpers/errors.js';
import { AuthSession, StoredRefreshSession, UserProfile } from '../types/auth.js';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export class TokenService {
  constructor(private readonly repository: AuthRepository) {}

  async createSession(user: UserProfile): Promise<AuthSession> {
    const sessionId = randomUUID();
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = Date.now() + env.refreshTokenDays * 86_400_000;
    const accessToken = jwt.sign({ sub: user.id, sid: sessionId }, env.jwtAccessSecret, {
      expiresIn: 15 * 60,
    });

    const session: StoredRefreshSession = {
      id: sessionId,
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt,
      revokedAt: null,
      createdAt: Date.now(),
    };
    await this.repository.saveRefreshSession(session);
    return { accessToken, refreshToken, expiresIn: 15 * 60 };
  }

  verifyAccessToken(token: string): { userId: string; sessionId: string } {
    try {
      const payload = jwt.verify(token, env.jwtAccessSecret) as JwtPayload;
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') throw new Error();
      return { userId: payload.sub, sessionId: payload.sid };
    } catch {
      throw new AppError('unauthorized', 'Your session is invalid or expired', 401);
    }
  }

  async refresh(refreshToken: string): Promise<{ user: UserProfile; session: AuthSession }> {
    const existing = await this.repository.findRefreshSession(hashToken(refreshToken));
    if (!existing || existing.revokedAt || existing.expiresAt < Date.now()) {
      throw new AppError('unauthorized', 'Your refresh session is invalid or expired', 401);
    }
    const user = await this.repository.findUserById(existing.userId);
    if (!user) throw new AppError('unauthorized', 'User account was not found', 401);
    await this.repository.revokeRefreshSession(existing.id);
    return { user, session: await this.createSession(user) };
  }

  async revoke(refreshToken: string): Promise<void> {
    const session = await this.repository.findRefreshSession(hashToken(refreshToken));
    if (session) await this.repository.revokeRefreshSession(session.id);
  }
}