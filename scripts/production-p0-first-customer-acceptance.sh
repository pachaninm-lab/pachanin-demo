#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

LIVE_BASE='https://xn----8sbjf4befbjgs9b.xn--p1ai'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
DEFAULT_HOST='195.19.12.120'
USER_AGENT='PC-P0-production-acceptance/1.0'

die() {
  printf 'P0_ACCEPTANCE_BLOCKED=%s\n' "$1" >&2
  exit "${2:-1}"
}

require_command() {
  command -v "$1" >/dev/null || die "MISSING_COMMAND_$1" 2
}

is_sha() {
  [[ "$1" =~ ^[0-9a-f]{40}$ ]]
}

remote_proof() {
  local target_sha="${1:-}" input api_container web_container api_revision web_revision
  local working_dir config_files project config_file compose_json migration_service migration_image migration_revision
  local migration_database_url migration_env_file
  local context_b64 rls_file receipt_file

  is_sha "$target_sha" || die INVALID_REMOTE_TARGET 40
  input="$(cat)"
  jq -e '
    .lotId | type == "string" and length > 0
  ' <<< "$input" >/dev/null || die INVALID_REMOTE_CONTEXT 41
  jq -e '
    [.actors.a, .actors.b]
    | length == 2
      and all(.[];
        (.userId | type == "string" and length > 0)
        and (.orgId | type == "string" and length > 0)
        and (.tenantId | type == "string" and length > 0)
        and (.role | type == "string" and length > 0)
        and (.sessionId | type == "string" and length > 0)
      )
  ' <<< "$input" >/dev/null || die INVALID_REMOTE_ACTORS 41
  jq -e '.applications | length == 2' <<< "$input" >/dev/null || die INVALID_REMOTE_APPLICATIONS 41

  mapfile -t api_containers < <(docker ps -q --filter 'label=com.docker.compose.service=api')
  mapfile -t web_containers < <(docker ps -q --filter 'label=com.docker.compose.service=web')
  [[ "${#api_containers[@]}" == 1 && "${#web_containers[@]}" == 1 ]] || die COMPOSE_RUNTIME_AUTHORITY_AMBIGUOUS 42
  api_container="${api_containers[0]}"
  web_container="${web_containers[0]}"
  api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_container")"
  web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_container")"
  [[ "$api_revision" == "$target_sha" && "$web_revision" == "$target_sha" ]] || die LIVE_REVISION_MISMATCH 43

  context_b64="$(printf '%s' "$input" | base64 -w0)"
  rls_file="$(mktemp)"
  receipt_file="$(mktemp)"
  migration_env_file="$(mktemp)"
  trap 'rm -f "${rls_file:-}" "${receipt_file:-}" "${migration_env_file:-}"' EXIT

  docker exec -i -e "PC_P0_CONTEXT_B64=$context_b64" "$api_container" /nodejs/bin/node - > "$rls_file" <<'NODE'
const { PrismaClient } = require('@prisma/client');

const fail = (code) => {
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
};

const context = JSON.parse(Buffer.from(process.env.PC_P0_CONTEXT_B64, 'base64').toString('utf8'));
const prisma = new PrismaClient();

async function probe(actor) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await tx.$queryRawUnsafe(`
      SELECT
        set_config('app.current_user_id', $1, true),
        set_config('app.current_org_id', $2, true),
        set_config('app.current_tenant_id', $3, true),
        set_config('app.current_role', $4, true),
        set_config('app.current_session_id', $5, true)
    `, actor.userId, actor.orgId, actor.tenantId, actor.role, actor.sessionId);
    const [role] = await tx.$queryRawUnsafe(`
      SELECT current_user AS role, roles.rolsuper, roles.rolbypassrls
      FROM pg_catalog.pg_roles roles
      WHERE roles.rolname = current_user
    `);
    const [relation] = await tx.$queryRawUnsafe(`
      SELECT relation.relrowsecurity, relation.relforcerowsecurity
      FROM pg_catalog.pg_class relation
      JOIN pg_catalog.pg_namespace schema ON schema.oid = relation.relnamespace
      WHERE schema.nspname = 'auction' AND relation.relname = 'lots'
    `);
    const [row] = await tx.$queryRawUnsafe(
      'SELECT count(*)::integer AS count FROM auction.lots WHERE id = $1',
      context.lotId,
    );
    return {
      count: Number(row?.count ?? -1),
      role: String(role?.role ?? ''),
      superuser: Boolean(role?.rolsuper),
      bypassRls: Boolean(role?.rolbypassrls),
      rlsEnabled: Boolean(relation?.relrowsecurity),
      rlsForced: Boolean(relation?.relforcerowsecurity),
    };
  });
}

