import { apiRequest } from './client';
import { VendorProfile } from '@/store/vendorStore';
import { Pagination } from './types';

export type CancellationPolicy = 'lenient' | 'standard' | 'strict';
export const CANCELLATION_POLICY_LABELS: Record<CancellationPolicy, string> = {
  lenient: 'Lenient', standard: 'Standard', strict: 'Strict',
};

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
  peak_percentage: number | null;
  peak_windows: { days: number[]; start_time: string; end_time: string }[];
  is_active: boolean;
  is_verified: boolean;
  verification_status: string;
  verification_reason: string | null;
  rating: number;
  total_reviews: number;
  operating_hours: { open: string; close: string };
  scheduling_policy: { max_slot_duration_minutes: number; max_advance_booking_days: number };
  rules: string[];
  cancellation_policy: CancellationPolicy | null;
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
  base_price?: number;
  is_peak?: boolean;
  is_booked: boolean;
  is_blocked: boolean;
  is_club_reserved?: boolean;
  reservation_note?: string | null;
  is_held?: boolean;
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

export async function updateVendorProfile(data: Partial<Pick<VendorProfile, 'business_name' | 'business_phone' | 'business_city' | 'business_description' | 'business_logo' | 'business_cover_image' | 'is_active'>>): Promise<VendorProfile> {
  const result = await apiRequest<{ profile: VendorProfile }>('/vendors/me', { method: 'PATCH', data });
  return result.profile;
}

export async function activateVendorMode(): Promise<void> {
  await apiRequest('/vendors/mode', { method: 'PATCH', data: {} });
}

export type VendorVerificationDocument = { type: 'cnic_front' | 'cnic_back' | 'business_registration' | 'authorization_letter'; storage_key: string; content_type: string; original_filename?: string | null };
export type VendorVerification = { status: string; identity_status: string; business_status: string; payout_status: string; identity_reason?: string | null; business_reason?: string | null; payout_reason?: string | null; business_type?: string | null; registrant_relationship?: string | null; cnic_last_four?: string | null; business_number_last_four?: string | null; payout_bank_name?: string | null; payout_account_title?: string | null; documents: { id: string; type: string; contentType: string; originalFilename: string | null }[] };
export async function getVendorVerification(): Promise<VendorVerification | null> { return (await apiRequest<{ verification: VendorVerification | null }>('/vendors/verification')).verification; }
export async function saveVendorVerificationStep(step: 'identity' | 'business' | 'payout', data: Record<string, unknown>): Promise<void> { await apiRequest(`/vendors/verification/${step}`, { method: 'PUT', data }); }
export async function submitVendorVerification(): Promise<void> { await apiRequest('/vendors/verification/submit', { method: 'POST', data: {} }); }
export type GroundVerificationDocument = { id?: string; type: string; storage_key?: string; content_type?: string; original_filename?: string | null; contentType?: string; originalFilename?: string | null };
export type GroundVerification = { status: string; authority_status: string; authority_reason?: string | null; relationship?: 'owner' | 'tenant_lessee' | 'manager_operator' | null; document_expiry_date?: string | null; documents: GroundVerificationDocument[]; submitted_at?: string | null };
export async function getGroundVerification(id: string): Promise<{ ground: Ground; verification: GroundVerification }> { return apiRequest(`/grounds/${id}/verification`); }
export async function saveGroundVerification(id: string, data: Record<string, unknown>): Promise<void> { await apiRequest(`/grounds/${id}/verification`, { method: 'PUT', data }); }
export async function submitGroundVerification(id: string): Promise<void> { await apiRequest(`/grounds/${id}/verification/submit`, { method: 'POST', data: {} }); }

export interface EarningsEntry {
  id: string;
  booking_id: string;
  type: 'booking_earning' | 'refund' | 'adjustment' | 'payout';
  status: 'pending' | 'posted' | 'reversed';
  amount: number;
  description: string;
  booking_number: string;
  ground_title: string;
  posted_at: string | null;
  created_at: string;
}

export interface EarningsSummary {
  available_to_withdraw: number;
  pending_earnings: number;
  total_paid_out: number;
  pending_refunds: number;
}

export async function getVendorEarnings(page = 1, limit = 30): Promise<{ summary: EarningsSummary; entries: EarningsEntry[]; pagination: Pagination }> {
  return apiRequest(`/vendors/earnings?page=${page}&limit=${limit}`);
}

