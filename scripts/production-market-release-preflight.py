#!/usr/bin/env python3
"""Bounded, read-only REG.RU inventory. A collection result NEVER authorizes release.

The default host mode uses only Docker inspection, bounded Compose config rendering, READ ONLY metadata
transactions, local Caddy configuration GET and filesystem metadata. Raw configuration, stderr, credentials,
addresses, protected paths and customer records are never emitted.
The separate PR-only publication mode reads pinned registry metadata, never layers or a host.
"""
from __future__ import annotations
import datetime as dt
import ctypes
import base64
import hashlib
import ipaddress
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import selectors
import signal
import time
import stat
import subprocess
import sys
import urllib.request
import urllib.error
import urllib.parse
from typing import Any

SHA = re.compile(r"[0-9a-f]{40}\Z")
CHECKSUM = re.compile(r"[0-9a-f]{64}\Z")
NAME = re.compile(r"(?:0001_postgresql_initial|[0-9]{8,14}_[A-Za-z0-9_]{1,180})\Z")
MIGRATION_FAILURE_CODES = frozenset({
    'NOT_OBSERVED', 'METADATA_BAD_FORMAT', 'PERMISSION_DENIED', 'LEDGER_MISSING',
    'READ_ONLY_NOT_PROVEN', 'QUERY_FAILED', 'INVENTORY_LIMIT', 'LEGACY_INITIAL_MARKER_PRESENT',
})
DOMAIN = "xn----8sbjf4befbjgs9b.xn--p1ai"
API_ORIGIN = "http://api:3001/api"
MAX_BYTES = 1024 * 1024
DB_PROGRAM = r'''
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
let phase = 'READ_ONLY_SETUP';
let failureCode = 'READ_ONLY_NOT_PROVEN';
(async () => {
  const result = await p.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '8s'");
    const mode = await tx.$queryRawUnsafe("SELECT current_setting('transaction_read_only') AS value");
    if (mode[0]?.value !== 'on') throw new Error('READ_ONLY_REQUIRED');
    failureCode = 'QUERY_FAILED';
    phase = 'ROLE_QUERY';
    const roles = await tx.$queryRawUnsafe('SELECT rolsuper, rolbypassrls FROM pg_catalog.pg_roles WHERE rolname=current_user');
    phase = 'LEDGER_QUERY';
    const rows = await tx.$queryRawUnsafe('SELECT migration_name, checksum, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back FROM public._prisma_migrations ORDER BY migration_name, started_at LIMIT 5001');
    phase = 'LEDGER_BOUNDS';
    if (rows.length > 5000) {
      failureCode = 'INVENTORY_LIMIT';
      throw new Error('INVENTORY_LIMIT');
    }
    phase = 'SCHEMA_QUERY';
    const schema = await tx.$queryRawUnsafe("SELECT to_regclass('auction.public_market_lot_cards') IS NOT NULL AS projection_present, to_regprocedure('auction.list_public_market_lot_cards(integer)') IS NOT NULL AS reader_present");
    return { read_only: true, restricted_role: roles.length === 1 && !roles[0].rolsuper && !roles[0].rolbypassrls, rows, schema: schema[0] };
  }, { timeout: 12000, maxWait: 3000 });
  process.stdout.write(JSON.stringify(result));
})().catch((error) => {
  if (phase === 'LEDGER_QUERY') {
    const pgCode = typeof error?.meta?.code === 'string' ? error.meta.code
      : typeof error?.code === 'string' ? error.code : '';
    if (pgCode === '42501') failureCode = 'PERMISSION_DENIED';
    if (pgCode === '42P01') failureCode = 'LEDGER_MISSING';
  }
  process.stdout.write(JSON.stringify({ status: 'NOT_PROVEN', failure_code: failureCode }));
}).finally(async () => { await p.$disconnect(); });
'''


def run(argv: list[str], source: str | None = None) -> str | None:
    # The only stdin program is under PIPE_BUF; no shell or arbitrary script input.
    data = source.encode('utf-8') if source is not None else b''
    if len(data) > 4096:
        return None
    proc = None
    try:
        proc = subprocess.Popen(argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                stderr=subprocess.DEVNULL, bufsize=0)
        deadline = time.monotonic() + 18
        if data:
            proc.stdin.write(data)
        proc.stdin.close()
        chunks, total = [], 0
        with selectors.DefaultSelector() as poller:
            poller.register(proc.stdout, selectors.EVENT_READ)
            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0 or not poller.select(remaining):
                    return None
                block = os.read(proc.stdout.fileno(), 65536)
                if not block:
                    break
                total += len(block)
                if total > MAX_BYTES:
                    return None
                chunks.append(block)
        remaining = deadline - time.monotonic()
        if remaining <= 0 or proc.wait(timeout=remaining) != 0:
            return None
        return b''.join(chunks).decode('utf-8', errors='strict')
    except (OSError, UnicodeError, ValueError, subprocess.SubprocessError):
        return None
    finally:
        if proc is not None:
            if proc.poll() is None:
                proc.kill()
                proc.wait()
            if proc.stdout:
                proc.stdout.close()
            if proc.stdin and not proc.stdin.closed:
                proc.stdin.close()


def env_of(value: dict[str, Any]) -> dict[str, str]:
    result = {}
    for row in (value.get('Config') or {}).get('Env') or []:
        name, sep, text = str(row).partition('=')
        if sep:
            if name in result:
                return {}  # ambiguous environment is not a trusted configuration
            result[name] = text
    return result


def containers(service: str, project: str | None = None) -> list[dict[str, Any]]:
    argv = ['docker', 'ps', '-q', '--filter', 'label=com.docker.compose.service=' + service]
    if project:
        argv += ['--filter', 'label=com.docker.compose.project=' + project]
    raw = run(argv)
    ids = (raw or '').split()
    if len(ids) != 1 or not re.fullmatch(r'[0-9a-f]{12,64}', ids[0]):
        return []
    try:
        rows = json.loads(run(['docker', 'inspect', ids[0]]) or 'null')
        return rows if isinstance(rows, list) and len(rows) == 1 and isinstance(rows[0], dict) else []
    except (ValueError, TypeError):
        return []


def revision(value: dict[str, Any]) -> str:
    s = ((value.get('Config') or {}).get('Labels') or {}).get('org.opencontainers.image.revision', '')
    return s if isinstance(s, str) and SHA.fullmatch(s) else 'NOT_PROVEN'


def ingress(value: dict[str, Any]) -> str:
    mode = (value.get('HostConfig') or {}).get('NetworkMode')
    if not isinstance(mode, str) or mode in ('host', 'none') or mode.startswith('container:'):
        return 'NOT_PROVEN'
    ports = (value.get('NetworkSettings') or {}).get('Ports')
    if not isinstance(ports, dict):
        return 'NOT_PROVEN'
    for binds in ports.values():
        if binds is not None and not isinstance(binds, list):
            return 'NOT_PROVEN'
        for b in binds or []:
            try:
                if not ipaddress.ip_address(b['HostIp']).is_loopback:
                    return 'PUBLIC_BINDING'
            except (ValueError, KeyError, TypeError):
                return 'NOT_PROVEN'
    return 'NO_PUBLIC_DOCKER_BINDING'


def trust(web: dict[str, Any], api: dict[str, Any]) -> str:
    e = env_of(api)
    if e.get('TRUST_PROXY_MODE', '').strip().lower() != 'cidr':
        return 'CIDR_MODE_NOT_PROVEN'
    try:
        networks = [ipaddress.ip_network(x.strip(), strict=False) for x in e.get('TRUSTED_PROXY_CIDRS', '').split(',') if x.strip()]
        if not networks or any(n.prefixlen == 0 for n in networks):
            return 'UNSAFE_OR_MISSING_CIDRS'
        wn = (web.get('NetworkSettings') or {}).get('Networks') or {}
        an = (api.get('NetworkSettings') or {}).get('Networks') or {}
        ips = [ipaddress.ip_address(wn[n][key]) for n in set(wn) & set(an)
               for key in ('IPAddress', 'GlobalIPv6Address') if wn[n].get(key)]
        if not ips:
            return 'WEB_PEER_NOT_OBSERVED'
        return ('OBSERVED_WEB_PEERS_TRUSTED' if all(any(ip.version == n.version and ip in n for n in networks) for ip in ips)
                else 'WEB_PEER_NOT_TRUSTED')
    except (ValueError, TypeError, KeyError):
        return 'NOT_PROVEN'


def origin(web: dict[str, Any]) -> str:
    e = env_of(web)
    raw = e.get('API_URL', '').strip()
    # Matches the existing server-api-origin.ts production default.
    if not raw and e.get('NODE_ENV', '').strip() == 'production':
        return 'CANONICAL'
    return 'CANONICAL' if raw.rstrip('/') == API_ORIGIN else 'NOT_CANONICAL'


def caddy_config() -> dict[str, Any] | None:
    try:
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
        with opener.open('http://127.0.0.1:2019/config/', timeout=3) as response:
            raw = response.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES:
            return None
        value = json.loads(raw)
        return value if isinstance(value, dict) else None
    except (OSError, ValueError, TypeError):
        return None


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def caddy_assessment(config: dict[str, Any] | None, web: dict[str, Any]) -> str:
    if config is None:
        return 'NOT_OBSERVED'
    targets = {'web:3000'}
    try:
        for n in ((web.get('NetworkSettings') or {}).get('Networks') or {}).values():
            for key in ('IPAddress', 'GlobalIPv6Address'):
                if n.get(key):
                    ip = ipaddress.ip_address(n[key])
                    targets.add(f'[{ip}]:3000' if ip.version == 6 else f'{ip}:3000')
        for b in ((web.get('NetworkSettings') or {}).get('Ports') or {}).get('3000/tcp') or []:
            if ipaddress.ip_address(b['HostIp']).is_loopback and str(b['HostPort']).isdigit():
                targets.add(f"{b['HostIp']}:{b['HostPort']}")
        matched = False
        unsafe = False
        def walk(node: Any, canonical: bool | None = None) -> None:
            nonlocal matched, unsafe
            if isinstance(node, list):
                for child in node:
                    walk(child, canonical)
            elif isinstance(node, dict):
                # A child matcher narrows, never broadens, an inherited host match.
                host_sets = [m.get('host') for m in node.get('match', []) if isinstance(m, dict) and m.get('host')]
                if host_sets:
                    local_match = any(DOMAIN in hosts for hosts in host_sets)
                    canonical = local_match if canonical is None else canonical and local_match
                if node.get('handler') == 'reverse_proxy' and canonical:
                    ups = node.get('upstreams') or []
                    if ups and all(isinstance(u, dict) and u.get('dial') in targets for u in ups):
                        matched = True
                        if node.get('dynamic_upstreams') or node.get('trusted_proxies'):
                            unsafe = True
                for key, child in node.items():
                    if str(key).lower() == 'x-forwarded-for' or (str(key).lower() == 'delete' and isinstance(child, list) and any(isinstance(item, str) and item.lower() == 'x-forwarded-for' for item in child)):
                        unsafe = True  # a custom overwrite/append needs explicit review
                    walk(child, canonical)
        servers = config.get('apps', {}).get('http', {}).get('servers', {})
        if not isinstance(servers, dict):
            return 'NOT_PROVEN'
        for server in servers.values():
            if server.get('trusted_proxies') or server.get('client_ip_headers'):
                unsafe = True
            walk(server.get('routes', []))
        return 'HEADER_OR_PROXY_OVERRIDE_REQUIRES_REVIEW' if unsafe else ('CANONICAL_WEB_ROUTE_OBSERVED' if matched else 'CANONICAL_WEB_ROUTE_NOT_PROVEN')
    except (ValueError, TypeError, KeyError, AttributeError, RecursionError):
        return 'NOT_PROVEN'


def migration_metadata(raw: str | None) -> dict[str, Any]:
    if raw is None:
        return {'status': 'NOT_PROVEN', 'failure_code': 'NOT_OBSERVED'}
    try:
        v = json.loads(raw or 'null')
        if v == {'status': 'NOT_PROVEN'}:
            return v
        if isinstance(v, dict) and v.get('status') == 'NOT_PROVEN':
            if (set(v) != {'status', 'failure_code'} or not isinstance(v.get('failure_code'), str)
                    or v['failure_code'] not in MIGRATION_FAILURE_CODES):
                raise ValueError()
            return {'status': 'NOT_PROVEN', 'failure_code': v['failure_code']}
        if isinstance(v, dict) and v.get('read_only') is False:
            return {'status': 'NOT_PROVEN', 'failure_code': 'READ_ONLY_NOT_PROVEN'}
        if not isinstance(v, dict) or v.get('read_only') is not True or type(v.get('restricted_role')) is not bool:
            raise ValueError()
        rows = v.get('rows')
        schema = v.get('schema')
        if not isinstance(rows, list) or len(rows) > 5000 or not isinstance(schema, dict):
            if isinstance(rows, list) and len(rows) > 5000:
                return {'status': 'NOT_PROVEN', 'failure_code': 'INVENTORY_LIMIT'}
            raise ValueError()
        legacy_initial_marker = False
        for r in rows:
            if not isinstance(r, dict) or not isinstance(r.get('migration_name'), str) or not isinstance(r.get('checksum'), str) or not NAME.fullmatch(r['migration_name']):
                raise ValueError()
            if type(r.get('finished')) is not bool or type(r.get('rolled_back')) is not bool:
                raise ValueError()
            if not CHECKSUM.fullmatch(r['checksum']):
                if r['migration_name'] == '0001_postgresql_initial' and r['checksum'] == 'grainflow_v3_initial_postgresql':
                    legacy_initial_marker = True
                else:
                    raise ValueError()
        if any(type(schema.get(k)) is not bool for k in ('projection_present', 'reader_present')):
            raise ValueError()
        if legacy_initial_marker:
            return {'status': 'NOT_PROVEN', 'failure_code': 'LEGACY_INITIAL_MARKER_PRESENT'}
        safe = [{k: r[k] for k in ('migration_name', 'checksum', 'finished', 'rolled_back')} for r in rows]
        return {'status': 'OBSERVED_READ_ONLY', 'restricted_role': v['restricted_role'], 'rows': safe,
                'failed_unresolved': sum(not r['finished'] and not r['rolled_back'] for r in safe),
                'projection_present': schema['projection_present'], 'reader_present': schema['reader_present']}
    except (ValueError, TypeError, KeyError):
        return {'status': 'NOT_PROVEN', 'failure_code': 'METADATA_BAD_FORMAT'}


def backups(root: Path) -> dict[str, Any]:
    result: dict[str, Any] = {'artifact': 'NOT_OBSERVED', 'archive_catalog': 'NOT_CHECKED', 'restore_verification': 'NOT_PROVEN'}
    try:
        candidates = []
        for i, p in enumerate(root.iterdir()):
            if i >= 500:
                return result | {'artifact': 'INVENTORY_LIMIT'}
            s = p.lstat()
            if p.name.endswith('.backup') and stat.S_ISREG(s.st_mode) and s.st_size > 0:
                candidates.append((s.st_mtime, p, s))
        if not candidates:
            return result
        _, p, s = max(candidates, key=lambda row: row[0])
        age = dt.datetime.now(dt.timezone.utc).timestamp() - s.st_mtime
        protected = s.st_uid == 0 and stat.S_IMODE(s.st_mode) & 0o077 == 0
        result.update(artifact='PRESENT', age_seconds=int(age), time_consistency='VALID' if age >= 0 else 'FUTURE_TIMESTAMP', bytes=s.st_size, protected=protected)
        # Do not parse unprotected/symlink input as root. A catalog is not a restore.
        if protected and age >= 0 and shutil.which('pg_restore'):
            result['archive_catalog'] = 'READABLE' if run(['pg_restore', '--list', str(p)]) is not None else 'NOT_PROVEN'
        return result
    except (OSError, ValueError):
        return result



def runtime_identity(value: dict[str, Any]) -> str | None:
    # Only an internal comparison digest is used; it is never published.
    required = ('Id', 'Image', 'Config', 'HostConfig', 'NetworkSettings', 'State')
    if any(k not in value for k in required) or (value.get('State') or {}).get('Running') is not True:
        return None
    stable = {k: value[k] for k in required if k != 'State'}
    stable['StartedAt'] = value['State'].get('StartedAt')
    if not stable['StartedAt']:
        return None
    return hashlib.sha256(json.dumps(stable, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


CHECK_VALUES = {
    'web_ingress': {'NO_PUBLIC_DOCKER_BINDING', 'PUBLIC_BINDING', 'NOT_PROVEN'},
    'canonical_api_origin': {'CANONICAL', 'NOT_CANONICAL'},
    'api_web_peer_trust': {'CIDR_MODE_NOT_PROVEN', 'UNSAFE_OR_MISSING_CIDRS', 'WEB_PEER_NOT_OBSERVED', 'OBSERVED_WEB_PEERS_TRUSTED', 'WEB_PEER_NOT_TRUSTED', 'NOT_PROVEN'},
    'caddy_route_and_headers': {'NOT_OBSERVED', 'NOT_PROVEN', 'HEADER_OR_PROXY_OVERRIDE_REQUIRES_REVIEW', 'CANONICAL_WEB_ROUTE_OBSERVED', 'CANONICAL_WEB_ROUTE_NOT_PROVEN'},
    'runtime_configuration_stability': {'UNCHANGED', 'NOT_PROVEN'},
    'caddy_configuration_stability': {'UNCHANGED', 'NOT_PROVEN'},
}


def validate_report(value: Any, target: str) -> dict[str, Any]:
    """Hosted-side strict admission of remote diagnostic data, never release approval."""
    keys = {'schema', 'target_sha', 'observed_at_utc', 'running_web_revision', 'running_api_revision',
            'checks', 'migration_inventory', 'capacity', 'backup', 'production_mutation',
            'deployment_authorized', 'live_acceptance', 'protected_values', 'outbox_topology', 'release_inventory',
            'registration_binding', 'api_publication_config', 'filesystem_capacity', 'capacity_diagnostics'}
    if not isinstance(value, dict) or set(value) != keys or not SHA.fullmatch(target):
        raise ValueError('REPORT_SCHEMA')
    for key, expected in {'schema': 'pc-crop.market-release-preflight.v6', 'target_sha': target,
                          'production_mutation': 'NONE', 'live_acceptance': 'NOT_PERFORMED',
                          'protected_values': 'NOT_PUBLISHED'}.items():
        if value[key] != expected:
            raise ValueError('REPORT_BINDING')
    if value['deployment_authorized'] is not False:
        raise ValueError('REPORT_AUTHORITY')
    timestamp = value['observed_at_utc']
    if not isinstance(timestamp, str) or not re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,6})?\+00:00', timestamp):
        raise ValueError('REPORT_TIME')
    observed = dt.datetime.fromisoformat(timestamp)
    if abs((dt.datetime.now(dt.timezone.utc) - observed).total_seconds()) > 300:
        raise ValueError('REPORT_STALE_OR_CLOCK_SKEW')
    for key in ('running_web_revision', 'running_api_revision'):
        if not isinstance(value[key], str) or (value[key] != 'NOT_PROVEN' and not SHA.fullmatch(value[key])):
            raise ValueError('REPORT_REVISION')
    checks = value['checks']
    if not isinstance(checks, dict) or set(checks) != set(CHECK_VALUES):
        raise ValueError('REPORT_CHECKS')
    if any(not isinstance(checks[k], str) or checks[k] not in choices for k, choices in CHECK_VALUES.items()):
        raise ValueError('REPORT_CHECK_VALUE')
    capacity = value['capacity']
    if not isinstance(capacity, dict) or set(capacity) - {'disk_free_bytes', 'memory_available_bytes', 'cpu_count'}:
        raise ValueError('REPORT_CAPACITY')
    if any(type(v) is not int or not 0 <= v <= 2**63-1 for v in capacity.values()):
        raise ValueError('REPORT_CAPACITY_VALUE')
    backup = value['backup']
    if not isinstance(backup, dict) or set(backup) - {'artifact', 'archive_catalog', 'restore_verification', 'age_seconds', 'time_consistency', 'bytes', 'protected'}:
        raise ValueError('REPORT_BACKUP')
    if backup.get('artifact') not in ('PRESENT', 'NOT_OBSERVED', 'INVENTORY_LIMIT') or backup.get('archive_catalog') not in ('NOT_CHECKED', 'READABLE', 'NOT_PROVEN') or backup.get('restore_verification') != 'NOT_PROVEN':
        raise ValueError('REPORT_BACKUP_STATE')
    if backup['artifact'] == 'PRESENT':
        if set(backup) != {'artifact', 'archive_catalog', 'restore_verification', 'age_seconds', 'time_consistency', 'bytes', 'protected'}:
            raise ValueError('REPORT_BACKUP_FIELDS')
        if type(backup['protected']) is not bool or type(backup['bytes']) is not int or not 0 < backup['bytes'] < 2**63:
            raise ValueError('REPORT_BACKUP_SIZE')
        if type(backup['age_seconds']) is not int or not -2**63 < backup['age_seconds'] < 2**63 or backup['time_consistency'] not in ('VALID', 'FUTURE_TIMESTAMP'):
            raise ValueError('REPORT_BACKUP_AGE')
        if backup['time_consistency'] == 'FUTURE_TIMESTAMP' or backup['age_seconds'] < 0 or backup['protected'] is not True:
            if backup['archive_catalog'] != 'NOT_CHECKED':
                raise ValueError('REPORT_BACKUP_CATALOG_AUTHORITY')
    elif set(backup) != {'artifact', 'archive_catalog', 'restore_verification'} or backup['archive_catalog'] != 'NOT_CHECKED':
        raise ValueError('REPORT_BACKUP_ABSENT')
    inventory = value['migration_inventory']
    if isinstance(inventory, dict) and inventory.get('status') == 'NOT_PROVEN':
        if inventory != {'status': 'NOT_PROVEN'} and (
                set(inventory) != {'status', 'failure_code'}
                or not isinstance(inventory.get('failure_code'), str)
                or inventory['failure_code'] not in MIGRATION_FAILURE_CODES):
            raise ValueError('REPORT_DB_DIAGNOSTIC_SCHEMA')
    else:
        expected_keys = {'status', 'restricted_role', 'rows', 'failed_unresolved', 'projection_present', 'reader_present'}
        if not isinstance(inventory, dict) or set(inventory) != expected_keys or inventory.get('status') != 'OBSERVED_READ_ONLY':
            raise ValueError('REPORT_DB_SCHEMA')
        if type(inventory.get('failed_unresolved')) is not int:
            raise ValueError('REPORT_DB_COUNT')
        rebuilt = migration_metadata(json.dumps({'read_only': True, 'restricted_role': inventory['restricted_role'], 'rows': inventory['rows'], 'schema': {'projection_present': inventory['projection_present'], 'reader_present': inventory['reader_present']}}))
        if rebuilt != inventory:
            raise ValueError('REPORT_DB_INTEGRITY')
    validate_outbox_topology(value['outbox_topology'])
    validate_release_inventory(value['release_inventory'])
    validate_registration_preconditions(value['registration_binding'], checks, value['outbox_topology'])
    validate_api_publication_config(value['api_publication_config'], checks, value['outbox_topology'])
    validate_filesystem_capacity(value['filesystem_capacity'])
    validate_capacity_profile(value['capacity_diagnostics'])
    # No unknown key, string, path, address, error or payload can pass to artifacts.
    return value


