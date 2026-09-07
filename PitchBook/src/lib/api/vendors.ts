import { apiRequest } from './client';
import { VendorProfile } from '@/store/vendorStore';

export interface Ground {
  id: string;
  vendor_id: string;
  title: string;
  description: string | null;
  location: string;
  city: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  amenities: string[];
  images: string[];
  cover_image: string | null;
  pitch_type: string | null;
  price_per_hour: number;
  peak_price: number | null;
  is_active: boolean;
  is_verified: boolean;
  rating: number;
  total_reviews: number;
  operating_hours: { open: string; close: string };
  rules: string[];
  cancellation_policy: string | null;
  created_at: string;
  updated_at: string;
}

export interface Slot {
  id: string;
  ground_id: string;
  date: string;
  start_time: string;
  end_time: string;
  price: number;
  is_booked: boolean;
  is_blocked: boolean;
  created_at: string;
  updated_at: string;
}

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

export async function activateVendorMode(): Promise<void> {
  await apiRequest('/vendors/mode', { method: 'PATCH' });
}

export async function listVendorGrounds(): Promise<Ground[]> {
  const result = await apiRequest<{ grounds: Ground[] }>('/grounds/vendor/mine');
  return result.grounds;
}

export async function createGround(data: Partial<Ground>): Promise<Ground> {
  const result = await apiRequest<{ ground: Ground }>('/grounds', { method: 'POST', data });
  return result.ground;
}

export async function updateGround(id: string, data: Partial<Ground>): Promise<Ground> {
  const result = await apiRequest<{ ground: Ground }>(`/grounds/${id}`, { method: 'PATCH', data });
  return result.ground;
}

export async function deleteGround(id: string): Promise<void> {
  await apiRequest<void>(`/grounds/${id}`, { method: 'DELETE' });
}

export async function listGroundSlots(id: string): Promise<Slot[]> {
  const result = await apiRequest<{ slots: Slot[] }>(`/grounds/${id}/slots`);
  return result.slots;
}

export async function createGroundSlot(groundId: string, data: Pick<Slot, 'date' | 'start_time' | 'end_time' | 'price'>): Promise<Slot> {
  const result = await apiRequest<{ slot: Slot }>(`/grounds/${groundId}/slots`, { method: 'POST', data });
  return result.slot;
}

export async function updateGroundSlot(groundId: string, slotId: string, data: Partial<Slot>): Promise<Slot> {
  const result = await apiRequest<{ slot: Slot }>(`/grounds/${groundId}/slots/${slotId}`, { method: 'PATCH', data });
  return result.slot;
}

export async function deleteGroundSlot(groundId: string, slotId: string): Promise<void> {
  await apiRequest<void>(`/grounds/${groundId}/slots/${slotId}`, { method: 'DELETE' });
}

export async function listPublicGrounds(): Promise<Ground[]> {
  const result = await apiRequest<{ grounds: Ground[] }>('/grounds');
  return result.grounds;
}

export async function getPublicGround(id: string): Promise<{ ground: Ground; slots: Slot[] }> {
  return apiRequest<{ ground: Ground; slots: Slot[] }>(`/grounds/${id}`);
}
