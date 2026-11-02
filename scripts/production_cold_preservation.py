#!/usr/bin/env python3
"""Bounded local cold preservation; never starts a service or accepts a restore."""
from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
import shutil
import stat
import subprocess
import tempfile
import time
from decimal import Decimal
from pathlib import Path

MAX_ENTRIES = 100_000
MAX_DEPTH = 64
MAX_PATH_BYTES = 32 * 1024 * 1024
MAX_XATTR_BYTES = 16 * 1024 * 1024
MAX_SOURCE_BYTES = 1024 * 1024 * 1024
MAX_MANIFEST_BYTES = 128 * 1024 * 1024
MAX_ARCHIVE_BYTES = 2 * 1024 * 1024 * 1024
RESERVE_BYTES = 2 * 1024 * 1024 * 1024
SCRATCH_MARGIN_BYTES = 256 * 1024 * 1024
MANIFEST_NAME = 'pc-cold-preservation-manifest.json'
BACKUP_ROOT = '/var/lib/pc-release-authority/backups'
OPERATION_NAME = 'cold-preservation-20261022'
CHILD_ENV = {'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'LC_ALL': 'C.UTF-8'}


class PreservationError(Exception):
    """Only fixed public error codes may cross the operational boundary."""


def require(condition, code):
    if not condition:
        raise PreservationError(code)


def directory_fd(name, parent=None):
    require(hasattr(os, 'O_NOATIME'), 'NOATIME_UNAVAILABLE')
    return os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_NOATIME,
                   dir_fd=parent)


def absolute_directory(path, owner_uid=0):
    require(isinstance(path, str) and path.startswith('/'), 'DIRECTORY_PATH')
    parts = path.split('/')[1:]
    parts = [] if path == '/' else parts
    require(all(part not in ('', '.', '..') for part in parts), 'DIRECTORY_PATH')
    # Traversal reads no directory entries; only enumerated leaf descriptors need NOATIME.
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    fd = os.open('/', flags)
    try:
        for part in parts:
            info = os.fstat(fd)
            require(info.st_uid in (0, owner_uid), 'DIRECTORY_OWNER')
            require(not (stat.S_IMODE(info.st_mode) & 0o022) or
                    (info.st_uid == 0 and bool(info.st_mode & stat.S_ISVTX)), 'DIRECTORY_WRITABLE')
            child = os.open(part, flags, dir_fd=fd)
            os.close(fd)
            fd = child
        info = os.fstat(fd)
        require(info.st_uid == owner_uid and not (stat.S_IMODE(info.st_mode) & 0o022),
                'DIRECTORY_OWNER_MODE')
        leaf = directory_fd('.', fd)
        os.close(fd)
        return leaf
    except BaseException:
        os.close(fd)
        raise


def stable_stat(info):
    return (info.st_dev, info.st_ino, info.st_mode, info.st_uid, info.st_gid,
            info.st_size, info.st_mtime_ns, info.st_ctime_ns, info.st_atime_ns, info.st_nlink)


