"""Bounded, read-only evidence for the guest boot after run 41730479605."""

import ast
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import selectors
import stat
import subprocess
import sys
import time


LEGACY_CUTOFF_MS = int(datetime(2026, 11, 3, 22, 26, tzinfo=timezone.utc).timestamp()) * 1000
JOURNAL_MAX_BYTES = 16 * 1024
EARLY_BOOT_US = 120 * 1_000_000
CLOCK_TOLERANCE_MS = 120_000
AUTHORITY = 'docs/platform-v7/autopilot/progress.json'
AUTHORITY_KEY = 'gektaApiComposeFileShapeEvidence'
BASELINE_RECORD = 'gektaApiBaselineContentEvidence'
STATE = 'docs/platform-v7/autopilot/autopilot-state.json'
SOURCE_BRANCH = 'ops/gekta-legacy-boot-evidence-20261111'
PROBE_PATH = 'scripts/production-legacy-boot-evidence.py'
SOURCE_PATHS = {'.github/workflows/production-legacy-boot-evidence.yml', PROBE_PATH}
MAX_DIRECTORY_DEPTH = 7
IDENTITY_CODES = {'MATCH', 'PROCESS_UID', 'NOATIME_UNAVAILABLE', 'PRIVATE_PARENT_MODE', 'PRIVATE_LEAF_MODE'} | {
    f'ANCESTOR_{depth}_{cause}' for depth in range(MAX_DIRECTORY_DEPTH + 1)
    for cause in ('TYPE', 'OWNER', 'GROUP', 'WRITABLE', 'UNAVAILABLE')
} | {
    f'{name}_{cause}' for name in ('RECEIPT', 'CIPHERTEXT', 'KEY')
    for cause in ('TYPE', 'OWNER', 'GROUP', 'MODE', 'LINKS', 'SIZE', 'UNAVAILABLE')
}
API_CODES = {'BASELINE_CHANGED', 'BASELINE_UNSTABLE', 'ROOTFS_DIFFERENT',
             'ROOTFS_MATCH_PROJECTED_DEFAULTS_DIFFERENT', 'ROOTFS_AND_PROJECTED_DEFAULTS_MATCH'}
API_ROOTFS_COUNT = 25
IMAGE_METADATA_FORMAT = '{{.Id}}\n{{.Os}}\n{{.Architecture}}\n{{json .RootFS.Layers}}\n{{json .Config}}'
ARCHIVE_LIMIT = 2 * 1024**3
STORE_MODES = (b'CLASSIC\n', b'CONTAINERD\n')
API_DEFAULT_FIELDS = (
    'User', 'ExposedPorts', 'Env', 'Entrypoint', 'Cmd', 'WorkingDir', 'ArgsEscaped',
    'Volumes', 'StopSignal', 'StopTimeout', 'Healthcheck', 'Shell', 'OnBuild',
    'NetworkDisabled', 'Hostname', 'Domainname', 'AttachStdin', 'AttachStdout',
    'AttachStderr', 'Tty', 'OpenStdin', 'StdinOnce', 'MacAddress',
)
API_FIELD_DEFAULTS = {
    **dict.fromkeys(('User', 'WorkingDir', 'StopSignal', 'Hostname', 'Domainname', 'MacAddress'), ''),
    **dict.fromkeys(('ArgsEscaped', 'NetworkDisabled', 'AttachStdin', 'AttachStdout', 'AttachStderr',
                     'Tty', 'OpenStdin', 'StdinOnce'), False),
}


def git(*args):
    return subprocess.check_output(['git', *args], timeout=20)


def regular_blob(ref, path):
    match = re.fullmatch(rb'100644 blob ([0-9a-f]{40})\t' + re.escape(path.encode()) + rb'\0',
                         git('ls-tree', '-z', ref, '--', path))
    if match is None:
        raise ValueError('source is not a regular file')
    return match[1].decode('ascii')


def accepted_content(base, head, path):
    blob = regular_blob(base, path)
    if regular_blob(head, path) != blob:
        raise ValueError('accepted authority file changed')
    return git('cat-file', 'blob', blob)


