import { supabase } from '../supabase';
import { AuthError, AuthResponse, UserProfile } from '@/types/auth';

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
      if (data.preferred_foot !== undefined) cleanData.preferred_foot = data.preferred_foot;
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

  // ─── Private Helpers ───

  private static async getOrCreateUserProfile(
    user: any
  ): Promise<AuthResponse<UserProfile> & { isNewUser?: boolean }> {
    try {
      // Check if profile exists
      const { data: existingProfile, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      // If profile exists, return it
      if (!fetchError && existingProfile) {
        // Check if profile is complete
        const isComplete = existingProfile.is_setup_complete === true;
        return { 
          data: existingProfile, 
          error: null,
          isNewUser: !isComplete,
        };
      }

      // If profile doesn't exist (PGRST116), create one
      if (fetchError && fetchError.code === 'PGRST116') {
        const newProfile = {
          id: user.id,
          phone: user.phone || '',
          email: user.email || null,
          full_name: '',
          city: null,
          role: 'player',
          preferred_foot: null,
          avatar_url: null,
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