(async () => {
  const a = await probe(context.actors.a);
  const b = await probe(context.actors.b);
  if (
    context.actors.a.tenantId === context.actors.b.tenantId
    || a.count !== 1
    || b.count !== 0
    || !a.role
    || a.role !== b.role
    || a.superuser
    || b.superuser
    || a.bypassRls
    || b.bypassRls
    || !a.rlsEnabled
    || !a.rlsForced
    || !b.rlsEnabled
    || !b.rlsForced
  ) {
    fail('P0_POSTGRESQL_RLS_PROOF_FAILED');
    return;
  }
  process.stdout.write(JSON.stringify({
    result: 'PASS',
    databaseRole: a.role,
    superuser: false,
    bypassRls: false,
    rlsEnabled: true,
    rlsForced: true,
    actorAVisibleRows: a.count,
    actorBVisibleRows: b.count,
  }));
})().catch(() => fail('P0_POSTGRESQL_RLS_PROOF_FAILED')).finally(() => prisma.$disconnect());
NODE
  jq -e '.result == "PASS" and .actorAVisibleRows == 1 and .actorBVisibleRows == 0' "$rls_file" >/dev/null \
    || die POSTGRESQL_RLS_PROOF_FAILED 44

  working_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$api_container")"
  config_files="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$api_container")"
  project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$api_container")"
  [[ -n "$working_dir" && -n "$config_files" && -n "$project" ]] || die COMPOSE_DISCOVERY_FAILED 45
  compose_args=(docker compose --project-directory "$working_dir" --project-name "$project")
  IFS=',' read -r -a discovered_config_files <<< "$config_files"
  for config_file in "${discovered_config_files[@]}"; do
    [[ -n "$config_file" ]] || die COMPOSE_DISCOVERY_FAILED 45
    compose_args+=(-f "$config_file")
  done
  compose_json="$("${compose_args[@]}" config --format json 2>/dev/null)"
  mapfile -t migration_services < <(jq -r '
    .services | to_entries[]
    | select(((.value.image // "") | test("grainflow-migration")) or (.key | test("migrat"; "i")))
    | .key
  ' <<< "$compose_json" | sort -u)
  [[ "${#migration_services[@]}" == 1 ]] || die MIGRATION_SERVICE_DISCOVERY_FAILED 46
  migration_service="${migration_services[0]}"
  migration_image="$(jq -r --arg service "$migration_service" '.services[$service].image // empty' <<< "$compose_json")"
  [[ -n "$migration_image" ]] || die MIGRATION_IMAGE_DISCOVERY_FAILED 46
  migration_revision="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$migration_image" 2>/dev/null || true)"
  [[ "$migration_revision" == "$target_sha" ]] || die MIGRATION_REVISION_MISMATCH 47
  migration_database_url="$(jq -r --arg service "$migration_service" '.services[$service].environment.DATABASE_URL // empty' <<< "$compose_json")"
  [[ -n "$migration_database_url" ]] || die MIGRATION_DATABASE_URL_DISCOVERY_FAILED 46
  [[ "$migration_database_url" != *$'\n'* && "$migration_database_url" != *$'\r'* ]] \
    || die MIGRATION_DATABASE_URL_DISCOVERY_FAILED 46
  printf 'PC_P0_MIGRATION_DATABASE_URL_B64=%s\n' \
    "$(printf '%s' "$migration_database_url" | base64 -w0)" > "$migration_env_file"
  unset migration_database_url

  docker exec -i \
    -e "PC_P0_CONTEXT_B64=$context_b64" \
    --env-file "$migration_env_file" \
    "$api_container" /nodejs/bin/node - > "$receipt_file" 2>/dev/null <<'NODE'
const { PrismaClient } = require('@prisma/client');

const missing = () => {
  process.stderr.write('MISSING_P0_CAUSAL_OUTBOX_PRODUCER\n');
  process.exitCode = 42;
};

const context = JSON.parse(Buffer.from(process.env.PC_P0_CONTEXT_B64, 'base64').toString('utf8'));
const databaseUrl = Buffer.from(
  String(process.env.PC_P0_MIGRATION_DATABASE_URL_B64 || ''),
  'base64',
).toString('utf8').trim();
if (!databaseUrl) {
  missing();
  process.exit();
}
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

(async () => {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await tx.$executeRawUnsafe('SET LOCAL ROLE pc_registration_receipt_authority');
    const [authority] = await tx.$queryRawUnsafe(`
      SELECT
        current_user AS current_role,
        role.rolcanlogin,
        role.rolsuper,
        role.rolbypassrls,
        (SELECT count(*)::integer
         FROM pg_catalog.pg_auth_members membership
         WHERE membership.roleid = role.oid) AS member_count
      FROM pg_catalog.pg_roles role
      WHERE role.rolname = 'pc_registration_receipt_authority'
    `);
    const [relation] = await tx.$queryRawUnsafe(`
      SELECT relation.relrowsecurity, relation.relforcerowsecurity,
        (SELECT count(*)::integer FROM pg_catalog.pg_policies policy
         WHERE policy.schemaname = 'public'
           AND policy.tablename = 'outbox_entries'
           AND policy.policyname IN (
             'outbox_entries_registration_receipt_select',
             'outbox_entries_registration_receipt_insert'
           )) AS bounded_policy_count
      FROM pg_catalog.pg_class relation
      JOIN pg_catalog.pg_namespace schema ON schema.oid = relation.relnamespace
      WHERE schema.nspname = 'public' AND relation.relname = 'outbox_entries'
    `);
    const rows = await tx.$queryRawUnsafe(`
      SELECT
        entry."id" AS "outboxId",
        entry."idempotencyKey" AS "idempotencyKey",
        entry."correlationId" AS "correlationId",
        entry."auditId" AS "auditId",
        entry."payload" ->> 'applicationId' AS "applicationId",
        entry."payload" ->> 'applicationVersion' AS "applicationVersion",
        entry."payload" ->> 'approvalEventId' AS "approvalEventId",
        entry."payload" ->> 'activationEventId' AS "activationEventId",
        entry."payload" ->> 'auditHash' AS "payloadAuditHash",
        application.status AS "applicationStatus",
        application.version::text AS "storedApplicationVersion",
        approval.new_status AS "approvalStatus",
        approval.correlation_id AS "approvalCorrelationId",
        activation.new_status AS "activationStatus",
        activation.correlation_id AS "activationCorrelationId",
        audit.hash AS "storedAuditHash"
      FROM public."outbox_entries" entry
      JOIN auth.registration_applications application
        ON application.id = entry."payload" ->> 'applicationId'
      JOIN auth.registration_application_events approval
        ON approval.id = entry."payload" ->> 'approvalEventId'
      JOIN auth.registration_application_events activation
        ON activation.id = entry."payload" ->> 'activationEventId'
      JOIN auth.audit_events audit
        ON audit.id = entry."auditId"
      WHERE entry."type" = 'auth.registration.lifecycle.receipt'
        AND entry."payload" ->> 'applicationId' IN ($1, $2)
      ORDER BY entry."payload" ->> 'applicationId'
    `, context.applications[0].applicationId, context.applications[1].applicationId);
    return { authority, relation, rows };
  });

  const expected = new Map(context.applications.map((item) => [item.applicationId, item.correlationId]));
  if (
    !result.authority
    || result.authority.current_role !== 'pc_registration_receipt_authority'
    || result.authority.rolcanlogin
    || result.authority.rolsuper
    || result.authority.rolbypassrls
    || Number(result.authority.member_count) !== 0
    || !result.relation?.relrowsecurity
    || !result.relation?.relforcerowsecurity
    || Number(result.relation?.bounded_policy_count) !== 2
    || result.rows.length !== 2
  ) {
    missing();
    return;
  }

  for (const row of result.rows) {
    const correlationId = expected.get(row.applicationId);
    if (
      !correlationId
      || row.applicationStatus !== 'ACTIVATED'
      || row.approvalStatus !== 'APPROVED'
      || row.activationStatus !== 'ACTIVATED'
      || row.applicationVersion !== row.storedApplicationVersion
      || row.idempotencyKey !== `registration-lifecycle:${row.applicationId}:${row.applicationVersion}`
      || row.correlationId !== correlationId
      || row.approvalCorrelationId !== correlationId
      || row.activationCorrelationId !== correlationId
      || !row.auditId
      || !row.storedAuditHash
      || row.payloadAuditHash !== row.storedAuditHash
    ) {
      missing();
      return;
    }
  }

  process.stdout.write(JSON.stringify({
    result: 'PASS',
    authorityRole: result.authority.current_role,
    memberCount: Number(result.authority.member_count),
    rlsEnabled: true,
    rlsForced: true,
    boundedPolicyCount: Number(result.relation.bounded_policy_count),
    receipts: result.rows.map((row) => ({
      applicationId: row.applicationId,
      applicationVersion: row.applicationVersion,
      correlationId: row.correlationId,
      idempotencyKey: row.idempotencyKey,
      outboxId: row.outboxId,
      auditId: row.auditId,
      approvalEventId: row.approvalEventId,
      activationEventId: row.activationEventId,
    })),
  }));
})().catch(missing).finally(() => prisma.$disconnect());
NODE
  jq -e '.result == "PASS" and (.receipts | length == 2)' "$receipt_file" >/dev/null \
    || die MISSING_P0_CAUSAL_OUTBOX_PRODUCER 48

  jq -n \
    --arg targetSha "$target_sha" \
    --argjson rls "$(cat "$rls_file")" \
    --argjson lifecycle "$(cat "$receipt_file")" \
    '{result:"PASS", targetSha:$targetSha, apiRevision:$targetSha, webRevision:$targetSha, migrationRevision:$targetSha, rls:$rls, lifecycle:$lifecycle}'
  rm -f "$rls_file" "$receipt_file" "$migration_env_file"
  trap - EXIT
}

if [[ "${1:-}" == 'remote-proof' ]]; then
  shift
  remote_proof "$@"
  exit
fi

for command in bash curl jq python3 openssl base64 ssh scp awk sed sha256sum; do
  require_command "$command"
done

TARGET_SHA="${TARGET_SHA:-${1:-}}"
EVIDENCE_DIR="${EVIDENCE_DIR:-artifacts/production-p0-first-customer-acceptance}"
RUN_KEY="${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
SSH_HOST="${PC_PROD_SSH_HOST:-$DEFAULT_HOST}"
SSH_USER="${PC_PROD_SSH_USER:-}"
SSH_PORT="${PC_PROD_SSH_PORT:-22}"
SSH_KEY_PATH="${PC_PROD_SSH_KEY_PATH:-$HOME/.ssh/id_pc_prod}"
REMOTE_SCRIPT="/tmp/pc-p0-first-customer-${GITHUB_RUN_ID:-manual}.sh"
TMP_DIR="$(mktemp -d)"
STAFF_JAR="$TMP_DIR/staff.cookies"
STAFF_SESSION_ID=''
REMOTE_ASSET_COPIED=0