def verify_source(base, head, verify_diff):
    if not all(re.fullmatch(r'[0-9a-f]{40}', ref) for ref in (base, head)):
        raise ValueError('invalid source refs')
    if git('rev-parse', 'HEAD').strip() != head.encode():
        raise ValueError('unexpected source checkout')
    git('merge-base', '--is-ancestor', base, head)
    state = json.loads(accepted_content(base, head, STATE))
    if sorted(state['approvedConcurrentScopes'][SOURCE_BRANCH]) != sorted(SOURCE_PATHS):
        raise ValueError('invalid accepted source scope')
    records = json.loads(accepted_content(base, head, AUTHORITY))
    manifest = records[AUTHORITY_KEY]
    if (manifest['schemaVersion'] != 'platform-v7.concurrent-scope.v1' or
            manifest['status'] != 'active' or manifest['branch'] != SOURCE_BRANCH or
            manifest['productionInvocationAuthorized'] is not False or
            manifest['productionMutationAuthorized'] is not False or manifest['releaseAuthorized'] is not False or
            manifest['baselineEvidence'] != BASELINE_RECORD or
            sorted(manifest['allowedPaths']) != sorted(SOURCE_PATHS)):
        raise ValueError('invalid source manifest')
    if verify_diff:
        changed = git('diff', '--no-renames', '--name-only', '-z', base, head).split(b'\0')[:-1]
        if sorted(changed) != sorted(path.encode() for path in SOURCE_PATHS):
            raise ValueError('source diff exceeds the exact manifest')
    pins = manifest['sourcePins']
    if sorted(pin['path'] for pin in pins) != sorted(SOURCE_PATHS):
        raise ValueError('wrong source pin paths')
    for pin in pins:
        blob = regular_blob(head, pin['path'])
        if pin['mode'] != '100644' or pin['blob'] != blob:
            raise ValueError('source blob differs from the manifest')
        if hashlib.sha256(git('cat-file', 'blob', blob)).hexdigest() != pin['sha256']:
            raise ValueError('source SHA-256 differs from the manifest')
    baseline = records[BASELINE_RECORD]['baseline']
    api_baseline_spec(baseline)
    return baseline


def api_baseline_spec(record):
    patterns = {'revision': r'[0-9a-f]{40}', 'observedImageId': r'sha256:[0-9a-f]{64}',
                'rootfsSHA256': r'[0-9a-f]{64}', 'projectedDefaultsSHA256': r'[0-9a-f]{64}'}
    spec = {key: record[key] for key in patterns}
    if any(type(spec[key]) is not str or re.fullmatch(pattern, spec[key]) is None
           for key, pattern in patterns.items()):
        raise ValueError('invalid API baseline evidence')
    return spec


def build_api_baseline_payload(ref):
    spec = api_baseline_spec(verify_source(ref, ref, verify_diff=False))
    source = git('cat-file', 'blob', regular_blob(ref, PROBE_PATH)).decode('utf-8')
    print('API_BASELINE = ' + repr(spec))
    sys.stdout.write(source)


def rollback_rehearsal_inputs(baseline):
    spec = api_baseline_spec(baseline)
    index, config = baseline['index'], baseline['config']
    if any(type(value) is not str or re.fullmatch(r'sha256:[0-9a-f]{64}', value) is None
           for value in (index, config)):
        raise ValueError('invalid canonical rollback image')
    return ('ghcr.io/pachaninm-lab/grainflow-api@' + index, config,
            spec['observedImageId'], 'pc-crop-transfer/api:' + spec['revision'])


def file_identity(info, label, maximum, exact=None):
    for passed, cause in (
        (stat.S_ISREG(info.st_mode), 'TYPE'), (info.st_uid == 0, 'OWNER'),
        (info.st_gid == 0, 'GROUP'), (stat.S_IMODE(info.st_mode) == 0o600, 'MODE'),
        (info.st_nlink == 1, 'LINKS'),
        (0 < info.st_size <= maximum and (exact is None or info.st_size == exact), 'SIZE'),
    ):
        if not passed:
            return f'{label}_{cause}'
    return 'MATCH'


def observe_identity(root, archive_size):
    if os.getuid() != 0 or os.geteuid() != 0:
        return 'PROCESS_UID'
    if not hasattr(os, 'O_NOATIME'):
        return 'NOATIME_UNAVAILABLE'
    descriptors = []
    try:
        flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_NOATIME
        for depth, component in enumerate(['/', *root.split('/')[1:]]):
            try:
                fd = os.open(component, flags, dir_fd=descriptors[-1] if descriptors else None)
                descriptors.append(fd)
                info = os.fstat(fd)
            except OSError:
                return f'ANCESTOR_{depth}_UNAVAILABLE'
            for passed, reason in (
                (stat.S_ISDIR(info.st_mode), 'TYPE'), (info.st_uid == 0, 'OWNER'),
                (info.st_gid == 0, 'GROUP'), (not stat.S_IMODE(info.st_mode) & 0o022, 'WRITABLE'),
            ):
                if not passed:
                    return f'ANCESTOR_{depth}_{reason}'
        if stat.S_IMODE(os.fstat(descriptors[-2]).st_mode) != 0o700:
            return 'PRIVATE_PARENT_MODE'
        if stat.S_IMODE(os.fstat(descriptors[-1]).st_mode) != 0o700:
            return 'PRIVATE_LEAF_MODE'
        for name, label, maximum, exact in (
            ('receipt.json', 'RECEIPT', 2 * 1024**3, None),
            ('preservation.tar.gpg', 'CIPHERTEXT', archive_size, archive_size),
            ('passphrase', 'KEY', 65, 65),
        ):
            try:
                info = os.stat(name, dir_fd=descriptors[-1], follow_symlinks=False)
            except OSError:
                return f'{label}_UNAVAILABLE'
            result = file_identity(info, label, maximum, exact)
            if result != 'MATCH':
                return result
        return 'MATCH'
    finally:
        for fd in reversed(descriptors):
            os.close(fd)


