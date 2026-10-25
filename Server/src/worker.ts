import { sql } from './database/client.js';
import { connectRedis, closeRedis } from './services/redisClient.js';
import { BookingMaintenanceService } from './services/bookingMaintenance.js';
import { PaymentController } from './controllers/paymentController.js';
import { processExpoPushReceipts } from './services/expoPushService.js';
import { processNotificationOutbox } from './services/notificationOutbox.js';
import { cleanupExpiredUnbookedSlots, extendAllScheduleHorizons } from './services/scheduleMaterialization.js';
import { escalateStaleClinkGeneration } from './services/paymentEscalation.js';
import { errorMetadata, logEvent } from './services/operationalLogger.js';
import { env } from './configs/env.js';

const maintenance = new BookingMaintenanceService();
const payments = new PaymentController();
let stopping = false;
let active: Promise<void> | null = null;
const otherJobs = new Set<Promise<unknown>>();

function track<T>(job: Promise<T>): Promise<T> {
  otherJobs.add(job);
  void job.then(() => otherJobs.delete(job), () => otherJobs.delete(job));
  return job;
}

async function exclusiveJob(name: string, lockId: number, task: () => Promise<unknown>): Promise<void> {
  let connection: Awaited<ReturnType<typeof sql.reserve>> | undefined;
  let owned = false;
  try {
    connection = await sql.reserve();
    const [result] = await connection`SELECT pg_try_advisory_lock(${lockId}) AS acquired`;
    owned = result?.acquired === true;
    if (!owned) return;
    const started = Date.now();
    const outcome = await task();
    logEvent('info', 'worker_job_completed', { job: name, duration_ms: Date.now() - started, outcome });
  } catch (error) {
    logEvent('error', 'worker_job_failed', { job: name, ...errorMetadata(error) });
  } finally {
    try {
      if (owned && connection) await connection`SELECT pg_advisory_unlock(${lockId})`;
    } finally {
      connection?.release();
    }
  }
}

async function tick(): Promise<void> {
  if (stopping || active) return;
  active = (async () => {
    await exclusiveJob('booking_maintenance', 2026102401, async () => ({ completed: await maintenance.completeEndedBookings() }));
    await exclusiveJob('clink_expiration', 2026102402, () => payments.expirePendingAttempts());
    await exclusiveJob('clink_ambiguity', 2026102406, escalateStaleClinkGeneration);
  })();
  try { await active; } finally { active = null; }
}

async function main(): Promise<void> {
  if (env.dbPoolMode === 'transaction') throw new Error('Worker advisory locks require a direct PostgreSQL connection or session pooling');
  await connectRedis();
  const timers: NodeJS.Timeout[] = [];
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    for (const timer of timers) clearInterval(timer);
    await Promise.allSettled([...(active ? [active] : []), ...otherJobs]);
    await closeRedis();
    await sql.end();
    process.exitCode = 0;
  };
  process.on('SIGTERM', () => { void shutdown().catch((error) => logEvent('error', 'worker_shutdown_failed', errorMetadata(error))); });
  process.on('SIGINT', () => { void shutdown().catch((error) => logEvent('error', 'worker_shutdown_failed', errorMetadata(error))); });
  logEvent('info', 'worker_started');
  await tick();
  if (stopping) return;
  await track(exclusiveJob('notification_outbox', 2026102404, processNotificationOutbox));
  if (stopping) return;
  await track(exclusiveJob('schedule_horizon', 2026102405, extendAllScheduleHorizons));
  if (stopping) return;
  await track(exclusiveJob('old_unbooked_slot_cleanup', 2026102407, cleanupExpiredUnbookedSlots));
  if (stopping) return;
  timers.push(setInterval(() => { void tick().catch((error) => logEvent('error', 'worker_tick_failed', errorMetadata(error))); }, 15_000));
  timers.push(setInterval(() => { void track(exclusiveJob('notification_outbox', 2026102404, processNotificationOutbox)).catch((error) => logEvent('error', 'worker_outbox_tick_failed', errorMetadata(error))); }, 2_000));
  timers.push(setInterval(() => { void track(exclusiveJob('push_receipts', 2026102403, processExpoPushReceipts)).catch((error) => logEvent('error', 'worker_receipt_tick_failed', errorMetadata(error))); }, 5 * 60_000));
  timers.push(setInterval(() => { void track(exclusiveJob('schedule_horizon', 2026102405, extendAllScheduleHorizons)).catch((error) => logEvent('error', 'worker_schedule_tick_failed', errorMetadata(error))); }, 10 * 60_000));
  timers.push(setInterval(() => { void track(exclusiveJob('old_unbooked_slot_cleanup', 2026102407, cleanupExpiredUnbookedSlots)).catch((error) => logEvent('error', 'worker_cleanup_tick_failed', errorMetadata(error))); }, 60 * 60_000));
}

main().catch((error) => { logEvent('error', 'worker_start_failed', errorMetadata(error)); process.exitCode = 1; });
