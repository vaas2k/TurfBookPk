#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
mkdir -p backups
output="backups/turfbookpk-$(date -u +%Y%m%dT%H%M%SZ).dump"
temporary="${output}.partial"
trap 'rm -f "$temporary"' EXIT
sudo docker compose --env-file deploy/.env.vm -f deploy/compose.vm.yml exec -T db \
  pg_dump -U turfbookpk -d turfbookpk -Fc > "$temporary"
sudo docker compose --env-file deploy/.env.vm -f deploy/compose.vm.yml exec -T db \
  pg_restore --list < "$temporary" > /dev/null
mv "$temporary" "$output"
sha256sum "$output" > "${output}.sha256"
echo "Backup created: $output"
