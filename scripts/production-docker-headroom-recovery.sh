#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

TARGET_SHA="${1:-}"
RUN_ID="${2:-}"
REQUIRED_KB=$((5 * 1024 * 1024))
TARGET_KB=$((6 * 1024 * 1024))
CONTAINERD_SNAPSHOT_ROOT='/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs'

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
command -v stat >/dev/null 2>&1 || fail STAT_UNAVAILABLE 8
docker version >/dev/null 2>&1 || fail DOCKER_DAEMON_UNAVAILABLE 9
[[ "$(docker info --format '{{.DockerRootDir}}')" == '/var/lib/docker' ]] || fail DOCKER_STORAGE_ROOT_MISMATCH 10
[[ -d /var/lib/docker && ! -L /var/lib/docker ]] || fail DOCKER_STORAGE_ROOT_INVALID 11
[[ -d /var/lib/containerd && ! -L /var/lib/containerd ]] || fail CONTAINERD_STORAGE_ROOT_INVALID 12
[[ -d "$CONTAINERD_SNAPSHOT_ROOT" && ! -L "$CONTAINERD_SNAPSHOT_ROOT" ]] || fail CONTAINERD_SNAPSHOT_ROOT_INVALID 13
[[ "$(stat -c '%d' /var/lib/docker)" == "$(stat -c '%d' /var/lib/containerd)" ]] || fail CONTAINERD_STORAGE_FILESYSTEM_MISMATCH 14
[[ "$(stat -c '%d' /var/lib/docker)" == "$(stat -c '%d' /var/lib/containerd/io.containerd.snapshotter.v1.overlayfs)" ]] || fail CONTAINERD_SNAPSHOT_FILESYSTEM_MISMATCH 15
printf 'CONTAINERD_STORAGE_FILESYSTEM_SHARED=1\n'

report="$(mktemp)"
trap 'rm -f "$report"' EXIT

set +e
python3 - "$TARGET_SHA" "$RUN_ID" "$report" "$REQUIRED_KB" "$TARGET_KB" "$CONTAINERD_SNAPSHOT_ROOT" <<'PY_RECLAIM'
import json
import os
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

target_sha, run_id, report_path, required_raw, target_raw, snapshot_root = sys.argv[1:]
required_kb = int(required_raw)
target_kb = int(target_raw)
canonical_tag = re.compile(r'^ghcr[.]io/pachaninm-lab/grainflow-(api|web|migration|tai):[A-Za-z0-9_.-]+$')
canonical_digest = re.compile(r'^ghcr[.]io/pachaninm-lab/grainflow-(api|web|migration|tai)@sha256:[0-9a-f]{64}$')
image_id_re = re.compile(r'^sha256:[0-9a-f]{64}$')
reclaim_components = {'api', 'web', 'migration'}
max_reference_removals_per_image = 128


