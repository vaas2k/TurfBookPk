// lib/supabase-test.ts
import { supabase } from './supabase';

export const testSupabaseConnection = async () => {
  try {
    // Test: Try to get current session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    

    console.log('🔗 Supabase URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);
    console.log('🔗 Supabase Anon Key:', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

    if (sessionError) {
      console.error('Auth error:', sessionError.message);
      return false;
    }
    
    console.log('Supabase connected!');
    console.log('Session:', sessionData.session ? 'User logged in' : 'No user');
    return true;
  } catch (error) {
    console.error(' Connection failed:', error);
    return false;
  }
};
