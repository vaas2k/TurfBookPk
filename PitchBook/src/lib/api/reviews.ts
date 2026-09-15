import { apiRequest } from './client';
export type GroundReview = { id: string; rating: number; comment: string | null; player_name: string; created_at: string };
export async function listGroundReviews(groundId: string): Promise<GroundReview[]> { return (await apiRequest<{ reviews: GroundReview[] }>(`/reviews/grounds/${groundId}`)).reviews; }
export async function createReview(bookingId: string, rating: number, comment: string): Promise<void> { await apiRequest(`/reviews/bookings/${bookingId}`, { method: 'POST', data: { rating, comment } }); }