cleanup() {
  local status=$?
  trap - EXIT
  set +e
  if [[ -n "$STAFF_SESSION_ID" && -s "$STAFF_JAR" ]]; then
    csrf="$(awk -F $'\t' '$6 == "pc_csrf_token" { value=$7 } END { print value }' "$STAFF_JAR")"
    if [[ -n "$csrf" ]]; then
      curl --silent --show-error --max-time 12 \
        -X POST -b "$STAFF_JAR" -c "$STAFF_JAR" \
        -H 'Content-Type: application/json' -H "Origin: $LIVE_BASE" -H "x-csrf-token: $csrf" \
        -H 'x-correlation-id: p0-cleanup' \
        --data '{"reason":"Production acceptance cleanup"}' \
        "$LIVE_BASE/api/staff/access/sessions/$STAFF_SESSION_ID/end" >/dev/null 2>&1 || true
    fi
  fi
  if [[ "$REMOTE_ASSET_COPIED" == 1 && -f "$SSH_KEY_PATH" ]]; then
    ssh -i "$SSH_KEY_PATH" -p "$SSH_PORT" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15 \
      "$SSH_USER@$SSH_HOST" "rm -f '$REMOTE_SCRIPT'" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_DIR"
  exit "$status"
}
trap cleanup EXIT

is_sha "$TARGET_SHA" || die INVALID_TARGET_SHA 3
[[ "$SSH_HOST" == "$DEFAULT_HOST" ]] || die CANONICAL_VPS_MISMATCH 4
[[ "$SSH_USER" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]] || die SSH_PRINCIPAL_MISSING 4
[[ "$SSH_PORT" =~ ^[0-9]+$ ]] && (( SSH_PORT >= 1 && SSH_PORT <= 65535 )) || die SSH_PORT_INVALID 4
[[ -s "$SSH_KEY_PATH" ]] || die SSH_KEY_MISSING 4

for required in \
  PC_PROD_P0_MAILBOX_EMAIL_TEMPLATE \
  PC_PROD_P0_MAILBOX_IMAP_HOST \
  PC_PROD_P0_MAILBOX_IMAP_USER \
  PC_PROD_P0_MAILBOX_IMAP_PASSWORD \
  PC_PROD_P0_STAFF_EMAIL \
  PC_PROD_P0_STAFF_PASSWORD \
  PC_PROD_P0_STAFF_TOTP_SECRET; do
  [[ -n "${!required:-}" ]] || die "PREREQUISITE_${required}_MISSING" 5
  printf '::add-mask::%s\n' "${!required}"
done
PC_PROD_P0_MAILBOX_IMAP_PORT="${PC_PROD_P0_MAILBOX_IMAP_PORT:-993}"
[[ "$PC_PROD_P0_MAILBOX_IMAP_PORT" =~ ^[0-9]+$ ]] || die MAILBOX_PORT_INVALID 5
[[ "$PC_PROD_P0_MAILBOX_EMAIL_TEMPLATE" == *'{run}'* && "$PC_PROD_P0_MAILBOX_EMAIL_TEMPLATE" == *'{slot}'* ]] \
  || die MAILBOX_TEMPLATE_INVALID 5

mkdir -p "$EVIDENCE_DIR"
chmod 700 "$EVIDENCE_DIR"

http_status() {
  local method="$1" jar="$2" url="$3" output="$4" expected="$5"
  shift 5
  local status
  status="$(curl --silent --show-error --max-time 30 \
    -X "$method" -b "$jar" -c "$jar" -A "$USER_AGENT" \
    -o "$output" -w '%{http_code}' "$@" "$url")"
  [[ "$status" == "$expected" ]] || {
    local code
    code="$(jq -r '.code // "HTTP_STATUS_MISMATCH"' "$output" 2>/dev/null || printf HTTP_STATUS_MISMATCH)"
    die "${code}_${status}_EXPECTED_${expected}" 10
  }
}

csrf_token() {
  local jar="$1" token
  token="$(awk -F $'\t' '$6 == "pc_csrf_token" { value=$7 } END { print value }' "$jar")"
  [[ "$token" =~ ^[0-9a-f]{48}$ ]] || die CSRF_COOKIE_MISSING 11
  printf '%s' "$token"
}

initialize_jar() {
  local jar="$1" page="${2:-/platform-v7/register}" body="$TMP_DIR/init-$(basename "$jar").html"
  : > "$jar"
  http_status GET "$jar" "$LIVE_BASE$page" "$body" 200
  csrf_token "$jar" >/dev/null
}

post_json() {
  local jar="$1" path="$2" payload="$3" output="$4" expected="$5" correlation="$6" idempotency="${7:-}"
  local csrf
  csrf="$(csrf_token "$jar")"
  local headers=(
    -H 'Content-Type: application/json'
    -H "Origin: $LIVE_BASE"
    -H "x-csrf-token: $csrf"
    -H "x-correlation-id: $correlation"
  )
  [[ -z "$idempotency" ]] || headers+=(-H "idempotency-key: $idempotency")
  http_status POST "$jar" "$LIVE_BASE$path" "$output" "$expected" "${headers[@]}" --data "$payload"
}

get_json() {
  local jar="$1" path="$2" output="$3" expected="$4" correlation="$5"
  http_status GET "$jar" "$LIVE_BASE$path" "$output" "$expected" \
    -H 'Accept: application/json' -H "x-correlation-id: $correlation"
}

render_email() {
  local slot="$1"
  PC_P0_SLOT="$slot" PC_P0_RUN="$RUN_KEY" python3 - <<'PY'
import os
template = os.environ['PC_PROD_P0_MAILBOX_EMAIL_TEMPLATE']
value = template.replace('{run}', os.environ['PC_P0_RUN']).replace('{slot}', os.environ['PC_P0_SLOT']).strip().lower()
if value.count('@') != 1 or len(value) > 254 or any(ch.isspace() for ch in value):
    raise SystemExit('invalid mailbox address template')
print(value)
PY
}

run_digits() {
  local slot="$1"
  PC_P0_SLOT="$slot" PC_P0_RUN="$RUN_KEY" python3 - <<'PY'
import hashlib, os
raw = hashlib.sha256(f"{os.environ['PC_P0_RUN']}:{os.environ['PC_P0_SLOT']}".encode()).hexdigest()
number = int(raw[:16], 16)
print(f"9{number % 10**11:011d}")
PY
}

