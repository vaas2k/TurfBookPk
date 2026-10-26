import postgres from 'postgres';

const rawApiUrl = process.env.STAGING_API_URL;
if (!rawApiUrl) throw new Error('Set STAGING_API_URL to the staging API origin');
const origin = new URL(rawApiUrl);
if (origin.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(origin.hostname)) throw new Error('Staging API must use HTTPS');
const base = `${origin.origin}/api`;

async function get(path, headers = {}) {
  return fetch(`${base}${path}`, { headers, signal: AbortSignal.timeout(10_000) });
}

const health = await get('/health');
const ready = await get('/ready');
if (!health.ok || !ready.ok) throw new Error(`Staging health/readiness failed: ${health.status}/${ready.status}`);

const discovery = await get('/grounds?limit=24', { 'Accept-Encoding': 'gzip' });
if (!discovery.ok || discovery.headers.get('cache-control') !== 'no-store') throw new Error('Staging discovery is unavailable or cacheable');
const compressed = discovery.headers.get('content-encoding') === 'gzip';
const body = await discovery.json();
if (!Array.isArray(body.grounds)) throw new Error('Staging discovery response is invalid');
const bodyBytes = Buffer.byteLength(JSON.stringify(body));

const groundId = process.env.STAGING_PUBLIC_GROUND_ID || body.grounds[0]?.id;
let metadataChecked = false;
if (groundId) {
  const first = await get(`/grounds/${encodeURIComponent(groundId)}/metadata`);
  const etag = first.headers.get('etag');
  if (!first.ok || !etag) throw new Error('Staging metadata ETag is missing');
  const second = await get(`/grounds/${encodeURIComponent(groundId)}/metadata`, { 'If-None-Match': etag });
  if (second.status !== 304) throw new Error(`Staging conditional metadata returned ${second.status}, expected 304`);
  metadataChecked = true;
}

const result = { api_ready: true, discovery_no_store: true, gzip: compressed, gzip_required: bodyBytes >= 1024, metadata_etag_304: metadataChecked, database: null };
if (process.env.STAGING_DIRECT_DATABASE_URL) {
  const db = postgres(process.env.STAGING_DIRECT_DATABASE_URL, { max: 1, prepare: false, connect_timeout: 5 });
  try {
    const [settings] = await db`SELECT current_setting('max_connections') AS max_connections, current_setting('log_min_duration_statement') AS slow_query_threshold, current_setting('log_parameter_max_length') AS logged_parameter_length`;
    result.database = { max_connections: Number(settings.max_connections), slow_query_threshold: settings.slow_query_threshold, logged_parameter_length: Number(settings.logged_parameter_length) };
    if (result.database.logged_parameter_length !== 0) throw new Error('Staging PostgreSQL may log query parameter values');
  } finally {
    await db.end();
  }
}
console.log(JSON.stringify(result, null, 2));
if (!compressed && bodyBytes >= 1024) process.exitCode = 1;
