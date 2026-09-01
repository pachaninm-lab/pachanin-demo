#!/usr/bin/env bash
set -Eeuo pipefail

expected_sha="${1:-}"
stale_seconds="${2:-}"
cleanup_correlation="${3:-}"
runner_path="${4:-}"
self_path="$(realpath -e -- "$0" 2>/dev/null || true)"

fail() {
  printf 'P0_RETIRE_RESULT=FAIL\n'
  printf 'P0_RETIRE_BLOCKER=%s\n' "$1"
  exit "${2:-1}"
}
cleanup() {
  [[ -z "$runner_path" ]] || rm -f -- "$runner_path"
  [[ -z "$self_path" ]] || rm -f -- "$self_path"
}
trap cleanup EXIT

[[ "$(id -u)" -eq 0 ]] || fail ROOT_AUTHORITY_REQUIRED 31
command -v docker >/dev/null 2>&1 || fail DOCKER_REQUIRED 32
command -v python3 >/dev/null 2>&1 || fail PYTHON_REQUIRED 33
[[ "$expected_sha" =~ ^[0-9a-f]{40}$ ]] || fail EXPECTED_SHA_INVALID 34
[[ "$stale_seconds" == 1800 ]] || fail STALE_WINDOW_INVALID 35
[[ "$cleanup_correlation" =~ ^p0-fixture-retire:[0-9]+-[0-9]+$ ]] || fail CORRELATION_INVALID 36
[[ "$runner_path" =~ ^/tmp/p0-retire-[0-9]+-[0-9]+[.]cjs$ && -f "$runner_path" && ! -L "$runner_path" ]] || fail RUNNER_PATH_INVALID 37
chmod 0600 "$runner_path"

mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 )) || fail WEB_CARDINALITY_NOT_ONE 38
web_id="${web_ids[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
working_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
config_files="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"
[[ "$project" =~ ^[A-Za-z0-9_.-]{1,128}$ ]] || fail COMPOSE_PROJECT_INVALID 39
[[ "$working_dir" == /* && "$working_dir" != / && -d "$working_dir" && ! -L "$working_dir" ]] || fail COMPOSE_WORKDIR_INVALID 40
[[ -n "$config_files" ]] || fail COMPOSE_CONFIG_FILES_MISSING 41

mapfile -t api_ids < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 )) || fail API_CARDINALITY_NOT_ONE 42
api_id="${api_ids[0]}"
api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
[[ "$api_revision" == "$expected_sha" ]] || fail API_REVISION_MISMATCH 43
[[ "$web_revision" == "$expected_sha" ]] || fail WEB_REVISION_MISMATCH 44
docker exec "$api_id" /nodejs/bin/node -e "fetch('http://127.0.0.1:3001/ready',{signal:AbortSignal.timeout(4000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" >/dev/null 2>&1 || fail API_NOT_READY 45

working_dir="$(realpath -e -- "$working_dir")"
IFS=',' read -r -a raw_compose_files <<< "$config_files"
compose_files=()
for raw_file in "${raw_compose_files[@]}"; do
  file="${raw_file#"${raw_file%%[![:space:]]*}"}"
  file="${file%"${file##*[![:space:]]}"}"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$working_dir/$file"
  [[ -f "$file" && ! -L "$file" ]] || fail COMPOSE_FILE_INVALID 46
  compose_files+=("$(realpath -e -- "$file")")
done
(( ${#compose_files[@]} >= 1 )) || fail COMPOSE_FILE_SET_EMPTY 47

dc=(docker compose --project-directory "$working_dir" --project-name "$project")
for file in "${compose_files[@]}"; do dc+=(-f "$file"); done
compose_json="$(${dc[@]} config --format json)"
[[ -n "$compose_json" ]] || fail COMPOSE_CONFIG_EMPTY 48
migration_database_url="$(python3 -c '
import json,re,sys
from urllib.parse import urlsplit
services=(json.load(sys.stdin).get("services") or {})
c=[]
for name,service in services.items():
    image=str(service.get("image") or "")
    command=service.get("command")
    command=" ".join(map(str,command)) if isinstance(command,list) else str(command or "")
    if re.search(r"(^|[-_])(migrate|migration)([-_]|$)",name,re.I) or "grainflow-migration" in image or ("prisma" in command.lower() and "migrate" in command.lower()):
        c.append((name,service))
if len(c)!=1: raise SystemExit(1)
env=c[0][1].get("environment") or {}
if isinstance(env,list): env=dict(x.split("=",1) for x in env if isinstance(x,str) and "=" in x)
value=str(env.get("DATABASE_URL") or "").strip()
u=urlsplit(value)
if u.scheme not in ("postgres","postgresql") or not u.username or not u.password or not u.hostname or not u.path.strip("/"): raise SystemExit(2)
sys.stdout.write(value)
' <<< "$compose_json")" || fail MIGRATION_DATABASE_AUTHORITY_UNAVAILABLE 49
unset compose_json
[[ -n "$migration_database_url" ]] || fail MIGRATION_DATABASE_AUTHORITY_UNAVAILABLE 50

api_env="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$api_id")"
main_db="$(sed -n 's/^DATABASE_URL=//p' <<< "$api_env" | head -1)"
auth_db="$(sed -n 's/^AUTH_DATABASE_URL=//p' <<< "$api_env" | head -1)"
unset api_env
[[ -n "$main_db" && -n "$auth_db" ]] || fail API_DATABASE_TARGETS_MISSING 51
parity="$(printf '%s\n%s\n%s\n' "$migration_database_url" "$main_db" "$auth_db" | python3 -c '
import sys
from urllib.parse import unquote,urlsplit
rows=sys.stdin.read().splitlines()
if len(rows)<3: raise SystemExit(1)
m,d,a=[urlsplit(x) for x in rows[:3]]
def valid(x): return x.scheme in ("postgres","postgresql") and x.username and x.password and x.hostname and x.path.strip("/")
def target(x): return ((x.hostname or "").lower(),x.port or 5432,unquote(x.path))
if not all(valid(x) for x in (m,d,a)): raise SystemExit(2)
if target(m)!=target(d) or target(m)!=target(a): raise SystemExit(3)
if unquote(m.username) in {unquote(d.username),unquote(a.username)}: raise SystemExit(4)
print("PASS")
')" || fail DATABASE_TARGET_PARITY_FAILED 52
[[ "$parity" == PASS ]] || fail DATABASE_TARGET_PARITY_FAILED 53
unset main_db auth_db parity

set +e
node_output="$(docker exec \
  -e P0_RETIRE_BOUNDED_MAINTENANCE=1 \
  -e P0_RETIRE_DATABASE_URL="$migration_database_url" \
  -i "$api_id" /nodejs/bin/node - "$stale_seconds" "$cleanup_correlation" \
  < "$runner_path" 2>/dev/null)"
node_rc=$?
set -e
unset migration_database_url
safe_output="$(printf '%s\n' "$node_output" | grep -E '^P0_RETIRE_(RESULT|BLOCKER|RETIRED|REMAINING|EVENT_EVIDENCE|AUDIT_EVIDENCE|RAW_IDENTIFIERS|NON_MARKER_MUTATIONS)=' || true)"
printf '%s\n' "$safe_output"
(( node_rc == 0 )) || exit "$node_rc"
grep -Fxq 'P0_RETIRE_RESULT=PASS' <<< "$safe_output" || fail NODE_RESULT_NOT_PASS 54
for marker in P0_RETIRE_REMAINING=0 P0_RETIRE_RAW_IDENTIFIERS=0 P0_RETIRE_NON_MARKER_MUTATIONS=0; do
  grep -Fxq "$marker" <<< "$safe_output" || fail NODE_POSTCONDITION_MISSING 55
done
retired="$(sed -n 's/^P0_RETIRE_RETIRED=//p' <<< "$safe_output" | tail -1)"
events="$(sed -n 's/^P0_RETIRE_EVENT_EVIDENCE=//p' <<< "$safe_output" | tail -1)"
audits="$(sed -n 's/^P0_RETIRE_AUDIT_EVIDENCE=//p' <<< "$safe_output" | tail -1)"
[[ "$retired" =~ ^[0-9]{1,3}$ && "$events" == "$retired" && "$audits" == "$retired" ]] || fail EVIDENCE_COUNT_MISMATCH 56
printf 'P0_REMOTE_PRODUCTION_SHA=PASS\n'
printf 'P0_REMOTE_DB_AUTHORITY=PASS\n'
