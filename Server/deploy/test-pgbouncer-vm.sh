#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

clients="${PGBOUNCER_TEST_CLIENTS:-30}"
if ! [[ "$clients" =~ ^[0-9]+$ ]] || (( clients < 2 || clients > 60 )); then
  echo "PGBOUNCER_TEST_CLIENTS must be an integer between 2 and 60" >&2
  exit 1
fi

compose=(
  sudo docker compose
  --env-file deploy/.env.vm
  -f deploy/compose.vm.yml
  -f deploy/compose.ha-rehearsal.yml
  -f deploy/compose.pgbouncer-rehearsal.yml
)

sudo -v
echo "Starting $clients read-only clients for three seconds..."
"${compose[@]}" exec -T pgbouncer sh -c '
  credential_part=${DATABASE_URL#*://}
  credential_part=${credential_part%%@*}
  export PGPASSWORD=${credential_part#*:}
  pids=""
  current=1
  while [ "$current" -le "$1" ]; do
    psql -h 127.0.0.1 -p 5432 -U turfbookpk -d turfbookpk \
      -v ON_ERROR_STOP=1 -c "SELECT pg_sleep(3);" >/dev/null &
    pids="$pids $!"
    current=$((current + 1))
  done
  for pid in $pids; do wait "$pid"; done
' sh "$clients" &
load_pid=$!
trap 'wait "$load_pid" 2>/dev/null || true' EXIT

sleep 1
echo "PgBouncer pool during load:"
"${compose[@]}" exec -T pgbouncer sh -c '
  credential_part=${DATABASE_URL#*://}
  credential_part=${credential_part%%@*}
  export PGPASSWORD=${credential_part#*:}
  psql -h 127.0.0.1 -p 5432 -U turfbookpk -d pgbouncer \
    -v ON_ERROR_STOP=1 -c "SHOW POOLS;"
'

echo "Active PostgreSQL connections for the application user:"
"${compose[@]}" exec -T db psql -U turfbookpk -d turfbookpk -Atc \
  "SELECT count(*) FROM pg_stat_activity WHERE usename = 'turfbookpk' AND state = 'active';"

wait "$load_pid"
trap - EXIT
echo "Read-only pool test completed"
curl --fail --silent --show-error http://127.0.0.1:5080/api/ready
echo
