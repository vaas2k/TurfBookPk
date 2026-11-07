import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { eq } from 'drizzle-orm';
import { db, sql } from './client.js';
import { grounds, pitchComponents, pitches, slots, users, vendors } from './schema.js';

const rollback = new Error('pitch test rollback');
after(async () => { await sql.end(); });

async function fixture(tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 8);
  const [owner] = await tx.insert(users).values({ phone: `+92321${suffix}`, fullName: 'Pitch owner', role: 'vendor' }).returning();
  const [vendor] = await tx.insert(vendors).values({ userId: owner!.id, businessName: 'Pitch test', businessPhone: `+92322${suffix}`, businessCity: 'Lahore' }).returning();
  const [ground] = await tx.insert(grounds).values({ vendorId: vendor!.id, title: 'Pitch test', location: 'Lahore', city: 'Lahore', address: 'Test', pricePerHour: 1000 }).returning();
  const [first] = await tx.select().from(pitches).where(eq(pitches.groundId, ground!.id));
  const [second] = await tx.insert(pitches).values({ groundId: ground!.id, name: 'Pitch B', side: 7 }).returning();
  const [combined] = await tx.insert(pitches).values({ groundId: ground!.id, name: 'Full pitch', side: 9, kind: 'combined' }).returning();
  await tx.insert(pitchComponents).values([{ pitchId: combined!.id, componentPitchId: first!.id }, { pitchId: combined!.id, componentPitchId: second!.id }]);
  const base = { groundId: ground!.id, date: '2030-01-01', endDate: '2030-01-01', startTime: '10:00', endTime: '11:00', price: 1000 };
  const [a] = await tx.insert(slots).values({ ...base, pitchId: first!.id }).returning();
  const [b] = await tx.insert(slots).values({ ...base, pitchId: second!.id }).returning();
  const [large] = await tx.insert(slots).values({ ...base, pitchId: combined!.id }).returning();
  return { a: a!, b: b!, large: large! };
}

for (const firstClaim of ['combined', 'small'] as const) {
  test(`${firstClaim} pitch claim blocks overlapping use of both physical pitches`, async () => {
    try {
      await db.transaction(async (tx) => {
        const { a, b, large } = await fixture(tx);
        if (firstClaim === 'combined') {
          await tx.update(slots).set({ isBlocked: true }).where(eq(slots.id, large.id));
          await assert.rejects(tx.update(slots).set({ isBlocked: true }).where(eq(slots.id, a.id)), (error: any) => error?.cause?.code === '23P01' || error?.code === '23P01');
        } else {
          await tx.update(slots).set({ isBlocked: true }).where(eq(slots.id, b.id));
          await assert.rejects(tx.update(slots).set({ isBlocked: true }).where(eq(slots.id, large.id)), (error: any) => error?.cause?.code === '23P01' || error?.code === '23P01');
        }
        throw rollback;
      });
    } catch (error) { if (error !== rollback) throw error; }
  });
}
