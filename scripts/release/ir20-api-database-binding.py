#!/usr/bin/env python3
"""Read-only API/default-database binding primitive, NOT restore/release authority.

A protected caller must establish canonical API identity and serialize releases.
No DSN is accepted, printed or written. A transaction-local random marker proves
that the selected source sees the API's actual live PostgreSQL backend, rather
than merely matching database names, aliases or copied container metadata.
"""
from __future__ import annotations

import json
import os
import re
import secrets
import selectors
import subprocess
import sys
import time
from typing import Any

DOCKER = ['/usr/bin/docker', '--host', 'unix:///var/run/docker.sock']
ENV = {'PATH': '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', 'LC_ALL': 'C'}
HEX_ID = re.compile(r'[0-9a-f]{64}\Z')
NAME = re.compile(r'[A-Za-z_][A-Za-z0-9_-]{0,62}\Z')
MAX_OUTPUT = 1024 * 1024

# Independent watchdog also bounds the container-side process if its Docker
# client dies. EOF, malformed input and missing release acknowledgement fail.
API_PROGRAM = r'''
const { PrismaClient } = require('@prisma/client');
const marker = process.argv[1];
if (!/^pc-ir20-bind-[0-9a-f]{32}$/.test(marker)) process.exit(1);
const watchdog = setTimeout(() => process.exit(1), 15000);
const p = new PrismaClient({ log: [] });
let receipt = false, input = '';
let resolveRelease, rejectRelease;
const release = new Promise((resolve, reject) => {
  resolveRelease = resolve; rejectRelease = reject;
});
release.catch(() => {});
process.stdin.setEncoding('utf8');
process.stdin.on('data', part => {
  input += part;
  if (input.length > 16 || (input.includes('\n') && input !== 'release\n')) {
    rejectRelease(new Error('CONTROL_INPUT'));
  } else if (input === 'release\n') {
    receipt = true; resolveRelease();
  }
});
process.stdin.on('end', () => {
  if (!receipt) rejectRelease(new Error('CONTROL_EOF'));
});
(async () => {
  await p.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '3s'");
    await tx.$executeRawUnsafe("SET LOCAL idle_in_transaction_session_timeout = '10s'");
    await tx.$queryRawUnsafe("SELECT set_config('application_name', $1, true)", marker);
    const rows = await tx.$queryRawUnsafe(
      "SELECT pg_backend_pid() AS pid, current_setting('transaction_read_only') AS ro, " +
      "current_setting('server_version_num')::int AS version"
    );
    if (rows.length !== 1 || rows[0].ro !== 'on' ||
        !Number.isInteger(rows[0].pid) || rows[0].pid < 1 ||
        rows[0].version < 160000 || rows[0].version >= 170000) throw new Error('DB_IDENTITY');
    process.stdout.write(JSON.stringify({pid: rows[0].pid, marker}) + '\n');
    await release;
    // The read-only transaction commits no business writes. SET LOCAL expires.
    const end = await tx.$queryRawUnsafe("SELECT current_setting('transaction_read_only') AS ro");
    if (end.length !== 1 || end[0].ro !== 'on') throw new Error('READ_ONLY_LOST');
  }, { maxWait: 2000, timeout: 12000 });
  await p.$disconnect();
  process.stdout.write('RELEASED\n');
  process.stdin.pause();
  clearTimeout(watchdog);
})().catch(async () => {
  process.exitCode = 1;
  try { await p.$disconnect(); } finally {
    process.stdin.pause(); clearTimeout(watchdog);
  }
  // Never print exception text/connection details.
});
'''


class BindingError(Exception):
    """Only fixed error codes cross the operational boundary."""


