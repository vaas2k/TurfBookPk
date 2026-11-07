import assert from 'node:assert/strict';
import test from 'node:test';
import { coordinatesFromMapUrl } from './mapLinkResolver.js';

test('extracts coordinates from supported Google and Apple map links', () => {
  assert.deepEqual(coordinatesFromMapUrl('https://www.google.com/maps/@33.641757,72.996779,17z'), {
    latitude: 33.641757, longitude: 72.996779, mapsUrl: 'https://www.google.com/maps/search/?api=1&query=33.641757,72.996779',
  });
  assert.equal(coordinatesFromMapUrl('https://maps.apple.com/?ll=33.641757,72.996779')?.longitude, 72.996779);
  assert.equal(coordinatesFromMapUrl('https://evil.example/?q=33.641757,72.996779'), null);
});
