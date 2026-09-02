import { AuthService } from '@/lib/Supabase/services/auth';
import { supabase } from '@/lib/Supabase/supabase';
import { AuthError, AuthState, UserProfile } from '@/types/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface AuthStore extends AuthState {
  // Actions
  sendOTP: (phone: string) => Promise<{ error: AuthError | null }>;
  verifyOTP: (phone: string, token: string) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  completeProfile: (data: Partial<UserProfile>) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

const initialState: AuthState = {
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,
  isNewUser: false,
  role: null,
  error: null,
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      sendOTP: async (phone: string) => {
        set({ isLoading: true, error: null });

        const result = await AuthService.sendOTP(phone);

        set({ isLoading: false });

        if (result.error) {
          set({ error: result.error });
          return { error: result.error };
        }

        return { error: null };
      },

      verifyOTP: async (phone: string, token: string) => {
        set({ isLoading: true, error: null });

        const result = await AuthService.verifyOTP(phone, token);

        if (result.error) {
          set({ isLoading: false, error: result.error });
          return { error: result.error };
        }

        if (result.data) {
          const { user, profile, isNewUser } = result.data;

          set({
            user,
            profile,
            isAuthenticated: true,
            isNewUser: isNewUser || false,
            role: profile?.role || 'player',
            isLoading: false,
            error: null,
          });

          return { error: null };
        }

        set({ isLoading: false });
        return { error: null };
      },

      // Google Sign In
      signInWithGoogle: async () => {
        set({ isLoading: true, error: null });

        try {
          console.log('[AuthStore] Starting Google sign-in...');

          const result = await AuthService.signInWithGoogle();

          console.log('[AuthStore] Google sign-in result:', result);

          // For web, we might get a redirect error
          if (result.error && result.error.code === 'redirect') {
            // This is expected - we're redirecting to Google
            set({ isLoading: false });
            return { error: null };
          }

          if (result.error) {
            set({ isLoading: false, error: result.error });
            return { error: result.error };
          }

          if (result.data) {
            const { user, profile, isNewUser } = result.data;

            set({
              user: user,
              profile: profile,
              isAuthenticated: true,
              isNewUser: isNewUser,
              role: profile?.role || 'player',
              isLoading: false,
              error: null,
            });

            console.log('[AuthStore] Google sign-in successful, isNewUser:', isNewUser);
            return { error: null };
          }

          set({ isLoading: false });
          return { error: null };
        } catch (error: any) {
          console.error('[AuthStore] Google sign-in error:', error);
          set({ isLoading: false });
          return {
            error: {
              code: 'google_auth_error',
              message: error.message || 'Unable to sign in with Google',
            },
          };
        }
      },

      completeProfile: async (data: Partial<UserProfile>) => {
        const { user, profile } = get();

        if (!user) {
          const error: AuthError = {
            code: 'unauthorized',
            message: 'User not authenticated',
          };
          set({ error });
          return { error };
        }

        set({ isLoading: true, error: null });

        try {
          const result = await AuthService.updateProfile(user.id, {
            ...data,
            is_setup_complete: true,
          });

          set({ isLoading: false });

          if (result.error) {
            set({ error: result.error });
            return { error: result.error };
          }

          if (result.data) {
            set({
              profile: result.data,
              isNewUser: false,
            });
            return { error: null };
          }

          // Fallback: try fetching the profile directly
          const { data: freshProfile, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

          if (freshProfile) {
            set({
              profile: freshProfile,
              isNewUser: false,
            });
            return { error: null };
          }

          return { error: null };
        } catch (error: any) {
          set({ isLoading: false });
          const authError: AuthError = {
            code: 'unknown_error',
            message: error.message || 'Unable to complete profile setup',
          };
          set({ error: authError });
          return { error: authError };
        }
      },

      signOut: async () => {
        set({ isLoading: true });

        await AuthService.signOut();

        set({
          ...initialState,
          isLoading: false,
        });

        await AsyncStorage.removeItem('auth-storage');
      },

      checkAuth: async () => {
        set({ isLoading: true });

        try {
          const sessionResult = await AuthService.getSession();

          if (sessionResult.error || !sessionResult.data) {
            set({
              ...initialState,
              isLoading: false,
            });
            return;
          }

          const userResult = await AuthService.getCurrentUser();

          if (userResult.error || !userResult.data) {
            set({
              ...initialState,
              isLoading: false,
            });
            return;
          }

          const { user, profile } = userResult.data;

          const isSetupComplete = profile?.is_setup_complete || false;
          const isNewUser = !isSetupComplete;

          set({
            user,
            session: sessionResult.data,
            profile: profile || null,
            isAuthenticated: true,
            isNewUser,
            role: profile?.role || 'player',
            isLoading: false,
            error: null,
          });
        } catch (error) {
          console.error('[AuthStore] Check auth error:', error);
          set({
            ...initialState,
            isLoading: false,
          });
        }
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        role: state.role,
        profile: state.profile,
        isNewUser: state.isNewUser,
      }),
    }
  )
);

// Auth state listener
supabase.auth.onAuthStateChange((event, session) => {
  const store = useAuthStore.getState();

  if (event === 'SIGNED_IN' && session) {
    store.checkAuth();
  }

  if (event === 'SIGNED_OUT') {
    console.log('[AuthStore] User signed out, clearing auth state');
    store.signOut();
  }
});