def decode(raw: bytes) -> Any:
    def unique(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result = {}
        for key, value in pairs:
            if key in result:
                raise BindingError('DUPLICATE_JSON_KEY')
            result[key] = value
        return result
    try:
        return json.loads(raw.decode('utf-8', errors='strict'), object_pairs_hook=unique,
                          parse_constant=lambda _: (_ for _ in ()).throw(BindingError('JSON_CONSTANT')))
    except (UnicodeError, ValueError) as exc:
        raise BindingError('INVALID_JSON') from exc


class Process:
    def __init__(self, argv: list[str], seconds: float):
        self.deadline = time.monotonic() + seconds
        self.proc = subprocess.Popen(argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                     stderr=subprocess.DEVNULL, env=ENV, bufsize=0)
        self.buffer = b''
        self.total = 0

    def read(self, line: bool = False) -> bytes:
        with selectors.DefaultSelector() as poll:
            poll.register(self.proc.stdout, selectors.EVENT_READ)
            while True:
                if line and b'\n' in self.buffer:
                    result, self.buffer = self.buffer.split(b'\n', 1)
                    return result
                remaining = self.deadline - time.monotonic()
                if remaining <= 0 or not poll.select(remaining):
                    raise BindingError('PROCESS_TIMEOUT')
                chunk = os.read(self.proc.stdout.fileno(), 65536)
                if not chunk:
                    if line:
                        raise BindingError('PROCESS_EOF')
                    result, self.buffer = self.buffer, b''
                    return result
                self.total += len(chunk)
                if self.total > MAX_OUTPUT:
                    raise BindingError('OUTPUT_LIMIT')
                self.buffer += chunk

    def send(self, data: bytes) -> None:
        if len(data) > 4096:
            raise BindingError('INPUT_LIMIT')
        self.proc.stdin.write(data)

    def finish(self, data: bytes = b'') -> bytes:
        if data:
            self.send(data)
        self.proc.stdin.close()
        result = self.read()
        remaining = self.deadline - time.monotonic()
        if remaining <= 0:
            raise BindingError('PROCESS_TIMEOUT')
        if self.proc.wait(timeout=remaining) != 0:
            raise BindingError('PROCESS_FAILED')
        return result

    def close(self) -> None:
        if self.proc.poll() is None:
            self.proc.kill()
            self.proc.wait(timeout=3)
        self.proc.stdout.close()
        if not self.proc.stdin.closed:
            self.proc.stdin.close()


class Runtime:
    def run(self, arguments: list[str], data: bytes = b'') -> bytes:
        child = Process(DOCKER + arguments, 8)
        try:
            return child.finish(data)
        finally:
            child.close()

    def session(self, api_id: str, marker: str) -> Process:
        return Process(DOCKER + ['exec', '-i', api_id, 'node', '-e', API_PROGRAM, marker], 14)

    def inspect(self, identity: str) -> dict[str, Any]:
        value = decode(self.run(['container', 'inspect', identity]))
        if not isinstance(value, list) or len(value) != 1 or not isinstance(value[0], dict):
            raise BindingError('INSPECTION_SHAPE')
        return value[0]


def environment(container: dict[str, Any]) -> dict[str, str]:
    values = {}
    entries = container['Config']['Env']
    if not isinstance(entries, list):
        raise BindingError('ENVIRONMENT_SHAPE')
    for entry in entries:
        if not isinstance(entry, str):
            raise BindingError('ENVIRONMENT_SHAPE')
        key, separator, value = entry.partition('=')
        if not separator or key in values:
            raise BindingError('ENVIRONMENT_AMBIGUOUS')
        values[key] = value
    return values


def validate(container: dict[str, Any], identity: str, project: str, services: set[str]) -> None:
    labels = container['Config']['Labels']
    if (container['Id'] != identity or container['State']['Running'] is not True or
            labels['com.docker.compose.project'] != project or
            labels['com.docker.compose.service'] not in services or
            not re.fullmatch(r'sha256:[0-9a-f]{64}', container['Image'])):
        raise BindingError('CONTAINER_IDENTITY')
    environment(container)


def stable(container: dict[str, Any]) -> dict[str, Any]:
    result = {key: container[key] for key in
              ('Id', 'Image', 'Config', 'HostConfig', 'Mounts', 'NetworkSettings', 'RestartCount')}
    result['State'] = {key: container['State'][key] for key in ('Running', 'Pid', 'StartedAt')}
    return result


def bind(target: str, api_id: str, source_id: str, project: str, runtime: Runtime) -> dict[str, Any]:
    if (not re.fullmatch(r'[0-9a-f]{40}', target) or not HEX_ID.fullmatch(api_id) or
            not HEX_ID.fullmatch(source_id) or api_id == source_id or
            not re.fullmatch(r'[a-z0-9][a-z0-9_-]{0,62}', project)):
        raise BindingError('ARGUMENTS')
    api, source = runtime.inspect(api_id), runtime.inspect(source_id)
    validate(api, api_id, project, {'api'})
    validate(source, source_id, project, {'postgres', 'postgresql', 'db'})
    config = environment(source)
    user, database = config.get('POSTGRES_USER', ''), config.get('POSTGRES_DB', '')
    if config.get('PG_MAJOR') != '16' or not NAME.fullmatch(user) or not NAME.fullmatch(database):
        raise BindingError('POSTGRES_CONFIGURATION')
    marker = 'pc-ir20-bind-' + secrets.token_hex(16)
    child = runtime.session(api_id, marker)
    try:
        identity = decode(child.read(line=True))
        if (not isinstance(identity, dict) or set(identity) != {'pid', 'marker'} or
                identity['marker'] != marker or type(identity['pid']) is not int or
                not 1 <= identity['pid'] <= 2147483647):
            raise BindingError('BACKEND_IDENTITY')
        # Marker and PID are validated/generated above, not arbitrary SQL input.
        sql = ("BEGIN READ ONLY; SET LOCAL statement_timeout='3s'; "
               "SELECT count(*) FROM pg_catalog.pg_stat_activity "
               f"WHERE pid={identity['pid']} AND application_name='{marker}' "
               "AND datid=(SELECT oid FROM pg_catalog.pg_database WHERE datname=current_database()) "
               "AND backend_type='client backend' AND xact_start IS NOT NULL "
               "AND state IN ('active','idle in transaction'); ROLLBACK;\n")
        argv = ['exec', '-i', '-e', 'PGHOST=/var/run/postgresql', '-e', 'PGPORT=5432',
                '-e', 'PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=3000',
                source_id, 'env', '-u', 'PGSERVICE', '-u', 'PGSERVICEFILE', '-u', 'PGHOSTADDR',
                'psql', '-h', '/var/run/postgresql', '-p', '5432', '-XqAt', '-w',
                '-v', 'ON_ERROR_STOP=1', '-U', user, '-d', database]
        if runtime.run(argv, sql.encode('ascii')) != b'1\n':
            raise BindingError('DATABASE_BINDING_NOT_PROVEN')
        if child.finish(b'release\n') != b'RELEASED\n':
            raise BindingError('TRANSACTION_COMPLETION_NOT_PROVEN')
    finally:
        child.close()
    # A successful connection probe must not hide a simultaneous recreate,
    # restart, environment, mount, network or other inspected runtime change.
    if stable(runtime.inspect(api_id)) != stable(api) or stable(runtime.inspect(source_id)) != stable(source):
        raise BindingError('RUNTIME_CHANGED')
    return {'schema': 'pc-crop.ir20-api-database-binding.v1', 'target_sha': target,
            'api_default_database_binding': 'VERIFIED_LIVE_BACKEND_MARKER',
            'canonical_api_identity': 'CALLER_REQUIRED_NOT_PROVEN',
            'runtime_stability': 'UNCHANGED', 'business_data_mutation': 'NONE',
            'persistent_configuration_mutation': 'NONE',
            'session_effect': 'BOUNDED_TRANSACTION_LOCAL_APPLICATION_NAME',
            'backup_created': False, 'deployment_authorized': False,
            'restore_authorized': False, 'live_delivery': 'NOT_PERFORMED'}


def main(arguments: list[str]) -> int:
    try:
        if os.geteuid() != 0 or len(arguments) != 4:
            raise BindingError('ROOT_AND_FOUR_ARGUMENTS_REQUIRED')
        report = bind(*arguments, Runtime())
        print(json.dumps(report, sort_keys=True))
        return 0
    except BindingError as exc:
        print('IR20_BINDING_ERROR=' + str(exc), file=sys.stderr)
    except (OSError, KeyError, TypeError, ValueError, RecursionError, subprocess.SubprocessError):
        print('IR20_BINDING_ERROR=EXECUTION_OR_METADATA', file=sys.stderr)
    return 1


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
