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
  peak_windows: { days: number[]; start_time: string; end_time: string; end_next_day?: boolean }[];
  is_active: boolean;
  is_verified: boolean;
  verification_status: string;
  verification_reason: string | null;
  rating: number;
  total_reviews: number;
  operating_hours: { open: string; close: string; close_next_day?: boolean };
  turnaround_minutes: number;
  scheduling_policy: { max_slot_duration_minutes: number; max_advance_booking_days: number };
  rules: string[];
  cancellation_policy: CancellationPolicy | null;
  created_at: string;
  updated_at: string;
}

export interface Slot {
  id: string;
  ground_id: string;
  pitch_id: string | null;
  date: string;
  end_date?: string;
  start_time: string;
  end_time: string;
  turnaround_minutes: number;
  price: number;
  base_price?: number;
  is_peak?: boolean;
  is_booked: boolean;
  is_blocked: boolean;
  is_club_reserved?: boolean;
  reservation_note?: string | null;
  is_held?: boolean;
  resource_unavailable?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Pitch {
  id: string;
  ground_id?: string;
  name: string;
  side: number;
  kind: 'independent' | 'combined';
  is_active?: boolean;
  component_pitch_ids: string[];
}

export async function listGroundPitches(groundId: string): Promise<Pitch[]> {
  return (await apiRequest<{ pitches: Pitch[] }>(`/grounds/${groundId}/pitches`)).pitches;
}
export async function createGroundPitch(groundId: string, data: { name: string; side: 7 | 9 | 11; kind: 'independent' | 'combined'; component_pitch_ids?: string[] }): Promise<Pitch> {
  return (await apiRequest<{ pitch: Pitch }>(`/grounds/${groundId}/pitches`, { method: 'POST', data })).pitch;
}
export async function updateGroundPitch(groundId: string, pitchId: string, data: { name?: string; side?: 7 | 9 | 11; is_active?: boolean }): Promise<Pitch> {
  return (await apiRequest<{ pitch: Pitch }>(`/grounds/${groundId}/pitches/${pitchId}`, { method: 'PATCH', data })).pitch;
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

export async function resolveGroundMapLink(link: string): Promise<{ latitude: number; longitude: number; maps_url: string }> {
  return apiRequest('/grounds/location/resolve', { method: 'POST', data: { link } });
}

export async function deleteGround(id: string): Promise<{ deleted: boolean; archived: boolean; message?: string }> {
  return apiRequest<{ deleted: boolean; archived: boolean; message?: string }>(`/grounds/${id}`, { method: 'DELETE' });
}

export async function listGroundSlots(id: string): Promise<Slot[]> {
  const result = await apiRequest<{ slots: Slot[] }>(`/grounds/vendor/mine/${id}/slots`);
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

export type GroundScheduleInput = { pitch_id: string; open_time: string; close_time: string; close_next_day: boolean; extend_ground_hours: boolean; slot_duration_minutes: number; turnaround_minutes: 5 | 10 | 15; slot_starts: { time: string; day_offset: 0 | 1 }[]; days: number[]; price: number };
export async function previewGroundSchedule(groundId: string, data: GroundScheduleInput): Promise<{ replaceable_slots: number; protected_slots: number; selected_times: number; repeat_days: number; turnaround_minutes: number }> {
  const result = await apiRequest<{ preview: { replaceable_slots: number; protected_slots: number; selected_times: number; repeat_days: number; turnaround_minutes: number } }>(`/grounds/${groundId}/schedule`, { method: 'PUT', data: { ...data, preview_only: true } });
  return result.preview;
}
export async function saveGroundSchedule(groundId: string, data: GroundScheduleInput): Promise<Slot[]> {
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

export async function getPublicGround(id: string): Promise<{ ground: Ground; pitches: Pitch[]; slots: Slot[] }> {
  return apiRequest<{ ground: Ground; pitches: Pitch[]; slots: Slot[] }>(`/grounds/${id}`);
}
