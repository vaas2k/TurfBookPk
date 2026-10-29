export function shouldLogHttpRequest(
  status: number,
  durationMs: number,
  successSampleRate: number,
  random: () => number = Math.random,
): boolean {
  // Failures and slow requests are operational evidence and are never sampled.
  if (status >= 400 || durationMs >= 1_000) return true;
  if (successSampleRate >= 1) return true;
  if (successSampleRate <= 0) return false;
  return random() < successSampleRate;
}
