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

const accessTokenTtl = process.env.JWT_ACCESS_TTL || '15m';

export const env = {
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8081',
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  databaseUrl: process.env.DATABASE_URL || 'postgres://turfbookpk:turfbookpk@172.17.0.2:5432/turfbookpk',
  jwtAccessSecret: requiredSecret('JWT_ACCESS_SECRET', 'development-access-secret-change-me'),
  accessTokenTtl,
  accessTokenSeconds: durationSeconds(accessTokenTtl),
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS) || 30,
  otpTtlMinutes: Number(process.env.OTP_TTL_MINUTES) || 5,
  otpFixedCode: process.env.AUTH_OTP_FIXED_CODE,
  platformCommissionBps: integerInRange('PLATFORM_COMMISSION_BPS', 0, 0, 10_000),
};
