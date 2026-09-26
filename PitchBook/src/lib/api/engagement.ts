import { apiRequest } from './client';
import { Ground } from './vendors';

export async function listFavoriteGrounds(): Promise<Ground[]> { return (await apiRequest<{ grounds: Ground[] }>('/engagement/favorites')).grounds; }
export async function listRecentlyViewedGrounds(): Promise<Ground[]> { return (await apiRequest<{ grounds: Ground[] }>('/engagement/recent')).grounds; }
export async function addFavoriteGround(groundId: string): Promise<void> { await apiRequest(`/engagement/grounds/${groundId}/favorite`, { method: 'POST', data: {} }); }
export async function removeFavoriteGround(groundId: string): Promise<void> { await apiRequest(`/engagement/grounds/${groundId}/favorite`, { method: 'DELETE' }); }
export async function recordGroundView(groundId: string): Promise<void> { await apiRequest(`/engagement/grounds/${groundId}/view`, { method: 'POST', data: {} }); }
