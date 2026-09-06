import 'dotenv/config';

const isProduction = process.env.NODE_ENV === 'production';

function requiredSecret(name: string, developmentFallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProduction) throw new Error(`${name} must be configured in production`);
  return developmentFallback;
}

export const env = {
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8081',
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  databaseUrl: process.env.DATABASE_URL || 'postgres://turfbookpk:turfbookpk@172.17.0.2:5432/turfbookpk',
  jwtAccessSecret: requiredSecret('JWT_ACCESS_SECRET', 'development-access-secret-change-me'),
  accessTokenTtl: process.env.JWT_ACCESS_TTL || '15m',
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS) || 30,
  otpTtlMinutes: Number(process.env.OTP_TTL_MINUTES) || 5,
  otpFixedCode: process.env.AUTH_OTP_FIXED_CODE,
};