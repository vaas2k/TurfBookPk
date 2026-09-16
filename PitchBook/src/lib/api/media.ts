import { apiRequest } from './client';
import { File } from 'expo-file-system';

export type MediaPurpose = 'avatar' | 'ground' | 'vendor_logo' | 'vendor_cover';
type LocalImage = { uri: string; mimeType?: string | null; fileSize?: number | null; fileName?: string | null };

export async function uploadImage(image: LocalImage, purpose: MediaPurpose): Promise<{ url: string; key: string }> {
  const contentType = image.mimeType || 'image/jpeg'; const contentLength = image.fileSize || 0;
  if (!contentLength) throw new Error('Unable to read this image size. Choose a different image.');
  const { target } = await apiRequest<{ target: { key: string; upload_url: string; public_url: string; method: 'POST' | 'PUT'; fields: Record<string, string> } }>('/media/upload-target', { method: 'POST', data: { content_type: contentType, content_length: contentLength, purpose } });
  const form = new FormData(); Object.entries(target.fields).forEach(([key, value]) => form.append(key, value));
  // Expo SDK 57's fetch only accepts Blob-compatible values. React Native's
  // legacy `{ uri, type, name }` FormData part is rejected at runtime.
  const file = new File(image.uri);
  form.append('file', file, image.fileName || `image-${Date.now()}.jpg`);
  const response = await fetch(target.upload_url, { method: target.method, body: form });
  if (!response.ok) throw new Error('Image upload failed. Please try again.');
  return { url: target.public_url, key: target.key };
}

export async function deleteImage(key: string): Promise<void> { await apiRequest('/media', { method: 'DELETE', data: { key } }); }
export function mediaKeyFromUrl(url: string | null | undefined): string | null { if (!url) return null; const marker = '/image/upload/f_auto,q_auto/'; const index = url.indexOf(marker); return index < 0 ? null : decodeURIComponent(url.slice(index + marker.length)); }
export async function deleteOwnedImageUrl(url: string | null | undefined): Promise<void> { const key = mediaKeyFromUrl(url); if (key) await deleteImage(key); }
