#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
backup="${1:?Usage: bash deploy/restore-check-vm.sh backups/FILE.dump}"
test -f "$backup"
sha256sum --check "${backup}.sha256"
database="turfbookpk_restoretest_$(date -u +%Y%m%d%H%M%S)"
sudo docker compose --env-file deploy/.env.vm -f deploy/compose.vm.yml exec -T db \
  createdb -U turfbookpk "$database"
sudo docker compose --env-file deploy/.env.vm -f deploy/compose.vm.yml exec -T db \
  pg_restore -U turfbookpk --no-owner --no-acl -d "$database" < "$backup"
sudo docker compose --env-file deploy/.env.vm -f deploy/compose.vm.yml exec -T db \
  psql -U turfbookpk -d "$database" -Atc 'SELECT count(*) FROM public.users;'
echo "Restore verified in disposable database: $database"
echo "After reviewing it, remove only that database: sudo docker compose --env-file deploy/.env.vm -f deploy/compose.vm.yml exec -T db dropdb -U turfbookpk $database"
