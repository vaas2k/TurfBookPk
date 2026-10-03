import { apiRequest } from './client';
import { File } from 'expo-file-system';

export type MediaPurpose = 'avatar' | 'ground' | 'vendor_logo' | 'vendor_cover' | 'vendor_identity_document' | 'vendor_business_document' | 'vendor_authorization_document' | 'ground_authority_document';
type LocalImage = { uri: string; mimeType?: string | null; fileSize?: number | null; fileName?: string | null };

export async function uploadImage(image: LocalImage, purpose: MediaPurpose): Promise<{ url: string; key: string }> {
  const contentType = image.mimeType || 'image/jpeg'; const contentLength = image.fileSize || 0;
  if (!contentLength) throw new Error('Unable to read this image size. Choose a different image.');
  const { target } = await apiRequest<{ target: { key: string; upload_url: string; public_url: string | null; is_private: boolean; method: 'POST' | 'PUT'; fields: Record<string, string> } }>('/media/upload-target', { method: 'POST', data: { content_type: contentType, content_length: contentLength, purpose } });
  const form = new FormData(); Object.entries(target.fields).forEach(([key, value]) => form.append(key, value));
  // Expo SDK 57's fetch only accepts Blob-compatible values. React Native's
  // legacy `{ uri, type, name }` FormData part is rejected at runtime.
  const file = new File(image.uri);
  form.append('file', file, image.fileName || `image-${Date.now()}.jpg`);
  const response = await fetch(target.upload_url, { method: target.method, body: form });
  if (!response.ok) throw new Error('Image upload failed. Please try again.');
  if (!target.public_url) throw new Error('This private document was uploaded but cannot be displayed publicly.');
  return { url: target.public_url, key: target.key };
}

export async function uploadPrivateDocument(file: LocalImage, purpose: Extract<MediaPurpose, 'vendor_identity_document' | 'vendor_business_document' | 'vendor_authorization_document' | 'ground_authority_document'>): Promise<{ key: string; content_type: string; original_filename: string | null }> {
  const contentType = file.mimeType || 'image/jpeg'; const contentLength = file.fileSize || 0;
  if (!contentLength) throw new Error('Unable to read this document size. Choose a different file.');
  const { target } = await apiRequest<{ target: { key: string; upload_url: string; is_private: boolean; method: 'POST' | 'PUT'; fields: Record<string, string> } }>('/media/upload-target', { method: 'POST', data: { content_type: contentType, content_length: contentLength, purpose } });
  if (!target.is_private) throw new Error('Private document upload was not configured correctly.');
  const form = new FormData(); Object.entries(target.fields).forEach(([key, value]) => form.append(key, value)); const documentFile = new File(file.uri); form.append('file', documentFile, file.fileName || `document-${Date.now()}`);
  const response = await fetch(target.upload_url, { method: target.method, body: form });
  if (!response.ok) {
    const providerMessage = await response.text().catch(() => '');
    let message = 'Document upload failed. Please try again.';
    try { const parsed = JSON.parse(providerMessage) as { error?: { message?: string } }; if (parsed.error?.message) message = `Document upload failed: ${parsed.error.message}`; } catch { /* Provider did not return JSON. */ }
    throw new Error(message);
  }
  return { key: target.key, content_type: contentType, original_filename: file.fileName || null };
}

export async function deleteImage(key: string): Promise<void> { await apiRequest('/media', { method: 'DELETE', data: { key } }); }
export function mediaKeyFromUrl(url: string | null | undefined): string | null { if (!url) return null; const marker = '/image/upload/f_auto,q_auto/'; const index = url.indexOf(marker); return index < 0 ? null : decodeURIComponent(url.slice(index + marker.length)); }
export async function deleteOwnedImageUrl(url: string | null | undefined): Promise<void> { const key = mediaKeyFromUrl(url); if (key) await deleteImage(key); }
