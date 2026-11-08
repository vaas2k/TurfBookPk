import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { db } from '../database/client.js';
import { groundManagers, users, vendors } from '../database/schema.js';

export async function managedGroundIds(userId: string): Promise<string[]> {
  const user = (await db.select({ phone: users.phone, suspended: users.isSuspended }).from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!user?.phone || user.suspended) return [];
  const rows = await db.select({ groundId: groundManagers.groundId }).from(groundManagers)
    .innerJoin(vendors, eq(groundManagers.vendorId, vendors.id))
    .where(and(eq(groundManagers.phone, user.phone), isNull(groundManagers.revokedAt), isNotNull(groundManagers.acceptedAt), eq(vendors.isActive, true), eq(vendors.verificationStatus, 'approved')));
  return [...new Set(rows.map((row) => row.groundId))];
}

export async function canOperateGround(userId: string, vendorId: string, groundId: string): Promise<boolean> {
  const owner = (await db.select({ id: vendors.id }).from(vendors).where(and(eq(vendors.id, vendorId), eq(vendors.userId, userId), eq(vendors.isActive, true), eq(vendors.verificationStatus, 'approved'))).limit(1))[0];
  if (owner) return true;
  const user = (await db.select({ phone: users.phone, suspended: users.isSuspended }).from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!user?.phone || user.suspended) return false;
  const manager = (await db.select({ id: groundManagers.id }).from(groundManagers)
    .innerJoin(vendors, eq(groundManagers.vendorId, vendors.id))
    .where(and(eq(groundManagers.vendorId, vendorId), eq(groundManagers.groundId, groundId), eq(groundManagers.phone, user.phone), isNull(groundManagers.revokedAt), isNotNull(groundManagers.acceptedAt), eq(vendors.isActive, true), eq(vendors.verificationStatus, 'approved')))
    .limit(1))[0];
  return Boolean(manager);
}
