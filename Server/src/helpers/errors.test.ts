import assert from 'node:assert/strict';
import test from 'node:test';
import { databaseConstraintError } from './errors.js';

test('slot overlap and invalid-state database constraints become client conflicts', () => {
  const overlap = databaseConstraintError({ code: '23P01', constraint_name: 'slots_no_overlapping_times' });
  assert.equal(overlap?.statusCode, 409);
  assert.equal(overlap?.code, 'slot_conflict');

  const invalidState = databaseConstraintError({ code: '23514', constraint_name: 'slots_hold_not_booked_or_blocked' });
  assert.equal(invalidState?.statusCode, 409);
  assert.equal(invalidState?.code, 'invalid_slot_state');
});
