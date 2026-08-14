#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

TARGET_SHA="${1:-}"
RUN_ID="${2:-}"
REQUIRED_KB=$((5 * 1024 * 1024))
TARGET_KB=$((6 * 1024 * 1024))

fail() {
  printf 'ERROR_CODE=%s\n' "$1" >&2
  exit "${2:-1}"
}

[[ "$(id -u)" -eq 0 ]] || fail ROOT_AUTHORITY_REQUIRED 2
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || fail INVALID_TARGET_SHA 3
[[ "$RUN_ID" =~ ^[0-9]{1,20}$ ]] || fail INVALID_RUN_ID 4
command -v docker >/dev/null 2>&1 || fail DOCKER_UNAVAILABLE 5
command -v python3 >/dev/null 2>&1 || fail PYTHON_UNAVAILABLE 6
command -v df >/dev/null 2>&1 || fail DF_UNAVAILABLE 7
docker version >/dev/null 2>&1 || fail DOCKER_DAEMON_UNAVAILABLE 8
[[ "$(docker info --format '{{.DockerRootDir}}')" == '/var/lib/docker' ]] || fail DOCKER_STORAGE_ROOT_MISMATCH 9
[[ -d /var/lib/docker && ! -L /var/lib/docker ]] || fail DOCKER_STORAGE_ROOT_INVALID 10

report="$(mktemp)"
trap 'rm -f "$report"' EXIT

set +e
python3 - "$TARGET_SHA" "$RUN_ID" "$report" "$REQUIRED_KB" "$TARGET_KB" <<'PY_RECLAIM'
import json
import os
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

target_sha, run_id, report_path, required_raw, target_raw = sys.argv[1:]
required_kb = int(required_raw)
target_kb = int(target_raw)
canonical = re.compile(r'^ghcr[.]io/pachaninm-lab/grainflow-(api|web|migration|tai):[A-Za-z0-9_.-]+$')
image_id_re = re.compile(r'^sha256:[0-9a-f]{64}$')

