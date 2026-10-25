type LogLevel = "info" | "warn" | "error";

const sensitiveKey = /(authorization|cookie|token|otp|phone|cnic|iban|account|password|secret|refresh)/i;
const phonePattern = /(?:\+?92|0)3\d{9}\b/g;
const cnicPattern = /\b\d{5}-?\d{7}-?\d\b/g;
const ibanPattern = /\bPK\d{2}[A-Z0-9]{20}\b/gi;
const jwtPattern = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const bearerPattern = /Bearer\s+[^\s,;]+/gi;
const expoTokenPattern = /(?:Expo|Exponent)PushToken\[[^\]]+\]/gi;

function redactText(value: string): string {
  return value
    .replace(bearerPattern, 'Bearer [redacted]')
    .replace(jwtPattern, '[redacted-jwt]')
    .replace(expoTokenPattern, '[redacted-push-token]')
    .replace(cnicPattern, '[redacted-cnic]')
    .replace(ibanPattern, '[redacted-iban]')
    .replace(phonePattern, '[redacted-phone]');
}

export function redactOperationalData(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redactOperationalData(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key, sensitiveKey.test(key) ? "[redacted]" : redactOperationalData(item, depth + 1),
    ]),
  );
}

export function logEvent(level: LogLevel, event: string, fields: Record<string, unknown> = {}): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(redactOperationalData(fields) as Record<string, unknown>),
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export function errorMetadata(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const candidate = error as Error & { code?: string; statusCode?: number };
    return {
      error_name: candidate.name,
      error_code: candidate.code,
      error_status: candidate.statusCode,
      error_message: candidate.message,
      error_stack: candidate.stack,
    };
  }
  return { error_name: "UnknownError" };
}
