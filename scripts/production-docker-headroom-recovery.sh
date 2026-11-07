#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
export PATH='/usr/sbin:/usr/bin:/sbin:/bin'
# Reviewed source enters through the one pinned owner transport; no remote file.
exec /usr/bin/python3 - "$@" <<'PY_RECLAIM'
import ctypes
import hashlib
import json
import os
import re
import selectors
import signal
import stat
import subprocess
import sys
import time
from collections import defaultdict
from pathlib import Path

SCHEMA = 'pc.production-docker-headroom-recovery.v2'
OPERATION = 'live-headroom-20261030'
JOURNAL_PARENT = '/var/lib/pc-release-authority'
MAX_IMAGES = 512
MAX_CONTAINERS = 128
MAX_REFS = 128
MAX_COMMANDS = 512
MAX_OUTPUT = 2 * 1024 * 1024
MAX_TOTAL_OUTPUT = 16 * 1024 * 1024
OPERATION_SECONDS = 180
COMMAND_SECONDS = 5
FAILURES = {'INVALID_INPUT', 'ROOT_REQUIRED', 'DEADLINE', 'COMMAND_LIMIT', 'OUTPUT_LIMIT',
            'COMMAND_FAILED', 'COMMAND_NOT_PROVEN', 'METADATA_NOT_PROVEN', 'INVENTORY_LIMIT',
            'RUNTIME_NOT_PROVEN', 'RUNTIME_CHANGED', 'IMAGE_CHANGED', 'RESERVE_CHANGED',
            'STORAGE_NOT_PROVEN', 'JOURNAL_NOT_PROVEN', 'OPERATION_ALREADY_EXISTS',
            'REMOVE_NOT_PROVEN', 'INTERNAL_NOT_PROVEN'}
canonical_tag = re.compile(r'^ghcr[.]io/pachaninm-lab/grainflow-(api|web|migration|tai):[A-Za-z0-9_.-]+$')
canonical_digest = re.compile(r'^ghcr[.]io/pachaninm-lab/grainflow-(api|web|migration|tai)@sha256:[0-9a-f]{64}$')
transfer_tag = re.compile(r'^pc-crop-transfer/(api|web|migration):([0-9a-f]{40})$')
transfer_digest = re.compile(r'^pc-crop-transfer/(api|web|migration)@sha256:[0-9a-f]{64}$')
revision_re = re.compile(r'^[0-9a-f]{40}$')
image_id_re = re.compile(r'^sha256:[0-9a-f]{64}$')
container_id_re = re.compile(r'^[0-9a-f]{64}$')
reclaim_components = {'api', 'web', 'migration'}


class Refusal(Exception):
    def __init__(self, code):
        self.code = code if code in FAILURES else 'INTERNAL_NOT_PROVEN'


def require(value, code='METADATA_NOT_PROVEN'):
    if not value:
        raise Refusal(code)


def strict_json(raw):
    def pairs(items):
        value = {}
        for key, item in items:
            require(key not in value)
            value[key] = item
        return value
    def nonfinite(value):
        raise Refusal('METADATA_NOT_PROVEN')
    try:
        return json.loads(raw, object_pairs_hook=pairs, parse_constant=nonfinite)
    except (ValueError, UnicodeError, TypeError):
        raise Refusal('METADATA_NOT_PROVEN') from None


def compact(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=True, separators=(',', ':'))


