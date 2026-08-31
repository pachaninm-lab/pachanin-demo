#!/usr/bin/env bash
set -Eeuo pipefail

FAILED_RUN_ID='33425716125'
FAILED_RUN_ATTEMPT='2'
FAILED_TARGET_SHA='1bffaec1a7aad09840df136e886c07d2b32e2008'
DIAGNOSTIC_SINCE='2026-08-31T19:18:00Z'
DIAGNOSTIC_UNTIL='2026-08-31T19:20:30Z'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
DEFAULT_HOST='195.19.12.120'

fail() {
  printf 'P0_REVIEWER_DECISION_NOTIFICATION_DIAGNOSTIC_ERROR=%s\n' "$1" >&2
  exit "${2:-1}"
}

for command in git gh ssh ssh-keygen ssh-keyscan getent awk sort base64 node mktemp; do
  command -v "$command" >/dev/null 2>&1 || fail "MISSING_COMMAND_${command^^}" 10
done

[[ -n "${GITHUB_REPOSITORY:-}" ]] || fail GITHUB_REPOSITORY_MISSING 11
[[ "$FAILED_RUN_ID" =~ ^[0-9]{2,20}$ && "$FAILED_RUN_ATTEMPT" == '2' ]] \
  || fail FIXED_RUN_IDENTITY_INVALID 12
