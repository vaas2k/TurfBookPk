import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./configs/env.js";
import { DrizzleAuthRepository } from "./database/drizzleAuthRepository.js";
import { databaseConstraintError, getErrorMessage, requestParsingError } from "./helpers/errors.js";
import { AuthController } from "./controllers/authController.js";
import { createAuthRouter } from "./router/authRoutes.js";
import { AuthService } from "./services/authService.js";
import { OtpService } from "./services/otpService.js";
import { TokenService } from "./services/tokenService.js";
import { VendorController } from './controllers/vendorController.js';
import { createVendorRouter } from './router/vendorRoutes.js';
import { GroundController } from './controllers/groundController.js';
import { createGroundRouter } from './router/groundRoutes.js';
import { BookingController } from './controllers/bookingController.js';
import { createBookingRouter } from './router/bookingRoutes.js';
import { requireJsonBody } from './middleware/requestValidation.js';
import { NotificationController } from './controllers/notificationController.js';
import { createNotificationRouter } from './router/notificationRoutes.js';
import { ReviewController } from './controllers/reviewController.js';
import { createReviewRouter } from './router/reviewRoutes.js';
import { MediaController } from './controllers/mediaController.js';
import { CloudinaryStorageProvider } from './services/cloudinaryStorageProvider.js';
import { createMediaRouter } from './router/mediaRoutes.js';
import { EngagementController } from './controllers/engagementController.js';
import { createEngagementRouter } from './router/engagementRoutes.js';
import { AdminController } from './controllers/adminController.js';
import { createAdminRouter } from './router/adminRoutes.js';
import { errorMetadata, logEvent } from './services/operationalLogger.js';
import { randomUUID } from 'node:crypto';
import { PaymentController } from './controllers/paymentController.js';
import { createPaymentRouter, createPublicPaymentRouter } from './router/paymentRoutes.js';
import { createRateLimiter } from './middleware/rateLimit.js';
import { connectRedis, closeRedis, redis } from './services/redisClient.js';
import { sql } from './database/client.js';

const app = express();
let shuttingDown = false;
if (env.trustProxyHops > 0) app.set('trust proxy', env.trustProxyHops);


app.use(helmet());
app.use(cors({
  origin: env.nodeEnv === 'production' ? env.frontendUrl : '*',
}));
app.use(express.json({ limit: '32kb', strict: true }));

app.use((request, response, next) => {
  const requestId = typeof request.headers['x-request-id'] === 'string' && request.headers['x-request-id'].length <= 128
    ? request.headers['x-request-id']
    : randomUUID();
  const startedAt = Date.now();
  response.locals.requestId = requestId;
  response.setHeader('X-Request-Id', requestId);
  response.on('finish', () => {
    const status = response.statusCode;
    logEvent(status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info', 'http_request', {
      request_id: requestId,
      method: request.method,
      path: request.path,
      status_code: status,
      duration_ms: Date.now() - startedAt,
    });
  });
  next();
});

const paymentController = new PaymentController();
const globalLimit = createRateLimiter({ windowMs: 60_000, maxRequests: 300, code: 'too_many_requests', message: 'Too many requests. Please slow down.' });
app.use('/api', (request, response, next) => request.path === '/health' || request.path === '/ready' ? next() : globalLimit(request, response, next));
app.use('/api/payments/clink/acknowledgment', createRateLimiter({ windowMs: 60_000, maxRequests: 120, code: 'too_many_acknowledgments', message: 'Too many acknowledgments.' }));
app.use('/api/payments', createPublicPaymentRouter(paymentController));

app.use((request, response, next) => {
  if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
    requireJsonBody(request, response, next);
    return;
  }
  next();
});

const repository = new DrizzleAuthRepository();
const otpService = new OtpService(repository);
const tokenService = new TokenService(repository);
const authService = new AuthService(repository, otpService, tokenService);
const authController = new AuthController(authService, tokenService);
const vendorController = new VendorController();
const groundController = new GroundController();
const bookingController = new BookingController();
const notificationController = new NotificationController();
const reviewController = new ReviewController();
const mediaController = new MediaController(new CloudinaryStorageProvider());
const engagementController = new EngagementController();
const adminController = new AdminController();

