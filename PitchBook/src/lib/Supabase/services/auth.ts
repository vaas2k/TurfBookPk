import { AuthResponse, UserProfile } from '@/types/auth';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../supabase';
import { Platform } from 'react-native';

// Custom error codes for better UX
export const AuthErrorCodes = {
  INVALID_PHONE: 'invalid_phone',
  INVALID_OTP: 'invalid_otp',
  OTP_EXPIRED: 'otp_expired',
  TOO_MANY_ATTEMPTS: 'too_many_attempts',
  USER_NOT_FOUND: 'user_not_found',
  NETWORK_ERROR: 'network_error',
  UNKNOWN_ERROR: 'unknown_error',
  SESSION_EXPIRED: 'session_expired',
  UNAUTHORIZED: 'unauthorized',
} as const;

export type AuthErrorCode = typeof AuthErrorCodes[keyof typeof AuthErrorCodes];

export class AuthService {
  /**
   * Send OTP to phone number
   */
  static async sendOTP(phone: string): Promise<AuthResponse<null>> {
    try {
      // Validate phone number format
      const validation = this.validatePhone(phone);
      if (!validation.isValid) {
        return {
          data: null,
          error: {
            code: AuthErrorCodes.INVALID_PHONE,
            message: validation.message || 'Invalid phone number format',
          },
        };
      }

      const cleanPhone = phone.replace(/\D/g, '');
      const fullPhone = `92${cleanPhone}`;

      const { data, error } = await supabase.auth.signInWithOtp({
        phone: fullPhone,
      });

      if (error) {
        const mappedError = this.mapSupabaseError(error);
        return { data: null, error: mappedError };
      }

      return { data: null, error: null };
    } catch (error: any) {
      console.error('[Auth] Send OTP error:', error);
      return {
        data: null,
        error: {
          code: AuthErrorCodes.UNKNOWN_ERROR,
          message: 'Unable to send verification code. Please try again.',
        },
      };
    }
  }

  /**
   * Verify OTP and create/get user
   */
  static async verifyOTP(
    phone: string,
    token: string
  ): Promise<AuthResponse<{ user: any; profile: UserProfile | null; isNewUser: boolean }>> {
    try {
      // Validate OTP format
      if (!token || token.length !== 6 || !/^\d{6}$/.test(token)) {
        return {
          data: null,
          error: {
            code: AuthErrorCodes.INVALID_OTP,
            message: 'Please enter a valid 6-digit verification code',
          },
        };
      }

      const cleanPhone = phone.replace(/\D/g, '');
      const fullPhone = `92${cleanPhone}`;

      const { data, error } = await supabase.auth.verifyOtp({
        phone: fullPhone,
        token: token,
        type: 'sms',
      });

      if (error) {
        const mappedError = this.mapSupabaseError(error);
        return { data: null, error: mappedError };
      }

      if (!data.user) {
        return {
          data: null,
          error: {
            code: AuthErrorCodes.UNKNOWN_ERROR,
            message: 'Unable to verify code. Please try again.',
          },
        };
      }

      // Get or create user profile
      const profileResult = await this.getOrCreateUserProfile(data.user);

      if (profileResult.error) {
        return { data: null, error: profileResult.error };
      }

      return {
        data: {
          user: data.user,
          profile: profileResult.data,
          isNewUser: profileResult.isNewUser || false,
        },
        error: null,
      };
    } catch (error: any) {
      console.error('[Auth] Verify OTP error:', error);
      return {
        data: null,
        error: {
          code: AuthErrorCodes.UNKNOWN_ERROR,
          message: 'Unable to verify code. Please try again.',
        },
      };
    }
  }

  /**
   * Get current session
   */
  static async getSession(): Promise<AuthResponse<any>> {
    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        const mappedError = this.mapSupabaseError(error);
        return { data: null, error: mappedError };
      }

