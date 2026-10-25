import 'dotenv/config';
import postgres from 'postgres';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const db = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
try {
  const [row] = await db.unsafe("select coalesce(g.cover_image, g.images[1]) as image_url from grounds g join vendors v on v.id = g.vendor_id where g.is_active and g.is_verified and g.verification_status = 'approved' and v.is_active and v.verification_status = 'approved' and coalesce(g.cover_image, g.images[1]) like 'https://res.cloudinary.com/%' limit 1");
  if (!row?.image_url) {
    console.log(JSON.stringify({ checked: false, reason: 'No approved ground with a Cloudinary public image' }));
    process.exitCode = 0;
  } else {
    const url = new URL(row.image_url);
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') throw new Error('Sample public image is not hosted on Cloudinary');
    const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10_000) });
    console.log(JSON.stringify({ checked: true, host: url.hostname, status: response.status, cache_control: response.headers.get('cache-control'), etag_present: Boolean(response.headers.get('etag')) }));
    if (!response.ok || !response.headers.get('cache-control')) process.exitCode = 1;
  }
} finally {
  await db.end();
}
