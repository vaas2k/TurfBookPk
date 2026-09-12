import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useVendorStore } from './vendorStore';
import { activateVendorMode } from '@/lib/api/vendors';
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
  lastModeByUser: Record<string, 'player' | 'vendor'>;
  sendOTP: (phone: string) => Promise<{ error: ApiError | null }>;
  verifyOTP: (phone: string, token: string) => Promise<{ error: ApiError | null }>;
  signInWithGoogle: () => Promise<{ error: ApiError | null }>;
  completeProfile: (data: Partial<UserProfile>) => Promise<{ error: ApiError | null }>;
  signOut: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  setSession: (session: AuthSession | null) => void;
  createUserProfile: (user: AuthUser) => Promise<{ error: ApiError | null }>;
  switchToPlayer: () => Promise<{ error: ApiError | null }>;
  switchToVendor: () => Promise<{ error: ApiError | null }>;
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
  lastModeByUser: {},
  error: null,
} satisfies Pick<AuthState, 'user' | 'session' | 'profile' | 'isLoading' | 'isAuthenticated' | 'isNewUser' | 'role' | 'lastMode' | 'lastModeByUser' | 'error'>;

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
          const vendorStatus = await useVendorStore.getState().checkVendorStatus(result.user.id);
          const preferredMode = vendorStatus.isVendor
            ? get().lastModeByUser[result.user.id] ?? 'player'
            : 'player';
          set({
            user: result.user,
            session: result.session,
            profile: result.profile,
            isAuthenticated: true,
            isNewUser: !result.profile.is_setup_complete,
            role: preferredMode,
            lastMode: preferredMode,
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
          set({ profile: result.profile, user: result.user, role: result.profile.role, lastMode: result.profile.role, isNewUser: false, isLoading: false });
          return { error: null };
        } catch (error) {
          const apiError = toApiError(error);
          set({ isLoading: false, error: apiError });
          return { error: apiError };
        }
      },

      signOut: async () => {
          const currentUserId = get().user?.id;
          const preferredMode = currentUserId ? get().lastModeByUser[currentUserId] ?? get().role : get().role;
        set({ isLoading: true });
        try {
          await apiSignOut();
        } finally {
          setAccessToken(null);
          set({ ...initialState, lastMode: preferredMode, lastModeByUser: get().lastModeByUser, isLoading: false });
          useVendorStore.getState().clearVendor();
        }
      },

      checkAuth: async () => {
        set({ isLoading: true });
        try {
          const result = await refreshSession();
          const vendorStatus = await useVendorStore.getState().checkVendorStatus(result.user.id);
          const preferredMode = vendorStatus.isVendor
            ? get().lastModeByUser[result.user.id] ?? 'player'
            : 'player';
          set({
            user: result.user,
            session: result.session,
            profile: result.profile,
            isAuthenticated: true,
            isNewUser: !result.profile.is_setup_complete,
            role: preferredMode,
            lastMode: preferredMode,
            isLoading: false,
            error: null,
          });
        } catch {
          set({ ...initialState, lastModeByUser: get().lastModeByUser, isLoading: false });
        }
      },

      clearError: () => set({ error: null }),
      setSession: (session) => set({ session, isAuthenticated: Boolean(session) }),
      createUserProfile: async () => ({ error: null }),

      switchToPlayer: async () => {
        const { user } = get();
        if (!user) return { error: { code: 'unauthorized', message: 'No user is logged in' } };
        try {
          const result = await updateProfile({ role: 'player' });
          set((state) => ({ user: result.user, profile: result.profile, role: 'player', lastMode: 'player', lastModeByUser: { ...state.lastModeByUser, [result.user.id]: 'player' } }));
          return { error: null };
        } catch (error) {
          const apiError = toApiError(error);
          set({ error: apiError });
          return { error: apiError };
        }
      },

      switchToVendor: async () => {
        const { user, profile } = get();
        if (!user || !profile) return { error: { code: 'unauthorized', message: 'No user is logged in' } };
        try {
          await activateVendorMode();
          set((state) => ({ role: 'vendor', profile: { ...profile, role: 'vendor' }, lastMode: 'vendor', lastModeByUser: { ...state.lastModeByUser, [user.id]: 'vendor' }, error: null }));
          return { error: null };
        } catch (error) {
          const apiError = toApiError(error);
          set({ error: apiError });
          return { error: apiError };
        }
      },

      setLastMode: (mode) => set((state) => ({
        lastMode: mode,
        lastModeByUser: state.user ? { ...state.lastModeByUser, [state.user.id]: mode } : state.lastModeByUser,
      })),
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
        lastModeByUser: state.lastModeByUser,
      }),
    },
  ),
);
