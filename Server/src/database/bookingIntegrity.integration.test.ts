import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { db, sql } from './client.js';
import { bookings, grounds, slots, users, vendors } from './schema.js';

const rollback = new Error('test rollback');

after(async () => {
  await sql.end();
});

async function inRollbackTransaction(action: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<void>): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await action(tx);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

async function fixture(tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const player = (await tx.insert(users).values({ phone: `+92300${suffix.replace(/\D/g, '').slice(-7)}`, fullName: 'Integration Player' }).returning())[0]!;
  const owner = (await tx.insert(users).values({ phone: `+92301${suffix.replace(/\D/g, '').slice(-7)}`, fullName: 'Integration Owner', role: 'vendor' }).returning())[0]!;
  const vendor = (await tx.insert(vendors).values({ userId: owner.id, businessName: `Test Vendor ${suffix}`, businessPhone: `+92311${suffix.replace(/\D/g, '').slice(-7)}`, businessCity: 'Karachi' }).returning())[0]!;
  const ground = (await tx.insert(grounds).values({ vendorId: vendor.id, title: `Test Ground ${suffix}`, location: 'Test location', city: 'Karachi', address: 'Test address', pricePerHour: 1000 }).returning())[0]!;
  const slot = (await tx.insert(slots).values({ groundId: ground.id, date: '2030-01-01', startTime: '10:00', endTime: '11:00', price: 1000 }).returning())[0]!;
  return { player, vendor, ground, slot };
}

function postgresError(error: unknown): { code?: string; constraint_name?: string } | undefined {
  return (error as { cause?: { code?: string; constraint_name?: string } })?.cause;
}

test('database rejects overlapping slots', async () => {
  await inRollbackTransaction(async (tx) => {
    const { ground } = await fixture(tx);
    await assert.rejects(
      tx.insert(slots).values({ groundId: ground.id, date: '2030-01-01', startTime: '10:30', endTime: '11:30', price: 1000 }),
      (error) => postgresError(error)?.code === '23P01',
    );
  });
});

test('database rejects contradictory slot flags', async () => {
  await inRollbackTransaction(async (tx) => {
    const { ground } = await fixture(tx);
    await assert.rejects(
      tx.insert(slots).values({ groundId: ground.id, date: '2030-01-02', startTime: '10:00', endTime: '11:00', price: 1000, isBooked: true, isBlocked: true }),
      (error) => postgresError(error)?.code === '23514',
    );
  });
});

test('database permits only one active booking per slot', async () => {
  await inRollbackTransaction(async (tx) => {
    const { player, vendor, ground, slot } = await fixture(tx);
    const base = { playerId: player.id, vendorId: vendor.id, groundId: ground.id, slotId: slot.id, date: slot.date, startTime: slot.startTime, endTime: slot.endTime, totalAmount: 1000, vendorAmount: 1000, status: 'pending_payment' as const, paymentStatus: 'pending' as const };
    await tx.insert(bookings).values({ ...base, bookingNumber: `first-${slot.id}` });
    await assert.rejects(
      tx.insert(bookings).values({ ...base, bookingNumber: `second-${slot.id}` }),
      (error) => postgresError(error)?.code === '23505' && postgresError(error)?.constraint_name === 'bookings_one_active_booking_per_slot',
    );
  });
});
