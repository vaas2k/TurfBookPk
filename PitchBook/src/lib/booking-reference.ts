export function shortBookingReference(value: string | null | undefined): string {
  if (!value) return 'N/A';
  const normalized = value.replace(/[^a-z0-9]/gi, '').toUpperCase();
  return normalized.slice(-6) || 'N/A';
}
