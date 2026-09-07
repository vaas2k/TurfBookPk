import { apiRequest } from './client';
import { BookingProfile } from '@/types/booking';

export type { BookingProfile } from '@/types/booking';

export async function createBooking(slotId: string, paymentReference?: string): Promise<BookingProfile> {
  const result = await apiRequest<{ booking: BookingProfile }>('/bookings', { method: 'POST', data: { slot_id: slotId, payment_reference: paymentReference || null } });
  return result.booking;
}

export async function listPlayerBookings(): Promise<BookingProfile[]> {
  const result = await apiRequest<{ bookings: BookingProfile[] }>('/bookings/mine');
  return result.bookings;
}

export async function listVendorBookings(): Promise<BookingProfile[]> {
  const result = await apiRequest<{ bookings: BookingProfile[] }>('/bookings/vendor');
  return result.bookings;
}

export async function cancelBooking(id: string): Promise<void> {
  await apiRequest(`/bookings/${id}/cancel`, { method: 'PATCH' });
}
