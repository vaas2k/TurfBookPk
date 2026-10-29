import 'dotenv/config';
import postgres from 'postgres';

const url = new URL(process.env.DATABASE_URL || '');
const databaseName = decodeURIComponent(url.pathname.slice(1));
if (process.env.NODE_ENV === 'production' || process.env.ALLOW_SCALABILITY_SEED !== 'true' || !/_(loadtest|staging)$/.test(databaseName)) {
  throw new Error('Refusing to seed: use a separate *_loadtest or *_staging database, NODE_ENV!=production, and ALLOW_SCALABILITY_SEED=true');
}

const small = process.argv.includes('--small');
const players = small ? 300 : 10_000;
const vendorCount = small ? 10 : 100;
const groundCount = small ? 30 : 1_000;
const days = small ? 10 : 50;
const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, idle_timeout: 20 });
const run = async (name, query) => {
  const start = Date.now();
  await client.unsafe(query);
  console.log(`${name}: ${((Date.now() - start) / 1000).toFixed(1)}s`);
};

try {
  await run('users', `
    insert into users (id, phone, full_name, city, role, is_verified, is_setup_complete)
    select md5('loadtest-user-' || n)::uuid, '92399' || lpad(n::text, 7, '0'),
      'Load Test Person ' || n,
      (array['Islamabad','Rawalpindi','Lahore','Karachi','Peshawar'])[1 + n % 5],
      case when n <= ${vendorCount} then 'vendor' else 'player' end, true, true
    from generate_series(1, ${players}) n on conflict (id) do nothing`);
  await run('vendors', `
    insert into vendors (id, user_id, business_name, business_phone, business_city, verification_status, is_verified)
    select md5('loadtest-vendor-' || n)::uuid, md5('loadtest-user-' || n)::uuid,
      'Load Test Turf Operator ' || n, '92399' || lpad(n::text, 7, '0'),
      (array['Islamabad','Rawalpindi','Lahore','Karachi','Peshawar'])[1 + n % 5], 'approved', true
    from generate_series(1, ${vendorCount}) n on conflict (id) do nothing`);
  await run('grounds', `
    insert into grounds (id, vendor_id, title, description, location, city, address,
      latitude, longitude, amenities, pitch_type, price_per_hour, verification_status, is_verified, rating, total_reviews)
    select md5('loadtest-ground-' || n)::uuid, md5('loadtest-vendor-' || (1 + (n-1) % ${vendorCount}))::uuid,
      'Load Test Football Ground ' || n, 'Synthetic staging football ground',
      'Sector ' || (1 + n % 20),
      (array['Islamabad','Rawalpindi','Lahore','Karachi','Peshawar'])[1 + n % 5],
      'Load Test Street ' || n,
      33.5 + ((n % 100)::numeric / 1000), 73.0 + ((n % 100)::numeric / 1000),
      array['Parking','Floodlights'], (array['5-a-side','7-a-side','11-a-side'])[1 + n % 3],
      1000 + (n % 8) * 250, 'approved', true, (3 + (n % 20)::numeric / 10), n % 100
    from generate_series(1, ${groundCount}) n on conflict (id) do nothing`);
  await run('recurring schedule templates', `
    insert into slot_schedule_templates (id, ground_id, days, start_time, end_time, price, is_active)
    select md5('loadtest-template-' || g || '-' || h)::uuid,
      md5('loadtest-ground-' || g)::uuid, array[0,1,2,3,4,5,6],
      make_time(12 + h, 0, 0), make_time(13 + h, 0, 0),
      1000 + (g % 8) * 250 + (case when h >= 6 then 300 else 0 end), true
    from generate_series(1, ${groundCount}) g cross join generate_series(0, 9) h
    on conflict (id) do nothing`);
  await run('slots', `
    insert into slots (id, ground_id, date, start_time, end_time, price, schedule_template_id)
    select md5('loadtest-slot-' || g || '-' || d || '-' || h)::uuid,
      md5('loadtest-ground-' || g)::uuid,
      ((now() at time zone 'Asia/Karachi')::date - 10 + d),
      make_time(12 + h, 0, 0), make_time(13 + h, 0, 0),
      1000 + (g % 8) * 250 + (case when h >= 6 then 300 else 0 end),
      md5('loadtest-template-' || g || '-' || h)::uuid
    from generate_series(1, ${groundCount}) g
    cross join generate_series(0, ${days - 1}) d
    cross join generate_series(0, 9) h
    on conflict (id) do nothing`);
  await run('existing slot template links', `
    update slots s set schedule_template_id = t.id
    from slot_schedule_templates t join grounds g on g.id = t.ground_id
    where s.ground_id = t.ground_id and s.start_time = t.start_time
      and s.schedule_template_id is null and g.title like 'Load Test Football Ground %'`);
  await run('bookings and slot claims', `
    with selected as (
      select s.*, gr.vendor_id, (101 + ((g.number * ${days} + g.day_offset) % ${players - 100})) as player_number
      from (
        select n as number, d as day_offset, md5('loadtest-ground-' || n)::uuid as ground_id
        from generate_series(1, ${groundCount}) n cross join generate_series(0, ${days - 1}) d
      ) g
      join slots s on s.id = md5('loadtest-slot-' || g.number || '-' || g.day_offset || '-9')::uuid
      join grounds gr on gr.id = g.ground_id
      where s.is_booked = false
    ), created as (
      insert into bookings (id, booking_number, player_id, vendor_id, ground_id, slot_id,
        date, start_time, end_time, total_amount, vendor_amount, status, payment_status,
        payment_method, cancellation_policy, created_at)
      select md5('loadtest-booking-' || selected.id)::uuid,
        'LOAD-' || replace(selected.id::text, '-', ''),
        md5('loadtest-user-' || selected.player_number)::uuid, selected.vendor_id,
        selected.ground_id, selected.id, selected.date, selected.start_time, selected.end_time,
        selected.price, selected.price, case when selected.date < (now() at time zone 'Asia/Karachi')::date then 'completed'::booking_status else 'confirmed'::booking_status end,
        'paid'::payment_status, 'mock', 'standard', selected.date::timestamp - interval '7 days'
      from selected on conflict (id) do nothing
      returning id, slot_id, player_id
    )
    update slots set is_booked = true, booking_id = created.id, booked_by = created.player_id
    from created where slots.id = created.slot_id`);
  await run('payment attempts', `
    insert into payment_attempts (id, booking_id, player_id, vendor_id, provider, provider_reference,
      provider_status, amount, status, idempotency_key, paid_at)
    select md5('loadtest-payment-' || b.id)::uuid, b.id, b.player_id, b.vendor_id,
      'mock', 'LOAD-' || replace(b.id::text, '-', ''), 'paid', b.total_amount,
      'paid', 'loadtest-payment:' || b.id, b.created_at + interval '5 minutes'
    from bookings b where b.booking_number like 'LOAD-%' on conflict (id) do nothing`);
  await run('earnings ledger', `
    insert into ledger_entries (id, vendor_id, booking_id, payment_attempt_id, type, status,
      amount, description, idempotency_key, posted_at)
    select md5('loadtest-ledger-' || b.id)::uuid, b.vendor_id, b.id,
      md5('loadtest-payment-' || b.id)::uuid, 'booking_earning',
      case when b.status = 'completed' then 'posted'::ledger_entry_status else 'pending'::ledger_entry_status end,
      b.vendor_amount, 'Load test booking earning', 'loadtest-earning:' || b.id,
      case when b.status = 'completed' then b.date::timestamp else null end
    from bookings b where b.booking_number like 'LOAD-%' on conflict (id) do nothing`);
  await run('player and vendor notifications', `
    insert into notifications (id, user_id, type, title, message, data, created_at)
    select md5('loadtest-notification-player-' || b.id)::uuid, b.player_id, 'booking',
      'Booking confirmed', 'Your football slot is confirmed.', jsonb_build_object('bookingId', b.id), b.created_at
    from bookings b where b.booking_number like 'LOAD-%'
    union all
    select md5('loadtest-notification-vendor-' || b.id)::uuid, v.user_id, 'booking',
      'New booking', 'A player booked a football slot.', jsonb_build_object('bookingId', b.id), b.created_at
    from bookings b join vendors v on v.id = b.vendor_id where b.booking_number like 'LOAD-%'
    on conflict (id) do nothing`);
  // Bulk synthetic inserts can leave PostgreSQL's planner statistics far
  // behind the actual table sizes. Refresh them before any benchmark so the
  // first run does not use poor plans and contaminate the next run.
  await run('planner statistics', 'analyze');
  console.log(`Seed complete: ${players} users, ${groundCount} grounds, ${groundCount * days * 10} slots, about ${groundCount * days} bookings.`);
} catch (error) {
  console.error('Seed failed:', error.code || error.message, error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
