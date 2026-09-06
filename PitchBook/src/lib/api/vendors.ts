import { apiRequest } from './client';
import { VendorProfile } from '@/store/vendorStore';

export async function getVendorProfile(): Promise<VendorProfile | null> {
  const result = await apiRequest<{ profile: VendorProfile | null }>('/vendors/me');
  return result.profile;
}

export async function registerVendor(data: {
  business_name: string;
  business_phone: string;
  business_city: string;
  business_description?: string;
}): Promise<VendorProfile> {
  const result = await apiRequest<{ profile: VendorProfile }>('/vendors', {
    method: 'POST',
    data,
  });
  return result.profile;
}