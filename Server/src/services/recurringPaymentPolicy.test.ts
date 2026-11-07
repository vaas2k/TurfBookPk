import assert from 'node:assert/strict';
import test from 'node:test';
import { immediateRecurringSlotIds } from './recurringPaymentPolicy.js';

test('charges every recurring occurrence within the next 36 hours', () => {
  const now = new Date('2026-11-07T05:00:00.000Z'); // 10 AM Pakistan time
  const result = immediateRecurringSlotIds([
    { id: 'today', date: '2026-11-07', startTime: '20:00' },
    { id: 'tomorrow', date: '2026-11-08', startTime: '20:00' },
    { id: 'later', date: '2026-11-09', startTime: '20:00' },
  ], now, 36);
  assert.deepEqual([...result].sort(), ['today', 'tomorrow']);
});

test('charges the first occurrence when all selected slots are beyond 36 hours', () => {
  const now = new Date('2026-11-07T05:00:00.000Z');
  const result = immediateRecurringSlotIds([
    { id: 'second', date: '2026-11-15', startTime: '20:00' },
    { id: 'first', date: '2026-11-14', startTime: '20:00' },
  ], now, 36);
  assert.deepEqual([...result], ['first']);
});