app.use('/api/auth', createAuthRouter(authController, tokenService));
app.use('/api/vendors', createVendorRouter(vendorController, tokenService));
app.use('/api/grounds', createGroundRouter(groundController, tokenService));
app.use('/api/bookings', createRateLimiter({ windowMs: 60_000, maxRequests: 60, code: 'too_many_booking_requests', message: 'Too many booking requests.' }), createBookingRouter(bookingController, tokenService));
app.use('/api/notifications', createNotificationRouter(notificationController, tokenService));
app.use('/api/reviews', createReviewRouter(reviewController, tokenService));
app.use('/api/media', createRateLimiter({ windowMs: 60_000, maxRequests: 30, code: 'too_many_upload_requests', message: 'Too many upload requests.' }), createMediaRouter(mediaController, tokenService));
app.use('/api/engagement', createEngagementRouter(engagementController, tokenService));
app.use('/api/payments', createRateLimiter({ windowMs: 60_000, maxRequests: 60, code: 'too_many_payment_requests', message: 'Too many payment requests.' }), createPaymentRouter(paymentController, tokenService));
app.use('/api/admin', createRateLimiter({ windowMs: 60_000, maxRequests: 120, code: 'too_many_admin_requests', message: 'Too many admin requests.' }), createAdminRouter(adminController, tokenService));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "API is running"
  });
});
app.get('/api/ready', async (_req, res) => {
  if (shuttingDown) return void res.status(503).json({ status: 'shutting_down' });
  try {
    await sql`SELECT expiry_retry_count FROM payment_attempts LIMIT 0`;
    await sql`SELECT id FROM notification_outbox LIMIT 0`;
    if (redis && !redis.isReady) throw new Error('Redis is not ready');
    res.json({ status: 'ready', postgres: 'ok', redis: redis ? 'ok' : 'local_only' });
  } catch { res.status(503).json({ status: 'not_ready' }); }
});
app.get("/api/test", async (_req, res) => {
  res.json({
    status: "ok",
    message: "Test endpoint is working"
  });
});

app.use((error: unknown, request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const normalizedError = requestParsingError(error) || databaseConstraintError(error) || error;
  const statusCode = typeof normalizedError === 'object' && normalizedError !== null && 'statusCode' in normalizedError
    ? Number(normalizedError.statusCode)
    : 500;
  const requestId = response.locals.requestId as string | undefined;
  const errorCode = typeof normalizedError === 'object' && normalizedError !== null && 'code' in normalizedError ? String(normalizedError.code) : 'internal_error';
  const nextActionByCode: Record<string, string> = {
    payment_provider_unavailable: 'Configure PAYMENT_PROVIDER=clink and the Clink sandbox credentials, then restart the API.',
    payment_provider_auth_failed: 'Verify the Clink sandbox username, password, token URL, and token HTTP method with the provider.',
    payment_provider_error: 'Share the request ID, UTC timestamp, endpoint, and HTTP status with Clink support.',
    payment_provider_invalid_response: 'Share the request ID and UTC timestamp with Clink; their response did not match the documented JSON contract.',
    payment_provider_unknown: 'Do not retry automatically. Check the admin manual-review queue and ask Clink whether a reference was created.',
    payment_reference_rejected: 'Correct the payer/reference fields described in the message, then retry checkout.',
    payment_reference_expiration_failed: 'Do not release the slot manually. Check Clink connectivity; TurfBookPK will retry expiration safely.',
    payment_under_review: 'Do not regenerate. Check the admin manual-review queue using the payment attempt ID.',
    payment_hold_expired: 'Return to the ground and select the slot again.',
    billing_identity_in_use: 'Sign in to the account already linked to this CNIC or contact TurfBookPK support.',
    invalid_billing_profile: 'Correct the highlighted payment-profile information and submit it again.',
    sandbox_simulation_disabled: 'Enable the explicit sandbox acknowledgment flag only in a local or sandbox environment.',
  };
  const nextAction = nextActionByCode[errorCode] || (statusCode >= 500 ? 'Retry once. If it fails again, share the request ID and UTC timestamp with TurfBookPK support.' : 'Correct the request and try again.');
  logEvent(statusCode >= 500 ? 'error' : 'warn', 'http_error', {
    request_id: requestId,
    method: request.method,
    path: request.path,
    status_code: statusCode,
    ...errorMetadata(normalizedError),
  });
  response.status(statusCode).json({
    error: {
      code: errorCode,
      message: statusCode === 500 ? 'An unexpected server error occurred' : getErrorMessage(normalizedError),
      next_action: nextAction,
      workflow_stage: request.path.startsWith('/api/payments') ? 'payment_request_failed' : 'request_failed',
      request_id: requestId,
    },
  });
});

connectRedis().then(() => {
  const server = app.listen(env.port, () => logEvent('info', 'server_started', { port: env.port, environment: env.nodeEnv, timezone: 'Asia/Karachi' }));
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    logEvent('info', 'server_shutdown_started', { grace_ms: env.shutdownGraceMs });
    const deadline = setTimeout(() => {
      logEvent('error', 'server_shutdown_grace_exceeded');
      server.closeAllConnections();
    }, env.shutdownGraceMs);
    deadline.unref();
    server.close((error) => {
      clearTimeout(deadline);
      if (error) logEvent('error', 'server_close_failed', errorMetadata(error));
      void Promise.all([closeRedis(), sql.end()]).then(() => {
        logEvent('info', 'server_shutdown_completed');
        process.exitCode = error ? 1 : 0;
      }).catch((closeError) => {
        logEvent('error', 'server_resource_close_failed', errorMetadata(closeError));
        process.exitCode = 1;
      });
    });
    server.closeIdleConnections();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}).catch((error) => { logEvent('error', 'server_start_failed', errorMetadata(error)); process.exitCode = 1; });
