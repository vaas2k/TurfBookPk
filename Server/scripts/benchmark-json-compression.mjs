import { gzipSync, brotliCompressSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';

const url = process.argv[2];
if (!url || !/^https?:\/\/[^\s]+$/.test(url)) {
  throw new Error('Usage: node scripts/benchmark-json-compression.mjs <public API URL>');
}
const parsed = new URL(url);
if (!/^\/api\/grounds(?:\/|\?|$)/.test(parsed.pathname) || /\/slots(?:\/|$)/.test(parsed.pathname)) {
  throw new Error('Use a public ground discovery or metadata URL, not a private or live-slot endpoint');
}

const response = await fetch(url, { headers: { 'Accept-Encoding': 'identity' }, signal: AbortSignal.timeout(10_000) });
if (!response.ok) throw new Error(`Sample request returned HTTP ${response.status}`);
if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Sample response is not JSON');
const data = Buffer.from(await response.arrayBuffer());
if (data.length > 2_000_000) throw new Error('Sample exceeds the 2 MB benchmark limit');

function measure(compress) {
  const started = performance.now();
  let output;
  for (let index = 0; index < 100; index += 1) output = compress(data);
  return { bytes: output.length, ratio: Number((output.length / data.length).toFixed(3)), mean_cpu_ms: Number(((performance.now() - started) / 100).toFixed(3)) };
}

console.log(JSON.stringify({ url: parsed.origin + parsed.pathname, original_bytes: data.length, gzip: measure((input) => gzipSync(input, { level: 5 })), brotli: measure((input) => brotliCompressSync(input)) }, null, 2));
