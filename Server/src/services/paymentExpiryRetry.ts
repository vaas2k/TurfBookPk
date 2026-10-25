export const MAX_EXPIRY_ATTEMPTS = 6;

export function expiryRetryDelayMs(attempt: number): number {
  return Math.min(60_000 * 2 ** Math.max(0, attempt - 1), 30 * 60_000);
}
