#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-reviewer-reset-dsn-diagnose 31757284161'
SOURCE_RUN_ID='31757284161'
SOURCE_DEPLOYED_SHA='df395bf02604d2445be625b59dd01099590d58d7'
SOURCE_MESSAGE_SINCE='2026-08-14T00:25:00Z'
SOURCE_MESSAGE_UNTIL='2026-08-14T00:27:00Z'

key_path="$RUNNER_TEMP/pc-p0-reviewer-reset-dsn-key"
known_hosts="$RUNNER_TEMP/pc-p0-reviewer-reset-dsn-known-hosts"
TARGET_SHA='unknown'
result_published=0

cleanup() {
  rm -f -- "$key_path" "$known_hosts"
}
trap cleanup EXIT

publish_failure() {
  local rc="$?"
  trap - ERR
  if [[ "$result_published" == '0' ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset DSN diagnostic

- exact diagnostic main: \`$TARGET_SHA\`
- source reset run: \`$SOURCE_RUN_ID\`
- source deployed revision: \`$SOURCE_DEPLOYED_SHA\`
- result: \`FAIL_CLOSED\`
- reviewer identity exposure: \`NONE\`
- mailbox mutation: \`NONE\`
- mail sent by diagnostic: \`NO\`
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
  [[ "$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)" == "$TARGET_SHA" ]]
}

TARGET_SHA="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]
[[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]
git merge-base --is-ancestor "$SOURCE_DEPLOYED_SHA" "$TARGET_SHA"
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
  ssh-keygen -y -P '' -f "$key_path" > "$public_key" 2>/dev/null \
    || { rm -f "$public_key"; return 1; }
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
ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan"
[[ -s "$scan" ]]
while IFS= read -r line; do
  fingerprint="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
  [[ "$fingerprint" != "$expected" ]] || printf '%s\n' "$line" >> "$match"
done < "$scan"
[[ "$(grep -c . "$match" || true)" == '1' ]]
mv "$match" "$known_hosts"; rm -f "$scan"; chmod 0600 "$known_hosts"

guard_main
output="$(ssh -i "$key_path" -p "$port" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 \
  "$user@$host" "bash -s -- '$SOURCE_DEPLOYED_SHA' '$SOURCE_MESSAGE_SINCE' '$SOURCE_MESSAGE_UNTIL'" <<'REMOTE'
set -Eeuo pipefail
source_sha="$1"
source_since="$2"
source_until="$3"
[[ "$source_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$source_since" == '2026-08-14T00:25:00Z' ]]
[[ "$source_until" == '2026-08-14T00:27:00Z' ]]
[[ "$(id -u)" -eq 0 ]]
command -v docker >/dev/null 2>&1
command -v python3 >/dev/null 2>&1

mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 ))
web_id="${web_ids[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
active_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
[[ -n "$project" ]]
[[ "$web_revision" == "$source_sha" ]]
[[ -n "$active_dir" && "$active_dir" == /* && "$active_dir" != / && -d "$active_dir" && ! -L "$active_dir" ]]
active_dir="$(realpath -e -- "$active_dir")"

mapfile -t api_ids < <(docker ps -q \
  --filter "label=com.docker.compose.project=$project" \
  --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 ))
api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "${api_ids[0]}")"
[[ "$api_revision" == "$source_sha" ]]

mail_file="$active_dir/.pc-transactional-mail.env"
[[ "$mail_file" == "$active_dir"/* ]]
[[ -f "$mail_file" && ! -L "$mail_file" ]]
[[ "$(stat -c '%a:%u:%g' "$mail_file")" == '600:0:0' ]]

python3 - "$mail_file" "$source_since" "$source_until" <<'PY'
import email
import imaplib
import re
import ssl
import sys
from datetime import datetime, timezone
from email.policy import default
from email.utils import parsedate_to_datetime

MAIL_HOST = "mail.hosting.reg.ru"
IMAP_PORT = 993
RESET_SUBJECT = "Прозрачная Цена — восстановление доступа"

def fail(code):
    print(f"DSN_DIAG_ERROR={code}", file=sys.stderr)
    raise SystemExit(1)

def parse_iso(value):
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
    except Exception:
        fail("SOURCE_TIME_INVALID")

def parse_date(value):
    try:
        dt = parsedate_to_datetime(str(value or ""))
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None

def cardinality(count):
    return "ZERO" if count == 0 else "ONE" if count == 1 else "MULTIPLE"

def extract_message(part):
    payload = part.get_payload()
    if isinstance(payload, list) and payload:
        return payload[0]
    raw = part.get_payload(decode=True)
    if isinstance(raw, (bytes, bytearray)) and raw:
        try:
            return email.message_from_bytes(bytes(raw), policy=default)
        except Exception:
            return None
    return None

def classify_remote(value):
    text = str(value or "").lower()
    if any(token in text for token in ("google.com", "googlemail.com", "gmail.com", "l.google.com")):
        return "GOOGLE"
    if "reg.ru" in text:
        return "REG_RU"
    return "OTHER_OR_REDACTED" if text else "UNKNOWN"

if len(sys.argv) != 4:
    fail("ARGUMENTS_INVALID")
mail_path, since_raw, until_raw = sys.argv[1:]
since = parse_iso(since_raw)
until = parse_iso(until_raw)
if since >= until:
    fail("SOURCE_TIME_ORDER_INVALID")

try:
    raw = open(mail_path, encoding="utf-8").read()
except Exception:
    fail("MAIL_RUNTIME_READ_FAILED")
if not raw.endswith("\n") or "\r" in raw or "\x00" in raw:
    fail("MAIL_RUNTIME_FORMAT_INVALID")

values = {}
for line in raw.rstrip("\n").split("\n"):
    key, sep, value = line.partition("=")
    if not sep or key in values or value != value.strip() or not value:
        fail("MAIL_RUNTIME_FORMAT_INVALID")
    values[key] = value

required = {"PC_SMTP_HOST", "PC_SMTP_USER", "PC_SMTP_PASS"}
allowed = required | {"PC_SMTP_PORT", "PC_MAIL_FROM"}
if not required.issubset(values) or not set(values).issubset(allowed):
    fail("MAIL_CHANNEL_NOT_SMTP")
if values["PC_SMTP_HOST"] != MAIL_HOST or values.get("PC_SMTP_PORT", "465") != "465":
    fail("SMTP_AUTHORITY_INVALID")

smtp_user = values["PC_SMTP_USER"]
smtp_pass = values["PC_SMTP_PASS"]
mail_from = values.get("PC_MAIL_FROM", smtp_user)
if (
    len(smtp_user) > 254
    or len(mail_from) > 254
    or not smtp_pass
    or len(smtp_pass) > 512
    or "\n" in smtp_pass
    or "\r" in smtp_pass
    or "\x00" in smtp_pass
):
    fail("SMTP_RUNTIME_INVALID")

sender_matches = int(smtp_user.casefold() == mail_from.casefold())
context = ssl.create_default_context()
mailbox = None
dsn_seen = 0
matches = []

try:
    mailbox = imaplib.IMAP4_SSL(MAIL_HOST, IMAP_PORT, ssl_context=context, timeout=15)
    mailbox.login(smtp_user, smtp_pass)
    status, _ = mailbox.select("INBOX", readonly=True)
    if status != "OK":
        fail("IMAP_SELECT_FAILED")

    status, data = mailbox.search(None, "SINCE", "14-Aug-2026")
    if status != "OK":
        fail("IMAP_SEARCH_FAILED")

    identifiers = (data[0] or b"").split()[-500:]
    for identifier in identifiers:
        status, rows = mailbox.fetch(
            identifier,
            "(BODY.PEEK[HEADER.FIELDS (DATE SUBJECT CONTENT-TYPE)])",
        )
        if status != "OK":
            continue
        header_raw = next(
            (item[1] for item in rows if isinstance(item, tuple) and len(item) > 1),
            None,
        )
        if not header_raw:
            continue
        header = email.message_from_bytes(header_raw, policy=default)
        content_type = str(header.get("Content-Type", "")).lower()
        if "multipart/report" not in content_type or "delivery-status" not in content_type:
            continue

        status, rows = mailbox.fetch(identifier, "(BODY.PEEK[])")
        if status != "OK":
            continue
        full_raw = next(
            (item[1] for item in rows if isinstance(item, tuple) and len(item) > 1),
            None,
        )
        if not full_raw:
            continue

        parsed = email.message_from_bytes(full_raw, policy=default)
        dsn_seen += 1
        original = None
        for part in parsed.walk():
            if part.get_content_type() in ("message/rfc822", "message/global"):
                candidate = extract_message(part)
                if candidate is not None:
                    original = candidate
                    break
        if original is None:
            continue

        original_subject = str(original.get("Subject", ""))
        original_date = parse_date(original.get("Date"))
        if (
            original_subject != RESET_SUBJECT
            or original_date is None
            or original_date < since
            or original_date > until
        ):
            continue

        actions = set()
        statuses = set()
        remote_classes = set()
        for part in parsed.walk():
            if part.get_content_type() != "message/delivery-status":
                continue
            blocks = part.get_payload()
            if not isinstance(blocks, list):
                continue
            for block in blocks:
                action = str(block.get("Action", "")).strip().lower()
                if action in {"failed", "delayed", "delivered", "relayed", "expanded"}:
                    actions.add(action.upper())
                status_value = str(block.get("Status", "")).strip()
                if re.fullmatch(r"[245]\.\d{1,3}\.\d{1,3}", status_value):
                    statuses.add(status_value)
                remote_classes.add(classify_remote(block.get("Remote-MTA")))

        matches.append(
            (
                next(iter(actions)) if len(actions) == 1 else "MIXED_OR_UNKNOWN",
                next(iter(statuses)) if len(statuses) == 1 else "MULTIPLE_OR_UNKNOWN",
                next(iter(remote_classes)) if len(remote_classes) == 1 else "MIXED_OR_UNKNOWN",
            )
        )
finally:
    if mailbox is not None:
        try:
            mailbox.logout()
        except Exception:
            pass

match_class = cardinality(len(matches))
dsn_class = cardinality(dsn_seen)
if len(matches) == 1:
    action, enhanced_status, remote_mta = matches[0]
else:
    action = "NONE" if len(matches) == 0 else "MULTIPLE"
    enhanced_status = "NONE" if len(matches) == 0 else "MULTIPLE"
    remote_mta = "NONE" if len(matches) == 0 else "MULTIPLE"

mailbox_authority = "ENVELOPE_SENDER" if sender_matches else "AUTH_USER_ALIAS_UNCERTAIN"

print("MAIL_CHANNEL=SMTP")
print("IMAP_READ_ONLY=1")
print(f"SMTP_AUTH_USER_EQUALS_MAIL_FROM={sender_matches}")
print(f"MAILBOX_AUTHORITY={mailbox_authority}")
print(f"DSN_MESSAGES_SCANNED={dsn_class}")
print(f"RESET_DSN_MATCH_CARDINALITY={match_class}")
print(f"RESET_DSN_ACTION={action}")
print(f"RESET_DSN_STATUS={enhanced_status}")
print(f"RESET_DSN_REMOTE_MTA={remote_mta}")
print("MAIL_SENT_BY_DIAGNOSTIC=NO")
print("MAILBOX_MUTATION=NONE")
print("PRODUCTION_MUTATION=NONE")
PY
REMOTE
)"

mail_channel="$(grep '^MAIL_CHANNEL=' <<< "$output" | tail -n1)"
imap_read_only="$(grep '^IMAP_READ_ONLY=' <<< "$output" | tail -n1)"
sender_match="$(grep '^SMTP_AUTH_USER_EQUALS_MAIL_FROM=' <<< "$output" | tail -n1)"
mailbox_authority="$(grep '^MAILBOX_AUTHORITY=' <<< "$output" | tail -n1)"
dsn_scanned="$(grep '^DSN_MESSAGES_SCANNED=' <<< "$output" | tail -n1)"
dsn_match="$(grep '^RESET_DSN_MATCH_CARDINALITY=' <<< "$output" | tail -n1)"
dsn_action="$(grep '^RESET_DSN_ACTION=' <<< "$output" | tail -n1)"
dsn_status="$(grep '^RESET_DSN_STATUS=' <<< "$output" | tail -n1)"
dsn_remote="$(grep '^RESET_DSN_REMOTE_MTA=' <<< "$output" | tail -n1)"
mail_sent="$(grep '^MAIL_SENT_BY_DIAGNOSTIC=' <<< "$output" | tail -n1)"
mailbox_mutation="$(grep '^MAILBOX_MUTATION=' <<< "$output" | tail -n1)"
production_mutation="$(grep '^PRODUCTION_MUTATION=' <<< "$output" | tail -n1)"

[[ "$mail_channel" == 'MAIL_CHANNEL=SMTP' ]]
[[ "$imap_read_only" == 'IMAP_READ_ONLY=1' ]]
[[ "$sender_match" =~ ^SMTP_AUTH_USER_EQUALS_MAIL_FROM=[01]$ ]]
[[ "$mailbox_authority" =~ ^MAILBOX_AUTHORITY=(ENVELOPE_SENDER|AUTH_USER_ALIAS_UNCERTAIN)$ ]]
[[ "$dsn_scanned" =~ ^DSN_MESSAGES_SCANNED=(ZERO|ONE|MULTIPLE)$ ]]
[[ "$dsn_match" =~ ^RESET_DSN_MATCH_CARDINALITY=(ZERO|ONE|MULTIPLE)$ ]]
[[ "$dsn_action" =~ ^RESET_DSN_ACTION=(FAILED|DELAYED|DELIVERED|RELAYED|EXPANDED|MIXED_OR_UNKNOWN|NONE|MULTIPLE)$ ]]
[[ "$dsn_status" =~ ^RESET_DSN_STATUS=([245]\.[0-9]{1,3}\.[0-9]{1,3}|MULTIPLE_OR_UNKNOWN|NONE|MULTIPLE)$ ]]
[[ "$dsn_remote" =~ ^RESET_DSN_REMOTE_MTA=(GOOGLE|REG_RU|OTHER_OR_REDACTED|UNKNOWN|MIXED_OR_UNKNOWN|NONE|MULTIPLE)$ ]]
[[ "$mail_sent" == 'MAIL_SENT_BY_DIAGNOSTIC=NO' ]]
[[ "$mailbox_mutation" == 'MAILBOX_MUTATION=NONE' ]]
[[ "$production_mutation" == 'PRODUCTION_MUTATION=NONE' ]]

guard_main
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset DSN diagnostic

- exact diagnostic main: \`$TARGET_SHA\`
- source reset run: \`$SOURCE_RUN_ID\`
- inspected deployed revision: \`$SOURCE_DEPLOYED_SHA\`
- result: \`PASS_READ_ONLY\`
- mail channel: \`${mail_channel#*=}\`
- IMAP read-only: \`${imap_read_only#*=}\`
- SMTP auth user equals envelope sender: \`${sender_match#*=}\`
- mailbox authority: \`${mailbox_authority#*=}\`
- DSN messages scanned class: \`${dsn_scanned#*=}\`
- matching reset DSN cardinality: \`${dsn_match#*=}\`
- matching DSN action: \`${dsn_action#*=}\`
- matching DSN enhanced status: \`${dsn_status#*=}\`
- matching DSN remote MTA class: \`${dsn_remote#*=}\`
- reviewer identity exposure: \`NONE\`
- mailbox mutation: \`NONE\`
- mail sent by diagnostic: \`NO\`
- production mutation: \`NONE\`" >/dev/null
result_published=1