def command(argv, check=True):
    result = subprocess.run(argv, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if check and result.returncode != 0:
        raise RuntimeError(f'command_failed:{argv[0]}:{argv[1] if len(argv) > 1 else ""}')
    return result


def available_kb():
    result = command(['df', '-Pk', '--', snapshot_root])
    lines = [line.split() for line in result.stdout.splitlines() if line.strip()]
    if len(lines) != 2 or len(lines[1]) < 4 or not lines[1][3].isdigit():
        raise RuntimeError('containerd_snapshot_df_invalid')
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


def image_refs(item):
    refs = []
    for key in ('RepoTags', 'RepoDigests'):
        values = item.get(key)
        if values is None:
            values = []
        if not isinstance(values, list):
            return None
        for value in values:
            if not isinstance(value, str):
                return None
            if value and value not in ('<none>', '<none>:<none>'):
                refs.append(value)
    return tuple(sorted(set(refs)))


def ref_component(ref):
    tag_match = canonical_tag.fullmatch(ref)
    if tag_match:
        return tag_match.group(1), 'TAG'
    digest_match = canonical_digest.fullmatch(ref)
    if digest_match:
        return digest_match.group(1), 'DIGEST'
    return None


def classify_release_image(item, require_tag=True):
    refs = image_refs(item)
    if refs is None or not refs:
        return None
    tags = []
    components = set()
    for ref in refs:
        classified = ref_component(ref)
        if classified is None:
            return None
        component, ref_type = classified
        components.add(component)
        if ref_type == 'TAG':
            tags.append(ref)
    if (require_tag and not tags) or len(components) != 1:
        return None
    component = next(iter(components))
    if component not in reclaim_components:
        return None
    return component, tuple(sorted(set(tags))), refs


def remove_failure_class(result):
    text = f'{result.stdout}\n{result.stderr}'.lower()
    if 'no space left on device' in text:
        return 'NO_SPACE'
    if 'dependent child' in text:
        return 'DEPENDENT_CHILD'
    if 'container' in text and ('using its referenced image' in text or 'is being used by' in text):
        return 'CONTAINER_REFERENCE'
    if 'multiple repositories' in text:
        return 'MULTIPLE_REFERENCES'
    if 'reference does not exist' in text or 'no such image' in text:
        return 'REFERENCE_NOT_FOUND'
    if 'conflict' in text:
        return 'CONFLICT'
    return 'OTHER'


def attest_candidate(image_id, component):
    if image_id in container_image_ids():
        return None, 'CONTAINER_REFERENCE'
    item = inspect_image(image_id)
    if item is None:
        return None, None
    config = item.get('Config') if isinstance(item.get('Config'), dict) else {}
    labels = config.get('Labels') if isinstance(config.get('Labels'), dict) else {}
    revision = labels.get('org.opencontainers.image.revision') if isinstance(labels, dict) else None
    if revision == target_sha:
        return None, 'TARGET_REVISION'
    refs = image_refs(item)
    if refs is None:
        return None, 'UNEXPECTED_REFERENCE_STATE'
    if refs:
        classification = classify_release_image(item, require_tag=False)
        if classification is None or classification[0] != component:
            return None, 'UNEXPECTED_REFERENCE_STATE'
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
    # Registry pull-by-digest leaves canonical RepoDigests without RepoTags.
    # They remain inside the same bounded component classifier and protections.
    classification = classify_release_image(item, require_tag=False)
    if classification is None:
        continue
    component, tags, refs = classification
    config = item.get('Config') if isinstance(item.get('Config'), dict) else {}
    labels = config.get('Labels') if isinstance(config.get('Labels'), dict) else {}
    revision = labels.get('org.opencontainers.image.revision') if isinstance(labels, dict) else None
    created = str(item.get('Created') or '')
    size = item.get('Size')
    if not created or not isinstance(size, int) or size < 0:
        continue
    records.append({
        'id': image_id,
        'component': component,
        'tags': tags,
        'refs': refs,
        'created': created,
        'revision': revision,
        'size': size,
    })
    if revision == target_sha:
        protected.add(image_id)

by_component = defaultdict(list)
for record in records:
    by_component[record['component']].append(record)
for component_records in by_component.values():
    for record in sorted(component_records, key=lambda row: row['created'], reverse=True)[:2]:
        protected.add(record['id'])

eligible = [record for record in records if record['id'] not in protected]
# Preserve target and two newest images per component, then remove the newest
# remaining candidates first to avoid legacy parent/child ordering conflicts.
eligible.sort(key=lambda row: (row['created'], row['component'], row['id']), reverse=True)
deleted = 0
skipped = 0
attempted = 0
removed_references = 0
remove_failures = defaultdict(int)

for record in eligible:
    if available_kb() >= target_kb:
        break

    attempted += 1
    removed = False
    failed = False

    for _ in range(max_reference_removals_per_image):
        item, attestation_error = attest_candidate(record['id'], record['component'])
        if attestation_error:
            remove_failures[attestation_error] += 1
            failed = True
            break
        if item is None:
            deleted += 1
            removed = True
            break

        refs = image_refs(item)
        if refs is None:
            remove_failures['UNEXPECTED_REFERENCE_STATE'] += 1
            failed = True
            break

        if refs:
            ref = refs[0]
            result = command(['docker', 'image', 'rm', ref], check=False)
            if result.returncode != 0:
                remove_failures[remove_failure_class(result)] += 1
                failed = True
                break
            removed_references += 1

            item_after, attestation_error = attest_candidate(record['id'], record['component'])
            if attestation_error:
                remove_failures[attestation_error] += 1
                failed = True
                break
            if item_after is None:
                deleted += 1
                removed = True
                break
            refs_after = image_refs(item_after)
            if refs_after is None:
                remove_failures['UNEXPECTED_REFERENCE_STATE'] += 1
                failed = True
                break
            if refs_after == refs:
                remove_failures['NO_STATE_CHANGE'] += 1
                failed = True
                break
            continue

        # An unused image object with no remaining repository references may be
        # removed only by its immutable full ID and still never with --force.
        result = command(['docker', 'image', 'rm', record['id']], check=False)
        if result.returncode != 0:
            remove_failures[remove_failure_class(result)] += 1
            failed = True
            break
        if inspect_image(record['id']) is None:
            deleted += 1
            removed = True
        else:
            remove_failures['STILL_PRESENT'] += 1
            failed = True
        break
    else:
        remove_failures['BOUNDED_LOOP_EXHAUSTED'] += 1
        failed = True

    if not removed:
        skipped += 1
    if failed:
        continue

after_kb = available_kb()
reclaimed_bytes = max(0, after_kb - before_kb) * 1024
payload = {
    'schemaVersion': 'pc.production-docker-headroom-recovery.v1',
    'targetSha': target_sha,
    'runId': int(run_id),
    'mode': 'BOUNDED_UNUSED_CANONICAL_IMAGE_RECLAIM',
    'deleteAuthority': 'CANONICAL_REFERENCE_OR_FULL_IMAGE_ID_NO_FORCE',
    'reclaimComponents': sorted(reclaim_components),
    'requiredAvailableKb': required_kb,
    'targetAvailableKb': target_kb,
    'beforeAvailableKb': before_kb,
    'afterAvailableKb': after_kb,
    'canonicalImageCount': len(records),
    'eligibleImageCount': len(eligible),
    'containerProtectedImageCount': container_protected_count,
    'protectedImageCount': len(protected),
    'attemptedImageCount': attempted,
    'removedReferenceCount': removed_references,
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

[[ -s "$report" && ! -L "$report" ]] || fail DOCKER_HEADROOM_EVIDENCE_MISSING 16
python3 - "$report" "$TARGET_SHA" "$RUN_ID" "$REQUIRED_KB" "$TARGET_KB" <<'PY_VALIDATE'
import json
import sys

path, sha, run_id, required_raw, target_raw = sys.argv[1:]
value = json.load(open(path, encoding='utf-8'))
if value.get('schemaVersion') != 'pc.production-docker-headroom-recovery.v1': raise SystemExit('schema mismatch')
if value.get('targetSha') != sha: raise SystemExit('target mismatch')
if value.get('runId') != int(run_id): raise SystemExit('run mismatch')
if value.get('mode') != 'BOUNDED_UNUSED_CANONICAL_IMAGE_RECLAIM': raise SystemExit('mode mismatch')
if value.get('deleteAuthority') != 'CANONICAL_REFERENCE_OR_FULL_IMAGE_ID_NO_FORCE': raise SystemExit('delete authority mismatch')
if value.get('reclaimComponents') != ['api', 'migration', 'web']: raise SystemExit('component scope mismatch')
if value.get('requiredAvailableKb') != int(required_raw): raise SystemExit('required threshold mismatch')
if value.get('targetAvailableKb') != int(target_raw): raise SystemExit('target threshold mismatch')
for key in ('beforeAvailableKb','afterAvailableKb','canonicalImageCount','eligibleImageCount','containerProtectedImageCount','protectedImageCount','attemptedImageCount','removedReferenceCount','deletedImageCount','skippedImageCount','reclaimedBytes'):
    if not isinstance(value.get(key), int) or value[key] < 0: raise SystemExit(f'invalid integer field: {key}')
failures = value.get('removeFailureCounts')
allowed_failures = {
    'BOUNDED_LOOP_EXHAUSTED',
    'CONFLICT',
    'CONTAINER_REFERENCE',
    'DEPENDENT_CHILD',
    'MULTIPLE_REFERENCES',
    'NO_SPACE',
    'NO_STATE_CHANGE',
    'OTHER',
    'REFERENCE_NOT_FOUND',
    'STILL_PRESENT',
    'TARGET_REVISION',
    'UNEXPECTED_REFERENCE_STATE',
}
if not isinstance(failures, dict): raise SystemExit('remove failure counts invalid')
for key, count in failures.items():
    if key not in allowed_failures or not isinstance(count, int) or count < 0: raise SystemExit('remove failure entry invalid')
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
print(f"DOCKER_HEADROOM_DELETE_AUTHORITY={value['deleteAuthority']}")
print(f"DOCKER_HEADROOM_CANONICAL_IMAGES={value['canonicalImageCount']}")
print(f"DOCKER_HEADROOM_ELIGIBLE_IMAGES={value['eligibleImageCount']}")
print(f"DOCKER_HEADROOM_ATTEMPTED_IMAGES={value['attemptedImageCount']}")
print(f"DOCKER_HEADROOM_REMOVED_REFERENCES={value['removedReferenceCount']}")
print(f"DOCKER_HEADROOM_DELETED_IMAGES={value['deletedImageCount']}")
print(f"DOCKER_HEADROOM_SKIPPED_IMAGES={value['skippedImageCount']}")
for key, count in sorted(value['removeFailureCounts'].items()):
    print(f"DOCKER_HEADROOM_REMOVE_FAILURE_{key}={count}")
print(f"DOCKER_HEADROOM_RECLAIMED_BYTES={value['reclaimedBytes']}")
print(f"DOCKER_HEADROOM_TARGET_REACHED={str(value['targetReached']).lower()}")
print(f"DOCKER_HEADROOM_RECOVERY={'PASS' if value['passed'] else 'FAIL'}")
PY_EMIT

(( rc == 0 )) || fail DOCKER_HEADROOM_INSUFFICIENT_SAFE_RECLAIM 17
