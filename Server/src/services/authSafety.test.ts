import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthRepository } from '../database/authRepository.js';
import { OtpChallenge, StoredRefreshSession, UserProfile } from '../types/auth.js';
import { OtpService } from './otpService.js';
import { TokenService } from './tokenService.js';

class MemoryAuthRepository implements AuthRepository {
  otp: OtpChallenge | null = null;
  sessions = new Map<string, StoredRefreshSession>();
  user: UserProfile = {
    id: '00000000-0000-4000-8000-000000000001', phone: '923001234567', email: null, full_name: 'Test Player',
    city: null, bio: null, preferred_foot: null, preferred_position: null, skill_level: null, role: 'player',
    avatar_url: null, is_verified: true, is_setup_complete: true,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };

  async findUserByPhone(): Promise<UserProfile | null> { return this.user; }
  async findUserById(): Promise<UserProfile | null> { return this.user; }
  async createUser(): Promise<UserProfile> { return this.user; }
  async updateUser(): Promise<UserProfile> { return this.user; }
  async saveOtp(challenge: OtpChallenge): Promise<void> { this.otp = { ...challenge }; }
  async getOtp(): Promise<OtpChallenge | null> { return this.otp ? { ...this.otp } : null; }
  async deleteOtp(): Promise<void> { this.otp = null; }
  async saveRefreshSession(session: StoredRefreshSession): Promise<void> { this.sessions.set(session.id, { ...session }); }
  async findRefreshSession(tokenHash: string): Promise<StoredRefreshSession | null> {
    return [...this.sessions.values()].find((session) => session.tokenHash === tokenHash) || null;
  }
  async findRefreshSessionById(id: string): Promise<StoredRefreshSession | null> { return this.sessions.get(id) || null; }
  async revokeRefreshSession(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) session.revokedAt = Date.now();
  }
  async rotateRefreshSession(existingId: string, expectedTokenHash: string, replacement: StoredRefreshSession): Promise<boolean> {
    const existing = this.sessions.get(existingId);
    if (!existing || existing.revokedAt || existing.tokenHash !== expectedTokenHash) return false;
    existing.revokedAt = Date.now();
    this.sessions.set(replacement.id, { ...replacement });
    return true;
  }
}

test('OTP resend preserves failed verification attempts within its abuse window', async () => {
  const repository = new MemoryAuthRepository();
  const now = Date.now();
  repository.otp = {
    phone: '923001234567', codeHash: 'old', expiresAt: now + 60_000, attempts: 4,
    requestCount: 1, requestWindowStartedAt: now - 120_000, lastSentAt: now - 61_000,
  };
  await new OtpService(repository).issue('923001234567');
  assert.equal(repository.otp?.attempts, 4);
  assert.equal(repository.otp?.requestCount, 2);
});

test('OTP resend cooldown is enforced', async () => {
  const repository = new MemoryAuthRepository();
  const service = new OtpService(repository);
  await service.issue('923001234567');
  await assert.rejects(service.issue('923001234567'), (error: any) => error.code === 'otp_request_too_soon' && error.statusCode === 429);
});

test('refresh token rotation has exactly one winner and revokes the old access token', async () => {
  const repository = new MemoryAuthRepository();
  const service = new TokenService(repository);
  const original = await service.createSession(repository.user);
  const attempts = await Promise.allSettled([service.refresh(original.refreshToken), service.refresh(original.refreshToken)]);
  assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(attempts.filter((result) => result.status === 'rejected').length, 1);
  await assert.rejects(service.authenticateAccessToken(original.accessToken), (error: any) => error.code === 'unauthorized');
});
