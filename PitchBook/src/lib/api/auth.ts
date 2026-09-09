import { apiRequest, clearRefreshToken, getRefreshToken, refreshStoredSession, setAccessToken, setRefreshToken } from './client';
import { AuthResult, AuthSession, AuthUser, UserProfile } from '@/types/auth';

interface AuthPayload {
  user: AuthUser;
  profile: UserProfile;
  session: AuthSession;
}

export async function requestOtp(phone: string): Promise<void> {
  await apiRequest('/auth/otp/request', {
    method: 'POST',
    data: { phone },
  });
}

export async function verifyOtp(phone: string, code: string): Promise<AuthPayload> {
  const result = await apiRequest<AuthPayload>('/auth/otp/verify', {
    method: 'POST',
    data: { phone, code },
  });
  await saveSession(result.session);
  return result;
}

export async function refreshSession(): Promise<AuthPayload> {
  return refreshStoredSession<AuthPayload>();
}

export async function getCurrentUser(): Promise<Pick<AuthPayload, 'user' | 'profile'>> {
  return apiRequest('/auth/me');
}

export async function updateProfile(data: Partial<UserProfile>): Promise<Pick<AuthPayload, 'user' | 'profile'>> {
  return apiRequest('/auth/me', { method: 'PATCH', data });
}

export async function signOut(): Promise<void> {
  const refreshToken = await getRefreshToken();
  try {
    await apiRequest('/auth/logout', {
      method: 'POST',
      data: { refreshToken },
    }, false);
  } finally {
    setAccessToken(null);
    await clearRefreshToken();
  }
}

async function saveSession(session: AuthSession): Promise<void> {
  setAccessToken(session.accessToken);
  await setRefreshToken(session.refreshToken);
}

export type { AuthResult };
