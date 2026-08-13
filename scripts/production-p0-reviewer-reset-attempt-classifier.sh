#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_REVIEWER_RESET_ATTEMPT_COMMAND:?PC_REVIEWER_RESET_ATTEMPT_COMMAND is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
ATTEMPT_COMMAND='/production p0-reviewer-reset-attempt-classify 31706325376 current-main'
AUTH_HASH_RUNTIME_COMMAND='/production p0-auth-hash-runtime-classify current-main'
AUTH_HASH_IMPACT_COMMAND='/production p0-auth-hash-impact-classify current-main'
SOURCE_RUN_ID='31706325376'
ATTEMPT_SINCE='2026-08-13T13:43:10Z'
ATTEMPT_UNTIL='2026-08-13T13:43:26Z'
SOURCE_REVISION='7c768ad7c54523837b06999a8f69bdffe2a840db'

case "$PC_REVIEWER_RESET_ATTEMPT_COMMAND" in
  "$ATTEMPT_COMMAND") classifier_mode='RESET_ATTEMPT' ;;
  "$AUTH_HASH_RUNTIME_COMMAND") classifier_mode='AUTH_HASH_RUNTIME' ;;
  "$AUTH_HASH_IMPACT_COMMAND") classifier_mode='AUTH_HASH_IMPACT' ;;
  *) exit 2 ;;
esac

key_path="$RUNNER_TEMP/pc-p0-reviewer-reset-attempt-key"
known_hosts="$RUNNER_TEMP/pc-p0-reviewer-reset-attempt-known-hosts"
TARGET_SHA='unknown'
stage='INITIAL'
failure_detail='NONE'
result_published=0
scan=''
scan_raw=''
match=''

cleanup() {
  rm -f -- "$key_path" "$known_hosts"
  [[ -z "$scan" ]] || rm -f -- "$scan"
  [[ -z "$scan_raw" ]] || rm -f -- "$scan_raw"
  [[ -z "$match" ]] || rm -f -- "$match"
}

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