def source_lineage(inventory: dict[str, Any], root: Path) -> dict[str, Any]:
    """Compare live metadata with the exact trusted checkout; never edit migrations."""
    if inventory.get('status') != 'OBSERVED_READ_ONLY':
        return {'status': 'NOT_PROVEN'}
    try:
        source = {}
        for folder in root.iterdir():
            if not folder.is_dir():
                continue
            if folder.is_symlink() or not NAME.fullmatch(folder.name):
                return {'status': 'NOT_PROVEN'}
            path = folder / 'migration.sql'
            if path.is_symlink() or not path.is_file() or path.stat().st_size > 8 * MAX_BYTES:
                return {'status': 'NOT_PROVEN'}
            source[folder.name] = hashlib.sha256(path.read_bytes()).hexdigest()
            if len(source) > 5000:
                return {'status': 'NOT_PROVEN'}
        if not source:
            return {'status': 'NOT_PROVEN'}
        applied = [r for r in inventory['rows'] if r['finished'] and not r['rolled_back']]
        seen = {r['migration_name'] for r in applied}
        unknown = sorted(seen - set(source))
        mismatches = sorted({r['migration_name'] for r in applied if r['migration_name'] in source and r['checksum'] != source[r['migration_name']]})
        return {'status': 'COMPARED_NOT_MIGRATED', 'source_count': len(source), 'applied_count': len(applied),
                'pending': sorted(set(source) - seen), 'applied_unknown_to_source': unknown,
                'checksum_mismatch': mismatches, 'duplicate_applied_names': len(applied) != len(seen),
                'failed_unresolved': inventory['failed_unresolved']}
    except (OSError, ValueError, TypeError, KeyError):
        return {'status': 'NOT_PROVEN'}


OUTBOX_REPOSITORY = 'ghcr.io/pachaninm-lab/grainflow-outbox-worker'
# Reviewed protocol-2 body from the canonical IR-20 migration. Other source
# versions remain observations and cannot establish legacy rollback semantics.
CANONICAL_FENCE_PROTOCOL2_SHA256 = '6cf542446dd81c9f4efcf0b16d0633c6cc5bbf59d45b7fe5d34758358ab765ba'
IMAGE_ID = re.compile(r'sha256:[0-9a-f]{64}\Z')
CONTAINER_ID = re.compile(r'[0-9a-f]{64}\Z')
PROJECT = re.compile(r'[a-z0-9][a-z0-9_-]{0,127}\Z')
PRINCIPAL_TRUE = {'is_app_outbox', 'session_is_app_outbox', 'row_security_on', 'outbox_select', 'required_updates'}
PRINCIPAL_FALSE = {'superuser', 'bypass_rls', 'createdb', 'createrole', 'replication',
                   'role_inherit', 'role_memberships', 'owns_outbox', 'forbidden_updates', 'outbox_other_privileges',
                   'outbox_insert', 'outbox_delete', 'deal_privileges', 'redrive_privileges', 'auth_usage'}
PRINCIPAL_SQL = r'''
SELECT current_user='app_outbox' AS is_app_outbox,session_user='app_outbox' AS session_is_app_outbox,
r.rolsuper AS superuser,
r.rolbypassrls AS bypass_rls,r.rolcreatedb AS createdb,r.rolcreaterole AS createrole,
r.rolreplication AS replication,r.rolinherit AS role_inherit,
EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid) AS role_memberships,
c.relowner=r.oid AS owns_outbox,current_setting('row_security')='on' AS row_security_on,
has_table_privilege(current_user,c.oid,'SELECT') AS outbox_select,
(SELECT bool_and(has_column_privilege(current_user,c.oid,n,'UPDATE')) FROM unnest(ARRAY[
'status','retryCount','nextRetryAt','lastError','lastErrorCode','lastErrorCategory','lastAttemptAt',
'manualReviewAt','sentAt','confirmedAt','failedAt','deadLetterAt','leaseOwner','leaseToken',
'leaseExpiresAt','heartbeatAt']) n) AS required_updates,
has_table_privilege(current_user,c.oid,'UPDATE') OR EXISTS(
SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
AND a.attname NOT IN ('status','retryCount','nextRetryAt','lastError','lastErrorCode','lastErrorCategory',
'lastAttemptAt','manualReviewAt','sentAt','confirmedAt','failedAt','deadLetterAt','leaseOwner',
'leaseToken','leaseExpiresAt','heartbeatAt')
AND has_column_privilege(current_user,c.oid,a.attnum,'UPDATE')) AS forbidden_updates,
has_table_privilege(current_user,c.oid,'INSERT') OR has_any_column_privilege(current_user,c.oid,'INSERT') AS outbox_insert,
has_table_privilege(current_user,c.oid,'DELETE') AS outbox_delete,
has_table_privilege(current_user,c.oid,'TRUNCATE,REFERENCES,TRIGGER') OR
has_any_column_privilege(current_user,c.oid,'REFERENCES') AS outbox_other_privileges,
has_table_privilege(current_user,'public.deals','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
has_any_column_privilege(current_user,'public.deals','SELECT,INSERT,UPDATE,REFERENCES') AS deal_privileges,
has_table_privilege(current_user,'public.outbox_redrive_events','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
has_any_column_privilege(current_user,'public.outbox_redrive_events','SELECT,INSERT,UPDATE,REFERENCES') AS redrive_privileges,
has_schema_privilege(current_user,'auth','USAGE') AS auth_usage
FROM pg_roles r JOIN pg_class c ON c.oid=to_regclass('public.outbox_entries') WHERE r.rolname=current_user
'''
CATALOG_SQL = r'''
SELECT to_regclass('public.outbox_entries') IS NOT NULL AS table_present,
coalesce(c.relrowsecurity,false) AS rls_enabled,coalesce(c.relforcerowsecurity,false) AS rls_forced,
coalesce((SELECT count(*)=4 FROM pg_attribute WHERE attrelid=c.oid AND NOT attisdropped
AND attname IN ('lastErrorCode','lastErrorCategory','lastAttemptAt','manualReviewAt')),false) AS durable_columns_present,
p.prosrc AS fence_body,p.prosecdef AS fence_security_definer,l.lanname AS fence_language,
coalesce((SELECT json_agg(json_build_object('enabled',t.tgenabled,'type',t.tgtype,'function_matches',t.tgfoid=p.oid,
'no_when',t.tgqual IS NULL,'columns',(SELECT array_agg(a.attname ORDER BY a.attname)
FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum=ANY(t.tgattr))))
FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal
AND t.tgname='outbox_expired_attempt_reclaim_guard_trigger'),'[]'::json) AS triggers
FROM (SELECT 1) seed LEFT JOIN pg_class c ON c.oid=to_regclass('public.outbox_entries')
LEFT JOIN pg_proc p ON p.oid=to_regprocedure('public.outbox_expired_attempt_reclaim_guard()')
LEFT JOIN pg_language l ON l.oid=p.prolang
'''


def read_only_program(sql: str) -> str:
    # Return only catalog/privilege facts. The database identity stays inside the collector.
    return r'''const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{const x=await p.$transaction(async t=>{
await t.$executeRawUnsafe('SET TRANSACTION READ ONLY');
await t.$executeRawUnsafe("SET LOCAL statement_timeout='8s'");
const mode=await t.$queryRawUnsafe("SELECT current_setting('transaction_read_only') AS value");
if(mode[0]?.value!=='on')throw Error('READ_ONLY_REQUIRED');
const identity=await t.$queryRawUnsafe("SELECT current_database() AS name,inet_server_addr()::text AS address,inet_server_port() AS port");
const rows=await t.$queryRawUnsafe(''' + json.dumps(sql) + r''');
if(rows.length!==1||identity.length!==1)throw Error('METADATA_NOT_PROVEN');
return {read_only:true,identity:identity[0],row:rows[0]};
},{timeout:12000,maxWait:3000});process.stdout.write(JSON.stringify(x));
})().catch(()=>{process.exitCode=1}).finally(async()=>{await p.$disconnect()});'''


def read_only_metadata(container: dict[str, Any], sql: str) -> dict[str, Any] | None:
    cid = container.get('Id')
    if not isinstance(cid, str) or not CONTAINER_ID.fullmatch(cid) or (container.get('State') or {}).get('Running') is not True:
        return None
    try:
        value = json.loads(run(['docker', 'exec', '-i', cid, '/nodejs/bin/node', '-'], read_only_program(sql)) or 'null')
        if not isinstance(value, dict) or set(value) != {'read_only', 'identity', 'row'} or value['read_only'] is not True:
            return None
        identity = value['identity']
        if not isinstance(identity, dict) or set(identity) != {'name', 'address', 'port'} or not isinstance(identity['name'], str) or not identity['name']:
            return None
        if not isinstance(identity['address'], str) or type(identity['port']) is not int or not 1 <= identity['port'] <= 65535:
            return None
        ipaddress.ip_address(identity['address'])
        return value if isinstance(value['row'], dict) else None
    except (ValueError, TypeError, KeyError):
        return None


def project_containers(project: str) -> list[dict[str, Any]] | None:
    if not isinstance(project, str) or not PROJECT.fullmatch(project):
        return None
    raw = run(['docker', 'ps', '-aq', '--no-trunc', '--filter', 'label=com.docker.compose.project=' + project])
    if raw is None:
        return None
    ids = raw.split()
    if not 1 <= len(ids) <= 64 or len(set(ids)) != len(ids) or any(not CONTAINER_ID.fullmatch(cid) for cid in ids):
        return None
    try:
        rows = json.loads(run(['docker', 'inspect', *ids]) or 'null')
        if not isinstance(rows, list) or len(rows) != len(ids) or any(not isinstance(row, dict) for row in rows):
            return None
        if {row.get('Id') for row in rows} != set(ids):
            return None
        if any(((row.get('Config') or {}).get('Labels') or {}).get('com.docker.compose.project') != project for row in rows):
            return None
        return rows
    except (ValueError, TypeError, KeyError):
        return None


def bound_image(container: dict[str, Any], repository: str | None) -> dict[str, Any]:
    result = {'revision': 'NOT_PROVEN', 'registry_digest': 'NOT_PROVEN', 'container_image_binding': False,
              'immutable_config_ref': False, 'running': (container.get('State') or {}).get('Running') is True,
              'health': 'NOT_PROVEN'}
    health = ((container.get('State') or {}).get('Health') or {}).get('Status')
    if health in ('healthy', 'unhealthy', 'starting'):
        result['health'] = health
    image_id = container.get('Image')
    if not isinstance(image_id, str) or not IMAGE_ID.fullmatch(image_id):
        return result
    try:
        images = json.loads(run(['docker', 'image', 'inspect', image_id]) or 'null')
        if not isinstance(images, list) or len(images) != 1 or not isinstance(images[0], dict) or images[0].get('Id') != image_id:
            return result
        image = images[0]
        result['container_image_binding'] = True
        result['revision'] = revision(image)
        digests = image.get('RepoDigests')
        if isinstance(digests, list):
            refs = [ref for ref in digests if isinstance(ref, str) and re.fullmatch(r'[^\s@]+@sha256:[0-9a-f]{64}', ref)
                    and (repository is None or ref.startswith(repository + '@'))]
            if len(refs) == 1:
                result['registry_digest'] = refs[0].split('@')[1]
                result['immutable_config_ref'] = (container.get('Config') or {}).get('Image') == refs[0]
        return result
    except (ValueError, TypeError, KeyError):
        return result


def canonical_worker_configuration(container: dict[str, Any]) -> bool:
    config = container.get('Config') or {}
    values = env_of(container)
    return (config.get('Cmd') == ['dist-outbox-worker/outbox-worker.js']
            and config.get('Entrypoint') == ['/nodejs/bin/node'] and config.get('WorkingDir') == '/app'
            and all(values.get(key) == expected for key, expected in (
                ('NODE_ENV', 'production'), ('RUNTIME_COMPONENT', 'outbox-worker'),
                ('OUTBOX_WORKER_ENABLED', 'true'), ('KAFKA_REQUIRED', 'true'))))