[[ "$FAILED_TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || fail FIXED_TARGET_SHA_INVALID 13
[[ "$DIAGNOSTIC_SINCE" == '2026-08-31T19:18:00Z' ]] || fail FIXED_WINDOW_INVALID 14
[[ "$DIAGNOSTIC_UNTIL" == '2026-08-31T19:20:30Z' ]] || fail FIXED_WINDOW_INVALID 14

key="$(mktemp)"
known_hosts="$(mktemp)"
scan="$(mktemp)"
match="$(mktemp)"
result="$(mktemp)"
cleanup() {
  rm -f -- "$key" "$known_hosts" "$scan" "$match" "$result"
}
trap cleanup EXIT

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

validate_key() {
  local source="$1" public_key
  tr -d '\r' < "$source" > "$key"
  chmod 0600 "$key"
  grep -Eq '^(ssh-|ecdsa-|sk-)' "$key" && return 1
  public_key="$(mktemp)"
  if ! ssh-keygen -y -P '' -f "$key" > "$public_key" 2>/dev/null; then
    rm -f -- "$public_key"
    return 1
  fi
  rm -f -- "$public_key"
}

try_key() {
  local raw="$1" plain escaped decoded
  [[ -n "$raw" ]] || return 1
  plain="$(mktemp)"
  escaped="$(mktemp)"
  decoded="$(mktemp)"
  printf '%s\n' "$raw" > "$plain"
  if validate_key "$plain"; then
    rm -f -- "$plain" "$escaped" "$decoded"
    return 0
  fi
  printf '%s' "${raw//\\n/$'\n'}" > "$escaped"
  if validate_key "$escaped"; then
    rm -f -- "$plain" "$escaped" "$decoded"
    return 0
  fi
  if printf '%s' "$raw" | base64 --decode > "$decoded" 2>/dev/null \
      && validate_key "$decoded"; then
    rm -f -- "$plain" "$escaped" "$decoded"
    return 0
  fi
  rm -f -- "$plain" "$escaped" "$decoded"
  return 1
}

current_main="$(git rev-parse HEAD)"
[[ "$current_main" =~ ^[0-9a-f]{40}$ ]] || fail CURRENT_MAIN_INVALID 20
git fetch --no-tags origin main >/dev/null 2>&1 || fail CURRENT_MAIN_FETCH_FAILED 21
[[ "$(git rev-parse origin/main)" == "$current_main" ]] || fail CHECKOUT_NOT_CURRENT_MAIN 22
[[ "$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha 2>/dev/null)" == "$current_main" ]] \
  || fail REMOTE_MAIN_MISMATCH 23
git cat-file -e "$FAILED_TARGET_SHA^{commit}" 2>/dev/null || fail FAILED_SHA_MISSING 24
git merge-base --is-ancestor "$FAILED_TARGET_SHA" "$current_main" \
  || fail FAILED_SHA_NO_LONGER_ANCESTOR 25
[[ -z "$(git status --porcelain=v1)" ]] || fail DIRTY_CHECKOUT 26

host="$(trim "${PC_PROD_HOST:-$DEFAULT_HOST}")"
user="$(trim "${PC_PROD_SSH_USER:-}")"
port="$(trim "${PC_PROD_SSH_PORT:-22}")"
expected_fingerprint="$(trim "${PC_PROD_SSH_HOST_FINGERPRINT:-}")"
[[ "$host" == "$DEFAULT_HOST" ]] || fail PRODUCTION_HOST_MISMATCH 30
[[ -n "$user" && "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]] \
  || fail PRODUCTION_SSH_USER_INVALID 31
[[ "$port" =~ ^[0-9]+$ ]] && (( port >= 1 && port <= 65535 )) \
  || fail PRODUCTION_SSH_PORT_INVALID 32
[[ "$expected_fingerprint" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]] \
  || fail PRODUCTION_HOST_FINGERPRINT_INVALID 33
try_key "${PC_PROD_SSH_KEY:-}" \
  || try_key "${PC_PROD_SSH_PRIVATE_KEY:-}" \
  || try_key "${VPS_SSH_KEY:-}" \
  || fail PRODUCTION_SSH_KEY_INVALID 34

getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u | grep -Fxq "$DEFAULT_HOST" \
  || fail PRODUCTION_DNS_PIN_MISMATCH 35
pinned=0
for attempt in 1 2 3; do
  : > "$scan"
  : > "$match"
  ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan" || true
  while IFS= read -r line; do
    [[ -n "$line" ]] || continue
    fingerprint="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
    [[ "$fingerprint" != "$expected_fingerprint" ]] || printf '%s\n' "$line" >> "$match"
  done < "$scan"
  sort -u -o "$match" "$match"
  if [[ "$(grep -c . "$match" || true)" == '1' ]]; then
    pinned=1
    break
  fi
  (( attempt == 3 )) || sleep "$attempt"
done
[[ "$pinned" == '1' ]] || fail PRODUCTION_HOST_KEY_PIN_FAILED 36
mv "$match" "$known_hosts"
chmod 0600 "$known_hosts"

ssh -i "$key" -p "$port" \
  -o BatchMode=yes \
  -o IdentitiesOnly=yes \
  -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$known_hosts" \
  -o ConnectTimeout=15 \
  "$user@$host" 'bash -s' -- "$FAILED_TARGET_SHA" "$DIAGNOSTIC_SINCE" "$DIAGNOSTIC_UNTIL" \
  > "$result" <<'REMOTE'
set -Eeuo pipefail
target_sha="$1"
since="$2"
until="$3"
command -v docker >/dev/null 2>&1
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 ))
web_id="${web_ids[0]}"
web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
[[ "$web_revision" == "$target_sha" ]]

docker logs --since "$since" --until "$until" --timestamps "$web_id" 2>&1 \
  | docker exec -i "$web_id" /nodejs/bin/node --input-type=commonjs -e '
const fs = require("node:fs");
const input = fs.readFileSync(0, "utf8");
const lines = input.split(/\r?\n/);
const ceremonies = [];
const deliveries = [];

function parseAfter(line, marker) {
  const markerIndex = line.indexOf(marker);
  if (markerIndex < 0) return null;
  const jsonIndex = line.indexOf("{", markerIndex + marker.length);
  if (jsonIndex < 0) return null;
  try {
    const value = JSON.parse(line.slice(jsonIndex));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

for (const line of lines) {
  const ceremony = parseAfter(line, "p0_human_reviewer_ceremony");
  if (ceremony?.marker === "P0_HUMAN_REVIEWER_CEREMONY") ceremonies.push(ceremony);
  const delivery = parseAfter(line, "registration_decision_notification_result");
  if (delivery) deliveries.push(delivery);
}

const phase = (value) => {
  const correlation = String(value?.correlationId || "");
  if (correlation.startsWith("p0-human-approve:")) return "approve";
  if (correlation.startsWith("p0-human-replay:")) return "replay";
  return "other";
};
const applicationKey = (value) => String(value?.applicationId || "");
const approve = ceremonies.filter((value) => phase(value) === "approve");
const replay = ceremonies.filter((value) => phase(value) === "replay");
const committed = approve.filter((value) => value.replayed === false);
const committedDelivered = committed.filter((value) => value.notificationDelivered === true);
const committedUndelivered = committed.filter((value) => value.notificationDelivered !== true);
const approveReplayed = approve.filter((value) => value.replayed === true);
const replaySuppressed = replay.filter(
  (value) => value.replayed === true && value.notificationSuppressed === true,
);
const uniqueApplications = new Set(ceremonies.map(applicationKey).filter(Boolean));
const committedApplications = new Set(committed.map(applicationKey).filter(Boolean));
const suppressedApplications = new Set(replaySuppressed.map(applicationKey).filter(Boolean));
const replayMissing = [...committedApplications].filter(
  (application) => !suppressedApplications.has(application),
).length;
const deliveryTrue = deliveries.filter((value) => value.delivered === true).length;
const deliveryFalse = deliveries.filter((value) => value.delivered !== true).length;

const buckets = {
  SENT: 0,
  TIMEOUT: 0,
  AUTH: 0,
  TRANSPORT: 0,
  RECIPIENT: 0,
  TEMPORARY: 0,
  OTHER: 0,
};
for (const value of deliveries) {
  const reason = String(value?.reason || "").toLowerCase();
  let bucket = "OTHER";
  if (value?.delivered === true || reason.includes("sent")) bucket = "SENT";
  else if (reason.includes("timeout") || reason.includes("timedout")) bucket = "TIMEOUT";
  else if (reason.includes("auth") || reason.includes("credential") || reason.includes("login")) bucket = "AUTH";
  else if (
    reason.includes("connect") || reason.includes("socket") || reason.includes("network")
    || reason.includes("econn") || reason.includes("tls")
  ) bucket = "TRANSPORT";
  else if (
    reason.includes("recipient") || reason.includes("rcpt")
    || reason.includes("mailbox") || reason.includes("550")
  ) bucket = "RECIPIENT";
  else if (
    reason.includes("temporary") || reason.includes("rate") || reason.includes("limit")
    || reason.includes("451") || reason.includes("421")
  ) bucket = "TEMPORARY";
  buckets[bucket] += 1;
}

let classification = "PARTIAL_OR_LOG_WINDOW_MISMATCH";
if (committedUndelivered.length > 0) classification = "COMMIT_SUCCEEDED_NOTIFICATION_FAILED";
else if (approveReplayed.length > 0 && committedDelivered.length < 8) {
  classification = "PRIOR_COMMIT_REPLAY_WITHOUT_FIRST_DELIVERY";
} else if (replayMissing > 0 && committed.length > 0) {
  classification = "COMMIT_SUCCEEDED_REPLAY_MISSING";
} else if (
  committedDelivered.length === 8
  && replaySuppressed.length === 8
  && uniqueApplications.size === 8
) classification = "CEREMONY_EVIDENCE_COMPLETE";
else if (ceremonies.length === 0) classification = "NO_CEREMONY_EVENTS_IN_BOUND_WINDOW";

const output = {
  P0_DIAGNOSTIC_SCHEMA: "production.p0.reviewer-decision-notification-diagnostic.v1",
  P0_WEB_REVISION_EXACT: 1,
  P0_CEREMONY_EVENTS_TOTAL: ceremonies.length,
  P0_UNIQUE_APPLICATIONS: uniqueApplications.size,
  P0_APPROVE_COMMITTED: committed.length,
  P0_APPROVE_COMMITTED_DELIVERED: committedDelivered.length,
  P0_APPROVE_COMMITTED_UNDELIVERED: committedUndelivered.length,
  P0_APPROVE_REPLAYED: approveReplayed.length,
  P0_REPLAY_EVENTS: replay.length,
  P0_REPLAY_SUPPRESSED: replaySuppressed.length,
  P0_REPLAY_MISSING: replayMissing,
  P0_DELIVERY_EVENTS: deliveries.length,
  P0_DELIVERY_TRUE: deliveryTrue,
  P0_DELIVERY_FALSE: deliveryFalse,
  P0_DELIVERY_REASON_SENT: buckets.SENT,
  P0_DELIVERY_REASON_TIMEOUT: buckets.TIMEOUT,
  P0_DELIVERY_REASON_AUTH: buckets.AUTH,
  P0_DELIVERY_REASON_TRANSPORT: buckets.TRANSPORT,
  P0_DELIVERY_REASON_RECIPIENT: buckets.RECIPIENT,
  P0_DELIVERY_REASON_TEMPORARY: buckets.TEMPORARY,
  P0_DELIVERY_REASON_OTHER: buckets.OTHER,
  P0_CLASSIFICATION: classification,
  PRODUCTION_MUTATION: "NONE",
  RAW_LOGS_PUBLISHED: 0,
};
for (const [key, value] of Object.entries(output)) process.stdout.write(`${key}=${value}\n`);
'
REMOTE

[[ -s "$result" ]] || fail EMPTY_DIAGNOSTIC_RESULT 40
P0_RESULT_FILE="$result" node <<'NODE'
const fs = require('node:fs');
const lines = fs.readFileSync(process.env.P0_RESULT_FILE, 'utf8').trim().split(/\r?\n/);
const allowed = new Set([
  'P0_DIAGNOSTIC_SCHEMA', 'P0_WEB_REVISION_EXACT', 'P0_CEREMONY_EVENTS_TOTAL',
  'P0_UNIQUE_APPLICATIONS', 'P0_APPROVE_COMMITTED', 'P0_APPROVE_COMMITTED_DELIVERED',
  'P0_APPROVE_COMMITTED_UNDELIVERED', 'P0_APPROVE_REPLAYED', 'P0_REPLAY_EVENTS',
  'P0_REPLAY_SUPPRESSED', 'P0_REPLAY_MISSING', 'P0_DELIVERY_EVENTS', 'P0_DELIVERY_TRUE',
  'P0_DELIVERY_FALSE', 'P0_DELIVERY_REASON_SENT', 'P0_DELIVERY_REASON_TIMEOUT',
  'P0_DELIVERY_REASON_AUTH', 'P0_DELIVERY_REASON_TRANSPORT', 'P0_DELIVERY_REASON_RECIPIENT',
  'P0_DELIVERY_REASON_TEMPORARY', 'P0_DELIVERY_REASON_OTHER', 'P0_CLASSIFICATION',
  'PRODUCTION_MUTATION', 'RAW_LOGS_PUBLISHED',
]);
const values = new Map();
for (const line of lines) {
  if (!/^[A-Z0-9_]+=[A-Z0-9_.-]+$/.test(line)) process.exit(2);
  const separator = line.indexOf('=');
  const key = line.slice(0, separator);
  const value = line.slice(separator + 1);
  if (!allowed.has(key) || values.has(key)) process.exit(3);
  values.set(key, value);
}
for (const key of allowed) if (!values.has(key)) process.exit(4);
if (
  values.get('P0_DIAGNOSTIC_SCHEMA') !== 'production.p0.reviewer-decision-notification-diagnostic.v1'
  || values.get('P0_WEB_REVISION_EXACT') !== '1'
  || values.get('PRODUCTION_MUTATION') !== 'NONE'
  || values.get('RAW_LOGS_PUBLISHED') !== '0'
) process.exit(5);
const classification = values.get('P0_CLASSIFICATION') || '';
if (!/^(COMMIT_SUCCEEDED_NOTIFICATION_FAILED|PRIOR_COMMIT_REPLAY_WITHOUT_FIRST_DELIVERY|COMMIT_SUCCEEDED_REPLAY_MISSING|CEREMONY_EVIDENCE_COMPLETE|NO_CEREMONY_EVENTS_IN_BOUND_WINDOW|PARTIAL_OR_LOG_WINDOW_MISMATCH)$/.test(classification)) process.exit(6);
NODE

cat "$result"
