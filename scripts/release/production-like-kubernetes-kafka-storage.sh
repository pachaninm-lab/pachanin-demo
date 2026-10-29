#!/usr/bin/env bash
# Disposable kind fixture only. This is neither production storage nor HA/DR.
set -Eeuo pipefail
python3 -I - "$@" <<'PY_KAFKA_STORAGE'
import copy
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import time

NS = 'grainflow-acceptance'
CONTEXT = 'kind-' + NS
CLAIM = 'ir20-kafka-data'
DATA = '/var/lib/kafka/data'
MARKER = DATA + '/.pc-crop-persistence-proof'
SELECTOR = 'app.kubernetes.io/name=kafka'


def require(condition, code):
    if not condition:
        raise ValueError(code)


def command(args, payload=None, timeout=30):
    result = subprocess.run(args, input=payload, text=True, capture_output=True, timeout=timeout)
    require(result.returncode == 0, 'KAFKA_STORAGE_COMMAND_FAILED')
    return result.stdout.strip()


def kube(*args, payload=None, timeout=30):
    return command(['kubectl', '--context', CONTEXT, '-n', NS,
                    '--request-timeout=' + str(timeout - 5) + 's', *args], payload, timeout)


def get(*args):
    return json.loads(kube('get', *args, '-o', 'json'))


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    pending = path.with_suffix('.pending.json')
    pending.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')
    os.replace(pending, path)


def data_volume(spec, persistent):
    volumes = spec['volumes']
    matches = [(index, volume) for index, volume in enumerate(volumes) if volume.get('name') == 'data']
    require(len(matches) == 1, 'KAFKA_STORAGE_VOLUME_AMBIGUOUS')
    index, volume = matches[0]
    expected = {'name': 'data', 'persistentVolumeClaim': {'claimName': CLAIM}} if persistent else {
        'name': 'data', 'emptyDir': {'sizeLimit': '2Gi'}}
    require(volume == expected, 'KAFKA_STORAGE_VOLUME_MISMATCH')
    containers = spec['containers']
    require(len(containers) == 1 and containers[0]['name'] == 'kafka', 'KAFKA_STORAGE_CONTAINER_MISMATCH')
    mounts = [v for v in containers[0]['volumeMounts'] if v.get('name') == 'data']
    require(len(mounts) == 1 and mounts[0] == {'name': 'data', 'mountPath': DATA},
            'KAFKA_STORAGE_MOUNT_MISMATCH')
    log_dirs = [v for v in containers[0]['env'] if v.get('name') == 'KAFKA_LOG_DIRS']
    require(log_dirs == [{'name': 'KAFKA_LOG_DIRS', 'value': DATA}], 'KAFKA_STORAGE_LOG_DIR_MISMATCH')
    return index


def hashes(pod):
    text = kube('exec', pod, '--', 'sha256sum', DATA + '/meta.properties', MARKER)
    values = text.splitlines()
    require(len(values) == 2, 'KAFKA_STORAGE_HASH_COUNT')
    result = []
    for line, path in zip(values, (DATA + '/meta.properties', MARKER)):
        match = re.fullmatch(r'([0-9a-f]{64})  ' + re.escape(path), line)
        require(match is not None, 'KAFKA_STORAGE_HASH_FORMAT')
        result.append(match[1])
    return result


