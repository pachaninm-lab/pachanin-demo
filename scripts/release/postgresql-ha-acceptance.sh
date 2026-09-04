#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GENERATED="$ROOT_DIR/scripts/release/.postgresql-ha-acceptance.generated.sh"
trap 'rm -f "$GENERATED"' EXIT

cat \
  "$ROOT_DIR/scripts/release/postgresql-ha-acceptance.d/00-bootstrap.part" \
  "$ROOT_DIR/scripts/release/postgresql-ha-acceptance.d/01-operators.part" \
  "$ROOT_DIR/scripts/release/postgresql-ha-acceptance.d/02-database.part" \
  "$ROOT_DIR/scripts/release/postgresql-ha-acceptance.d/03-failover-backup.part" \
  "$ROOT_DIR/scripts/release/postgresql-ha-acceptance.d/04-restore.part" \
  "$ROOT_DIR/scripts/release/postgresql-ha-acceptance.d/05-evidence.part" \
  > "$GENERATED"
chmod 0700 "$GENERATED"
bash "$GENERATED"
