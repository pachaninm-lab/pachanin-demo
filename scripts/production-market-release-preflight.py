#!/usr/bin/env python3
"""Bounded, read-only REG.RU inventory. A collection result NEVER authorizes release.

Only Docker inspection, a READ ONLY metadata transaction, local Caddy configuration
GET and filesystem metadata are used. Raw configuration, stderr, credentials,
addresses, protected paths and customer records are never emitted.
"""
from __future__ import annotations
import datetime as dt
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import re
import shutil
import selectors
import time
import stat
import subprocess
import sys
import urllib.request
from typing import Any

SHA = re.compile(r"[0-9a-f]{40}\Z")
CHECKSUM = re.compile(r"[0-9a-f]{64}\Z")
NAME = re.compile(r"[0-9]{8,14}_[A-Za-z0-9_]{1,180}\Z")
DOMAIN = "xn----8sbjf4befbjgs9b.xn--p1ai"
API_ORIGIN = "http://api:3001/api"
MAX_BYTES = 1024 * 1024
DB_PROGRAM = r'''
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const result = await p.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '8s'");
    const mode = await tx.$queryRawUnsafe("SELECT current_setting('transaction_read_only') AS value");
    if (mode[0]?.value !== 'on') throw new Error('READ_ONLY_REQUIRED');
    const roles = await tx.$queryRawUnsafe('SELECT rolsuper, rolbypassrls FROM pg_catalog.pg_roles WHERE rolname=current_user');
    const rows = await tx.$queryRawUnsafe('SELECT migration_name, checksum, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back FROM public._prisma_migrations ORDER BY migration_name, started_at LIMIT 5001');
    if (rows.length > 5000) throw new Error('INVENTORY_LIMIT');
    const schema = await tx.$queryRawUnsafe("SELECT to_regclass('auction.public_market_lot_cards') IS NOT NULL AS projection_present, to_regprocedure('auction.list_public_market_lot_cards(integer)') IS NOT NULL AS reader_present");
    return { read_only: true, restricted_role: roles.length === 1 && !roles[0].rolsuper && !roles[0].rolbypassrls, rows, schema: schema[0] };
  }, { timeout: 12000, maxWait: 3000 });
  process.stdout.write(JSON.stringify(result));
})().catch(() => { process.exitCode = 1; }).finally(async () => { await p.$disconnect(); });
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
                    if str(key).lower() == 'x-forwarded-for':
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
    try:
        v = json.loads(raw or 'null')
        if not isinstance(v, dict) or v.get('read_only') is not True or type(v.get('restricted_role')) is not bool:
            raise ValueError()
        rows = v.get('rows')
        schema = v.get('schema')
        if not isinstance(rows, list) or len(rows) > 5000 or not isinstance(schema, dict):
            raise ValueError()
        safe = []
        for r in rows:
            if not isinstance(r, dict) or not NAME.fullmatch(str(r.get('migration_name', ''))) or not CHECKSUM.fullmatch(str(r.get('checksum', ''))):
                raise ValueError()
            if type(r.get('finished')) is not bool or type(r.get('rolled_back')) is not bool:
                raise ValueError()
            safe.append({k: r[k] for k in ('migration_name', 'checksum', 'finished', 'rolled_back')})
        if any(type(schema.get(k)) is not bool for k in ('projection_present', 'reader_present')):
            raise ValueError()
        return {'status': 'OBSERVED_READ_ONLY', 'restricted_role': v['restricted_role'], 'rows': safe,
                'failed_unresolved': sum(not r['finished'] and not r['rolled_back'] for r in safe),
                'projection_present': schema['projection_present'], 'reader_present': schema['reader_present']}
    except (ValueError, TypeError, KeyError):
        return {'status': 'NOT_PROVEN'}


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
            'deployment_authorized', 'live_acceptance', 'protected_values'}
    if not isinstance(value, dict) or set(value) != keys or not SHA.fullmatch(target):
        raise ValueError('REPORT_SCHEMA')
    for key, expected in {'schema': 'pc-crop.market-release-preflight.v1', 'target_sha': target,
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
    if inventory != {'status': 'NOT_PROVEN'}:
        expected_keys = {'status', 'restricted_role', 'rows', 'failed_unresolved', 'projection_present', 'reader_present'}
        if not isinstance(inventory, dict) or set(inventory) != expected_keys or inventory.get('status') != 'OBSERVED_READ_ONLY':
            raise ValueError('REPORT_DB_SCHEMA')
        if type(inventory.get('failed_unresolved')) is not int:
            raise ValueError('REPORT_DB_COUNT')
        rebuilt = migration_metadata(json.dumps({'read_only': True, 'restricted_role': inventory['restricted_role'], 'rows': inventory['rows'], 'schema': {'projection_present': inventory['projection_present'], 'reader_present': inventory['reader_present']}}))
        if rebuilt != inventory:
            raise ValueError('REPORT_DB_INTEGRITY')
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


def collect(target: str) -> dict[str, Any]:
    if not SHA.fullmatch(target):
        raise ValueError('INVALID_TARGET_SHA')
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
    capacity = {'disk_free_bytes': shutil.disk_usage('/').free, 'cpu_count': os.cpu_count()}
    try:
        mem = Path('/proc/meminfo').read_text()
        m = re.search(r'^MemAvailable:\s+(\d+) kB$', mem, re.M)
        if m:
            capacity['memory_available_bytes'] = int(m.group(1)) * 1024
    except OSError:
        pass
    backup = backups(Path('/var/lib/pc-release-authority/backups'))
    after_web = containers('web')
    after_api = containers('api', project) if isinstance(project, str) and project else []
    stable = (runtime_identity(web) is not None and runtime_identity(api) is not None
              and len(after_web) == len(after_api) == 1
              and runtime_identity(web) == runtime_identity(after_web[0])
              and runtime_identity(api) == runtime_identity(after_api[0]))
    checks['runtime_configuration_stability'] = 'UNCHANGED' if stable else 'NOT_PROVEN'
    checks['caddy_configuration_stability'] = ('UNCHANGED' if caddy_before is not None and caddy_before == caddy_config() else 'NOT_PROVEN')
    return {'schema': 'pc-crop.market-release-preflight.v1', 'target_sha': target,
            'observed_at_utc': dt.datetime.now(dt.timezone.utc).isoformat(),
            'running_web_revision': revision(web), 'running_api_revision': revision(api),
            'checks': checks, 'migration_inventory': db, 'capacity': capacity,
            'backup': backup,
            'production_mutation': 'NONE', 'deployment_authorized': False,
            'live_acceptance': 'NOT_PERFORMED', 'protected_values': 'NOT_PUBLISHED'}


def main() -> None:
    try:
        value = collect(sys.argv[1] if len(sys.argv) == 2 else '')
        encoded = json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(',', ':'))
        if len(encoded.encode()) > MAX_BYTES:
            raise ValueError('REPORT_BOUND')
        print(encoded)
    except Exception:
        # Never serialize raw exception messages or command/environment contents.
        print('{"schema":"pc-crop.market-release-preflight.v1","collection":"NOT_PROVEN","production_mutation":"NONE","deployment_authorized":false}')
        raise SystemExit(1)


if __name__ == '__main__':
    main()