mailbox_probe() {
  local mode="$1" slot="$2" email="$3" output="$4" minimum_uid="${5:-0}"
  PC_P0_MAIL_MODE="$mode" PC_P0_MAIL_SLOT="$slot" PC_P0_MAIL_TO="$email" \
  PC_P0_MAIL_OUTPUT="$output" PC_P0_MAIL_MIN_UID="$minimum_uid" PC_P0_LIVE_DOMAIN="$LIVE_DOMAIN" \
    python3 - <<'PY'
import email, html, imaplib, json, os, re, ssl, time
from email import policy
from email.header import decode_header, make_header
from urllib.parse import parse_qs, urlparse

host = os.environ['PC_PROD_P0_MAILBOX_IMAP_HOST']
port = int(os.environ.get('PC_PROD_P0_MAILBOX_IMAP_PORT', '993'))
user = os.environ['PC_PROD_P0_MAILBOX_IMAP_USER']
password = os.environ['PC_PROD_P0_MAILBOX_IMAP_PASSWORD']
target = os.environ['PC_P0_MAIL_TO']
mode = os.environ['PC_P0_MAIL_MODE']
minimum_uid = int(os.environ.get('PC_P0_MAIL_MIN_UID', '0'))
output = os.environ['PC_P0_MAIL_OUTPUT']
domain = os.environ['PC_P0_LIVE_DOMAIN']
deadline = time.time() + 600

def decoded_subject(message):
    try:
        return str(make_header(decode_header(message.get('Subject', ''))))
    except Exception:
        return ''

def message_text(message):
    values = []
    for part in message.walk():
        if part.get_content_maintype() == 'multipart':
            continue
        if part.get_content_type() not in ('text/plain', 'text/html'):
            continue
        try:
            values.append(part.get_content())
        except Exception:
            payload = part.get_payload(decode=True) or b''
            values.append(payload.decode(part.get_content_charset() or 'utf-8', errors='replace'))
    return html.unescape('\n'.join(values))

while time.time() < deadline:
    client = None
    try:
        client = imaplib.IMAP4_SSL(host, port, ssl_context=ssl.create_default_context())
        client.login(user, password)
        status, _ = client.select('INBOX', readonly=True)
        if status != 'OK':
            raise RuntimeError('mailbox select failed')
        status, data = client.uid('search', None, 'TO', f'"{target}"')
        if status != 'OK':
            raise RuntimeError('mailbox search failed')
        uids = sorted((int(item) for item in (data[0] or b'').split() if item.isdigit()), reverse=True)
        for uid in uids:
            if uid <= minimum_uid:
                continue
            status, fetched = client.uid('fetch', str(uid), '(RFC822)')
            if status != 'OK':
                continue
            raw = next((item[1] for item in fetched if isinstance(item, tuple) and isinstance(item[1], bytes)), None)
            if not raw:
                continue
            message = email.message_from_bytes(raw, policy=policy.default)
            subject = decoded_subject(message).lower()
            if mode == 'decision':
                if not any(marker in subject for marker in ('статус заявки', 'application status', '申请状态', '状态已更新')):
                    continue
                result = {'uid': uid, 'acknowledged': True}
            else:
                text = message_text(message)
                result = None
                for candidate in re.findall(r'https?://[^\s<>"\']+', text):
                    candidate = candidate.rstrip('.,);]')
                    parsed = urlparse(candidate)
                    query = parse_qs(parsed.query)
                    verify = (query.get('verify') or [''])[0]
                    status_token = (query.get('statusToken') or [''])[0]
                    if parsed.hostname == domain and parsed.path == '/platform-v7/register' and len(verify) >= 48 and status_token.startswith('rst_reg_'):
                        result = {'uid': uid, 'verifyToken': verify, 'statusToken': status_token}
                        break
                if result is None:
                    continue
            with open(output, 'w', encoding='utf-8') as handle:
                json.dump(result, handle, separators=(',', ':'))
            os.chmod(output, 0o600)
            client.logout()
            raise SystemExit(0)
        client.logout()
    except SystemExit:
        raise
    except Exception:
        try:
            if client is not None:
                client.logout()
        except Exception:
            pass
    time.sleep(10)
raise SystemExit('mailbox acknowledgement timeout')
PY
}

mailbox_assert_no_decision_after() {
  local slot="$1" email="$2" minimum_uid="$3" output="$4" window_seconds="${5:-120}"
  PC_P0_MAIL_SLOT="$slot" PC_P0_MAIL_TO="$email" PC_P0_MAIL_MIN_UID="$minimum_uid" \
  PC_P0_MAIL_OUTPUT="$output" PC_P0_MAIL_WINDOW_SECONDS="$window_seconds" \
    python3 - <<'PY'
import email, imaplib, json, os, ssl, time
from email import policy
from email.header import decode_header, make_header

host = os.environ['PC_PROD_P0_MAILBOX_IMAP_HOST']
port = int(os.environ.get('PC_PROD_P0_MAILBOX_IMAP_PORT', '993'))
user = os.environ['PC_PROD_P0_MAILBOX_IMAP_USER']
password = os.environ['PC_PROD_P0_MAILBOX_IMAP_PASSWORD']
target = os.environ['PC_P0_MAIL_TO']
minimum_uid = int(os.environ['PC_P0_MAIL_MIN_UID'])
output = os.environ['PC_P0_MAIL_OUTPUT']
window_seconds = int(os.environ['PC_P0_MAIL_WINDOW_SECONDS'])
if window_seconds < 120 or window_seconds > 300:
    raise SystemExit('invalid replay mailbox observation window')
deadline = time.time() + window_seconds
last_successful_poll = 0.0
markers = ('статус заявки', 'application status', '申请状态', '状态已更新')

def decoded_subject(message):
    try:
        return str(make_header(decode_header(message.get('Subject', '')))).lower()
    except Exception:
        return ''

while time.time() < deadline:
    client = None
    try:
        client = imaplib.IMAP4_SSL(host, port, ssl_context=ssl.create_default_context())
        client.login(user, password)
        status, _ = client.select('INBOX', readonly=True)
        if status != 'OK':
            raise RuntimeError('mailbox select failed')
        status, data = client.uid('search', None, 'TO', f'"{target}"')
        if status != 'OK':
            raise RuntimeError('mailbox search failed')
        uids = sorted(int(item) for item in (data[0] or b'').split() if item.isdigit())
        for uid in uids:
            if uid <= minimum_uid:
                continue
            status, fetched = client.uid('fetch', str(uid), '(RFC822)')
            if status != 'OK':
                raise RuntimeError('mailbox fetch failed')
            raw = next((item[1] for item in fetched if isinstance(item, tuple) and isinstance(item[1], bytes)), None)
            if raw is None:
                raise RuntimeError('mailbox message missing')
            message = email.message_from_bytes(raw, policy=policy.default)
            if any(marker in decoded_subject(message) for marker in markers):
                raise SystemExit('duplicate decision notification detected after exact replay')
        last_successful_poll = time.time()
        client.logout()
    except SystemExit:
        raise
    except Exception:
        try:
            if client is not None:
                client.logout()
        except Exception:
            pass
    remaining = deadline - time.time()
    if remaining > 0:
        time.sleep(min(10, remaining))

if last_successful_poll == 0 or time.time() - last_successful_poll > 20:
    raise SystemExit('mailbox unavailable at end of replay observation window')
with open(output, 'w', encoding='utf-8') as handle:
    json.dump({
        'afterUid': minimum_uid,
        'windowSeconds': window_seconds,
        'duplicateDecisionNotification': False,
    }, handle, separators=(',', ':'))
os.chmod(output, 0o600)
PY
}

totp_code() {
  local secret="$1"
  PC_P0_TOTP_SECRET="$secret" python3 - <<'PY'
import base64, hashlib, hmac, os, struct, time
secret = ''.join(os.environ['PC_P0_TOTP_SECRET'].split()).upper()
secret += '=' * ((8 - len(secret) % 8) % 8)
key = base64.b32decode(secret, casefold=True)
counter = int(time.time()) // 30
digest = hmac.new(key, struct.pack('>Q', counter), hashlib.sha1).digest()
offset = digest[-1] & 15
value = (struct.unpack('>I', digest[offset:offset + 4])[0] & 0x7fffffff) % 1000000
print(f'{value:06d}')
PY
}

wait_totp_window() {
  local remainder delay
  remainder=$(( $(date +%s) % 30 ))
  if (( remainder > 20 )); then
    delay=$(( 31 - remainder ))
    sleep "$delay"
  fi
}

