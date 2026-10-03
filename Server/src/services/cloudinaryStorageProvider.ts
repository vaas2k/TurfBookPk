import { createHash, randomUUID } from 'node:crypto';
import { AppError } from '../helpers/errors.js';
import { env } from '../configs/env.js';
import { ObjectStorageProvider, UploadTarget } from './objectStorageProvider.js';

function signature(params: Record<string, string>): string {
  const serialized = Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('&');
  return createHash('sha256').update(`${serialized}${env.cloudinaryApiSecret}`).digest('hex');
}

export class CloudinaryStorageProvider implements ObjectStorageProvider {
  private assertConfigured(): void {
    if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) throw new AppError('storage_not_configured', 'Image storage is not configured yet', 503);
  }

  async createUploadTarget(input: { ownerId: string; contentType: string; contentLength: number; purpose: 'avatar' | 'ground' | 'vendor_logo' | 'vendor_cover' | 'vendor_identity_document' | 'vendor_business_document' | 'vendor_authorization_document' | 'ground_authority_document' }): Promise<UploadTarget> {
    this.assertConfigured();
    const privateDocument = input.purpose.endsWith('_document');
    const allowed = privateDocument ? ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] : ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(input.contentType)) throw new AppError('invalid_media_type', privateDocument ? 'Use a JPEG, PNG, WebP, or PDF document' : 'Use a JPEG, PNG, or WebP image', 422);
    if (!Number.isSafeInteger(input.contentLength) || input.contentLength < 1 || input.contentLength > (privateDocument ? 12 : 8) * 1024 * 1024) throw new AppError('invalid_media_size', privateDocument ? 'Documents must be smaller than 12 MB' : 'Images must be smaller than 8 MB', 422);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const assetId = randomUUID(); const folder = `turfbookpk/${input.ownerId}/${input.purpose}`; const publicId = `${folder}/${assetId}`;
    const params = privateDocument ? { folder, public_id: assetId, timestamp, type: 'authenticated' } : { folder, public_id: assetId, timestamp };
    return {
      key: publicId,
      // `authenticated` is the delivery type sent as a signed form field.
      // The Upload API URL contains only the resource type (`auto` here so PDFs
      // and images are both accepted), not the delivery type.
      uploadUrl: `https://api.cloudinary.com/v1_1/${env.cloudinaryCloudName}/${privateDocument ? 'auto' : 'image'}/upload`,
      publicUrl: privateDocument ? null : `https://res.cloudinary.com/${env.cloudinaryCloudName}/image/upload/f_auto,q_auto/${publicId}`,
      expiresAt: new Date((Number(timestamp) + 3600) * 1000),
      method: 'POST',
      fields: { api_key: env.cloudinaryApiKey, timestamp, folder, public_id: assetId, ...(privateDocument ? { type: 'authenticated' } : {}), signature: signature(params) },
    };
  }

  async deleteObject(input: { ownerId: string; key: string }): Promise<void> {
    this.assertConfigured();
    if (!input.key.startsWith(`turfbookpk/${input.ownerId}/`)) throw new AppError('media_forbidden', 'You cannot delete this image', 403);
    const privateDocument = /\/(vendor_(identity|business|authorization)|ground_authority)_document\//.test(input.key);
    const timestamp = String(Math.floor(Date.now() / 1000)); const params = privateDocument ? { invalidate: 'true', public_id: input.key, timestamp, type: 'authenticated' } : { invalidate: 'true', public_id: input.key, timestamp };
    const body = new URLSearchParams({ ...params, api_key: env.cloudinaryApiKey, signature: signature(params) });
    const result = await fetch(`https://api.cloudinary.com/v1_1/${env.cloudinaryCloudName}/${privateDocument ? 'auto' : 'image'}/destroy`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
    if (!result.ok) throw new AppError('media_delete_failed', 'Unable to delete the image', 502);
  }
}
