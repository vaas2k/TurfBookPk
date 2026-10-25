// Build first, then run this against a migrated development/staging database.
import 'dotenv/config';
if (process.argv.includes('--loadtest')) {
  const url = new URL(process.env.DATABASE_URL);
  if (!url.pathname.endsWith('_loadtest')) url.pathname += '_loadtest';
  process.env.DATABASE_URL = url.toString();
}
const [{ GroundController }, { AdminController }, { sql }] = await Promise.all([
  import('../dist/controllers/groundController.js'),
  import('../dist/controllers/adminController.js'),
  import('../dist/database/client.js'),
]);

async function invoke(action, request) {
  let payload;
  await action(request, { json(value) { payload = value; } });
  if (!payload) throw new Error('Controller did not return JSON');
  return payload;
}

try {
  const controller = new GroundController();
  const discovery = await invoke(controller.listPublic, { query: { page: '1', limit: '2' } });
  if (!Array.isArray(discovery.grounds) || discovery.grounds.length > 2 || !discovery.pagination) throw new Error('Discovery response mismatch');
  const date = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
  const dated = await invoke(controller.listPublic, { query: { page: '1', limit: '2', availability_date: date } });
  if (!Array.isArray(dated.grounds) || dated.grounds.length > 2) throw new Error('Dated discovery response mismatch');
  for (const sort of ['price_low', 'price_high']) {
    const priced = await invoke(controller.listPublic, { query: { page: '1', limit: '2', availability_date: date, max_price: '2000', sort } });
    if (!Array.isArray(priced.grounds) || priced.grounds.length > 2 || !priced.pagination) throw new Error(`${sort} response mismatch`);
  }
  if (discovery.grounds[0]) {
    const detail = await invoke(controller.getPublic, { params: { id: discovery.grounds[0].id } });
    if (!detail.ground || !Array.isArray(detail.slots)) throw new Error('Ground detail response mismatch');
  }
  const admin = new AdminController();
  const dashboard = await invoke(admin.dashboard, {});
  if (!dashboard.analytics || !dashboard.counts) throw new Error('Admin dashboard response mismatch');
  const operations = await invoke(admin.operations, {});
  if (!operations.analytics) throw new Error('Admin operations response mismatch');
  console.log('Discovery, dated discovery, ground detail, and dashboard queries passed.');
} catch (error) {
  console.error('Scalability query smoke failed:', error.cause?.code || error.code || '', error.cause?.message || error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