complete_login() {
  local kind="$1" jar="$2" email="$3" password="$4" configured_secret="$5" me_output="$6" secret_output="$7"
  local response="$TMP_DIR/${kind}-login.json" select_response="$TMP_DIR/${kind}-select.json"
  local membership_id secret code payload
  initialize_jar "$jar" '/platform-v7/login'
  payload="$(jq -cn --arg email "$email" --arg password "$password" '{email:$email,password:$password}')"
  post_json "$jar" '/api/auth/login' "$payload" "$response" 200 "p0-login-$kind-$RUN_KEY"
  jq -e '.ok == true' "$response" >/dev/null || die "${kind}_LOGIN_FAILED" 20

  if [[ "$(jq -r '.membershipSelectionRequired // false' "$response")" == true ]]; then
    membership_id="$(jq -r '([.memberships[] | select(.isOrgAdmin == true) | .membershipId][0] // .memberships[0].membershipId // empty)' "$response")"
    [[ -n "$membership_id" ]] || die "${kind}_MEMBERSHIP_SELECTION_MISSING" 20
    payload="$(jq -cn --arg membershipId "$membership_id" '{membershipId:$membershipId}')"
    post_json "$jar" '/api/auth/membership-select' "$payload" "$select_response" 200 "p0-membership-$kind-$RUN_KEY"
    mv "$select_response" "$response"
  fi

  jq -e '.ok == true and .mfaRequired == true' "$response" >/dev/null || die "${kind}_FRESH_MFA_REQUIRED" 21
  if [[ "$kind" == staff ]]; then
    jq -e '.enrollmentRequired == false' "$response" >/dev/null || die STAFF_MFA_PREREQUISITE_INVALID 21
    secret="$configured_secret"
  else
    secret="$(jq -r '.setupSecret // empty' "$response")"
    [[ -n "$secret" ]] || die "${kind}_MFA_ENROLLMENT_SECRET_MISSING" 21
  fi
  printf '::add-mask::%s\n' "$secret"
  printf '%s' "$secret" > "$secret_output"
  chmod 600 "$secret_output"
  wait_totp_window
  code="$(totp_code "$secret")"
  printf '::add-mask::%s\n' "$code"
  payload="$(jq -cn --arg code "$code" '{code:$code}')"
  post_json "$jar" '/api/auth/mfa-login' "$payload" "$TMP_DIR/${kind}-mfa.json" 200 "p0-mfa-$kind-$RUN_KEY"
  jq -e '.ok == true' "$TMP_DIR/${kind}-mfa.json" >/dev/null || die "${kind}_MFA_FAILED" 21
  get_json "$jar" '/api/auth/me' "$me_output" 200 "p0-me-$kind-$RUN_KEY"
  jq -e '.authenticated == true and (.id | type == "string") and (.tenantId | type == "string") and (.orgId | type == "string")' "$me_output" >/dev/null \
    || die "${kind}_IDENTITY_CONTEXT_INVALID" 22
}

relogin_customer() {
  local kind="$1" jar="$2" email="$3" password="$4" secret="$5" me_output="$6"
  local response="$TMP_DIR/${kind}-relogin.json" payload code
  initialize_jar "$jar" '/platform-v7/login'
  payload="$(jq -cn --arg email "$email" --arg password "$password" '{email:$email,password:$password}')"
  post_json "$jar" '/api/auth/login' "$payload" "$response" 200 "p0-relogin-$kind-$RUN_KEY"
  jq -e '.ok == true and .mfaRequired == true and .enrollmentRequired == false' "$response" >/dev/null \
    || die "${kind}_RELOGIN_MFA_CONTRACT_FAILED" 23
  sleep "$((31 - $(date +%s) % 30))"
  code="$(totp_code "$secret")"
  printf '::add-mask::%s\n' "$code"
  payload="$(jq -cn --arg code "$code" '{code:$code}')"
  post_json "$jar" '/api/auth/mfa-login' "$payload" "$TMP_DIR/${kind}-relogin-mfa.json" 200 "p0-relogin-mfa-$kind-$RUN_KEY"
  jq -e '.ok == true' "$TMP_DIR/${kind}-relogin-mfa.json" >/dev/null || die "${kind}_RELOGIN_MFA_FAILED" 23
  get_json "$jar" '/api/auth/me' "$me_output" 200 "p0-relogin-me-$kind-$RUN_KEY"
  jq -e '.authenticated == true' "$me_output" >/dev/null || die "${kind}_RELOGIN_CONTEXT_FAILED" 23
}

jwt_claims() {
  local jar="$1" me_file="$2" token
  token="$(awk -F $'\t' '$6 == "pc_access_token" { value=$7 } END { print value }' "$jar")"
  [[ -n "$token" ]] || die ACCESS_TOKEN_COOKIE_MISSING 24
  PC_P0_ACCESS_TOKEN="$token" PC_P0_ME_FILE="$me_file" python3 - <<'PY'
import base64, json, os
parts = os.environ['PC_P0_ACCESS_TOKEN'].split('.')
if len(parts) != 3:
    raise SystemExit('invalid access token shape')
payload = parts[1] + '=' * ((4 - len(parts[1]) % 4) % 4)
claims = json.loads(base64.urlsafe_b64decode(payload.encode()))
with open(os.environ['PC_P0_ME_FILE'], encoding='utf-8') as handle:
    me = json.load(handle)
if claims.get('sub') != me.get('id') or not isinstance(claims.get('sid'), str) or not claims['sid']:
    raise SystemExit('session claim mismatch')
print(json.dumps({'sub': claims['sub'], 'sid': claims['sid']}, separators=(',', ':')))
PY
}

printf '%s\n' "$TARGET_SHA" > "$EVIDENCE_DIR/target-sha.txt"
ready_file="$TMP_DIR/ready.json"
empty_jar="$TMP_DIR/public.cookies"
: > "$empty_jar"
http_status GET "$empty_jar" "$LIVE_BASE/api/health/ready?acceptance=$RUN_KEY" "$ready_file" 200 \
  -H 'Cache-Control: no-cache, no-store, max-age=0'
jq -e --arg sha "$TARGET_SHA" '.status == "ok" and .service == "web" and .releaseAuthority == "exact-sha" and .revision == $sha' "$ready_file" >/dev/null \
  || die LIVE_WEB_REVISION_MISMATCH 25

EMAIL_A="$(render_email a)"
EMAIL_B="$(render_email b)"
[[ "$EMAIL_A" != "$EMAIL_B" ]] || die MAILBOX_IDENTITIES_NOT_UNIQUE 26
PASSWORD_A="Aa9!$(openssl rand -hex 20)"
PASSWORD_B="Bb9!$(openssl rand -hex 20)"
for secret in "$EMAIL_A" "$EMAIL_B" "$PASSWORD_A" "$PASSWORD_B"; do printf '::add-mask::%s\n' "$secret"; done
INN_A="$(run_digits a)"
INN_B="$(run_digits b)"
[[ "$INN_A" != "$INN_B" ]] || die REGISTRATION_INN_COLLISION 26

declare -A EMAIL=( [a]="$EMAIL_A" [b]="$EMAIL_B" )
declare -A PASSWORD=( [a]="$PASSWORD_A" [b]="$PASSWORD_B" )
declare -A INN=( [a]="$INN_A" [b]="$INN_B" )
declare -A APPLICATION_ID STATUS_TOKEN VERIFY_UID DECISION_CORRELATION DECISION_KEY

