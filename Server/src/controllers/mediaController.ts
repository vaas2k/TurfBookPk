import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../helpers/errors.js';
import { ObjectStorageProvider } from '../services/objectStorageProvider.js';

const purposes = ['avatar', 'ground', 'vendor_logo', 'vendor_cover', 'vendor_identity_document', 'vendor_business_document', 'vendor_authorization_document', 'ground_authority_document'] as const;
export class MediaController {
  constructor(private readonly storage: ObjectStorageProvider) {}
  createUploadTarget = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const { content_type, content_length, purpose } = request.body || {};
    if (!purposes.includes(purpose) || typeof content_type !== 'string' || !Number.isSafeInteger(content_length)) throw new AppError('invalid_media', 'Image type, size, and purpose are required', 422);
    const target = await this.storage.createUploadTarget({ ownerId: request.auth.userId, contentType: content_type, contentLength: content_length, purpose });
    response.status(201).json({ target: { key: target.key, upload_url: target.uploadUrl, public_url: target.publicUrl, is_private: target.publicUrl === null, expires_at: target.expiresAt.toISOString(), method: target.method, fields: target.fields } });
  };
  remove = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const key = typeof request.body?.key === 'string' ? request.body.key : '';
    if (!key) throw new AppError('invalid_media', 'Image key is required', 422);
    await this.storage.deleteObject({ ownerId: request.auth.userId, key }); response.status(204).send();
  };
}
