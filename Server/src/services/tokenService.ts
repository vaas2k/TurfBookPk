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
    const created = this.buildSession(user);
    await this.repository.saveRefreshSession(created.storedSession);
    return created.session;
  }

  private buildSession(user: UserProfile): { session: AuthSession; storedSession: StoredRefreshSession } {
    const sessionId = randomUUID();
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = Date.now() + env.refreshTokenDays * 86_400_000;
    const accessToken = jwt.sign({ sub: user.id, sid: sessionId }, env.jwtAccessSecret, {
      expiresIn: env.accessTokenSeconds,
    });

    const session: StoredRefreshSession = {
      id: sessionId,
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt,
      revokedAt: null,
      createdAt: Date.now(),
    };
    return { session: { accessToken, refreshToken, expiresIn: env.accessTokenSeconds }, storedSession: session };
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

  async authenticateAccessToken(token: string): Promise<{ userId: string; sessionId: string }> {
    const claims = this.verifyAccessToken(token);
    const session = await this.repository.findRefreshSessionById(claims.sessionId);
    if (!session || session.userId !== claims.userId || session.revokedAt || session.expiresAt <= Date.now()) {
      throw new AppError('unauthorized', 'Your session has been logged out or expired', 401);
    }
    return claims;
  }

  async refresh(refreshToken: string): Promise<{ user: UserProfile; session: AuthSession }> {
    const existing = await this.repository.findRefreshSession(hashToken(refreshToken));
    if (!existing || existing.revokedAt || existing.expiresAt < Date.now()) {
      throw new AppError('unauthorized', 'Your refresh session is invalid or expired', 401);
    }
    const user = await this.repository.findUserById(existing.userId);
    if (!user) throw new AppError('unauthorized', 'User account was not found', 401);
    const replacement = this.buildSession(user);
    const rotated = await this.repository.rotateRefreshSession(existing.id, hashToken(refreshToken), replacement.storedSession);
    if (!rotated) throw new AppError('unauthorized', 'This refresh token has already been used', 401);
    return { user, session: replacement.session };
  }

  async revoke(refreshToken: string): Promise<void> {
    const session = await this.repository.findRefreshSession(hashToken(refreshToken));
    if (session) await this.repository.revokeRefreshSession(session.id);
  }
}
