import { sql } from './database/client.js';
import { connectRedis, closeRedis } from './services/redisClient.js';
import { BookingMaintenanceService } from './services/bookingMaintenance.js';
import { PaymentController } from './controllers/paymentController.js';
import { processExpoPushReceipts } from './services/expoPushService.js';
import { processNotificationOutbox } from './services/notificationOutbox.js';
import { extendAllScheduleHorizons } from './services/scheduleMaterialization.js';
import { escalateStaleClinkGeneration } from './services/paymentEscalation.js';
import { errorMetadata, logEvent } from './services/operationalLogger.js';

const maintenance = new BookingMaintenanceService();
const payments = new PaymentController();
let stopping = false;
let active: Promise<void> | null = null;

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
  await connectRedis();
  logEvent('info', 'worker_started');
  await tick();
  await exclusiveJob('notification_outbox', 2026102404, processNotificationOutbox);
  await exclusiveJob('schedule_horizon', 2026102405, extendAllScheduleHorizons);
  const maintenanceTimer = setInterval(() => { void tick().catch((error) => logEvent('error', 'worker_tick_failed', errorMetadata(error))); }, 15_000);
  const pushTimer = setInterval(() => { void exclusiveJob('notification_outbox', 2026102404, processNotificationOutbox).catch((error) => logEvent('error', 'worker_outbox_tick_failed', errorMetadata(error))); }, 2_000);
  const receiptTimer = setInterval(() => { void exclusiveJob('push_receipts', 2026102403, processExpoPushReceipts).catch((error) => logEvent('error', 'worker_receipt_tick_failed', errorMetadata(error))); }, 5 * 60_000);
  const scheduleTimer = setInterval(() => { void exclusiveJob('schedule_horizon', 2026102405, extendAllScheduleHorizons).catch((error) => logEvent('error', 'worker_schedule_tick_failed', errorMetadata(error))); }, 10 * 60_000);
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    clearInterval(maintenanceTimer);
    clearInterval(pushTimer);
    clearInterval(receiptTimer);
    clearInterval(scheduleTimer);
    if (active) await active;
    await closeRedis();
    await sql.end();
    process.exit(0);
  };
  process.on('SIGTERM', () => { void shutdown(); });
  process.on('SIGINT', () => { void shutdown(); });
}

main().catch((error) => { logEvent('error', 'worker_start_failed', errorMetadata(error)); process.exitCode = 1; });