for slot in a b; do
  jar="$TMP_DIR/register-$slot.cookies"
  initialize_jar "$jar"
  phone_suffix="${INN[$slot]: -9}"
  registration_payload="$(jq -cn \
    --arg email "${EMAIL[$slot]}" --arg phone "+79$phone_suffix" \
    --arg fullName "Production Acceptance $slot" --arg position 'Руководитель' \
    --arg orgLegalName "P0 Acceptance $RUN_KEY $slot" --arg inn "${INN[$slot]}" \
    --arg password "${PASSWORD[$slot]}" \
    '{email:$email,phone:$phone,fullName:$fullName,position:$position,orgLegalName:$orgLegalName,orgInn:$inn,orgType:"INDIVIDUAL",region:"Тестовый производственный контур",workspace:"seller",password:$password,termsVersion:"2026-07-31",privacyVersion:"2026-07-31",acceptTerms:true,acceptPrivacy:true,locale:"ru"}')"
  register_response="$TMP_DIR/register-$slot.json"
  post_json "$jar" '/api/auth/register' "$registration_payload" "$register_response" 202 \
    "p0-register-$slot-$RUN_KEY" "p0-register-$slot-$RUN_KEY"
  jq -e '.accepted == true and .status == "EMAIL_VERIFICATION_REQUIRED" and .nextAction == "VERIFY_EMAIL" and (has("applicationId") | not) and (has("statusToken") | not)' "$register_response" >/dev/null \
    || die "REGISTRATION_${slot}_PUBLIC_RESPONSE_INVALID" 27

  mail_file="$TMP_DIR/mail-$slot.json"
  mailbox_probe registration "$slot" "${EMAIL[$slot]}" "$mail_file"
  VERIFY_UID[$slot]="$(jq -r '.uid' "$mail_file")"
  verify_token="$(jq -r '.verifyToken' "$mail_file")"
  STATUS_TOKEN[$slot]="$(jq -r '.statusToken' "$mail_file")"
  printf '::add-mask::%s\n' "$verify_token"
  printf '::add-mask::%s\n' "${STATUS_TOKEN[$slot]}"
  verify_payload="$(jq -cn --arg token "$verify_token" '{token:$token,locale:"ru"}')"
  verify_response="$TMP_DIR/verify-$slot.json"
  post_json "$jar" '/api/auth/registration/verify' "$verify_payload" "$verify_response" 200 "p0-verify-$slot-$RUN_KEY"
  jq -e --arg token "${STATUS_TOKEN[$slot]}" '.ok == true and .status == "ORGANIZATION_VERIFICATION_PENDING" and .statusToken == $token and (.applicationId | type == "string")' "$verify_response" >/dev/null \
    || die "REGISTRATION_${slot}_VERIFY_FAILED" 28
  APPLICATION_ID[$slot]="$(jq -r '.applicationId' "$verify_response")"
  post_json "$jar" '/api/auth/registration/verify' "$verify_payload" "$TMP_DIR/verify-replay-$slot.json" 400 "p0-verify-replay-$slot-$RUN_KEY"
  jq -e '.ok == false and .code == "REGISTRATION_EMAIL_TOKEN_INVALID"' "$TMP_DIR/verify-replay-$slot.json" >/dev/null \
    || die "REGISTRATION_${slot}_TOKEN_REPLAY_NOT_REJECTED" 28
  get_json "$jar" "/api/auth/registration/status?token=${STATUS_TOKEN[$slot]}" "$TMP_DIR/status-pending-$slot.json" 200 "p0-status-pending-$slot-$RUN_KEY"
  jq -e --arg app "${APPLICATION_ID[$slot]}" '.ok == true and .applicationId == $app and .status == "ORGANIZATION_VERIFICATION_PENDING"' "$TMP_DIR/status-pending-$slot.json" >/dev/null \
    || die "REGISTRATION_${slot}_PENDING_STATUS_FAILED" 28
done

[[ "${APPLICATION_ID[a]}" != "${APPLICATION_ID[b]}" ]] || die REGISTRATION_APPLICATION_COLLISION 29

complete_login staff "$STAFF_JAR" "$PC_PROD_P0_STAFF_EMAIL" "$PC_PROD_P0_STAFF_PASSWORD" \
  "$PC_PROD_P0_STAFF_TOTP_SECRET" "$TMP_DIR/staff-me.json" "$TMP_DIR/staff-secret"
jq -e '
  .mfaVerified == true
  and (.mfaVerifiedAt | type == "string")
' "$TMP_DIR/staff-me.json" >/dev/null || die STAFF_OWNER_FRESH_MFA_CONTEXT_MISSING 30

get_json "$STAFF_JAR" '/api/staff/assignments/me' "$TMP_DIR/staff-assignments.json" 200 "p0-staff-assignments-$RUN_KEY"
assignment_id="$(jq -r '[.[] | select(.role == "PLATFORM_OWNER") | .id][0] // empty' "$TMP_DIR/staff-assignments.json")"
[[ -n "$assignment_id" ]] || die STAFF_OWNER_ASSIGNMENT_MISSING 30
staff_request_payload="$(jq -cn --arg assignmentId "$assignment_id" --arg ticketId "P0-$RUN_KEY" \
  '{assignmentId:$assignmentId,accessMode:"CONTROL_PLANE",permissions:["staff-request:read","staff-request:approve"],reason:"Production P0 registration acceptance",ticketId:$ticketId,durationSeconds:1800}')"
post_json "$STAFF_JAR" '/api/staff/access/requests' "$staff_request_payload" "$TMP_DIR/staff-request.json" 201 "p0-staff-request-$RUN_KEY"
jq -e '.status == "GRANTED" and (.grantId | type == "string")' "$TMP_DIR/staff-request.json" >/dev/null \
  || die STAFF_PROTECTED_GRANT_MISSING 31
grant_id="$(jq -r '.grantId' "$TMP_DIR/staff-request.json")"
post_json "$STAFF_JAR" "/api/staff/access/grants/$grant_id/activate" '{}' "$TMP_DIR/staff-activate.json" 201 "p0-staff-activate-$RUN_KEY"
jq -e '
  (.accessSessionId | type == "string")
  and .accessMode == "CONTROL_PLANE"
  and (.permissions | index("staff-request:read") != null)
  and (.permissions | index("staff-request:approve") != null)
' "$TMP_DIR/staff-activate.json" >/dev/null || die STAFF_PROTECTED_SESSION_ACTIVATION_FAILED 31
STAFF_SESSION_ID="$(jq -r '.accessSessionId' "$TMP_DIR/staff-activate.json")"
get_json "$STAFF_JAR" '/api/staff/session-context' "$TMP_DIR/staff-context.json" 200 "p0-staff-context-$RUN_KEY"
jq -e --arg session "$STAFF_SESSION_ID" '
  .active == true and .session.accessSessionId == $session
  and (.session.permissions | index("staff-request:approve") != null)
' "$TMP_DIR/staff-context.json" >/dev/null || die STAFF_PROTECTED_SESSION_NOT_VERIFIED 31

