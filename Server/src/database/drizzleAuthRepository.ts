import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { AuthRepository } from './authRepository.js';
import { db } from './client.js';
import { otpChallenges, refreshSessions, users } from './schema.js';
import { OtpChallenge, StoredRefreshSession, UserProfile } from '../types/auth.js';

export class DrizzleAuthRepository implements AuthRepository {
  async findUserByPhone(phone: string): Promise<UserProfile | null> {
    const rows = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
    return rows[0] ? this.toUserProfile(rows[0]) : null;
  }

  async findUserById(id: string): Promise<UserProfile | null> {
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0] ? this.toUserProfile(rows[0]) : null;
  }

  async createUser(phone: string): Promise<UserProfile> {
    const rows = await db.insert(users).values({
      id: randomUUID(),
      phone,
      isVerified: true,
    }).returning();
    const user = rows[0];
    if (!user) throw new Error('User could not be created');
    return this.toUserProfile(user);
  }

  async updateUser(id: string, changes: Partial<UserProfile>): Promise<UserProfile> {
    const values: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (changes.phone !== undefined) values.phone = changes.phone;
    if (changes.email !== undefined) values.email = changes.email;
    if (changes.full_name !== undefined) values.fullName = changes.full_name;
    if (changes.city !== undefined) values.city = changes.city;
    if (changes.bio !== undefined) values.bio = changes.bio;
    if (changes.preferred_foot !== undefined) values.preferredFoot = changes.preferred_foot;
    if (changes.preferred_position !== undefined) values.preferredPosition = changes.preferred_position;
    if (changes.skill_level !== undefined) values.skillLevel = changes.skill_level;
    if (changes.role !== undefined) values.role = changes.role;
    if (changes.avatar_url !== undefined) values.avatarUrl = changes.avatar_url;
    if (changes.is_verified !== undefined) values.isVerified = changes.is_verified;
    if (changes.is_setup_complete !== undefined) values.isSetupComplete = changes.is_setup_complete;

    const rows = await db.update(users).set(values).where(eq(users.id, id)).returning();
    const user = rows[0];
    if (!user) throw new Error('User not found');
    return this.toUserProfile(user);
  }

  async saveOtp(challenge: OtpChallenge): Promise<void> {
    await db.insert(otpChallenges).values({
      phone: challenge.phone,
      codeHash: challenge.codeHash,
      expiresAt: new Date(challenge.expiresAt),
      attempts: challenge.attempts,
    }).onConflictDoUpdate({
      target: otpChallenges.phone,
      set: {
        codeHash: challenge.codeHash,
        expiresAt: new Date(challenge.expiresAt),
        attempts: challenge.attempts,
      },
    });
  }

  async getOtp(phone: string): Promise<OtpChallenge | null> {
    const rows = await db.select().from(otpChallenges).where(eq(otpChallenges.phone, phone)).limit(1);
    const challenge = rows[0];
    if (!challenge) return null;
    return {
      phone: challenge.phone,
      codeHash: challenge.codeHash,
      expiresAt: challenge.expiresAt.getTime(),
      attempts: challenge.attempts,
    };
  }

  async deleteOtp(phone: string): Promise<void> {
    await db.delete(otpChallenges).where(eq(otpChallenges.phone, phone));
  }

  async saveRefreshSession(session: StoredRefreshSession): Promise<void> {
    await db.insert(refreshSessions).values({
      id: session.id,
      userId: session.userId,
      tokenHash: session.tokenHash,
      expiresAt: new Date(session.expiresAt),
      revokedAt: session.revokedAt ? new Date(session.revokedAt) : null,
      createdAt: new Date(session.createdAt),
    });
  }

  async findRefreshSession(tokenHash: string): Promise<StoredRefreshSession | null> {
    const rows = await db.select().from(refreshSessions).where(eq(refreshSessions.tokenHash, tokenHash)).limit(1);
    const session = rows[0];
    if (!session) return null;
    return {
      id: session.id,
      userId: session.userId,
      tokenHash: session.tokenHash,
      expiresAt: session.expiresAt.getTime(),
      revokedAt: session.revokedAt?.getTime() || null,
      createdAt: session.createdAt.getTime(),
    };
  }

  async revokeRefreshSession(id: string): Promise<void> {
    await db.update(refreshSessions)
      .set({ revokedAt: new Date() })
      .where(eq(refreshSessions.id, id));
  }

  private toUserProfile(user: typeof users.$inferSelect): UserProfile {
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      full_name: user.fullName || 'Player',
      city: user.city,
      bio: user.bio,
      preferred_foot: user.preferredFoot as UserProfile['preferred_foot'],
      preferred_position: user.preferredPosition,
      skill_level: user.skillLevel as UserProfile['skill_level'],
      role: user.role === 'vendor' || user.role === 'admin' ? user.role : 'player',
      avatar_url: user.avatarUrl,
      is_verified: user.isVerified,
      is_setup_complete: user.isSetupComplete,
      created_at: user.createdAt.toISOString(),
      updated_at: user.updatedAt.toISOString(),
    };
  }
}