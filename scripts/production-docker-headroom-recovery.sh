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

def remove_failure_class(result):
    text = f'{result.stdout}\n{result.stderr}'.lower()
    if 'no space left on device' in text:
        return 'NO_SPACE'
    if 'dependent child' in text:
        return 'DEPENDENT_CHILD'
    if 'container' in text and ('using its referenced image' in text or 'is being used by' in text):
        return 'CONTAINER_REFERENCE'
    if 'conflict' in text:
        return 'CONFLICT'
    return 'OTHER'

def safe_after_mutation_attestation(image_id, component):
    if image_id in container_image_ids():
        return None, 'CONTAINER_REFERENCE'
    item = inspect_image(image_id)
    if item is None:
        return None, None
    labels = (item.get('Config') or {}).get('Labels') or {}
    revision = labels.get('org.opencontainers.image.revision') if isinstance(labels, dict) else None
    if revision == target_sha:
        return None, 'TARGET_REVISION'
    tags = item.get('RepoTags') or []
    if not isinstance(tags, list):
        return None, 'UNEXPECTED_TAG_STATE'
    for raw in tags:
        if not isinstance(raw, str):
            return None, 'UNEXPECTED_TAG_STATE'
        match = canonical.fullmatch(raw)
        if not match or match.group(1) != component:
            return None, 'UNEXPECTED_TAG_STATE'
    return item, None

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
# Newest-first avoids legacy parent/child deletion conflicts while still preserving
# the exact-main image and two newest canonical rollback images per component.
eligible.sort(key=lambda row: row['created'], reverse=True)
deleted = 0
skipped = 0
remove_failures = defaultdict(int)

for record in eligible:
    if available_kb() >= target_kb:
        break
    current_refs = container_image_ids()
    if record['id'] in current_refs:
        protected.add(record['id'])
        remove_failures['CONTAINER_REFERENCE'] += 1
        skipped += 1
        continue
    item = inspect_image(record['id'])
    if item is None:
        skipped += 1
        continue
    classification = classify_image(item)
    if classification is None:
        remove_failures['UNEXPECTED_TAG_STATE'] += 1
        skipped += 1
        continue
    component, tags = classification
    if component != record['component']:
        remove_failures['UNEXPECTED_TAG_STATE'] += 1
        skipped += 1
        continue
    labels = (item.get('Config') or {}).get('Labels') or {}
    revision = labels.get('org.opencontainers.image.revision') if isinstance(labels, dict) else None
    if revision == target_sha:
        protected.add(record['id'])
        remove_failures['TARGET_REVISION'] += 1
        skipped += 1
        continue

    # First use Docker's normal tag-aware removal. Never force deletion.
    result = command(['docker', 'image', 'rm', *tags], check=False)
    if result.returncode != 0:
        remove_failures[remove_failure_class(result)] += 1

    item_after, attestation_error = safe_after_mutation_attestation(record['id'], component)
    if attestation_error:
        remove_failures[attestation_error] += 1
        skipped += 1
        continue
    if item_after is None:
        deleted += 1
        continue

    # A failed multi-tag removal may leave only canonical tags behind. Remove any
    # remaining canonical tags individually, re-attesting the image after each step.
    remaining_tags = tuple(sorted(set(item_after.get('RepoTags') or [])))
    individual_failed = False
    for tag in remaining_tags:
        tag_result = command(['docker', 'image', 'rm', tag], check=False)
        if tag_result.returncode != 0:
            remove_failures[remove_failure_class(tag_result)] += 1
            individual_failed = True
            break
        item_after, attestation_error = safe_after_mutation_attestation(record['id'], component)
        if attestation_error:
            remove_failures[attestation_error] += 1
            individual_failed = True
            break
        if item_after is None:
            break
    if individual_failed:
        skipped += 1
        continue
    if item_after is None:
        deleted += 1
        continue

    # If all canonical tags are gone but Docker still retains the same attested,
    # unused image object, remove that exact image ID without --force.
    final_tags = item_after.get('RepoTags') or []
    if final_tags:
        remove_failures['STILL_TAGGED'] += 1
        skipped += 1
        continue
    id_result = command(['docker', 'image', 'rm', record['id']], check=False)
    if id_result.returncode != 0:
        remove_failures[remove_failure_class(id_result)] += 1
        skipped += 1
        continue
    if inspect_image(record['id']) is None:
        deleted += 1
    else:
        remove_failures['STILL_PRESENT'] += 1
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
    'removeFailureCounts': dict(sorted(remove_failures.items())),
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
failures = value.get('removeFailureCounts')
if not isinstance(failures, dict): raise SystemExit('remove failure counts invalid')
for key, count in failures.items():
    if not isinstance(key, str) or not key or not isinstance(count, int) or count < 0: raise SystemExit('remove failure entry invalid')
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
print(f"DOCKER_HEADROOM_CANONICAL_IMAGES={value['canonicalImageCount']}")
print(f"DOCKER_HEADROOM_ELIGIBLE_IMAGES={value['eligibleImageCount']}")
print(f"DOCKER_HEADROOM_DELETED_IMAGES={value['deletedImageCount']}")
print(f"DOCKER_HEADROOM_SKIPPED_IMAGES={value['skippedImageCount']}")
for key, count in sorted(value['removeFailureCounts'].items()):
    print(f"DOCKER_HEADROOM_REMOVE_FAILURE_{key}={count}")
print(f"DOCKER_HEADROOM_RECLAIMED_BYTES={value['reclaimedBytes']}")
print(f"DOCKER_HEADROOM_TARGET_REACHED={str(value['targetReached']).lower()}")
print(f"DOCKER_HEADROOM_RECOVERY={'PASS' if value['passed'] else 'FAIL'}")
PY_EMIT

(( rc == 0 )) || fail DOCKER_HEADROOM_INSUFFICIENT_SAFE_RECLAIM 12