guard_main() {
  [[ "$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)" == "$TARGET_SHA" ]]
  git fetch --no-tags origin main >/dev/null
  [[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]
  [[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]
  git merge-base --is-ancestor "$SOURCE_REVISION" "$TARGET_SHA"
  [[ -z "$(git status --porcelain=v1)" ]]
}

publish_failure() {
  local rc="$?"
  trap - ERR
  if [[ "$result_published" == '0' ]]; then
    if [[ "$classifier_mode" == 'AUTH_HASH_RUNTIME' ]]; then
      gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-hash runtime authority classifier

- exact diagnostic main: \`$TARGET_SHA\`
- source reset revision: \`$SOURCE_REVISION\`
- result: \`FAIL_CLOSED\`
- failure stage: \`$stage\`
- failure detail: \`$failure_detail\`
- protected value / file path / hash / length exposure: \`NONE\`
- reviewer identity / reset token / credential exposure: \`NONE\`
- reset replay / mail send: \`NONE\`
- raw Docker / Compose / filesystem output: \`NOT_PUBLISHED\`
- production mutation: \`NONE\`
- exit code: \`$rc\`" >/dev/null || true
    elif [[ "$classifier_mode" == 'AUTH_HASH_IMPACT' ]]; then
      gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-hash persisted-impact classifier

- exact diagnostic main: \`$TARGET_SHA\`
- source reset revision: \`$SOURCE_REVISION\`
- result: \`FAIL_CLOSED\`
- failure stage: \`$stage\`
- failure detail: \`$failure_detail\`
- database row / identity / hash / count exposure: \`NONE\`
- protected value / URL / credential exposure: \`NONE\`
- reset replay / mail send: \`NONE\`
- raw Docker / database output: \`NOT_PUBLISHED\`
- production mutation: \`NONE\`
- exit code: \`$rc\`" >/dev/null || true
    else
      gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset attempt classifier

- source reset run: \`$SOURCE_RUN_ID\`
- exact diagnostic main: \`$TARGET_SHA\`
- source reset revision: \`$SOURCE_REVISION\`
- active production revision policy: \`MATCHING_ANCESTOR_OF_EXACT_MAIN\`
- result: \`FAIL_CLOSED\`
- failure stage: \`$stage\`
- failure detail: \`$failure_detail\`
- reviewer identity / account hash / correlation id exposure: \`NONE\`
- reset token / hash / credential exposure: \`NONE\`
- reset replay / mail send: \`NONE\`
- raw database/runtime output: \`NOT_PUBLISHED\`
- production mutation: \`NONE\`
- exit code: \`$rc\`" >/dev/null || true
    fi
  fi
  exit "$rc"
}

trap cleanup EXIT
trap publish_failure ERR

TARGET_SHA="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]
[[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]
git cat-file -e "$SOURCE_REVISION^{commit}"
git merge-base --is-ancestor "$SOURCE_REVISION" "$TARGET_SHA"
[[ -z "$(git status --porcelain=v1)" ]]
stage='MAIN_CONFIRMED'

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
stage='SSH_KEY_CONFIRMED'
guard_main

domain_ips="$(getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u || true)"
grep -Fxq "$DEFAULT_HOST" <<< "$domain_ips"
stage='DNS_CONFIRMED'

scan="$(mktemp)"; scan_raw="$(mktemp)"; match="$(mktemp)"
pinned_ready=0
for attempt in 1 2 3; do
  : > "$scan_raw"; : > "$scan"; : > "$match"
  /usr/bin/ssh-keyscan -T 10 -p "$port" "$host" > "$scan_raw" 2>/dev/null || true
  if [[ -s "$scan_raw" ]]; then
    sort -u "$scan_raw" > "$scan"
    while IFS= read -r line; do
      fingerprint="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
      [[ "$fingerprint" != "$expected" ]] || printf '%s\n' "$line" >> "$match"
    done < "$scan"
    sort -u -o "$match" "$match"
    if [[ "$(grep -c . "$match" || true)" == '1' ]]; then
      pinned_ready=1
      break
    fi
  fi
  (( attempt == 3 )) || sleep "$attempt"
done
[[ "$pinned_ready" == '1' ]]
mv "$match" "$known_hosts"; match=''
rm -f -- "$scan" "$scan_raw"; scan=''; scan_raw=''
chmod 0600 "$known_hosts"
stage='HOST_KEY_CONFIRMED'

guard_main
ssh_opts=(
  -i "$key_path" -p "$port"
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15
)
ssh "${ssh_opts[@]}" "$user@$host" \
  'set -Eeuo pipefail; test "$(id -u)" -eq 0; docker version >/dev/null' >/dev/null
stage='SSH_CONFIRMED'

if [[ "$classifier_mode" == 'AUTH_HASH_RUNTIME' ]]; then
  guard_main
  stage='REMOTE_AUTH_HASH_RUNTIME_CLASSIFICATION'
  failure_detail='REMOTE_CLASSIFICATION_FAILED'
  if ! output="$(ssh "${ssh_opts[@]}" "$user@$host" "python3 - '$SOURCE_REVISION'" <<'PY'
import hmac
import json
import os
import re
import stat
import subprocess
import sys

SOURCE_REVISION = sys.argv[1]
SAFE_SECRET = re.compile(r'^[A-Za-z0-9._~+/=-]{32,512}$')
SAFE_FAILURES = {
    'NOT_ROOT',
    'DOCKER_UNAVAILABLE',
    'ACTIVE_WEB_CARDINALITY',
    'ACTIVE_PROJECT_MISSING',
    'ACTIVE_API_CARDINALITY',
    'ACTIVE_REVISION_INVALID',
    'ACTIVE_REVISION_PARITY',
    'PRODUCTION_DIRECTORY_INVALID',
    'COMPOSE_AUTHORITY_INVALID',
    'COMPOSE_CONFIG_INVALID',
    'PROTECTED_FILE_SCAN_INVALID',
    'ACTIVE_RUNTIME_DRIFT',
    'UNKNOWN',
}


class ClassificationFailure(Exception):
    pass


def fail(code):
    raise ClassificationFailure(code if code in SAFE_FAILURES else 'UNKNOWN')


def run(arguments):
    completed = subprocess.run(
        arguments,
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding='utf-8',
    )
    if completed.returncode != 0:
        fail('DOCKER_UNAVAILABLE')
    return completed.stdout


def docker_json(*arguments):
    try:
        value = json.loads(run(['docker', *arguments]))
    except (json.JSONDecodeError, UnicodeError):
        fail('DOCKER_UNAVAILABLE')
    return value


def environment(document):
    values = {}
    duplicates = set()
    for raw in document.get('Config', {}).get('Env', []) or []:
        name, separator, value = str(raw).partition('=')
        if not separator:
            continue
        if name in values:
            duplicates.add(name)
        values[name] = value
    return values, duplicates


def secret_state(values, duplicates, name):
    if name in duplicates:
        return 'UNSAFE'
    if name not in values:
        return 'MISSING'
    value = values[name]
    return 'READY' if SAFE_SECRET.fullmatch(value) and value == value.strip() else 'UNSAFE'


def cardinality(count):
    if count == 0:
        return 'ZERO'
    if count == 1:
        return 'ONE'
    return 'MULTIPLE'


def labels(document):
    return document.get('Config', {}).get('Labels', {}) or {}


def inspect_one(container_id):
    documents = docker_json('inspect', container_id)
    if not isinstance(documents, list) or len(documents) != 1:
        fail('DOCKER_UNAVAILABLE')
    return documents[0]


def running_ids(project, service):
    output = run([
        'docker', 'ps', '-q',
        '--filter', f'label=com.docker.compose.project={project}',
        '--filter', f'label=com.docker.compose.service={service}',
    ])
    return [line for line in output.splitlines() if line]


def all_ids(project, service):
    output = run([
        'docker', 'ps', '-aq',
        '--filter', f'label=com.docker.compose.project={project}',
        '--filter', f'label=com.docker.compose.service={service}',
    ])
    return [line for line in output.splitlines() if line]


def scan_protected_files(production_directory):
    assignments = {'AUTH_TOKEN_PEPPER': [], 'AUTH_HASH_SECRET': []}
    unsafe_scan = {'AUTH_TOKEN_PEPPER': False, 'AUTH_HASH_SECRET': False}
    try:
        entries = list(os.scandir(production_directory))
    except OSError:
        fail('PROTECTED_FILE_SCAN_INVALID')
    candidates = [
        entry for entry in entries
        if entry.name == '.env'
        or entry.name.startswith('.env.')
        or (
            entry.name.endswith('.env')
            and re.search(r'(^|[._-])auth([._-]|$)', entry.name, re.IGNORECASE)
        )
    ]
    if len(candidates) > 128:
        fail('PROTECTED_FILE_SCAN_INVALID')
    for entry in candidates:
        try:
            info = entry.stat(follow_symlinks=False)
        except OSError:
            fail('PROTECTED_FILE_SCAN_INVALID')
        if not stat.S_ISREG(info.st_mode) or entry.is_symlink():
            continue
        if info.st_size > 1024 * 1024:
            for name in unsafe_scan:
                unsafe_scan[name] = True
            continue
        try:
            raw = open(entry.path, 'rb').read()
            text = raw.decode('utf-8')
        except (OSError, UnicodeError):
            fail('PROTECTED_FILE_SCAN_INVALID')
        protected_mode = info.st_uid == 0 and info.st_gid == 0 and stat.S_IMODE(info.st_mode) == 0o600
        if b'\x00' in raw or '\r' in text:
            protected_mode = False
        seen_in_file = set()
        for line in text.splitlines():
            name, separator, value = line.partition('=')
            if not separator or name not in assignments:
                continue
            valid = (
                protected_mode
                and name not in seen_in_file
                and bool(SAFE_SECRET.fullmatch(value))
                and value == value.strip()
            )
            assignments[name].append((entry.path, value, valid))
            seen_in_file.add(name)
    return assignments, unsafe_scan


def file_authority(records, scan_unsafe):
    files = {path for path, _value, _valid in records}
    card = cardinality(len(files))
    if scan_unsafe:
        return card, 'UNSAFE', None
    if not records:
        return card, 'NONE', None
    if any(not valid for _path, _value, valid in records):
        return card, 'UNSAFE', None
    values = [value for _path, value, _valid in records]
    if len(records) == 1 and len(files) == 1:
        return card, 'READY', values[0]
    first = values[0]
    if all(hmac.compare_digest(first, value) for value in values[1:]):
        return card, 'MULTIPLE_CONSISTENT', None
    return card, 'CONFLICT', None


def compose_environment(production_directory, project, compose_files):
    command = ['docker', 'compose', '--project-directory', production_directory, '--project-name', project]
    for path in compose_files:
        command.extend(['-f', path])
    command.extend(['config', '--format', 'json'])
    try:
        config = json.loads(run(command))
    except (json.JSONDecodeError, UnicodeError):
        fail('COMPOSE_CONFIG_INVALID')
    service = (config.get('services') or {}).get('api')
    if not isinstance(service, dict):
        fail('COMPOSE_CONFIG_INVALID')
    raw_environment = service.get('environment') or {}
    if isinstance(raw_environment, dict):
        return {str(name): '' if value is None else str(value) for name, value in raw_environment.items()}, set()
    if isinstance(raw_environment, list):
        document = {'Config': {'Env': raw_environment}}
        return environment(document)
    fail('COMPOSE_CONFIG_INVALID')


try:
    if os.geteuid() != 0:
        fail('NOT_ROOT')
    if SOURCE_REVISION != '7c768ad7c54523837b06999a8f69bdffe2a840db':
        fail('UNKNOWN')
    run(['docker', 'version'])

    unscoped_web = [line for line in run([
        'docker', 'ps', '-q', '--filter', 'label=com.docker.compose.service=web'
    ]).splitlines() if line]
    if len(unscoped_web) != 1:
        fail('ACTIVE_WEB_CARDINALITY')
    web_id = unscoped_web[0]
    web_document = inspect_one(web_id)
    web_labels = labels(web_document)
    project = str(web_labels.get('com.docker.compose.project') or '')
    if not project:
        fail('ACTIVE_PROJECT_MISSING')
    api_ids = running_ids(project, 'api')
    if len(api_ids) != 1:
        fail('ACTIVE_API_CARDINALITY')
    api_id = api_ids[0]
    api_document = inspect_one(api_id)
    api_labels = labels(api_document)
    active_revision = str(api_labels.get('org.opencontainers.image.revision') or '')
    web_revision = str(web_labels.get('org.opencontainers.image.revision') or '')
    if not re.fullmatch(r'[0-9a-f]{40}', active_revision):
        fail('ACTIVE_REVISION_INVALID')
    if web_revision != active_revision:
        fail('ACTIVE_REVISION_PARITY')

    production_directory = str(web_labels.get('com.docker.compose.project.working_dir') or '')
    if not production_directory or not os.path.isabs(production_directory) or production_directory == '/':
        fail('PRODUCTION_DIRECTORY_INVALID')
    if os.path.islink(production_directory) or not os.path.isdir(production_directory):
        fail('PRODUCTION_DIRECTORY_INVALID')
    production_directory = os.path.realpath(production_directory)
    config_label = str(web_labels.get('com.docker.compose.project.config_files') or '')
    raw_files = [item.strip() for item in config_label.split(',') if item.strip()]
    if not raw_files:
        fail('COMPOSE_AUTHORITY_INVALID')
    compose_files = []
    for raw_path in raw_files:
        path = raw_path if os.path.isabs(raw_path) else os.path.join(production_directory, raw_path)
        if os.path.islink(path) or not os.path.isfile(path):
            fail('COMPOSE_AUTHORITY_INVALID')
        real_path = os.path.realpath(path)
        if os.path.commonpath([production_directory, real_path]) != production_directory:
            fail('COMPOSE_AUTHORITY_INVALID')
        compose_files.append(real_path)

    active_values, active_duplicates = environment(api_document)
    active_pepper = secret_state(active_values, active_duplicates, 'AUTH_TOKEN_PEPPER')
    compose_values, compose_duplicates = compose_environment(
        production_directory, project, compose_files
    )
    compose_pepper = secret_state(compose_values, compose_duplicates, 'AUTH_TOKEN_PEPPER')

    source_documents = []
    for candidate_id in all_ids(project, 'api'):
        candidate = inspect_one(candidate_id)
        candidate_revision = str(labels(candidate).get('org.opencontainers.image.revision') or '')
        if candidate_revision == SOURCE_REVISION:
            source_documents.append(candidate)
    source_cardinality = cardinality(len(source_documents))
    if len(source_documents) == 0:
        source_pepper = 'UNAVAILABLE'
    elif len(source_documents) == 1:
        source_values, source_duplicates = environment(source_documents[0])
        source_pepper = secret_state(source_values, source_duplicates, 'AUTH_TOKEN_PEPPER')
    else:
        source_pepper = 'AMBIGUOUS'

    assignments, unsafe_scan = scan_protected_files(production_directory)
    pepper_cardinality, pepper_authority, pepper_value = file_authority(
        assignments['AUTH_TOKEN_PEPPER'], unsafe_scan['AUTH_TOKEN_PEPPER']
    )
    legacy_cardinality, legacy_authority, legacy_value = file_authority(
        assignments['AUTH_HASH_SECRET'], unsafe_scan['AUTH_HASH_SECRET']
    )

    candidate_value = pepper_value if pepper_authority == 'READY' else None
    if candidate_value is None and pepper_authority == 'NONE' and legacy_authority == 'READY':
        candidate_value = legacy_value
    purpose_names = ('AUTH_OPAQUE_TOKEN_DIGEST_KEY', 'JWT_SECRET', 'MFA_ENCRYPTION_KEY')
    purpose_values = [active_values.get(name, '') for name in purpose_names]
    if candidate_value is None or any(not SAFE_SECRET.fullmatch(value or '') for value in purpose_values):
        purpose_separation = 'UNAVAILABLE'
    elif any(hmac.compare_digest(candidate_value, value) for value in purpose_values):
        purpose_separation = 'CONFLICT'
    else:
        purpose_separation = 'PASS'

    if candidate_value is not None and purpose_separation == 'CONFLICT':
        recovery_class = 'PURPOSE_CONFLICT'
    elif pepper_authority == 'READY' and purpose_separation == 'PASS':
        recovery_class = 'REUSE_AUTH_TOKEN_PEPPER'
    elif pepper_authority == 'NONE' and legacy_authority == 'READY' and purpose_separation == 'PASS':
        recovery_class = 'MIGRATE_LEGACY_AUTH_HASH_SECRET'
    elif pepper_authority == 'NONE' and legacy_authority == 'NONE' and compose_pepper == 'READY':
        recovery_class = 'REPROJECT_COMPOSE_AUTHORITY'
    elif pepper_authority == 'NONE' and legacy_authority == 'NONE' and compose_pepper == 'MISSING':
        recovery_class = 'NO_EXISTING_AUTHORITY'
    else:
        recovery_class = 'AMBIGUOUS_OR_UNSAFE'

    web_after = running_ids(project, 'web')
    api_after = running_ids(project, 'api')
    if web_after != [web_id] or api_after != [api_id]:
        fail('ACTIVE_RUNTIME_DRIFT')
    if str(labels(inspect_one(web_id)).get('org.opencontainers.image.revision') or '') != active_revision:
        fail('ACTIVE_RUNTIME_DRIFT')
    if str(labels(inspect_one(api_id)).get('org.opencontainers.image.revision') or '') != active_revision:
        fail('ACTIVE_RUNTIME_DRIFT')

    print('|'.join([
        'AUTH_HASH_RUNTIME',
        'PASS',
        active_revision,
        active_pepper,
        source_cardinality,
        source_pepper,
        compose_pepper,
        pepper_cardinality,
        pepper_authority,
        legacy_cardinality,
        legacy_authority,
        purpose_separation,
        recovery_class,
        'NONE',
    ]))
except ClassificationFailure as error:
    print(f'AUTH_HASH_RUNTIME_REMOTE_FAILURE|{error}')
    raise SystemExit(1)
except Exception:
    print('AUTH_HASH_RUNTIME_REMOTE_FAILURE|UNKNOWN')
    raise SystemExit(1)
PY
)"; then
    false
  fi

  stage='AUTH_HASH_RUNTIME_RESULT_VALIDATION'
  failure_detail='OUTPUT_VALIDATION_FAILED'
  [[ "$(wc -l <<< "$output" | tr -d '[:space:]')" == '1' ]]
  IFS='|' read -r marker pass active_revision active_pepper source_cardinality source_pepper \
    compose_pepper pepper_cardinality pepper_authority legacy_cardinality legacy_authority \
    purpose_separation recovery_class production_mutation <<< "$output"
  [[ "$marker" == 'AUTH_HASH_RUNTIME' && "$pass" == 'PASS' ]]
  [[ "$active_revision" =~ ^[0-9a-f]{40}$ ]]
  [[ "$active_pepper" =~ ^(MISSING|READY|UNSAFE)$ ]]
  [[ "$source_cardinality" =~ ^(ZERO|ONE|MULTIPLE)$ ]]
  [[ "$source_pepper" =~ ^(UNAVAILABLE|MISSING|READY|UNSAFE|AMBIGUOUS)$ ]]
  [[ "$compose_pepper" =~ ^(MISSING|READY|UNSAFE)$ ]]
  [[ "$pepper_cardinality" =~ ^(ZERO|ONE|MULTIPLE)$ ]]
  [[ "$pepper_authority" =~ ^(NONE|READY|UNSAFE|MULTIPLE_CONSISTENT|CONFLICT)$ ]]
  [[ "$legacy_cardinality" =~ ^(ZERO|ONE|MULTIPLE)$ ]]
  [[ "$legacy_authority" =~ ^(NONE|READY|UNSAFE|MULTIPLE_CONSISTENT|CONFLICT)$ ]]
  [[ "$purpose_separation" =~ ^(PASS|CONFLICT|UNAVAILABLE)$ ]]
  [[ "$recovery_class" =~ ^(REUSE_AUTH_TOKEN_PEPPER|MIGRATE_LEGACY_AUTH_HASH_SECRET|REPROJECT_COMPOSE_AUTHORITY|NO_EXISTING_AUTHORITY|PURPOSE_CONFLICT|AMBIGUOUS_OR_UNSAFE)$ ]]
  [[ "$production_mutation" == 'NONE' ]]
  git merge-base --is-ancestor "$active_revision" "$TARGET_SHA"
  guard_main

  stage='AUTH_HASH_RUNTIME_RESULT_PUBLISH'
  gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-hash runtime authority classifier

- exact diagnostic main: \`$TARGET_SHA\`
- active production API/Web revision: \`$active_revision\`
- active API AUTH_TOKEN_PEPPER: \`$active_pepper\`
- source-reset API container cardinality: \`$source_cardinality\`
- source-reset AUTH_TOKEN_PEPPER: \`$source_pepper\`
- resolved Compose AUTH_TOKEN_PEPPER: \`$compose_pepper\`
- protected AUTH_TOKEN_PEPPER file cardinality: \`$pepper_cardinality\`
- protected AUTH_TOKEN_PEPPER authority: \`$pepper_authority\`
- protected legacy AUTH_HASH_SECRET file cardinality: \`$legacy_cardinality\`
- protected legacy AUTH_HASH_SECRET authority: \`$legacy_authority\`
- candidate purpose separation from opaque/JWT/MFA keys: \`$purpose_separation\`
- recovery class: \`$recovery_class\`
- protected value / file path / hash / length exposure: \`NONE\`
- reviewer identity / reset token / credential exposure: \`NONE\`
- raw Docker / Compose / filesystem output: \`NOT_PUBLISHED\`
- reset replay / mail send: \`NONE\`
- reset authorized now: \`NO_CURRENT_MAIL_PATH_AND_SMTP_IMAP_NOT_REPROVEN\`
- production mutation: \`NONE\`
- new recurring cost: \`0 RUB\`" >/dev/null
  result_published=1
  exit 0
fi

guard_main
stage='REMOTE_ATTEMPT_CLASSIFICATION'
if output="$(ssh "${ssh_opts[@]}" "$user@$host" "bash -s -- '$SOURCE_REVISION' '$ATTEMPT_SINCE' '$ATTEMPT_UNTIL' '$classifier_mode'" <<'REMOTE'
set -Eeuo pipefail
source_revision="$1"
attempt_since="$2"
attempt_until="$3"
classifier_mode="$4"
remote_substage='REMOTE_PRECONDITION'
remote_source_cardinality='UNKNOWN'
remote_terminal_cardinality='UNKNOWN'
remote_delivery_cardinality='UNKNOWN'
db_output=''
web_logs=''

publish_remote_failure() {
  local rc="$?"
  trap - ERR
  printf 'ATTEMPT_REMOTE_FAILURE|%s|%s|%s|%s\n' \
    "$remote_substage" "$remote_source_cardinality" \
    "$remote_terminal_cardinality" "$remote_delivery_cardinality"
  exit "$rc"
}
trap publish_remote_failure ERR
exec 2>/dev/null

[[ "$source_revision" == '7c768ad7c54523837b06999a8f69bdffe2a840db' ]]
[[ "$attempt_since" == '2026-08-13T13:43:10Z' ]]
[[ "$attempt_until" == '2026-08-13T13:43:26Z' ]]
[[ "$classifier_mode" =~ ^(RESET_ATTEMPT|AUTH_HASH_IMPACT)$ ]]
[[ "$(id -u)" -eq 0 ]]
command -v docker >/dev/null 2>&1

remote_substage='CONTAINER_DISCOVERY'
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 ))
active_web_id="${web_ids[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$active_web_id")"
[[ -n "$project" ]]
mapfile -t api_ids < <(docker ps -q \
  --filter "label=com.docker.compose.project=$project" \
  --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 ))
api_id="${api_ids[0]}"
api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$active_web_id")"
[[ "$api_revision" =~ ^[0-9a-f]{40}$ ]]
[[ "$web_revision" == "$api_revision" ]]
active_revision="$api_revision"
printf 'ACTIVE_REVISION|%s\n' "$active_revision"
printf 'PARITY|PASS\n'

if [[ "$classifier_mode" == 'RESET_ATTEMPT' ]]; then
remote_substage='HISTORICAL_LOG_SOURCE_DISCOVERY'
project_web_output="$(docker ps -aq \
  --filter "label=com.docker.compose.project=$project" \
  --filter 'label=com.docker.compose.service=web')"
project_web_ids=()
if [[ -n "$project_web_output" ]]; then
  mapfile -t project_web_ids <<< "$project_web_output"
fi
historical_web_ids=()
attempt_since_epoch="$(date -u -d "$attempt_since" +%s)"
attempt_until_epoch="$(date -u -d "$attempt_until" +%s)"
[[ "$attempt_since_epoch" =~ ^[0-9]+$ && "$attempt_until_epoch" =~ ^[0-9]+$ ]]
(( attempt_since_epoch <= attempt_until_epoch ))
for candidate_id in "${project_web_ids[@]}"; do
  candidate_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$candidate_id")"
  [[ "$candidate_revision" =~ ^[0-9a-f]{40}$ ]]
  [[ "$candidate_revision" == "$source_revision" ]] || continue
  candidate_started_at="$(docker inspect --format '{{ .State.StartedAt }}' "$candidate_id")"
  candidate_finished_at="$(docker inspect --format '{{ .State.FinishedAt }}' "$candidate_id")"
  if [[ "$candidate_started_at" == 0001-01-01T00:00:00* ]]; then
    continue
  fi
  candidate_started_epoch="$(date -u -d "$candidate_started_at" +%s)"
  [[ "$candidate_started_epoch" =~ ^[0-9]+$ ]]
  (( candidate_started_epoch <= attempt_until_epoch )) || continue
  if [[ "$candidate_finished_at" == 0001-01-01T00:00:00* ]]; then
    historical_web_ids+=("$candidate_id")
    continue
  fi
  candidate_finished_epoch="$(date -u -d "$candidate_finished_at" +%s)"
  [[ "$candidate_finished_epoch" =~ ^[0-9]+$ ]]
  (( candidate_finished_epoch >= attempt_since_epoch )) || continue
  historical_web_ids+=("$candidate_id")
done
case "${#historical_web_ids[@]}" in
  0)
    remote_source_cardinality='ZERO'
    log_source='UNAVAILABLE_AFTER_EXACT_RELEASE'
    historical_web_id=''
    ;;
  1)
    remote_source_cardinality='ONE'
    log_source='HISTORICAL_CONTAINER'
    historical_web_id="${historical_web_ids[0]}"
    ;;
  *)
    remote_source_cardinality='MULTIPLE'
    remote_substage='HISTORICAL_LOG_SOURCE_MULTIPLE'
    false
    ;;
esac
unset project_web_output project_web_ids historical_web_ids candidate_id candidate_revision
unset candidate_started_at candidate_finished_at candidate_started_epoch candidate_finished_epoch
unset attempt_since_epoch attempt_until_epoch
else
  remote_source_cardinality='UNKNOWN'
  log_source='NOT_RUN'
  historical_web_id=''
fi

remote_substage='DATABASE_AGGREGATES'
if db_output="$(
docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - "$classifier_mode" "$attempt_since" "$attempt_until" <<'NODE'
const { createHash, createHmac } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const [classifierMode, attemptSince, attemptUntil] = process.argv.slice(2);
const safeCount = (value) => Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 100;
const safeSecret = /^[A-Za-z0-9._~+/=-]{32,512}$/;
const secretState = (value) => {
  const raw = String(value || '');
  if (!raw) return 'MISSING';
  return raw === raw.trim() && safeSecret.test(raw) ? 'READY' : 'UNSAFE';
};
const presenceState = (value) => value === true ? 'NONZERO' : 'ZERO';
const explicitFailureCodes = new Set([
  'CLASSIFIER_MODE_INVALID',
  'AUTH_DATABASE_URL_MISSING',
  'AUTH_DATABASE_URL_NOT_ISOLATED',
  'AUTH_DATABASE_URL_INVALID',
  'AUTH_IMPACT_PRINCIPAL_BOUNDARY',
  'AUTH_IMPACT_AGGREGATE_CARDINALITY',
  'AUTH_IMPACT_AGGREGATE_INVALID',
  'STAFF_DATABASE_URL_MISSING',
  'STAFF_PRINCIPAL_BOUNDARY',
  'REVIEWER_CARDINALITY',
  'REVIEWER_READINESS_INVALID',
  'REVIEWER_SUBJECT_INVALID',
  'AUTH_TOKEN_PEPPER_MISSING',
  'ATTEMPT_BINDING_INVALID',
  'AUTH_PRINCIPAL_BOUNDARY',
  'AUTH_SUBJECT_NOT_FOUND',
  'CHALLENGE_AGGREGATE_CARDINALITY',
  'CHALLENGE_AGGREGATE_INVALID',
  'CHALLENGE_STATUS_INVALID',
  'AUDIT_AGGREGATE_CARDINALITY',
  'AUDIT_AGGREGATE_INVALID',
  'ATTEMPT_EVIDENCE_AMBIGUOUS',
]);
const fail = (code) => {
  const error = new Error(code);
  error.code = code;
  throw error;
};
const safeFailureCode = (error) => {
  const explicit = String(error?.message || '');
  if (explicitFailureCodes.has(explicit)) return explicit;
  for (const candidate of [error?.meta?.code, error?.code]) {
    const value = String(candidate || '').toUpperCase();
    if (/^[A-Z0-9]{4,8}$/.test(value)) return `DB_${value}`;
  }
  return 'UNKNOWN';
};
let staffDb;
let authDb;

(async () => {
  if (!['RESET_ATTEMPT', 'AUTH_HASH_IMPACT'].includes(classifierMode)) {
    fail('CLASSIFIER_MODE_INVALID');
  }
  const authUrl = String(process.env.AUTH_DATABASE_URL || '').trim();
  const dealUrl = String(process.env.DATABASE_URL || '').trim();
  if (!authUrl) fail('AUTH_DATABASE_URL_MISSING');
  if (!dealUrl || authUrl === dealUrl) fail('AUTH_DATABASE_URL_NOT_ISOLATED');
  let readOnlyAuthUrl;
  try {
    readOnlyAuthUrl = new URL(authUrl);
    const existingOptions = readOnlyAuthUrl.searchParams.get('options');
    readOnlyAuthUrl.searchParams.set(
      'options',
      `${existingOptions ? `${existingOptions} ` : ''}-c default_transaction_read_only=on`,
    );
  } catch {
    fail('AUTH_DATABASE_URL_INVALID');
  }
  authDb = new PrismaClient({ datasources: { db: { url: readOnlyAuthUrl.toString() } } });
  process.stdout.write('AUTH_DATASOURCE|PASS\n');

  if (classifierMode === 'AUTH_HASH_IMPACT') {
    const genericPepperState = secretState(process.env.AUTH_TOKEN_PEPPER);
    const opaqueKeyState = secretState(process.env.AUTH_OPAQUE_TOKEN_DIGEST_KEY);
    const aggregate = await authDb.$transaction(async (tx) => {
      const principalRows = await tx.$queryRawUnsafe(`
        SELECT current_setting('transaction_read_only') = 'on' AS read_only,
               NOT rolsuper AS no_super,
               NOT rolbypassrls AS no_bypass,
               NOT rolinherit AS no_inherit,
               has_schema_privilege(current_user, 'auth', 'USAGE') AS auth_usage,
               has_table_privilege(current_user, 'auth.login_throttles', 'SELECT') AS login_select,
               has_table_privilege(current_user, 'auth.registration_applications', 'SELECT') AS registration_select,
               has_table_privilege(current_user, 'auth.registration_public_attempts', 'SELECT') AS attempt_select,
               has_table_privilege(current_user, 'auth.organization_invitations', 'SELECT') AS invitation_select,
               has_table_privilege(current_user, 'auth.organization_membership_command_events', 'SELECT') AS membership_event_select,
               has_table_privilege(current_user, 'auth.mfa_recovery_challenges', 'SELECT') AS mfa_recovery_select
        FROM pg_roles WHERE rolname = current_user
      `);
      const principal = principalRows[0];
      if (!principal || !Object.values(principal).every((value) => value === true)) {
        fail('AUTH_IMPACT_PRINCIPAL_BOUNDARY');
      }

      const aggregateRows = await tx.$queryRawUnsafe(`
        SELECT
          EXISTS (SELECT 1 FROM auth.login_throttles) AS login_rows,
          EXISTS (
            SELECT 1 FROM auth.login_throttles
            WHERE failures > 0 OR locked_until > now()
          ) AS active_login_rows,
          EXISTS (SELECT 1 FROM auth.registration_applications) AS registration_rows,
          EXISTS (
            SELECT 1 FROM auth.registration_applications
            WHERE status NOT IN ('REJECTED', 'ACTIVATED', 'EXPIRED', 'CANCELLED')
              AND expires_at > now()
          ) AS live_registration_rows,
          EXISTS (SELECT 1 FROM auth.registration_public_attempts) AS registration_attempt_rows,
          EXISTS (SELECT 1 FROM auth.organization_invitations) AS invitation_rows,
          EXISTS (
            SELECT 1 FROM auth.organization_invitations
            WHERE status = 'PENDING' AND expires_at > now()
          ) AS live_invitation_rows,
          EXISTS (SELECT 1 FROM auth.organization_membership_command_events) AS membership_event_rows,
          EXISTS (SELECT 1 FROM auth.mfa_recovery_challenges) AS mfa_recovery_rows,
          EXISTS (
            SELECT 1 FROM auth.mfa_recovery_challenges
            WHERE status = 'PENDING' AND expires_at > now()
          ) AS live_mfa_recovery_rows
      `);
      if (aggregateRows.length !== 1) fail('AUTH_IMPACT_AGGREGATE_CARDINALITY');
      const row = aggregateRows[0];
      if (Object.values(row).some((value) => typeof value !== 'boolean')) {
        fail('AUTH_IMPACT_AGGREGATE_INVALID');
      }
      return row;
    }, { isolationLevel: 'Serializable' });

    const historyStates = [
      aggregate.login_rows,
      aggregate.registration_rows,
      aggregate.registration_attempt_rows,
      aggregate.invitation_rows,
      aggregate.membership_event_rows,
      aggregate.mfa_recovery_rows,
    ];
    const liveStates = [
      aggregate.active_login_rows,
      aggregate.live_registration_rows,
      aggregate.live_invitation_rows,
      aggregate.live_mfa_recovery_rows,
    ];
    let compatibilityClass = 'SAFE_EMPTY_PERSISTED_GENERIC_HASH_STATE';
    if (genericPepperState !== 'MISSING' || opaqueKeyState !== 'READY') {
      compatibilityClass = 'RUNTIME_AUTHORITY_STATE_CHANGED';
    } else if (liveStates.some(Boolean)) {
      compatibilityClass = 'LIVE_GENERIC_HASH_STATE_PRESENT';
    } else if (historyStates.some(Boolean)) {
      compatibilityClass = 'HISTORICAL_GENERIC_HASH_STATE_PRESENT';
    }

    process.stdout.write('AUTH_PRINCIPAL|PASS\n');
    process.stdout.write('AUTH_TRANSACTION|READ_ONLY\n');
    process.stdout.write([
      'AUTH_HASH_IMPACT_DB', 'PASS', genericPepperState, opaqueKeyState,
      presenceState(aggregate.login_rows), presenceState(aggregate.active_login_rows),
      presenceState(aggregate.registration_rows), presenceState(aggregate.live_registration_rows),
      presenceState(aggregate.registration_attempt_rows), presenceState(aggregate.invitation_rows),
      presenceState(aggregate.live_invitation_rows), presenceState(aggregate.membership_event_rows),
      presenceState(aggregate.mfa_recovery_rows), presenceState(aggregate.live_mfa_recovery_rows),
      compatibilityClass, 'NONE',
    ].join('|') + '\n');
    return;
  }

  const staffUrl = String(process.env.STAFF_DATABASE_URL || '').trim();
  if (!staffUrl) fail('STAFF_DATABASE_URL_MISSING');
  staffDb = new PrismaClient({ datasources: { db: { url: staffUrl } } });

  const staffPrincipalRows = await staffDb.$queryRawUnsafe(`
    SELECT current_user = 'pc_staff_runtime' AS runtime_ok,
           NOT rolsuper AS no_super,
           NOT rolbypassrls AS no_bypass,
           NOT has_table_privilege(current_user, 'public.users', 'SELECT') AS no_users,
           NOT has_table_privilege(current_user, 'auth.password_reset_challenges', 'SELECT') AS no_reset_rows,
           coalesce(has_function_privilege(current_user, to_regprocedure('auth.staff_reviewer_preflight()'), 'EXECUTE'), false) AS preflight_execute,
           coalesce(has_function_privilege(current_user, to_regprocedure('auth.staff_reviewer_login_readiness()'), 'EXECUTE'), false) AS readiness_execute,
           coalesce(has_function_privilege(current_user, to_regprocedure('auth.staff_reviewer_password_reset_subject()'), 'EXECUTE'), false) AS subject_execute
    FROM pg_roles WHERE rolname = current_user
  `);
  const staffPrincipal = staffPrincipalRows[0];
  if (!staffPrincipal || !Object.values(staffPrincipal).every((value) => value === true)) {
    fail('STAFF_PRINCIPAL_BOUNDARY');
  }

  const reviewerRows = await staffDb.$queryRawUnsafe(`
    SELECT preflight.active_owner_count,
           preflight.usable_reviewer_count,
           readiness.assignment_ready_count,
           readiness.active_identity_ready_count,
           readiness.membership_ready_count,
           readiness.password_ready_count,
           readiness.mfa_enrolled_ready_count,
           readiness.login_ready_count,
           auth.staff_reviewer_password_reset_subject() AS reviewer_email
    FROM auth.staff_reviewer_preflight() preflight
    CROSS JOIN auth.staff_reviewer_login_readiness() readiness
  `);
  if (reviewerRows.length !== 1) fail('REVIEWER_CARDINALITY');
  const reviewer = reviewerRows[0];
  const readiness = [
    Number(reviewer.active_owner_count),
    Number(reviewer.usable_reviewer_count),
    Number(reviewer.assignment_ready_count),
    Number(reviewer.active_identity_ready_count),
    Number(reviewer.membership_ready_count),
    Number(reviewer.password_ready_count),
    Number(reviewer.mfa_enrolled_ready_count),
    Number(reviewer.login_ready_count),
  ];
  if (readiness.some((value) => !safeCount(value)) || readiness.join('|') !== '1|1|1|1|1|0|0|0') {
    fail('REVIEWER_READINESS_INVALID');
  }
  const passwordReady = readiness[5];
  const mfaReady = readiness[6];
  const loginReady = readiness[7];
  const email = String(reviewer.reviewer_email || '');
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}$/.test(email) || email.length > 254) {
    fail('REVIEWER_SUBJECT_INVALID');
  }
  const authTokenPepper = String(process.env.AUTH_TOKEN_PEPPER || '').trim();
  if (!authTokenPepper) fail('AUTH_TOKEN_PEPPER_MISSING');
  const webAccountHash = createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 16);
  const authHashKey = createHash('sha256').update(authTokenPepper, 'utf8').digest();
  const apiAccountHash = createHmac('sha256', authHashKey)
    .update(`password-reset:${email}`, 'utf8')
    .digest('hex');
  if (!/^[a-f0-9]{16}$/.test(webAccountHash) || !/^[a-f0-9]{64}$/.test(apiAccountHash)) {
    fail('ATTEMPT_BINDING_INVALID');
  }

  const authPrincipalRows = await authDb.$queryRawUnsafe(`
    SELECT NOT rolsuper AS no_super,
           NOT rolbypassrls AS no_bypass,
           NOT rolinherit AS no_inherit,
           has_schema_privilege(current_user, 'auth', 'USAGE') AS auth_usage,
           has_table_privilege(current_user, 'auth.password_reset_challenges', 'SELECT') AS reset_select,
           has_table_privilege(current_user, 'auth.audit_events', 'SELECT') AS audit_select,
           coalesce(has_function_privilege(current_user, to_regprocedure('auth.resolve_password_reset_subject(text)'), 'EXECUTE'), false) AS subject_execute
    FROM pg_roles WHERE rolname = current_user
  `);
  const authPrincipal = authPrincipalRows[0];
  if (!authPrincipal || !Object.values(authPrincipal).every((value) => value === true)) {
    fail('AUTH_PRINCIPAL_BOUNDARY');
  }
  process.stdout.write('AUTH_PRINCIPAL|PASS\n');

  const subjectRows = await authDb.$queryRawUnsafe(
    `SELECT user_id FROM auth.resolve_password_reset_subject($1)`, email,
  );
  if (subjectRows.length !== 1 || !String(subjectRows[0]?.user_id || '')) fail('AUTH_SUBJECT_NOT_FOUND');
  const userId = String(subjectRows[0].user_id);

  const challengeRows = await authDb.$queryRawUnsafe(`
    SELECT
      count(*) FILTER (WHERE created_at >= $2::timestamptz AND created_at <= $3::timestamptz)::int AS attempt_count,
      count(*) FILTER (WHERE status = 'PENDING' AND expires_at > now())::int AS unexpired_pending_count,
      coalesce((SELECT c.status FROM auth.password_reset_challenges c WHERE c.user_id = $1 ORDER BY c.created_at DESC, c.id DESC LIMIT 1), 'NONE') AS latest_status,
      coalesce((SELECT c.expires_at <= now() FROM auth.password_reset_challenges c WHERE c.user_id = $1 ORDER BY c.created_at DESC, c.id DESC LIMIT 1), true) AS latest_expired
    FROM auth.password_reset_challenges
    WHERE user_id = $1
  `, userId, attemptSince, attemptUntil);
  if (challengeRows.length !== 1) fail('CHALLENGE_AGGREGATE_CARDINALITY');
  const challenge = challengeRows[0];
  const attemptChallenges = Number(challenge.attempt_count);
  const unexpiredPending = Number(challenge.unexpired_pending_count);
  const latestStatus = String(challenge.latest_status || 'NONE');
  const latestExpired = challenge.latest_expired === true ? 1 : 0;
  if (![attemptChallenges, unexpiredPending].every(safeCount)) fail('CHALLENGE_AGGREGATE_INVALID');
  if (!['NONE', 'PENDING', 'CONSUMED', 'EXPIRED'].includes(latestStatus)) fail('CHALLENGE_STATUS_INVALID');

  const auditRows = await authDb.$queryRawUnsafe(`
    SELECT
      count(*) FILTER (WHERE user_id = $1 AND reason = 'CHALLENGE_ISSUED')::int AS issued_count,
      count(*) FILTER (WHERE user_id = $1 AND reason = 'COOLDOWN_ACTIVE')::int AS cooldown_count,
      count(*) FILTER (WHERE metadata->>'accountHash' = $4 AND reason = 'DELIVERY_BOUNDARY_REJECTED')::int AS boundary_count,
      count(*) FILTER (WHERE metadata->>'accountHash' = $4 AND reason = 'UNIVERSAL_NON_ELIGIBLE')::int AS noneligible_count,
      count(*) FILTER (WHERE (user_id = $1 OR metadata->>'accountHash' = $4) AND coalesce(reason, '') NOT IN (
        'CHALLENGE_ISSUED', 'COOLDOWN_ACTIVE', 'DELIVERY_BOUNDARY_REJECTED', 'UNIVERSAL_NON_ELIGIBLE'
      ))::int AS other_count
    FROM auth.audit_events
    WHERE action = 'auth.password_reset.request'
      AND created_at >= $2::timestamptz
      AND created_at <= $3::timestamptz
      AND (user_id = $1 OR metadata->>'accountHash' = $4)
  `, userId, attemptSince, attemptUntil, apiAccountHash);
  if (auditRows.length !== 1) fail('AUDIT_AGGREGATE_CARDINALITY');
  const audit = auditRows[0];
  const issued = Number(audit.issued_count);
  const cooldown = Number(audit.cooldown_count);
  const boundary = Number(audit.boundary_count);
  const noneligible = Number(audit.noneligible_count);
  const other = Number(audit.other_count);
  if (![issued, cooldown, boundary, noneligible, other].every(safeCount)) fail('AUDIT_AGGREGATE_INVALID');
  if (attemptChallenges > 1 || issued + cooldown + boundary + noneligible + other > 1) {
    fail('ATTEMPT_EVIDENCE_AMBIGUOUS');
  }

  const privateBinding = ['RESET_ATTEMPT_BINDING', webAccountHash, apiAccountHash].join('|');
  process.stdout.write(privateBinding + '\n');
  process.stdout.write([
    'RESET_ATTEMPT_DB', 'PASS', passwordReady, mfaReady, loginReady,
    attemptChallenges, unexpiredPending, latestStatus, latestExpired,
    issued, cooldown, boundary, noneligible, other,
  ].join('|') + '\n');
})().catch((error) => {
  const marker = classifierMode === 'AUTH_HASH_IMPACT' ? 'AUTH_HASH_IMPACT_DB' : 'RESET_ATTEMPT_DB';
  process.stdout.write(`${marker}|FAIL_${safeFailureCode(error)}\n`);
  process.exitCode = 1;
}).finally(async () => {
  if (staffDb) await staffDb.$disconnect().catch(() => undefined);
  if (authDb) await authDb.$disconnect().catch(() => undefined);
});
NODE
)"; then
  db_rc=0
else
  db_rc=$?
fi

if (( db_rc != 0 )); then
  if [[ "$classifier_mode" == 'AUTH_HASH_IMPACT' ]]; then
    db_failure="$(grep '^AUTH_HASH_IMPACT_DB|FAIL_' <<< "$db_output" | tail -n1 || true)"
    [[ "$db_failure" =~ ^AUTH_HASH_IMPACT_DB\|FAIL_[A-Z0-9_-]{1,64}$ ]]
  else
    db_failure="$(grep '^RESET_ATTEMPT_DB|FAIL_' <<< "$db_output" | tail -n1 || true)"
    [[ "$db_failure" =~ ^RESET_ATTEMPT_DB\|FAIL_[A-Z0-9_-]{1,64}$ ]]
  fi
  printf '%s\n' "$db_failure"
  false
fi

if [[ "$classifier_mode" == 'AUTH_HASH_IMPACT' ]]; then
  datasource_marker="$(grep '^AUTH_DATASOURCE|' <<< "$db_output" | tail -n1 || true)"
  principal_marker="$(grep '^AUTH_PRINCIPAL|' <<< "$db_output" | tail -n1 || true)"
  transaction_marker="$(grep '^AUTH_TRANSACTION|' <<< "$db_output" | tail -n1 || true)"
  db_safe_marker="$(grep '^AUTH_HASH_IMPACT_DB|' <<< "$db_output" | tail -n1 || true)"
  [[ "$datasource_marker" == 'AUTH_DATASOURCE|PASS' ]]
  [[ "$principal_marker" == 'AUTH_PRINCIPAL|PASS' ]]
  [[ "$transaction_marker" == 'AUTH_TRANSACTION|READ_ONLY' ]]
  [[ "$db_safe_marker" =~ ^AUTH_HASH_IMPACT_DB\|PASS\|(MISSING|READY|UNSAFE)\|(MISSING|READY|UNSAFE)(\|(ZERO|NONZERO)){10}\|(SAFE_EMPTY_PERSISTED_GENERIC_HASH_STATE|LIVE_GENERIC_HASH_STATE_PRESENT|HISTORICAL_GENERIC_HASH_STATE_PRESENT|RUNTIME_AUTHORITY_STATE_CHANGED)\|NONE$ ]]

  remote_substage='REVISION_AFTER'
  mapfile -t web_ids_after < <(docker ps -q \
    --filter "label=com.docker.compose.project=$project" \
    --filter 'label=com.docker.compose.service=web')
  mapfile -t api_ids_after < <(docker ps -q \
    --filter "label=com.docker.compose.project=$project" \
    --filter 'label=com.docker.compose.service=api')
  (( ${#web_ids_after[@]} == 1 && ${#api_ids_after[@]} == 1 ))
  [[ "${web_ids_after[0]}" == "$active_web_id" && "${api_ids_after[0]}" == "$api_id" ]]
  [[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")" == "$active_revision" ]]
  [[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$active_web_id")" == "$active_revision" ]]

  trap - ERR
  printf '%s\n' "$datasource_marker" "$principal_marker" "$transaction_marker" "$db_safe_marker"
  printf 'RESET_REPLAY|NONE\n'
  printf 'MAIL_SENT_BY_CLASSIFIER|NO\n'
  printf 'PRODUCTION_MUTATION|NONE\n'
  exit 0
fi
datasource_marker="$(grep '^AUTH_DATASOURCE|' <<< "$db_output" | tail -n1 || true)"
principal_marker="$(grep '^AUTH_PRINCIPAL|' <<< "$db_output" | tail -n1 || true)"
db_safe_marker="$(grep '^RESET_ATTEMPT_DB|' <<< "$db_output" | tail -n1 || true)"
binding_marker="$(grep '^RESET_ATTEMPT_BINDING|' <<< "$db_output" | tail -n1 || true)"
[[ "$datasource_marker" == 'AUTH_DATASOURCE|PASS' ]]
[[ "$principal_marker" == 'AUTH_PRINCIPAL|PASS' ]]
[[ "$db_safe_marker" =~ ^RESET_ATTEMPT_DB\|PASS\| ]]
[[ "$binding_marker" =~ ^RESET_ATTEMPT_BINDING\|[a-f0-9]{16}\|[a-f0-9]{64}$ ]]
IFS='|' read -r _ reviewer_web_hash reviewer_api_hash <<< "$binding_marker"
printf '%s\n' "$datasource_marker" "$principal_marker" "$db_safe_marker"
unset db_output db_failure datasource_marker principal_marker db_safe_marker binding_marker reviewer_api_hash

delivered_class='NOT_OBSERVED'
provider_class='NONE'
reason_class='NONE'
api_status_class='NONE'
transport_class='NONE'
configuration_class='NONE'

if [[ "$log_source" == 'HISTORICAL_CONTAINER' ]]; then
  remote_substage='TERMINAL_LOG_READ'
  if web_logs="$(docker logs --since "$attempt_since" --until "$attempt_until" "$historical_web_id" 2>&1)"; then
    :
  else
    false
  fi

  # Every attributable Web event carries the public-route SHA-256 account hash.
  # Filter it against the reviewer hash resolved inside the same protected SSH
  # session. Configuration events predate that hash in the source route, so
  # their presence is inherently unbindable and must fail closed.
  remote_substage='TERMINAL_LOG_BINDING'
  mapfile -t delivery_lines < <(
    grep -F 'password_reset_delivery_result' <<< "$web_logs" \
      | grep -F "\"accountHash\":\"$reviewer_web_hash\"" || true
  )
  mapfile -t accepted_lines < <(
    grep -F 'password_reset_request_accepted_without_delivery' <<< "$web_logs" \
      | grep -F "\"accountHash\":\"$reviewer_web_hash\"" || true
  )
  mapfile -t api_failure_lines < <(
    grep -F 'password_reset_request_api_failure' <<< "$web_logs" \
      | grep -F "\"accountHash\":\"$reviewer_web_hash\"" || true
  )
  mapfile -t transport_lines < <(
    grep -F 'password_reset_request_transport_failure' <<< "$web_logs" \
      | grep -F "\"accountHash\":\"$reviewer_web_hash\"" || true
  )
  mapfile -t configuration_lines < <(
    grep -F 'password_reset_request_configuration_error' <<< "$web_logs" || true
  )
  unset web_logs reviewer_web_hash
  delivery_count="${#delivery_lines[@]}"
  accepted_count="${#accepted_lines[@]}"
  api_failure_count="${#api_failure_lines[@]}"
  transport_count="${#transport_lines[@]}"
  if (( ${#configuration_lines[@]} != 0 )); then
    remote_substage='UNBOUND_CONFIGURATION_EVENT'
    false
  fi
  configuration_count=0
  terminal_count=$(( delivery_count + accepted_count + api_failure_count + transport_count + configuration_count ))
  case "$terminal_count" in
    0) remote_terminal_cardinality='ZERO' ;;
    1) remote_terminal_cardinality='ONE' ;;
    *) remote_terminal_cardinality='MULTIPLE'; false ;;
  esac
  case "$delivery_count" in
    0) remote_delivery_cardinality='ZERO' ;;
    1) remote_delivery_cardinality='ONE' ;;
    *) remote_delivery_cardinality='MULTIPLE'; false ;;
  esac

  reviewer_correlation=''
  if (( terminal_count == 1 )); then
    bound_line="${delivery_lines[0]:-${accepted_lines[0]:-${api_failure_lines[0]:-${transport_lines[0]:-}}}}"
    reviewer_correlation="$(sed -n 's/.*"correlationId"[[:space:]]*:[[:space:]]*"\([0-9a-f-]*\)".*/\1/p' <<< "$bound_line")"
    [[ "$reviewer_correlation" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]
  fi
  unset bound_line reviewer_correlation

if (( delivery_count == 1 )); then
  remote_substage='DELIVERY_EVENT_CLASSIFICATION'
  delivery_line="${delivery_lines[0]}"
  delivered="$(sed -n 's/.*"delivered"[[:space:]]*:[[:space:]]*\(true\|false\).*/\1/p' <<< "$delivery_line")"
  provider="$(sed -n 's/.*"provider"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' <<< "$delivery_line")"
  reason="$(sed -n 's/.*"reason"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' <<< "$delivery_line")"
  [[ "$delivered" =~ ^(true|false)$ ]]
  [[ "$provider" =~ ^(smtp|resend|none)$ ]]
  [[ -n "$reason" && ${#reason} -le 420 && "$reason" != *$'\n'* && "$reason" != *$'\r'* ]]
  delivered_class="${delivered^^}"
  provider_class="${provider^^}"
  if [[ "$delivered" == 'true' ]]; then
    [[ "$reason" == 'sent' && "$provider" =~ ^(smtp|resend)$ ]]
    reason_class='SENT'
  elif [[ "$reason" == *'smtp_535'* ]]; then
    reason_class='SMTP_AUTH_REJECTED'
  elif [[ "$reason" =~ smtp_(550|551|552|553|554) ]]; then
    reason_class='SMTP_RECIPIENT_OR_POLICY'
  elif [[ "$reason" =~ smtp_(421|450|451|452) ]]; then
    reason_class='SMTP_TEMPORARY'
  elif [[ "$reason" == *'smtp_timeout'* || "$reason" == *'ETIMEDOUT'* ]]; then
    reason_class='SMTP_TIMEOUT'
  elif [[ "$reason" == *'ENOTFOUND'* || "$reason" == *'EAI_AGAIN'* ]]; then
    reason_class='SMTP_DNS_FAILURE'
  elif [[ "$reason" == *'ECONNREFUSED'* ]]; then
    reason_class='SMTP_CONNECTION_REFUSED'
  elif [[ "$reason" == *'certificate'* || "$reason" == *'CERT_'* || "$reason" == *'self signed'* || "$reason" == *'unable to verify'* || "$reason" == *'wrong version number'* ]]; then
    reason_class='SMTP_TLS_FAILURE'
  elif [[ "$reason" == *'smtp_failed:'* ]]; then
    reason_class='SMTP_TRANSPORT_EXCEPTION'
  elif [[ "$reason" =~ resend_(401|403) ]]; then
    reason_class='RESEND_AUTH_REJECTED'
  elif [[ "$reason" == *'resend_429'* ]]; then
    reason_class='RESEND_RATE_LIMIT'
  elif [[ "$reason" =~ resend_5[0-9][0-9] ]]; then
    reason_class='RESEND_UPSTREAM'
  elif [[ "$reason" == *'resend_failed:AbortError'* || "$reason" == *'resend_failed:TimeoutError'* ]]; then
    reason_class='RESEND_TIMEOUT'
  elif [[ "$reason" == *'resend_failed:'* ]]; then
    reason_class='RESEND_TRANSPORT_EXCEPTION'
  elif [[ "$reason" == *'resend_not_configured'* && "$reason" == *'smtp_not_configured'* ]]; then
    reason_class='MAIL_CHANNEL_NOT_CONFIGURED'
  else
    reason_class='UNCLASSIFIED'
  fi
fi

if (( api_failure_count == 1 )); then
  remote_substage='API_FAILURE_CLASSIFICATION'
  api_status="$(sed -n 's/.*"status"[[:space:]]*:[[:space:]]*\([0-9][0-9][0-9]\).*/\1/p' <<< "${api_failure_lines[0]}")"
  [[ "$api_status" =~ ^[0-9]{3}$ ]]
  case "$api_status" in
    429) api_status_class='HTTP_429' ;;
    4??) api_status_class='HTTP_4XX' ;;
    5??) api_status_class='HTTP_5XX' ;;
    *) api_status_class='HTTP_OTHER' ;;
  esac
fi

if (( transport_count == 1 )); then
  remote_substage='TRANSPORT_FAILURE_CLASSIFICATION'
  transport_reason="$(sed -n 's/.*"reason"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' <<< "${transport_lines[0]}")"
  [[ -n "$transport_reason" && ${#transport_reason} -le 64 ]]
  case "$transport_reason" in
    AbortError) transport_class='ABORT' ;;
    TimeoutError) transport_class='TIMEOUT' ;;
    *) transport_class='OTHER' ;;
  esac
fi

if (( configuration_count == 1 )); then
  remote_substage='CONFIGURATION_FAILURE_CLASSIFICATION'
  configuration_line="${configuration_lines[0]}"
  api_configured="$(sed -n 's/.*"apiConfigured"[[:space:]]*:[[:space:]]*\(true\|false\).*/\1/p' <<< "$configuration_line")"
  boundary_configured="$(sed -n 's/.*"deliveryBoundaryConfigured"[[:space:]]*:[[:space:]]*\(true\|false\).*/\1/p' <<< "$configuration_line")"
  mail_configured="$(sed -n 's/.*"mailConfigured"[[:space:]]*:[[:space:]]*\(true\|false\).*/\1/p' <<< "$configuration_line")"
  [[ "$api_configured" =~ ^(true|false)$ ]]
  [[ "$boundary_configured" =~ ^(true|false)$ ]]
  [[ "$mail_configured" =~ ^(true|false)$ ]]
  missing_count=0
  [[ "$api_configured" == 'true' ]] || (( missing_count += 1 ))
  [[ "$boundary_configured" == 'true' ]] || (( missing_count += 1 ))
  [[ "$mail_configured" == 'true' ]] || (( missing_count += 1 ))
  (( missing_count >= 1 ))
  if (( missing_count > 1 )); then
    configuration_class='MULTIPLE_MISSING'
  elif [[ "$api_configured" == 'false' ]]; then
    configuration_class='API_MISSING'
  elif [[ "$boundary_configured" == 'false' ]]; then
    configuration_class='DELIVERY_BOUNDARY_MISSING'
  else
    configuration_class='MAIL_MISSING'
  fi
fi

  [[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$historical_web_id")" == "$source_revision" ]]
else
  remote_substage='TERMINAL_LOG_UNAVAILABLE'
  unset reviewer_web_hash
  terminal_count='NA'
  delivery_count='NA'
  accepted_count='NA'
  api_failure_count='NA'
  transport_count='NA'
  configuration_count='NA'
  delivered_class='UNAVAILABLE'
  provider_class='UNAVAILABLE'
  reason_class='UNAVAILABLE'
  api_status_class='UNAVAILABLE'
  transport_class='UNAVAILABLE'
  configuration_class='UNAVAILABLE'
  remote_terminal_cardinality='UNAVAILABLE'
  remote_delivery_cardinality='UNAVAILABLE'
fi

unset delivery_lines accepted_lines api_failure_lines transport_lines configuration_lines
unset delivery_line delivered provider reason api_status transport_reason configuration_line
unset api_configured boundary_configured mail_configured missing_count
remote_substage='REVISION_AFTER'
mapfile -t web_ids_after < <(docker ps -q \
  --filter "label=com.docker.compose.project=$project" \
  --filter 'label=com.docker.compose.service=web')
mapfile -t api_ids_after < <(docker ps -q \
  --filter "label=com.docker.compose.project=$project" \
  --filter 'label=com.docker.compose.service=api')
(( ${#web_ids_after[@]} == 1 && ${#api_ids_after[@]} == 1 ))
[[ "${web_ids_after[0]}" == "$active_web_id" && "${api_ids_after[0]}" == "$api_id" ]]
[[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")" == "$active_revision" ]]
[[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$active_web_id")" == "$active_revision" ]]
if [[ "$log_source" == 'HISTORICAL_CONTAINER' ]]; then
  [[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$historical_web_id")" == "$source_revision" ]]
fi

trap - ERR
printf 'RESET_ATTEMPT_LOG|PASS|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s\n' \
  "$log_source" "$terminal_count" "$delivery_count" "$accepted_count" "$api_failure_count" "$transport_count" \
  "$configuration_count" "$delivered_class" "$provider_class" "$reason_class" "$api_status_class" \
  "$transport_class" "$configuration_class"
printf 'RESET_REPLAY|NONE\n'
printf 'MAIL_SENT_BY_CLASSIFIER|NO\n'
printf 'PRODUCTION_MUTATION|NONE\n'
REMOTE
)"; then
  remote_rc=0
else
  remote_rc=$?
fi
stage='RESULT_VALIDATION'

parity="$(grep '^PARITY|' <<< "$output" | tail -n1 || true)"
active_marker="$(grep '^ACTIVE_REVISION|' <<< "$output" | tail -n1 || true)"
datasource="$(grep '^AUTH_DATASOURCE|' <<< "$output" | tail -n1 || true)"
principal="$(grep '^AUTH_PRINCIPAL|' <<< "$output" | tail -n1 || true)"
transaction_marker="$(grep '^AUTH_TRANSACTION|' <<< "$output" | tail -n1 || true)"
if [[ "$classifier_mode" == 'AUTH_HASH_IMPACT' ]]; then
  db_marker="$(grep '^AUTH_HASH_IMPACT_DB|' <<< "$output" | tail -n1 || true)"
else
  db_marker="$(grep '^RESET_ATTEMPT_DB|' <<< "$output" | tail -n1 || true)"
fi
log_marker="$(grep '^RESET_ATTEMPT_LOG|' <<< "$output" | tail -n1 || true)"
replay_marker="$(grep '^RESET_REPLAY|' <<< "$output" | tail -n1 || true)"
mail_marker="$(grep '^MAIL_SENT_BY_CLASSIFIER|' <<< "$output" | tail -n1 || true)"
mutation_marker="$(grep '^PRODUCTION_MUTATION|' <<< "$output" | tail -n1 || true)"
if (( remote_rc != 0 )); then
  remote_failure="$(grep '^ATTEMPT_REMOTE_FAILURE|' <<< "$output" | tail -n1 || true)"
  if [[ "$parity" != 'PARITY|PASS' ]]; then
    failure_detail='PARITY_OR_PRE_NODE_FAILURE'
  elif [[ "$db_marker" =~ ^AUTH_HASH_IMPACT_DB\|FAIL_([A-Z0-9_-]{1,64})$ ]]; then
    failure_detail="${BASH_REMATCH[1]}"
  elif [[ "$db_marker" =~ ^RESET_ATTEMPT_DB\|FAIL_([A-Z0-9_-]{1,64})$ ]]; then
    failure_detail="${BASH_REMATCH[1]}"
  elif [[ "$remote_failure" =~ ^ATTEMPT_REMOTE_FAILURE\|([A-Z0-9_-]{1,64})\|(ZERO|ONE|MULTIPLE|UNKNOWN)\|(ZERO|ONE|MULTIPLE|UNKNOWN|UNAVAILABLE)\|(ZERO|ONE|MULTIPLE|UNKNOWN|UNAVAILABLE)$ ]]; then
    failure_detail="${BASH_REMATCH[1]}_${BASH_REMATCH[2]}_${BASH_REMATCH[3]}_${BASH_REMATCH[4]}"
  else
    failure_detail='REMOTE_NO_SAFE_MARKER'
  fi
  [[ "$failure_detail" =~ ^[A-Z0-9_-]{1,96}$ ]]
  false
fi

[[ "$parity" == 'PARITY|PASS' ]]
[[ "$active_marker" =~ ^ACTIVE_REVISION\|([0-9a-f]{40})$ ]]
active_revision="${BASH_REMATCH[1]}"
git merge-base --is-ancestor "$active_revision" "$TARGET_SHA"
[[ "$datasource" == 'AUTH_DATASOURCE|PASS' ]]
[[ "$principal" == 'AUTH_PRINCIPAL|PASS' ]]
[[ "$replay_marker" == 'RESET_REPLAY|NONE' ]]
[[ "$mail_marker" == 'MAIL_SENT_BY_CLASSIFIER|NO' ]]
[[ "$mutation_marker" == 'PRODUCTION_MUTATION|NONE' ]]

if [[ "$classifier_mode" == 'AUTH_HASH_IMPACT' ]]; then
  [[ "$transaction_marker" == 'AUTH_TRANSACTION|READ_ONLY' ]]
  IFS='|' read -r db_tag db_result generic_pepper opaque_key login_rows active_login_rows \
    registration_rows live_registration_rows registration_attempt_rows invitation_rows \
    live_invitation_rows membership_event_rows mfa_recovery_rows live_mfa_recovery_rows \
    compatibility_class production_mutation <<< "$db_marker"
  [[ "$db_tag" == 'AUTH_HASH_IMPACT_DB' && "$db_result" == 'PASS' ]]
  [[ "$generic_pepper" =~ ^(MISSING|READY|UNSAFE)$ ]]
  [[ "$opaque_key" =~ ^(MISSING|READY|UNSAFE)$ ]]
  for value in "$login_rows" "$active_login_rows" "$registration_rows" \
    "$live_registration_rows" "$registration_attempt_rows" "$invitation_rows" \
    "$live_invitation_rows" "$membership_event_rows" "$mfa_recovery_rows" \
    "$live_mfa_recovery_rows"; do
    [[ "$value" =~ ^(ZERO|NONZERO)$ ]]
  done
  [[ "$compatibility_class" =~ ^(SAFE_EMPTY_PERSISTED_GENERIC_HASH_STATE|LIVE_GENERIC_HASH_STATE_PRESENT|HISTORICAL_GENERIC_HASH_STATE_PRESENT|RUNTIME_AUTHORITY_STATE_CHANGED)$ ]]
  [[ "$production_mutation" == 'NONE' ]]

  provisioning_gate='BLOCKED'
  if [[ "$compatibility_class" == 'SAFE_EMPTY_PERSISTED_GENERIC_HASH_STATE' ]]; then
    provisioning_gate='CANDIDATE_PASS'
  fi

  guard_main
  stage='AUTH_HASH_IMPACT_RESULT_PUBLISH'
  gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-hash persisted-impact classifier

- exact diagnostic main: \`$TARGET_SHA\`
- active production API/Web revision: \`$active_revision\`
- active API AUTH_TOKEN_PEPPER: \`$generic_pepper\`
- dedicated opaque-token authority: \`$opaque_key\`
- database transaction mode: \`READ_ONLY\`
- login-throttle rows: \`$login_rows\`
- active failed-login / lockout rows: \`$active_login_rows\`
- registration-application rows: \`$registration_rows\`
- live nonterminal registration rows: \`$live_registration_rows\`
- registration public-attempt rows: \`$registration_attempt_rows\`
- organization-invitation rows: \`$invitation_rows\`
- live pending invitation rows: \`$live_invitation_rows\`
- membership-command idempotency rows: \`$membership_event_rows\`
- MFA-recovery rows: \`$mfa_recovery_rows\`
- live pending MFA-recovery rows: \`$live_mfa_recovery_rows\`
- compatibility class: \`$compatibility_class\`
- bounded auth-key provisioning gate: \`$provisioning_gate\`
- bearer reset / verification / MFA / refresh token digests remain on dedicated opaque authority: \`YES_BY_RUNTIME_AUTHORITY_SEPARATION\`
- session, client-IP and audit hashes are not validation authority: \`EXCLUDED_FROM_COMPATIBILITY_GATE\`
- database row / identity / hash / count exposure: \`NONE\`
- protected value / URL / credential exposure: \`NONE\`
- raw Docker / database output: \`NOT_PUBLISHED\`
- reset replay / mail send: \`NONE\`
- reset authorized now: \`NO_CURRENT_MAIL_PATH_AND_SMTP_IMAP_NOT_REPROVEN\`
- production mutation: \`NONE\`
- new recurring cost: \`0 RUB\`" >/dev/null
  result_published=1
  exit 0
fi

IFS='|' read -r db_tag db_result password_ready mfa_ready login_ready attempt_challenges unexpired_pending latest_status latest_expired issued cooldown boundary noneligible other_audit <<< "$db_marker"
[[ "$db_tag" == 'RESET_ATTEMPT_DB' && "$db_result" == 'PASS' ]]
for value in "$password_ready" "$mfa_ready" "$login_ready" "$attempt_challenges" "$unexpired_pending" "$latest_expired" "$issued" "$cooldown" "$boundary" "$noneligible" "$other_audit"; do
  [[ "$value" =~ ^[0-9]{1,3}$ ]]
done
[[ "$latest_status" =~ ^(NONE|PENDING|CONSUMED|EXPIRED)$ ]]

IFS='|' read -r log_tag log_result log_source terminal_count delivery_count accepted_count api_failure_count transport_count configuration_count delivered_class provider_class reason_class api_status_class transport_class configuration_class <<< "$log_marker"
[[ "$log_tag" == 'RESET_ATTEMPT_LOG' && "$log_result" == 'PASS' ]]
[[ "$log_source" =~ ^(HISTORICAL_CONTAINER|UNAVAILABLE_AFTER_EXACT_RELEASE)$ ]]
if [[ "$log_source" == 'HISTORICAL_CONTAINER' ]]; then
  for value in "$terminal_count" "$delivery_count" "$accepted_count" "$api_failure_count" "$transport_count" "$configuration_count"; do
    [[ "$value" =~ ^[01]$ ]]
  done
  [[ "$delivered_class" =~ ^(NOT_OBSERVED|TRUE|FALSE)$ ]]
  [[ "$provider_class" =~ ^(NONE|SMTP|RESEND)$ ]]
  [[ "$reason_class" =~ ^(NONE|SENT|SMTP_AUTH_REJECTED|SMTP_RECIPIENT_OR_POLICY|SMTP_TEMPORARY|SMTP_TIMEOUT|SMTP_DNS_FAILURE|SMTP_CONNECTION_REFUSED|SMTP_TLS_FAILURE|SMTP_TRANSPORT_EXCEPTION|RESEND_AUTH_REJECTED|RESEND_RATE_LIMIT|RESEND_UPSTREAM|RESEND_TIMEOUT|RESEND_TRANSPORT_EXCEPTION|MAIL_CHANNEL_NOT_CONFIGURED|UNCLASSIFIED)$ ]]
  [[ "$api_status_class" =~ ^(NONE|HTTP_429|HTTP_4XX|HTTP_5XX|HTTP_OTHER)$ ]]
  [[ "$transport_class" =~ ^(NONE|ABORT|TIMEOUT|OTHER)$ ]]
  [[ "$configuration_class" =~ ^(NONE|API_MISSING|DELIVERY_BOUNDARY_MISSING|MAIL_MISSING|MULTIPLE_MISSING)$ ]]
  (( terminal_count == delivery_count + accepted_count + api_failure_count + transport_count + configuration_count ))
else
  [[ "$terminal_count|$delivery_count|$accepted_count|$api_failure_count|$transport_count|$configuration_count" == 'NA|NA|NA|NA|NA|NA' ]]
  [[ "$delivered_class|$provider_class|$reason_class|$api_status_class|$transport_class|$configuration_class" == 'UNAVAILABLE|UNAVAILABLE|UNAVAILABLE|UNAVAILABLE|UNAVAILABLE|UNAVAILABLE' ]]
fi

if [[ "$log_source" == 'UNAVAILABLE_AFTER_EXACT_RELEASE' ]]; then
  if (( attempt_challenges > 0 || issued > 0 )); then
    attempt_class='DURABLE_CHALLENGE_CREATED_LOG_UNAVAILABLE'
  elif (( cooldown > 0 )); then
    attempt_class='DURABLE_COOLDOWN_ACTIVE_LOG_UNAVAILABLE'
  elif (( boundary > 0 )); then
    attempt_class='DURABLE_DELIVERY_BOUNDARY_REJECTED_LOG_UNAVAILABLE'
  elif (( noneligible > 0 )); then
    attempt_class='DURABLE_REVIEWER_NON_ELIGIBLE_LOG_UNAVAILABLE'
  elif (( other_audit > 0 )); then
    attempt_class='DURABLE_OTHER_AUDIT_LOG_UNAVAILABLE'
  else
    attempt_class='NO_DURABLE_RESET_EFFECT_LOG_UNAVAILABLE'
  fi
else
attempt_class='BEFORE_POST_OR_NO_DURABLE_EFFECT'
if (( configuration_count == 1 )); then
  attempt_class='WEB_CONFIGURATION_REJECTED'
elif (( api_failure_count == 1 )); then
  attempt_class='WEB_OBSERVED_API_FAILURE'
elif (( transport_count == 1 )); then
  attempt_class='WEB_OBSERVED_AUTH_TRANSPORT_FAILURE'
elif (( delivery_count == 1 )); then
  if (( attempt_challenges == 0 && issued == 0 )); then
    attempt_class='DELIVERY_EVENT_WITHOUT_DURABLE_MATCH'
  elif [[ "$delivered_class" == 'TRUE' ]]; then
    attempt_class='CHALLENGE_CREATED_DELIVERY_REPORTED_PASS'
  else
    attempt_class='CHALLENGE_CREATED_DELIVERY_REPORTED_FAIL'
  fi
elif (( accepted_count == 1 )); then
  if (( cooldown > 0 )); then
    attempt_class='COOLDOWN_ACTIVE_NO_NEW_DELIVERY'
  elif (( boundary > 0 )); then
    attempt_class='DELIVERY_BOUNDARY_REJECTED'
  elif (( noneligible > 0 )); then
    attempt_class='REVIEWER_NON_ELIGIBLE'
  elif (( attempt_challenges > 0 || issued > 0 )); then
    attempt_class='CHALLENGE_CREATED_BUT_DELIVERY_ENVELOPE_MISSING'
  else
    attempt_class='API_ACCEPTED_WITHOUT_DELIVERY_UNCLASSIFIED'
  fi
elif (( attempt_challenges > 0 || issued > 0 )); then
  attempt_class='CHALLENGE_CREATED_WEB_TERMINAL_NOT_OBSERVED'
fi
fi

fresh='NO'
blocker='NONE'
if (( password_ready != 0 )); then
  blocker='PASSWORD_ALREADY_READY'
elif (( unexpired_pending > 0 )); then
  blocker='UNEXPIRED_RESET_EXISTS'
elif [[ "$latest_status" == 'CONSUMED' ]]; then
  blocker='CONSUMED_CHALLENGE_WITH_PASSWORD_NOT_READY'
else
  fresh='YES'
fi

guard_main
stage='PUBLISH_RESULT'
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset attempt classifier

- source reset run: \`$SOURCE_RUN_ID\`
- exact diagnostic main: \`$TARGET_SHA\`
- source reset revision: \`$SOURCE_REVISION\`
- active production API/Web revision: \`$active_revision\`
- result: \`PASS_READ_ONLY_CLASSIFIED\`
- attempt class: \`$attempt_class\`
- historical Web log source: \`$log_source\`
- Web cardinalities classify historical events only: \`$([[ "$log_source" == 'HISTORICAL_CONTAINER' ]] && printf 'YES' || printf 'NO_LOG_SOURCE_UNAVAILABLE')\`
- challenge rows created in attempt window: \`$attempt_challenges\`
- CHALLENGE_ISSUED audit in attempt window: \`$issued\`
- COOLDOWN_ACTIVE audit in attempt window: \`$cooldown\`
- DELIVERY_BOUNDARY_REJECTED audit in attempt window: \`$boundary\`
- UNIVERSAL_NON_ELIGIBLE audit in attempt window: \`$noneligible\`
- other reset audit in attempt window: \`$other_audit\`
- terminal Web event cardinality: \`$terminal_count\`
- delivery-result event cardinality: \`$delivery_count\`
- accepted-without-delivery event cardinality: \`$accepted_count\`
- API-failure event cardinality: \`$api_failure_count\`
- transport-failure event cardinality: \`$transport_count\`
- configuration-error event cardinality: \`$configuration_count\`
- delivered class: \`$delivered_class\`
- provider class: \`$provider_class\`
- delivery reason class: \`$reason_class\`
- API status class: \`$api_status_class\`
- transport class: \`$transport_class\`
- configuration class: \`$configuration_class\`
- current password / MFA / login ready: \`$password_ready / $mfa_ready / $login_ready\`
- current unexpired pending reset challenges: \`$unexpired_pending\`
- latest challenge status: \`$latest_status\`
- latest challenge expired by clock: \`$latest_expired\`
- fresh reset challenge slot clear: \`$fresh\`
- challenge-slot blocker: \`$blocker\`
- reset authorized now: \`NO_CURRENT_MAIL_PATH_AND_SMTP_IMAP_NOT_REPROVEN\`
- reviewer identity / account hash / correlation id exposure: \`NONE\`
- reset token / hash / user-id output: \`NONE\`
- reset replay / mail sent by classifier: \`NONE\`
- raw database/runtime output: \`NOT_PUBLISHED\`
- production mutation: \`NONE\`
- new recurring cost: \`0 RUB\`" >/dev/null
result_published=1
