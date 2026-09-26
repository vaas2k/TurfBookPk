/** Formats server HH:mm values for people, while keeping API values unchanged. */
export function formatTime12(value?: string | null): string {
  if (!value) return '';
  const [rawHour, rawMinute = '00'] = value.slice(0, 5).split(':');
  const hour = Number(rawHour);
  if (!Number.isFinite(hour)) return value;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return rawMinute === '00' ? `${displayHour} ${suffix}` : `${displayHour}:${rawMinute} ${suffix}`;
}

export function formatTimeRange12(start?: string | null, end?: string | null): string {
  return `${formatTime12(start)} - ${formatTime12(end)}`;
}
