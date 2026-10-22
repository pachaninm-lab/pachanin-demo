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
    require(parts and all(part not in ('', '.', '..') for part in parts), 'DIRECTORY_PATH')
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
        require(len(self.entries) < MAX_ENTRIES, 'SOURCE_ENTRY_LIMIT')

    def _attributes(self, fd):
        result = {}
        for name in sorted(os.listxattr(fd)):
            # Extended ACL/security namespaces need a separately reviewed restoration profile.
            require(name.startswith('user.'), 'XATTR_PROFILE_UNSUPPORTED')
            value = os.getxattr(fd, name)
            self.xattr_bytes += len(name.encode('utf-8', 'surrogateescape')) + len(value)
            require(self.xattr_bytes <= MAX_XATTR_BYTES, 'XATTR_LIMIT')
            result[name] = {'bytes': len(value), 'sha256': hashlib.sha256(value).hexdigest()}
        return result

    def _record(self, path, fd, before, kind, digest=None):
        require(path not in self.entries, 'DUPLICATE_SOURCE_PATH')
        self.path_bytes += len(os.fsencode(path))
        require(self.path_bytes <= MAX_PATH_BYTES, 'SOURCE_PATH_LIMIT')
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
                            require(self.discovered <= MAX_ENTRIES, 'SOURCE_ENTRY_LIMIT')
                            names.append(item.name)
                    for child in sorted(names, key=os.fsencode):
                        self._visit(fd, child, path + '/' + child, depth + 1)
                require(stable_stat(before) == stable_stat(os.fstat(fd)), 'SOURCE_DIRECTORY_CHANGED')
            else:
                self.source_bytes += before.st_size
                require(self.source_bytes <= MAX_SOURCE_BYTES, 'SOURCE_BYTE_LIMIT')
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
        require(len(raw) <= MAX_MANIFEST_BYTES, 'MANIFEST_LIMIT')
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


def child_limits():
    """Linux children die with their controller and cannot exhaust the filesystem."""
    import ctypes
    import resource
    import signal
    parent = os.getppid()
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(1, signal.SIGKILL, 0, 0, 0) != 0 or os.getppid() != parent or parent == 1:
        os._exit(125)
    os.umask(0o077)
    resource.setrlimit(resource.RLIMIT_FSIZE, (MAX_ARCHIVE_BYTES, MAX_ARCHIVE_BYTES))
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


def make_encrypted_archive(snapshot, operation_fd, key_fd):
    """No named plaintext: manifest/list and decrypted verification use anonymous FDs."""
    import sys
    import tarfile
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
                                        preexec_fn=child_limits, env=CHILD_ENV)
            os.lseek(key_fd, 0, os.SEEK_SET)
            encryptor = subprocess.Popen(gpg_arguments(home, key_fd) + [
                '--symmetric', '--cipher-algo', 'AES256', '--s2k-digest-algo', 'SHA256',
                '--s2k-count', '65011712', '--compress-algo', 'none', '--output', '-'],
                stdin=producer.stdout, stdout=cipher_fd, stderr=subprocess.DEVNULL,
                pass_fds=(key_fd, operation_fd), preexec_fn=child_limits, env=CHILD_ENV)
            producer.stdout.close()
            require(encryptor.wait(timeout=300) == 0, 'ENCRYPTION_FAILED')
            require(producer.wait(timeout=30) == 0, 'ARCHIVE_PRODUCER_FAILED')
            sync(cipher_fd)
            size = os.fstat(cipher_fd).st_size
            require(0 < size <= MAX_ARCHIVE_BYTES, 'CIPHERTEXT_SIZE')
            sync(operation_fd)
            # GPG must authenticate the complete stream before the parser sees it.
            with anonymous_file(operation_path, device) as plaintext:
                os.lseek(key_fd, 0, os.SEEK_SET)
                os.lseek(cipher_fd, 0, os.SEEK_SET)
                result = subprocess.run(gpg_arguments(home, key_fd) + ['--decrypt', '--output', '-'],
                                        stdin=cipher_fd, stdout=plaintext, stderr=subprocess.DEVNULL,
                                        pass_fds=(key_fd, operation_fd), preexec_fn=child_limits,
                                        timeout=300, env=CHILD_ENV)
                require(result.returncode == 0, 'ARCHIVE_AUTHENTICATION_FAILED')
                require(0 < os.fstat(plaintext.fileno()).st_size <= MAX_ARCHIVE_BYTES,
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


def main():
    import argparse
    from production_stopped_runtime_headroom import Host, RecoveryError
    parser = argparse.ArgumentParser()
    parser.add_argument('--sha', required=True)
    parser.add_argument('--run-id', required=True)
    parser.add_argument('--execute', action='store_true', required=True)
    args = parser.parse_args()
    try:
        result = preserve(Host(), args.sha, args.run_id)
        print(json.dumps(result, separators=(',', ':')), flush=True)
        return 0
    except Exception as error:
        code = str(error) if isinstance(error, (PreservationError, RecoveryError)) else 'UNCLASSIFIED_FAILURE'
        if not re.fullmatch('[A-Z_]{1,64}', code):
            code = 'UNCLASSIFIED_FAILURE'
        print(json.dumps({'schemaVersion': 'pc.cold-preservation.v1', 'passed': False,
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


if __name__ == '__main__':
    raise SystemExit(main())
