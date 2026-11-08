import { apiRequest } from './client';

export type ManagerAssignment = { id: string; name: string; phone: string; ground_id: string; ground_title: string; vendor_name?: string; accepted_at: string | null; revoked_at: string | null };
export async function getMyManagerAssignments(): Promise<ManagerAssignment[]> {
  return (await apiRequest<{ assignments: ManagerAssignment[] }>('/vendors/manager-assignments')).assignments;
}
export async function acceptManagerAssignment(id: string): Promise<void> {
  await apiRequest(`/vendors/manager-assignments/${id}/accept`, { method: 'POST', data: {} });
}
export async function listManagers(): Promise<ManagerAssignment[]> {
  return (await apiRequest<{ managers: ManagerAssignment[] }>('/vendors/managers')).managers;
}
export async function addManager(input: { name: string; phone: string; ground_id: string }): Promise<ManagerAssignment> {
  return (await apiRequest<{ manager: ManagerAssignment }>('/vendors/managers', { method: 'POST', data: input })).manager;
}
export async function revokeManager(id: string): Promise<void> {
  await apiRequest(`/vendors/managers/${id}`, { method: 'DELETE' });
}
export type ManagerPitch = { id: string; name: string; side: number; kind: 'independent' | 'combined'; is_active: boolean };
export type ManagerSlot = { id: string; ground_id: string; pitch_id: string | null; pitch_name: string | null; pitch_side: number | null; date: string; end_date: string; start_time: string; end_time: string; is_booked: boolean; is_blocked: boolean; is_club_reserved: boolean; is_held: boolean };
export async function getManagerSlots(groundId: string, date: string): Promise<{ pitches: ManagerPitch[]; slots: ManagerSlot[] }> {
  return apiRequest<{ pitches: ManagerPitch[]; slots: ManagerSlot[] }>(`/vendors/manager-grounds/${groundId}/slots?date=${encodeURIComponent(date)}`);
}
export async function changeManagerSlot(groundId: string, slotId: string, action: 'block' | 'unblock' | 'reserve' | 'remove'): Promise<void> {
  await apiRequest(`/vendors/manager-grounds/${groundId}/slots/${slotId}`, { method: 'PATCH', data: { action } });
}
