import 'dotenv/config';

const isProduction = process.env.NODE_ENV === 'production';

function requiredSecret(name: string, developmentFallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProduction) throw new Error(`${name} must be configured in production`);
  return developmentFallback;
}

function durationSeconds(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  if (!match) throw new Error('JWT_ACCESS_TTL must use a positive duration such as 900s, 15m, 1h, or 1d');
  const amount = Number(match[1]);
  const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[match[2] as 's' | 'm' | 'h' | 'd'];
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('JWT_ACCESS_TTL must be a positive duration');
  return amount * multiplier;
}

function integerInRange(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

function numberInRange(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be a number between ${minimum} and ${maximum}`);
  }
  return value;
}

function booleanValue(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`${name} must be true or false`);
}

const accessTokenTtl = process.env.JWT_ACCESS_TTL || '15m';

function allowedFrontendOrigins(): string[] {
  const raw = process.env.FRONTEND_ORIGINS || process.env.FRONTEND_URL || '';
  if (!raw && isProduction) throw new Error('FRONTEND_ORIGINS is required in production');
  return raw.split(',').map((value) => value.trim()).filter(Boolean).map((value) => {
    const url = new URL(value);
    if (url.origin !== value.replace(/\/$/, '') || (isProduction && url.protocol !== 'https:')) {
      throw new Error('FRONTEND_ORIGINS must contain HTTPS origins without paths or wildcards');
    }
    return url.origin;
  });
}

export const env = {
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8081',
  frontendOrigins: allowedFrontendOrigins(),
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  databaseUrl: process.env.DATABASE_URL || 'postgres://turfbookpk:turfbookpk@172.17.0.2:5432/turfbookpk',
  dbPoolMode: process.env.DB_POOL_MODE || 'direct',
  dbPoolMax: integerInRange('DB_POOL_MAX', isProduction ? 10 : 3, 1, 50),
  dbConnectTimeoutSeconds: integerInRange('DB_CONNECT_TIMEOUT_SECONDS', 5, 1, 60),
  dbIdleTimeoutSeconds: integerInRange('DB_IDLE_TIMEOUT_SECONDS', 30, 1, 600),
  dbStatementTimeoutMs: integerInRange('DB_STATEMENT_TIMEOUT_MS', 15_000, 1_000, 120_000),
  dbLockTimeoutMs: integerInRange('DB_LOCK_TIMEOUT_MS', 10_000, 1_000, 120_000),
  shutdownGraceMs: integerInRange('SHUTDOWN_GRACE_MS', 30_000, 5_000, 120_000),
  apiCompression: booleanValue('API_COMPRESSION', true),
  httpSuccessLogSampleRate: numberInRange('HTTP_SUCCESS_LOG_SAMPLE_RATE', 1, 0, 1),
  redisUrl: process.env.REDIS_URL || '',
  trustProxyHops: integerInRange('TRUST_PROXY_HOPS', 0, 0, 8),
  metricsToken: process.env.METRICS_TOKEN || '',
  loadTestRateLimitBypass: booleanValue('ALLOW_LOADTEST_RATE_LIMIT_BYPASS'),
  jwtAccessSecret: requiredSecret('JWT_ACCESS_SECRET', 'development-access-secret-change-me'),
  accessTokenTtl,
  accessTokenSeconds: durationSeconds(accessTokenTtl),
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS) || 30,
  otpTtlMinutes: Number(process.env.OTP_TTL_MINUTES) || 5,
  otpFixedCode: process.env.AUTH_OTP_FIXED_CODE,
  platformCommissionBps: integerInRange('PLATFORM_COMMISSION_BPS', 0, 0, 10_000),
  maxSlotDurationMinutes: integerInRange('MAX_SLOT_DURATION_MINUTES', 240, 30, 1_440),
  maxAdvanceBookingDays: integerInRange('MAX_ADVANCE_BOOKING_DAYS', 90, 1, 365),
  recurringPaymentOpensBeforeMinutes: integerInRange('RECURRING_PAYMENT_OPENS_BEFORE_MINUTES', 120, 30, 1_440),
  recurringPaymentWindowMinutes: integerInRange('RECURRING_PAYMENT_WINDOW_MINUTES', 30, 5, 240),
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
  sensitiveDataHmacSecret: requiredSecret('SENSITIVE_DATA_HMAC_SECRET', 'development-sensitive-data-hmac-secret-change-me'),
  payoutEncryptionKey: requiredSecret('PAYOUT_ENCRYPTION_KEY', 'development-payout-encryption-key-change-me'),
  paymentProvider: process.env.PAYMENT_PROVIDER || 'mock',
  paymentEnvironment: process.env.PAYMENT_ENVIRONMENT || 'sandbox',
  paymentPiiEncryptionKey: requiredSecret('PAYMENT_PII_ENCRYPTION_KEY', 'development-payment-pii-key-change-me'),
  paymentPiiHmacSecret: requiredSecret('PAYMENT_PII_HMAC_SECRET', 'development-payment-pii-hmac-change-me'),
  paymentHoldMinutes: integerInRange('PAYMENT_HOLD_MINUTES', 15, 5, 120),
  minimumBookingLeadMinutes: integerInRange('MINIMUM_BOOKING_LEAD_MINUTES', 45, 0, 1_440),
  clinkTokenUrl: process.env.CLINK_TOKEN_URL || 'https://kaizenhive.com/Sandboxapi/Token',
  clinkGenerateUrl: process.env.CLINK_GENERATE_URL || 'https://kaizenhive.com/Sandboxapi/api/CLINK/CLIENT/Generate_ClinkID',
  clinkExpireUrl: process.env.CLINK_EXPIRE_URL || 'https://kaizenhive.com/Sandboxapi/api/CLINK/CLIENT/Mark_1Bill_Expired',
  clinkUsername: process.env.CLINK_USERNAME || '',
  clinkPassword: process.env.CLINK_PASSWORD || '',
  clinkClientId: integerInRange('CLINK_CLIENT_ID', 1050, 1, 2_147_483_647),
  clinkChallanId: integerInRange('CLINK_CHALLAN_ID', 105001, 1, 2_147_483_647),
  clinkMasterCategory: integerInRange('CLINK_MASTER_CATEGORY', 1050010101, 1, 2_147_483_647),
  clinkChallanCategory: Number(process.env.CLINK_CHALLAN_CATEGORY || '105001010101'),
  clinkAmountHeadId: integerInRange('CLINK_AMOUNT_HEAD_ID', 105001001, 1, 2_147_483_647),
  clinkAmountHeadTitle: process.env.CLINK_AMOUNT_HEAD_TITLE || 'Turf Booking Fee',
  clinkConsumerId: integerInRange('CLINK_CONSUMER_ID', 77, 1, 2_147_483_647),
  clinkBillerPrefix: process.env.CLINK_BILLER_PREFIX || '100806',
  clinkAllowUnverifiedSandboxAck: booleanValue('CLINK_ALLOW_UNVERIFIED_SANDBOX_ACK'),
};

if (isProduction && !env.redisUrl) throw new Error('REDIS_URL is required in production for shared rate limiting');
if (env.metricsToken && env.metricsToken.length < 32) throw new Error('METRICS_TOKEN must contain at least 32 characters');
if (env.redisUrl && !/^rediss?:\/\//.test(env.redisUrl)) throw new Error('REDIS_URL must start with redis:// or rediss://');
if (env.dbLockTimeoutMs > env.dbStatementTimeoutMs) throw new Error('DB_LOCK_TIMEOUT_MS must not exceed DB_STATEMENT_TIMEOUT_MS');
if (!['direct', 'session', 'transaction'].includes(env.dbPoolMode)) throw new Error('DB_POOL_MODE must be direct, session, or transaction');
if (env.loadTestRateLimitBypass && (isProduction || !/_loadtest(?:\?|$)/.test(env.databaseUrl))) throw new Error('Rate-limit bypass is allowed only on a non-production _loadtest database');

if (!['mock', 'clink'].includes(env.paymentProvider)) throw new Error('PAYMENT_PROVIDER must be mock or clink');
if (!['sandbox', 'live'].includes(env.paymentEnvironment)) throw new Error('PAYMENT_ENVIRONMENT must be sandbox or live');
if (isProduction && env.paymentProvider === 'mock') throw new Error('Mock payments are forbidden in production');
if (env.paymentProvider === 'clink') {
  if (!env.clinkUsername || !env.clinkPassword) throw new Error('CLINK_USERNAME and CLINK_PASSWORD are required for Clink');
  if (!/^\d{6}$/.test(env.clinkBillerPrefix)) throw new Error('CLINK_BILLER_PREFIX must contain exactly 6 digits');
  if (!Number.isSafeInteger(env.clinkChallanCategory) || env.clinkChallanCategory <= 0) throw new Error('CLINK_CHALLAN_CATEGORY must be a positive whole number');
  if (env.paymentEnvironment === 'live' && env.clinkAllowUnverifiedSandboxAck) throw new Error('Unsigned Clink acknowledgments are forbidden in live mode');
  if (env.paymentEnvironment === 'live' && /sandbox/i.test(`${env.clinkTokenUrl} ${env.clinkGenerateUrl} ${env.clinkExpireUrl}`)) throw new Error('Sandbox Clink URLs are forbidden in live mode');
  if (env.paymentEnvironment === 'live') throw new Error('Clink live payments are blocked until signed callbacks, expiry, fees, refunds, and settlement are documented');
}
