from pathlib import Path
import json
import re

executor = Path('scripts/production-full-stack-exact-sha.sh')
text = executor.read_text()
replacement = r'''verify_durable_intake() {
  [[ "$INTAKE_REQUEST_NUMBER" =~ ^PC-[0-9]{8}-[0-9A-F]{12}$ ]] || fail INTAKE_REQUEST_NUMBER_INVALID 40
  [[ "$INTAKE_CORRELATION_ID" =~ ^[A-Za-z0-9._:-]{8,128}$ ]] || fail INTAKE_CORRELATION_ID_INVALID 41
  local pg_id api_runtime_id sql result node_program
  sql="SELECT verdict || '|' || audit_id || '|' || outbox_id FROM public.verify_public_organization_connection_request_evidence('$INTAKE_REQUEST_NUMBER', '$INTAKE_CORRELATION_ID');"

  if [[ -n "$postgres_service" ]]; then
    pg_id="$(compose_id "$postgres_service")"
    [[ -n "$pg_id" ]] || fail POSTGRES_RUNTIME_MISSING 43
    if ! result="$(docker exec "$pg_id" sh -ceu 'test -n "${POSTGRES_USER:-}"; test -n "${POSTGRES_DB:-}"; psql -v ON_ERROR_STOP=1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --tuples-only --no-align --command "$1"' sh "$sql" | tr -d '[:space:]')"; then
      fail POSTGRES_EVIDENCE_AUTHORITY_UNAVAILABLE 42
    fi
    printf 'POSTGRES_EVIDENCE_AUTHORITY=COMPOSE_POSTGRES\n'
  else
    api_runtime_id="$(compose_id api)"
    [[ -n "$api_runtime_id" ]] || fail API_RUNTIME_MISSING 43
    read -r -d '' node_program <<'NODE' || true
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT verdict, audit_id, outbox_id FROM public.verify_public_organization_connection_request_evidence($1, $2)',
    process.env.PC_INTAKE_REQUEST_NUMBER,
    process.env.PC_INTAKE_CORRELATION_ID,
  );
  const row = rows[0];
  if (!row) process.exit(2);
  process.stdout.write(`${row.verdict}|${row.audit_id}|${row.outbox_id}`);
})().catch(() => {
  process.stderr.write('API_PRISMA_EVIDENCE_QUERY_FAILED\n');
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
NODE
    if ! result="$(docker exec \
      -e PC_INTAKE_REQUEST_NUMBER="$INTAKE_REQUEST_NUMBER" \
      -e PC_INTAKE_CORRELATION_ID="$INTAKE_CORRELATION_ID" \
      "$api_runtime_id" /nodejs/bin/node -e "$node_program" | tr -d '[:space:]')"; then
      fail POSTGRES_EVIDENCE_AUTHORITY_UNAVAILABLE 42
    fi
    printf 'POSTGRES_EVIDENCE_AUTHORITY=API_PRISMA_SECURITY_DEFINER\n'
  fi

  [[ "$result" =~ ^PASS\|audit-[A-Za-z0-9-]+\|outbox-[A-Za-z0-9-]+$ ]] || fail DURABLE_INTAKE_EVIDENCE_FAILED 44
  IFS='|' read -r _ audit_id outbox_id <<< "$result"
  printf 'DURABLE_INTAKE_DB=PASS\n'
  printf 'DURABLE_INTAKE_AUDIT_ID=%s\n' "$audit_id"
  printf 'DURABLE_INTAKE_OUTBOX_ID=%s\n' "$outbox_id"
}'''
pattern = r'verify_durable_intake\(\) \{.*?\n\}\n\nif \[\[ "\$ACTION" == verify-intake \]\]; then'
text, count = re.subn(pattern, replacement + '\n\nif [[ "$ACTION" == verify-intake ]]; then', text, count=1, flags=re.S)
if count != 1:
    raise SystemExit('verify_durable_intake block anchor mismatch')
executor.write_text(text)

migration = Path('apps/api/prisma/migrations/20260730113000_public_organization_intake_evidence_authority/migration.sql')
migration.parent.mkdir(parents=True, exist_ok=True)
migration.write_text(Path('docs/platform-v7/autopilot/templates/public-intake-evidence-authority.sql').read_text())

checker = Path('scripts/check-production-full-stack-release.mjs')
text = checker.read_text()
if "evidenceMigration:" not in text:
    anchor = "  live: 'scripts/production-full-stack-live-acceptance.sh',\n"
    if text.count(anchor) != 1:
        raise SystemExit('checker paths anchor mismatch')
    text = text.replace(anchor, anchor + "  evidenceMigration: 'apps/api/prisma/migrations/20260730113000_public_organization_intake_evidence_authority/migration.sql',\n")
if "'API_PRISMA_SECURITY_DEFINER'" not in text:
    anchor = "  'DEPLOYMENT_COMPLETE=1',\n]);\nrequireAll('live', ["
    if text.count(anchor) != 1:
        raise SystemExit('checker executor anchor mismatch')
    text = text.replace(anchor, "  'DEPLOYMENT_COMPLETE=1',\n  'API_PRISMA_SECURITY_DEFINER',\n  'verify_public_organization_connection_request_evidence',\n]);\nrequireAll('evidenceMigration', [\n  'SECURITY DEFINER',\n  'verify_public_organization_connection_request_evidence',\n  'REVOKE ALL ON FUNCTION',\n  'GRANT EXECUTE ON FUNCTION',\n  \"NOT (payload ?| ARRAY['organizationName','inn','contactName','position','phone','email','payloadHash'])\",\n]);\nrequireAll('live', [")
checker.write_text(text)

scope = {
    'schemaVersion': 'platform-v7.concurrent-scope.v1',
    'branch': 'fix/external-postgres-evidence-authority-20260730',
    'status': 'active',
    'issue': 3072,
    'baseCommit': 'GENERATED_FROM_CURRENT_MAIN',
    'operationalStatus': 'EXTERNAL_POSTGRES_DURABLE_EVIDENCE_AUTHORITY_FIX',
    'allowedPaths': [
        'scripts/production-full-stack-exact-sha.sh',
        'scripts/check-production-full-stack-release.mjs',
        'apps/api/prisma/migrations/20260730113000_public_organization_intake_evidence_authority/migration.sql',
        '.github/workflows/one-shot-external-postgres-evidence-authority.yml',
        'scripts/one-shot-external-postgres-evidence-authority.py',
        'docs/platform-v7/autopilot/templates/public-intake-evidence-authority.sql',
        'docs/platform-v7/autopilot/scopes/one-shot-external-postgres-evidence-authority-3072.json',
        'docs/platform-v7/autopilot/scopes/fix-external-postgres-evidence-authority-3072.json',
    ],
    'boundaries': {
        'runtimeBusinessBehaviorChange': False,
        'securityGateDisabled': False,
        'acceptanceGateWeakened': False,
        'blanketContinueOnError': False,
        'productionDeployment': True,
    },
    'acceptance': [
        'compose PostgreSQL evidence remains supported',
        'external PostgreSQL evidence is verified through the exact API runtime Prisma connection',
        'the database function returns only verdict audit ID and outbox ID',
        'no PII is returned or stored in release evidence',
        'live and durable acceptance must pass before release success',
        'production remains REG.RU VPS only',
    ],
    'productionHosting': 'REG_RU_VPS_ONLY',
}
Path('docs/platform-v7/autopilot/scopes/fix-external-postgres-evidence-authority-3072.json').write_text(
    json.dumps(scope, ensure_ascii=False, indent=2) + '\n'
)
