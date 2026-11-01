import assert from 'node:assert/strict';
import test from 'node:test';
import { periodsConflict, validTurnaround } from './slotTurnaround.js';

const first = { date: '2030-01-01', startTime: '13:00', endTime: '14:00', turnaroundMinutes: 10 };

test('a team receives full play time followed by the selected changeover', () => {
  assert.equal(periodsConflict(first, { date: first.date, startTime: '14:05', endTime: '15:05', turnaroundMinutes: 10 }), true);
  assert.equal(periodsConflict(first, { date: first.date, startTime: '14:10', endTime: '15:10', turnaroundMinutes: 10 }), false);
  assert.equal(periodsConflict({ ...first, turnaroundMinutes: 5 }, { date: first.date, startTime: '14:05', endTime: '15:05', turnaroundMinutes: 15 }), false);
  assert.equal(periodsConflict({ ...first, turnaroundMinutes: 15 }, { date: first.date, startTime: '14:10', endTime: '15:10', turnaroundMinutes: 10 }), true);
});

test('buffer crossing midnight blocks the following day', () => {
  assert.equal(periodsConflict({ date: '2030-01-01', startTime: '23:00', endTime: '23:55', turnaroundMinutes: 10 }, { date: '2030-01-02', startTime: '00:00', endTime: '01:00', turnaroundMinutes: 10 }), true);
});

test('only the three vendor options are accepted', () => {
  assert.deepEqual([0, 5, 10, 15, 20].filter(validTurnaround), [5, 10, 15]);
});
