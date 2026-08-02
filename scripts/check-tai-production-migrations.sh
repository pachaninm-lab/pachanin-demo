#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$ROOT/apps/tai/tai/migrations/manifest.json"
WORK="$(mktemp -d)"
SQL="$WORK/migration-apply.sql"
CONTAINER="tai-migration-contract-${GITHUB_RUN_ID:-$$}-${GITHUB_RUN_ATTEMPT:-1}"
cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

[[ -f "$MANIFEST" && ! -L "$MANIFEST" ]]
docker run --detach --rm --name "$CONTAINER" \
  -e POSTGRES_PASSWORD=contract-only \
  -e POSTGRES_DB=tai_contract \
  postgres:16-bookworm >/dev/null

ready=0
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U postgres -d tai_contract >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
(( ready == 1 ))

python3 - "$MANIFEST" "$SQL" "$ROOT" <<'PY'
import hashlib
import json
import pathlib
import re
import sys

manifest_path = pathlib.Path(sys.argv[1])
output_path = pathlib.Path(sys.argv[2])
root = pathlib.Path(sys.argv[3])
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
if manifest.get("schema_version") != "tai.migration.manifest.v1":
    raise SystemExit("migration manifest schema mismatch")
items = manifest.get("migrations") or []
if not items:
    raise SystemExit("migration manifest is empty")
seen_versions: set[int] = set()
seen_paths: set[str] = set()
lines = [
    "CREATE TABLE IF NOT EXISTS public.tai_schema_migrations (version INTEGER PRIMARY KEY CHECK (version > 0), path TEXT NOT NULL UNIQUE, sha256 TEXT NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'), target_sha TEXT NOT NULL CHECK (target_sha ~ '^[0-9a-f]{40}$'), applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp());"
]

def literal(value: str) -> str:
    if "\x00" in value:
        raise SystemExit("NUL in migration authority")
    return "'" + value.replace("'", "''") + "'"

for item in items:
    version = item.get("version")
    name = item.get("path")
    if not isinstance(version, int) or isinstance(version, bool) or version < 1 or version in seen_versions:
        raise SystemExit(f"migration version authority invalid: {version!r}")
    if not isinstance(name, str) or not name.endswith(".sql") or "/" in name or name in seen_paths:
        raise SystemExit(f"migration path authority invalid: {name!r}")
    path = root / "apps/tai/tai/migrations" / name
    raw_bytes = path.read_bytes()
    raw = raw_bytes.decode("utf-8")
    digest = hashlib.sha256(raw_bytes).hexdigest()
    match = re.fullmatch(r"\s*BEGIN;\s*(.*?)\s*COMMIT;\s*", raw, re.S | re.I)
    if not match:
        raise SystemExit(f"migration transaction boundary invalid: {name}")
    body = match.group(1).strip()
    prefix = f"tai_m{version}_"
    lines.extend(
        [
            f"\\echo TAI_MIGRATION_APPLY_VERSION={version} PATH={name}",
            "DO $tai_guard$ BEGIN IF EXISTS (SELECT 1 FROM public.tai_schema_migrations WHERE version = "
            + str(version)
            + " AND (path <> "
            + literal(name)
            + " OR sha256 <> "
            + literal(digest)
            + ")) THEN RAISE EXCEPTION 'TAI migration ledger mismatch for version "
            + str(version)
            + "'; END IF; END $tai_guard$;",
            "SELECT EXISTS (SELECT 1 FROM public.tai_schema_migrations WHERE version = "
            + str(version)
            + " AND path = "
            + literal(name)
            + " AND sha256 = "
            + literal(digest)
            + ") AS applied \\gset "
            + prefix,
            "\\if :" + prefix + "applied",
            "\\echo verified existing TAI migration " + str(version),
            "\\else",
            "BEGIN;",
            body,
            "INSERT INTO public.tai_schema_migrations(version,path,sha256,target_sha) VALUES ("
            + str(version)
            + ","
            + literal(name)
            + ","
            + literal(digest)
            + ","
            + literal("0" * 40)
            + ");",
            "COMMIT;",
            "\\endif",
        ]
    )
    seen_versions.add(version)
    seen_paths.add(name)
output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
PY
chmod 0600 "$SQL"

apply() {
  docker exec -i "$CONTAINER" psql -X --set ON_ERROR_STOP=1 -U postgres -d tai_contract < "$SQL"
}
apply
apply
expected="$(python3 - "$MANIFEST" <<'PY'
import json,sys
print(len(json.load(open(sys.argv[1],encoding='utf-8'))['migrations']))
PY
)"
actual="$(docker exec "$CONTAINER" psql -X -At -U postgres -d tai_contract -c 'SELECT COUNT(*) FROM public.tai_schema_migrations;')"
[[ "$actual" == "$expected" ]]
echo "TAI_PRODUCTION_MIGRATION_APPLY_CONTRACT=PASS"
echo "TAI_MIGRATION_COUNT=$actual"
