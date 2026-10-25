import 'dotenv/config';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import postgres from 'postgres';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const database = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
const rows = await database.unsafe("select g.id, g.vendor_id from grounds g join vendors v on v.id = g.vendor_id where g.is_active and g.is_verified and g.verification_status = 'approved' and v.is_active and v.verification_status = 'approved' limit 1");
if (!rows[0]) throw new Error('A public approved ground is required for this read-only smoke test');
const originalRevision = Number((await database`SELECT revision FROM public_ground_catalog_revision WHERE id = 1`)[0].revision);
const rollbackProbe = new Error('rollback_revision_probe');
try {
  await database.begin(async (tx) => {
    await tx`UPDATE grounds SET updated_at = updated_at WHERE id = ${rows[0].id}`;
    await tx`UPDATE vendors SET is_active = is_active WHERE id = ${rows[0].vendor_id}`;
    const insideRevision = Number((await tx`SELECT revision FROM public_ground_catalog_revision WHERE id = 1`)[0].revision);
    if (insideRevision !== originalRevision + 2) throw new Error('Ground/vendor triggers did not bump the catalog revision');
    throw rollbackProbe;
  });
} catch (error) {
  if (error !== rollbackProbe) throw error;
}
const restoredRevision = Number((await database`SELECT revision FROM public_ground_catalog_revision WHERE id = 1`)[0].revision);
if (restoredRevision !== originalRevision) throw new Error('Revision probe did not roll back');
await database.end();

const portServer = createServer();
await new Promise((resolve) => portServer.listen(0, '127.0.0.1', resolve));
const port = portServer.address().port;
await new Promise((resolve) => portServer.close(resolve));
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['dist/server.js'], { env: { ...process.env, PORT: String(port) }, stdio: process.env.CACHE_SMOKE_DEBUG ? 'inherit' : 'ignore' });
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Temporary API exited with code ${server.exitCode}`);
    try {
      const health = await fetch(`${base}/api/ready`, { signal: AbortSignal.timeout(500) });
      if (health.ok) { ready = true; break; }
    } catch { /* server is starting */ }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  if (!ready) throw new Error('API did not become ready');

  const metadataUrl = `${base}/api/grounds/${rows[0].id}/metadata`;
  const first = await fetch(metadataUrl);
  const etag = first.headers.get('etag');
  if (!first.ok || !etag || !(await first.json()).ground?.id) throw new Error('Metadata response or ETag is missing');
  const second = await fetch(metadataUrl, { headers: { 'If-None-Match': etag } });
  if (second.status !== 304) throw new Error(`Expected metadata 304; got ${second.status}`);
  const detail = await fetch(`${base}/api/grounds/${rows[0].id}`);
  if (!detail.ok || detail.headers.get('cache-control') !== 'no-store') throw new Error('Ground detail must remain live and no-store');
  const discovery = await fetch(`${base}/api/grounds?limit=1`);
  if (!discovery.ok || discovery.headers.get('cache-control') !== 'no-store') throw new Error('Discovery must remain live and no-store');
  const compressed = await fetch(`${base}/api/grounds?limit=24`, { headers: { 'Accept-Encoding': 'gzip' } });
  if (!compressed.ok || (process.env.API_COMPRESSION !== 'false' && compressed.headers.get('content-encoding') !== 'gzip')) throw new Error(`Public discovery gzip response is missing: HTTP ${compressed.status}, encoding ${compressed.headers.get('content-encoding')}, length ${compressed.headers.get('content-length')}`);
  console.log(JSON.stringify({ metadata_etag: true, conditional_304: true, dynamic_no_store: true, gzip: compressed.headers.get('content-encoding') === 'gzip' }));
  const compression = execFileSync(process.execPath, ['scripts/benchmark-json-compression.mjs', `${base}/api/grounds?limit=24`], { encoding: 'utf8' });
  console.log(compression.trim());
  if (process.env.API_COMPRESSION !== 'false') {
    const stagingCheck = execFileSync(process.execPath, ['scripts/check-staging-day3.mjs'], { encoding: 'utf8', env: { ...process.env, STAGING_API_URL: base } });
    console.log(stagingCheck.trim());
  }
} finally {
  server.kill();
}
