import { create } from 'zustand';
import { getVendorProfile, registerVendor as registerVendorApi } from '@/lib/api/vendors';
import { useAuthStore } from './authStore';

export interface VendorProfile {
  id: string;
  user_id: string;
  business_name: string;
  business_phone: string;
  business_city: string;
  business_description: string | null;
  business_logo: string | null;
  business_cover_image: string | null;
  is_verified: boolean;
  is_active: boolean;
  total_earnings: number;
  pending_earnings: number;
  total_withdrawn: number;
  rating: number;
  total_reviews: number;
  created_at: string;
  updated_at: string;
}

interface VendorState {
  vendorProfile: VendorProfile | null;
  isLoading: boolean;
  isVendor: boolean;
  
  // Actions
  checkVendorStatus: (userId: string) => Promise<{ isVendor: boolean; profile: VendorProfile | null }>;
  registerVendor: (data: any) => Promise<{ error: string | null }>;
  getVendorProfile: (userId: string) => Promise<{ profile: VendorProfile | null; error: string | null }>;
  clearVendor: () => void;
}

export const useVendorStore = create<VendorState>((set, get) => ({
  vendorProfile: null,
  isLoading: false,
  isVendor: false,

  checkVendorStatus: async (_userId: string) => {
    set({ isLoading: true });
    try {
      const data = await getVendorProfile();
      const isVendor = !!data;
      set({ 
        vendorProfile: data,
        isVendor: isVendor,
        isLoading: false 
      });
      
      return { isVendor, profile: data };
    } catch (error) {
      console.error('Check vendor status error:', error);
      set({ isLoading: false });
      return { isVendor: false, profile: null };
    }
  },

  registerVendor: async (data: any) => {
    set({ isLoading: true });
    try {
      const user = useAuthStore.getState().user;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const vendorData = await registerVendorApi(data);

      // Update auth store role
      useAuthStore.setState({ role: 'vendor' });

      set({ 
        vendorProfile: vendorData, 
        isVendor: true,
        isLoading: false 
      });

      return { error: null };
    } catch (error: any) {
      console.error('Register vendor error:', error);
      set({ isLoading: false });
      return { error: error.message };
    }
  },

  getVendorProfile: async (userId: string) => {
    try {
      const data = await getVendorProfile();
      if (!data) throw new Error('Vendor profile not found');

      set({ vendorProfile: data, isVendor: true });
      return { profile: data, error: null };
    } catch (error: any) {
      console.error('Get vendor profile error:', error);
      return { profile: null, error: error.message };
    }
  },

  clearVendor: () => {
    set({ vendorProfile: null, isVendor: false });
  },
}));