class SourceSnapshot:
    entry_limit = property(lambda self: MAX_ENTRIES)
    source_limit = property(lambda self: MAX_SOURCE_BYTES)
    path_limit = property(lambda self: MAX_PATH_BYTES)
    xattr_limit = property(lambda self: MAX_XATTR_BYTES)
    manifest_limit = property(lambda self: MAX_MANIFEST_BYTES)

    def __init__(self, root, volume_names, *, owner_uid=0, seconds=60):
        self.root = str(root)
        self.volume_names = tuple(sorted(volume_names))
        require(len(self.volume_names) == len(set(self.volume_names)) and
                all(isinstance(name, str) and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,254}', name)
                    for name in self.volume_names), 'VOLUME_IDENTITY')
        self.owner_uid = owner_uid
        self.deadline = time.monotonic() + seconds
        self.entries = {}
        self.source_bytes = self.path_bytes = self.xattr_bytes = self.discovered = 0
        self.root_fd = absolute_directory(self.root, owner_uid)
        self.device = os.fstat(self.root_fd).st_dev

    def close(self):
        if self.root_fd is not None:
            os.close(self.root_fd)
            self.root_fd = None

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()

    def _budget(self):
        require(time.monotonic() <= self.deadline, 'SOURCE_TIMEOUT')
        require(len(self.entries) < self.entry_limit, 'SOURCE_ENTRY_LIMIT')

    def _attributes(self, fd):
        result = {}
        for name in sorted(os.listxattr(fd)):
            # Extended ACL/security namespaces need a separately reviewed restoration profile.
            require(name.startswith('user.'), 'XATTR_PROFILE_UNSUPPORTED')
            value = os.getxattr(fd, name)
            self.xattr_bytes += len(name.encode('utf-8', 'surrogateescape')) + len(value)
            require(self.xattr_bytes <= self.xattr_limit, 'XATTR_LIMIT')
            result[name] = {'bytes': len(value), 'sha256': hashlib.sha256(value).hexdigest()}
        return result

    def _record(self, path, fd, before, kind, digest=None):
        require(path not in self.entries, 'DUPLICATE_SOURCE_PATH')
        self.path_bytes += len(os.fsencode(path))
        require(self.path_bytes <= self.path_limit, 'SOURCE_PATH_LIMIT')
        attributes = self._attributes(fd)
        require(stable_stat(before) == stable_stat(os.fstat(fd)), 'SOURCE_CHANGED')
        self.entries[path] = {
            'kind': kind, 'uid': before.st_uid, 'gid': before.st_gid,
            'mode': stat.S_IMODE(before.st_mode), 'mtime_ns': before.st_mtime_ns,
            'ctime_ns': before.st_ctime_ns, 'atime_ns': before.st_atime_ns,
            'device': before.st_dev, 'inode': before.st_ino, 'nlink': before.st_nlink,
            'size': before.st_size if kind == 'file' else 0,
            'sha256': digest, 'xattrs': attributes,
        }

    def _visit(self, parent, name, path, depth, descend=True, require_directory=False):
        self._budget()
        require(depth <= MAX_DEPTH and len(os.fsencode(path)) <= 4096, 'SOURCE_DEPTH_PATH')
        before = os.stat(name, dir_fd=parent, follow_symlinks=False)
        require(not require_directory or stat.S_ISDIR(before.st_mode), 'SOURCE_DIRECTORY_REQUIRED')
        require(before.st_dev == self.device, 'SOURCE_DEVICE_CHANGED')
        require(stat.S_ISDIR(before.st_mode) or stat.S_ISREG(before.st_mode),
                'SOURCE_LINK_OR_SPECIAL')
        flags = os.O_RDONLY | os.O_NOFOLLOW | os.O_NOATIME | os.O_NONBLOCK
        if stat.S_ISDIR(before.st_mode):
            flags |= os.O_DIRECTORY
        fd = os.open(name, flags, dir_fd=parent)
        try:
            require(stable_stat(before) == stable_stat(os.fstat(fd)), 'SOURCE_ENTRY_CHANGED')
            if stat.S_ISDIR(before.st_mode):
                self._record(path, fd, before, 'directory')
                if descend:
                    names = []
                    with os.scandir(fd) as iterator:
                        for item in iterator:
                            self.discovered += 1
                            require(self.discovered <= self.entry_limit, 'SOURCE_ENTRY_LIMIT')
                            names.append(item.name)
                    for child in sorted(names, key=os.fsencode):
                        self._visit(fd, child, path + '/' + child, depth + 1)
                require(stable_stat(before) == stable_stat(os.fstat(fd)), 'SOURCE_DIRECTORY_CHANGED')
            else:
                self.source_bytes += before.st_size
                require(self.source_bytes <= self.source_limit, 'SOURCE_BYTE_LIMIT')
                digest = hashlib.sha256()
                count = 0
                while True:
                    require(time.monotonic() <= self.deadline, 'SOURCE_TIMEOUT')
                    chunk = os.read(fd, 64 * 1024)
                    if not chunk:
                        break
                    count += len(chunk)
                    require(count <= before.st_size, 'SOURCE_FILE_GREW')
                    digest.update(chunk)
                require(count == before.st_size, 'SOURCE_FILE_CHANGED')
                self._record(path, fd, before, 'file', digest.hexdigest())
        finally:
            os.close(fd)

    def capture(self):
        self._visit(self.root_fd, 'containers', 'containers', 0, require_directory=True)
        self._visit(self.root_fd, 'volumes', 'volumes', 0, descend=False, require_directory=True)
        parent = directory_fd('volumes', self.root_fd)
        try:
            for name in self.volume_names:
                volume = directory_fd(name, parent)
                try:
                    data = directory_fd('_data', volume)
                    os.close(data)
                finally:
                    os.close(volume)
                self._visit(parent, name, 'volumes/' + name, 1, require_directory=True)
        finally:
            os.close(parent)
        return self

    def manifest(self):
        raw = json.dumps({'schema': 'pc.cold-preservation.manifest.v1', 'entries': self.entries},
                         sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode()
        require(len(raw) <= self.manifest_limit, 'MANIFEST_LIMIT')
        return raw


def verify_archive(handle, snapshot):
    """Verify authenticated decrypted bytes/metadata; this is not a database restore."""
    import tarfile
    manifest = snapshot.manifest()
    expected_manifest = hashlib.sha256(manifest).hexdigest()
    seen = set()
    deadline = time.monotonic() + 300
    with tarfile.open(fileobj=handle, mode='r:', encoding='utf-8', errors='surrogateescape') as archive:
        for member in archive:
            require(time.monotonic() <= deadline, 'ARCHIVE_VERIFY_TIMEOUT')
            name = member.name.rstrip('/')
            require(name not in seen, 'ARCHIVE_DUPLICATE')
            seen.add(name)
            if name == MANIFEST_NAME:
                require(member.isfile() and member.size == len(manifest) and member.mode == 0o600 and
                        member.uid == snapshot.owner_uid and member.gid == os.getegid(), 'ARCHIVE_MANIFEST')
                stream = archive.extractfile(member)
                require(stream is not None, 'ARCHIVE_MANIFEST')
                digest = hashlib.sha256()
                while chunk := stream.read(64 * 1024):
                    digest.update(chunk)
                require(digest.hexdigest() == expected_manifest, 'ARCHIVE_MANIFEST')
                continue
            expected = snapshot.entries.get(name)
            require(expected is not None and not name.startswith('/') and
                    all(part not in ('', '.', '..') for part in name.split('/')), 'ARCHIVE_PATH')
            require(member.uid == expected['uid'] and member.gid == expected['gid'] and
                    member.mode == expected['mode'], 'ARCHIVE_OWNERSHIP_MODE')
            stamp = member.pax_headers.get('mtime', str(member.mtime))
            require(Decimal(stamp) * 1_000_000_000 == expected['mtime_ns'], 'ARCHIVE_TIMESTAMP')
            attributes = {}
            for key, value in member.pax_headers.items():
                if key.startswith('SCHILY.xattr.'):
                    payload = value.encode('utf-8', 'surrogateescape')
                    attributes[key[len('SCHILY.xattr.'):]] = {
                        'bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest()}
            if member.islnk():
                target = snapshot.entries.get(member.linkname)
                require(member.linkname != name and member.linkname in seen and target is not None and
                        target['kind'] == 'file' and (target['device'], target['inode']) ==
                        (expected['device'], expected['inode']) and target['xattrs'] == expected['xattrs'],
                        'ARCHIVE_HARDLINK')
                # GNU tar stores inode xattrs on the preceding data member only.
                if not attributes:
                    attributes = target['xattrs']
            require(attributes == expected['xattrs'], 'ARCHIVE_XATTR')
            if expected['kind'] == 'directory':
                require(member.isdir(), 'ARCHIVE_TYPE')
            else:
                require(member.isfile() or member.islnk(), 'ARCHIVE_TYPE')
                stream = archive.extractfile(member)
                require(stream is not None, 'ARCHIVE_FILE')
                digest = hashlib.sha256()
                count = 0
                while chunk := stream.read(64 * 1024):
                    require(time.monotonic() <= deadline, 'ARCHIVE_VERIFY_TIMEOUT')
                    count += len(chunk)
                    require(count <= expected['size'], 'ARCHIVE_FILE_LIMIT')
                    digest.update(chunk)
                require(count == expected['size'] and digest.hexdigest() == expected['sha256'],
                        'ARCHIVE_CONTENT')
    require(seen == set(snapshot.entries) | {MANIFEST_NAME}, 'ARCHIVE_INCOMPLETE')


def child_limits(archive_limit=MAX_ARCHIVE_BYTES):
    """Linux children die with their controller and cannot exhaust the filesystem."""
    import ctypes
    import resource
    import signal
    parent = os.getppid()
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(1, signal.SIGKILL, 0, 0, 0) != 0 or os.getppid() != parent or parent == 1:
        os._exit(125)
    os.umask(0o077)
    resource.setrlimit(resource.RLIMIT_FSIZE, (archive_limit, archive_limit))
    resource.setrlimit(resource.RLIMIT_CPU, (300, 300))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))


