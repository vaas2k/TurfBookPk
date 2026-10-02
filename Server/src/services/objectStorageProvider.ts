export interface UploadTarget {
  key: string;
  uploadUrl: string;
  publicUrl: string | null;
  expiresAt: Date;
  method: 'POST' | 'PUT';
  fields: Record<string, string>;
}

export interface ObjectStorageProvider {
  createUploadTarget(input: { ownerId: string; contentType: string; contentLength: number; purpose: 'avatar' | 'ground' | 'vendor_logo' | 'vendor_cover' | 'vendor_identity_document' | 'vendor_business_document' | 'vendor_authorization_document' }): Promise<UploadTarget>;
  deleteObject(input: { ownerId: string; key: string }): Promise<void>;
}

/**
 * Contract for a future R2/S3 implementation. Mobile clients must upload through
 * short-lived server-issued targets, never persist device-local file URIs as media URLs.
 */
