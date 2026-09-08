import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import axios, { AxiosRequestConfig } from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const REFRESH_TOKEN_KEY = 'pitchbook.refresh-token';
const REQUEST_TIMEOUT_MS = 10000;

export interface ApiError {
  code: string;
  message: string;
}

let accessToken: string | null = null;

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
}

export async function apiRequest<T>(path: string, options: AxiosRequestConfig = {}, retry = true): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };

  try {
    const response = await axios.request<T>({
      ...options,
      url: `${API_URL}${path}`,
      headers,
      timeout: REQUEST_TIMEOUT_MS,
    });
    return response.status === 204 ? undefined as T : response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      if (error.response.status === 401 && retry && path !== '/auth/refresh' && path !== '/auth/logout') {
        const refreshToken = await getRefreshToken();
        if (refreshToken) {
          try {
            const refreshed = await apiRequest<{ session: { accessToken: string; refreshToken: string } }>(
              '/auth/refresh',
              { method: 'POST', data: { refreshToken } },
              false,
            );
            setAccessToken(refreshed.session.accessToken);
            await setRefreshToken(refreshed.session.refreshToken);
            return apiRequest<T>(path, options, false);
          } catch {
            await clearRefreshToken();
            setAccessToken(null);
          }
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
