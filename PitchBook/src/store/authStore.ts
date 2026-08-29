import {create} from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/Supabase/supabase';
import { auth, UserProfile, UserRole } from '@/lib/Supabase/player/helpers/authHelper';
import { User, Session } from '@supabase/supabase-js';
import { isLoading } from 'expo-font';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  role: UserRole;

  // Actions
  sendOTP: (phone: string) => Promise<{ error: string | null }>;
  verifyOTP: (phone: string, token: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setSession: (session: Session | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  updateProfile: (data: Partial<UserProfile>) => Promise<{ error: string | null }>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      profile: null,
      isLoading: true,
      isAuthenticated: false,
      role: null,

      // Send OTP to the user's phone number
      sendOTP: async (phone: string) => {
        try {

          const { error } = await auth.sendOtp(phone);

          if (error) throw new Error(error);
          return { error: null }
        } catch (error: any) {
          return { error: error.message }
        }
      },
      // Verify the OTP token
      verifyOTP: async (phone: string, token: string) => {
        try {
          const { data, error } = await auth.verifyOtp(phone, token);
          if (error) throw new Error(error);

          if (data!.user) {

            const { data: profileData, error: profileError } = await supabase
              .from('users')
              .select('*')
              .eq('id', data!.user.id)
              .single();


            if (profileError && profileError.code !== 'PGRST116') {
              console.error('Error fetching user profile:', profileError);
            }

            set({
              user: data!.user,
              session: data!.session,
              profile: profileData || null,
              role: profileData?.role || null,
              isAuthenticated: true,
              isLoading: false
            });
          }

          return { error: null };
        } catch (error: any) {
          return { error: error.message }
        }
      },
      signOut: async () => {
        try {
          await auth.signOut();
          set({
            user: null,
            session: null,
            profile: null,
            isAuthenticated: false,
            role: null,
          });
        } catch (error: any) {
          console.error('Sign out error:', error);
        }
      },
      checkAuth : async () => {
        try{

          const { session, error } = await auth.getSession();

          if(error) throw new Error(error);
          
          if(session) {
            const {user} = await auth.getUser();
            
            if(user) {

              const {data : profileData, error: profileError} = await supabase
              .from('users')
              .select('*')
              .eq('id', user!.id)
              .single();
              
              set({
                user: user,
                session: session,
                profile: profileData || null,
                role: profileData?.role || null,
                isAuthenticated: true,
                isLoading: false
              });
            }
            else {
              set({
                isLoading: false
              });
            }            
          }
          else {
            set({
              isLoading: false
            });
          }

        }catch(error :any) {
          console.error('Auth check error:', error);
        }
      },
      setSession : (session: Session | null) => {
        set({ 
          session,
          user: session?.user || null,
          isAuthenticated: true,
          isLoading:false
         });
      },
      setProfile : (profile: UserProfile | null) => {
        set({profile,isLoading:false});
      },
      updateProfile: async (data: Partial<UserProfile>) => {
        try{

          //@ts-ignore
          const user = await get().user;
          if(!user) throw new Error("No user logged in");

          const { error } = await supabase
            .from('users')
            .update(data)
            .eq('id', user.id);

          if (error) throw error;

          // Update the profile in the store
          //@ts-ignore
          const currentProfile = get().profile;
          if(currentProfile) {
            set({profile : {...currentProfile,...data},isLoading:false})
          }

        }catch(error : any) {
          console.log(error);
          return { error: error.message }
        }
      }
    }),{
      name : 'auth-storage',
      storage:createJSONStorage(() => AsyncStorage),
      partialize: (state : any) => ({
        isAuthenticated: state.isAuthenticated,
        role: state.role,
      }),
    }
  )
);

// Auth state listener
supabase.auth.onAuthStateChange((event, session) => {
  const store = useAuthStore.getState();
  store.setSession(session);
  
  if (event === 'SIGNED_OUT') {
    store.setProfile(null);
  }
});