def project_runtime_identity(container: dict[str, Any]) -> str | None:
    # A stopped one-shot migration container is legitimate inventory, not an
    # unstable worker. Compare identity/configuration without health log text.
    required = ('Id', 'Image', 'Config', 'HostConfig', 'NetworkSettings', 'State')
    if any(key not in container for key in required):
        return None
    state = container['State']
    if not isinstance(state, dict) or type(state.get('Running')) is not bool or not isinstance(state.get('StartedAt'), str):
        return None
    selected = {key: container[key] for key in required if key != 'State'}
    selected['State'] = {key: state.get(key) for key in ('Running', 'Status', 'StartedAt', 'FinishedAt', 'Restarting')}
    selected['RestartCount'] = container.get('RestartCount')
    return hashlib.sha256(json.dumps(selected, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def kafka_topology(worker: dict[str, Any], rows: list[dict[str, Any]]) -> dict[str, Any]:
    result = {'status': 'NOT_PROVEN', 'configured_brokers': 0, 'same_project_peers': 0,
              'running_peers': 0, 'broker_probe': 'NOT_PERFORMED'}
    brokers = env_of(worker).get('KAFKA_BROKERS', '').split(',')
    if not 1 <= len(brokers) <= 32 or not all(re.fullmatch(r'[A-Za-z0-9_.-]+:[0-9]{1,5}', item) for item in brokers):
        return result
    if any(not 1 <= int(item.rsplit(':', 1)[1]) <= 65535 for item in brokers):
        return result
    result['configured_brokers'] = len(brokers)
    networks = (worker.get('NetworkSettings') or {}).get('Networks') or {}
    mapped = []
    for broker in brokers:
        host = broker.rsplit(':', 1)[0]
        peers = []
        for row in rows:
            if row.get('Id') == worker.get('Id'):
                continue
            for name, network in ((row.get('NetworkSettings') or {}).get('Networks') or {}).items():
                own = networks.get(name) or {}
                aliases = network.get('Aliases') or []
                if (own.get('NetworkID') and own.get('NetworkID') == network.get('NetworkID')
                        and (host == network.get('IPAddress') or host in aliases)):
                    peers.append(row.get('Id'))
                    break
        if len(peers) != 1:
            return result
        mapped.append(peers[0])
    result.update(status='COMPOSE_PEERS_OBSERVED_NOT_CONNECTIVITY', same_project_peers=len(set(mapped)),
                  running_peers=sum((row.get('State') or {}).get('Running') is True for row in rows if row.get('Id') in mapped))
    return result


def outbox_topology(api: dict[str, Any], project: str | None) -> dict[str, Any]:
    rows = project_containers(project)
    if rows is None or api.get('Id') not in {row['Id'] for row in rows}:
        return {'status': 'NOT_PROVEN'}
    project_api = next(row for row in rows if row['Id'] == api.get('Id'))
    if runtime_identity(api) is None or runtime_identity(api) != runtime_identity(project_api):
        return {'status': 'NOT_PROVEN'}
    candidates = [row for row in rows if env_of(row).get('RUNTIME_COMPONENT') == 'outbox-worker'
                  or (row.get('Config') or {}).get('Cmd') == ['dist-outbox-worker/outbox-worker.js']
                  or str((row.get('Config') or {}).get('Image', '')).startswith(OUTBOX_REPOSITORY + '@')]
    worker = candidates[0] if len(candidates) == 1 else {}
    catalog_raw = read_only_metadata(api, CATALOG_SQL)
    catalog = {'status': 'NOT_PROVEN'}
    if catalog_raw is not None:
        row = catalog_raw['row']
        flags = ('table_present', 'rls_enabled', 'rls_forced', 'durable_columns_present')
        if all(type(row.get(key)) is bool for key in flags):
            triggers = row.get('triggers')
            trigger = triggers[0] if isinstance(triggers, list) and len(triggers) == 1 and isinstance(triggers[0], dict) else {}
            body = row.get('fence_body')
            catalog = {'status': 'OBSERVED_READ_ONLY', **{key: row[key] for key in flags},
                       'fence_body_sha256': hashlib.sha256(body.encode()).hexdigest() if isinstance(body, str) and len(body.encode()) <= 65536 else 'NOT_PROVEN',
                       'trigger_enabled': trigger.get('enabled') in ('O', 'A'),
                       'trigger_shape_matches': trigger.get('type') == 19 and trigger.get('function_matches') is True
                           and trigger.get('no_when') is True and trigger.get('columns') == ['leaseToken', 'status'],
                       'fence_invoker_plpgsql': row.get('fence_security_definer') is False and row.get('fence_language') == 'plpgsql'}
    principal_raw = read_only_metadata(worker, PRINCIPAL_SQL)
    principal = {'status': 'NOT_PROVEN'}
    if principal_raw is not None and set(principal_raw['row']) == PRINCIPAL_TRUE | PRINCIPAL_FALSE and all(type(v) is bool for v in principal_raw['row'].values()):
        flags = principal_raw['row']
        principal = {'status': 'OBSERVED_READ_ONLY', **flags,
                     'boundary_matches': all(flags[key] for key in PRINCIPAL_TRUE) and not any(flags[key] for key in PRINCIPAL_FALSE),
                     'same_database_as_api': catalog_raw is not None and principal_raw['identity'] == catalog_raw['identity']}
    after = project_containers(project)
    before_ids = {row['Id']: project_runtime_identity(row) for row in rows}
    after_ids = {row['Id']: project_runtime_identity(row) for row in after} if after is not None else {}
    return {'status': 'OBSERVED_COMPOSE_METADATA', 'api_image': bound_image(api, 'ghcr.io/pachaninm-lab/grainflow-api'),
            'worker_candidates': len(candidates), 'worker_image': bound_image(worker, OUTBOX_REPOSITORY),
            'worker_configuration_matches': len(candidates) == 1 and canonical_worker_configuration(worker),
            'principal': principal, 'catalog': catalog, 'kafka': kafka_topology(worker, rows),
            'runtime_stability': 'UNCHANGED' if None not in before_ids.values() and before_ids == after_ids else 'NOT_PROVEN',
            'persisted_compose_model': 'NOT_INSPECTED', 'rollback_compatibility': 'NOT_PROVEN'}


def validate_outbox_topology(value: Any) -> None:
    if value == {'status': 'NOT_PROVEN'}:
        return
    expected = {'status', 'api_image', 'worker_candidates', 'worker_image', 'worker_configuration_matches', 'principal', 'catalog', 'kafka', 'runtime_stability', 'persisted_compose_model', 'rollback_compatibility'}
    if not isinstance(value, dict) or set(value) != expected or value['status'] != 'OBSERVED_COMPOSE_METADATA':
        raise ValueError('OUTBOX_SCHEMA')
    if type(value['worker_candidates']) is not int or not 0 <= value['worker_candidates'] <= 64 or type(value['worker_configuration_matches']) is not bool:
        raise ValueError('OUTBOX_CANDIDATES')
    if value['worker_configuration_matches'] and value['worker_candidates'] != 1:
        raise ValueError('OUTBOX_AMBIGUOUS_WORKER')
    for key in ('api_image', 'worker_image'):
        image = value[key]
        if not isinstance(image, dict) or set(image) != {'revision', 'registry_digest', 'container_image_binding', 'immutable_config_ref', 'running', 'health'}:
            raise ValueError('OUTBOX_IMAGE_SCHEMA')
        if not isinstance(image['revision'], str) or (image['revision'] != 'NOT_PROVEN' and not SHA.fullmatch(image['revision'])):
            raise ValueError('OUTBOX_IMAGE_REVISION')
        if not isinstance(image['registry_digest'], str) or (image['registry_digest'] != 'NOT_PROVEN' and not IMAGE_ID.fullmatch(image['registry_digest'])):
            raise ValueError('OUTBOX_IMAGE_DIGEST')
        if any(type(image[k]) is not bool for k in ('container_image_binding', 'immutable_config_ref', 'running')) or image['health'] not in ('healthy', 'unhealthy', 'starting', 'NOT_PROVEN'):
            raise ValueError('OUTBOX_IMAGE_STATE')
    principal = value['principal']
    if principal != {'status': 'NOT_PROVEN'}:
        keys = PRINCIPAL_TRUE | PRINCIPAL_FALSE | {'boundary_matches', 'same_database_as_api'}
        if not isinstance(principal, dict) or set(principal) != keys | {'status'} or principal['status'] != 'OBSERVED_READ_ONLY' or any(type(principal[k]) is not bool for k in keys):
            raise ValueError('OUTBOX_PRINCIPAL_SCHEMA')
        if principal['boundary_matches'] != (all(principal[k] for k in PRINCIPAL_TRUE) and not any(principal[k] for k in PRINCIPAL_FALSE)):
            raise ValueError('OUTBOX_PRINCIPAL_CONTRADICTION')
    catalog = value['catalog']
    if catalog != {'status': 'NOT_PROVEN'}:
        keys = {'table_present', 'rls_enabled', 'rls_forced', 'durable_columns_present', 'trigger_enabled', 'trigger_shape_matches', 'fence_invoker_plpgsql'}
        if not isinstance(catalog, dict) or set(catalog) != keys | {'status', 'fence_body_sha256'} or catalog['status'] != 'OBSERVED_READ_ONLY' or any(type(catalog[k]) is not bool for k in keys):
            raise ValueError('OUTBOX_CATALOG_SCHEMA')
        if not isinstance(catalog['fence_body_sha256'], str) or (catalog['fence_body_sha256'] != 'NOT_PROVEN' and not CHECKSUM.fullmatch(catalog['fence_body_sha256'])):
            raise ValueError('OUTBOX_FENCE_HASH')
    kafka = value['kafka']
    if not isinstance(kafka, dict) or set(kafka) != {'status', 'configured_brokers', 'same_project_peers', 'running_peers', 'broker_probe'} or kafka['status'] not in ('NOT_PROVEN', 'COMPOSE_PEERS_OBSERVED_NOT_CONNECTIVITY') or kafka['broker_probe'] != 'NOT_PERFORMED':
        raise ValueError('OUTBOX_KAFKA_SCHEMA')
    if any(type(kafka[k]) is not int or not 0 <= kafka[k] <= 32 for k in ('configured_brokers', 'same_project_peers', 'running_peers')):
        raise ValueError('OUTBOX_KAFKA_COUNT')
    if not kafka['running_peers'] <= kafka['same_project_peers'] <= kafka['configured_brokers']:
        raise ValueError('OUTBOX_KAFKA_COUNT_CONTRADICTION')
    if value['runtime_stability'] not in ('UNCHANGED', 'NOT_PROVEN') or value['persisted_compose_model'] != 'NOT_INSPECTED' or value['rollback_compatibility'] != 'NOT_PROVEN':
        raise ValueError('OUTBOX_AUTHORITY')


def outbox_source_comparison(topology: dict[str, Any], root: Path) -> dict[str, str]:
    result = {'fence_definition': 'NOT_PROVEN', 'rollback_compatibility': 'NOT_PROVEN', 'legacy_claim_rollback': 'NOT_PROVEN'}
    try:
        paths = list(root.glob('*_canonical_durable_outbox/migration.sql'))
        if len(paths) != 1 or paths[0].is_symlink() or not paths[0].is_file() or paths[0].stat().st_size > MAX_BYTES:
            return result
        source = paths[0].read_text()
        body = re.findall(r'CREATE OR REPLACE FUNCTION public\.outbox_expired_attempt_reclaim_guard\(\)\s+RETURNS trigger\s+LANGUAGE plpgsql\s+AS \$guard\$(.*?)\$guard\$;', source, re.S)
        catalog = topology.get('catalog', {})
        if len(body) == 1 and catalog.get('fence_body_sha256') == hashlib.sha256(body[0].encode()).hexdigest():
            result['fence_definition'] = 'MATCHES_TRUSTED_SOURCE'
            if (catalog['fence_body_sha256'] == CANONICAL_FENCE_PROTOCOL2_SHA256
                    and all(catalog.get(key) is True for key in ('trigger_enabled', 'trigger_shape_matches', 'fence_invoker_plpgsql'))):
                result['legacy_claim_rollback'] = 'INCOMPATIBLE_WITH_OBSERVED_FENCE'
        return result
    except (OSError, ValueError, TypeError):
        return result


DB_PROBE_FLAGS = {'api_is_app_deal', 'row_security_on', 'outbox_role_exists', 'outbox_role_unsafe',
                  'outbox_table_present', 'fence_function_present'}
DB_PROBE_ERRORS = {'NOT_PROVEN', 'DEFAULT_DATABASE_URL_MISSING', 'MODULE_OR_CLIENT_UNAVAILABLE',
                   'AUTHENTICATION_FAILED', 'CONNECTION_FAILED', 'READ_ONLY_SETUP_FAILED',
                   'PERMISSION_DENIED', 'OBJECT_MISSING', 'QUERY_FAILED', 'TRANSACTION_FAILED'}
DB_PROBE_PROGRAM = r'''
let p,stage='MODULE';
const emit=x=>process.stdout.write(JSON.stringify(x));
(async()=>{
if(!String(process.env.DATABASE_URL||'').trim()){emit({status:'DEFAULT_DATABASE_URL_MISSING'});return;}
const {PrismaClient}=require('@prisma/client');p=new PrismaClient();stage='CONNECT';
await p.$connect();stage='READ_ONLY';
const row=await p.$transaction(async t=>{
await t.$executeRawUnsafe('SET TRANSACTION READ ONLY');
await t.$executeRawUnsafe("SET LOCAL statement_timeout='8s'");
const mode=await t.$queryRawUnsafe("SELECT current_setting('transaction_read_only') AS value");
if(mode[0]?.value!=='on')throw Error('READ_ONLY_REQUIRED');stage='QUERY';
const rows=await t.$queryRawUnsafe(`SELECT current_user='app_deal' AS api_is_app_deal,
current_setting('row_security')='on' AS row_security_on,
EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='app_outbox') AS outbox_role_exists,
EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE rolname='app_outbox' AND
(rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication OR rolinherit OR
EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=r.oid))) AS outbox_role_unsafe,
to_regclass('public.outbox_entries') IS NOT NULL AS outbox_table_present,
to_regprocedure('public.outbox_expired_attempt_reclaim_guard()') IS NOT NULL AS fence_function_present`);
const keys=['api_is_app_deal','row_security_on','outbox_role_exists','outbox_role_unsafe','outbox_table_present','fence_function_present'];
if(rows.length!==1||keys.some(k=>typeof rows[0][k]!=='boolean'))throw Error('INVALID_METADATA');
return Object.fromEntries(keys.map(k=>[k,rows[0][k]]));
},{timeout:12000,maxWait:3000});emit({status:'OBSERVED_READ_ONLY',...row});
})().catch(e=>{
const c=e?.code,s=e?.meta?.code;
const status=c==='P1000'?'AUTHENTICATION_FAILED':c==='P1001'||c==='P1002'?'CONNECTION_FAILED':
s==='42501'?'PERMISSION_DENIED':s==='42P01'||s==='42883'?'OBJECT_MISSING':
c==='P2024'||c==='P2028'?'TRANSACTION_FAILED':stage==='MODULE'?'MODULE_OR_CLIENT_UNAVAILABLE':
stage==='CONNECT'?'CONNECTION_FAILED':stage==='READ_ONLY'?'READ_ONLY_SETUP_FAILED':'QUERY_FAILED';
emit({status});
}).finally(async()=>{if(p)await p.$disconnect().catch(()=>{});});
'''


def database_probe(api: dict[str, Any]) -> dict[str, Any]:
    cid = api.get('Id')
    if not isinstance(cid, str) or not CONTAINER_ID.fullmatch(cid) or (api.get('State') or {}).get('Running') is not True:
        return {'status': 'NOT_PROVEN'}
    try:
        result = json.loads(run(['docker', 'exec', '-i', cid, '/nodejs/bin/node', '-'], DB_PROBE_PROGRAM) or 'null')
        validate_database_probe(result)
        return result
    except (ValueError, TypeError):
        return {'status': 'NOT_PROVEN'}


def validate_database_probe(value: Any) -> None:
    if not isinstance(value, dict) or not isinstance(value.get('status'), str):
        raise ValueError('DATABASE_PROBE_SCHEMA')
    if value['status'] in DB_PROBE_ERRORS and set(value) == {'status'}:
        return
    if value['status'] != 'OBSERVED_READ_ONLY' or set(value) != DB_PROBE_FLAGS | {'status'} or any(type(value[k]) is not bool for k in DB_PROBE_FLAGS):
        raise ValueError('DATABASE_PROBE_SCHEMA')
    if value['outbox_role_unsafe'] and not value['outbox_role_exists']:
        raise ValueError('DATABASE_PROBE_ROLE_CONTRADICTION')


def broker_image(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    return re.fullmatch(r'(?:[a-z0-9.:-]+/)*(?:kafka|cp-kafka|cp-server|redpanda)(?::[^\s@]+|@sha256:[0-9a-f]{64})?', value) is not None


def compose_config_command(web: dict[str, Any], project: str) -> list[str] | None:
    """The only admitted Compose operation is config --format json."""
    labels = (web.get('Config') or {}).get('Labels') or {}
    if not isinstance(project, str) or not PROJECT.fullmatch(project) or labels.get('com.docker.compose.project') != project:
        return None
    directory, raw_files = labels.get('com.docker.compose.project.working_dir'), labels.get('com.docker.compose.project.config_files')
    if not isinstance(directory, str) or not directory.startswith('/') or len(directory) > 4096 or not isinstance(raw_files, str) or len(raw_files) > 16384:
        return None
    files = raw_files.split(',')
    if not 1 <= len(files) <= 16 or len(set(files)) != len(files) or any(not f.strip() for f in files):
        return None
    try:
        root = Path(directory)
        if not root.is_dir():
            return None
        command = ['docker', 'compose', '--project-directory', directory, '--project-name', project]
        for value in files:
            path = Path(value.strip())
            path = path if path.is_absolute() else root / path
            if path.is_symlink() or not path.is_file() or path.stat().st_size > MAX_BYTES:
                return None
            command += ['-f', str(path)]
        return command + ['config', '--format', 'json']
    except (OSError, ValueError):
        return None


def rendered_compose(web: dict[str, Any], project: str) -> dict[str, Any] | None:
    command = compose_config_command(web, project)
    if command is None:
        return None
    try:
        model = json.loads(run(command) or 'null')
        services = model.get('services') if isinstance(model, dict) else None
        if model.get('name') != project or not isinstance(services, dict) or not 2 <= len(services) <= 64:
            return None
        if any(not isinstance(k, str) or not PROJECT.fullmatch(k) or not isinstance(v, dict) for k, v in services.items()) or not {'api', 'web'} <= set(services):
            return None
        return model
    except (ValueError, TypeError, AttributeError):
        return None


COMPOSE_COUNTS = {'service_count', 'worker_candidates', 'broker_candidates', 'postgres_candidates', 'migration_candidates'}
COMPOSE_FLAGS = {'api_image_matches_runtime_config', 'web_image_matches_runtime_config',
                 'api_outbox_worker_enabled', 'api_brokers_configured',
                 'api_database_configured', 'migration_database_configured'}


def migration_candidate(name: str, service: dict[str, Any]) -> bool:
    image = service.get('image')
    command = service.get('command')
    command = ' '.join(command) if isinstance(command, list) and all(isinstance(v, str) for v in command) else command
    return (re.search(r'(^|[-_])(migrate|migration)([-_]|$)', name, re.I) is not None
            or isinstance(image, str) and image.split('@')[0].split(':')[0] == 'ghcr.io/pachaninm-lab/grainflow-migration'
            or isinstance(command, str) and 'prisma' in command and 'migrate' in command)


DECLARED_DB_FLAGS = {'auth_default_declared_target_equal',
                     'auth_declared_target_matches_selected_pg',
                     'default_declared_target_matches_selected_pg', 'unique_project_pg16'}


def declared_env(container: dict[str, Any]) -> dict[str, str] | None:
    """Keep values private; malformed or duplicate configuration is unknown."""
    if not isinstance(container, dict) or not isinstance(container.get('Config'), dict):
        return None
    entries = container['Config'].get('Env')
    if not isinstance(entries, list) or len(entries) > 512:
        return None
    result = {}
    for row in entries:
        if not isinstance(row, str) or len(row) > 65536 or '=' not in row or any(ord(c) < 32 for c in row):
            return None
        name, value = row.split('=', 1)
        if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', name) or name in result:
            return None
        result[name] = value
    return result


def declared_db_target(raw: Any) -> tuple[str, int, str] | None:
    """Conservative URL metadata only; never resolves DNS or instantiates a client."""
    if (not isinstance(raw, str) or not 1 <= len(raw) <= 8192 or
            any(ord(c) <= 32 or ord(c) == 127 for c in raw) or
            re.search(r'%(?![0-9A-Fa-f]{2})', raw) or '?' in raw or '#' in raw or '\\' in raw):
        return None
    try:
        url = urllib.parse.urlsplit(raw)
        if (url.scheme not in ('postgres', 'postgresql') or not url.netloc or not url.hostname or
                url.netloc.count('@') > 1 or url.netloc.rsplit('@', 1)[-1].endswith(':')):
            return None
        host = url.hostname.lower()
        if not re.fullmatch(r'[a-z0-9][a-z0-9_.-]{0,252}', host) or host.endswith('.'):
            return None
        if host == 'localhost' or host.endswith('.localhost'):
            return None
        try:
            address = ipaddress.ip_address(host)
            if address.is_loopback or address.is_unspecified or address.is_link_local:
                return None
        except ValueError:
            if re.fullmatch(r'[0-9.]+', host):
                return None
        port = url.port if url.port is not None else 5432
        if not 1 <= port <= 65535 or not url.path.startswith('/'):
            return None
        database = urllib.parse.unquote(url.path[1:], encoding='utf-8', errors='strict')
        if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_$-]{0,62}', database):
            return None
        # Missing credentials do not change a declared target. No credential
        # parsing or fallback is used to claim application resolver behavior.
        return host, port, database
    except (ValueError, UnicodeError):
        return None


def declared_database_relations(api: dict[str, Any], rows: Any, project: str) -> dict[str, Any]:
    """Compare already inspected declarations. This is never live database binding."""
    result = {key: 'UNKNOWN' for key in DECLARED_DB_FLAGS}
    result.update(assurance='DECLARED_CONFIG_ONLY_NOT_RUNTIME_BINDING',
                  binding_proven=False, helper_execution='NOT_PERFORMED')
    def shape(row: Any) -> bool:
        return (isinstance(row, dict) and isinstance(row.get('Id'), str) and CONTAINER_ID.fullmatch(row['Id']) is not None
                and all(isinstance(row.get(key), dict) for key in ('Config', 'HostConfig', 'State', 'NetworkSettings'))
                and isinstance(row['Config'].get('Labels'), dict)
                and row['Config']['Labels'].get('com.docker.compose.project') == project
                and type(row['State'].get('Running')) is bool
                and isinstance(row['State'].get('StartedAt'), str))
    if not isinstance(project, str) or not PROJECT.fullmatch(project) or not shape(api):
        return result
    environment = declared_env(api)
    auth = declared_db_target(environment.get('AUTH_DATABASE_URL')) if environment is not None else None
    default = declared_db_target(environment.get('DATABASE_URL')) if environment is not None else None
    if auth is not None and default is not None:
        result['auth_default_declared_target_equal'] = auth == default
    if (not isinstance(rows, list) or not 1 <= len(rows) <= 64 or
            any(not shape(row) for row in rows) or
            len({row['Id'] for row in rows}) != len(rows)):
        return result
    selected = [row for row in rows if row['Id'] == api.get('Id')]
    identity = project_runtime_identity(api)
    if len(selected) != 1 or identity is None or project_runtime_identity(selected[0]) != identity:
        return result
    postgres = [row for row in rows if isinstance((row.get('Config') or {}).get('Image'), str) and
                re.fullmatch(r'(?:(?:docker[.]io/)?library/)?postgres(?::[^\s@]+|@sha256:[0-9a-f]{64})?', row['Config']['Image'])]
    if len(postgres) != 1:
        if len(postgres) > 1:
            result['unique_project_pg16'] = False
        return result
    pg = postgres[0]
    pg_env = declared_env(pg)
    image = pg['Config']['Image']
    # An environment claim cannot override an explicit conflicting image tag.
    # Mutable/implicit tags do not establish this narrow PG16 declaration profile.
    version_tag = re.search(r':([0-9]+)(?:[.-][A-Za-z0-9_.-]+)?\Z', image)
    version_supported = (version_tag is not None and version_tag[1] == '16'
                         or '@sha256:' in image and pg_env is not None and pg_env.get('PG_MAJOR') == '16')
    if (pg_env is None or (pg.get('State') or {}).get('Running') is not True or
            not version_supported or
            pg_env.get('PG_MAJOR', '16') != '16' or pg_env.get('PGPORT', '5432') != '5432' or
            pg['Config'].get('Cmd') != ['postgres'] or
            pg['Config'].get('Entrypoint') not in (['docker-entrypoint.sh'], ['/usr/local/bin/docker-entrypoint.sh']) or
            not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_$-]{0,62}', pg_env.get('POSTGRES_DB', ''))):
        return result
    result['unique_project_pg16'] = True
    # Hosts-file, legacy-link or DNS overrides have precedence/semantics outside
    # this supported declaration profile. Do not infer resolution through them.
    host = api['HostConfig']
    if (any(host.get(key) not in (None, []) for key in ('ExtraHosts', 'Links', 'Dns', 'DnsSearch', 'DnsOptions')) or
            not isinstance(host.get('NetworkMode'), str) or host['NetworkMode'] in ('host', 'none') or
            host['NetworkMode'].startswith('container:') or environment is None or
            any(environment.get(key) for key in ('HOSTALIASES', 'LOCALDOMAIN', 'RES_OPTIONS'))):
        return result
    own_hostname, own_domain = api['Config'].get('Hostname'), api['Config'].get('Domainname')
    valid_name = lambda value: isinstance(value, str) and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,252}', value) is not None
    if not valid_name(own_hostname) or not (own_domain == '' or valid_name(own_domain)):
        return result
    own_names = {own_hostname.lower(), (own_hostname + '.' + own_domain).lower()} if own_domain else {own_hostname.lower()}
    mounts = api.get('Mounts')
    if not isinstance(mounts, list) or len(mounts) > 128:
        return result
    resolution_paths = [PurePosixPath(p) for p in ('/etc/hosts', '/etc/resolv.conf', '/etc/nsswitch.conf', '/etc/host.conf', '/etc/gai.conf')]
    for mount in mounts:
        destination = mount.get('Destination') if isinstance(mount, dict) else None
        if (not isinstance(destination, str) or not destination.startswith('/') or destination.startswith('//') or
                len(destination) > 4096 or any(ord(c) < 32 for c in destination) or
                any(p in ('.', '..') for p in destination.split('/')) or str(PurePosixPath(destination)) != destination):
            return result
        path = PurePosixPath(destination)
        if any(path == protected or path in protected.parents for protected in resolution_paths):
            return result
    own = api['NetworkSettings'].get('Networks')
    if not isinstance(own, dict) or not own:
        return result
    if any(not isinstance(network, dict) or not isinstance(network.get('NetworkID'), str)
           or not CONTAINER_ID.fullmatch(network['NetworkID']) for network in own.values()):
        return result
    for key, target in [('auth_declared_target_matches_selected_pg', auth),
                        ('default_declared_target_matches_selected_pg', default)]:
        if target is None:
            continue
        host, port, database = target
        if host in own_names:
            continue
        peers, complete = set(), True
        for row in rows:
            networks = row['NetworkSettings'].get('Networks')
            if not isinstance(networks, dict):
                complete = False
                break
            for name, network in networks.items():
                source = own.get(name)
                if not isinstance(source, dict) or not source.get('NetworkID'):
                    continue
                if (not isinstance(network, dict) or not isinstance(network.get('NetworkID'), str)
                        or not CONTAINER_ID.fullmatch(network['NetworkID'])):
                    complete = False
                    break
                if source['NetworkID'] != network.get('NetworkID'):
                    continue
                aliases = network.get('Aliases')
                if aliases is None:
                    aliases = []
                if (not isinstance(aliases, list) or len(aliases) > 128 or
                        any(not valid_name(alias) for alias in aliases)):
                    complete = False
                    break
                address = network.get('IPAddress')
                if not isinstance(address, str):
                    complete = False
                    break
                try:
                    if address and (str(ipaddress.IPv4Address(address)) != address or
                                    ipaddress.IPv4Address(address).is_loopback or
                                    ipaddress.IPv4Address(address).is_unspecified or
                                    ipaddress.IPv4Address(address).is_multicast):
                        complete = False
                        break
                except ValueError:
                    complete = False
                    break
                # Numeric IPv4 literals bypass DNS aliases, even if an alias
                # happens to be spelled as an address belonging to another peer.
                match = host == address if re.fullmatch(r'[0-9.]+', host) else host in {alias.lower() for alias in aliases}
                if match:
                    peers.add(row['Id'])
        if complete and len(peers) == 1:
            result[key] = peers == {pg['Id']} and port == 5432 and database == pg_env['POSTGRES_DB']
    return result


def validate_declared_database_relations(value: Any) -> None:
    if (not isinstance(value, dict) or set(value) != DECLARED_DB_FLAGS | {'assurance', 'binding_proven', 'helper_execution'} or
            value['assurance'] != 'DECLARED_CONFIG_ONLY_NOT_RUNTIME_BINDING' or
            value['binding_proven'] is not False or value['helper_execution'] != 'NOT_PERFORMED' or
            any(type(value[k]) is not bool and value[k] != 'UNKNOWN' for k in DECLARED_DB_FLAGS)):
        raise ValueError('DECLARED_DATABASE_RELATIONS_SCHEMA')
    mappings = [value['auth_declared_target_matches_selected_pg'], value['default_declared_target_matches_selected_pg']]
    if ((value['unique_project_pg16'] is not True and any(v != 'UNKNOWN' for v in mappings)) or
            (value['auth_default_declared_target_equal'] is True and mappings[0] != mappings[1])):
        raise ValueError('DECLARED_DATABASE_RELATIONS_CONTRADICTION')


def release_inventory(web: dict[str, Any], api: dict[str, Any], project: str) -> dict[str, Any]:
    model = rendered_compose(web, project)
    compose = {'status': 'NOT_PROVEN'}
    if model is not None:
        services = model['services']
        migrations = [s for name, s in services.items() if migration_candidate(name, s)]
        migration_env = migrations[0].get('environment') if len(migrations) == 1 else None
        environment = services['api'].get('environment') or {}
        if isinstance(environment, dict):
            compose = {'status': 'OBSERVED_READ_ONLY', 'configuration_stability': 'NOT_PROVEN',
                       'service_count': len(services),
                       'worker_candidates': sum(isinstance(s.get('image'), str) and s['image'].split('@')[0].split(':')[0] == OUTBOX_REPOSITORY
                           or isinstance(s.get('environment'), dict) and s['environment'].get('RUNTIME_COMPONENT') == 'outbox-worker' for s in services.values()),
                       'broker_candidates': sum(broker_image(s.get('image')) for s in services.values()),
                       'postgres_candidates': sum(isinstance(s.get('image'), str) and re.fullmatch(r'(?:[^\s@]+/)?postgres(?::[^\s@]+|@sha256:[0-9a-f]{64})?', s['image']) is not None for s in services.values()),
                       'migration_candidates': len(migrations),
                       'api_image_matches_runtime_config': isinstance(services['api'].get('image'), str) and services['api']['image'] == (api.get('Config') or {}).get('Image'),
                       'web_image_matches_runtime_config': isinstance(services['web'].get('image'), str) and services['web']['image'] == (web.get('Config') or {}).get('Image'),
                       'api_outbox_worker_enabled': environment.get('OUTBOX_WORKER_ENABLED') == 'true',
                       'api_database_configured': isinstance(environment.get('DATABASE_URL'), str) and bool(environment['DATABASE_URL'].strip()),
                       'migration_database_configured': isinstance(migration_env, dict) and isinstance(migration_env.get('DATABASE_URL'), str) and bool(migration_env['DATABASE_URL'].strip()),
                       'api_brokers_configured': isinstance(environment.get('KAFKA_BROKERS'), str) and bool(environment['KAFKA_BROKERS'].strip())}
            compose['configuration_stability'] = 'UNCHANGED' if model == rendered_compose(web, project) else 'NOT_PROVEN'
    rows = project_containers(project)
    runtime = {'status': 'NOT_PROVEN'}
    if rows is not None:
        brokers = [r for r in rows if broker_image((r.get('Config') or {}).get('Image'))]
        runtime = {'status': 'OBSERVED_IMAGE_METADATA', 'broker_candidates': len(brokers),
                   'running_broker_candidates': sum((r.get('State') or {}).get('Running') is True for r in brokers),
                   'enabled_delivery_candidates': sum(env_of(r).get('OUTBOX_WORKER_ENABLED') == 'true' for r in rows)}
    return {'compose': compose, 'runtime': runtime, 'database_probe': database_probe(api),
            'declared_database_relations': declared_database_relations(api, rows, project)}


def validate_release_inventory(value: Any) -> None:
    if not isinstance(value, dict) or set(value) != {'compose', 'runtime', 'database_probe', 'declared_database_relations'}:
        raise ValueError('RELEASE_INVENTORY_SCHEMA')
    validate_database_probe(value['database_probe'])
    validate_declared_database_relations(value['declared_database_relations'])
    compose = value['compose']
    if compose != {'status': 'NOT_PROVEN'}:
        if not isinstance(compose, dict) or set(compose) != COMPOSE_COUNTS | COMPOSE_FLAGS | {'status', 'configuration_stability'} or compose['status'] != 'OBSERVED_READ_ONLY' or compose['configuration_stability'] not in ('UNCHANGED', 'NOT_PROVEN'):
            raise ValueError('COMPOSE_INVENTORY_SCHEMA')
        if any(type(compose[k]) is not int or not 0 <= compose[k] <= 64 for k in COMPOSE_COUNTS) or any(type(compose[k]) is not bool for k in COMPOSE_FLAGS):
            raise ValueError('COMPOSE_INVENTORY_VALUE')
        if compose['service_count'] < 2 or any(compose[k] > compose['service_count'] for k in COMPOSE_COUNTS - {'service_count'}):
            raise ValueError('COMPOSE_INVENTORY_COUNT')
        if compose['migration_database_configured'] and compose['migration_candidates'] != 1:
            raise ValueError('COMPOSE_MIGRATION_AMBIGUOUS')
    runtime = value['runtime']
    if runtime != {'status': 'NOT_PROVEN'}:
        keys = {'broker_candidates', 'running_broker_candidates', 'enabled_delivery_candidates'}
        if not isinstance(runtime, dict) or set(runtime) != keys | {'status'} or runtime['status'] != 'OBSERVED_IMAGE_METADATA' or any(type(runtime[k]) is not int or not 0 <= runtime[k] <= 64 for k in keys) or runtime['running_broker_candidates'] > runtime['broker_candidates']:
            raise ValueError('RUNTIME_INVENTORY_SCHEMA')


def code_mount_observation(api: dict[str, Any]) -> str:
    mounts = api.get('Mounts')
    if not isinstance(mounts, list):
        return 'NOT_PROVEN'
    protected = [PurePosixPath(p) for p in ('/nodejs', '/app/dist', '/app/node_modules')]
    overlap = False
    for mount in mounts:
        destination = mount.get('Destination') if isinstance(mount, dict) else None
        if (not isinstance(destination, str) or not destination.startswith('/') or destination.startswith('//') or
                any(ord(c) < 32 for c in destination) or
                any(p in ('.', '..') for p in destination.split('/')) or
                str(PurePosixPath(destination)) != destination):
            return 'NOT_PROVEN'
        path = PurePosixPath(destination)
        overlap |= any(path == p or path in p.parents or p in path.parents for p in protected)
    return 'CODE_PATH_OVERLAP' if overlap else 'NO_CODE_MOUNT_OBSERVED'


def registration_blockers(value: dict[str, Any]) -> list[str]:
    # Local image metadata, read-only rootfs and a matching route configuration
    # do not attest registry provenance, the existing writable layer or a live
    # registration database binding. These three limitations always remain.
    blockers = {'TRUSTED_IMAGE_PROOF_MISSING', 'INSTALLED_CODE_PROOF_MISSING',
                'REGISTRATION_BINDING_NOT_PERFORMED'}
    for key, expected, reason in (
        ('route_configuration', 'OBSERVED_CONFIGURATION_ONLY', 'ROUTE_CHAIN_NOT_PROVEN'),
        ('local_image_binding', 'OBSERVED', 'LOCAL_IMAGE_BINDING_NOT_PROVEN'),
        ('immutable_reference', 'OBSERVED', 'IMMUTABLE_REFERENCE_NOT_OBSERVED'),
        ('code_mounts', 'NO_CODE_MOUNT_OBSERVED', 'CODE_MOUNTS_NOT_ATTESTED'),
        ('root_filesystem', 'READ_ONLY', 'WRITABLE_ROOT_OR_UNKNOWN'),
        ('registration_url', 'CONFIGURED', 'REGISTRATION_URL_NOT_CONFIGURED'),
        ('runtime_stability', 'UNCHANGED', 'RUNTIME_STABILITY_NOT_PROVEN'),
    ):
        if value[key] != expected:
            blockers.add(reason)
    return sorted(blockers)


def registration_preconditions(api: dict[str, Any], checks: dict[str, Any],
                               topology: dict[str, Any]) -> dict[str, Any]:
    """Passive observations only: no command, constructor, SQL or helper call.

    This explains why the accepted IR20 primitive cannot yet be invoked. It
    neither establishes a live Caddy/API route nor authorizes a subsequent call.
    """
    image = topology.get('api_image') or {}
    stable = (checks.get('runtime_configuration_stability') == 'UNCHANGED' and
              topology.get('runtime_stability') == 'UNCHANGED')
    route = stable and all(checks.get(k) == v for k, v in (
        ('web_ingress', 'NO_PUBLIC_DOCKER_BINDING'),
        ('canonical_api_origin', 'CANONICAL'),
        ('api_web_peer_trust', 'OBSERVED_WEB_PEERS_TRUSTED'),
        ('caddy_route_and_headers', 'CANONICAL_WEB_ROUTE_OBSERVED'),
        ('caddy_configuration_stability', 'UNCHANGED'),
    ))
    config = api.get('Config') or {}
    entries = config.get('Env')
    url = 'NOT_PROVEN'
    if isinstance(entries, list) and all(isinstance(v, str) and '=' in v for v in entries):
        matches = [v.partition('=')[2] for v in entries if v.partition('=')[0] == 'AUTH_DATABASE_URL']
        if len(matches) <= 1:
            url = 'CONFIGURED' if matches and matches[0].strip() else 'MISSING'
    readonly = (api.get('HostConfig') or {}).get('ReadonlyRootfs')
    value = {
        'status': 'PRECONDITIONS_ONLY_NOT_BINDING',
        'route_configuration': 'OBSERVED_CONFIGURATION_ONLY' if route else 'NOT_PROVEN',
        'local_image_binding': 'OBSERVED' if stable and image.get('container_image_binding') is True else 'NOT_PROVEN',
        'immutable_reference': 'OBSERVED' if stable and image.get('container_image_binding') is True
            and image.get('immutable_config_ref') is True
            and isinstance(image.get('registry_digest'), str)
            and IMAGE_ID.fullmatch(image['registry_digest']) else 'NOT_PROVEN',
        'code_mounts': code_mount_observation(api),
        'root_filesystem': 'READ_ONLY' if readonly is True else 'WRITABLE' if readonly is False else 'NOT_PROVEN',
        'registration_url': url,
        'runtime_stability': 'UNCHANGED' if stable else 'NOT_PROVEN',
        'binding_proven': False,
        'helper_execution': 'NOT_PERFORMED',
    }
    value['blocking_reasons'] = registration_blockers(value)
    return value


def validate_registration_preconditions(value: Any, checks: dict[str, Any],
                                        topology: dict[str, Any]) -> None:
    choices = {
        'status': {'PRECONDITIONS_ONLY_NOT_BINDING'},
        'route_configuration': {'OBSERVED_CONFIGURATION_ONLY', 'NOT_PROVEN'},
        'local_image_binding': {'OBSERVED', 'NOT_PROVEN'},
        'immutable_reference': {'OBSERVED', 'NOT_PROVEN'},
        'code_mounts': {'NO_CODE_MOUNT_OBSERVED', 'CODE_PATH_OVERLAP', 'NOT_PROVEN'},
        'root_filesystem': {'READ_ONLY', 'WRITABLE', 'NOT_PROVEN'},
        'registration_url': {'CONFIGURED', 'MISSING', 'NOT_PROVEN'},
        'runtime_stability': {'UNCHANGED', 'NOT_PROVEN'},
        'helper_execution': {'NOT_PERFORMED'},
    }
    if (not isinstance(value, dict) or set(value) != set(choices) | {'binding_proven', 'blocking_reasons'} or
            value.get('binding_proven') is not False or
            any(not isinstance(value[k], str) or value[k] not in allowed for k, allowed in choices.items())):
        raise ValueError('REGISTRATION_PRECONDITIONS_SCHEMA')
    expected = registration_preconditions({}, checks, topology)
    for key in ('route_configuration', 'local_image_binding', 'immutable_reference', 'runtime_stability'):
        if value[key] != expected[key]:
            raise ValueError('REGISTRATION_PRECONDITIONS_CONTRADICTION')
    if value['blocking_reasons'] != registration_blockers(value):
        raise ValueError('REGISTRATION_PRECONDITIONS_BLOCKERS')


def api_publication_config(api: dict[str, Any], checks: dict[str, Any],
                           topology: dict[str, Any]) -> dict[str, Any]:
    """Compare declared base config metadata, never mutable installed contents."""
    observed = api.get('Image')
    observed = observed if isinstance(observed, str) and IMAGE_ID.fullmatch(observed) else 'NOT_PROVEN'
    image = topology.get('api_image') or {}
    stable = (checks.get('runtime_configuration_stability') == 'UNCHANGED'
              and topology.get('runtime_stability') == 'UNCHANGED')
    status = 'NOT_PROVEN'
    if (stable and image.get('container_image_binding') is True and image.get('running') is True
            and observed == PUBLICATION['config'] and image.get('revision') == PUBLICATION['source_sha']):
        status = 'DECLARED_BASE_CONFIG_ID_MATCH_ONLY'
    return {'status': status, 'expected_config_digest': PUBLICATION['config'],
            'expected_source_sha': PUBLICATION['source_sha'], 'observed_image_id': observed,
            'assurance': 'BASE_CONFIG_METADATA_ONLY', 'installed_code': 'NOT_INSPECTED',
            'registration_binding': 'NOT_PERFORMED'}


def validate_api_publication_config(value: Any, checks: dict[str, Any], topology: dict[str, Any]) -> None:
    if not isinstance(value, dict) or not isinstance(value.get('observed_image_id'), str):
        raise ValueError('PUBLICATION_CONFIG_OBSERVATION')
    digest = value['observed_image_id']
    if digest != 'NOT_PROVEN' and not IMAGE_ID.fullmatch(digest):
        raise ValueError('PUBLICATION_CONFIG_OBSERVATION')
    if value != api_publication_config({'Image': digest}, checks, topology):
        raise ValueError('PUBLICATION_CONFIG_OBSERVATION')


def filesystem_snapshot(path: Any) -> tuple[dict[str, Any], int | None]:
    """Directory descriptors and statvfs only: no entries, file bytes or atime reads."""
    unknown: dict[str, Any] = {'status': 'NOT_PROVEN'}
    fd = None
    try:
        flags = (getattr(os, 'O_PATH', None), getattr(os, 'O_DIRECTORY', None), getattr(os, 'O_NOFOLLOW', None))
        if (any(type(flag) is not int or flag <= 0 for flag in flags) or not isinstance(path, str)
                or not path.startswith('/') or len(path.encode('utf-8')) > 4096
                or any(ord(char) < 32 or ord(char) == 127 for char in path)):
            return unknown, None
        parts = [] if path == '/' else path[1:].split('/')
        if len(parts) > 64 or any(part in ('', '.', '..') for part in parts):
            return unknown, None
        mode = flags[0] | flags[1] | flags[2]
        fd = os.open('/', mode)
        for part in parts:
            child = os.open(part, mode, dir_fd=fd)
            os.close(fd)
            fd = child
            if not stat.S_ISDIR(os.fstat(fd).st_mode):
                return unknown, None
        before = os.fstat(fd)
        if not stat.S_ISDIR(before.st_mode) or type(before.st_dev) is not int:
            return unknown, None
        values = os.fstatvfs(fd)
        after = os.fstat(fd)
        if (before.st_dev, before.st_ino) != (after.st_dev, after.st_ino):
            return unknown, None
        unit, total, free, available = values.f_frsize, values.f_blocks, values.f_bfree, values.f_bavail
        if (any(type(v) is not int for v in (unit, total, free, available)) or unit <= 0
                or not 0 <= available <= free <= total or total * unit > 2**63 - 1):
            return unknown, None
        inodes: dict[str, Any] = {'status': 'NOT_PROVEN'}
        itotal, ifree, iavailable = values.f_files, values.f_ffree, values.f_favail
        if (all(type(v) is int for v in (itotal, ifree, iavailable))
                and 0 <= iavailable <= ifree <= itotal <= 2**63 - 1):
            inodes = {'status': 'OBSERVED', 'total': itotal, 'free': ifree, 'available': iavailable}
        return {'status': 'OBSERVED_METADATA_ONLY', 'total_bytes': total * unit,
                'free_bytes': free * unit, 'available_bytes': available * unit,
                'inodes': inodes}, before.st_dev
    except (OSError, ValueError, UnicodeError, AttributeError, OverflowError):
        return unknown, None
    finally:
        if fd is not None:
            os.close(fd)


def filesystem_capacity() -> dict[str, Any]:
    root, root_device = filesystem_snapshot('/')
    backup, backup_device = filesystem_snapshot('/var/lib/pc-release-authority/backups')
    docker_path = None
    try:
        docker_path = json.loads(run(['docker', 'info', '--format', '{{json .DockerRootDir}}']) or 'null')
    except (ValueError, TypeError):
        pass
    docker, docker_device = filesystem_snapshot(docker_path)
    def relation(left: int | None, right: int | None) -> str:
        if left is None or right is None:
            return 'NOT_PROVEN'
        return 'SAME_FILESYSTEM_OBSERVED' if left == right else 'DIFFERENT_FILESYSTEM_OBSERVED'
    return {'root': root, 'docker': docker, 'backup': backup,
            'root_docker': relation(root_device, docker_device),
            'root_backup': relation(root_device, backup_device),
            'docker_backup': relation(docker_device, backup_device), 'admission': 'NOT_GRANTED'}


def validate_filesystem_capacity(value: Any) -> None:
    if (not isinstance(value, dict) or set(value) != {'root', 'docker', 'backup', 'root_docker',
            'root_backup', 'docker_backup', 'admission'} or value['admission'] != 'NOT_GRANTED'):
        raise ValueError('FILESYSTEM_CAPACITY_SCHEMA')
    observed = {}
    for name in ('root', 'docker', 'backup'):
        item = value[name]
        if item == {'status': 'NOT_PROVEN'}:
            observed[name] = False
            continue
        if (not isinstance(item, dict) or set(item) != {'status', 'total_bytes', 'free_bytes', 'available_bytes', 'inodes'}
                or item['status'] != 'OBSERVED_METADATA_ONLY'
                or any(type(item[k]) is not int for k in ('total_bytes', 'free_bytes', 'available_bytes'))
                or not 0 <= item['available_bytes'] <= item['free_bytes'] <= item['total_bytes'] <= 2**63 - 1):
            raise ValueError('FILESYSTEM_CAPACITY_VALUE')
        inode = item['inodes']
        if inode != {'status': 'NOT_PROVEN'}:
            if (not isinstance(inode, dict) or set(inode) != {'status', 'total', 'free', 'available'}
                    or inode['status'] != 'OBSERVED'
                    or any(type(inode[k]) is not int for k in ('total', 'free', 'available'))
                    or not 0 <= inode['available'] <= inode['free'] <= inode['total'] <= 2**63 - 1):
                raise ValueError('FILESYSTEM_CAPACITY_INODES')
        observed[name] = True
    pairs = (('root_docker', 'root', 'docker'), ('root_backup', 'root', 'backup'), ('docker_backup', 'docker', 'backup'))
    groups = {name: name for name in observed}
    for key, left, right in pairs:
        fact = value[key]
        choices = {'SAME_FILESYSTEM_OBSERVED', 'DIFFERENT_FILESYSTEM_OBSERVED'} if observed[left] and observed[right] else {'NOT_PROVEN'}
        if not isinstance(fact, str) or fact not in choices:
            raise ValueError('FILESYSTEM_CAPACITY_RELATION')
        if fact == 'SAME_FILESYSTEM_OBSERVED':
            old, new = groups[right], groups[left]
            groups = {name: new if group == old else group for name, group in groups.items()}
    if any(value[key] == 'DIFFERENT_FILESYSTEM_OBSERVED' and groups[left] == groups[right] for key, left, right in pairs):
        raise ValueError('FILESYSTEM_CAPACITY_CONTRADICTION')


CAPACITY_COMMAND_SECONDS = 5
CAPACITY_PROFILE_SECONDS = 35
CAPACITY_OUTPUT_BYTES = 2 * 1024 * 1024
CAPACITY_TOTAL_BYTES = 16 * 1024 * 1024
CAPACITY_QUERY_KEYS = ('containers_list', 'containers_inspect', 'volumes_list',
                       'networks_list', 'images_list', 'images_inspect_after_warm')
CAPACITY_DISK_PATHS = {'docker_containers': '/var/lib/docker/containers',
                       'docker_image_metadata': '/var/lib/docker/image',
                       'docker_build_cache': '/var/lib/docker/buildkit',
                       'containerd': '/var/lib/containerd'}
CAPACITY_STATUSES = {'NOT_RUN', 'SUCCESS', 'TIMED_OUT', 'OUTPUT_LIMIT', 'NONZERO', 'INVALID', 'UNKNOWN'}


def empty_image_reclaim_plan() -> dict[str, Any]:
    return {'status': 'NOT_PROVEN', 'assurance': 'INITIAL_SNAPSHOT_LOGICAL_UPPER_ONLY',
            'catalog_stability': 'NOT_PROVEN', 'physical_reclaim': 'NOT_PROVEN',
            'cleanup_authorized': False, 'canonical_image_count': None,
            'eligible_image_count': None, 'container_protected_image_count': None,
            'protected_image_count': None, 'eligible_logical_bytes_upper': None,
            'first_candidates': []}


def capacity_image_classification(item: dict[str, Any]):
    """D953 initial classifier only; no attested intermediate/digest-only alias authority."""
    refs = []
    for key in ('RepoTags', 'RepoDigests'):
        values = item.get(key)
        if values is None:
            values = []
        if not isinstance(values, list) or any(not isinstance(value, str) for value in values):
            raise ValueError('IMAGE_REFS')
        refs.extend(value for value in values if value and value not in ('<none>', '<none>:<none>'))
    refs = tuple(sorted(set(refs)))
    if len(refs) > 128:
        raise ValueError('IMAGE_REFS')
    if not refs:
        return None
    patterns = ((r'ghcr[.]io/pachaninm-lab/grainflow-(api|web|migration|tai):[A-Za-z0-9_.-]+', 'TAG', 'REGISTRY_CANONICAL'),
                (r'ghcr[.]io/pachaninm-lab/grainflow-(api|web|migration|tai)@sha256:[0-9a-f]{64}', 'DIGEST', 'REGISTRY_CANONICAL'),
                (r'pc-crop-transfer/(api|web|migration):([0-9a-f]{40})', 'TAG', 'EXACT_SHA_TRANSFER_ALIAS'),
                (r'pc-crop-transfer/(api|web|migration)@sha256:[0-9a-f]{64}', 'DIGEST', 'EXACT_SHA_TRANSFER_ALIAS'))
    components, namespaces, tags = set(), set(), []
    for ref in refs:
        matches = [(re.fullmatch(pattern, ref), kind, namespace) for pattern, kind, namespace in patterns]
        matches = [(match, kind, namespace) for match, kind, namespace in matches if match]
        if len(matches) != 1:
            return None
        match, kind, namespace = matches[0]
        components.add(match[1]); namespaces.add(namespace)
        if kind == 'TAG':
            tags.append((ref, match[2] if namespace == 'EXACT_SHA_TRANSFER_ALIAS' else None))
    if len(components) != 1 or len(namespaces) != 1 or next(iter(components)) not in ('api', 'web', 'migration'):
        return None
    config = item.get('Config') if isinstance(item.get('Config'), dict) else {}
    labels = config.get('Labels') if isinstance(config.get('Labels'), dict) else {}
    revision = labels.get('org.opencontainers.image.revision')
    if not isinstance(revision, str) or not SHA.fullmatch(revision):
        return None
    namespace = next(iter(namespaces))
    if namespace == 'EXACT_SHA_TRANSFER_ALIAS' and (not tags or any(tag_revision != revision for _, tag_revision in tags)):
        return None
    return next(iter(components)), namespace, refs, revision


def capacity_image_reclaim_plan(containers: Any, images: Any, target: Any) -> dict[str, Any]:
    """Reuse captured batches. Logical sizes overlap layers and never promise freed bytes."""
    unknown = empty_image_reclaim_plan()
    try:
        if (not isinstance(target, str) or not SHA.fullmatch(target) or
                not isinstance(containers, dict) or not 1 <= len(containers) <= 128 or
                not isinstance(images, dict) or not 1 <= len(images) <= 512):
            return unknown
        referenced, roles, records = set(), {'api': 0, 'web': 0}, {}
        for identity, item in containers.items():
            if (not isinstance(identity, str) or not CONTAINER_ID.fullmatch(identity) or
                    not isinstance(item, dict) or item.get('Id') != identity or
                    not isinstance(item.get('Image'), str) or not IMAGE_ID.fullmatch(item['Image']) or
                    any(not isinstance(item.get(key), dict) for key in ('Config', 'HostConfig', 'NetworkSettings', 'State'))):
                return unknown
            labels = item['Config'].get('Labels') or {}
            if not isinstance(labels, dict):
                return unknown
            role = labels.get('com.docker.compose.service')
            if role in roles and item['State'].get('Running') is True:
                revision = labels.get('org.opencontainers.image.revision')
                if not isinstance(revision, str) or not SHA.fullmatch(revision):
                    return unknown
                roles[role] += 1
            referenced.add(item['Image'])
        if any(count != 1 for count in roles.values()) or not referenced <= set(images):
            return unknown
        for identity, item in images.items():
            if (not isinstance(identity, str) or not IMAGE_ID.fullmatch(identity) or
                    not isinstance(item, dict) or item.get('Id') != identity):
                return unknown
            classified = capacity_image_classification(item)
            if classified is None:
                continue
            component, namespace, refs, revision = classified
            size, created = item.get('Size'), item.get('Created')
            match = re.fullmatch(r'(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:[.](\d{1,9}))?Z', created) if isinstance(created, str) else None
            if type(size) is not int or not 0 <= size < 2**63 or match is None:
                return unknown
            seconds = int(dt.datetime.fromisoformat(match[1] + '+00:00').timestamp())
            records[identity] = {'id': identity, 'component': component, 'namespace': namespace,
                                 'revision': revision, 'refs': refs, 'size': size,
                                 'created': (seconds, (match[2] or '').ljust(9, '0'), identity)}
        protected, groups = set(referenced), {}
        for identity, row in records.items():
            if row['revision'] == target:
                protected.add(identity)
            groups.setdefault((row['component'], row['namespace']), []).append(row)
        for rows in groups.values():
            protected.update(row['id'] for row in sorted(rows, key=lambda row: row['created'], reverse=True)[:2])
        eligible = sorted((row for identity, row in records.items() if identity not in protected),
                          key=lambda row: row['created'], reverse=True)
        # Bounded numeric prefix only; logical sizes never predict physical reclaim.
        candidates, cumulative = [], 0
        for rank, row in enumerate(eligible[:8], 1):
            cumulative += row['size']
            candidates.append({'rank': rank, 'logical_bytes_upper': row['size'],
                               'cumulative_logical_bytes_upper': cumulative,
                               'initial_reference_count': len(row['refs']),
                               'initial_rm_calls_lower': 1, 'initial_rm_calls_upper': len(row['refs']) + 1})
        return {**unknown, 'status': 'INITIAL_SNAPSHOT_ONLY', 'canonical_image_count': len(records),
                'eligible_image_count': len(eligible), 'container_protected_image_count': len(referenced),
                'protected_image_count': len(protected),
                'eligible_logical_bytes_upper': sum(row['size'] for row in eligible),
                'first_candidates': candidates}
    except (ValueError, TypeError, OverflowError, OSError, KeyError):
        return unknown


def validate_image_reclaim_plan(value: Any, profile: dict[str, Any]) -> None:
    template = empty_image_reclaim_plan()
    if (not isinstance(value, dict) or set(value) != set(template) or
            any(value[key] != template[key] for key in ('assurance', 'catalog_stability', 'physical_reclaim')) or
            value['cleanup_authorized'] is not False):
        raise ValueError('IMAGE_PLAN_SCHEMA')
    if value['status'] == 'NOT_PROVEN':
        # Strict null shape prevents False==0 equality from admitting fabricated counts.
        if any(value[key] is not None for key in ('canonical_image_count', 'eligible_image_count',
                'container_protected_image_count', 'protected_image_count', 'eligible_logical_bytes_upper')) or value['first_candidates'] != []:
            raise ValueError('IMAGE_PLAN_UNKNOWN')
        return
    if value['status'] != 'INITIAL_SNAPSHOT_ONLY':
        raise ValueError('IMAGE_PLAN_STATUS')
    count = profile['commands']['images_list']['count']
    container_count = profile['commands']['containers_list']['count']
    if (profile['image_batches']['status'] != 'SUCCESS' or
            profile['commands']['containers_inspect']['status'] != 'SUCCESS' or
            type(count) is not int or type(container_count) is not int or container_count < 2):
        raise ValueError('IMAGE_PLAN_DEPENDENCY')
    for key in ('canonical_image_count', 'eligible_image_count', 'container_protected_image_count', 'protected_image_count'):
        if type(value[key]) is not int or not 0 <= value[key] <= count:
            raise ValueError('IMAGE_PLAN_COUNT')
    canonical, eligible, referenced, protected = (value[key] for key in
        ('canonical_image_count', 'eligible_image_count', 'container_protected_image_count', 'protected_image_count'))
    total = value['eligible_logical_bytes_upper']
    if (not 1 <= referenced <= min(container_count, protected) or eligible > min(canonical, count - protected) or
            not min(2, canonical) <= canonical - eligible <= protected or
            protected > referenced + canonical - eligible or
            type(total) is not int or not 0 <= total <= eligible * (2**63 - 1)):
        raise ValueError('IMAGE_PLAN_RELATION')
    rows = value['first_candidates']
    if not isinstance(rows, list) or len(rows) != min(8, eligible):
        raise ValueError('IMAGE_PLAN_CANDIDATES')
    cumulative = 0
    for rank, row in enumerate(rows, 1):
        if (not isinstance(row, dict) or set(row) != {'rank', 'cumulative_logical_bytes_upper', 'logical_bytes_upper', 'initial_reference_count', 'initial_rm_calls_lower', 'initial_rm_calls_upper'} or
                any(type(number) is not int for number in row.values()) or row['rank'] != rank or
                not 0 <= row['logical_bytes_upper'] < 2**63 or not 1 <= row['initial_reference_count'] <= 128 or
                row['initial_rm_calls_lower'] != 1 or row['initial_rm_calls_upper'] != row['initial_reference_count'] + 1):
            raise ValueError('IMAGE_PLAN_CANDIDATE')
        cumulative += row['logical_bytes_upper']
        if row['cumulative_logical_bytes_upper'] != cumulative:
            raise ValueError('IMAGE_PLAN_CUMULATIVE')
    subtotal = sum(row['logical_bytes_upper'] for row in rows)
    if not subtotal <= total <= subtotal + (eligible - len(rows)) * (2**63 - 1):
        raise ValueError('IMAGE_PLAN_SIZE')


def empty_capacity_profile() -> dict[str, Any]:
    return {'status': 'NOT_PERFORMED', 'assurance': 'FRESH_READ_ONLY_OBSERVATION_NOT_RECLAIMABLE',
            'elapsed_ms': 0, 'command_budget_seconds': 5, 'profile_budget_seconds': 35,
            'stdout_bytes': None, 'io_bytes': None, 'image_reclaim_plan': empty_image_reclaim_plan(),
            'image_batches': {'status': 'NOT_RUN', 'batch_size': 64, 'batch_count': 0,
                              'batch_complete_count': 0, 'complete_image_count': None, 'maxbatch_ms': None,
                              'elapsed_ms': 0, 'stdout_bytes': None, 'io_bytes': None},
            'commands': {key: {'status': 'NOT_RUN', 'elapsed_ms': 0, 'count': None,
                               'stdout_bytes': None, 'io_bytes': None} for key in CAPACITY_QUERY_KEYS},
            'disk_usage': {key: {'status': 'NOT_RUN', 'elapsed_ms': 0, 'bytes': None} for key in CAPACITY_DISK_PATHS}}


def capacity_fixed_path_ready(path: str, *, directory: bool) -> bool:
    """Fixed root-owned ancestors only; never follow a replacement symlink."""
    try:
        parts = PurePosixPath(path).parts
        for index in range(1, len(parts) + 1):
            info = os.stat(str(PurePosixPath(*parts[:index])), follow_symlinks=False)
            last = index == len(parts)
            if (info.st_uid != 0 or info.st_mode & 0o022 or
                    not (stat.S_ISDIR(info.st_mode) if not last or directory else stat.S_ISREG(info.st_mode))):
                return False
        return True
    except (OSError, ValueError):
        return False


def capacity_docker_ready() -> bool:
    try:
        info = os.stat('/run/docker.sock', follow_symlinks=False)
        return (os.geteuid() == 0 and stat.S_ISSOCK(info.st_mode) and info.st_uid == 0
                and not info.st_mode & 0o002 and capacity_fixed_path_ready('/usr/bin/docker', directory=False))
    except OSError:
        return False


class CapacityProfileRunner:
    """Fixed read-only argv; private bounded pipes and one nonrenewable deadline."""
    def __init__(self, outer_deadline: float):
        self.started = time.monotonic()
        self.deadline = min(self.started + CAPACITY_PROFILE_SECONDS, outer_deadline)
        self.total = 0
        self.calls = 0
        self.stdout_total = 0
        self.last_stdout_bytes = 0
        self.last_io_bytes = 0
        self.clean = True
        self.exhausted = False

    def execute(self, key: str, identities: list[str] | None = None) -> tuple[str, int, bytes | None]:
        started = time.monotonic()
        self.last_stdout_bytes = self.last_io_bytes = 0
        if not self.clean or self.exhausted or self.total >= CAPACITY_TOTAL_BYTES or self.deadline - started <= 0.25:
            return 'NOT_RUN', 0, None
        fixed = {'containers_list': ['ps', '-aq', '--no-trunc'],
                 'volumes_list': ['volume', 'ls', '-q'], 'networks_list': ['network', 'ls', '-q', '--no-trunc'],
                 'images_list': ['image', 'ls', '-aq', '--no-trunc']}
        if key in fixed:
            argv = ['/usr/bin/docker', '--host', 'unix:///run/docker.sock'] + fixed[key]
        elif key in ('containers_inspect', 'images_inspect'):
            pattern, maximum = (CONTAINER_ID, 128) if key == 'containers_inspect' else (IMAGE_ID, 512)
            if (not isinstance(identities, list) or not 1 <= len(identities) <= maximum or
                    any(not isinstance(value, str) or not pattern.fullmatch(value) for value in identities) or
                    len(set(identities)) != len(identities)):
                return 'NOT_RUN', 0, None
            argv = ['/usr/bin/docker', '--host', 'unix:///run/docker.sock'] + (['inspect'] if key == 'containers_inspect' else ['image', 'inspect']) + sorted(identities)
        elif key in CAPACITY_DISK_PATHS:
            argv = ['/usr/bin/du', '--summarize', '--block-size=1', '--one-file-system', '--null', '--', CAPACITY_DISK_PATHS[key]]
        else:
            return 'NOT_RUN', 0, None
        deadline = min(started + CAPACITY_COMMAND_SECONDS, self.deadline)
        work_deadline = deadline - 0.25
        proc, poller, stdout = None, selectors.DefaultSelector(), bytearray()
        sizes, status, payload = {'out': 0, 'err': 0}, 'UNKNOWN', None
        parent = os.getpid()
        def child_limits():
            import resource
            resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
            if ctypes.CDLL(None, use_errno=True).prctl(1, signal.SIGKILL, 0, 0, 0) != 0 or os.getppid() != parent:
                os._exit(125)
        try:
            self.calls += 1
            proc = subprocess.Popen(argv, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                    env={'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'LC_ALL': 'C'}, cwd='/',
                                    close_fds=True, start_new_session=True, preexec_fn=child_limits)
            for stream, name in ((proc.stdout, 'out'), (proc.stderr, 'err')):
                os.set_blocking(stream.fileno(), False)
                poller.register(stream, selectors.EVENT_READ, name)
            while poller.get_map():
                remaining = work_deadline - time.monotonic()
                if remaining <= 0:
                    status = 'TIMED_OUT'
                    break
                for item, _ in poller.select(min(remaining, 0.05)):
                    try:
                        # At most one extra byte proves either exhausted cap.
                        size = max(1, min(65536, CAPACITY_OUTPUT_BYTES - sizes[item.data] + 1,
                                          CAPACITY_TOTAL_BYTES - self.total + 1))
                        chunk = os.read(item.fileobj.fileno(), size)
                    except BlockingIOError:
                        continue
                    if not chunk:
                        poller.unregister(item.fileobj)
                        continue
                    sizes[item.data] += len(chunk)
                    self.total += len(chunk)
                    if item.data == 'out':
                        self.stdout_total += len(chunk)
                    if sizes[item.data] > CAPACITY_OUTPUT_BYTES or self.total > CAPACITY_TOTAL_BYTES:
                        if self.total > CAPACITY_TOTAL_BYTES:
                            self.exhausted = True
                        status = 'OUTPUT_LIMIT'
                        break
                    if item.data == 'out':
                        stdout.extend(chunk)
                if status == 'OUTPUT_LIMIT':
                    break
            else:
                code = proc.wait(timeout=max(0.001, work_deadline - time.monotonic()))
                status = 'SUCCESS' if code == 0 else 'NONZERO'
                payload = bytes(stdout) if status == 'SUCCESS' else None
        except subprocess.TimeoutExpired:
            status = 'TIMED_OUT'
        except (OSError, ValueError, subprocess.SubprocessError):
            status = 'UNKNOWN'
        finally:
            poller.close()
            if proc is not None:
                try:
                    os.killpg(proc.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                except OSError:
                    self.clean = False
                for stream in (proc.stdout, proc.stderr):
                    if stream is not None:
                        stream.close()
                try:
                    proc.wait(timeout=max(0.001, deadline - time.monotonic()))
                    while True:
                        try:
                            os.killpg(proc.pid, 0)
                        except ProcessLookupError:
                            break
                        if time.monotonic() >= deadline:
                            self.clean = False
                            break
                        time.sleep(0.005)
                except (OSError, subprocess.TimeoutExpired):
                    self.clean = False
        elapsed = max(0, int((time.monotonic() - started) * 1000))
        self.last_stdout_bytes, self.last_io_bytes = sizes['out'], sizes['out'] + sizes['err']
        if not self.clean or elapsed > CAPACITY_COMMAND_SECONDS * 1000:
            return 'UNKNOWN', elapsed, None
        return status, elapsed, payload


def capacity_inspected_rows(raw: bytes, expected: list[str]) -> dict[str, Any]:
    def pairs(items):
        value = {}
        for name, item in items:
            if name in value:
                raise ValueError('INVALID')
            value[name] = item
        return value
    value = json.loads(raw.decode('utf-8', errors='strict'), object_pairs_hook=pairs,
                       parse_constant=lambda _: (_ for _ in ()).throw(ValueError('INVALID')))
    if (not isinstance(value, list) or len(value) != len(expected) or
            any(not isinstance(row, dict) or not isinstance(row.get('Id'), str) for row in value) or
            {row['Id'] for row in value} != set(expected)):
        raise ValueError('INVALID')
    return {row['Id']: row for row in value}


def capacity_readonly_profile(outer_deadline: float, target: str | None = None) -> dict[str, Any]:
    result = empty_capacity_profile()
    if os.geteuid() != 0:
        return result
    runner = CapacityProfileRunner(outer_deadline)
    ids: dict[str, list[str]] = {}
    container_metadata = None
    stopped = False
    clean_warm_timeout = False
    if capacity_docker_ready():
        for key in CAPACITY_QUERY_KEYS[:-1]:
            source = 'containers_list' if key == 'containers_inspect' else 'images_list'
            if key.endswith('_inspect') and not ids.get(source):
                continue
            status, elapsed, raw = runner.execute(key, ids.get(source))
            count = None
            if status == 'SUCCESS':
                try:
                    if key.endswith('_inspect'):
                        expected = ids[source]
                        container_metadata = capacity_inspected_rows(raw, expected)
                        count = len(container_metadata)
                    else:
                        values = raw.decode('ascii', errors='strict').splitlines()
                        maximum = {'containers_list': 128, 'volumes_list': 512, 'networks_list': 128, 'images_list': 512}[key]
                        pattern = IMAGE_ID if key == 'images_list' else re.compile(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,254}\Z') if key == 'volumes_list' else CONTAINER_ID
                        unique = sorted(set(values))
                        if (len(values) > maximum * (128 if key == 'images_list' else 1) or len(unique) > maximum or
                                any(not pattern.fullmatch(value) for value in values) or
                                key != 'images_list' and len(values) != len(unique)):
                            raise ValueError('INVALID')
                        ids[key], count = unique, len(unique)
                except (UnicodeError, ValueError, TypeError, RecursionError):
                    status = 'INVALID'
            result['commands'][key] = {'status': status, 'elapsed_ms': elapsed, 'count': count,
                                      'stdout_bytes': runner.last_stdout_bytes if status != 'NOT_RUN' else None,
                                      'io_bytes': runner.last_io_bytes if status != 'NOT_RUN' else None}
            if status != 'SUCCESS':
                stopped = True
                break
        if not stopped and ids.get('images_list'):
            expected, metadata = ids['images_list'], {}
            batches = result['image_batches']
            for offset in range(0, len(expected), 64):
                batch = expected[offset:offset + 64]
                status, elapsed, raw = runner.execute('images_inspect', batch)
                if status == 'NOT_RUN':
                    batches['status'] = 'UNKNOWN' if batches['batch_count'] else 'NOT_RUN'
                    stopped = True
                    break
                batches['batch_count'] += 1
                batches['elapsed_ms'] += elapsed
                batches['maxbatch_ms'] = max(batches['maxbatch_ms'] or 0, elapsed)
                batches['stdout_bytes'] = (batches['stdout_bytes'] or 0) + runner.last_stdout_bytes
                batches['io_bytes'] = (batches['io_bytes'] or 0) + runner.last_io_bytes
                if status == 'SUCCESS':
                    try:
                        inspected = capacity_inspected_rows(raw, batch)
                        if set(inspected) & set(metadata):
                            raise ValueError('INVALID')
                        metadata.update(inspected)
                        batches['batch_complete_count'] += 1
                    except (UnicodeError, ValueError, TypeError, RecursionError):
                        status = 'UNKNOWN'
                if status != 'SUCCESS':
                    batches['status'], stopped = status, True
                    break
            else:
                batches['status'] = 'SUCCESS'
                batches['complete_image_count'] = len(metadata)
            if batches['status'] == 'SUCCESS':
                result['image_reclaim_plan'] = capacity_image_reclaim_plan(container_metadata, metadata, target)
                status, elapsed, raw = runner.execute('images_inspect', expected)
                count = None
                if status == 'SUCCESS':
                    try:
                        current = capacity_inspected_rows(raw, expected)
                        canonical = lambda value: json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False)
                        if canonical(current) != canonical(metadata):
                            raise ValueError('DRIFT')
                        count = len(expected)
                    except (UnicodeError, ValueError, TypeError, RecursionError):
                        status = 'UNKNOWN'
                result['commands']['images_inspect_after_warm'] = {
                    'status': status, 'elapsed_ms': elapsed, 'count': count,
                    'stdout_bytes': runner.last_stdout_bytes if status != 'NOT_RUN' else None,
                    'io_bytes': runner.last_io_bytes if status != 'NOT_RUN' else None}
                stopped = status != 'SUCCESS'
                clean_warm_timeout = (status == 'TIMED_OUT' and batches['status'] == 'SUCCESS'
                                      and runner.clean and not runner.exhausted)
    if (not stopped or clean_warm_timeout) and runner.clean and not runner.exhausted and capacity_fixed_path_ready('/usr/bin/du', directory=False):
        for key, path in CAPACITY_DISK_PATHS.items():
            if not capacity_fixed_path_ready(path, directory=True):
                result['disk_usage'][key]['status'] = 'UNKNOWN'
                continue
            status, elapsed, raw = runner.execute(key)
            size = None
            if status == 'SUCCESS':
                match = re.fullmatch(rb'([0-9]{1,19})\t' + re.escape(path.encode('ascii')) + b'\x00', raw)
                if match is None or int(match[1]) >= 2**63:
                    status = 'INVALID'
                else:
                    size = int(match[1])
            result['disk_usage'][key] = {'status': status, 'elapsed_ms': elapsed, 'bytes': size}
            if status == 'OUTPUT_LIMIT' or not runner.clean or runner.exhausted:
                break
    result['elapsed_ms'] = max(0, int((time.monotonic() - runner.started) * 1000))
    if runner.calls:
        result['stdout_bytes'], result['io_bytes'] = runner.stdout_total, runner.total
    rows = [*result['commands'].values(), *result['disk_usage'].values()]
    result['status'] = ('NOT_PERFORMED' if all(row['status'] == 'NOT_RUN' for row in rows) else
                        'COMPLETE_READ_ONLY' if all(row['status'] == 'SUCCESS' for row in rows) and result['image_batches']['status'] == 'SUCCESS' and result['elapsed_ms'] <= 35000 else 'PARTIAL_READ_ONLY')
    return result


def validate_capacity_profile(value: Any) -> None:
    template = empty_capacity_profile()
    if (not isinstance(value, dict) or set(value) != set(template) or
            value['assurance'] != template['assurance'] or value['command_budget_seconds'] != 5 or
            type(value['command_budget_seconds']) is not int or value['profile_budget_seconds'] != 35 or
            type(value['profile_budget_seconds']) is not int or type(value['elapsed_ms']) is not int or
            not 0 <= value['elapsed_ms'] <= 180000 or value['status'] not in ('NOT_PERFORMED', 'COMPLETE_READ_ONLY', 'PARTIAL_READ_ONLY')):
        raise ValueError('CAPACITY_PROFILE_SCHEMA')
    def metrics(stdout, total, *, missing=False, maximum=16777217):
        if missing:
            return stdout is None and total is None
        return (type(stdout) is int and type(total) is int and 0 <= stdout <= total <= maximum)
    if not metrics(value['stdout_bytes'], value['io_bytes'], missing=value['io_bytes'] is None):
        raise ValueError('CAPACITY_PROFILE_IO')
    rows = []
    for section, keys, measure in [('commands', CAPACITY_QUERY_KEYS, 'count'), ('disk_usage', CAPACITY_DISK_PATHS, 'bytes')]:
        if not isinstance(value[section], dict) or set(value[section]) != set(keys):
            raise ValueError('CAPACITY_PROFILE_KEYS')
        for key, row in value[section].items():
            expected = {'status', 'elapsed_ms', measure} | ({'stdout_bytes', 'io_bytes'} if section == 'commands' else set())
            if (not isinstance(row, dict) or set(row) != expected or
                    not isinstance(row['status'], str) or row['status'] not in CAPACITY_STATUSES or type(row['elapsed_ms']) is not int or not 0 <= row['elapsed_ms'] <= 180000 or
                    (row['status'] == 'SUCCESS' and (type(row[measure]) is not int or not 0 <= row[measure] < 2**63 or row['elapsed_ms'] > 5000)) or
                    (row['status'] != 'SUCCESS' and row[measure] is not None) or
                    (row['status'] == 'NOT_RUN' and row['elapsed_ms'] != 0)):
                raise ValueError('CAPACITY_PROFILE_ROW')
            if section == 'commands':
                if (not metrics(row['stdout_bytes'], row['io_bytes'], missing=row['status'] == 'NOT_RUN', maximum=4194305) or
                        (row['stdout_bytes'] is not None and row['stdout_bytes'] > 2097153) or
                        (row['status'] == 'SUCCESS' and (row['stdout_bytes'] > 2097152 or row['io_bytes'] > 4194304))):
                    raise ValueError('CAPACITY_PROFILE_COMMAND_IO')
                if row['status'] == 'SUCCESS' and row['count'] > (512 if key in ('volumes_list', 'images_list', 'images_inspect_after_warm') else 128):
                    raise ValueError('CAPACITY_PROFILE_COUNT')
            rows.append(row)
    batches = value['image_batches']
    if (not isinstance(batches, dict) or set(batches) != set(template['image_batches']) or
            not isinstance(batches['status'], str) or batches['status'] not in CAPACITY_STATUSES or
            type(batches['batch_size']) is not int or batches['batch_size'] != 64 or
            type(batches['batch_count']) is not int or not 0 <= batches['batch_count'] <= 8 or
            type(batches['batch_complete_count']) is not int or not 0 <= batches['batch_complete_count'] <= batches['batch_count'] or
            type(batches['elapsed_ms']) is not int or not 0 <= batches['elapsed_ms'] <= 180000 or
            not metrics(batches['stdout_bytes'], batches['io_bytes'], missing=batches['batch_count'] == 0)):
        raise ValueError('CAPACITY_BATCH_SCHEMA')
    if batches['batch_count'] == 0:
        if batches != template['image_batches']:
            raise ValueError('CAPACITY_BATCH_NOT_RUN')
    elif (type(batches['maxbatch_ms']) is not int or not 0 <= batches['maxbatch_ms'] <= batches['elapsed_ms'] or
          batches['elapsed_ms'] > batches['batch_count'] * batches['maxbatch_ms'] or batches['status'] == 'NOT_RUN'):
        raise ValueError('CAPACITY_BATCH_TIMING')
    listed = value['commands']['images_list']
    if batches['status'] == 'SUCCESS':
        if (listed['status'] != 'SUCCESS' or not listed['count'] or
                type(batches['complete_image_count']) is not int or batches['complete_image_count'] != listed['count'] or
                batches['batch_count'] != (listed['count'] + 63) // 64 or
                batches['batch_complete_count'] != batches['batch_count'] or batches['maxbatch_ms'] > 5000 or
                batches['stdout_bytes'] > min(16777216, batches['batch_count'] * 2097152) or
                batches['io_bytes'] > min(16777216, batches['batch_count'] * 4194304)):
            raise ValueError('CAPACITY_BATCH_COMPLETE')
    elif batches['complete_image_count'] is not None:
        raise ValueError('CAPACITY_BATCH_UNKNOWN_COUNT')
    if batches['batch_count'] and (listed['status'] != 'SUCCESS' or not listed['count'] or batches['batch_count'] > (listed['count'] + 63) // 64):
        raise ValueError('CAPACITY_BATCH_DEPENDENCY')
    for source, inspect in [('containers_list', 'containers_inspect'), ('images_list', 'images_inspect_after_warm')]:
        source_row, inspected = value['commands'][source], value['commands'][inspect]
        if inspected['status'] == 'SUCCESS' and (source_row['status'] != 'SUCCESS' or not source_row['count'] or inspected['count'] != source_row['count']):
            raise ValueError('CAPACITY_PROFILE_DEPENDENCY')
    warm = value['commands']['images_inspect_after_warm']
    if warm['status'] != 'NOT_RUN' and batches['status'] != 'SUCCESS':
        raise ValueError('CAPACITY_WARM_BEFORE_COMPLETE_BATCHES')
    if sum(row['elapsed_ms'] for row in rows) + batches['elapsed_ms'] > value['elapsed_ms']:
        raise ValueError('CAPACITY_PROFILE_TIMING')
    known_io = sum(row['io_bytes'] or 0 for row in value['commands'].values()) + (batches['io_bytes'] or 0)
    known_stdout = sum(row['stdout_bytes'] or 0 for row in value['commands'].values()) + (batches['stdout_bytes'] or 0)
    if (known_io and value['io_bytes'] is None or known_stdout and value['stdout_bytes'] is None or
            value['io_bytes'] is not None and known_io > value['io_bytes'] or
            value['stdout_bytes'] is not None and known_stdout > value['stdout_bytes']):
        raise ValueError('CAPACITY_PROFILE_IO_TOTAL')
    expected = ('NOT_PERFORMED' if all(row['status'] == 'NOT_RUN' for row in rows) else
                'COMPLETE_READ_ONLY' if all(row['status'] == 'SUCCESS' for row in rows) and batches['status'] == 'SUCCESS' and value['elapsed_ms'] <= 35000 else 'PARTIAL_READ_ONLY')
    if value['status'] != expected:
        raise ValueError('CAPACITY_PROFILE_CONTRADICTION')
    if value['status'] == 'COMPLETE_READ_ONLY' and (value['io_bytes'] is None or value['io_bytes'] > 16777216):
        raise ValueError('CAPACITY_COMPLETE_OUTPUT_BUDGET')
    validate_image_reclaim_plan(value['image_reclaim_plan'], value)


def collect(target: str) -> dict[str, Any]:
    if not SHA.fullmatch(target):
        raise ValueError('INVALID_TARGET_SHA')
    collection_deadline = time.monotonic() + 180
    wr = containers('web')
    web = wr[0] if wr else {}
    project = ((web.get('Config') or {}).get('Labels') or {}).get('com.docker.compose.project')
    ar = containers('api', project) if isinstance(project, str) and project else []
    api = ar[0] if ar else {}
    caddy_before = caddy_config()
    checks = {
        'web_ingress': ingress(web),
        'canonical_api_origin': origin(web),
        'api_web_peer_trust': trust(web, api),
        'caddy_route_and_headers': caddy_assessment(caddy_before, web),
    }
    db = {'status': 'NOT_PROVEN'}
    api_id = api.get('Id', '')
    if isinstance(api_id, str) and re.fullmatch(r'[0-9a-f]{12,64}', api_id):
        db = migration_metadata(run(['docker', 'exec', '-i', api_id, '/nodejs/bin/node', '-'], DB_PROGRAM))
    capacity = {'disk_free_bytes': shutil.disk_usage('/').free}
    cpu_count = os.cpu_count()
    if type(cpu_count) is int and cpu_count > 0:
        capacity['cpu_count'] = cpu_count
    try:
        mem = Path('/proc/meminfo').read_text()
        m = re.search(r'^MemAvailable:\s+(\d+) kB$', mem, re.M)
        if m:
            capacity['memory_available_bytes'] = int(m.group(1)) * 1024
    except OSError:
        pass
    backup = backups(Path('/var/lib/pc-release-authority/backups'))
    filesystem_observation = filesystem_capacity()
    capacity_profile = capacity_readonly_profile(collection_deadline, target)
    after_web = containers('web')
    after_api = containers('api', project) if isinstance(project, str) and project else []
    stable = (runtime_identity(web) is not None and runtime_identity(api) is not None
              and len(after_web) == len(after_api) == 1
              and runtime_identity(web) == runtime_identity(after_web[0])
              and runtime_identity(api) == runtime_identity(after_api[0]))
    checks['runtime_configuration_stability'] = 'UNCHANGED' if stable else 'NOT_PROVEN'
    checks['caddy_configuration_stability'] = ('UNCHANGED' if caddy_before is not None and caddy_before == caddy_config() else 'NOT_PROVEN')
    result = {'schema': 'pc-crop.market-release-preflight.v6', 'target_sha': target,
            'observed_at_utc': dt.datetime.now(dt.timezone.utc).isoformat(),
            'running_web_revision': revision(web), 'running_api_revision': revision(api),
            'checks': checks, 'migration_inventory': db, 'capacity': capacity,
            'backup': backup, 'outbox_topology': outbox_topology(api, project),
            'release_inventory': release_inventory(web, api, project),
            'production_mutation': 'NONE', 'deployment_authorized': False,
            'live_acceptance': 'NOT_PERFORMED', 'protected_values': 'NOT_PUBLISHED'}
    result['registration_binding'] = registration_preconditions(api, checks, result['outbox_topology'])
    result['api_publication_config'] = api_publication_config(api, checks, result['outbox_topology'])
    result['filesystem_capacity'] = filesystem_observation
    result['capacity_diagnostics'] = capacity_profile
    return result


PUBLICATION = {
    'repository': 'pachaninm-lab/grainflow-api',
    'source_sha': 'a6784252a57a8a5e14f231bc18a64d67ab0fd274',
    'index': 'sha256:9f9095cfdb1c007f62c2eed8c35850c3248d047a4cad440af96a38438469f6e5',
    'manifest': 'sha256:45e109ea493164683c8f717f5e095bd2771dfa1f562c168cc2dd8c920ef73365',
    'config': 'sha256:b7fb48be36e4254d13daa21a56504170b784d6b28ea0b2256b937fdf427109bf',
}
OCI_INDEX = 'application/vnd.oci.image.index.v1+json'
OCI_MANIFEST = 'application/vnd.oci.image.manifest.v1+json'
OCI_CONFIG = 'application/vnd.oci.image.config.v1+json'
PUBLICATION_MAX_BYTES = 512 * 1024
PUBLICATION_MAX_TOTAL = 2 * 1024 * 1024
PUBLICATION_SECONDS = 60


def publication_json(raw: bytes) -> dict[str, Any]:
    def pairs(items: list[tuple[str, Any]]) -> dict[str, Any]:
        value: dict[str, Any] = {}
        for key, item in items:
            if key in value:
                raise ValueError('PUBLICATION_JSON')
            value[key] = item
        return value
    def nonfinite(_: str) -> None:
        raise ValueError('PUBLICATION_JSON')
    if not isinstance(raw, bytes) or not 0 < len(raw) <= PUBLICATION_MAX_BYTES:
        raise ValueError('PUBLICATION_BOUNDS')
    try:
        value = json.loads(raw.decode('utf-8', errors='strict'), object_pairs_hook=pairs,
                           parse_constant=nonfinite)
    except (UnicodeError, ValueError, RecursionError):
        raise ValueError('PUBLICATION_JSON') from None
    if not isinstance(value, dict):
        raise ValueError('PUBLICATION_JSON')
    return value


def publication_digest(raw: bytes, expected: str) -> dict[str, Any]:
    if not isinstance(raw, bytes) or 'sha256:' + hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError('PUBLICATION_DIGEST')
    return publication_json(raw)


def verify_publication_documents(index_raw: bytes, manifest_raw: bytes,
                                 config_raw: bytes) -> dict[str, Any]:
    """Verify pinned metadata only. No image layers or installed code are read."""
    index = publication_digest(index_raw, PUBLICATION['index'])
    manifest = publication_digest(manifest_raw, PUBLICATION['manifest'])
    config = publication_digest(config_raw, PUBLICATION['config'])
    if type(index.get('schemaVersion')) is not int or index['schemaVersion'] != 2 or index.get('mediaType') != OCI_INDEX:
        raise ValueError('PUBLICATION_INDEX')
    descriptors = index.get('manifests')
    if not isinstance(descriptors, list) or not 0 < len(descriptors) <= 16:
        raise ValueError('PUBLICATION_INDEX')
    candidates = [d for d in descriptors if isinstance(d, dict) and d.get('digest') == PUBLICATION['manifest']]
    if len(candidates) != 1:
        raise ValueError('PUBLICATION_PLATFORM')
    selected = candidates[0]
    platform = selected.get('platform')
    if (not isinstance(platform, dict) or platform.get('os') != 'linux' or platform.get('architecture') != 'amd64'
            or platform.get('variant') not in (None, '') or selected.get('mediaType') != OCI_MANIFEST
            or type(selected.get('size')) is not int or selected['size'] != len(manifest_raw)):
        raise ValueError('PUBLICATION_PLATFORM')
    descriptor = manifest.get('config')
    if (type(manifest.get('schemaVersion')) is not int or manifest['schemaVersion'] != 2 or manifest.get('mediaType') != OCI_MANIFEST
            or not isinstance(descriptor, dict) or descriptor.get('mediaType') != OCI_CONFIG
            or descriptor.get('digest') != PUBLICATION['config']
            or type(descriptor.get('size')) is not int or descriptor['size'] != len(config_raw)):
        raise ValueError('PUBLICATION_CONFIG')
    layers = manifest.get('layers')
    if not isinstance(layers, list) or not 0 < len(layers) <= 128:
        raise ValueError('PUBLICATION_LAYERS')
    total = 0
    for layer in layers:
        if (not isinstance(layer, dict) or not isinstance(layer.get('digest'), str)
                or not re.fullmatch(r'sha256:[0-9a-f]{64}', layer['digest'])
                or type(layer.get('size')) is not int or not 0 < layer['size'] <= 1024**3
                or layer.get('mediaType') not in ('application/vnd.oci.image.layer.v1.tar+gzip',
                                                'application/vnd.oci.image.layer.v1.tar')):
            raise ValueError('PUBLICATION_LAYERS')
        total += layer['size']
    if total > 4 * 1024**3:
        raise ValueError('PUBLICATION_LAYERS')
    rootfs = config.get('rootfs')
    image_config = config.get('config')
    labels = image_config.get('Labels') if isinstance(image_config, dict) else None
    if (config.get('os') != 'linux' or config.get('architecture') != 'amd64'
            or not isinstance(labels, dict) or labels.get('org.opencontainers.image.revision') != PUBLICATION['source_sha']
            or labels.get('org.opencontainers.image.source') != 'https://github.com/pachaninm-lab/pachanin-demo'
            or not isinstance(rootfs, dict) or rootfs.get('type') != 'layers'):
        raise ValueError('PUBLICATION_REVISION')
    diff_ids = rootfs.get('diff_ids')
    if (not isinstance(diff_ids, list) or len(diff_ids) != len(layers)
            or any(not isinstance(d, str) or not re.fullmatch(r'sha256:[0-9a-f]{64}', d) for d in diff_ids)):
        raise ValueError('PUBLICATION_ROOTFS')
    # Never export arbitrary labels, environment, history, URLs or registry output.
    return {
        'schema': 'pc-crop.api-publication-baseline.v1',
        'status': 'PINNED_METADATA_VERIFIED',
        'source_sha': PUBLICATION['source_sha'],
        'index_digest': PUBLICATION['index'],
        'manifest_digest': PUBLICATION['manifest'],
        'image_config_digest': PUBLICATION['config'],
        'platform': 'linux/amd64',
        'layer_count': len(layers),
        'declared_layer_bytes': total,
        'layer_contents': 'NOT_DOWNLOADED',
        'installed_code': 'NOT_INSPECTED',
        'host_binding': 'NOT_PERFORMED',
        'registration_binding': 'NOT_PERFORMED',
        'production_mutation': 'NONE',
        'deployment_authorized': False,
    }


def publication_get(url: str, authorization: str, deadline: float,
                    opener: Any, budget: list[int], *, max_bytes: int = PUBLICATION_MAX_BYTES,
                    allow_blob_redirect: bool = False) -> bytes:
    """Bounded GET; fixed registry origin or credential-free GitHub blob redirect."""
    # The authenticated fixed config endpoint supplies a storage location.
    # Its bounded namespace is transport policy; the pinned response-byte SHA
    # below is the resource identity. Storage object names need not be digests.
    if allow_blob_redirect and url != ('https://ghcr.io/v2/' + PUBLICATION['repository'] + '/blobs/' + PUBLICATION['config']):
        raise ValueError('PUBLICATION_ORIGIN')
    for redirect in range(3):
        if (not isinstance(url, str) or not 0 < len(url) <= 8192
                or any(not 33 <= ord(char) <= 126 for char in url)):
            raise ValueError('PUBLICATION_REDIRECT')
        parsed = urllib.parse.urlsplit(url)
        registry = parsed.hostname == 'ghcr.io'
        storage = parsed.hostname == 'pkg-containers.githubusercontent.com'
        if (len(url) > 8192 or parsed.scheme != 'https' or parsed.port not in (None, 443)
                or parsed.username is not None or parsed.password is not None or parsed.fragment
                or (not registry and not (allow_blob_redirect and storage))):
            raise ValueError('PUBLICATION_ORIGIN')
        if storage:
            # Decode once for this bounded path policy, without rewriting the
            # signed URL or asserting general URI equivalence. Byte-digest
            # verification remains mandatory before any document is admitted.
            if not 1 < len(parsed.path) <= 2048:
                raise ValueError('PUBLICATION_STORAGE_LENGTH')
            if re.search(r'%(?![0-9A-Fa-f]{2})', parsed.path):
                raise ValueError('PUBLICATION_STORAGE_ENCODING')
            try:
                storage_path = urllib.parse.unquote_to_bytes(parsed.path).decode('ascii', errors='strict')
            except UnicodeError:
                raise ValueError('PUBLICATION_STORAGE_ENCODING') from None
            if '%' in storage_path:
                raise ValueError('PUBLICATION_STORAGE_ENCODING')
            if not 1 < len(storage_path) <= 2048:
                raise ValueError('PUBLICATION_STORAGE_LENGTH')
            # Storage layout is opaque. The fixed origin and content digest,
            # rather than a guessed pool/filename, bind the returned resource.
            if not re.fullmatch(r"/[A-Za-z0-9._~!$&'()*+,;=:@/-]+", storage_path):
                raise ValueError('PUBLICATION_STORAGE_PATH')
            segments = storage_path[1:].split('/')
            if len(segments) > 32 or any(part in ('', '.', '..') for part in segments):
                raise ValueError('PUBLICATION_STORAGE_SEGMENTS')
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise ValueError('PUBLICATION_TIMEOUT')
        headers = {'Accept': OCI_INDEX + ', ' + OCI_MANIFEST + ', ' + OCI_CONFIG}
        if registry:
            headers['Authorization'] = authorization
        request = urllib.request.Request(url, headers=headers, method='GET')
        budget[1] += 1
        if budget[1] > 8:
            raise ValueError('PUBLICATION_BOUNDS')
        try:
            response = opener.open(request, timeout=min(5, remaining))
        except urllib.error.HTTPError as error:
            if allow_blob_redirect and error.code in (301, 302, 303, 307, 308) and redirect < 2:
                location = error.headers.get('Location', '')
                error.close()
                # Registry credentials never follow a redirect, even to the registry.
                authorization = ''
                # Do not let URL resolution erase raw controls or dot segments.
                # Cross-origin absolute and scheme-relative HTTPS locations
                # preserve their signed path/query; relative paths are denied.
                if (not isinstance(location, str) or not 0 < len(location) <= 8192
                        or any(not 33 <= ord(char) <= 126 for char in location)):
                    raise ValueError('PUBLICATION_REDIRECT') from None
                if location.startswith('https://'):
                    url = location
                elif location.startswith('//'):
                    url = 'https:' + location
                else:
                    raise ValueError('PUBLICATION_ORIGIN') from None
                if urllib.parse.urlsplit(url).hostname != 'pkg-containers.githubusercontent.com':
                    raise ValueError('PUBLICATION_ORIGIN') from None
                continue
            error.close()
            raise ValueError('PUBLICATION_AUTHORIZATION' if error.code in (401, 403) else 'PUBLICATION_HTTP') from None
        with response:
            if response.status != 200 or response.geturl() != url:
                raise ValueError('PUBLICATION_HTTP')
            length = response.headers.get('Content-Length')
            if length is not None and (not length.isascii() or not length.isdigit() or int(length) > max_bytes):
                raise ValueError('PUBLICATION_BOUNDS')
            chunks = []
            size = 0
            while True:
                if time.monotonic() >= deadline:
                    raise ValueError('PUBLICATION_TIMEOUT')
                chunk = response.read1(min(16384, max_bytes + 1 - size))
                if not chunk:
                    break
                size += len(chunk)
                budget[0] += len(chunk)
                if size > max_bytes or budget[0] > PUBLICATION_MAX_TOTAL:
                    raise ValueError('PUBLICATION_BOUNDS')
                chunks.append(chunk)
            if not size:
                raise ValueError('PUBLICATION_BOUNDS')
            return b''.join(chunks)
    raise ValueError('PUBLICATION_HTTP')


def published_api_baseline() -> dict[str, Any]:
    # A separate same-repository PR runner, never the issue-command host collector.
    required = {'GITHUB_ACTIONS': 'true', 'GITHUB_EVENT_NAME': 'pull_request',
                'GITHUB_REPOSITORY': 'pachaninm-lab/pachanin-demo',
                'GITHUB_HEAD_REF': 'ops/farmer-market-release-preflight-20260916'}
    if any(os.environ.get(key) != value for key, value in required.items()):
        raise ValueError('PUBLICATION_RUNNER_ONLY')
    actor, token = os.environ.get('GITHUB_ACTOR', ''), os.environ.get('GH_TOKEN', '')
    producer = os.environ.get('GITHUB_SHA', '')
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,100}', actor) or not token or len(token) > 2048 or not SHA.fullmatch(producer):
        raise ValueError('PUBLICATION_RUNNER_ONLY')
    deadline, budget = time.monotonic() + PUBLICATION_SECONDS, [0, 0]
    opener = urllib.request.build_opener(NoRedirect())
    basic = 'Basic ' + base64.b64encode((actor + ':' + token).encode()).decode('ascii')
    token_url = 'https://ghcr.io/token?' + urllib.parse.urlencode({
        'service': 'ghcr.io', 'scope': 'repository:' + PUBLICATION['repository'] + ':pull'})
    auth = publication_json(publication_get(token_url, basic, deadline, opener, budget, max_bytes=65536)).get('token')
    if not isinstance(auth, str) or not 0 < len(auth) <= 20000 or not re.fullmatch(r'[!-~]+', auth):
        raise ValueError('PUBLICATION_AUTH')
    bearer = 'Bearer ' + auth
    prefix = 'https://ghcr.io/v2/' + PUBLICATION['repository'] + '/'
    index = publication_get(prefix + 'manifests/' + PUBLICATION['index'], bearer, deadline, opener, budget)
    manifest = publication_get(prefix + 'manifests/' + PUBLICATION['manifest'], bearer, deadline, opener, budget)
    config = publication_get(prefix + 'blobs/' + PUBLICATION['config'], bearer, deadline, opener, budget,
                             allow_blob_redirect=True)
    result = verify_publication_documents(index, manifest, config)
    result['producer_actions_sha'] = producer
    result['producer_source_sha256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    return result


# Original-volume inventory is a separately admitted read purpose, never release authority.
ORIGINAL_RECEIPT = {
    'schemaVersion': 'pc.cold-preservation.v1',
    'targetSha': 'a509789c22298375130d70fde95915b8daa7634a', 'runId': '39779050389',
    'passed': True, 'status': 'ENCRYPTED_COLD_PRESERVATION_VERIFIED',
    'ciphertextBytes': 389954515,
    'ciphertextSha256': '800264a1819ba26869e4b79d1f6874dc5078aa982ab333fdd999629f6b490603',
    'entries': 8547, 'sourceBytes': 520405747, 'volumes': 19,
    'sourceUnchanged': True, 'runtimeUnchanged': True, 'runtimeRestored': False,
    'databaseIntegrity': 'NOT_ATTESTED', 'restoreVerification': 'NOT_PERFORMED',
    'offHostRecovery': 'NOT_ESTABLISHED',
}
ORIGINAL_ROOT = '/var/lib/pc-release-authority/backups/cold-preservation-20261022'
ORIGINAL_MANIFEST = 'pc-cold-preservation-manifest.json'
ORIGINAL_MANIFEST_LIMIT = 16 * 1024 * 1024
ORIGINAL_PLAINTEXT_LIMIT = 2 * 1024**3
ORIGINAL_STATUS_LIMIT = 65536
ORIGINAL_SECONDS = 90
ORIGINAL_NAME = re.compile(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,254}\Z')
ORIGINAL_FAILURES = frozenset({'IDENTITY', 'RECEIPT', 'CIPHER', 'DEADLINE', 'GPG',
    'AUTHENTICATION', 'MANIFEST', 'ARCHIVE', 'CURRENT', 'DRIFT', 'BOUNDS', 'UNAVAILABLE'})


class OriginalRefusal(ValueError):
    pass


def original_require(condition: Any, code: str) -> None:
    if not condition:
        raise OriginalRefusal(code)


def original_check_deadline(deadline: float) -> None:
    original_require(time.monotonic() < deadline, 'DEADLINE')


def original_json(raw: bytes) -> Any:
    def pairs(items: list[tuple[str, Any]]) -> dict[str, Any]:
        value: dict[str, Any] = {}
        for key, item in items:
            original_require(key not in value, 'MANIFEST')
            value[key] = item
        return value
    def invalid(_: str) -> None:
        raise OriginalRefusal('MANIFEST')
    try:
        return json.loads(raw.decode('utf-8', errors='strict'), object_pairs_hook=pairs,
                          parse_constant=invalid)
    except (ValueError, UnicodeError, RecursionError):
        raise OriginalRefusal('MANIFEST') from None


def original_token(info: Any) -> tuple[Any, ...]:
    return (info.st_dev, info.st_ino, info.st_mode, info.st_uid, info.st_gid, info.st_nlink,
            info.st_size, info.st_atime_ns, info.st_mtime_ns, info.st_ctime_ns)


def original_directory(path: str) -> list[int]:
    """Fixed descriptor-only traversal; no symlink, directory enumeration or atime write."""
    original_require(path == ORIGINAL_ROOT and hasattr(os, 'O_NOATIME'), 'IDENTITY')
    descriptors: list[int] = []
    try:
        for part in ['/', *path.split('/')[1:]]:
            fd = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_NOATIME,
                         dir_fd=descriptors[-1] if descriptors else None)
            descriptors.append(fd)
            info = os.fstat(fd)
            original_require(stat.S_ISDIR(info.st_mode) and info.st_uid == info.st_gid == 0
                             and not stat.S_IMODE(info.st_mode) & 0o022, 'IDENTITY')
        original_require(stat.S_IMODE(os.fstat(descriptors[-1]).st_mode) == 0o700
                         and stat.S_IMODE(os.fstat(descriptors[-2]).st_mode) == 0o700, 'IDENTITY')
        return descriptors
    except BaseException:
        for fd in reversed(descriptors):
            os.close(fd)
        raise


def original_file(parent: int, name: str, size: int | None = None) -> int:
    original_require(name in {'passphrase', 'preservation.tar.gpg', 'receipt.json'}, 'IDENTITY')
    fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NOATIME | os.O_NONBLOCK, dir_fd=parent)
    try:
        info = os.fstat(fd)
        original_require(stat.S_ISREG(info.st_mode) and info.st_uid == info.st_gid == 0
                         and stat.S_IMODE(info.st_mode) == 0o600 and info.st_nlink == 1
                         and 0 < info.st_size <= (ORIGINAL_PLAINTEXT_LIMIT if size is None else size)
                         and (size is None or info.st_size == size), 'IDENTITY')
        return fd
    except BaseException:
        os.close(fd)
        raise


def original_hash(fd: int, deadline: float) -> str:
    os.lseek(fd, 0, os.SEEK_SET)
    digest = hashlib.sha256()
    count = 0
    while True:
        original_check_deadline(deadline)
        block = os.read(fd, 65536)
        if not block:
            break
        count += len(block)
        original_require(count <= ORIGINAL_RECEIPT['ciphertextBytes'], 'CIPHER')
        digest.update(block)
    original_require(count == ORIGINAL_RECEIPT['ciphertextBytes'], 'CIPHER')
    return digest.hexdigest()


def original_current_names() -> tuple[str, ...]:
    raw = run(['docker', 'volume', 'ls', '-q'])
    original_require(type(raw) is str and len(raw) <= 19 * 256, 'CURRENT')
    names = raw.splitlines()
    original_require(len(names) == len(set(names)) == 19 and
                     all(ORIGINAL_NAME.fullmatch(name) for name in names), 'CURRENT')
    return tuple(sorted(names))


def original_name_digests(names: tuple[str, ...]) -> tuple[str, str]:
    canonical = json.dumps(sorted(names), ensure_ascii=True, separators=(',', ':')).encode('ascii')
    # Historical later observations hash newline-joined current names without a final LF.
    return hashlib.sha256(canonical).hexdigest(), hashlib.sha256('\n'.join(sorted(names)).encode('ascii')).hexdigest()


def original_manifest(raw: bytes) -> tuple[dict[str, Any], tuple[str, ...]]:
    original_require(0 < len(raw) <= ORIGINAL_MANIFEST_LIMIT, 'BOUNDS')
    value = original_json(raw)
    original_require(type(value) is dict and set(value) == {'schema', 'entries'} and
                     value['schema'] == 'pc.cold-preservation.manifest.v1', 'MANIFEST')
    entries = value['entries']
    original_require(type(entries) is dict and len(entries) == ORIGINAL_RECEIPT['entries'], 'MANIFEST')
    fields = {'kind', 'uid', 'gid', 'mode', 'mtime_ns', 'ctime_ns', 'atime_ns', 'device',
              'inode', 'nlink', 'size', 'sha256', 'xattrs'}
    names: set[str] = set()
    source_bytes = path_bytes = attribute_bytes = 0
    for path, entry in entries.items():
        original_require(type(path) is str and 0 < len(os.fsencode(path)) <= 4096, 'MANIFEST')
        parts = path.split('/')
        original_require(len(parts) <= 66 and all(part not in ('', '.', '..') and '\0' not in part for part in parts)
                         and parts[0] in {'containers', 'volumes'}, 'MANIFEST')
        path_bytes += len(os.fsencode(path))
        original_require(path_bytes <= 32 * 1024 * 1024 and type(entry) is dict and set(entry) == fields,
                         'MANIFEST')
        original_require(entry['kind'] in {'file', 'directory'}, 'MANIFEST')
        for key in fields - {'kind', 'sha256', 'xattrs'}:
            original_require(type(entry[key]) is int and 0 <= entry[key] < 2**63, 'MANIFEST')
        original_require(entry['mode'] <= 0o7777 and entry['nlink'] > 0 and entry['inode'] > 0, 'MANIFEST')
        if entry['kind'] == 'directory':
            original_require(entry['size'] == 0 and entry['sha256'] is None, 'MANIFEST')
        else:
            original_require(type(entry['sha256']) is str and CHECKSUM.fullmatch(entry['sha256']), 'MANIFEST')
            source_bytes += entry['size']
        attrs = entry['xattrs']
        original_require(type(attrs) is dict and len(attrs) <= 1024, 'MANIFEST')
        for key, attr in attrs.items():
            original_require(type(key) is str and key.startswith('user.') and len(key.encode('utf-8')) <= 255
                             and '\0' not in key and type(attr) is dict and set(attr) == {'bytes', 'sha256'}
                             and type(attr['bytes']) is int and 0 <= attr['bytes'] <= 16 * 1024 * 1024
                             and type(attr['sha256']) is str and CHECKSUM.fullmatch(attr['sha256']), 'MANIFEST')
            attribute_bytes += len(key.encode('utf-8')) + attr['bytes']
        original_require(attribute_bytes <= 16 * 1024 * 1024, 'MANIFEST')
        if parts[0] == 'volumes' and len(parts) >= 2:
            original_require(ORIGINAL_NAME.fullmatch(parts[1]), 'MANIFEST')
            names.add(parts[1])
    original_require(source_bytes == ORIGINAL_RECEIPT['sourceBytes'] and len(names) == 19, 'MANIFEST')
    for path, entry in entries.items():
        parts = path.split('/')
        for index in range(1, len(parts)):
            original_require(entries.get('/'.join(parts[:index]), {}).get('kind') == 'directory', 'MANIFEST')
        if len(parts) == 1 or (parts[0] == 'volumes' and len(parts) == 2):
            original_require(entry['kind'] == 'directory', 'MANIFEST')
    for name in names:
        original_require(entries.get('volumes/' + name + '/_data', {}).get('kind') == 'directory', 'MANIFEST')
    original_require(entries.get('containers', {}).get('kind') == 'directory'
                     and entries.get('volumes', {}).get('kind') == 'directory', 'MANIFEST')
    return entries, tuple(sorted(names))


def original_child_limits() -> None:
    import resource
    parent = os.getppid()
    libc = ctypes.CDLL(None, use_errno=True)
    if parent == 1 or libc.prctl(1, signal.SIGKILL, 0, 0, 0) != 0 or os.getppid() != parent:
        os._exit(125)
    for kind, maximum in ((resource.RLIMIT_CORE, 0), (resource.RLIMIT_FSIZE, 0),
                          (resource.RLIMIT_AS, 256 * 1024 * 1024), (resource.RLIMIT_CPU, ORIGINAL_SECONDS)):
        _, hard = resource.getrlimit(kind)
        limit = maximum if hard == resource.RLIM_INFINITY else min(maximum, hard)
        resource.setrlimit(kind, (limit, limit))
    os.umask(0o077)


class OriginalGPGStream:
    """Multiplex and bound both pipes; never log status arguments or plaintext."""
    def __init__(self, cipher_fd: int, key_fd: int, deadline: float):
        original_check_deadline(deadline)
        self.deadline, self.total, self.status = deadline, 0, bytearray()
        self.pending = bytearray()
        self.process = subprocess.Popen([
            '/usr/bin/gpg', '--no-options', '--homedir', '/nonexistent', '--no-autostart',
            '--batch', '--no-tty', '--no-symkey-cache', '--no-keyring', '--no-random-seed-file',
            '--lock-never', '--pinentry-mode', 'loopback', '--passphrase-fd', str(key_fd),
            '--status-fd', '2', '--decrypt', '--output', '-'],
            stdin=cipher_fd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            pass_fds=(key_fd,), env={'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'LC_ALL': 'C.UTF-8'},
            bufsize=0, start_new_session=True, preexec_fn=original_child_limits)
        self.poller = selectors.DefaultSelector()
        self.poller.register(self.process.stdout, selectors.EVENT_READ, 'plain')
        self.poller.register(self.process.stderr, selectors.EVENT_READ, 'status')

    def read(self, count: int) -> bytes:
        original_require(type(count) is int and 0 < count <= 65536, 'BOUNDS')
        while len(self.pending) < count and self.poller.get_map():
            original_check_deadline(self.deadline)
            events = self.poller.select(min(0.25, max(0, self.deadline - time.monotonic())))
            for key, _ in events:
                block = os.read(key.fileobj.fileno(), 65536)
                if not block:
                    self.poller.unregister(key.fileobj)
                elif key.data == 'status':
                    self.status.extend(block)
                    original_require(len(self.status) <= ORIGINAL_STATUS_LIMIT, 'BOUNDS')
                else:
                    self.total += len(block)
                    original_require(self.total <= ORIGINAL_PLAINTEXT_LIMIT, 'BOUNDS')
                    self.pending.extend(block)
        result = bytes(self.pending[:count])
        del self.pending[:count]
        return result

    def authenticate(self) -> None:
        original_require(not self.pending and not self.poller.get_map(), 'AUTHENTICATION')
        original_check_deadline(self.deadline)
        code = self.process.wait(timeout=max(0.001, self.deadline - time.monotonic()))
        records = [line[len(b'[GNUPG:] '):].split()
                   for line in bytes(self.status).splitlines() if line.startswith(b'[GNUPG:] ')]
        statuses = [record[0] for record in records if record]
        infos = [record[1:] for record in records if record and record[0] == b'DECRYPTION_INFO']
        original_require(code == 0 and infos == [[b'2', b'9', b'0']] and
                         all(statuses.count(word) == 1 for word in
                         (b'BEGIN_DECRYPTION', b'GOODMDC', b'DECRYPTION_OKAY', b'END_DECRYPTION')) and not
                         set(statuses) & {b'BADMDC', b'ERRMDC', b'DECRYPTION_FAILED', b'FAILURE', b'ERROR',
                                          b'NODATA', b'UNEXPECTED'}, 'AUTHENTICATION')

    def close(self) -> None:
        if self.process.poll() is None:
            os.killpg(self.process.pid, signal.SIGKILL)
            self.process.wait(timeout=5)
        self.poller.close()
        self.process.stdout.close()
        self.process.stderr.close()
        self.status.clear()
        self.pending.clear()


def original_archive(stream: Any, deadline: float) -> tuple[str, ...]:
    """Verify every authenticated tar member in memory; no extraction or saved plaintext."""
    import tarfile
    from decimal import Decimal, InvalidOperation
    class BoundedTarInfo(tarfile.TarInfo):
        def _proc_pax(self, archive):
            original_require(0 <= self.size <= 1024 * 1024, 'BOUNDS')
            return super()._proc_pax(archive)
        def _proc_gnulong(self, archive):
            original_require(0 <= self.size <= 8192, 'BOUNDS')
            return super()._proc_gnulong(archive)
    try:
        with tarfile.open(fileobj=stream, mode='r|', bufsize=512, tarinfo=BoundedTarInfo,
                          encoding='utf-8', errors='surrogateescape') as archive:
            first = archive.next()
            original_require(first is not None and first.name == ORIGINAL_MANIFEST and first.isfile()
                             and 0 < first.size <= ORIGINAL_MANIFEST_LIMIT and first.uid == first.gid == 0
                             and first.mode == 0o600 and not first.linkname, 'MANIFEST')
            source = archive.extractfile(first)
            original_require(source is not None, 'MANIFEST')
            entries, names = original_manifest(source.read(ORIGINAL_MANIFEST_LIMIT + 1))
            seen: set[str] = set()
            # next() above leaves firstmember pending for iterator semantics.
            for member in archive:
                if member is first:
                    continue
                original_check_deadline(deadline)
                name = member.name.rstrip('/')
                original_require(name not in seen and name in entries, 'ARCHIVE')
                entry = entries[name]
                original_require(member.uid == entry['uid'] and member.gid == entry['gid']
                                 and member.mode == entry['mode'] and
                                 Decimal(member.pax_headers.get('mtime', str(member.mtime))) * 10**9 == entry['mtime_ns'], 'ARCHIVE')
                attrs = {}
                for key, value in member.pax_headers.items():
                    if key.startswith('SCHILY.xattr.'):
                        payload = value.encode('utf-8', 'surrogateescape')
                        attrs[key[len('SCHILY.xattr.'):]] = {'bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest()}
                if entry['kind'] == 'directory':
                    original_require(member.isdir() and member.size == 0, 'ARCHIVE')
                elif member.islnk():
                    target = entries.get(member.linkname)
                    original_require(member.linkname in seen and type(target) is dict and target['kind'] == 'file'
                                     and all(target[key] == entry[key] for key in ('device', 'inode', 'size', 'sha256', 'xattrs')), 'ARCHIVE')
                    if not attrs:
                        attrs = target['xattrs']
                else:
                    original_require(member.isfile() and member.size == entry['size'], 'ARCHIVE')
                    source = archive.extractfile(member)
                    original_require(source is not None, 'ARCHIVE')
                    digest, count = hashlib.sha256(), 0
                    while True:
                        original_check_deadline(deadline)
                        block = source.read(65536)
                        if not block:
                            break
                        count += len(block)
                        original_require(count <= entry['size'], 'ARCHIVE')
                        digest.update(block)
                    original_require(count == entry['size'] and digest.hexdigest() == entry['sha256'], 'ARCHIVE')
                original_require(attrs == entry['xattrs'], 'ARCHIVE')
                seen.add(name)
            original_require(seen == set(entries), 'ARCHIVE')
            # tarfile stops at the first end block. Drain its buffered remainder AND
            # the native pipes through EOF; only zero tar padding may follow.
            padding = 512
            while True:
                original_check_deadline(deadline)
                block = archive.fileobj.read(65536)
                if not block:
                    break
                original_require(not block.strip(b'\0'), 'ARCHIVE')
                padding += len(block)
            original_require(padding >= 1024, 'ARCHIVE')
        stream.authenticate()
        return names
    except (tarfile.TarError, UnicodeError, InvalidOperation, OverflowError):
        raise OriginalRefusal('ARCHIVE') from None


def original_inventory_witness() -> dict[str, Any]:
    """Private proposal until explicit owner purpose acceptance; no default-mode key IO."""
    result: dict[str, Any] = {'schema': 'pc-crop.original-volume-inventory.v1', 'status': 'NOT_PROVEN',
        'failure': 'UNAVAILABLE', 'receipt_run_id': ORIGINAL_RECEIPT['runId'],
        'ciphertext_sha256': ORIGINAL_RECEIPT['ciphertextSha256'],
        'original_count': 0, 'current_before_count': 0, 'current_after_count': 0,
        'original_canonical_json_sha256': None, 'current_before_canonical_json_sha256': None,
        'current_after_canonical_json_sha256': None, 'current_before_newline_sha256': None,
        'current_after_newline_sha256': None, 'full_eof_mdc': False,
        'ciphertext_unchanged': False, 'metadata_unchanged': False, 'exact_set_match': False,
        'production_mutation': 'NONE', 'deployment_authorized': False,
        'restore_verification': 'NOT_PERFORMED', 'protected_values': 'NOT_PUBLISHED'}
    descriptors: list[int] = []
    stream = None
    try:
        original_require(os.getuid() == os.geteuid() == 0, 'IDENTITY')
        deadline = time.monotonic() + ORIGINAL_SECONDS
        before = original_current_names()
        descriptors = original_directory(ORIGINAL_ROOT)
        directory_count = len(descriptors)
        for name, size in [('receipt.json', None), ('preservation.tar.gpg', ORIGINAL_RECEIPT['ciphertextBytes']), ('passphrase', 65)]:
            descriptors.append(original_file(descriptors[directory_count - 1], name, size))
        receipt_fd, cipher_fd, key_fd = descriptors[-3:]
        tokens = [original_token(os.fstat(fd)) for fd in descriptors]
        original_require(os.fstat(receipt_fd).st_size <= 4096, 'RECEIPT')
        raw = os.read(receipt_fd, 4097)
        receipt = original_json(raw)
        original_require(len(raw) <= 4096 and receipt == ORIGINAL_RECEIPT
                         and all(type(receipt[key]) is type(value) for key, value in ORIGINAL_RECEIPT.items()), 'RECEIPT')
        original_require(original_hash(cipher_fd, deadline) == ORIGINAL_RECEIPT['ciphertextSha256'], 'CIPHER')
        os.lseek(cipher_fd, 0, os.SEEK_SET)
        # The passphrase is NEVER read by Python. Only native GPG inherits its FD.
        stream = OriginalGPGStream(cipher_fd, key_fd, deadline)
        names = original_archive(stream, deadline)
        stream.close()
        stream = None
        original_require(original_hash(cipher_fd, deadline) == ORIGINAL_RECEIPT['ciphertextSha256'], 'CIPHER')
        after = original_current_names()
        original_check_deadline(deadline)
        original_require(tokens == [original_token(os.fstat(fd)) for fd in descriptors], 'DRIFT')
        # Recheck every path binding as well as open FD tokens, including ancestors.
        for index, part in enumerate(ORIGINAL_ROOT.split('/')[1:], 1):
            original_require(original_token(os.stat(part, dir_fd=descriptors[index - 1], follow_symlinks=False)) == tokens[index], 'DRIFT')
        for index, name in enumerate(('receipt.json', 'preservation.tar.gpg', 'passphrase'), directory_count):
            original_require(original_token(os.stat(name, dir_fd=descriptors[directory_count - 1], follow_symlinks=False)) == tokens[index], 'DRIFT')
        original_require(before == after == names, 'DRIFT')
        canonical, _ = original_name_digests(names)
        before_json, before_newline = original_name_digests(before)
        after_json, after_newline = original_name_digests(after)
        result.update(status='AUTHENTICATED_ORIGINAL19_MATCH', failure='NONE', original_count=19,
                      current_before_count=19, current_after_count=19,
                      original_canonical_json_sha256=canonical, current_before_canonical_json_sha256=before_json,
                      current_after_canonical_json_sha256=after_json, current_before_newline_sha256=before_newline,
                      current_after_newline_sha256=after_newline, full_eof_mdc=True, ciphertext_unchanged=True,
                      metadata_unchanged=True, exact_set_match=True)
    except Exception as error:
        result['failure'] = str(error) if type(error) is OriginalRefusal and str(error) in ORIGINAL_FAILURES else 'UNAVAILABLE'
    finally:
        if stream is not None:
            stream.close()
        for fd in reversed(descriptors):
            os.close(fd)
    return result


def validate_original_inventory(value: Any) -> None:
    template = {'schema': 'pc-crop.original-volume-inventory.v1', 'status': 'NOT_PROVEN',
        'failure': 'UNAVAILABLE', 'receipt_run_id': ORIGINAL_RECEIPT['runId'],
        'ciphertext_sha256': ORIGINAL_RECEIPT['ciphertextSha256'],
        'original_count': 0, 'current_before_count': 0, 'current_after_count': 0,
        'original_canonical_json_sha256': None, 'current_before_canonical_json_sha256': None,
        'current_after_canonical_json_sha256': None, 'current_before_newline_sha256': None,
        'current_after_newline_sha256': None, 'full_eof_mdc': False,
        'ciphertext_unchanged': False, 'metadata_unchanged': False, 'exact_set_match': False,
        'production_mutation': 'NONE', 'deployment_authorized': False,
        'restore_verification': 'NOT_PERFORMED', 'protected_values': 'NOT_PUBLISHED'}
    original_require(type(value) is dict and set(value) == set(template), 'MANIFEST')
    variable = {'status', 'failure', 'original_count', 'current_before_count', 'current_after_count',
                'original_canonical_json_sha256', 'current_before_canonical_json_sha256',
                'current_after_canonical_json_sha256', 'current_before_newline_sha256', 'current_after_newline_sha256',
                'full_eof_mdc', 'ciphertext_unchanged', 'metadata_unchanged', 'exact_set_match'}
    original_require(all(type(value[key]) is type(template[key]) and value[key] == template[key]
                         for key in set(template) - variable), 'MANIFEST')
    if value['status'] == 'NOT_PROVEN':
        original_require(type(value['failure']) is str and value['failure'] in ORIGINAL_FAILURES and
                         all(type(value[key]) is type(template[key]) and value[key] == template[key]
                             for key in variable - {'failure'}), 'MANIFEST')
    else:
        original_require(value['status'] == 'AUTHENTICATED_ORIGINAL19_MATCH' and value['failure'] == 'NONE', 'MANIFEST')
        original_require(all(type(value[key]) is int and value[key] == 19 for key in
                             ('original_count', 'current_before_count', 'current_after_count')), 'MANIFEST')
        digest_keys = [key for key in variable if key.endswith('_sha256')]
        original_require(all(type(value[key]) is str and CHECKSUM.fullmatch(value[key]) for key in digest_keys), 'MANIFEST')
        original_require(len({value[key] for key in digest_keys if 'canonical_json' in key}) == 1 and
                         value['current_before_newline_sha256'] == value['current_after_newline_sha256'], 'MANIFEST')
        original_require(all(value[key] is True for key in
                             ('full_eof_mdc', 'ciphertext_unchanged', 'metadata_unchanged', 'exact_set_match')), 'MANIFEST')


def collect_with_original_inventory(target: str) -> dict[str, Any]:
    # The v6 collector and its default CLI are unchanged. Only an explicit option
    # creates this envelope. Hosted admission validates both nested profiles.
    base = collect(target)
    witness = original_inventory_witness()
    return {'schema': 'pc-crop.market-original-inventory-envelope.v1', 'target_sha': target,
            'market_preflight': base, 'original_inventory': witness,
            'production_mutation': 'NONE', 'deployment_authorized': False}


def validate_original_envelope(value: Any, target: str) -> dict[str, Any]:
    original_require(type(value) is dict and set(value) == {'schema', 'target_sha', 'market_preflight',
        'original_inventory', 'production_mutation', 'deployment_authorized'} and
        value['schema'] == 'pc-crop.market-original-inventory-envelope.v1' and value['target_sha'] == target
        and value['production_mutation'] == 'NONE' and value['deployment_authorized'] is False, 'MANIFEST')
    validate_report(value['market_preflight'], target)
    validate_original_inventory(value['original_inventory'])
    return value


ORIGINAL_PURPOSE_BEGIN = '<!-- PC_ORIGINAL19_NATIVE_FD_PURPOSE_V1_BEGIN -->'
ORIGINAL_PURPOSE_END = '<!-- PC_ORIGINAL19_NATIVE_FD_PURPOSE_V1_END -->'
ORIGINAL_BEFORE_BLOBS = {
    'scripts/production-market-release-preflight.py': '19928c77b2ed4b6663ddc95b66f0c00d706904ca',
    'scripts/test-production-market-release-preflight.py': 'abd503ec9083fb570a2970acc1ff5b39a746329e',
    '.github/workflows/production-p0-runtime-revision-parity-diagnostic.yml': 'b798a3de2e412a19d6821cb388657389403bd2f4',
}


def validate_original_purpose_record(text: str, sources: dict[str, bytes]) -> str:
    """Accept one closed record in the already accepted main review document only."""
    original_require(type(text) is str and len(text.encode('utf-8')) <= 4 * 1024 * 1024 and
                     len(re.findall('^' + re.escape(ORIGINAL_PURPOSE_BEGIN) + '$', text, re.M)) ==
                     len(re.findall('^' + re.escape(ORIGINAL_PURPOSE_END) + '$', text, re.M)) == 1, 'IDENTITY')
    match = re.search('^' + re.escape(ORIGINAL_PURPOSE_BEGIN) + r'$([\s\S]*?)^' + re.escape(ORIGINAL_PURPOSE_END) + '$', text, re.M)
    original_require(match is not None, 'IDENTITY')
    block = match[1]
    original_require(block.startswith('\n```text\n') and block.endswith('\n```\n'), 'IDENTITY')
    raw = block[len('\n```text\n'):-len('\n```\n')].encode('utf-8')
    original_require(len(raw) <= 16384, 'BOUNDS')
    record = original_json(raw)
    fixed = {'schema': 'pc.original19-native-fd-purpose.v1',
        'purposeId': 'market-original-inventory-witness-20261101', 'owner': 'ACCOUNT_1_CORE',
        'authorityBaseExactMain': '9b2b895b3e71648f9084d8a80a97458488ef06df',
        'sourceBranch': 'ops/farmer-market-release-preflight-20260916',
        'nativeFdReadPurpose': 'AUTHENTICATED_ORIGINAL19_INVENTORY_ONLY', 'readOnly': True,
        'productionMutationAuthorized': False, 'originalReceiptRunId': ORIGINAL_RECEIPT['runId'],
        'originalCiphertextBytes': ORIGINAL_RECEIPT['ciphertextBytes'],
        'originalCiphertextSha256': ORIGINAL_RECEIPT['ciphertextSha256'],
        'authorityGranted': 'SOURCE_PURPOSE_ONLY_SEPARATE_FINITE_OWNER_COMMAND_REQUIRED',
        'productionInvocationAuthorized': False, 'releaseAuthorized': False, 'masterCredit': 0}
    original_require(type(record) is dict and set(record) == set(fixed) | {'sourcePins'} and
                     all(type(record[key]) is type(value) and record[key] == value for key, value in fixed.items()), 'IDENTITY')
    pins = record['sourcePins']
    original_require(type(sources) is dict and set(sources) == set(ORIGINAL_BEFORE_BLOBS) and
                     type(pins) is list and len(pins) == 3, 'IDENTITY')
    seen: set[str] = set()
    for pin in pins:
        original_require(type(pin) is dict and set(pin) == {'path', 'mode', 'beforeBlob', 'afterBlob', 'bytes', 'sha256'}, 'IDENTITY')
        path = pin['path']
        original_require(type(path) is str and path in sources and path not in seen and
                         pin['mode'] == '100644' and pin['beforeBlob'] == ORIGINAL_BEFORE_BLOBS[path], 'IDENTITY')
        raw_source = sources[path]
        original_require(type(raw_source) is bytes and type(pin['bytes']) is int and pin['bytes'] == len(raw_source)
                         and pin['sha256'] == hashlib.sha256(raw_source).hexdigest() and
                         pin['afterBlob'] == hashlib.sha1(b'blob ' + str(len(raw_source)).encode('ascii') + b'\0' + raw_source).hexdigest(), 'IDENTITY')
        seen.add(path)
    return hashlib.sha256(json.dumps(record, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode('ascii')).hexdigest()


def main() -> None:
    if sys.argv[1:] == ['--published-api-baseline']:
        try:
            print(json.dumps(published_api_baseline(), sort_keys=True, separators=(',', ':')))
        except Exception as error:
            safe = {'PUBLICATION_' + name for name in ('AUTH', 'AUTHORIZATION', 'BOUNDS', 'CONFIG', 'DIGEST',
                    'HTTP', 'INDEX', 'JSON', 'LAYERS', 'ORIGIN', 'PLATFORM', 'REDIRECT', 'REVISION', 'ROOTFS', 'RUNNER_ONLY',
                    'STORAGE_PATH', 'STORAGE_ENCODING', 'STORAGE_LENGTH', 'STORAGE_SEGMENTS', 'TIMEOUT')}
            code = str(error) if type(error) is ValueError and str(error) in safe else 'PUBLICATION_UNAVAILABLE'
            print(json.dumps({'schema': 'pc-crop.api-publication-baseline.v1', 'status': 'NOT_PROVEN',
                              'failure': code, 'host_binding': 'NOT_PERFORMED',
                              'production_mutation': 'NONE', 'deployment_authorized': False}, sort_keys=True))
            raise SystemExit(1)
        return
    try:
        if len(sys.argv) == 3 and sys.argv[2] == '--original-volume-inventory':
            import resource
            for kind, maximum in ((resource.RLIMIT_AS, 512 * 1024 * 1024), (resource.RLIMIT_CORE, 0)):
                _, hard = resource.getrlimit(kind)
                limit = maximum if hard == resource.RLIM_INFINITY else min(maximum, hard)
                resource.setrlimit(kind, (limit, limit))
            value = collect_with_original_inventory(sys.argv[1])
        else:
            value = collect(sys.argv[1] if len(sys.argv) == 2 else '')
        encoded = json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(',', ':'))
        if len(encoded.encode()) > MAX_BYTES:
            raise ValueError('REPORT_BOUND')
        print(encoded)
    except Exception:
        # Never serialize raw exception messages or command/environment contents.
        print('{"schema":"pc-crop.market-release-preflight.v6","collection":"NOT_PROVEN","production_mutation":"NONE","deployment_authorized":false}')
        raise SystemExit(1)


if __name__ == '__main__':
    main()
