#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

token="$(awk -F= '$1 == "METRICS_TOKEN" { sub(/^[^=]*=/, ""); print; exit }' deploy/.env.vm)"
if (( ${#token} < 32 )); then
  echo "METRICS_TOKEN must contain at least 32 characters" >&2
  exit 1
fi

temporary="$(mktemp)"
trap 'rm -f "$temporary"' EXIT
printf '%s' "$token" > "$temporary"

# The official Prometheus image runs as UID/GID 65534 (nobody). Standalone
# Compose preserves source-file ownership for local secrets, so install the
# ignored host file for that runtime account instead of making it world-readable.
sudo install -o 65534 -g 65534 -m 0400 "$temporary" deploy/metrics-token
echo "Prepared private Prometheus metrics token"