def sync(fd):
    os.fsync(fd)


def private_file(parent, name):
    fd = os.open(name, os.O_RDWR | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=parent)
    info = os.fstat(fd)
    require(stat.S_ISREG(info.st_mode) and stat.S_IMODE(info.st_mode) == 0o600 and
            info.st_uid == os.geteuid() and info.st_nlink == 1, 'PRIVATE_FILE_IDENTITY')
    return fd


def anonymous_file(parent_path, device):
    handle = tempfile.TemporaryFile(mode='w+b', dir=parent_path)
    info = os.fstat(handle.fileno())
    require(stat.S_ISREG(info.st_mode) and stat.S_IMODE(info.st_mode) == 0o600 and
            info.st_nlink == 0 and info.st_dev == device, 'ANONYMOUS_FILE_IDENTITY')
    return handle


def gpg_arguments(home, key_fd):
    return ['/usr/bin/gpg', '--no-options', '--homedir', home, '--no-autostart', '--batch', '--no-tty',
            '--no-symkey-cache', '--pinentry-mode', 'loopback', '--passphrase-fd', str(key_fd)]


def make_encrypted_archive(snapshot, operation_fd, key_fd, archive_limit=MAX_ARCHIVE_BYTES):
    """No named plaintext: manifest/list and decrypted verification use anonymous FDs."""
    import sys
    import tarfile
    from functools import partial
    limits = partial(child_limits, archive_limit)
    operation_path = '/proc/self/fd/' + str(operation_fd)
    device = os.fstat(operation_fd).st_dev
    with anonymous_file(operation_path, device) as prefix, anonymous_file(operation_path, device) as names:
        manifest = snapshot.manifest()
        header = tarfile.TarInfo(MANIFEST_NAME)
        header.mode = 0o600
        header.uid, header.gid, header.size = snapshot.owner_uid, os.getegid(), len(manifest)
        prefix.write(header.tobuf(format=tarfile.PAX_FORMAT))
        prefix.write(manifest)
        prefix.write(b'\0' * (-len(manifest) % 512))
        prefix.seek(0)
        for path in sorted(snapshot.entries, key=os.fsencode):
            names.write(os.fsencode(path) + b'\0')
        names.seek(0)
        os.mkdir('gnupg', 0o700, dir_fd=operation_fd)
        sync(operation_fd)
        home = operation_path + '/gnupg'
        tar = ['/usr/bin/tar', '--create', '--format=posix', '--atime-preserve=system', '--sparse',
               '--acls', '--xattrs', '--numeric-owner', '--null', '--verbatim-files-from',
               '--no-recursion', '--directory', '/proc/self/fd/' + str(snapshot.root_fd),
               '--files-from', '/proc/self/fd/' + str(names.fileno())]
        # The child writes a manifest prefix, then becomes GNU tar. There is no shell.
        producer_code = ('import os,sys\nfd=int(sys.argv[1])\n'
                         'while True:\n b=os.read(fd,65536)\n if not b: break\n'
                         ' view=memoryview(b)\n while view:\n  view=view[os.write(1,view):]\n'
                         'os.close(fd)\nos.execvp(sys.argv[2],sys.argv[2:])\n')
        cipher_fd = private_file(operation_fd, 'preservation.tar.gpg')
        producer = encryptor = None
        try:
            producer = subprocess.Popen([sys.executable, '-I', '-c', producer_code,
                                         str(prefix.fileno()), *tar], stdin=subprocess.DEVNULL,
                                        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                        pass_fds=(prefix.fileno(), names.fileno(), snapshot.root_fd),
                                        preexec_fn=limits, env=CHILD_ENV)
            os.lseek(key_fd, 0, os.SEEK_SET)
            encryptor = subprocess.Popen(gpg_arguments(home, key_fd) + [
                '--symmetric', '--cipher-algo', 'AES256', '--s2k-digest-algo', 'SHA256',
                '--s2k-count', '65011712', '--compress-algo', 'none', '--output', '-'],
                stdin=producer.stdout, stdout=cipher_fd, stderr=subprocess.DEVNULL,
                                        pass_fds=(key_fd, operation_fd), preexec_fn=limits, env=CHILD_ENV)
            producer.stdout.close()
            require(encryptor.wait(timeout=300) == 0, 'ENCRYPTION_FAILED')
            require(producer.wait(timeout=30) == 0, 'ARCHIVE_PRODUCER_FAILED')
            sync(cipher_fd)
            size = os.fstat(cipher_fd).st_size
            require(0 < size <= archive_limit, 'CIPHERTEXT_SIZE')
            sync(operation_fd)
            # GPG must authenticate the complete stream before the parser sees it.
            with anonymous_file(operation_path, device) as plaintext:
                os.lseek(key_fd, 0, os.SEEK_SET)
                os.lseek(cipher_fd, 0, os.SEEK_SET)
                result = subprocess.run(gpg_arguments(home, key_fd) + ['--decrypt', '--output', '-'],
                                        stdin=cipher_fd, stdout=plaintext, stderr=subprocess.DEVNULL,
                                        pass_fds=(key_fd, operation_fd), preexec_fn=limits,
                                        timeout=300, env=CHILD_ENV)
                require(result.returncode == 0, 'ARCHIVE_AUTHENTICATION_FAILED')
                require(0 < os.fstat(plaintext.fileno()).st_size <= archive_limit,
                        'PLAINTEXT_SIZE')
                plaintext.seek(0)
                verify_archive(plaintext, snapshot)
            os.lseek(cipher_fd, 0, os.SEEK_SET)
            digest = hashlib.sha256()
            while chunk := os.read(cipher_fd, 64 * 1024):
                digest.update(chunk)
            return size, digest.hexdigest()
        finally:
            for process in (encryptor, producer):
                if process is not None and process.poll() is None:
                    process.kill()
                    process.wait(timeout=15)
            if producer is not None and producer.stdout is not None:
                producer.stdout.close()
            os.close(cipher_fd)


