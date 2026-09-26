import { apiRequest } from './client';
export type GroundReview = { id: string; rating: number; comment: string | null; player_name: string; created_at: string };
export async function listGroundReviews(groundId: string): Promise<GroundReview[]> { return (await apiRequest<{ reviews: GroundReview[] }>(`/reviews/grounds/${groundId}`)).reviews; }
export async function createReview(bookingId: string, rating: number, comment: string): Promise<void> { await apiRequest(`/reviews/bookings/${bookingId}`, { method: 'POST', data: { rating, comment } }); }
export async function reportReview(reviewId: string, reason: string): Promise<void> { await apiRequest(`/reviews/${reviewId}/report`, { method: 'POST', data: { reason } }); }
export async function moderateReview(reviewId: string, isHidden: boolean, reason?: string): Promise<void> { await apiRequest(`/reviews/${reviewId}/moderation`, { method: 'PATCH', data: { is_hidden: isHidden, reason: reason || null } }); }