      return { data: data.session, error: null };
    } catch (error: any) {
      console.error('[Auth] Get session error:', error);
      return {
        data: null,
        error: {
          code: AuthErrorCodes.UNKNOWN_ERROR,
          message: 'Unable to get session',
        },
      };
    }
  }

  /**
   * Get current user with profile
   */
  static async getCurrentUser(): Promise<AuthResponse<{ user: any; profile: UserProfile | null }>> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error) {
        const mappedError = this.mapSupabaseError(error);
        return { data: null, error: mappedError };
      }

      if (!user) {
        return {
          data: null,
          error: {
            code: AuthErrorCodes.UNAUTHORIZED,
            message: 'No user found',
          },
        };
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('[Auth] Profile fetch error:', profileError);
        return {
          data: { user, profile: null },
          error: null,
        };
      }

      return {
        data: { user, profile: profile || null },
        error: null,
      };
    } catch (error: any) {
      console.error('[Auth] Get user error:', error);
      return {
        data: null,
        error: {
          code: AuthErrorCodes.UNKNOWN_ERROR,
          message: 'Unable to get user',
        },
      };
    }
  }

  /**
   * Sign out
   */
  static async signOut(): Promise<AuthResponse<null>> {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        const mappedError = this.mapSupabaseError(error);
        return { data: null, error: mappedError };
      }

      return { data: null, error: null };
    } catch (error: any) {
      console.error('[Auth] Sign out error:', error);
      return {
        data: null,
        error: {
          code: AuthErrorCodes.UNKNOWN_ERROR,
          message: 'Unable to sign out',
        },
      };
    }
  }

  /**
 * Update user profile
 */
  static async updateProfile(
    userId: string,
    data: Partial<UserProfile>
  ): Promise<AuthResponse<UserProfile>> {
    try {
      // Validate required fields for profile setup
      if (data.is_setup_complete === true) {
        const validation = this.validateProfileData(data);
        if (!validation.isValid) {
          return {
            data: null,
            error: {
              code: AuthErrorCodes.INVALID_PHONE,
              message: validation.message || 'Invalid profile data',
            },
          };
        }
      }

      // Clean data - only include fields that exist in the table
      const cleanData: any = {};
      if (data.full_name !== undefined) cleanData.full_name = data.full_name;
      if (data.email !== undefined) cleanData.email = data.email;
      if (data.city !== undefined) cleanData.city = data.city;
      // if (data.preferred_foot !== undefined) cleanData.preferred_foot = data.preferred_foot;
      if (data.avatar_url !== undefined) cleanData.avatar_url = data.avatar_url;
      if (data.is_setup_complete !== undefined) cleanData.is_setup_complete = data.is_setup_complete;
      if (data.role !== undefined) cleanData.role = data.role;

      cleanData.updated_at = new Date().toISOString();

      // First, update the profile
      const { error: updateError } = await supabase
        .from('users')
        .update(cleanData)
        .eq('id', userId);

      if (updateError) {
        console.error('[Auth] Update profile error:', updateError);
        return {
          data: null,
          error: {
            code: AuthErrorCodes.UNKNOWN_ERROR,
            message: 'Unable to update profile',
          },
        };
      }

      // Then, fetch the updated profile
      const { data: updatedProfile, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchError) {
        console.error('[Auth] Fetch updated profile error:', fetchError);
        // If we can't fetch, try to get the profile without .single()
        const { data: profileData } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId);

        if (profileData && profileData.length > 0) {
          return { data: profileData[0], error: null };
        }

        return {
          data: null,
          error: {
            code: AuthErrorCodes.UNKNOWN_ERROR,
            message: 'Unable to fetch updated profile',
          },
        };
      }

      return { data: updatedProfile, error: null };
    } catch (error: any) {
      console.error('[Auth] Update profile error:', error);
      return {
        data: null,
        error: {
          code: AuthErrorCodes.UNKNOWN_ERROR,
          message: 'Unable to update profile',
        },
      };
    }
  }

/**
 * Sign in with Google
 */
