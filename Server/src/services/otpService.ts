import { createHash, randomInt } from 'node:crypto';
import { env } from '../configs/env.js';
import { AppError } from '../helpers/errors.js';
import { AuthRepository } from '../database/authRepository.js';

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

const OTP_REQUEST_WINDOW_MS = 15 * 60_000;
const OTP_REQUEST_COOLDOWN_MS = 60_000;
const OTP_REQUEST_LIMIT = 5;
const OTP_VERIFICATION_LIMIT = 5;

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const local = digits.startsWith('92') ? digits.slice(2) : digits;
  if (!/^3\d{9}$/.test(local)) {
    throw new AppError('invalid_phone', 'Please enter a valid Pakistani phone number', 422);
  }
  return `92${local}`;
}

export class OtpService {
  constructor(private readonly repository: AuthRepository) {}

  async issue(phoneInput: string): Promise<void> {
    const phone = normalizePhone(phoneInput);
    const now = Date.now();
    const existing = await this.repository.getOtp(phone);
    const inCurrentWindow = Boolean(existing && now - existing.requestWindowStartedAt < OTP_REQUEST_WINDOW_MS);
    if (existing && now - existing.lastSentAt < OTP_REQUEST_COOLDOWN_MS) {
      throw new AppError('otp_request_too_soon', 'Please wait one minute before requesting another code', 429);
    }
    if (existing && inCurrentWindow && existing.requestCount >= OTP_REQUEST_LIMIT) {
      throw new AppError('too_many_otp_requests', 'Too many verification codes requested. Please try again later.', 429);
    }
    const code = env.otpFixedCode && env.nodeEnv !== 'production'
      ? env.otpFixedCode
      : String(randomInt(100000, 1000000));

    await this.repository.saveOtp({
      phone,
      codeHash: hash(code),
      expiresAt: now + env.otpTtlMinutes * 60_000,
      attempts: inCurrentWindow ? existing?.attempts || 0 : 0,
      requestCount: inCurrentWindow ? (existing?.requestCount || 0) + 1 : 1,
      requestWindowStartedAt: inCurrentWindow ? existing!.requestWindowStartedAt : now,
      lastSentAt: now,
    });

    if (env.nodeEnv !== 'production') {
      console.info('[OTP][development] Verification code issued');
    }
  }

  async verify(phoneInput: string, code: string): Promise<string> {
    const phone = normalizePhone(phoneInput);
    if (!/^\d{6}$/.test(code)) {
      throw new AppError('invalid_otp', 'Please enter a valid 6-digit verification code', 422);
    }

    const challenge = await this.repository.getOtp(phone);
    if (!challenge || challenge.expiresAt < Date.now()) {
      throw new AppError('otp_expired', 'This verification code has expired', 401);
    }
    if (challenge.attempts >= OTP_VERIFICATION_LIMIT) {
      throw new AppError('too_many_attempts', 'Too many verification attempts', 429);
    }

    challenge.attempts += 1;
    await this.repository.saveOtp(challenge);
    if (challenge.codeHash !== hash(code)) {
      throw new AppError('invalid_otp', 'The verification code is incorrect', 401);
    }

    await this.repository.deleteOtp(phone);
    return phone;
  }
}
