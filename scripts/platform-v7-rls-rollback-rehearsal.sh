#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cat >&2 <<'NOTICE'
The former reverse-RLS rehearsal has been retired.

Database schema changes are forward-only. Application rollback must use a
forward-compatible database. Emergency database recovery must restore a
verified backup or use provider PITR into an isolated target before cutover.

This compatibility entry point now runs the safe backup/restore rehearsal and
will fail closed unless all DR_SOURCE_* and DR_RESTORE_* datasources are set.
NOTICE

exec "$ROOT_DIR/scripts/platform-v7-database-dr-rehearsal.sh" "$@"