/**
 * Sign in with Google
 */
/**
 * Sign in with Google
 * Works for both Web and Mobile (Android/iOS)
 */
static async signInWithGoogle(): Promise<AuthResponse<{ user: any; profile: UserProfile | null; isNewUser: boolean }>> {
  try {
    console.log('[Auth] Starting Google sign-in...');
    console.log('[Auth] Platform:', Platform.OS);

    // ─── WEB PLATFORM ───
    if (Platform.OS === 'web') {
      const currentUrl = window.location.href;
      console.log('[Auth] Current URL:', currentUrl);

      // Check if we're in the callback
      if (currentUrl.includes('auth/callback')) {
        console.log('[Auth] Processing callback...');
        
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[Auth] Session error:', sessionError);
          throw sessionError;
        }

        if (sessionData.session) {
          console.log('[Auth] Session found!');
          const user = sessionData.session.user;
          
          const { data: profileData, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

          let profile = profileData;
          if (!profileData) {
            console.log('[Auth] Creating new profile...');
            const newProfile = {
              id: user.id,
              email: user.email || null,
              phone: null,
              full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
              city: null,
              role: 'player',
              avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
              is_verified: true,
              is_setup_complete: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            const { data: createdProfile, error: insertError } = await supabase
              .from('users')
              .insert(newProfile)
              .select()
              .single();

            if (!insertError) {
              profile = createdProfile;
              console.log('[Auth] Profile created');
            }
          }

          const isNewUser = !profile || !profile.is_setup_complete;

          return {
            data: {
              user: user,
              profile: profile || null,
              isNewUser: isNewUser,
            },
            error: null,
          };
        } else {
          console.log('[Auth] No session found in callback');
          return {
            data: null,
            error: {
              code: AuthErrorCodes.UNAUTHORIZED,
              message: 'No session found',
            },
          };
        }
      }

      // Start OAuth flow for web
      console.log('[Auth] Starting OAuth flow...');
      const redirectTo = `${window.location.origin}/auth/callback`;
      console.log('[Auth] Redirect URL:', redirectTo);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('[Auth] SignInWithOAuth error:', error);
        throw error;
      }

      if (!data.url) {
        throw new Error('No OAuth URL returned');
      }

      console.log('[Auth] Redirecting to:', data.url);
      window.location.href = data.url;
      
      return {
        data: null,
        error: {
          code: 'redirect',
          message: 'Redirecting to Google...',
        },
      };
    }

    // ─── MOBILE PLATFORMS (Android/iOS) ───
    console.log('[Auth] Mobile platform detected');

    // Get the app scheme for deep linking
    const scheme = 'turfbookpk';
    const redirectTo = `${scheme}://auth/callback`;
    console.log('[Auth] Redirect URL:', redirectTo);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      console.error('[Auth] SignInWithOAuth error:', error);
      throw error;
    }

    if (!data.url) {
      throw new Error('No OAuth URL returned');
    }

    console.log('[Auth] OAuth URL generated, opening browser...');

    // Open the OAuth URL in browser
    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      `${scheme}://auth/callback`,
      {
        showInRecents: true,
        preferEphemeralSession: false,
        createTask: true,
      }
    );

    console.log('[Auth] Browser result type:', result.type);

    if (result.type === 'success' && result.url) {
      console.log('[Auth] Success URL received');
      
      // Parse the URL to get tokens
      const url = new URL(result.url);
      const accessToken = url.searchParams.get('access_token');
      const refreshToken = url.searchParams.get('refresh_token');
      const errorParam = url.searchParams.get('error');

      if (errorParam) {
        console.error('[Auth] OAuth error:', errorParam);
        return {
          data: null,
          error: {
            code: AuthErrorCodes.UNKNOWN_ERROR,
            message: 'OAuth error: ' + errorParam,
          },
        };
      }

      if (accessToken && refreshToken) {
        console.log('[Auth] Tokens found, setting session...');

        // Set the session
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          console.error('[Auth] Set session error:', sessionError);
          throw sessionError;
        }

        console.log('[Auth] Session set successfully');

        if (sessionData.user) {
          // Get or create user profile
          const { data: profileData, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', sessionData.user.id)
            .maybeSingle();

          if (profileError && profileError.code !== 'PGRST116') {
            console.error('[Auth] Profile fetch error:', profileError);
          }

          let profile = profileData;
          if (!profileData) {
            console.log('[Auth] Creating new profile...');
            const newProfile = {
              id: sessionData.user.id,
              email: sessionData.user.email || null,
              phone: null,
              full_name: sessionData.user.user_metadata?.full_name || sessionData.user.user_metadata?.name || '',
              city: null,
              role: 'player',
              avatar_url: sessionData.user.user_metadata?.avatar_url || sessionData.user.user_metadata?.picture || null,
              is_verified: true,
              is_setup_complete: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            const { data: createdProfile, error: insertError } = await supabase
              .from('users')
              .insert(newProfile)
              .select()
              .single();

            if (insertError) {
              console.error('[Auth] Profile creation error:', insertError);
            } else {
              profile = createdProfile;
              console.log('[Auth] Profile created successfully');
            }
          }

          const isNewUser = !profile || !profile.is_setup_complete;

          return {
            data: {
              user: sessionData.user,
              profile: profile || null,
              isNewUser: isNewUser,
            },
            error: null,
          };
        }
      } else {
        console.log('[Auth] No tokens found in URL');
      }
    } else if (result.type === 'cancel') {
      console.log('[Auth] User cancelled the sign-in');
      return {
        data: null,
        error: {
          code: AuthErrorCodes.UNKNOWN_ERROR,
          message: 'Sign-in cancelled',
        },
      };
    } else {
      console.log('[Auth] Unexpected result:', result.type);
    }

    return {
      data: null,
      error: {
        code: AuthErrorCodes.UNKNOWN_ERROR,
        message: 'Unable to complete Google sign-in',
      },
    };
  } catch (error: any) {
    console.error('[Auth] Google sign-in error:', error);
    return {
      data: null,
      error: {
        code: AuthErrorCodes.UNKNOWN_ERROR,
        message: error.message || 'Unable to sign in with Google',
      },
    };
  }
}
  /**
  * Get user from Google OAuth callback
  */
  static async handleGoogleCallback(url: string): Promise<AuthResponse<{ user: any; profile: UserProfile | null; isNewUser: boolean }>> {
    try {
      // Parse the callback URL to get session
      const { data, error } = await supabase.auth.getSession();

      if (error) throw error;

      if (!data.session) {
        return {
          data: null,
          error: {
            code: AuthErrorCodes.UNAUTHORIZED,
            message: 'No session found',
          },
        };
      }

      // Get user profile
      const user = data.session.user;

      if (!user) {
        return {
          data: null,
          error: {
            code: AuthErrorCodes.UNAUTHORIZED,
            message: 'No user found',
          },
        };
      }

      // Get or create user profile
      const profileResult = await this.getOrCreateUserProfile(user);

      if (profileResult.error) {
        return { data: null, error: profileResult.error };
      }

      return {
        data: {
          user: user,
          profile: profileResult.data,
          isNewUser: profileResult.isNewUser || false,
        },
        error: null,
      };
    } catch (error: any) {
      console.error('[Auth] Google callback error:', error);
      return {
        data: null,
        error: {
          code: AuthErrorCodes.UNKNOWN_ERROR,
          message: 'Unable to complete Google sign-in',
        },
      };
    }
  }



  // ─── Private Helpers ───

  /**
   * Get or create user profile - UPDATED for Google users
   */
  private static async getOrCreateUserProfile(
    user: any
  ): Promise<AuthResponse<UserProfile> & { isNewUser?: boolean }> {
    try {
      // Use maybeSingle() to avoid PGRST116 errors
      const { data: existingProfile, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      // If profile exists, return it
      if (existingProfile) {
        const isComplete = existingProfile.is_setup_complete === true;
        return {
          data: existingProfile,
          error: null,
          isNewUser: !isComplete,
        };
      }

      // If no profile found, create one
      if (!existingProfile && !fetchError) {
        const newProfile = {
          id: user.id,
          phone: user.phone || null,
          email: user.email || user.user_metadata?.email || null,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
          city: null,
          role: 'player',
          preferred_foot: null,
          avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
          is_verified: true,
          is_setup_complete: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: created, error: insertError } = await supabase
          .from('users')
          .insert(newProfile)
          .select()
          .single();

        if (insertError) {
          console.error('[Auth] Create profile error:', insertError);
          return {
            data: null,
            error: {
              code: AuthErrorCodes.UNKNOWN_ERROR,
              message: 'Unable to create profile',
            },
          };
        }

        return {
          data: created,
          error: null,
          isNewUser: true,
        };
      }

      // Unknown error
      console.error('[Auth] Profile fetch error:', fetchError);
      return {
        data: null,
        error: {
          code: AuthErrorCodes.UNKNOWN_ERROR,
          message: 'Unable to get profile',
        },
      };
    } catch (error: any) {
      console.error('[Auth] Get/create profile error:', error);
      return {
        data: null,
        error: {
          code: AuthErrorCodes.UNKNOWN_ERROR,
          message: 'Unable to get profile',
        },
      };
    }
  }

  private static validatePhone(phone: string): { isValid: boolean; message?: string } {
    const cleanPhone = phone.replace(/\s/g, '');

    if (!cleanPhone || cleanPhone.length === 0) {
      return { isValid: false, message: 'Phone number is required' };
    }

    if (!/^\d{10}$/.test(cleanPhone)) {
      return { isValid: false, message: 'Please enter a valid 10-digit phone number' };
    }

    return { isValid: true };
  }

  private static validateProfileData(data: Partial<UserProfile>): { isValid: boolean; message?: string } {
    if (!data.full_name || data.full_name.trim().length < 2) {
      return { isValid: false, message: 'Full name is required (minimum 2 characters)' };
    }

    if (data.email && data.email.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        return { isValid: false, message: 'Please enter a valid email address' };
      }
    }

    if (data.city && !data.city.trim()) {
      return { isValid: false, message: 'City is required' };
    }

    return { isValid: true };
  }

  private static mapSupabaseError(error: any): { code: AuthErrorCode; message: string } {
    console.error('[Auth] Supabase error:', error);

    // Map common Supabase errors
    if (error.message?.includes('Invalid phone')) {
      return {
        code: AuthErrorCodes.INVALID_PHONE,
        message: 'Invalid phone number format',
      };
    }

    if (error.message?.includes('expired')) {
      return {
        code: AuthErrorCodes.OTP_EXPIRED,
        message: 'Verification code has expired. Please request a new one.',
      };
    }

    if (error.message?.includes('too many requests')) {
      return {
        code: AuthErrorCodes.TOO_MANY_ATTEMPTS,
        message: 'Too many attempts. Please wait a few minutes and try again.',
      };
    }

    if (error.message?.includes('Invalid token')) {
      return {
        code: AuthErrorCodes.INVALID_OTP,
        message: 'Invalid verification code. Please try again.',
      };
    }

    if (error.message?.includes('session')) {
      return {
        code: AuthErrorCodes.SESSION_EXPIRED,
        message: 'Your session has expired. Please login again.',
      };
    }

    if (error.message?.includes('Column') && error.message?.includes('does not exist')) {
      return {
        code: AuthErrorCodes.UNKNOWN_ERROR,
        message: 'Database schema error. Please contact support.',
      };
    }

    // Generic error
    return {
      code: AuthErrorCodes.UNKNOWN_ERROR,
      message: error.message || 'Something went wrong. Please try again.',
    };
  }
}