get_json "$STAFF_JAR" '/api/staff/registration/applications' "$TMP_DIR/staff-queue.json" 200 "p0-staff-queue-$RUN_KEY"
DECISION_REPLAY_PROVED=0
decision_payload="$(jq -cn '{decision:"APPROVE",reason:"Production P0 first-customer acceptance",locale:"ru"}')"
for slot in a b; do
  jq -e --arg app "${APPLICATION_ID[$slot]}" '.applications | any(.applicationId == $app and .status == "ORGANIZATION_VERIFICATION_PENDING")' "$TMP_DIR/staff-queue.json" >/dev/null \
    || die "REGISTRATION_${slot}_NOT_IN_STAFF_QUEUE" 32
  DECISION_CORRELATION[$slot]="p0-decision-$slot-$RUN_KEY"
  DECISION_KEY[$slot]="p0-decision-idempotency-$slot-$RUN_KEY"
  post_json "$STAFF_JAR" "/api/staff/registration/applications/${APPLICATION_ID[$slot]}/decision" \
    "$decision_payload" "$TMP_DIR/decision-$slot.json" 201 "${DECISION_CORRELATION[$slot]}" "${DECISION_KEY[$slot]}"
  jq -e --arg app "${APPLICATION_ID[$slot]}" --arg correlation "${DECISION_CORRELATION[$slot]}" '
    .applicationId == $app and .status == "ACTIVATED" and .nextAction == "LOGIN"
    and .replayed == false and .notificationDelivered == true and .correlationId == $correlation
  ' "$TMP_DIR/decision-$slot.json" >/dev/null || die "REGISTRATION_${slot}_STAFF_DECISION_FAILED" 33
  get_json "$TMP_DIR/register-$slot.cookies" "/api/auth/registration/status?token=${STATUS_TOKEN[$slot]}" "$TMP_DIR/status-active-$slot.json" 200 "p0-status-active-$slot-$RUN_KEY"
  jq -e --arg app "${APPLICATION_ID[$slot]}" '.ok == true and .applicationId == $app and .status == "ACTIVATED" and .nextAction == "LOGIN"' "$TMP_DIR/status-active-$slot.json" >/dev/null \
    || die "REGISTRATION_${slot}_ACTIVATED_STATUS_FAILED" 33
done

# Complete both privileged decisions inside the same fresh-MFA window before
# waiting on asynchronous mailbox delivery. For slot A, acknowledge the first
# decision email before the exact replay, then fail if a newer matching UID
# appears during a bounded post-replay observation window.
mailbox_probe decision a "${EMAIL[a]}" "$TMP_DIR/decision-mail-a.json" "${VERIFY_UID[a]}"
jq -e '.acknowledged == true and (.uid | type == "number")' "$TMP_DIR/decision-mail-a.json" >/dev/null \
  || die REGISTRATION_A_DECISION_MAIL_NOT_ACKNOWLEDGED 33
first_decision_uid_a="$(jq -r '.uid' "$TMP_DIR/decision-mail-a.json")"

replay_correlation="p0-decision-replay-a-$RUN_KEY"
post_json "$STAFF_JAR" "/api/staff/registration/applications/${APPLICATION_ID[a]}/decision" \
  "$decision_payload" "$TMP_DIR/decision-replay-a.json" 201 "$replay_correlation" "${DECISION_KEY[a]}"
jq -e --arg app "${APPLICATION_ID[a]}" --arg correlation "$replay_correlation" '
  .applicationId == $app and .status == "ACTIVATED" and .nextAction == "LOGIN"
  and .replayed == true and (has("notificationDelivered") | not) and .correlationId == $correlation
' "$TMP_DIR/decision-replay-a.json" >/dev/null || die REGISTRATION_DECISION_REPLAY_NOTIFICATION_NOT_SUPPRESSED 33

mailbox_assert_no_decision_after a "${EMAIL[a]}" "$first_decision_uid_a" \
  "$EVIDENCE_DIR/decision-replay-mailbox.json" 120 \
  || die REGISTRATION_DECISION_REPLAY_DUPLICATE_MAIL_DETECTED 33
jq -e --argjson uid "$first_decision_uid_a" '
  .afterUid == $uid and .windowSeconds >= 120 and .duplicateDecisionNotification == false
' "$EVIDENCE_DIR/decision-replay-mailbox.json" >/dev/null \
  || die REGISTRATION_DECISION_REPLAY_MAILBOX_PROOF_INVALID 33
DECISION_REPLAY_PROVED=1
(( DECISION_REPLAY_PROVED == 1 )) || die REGISTRATION_DECISION_REPLAY_NOT_PROVED 33

mailbox_probe decision b "${EMAIL[b]}" "$TMP_DIR/decision-mail-b.json" "${VERIFY_UID[b]}"
jq -e '.acknowledged == true' "$TMP_DIR/decision-mail-b.json" >/dev/null \
  || die REGISTRATION_B_DECISION_MAIL_NOT_ACKNOWLEDGED 33

declare -A CUSTOMER_JAR CUSTOMER_ME CUSTOMER_SECRET
for slot in a b; do
  CUSTOMER_JAR[$slot]="$TMP_DIR/customer-$slot.cookies"
  CUSTOMER_ME[$slot]="$TMP_DIR/customer-$slot-me.json"
  CUSTOMER_SECRET[$slot]="$TMP_DIR/customer-$slot-secret"
  complete_login "customer-$slot" "${CUSTOMER_JAR[$slot]}" "${EMAIL[$slot]}" "${PASSWORD[$slot]}" '' \
    "${CUSTOMER_ME[$slot]}" "${CUSTOMER_SECRET[$slot]}"
  jq -e '.role == "FARMER" and .surfaceRole == "seller" and .mfaVerified == true' "${CUSTOMER_ME[$slot]}" >/dev/null \
    || die "CUSTOMER_${slot}_SELLER_CONTEXT_FAILED" 34
  http_status GET "${CUSTOMER_JAR[$slot]}" "$LIVE_BASE/platform-v7/seller" "$TMP_DIR/cabinet-$slot.html" 200 \
    -H 'Cache-Control: no-cache, no-store, max-age=0'
done

tenant_a="$(jq -r '.tenantId' "${CUSTOMER_ME[a]}")"
tenant_b="$(jq -r '.tenantId' "${CUSTOMER_ME[b]}")"
org_a="$(jq -r '.orgId' "${CUSTOMER_ME[a]}")"
org_b="$(jq -r '.orgId' "${CUSTOMER_ME[b]}")"
[[ "$tenant_a" != "$tenant_b" && "$org_a" != "$org_b" ]] || die CUSTOMER_TENANT_ISOLATION_NOT_DISTINCT 35

auction_end="$(date -u -d '+2 hours' +%Y-%m-%dT%H:%M:%SZ)"
lot_payload="$(jq -cn --arg end "$auction_end" --arg run "$RUN_KEY" \
  '{title:("Production P0 wheat " + $run),culture:"wheat",grade:"3",volumeTons:"10.000000",startPriceKopecksPerTon:"1500000",stepPriceKopecksPerTon:"10000",region:"Production acceptance",address:"Verified acceptance location",auctionEndsAt:$end,sourceType:"OTHER",sourceExternalId:("p0:" + $run),autoExtendEnabled:true,autoExtendWindowMinutes:10,autoExtendMinutes:10,idempotencyKey:("p0-lot:" + $run)}')"
post_json "${CUSTOMER_JAR[a]}" '/api/proxy/auctions/lots' "$lot_payload" "$TMP_DIR/lot-create.json" 201 "p0-lot-$RUN_KEY"
jq -e '.status == "BIDDING" and (.lotId | type == "string") and (.auditId | type == "string") and (.outboxId | type == "string")' "$TMP_DIR/lot-create.json" >/dev/null \
  || die CUSTOMER_A_NAMED_ACTION_FAILED 36
lot_id="$(jq -r '.lotId' "$TMP_DIR/lot-create.json")"
get_json "${CUSTOMER_JAR[a]}" "/api/proxy/auctions/lots/$lot_id/workspace" "$TMP_DIR/lot-a.json" 200 "p0-lot-read-a-$RUN_KEY"
get_json "${CUSTOMER_JAR[b]}" "/api/proxy/auctions/lots/$lot_id/workspace" "$TMP_DIR/lot-b.json" 404 "p0-lot-read-b-$RUN_KEY"
jq -e '.code == "AUCTION_LOT_NOT_ACCESSIBLE"' "$TMP_DIR/lot-b.json" >/dev/null || die CUSTOMER_B_KNOWN_RESOURCE_DENIAL_FAILED 37