def no_postgres_processes():
    result = subprocess.run(['/usr/bin/ps', '-C', 'postgres,postmaster', '-o', 'pid='],
                            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                            stderr=subprocess.DEVNULL, timeout=10, env=CHILD_ENV)
    require(result.returncode in (0, 1) and len(result.stdout) <= 16384 and
            not result.stdout.strip(), 'POSTGRES_PROCESS_PRESENT_OR_UNKNOWN')


def tool_preflight():
    for name, marker in [('/usr/bin/tar', b'GNU tar'), ('/usr/bin/gpg', b'GnuPG')]:
        require(shutil.which(name) is not None, 'PRESERVATION_TOOL_UNAVAILABLE')
        result = subprocess.run([name, '--version'], stdin=subprocess.DEVNULL,
                                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=10, env=CHILD_ENV)
        require(result.returncode == 0 and len(result.stdout) <= 16384 and marker in result.stdout,
                'PRESERVATION_TOOL_UNSUPPORTED')


def preserve(host, target_sha, run_id, *, source_root='/var/lib/docker', backup_root=BACKUP_ROOT,
             owner_uid=0, runtime_probe=no_postgres_processes, tools_probe=tool_preflight):
    """Only fresh quiescent observations and a complete profile can authorize writes."""
    import fcntl
    require(os.getuid() == os.geteuid() == owner_uid and re.fullmatch('[0-9a-f]{40}', target_sha) and
            re.fullmatch('[1-9][0-9]{0,19}', run_id), 'OPERATOR_SOURCE_IDENTITY')
    baseline = host.observe()
    runtime_probe()
    tools_probe()
    volume_names = [value.decode('ascii') for value in baseline[1]]
    with SourceSnapshot(source_root, volume_names, owner_uid=owner_uid) as snapshot:
        snapshot.capture()
        # Force manifest/profile bounds before any archive/key/operation-directory write.
        snapshot.manifest()
        backup_fd = absolute_directory(backup_root, owner_uid)
        operation_fd = key_fd = None
        try:
            info = os.fstat(backup_fd)
            require(stat.S_IMODE(info.st_mode) == 0o700 and info.st_dev == snapshot.device,
                    'BACKUP_ROOT_IDENTITY')
            fcntl.flock(backup_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            try:
                os.stat(OPERATION_NAME, dir_fd=backup_fd, follow_symlinks=False)
            except FileNotFoundError:
                pass
            else:
                raise PreservationError('OPERATION_ALREADY_EXISTS_RECONCILE')
            free = os.fstatvfs(backup_fd)
            available = free.f_bavail * free.f_frsize
            require(available >= 2 * MAX_ARCHIVE_BYTES + RESERVE_BYTES + SCRATCH_MARGIN_BYTES,
                    'PRESERVATION_SPACE_INSUFFICIENT')
            require(host.observe() == baseline, 'PRE_WRITE_RUNTIME_DRIFT')
            runtime_probe()
            # All prerequisites above are read-only. An existing operation is never replayed.
            os.mkdir(OPERATION_NAME, 0o700, dir_fd=backup_fd)
            sync(backup_fd)
            operation_fd = directory_fd(OPERATION_NAME, backup_fd)
            key_fd = private_file(operation_fd, 'passphrase')
            payload = (secrets.token_urlsafe(48) + '\n').encode('ascii')
            require(os.write(key_fd, payload) == len(payload), 'KEY_WRITE_FAILED')
            sync(key_fd)
            sync(operation_fd)
            # The durable key precedes the first ciphertext byte; never remove it on failure.
            archive_bytes, cipher_sha = make_encrypted_archive(snapshot, operation_fd, key_fd)
            with SourceSnapshot(source_root, volume_names, owner_uid=owner_uid) as after:
                after.capture()
                require(snapshot.entries == after.entries, 'POST_COPY_SOURCE_DRIFT')
            runtime_probe()
            require(host.observe() == baseline, 'POST_COPY_RUNTIME_DRIFT')
            free = os.fstatvfs(backup_fd)
            require(free.f_bavail * free.f_frsize >= RESERVE_BYTES, 'POST_COPY_SPACE_RESERVE')
            report = {
                'schemaVersion': 'pc.cold-preservation.v1', 'targetSha': target_sha, 'runId': run_id,
                'passed': True, 'status': 'ENCRYPTED_COLD_PRESERVATION_VERIFIED',
                'ciphertextBytes': archive_bytes, 'ciphertextSha256': cipher_sha,
                'entries': len(snapshot.entries), 'sourceBytes': snapshot.source_bytes,
                'volumes': len(volume_names), 'sourceUnchanged': True, 'runtimeUnchanged': True,
                'runtimeRestored': False, 'databaseIntegrity': 'NOT_ATTESTED',
                'restoreVerification': 'NOT_PERFORMED', 'offHostRecovery': 'NOT_ESTABLISHED',
            }
            receipt = private_file(operation_fd, 'receipt.pending')
            try:
                raw = (json.dumps(report, separators=(',', ':')) + '\n').encode()
                require(os.write(receipt, raw) == len(raw), 'RECEIPT_WRITE_FAILED')
                sync(receipt)
            finally:
                os.close(receipt)
            sync(operation_fd)
            os.rename('receipt.pending', 'receipt.json', src_dir_fd=operation_fd, dst_dir_fd=operation_fd)
            sync(operation_fd)
            sync(backup_fd)
            return report
        finally:
            if key_fd is not None:
                os.close(key_fd)
            if operation_fd is not None:
                os.close(operation_fd)
            os.close(backup_fd)


BINDINGS_OPERATION = 'cold-bindings-preservation-20261023'
BINDINGS_ARCHIVE_BYTES = 192 * 1024 * 1024
BINDINGS_SOURCE_BYTES = 128 * 1024 * 1024
BINDINGS_ENTRIES = 4096
BINDINGS_SCHEMA = 'pc.cold-bindings-preservation.v1'


def configuration_paths(records, expected_hashes):
    """Derive private selections from exact saved records, never from CLI paths."""
    require(len(records) == len(expected_hashes) == 11, 'CONFIG_RECORD_COUNT')
    paths, compose, binds = set(), set(), []
    identities = []
    for raw in records:
        require(type(raw) is bytes and 0 < len(raw) <= 4 * 1024 * 1024, 'CONFIG_RECORD_SIZE')
        value = json.loads(raw)
        require(type(value) is dict, 'CONFIG_RECORD_SCHEMA')
        identities.append((value.get('ID'), value.get('Image'), hashlib.sha256(raw).hexdigest()))
        points = value.get('MountPoints')
        require(type(points) is dict, 'CONFIG_MOUNTS')
        for point in points.values():
            require(type(point) is dict, 'CONFIG_MOUNT')
            if point.get('Type') == 'volume':
                continue
            require(point.get('Type') == 'bind' and point.get('RW') is False,
                    'CONFIG_BIND_PROFILE')
            source = point.get('Source')
            require(type(source) is str, 'CONFIG_PATH')
            binds.append(source)
            paths.add(source)
        config = value.get('Config')
        labels = config.get('Labels') if type(config) is dict else None
        require(type(labels) is dict, 'CONFIG_LABELS')
        files = labels.get('com.docker.compose.project.config_files')
        working = labels.get('com.docker.compose.project.working_dir')
        # Unlabelled retired records add no implicit directory or guessed env file.
        if files is None and working is None:
            continue
        require(type(files) is str and 0 < len(files) <= 8192 and
                type(working) is str and 0 < len(working) <= 4096 and working.startswith('/'),
                'CONFIG_COMPOSE_LABEL')
        for name in files.split(','):
            require(name and '\0' not in name, 'CONFIG_PATH')
            path = name if name.startswith('/') else working.rstrip('/') + '/' + name
            compose.add(path)
            require(len(compose) <= 8, 'CONFIG_COMPOSE_COUNT')
            paths.add(path)
    require(tuple(sorted(identities)) == tuple(sorted(expected_hashes)), 'CONFIG_RECORD_DRIFT')
    require(len(binds) == 8 and len(compose) == 8 and 1 <= len(paths) <= 16,
            'CONFIG_SELECTION_COUNT')
    for path in paths:
        require(path.startswith('/') and len(os.fsencode(path)) <= 4096 and
                all(part not in ('', '.', '..') for part in path.split('/')[1:]) and '\0' not in path,
                'CONFIG_PATH')
        require(not any(path == prefix or path.startswith(prefix + '/') or prefix.startswith(path + '/') for prefix in
                        ('/proc', '/sys', '/dev', '/run', '/var/run', '/var/lib/docker',
                         '/var/lib/containerd', BACKUP_ROOT)), 'CONFIG_NONFILE_ENDPOINT')
    ordered = tuple(sorted(paths, key=os.fsencode))
    # Do not silently omit an overlapping root or guess how a symlink resolves.
    require(not any(other.startswith(path + '/') for path in ordered for other in ordered
                    if path != other), 'CONFIG_OVERLAPPING_ROOTS')
    return ordered, frozenset(compose)


def read_configuration_records(source_root, expected_hashes, owner_uid=0):
    records = []
    root_fd = absolute_directory(source_root, owner_uid)
    try:
        containers = directory_fd('containers', root_fd)
        try:
            for cid, _, _ in sorted(expected_hashes):
                require(type(cid) is str and re.fullmatch('[0-9a-f]{64}', cid), 'CONFIG_RECORD_ID')
                parent = directory_fd(cid, containers)
                try:
                    fd = os.open('config.v2.json', os.O_RDONLY | os.O_NOFOLLOW | os.O_NOATIME |
                                 os.O_NONBLOCK, dir_fd=parent)
                    try:
                        before = os.fstat(fd)
                        require(stat.S_ISREG(before.st_mode) and 0 < before.st_size <= 4 * 1024 * 1024,
                                'CONFIG_RECORD_SIZE')
                        raw = b''
                        while len(raw) <= before.st_size:
                            chunk = os.read(fd, min(65536, before.st_size + 1 - len(raw)))
                            if not chunk:
                                break
                            raw += chunk
                        require(len(raw) == before.st_size and stable_stat(before) == stable_stat(os.fstat(fd)),
                                'CONFIG_RECORD_DRIFT')
                        records.append(raw)
                    finally:
                        os.close(fd)
                finally:
                    os.close(parent)
        finally:
            os.close(containers)
    finally:
        os.close(root_fd)
    return records


class ConfigurationSnapshot(SourceSnapshot):
    """Same descriptor/archive verifier with a stricter, explicitly selected profile."""
    entry_limit = BINDINGS_ENTRIES
    source_limit = BINDINGS_SOURCE_BYTES
    path_limit = 4 * 1024 * 1024
    xattr_limit = 1024 * 1024
    manifest_limit = 8 * 1024 * 1024

    def __init__(self, root, selections, compose, *, owner_uid=0):
        super().__init__(root, (), owner_uid=owner_uid, seconds=30)
        self.selections, self.compose = tuple(selections), frozenset(compose)

    def capture(self):
        for path in self.selections:
            parts = path.split('/')[1:]
            require(parts and all(part not in ('', '.', '..') for part in parts), 'CONFIG_PATH')
            parent = os.dup(self.root_fd)
            try:
                for component in parts[:-1]:
                    info = os.fstat(parent)
                    require(info.st_uid == self.owner_uid and not stat.S_IMODE(info.st_mode) & 0o022,
                            'CONFIG_PARENT_OWNER_MODE')
                    child = directory_fd(component, parent)
                    os.close(parent)
                    parent = child
                info = os.fstat(parent)
                require(info.st_uid == self.owner_uid and not stat.S_IMODE(info.st_mode) & 0o022,
                        'CONFIG_PARENT_OWNER_MODE')
                item = os.stat(parts[-1], dir_fd=parent, follow_symlinks=False)
                require(item.st_uid == self.owner_uid and not stat.S_IMODE(item.st_mode) & 0o022,
                        'CONFIG_SOURCE_OWNER_MODE')
                require(path not in self.compose or stat.S_ISREG(item.st_mode), 'CONFIG_COMPOSE_TYPE')
                self._visit(parent, parts[-1], '/'.join(parts), 0)
            finally:
                os.close(parent)
        return self


def preserve_bindings(host, target_sha, run_id, *, source_root='/var/lib/docker',
                      filesystem_root='/', backup_root=BACKUP_ROOT, owner_uid=0,
                      runtime_probe=no_postgres_processes, tools_probe=tool_preflight):
    """Preserve supported file/dir bindings; unsupported endpoints block before writes."""
    import fcntl
    require(os.getuid() == os.geteuid() == owner_uid and re.fullmatch('[0-9a-f]{40}', target_sha) and
            re.fullmatch('[1-9][0-9]{0,19}', run_id), 'OPERATOR_SOURCE_IDENTITY')
    baseline = host.observe()
    runtime_probe()
    tools_probe()
    raw = read_configuration_records(source_root, baseline[0], owner_uid)
    selections, compose = configuration_paths(raw, baseline[0])
    with ConfigurationSnapshot(filesystem_root, selections, compose, owner_uid=owner_uid) as snapshot:
        snapshot.capture()
        snapshot.manifest()
        backup_fd = absolute_directory(backup_root, owner_uid)
        operation_fd = key_fd = None
        try:
            info = os.fstat(backup_fd)
            require(stat.S_IMODE(info.st_mode) == 0o700 and info.st_dev == snapshot.device,
                    'BACKUP_ROOT_IDENTITY')
            fcntl.flock(backup_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            # Never open, alter, decrypt or remove the original cold copy or its key.
            try:
                os.stat(BINDINGS_OPERATION, dir_fd=backup_fd, follow_symlinks=False)
            except FileNotFoundError:
                pass
            else:
                raise PreservationError('OPERATION_ALREADY_EXISTS_RECONCILE')
            free = os.fstatvfs(backup_fd)
            require(free.f_bavail * free.f_frsize >=
                    2 * BINDINGS_ARCHIVE_BYTES + RESERVE_BYTES + SCRATCH_MARGIN_BYTES,
                    'PRESERVATION_SPACE_INSUFFICIENT')
            require(host.observe() == baseline, 'PRE_WRITE_RUNTIME_DRIFT')
            runtime_probe()
            os.mkdir(BINDINGS_OPERATION, 0o700, dir_fd=backup_fd)
            sync(backup_fd)
            operation_fd = directory_fd(BINDINGS_OPERATION, backup_fd)
            key_fd = private_file(operation_fd, 'passphrase')
            payload = (secrets.token_urlsafe(48) + '\n').encode('ascii')
            require(os.write(key_fd, payload) == len(payload), 'KEY_WRITE_FAILED')
            sync(key_fd)
            sync(operation_fd)
            size, digest = make_encrypted_archive(snapshot, operation_fd, key_fd, BINDINGS_ARCHIVE_BYTES)
            require(configuration_paths(read_configuration_records(source_root, baseline[0], owner_uid),
                                        baseline[0]) == (selections, compose), 'CONFIG_RECORD_DRIFT')
            with ConfigurationSnapshot(filesystem_root, selections, compose, owner_uid=owner_uid) as after:
                after.capture()
                require(snapshot.entries == after.entries, 'POST_COPY_SOURCE_DRIFT')
            runtime_probe()
            require(host.observe() == baseline, 'POST_COPY_RUNTIME_DRIFT')
            free = os.fstatvfs(backup_fd)
            require(free.f_bavail * free.f_frsize >= RESERVE_BYTES, 'POST_COPY_SPACE_RESERVE')
            report = {'schemaVersion': BINDINGS_SCHEMA, 'targetSha': target_sha, 'runId': run_id,
                      'passed': True, 'status': 'ENCRYPTED_BINDINGS_PRESERVATION_VERIFIED',
                      'ciphertextBytes': size, 'ciphertextSha256': digest,
                      'entries': len(snapshot.entries), 'sourceBytes': snapshot.source_bytes,
                      'selectedRoots': len(selections), 'bindReferences': 8, 'composeFiles': 8,
                      'sourceUnchanged': True, 'runtimeUnchanged': True, 'runtimeRestored': False,
                      'startupAuthorized': False, 'databaseIntegrity': 'NOT_ATTESTED',
                      'currentComposeParity': 'NOT_ATTESTED', 'environmentFilesCovered': False,
                      'restoreVerification': 'NOT_PERFORMED', 'offHostRecovery': 'NOT_ESTABLISHED'}
            receipt = private_file(operation_fd, 'receipt.pending')
            try:
                data = (json.dumps(report, separators=(',', ':')) + '\n').encode()
                require(os.write(receipt, data) == len(data), 'RECEIPT_WRITE_FAILED')
                sync(receipt)
            finally:
                os.close(receipt)
            sync(operation_fd)
            os.rename('receipt.pending', 'receipt.json', src_dir_fd=operation_fd, dst_dir_fd=operation_fd)
            sync(operation_fd)
            sync(backup_fd)
            return report
        finally:
            if key_fd is not None:
                os.close(key_fd)
            if operation_fd is not None:
                os.close(operation_fd)
            os.close(backup_fd)


def main():
    import argparse
    from production_stopped_runtime_headroom import Host, RecoveryError
    parser = argparse.ArgumentParser()
    parser.add_argument('--sha', required=True)
    parser.add_argument('--run-id', required=True)
    parser.add_argument('--execute', action='store_true', required=True)
    parser.add_argument('--bindings', action='store_true')
    args = parser.parse_args()
    try:
        result = (preserve_bindings if args.bindings else preserve)(Host(), args.sha, args.run_id)
        print(json.dumps(result, separators=(',', ':')), flush=True)
        return 0
    except Exception as error:
        code = str(error) if isinstance(error, (PreservationError, RecoveryError)) else 'UNCLASSIFIED_FAILURE'
        if not re.fullmatch('[A-Z_]{1,64}', code):
            code = 'UNCLASSIFIED_FAILURE'
        print(json.dumps({'schemaVersion': BINDINGS_SCHEMA if args.bindings else 'pc.cold-preservation.v1', 'passed': False,
                          'errorCode': code, 'runtimeRestored': False,
                          'mutationOutcome': 'RECONCILIATION_REQUIRED_IF_STARTED'}, separators=(',', ':')),
              flush=True)
        return 1


def validate_terminal(raw, target_sha, run_id, ssh_status):
    """The runner publishes only this closed vocabulary after transport/source binding."""
    require(isinstance(raw, bytes) and 0 < len(raw) <= 16384, 'OUTPUT_LIMIT')
    value = json.loads(raw)
    require(isinstance(value, dict), 'OUTPUT_SCHEMA')
    failed = {'schemaVersion', 'passed', 'errorCode', 'runtimeRestored', 'mutationOutcome'}
    final = {'schemaVersion', 'targetSha', 'runId', 'passed', 'status', 'ciphertextBytes',
             'ciphertextSha256', 'entries', 'sourceBytes', 'volumes', 'sourceUnchanged',
             'runtimeUnchanged', 'runtimeRestored', 'databaseIntegrity', 'restoreVerification',
             'offHostRecovery'}
    require(set(value) in (failed, final) and value.get('schemaVersion') == 'pc.cold-preservation.v1'
            and value.get('runtimeRestored') is False and type(value.get('passed')) is bool,
            'OUTPUT_SCHEMA')
    if set(value) == failed:
        require(value['passed'] is False and isinstance(value['errorCode'], str) and
                re.fullmatch('[A-Z_]{1,64}', value['errorCode']) and
                value['mutationOutcome'] == 'RECONCILIATION_REQUIRED_IF_STARTED' and ssh_status == 1,
                'FAILURE_OR_TRANSPORT_SCHEMA')
    else:
        require(value['targetSha'] == target_sha and value['runId'] == run_id and
                value['passed'] is True and ssh_status == 0 and
                value['status'] == 'ENCRYPTED_COLD_PRESERVATION_VERIFIED' and
                value['sourceUnchanged'] is True and value['runtimeUnchanged'] is True and
                value['databaseIntegrity'] == 'NOT_ATTESTED' and
                value['restoreVerification'] == 'NOT_PERFORMED' and
                value['offHostRecovery'] == 'NOT_ESTABLISHED', 'RESULT_INVARIANT_SCHEMA')
        for key, minimum, maximum in [('ciphertextBytes', 1, MAX_ARCHIVE_BYTES),
                                      ('entries', 1, MAX_ENTRIES),
                                      ('sourceBytes', 0, MAX_SOURCE_BYTES), ('volumes', 19, 19)]:
            require(type(value[key]) is int and minimum <= value[key] <= maximum, 'RESULT_COUNT_SCHEMA')
        require(isinstance(value['ciphertextSha256'], str) and
                re.fullmatch('[0-9a-f]{64}', value['ciphertextSha256']), 'RESULT_DIGEST_SCHEMA')
    return value


def validate_bindings_terminal(raw, target_sha, run_id, ssh_status):
    require(type(raw) is bytes and 0 < len(raw) <= 16384, 'OUTPUT_LIMIT')
    def closed_object(pairs):
        require(len(pairs) == len(dict(pairs)), 'OUTPUT_DUPLICATE')
        return dict(pairs)
    value = json.loads(raw, object_pairs_hook=closed_object)
    require(type(value) is dict, 'OUTPUT_SCHEMA')
    failed = {'schemaVersion', 'passed', 'errorCode', 'runtimeRestored', 'mutationOutcome'}
    final = {'schemaVersion', 'targetSha', 'runId', 'passed', 'status', 'ciphertextBytes',
             'ciphertextSha256', 'entries', 'sourceBytes', 'selectedRoots', 'bindReferences',
             'composeFiles', 'sourceUnchanged', 'runtimeUnchanged', 'runtimeRestored',
             'startupAuthorized', 'databaseIntegrity', 'currentComposeParity',
             'environmentFilesCovered', 'restoreVerification', 'offHostRecovery'}
    require(set(value) in (failed, final) and value.get('schemaVersion') == BINDINGS_SCHEMA and
            value.get('runtimeRestored') is False and type(value.get('passed')) is bool,
            'OUTPUT_SCHEMA')
    if set(value) == failed:
        require(value['passed'] is False and type(value['errorCode']) is str and
                re.fullmatch('[A-Z_]{1,64}', value['errorCode']) and
                value['mutationOutcome'] == 'RECONCILIATION_REQUIRED_IF_STARTED' and ssh_status == 1,
                'FAILURE_OR_TRANSPORT_SCHEMA')
    else:
        require(value['targetSha'] == target_sha and value['runId'] == run_id and
                value['passed'] is True and ssh_status == 0 and
                value['status'] == 'ENCRYPTED_BINDINGS_PRESERVATION_VERIFIED' and
                value['sourceUnchanged'] is True and value['runtimeUnchanged'] is True and
                value['startupAuthorized'] is False and value['environmentFilesCovered'] is False and
                value['databaseIntegrity'] == value['currentComposeParity'] == 'NOT_ATTESTED' and
                value['restoreVerification'] == 'NOT_PERFORMED' and
                value['offHostRecovery'] == 'NOT_ESTABLISHED', 'RESULT_INVARIANT_SCHEMA')
        for key, minimum, maximum in [('ciphertextBytes', 1, BINDINGS_ARCHIVE_BYTES),
                                      ('entries', 1, BINDINGS_ENTRIES),
                                      ('sourceBytes', 0, BINDINGS_SOURCE_BYTES),
                                      ('selectedRoots', 8, 16), ('bindReferences', 8, 8), ('composeFiles', 8, 8)]:
            require(type(value[key]) is int and minimum <= value[key] <= maximum, 'RESULT_COUNT_SCHEMA')
        require(type(value['ciphertextSha256']) is str and
                re.fullmatch('[0-9a-f]{64}', value['ciphertextSha256']), 'RESULT_DIGEST_SCHEMA')
    return value


if __name__ == '__main__':
    raise SystemExit(main())
