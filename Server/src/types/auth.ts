export type UserRole = 'player' | 'vendor' | 'admin';

export interface UserProfile {
  id: string;
  phone: string | null;
  email: string | null;
  full_name: string;
  city: string | null;
  bio: string | null;
  preferred_foot: 'Left' | 'Right' | 'Both' | null;
  preferred_position: string | null;
  skill_level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Professional' | null;
  role: UserRole;
  avatar_url: string | null;
  is_verified: boolean;
  is_setup_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: string;
  phone: string | null;
  email: string | null;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResult {
  user: AuthUser;
  profile: UserProfile;
  session: AuthSession;
}

export interface StoredRefreshSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: number;
  revokedAt: number | null;
  createdAt: number;
}

export interface OtpChallenge {
  phone: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
  requestCount: number;
  requestWindowStartedAt: number;
  lastSentAt: number;
}
