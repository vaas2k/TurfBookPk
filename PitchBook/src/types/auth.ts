export interface AuthError {
  code: string;
  message: string;
}

export interface AuthResponse<T> {
  data: T | null;
  error: AuthError | null;
}

export interface UserProfile {
  id: string;
  email: string | null;
  phone: string;
  full_name: string;
  city: string | null;
  role: 'player' | 'vendor' | 'admin';
  preferred_foot: 'Left' | 'Right' | 'Both' | null;
  avatar_url: string | null;
  is_verified: boolean;
  is_setup_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: any | null;
  session: any | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isNewUser: boolean;
  role: 'player' | 'vendor' | 'admin' | null;
  error: AuthError | null;
}