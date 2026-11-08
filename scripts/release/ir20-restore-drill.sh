#!/usr/bin/env bash
# Separate stopped-source mode: no release route or production invocation is added.
if [[ "${1:-}" == --stopped ]]; then
  [[ $# == 3 ]] || { printf 'IR20_STOPPED_ERROR=ARGUMENTS\n' >&2; exit 2; }
  ir20_source_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  python3 -I - "$2" "$3" "$ir20_source_root" <<'PY_STOPPED_SOURCE'
"""IR20 stopped-source physical-copy prerequisite, embedded in the existing executor."""
import hashlib
import io
import json
import os
from pathlib import Path
import re
import secrets
import signal
import stat
import subprocess
import sys
import tarfile
import time
from decimal import Decimal
from contextlib import contextmanager

SCHEMA = 'pc.ir20-stopped-copy.v1'
PG_IMAGE = 'sha256:33f923b05f64ca54ac4401c01126a6b92afe839a0aa0a52bc5aeb5cc958e5f20'
PG_UID = PG_GID = 999
DATA = '/var/lib/postgresql/data'
TMPFS_BYTES = 512 * 1024 * 1024
SOURCE_BYTES = 384 * 1024 * 1024
LABEL = 'pc-crop.ir20-stopped-copy'
OPERATION = 'ir20-stopped-copy-20261023'
DOCKER = ['docker', '--host', 'unix:///var/run/docker.sock']
ENV = {'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'LC_ALL': 'C.UTF-8'}
DEPENDENCIES = {
    'production_stopped_runtime_headroom': '6b121fad2c380a8425f1ca6024e1740406f26172295c215e01bbe0f200768c14',
    'production_cold_preservation': '19c873694debb0076701a912b394aad6bb0e092947f04d97e5144320ca5ca832',
}
PRESERVED_CIPHERS = (
    ('cold-preservation-20261022', '800264a1819ba26869e4b79d1f6874dc5078aa982ab333fdd999629f6b490603'),
    ('cold-bindings-preservation-20261023', 'e1a618c49c2ba10498e17f8a139272412bd1055a28de0d42ee639a5187bc6e8c'),
)


class StoppedCopyError(Exception):
    """Only fixed codes may leave this process."""


def check(ok, code):
    if not ok:
        raise StoppedCopyError(code)


def dependencies(root):
    # An admitted transport may preload these exact accepted module bytes in memory.
    # The local shell path is computed from this executor, never supplied as a CLI path.
    import types
    for name, expected in DEPENDENCIES.items():
        module = sys.modules.get(name)
        if module is not None:
            check(getattr(module, '__ir20_accepted_sha256__', None) == expected, 'DEPENDENCY_BINDING')
            continue
        path = Path(root) / 'scripts' / (name + '.py')
        info = path.lstat()
        check(stat.S_ISREG(info.st_mode) and not path.is_symlink() and
              0 < info.st_size <= 200000, 'DEPENDENCY_PROFILE')
        raw = path.read_bytes()
        check(hashlib.sha256(raw).hexdigest() == expected, 'DEPENDENCY_BINDING')
        module = types.ModuleType(name)
        module.__file__ = str(path)
        module.__ir20_accepted_sha256__ = expected
        sys.modules[name] = module
        exec(compile(raw, '<accepted-ir20-dependency>', 'exec'), module.__dict__)
    return sys.modules['production_cold_preservation'], sys.modules['production_stopped_runtime_headroom']


def selected_postgres(records, expected):
    check(len(records) == len(expected) == 11, 'SOURCE_RECORD_COUNT')
    identities, selected = [], []
    for raw in records:
        value = json.loads(raw)
        check(type(value) is dict, 'SOURCE_RECORD_SCHEMA')
        identities.append((value.get('ID'), value.get('Image'), hashlib.sha256(raw).hexdigest()))
        if value.get('Image') != PG_IMAGE:
            continue
        config = value.get('Config')
        check(type(config) is dict and type(config.get('Env')) is list, 'POSTGRES_CONFIG')
        env = {}
        for item in config['Env']:
            check(type(item) is str and '=' in item, 'POSTGRES_ENV')
            key, value_text = item.split('=', 1)
            check(key not in env, 'POSTGRES_ENV_DUPLICATE')
            env[key] = value_text
        check(env.get('PG_MAJOR') == '16' and env.get('PGDATA', DATA) == DATA, 'POSTGRES_DATA_PROFILE')
        for key in ('POSTGRES_USER', 'POSTGRES_DB'):
            check(re.fullmatch(r'[A-Za-z_][A-Za-z0-9_-]{0,62}', env.get(key, '')) is not None,
                  'POSTGRES_PRINCIPAL_PROFILE')
        mounts = value.get('MountPoints')
        check(type(mounts) is dict, 'POSTGRES_MOUNTS')
        candidates = [m for m in mounts.values() if type(m) is dict and m.get('Destination') == DATA]
        check(len(candidates) == 1 and candidates[0].get('Type') == 'volume' and
              candidates[0].get('RW') is True, 'POSTGRES_VOLUME_PROFILE')
        name = candidates[0].get('Name')
        check(type(name) is str and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,254}', name) is not None,
              'POSTGRES_VOLUME_IDENTITY')
        selected.append({'volume': name, 'user': env['POSTGRES_USER'], 'database': env['POSTGRES_DB']})
    check(tuple(sorted(identities)) == tuple(sorted(expected)), 'SOURCE_RECORD_DRIFT')
    check(len(selected) == 1, 'POSTGRES_SOURCE_AMBIGUOUS')
    return selected[0]


def pg_snapshot(cold, root, volume):
    class Snapshot(cold.SourceSnapshot):
        entry_limit = 20000
        source_limit = SOURCE_BYTES
        path_limit = 4 * 1024 * 1024
        xattr_limit = 1024
        manifest_limit = 8 * 1024 * 1024

        def capture(self):
            parent = cold.directory_fd('volumes', self.root_fd)
            try:
                self.volume_fd = cold.directory_fd(volume, parent)
                try:
                    self._visit(self.volume_fd, '_data', 'data', 0, require_directory=True)
                finally:
                    os.close(self.volume_fd)
            finally:
                os.close(parent)
            return self

    return Snapshot(root, (volume,), seconds=45)


def validate_snapshot(snapshot):
    check('data/PG_VERSION' in snapshot.entries and 'data/global/pg_control' in snapshot.entries and
          'data/base' in snapshot.entries and 'data/pg_wal' in snapshot.entries, 'POSTGRES_CLUSTER_INCOMPLETE')
    check(not any('data/' + name in snapshot.entries for name in
                  ('recovery.signal', 'standby.signal', 'backup_label', 'tablespace_map')),
          'POSTGRES_RECOVERY_PROFILE_UNSUPPORTED')
    for name, entry in snapshot.entries.items():
        check(re.fullmatch(r'data(?:/[A-Za-z0-9_.-]+)*', name) is not None, 'POSTGRES_PATH_PROFILE')
        check(entry['uid'] == PG_UID and entry['gid'] == PG_GID and not entry['mode'] & 0o7027,
              'POSTGRES_OWNERSHIP_MODE')
        check(entry['mode'] in ((0o700, 0o750) if entry['kind'] == 'directory' else (0o600, 0o640)),
              'POSTGRES_MODE_PROFILE')
        check(not entry['xattrs'] and (entry['kind'] == 'directory' or entry['nlink'] == 1),
              'POSTGRES_METADATA_PROFILE')
    check(snapshot.entries['data']['mode'] in (0o700, 0o750), 'POSTGRES_ROOT_MODE')
    check(snapshot.entries['data/PG_VERSION']['sha256'] == hashlib.sha256(b'16\n').hexdigest(),
          'POSTGRES_MAJOR')
    snapshot.manifest()


def archive_verification(raw, entries):
    check(len(raw) <= TMPFS_BYTES + 32 * 1024 * 1024, 'CLONE_ARCHIVE_LIMIT')
    expected = {('.' if name == 'data' else name[5:]): value for name, value in entries.items()}
    seen = set()
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:') as archive:
        for member in archive:
            name = member.name
            check(name in expected and name not in seen, 'CLONE_ARCHIVE_PATH')
            seen.add(name)
            value = expected[name]
            check((member.isdir() and value['kind'] == 'directory') or
                  (member.isreg() and value['kind'] == 'file'), 'CLONE_ARCHIVE_TYPE')
            check((member.uid, member.gid, member.mode) == (value['uid'], value['gid'], value['mode']),
                  'CLONE_ARCHIVE_METADATA')
            check(int(Decimal(member.pax_headers.get('mtime', str(member.mtime))) * 1000000000) == value['mtime_ns'],
                  'CLONE_ARCHIVE_MTIME')
            if member.isreg():
                check(member.size == value['size'], 'CLONE_ARCHIVE_SIZE')
                handle = archive.extractfile(member)
                digest = hashlib.sha256()
                size = 0
                while True:
                    chunk = handle.read(65536)
                    if not chunk:
                        break
                    digest.update(chunk)
                    size += len(chunk)
                check(size == value['size'] and digest.hexdigest() == value['sha256'], 'CLONE_ARCHIVE_CONTENT')
    check(seen == set(expected), 'CLONE_ARCHIVE_INCOMPLETE')


class DockerCopy:
    def __init__(self, sha, run_id):
        self.token = secrets.token_hex(16)
        self.name = 'pc-ir20-stopped-' + self.token
        self.identity = sha + ':' + run_id + ':' + self.token
        self.container_id = None
        self.create_attempted = False
        self.deadline = time.monotonic() + 600
        self.cleanup_deadline = None
        self.tmpfs = None

    def remaining(self, seconds):
        remaining = self.deadline - time.monotonic()
        check(remaining > 0, 'OPERATION_DEADLINE')
        return min(seconds, remaining)

    def wait_for(self, process, seconds):
        return process.wait(timeout=self.remaining(seconds))

    def begin_cleanup(self):
        if self.cleanup_deadline is None:
            self.cleanup_deadline = time.monotonic() + 60
        self.deadline = self.cleanup_deadline

    def command(self, args, *, data=None, limit=1024 * 1024, seconds=120, allowed_failure=False):
        result = subprocess.run(DOCKER + args, input=data, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                timeout=self.remaining(seconds), env=ENV)
        check(len(result.stdout) <= limit, 'DOCKER_OUTPUT_LIMIT')
        check(allowed_failure or result.returncode == 0, 'OWNED_DOCKER_COMMAND')
        return result

    def create(self, user, database, mode):
        self.tmpfs = {
            DATA: 'rw,nosuid,nodev,noexec,uid=999,gid=999,mode=' + format(mode, 'o') + ',size=536870912',
            '/var/run/postgresql': 'rw,nosuid,nodev,noexec,uid=999,gid=999,size=16777216',
            '/tmp': 'rw,nosuid,nodev,noexec,size=16777216',
        }
        self.create_attempted = True
        args = ['create', '--pull=never', '--name', self.name, '--label', LABEL + '=' + self.identity,
                '--network', 'none', '--read-only', '--user', '999:999', '--cap-drop', 'ALL',
                '--security-opt', 'no-new-privileges', '--memory', '768m', '--memory-swap', '768m',
                '--cpus', '1', '--pids-limit', '128', '--restart', 'no', '--log-driver', 'none',
                '--tmpfs', DATA + ':' + self.tmpfs[DATA],
                '--tmpfs', '/var/run/postgresql:' + self.tmpfs['/var/run/postgresql'],
                '--tmpfs', '/tmp:' + self.tmpfs['/tmp'],
                '-e', 'POSTGRES_USER=' + user, '-e', 'POSTGRES_DB=' + database,
                '--entrypoint', '/bin/sleep', PG_IMAGE, '900']
        identifier = self.command(args).stdout.decode('ascii').strip()
        check(re.fullmatch('[0-9a-f]{64}', identifier) is not None, 'OWNED_CREATE_IDENTITY')
        self.container_id = identifier
        self.validate_isolation()
        self.command(['start', identifier])

    def inspection(self, target):
        rows = json.loads(self.command(['container', 'inspect', target]).stdout)
        check(type(rows) is list and len(rows) == 1 and type(rows[0]) is dict, 'OWNED_INSPECTION')
        return rows[0]

    def validate_isolation(self):
        row = self.inspection(self.container_id)
        host, config = row.get('HostConfig', {}), row.get('Config', {})
        check(row.get('Id') == self.container_id and row.get('Image') == PG_IMAGE and
              config.get('Labels', {}).get(LABEL) == self.identity and config.get('User') == '999:999',
              'OWNED_CONTAINER_IDENTITY')
        check(host.get('NetworkMode') == 'none' and host.get('ReadonlyRootfs') is True and
              host.get('Privileged') is False and not any(host.get(k) for k in
              ('Binds', 'Mounts', 'PortBindings', 'Devices', 'DeviceRequests', 'CapAdd', 'VolumesFrom')),
              'OWNED_CONTAINER_ISOLATION')
        check(self.tmpfs is not None and host.get('Tmpfs') == self.tmpfs and
              {mount.get('Destination') for mount in row.get('Mounts', [])} <= {DATA, '/var/run/postgresql', '/tmp'} and
              all(mount.get('Type') == 'tmpfs' for mount in row.get('Mounts', [])), 'OWNED_CONTAINER_MOUNTS')
        check(host.get('PidMode', '') in ('', 'private') and host.get('UTSMode', '') in ('', 'private') and
              host.get('IpcMode', '') in ('', 'private', 'shareable'), 'OWNED_CONTAINER_NAMESPACES')
        check(host.get('Memory') == host.get('MemorySwap') == 805306368 and host.get('NanoCpus') == 1000000000 and
              host.get('PidsLimit') == 128 and 'ALL' in host.get('CapDrop', []) and
              'no-new-privileges' in host.get('SecurityOpt', []) and
              host.get('RestartPolicy', {}).get('Name') == 'no' and host.get('LogConfig', {}).get('Type') == 'none',
              'OWNED_CONTAINER_LIMITS')
        check(row.get('State', {}).get('Running') is False, 'OWNED_CONTAINER_PRESTART')

    def execute(self, args, **kwargs):
        check(self.container_id is not None, 'OWNED_ID_REQUIRED')
        return self.command(['exec', '-i', self.container_id] + args, **kwargs)

    def transfer(self, snapshot, volume, cold):
        self.remaining(120)
        # Both lists are complete frozen descriptor-derived selections, never recursive guesses.
        names = b'\0'.join(('_data' + name[4:]).encode() for name in snapshot.entries) + b'\0'
        parent = cold.directory_fd('volumes', snapshot.root_fd)
        volume_fd = None
        source = destination = None
        try:
            volume_fd = cold.directory_fd(volume, parent)
            listing = os.memfd_create('ir20-private-source-list', os.MFD_CLOEXEC)
            try:
                check(os.write(listing, names) == len(names), 'SOURCE_LIST_WRITE')
                os.lseek(listing, 0, os.SEEK_SET)
                args = ['tar', '--format=pax', '--numeric-owner', '--atime-preserve=system', '--no-recursion',
                        '--null', '--verbatim-files-from', '-C', '/proc/self/fd/' + str(volume_fd),
                        '-T', '/proc/self/fd/' + str(listing), '-cf', '-']
                source = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                          pass_fds=(volume_fd, listing), env=ENV)
                destination = subprocess.Popen(DOCKER + ['exec', '-i', self.container_id, 'tar',
                    '--no-same-owner', '--same-permissions', '--strip-components=1', '-xf', '-', '-C', DATA],
                    stdin=source.stdout, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=ENV)
                source.stdout.close()
                check(self.wait_for(destination, 120) == 0 and self.wait_for(source, 15) == 0,
                      'PHYSICAL_COPY_FAILED')
            finally:
                os.close(listing)
        finally:
            for process in (source, destination):
                if process is not None and process.poll() is None:
                    self.begin_cleanup()
                    process.kill()
                    self.wait_for(process, 15)
            if volume_fd is not None:
                os.close(volume_fd)
            os.close(parent)
        clone_names = b'\0'.join(('.' if name == 'data' else name[5:]).encode() for name in snapshot.entries) + b'\0'
        root_mtime = format(Decimal(snapshot.entries['data']['mtime_ns']) / Decimal(1000000000), 'f')
        self.execute(['touch', '-m', '-d', '@' + root_mtime, DATA])
        result = self.execute(['tar', '--format=pax', '--numeric-owner', '--atime-preserve=system',
                               '--no-recursion', '--null', '--verbatim-files-from', '-C', DATA, '-T', '-', '-cf', '-'],
                              data=clone_names, limit=TMPFS_BYTES + 32 * 1024 * 1024)
        archive_verification(result.stdout, snapshot.entries)

    def recover(self, user, database):
        # Modify only the byte-verified volatile clone, never a source/configuration mount.
        setup = b'''umask 077
cd /var/lib/postgresql/data
rm -f -- postmaster.pid postmaster.opts
: > postgresql.auto.conf
cat > /tmp/pc-ir20-postgresql.conf <<'CONF'
listen_addresses = ''
unix_socket_directories = '/var/run/postgresql'
hba_file = '/tmp/pc-ir20-pg_hba.conf'
ident_file = '/tmp/pc-ir20-pg_ident.conf'
shared_preload_libraries = ''
session_preload_libraries = ''
local_preload_libraries = ''
archive_mode = off
archive_command = ''
archive_library = ''
restore_command = ''
primary_conninfo = ''
primary_slot_name = ''
ssl = off
logging_collector = off
autovacuum = off
max_worker_processes = 0
max_parallel_workers = 0
max_wal_senders = 0
max_replication_slots = 0
max_connections = 20
shared_buffers = '32MB'
work_mem = '4MB'
temp_file_limit = '128MB'
default_transaction_read_only = on
CONF
printf 'local all all trust\\n' > /tmp/pc-ir20-pg_hba.conf
: > /tmp/pc-ir20-pg_ident.conf
'''
        self.execute(['/bin/sh', '-eu'], data=setup)
        self.execute(['pg_ctl', '-D', DATA, '-l', '/tmp/pc-ir20-private-postgres.log', '-w', '-t', '60',
                      '-o', '-c config_file=/tmp/pc-ir20-postgresql.conf', 'start'], seconds=75)
        result = self.execute(['psql', '-h', '/var/run/postgresql', '-XqAt', '-w', '-v', 'ON_ERROR_STOP=1',
                               '-U', user, '-d', database], data=b"BEGIN READ ONLY; SELECT current_setting('server_version_num')::int BETWEEN 160000 AND 169999 AND NOT pg_is_in_recovery() AND (SELECT rolsuper FROM pg_roles WHERE rolname=current_user); ROLLBACK;\n")
        check(result.stdout.strip() == b't', 'CLONE_DATABASE_AUTHORITY')
        # pg_dump scans all logical rows in this selected database; it is not a complete physical integrity proof.
        # The discarded scan cannot fsync /dev/null; database/report fsync stays enabled.
        self.execute(['pg_dump', '-h', '/var/run/postgresql', '-w', '-U', user, '-d', database,
                      '--format=custom', '--file=/dev/null', '--no-sync'], seconds=180)
        # Install/check amcheck only in this disposable clone. PostgreSQL documents
        # its limited relation coverage; the aggregate never claims full integrity.
        self.execute(['env', 'PGOPTIONS=-c default_transaction_read_only=off -c statement_timeout=120000',
                      'pg_amcheck', '--host=/var/run/postgresql', '--username=' + user,
                      '--all', '--install-missing', '--heapallindexed'], seconds=180)
        self.execute(['pg_ctl', '-D', DATA, '-w', '-t', '60', '-m', 'fast', 'stop'], seconds=75)
        control = self.execute(['pg_controldata', '-D', DATA]).stdout.decode('ascii')
        fields = dict(line.split(':', 1) for line in control.splitlines() if ':' in line)
        check(fields.get('Database cluster state', '').strip() == 'shut down', 'CLONE_NOT_CLEANLY_STOPPED')
        checksum = fields.get('Data page checksum version', '').strip()
        check(checksum in ('0', '1'), 'CLONE_CHECKSUM_PROFILE')
        if checksum == '1':
            self.execute(['pg_checksums', '--check', '-D', DATA], seconds=180)
        return 'VERIFIED' if checksum == '1' else 'NOT_ENABLED'

    def cleanup(self):
        if not self.create_attempted:
            return
        self.begin_cleanup()
        row = self.inspection(self.name)
        identifier = row.get('Id')
        check(type(identifier) is str and re.fullmatch('[0-9a-f]{64}', identifier) and
              row.get('Config', {}).get('Labels', {}).get(LABEL) == self.identity and
              (self.container_id is None or identifier == self.container_id), 'CLEANUP_IDENTITY')
        # Cleanup retains its own bounded deadline even after the work budget expires.
        self.command(['rm', '-f', identifier], seconds=30)
        remaining = self.command(['ps', '-aq', '--no-trunc', '--filter', 'id=' + identifier], seconds=15)
        check(not remaining.stdout.strip(), 'CLEANUP_NOT_PROVEN')


def private_read(cold, parent, name, limit):
    fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NOATIME | os.O_NONBLOCK, dir_fd=parent)
    try:
        before = os.fstat(fd)
        check(stat.S_ISREG(before.st_mode) and before.st_uid == 0 and stat.S_IMODE(before.st_mode) == 0o600 and
              before.st_nlink == 1 and 0 < before.st_size <= limit, 'PRESERVED_FILE_PROFILE')
        digest = hashlib.sha256()
        retained = bytearray() if limit <= 16384 else None
        count = 0
        deadline = time.monotonic() + 30
        while True:
            check(time.monotonic() < deadline, 'PRESERVED_READ_DEADLINE')
            chunk = os.read(fd, 65536)
            if not chunk:
                break
            count += len(chunk)
            check(count <= before.st_size, 'PRESERVED_FILE_CHANGED')
            digest.update(chunk)
            if retained is not None:
                retained.extend(chunk)
        check(count == before.st_size and cold.stable_stat(before) == cold.stable_stat(os.fstat(fd)),
              'PRESERVED_FILE_CHANGED')
        return digest.hexdigest(), bytes(retained) if retained is not None else None
    finally:
        os.close(fd)


