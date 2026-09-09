import { OtpChallenge, StoredRefreshSession, UserProfile } from '../types/auth.js';

export interface AuthRepository {
  findUserByPhone(phone: string): Promise<UserProfile | null>;
  findUserById(id: string): Promise<UserProfile | null>;
  createUser(phone: string): Promise<UserProfile>;
  updateUser(id: string, changes: Partial<UserProfile>): Promise<UserProfile>;
  saveOtp(challenge: OtpChallenge): Promise<void>;
  getOtp(phone: string): Promise<OtpChallenge | null>;
  deleteOtp(phone: string): Promise<void>;
  saveRefreshSession(session: StoredRefreshSession): Promise<void>;
  findRefreshSession(tokenHash: string): Promise<StoredRefreshSession | null>;
  findRefreshSessionById(id: string): Promise<StoredRefreshSession | null>;
  revokeRefreshSession(id: string): Promise<void>;
  rotateRefreshSession(existingId: string, expectedTokenHash: string, replacement: StoredRefreshSession): Promise<boolean>;
}
