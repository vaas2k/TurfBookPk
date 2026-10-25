import 'dotenv/config';
import postgres from 'postgres';

const targetUrl = new URL(process.env.DATABASE_URL);
if (process.argv.includes('--loadtest')) {
  const name = decodeURIComponent(targetUrl.pathname.slice(1));
  targetUrl.pathname = `/${name.endsWith('_loadtest') ? name : `${name}_loadtest`}`;
}
const database = postgres(targetUrl.toString(), { max: 1, prepare: false });
try {
  const [row] = await database`
    SELECT count(*)::int AS eligible
    FROM slots AS slot
    WHERE slot.date < ((now() AT TIME ZONE 'Asia/Karachi')::date - 3)
      AND slot.is_booked = false AND slot.is_blocked = false AND slot.is_club_reserved = false
      AND slot.booking_id IS NULL AND slot.booked_by IS NULL
      AND slot.hold_booking_id IS NULL AND slot.held_by IS NULL AND slot.hold_expires_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM bookings AS booking WHERE booking.slot_id = slot.id)`;
  console.log(JSON.stringify({ database: targetUrl.pathname.slice(1), retention_days: 3, eligible_unbooked_slots: row.eligible }));
} finally { await database.end(); }
