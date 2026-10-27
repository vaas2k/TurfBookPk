#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
mkdir -p backups
output="backups/turfbookpk-$(date -u +%Y%m%dT%H%M%SZ).dump"
temporary="${output}.partial"
container_temporary="/tmp/turfbookpk-backup-$(date -u +%Y%m%dT%H%M%SZ)-$$.dump"
compose=(sudo docker compose --env-file deploy/.env.vm -f deploy/compose.vm.yml)
cleanup() {
  rm -f "$temporary"
  "${compose[@]}" exec -T db rm -f "$container_temporary" > /dev/null 2>&1 || true
}
trap cleanup EXIT
echo "Checking Docker access..."
sudo -v
echo "Creating database archive inside the PostgreSQL container..."
"${compose[@]}" exec -T db pg_dump -U turfbookpk -d turfbookpk -Fc -f "$container_temporary"
echo "Checking archive format..."
"${compose[@]}" exec -T db pg_restore --list "$container_temporary" > /dev/null
echo "Copying archive to backups/..."
"${compose[@]}" cp "db:$container_temporary" "$temporary"
sudo chown "$(id -u):$(id -g)" "$temporary"
chmod 600 "$temporary"
mv "$temporary" "$output"
sha256sum "$output" > "${output}.sha256"
echo "Backup created: $output"
