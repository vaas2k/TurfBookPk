import { apiRequest } from './client';
import { BookingProfile } from '@/types/booking';

export type { BookingProfile } from '@/types/booking';

export type BookingOrder = {
  id: string;
  order_number: string;
  total_amount: number;
  platform_fee: number;
  status: 'pending_payment' | 'confirmed' | 'cancelled' | 'expired';
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';
};

export async function createBooking(slotId: string, idempotencyKey: string): Promise<BookingProfile> {
  const result = await apiRequest<{ booking: BookingProfile }>('/bookings', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, data: { slot_id: slotId, idempotency_key: idempotencyKey } });
  return result.booking;
}

export async function confirmMockBooking(id: string, paymentReference?: string): Promise<BookingProfile> {
  const result = await apiRequest<{ booking: BookingProfile }>(`/bookings/${id}/mock-confirm`, { method: 'POST', data: { payment_reference: paymentReference || null } });
  return result.booking;
}

export async function createBookingOrder(slotIds: string[], idempotencyKey: string): Promise<BookingOrder> {
  const result = await apiRequest<{ order: BookingOrder }>('/bookings/orders', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    data: { slot_ids: slotIds, idempotency_key: idempotencyKey },
  });
  return result.order;
}

export async function confirmMockBookingOrder(id: string, paymentReference?: string): Promise<BookingOrder> {
  const result = await apiRequest<{ order: BookingOrder }>(`/bookings/orders/${id}/mock-confirm`, {
    method: 'POST',
    data: { payment_reference: paymentReference || null },
  });
  return result.order;
}

export async function listPlayerBookings(): Promise<BookingProfile[]> {
  const result = await apiRequest<{ bookings: BookingProfile[] }>('/bookings/mine');
  return result.bookings;
}

export async function listVendorBookings(): Promise<BookingProfile[]> {
  const result = await apiRequest<{ bookings: BookingProfile[] }>('/bookings/vendor');
  return result.bookings;
}

export async function cancelBooking(id: string, reason?: string): Promise<BookingProfile> {
  const result = await apiRequest<{ booking: BookingProfile }>(`/bookings/${id}/cancel`, { method: 'PATCH', data: { reason: reason || null } });
  return result.booking;
}

export async function getBooking(id: string): Promise<BookingProfile> {
  const result = await apiRequest<{ booking: BookingProfile }>(`/bookings/${id}`);
  return result.booking;
}

export async function markBookingNoShow(id: string): Promise<BookingProfile> {
  const result = await apiRequest<{ booking: BookingProfile }>(`/bookings/${id}/no-show`, { method: 'PATCH', data: {} });
  return result.booking;
}
