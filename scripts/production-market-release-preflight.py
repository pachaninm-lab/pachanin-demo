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
            if not isinstance(r, dict) or not isinstance(r.get('migration_name'), str) or not isinstance(r.get('checksum'), str) or not NAME.fullmatch(r['migration_name']) or not CHECKSUM.fullmatch(r['checksum']):
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
            'deployment_authorized', 'live_acceptance', 'protected_values', 'outbox_topology'}
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
    validate_outbox_topology(value['outbox_topology'])
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
            'backup': backup, 'outbox_topology': outbox_topology(api, project),
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