def preserved_copies(cold, root_fd):
    for name, cipher_hash in PRESERVED_CIPHERS:
        parent = cold.directory_fd(name, root_fd)
        try:
            info = os.fstat(parent)
            check(info.st_uid == 0 and stat.S_IMODE(info.st_mode) == 0o700, 'PRESERVED_DIRECTORY_PROFILE')
            actual, _ = private_read(cold, parent, 'preservation.tar.gpg', 2 * 1024 * 1024 * 1024)
            check(actual == cipher_hash, 'PRESERVED_CIPHERTEXT_CHANGED')
            _, receipt_raw = private_read(cold, parent, 'receipt.json', 16384)
            receipt = json.loads(receipt_raw)
            check(receipt.get('passed') is True and receipt.get('ciphertextSha256') == cipher_hash and
                  receipt.get('sourceUnchanged') is True and receipt.get('runtimeRestored') is False,
                  'PRESERVED_RECEIPT_CHANGED')
        finally:
            os.close(parent)


@contextmanager
def operation_journal(cold, backup_root, sha, run_id, copy):
    import fcntl
    root_fd = cold.absolute_directory(backup_root)
    operation_fd = None
    try:
        info = os.fstat(root_fd)
        check(stat.S_IMODE(info.st_mode) == 0o700, 'BACKUP_ROOT_MODE')
        fcntl.flock(root_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        preserved_copies(cold, root_fd)
        space = os.fstatvfs(root_fd)
        check(space.f_bavail * space.f_frsize >= 2 * 1024 * 1024 * 1024, 'COPY_DISK_RESERVE')
        try:
            os.stat(OPERATION, dir_fd=root_fd, follow_symlinks=False)
        except FileNotFoundError:
            pass
        else:
            raise StoppedCopyError('OPERATION_ALREADY_EXISTS_RECONCILE')
        os.mkdir(OPERATION, 0o700, dir_fd=root_fd)
        cold.sync(root_fd)
        operation_fd = cold.directory_fd(OPERATION, root_fd)
        pending = cold.private_file(operation_fd, 'operation.pending')
        try:
            data = json.dumps({'schemaVersion': SCHEMA, 'targetSha': sha, 'runId': run_id,
                               'status': 'UNKNOWN_RECONCILIATION_REQUIRED', 'ownedContainerName': copy.name,
                               'ownedContainerIdentity': copy.identity}).encode()
            check(os.write(pending, data) == len(data), 'JOURNAL_WRITE')
            cold.sync(pending)
        finally:
            os.close(pending)
        cold.sync(operation_fd)
        yield root_fd, operation_fd
    finally:
        if operation_fd is not None:
            os.close(operation_fd)
        os.close(root_fd)


def publish_stopped_report(cold, backup_fd, operation_fd, report):
    try:
        pending = cold.private_file(operation_fd, 'report.pending')
        try:
            raw = (json.dumps(report, separators=(',', ':')) + '\n').encode()
            check(os.write(pending, raw) == len(raw), 'REPORT_WRITE')
            cold.sync(pending)
        finally:
            os.close(pending)
        cold.sync(operation_fd)
        os.rename('report.pending', 'report.json', src_dir_fd=operation_fd, dst_dir_fd=operation_fd)
        cold.sync(operation_fd)
        cold.sync(backup_fd)
    except BaseException:
        # Only this invocation's two report markers are invalidated.
        # The durable owned identity journal remains for reconciliation.
        invalidated = True
        for name in ('report.pending', 'report.json'):
            try:
                os.unlink(name, dir_fd=operation_fd)
            except FileNotFoundError:
                pass
            except BaseException:
                invalidated = False
        for fd in (operation_fd, backup_fd):
            try:
                cold.sync(fd)
            except BaseException:
                invalidated = False
        raise StoppedCopyError('REPORT_PUBLICATION_FAILED' if invalidated else
                               'REPORT_CLEANUP_NOT_PROVEN') from None
    return report


def validate_stopped(cold, helper, sha, run_id, *, source_root='/var/lib/docker', backup_root=None,
                     docker_factory=DockerCopy):
    check(os.getuid() == os.geteuid() == 0 and re.fullmatch('[0-9a-f]{40}', sha) and
          re.fullmatch('[1-9][0-9]{0,19}', run_id), 'OPERATOR_SOURCE_IDENTITY')
    check(not any(os.environ.get(key) for key in ('DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_API_VERSION')),
          'DOCKER_CONTEXT_ENV')
    host = helper.Host()
    baseline = host.observe()
    cold.no_postgres_processes()
    records = cold.read_configuration_records(source_root, baseline[0])
    selected = selected_postgres(records, baseline[0])
    check(selected['volume'].encode() in baseline[1], 'POSTGRES_VOLUME_MISSING')
    with pg_snapshot(cold, source_root, selected['volume']) as before:
        before.capture()
        validate_snapshot(before)
        check(host.observe() == baseline, 'PRE_COPY_SOURCE_DRIFT')
        cold.no_postgres_processes()
        mem = dict(line.split(':', 1) for line in Path('/proc/meminfo').read_text().splitlines() if ':' in line)
        check(int(mem['MemAvailable'].split()[0]) * 1024 >= 2 * 1024 * 1024 * 1024, 'COPY_MEMORY_RESERVE')
        copy = docker_factory(sha, run_id)
        with operation_journal(cold, backup_root or cold.BACKUP_ROOT, sha, run_id, copy) as (backup_fd, operation_fd):
            check(host.observe() == baseline, 'PRE_CREATE_RUNTIME_DRIFT')
            failure = None
            checksum = None
            try:
                copy.create(selected['user'], selected['database'], before.entries['data']['mode'])
                copy.transfer(before, selected['volume'], cold)
                checksum = copy.recover(selected['user'], selected['database'])
            except BaseException as error:
                failure = error
            try:
                copy.cleanup()
            except BaseException:
                raise StoppedCopyError('DISPOSABLE_CLEANUP_NOT_PROVEN') from None
            if failure is not None:
                raise failure
            cold.no_postgres_processes()
            check(host.observe() == baseline, 'POST_COPY_RUNTIME_DRIFT')
            with pg_snapshot(cold, source_root, selected['volume']) as after:
                after.capture()
                check(before.entries == after.entries, 'POST_COPY_SOURCE_DRIFT')
            preserved_copies(cold, backup_fd)
            report = {'schemaVersion': SCHEMA, 'targetSha': sha, 'runId': run_id, 'passed': True,
                      'classification': 'ISOLATED_PHYSICAL_COPY_RECOVERY_VERIFIED_NOT_RELEASE_ACCEPTANCE',
                      'sourceUnchanged': True, 'runtimeUnchanged': True, 'cloneByteCopyVerified': True,
                      'cloneRecoveryVerified': True, 'selectedDatabaseLogicalScan': 'VERIFIED',
                      'amcheck': 'SUPPORTED_RELATIONS_VERIFIED',
                      'checksums': checksum, 'disposableCleanup': 'VERIFIED',
                      'sourceBinding': 'HISTORICAL_POSTGRES_NOT_CANONICAL_API_VERIFIED',
                      'databaseIntegrity': 'NOT_FULLY_ATTESTED', 'runtimeRestored': False,
                      'startupAuthorized': False, 'fullDrAcceptance': 'NOT_PROVEN',
                      'offHostRecovery': 'NOT_ESTABLISHED'}
            return publish_stopped_report(cold, backup_fd, operation_fd, report)


def stopped_main(arguments):
    try:
        check(len(arguments) == 3, 'ARGUMENTS')
        def interrupted(_signum, _frame):
            raise StoppedCopyError('OPERATION_INTERRUPTED')
        signal.signal(signal.SIGTERM, interrupted)
        signal.signal(signal.SIGINT, interrupted)
        signal.signal(signal.SIGHUP, interrupted)
        sha, run_id, root = arguments
        cold, helper = dependencies(root)
        value = validate_stopped(cold, helper, sha, run_id)
        print(json.dumps(value, separators=(',', ':')), flush=True)
        return 0
    except BaseException as error:
        code = str(error) if isinstance(error, StoppedCopyError) else 'STOPPED_COPY_FAILURE'
        if re.fullmatch('[A-Z_]{1,64}', code) is None:
            code = 'STOPPED_COPY_FAILURE'
        print(json.dumps({'schemaVersion': SCHEMA, 'passed': False, 'errorCode': code,
                          'runtimeRestored': False, 'startupAuthorized': False,
                          'mutationOutcome': 'RECONCILIATION_REQUIRED_IF_STARTED'}, separators=(',', ':')), flush=True)
        return 1


if __name__ == '__main__':
    raise SystemExit(stopped_main(sys.argv[1:]))
PY_STOPPED_SOURCE
  exit $?
fi

# A bounded source snapshot and an isolated restore, never an application release.
set -Eeuo pipefail
umask 077
SECONDS=0
export LC_ALL=C
unset DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS_VERIFY DOCKER_CERT_PATH DOCKER_API_VERSION
# Every Docker call pins the local daemon; no production bytes may leave the host.

fail() { printf 'IR20_RESTORE_ERROR=%s\n' "$1" >&2; exit 1; }
[[ $# == 3 ]] || fail ARGUMENTS
TARGET_SHA="$1"; SOURCE_ID="$2"; PROJECT="$3"
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || fail TARGET_SHA
[[ "$SOURCE_ID" =~ ^[0-9a-f]{64}$ ]] || fail SOURCE_ID
[[ "$PROJECT" =~ ^[a-z0-9][a-z0-9_-]{0,62}$ ]] || fail PROJECT
[[ $EUID == 0 ]] || fail ROOT_REQUIRED
for tool in docker python3 timeout sha256sum cmp flock; do
  command -v "$tool" >/dev/null || fail REQUIRED_TOOL
done

# No caller-selected destination, host mount, remote DSN, or image pull is accepted.
ROOT=/var/lib/pc-release-authority/backups/ir20
python3 -I - "$ROOT" <<'PY' >/dev/null 2>&1 || fail BACKUP_DIRECTORY
import os, pathlib, stat, sys
p = pathlib.Path(sys.argv[1])
for parent in reversed([p, *p.parents]):
    if not parent.exists() and not parent.is_symlink():
        parent.mkdir(mode=0o700)
    s = parent.lstat()
    if not stat.S_ISDIR(s.st_mode) or s.st_uid != 0 or s.st_mode & 0o022:
        raise SystemExit(1)
PY
exec 9>"$ROOT/.drill.lock"
flock -n 9 || fail DRILL_ALREADY_RUNNING
RUN="$(python3 -I -c 'import secrets; print(secrets.token_hex(16))')"
DIR="$ROOT/$RUN"; mkdir -m 700 "$DIR"
NAME="pc-ir20-restore-$RUN"; BOOTSTRAP="ir20_$RUN"
CREATE_ATTEMPTED=0
RESTORE_ID=''; SNAP_PID=''; SNAP_IN=''; SNAP_OUT=''; RESULT=FAILED

# Diagnostics and database bytes remain in root-only storage on the executing host.
cleanup() {
  local rc=$? id identity remaining
  trap - EXIT INT TERM
  if [[ -n "$SNAP_IN" ]]; then
    ( trap - EXIT; printf 'ROLLBACK;\n\\q\n' >&"$SNAP_IN" ) 2>/dev/null || true
    eval "exec ${SNAP_IN}>&-" 2>/dev/null || true
  fi
  if [[ -n "$SNAP_PID" ]]; then wait "$SNAP_PID" 2>/dev/null || true; fi
  # A timed-out create is an unknown outcome: reconcile only our random name.
  id="$(timeout 15 docker --host unix:///var/run/docker.sock container inspect --format '{{.Id}}' "$NAME" 2>/dev/null || true)"
  if [[ -n "$id" ]]; then
    identity="$(timeout 15 docker --host unix:///var/run/docker.sock container inspect --format '{{.Id}} {{ index .Config.Labels "pc-crop.ir20-restore" }}' "$NAME" 2>/dev/null || true)"
    if [[ ! "$id" =~ ^[0-9a-f]{64}$ || "$id" == "$SOURCE_ID" || "$identity" != "$id $RUN" ]]; then
      printf 'IR20_RESTORE_ERROR=CLEANUP_IDENTITY\n' >&2; rc=1
    elif ! timeout 30 docker --host unix:///var/run/docker.sock rm -fv "$id" >/dev/null 2>&1; then
      printf 'IR20_RESTORE_ERROR=CLEANUP_FAILED\n' >&2; rc=1
    else
      # A successful delete acknowledgement alone does not prove absence.
      # Query all states by the validated full ID, never enumerate other services.
      if ! remaining="$(timeout 15 docker --host unix:///var/run/docker.sock ps -aq --no-trunc --filter "id=$id" 2>/dev/null)"; then
        printf 'IR20_RESTORE_ERROR=CLEANUP_NOT_PROVEN\n' >&2; rc=1
      elif [[ -n "$remaining" ]]; then
        printf 'IR20_RESTORE_ERROR=CLEANUP_NOT_PROVEN\n' >&2; rc=1
      fi
    fi
  elif [[ "$CREATE_ATTEMPTED" == 1 ]]; then
    # Do not turn an inspection/transport failure into proof of cleanup.
    printf 'IR20_RESTORE_ERROR=CLEANUP_NOT_PROVEN\n' >&2; rc=1
  fi
  # Never retain environment inspections or duplicate business-row material.
  if ! rm -f "$DIR"/*.rows "$DIR"/source-*.json "$DIR"/restore-inspect.json "$DIR"/image.json "$DIR"/selected "$DIR"/roles-after.sql "$DIR"/diagnostic.log "$DIR"/snapshot.log 2>/dev/null; then
    printf 'IR20_RESTORE_ERROR=SENSITIVE_CLEANUP_FAILED\n' >&2; rc=1
  fi
  if [[ $rc == 0 && "$RESULT" == VERIFIED ]]; then
    python3 -I - "$DIR" <<'PYSYNC' >/dev/null 2>&1 || { printf 'IR20_RESTORE_ERROR=BACKUP_DURABILITY\n' >&2; exit 1; }
import os,pathlib,sys
p=pathlib.Path(sys.argv[1]); pending=p/'report.pending.json'; final=p/'report.json'
def sync(path):
    fd=os.open(path,os.O_RDONLY)
    try: os.fsync(fd)
    finally: os.close(fd)
try:
    # A durable run directory does not persist its entry in the parent directory.
    # The protected hierarchy may also be newly created: sync up to the root.
    for f in (p/'database.dump',p/'roles.sql',pending,p,*p.parents):
        sync(f)
    os.replace(pending,final)
    sync(p)
except OSError:
    # Fail closed even when the filesystem cannot persist marker removal.
    # Attempt both removals; cleanup failure must never turn the original error green.
    for marker in (pending,final):
        try: marker.unlink(missing_ok=True)
        except OSError: pass
    try: sync(p)
    except OSError: pass
    raise
PYSYNC
    cat "$DIR/report.json"
  else
    rm -f "$DIR/report.pending.json"
    printf 'IR20_RESTORE_RESULT=NOT_VERIFIED\n' >&2
  fi
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Bound both the Docker client runtime and each sensitive output file (64 MiB).
bounded() { (ulimit -f 65536; timeout --kill-after=5 240 "$@") 2>"$DIR/diagnostic.log"; }
inspect_source() { bounded docker --host unix:///var/run/docker.sock container inspect "$SOURCE_ID"; }
inspect_source >"$DIR/source-before.json" || fail SOURCE_INSPECTION
python3 -I - "$DIR/source-before.json" "$SOURCE_ID" "$PROJECT" <<'PY' >"$DIR/selected" 2>/dev/null || fail SOURCE_AUTHORITY
import json, re, sys
rows=json.load(open(sys.argv[1])); assert isinstance(rows,list) and len(rows)==1
c=rows[0]; assert c['Id']==sys.argv[2] and c['State']['Running'] is True
assert c['Config']['Labels']['com.docker.compose.project']==sys.argv[3]
assert c['Config']['Labels']['com.docker.compose.service'] in ('postgres','postgresql','db')
e={}
for entry in c['Config']['Env']:
    k, sep, v=entry.partition('='); assert sep and k not in e; e[k]=v
assert e.get('PG_MAJOR')=='16'
for k in ('POSTGRES_USER','POSTGRES_DB'):
    assert re.fullmatch(r'[A-Za-z_][A-Za-z0-9_-]{0,62}',e.get(k,''))
assert re.fullmatch(r'sha256:[0-9a-f]{64}',c['Image'])
print(c['Image']); print(e['POSTGRES_USER']); print(e['POSTGRES_DB'])
PY
mapfile -t SELECTED <"$DIR/selected"
IMAGE="${SELECTED[0]}"; DB_USER="${SELECTED[1]}"; DB_NAME="${SELECTED[2]}"
bounded docker --host unix:///var/run/docker.sock image inspect "$IMAGE" >"$DIR/image.json" || fail SOURCE_IMAGE
python3 -I - "$DIR/image.json" "$IMAGE" <<'PY' >/dev/null 2>&1 || fail IMAGE_CONTRACT
import json,sys
r=json.load(open(sys.argv[1])); assert len(r)==1 and r[0]['Id']==sys.argv[2]
c=r[0]['Config']; assert c['Entrypoint']==['docker-entrypoint.sh']
assert c['Cmd']==['postgres']
assert 'PG_MAJOR=16' in c.get('Env',[])
assert set(c.get('Volumes') or {}) <= {'/var/lib/postgresql/data'}
PY
UID_PG="$(bounded docker --host unix:///var/run/docker.sock exec "$SOURCE_ID" id -u postgres)" || fail SOURCE_UID
GID_PG="$(bounded docker --host unix:///var/run/docker.sock exec "$SOURCE_ID" id -g postgres)" || fail SOURCE_GID
[[ "$UID_PG" =~ ^[1-9][0-9]{0,4}$ && "$GID_PG" =~ ^[1-9][0-9]{0,4}$ ]] || fail SOURCE_UID_GID
python3 -I - "$ROOT" <<'PY' >/dev/null 2>&1 || fail CAPACITY
import pathlib,re,shutil,sys
assert shutil.disk_usage(sys.argv[1]).free >= 2*1024**3
m=re.search(r'^MemAvailable:\s+(\d+) kB$',pathlib.Path('/proc/meminfo').read_text(),re.M)
assert m and int(m[1])*1024 >= 2*1024**3
PY

# Explicit local socket; inherited libpq service/host-address overrides are removed.
# An empty PGSERVICE is not disabled: libpq tries to resolve the empty service name.
source_exec() {
  bounded docker --host unix:///var/run/docker.sock exec -i -e PGHOST=/var/run/postgresql -e PGPORT=5432 \
    -e PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=120000 -c lock_timeout=5000 -c timezone=UTC -c datestyle=ISO,YMD -c intervalstyle=postgres -c search_path=pg_catalog,public' \
    "$SOURCE_ID" env -u PGSERVICE -u PGSERVICEFILE -u PGHOSTADDR "$@"
}
source_sql() { source_exec psql -h /var/run/postgresql -p 5432 -XqAt -w -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME"; }
source_authority="$(printf "SELECT (current_user = '%s' AND current_database() = '%s' AND current_setting('transaction_read_only') = 'on' AND current_setting('server_version_num')::int BETWEEN 160000 AND 169999 AND (SELECT rolsuper FROM pg_roles WHERE rolname=current_user))::int;\n" "$DB_USER" "$DB_NAME" | source_sql)" || fail SOURCE_DATABASE_AUTHORITY
[[ "$source_authority" == 1 ]] || fail SOURCE_DATABASE_AUTHORITY
coproc SNAPSHOT { source_sql 2>"$DIR/snapshot.log"; }
SNAP_PID=$SNAPSHOT_PID
# Duplicate coprocess descriptors; Bash may unset the array when it terminates.
exec {SNAP_IN}>&"${SNAPSHOT[1]}"; exec {SNAP_OUT}<&"${SNAPSHOT[0]}"
# Keep a dead snapshot pipe from killing the parent before its cleanup trap.
( trap - EXIT; printf "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\nSET LOCAL idle_in_transaction_session_timeout='240s';\nSELECT pg_export_snapshot();\n" >&"$SNAP_IN" ) 2>/dev/null || fail SNAPSHOT_START
IFS= read -r -t 15 SNAPSHOT_ID <&"$SNAP_OUT" || fail SNAPSHOT_START
[[ "$SNAPSHOT_ID" =~ ^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{8}-[1-9][0-9]*$ ]] || fail SNAPSHOT_ID
TABLES=(deals audit_events ledger_entries outbox_entries _prisma_migrations catalog)
fingerprint_sql() {
  local table="$1" snapshot="${2:-}"
  printf 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\n'
  [[ -z "$snapshot" ]] || printf "SET TRANSACTION SNAPSHOT '%s';\n" "$snapshot"
  if [[ "$table" == catalog ]]; then
    cat <<'SQLCAT'
COPY (
 SELECT jsonb_build_object(
   'table', c.relname, 'owner', pg_get_userbyid(c.relowner),
   'rls', c.relrowsecurity, 'forced', c.relforcerowsecurity,
   'acl', (SELECT jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(x.grantor),'grantee',CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END,'privilege',x.privilege_type,'grantable',x.is_grantable) ORDER BY pg_get_userbyid(x.grantor), CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END, x.privilege_type) FROM aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) x),
   'policies', (SELECT jsonb_agg(jsonb_build_object('name',p.policyname,'permissive',p.permissive,'roles',ARRAY(SELECT r FROM unnest(p.roles) r ORDER BY r),'command',p.cmd,'using',p.qual,'check',p.with_check) ORDER BY p.policyname) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname),
   'triggers', (SELECT jsonb_agg(jsonb_build_object('definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled,'function',pg_get_functiondef(t.tgfoid),'owner',pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,'settings',p.proconfig) ORDER BY t.tgname) FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid WHERE t.tgrelid=c.oid AND NOT t.tgisinternal),
   'constraints', (SELECT jsonb_agg(pg_get_constraintdef(k.oid,true) ORDER BY k.conname) FROM pg_constraint k WHERE k.conrelid=c.oid)
 )::text
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN ('deals','audit_events','ledger_entries','outbox_entries','_prisma_migrations')
 ORDER BY c.relname COLLATE "C"
) TO STDOUT;
SQLCAT
  else
    printf 'COPY (SELECT to_jsonb(t)::text FROM public.%s t ORDER BY to_jsonb(t)::text COLLATE "C") TO STDOUT;\n' "$table"
  fi
  printf 'ROLLBACK;\n'
}
for table in "${TABLES[@]}"; do
  fingerprint_sql "$table" "$SNAPSHOT_ID" | source_sql >"$DIR/source-$table.rows" || fail SOURCE_FINGERPRINT
done
source_exec pg_dumpall -h /var/run/postgresql -p 5432 -w -U "$DB_USER" --roles-only --no-role-passwords >"$DIR/roles.sql" || fail ROLE_EXPORT
# A fresh bootstrap cannot collide with a role in the captured source.
! grep -Fq "$BOOTSTRAP" "$DIR/roles.sql" || fail BOOTSTRAP_COLLISION
source_exec pg_dump -h /var/run/postgresql -p 5432 -w -U "$DB_USER" -d "$DB_NAME" --format=custom \
  --snapshot="$SNAPSHOT_ID" --lock-wait-timeout=5s >"$DIR/database.dump" || fail DUMP
[[ -s "$DIR/database.dump" ]] || fail EMPTY_DUMP
source_exec pg_dumpall -h /var/run/postgresql -p 5432 -w -U "$DB_USER" --roles-only --no-role-passwords >"$DIR/roles-after.sql" || fail ROLE_RECHECK
# Patched pg_dumpall may generate a different psql restriction key per export.
# Discard only a validated, paired transport marker, never SQL or role attributes.
python3 -I - "$DIR/roles.sql" "$DIR/roles-after.sql" <<'PYROLES' >/dev/null 2>&1 || fail ROLES_CHANGED
import pathlib,re,sys
def normalized(filename):
    rows=pathlib.Path(filename).read_text().splitlines()
    marks=[r for r in rows if r.startswith(('\\restrict ', '\\unrestrict '))]
    if marks:
        assert len(marks)==2 and re.fullmatch(r'\\restrict [A-Za-z0-9]{32,128}',marks[0])
        assert marks[1]=='\\unrestrict '+marks[0].split()[1]
    return [r for r in rows if r not in marks]
assert normalized(sys.argv[1])==normalized(sys.argv[2])
PYROLES
( trap - EXIT; printf 'ROLLBACK;\n\\q\n' >&"$SNAP_IN" ) 2>/dev/null || fail SNAPSHOT_END
eval "exec ${SNAP_IN}>&-"; SNAP_IN=''
wait "$SNAP_PID" || fail SNAPSHOT_END
SNAP_PID=''

# Start only a new, non-root, networkless instance of the already-present image.
BACKUP_SECONDS=$SECONDS
CREATE_ATTEMPTED=1
RESTORE_ID="$(bounded docker --host unix:///var/run/docker.sock create --pull=never --name "$NAME" \
  --label "pc-crop.ir20-restore=$RUN" --network none --read-only \
  --user "$UID_PG:$GID_PG" --cap-drop ALL --security-opt no-new-privileges \
  --memory 768m --memory-swap 768m --cpus 1 --pids-limit 128 \
  --tmpfs "/var/lib/postgresql/data:rw,nosuid,nodev,noexec,uid=$UID_PG,gid=$GID_PG,size=536870912" \
  --tmpfs "/var/run/postgresql:rw,nosuid,nodev,noexec,uid=$UID_PG,gid=$GID_PG,size=16777216" \
  --tmpfs /tmp:rw,nosuid,nodev,noexec,size=16777216 \
  -e "POSTGRES_USER=$BOOTSTRAP" -e POSTGRES_DB=restored -e POSTGRES_HOST_AUTH_METHOD=trust \
  "$IMAGE" postgres -c listen_addresses= -c max_connections=20 -c shared_buffers=32MB \
  -c work_mem=4MB -c temp_file_limit=131072)" || fail RESTORE_CREATE
[[ "$RESTORE_ID" =~ ^[0-9a-f]{64}$ && "$RESTORE_ID" != "$SOURCE_ID" ]] || fail RESTORE_ID
bounded docker --host unix:///var/run/docker.sock container inspect "$RESTORE_ID" >"$DIR/restore-inspect.json" || fail RESTORE_INSPECTION
python3 -I - "$DIR/restore-inspect.json" "$RESTORE_ID" "$RUN" "$IMAGE" "$UID_PG:$GID_PG" <<'PY' >/dev/null 2>&1 || fail RESTORE_ISOLATION
import json,sys
r=json.load(open(sys.argv[1])); assert len(r)==1
c=r[0]; h=c['HostConfig']; assert c['Id']==sys.argv[2] and c['Image']==sys.argv[4]
assert c['Config']['Labels']['pc-crop.ir20-restore']==sys.argv[3]
assert c['Config']['User']==sys.argv[5]
assert not h.get('CapAdd') and not h.get('Devices') and not h.get('DeviceRequests')
assert not h.get('Mounts')
assert set(h['Tmpfs'])=={'/var/lib/postgresql/data','/var/run/postgresql','/tmp'}
assert h['NetworkMode']=='none' and h['ReadonlyRootfs'] and not h['Privileged']
assert not h.get('Binds') and not h.get('PortBindings')
assert h['Memory']==805306368 and h['MemorySwap']==805306368
assert h['NanoCpus']==1000000000 and h['PidsLimit']==128
assert 'ALL' in h['CapDrop'] and 'no-new-privileges' in h['SecurityOpt']
assert not c['State']['Running']
PY
bounded docker --host unix:///var/run/docker.sock start "$RESTORE_ID" >/dev/null || fail RESTORE_START
ready=0
for attempt in $(seq 1 30); do
  if timeout 5 docker --host unix:///var/run/docker.sock exec "$RESTORE_ID" pg_isready -q -U "$BOOTSTRAP" -d restored >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[[ "$ready" == 1 ]] || fail RESTORE_STARTUP
restore_exec() {
  bounded docker --host unix:///var/run/docker.sock exec -i -e PGHOST=/var/run/postgresql -e PGPORT=5432 \
    -e PGOPTIONS='-c statement_timeout=120000 -c timezone=UTC -c datestyle=ISO,YMD -c intervalstyle=postgres -c search_path=pg_catalog,public' "$RESTORE_ID" env -u PGSERVICE -u PGSERVICEFILE -u PGHOSTADDR "$@"
}
restore_exec psql -Xq -w -v ON_ERROR_STOP=1 -U "$BOOTSTRAP" -d restored <"$DIR/roles.sql" >/dev/null || fail ROLE_RESTORE
# Ownership and ACLs must be restored; no --no-owner/--no-acl shortcut.
restore_exec pg_restore -w --exit-on-error -U "$BOOTSTRAP" -d restored <"$DIR/database.dump" >/dev/null || fail DATABASE_RESTORE
for table in "${TABLES[@]}"; do
  fingerprint_sql "$table" | restore_exec psql -XqAt -w -v ON_ERROR_STOP=1 -U "$BOOTSTRAP" -d restored >"$DIR/restored-$table.rows" || fail RESTORED_FINGERPRINT
  cmp -s "$DIR/source-$table.rows" "$DIR/restored-$table.rows" || fail CRITICAL_STATE_MISMATCH
done
inspect_source >"$DIR/source-after.json" || fail SOURCE_RECHECK
python3 -I - "$DIR" "$TARGET_SHA" "$IMAGE" "$BACKUP_SECONDS" "$SECONDS" <<'PY' >"$DIR/report.pending.json" 2>/dev/null || fail REPORT
import datetime,hashlib,json,pathlib,sys
p=pathlib.Path(sys.argv[1]); a=json.loads((p/'source-before.json').read_text())[0]; b=json.loads((p/'source-after.json').read_text())[0]
for key in ('Id','Image','Config'):
    assert a[key]==b[key]
assert b['State']['Running'] is True and a['State']['StartedAt']==b['State']['StartedAt']
checks={}
for table in ('deals','audit_events','ledger_entries','outbox_entries','_prisma_migrations','catalog'):
    raw=(p/f'source-{table}.rows').read_bytes()
    checks[table]={'sha256':hashlib.sha256(raw).hexdigest(),'rows':raw.count(b'\n')}
report={'schema':'pc-crop.ir20-restore-drill.v1','target_sha':sys.argv[2],
        'classification':'CRITICAL_STATE_RESTORE_VERIFIED_NOT_RELEASE_ACCEPTANCE',
        'observed_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'backup_seconds':int(sys.argv[4]),'restore_seconds':int(sys.argv[5])-int(sys.argv[4]),
        'total_seconds':int(sys.argv[5]),'disposable_cleanup':'VERIFIED',
        'postgres_image_id':sys.argv[3], 'archive_sha256':hashlib.sha256((p/'database.dump').read_bytes()).hexdigest(),
        'roles_sha256':hashlib.sha256((p/'roles.sql').read_bytes()).hexdigest(),
        'checks':checks,'source_mutation':'NONE','deployment_authorized':False,
        'source_binding':'OPERATOR_SELECTED_NOT_CANONICAL_API_VERIFIED',
        'live_delivery':'NOT_PERFORMED','full_dr_acceptance':'NOT_PROVEN'}
print(json.dumps(report,sort_keys=True))
PY
# Preserve the archive/roles; remove extra copies of sensitive rows and inspection data.
RESULT=VERIFIED
