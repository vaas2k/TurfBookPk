const ALLOWED_MAP_HOSTS = new Set([
  'google.com',
  'www.google.com',
  'maps.google.com',
  'maps.app.goo.gl',
  'goo.gl',
  'maps.apple.com',
]);

export type ResolvedMapLocation = { latitude: number; longitude: number; mapsUrl: string };

function validCoordinate(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function location(latitude: number, longitude: number): ResolvedMapLocation | null {
  if (!validCoordinate(latitude, longitude)) return null;
  return {
    latitude,
    longitude,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
  };
}

function pair(value: string | null): ResolvedMapLocation | null {
  if (!value) return null;
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch { /* URLSearchParams may already have decoded malformed input. */ }
  const match = /(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/.exec(decoded);
  return match ? location(Number(match[1]), Number(match[2])) : null;
}

function allowedMapUrl(value: string): URL {
  const url = new URL(value.trim());
  if (url.protocol !== 'https:' || !ALLOWED_MAP_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password) throw new Error('unsupported_map_link');
  return url;
}

export function coordinatesFromMapUrl(value: string): ResolvedMapLocation | null {
  let url: URL;
  try { url = allowedMapUrl(value); } catch { return null; }
  for (const name of ['query', 'q', 'll', 'center', 'coordinate', 'destination']) {
    const result = pair(url.searchParams.get(name));
    if (result) return result;
  }
  let decoded = url.toString();
  try { decoded = decodeURIComponent(decoded); } catch { /* Keep the safe URL string when percent encoding is malformed. */ }
  const at = /@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/.exec(decoded);
  if (at) return location(Number(at[1]), Number(at[2]));
  const data = /!3d(-?\d{1,2}(?:\.\d+)?)[^!]*!4d(-?\d{1,3}(?:\.\d+)?)/.exec(decoded);
  return data ? location(Number(data[1]), Number(data[2])) : null;
}

export async function resolveMapLink(value: string): Promise<ResolvedMapLocation | null> {
  let current = allowedMapUrl(value).toString();
  for (let redirect = 0; redirect <= 5; redirect += 1) {
    const direct = coordinatesFromMapUrl(current);
    if (direct) return direct;
    if (redirect === 5) return null;
    const response = await fetch(current, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(5_000), headers: { 'user-agent': 'TurfBookPK/1.0 map-link-resolver' } });
    await response.body?.cancel();
    const target = response.headers.get('location');
    if (!target || response.status < 300 || response.status >= 400) return coordinatesFromMapUrl(response.url);
    current = allowedMapUrl(new URL(target, current).toString()).toString();
  }
  return null;
}
