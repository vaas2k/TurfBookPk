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
  due_now_amount?: number;
};

export type Pagination = { page: number; limit: number; total: number; has_more: boolean };
export type BookingList = { bookings: BookingProfile[]; pagination: Pagination };

function pageQuery(page: number, limit: number): string {
  return `?page=${page}&limit=${limit}`;
}

export async function createBooking(slotId: string, idempotencyKey: string): Promise<BookingProfile> {
  const result = await apiRequest<{ booking: BookingProfile }>('/bookings', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, data: { slot_id: slotId, idempotency_key: idempotencyKey } });
  return result.booking;
}

export async function confirmMockBooking(id: string, paymentReference?: string): Promise<BookingProfile> {
  const result = await apiRequest<{ booking: BookingProfile }>(`/bookings/${id}/mock-confirm`, { method: 'POST', data: { payment_reference: paymentReference || null } });
  return result.booking;
}

export async function createBookingOrder(slotIds: string[], idempotencyKey: string, reserveFutureSlots = false): Promise<BookingOrder> {
  const result = await apiRequest<{ order: BookingOrder }>('/bookings/orders', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    data: { slot_ids: slotIds, idempotency_key: idempotencyKey, reserve_future_slots: reserveFutureSlots },
  });
  return result.order;
}

export async function confirmRecurringReservationBooking(id: string, paymentReference?: string): Promise<BookingProfile> {
  const result = await apiRequest<{ booking: BookingProfile }>(`/bookings/${id}/recurring-reservation/mock-confirm`, { method: 'POST', data: { payment_reference: paymentReference || null } });
  return result.booking;
}

export async function confirmMockBookingOrder(id: string, paymentReference?: string): Promise<BookingOrder> {
  const result = await apiRequest<{ order: BookingOrder }>(`/bookings/orders/${id}/mock-confirm`, {
    method: 'POST',
    data: { payment_reference: paymentReference || null },
  });
  return result.order;
}

export async function getPlayerBookings(page = 1, limit = 50): Promise<BookingList> {
  return apiRequest<BookingList>(`/bookings/mine${pageQuery(page, limit)}`);
}

export async function listPlayerBookings(): Promise<BookingProfile[]> {
  return (await getPlayerBookings()).bookings;
}

export async function getVendorBookings(page = 1, limit = 50): Promise<BookingList> {
  return apiRequest<BookingList>(`/bookings/vendor${pageQuery(page, limit)}`);
}

export async function listVendorBookings(): Promise<BookingProfile[]> {
  return (await getVendorBookings()).bookings;
}

export async function cancelBooking(id: string, reason?: string): Promise<BookingProfile> {
  const result = await apiRequest<{ booking: BookingProfile }>(`/bookings/${id}/cancel`, { method: 'PATCH', data: { reason: reason || null } });
  return result.booking;
}

export async function getCancellationPreview(id: string): Promise<{ cancellation_fee: number; refund_amount: number; refund_required: boolean; refund_percentage: number; cancellation_policy: 'lenient' | 'standard' | 'strict'; within_grace_window: boolean; grace_window_minutes: number; payment_status: string; is_mock_payment: boolean }> {
  return apiRequest(`/bookings/${id}/cancellation-preview`);
}

export async function getBooking(id: string): Promise<BookingProfile> {
  const result = await apiRequest<{ booking: BookingProfile }>(`/bookings/${id}`);
  return result.booking;
}

export async function markBookingNoShow(id: string): Promise<BookingProfile> {
  const result = await apiRequest<{ booking: BookingProfile }>(`/bookings/${id}/no-show`, { method: 'PATCH', data: {} });
  return result.booking;
}
export async function markBookingCompleted(id: string): Promise<BookingProfile> {
  const result = await apiRequest<{ booking: BookingProfile }>(`/bookings/${id}/complete`, { method: 'PATCH', data: {} });
  return result.booking;
}

export type PaymentBillingProfile = { full_name: string; masked_cnic: string; billing_address: string; email: string; phone: string; consented_at: string };
export type PaymentAttempt = { id: string; booking_id: string | null; order_id: string | null; provider: string; status: string; provider_status: string; amount: number; service_charge: number | null; final_payable_amount: number | null; clink_id: string | null; consumer_number: string | null; provider_due_date: string | null; expires_at: string | null; paid_at: string | null; review_status: string; provider_error: string | null; manual_acknowledgment_test_enabled: boolean };

export async function getPaymentBillingProfile(): Promise<PaymentBillingProfile | null> {
  return (await apiRequest<{ billing_profile: PaymentBillingProfile | null }>('/payments/billing-profile')).billing_profile;
}
export async function savePaymentBillingProfile(input: { full_name: string; cnic: string; billing_address: string; email: string; phone: string }): Promise<PaymentBillingProfile> {
  return (await apiRequest<{ billing_profile: PaymentBillingProfile }>('/payments/billing-profile', { method: 'PUT', data: { ...input, consent: true } })).billing_profile;
}
export async function generateClinkReference(target: { booking_id?: string; order_id?: string }): Promise<{ payment: PaymentAttempt; fee_notice?: string }> {
  return apiRequest('/payments/references', { method: 'POST', data: target });
}
export async function getPaymentAttempt(id: string): Promise<PaymentAttempt> {
  return (await apiRequest<{ payment: PaymentAttempt }>(`/payments/${id}`)).payment;
}
export async function getBookingPaymentAttempt(bookingId: string): Promise<PaymentAttempt | null> {
  return (await apiRequest<{ payment: PaymentAttempt | null }>(`/payments/booking/${bookingId}`)).payment;
}
export async function getPaymentConfiguration(): Promise<{ provider: string; environment: string; available: boolean; manual_acknowledgment_test_enabled: boolean }> {
  return apiRequest('/payments/configuration');
}
