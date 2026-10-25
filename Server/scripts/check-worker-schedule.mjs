import 'dotenv/config';

const source = new URL(process.env.DATABASE_URL || '');
const name = decodeURIComponent(source.pathname.slice(1));
if (process.env.NODE_ENV === 'production') throw new Error('Schedule check is forbidden in production');
source.pathname = `/${name.endsWith('_loadtest') ? name : `${name}_loadtest`}`;
process.env.DATABASE_URL = source.toString();
process.env.MAX_ADVANCE_BOOKING_DAYS = '39';

const [{ extendAllScheduleHorizons }, { sql }] = await Promise.all([
  import('../dist/services/scheduleMaterialization.js'),
  import('../dist/database/client.js'),
]);
try {
  console.log(JSON.stringify(await extendAllScheduleHorizons()));
} finally {
  await sql.end();
}
