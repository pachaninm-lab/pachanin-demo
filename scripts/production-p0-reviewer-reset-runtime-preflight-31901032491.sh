#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_REVIEWER_RESET_RUNTIME_PREFLIGHT_COMMAND:?PC_REVIEWER_RESET_RUNTIME_PREFLIGHT_COMMAND is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-reviewer-reset-runtime-preflight 31901032491 current-main'
RESET_RUN_ID='31901032491'
RESET_REVISION='056ed4461dafb5e7dab2efc9ea5a0d5877523169'
EXPECTED_PUBLIC_SITE='https://xn----8sbjf4befbjgs9b.xn--p1ai'

key_path="$RUNNER_TEMP/pc-p0-reviewer-reset-runtime-preflight-key"
known_hosts="$RUNNER_TEMP/pc-p0-reviewer-reset-runtime-preflight-known-hosts"
SOURCE_SHA='unknown'
CURRENT_MAIN='unknown'
scan=''
match=''
result_published=0

cleanup() {
  rm -f -- "$key_path" "$known_hosts"
  [[ -z "$scan" ]] || rm -f -- "$scan"
  [[ -z "$match" ]] || rm -f -- "$match"
}
trap cleanup EXIT

publish_failure() {
  local rc="$?"
  trap - ERR
  if [[ "$result_published" == '0' ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset runtime preflight

- source reset run: \`$RESET_RUN_ID\`
- diagnostic main: \`$SOURCE_SHA\`
- reset revision: \`$RESET_REVISION\`
- result: \`FAIL_CLOSED\`
- secret values / database rows / raw Docker output: \`NOT_PUBLISHED\`
- reset replay / mail send: \`NONE\`
- production mutation: \`NONE\`
- exit code: \`$rc\`" >/dev/null || true
  fi
  exit "$rc"
}
trap publish_failure ERR

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

guard_main() {
  local remote_main
  remote_main="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
  [[ "$remote_main" == "$CURRENT_MAIN" ]]
  git fetch --no-tags origin main >/dev/null
  [[ "$(git rev-parse origin/main)" == "$CURRENT_MAIN" ]]
}

[[ "$PC_REVIEWER_RESET_RUNTIME_PREFLIGHT_COMMAND" == "$COMMAND" ]]
SOURCE_SHA="$(git rev-parse HEAD)"
CURRENT_MAIN="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$SOURCE_SHA" == "$CURRENT_MAIN" && "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse origin/main)" == "$CURRENT_MAIN" ]]
git merge-base --is-ancestor "$RESET_REVISION" "$CURRENT_MAIN"
[[ -z "$(git status --porcelain=v1)" ]]

host="$(trim "${PC_PROD_HOST:-$DEFAULT_HOST}")"
user="$(trim "${PC_PROD_SSH_USER:-}")"
port="$(trim "${PC_PROD_SSH_PORT:-22}")"
expected="$(trim "${PC_PROD_SSH_HOST_FINGERPRINT:-}")"
[[ "$host" == "$DEFAULT_HOST" ]]
[[ -n "$user" && "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]
[[ "$port" =~ ^[0-9]+$ ]] && (( port >= 1 && port <= 65535 ))
[[ "$expected" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]

validate_key() {
  local source="$1" public_key
  tr -d '\r' < "$source" > "$key_path"
  chmod 0600 "$key_path"
  grep -Eq '^(ssh-|ecdsa-|sk-)' "$key_path" && return 1
  public_key="$(mktemp)"
  ssh-keygen -y -P '' -f "$key_path" > "$public_key" 2>/dev/null || { rm -f "$public_key"; return 1; }
  rm -f "$public_key"
}

try_key() {
  local raw="$1" plain escaped decoded
  [[ -n "$raw" ]] || return 1
  plain="$(mktemp)"; escaped="$(mktemp)"; decoded="$(mktemp)"
  printf '%s\n' "$raw" > "$plain"
  validate_key "$plain" && { rm -f "$plain" "$escaped" "$decoded"; return 0; }
  printf '%s' "${raw//\\n/$'\n'}" > "$escaped"
  validate_key "$escaped" && { rm -f "$plain" "$escaped" "$decoded"; return 0; }
  printf '%s' "$raw" | base64 --decode > "$decoded" 2>/dev/null \
    && validate_key "$decoded" \
    && { rm -f "$plain" "$escaped" "$decoded"; return 0; }
  rm -f "$plain" "$escaped" "$decoded"
  return 1
}

try_key "${PC_PROD_SSH_KEY:-}" \
  || try_key "${PC_PROD_SSH_PRIVATE_KEY:-}" \
  || try_key "${VPS_SSH_KEY:-}"

guard_main

domain_ips="$(getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u || true)"
grep -Fxq "$DEFAULT_HOST" <<< "$domain_ips"
scan="$(mktemp)"; match="$(mktemp)"
pinned_ready=0
for attempt in 1 2 3; do
  : > "$scan"; : > "$match"
  ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan" || true
  if [[ -s "$scan" ]]; then
    while IFS= read -r line; do
      fingerprint="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
      [[ "$fingerprint" != "$expected" ]] || printf '%s\n' "$line" >> "$match"
    done < "$scan"
    sort -u -o "$match" "$match"
    if [[ "$(grep -c . "$match" || true)" == '1' ]]; then pinned_ready=1; break; fi
  fi
  (( attempt == 3 )) || sleep "$attempt"
done
[[ "$pinned_ready" == '1' ]]
mv "$match" "$known_hosts"; match=''
rm -f -- "$scan"; scan=''
chmod 0600 "$known_hosts"

guard_main
ssh_opts=(
  -i "$key_path" -p "$port"
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15
)
ssh "${ssh_opts[@]}" "$user@$host" 'set -Eeuo pipefail; test "$(id -u)" -eq 0; docker version >/dev/null' >/dev/null

guard_main
output="$(ssh "${ssh_opts[@]}" "$user@$host" "bash -s -- '$RESET_REVISION' '$EXPECTED_PUBLIC_SITE'" <<'REMOTE'
set -Eeuo pipefail
reset_revision="$1"
expected_public_site="$2"
[[ "$reset_revision" =~ ^[0-9a-f]{40}$ ]]
[[ "$expected_public_site" == 'https://xn----8sbjf4befbjgs9b.xn--p1ai' ]]
[[ "$(id -u)" -eq 0 ]]
command -v docker >/dev/null 2>&1

mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 ))
api_id="${api_ids[0]}"
api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
[[ "$api_revision" == "$reset_revision" ]]

runtime_marker="$(docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - "$expected_public_site" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const { createCipheriv, hkdfSync, randomBytes } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

const expectedPublicSite = process.argv[2];
const OUT = (parts) => process.stdout.write(`RUNTIME_PREFLIGHT|${parts.join('|')}\n`);
const safeBool = (v) => v === true ? 1 : 0;

(async () => {
  let publicSiteOk = 0;
  let cryptoOk = 0;
  let dbConnected = 0;
  let enqueueFunction = 0;
  let producerExecute = 0;
  let functionOwnerOk = 0;
  let securityDefinerOk = 0;
  let rowSecurityConfigOk = 0;
  let forceRlsOk = 0;
  let ownerTablePrivilegesOk = 0;
  let policyShapeOk = 0;
  let classification = 'UNCLASSIFIED';
  let db;

  try {
    const publicSite = String(process.env.PC_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');
    publicSiteOk = publicSite === expectedPublicSite ? 1 : 0;
    if (!publicSiteOk) {
      classification = 'PUBLIC_SITE_ORIGIN_INVALID';
      OUT([classification, publicSiteOk, cryptoOk, dbConnected, enqueueFunction, producerExecute, functionOwnerOk, securityDefinerOk, rowSecurityConfigOk, forceRlsOk, ownerTablePrivilegesOk, policyShapeOk]);
      return;
    }

    try {
      const keyringDir = String(process.env.AUTH_MAIL_OUTBOX_KEYRING_DIR || '').trim();
      const versionFile = String(process.env.AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION_FILE || '').trim();
      if (keyringDir !== '/run/pc-auth-mail/keyring' || versionFile !== '/run/pc-auth-mail/current-key-version') {
        throw new Error('CRYPTO_ENV_INVALID');
      }
      const versionRaw = fs.readFileSync(versionFile, 'utf8').trim();
      if (!/^\d{1,3}$/.test(versionRaw)) throw new Error('KEY_VERSION_INVALID');
      const version = Number(versionRaw);
      if (!Number.isInteger(version) || version < 1 || version > 999) throw new Error('KEY_VERSION_INVALID');
      const keyPath = path.join(keyringDir, `v${version}.key`);
      const keyRaw = fs.readFileSync(keyPath, 'utf8').trim();
      if (!/^[a-fA-F0-9]{64}$/.test(keyRaw)) throw new Error('KEY_FORMAT_INVALID');
      const master = Buffer.from(keyRaw, 'hex');
      const derived = Buffer.from(hkdfSync(
        'sha256',
        master,
        Buffer.from('pc-auth-mail-keyring-v1', 'utf8'),
        Buffer.from('pc-auth-mail:encryption:v1', 'utf8'),
        32,
      ));
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', derived, iv);
      cipher.setAAD(Buffer.from(['pc-auth-mail-outbox', String(version), 'PASSWORD_RESET', 'auth-mail:runtime-preflight', 'runtime-preflight'].join('\u001f'), 'utf8'));
      const payload = Buffer.from(JSON.stringify({ to: 'probe@example.invalid', subject: 'probe', text: 'probe' }), 'utf8');
      cipher.update(payload);
      cipher.final();
      const tag = cipher.getAuthTag();
      if (tag.length !== 16) throw new Error('CRYPTO_TAG_INVALID');
      payload.fill(0); derived.fill(0); master.fill(0);
      cryptoOk = 1;
    } catch {
      classification = 'AUTH_MAIL_CRYPTO_RUNTIME_INVALID';
      OUT([classification, publicSiteOk, cryptoOk, dbConnected, enqueueFunction, producerExecute, functionOwnerOk, securityDefinerOk, rowSecurityConfigOk, forceRlsOk, ownerTablePrivilegesOk, policyShapeOk]);
      return;
    }

    const authUrl = String(process.env.AUTH_DATABASE_URL || '').trim();
    if (!authUrl) {
      classification = 'AUTH_DATABASE_URL_MISSING';
      OUT([classification, publicSiteOk, cryptoOk, dbConnected, enqueueFunction, producerExecute, functionOwnerOk, securityDefinerOk, rowSecurityConfigOk, forceRlsOk, ownerTablePrivilegesOk, policyShapeOk]);
      return;
    }
    const readOnlyUrl = new URL(authUrl);
    const existingOptions = readOnlyUrl.searchParams.get('options');
    readOnlyUrl.searchParams.set('options', `${existingOptions ? `${existingOptions} ` : ''}-c default_transaction_read_only=on`);
    db = new PrismaClient({ datasources: { db: { url: readOnlyUrl.toString() } } });

    const principalRows = await db.$queryRawUnsafe(`
      SELECT
        current_user AS current_user,
        NOT rolsuper AS no_super,
        NOT rolbypassrls AS no_bypass,
        has_schema_privilege(current_user, 'auth', 'USAGE') AS schema_usage,
        coalesce(has_function_privilege(
          current_user,
          to_regprocedure('auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)'),
          'EXECUTE'
        ), false) AS enqueue_execute
      FROM pg_roles
      WHERE rolname = current_user
    `);
    if (principalRows.length !== 1) throw new Error('DB_PRINCIPAL_INVALID');
    const principal = principalRows[0];
    dbConnected = 1;
    producerExecute = safeBool(principal.enqueue_execute);

    const functionRows = await db.$queryRawUnsafe(`
      SELECT
        p.oid IS NOT NULL AS function_exists,
        owner.rolname = 'pc_auth_mail_enqueue_authority' AS owner_ok,
        p.prosecdef AS security_definer,
        coalesce('row_security=on' = ANY(p.proconfig), false) AS row_security_on,
        c.relforcerowsecurity AS force_rls,
        has_table_privilege('pc_auth_mail_enqueue_authority', 'auth.mail_outbox', 'SELECT')
          AND has_table_privilege('pc_auth_mail_enqueue_authority', 'auth.mail_outbox', 'INSERT') AS owner_table_privileges,
        (
          SELECT count(*) = 2
          FROM pg_policies
          WHERE schemaname = 'auth'
            AND tablename = 'mail_outbox'
            AND policyname IN ('auth_mail_outbox_enqueue_select', 'auth_mail_outbox_enqueue_insert')
        ) AS policy_shape
      FROM pg_proc p
      JOIN pg_roles owner ON owner.oid = p.proowner
      JOIN pg_class c ON c.oid = to_regclass('auth.mail_outbox')
      WHERE p.oid = to_regprocedure('auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)')
    `);
    if (functionRows.length !== 1) {
      classification = 'AUTH_MAIL_ENQUEUE_FUNCTION_MISSING';
      OUT([classification, publicSiteOk, cryptoOk, dbConnected, enqueueFunction, producerExecute, functionOwnerOk, securityDefinerOk, rowSecurityConfigOk, forceRlsOk, ownerTablePrivilegesOk, policyShapeOk]);
      return;
    }
    const fn = functionRows[0];
    enqueueFunction = safeBool(fn.function_exists);
    functionOwnerOk = safeBool(fn.owner_ok);
    securityDefinerOk = safeBool(fn.security_definer);
    rowSecurityConfigOk = safeBool(fn.row_security_on);
    forceRlsOk = safeBool(fn.force_rls);
    ownerTablePrivilegesOk = safeBool(fn.owner_table_privileges);
    policyShapeOk = safeBool(fn.policy_shape);

    if (!producerExecute) classification = 'AUTH_MAIL_PRODUCER_EXECUTE_MISSING';
    else if (!functionOwnerOk) classification = 'AUTH_MAIL_FUNCTION_OWNER_INVALID';
    else if (!securityDefinerOk || !rowSecurityConfigOk) classification = 'AUTH_MAIL_FUNCTION_SECURITY_CONFIG_INVALID';
    else if (!forceRlsOk || !ownerTablePrivilegesOk || !policyShapeOk) classification = 'AUTH_MAIL_RLS_OR_OWNER_PRIVILEGES_INVALID';
    else classification = 'AUTH_MAIL_RUNTIME_AND_DB_CONTRACT_READY';

    OUT([classification, publicSiteOk, cryptoOk, dbConnected, enqueueFunction, producerExecute, functionOwnerOk, securityDefinerOk, rowSecurityConfigOk, forceRlsOk, ownerTablePrivilegesOk, policyShapeOk]);
  } catch {
    classification = 'AUTH_MAIL_DB_METADATA_CHECK_FAILED';
    OUT([classification, publicSiteOk, cryptoOk, dbConnected, enqueueFunction, producerExecute, functionOwnerOk, securityDefinerOk, rowSecurityConfigOk, forceRlsOk, ownerTablePrivilegesOk, policyShapeOk]);
  } finally {
    if (db) await db.$disconnect().catch(() => undefined);
  }
})().catch(() => {
  OUT(['RUNTIME_PREFLIGHT_UNHANDLED', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  process.exitCode = 1;
});
NODE
)"

[[ "$runtime_marker" =~ ^RUNTIME_PREFLIGHT\|[A-Z0-9_]+\|[01]\|[01]\|[01]\|[01]\|[01]\|[01]\|[01]\|[01]\|[01]\|[01]\|[01]$ ]]
printf '%s\n' "$runtime_marker"
printf 'API_REVISION=%s\n' "$api_revision"
printf 'PRODUCTION_MUTATION=NONE\n'
REMOTE
)"

marker="$(grep '^RUNTIME_PREFLIGHT|' <<< "$output" | tail -n1)"
api_revision="$(grep '^API_REVISION=' <<< "$output" | tail -n1 | cut -d= -f2)"
mutation="$(grep '^PRODUCTION_MUTATION=' <<< "$output" | tail -n1)"
[[ "$marker" =~ ^RUNTIME_PREFLIGHT\|[A-Z0-9_]+\|[01]\|[01]\|[01]\|[01]\|[01]\|[01]\|[01]\|[01]\|[01]\|[01]\|[01]$ ]]
[[ "$api_revision" == "$RESET_REVISION" ]]
[[ "$mutation" == 'PRODUCTION_MUTATION=NONE' ]]
IFS='|' read -r _ classification public_site_ok crypto_ok db_connected function_present producer_execute owner_ok security_definer_ok row_security_ok force_rls_ok owner_privs_ok policy_ok <<< "$marker"

guard_main

gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset runtime preflight

- source reset run: \`$RESET_RUN_ID\`
- diagnostic main: \`$SOURCE_SHA\`
- inspected API revision: \`$RESET_REVISION\`
- result: \`PASS_READ_ONLY_CLASSIFIED\`
- classification: \`$classification\`
- public-site origin / crypto / auth-db connection: \`$public_site_ok/$crypto_ok/$db_connected\`
- enqueue function / producer EXECUTE: \`$function_present/$producer_execute\`
- function owner / SECURITY DEFINER / row_security=on: \`$owner_ok/$security_definer_ok/$row_security_ok\`
- FORCE RLS / owner SELECT+INSERT / enqueue policy shape: \`$force_rls_ok/$owner_privs_ok/$policy_ok\`
- secret values / database rows / raw Docker output: \`NOT_PUBLISHED\`
- reset replay / mail send: \`NONE\`
- production mutation: \`NONE\`
- new recurring cost: \`0 RUB\`" >/dev/null
result_published=1