def build_identity_payload(accepted_source, payload_script):
    assignments = {}
    for node in ast.parse(Path(accepted_source).read_bytes()).body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            name = node.targets[0].id
            if name in {'ORIGINAL_ROOT', 'ORIGINAL_RECEIPT'}:
                assignments[name] = ast.literal_eval(node.value)
    root = assignments['ORIGINAL_ROOT']
    size = assignments['ORIGINAL_RECEIPT']['ciphertextBytes']
    if not re.fullmatch(r'/(?:[A-Za-z0-9_.-]+/)*[A-Za-z0-9_.-]+', root) or any(
            part in {'.', '..'} for part in root.split('/')) or not 3 <= len(root.split('/')) <= MAX_DIRECTORY_DEPTH + 1:
        raise ValueError('invalid pinned root shape')
    if type(size) is not int or not 0 < size <= 2 * 1024**3:
        raise ValueError('invalid pinned ciphertext size')
    print('IDENTITY_SPEC = ' + repr((root, size)))
    sys.stdout.write(Path(payload_script).read_text())


def docker_read(*args):
    command = ['/usr/bin/docker', '--config', '/proc/self/fd', '--host', 'unix:///var/run/docker.sock', *args]
    deadline = time.monotonic() + 4
    maximum = 64 * 1024
    output = bytearray()
    child = subprocess.Popen(command, cwd='/', env={'PATH': '/usr/bin:/bin', 'LC_ALL': 'C'},
                             stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        with selectors.DefaultSelector() as selector:
            selector.register(child.stdout, selectors.EVENT_READ)
            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0 or not selector.select(remaining):
                    raise ValueError('Docker observation deadline')
                block = os.read(child.stdout.fileno(), min(8192, maximum + 1 - len(output)))
                if not block:
                    break
                output.extend(block)
                if len(output) > maximum:
                    raise ValueError('Docker observation output')
        if child.wait(timeout=max(0, deadline - time.monotonic())) != 0:
            raise ValueError('Docker observation refused')
    finally:
        child.stdout.close()
        if child.poll() is None:
            child.kill()
            child.wait(timeout=1)
    return output.decode('utf-8', errors='strict').splitlines()


def api_binding():
    ids = docker_read('ps', '-q', '--no-trunc', '--filter', 'label=com.docker.compose.service=api')
    if len(ids) != 1 or re.fullmatch(r'[a-f0-9]{64}', ids[0]) is None:
        raise ValueError('ambiguous running API')
    binding = docker_read('container', 'inspect', '--format', '{{.Image}} {{.State.Running}}', ids[0])
    if len(binding) != 1 or re.fullmatch(r'sha256:[a-f0-9]{64} true', binding[0]) is None:
        raise ValueError('invalid running API binding')
    return ids[0], binding[0].split()[0]


def api_image_result(parts, baseline):
    if len(parts) != 5 or parts[:3] != [baseline['observedImageId'], 'linux', 'amd64']:
        return 'BASELINE_CHANGED'
    layers = json.loads(parts[3])
    config = json.loads(parts[4])
    if not isinstance(config, dict) or not isinstance(config.get('Labels'), dict):
        return 'BASELINE_CHANGED'
    labels = config['Labels']
    if labels.get('org.opencontainers.image.revision') != baseline['revision']:
        return 'BASELINE_CHANGED'
    if (not isinstance(layers, list) or len(layers) != API_ROOTFS_COUNT or
            any(type(layer) is not str or re.fullmatch(r'sha256:[a-f0-9]{64}', layer) is None
                for layer in layers)):
        return 'ROOTFS_DIFFERENT'
    layers_digest = hashlib.sha256(json.dumps(layers, separators=(',', ':')).encode('ascii')).hexdigest()
    if layers_digest != baseline['rootfsSHA256']:
        return 'ROOTFS_DIFFERENT'
    defaults = {key: config.get(key, API_FIELD_DEFAULTS.get(key)) for key in API_DEFAULT_FIELDS}
    encoded = json.dumps(defaults, ensure_ascii=True, sort_keys=True, separators=(',', ':')).encode('ascii')
    if (hashlib.sha256(encoded).hexdigest() != baseline['projectedDefaultsSHA256'] or
            labels.get('org.opencontainers.image.source') != 'https://github.com/pachaninm-lab/pachanin-demo'):
        return 'ROOTFS_MATCH_PROJECTED_DEFAULTS_DIFFERENT'
    return 'ROOTFS_AND_PROJECTED_DEFAULTS_MATCH'


def restored_api_result(parts, baseline):
    if len(parts) != 5 or re.fullmatch(r'sha256:[0-9a-f]{64}', parts[0]) is None:
        raise ValueError('invalid restored image metadata')
    if parts[0] != baseline['observedImageId']:
        return 'RESTORED_IMAGE_ID_DIFFERS'
    if api_image_result(parts, baseline) != 'ROOTFS_AND_PROJECTED_DEFAULTS_MATCH':
        return 'RESTORED_IMAGE_CONTENT_DIFFERS'
    return 'EXACT_BASELINE_IMAGE_RESTORED'


def observe_api_baseline(baseline):
    if os.getuid() != 0 or os.geteuid() != 0:
        return 'NOT_PROVEN'
    before = api_binding()
    if before[1] != baseline['observedImageId']:
        return 'BASELINE_CHANGED'
    parts = docker_read('image', 'inspect', '--format', IMAGE_METADATA_FORMAT, before[1])
    if api_binding() != before:
        return 'BASELINE_UNSTABLE'
    return api_image_result(parts, baseline)


def api_compose_shape(working, files):
    if (type(working) is not str or not working.startswith('/') or working == '/' or
            type(files) is not str or not files or any(c in working + files for c in ('\0', '\r', '\n'))):
        return 'NOT_PROVEN'
    entries = [part.strip() for part in files.split(',')]
    if not 1 <= len(entries) <= 256:
        return 'NOT_PROVEN'
    normalized = [str(Path(working) / part) if part else '' for part in entries]
    managed = str(Path(working) / 'compose.production-api-only-image.override.yml')
    return 'COMPOSE_' + '_'.join(str(n) for n in (len(entries), len(entries) - len(set(entries)),
                       len(normalized) - len(set(normalized)), entries.count(''), normalized.count(managed)))


def validate_api_compose_shape(value):
    if re.fullmatch(r'COMPOSE_(?:[0-9]{1,3}_){4}[0-9]{1,3}', value):
        count, raw_duplicates, duplicates, empty, managed = map(int, value.split('_')[1:])
        if (1 <= count <= 256 and 0 <= raw_duplicates <= duplicates < count and
                0 <= empty <= count and 0 <= managed <= count - empty):
            return value
    return 'NOT_PROVEN'


def observe_api_compose_shape(baseline):
    if os.getuid() != 0 or os.geteuid() != 0:
        return 'NOT_PROVEN'
    before = api_binding()
    if before[1] != baseline['observedImageId']:
        return 'NOT_PROVEN'
    format_string = ('{{json (index .Config.Labels "com.docker.compose.project.working_dir")}}\n'
                     '{{json (index .Config.Labels "com.docker.compose.project.config_files")}}')
    parts = docker_read('container', 'inspect', '--format', format_string, before[0])
    if len(parts) != 2 or api_binding() != before:
        return 'NOT_PROVEN'
    return api_compose_shape(*(json.loads(part) for part in parts))


def image_store_mode(value):
    if value is None:
        return STORE_MODES[0]
    if (type(value) is not list or any(type(row) is not list or len(row) != 2 or
                                       any(type(item) is not str for item in row) for row in value)):
        raise ValueError('invalid Docker storage driver status')
    driver_types = [v for k, v in value if k == 'driver-type']
    if not driver_types:
        return STORE_MODES[0]
    if driver_types == ['io.containerd.snapshotter.v1']:
        return STORE_MODES[1]
    raise ValueError('unsupported Docker image store')


def read_image_store_mode():
    lines = docker_read('info', '--format', '{{json .DriverStatus}}')
    if len(lines) != 1:
        raise ValueError('invalid Docker storage profile')
    return image_store_mode(json.loads(lines[0]))


def export_api_archive(baseline):
    if os.getuid() != 0 or os.geteuid() != 0:
        raise ValueError('Docker image export requires the protected host identity')
    before = api_binding()
    if before[1] != baseline['observedImageId']:
        raise ValueError('running API image changed')
    parts = docker_read('image', 'inspect', '--format', IMAGE_METADATA_FORMAT, before[1])
    if api_image_result(parts, baseline) != 'ROOTFS_AND_PROJECTED_DEFAULTS_MATCH':
        raise ValueError('running API content differs from the accepted image')
    store = read_image_store_mode()
    sys.stdout.buffer.write(store)
    sys.stdout.buffer.flush()
    subprocess.run(['/usr/bin/docker', '--config', '/proc/self/fd', '--host', 'unix:///var/run/docker.sock',
                    'image', 'save', before[1]], cwd='/', env={'PATH': '/usr/bin:/bin', 'LC_ALL': 'C'},
                   stdin=subprocess.DEVNULL, stdout=sys.stdout.buffer, stderr=subprocess.DEVNULL,
                   timeout=180, check=True)
    if api_binding() != before or read_image_store_mode() != store:
        raise ValueError('running API identity changed during export')


def capture_api_archive(stream, target, limit=ARCHIVE_LIMIT):
    total = 0
    with open(target, 'xb') as archive:
        while block := stream.read(min(1024 * 1024, limit + 1 - total)):
            total += len(block)
            if total > limit:
                raise ValueError('image archive exceeds the size bound')
            archive.write(block)
    if total == 0:
        raise ValueError('empty image archive')


def capture_store_archive(stream, target):
    mode = stream.readline(max(map(len, STORE_MODES)) + 1)
    if mode not in STORE_MODES:
        raise ValueError('invalid Docker image store prefix')
    capture_api_archive(stream, target)
    return mode.decode('ascii').strip()


def kernel_boot_entry(raw, boot_id):
    if len(raw) > JOURNAL_MAX_BYTES or not re.fullmatch(r'[0-9a-f]{32}', boot_id):
        raise ValueError('invalid journal input')
    lines = raw.splitlines()
    if len(lines) != 1:
        raise ValueError('expected one early kernel entry')
    entry = json.loads(lines[0])
    if (entry.get('_BOOT_ID') != boot_id or entry.get('_TRANSPORT') != 'kernel' or
            entry.get('SYSLOG_FACILITY') != '0' or entry.get('SYSLOG_IDENTIFIER') != 'kernel' or
            not re.match(r'^Linux version [0-9]', entry.get('MESSAGE', ''))):
        raise ValueError('unexpected kernel entry')
    realtime = entry.get('__REALTIME_TIMESTAMP', '')
    monotonic = entry.get('__MONOTONIC_TIMESTAMP', '')
    if not re.fullmatch(r'[0-9]{16}', realtime) or not re.fullmatch(r'[0-9]{1,9}', monotonic):
        raise ValueError('invalid journal timestamps')
    if int(monotonic) > EARLY_BOOT_US:
        raise ValueError('kernel entry was not early in boot')
    return (int(realtime) - int(monotonic)) // 1000


def read_guest():
    boot_id = Path('/proc/sys/kernel/random/boot_id').read_text(encoding='ascii').strip().replace('-', '')
    result = subprocess.run(
        ['/usr/bin/journalctl', '--boot=0', '--dmesg', '--no-pager', '--quiet',
         '--lines=2', '--grep=^Linux version [0-9]', '--output=json',
         '--output-fields=MESSAGE,_BOOT_ID,_TRANSPORT,SYSLOG_FACILITY,SYSLOG_IDENTIFIER'],
        stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        cwd='/', env={'PATH': '/usr/bin:/bin', 'LC_ALL': 'C'}, timeout=5, check=True,
    )
    journal_boot_ms = kernel_boot_entry(result.stdout, boot_id)
    uptime_ms = (time.clock_gettime_ns(time.CLOCK_BOOTTIME) + 999_999) // 1_000_000
    print(f'{journal_boot_ms} {uptime_ms}')


def reconcile(raw, started_ms, ended_ms):
    pair = re.fullmatch(r'([0-9]{13}) ([0-9]{1,13})', raw)
    if pair is None or not 0 <= ended_ms - started_ms <= 35_000:
        return False
    journal_boot_ms, uptime_ms = map(int, pair.groups())
    lower_bound = started_ms - uptime_ms
    upper_bound = ended_ms - uptime_ms
    return (min(journal_boot_ms, lower_bound) > LEGACY_CUTOFF_MS + CLOCK_TOLERANCE_MS
            and lower_bound - CLOCK_TOLERANCE_MS <= journal_boot_ms <= upper_bound + CLOCK_TOLERANCE_MS)


def self_test():
    from io import BytesIO
    from tempfile import TemporaryDirectory
    from types import SimpleNamespace
    from unittest.mock import patch

    assert api_compose_shape('/srv/fixture', 'one.yml,/srv/fixture/one.yml,two.yml,two.yml') == 'COMPOSE_4_1_2_0_0'
    assert api_compose_shape('/srv/fixture', 'one.yml,,compose.production-api-only-image.override.yml') == 'COMPOSE_3_0_0_1_1'
    assert api_compose_shape('/srv/fixture', ','.join(['one.yml'] * 257)) == 'NOT_PROVEN'
    assert api_compose_shape('/srv/fixture', 'one.yml\ntwo.yml') == 'NOT_PROVEN'
    assert validate_api_compose_shape('COMPOSE_4_1_2_0_0') == 'COMPOSE_4_1_2_0_0'
    for invalid in ('COMPOSE_0_0_0_0_0', 'COMPOSE_4_2_1_0_0', 'COMPOSE_4_0_0_3_2', 'COMPOSE_PRIVATE_PATH'):
        assert validate_api_compose_shape(invalid) == 'NOT_PROVEN'

    boot_id = 'a' * 32
    entry = {'_BOOT_ID': boot_id, '_TRANSPORT': 'kernel', 'SYSLOG_FACILITY': '0',
             'SYSLOG_IDENTIFIER': 'kernel', 'MESSAGE': 'Linux version 6.18',
             '__MONOTONIC_TIMESTAMP': '1000000', '__REALTIME_TIMESTAMP': '1794355201000000'}
    assert kernel_boot_entry(json.dumps(entry).encode(), boot_id) == 1794355200000
    invalid = ({'_BOOT_ID': 'b' * 32}, {'_TRANSPORT': 'stdout'}, {'SYSLOG_FACILITY': '1'},
               {'SYSLOG_IDENTIFIER': 'other'}, {'MESSAGE': 'other'},
               {'__MONOTONIC_TIMESTAMP': '120000001'}, {'__REALTIME_TIMESTAMP': '0'})
    for change in invalid:
        try:
            kernel_boot_entry(json.dumps({**entry, **change}).encode(), boot_id)
        except ValueError:
            continue
        raise AssertionError('invalid kernel entry accepted')
    boot = LEGACY_CUTOFF_MS + 2_000_000
    before = boot + 5000
    after = before + 1000
    assert reconcile(f'{boot} 5000', before, after)
    assert not reconcile(f'{LEGACY_CUTOFF_MS - 1} 5000', before, after)
    assert not reconcile(f'{boot} 500000', before, after)
    assert not reconcile(f'{boot} 5000', before, before - 1)
    assert not reconcile(f'{boot} 5000', before, before + 35_001)
    assert not reconcile(f'{boot} 5000\nextra', before, after)
    info = {'st_mode': stat.S_IFREG | 0o600, 'st_uid': 0, 'st_gid': 0, 'st_nlink': 1, 'st_size': 65}
    assert file_identity(SimpleNamespace(**info), 'KEY', 65, 65) == 'MATCH'
    for key, value, reason in (
        ('st_mode', stat.S_IFLNK | 0o600, 'TYPE'), ('st_uid', 1, 'OWNER'), ('st_gid', 1, 'GROUP'),
        ('st_mode', stat.S_IFREG | 0o640, 'MODE'), ('st_nlink', 2, 'LINKS'), ('st_size', 64, 'SIZE'),
    ):
        assert file_identity(SimpleNamespace(**{**info, key: value}), 'KEY', 65, 65) == 'KEY_' + reason
    layers = ['sha256:' + 'f' * 64]
    image_source = 'https://github.com/pachaninm-lab/pachanin-demo'
    revision = '1' * 40
    image_id = 'sha256:' + '2' * 64
    config = {'Labels': {'org.opencontainers.image.revision': revision,
                         'org.opencontainers.image.source': image_source}, 'Env': ['FIXTURE=1']}
    defaults = {key: config.get(key, API_FIELD_DEFAULTS.get(key)) for key in API_DEFAULT_FIELDS}
    baseline = {
        'revision': revision,
        'observedImageId': image_id,
        'rootfsSHA256': hashlib.sha256(json.dumps(layers, separators=(',', ':')).encode()).hexdigest(),
        'projectedDefaultsSHA256': hashlib.sha256(json.dumps(defaults, sort_keys=True, separators=(',', ':')).encode()).hexdigest(),
    }
    assert api_baseline_spec({**baseline, 'observedArtifact': 1}) == baseline
    for field, value in (('revision', 'f' * 39), ('observedImageId', '0' * 64),
                         ('rootfsSHA256', 'f' * 64 + '\n'), ('projectedDefaultsSHA256', 1)):
        try:
            api_baseline_spec({**baseline, field: value})
        except ValueError:
            pass
        else:
            raise AssertionError('malformed API baseline was accepted')
    fixture = [image_id, 'linux', 'amd64', json.dumps(layers), json.dumps(config)]
    index = 'sha256:' + '3' * 64
    published_config = 'sha256:' + '4' * 64
    assert rollback_rehearsal_inputs({**baseline, 'index': index, 'config': published_config}) == (
        'ghcr.io/pachaninm-lab/grainflow-api@' + index, published_config,
        image_id, 'pc-crop-transfer/api:' + revision)
    try:
        rollback_rehearsal_inputs({**baseline, 'index': 'latest', 'config': published_config})
    except ValueError:
        pass
    else:
        raise AssertionError('mutable rollback image was accepted')
    with patch.dict(globals(), {'API_ROOTFS_COUNT': 1}):
        assert api_image_result(fixture, baseline) == 'ROOTFS_AND_PROJECTED_DEFAULTS_MATCH'
        assert api_image_result(fixture[:4], baseline) == 'BASELINE_CHANGED'
        assert api_image_result([fixture[0], 'linux', 'arm64', *fixture[3:]], baseline) == 'BASELINE_CHANGED'
        assert api_image_result([*fixture[:3], json.dumps([]), fixture[4]], baseline) == 'ROOTFS_DIFFERENT'
        assert api_image_result([*fixture[:3], json.dumps(['sha256:' + 'a' * 64]), fixture[4]], baseline) == 'ROOTFS_DIFFERENT'
        assert api_image_result([*fixture[:4], json.dumps({**config, 'Env': ['FIXTURE=2']})], baseline) == 'ROOTFS_MATCH_PROJECTED_DEFAULTS_DIFFERENT'
        bad_source = {**config['Labels'], 'org.opencontainers.image.source': 'https://example.invalid/other'}
        assert api_image_result([*fixture[:4], json.dumps({**config, 'Labels': bad_source})], baseline) == 'ROOTFS_MATCH_PROJECTED_DEFAULTS_DIFFERENT'
        assert api_image_result([*fixture[:4], json.dumps({**config, 'StopTimeout': 0})], baseline) == 'ROOTFS_MATCH_PROJECTED_DEFAULTS_DIFFERENT'
        assert api_image_result([*fixture[:4], json.dumps({**config, 'ArgsEscaped': False})], baseline) == 'ROOTFS_AND_PROJECTED_DEFAULTS_MATCH'
        assert restored_api_result(fixture, baseline) == 'EXACT_BASELINE_IMAGE_RESTORED'
        assert restored_api_result([published_config, *fixture[1:]], baseline) == 'RESTORED_IMAGE_ID_DIFFERS'
        assert restored_api_result([*fixture[:3], '[]', fixture[4]], baseline) == 'RESTORED_IMAGE_CONTENT_DIFFERS'
    binding = ('1' * 64, image_id)
    with (patch('os.getuid', return_value=0), patch('os.geteuid', return_value=0),
          patch.dict(globals(), {'api_binding': iter((binding, ('2' * 64, image_id))).__next__,
                                 'docker_read': lambda *_: fixture})):
        assert observe_api_baseline(baseline) == 'BASELINE_UNSTABLE'
    with TemporaryDirectory() as folder:
        target = Path(folder) / 'api.tar'
        capture_api_archive(BytesIO(b'abcd'), target, limit=4)
        assert target.read_bytes() == b'abcd'
        for data, path in ((b'', Path(folder) / 'empty'), (b'12345', Path(folder) / 'large'), (b'ok', target)):
            try:
                capture_api_archive(BytesIO(data), path, limit=4)
            except (ValueError, FileExistsError):
                pass
            else:
                raise AssertionError('invalid archive input was accepted')
        for mode in STORE_MODES:
            target = Path(folder) / mode.decode('ascii').strip()
            assert capture_store_archive(BytesIO(mode + b'image archive'), target) == target.name
            assert target.read_bytes() == b'image archive'
        for data in (b'UNKNOWN\narchive', b'CLASSIC', b'CONTAINERD\n'):
            try:
                capture_store_archive(BytesIO(data), Path(folder) / 'bad')
            except ValueError:
                pass
            else:
                raise AssertionError('invalid store archive was accepted')
    assert image_store_mode(None) == b'CLASSIC\n'
    assert image_store_mode([['Backing Filesystem', 'extfs']]) == b'CLASSIC\n'
    containerd = [['driver-type', 'io.containerd.snapshotter.v1']]
    assert image_store_mode(containerd) == b'CONTAINERD\n'
    for status in ({}, [[]], [['driver-type', 'other']], containerd * 2):
        try:
            image_store_mode(status)
        except ValueError:
            pass
        else:
            raise AssertionError('unsupported image store was accepted')
    for uid, last_binding, content, expected_calls, should_fail in (
        (1000, binding, 'ROOTFS_AND_PROJECTED_DEFAULTS_MATCH', 0, True),
        (0, binding, 'ROOTFS_AND_PROJECTED_DEFAULTS_MATCH', 1, False),
        (0, ('2' * 64, image_id), 'ROOTFS_AND_PROJECTED_DEFAULTS_MATCH', 1, True),
        (0, binding, 'ROOTFS_DIFFERENT', 0, True),
    ):
        observations = iter((binding, last_binding))
        with (patch('os.getuid', return_value=uid), patch('os.geteuid', return_value=uid),
              patch('subprocess.run') as execute,
              patch('sys.stdout', SimpleNamespace(buffer=BytesIO())),
              patch.dict(globals(), {'api_binding': observations.__next__, 'docker_read': lambda *_: [],
                                     'read_image_store_mode': lambda: b'CLASSIC\n',
                                     'api_image_result': lambda *_: content})):
            try:
                export_api_archive(baseline)
            except ValueError:
                assert should_fail
            else:
                assert not should_fail
            assert execute.call_count == expected_calls
            if expected_calls:
                assert sys.stdout.buffer.getvalue() == b'CLASSIC\n'
                assert execute.call_args.args[0][-3:] == ['image', 'save', image_id]
                assert execute.call_args.kwargs['timeout'] == 180
    print('PASS: local boot, identity, API content, image store and image recovery cases')


if __name__ == '__main__':
    try:
        if len(sys.argv) == 1:
            read_guest()
        elif sys.argv[1:] == ['--identity']:
            print(observe_identity(*globals()['IDENTITY_SPEC']))
        elif sys.argv[1:] == ['--api-baseline']:
            print(observe_api_baseline(api_baseline_spec(globals()['API_BASELINE'])))
        elif sys.argv[1:] == ['--api-compose-shape']:
            print(observe_api_compose_shape(api_baseline_spec(globals()['API_BASELINE'])))
        elif sys.argv[1:] == ['--export-running-api-archive']:
            export_api_archive(api_baseline_spec(globals()['API_BASELINE']))
        elif sys.argv[1:] == ['--self-test']:
            self_test()
        elif len(sys.argv) == 4 and sys.argv[1] == '--verify-pr':
            verify_source(sys.argv[2], sys.argv[3], verify_diff=True)
            print('LEGACY_BOOT_SOURCE_PINS_PASS')
        elif len(sys.argv) == 3 and sys.argv[1] == '--verify-main':
            verify_source(sys.argv[2], sys.argv[2], verify_diff=False)
            print('LEGACY_BOOT_SOURCE_PINS_PASS')
        elif len(sys.argv) == 3 and sys.argv[1] == '--build-api-baseline-payload':
            build_api_baseline_payload(sys.argv[2])
        elif len(sys.argv) == 3 and sys.argv[1] == '--rollback-rehearsal-inputs':
            ref = sys.argv[2]
            print(*rollback_rehearsal_inputs(verify_source(ref, ref, verify_diff=False)), sep='\n')
        elif len(sys.argv) == 3 and sys.argv[1] == '--capture-api-image-archive':
            print(capture_store_archive(sys.stdin.buffer, sys.argv[2]))
        elif sys.argv[1:] == ['--classify-image-store']:
            raw = sys.stdin.buffer.read(64 * 1024 + 1)
            if len(raw) > 64 * 1024:
                raise ValueError('Docker storage status is too large')
            print(image_store_mode(json.loads(raw)).decode('ascii').strip())
        elif len(sys.argv) == 3 and sys.argv[1] == '--verify-restored-api-image':
            ref = sys.argv[2]
            limit = 64 * 1024
            raw = sys.stdin.buffer.read(limit + 1)
            if len(raw) > limit:
                raise ValueError('restored image metadata is too large')
            baseline = verify_source(ref, ref, verify_diff=False)
            print(restored_api_result(raw.decode('utf-8').splitlines(), baseline))
        elif len(sys.argv) == 4 and sys.argv[1] == '--build-identity-payload':
            build_identity_payload(sys.argv[2], sys.argv[3])
        elif len(sys.argv) == 3 and sys.argv[1] == '--validate-identity':
            print(sys.argv[2] if sys.argv[2] in IDENTITY_CODES else 'NOT_PROVEN')
        elif len(sys.argv) == 3 and sys.argv[1] == '--validate-api':
            print(sys.argv[2] if sys.argv[2] in API_CODES else 'NOT_PROVEN')
        elif len(sys.argv) == 3 and sys.argv[1] == '--validate-api-compose-shape':
            print(validate_api_compose_shape(sys.argv[2]))
        elif len(sys.argv) == 5 and sys.argv[1] == '--reconcile':
            print('BOOT_AFTER_LEGACY_CUTOFF' if reconcile(sys.argv[2], int(sys.argv[3]), int(sys.argv[4]))
                  else 'NOT_PROVEN')
        else:
            raise SystemExit(2)
    except (OSError, ValueError, TypeError, AttributeError, KeyError, subprocess.SubprocessError):
        raise SystemExit(1) from None