class Runner:
    """A fixed local CLI, bounded pipes, deadline, and owned child process group."""
    def __init__(self):
        self.deadline = time.monotonic() + OPERATION_SECONDS
        self.calls = 0
        self.output_bytes = 0

    def check(self):
        require(time.monotonic() < self.deadline, 'DEADLINE')

    def command(self, argv, check=True):
        self.check()
        self.calls += 1
        require(self.calls <= MAX_COMMANDS, 'COMMAND_LIMIT')
        require(isinstance(argv, list) and argv and argv[0] == 'docker', 'COMMAND_NOT_PROVEN')
        require(all(isinstance(a, str) and 0 < len(a) <= 1024 and '\x00' not in a for a in argv), 'COMMAND_NOT_PROVEN')
        argv = ['/usr/bin/docker', '--host', 'unix:///run/docker.sock'] + argv[1:]
        parent = os.getpid()
        def child_limits():
            import resource
            resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
            if ctypes.CDLL(None, use_errno=True).prctl(1, signal.SIGKILL, 0, 0, 0) != 0 or os.getppid() != parent:
                os._exit(125)
        proc = None
        sel = selectors.DefaultSelector()
        out = bytearray()
        sizes = {'out': 0, 'err': 0}
        try:
            proc = subprocess.Popen(argv, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                    stderr=subprocess.PIPE, env={'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'LC_ALL': 'C'},
                                    cwd='/', close_fds=True, start_new_session=True, preexec_fn=child_limits)
            for stream, name in ((proc.stdout, 'out'), (proc.stderr, 'err')):
                os.set_blocking(stream.fileno(), False)
                sel.register(stream, selectors.EVENT_READ, name)
            deadline = min(self.deadline, time.monotonic() + COMMAND_SECONDS)
            while sel.get_map():
                remaining = deadline - time.monotonic()
                require(remaining > 0, 'DEADLINE')
                for key, _ in sel.select(min(remaining, 0.1)):
                    try:
                        chunk = os.read(key.fileobj.fileno(), 65536)
                    except BlockingIOError:
                        continue
                    if not chunk:
                        sel.unregister(key.fileobj)
                        continue
                    sizes[key.data] += len(chunk)
                    self.output_bytes += len(chunk)
                    require(sizes[key.data] <= MAX_OUTPUT and self.output_bytes <= MAX_TOTAL_OUTPUT, 'OUTPUT_LIMIT')
                    if key.data == 'out':
                        out.extend(chunk)
            status = proc.wait(timeout=max(0.001, deadline - time.monotonic()))
            self.check()
            require(not check or status == 0, 'COMMAND_FAILED')
            return subprocess.CompletedProcess(argv, status, bytes(out).decode('utf-8', errors='strict'), '')
        except Refusal:
            raise
        except subprocess.TimeoutExpired:
            raise Refusal('DEADLINE') from None
        except (OSError, ValueError, UnicodeError, subprocess.SubprocessError):
            raise Refusal('COMMAND_NOT_PROVEN') from None
        finally:
            sel.close()
            if proc is not None:
                # Also terminate descendants retaining pipes after their parent exits.
                try:
                    os.killpg(proc.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                for stream in (proc.stdout, proc.stderr):
                    if stream is not None:
                        stream.close()
                try:
                    proc.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    raise Refusal('COMMAND_NOT_PROVEN') from None


def directory_fd(path):
    require(isinstance(path, str) and path.startswith('/') and '\x00' not in path, 'STORAGE_NOT_PROVEN')
    parts = path[1:].split('/') if path != '/' else []
    require(len(parts) <= 64 and all(p not in ('', '.', '..') for p in parts), 'STORAGE_NOT_PROVEN')
    fd = os.open('/', os.O_DIRECTORY | os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        for index, part in enumerate(parts):
            child = os.open(part, os.O_DIRECTORY | os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=fd)
            os.close(fd)
            fd = child
            info = os.fstat(fd)
            sticky_ancestor = index < len(parts) - 1 and bool(info.st_mode & stat.S_ISVTX)
            require(info.st_uid == 0 and (not info.st_mode & 0o022 or sticky_ancestor), 'STORAGE_NOT_PROVEN')
        return fd
    except BaseException:
        os.close(fd)
        raise


class Journal:
    """Exclusive fixed-purpose journal; an existing operation is never replayed."""
    @staticmethod
    def ensure_absent():
        parent = directory_fd(JOURNAL_PARENT)
        try:
            try:
                os.stat(OPERATION, dir_fd=parent, follow_symlinks=False)
            except FileNotFoundError:
                return
            raise Refusal('OPERATION_ALREADY_EXISTS')
        finally:
            os.close(parent)

    def __init__(self, target, run_id):
        self.fd = None
        parent = directory_fd(JOURNAL_PARENT)
        try:
            try:
                os.mkdir(OPERATION, 0o700, dir_fd=parent)
            except FileExistsError:
                raise Refusal('OPERATION_ALREADY_EXISTS') from None
            os.fsync(parent)
            self.fd = os.open(OPERATION, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=parent)
            info = os.fstat(self.fd)
            require(info.st_uid == 0 and stat.S_IMODE(info.st_mode) == 0o700, 'JOURNAL_NOT_PROVEN')
            self.write('unknown.json', {'schema': 'pc.live-headroom-journal.v1', 'operation': OPERATION,
                                       'target': target, 'run_id': run_id, 'state': 'UNKNOWN'})
        except BaseException:
            self.close()
            raise
        finally:
            os.close(parent)

    def write(self, name, value):
        require(re.fullmatch(r'(?:unknown|receipt|intent-[0-9]{6})[.]json', name) is not None, 'JOURNAL_NOT_PROVEN')
        data = (compact(value) + '\n').encode()
        require(len(data) <= 16384, 'JOURNAL_NOT_PROVEN')
        fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC, 0o600, dir_fd=self.fd)
        try:
            view = memoryview(data)
            while view:
                written = os.write(fd, view)
                require(written > 0, 'JOURNAL_NOT_PROVEN')
                view = view[written:]
            os.fsync(fd)
        finally:
            os.close(fd)
        os.fsync(self.fd)

    def intent(self, ordinal, image, reference):
        self.write('intent-%06d.json' % ordinal, {'state': 'UNKNOWN', 'image': image, 'reference': reference,
                                                'operation': OPERATION, 'ordinal': ordinal})

    def close(self):
        if self.fd is not None:
            os.close(self.fd)
            self.fd = None


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
        return tag_match.group(1), 'TAG', 'REGISTRY_CANONICAL'
    digest_match = canonical_digest.fullmatch(ref)
    if digest_match:
        return digest_match.group(1), 'DIGEST', 'REGISTRY_CANONICAL'
    tag_match = transfer_tag.fullmatch(ref)
    if tag_match:
        return tag_match.group(1), 'TAG', 'EXACT_SHA_TRANSFER_ALIAS'
    digest_match = transfer_digest.fullmatch(ref)
    if digest_match:
        return digest_match.group(1), 'DIGEST', 'EXACT_SHA_TRANSFER_ALIAS'
    return None


def classify_release_image(item, require_tag=True, allow_attested_digest_only=False):
    refs = image_refs(item)
    if refs is None or not refs:
        return None
    tags = []
    components = set()
    namespaces = set()
    for ref in refs:
        classified = ref_component(ref)
        if classified is None:
            return None
        component, ref_type, namespace = classified
        components.add(component)
        namespaces.add(namespace)
        if ref_type == 'TAG':
            tags.append(ref)
    if (require_tag and not tags) or len(components) != 1 or len(namespaces) != 1:
        return None
    component = next(iter(components))
    if component not in reclaim_components:
        return None
    namespace = next(iter(namespaces))
    config = item.get('Config') if isinstance(item.get('Config'), dict) else {}
    labels = config.get('Labels') if isinstance(config.get('Labels'), dict) else {}
    revision = labels.get('org.opencontainers.image.revision')
    if not isinstance(revision, str) or not revision_re.fullmatch(revision):
        return None
    if namespace == 'EXACT_SHA_TRANSFER_ALIAS':
        # The accepted release controller imports these three component aliases.
        # A digest-only, mismatched, mixed or unknown alias is not disposable.
        if (not tags and not allow_attested_digest_only) or any(transfer_tag.fullmatch(tag).group(2) != revision for tag in tags):
            return None
    return component, namespace, tuple(sorted(set(tags))), refs

def bounded_lines(raw, maximum, pattern, allow_duplicates=False):
    values = raw.splitlines()
    raw_limit = maximum * MAX_REFS if allow_duplicates else maximum
    require(len(values) <= raw_limit and all(pattern.fullmatch(x) for x in values), 'INVENTORY_LIMIT')
    require(len(set(values)) <= maximum, 'INVENTORY_LIMIT')
    require(allow_duplicates or len(set(values)) == len(values), 'METADATA_NOT_PROVEN')
    return frozenset(values)


def image_token(item):
    return compact({k: item.get(k) for k in ('Id', 'RepoTags', 'RepoDigests', 'Config', 'RootFS', 'Created', 'Size')})


class Recovery:
    def __init__(self, target, run_id, runner=None):
        self.target = target
        self.run_id = run_id
        self.runner = runner or Runner()
        self.journal = None
        self.journal_attempted = False
        self.before_runtime = None
        self.before_images = None
        self.deleted = set()
        self.initial_reserve = set()
        self.attested_records = {}
        self.report = {
            'schemaVersion': SCHEMA, 'targetSha': target, 'runId': int(run_id),
            'mode': 'BOUNDED_UNUSED_CANONICAL_IMAGE_RECLAIM',
            'deleteAuthority': 'CANONICAL_REFERENCE_OR_FULL_IMAGE_ID_NO_FORCE',
            'reclaimComponents': ['api', 'migration', 'web'],
            'reclaimNamespaces': ['EXACT_SHA_TRANSFER_ALIAS', 'REGISTRY_CANONICAL'],
            'rollbackImagesPerComponentPerNamespace': 2,
            'requiredAvailableKb': 5 * 1024 * 1024, 'targetAvailableKb': 6 * 1024 * 1024,
            'beforeAvailableKb': None, 'afterAvailableKb': None,
            'canonicalImageCount': 0, 'eligibleImageCount': 0,
            'containerProtectedImageCount': 0, 'protectedImageCount': 0,
            'attemptedImageCount': 0, 'removedReferenceCount': 0,
            'deletedImageCount': 0, 'skippedImageCount': 0,
            'reclaimedBytes': 0, 'targetReached': False, 'passed': False,
            'status': 'REFUSED', 'failure': None, 'journal': 'NOT_CREATED',
            'runtimeIdentityUnchanged': False, 'objectSetsUnchanged': False,
            'productionAcceptance': False,
        }

    def command(self, args, check=True):
        return self.runner.command(['docker'] + args, check=check)

    def array(self, args, ids, key):
        data = strict_json(self.command(args).stdout)
        require(isinstance(data, list) and len(data) == len(ids))
        require(all(isinstance(row, dict) and isinstance(row.get(key), str) for row in data))
        require({row[key] for row in data} == set(ids) and len({row[key] for row in data}) == len(data))
        return {row[key]: row for row in data}

    def available_kb(self):
        descriptors = []
        try:
            for path in ('/var/lib/docker', '/var/lib/containerd', '/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs'):
                descriptors.append(directory_fd(path))
            devices = {os.fstat(fd).st_dev for fd in descriptors}
            require(len(devices) == 1, 'STORAGE_NOT_PROVEN')
            info = os.fstatvfs(descriptors[-1])
            require(all(type(v) is int for v in (info.f_frsize, info.f_bavail, info.f_bfree, info.f_blocks)), 'STORAGE_NOT_PROVEN')
            require(info.f_frsize > 0 and 0 <= info.f_bavail <= info.f_bfree <= info.f_blocks, 'STORAGE_NOT_PROVEN')
            value = info.f_frsize * info.f_bavail
            require(value < 2**63, 'STORAGE_NOT_PROVEN')
            return value // 1024
        finally:
            for fd in descriptors:
                os.close(fd)

    def runtime(self):
        ids = bounded_lines(self.command(['ps', '-aq', '--no-trunc']).stdout, MAX_CONTAINERS, container_id_re)
        require(ids, 'RUNTIME_NOT_PROVEN')
        data = self.array(['inspect'] + sorted(ids), ids, 'Id')
        referenced = set()
        roles = {'api': [], 'web': []}
        stable = {}
        for identity, item in data.items():
            require(image_id_re.fullmatch(item.get('Image', '')), 'RUNTIME_NOT_PROVEN')
            require(all(isinstance(item.get(k), dict) for k in ('Config', 'HostConfig', 'NetworkSettings', 'State')), 'RUNTIME_NOT_PROVEN')
            labels = item['Config'].get('Labels') or {}
            require(isinstance(labels, dict), 'RUNTIME_NOT_PROVEN')
            role = labels.get('com.docker.compose.service')
            if role in roles and item['State'].get('Running') is True:
                roles[role].append(identity)
                require(revision_re.fullmatch(labels.get('org.opencontainers.image.revision', '')), 'RUNTIME_NOT_PROVEN')
            referenced.add(item['Image'])
            stable[identity] = {k: item[k] for k in ('Id', 'Image', 'Config', 'HostConfig', 'NetworkSettings')}
            stable[identity]['State'] = {k: item['State'].get(k) for k in ('Running', 'StartedAt', 'Restarting', 'Paused')}
        require(all(len(values) == 1 for values in roles.values()), 'RUNTIME_NOT_PROVEN')
        volumes = bounded_lines(self.command(['volume', 'ls', '-q']).stdout, 512, re.compile(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,254}'))
        networks = bounded_lines(self.command(['network', 'ls', '-q', '--no-trunc']).stdout, 128, container_id_re)
        return {'identity': compact(stable), 'images': frozenset(referenced), 'volumes': volumes, 'networks': networks}

    def catalog(self):
        ids = bounded_lines(self.command(['image', 'ls', '-aq', '--no-trunc']).stdout, MAX_IMAGES, image_id_re, allow_duplicates=True)
        require(ids, 'METADATA_NOT_PROVEN')
        # Complete immutable-ID list plus exact-cardinality inspect. A failed
        # inspect is never absence and never a successful removal receipt.
        rows = self.array(['image', 'inspect'] + sorted(ids), ids, 'Id')
        records = {}
        for identity, item in rows.items():
            refs = image_refs(item)
            require(refs is not None and len(refs) <= MAX_REFS)
            classification = classify_release_image(item, require_tag=False)
            if classification is None and identity in self.attested_records:
                classification = classify_release_image(item, require_tag=False, allow_attested_digest_only=True)
            if classification is None:
                continue
            component, namespace, tags, refs = classification
            config = item.get('Config')
            require(isinstance(config, dict) and isinstance(config.get('Labels'), dict))
            revision = config['Labels'].get('org.opencontainers.image.revision')
            created = item.get('Created')
            size = item.get('Size')
            require(type(size) is int and 0 <= size < 2**63)
            match = re.fullmatch(r'(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:[.](\d{1,9}))?Z', created or '')
            require(match is not None)
            import datetime
            seconds = int(datetime.datetime.fromisoformat(match[1] + '+00:00').timestamp())
            order = (seconds, (match[2] or '').ljust(9, '0'), identity)
            records[identity] = {'id': identity, 'component': component, 'namespace': namespace,
                                 'refs': refs, 'revision': revision, 'created': order, 'size': size}
        return rows, records

    def reserve(self, records, runtime):
        protected = set(runtime['images'])
        groups = defaultdict(list)
        for identity, row in records.items():
            if row['revision'] == self.target:
                protected.add(identity)
            groups[(row['component'], row['namespace'])].append(row)
        for rows in groups.values():
            protected.update(row['id'] for row in sorted(rows, key=lambda row: row['created'], reverse=True)[:2])
        return protected

    def revalidate(self, changed_image=None, prior=None):
        runtime = self.runtime()
        require(runtime == self.before_runtime, 'RUNTIME_CHANGED')
        rows, records = self.catalog()
        expected_ids = set(self.before_images) - self.deleted
        if changed_image is not None and changed_image not in rows:
            expected_ids.remove(changed_image)
        require(set(rows) == expected_ids, 'IMAGE_CHANGED')
        for identity, item in rows.items():
            if identity != changed_image:
                require(image_token(item) == image_token(self.before_images[identity]), 'IMAGE_CHANGED')
        protected = self.reserve(records, runtime)
        require(self.initial_reserve <= set(rows) and self.initial_reserve <= protected, 'RESERVE_CHANGED')
        if changed_image is not None and changed_image in rows:
            require(prior is not None)
            before = dict(prior)
            after = dict(rows[changed_image])
            for field in ('RepoTags', 'RepoDigests'):
                before.pop(field, None)
                after.pop(field, None)
            require(image_token(before) == image_token(after), 'IMAGE_CHANGED')
            require(set(image_refs(rows[changed_image])) < set(image_refs(prior)), 'REMOVE_NOT_PROVEN')
        return runtime, rows, records, protected

    def execute(self):
        require(os.geteuid() == 0, 'ROOT_REQUIRED')
        require(revision_re.fullmatch(self.target) is not None and re.fullmatch(r'[1-9][0-9]{0,19}', self.run_id) is not None and int(self.run_id) < 2**63, 'INVALID_INPUT')
        Journal.ensure_absent()
        socket = os.stat('/run/docker.sock', follow_symlinks=False)
        require(stat.S_ISSOCK(socket.st_mode) and socket.st_uid == 0 and not socket.st_mode & 0o002, 'STORAGE_NOT_PROVEN')
        info = strict_json(self.command(['info', '--format', '{{json .}}']).stdout)
        require(isinstance(info, dict) and info.get('DockerRootDir') == '/var/lib/docker', 'STORAGE_NOT_PROVEN')
        self.report['beforeAvailableKb'] = self.available_kb()
        self.before_runtime = self.runtime()
        self.before_images, records = self.catalog()
        self.attested_records = dict(records)
        self.initial_reserve = self.reserve(records, self.before_runtime)
        require(self.before_runtime['images'] <= set(self.before_images), 'RUNTIME_NOT_PROVEN')
        eligible = [row for identity, row in records.items() if identity not in self.initial_reserve]
        eligible.sort(key=lambda row: row['created'], reverse=True)
        self.report.update(canonicalImageCount=len(records), eligibleImageCount=len(eligible),
                           protectedImageCount=len(self.initial_reserve),
                           containerProtectedImageCount=len(self.before_runtime['images']))
        for original in eligible:
            self.runner.check()
            if self.available_kb() >= self.report['targetAvailableKb']:
                break
            self.report['attemptedImageCount'] += 1
            for _ in range(MAX_REFS + 1):
                _, rows, current, protected = self.revalidate()
                identity = original['id']
                require(identity in rows and identity not in protected, 'RESERVE_CHANGED')
                refs = image_refs(rows[identity])
                if identity in current:
                    row = current[identity]
                else:
                    require(original.get('unreferenced') is True and not refs, 'IMAGE_CHANGED')
                    labels = ((rows[identity].get('Config') or {}).get('Labels') or {})
                    require(labels.get('org.opencontainers.image.revision') == original['revision'], 'IMAGE_CHANGED')
                    row = original
                require((row['component'], row['namespace'], row['revision']) ==
                        (original['component'], original['namespace'], original['revision']), 'IMAGE_CHANGED')
                reference = refs[0] if refs else identity
                # All refs were fully classified, and the immutable image ID is
                # rechecked immediately before every single nonforce/no-prune call.
                if self.journal is None:
                    self.journal_attempted = True
                    self.journal = Journal(self.target, self.run_id)
                    self.report['journal'] = 'UNKNOWN'
                ordinal = self.report['removedReferenceCount'] + self.report['deletedImageCount'] + 1
                self.journal.intent(ordinal, identity, reference)
                result = self.command(['image', 'rm', '--no-prune', reference], check=False)
                require(result.returncode == 0, 'REMOVE_NOT_PROVEN')
                _, after, after_records, _ = self.revalidate(identity, rows[identity])
                after_refs = image_refs(after[identity]) if identity in after else ()
                self.report['removedReferenceCount'] += len(refs) - len(after_refs)
                if identity not in after:
                    self.deleted.add(identity)
                    self.report['deletedImageCount'] += 1
                    break
                # Preserve the exact permitted intermediate reference state for
                # the next complete inventory fence. No other image may drift.
                self.before_images[identity] = after[identity]
                if identity not in after_records:
                    require(not after_refs, 'IMAGE_CHANGED')
                    # Only this originally classified immutable object may be
                    # removed after its last admitted reference is gone.
                    original['unreferenced'] = True
            else:
                raise Refusal('INVENTORY_LIMIT')
        self.revalidate()
        if self.journal is None:
            Journal.ensure_absent()
        self.report['afterAvailableKb'] = self.available_kb()
        self.report['runtimeIdentityUnchanged'] = True
        self.report['objectSetsUnchanged'] = True
        self.report['reclaimedBytes'] = max(0, self.report['afterAvailableKb'] - self.report['beforeAvailableKb']) * 1024
        self.report['targetReached'] = self.report['afterAvailableKb'] >= self.report['targetAvailableKb']
        self.report['passed'] = self.report['afterAvailableKb'] >= self.report['requiredAvailableKb']
        self.report['status'] = 'VERIFIED_HEADROOM_ONLY' if self.report['passed'] else 'INSUFFICIENT_HEADROOM'
        if self.journal is not None:
            receipt = dict(self.report, journal='TERMINAL_RECEIPT_DURABLE')
            self.journal.write('receipt.json', receipt)
            self.report = receipt
        return 0 if self.report['passed'] else 2

    def run(self):
        try:
            return self.execute()
        except BaseException as error:
            code = error.code if isinstance(error, Refusal) else 'INTERNAL_NOT_PROVEN'
            self.report.update(status='UNKNOWN' if self.journal_attempted else 'REFUSED',
                               failure=code, passed=False, targetReached=False,
                               runtimeIdentityUnchanged=False, objectSetsUnchanged=False)
            if self.journal_attempted:
                self.report['journal'] = 'UNKNOWN'
            return 1
        finally:
            if self.journal is not None:
                self.journal.close()


def main():
    if len(sys.argv) != 3 or revision_re.fullmatch(sys.argv[1]) is None or re.fullmatch(r'[1-9][0-9]{0,19}', sys.argv[2]) is None:
        return 1
    recovery = Recovery(sys.argv[1], sys.argv[2])
    def interrupted(signum, frame):
        raise Refusal('DEADLINE')
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    status = recovery.run()
    output = compact(recovery.report)
    require(len(output.encode()) < 16384)
    print(output)
    return status


if __name__ == '__main__':
    raise SystemExit(main())

PY_RECLAIM
