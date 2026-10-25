// Read-only representative plans against the isolated load-test database.
import 'dotenv/config';
import postgres from 'postgres';

const source = new URL(process.env.DATABASE_URL || '');
const name = decodeURIComponent(source.pathname.slice(1));
const target = name.endsWith('_loadtest') ? name : `${name}_loadtest`;
if (process.env.NODE_ENV === 'production' || !target.endsWith('_loadtest')) throw new Error('Requires an isolated load-test database');
source.pathname = `/${target}`;
const client = postgres(source.toString(), { max: 1, prepare: false });
const date = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
const page = await client.unsafe(`select id from grounds where is_active and is_verified order by rating desc, title, id limit 24`);
const pageIds = page.map(({ id }) => `'${id}'::uuid`).join(',');
const plans = {
  discovery: `select g.id from grounds g join vendors v on v.id = g.vendor_id where g.is_active and g.is_verified and g.verification_status = 'approved' and v.is_active and v.verification_status = 'approved' order by g.rating desc, g.title, g.id limit 24`,
  availability: `select ground_id, count(*) from slots where ground_id in (${pageIds}) and date >= current_date and not is_booked and not is_blocked and (hold_booking_id is null or hold_expires_at <= now()) group by ground_id`,
  dated_slots: `select ground_id, min(price) from slots where ground_id in (${pageIds}) and date = '${date}' and not is_booked and not is_blocked group by ground_id`,
  schedule_horizon: `select schedule_template_id, max(date) from slots where schedule_template_id in (select id from slot_schedule_templates where ground_id in (${pageIds}) and is_active) and date <= current_date + 39 group by schedule_template_id`,
  player_bookings: `select id from bookings where player_id = md5('loadtest-user-101')::uuid order by created_at desc, id desc limit 20`,
  notifications: `select id from notifications where user_id = md5('loadtest-user-101')::uuid order by created_at desc, id desc limit 20`,
  dashboard_gmv: `select count(*), sum(total_amount) from bookings where payment_status = 'paid'`,
};
const indexes = (node, result = new Set()) => {
  if (node['Index Name']) result.add(node['Index Name']);
  for (const child of node.Plans || []) indexes(child, result);
  return result;
};

try {
  for (const [name, statement] of Object.entries(plans)) {
    const rows = await client.unsafe(`explain (analyze, buffers, format json) ${statement}`);
    const report = rows[0]['QUERY PLAN'][0];
    console.log(JSON.stringify({ query: name, execution_ms: report['Execution Time'], rows: report.Plan['Actual Rows'], shared_hit_blocks: report.Plan['Shared Hit Blocks'], shared_read_blocks: report.Plan['Shared Read Blocks'], indexes: [...indexes(report.Plan)] }));
  }
} catch (error) {
  console.error('EXPLAIN failed:', error.code || error.message, error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