def validate_snapshot(deployment, pods, claim, pv):
    require(deployment['spec']['replicas'] == 1 and deployment['spec']['strategy']['type'] == 'Recreate',
            'KAFKA_STORAGE_DEPLOYMENT_MISMATCH')
    data_volume(deployment['spec']['template']['spec'], True)
    require(len(pods['items']) == 1, 'KAFKA_STORAGE_POD_COUNT')
    pod = pods['items'][0]
    require(not pod['metadata'].get('deletionTimestamp') and pod['status']['phase'] == 'Running',
            'KAFKA_STORAGE_POD_NOT_RUNNING')
    require(any(v.get('type') == 'Ready' and v.get('status') == 'True'
                for v in pod['status']['conditions']), 'KAFKA_STORAGE_POD_NOT_READY')
    data_volume(pod['spec'], True)
    require(claim['metadata']['name'] == CLAIM and claim['metadata']['namespace'] == NS
            and claim['status']['phase'] == 'Bound'
            and claim['spec']['storageClassName'] == 'standard'
            and claim['spec']['accessModes'] == ['ReadWriteOnce']
            and claim['spec']['resources']['requests']['storage'] == '2Gi', 'KAFKA_STORAGE_CLAIM_MISMATCH')
    reference = pv['spec']['claimRef']
    require(pv['metadata']['name'] == claim['spec']['volumeName'] and pv['status']['phase'] == 'Bound'
            and pv['spec']['storageClassName'] == 'standard'
            and reference['name'] == CLAIM and reference['namespace'] == NS
            and reference['uid'] == claim['metadata']['uid'], 'KAFKA_STORAGE_PV_MISMATCH')
    identity = {'claim_uid': claim['metadata']['uid'], 'pv_uid': pv['metadata']['uid'],
                'volume_name': pv['metadata']['name'], 'pod_uid': pod['metadata']['uid']}
    require(all(isinstance(v, str) and v for v in identity.values()), 'KAFKA_STORAGE_IDENTITY_MISSING')
    return identity, pod['metadata']['name']


def snapshot():
    claim = get('pvc', CLAIM)
    identity, pod = validate_snapshot(get('deployment', 'kafka'), get('pods', '-l', SELECTOR),
                                     claim, get('pv', claim['spec']['volumeName']))
    identity['data_hashes'] = hashes(pod)
    return identity


def compare(before, after):
    for key in ('claim_uid', 'pv_uid', 'volume_name', 'data_hashes'):
        require(before.get(key) == after.get(key) and before.get(key), 'KAFKA_STORAGE_IDENTITY_CHANGED')
    require(before['pod_uid'] != after['pod_uid'], 'KAFKA_STORAGE_RESTART_NOT_OBSERVED')


def prepare():
    # Reset only an unused bootstrap broker, before any application producer can exist.
    deployments = get('deployments')['items']
    require(not any(v['metadata']['name'] in ('grainflow-api', 'grainflow-outbox-worker', 'grainflow-web')
                    for v in deployments), 'KAFKA_STORAGE_APPLICATION_ALREADY_CREATED')
    for pod in get('pods')['items']:
        name = pod['metadata'].get('labels', {}).get('app.kubernetes.io/name')
        if name in ('grainflow-api', 'grainflow-outbox-worker', 'grainflow-web'):
            require(pod['metadata']['name'] == 'pgbouncer-runtime-check'
                    and pod['status']['phase'] == 'Succeeded', 'KAFKA_STORAGE_APPLICATION_ALREADY_CREATED')
    storage = get('storageclass', 'standard')
    require(storage['provisioner'] == 'rancher.io/local-path'
            and storage['volumeBindingMode'] == 'WaitForFirstConsumer'
            and storage['reclaimPolicy'] == 'Delete', 'KAFKA_STORAGE_CLASS_MISMATCH')
    deployment = get('deployment', 'kafka')
    require(deployment['spec']['replicas'] == 1 and deployment['spec']['strategy']['type'] == 'Recreate',
            'KAFKA_STORAGE_DEPLOYMENT_MISMATCH')
    data_volume(deployment['spec']['template']['spec'], False)
    require(kube('exec', 'deployment/kafka', '--', 'kafka-topics', '--bootstrap-server',
                 '127.0.0.1:19092', '--list', timeout=60) == '', 'KAFKA_STORAGE_BOOTSTRAP_NOT_EMPTY')
    require(kube('get', 'pvc', CLAIM, '--ignore-not-found', '-o', 'json') == '',
            'KAFKA_STORAGE_CLAIM_ALREADY_EXISTS')
    pvc = {'apiVersion': 'v1', 'kind': 'PersistentVolumeClaim',
           'metadata': {'name': CLAIM, 'namespace': NS},
           'spec': {'storageClassName': 'standard', 'accessModes': ['ReadWriteOnce'],
                    'resources': {'requests': {'storage': '2Gi'}}}}
    kube('create', '-f', '-', payload=json.dumps(pvc))
    kube('scale', 'deployment/kafka', '--current-replicas=1', '--replicas=0')
    deadline = time.monotonic() + 180
    while get('pods', '-l', SELECTOR)['items']:
        require(time.monotonic() < deadline, 'KAFKA_STORAGE_BOOTSTRAP_STILL_PRESENT')
        time.sleep(1)
    deployment = get('deployment', 'kafka')
    index = data_volume(deployment['spec']['template']['spec'], False)
    template = deployment['spec']['template']
    replacement = {'name': 'data', 'persistentVolumeClaim': {'claimName': CLAIM}}
    patch = [{'op': 'test', 'path': '/spec/replicas', 'value': 0},
             {'op': 'test', 'path': '/spec/template', 'value': template},
             {'op': 'replace', 'path': '/spec/template/spec/volumes/' + str(index), 'value': replacement}]
    kube('patch', 'deployment', 'kafka', '--type=json', '-p', json.dumps(patch))
    expected = copy.deepcopy(template)
    expected['spec']['volumes'][index] = replacement
    require(get('deployment', 'kafka')['spec']['template'] == expected, 'KAFKA_STORAGE_UNEXPECTED_TEMPLATE_CHANGE')
    kube('scale', 'deployment/kafka', '--current-replicas=0', '--replicas=1')
    kube('rollout', 'status', 'deployment/kafka', '--timeout=600s', timeout=630)
    marker = secrets.token_hex(32)
    kube('exec', 'deployment/kafka', '--', 'bash', '-ec',
         'umask 077; test ! -e "$1"; printf %s "$2" > "$1"; sync "$1"', '--', MARKER, marker)
    result = snapshot()
    require(result['data_hashes'][1] == hashlib.sha256(marker.encode()).hexdigest(), 'KAFKA_STORAGE_MARKER_NOT_PERSISTED')
    return result


