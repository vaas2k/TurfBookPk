import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useVendorStore } from './vendorStore';
import {
  refreshSession,
  requestOtp,
  signOut as apiSignOut,
  updateProfile,
  verifyOtp,
} from '@/lib/api/auth';
import { ApiError, setAccessToken } from '@/lib/api/client';

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
  role: 'player' | 'vendor';
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

interface AuthState {
  user: AuthUser | null;
  session: AuthSession | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isNewUser: boolean;
  role: 'player' | 'vendor' | null;
  error: ApiError | null;
  lastMode?: 'player' | 'vendor' | null;
  sendOTP: (phone: string) => Promise<{ error: ApiError | null }>;
  verifyOTP: (phone: string, token: string) => Promise<{ error: ApiError | null }>;
  signInWithGoogle: () => Promise<{ error: ApiError | null }>;
  completeProfile: (data: Partial<UserProfile>) => Promise<{ error: ApiError | null }>;
  signOut: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  setSession: (session: AuthSession | null) => void;
  createUserProfile: (user: AuthUser) => Promise<{ error: ApiError | null }>;
  switchToPlayer: () => Promise<void>;
  setLastMode: (mode: 'player' | 'vendor') => void;
}

const initialState = {
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,
  isNewUser: false,
  role: null,
  lastMode: null,
  error: null,
} satisfies Pick<AuthState, 'user' | 'session' | 'profile' | 'isLoading' | 'isAuthenticated' | 'isNewUser' | 'role' | 'lastMode' | 'error'>;

function toApiError(error: unknown): ApiError {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return {
      code: 'code' in error && typeof error.code === 'string' ? error.code : 'unknown_error',
      message: String(error.message),
    };
  }
  return { code: 'unknown_error', message: 'Something went wrong. Please try again.' };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...initialState,

      sendOTP: async (phone) => {
        set({ isLoading: true, error: null });
        try {
          await requestOtp(phone);
          set({ isLoading: false });
          return { error: null };
        } catch (error) {
          const apiError = toApiError(error);
          set({ isLoading: false, error: apiError });
          return { error: apiError };
        }
      },

      verifyOTP: async (phone, token) => {
        set({ isLoading: true, error: null });
        try {
          const result = await verifyOtp(phone, token);
          set({
            user: result.user,
            session: result.session,
            profile: result.profile,
            isAuthenticated: true,
            isNewUser: !result.profile.is_setup_complete,
            role: result.profile.role,
            isLoading: false,
          });
          return { error: null };
        } catch (error) {
          const apiError = toApiError(error);
          set({ isLoading: false, error: apiError });
          return { error: apiError };
        }
      },

      signInWithGoogle: async () => ({
        error: { code: 'not_implemented', message: 'Google sign-in will be added after the core auth flow.' },
      }),

      completeProfile: async (data) => {
        if (!get().user) return { error: { code: 'unauthorized', message: 'No user is logged in' } };
        set({ isLoading: true, error: null });
        try {
          const result = await updateProfile({ ...data, is_setup_complete: true });
          set({ profile: result.profile, user: result.user, isNewUser: false, isLoading: false });
          return { error: null };
        } catch (error) {
          const apiError = toApiError(error);
          set({ isLoading: false, error: apiError });
          return { error: apiError };
        }
      },

      signOut: async () => {
        set({ isLoading: true });
        try {
          await apiSignOut();
        } finally {
          setAccessToken(null);
          set({ ...initialState, isLoading: false });
          useVendorStore.getState().clearVendor();
        }
      },

      checkAuth: async () => {
        set({ isLoading: true });
        try {
          const result = await refreshSession();
          set({
            user: result.user,
            session: result.session,
            profile: result.profile,
            isAuthenticated: true,
            isNewUser: !result.profile.is_setup_complete,
            role: result.profile.role,
            isLoading: false,
            error: null,
          });
        } catch {
          set({ ...initialState, isLoading: false });
        }
      },

      clearError: () => set({ error: null }),
      setSession: (session) => set({ session, isAuthenticated: Boolean(session) }),
      createUserProfile: async () => ({ error: null }),

      switchToPlayer: async () => {
        const { user } = get();
        if (!user) return;
        try {
          const result = await updateProfile({ role: 'player' });
          set({ user: result.user, profile: result.profile, role: 'player', lastMode: 'player' });
          useVendorStore.getState().clearVendor();
        } catch (error) {
          set({ error: toApiError(error) });
        }
      },

      setLastMode: (mode) => set({ lastMode: mode }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        role: state.role,
        profile: state.profile,
        isNewUser: state.isNewUser,
        lastMode: state.lastMode,
      }),
    },
  ),
);
