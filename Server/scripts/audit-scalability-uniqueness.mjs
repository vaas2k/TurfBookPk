import 'dotenv/config';
import postgres from 'postgres';

const url = new URL(process.env.DATABASE_URL || '');
if (process.argv.includes('--loadtest') && !url.pathname.endsWith('_loadtest')) url.pathname += '_loadtest';
const database = postgres(url.toString(), { max: 1 });
try {
  const [blackouts, templates] = await Promise.all([
    database`select count(*)::int as total from (select ground_id, date from ground_blackout_dates group by ground_id, date having count(*) > 1) duplicates`,
    database`select count(*)::int as total from (select ground_id, start_time, end_time from slot_schedule_templates group by ground_id, start_time, end_time having count(*) > 1) duplicates`,
  ]);
  console.log(JSON.stringify({ database: decodeURIComponent(url.pathname.slice(1)), duplicate_blackout_dates: blackouts[0].total, duplicate_schedule_templates: templates[0].total }));
  if (blackouts[0].total || templates[0].total) process.exitCode = 1;
} finally {
  await database.end();
}