def main(mode):
    require(mode in ('prepare', 'verify'), 'KAFKA_STORAGE_INVALID_MODE')
    sha = os.environ['EXACT_HEAD']
    require(re.fullmatch('[0-9a-f]{40}', sha), 'KAFKA_STORAGE_INVALID_HEAD')
    require(command(['git', 'rev-parse', 'HEAD']) == sha, 'KAFKA_STORAGE_STALE_SOURCE')
    require(command(['kubectl', 'config', 'current-context']) == CONTEXT, 'KAFKA_STORAGE_WRONG_CONTEXT')
    require(NS in command(['kind', 'get', 'clusters']).splitlines(), 'KAFKA_STORAGE_NOT_KIND')
    require(get('namespace', NS)['metadata'].get('labels', {}).get('environment') == 'production-like',
            'KAFKA_STORAGE_WRONG_NAMESPACE')
    directory = Path(os.environ.get('EVIDENCE_DIR', 'artifacts/industrial-readiness')) / 'kubernetes' / 'kafka-storage'
    baseline = directory / 'baseline.json'
    common = {'schema': 'pc.disposable-kafka-storage.v1', 'commitSha': sha,
              'run_id': os.environ['GITHUB_RUN_ID'], 'run_attempt': os.environ['GITHUB_RUN_ATTEMPT'],
              'production_acceptance': False, 'ha_or_dr_acceptance': False}
    if mode == 'prepare':
        require(not baseline.exists(), 'KAFKA_STORAGE_BASELINE_ALREADY_EXISTS')
        atomic_json(baseline, dict(common, snapshot=prepare()))
    else:
        # Invalidate any prior result before re-observing. Verification never resets a broker or producer.
        report = directory / 'continuity.json'
        atomic_json(report, dict(common, result='FAIL'))
        before = json.loads(baseline.read_text(encoding='utf-8'))
        require(all(before.get(k) == v for k, v in common.items()), 'KAFKA_STORAGE_STALE_BASELINE')
        after = snapshot()
        compare(before['snapshot'], after)
        atomic_json(report, dict(common, result='PASS', snapshot=after))
    print('DISPOSABLE_KAFKA_STORAGE_' + mode.upper() + '=PASS')


if __name__ == '__main__':
    try:
        require(len(sys.argv) == 2, 'KAFKA_STORAGE_INVALID_ARGUMENTS')
        main(sys.argv[1])
    except Exception as error:
        # Do not expose kubectl output, arbitrary exception messages or configuration values.
        code = str(error) if type(error) is ValueError and re.fullmatch(r'KAFKA_STORAGE_[A-Z_]+', str(error)) else 'KAFKA_STORAGE_EXECUTION_FAILED'
        print(code, file=sys.stderr)
        sys.exit(1)
PY_KAFKA_STORAGE