for slot in a b; do
  post_json "${CUSTOMER_JAR[$slot]}" '/api/auth/logout' '{}' "$TMP_DIR/logout-$slot.json" 200 "p0-logout-$slot-$RUN_KEY"
  jq -e '.ok == true' "$TMP_DIR/logout-$slot.json" >/dev/null || die "CUSTOMER_${slot}_LOGOUT_FAILED" 38
  get_json "${CUSTOMER_JAR[$slot]}" '/api/auth/me' "$TMP_DIR/logged-out-$slot.json" 401 "p0-logged-out-$slot-$RUN_KEY"
  jq -e '.authenticated == false and .code == "UNAUTHENTICATED"' "$TMP_DIR/logged-out-$slot.json" >/dev/null \
    || die "CUSTOMER_${slot}_SESSION_NOT_REVOKED" 38
  relogin_customer "customer-$slot" "${CUSTOMER_JAR[$slot]}" "${EMAIL[$slot]}" "${PASSWORD[$slot]}" \
    "$(cat "${CUSTOMER_SECRET[$slot]}")" "${CUSTOMER_ME[$slot]}"
done

claims_a="$(jwt_claims "${CUSTOMER_JAR[a]}" "${CUSTOMER_ME[a]}")"
claims_b="$(jwt_claims "${CUSTOMER_JAR[b]}" "${CUSTOMER_ME[b]}")"
sid_a="$(jq -r '.sid' <<< "$claims_a")"
sid_b="$(jq -r '.sid' <<< "$claims_b")"
printf '::add-mask::%s\n' "$sid_a"
printf '::add-mask::%s\n' "$sid_b"

context_json="$(jq -cn \
  --arg lotId "$lot_id" \
  --arg aUser "$(jq -r '.id' "${CUSTOMER_ME[a]}")" --arg aOrg "$org_a" \
  --arg aTenant "$tenant_a" --arg aRole "$(jq -r '.role' "${CUSTOMER_ME[a]}")" --arg aSession "$sid_a" \
  --arg bUser "$(jq -r '.id' "${CUSTOMER_ME[b]}")" --arg bOrg "$org_b" \
  --arg bTenant "$tenant_b" --arg bRole "$(jq -r '.role' "${CUSTOMER_ME[b]}")" --arg bSession "$sid_b" \
  --arg appA "${APPLICATION_ID[a]}" --arg correlationA "${DECISION_CORRELATION[a]}" \
  --arg appB "${APPLICATION_ID[b]}" --arg correlationB "${DECISION_CORRELATION[b]}" \
  '{lotId:$lotId,actors:{a:{userId:$aUser,orgId:$aOrg,tenantId:$aTenant,role:$aRole,sessionId:$aSession},b:{userId:$bUser,orgId:$bOrg,tenantId:$bTenant,role:$bRole,sessionId:$bSession}},applications:[{applicationId:$appA,correlationId:$correlationA},{applicationId:$appB,correlationId:$correlationB}]}')"

scp -i "$SSH_KEY_PATH" -P "$SSH_PORT" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15 \
  "$0" "$SSH_USER@$SSH_HOST:$REMOTE_SCRIPT" >/dev/null
REMOTE_ASSET_COPIED=1
remote_result="$TMP_DIR/remote-result.json"
printf '%s' "$context_json" | ssh -i "$SSH_KEY_PATH" -p "$SSH_PORT" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15 \
  "$SSH_USER@$SSH_HOST" "chmod 0700 '$REMOTE_SCRIPT' && '$REMOTE_SCRIPT' remote-proof '$TARGET_SHA'" > "$remote_result"
jq -e --arg sha "$TARGET_SHA" '
  .result == "PASS" and .targetSha == $sha and .apiRevision == $sha and .webRevision == $sha and .migrationRevision == $sha
  and .rls.result == "PASS" and .rls.actorAVisibleRows == 1 and .rls.actorBVisibleRows == 0
  and .lifecycle.result == "PASS" and (.lifecycle.receipts | length == 2)
' "$remote_result" >/dev/null || die REMOTE_PRODUCTION_PROOF_FAILED 39

post_json "$STAFF_JAR" "/api/staff/access/sessions/$STAFF_SESSION_ID/end" \
  '{"reason":"Production P0 acceptance completed"}' "$TMP_DIR/staff-end.json" 201 "p0-staff-end-$RUN_KEY"
STAFF_SESSION_ID=''
post_json "$STAFF_JAR" '/api/auth/logout' '{}' "$TMP_DIR/staff-logout.json" 200 "p0-staff-logout-$RUN_KEY"

jq -n \
  --arg targetSha "$TARGET_SHA" --arg runKey "$RUN_KEY" --arg lotId "$lot_id" \
  --arg lotAuditId "$(jq -r '.auditId' "$TMP_DIR/lot-create.json")" \
  --arg lotOutboxId "$(jq -r '.outboxId' "$TMP_DIR/lot-create.json")" \
  --arg applicationA "${APPLICATION_ID[a]}" --arg applicationB "${APPLICATION_ID[b]}" \
  --arg decisionCorrelationA "${DECISION_CORRELATION[a]}" --arg decisionCorrelationB "${DECISION_CORRELATION[b]}" \
  --arg emailHashA "$(printf '%s' "$EMAIL_A" | sha256sum | cut -d' ' -f1)" \
  --arg emailHashB "$(printf '%s' "$EMAIL_B" | sha256sum | cut -d' ' -f1)" \
  --argjson replayMailbox "$(cat "$EVIDENCE_DIR/decision-replay-mailbox.json")" \
  --argjson remote "$(cat "$remote_result")" \
  '{schemaVersion:"production.p0.first-customer.acceptance.v1",result:"PASS",targetSha:$targetSha,runKey:$runKey,decisionReplayNotification:"PASS",decisionReplayMailbox:$replayMailbox,registrations:[{slot:"A",applicationId:$applicationA,decisionCorrelationId:$decisionCorrelationA,emailSha256:$emailHashA,status:"ACTIVATED",mailboxAcknowledged:true,logoutRelogin:"PASS"},{slot:"B",applicationId:$applicationB,decisionCorrelationId:$decisionCorrelationB,emailSha256:$emailHashB,status:"ACTIVATED",mailboxAcknowledged:true,logoutRelogin:"PASS"}],namedAction:{kind:"auction.lot.register",lotId:$lotId,auditId:$lotAuditId,outboxId:$lotOutboxId,ownerRead:"PASS",crossTenantBffDenial:"AUCTION_LOT_NOT_ACCESSIBLE"},productionProof:$remote}' \
  > "$EVIDENCE_DIR/acceptance.json"
chmod 600 "$EVIDENCE_DIR/acceptance.json"
jq -e '.result == "PASS" and .decisionReplayNotification == "PASS" and .decisionReplayMailbox.windowSeconds >= 120 and .decisionReplayMailbox.duplicateDecisionNotification == false and (.registrations | length == 2) and .productionProof.lifecycle.result == "PASS"' "$EVIDENCE_DIR/acceptance.json" >/dev/null

printf 'P0_TWO_REGISTRATIONS=PASS\n'
printf 'P0_TRANSACTIONAL_MAIL=PASS\n'
printf 'P0_DECISION_REPLAY_NOTIFICATION=PASS\n'
printf 'P0_STAFF_MFA_AND_PROTECTED_SESSION=PASS\n'
printf 'P0_CABINET_ACTION_LOGOUT_RELOGIN=PASS\n'
printf 'P0_TENANT_RLS=PASS\n'
printf 'P0_CAUSAL_AUDIT_OUTBOX=PASS\n'
printf 'P0_FIRST_CUSTOMER_ACCEPTANCE=PASS\n'
