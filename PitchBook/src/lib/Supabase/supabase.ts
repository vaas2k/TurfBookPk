// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Get environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Custom storage for Supabase (uses AsyncStorage on React Native)
const ExpoAsyncStorage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoAsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Important for mobile
  },
});

// Types for our database
export type Tables = {
  users: {
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
  };
  grounds: {
    id: string;
    name: string;
    location: string;
    city: string;
    latitude: number;
    longitude: number;
    vendor_id: string;
    description: string;
    amenities: string[];
    rating: number;
    total_reviews: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  };
  pitches: {
    id: string;
    ground_id: string;
    name: string;
    type: '5-a-side' | '7-a-side' | '11-a-side';
    price_per_hour: number;
    peak_price: number | null;
    operating_hours: {
      open: string;
      close: string;
    };
    is_active: boolean;
    created_at: string;
  };
  slots: {
    id: string;
    pitch_id: string;
    date: string;
    start_time: string;
    end_time: string;
    is_booked: boolean;
    is_blocked: boolean;
    price: number;
    booked_by: string | null;
    booking_id: string | null;
    created_at: string;
  };
  bookings: {
    id: string;
    player_id: string;
    ground_id: string;
    pitch_id: string;
    slot_id: string;
    date: string;
    start_time: string;
    end_time: string;
    total_amount: number;
    platform_fee: number;
    commission: number;
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
    payment_status: 'pending' | 'paid' | 'refunded';
    payment_method: 'jazzcash' | 'easypaisa' | 'bank_transfer';
    check_in_code: string;
    created_at: string;
    updated_at: string;
  };
};