def command(argv, check=True):
    result = subprocess.run(argv, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if check and result.returncode != 0:
        raise RuntimeError(f'command_failed:{argv[0]}:{argv[1] if len(argv) > 1 else ""}')
    return result

def available_kb():
    result = command(['df', '-Pk', '--', '/var/lib/docker'])
    lines = [line.split() for line in result.stdout.splitlines() if line.strip()]
    if len(lines) != 2 or len(lines[1]) < 4 or not lines[1][3].isdigit():
        raise RuntimeError('docker_df_invalid')
    return int(lines[1][3])

def container_image_ids():
    container_ids = [line.strip() for line in command(['docker', 'ps', '-aq', '--no-trunc']).stdout.splitlines() if line.strip()]
    result = set()
    for container_id in container_ids:
        data = json.loads(command(['docker', 'inspect', container_id]).stdout)
        if len(data) != 1:
            raise RuntimeError('container_inspect_ambiguous')
        image_id = str(data[0].get('Image') or '')
        if not image_id_re.fullmatch(image_id):
            raise RuntimeError('container_image_id_invalid')
        result.add(image_id)
    return result

def inspect_image(image_id):
    result = command(['docker', 'image', 'inspect', image_id], check=False)
    if result.returncode != 0:
        return None
    data = json.loads(result.stdout)
    if len(data) != 1 or not isinstance(data[0], dict):
        raise RuntimeError('image_inspect_ambiguous')
    return data[0]

def classify_image(item):
    tags = item.get('RepoTags') or []
    if not isinstance(tags, list) or not tags:
        return None
    components = set()
    normalized_tags = []
    for raw in tags:
        if not isinstance(raw, str):
            return None
        match = canonical.fullmatch(raw)
        if not match:
            return None
        components.add(match.group(1))
        normalized_tags.append(raw)
    if len(components) != 1:
        return None
    return next(iter(components)), tuple(sorted(set(normalized_tags)))

before_kb = available_kb()
protected = container_image_ids()
container_protected_count = len(protected)
records = []
image_ids = sorted({line.strip() for line in command(['docker', 'image', 'ls', '-q', '--no-trunc']).stdout.splitlines() if line.strip()})
for image_id in image_ids:
    if not image_id_re.fullmatch(image_id):
        continue
    item = inspect_image(image_id)
    if item is None:
        continue
    classification = classify_image(item)
    if classification is None:
        continue
    component, tags = classification
    labels = (item.get('Config') or {}).get('Labels') or {}
    revision = labels.get('org.opencontainers.image.revision') if isinstance(labels, dict) else None
    created = str(item.get('Created') or '')
    if not created:
        continue
    records.append({'id': image_id, 'component': component, 'tags': tags, 'created': created, 'revision': revision})
    if revision == target_sha:
        protected.add(image_id)

by_component = defaultdict(list)
for record in records:
    by_component[record['component']].append(record)
for component_records in by_component.values():
    for record in sorted(component_records, key=lambda row: row['created'], reverse=True)[:2]:
        protected.add(record['id'])

eligible = [record for record in records if record['id'] not in protected]
eligible.sort(key=lambda row: row['created'])
deleted = 0
skipped = 0

for record in eligible:
    if available_kb() >= target_kb:
        break
    current_refs = container_image_ids()
    if record['id'] in current_refs:
        protected.add(record['id'])
        skipped += 1
        continue
    item = inspect_image(record['id'])
    if item is None:
        skipped += 1
        continue
    classification = classify_image(item)
    if classification is None:
        skipped += 1
        continue
    component, tags = classification
    if component != record['component']:
        skipped += 1
        continue
    labels = (item.get('Config') or {}).get('Labels') or {}
    revision = labels.get('org.opencontainers.image.revision') if isinstance(labels, dict) else None
    if revision == target_sha:
        protected.add(record['id'])
        skipped += 1
        continue
    result = command(['docker', 'image', 'rm', *tags], check=False)
    if result.returncode != 0:
        skipped += 1
        continue
    if inspect_image(record['id']) is None:
        deleted += 1
    else:
        skipped += 1

after_kb = available_kb()
reclaimed_bytes = max(0, after_kb - before_kb) * 1024
payload = {
    'schemaVersion': 'pc.production-docker-headroom-recovery.v1',
    'targetSha': target_sha,
    'runId': int(run_id),
    'mode': 'BOUNDED_UNUSED_CANONICAL_IMAGE_RECLAIM',
    'requiredAvailableKb': required_kb,
    'targetAvailableKb': target_kb,
    'beforeAvailableKb': before_kb,
    'afterAvailableKb': after_kb,
    'canonicalImageCount': len(records),
    'eligibleImageCount': len(eligible),
    'containerProtectedImageCount': container_protected_count,
    'protectedImageCount': len(protected),
    'deletedImageCount': deleted,
    'skippedImageCount': skipped,
    'reclaimedBytes': reclaimed_bytes,
    'targetReached': after_kb >= target_kb,
    'passed': after_kb >= required_kb,
}
path = Path(report_path)
path.write_text(json.dumps(payload, ensure_ascii=True, separators=(',', ':')) + '\n', encoding='utf-8')
os.chmod(path, 0o600)
if not payload['passed']:
    raise SystemExit(91)
PY_RECLAIM
rc=$?
set -e

[[ -s "$report" && ! -L "$report" ]] || fail DOCKER_HEADROOM_EVIDENCE_MISSING 11
python3 - "$report" "$TARGET_SHA" "$RUN_ID" "$REQUIRED_KB" "$TARGET_KB" <<'PY_VALIDATE'
import json
import sys

path, sha, run_id, required_raw, target_raw = sys.argv[1:]
value = json.load(open(path, encoding='utf-8'))
if value.get('schemaVersion') != 'pc.production-docker-headroom-recovery.v1': raise SystemExit('schema mismatch')
if value.get('targetSha') != sha: raise SystemExit('target mismatch')
if value.get('runId') != int(run_id): raise SystemExit('run mismatch')
if value.get('mode') != 'BOUNDED_UNUSED_CANONICAL_IMAGE_RECLAIM': raise SystemExit('mode mismatch')
if value.get('requiredAvailableKb') != int(required_raw): raise SystemExit('required threshold mismatch')
if value.get('targetAvailableKb') != int(target_raw): raise SystemExit('target threshold mismatch')
for key in ('beforeAvailableKb','afterAvailableKb','canonicalImageCount','eligibleImageCount','containerProtectedImageCount','protectedImageCount','deletedImageCount','skippedImageCount','reclaimedBytes'):
    if not isinstance(value.get(key), int) or value[key] < 0: raise SystemExit(f'invalid integer field: {key}')
if value.get('targetReached') is not (value['afterAvailableKb'] >= value['targetAvailableKb']): raise SystemExit('targetReached mismatch')
if value.get('passed') is not (value['afterAvailableKb'] >= value['requiredAvailableKb']): raise SystemExit('passed mismatch')
PY_VALIDATE

python3 - "$report" <<'PY_EMIT'
import json
import sys

value = json.load(open(sys.argv[1], encoding='utf-8'))
print(f"DOCKER_HEADROOM_BEFORE_KB={value['beforeAvailableKb']}")
print(f"DOCKER_HEADROOM_AFTER_KB={value['afterAvailableKb']}")
print(f"DOCKER_HEADROOM_REQUIRED_KB={value['requiredAvailableKb']}")
print(f"DOCKER_HEADROOM_TARGET_KB={value['targetAvailableKb']}")
print(f"DOCKER_HEADROOM_DELETED_IMAGES={value['deletedImageCount']}")
print(f"DOCKER_HEADROOM_SKIPPED_IMAGES={value['skippedImageCount']}")
print(f"DOCKER_HEADROOM_RECLAIMED_BYTES={value['reclaimedBytes']}")
print(f"DOCKER_HEADROOM_TARGET_REACHED={str(value['targetReached']).lower()}")
print(f"DOCKER_HEADROOM_RECOVERY={'PASS' if value['passed'] else 'FAIL'}")
PY_EMIT

(( rc == 0 )) || fail DOCKER_HEADROOM_INSUFFICIENT_SAFE_RECLAIM 12
