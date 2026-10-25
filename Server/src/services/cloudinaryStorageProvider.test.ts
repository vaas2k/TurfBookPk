import assert from 'node:assert/strict';
import test from 'node:test';

test('signed Cloudinary uploads cannot overwrite cached public photos or private documents', async () => {
  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
  process.env.CLOUDINARY_API_KEY = 'test-key';
  process.env.CLOUDINARY_API_SECRET = 'test-secret';
  const { CloudinaryStorageProvider } = await import('./cloudinaryStorageProvider.js');
  const storage = new CloudinaryStorageProvider();
  const photo = await storage.createUploadTarget({ ownerId: 'owner', contentType: 'image/jpeg', contentLength: 1024, purpose: 'ground' });
  const document = await storage.createUploadTarget({ ownerId: 'owner', contentType: 'application/pdf', contentLength: 1024, purpose: 'ground_authority_document' });
  assert.equal(photo.fields.overwrite, 'false');
  assert.match(photo.publicUrl || '', /\/image\/upload\/f_auto,q_auto\/v1\/turfbookpk\/owner\/ground\//);
  assert.equal(document.fields.overwrite, 'false');
  assert.equal(document.fields.type, 'authenticated');
  assert.equal(document.publicUrl, null);
});
