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

  async createUploadTarget(input: { ownerId: string; contentType: string; contentLength: number; purpose: 'avatar' | 'ground' | 'vendor_logo' | 'vendor_cover' }): Promise<UploadTarget> {
    this.assertConfigured();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(input.contentType)) throw new AppError('invalid_image_type', 'Use a JPEG, PNG, or WebP image', 422);
    if (!Number.isSafeInteger(input.contentLength) || input.contentLength < 1 || input.contentLength > 8 * 1024 * 1024) throw new AppError('invalid_image_size', 'Images must be smaller than 8 MB', 422);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const assetId = randomUUID(); const folder = `turfbookpk/${input.ownerId}/${input.purpose}`; const publicId = `${folder}/${assetId}`;
    const params = { folder, public_id: assetId, timestamp };
    return {
      key: publicId,
      uploadUrl: `https://api.cloudinary.com/v1_1/${env.cloudinaryCloudName}/image/upload`,
      publicUrl: `https://res.cloudinary.com/${env.cloudinaryCloudName}/image/upload/f_auto,q_auto/${publicId}`,
      expiresAt: new Date((Number(timestamp) + 3600) * 1000),
      method: 'POST',
      fields: { api_key: env.cloudinaryApiKey, timestamp, folder, public_id: assetId, signature: signature(params) },
    };
  }

  async deleteObject(input: { ownerId: string; key: string }): Promise<void> {
    this.assertConfigured();
    if (!input.key.startsWith(`turfbookpk/${input.ownerId}/`)) throw new AppError('media_forbidden', 'You cannot delete this image', 403);
    const timestamp = String(Math.floor(Date.now() / 1000)); const params = { invalidate: 'true', public_id: input.key, timestamp };
    const body = new URLSearchParams({ ...params, api_key: env.cloudinaryApiKey, signature: signature(params) });
    const result = await fetch(`https://api.cloudinary.com/v1_1/${env.cloudinaryCloudName}/image/destroy`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
    if (!result.ok) throw new AppError('media_delete_failed', 'Unable to delete the image', 502);
  }
}
