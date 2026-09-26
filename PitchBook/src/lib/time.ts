/** Formats server HH:mm values for people, while keeping API values unchanged. */
export function formatTime12(value?: string | null): string {
  if (!value) return "";
  const [rawHour, rawMinute = "00"] = value.slice(0, 5).split(":");
  const hour = Number(rawHour);
  if (!Number.isFinite(hour)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return rawMinute === "00"
    ? `${displayHour} ${suffix}`
    : `${displayHour}:${rawMinute} ${suffix}`;
}

export function formatTimeRange12(
  start?: string | null,
  end?: string | null,
): string {
  return `${formatTime12(start)} - ${formatTime12(end)}`;
}

export function formatDuration(
  start?: string | null,
  end?: string | null,
): string {
  if (!start || !end) return "";
  const toMinutes = (value: string) => {
    const [hourText = "0", minuteText = "0"] = value.slice(0, 5).split(":");
    return Number(hourText) * 60 + Number(minuteText);
  };
  let minutes = toMinutes(end) - toMinutes(start);
  if (minutes <= 0) minutes += 24 * 60;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hour${hours === 1 ? "" : "s"}`;
}
