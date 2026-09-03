import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/Supabase/supabase';
import { User, Session } from '@supabase/supabase-js';
import { useVendorStore } from './vendorStore';

export interface UserProfile {
  id: string;
  phone: string | null;
  email: string | null;
  full_name: string;
  city: string | null;
  role: 'player' | 'vendor';
  avatar_url: string | null;
  is_verified: boolean;
  is_setup_complete: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isNewUser: boolean;
  role: 'player' | 'vendor' | null;
  error: string | null;
  lastMode?: 'player' | 'vendor' | null;

  // Actions
  sendOTP: (phone: string) => Promise<{ error: string | null }>;
  verifyOTP: (phone: string, token: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  completeProfile: (data: Partial<UserProfile>) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  setSession: (session: Session | null) => void;
  createUserProfile: (user: User) => Promise<{ error: string | null }>;
  switchToPlayer: () => Promise<void>;
  setLastMode: (mode: 'player' | 'vendor') => void;
}

const initialState: AuthState = {
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,
  isNewUser: false,
  role: null,
  lastMode: null,
  error: null,
  sendOTP: async () => ({ error: null }),
  verifyOTP: async () => ({ error: null }),
  signInWithGoogle: async () => ({ error: null }),
  completeProfile: async () => ({ error: null }),
  signOut: async () => { },
  checkAuth: async () => { },
  clearError: () => { },
  setSession: () => { },
  createUserProfile: async () => ({ error: null }),
  switchToPlayer: async () => { },
  setLastMode: (mode: 'player' | 'vendor') => { },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Send OTP
      sendOTP: async (phone: string) => {
        set({ isLoading: true, error: null });
        try {
          const cleanPhone = phone.replace('+', '');

          console.log('[AuthStore] Sending OTP to:', cleanPhone);
          const { error } = await supabase.auth.signInWithOtp({
            phone: cleanPhone,
          });
          if (error) throw error;
          set({ isLoading: false });
          return { error: null };
        } catch (error: any) {
          set({ isLoading: false, error: error.message });
          return { error: error.message };
        }
      },

      // Verify OTP
      verifyOTP: async (phone: string, token: string) => {
        set({ isLoading: true, error: null });
        try {
          const cleanPhone = phone.replace('+', '');
          const { data, error } = await supabase.auth.verifyOtp({
            phone: cleanPhone,
            token: token,
            type: 'sms',
          });
          if (error) throw error;

          if (data.user) {
            // Check if user profile exists
            const { data: profileData, error: profileError } = await supabase
              .from('users')
              .select('*')
              .eq('id', data.user.id)
              .maybeSingle();

            // If no profile, create one
            if (!profileData) {
              const newProfile: UserProfile = {
                id: data.user.id,
                phone: data.user.phone || cleanPhone,
                email: data.user.email || null,
                full_name: 'Player',
                city: null,
                role: 'player',
                avatar_url: null,
                is_verified: true,
                is_setup_complete: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };

              const { error: insertError } = await supabase
                .from('users')
                .insert(newProfile);

              if (insertError) {
                console.error('Insert profile error:', insertError);
                throw insertError;
              }

              set({
                user: data.user,
                session: data.session,
                profile: newProfile,
                isAuthenticated: true,
                isNewUser: true,
                role: 'player',
                isLoading: false,
                error: null,
              });
            } else {
              set({
                user: data.user,
                session: data.session,
                profile: profileData,
                isAuthenticated: true,
                isNewUser: !profileData.is_setup_complete,
                role: profileData.role || 'player',
                isLoading: false,
                error: null,
              });
            }
          }

          return { error: null };
        } catch (error: any) {
          console.error('Verify OTP error:', error);
          set({ isLoading: false, error: error.message });
          return { error: error.message };
        }
      },

      // Create user profile (for existing auth users)
      createUserProfile: async (user: User) => {
        try {
          const newProfile: UserProfile = {
            id: user.id,
            phone: user.phone || null,
            email: user.email || null,
            full_name: user.user_metadata?.full_name || 'Player',
            city: null,
            role: 'player',
            avatar_url: user.user_metadata?.avatar_url || null,
            is_verified: true,
            is_setup_complete: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const { error } = await supabase
            .from('users')
            .insert(newProfile);

          if (error) throw error;

          set({
            profile: newProfile,
            isNewUser: true,
          });

          return { error: null };
        } catch (error: any) {
          console.error('Create profile error:', error);
          return { error: error.message };
        }
      },

      // Google Sign In
      signInWithGoogle: async () => {
        // ... existing google sign in code ...
        return { error: null };
      },

      // Complete Profile
      completeProfile: async (data: Partial<UserProfile>) => {
        const { user, profile } = get();
        if (!user) {
          return { error: 'No user logged in' };
        }

        set({ isLoading: true, error: null });

        try {
          const { error } = await supabase
            .from('users')
            .update({
              full_name: data.full_name,
              email: data.email,
              city: data.city,
              is_setup_complete: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);

          if (error) throw error;

          const updatedProfile = {
            ...profile,
            ...data,
            is_setup_complete: true,
            updated_at: new Date().toISOString(),
          } as UserProfile;

          set({
            profile: updatedProfile,
            isNewUser: false,
            isLoading: false,
          });

          return { error: null };
        } catch (error: any) {
          set({ isLoading: false, error: error.message });
          return { error: error.message };
        }
      },

      // Sign Out
      signOut: async () => {
        try {
          set({ isLoading: true });
          await supabase.auth.signOut();
          await AsyncStorage.removeItem('auth-storage');
          set({
            ...initialState,
            isLoading: false,
          });
        } catch (error) {
          console.error('Sign out error:', error);
          set({ isLoading: false });
        }
      },

      // Check Auth
      checkAuth: async () => {
        try {
          console.log('[AuthStore] Checking auth...');
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();

          if (sessionError) {
            console.error('[AuthStore] Session error:', sessionError);
            set({ isLoading: false, isAuthenticated: false });
            return;
          }

          if (!session) {
            console.log('[AuthStore] No session found');
            set({ isLoading: false, isAuthenticated: false });
            return;
          }

          console.log('[AuthStore] Session found for user:', session.user.id);

          // CRITICAL: Check if profile exists in public.users
          const { data: profileData, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          // If profile doesn't exist, treat as NOT authenticated
          if (!profileData) {
            console.log('[AuthStore] No profile found - user needs to complete setup');

            // Option A: Force logout and redirect to login
            await supabase.auth.signOut();
            await AsyncStorage.removeItem('auth-storage');

            set({
              ...initialState,
              isLoading: false,
              isAuthenticated: false,
            });
            return;
          }

          // Profile exists - user is fully authenticated
          set({
            user: session.user,
            session: session,
            profile: profileData,
            isAuthenticated: true,
            isNewUser: !profileData.is_setup_complete,
            role: profileData.role || 'player',
            isLoading: false,
            error: null,
          });

          console.log('[AuthStore] Auth check complete, isAuthenticated:', true);
        } catch (error) {
          console.error('[AuthStore] Check auth error:', error);
          set({ isLoading: false, isAuthenticated: false });
        }
      },

      // Clear Error
      clearError: () => {
        set({ error: null });
      },

      // Set Session
      setSession: (session: Session | null) => {
        set({ session, user: session?.user || null });
      },
      switchToPlayer: async () => {
        const { user } = get();
        if (!user) return;

        try {
          console.log('[AuthStore] Switching to player mode...');

          // Update user role to player in Supabase
          const { error } = await supabase
            .from('users')
            .update({
              role: 'player',
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);

          if (error) {
            console.error('[AuthStore] Switch to player error:', error);
            throw error;
          }

          // Update local state
          set({
            role: 'player',
            lastMode: 'player',
          });

          // Update profile in store
          const currentProfile = get().profile;
          if (currentProfile) {
            set({
              profile: {
                ...currentProfile,
                role: 'player',
              }
            });
          }

          // Clear vendor state
          const { clearVendor } = useVendorStore.getState();
          clearVendor();

          console.log('[AuthStore] Switched to player mode successfully');
        } catch (error) {
          console.error('[AuthStore] Switch to player error:', error);
        }
      }
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
    }
  )
);  