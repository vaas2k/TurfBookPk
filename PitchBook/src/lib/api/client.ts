import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import axios, { AxiosRequestConfig } from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '');
const REFRESH_TOKEN_KEY = 'pitchbook.refresh-token';
const REQUEST_TIMEOUT_MS = 10000;

export interface ApiError {
  code: string;
  message: string;
}

let accessToken: string | null = null;
let sessionRevision = 0;
let refreshPromise: Promise<RefreshPayload> | null = null;

interface RefreshPayload {
  user: { id: string; phone: string | null; email: string | null };
  profile: unknown;
  session: { accessToken: string; refreshToken: string; expiresIn: number };
}

export function getApiConfigurationError(): string | null {
  if (!API_URL) return 'EXPO_PUBLIC_API_URL is missing. Add it to PitchBook/.env and restart Expo.';
  try {
    const url = new URL(API_URL);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? null
      : 'EXPO_PUBLIC_API_URL must use http:// or https://.';
  } catch {
    return 'EXPO_PUBLIC_API_URL must be a valid http:// or https:// API address.';
  }
}

async function isSecureStorageAvailable(): Promise<boolean> {
  return SecureStore.isAvailableAsync();
}

export async function getRefreshToken(): Promise<string | null> {
  return (await isSecureStorageAvailable())
    ? SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
    : AsyncStorage.getItem(REFRESH_TOKEN_KEY);
}

export async function setRefreshToken(token: string): Promise<void> {
  if (await isSecureStorageAvailable()) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  } else {
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, token);
  }
}

export async function clearRefreshToken(): Promise<void> {
  if (await isSecureStorageAvailable()) {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  }
  await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  sessionRevision += 1;
}

async function clearRefreshTokenIfUnchanged(expectedToken: string): Promise<void> {
  if (await getRefreshToken() === expectedToken) await clearRefreshToken();
}

export async function refreshStoredSession<T extends RefreshPayload = RefreshPayload>(): Promise<T> {
  if (refreshPromise) return refreshPromise as Promise<T>;
  const revisionAtStart = sessionRevision;
  refreshPromise = (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) throw { code: 'unauthorized', message: 'No saved session' } satisfies ApiError;
    try {
      const result = await apiRequest<RefreshPayload>('/auth/refresh', { method: 'POST', data: { refreshToken } }, false);
      if (sessionRevision !== revisionAtStart) throw { code: 'stale_refresh', message: 'A newer authentication state is already active' } satisfies ApiError;
      await setRefreshToken(result.session.refreshToken);
      if (sessionRevision !== revisionAtStart) {
        await clearRefreshTokenIfUnchanged(result.session.refreshToken);
        throw { code: 'stale_refresh', message: 'A newer authentication state is already active' } satisfies ApiError;
      }
      accessToken = result.session.accessToken;
      sessionRevision += 1;
      return result;
    } catch (error) {
      if (sessionRevision === revisionAtStart) {
        await clearRefreshTokenIfUnchanged(refreshToken);
        accessToken = null;
        sessionRevision += 1;
      }
      throw error;
    }
  })();
  try {
    return await refreshPromise as T;
  } finally {
    refreshPromise = null;
  }
}

export async function apiRequest<T>(path: string, options: AxiosRequestConfig = {}, retry = true): Promise<T> {
  const configurationError = getApiConfigurationError();
  if (configurationError) throw { code: 'configuration_error', message: configurationError } satisfies ApiError;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };

  try {
    const response = await axios.request<T>({
      ...options,
      url: `${API_URL!}${path}`,
      headers : {...headers,contentType: 'application/json'},
      timeout: REQUEST_TIMEOUT_MS,
    });
    return response.status === 204 ? undefined as T : response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      if (error.response.status === 401 && retry && path !== '/auth/refresh' && path !== '/auth/logout') {
        try {
          await refreshStoredSession();
          return apiRequest<T>(path, options, false);
        } catch {
          // The refresh helper safely clears only the token it attempted.
        }
      }

      const body = error.response.data as { error?: ApiError } | undefined;
      throw body?.error || { code: 'network_error', message: 'Unable to connect to the server' } satisfies ApiError;
    }

    throw {
      code: 'network_error',
      message: axios.isAxiosError(error) && error.code === 'ECONNABORTED'
        ? 'The server took too long to respond'
        : 'Unable to connect to the server',
    } satisfies ApiError;
  }
}
