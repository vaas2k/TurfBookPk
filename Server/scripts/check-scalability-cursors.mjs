import 'dotenv/config';
const url = new URL(process.env.DATABASE_URL || '');
if (!url.pathname.endsWith('_loadtest')) url.pathname += '_loadtest';
process.env.DATABASE_URL = url.toString();
const [{ BookingController }, { NotificationController }, { AdminController }, { sql }] = await Promise.all([
  import('../dist/controllers/bookingController.js'),
  import('../dist/controllers/notificationController.js'),
  import('../dist/controllers/adminController.js'),
  import('../dist/database/client.js'),
]);

async function request(action, query, userId) {
  let output;
  await action({ query, auth: { userId } }, { json(value) { output = value; } });
  return output;
}
async function check(name, action, key, userId) {
  const first = await request(action, { limit: '2' }, userId);
  if (first[key].length !== 2 || !first.pagination.next_cursor) throw new Error(`${name}: first cursor missing`);
  const second = await request(action, { limit: '2', cursor: first.pagination.next_cursor }, userId);
  const previous = new Set(first[key].map((row) => row.id));
  if (!second[key].length || second[key].some((row) => previous.has(row.id))) throw new Error(`${name}: repeated or missing rows`);
  console.log(`${name}: cursor advanced without duplicates`);
}

try {
  const [player] = await sql.unsafe("select md5('loadtest-user-101')::uuid as id");
  const [vendor] = await sql.unsafe("select md5('loadtest-user-1')::uuid as id");
  const booking = new BookingController();
  await check('player bookings', booking.playerList, 'bookings', player.id);
  await check('vendor bookings', booking.vendorList, 'bookings', vendor.id);
  await check('notifications', new NotificationController().list, 'notifications', player.id);
  await check('admin transactions', new AdminController().listTransactions, 'transactions', vendor.id);
} catch (error) {
  console.error('Cursor smoke failed:', error.cause?.message || error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
