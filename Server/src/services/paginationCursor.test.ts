import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextPaginationCursor, parsePaginationCursor } from './paginationCursor.js';

test('pagination cursor round trips exact timestamp and UUID', () => {
  const row = { createdAt: new Date('2026-10-24T12:34:56.789Z'), id: '123e4567-e89b-12d3-a456-426614174000' };
  assert.deepEqual(parsePaginationCursor(nextPaginationCursor(row)), row);
});

test('pagination cursor rejects malformed and non-UUID values', () => {
  assert.throws(() => parsePaginationCursor('%%%'));
  assert.throws(() => parsePaginationCursor(Buffer.from(JSON.stringify({ created_at: '2026-10-24T12:34:56.789Z', id: 'bad' })).toString('base64url')));
});