export async function getVendorGrounds(page = 1, limit = 50): Promise<{ grounds: Ground[]; pagination: Pagination }> {
  return apiRequest(`/grounds/vendor/mine?page=${page}&limit=${limit}`);
}

export async function listVendorGrounds(): Promise<Ground[]> {
  const result = await getVendorGrounds();
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

export async function deleteGround(id: string): Promise<{ deleted: boolean; archived: boolean; message?: string }> {
  return apiRequest<{ deleted: boolean; archived: boolean; message?: string }>(`/grounds/${id}`, { method: 'DELETE' });
}

export async function listGroundSlots(id: string): Promise<Slot[]> {
  const result = await apiRequest<{ slots: Slot[] }>(`/grounds/${id}/slots`);
  return result.slots;
}

export async function createGroundSlot(groundId: string, data: Pick<Slot, 'date' | 'start_time' | 'end_time' | 'price'>): Promise<Slot> {
  const result = await apiRequest<{ slot: Slot }>(`/grounds/${groundId}/slots`, { method: 'POST', data });
  return result.slot;
}

export async function createRecurringGroundSlots(groundId: string, data: { start_date: string; start_time: string; end_time: string; price: number; interval_days: number; occurrences: number }): Promise<Slot[]> {
  const result = await apiRequest<{ slots: Slot[] }>(`/grounds/${groundId}/slots/recurring`, { method: 'POST', data });
  return result.slots;
}

export async function updateGroundSlot(groundId: string, slotId: string, data: Partial<Slot>): Promise<Slot> {
  const result = await apiRequest<{ slot: Slot }>(`/grounds/${groundId}/slots/${slotId}`, { method: 'PATCH', data });
  return result.slot;
}

export async function deleteGroundSlot(groundId: string, slotId: string): Promise<void> {
  await apiRequest<void>(`/grounds/${groundId}/slots/${slotId}`, { method: 'DELETE' });
}

export async function bulkUpdateGroundSlots(groundId: string, slotIds: string[], action: 'block' | 'unblock' | 'delete'): Promise<void> {
  await apiRequest(`/grounds/${groundId}/slots/bulk`, { method: 'PATCH', data: { slot_ids: slotIds, action } });
}

export async function saveGroundSchedule(groundId: string, data: { open_time: string; close_time: string; slot_duration_minutes: number; slot_starts: string[]; days: number[]; price: number }): Promise<Slot[]> {
  const result = await apiRequest<{ slots: Slot[] }>(`/grounds/${groundId}/schedule`, { method: 'PUT', data });
  return result.slots;
}

export interface GroundBlackout { id: string; date: string; reason: string | null; }
export async function listGroundBlackouts(groundId: string): Promise<GroundBlackout[]> { const result = await apiRequest<{ blackouts: GroundBlackout[] }>(`/grounds/${groundId}/blackouts`); return result.blackouts; }
export async function createGroundBlackouts(groundId: string, dates: string[], reason?: string): Promise<void> { await apiRequest(`/grounds/${groundId}/blackouts`, { method: 'POST', data: { dates, reason } }); }
export async function deleteGroundBlackout(groundId: string, date: string): Promise<void> { await apiRequest(`/grounds/${groundId}/blackouts/${date}`, { method: 'DELETE' }); }

export interface PublicGroundListResult {
  grounds: Ground[];
  availability_by_ground: Record<string, { available_count: number; next_available_at: string | null }>;
  pagination: Pagination;
}

export async function listPublicGrounds(page = 1, limit = 24): Promise<PublicGroundListResult> {
  return apiRequest(`/grounds?page=${page}&limit=${limit}`);
}

export interface PublicGroundSearchResult {
  grounds: Ground[];
  slots_by_ground: Record<string, Slot[]>;
  pagination: Pagination;
}

export interface PublicGroundSearchOptions {
  q?: string;
  city?: string;
  pitch_type?: string;
  amenities?: string[];
  availability_date: string;
  max_price?: number;
  sort?: 'recommended' | 'price_low' | 'price_high' | 'rating';
  page?: number;
  limit?: number;
}

export async function searchPublicGrounds(options: PublicGroundSearchOptions): Promise<PublicGroundSearchResult> {
  const params = new URLSearchParams();
  Object.entries(options).forEach(([key, value]) => {
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return;
    params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  });
  return apiRequest<PublicGroundSearchResult>(`/grounds?${params.toString()}`);
}

export async function getPublicGround(id: string): Promise<{ ground: Ground; slots: Slot[] }> {
  return apiRequest<{ ground: Ground; slots: Slot[] }>(`/grounds/${id}`);
}
