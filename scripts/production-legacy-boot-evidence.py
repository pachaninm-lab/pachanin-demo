"""Bounded, read-only evidence for the guest boot after run 41730479605."""

import ast
from contextlib import ExitStack
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import selectors
import signal
import stat
import subprocess
import sys
import time


LEGACY_CUTOFF_MS = int(datetime(2026, 11, 3, 22, 26, tzinfo=timezone.utc).timestamp()) * 1000
JOURNAL_MAX_BYTES = 16 * 1024
EARLY_BOOT_US = 120 * 1_000_000
CLOCK_TOLERANCE_MS = 120_000
AUTHORITY = 'docs/platform-v7/autopilot/progress.json'
AUTHORITY_KEY = 'gektaApiCatalogSectionsEvidence'
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
COMPOSE_CONTROLLER = 'scripts/release/api-only-release-controller.py'
COMPOSE_CONTROLLER_BLOB = 'b6de12ba9dd084e173637047cfebc6bdc1dda70a'
SNAPSHOT_CONTROLLER_BLOB = '449e7a9e51c73fa10815564481a3a3dc59f019fe'
LEDGER_CONTROLLER_BLOB = '7d64b9311c50d5dc4143c0b599c96ccf257020ee'
CATALOG_CONTROLLER_BLOB = '64eafa8337649537d2ca8381e3976266be3e63c2'
CATALOG_ORACLE = {
    'target_sha': '88a033486262acd4fb11929c5545277174ad99f4',
    'api_digest': 'ghcr.io/pachaninm-lab/grainflow-api@sha256:139540c71f52e45babfea7194e4d20de7c609ff8ceb89a8121fb8d0074ede4b8',
    'migration_digest': 'ghcr.io/pachaninm-lab/grainflow-migration@sha256:9b64f2c1a5c1aaf71e9a3d51e121f5261a19a911205ecdabc1e61e75c18ed981',
    'catalog_sha256': '1a60dd5a455568be2509f694b4991a594bf5323a0b1cf1728ad22742ada32b48',
    'query_sha256': '29bc9ef6cffbd1994d99b5008e21ff614d6362284374cc169cd89c266420895f',
    'principal_sha256': {
        'default': 'ec72bb2ab745e46ce8fd28de7cd659ce036666f7a9c378f8aff1a3683738f2c6',
        'registration': '387dc9ca4a28ce3a9be8c0b1a4605496cdc3c5b5517874506d88568526ad8d88',
    },
    'status': 'VERIFIED', 'isolated_cleanup': 'VERIFIED',
}
CATALOG_POSTGRES = 'ghcr.io/pachaninm-lab/ci-postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777'
CATALOG_SECTIONS = ('schemas', 'extensions', 'columns', 'tables', 'constraints', 'indexes', 'enums',
                    'domains', 'sequences', 'routines', 'policies', 'triggers', 'default_privileges')
CATALOG_PROFILE = ('postgres_major', 'encoding', 'collation')
CATALOG_FINDINGS = (*CATALOG_PROFILE, *CATALOG_SECTIONS, 'default_principal', 'registration_principal',
                    'registration_catalog_differs', 'registration_unavailable')
CATALOG_CODES = {'CATALOG_MATCHES_ORACLE', 'CATALOG_BASELINE_CHANGED', 'CATALOG_LOCK_BUSY'}
LEDGER_INITIAL = '0001_postgresql_initial'
LEDGER_INITIAL_MARKER = 'grainflow_v3_initial_postgresql'
LEDGER_ARCHIVE_BLOBS = {
    '20260716130000_market_open_lots_showcase': '8a9e82b2bc3b8df1896afe27632b54c21d56de98',
    '20260716150000_auction_cross_tenant_participation': '8cb67de1a9eabeab7de8ffe31ca18d6dd7db9f33',
    '20260716160000_auction_participant_workspace': '5eee985e4db2317bbfdbe748201d22a4924eebba',
    '20260717170000_deal_cross_tenant_participation': 'a69d3bff7d22313280edccab25673dce3af9f001',
}
LEDGER_FINDINGS = (
    'legacy_initial_marker_only', 'unknown_name', 'duplicate_name', 'checksum_mismatch',
    'unfinished', 'rolled_back', 'invalid_steps', 'missing_source_entry', 'exact_archived_migrations',
)
LEDGER_CODES = {'LEDGER_MATCHES_SOURCE', 'LEDGER_BASELINE_CHANGED', 'LEDGER_LOCK_BUSY', 'LEDGER_ROW_SHAPE'}
SNAPSHOT_VOLUME_DIGEST = 'b534fb880d7ba07caff60b5475e44a4340e64d4446571b639b64971bcc6044ea'
SNAPSHOT_FIELDS = (
    'api_id', 'image_id', 'revision', 'ready', 'started_at', 'restart_count',
    'runtime_fingerprint', 'siblings', 'volumes', 'preservation', 'override',
)
SNAPSHOT_CODES = {
    'SNAPSHOT_STABLE_IN_SAMPLE', 'SNAPSHOT_INPUT_DRIFT', 'SNAPSHOT_INVENTORY_CHANGED',
    'SNAPSHOT_BASELINE_ID_CHANGED', 'SNAPSHOT_BASELINE_NOT_READY', 'SNAPSHOT_LOCK_BUSY',
    'SNAPSHOT_DEADLINE', 'SNAPSHOT_OVERRIDE_DRIFT',
}
SNAPSHOT_HOST_METHODS = {
    '__init__', 'lock', 'inspect', 'image', 'containers', 'ready', 'preservation',
    'configure', 'model', 'effective_api_image_id', 'snapshot',
}
SNAPSHOT_READY_PROBE = ("fetch('http://127.0.0.1:3001/ready',{signal:AbortSignal.timeout(4000)})"
                        ".then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))")
COMPOSE_PROFILE_CODES = (
    'PROFILE_TAB_INDENT', 'PROFILE_ENCODED_INPUT', 'PROFILE_INDIRECT_KEY', 'PROFILE_DIRECTIVE',
    'PROFILE_CURLY_BRACE', 'PROFILE_SQUARE_BRACKET', 'PROFILE_TAG', 'PROFILE_ENV_FILE_ESCAPE',
)
COMPOSE_FLOW_CODES = (
    'PROFILE_DOLLAR_BRACE', 'PROFILE_FLOW_MAPPING', 'PROFILE_BRACKET_LINE_BOUND',
    'PROFILE_BRACKET_LINE_SHAPE', 'PROFILE_BRACKET_EXTERNAL_KEY', 'PROFILE_BRACKET_LIST_KEY',
    'PROFILE_BRACKET_LIST_NESTED', 'PROFILE_BRACKET_LIST_BOUND', 'PROFILE_BRACKET_LIST_EMPTY_ITEM',
    'PROFILE_BRACKET_LIST_MAPPING_ITEM', 'PROFILE_BRACKET_LIST_ITEM', 'PROFILE_BRACKET_SCALAR',
    'PROFILE_BRACKET_UNCLOSED_OR_CONTINUATION',
)
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
            manifest['baselineEvidence'] != BASELINE_RECORD or manifest['controllerBlob'] != COMPOSE_CONTROLLER_BLOB or
            manifest['snapshotControllerBlob'] != SNAPSHOT_CONTROLLER_BLOB or
            manifest['ledgerControllerBlob'] != LEDGER_CONTROLLER_BLOB or
            manifest['catalogControllerBlob'] != CATALOG_CONTROLLER_BLOB or manifest['catalogOracleRun'] != 43887479195 or
            manifest['originalVolumeInventorySHA256'] != SNAPSHOT_VOLUME_DIGEST or
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


REFERENCE_POSITION_CODES = (
    'PROFILE_REF_NESTED', 'PROFILE_REF_SEQUENCE_ALIAS', 'PROFILE_REF_SEQUENCE_ANCHOR',
    'PROFILE_REF_INLINE_ANCHOR', 'PROFILE_REF_INLINE_BLOCK_SCALAR', 'PROFILE_REF_INLINE_FLOW',
    'PROFILE_REF_INLINE_TAG', 'PROFILE_REF_KEY_OPERATOR', 'PROFILE_REF_KEY_FORMAT',
    'PROFILE_INLINE_LINE_BOUND', 'PROFILE_INLINE_KEY_SPACE', 'PROFILE_INLINE_KEY_SHAPE',
    'PROFILE_INLINE_NAME_BOUND', 'PROFILE_INLINE_QUOTED_FORM', 'PROFILE_INLINE_INTERPOLATION',
    'PROFILE_INLINE_COMMENT_SPACE',
    'PROFILE_INLINE_COLON_SEPARATOR', 'PROFILE_INLINE_INDICATOR', 'PROFILE_INLINE_CHARACTERS',
    'PROFILE_REF_EMBEDDED_OR_OTHER',
)


def inline_scalar_rejection(raw_line, parse_anchor):
    if len(raw_line) > 16 * 1024:
        return 'PROFILE_INLINE_LINE_BOUND'
    raw = raw_line.decode('utf-8').removesuffix('\r')
    key_form = r"""(?:"(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^:]+)"""
    match = re.fullmatch(r'(?P<key> *(?:- +)?' + key_form +
                         r'): +&(?P<name>[A-Za-z0-9_-]+) +(?P<value>\S.*)', raw)
    if match is None:
        return 'PROFILE_REF_INLINE_ANCHOR'
    key, name, value = match['key'], match['name'], match['value']
    if len(name) > 64:
        return 'PROFILE_INLINE_NAME_BOUND'
    prefix = f'{key}: &{name} '
    if parse_anchor((prefix + 'x').encode()) is None:
        if key != key.rstrip() and parse_anchor((f'{key.rstrip()}: &{name} x').encode()) is not None:
            return 'PROFILE_INLINE_KEY_SPACE'
        return 'PROFILE_INLINE_KEY_SHAPE'
    if value.startswith(('"', "'")):
        return 'PROFILE_INLINE_QUOTED_FORM'
    comment = re.search(r'[ \t]+#', value)
    if comment is not None:
        value = value[:comment.start()].rstrip()
        if parse_anchor((prefix + value).encode()) is not None:
            return 'PROFILE_INLINE_COMMENT_SPACE'
    substituted = value
    for _ in range(8):
        shortened = re.sub(r'\$\{[^{}\r\n]*\}', 'x', substituted)
        if shortened == substituted:
            break
        substituted = shortened
    if substituted != value and parse_anchor((prefix + substituted).encode()) is not None:
        return 'PROFILE_INLINE_INTERPOLATION'
    if re.search(r':(?:[ \t]|$)', value):
        return 'PROFILE_INLINE_COLON_SEPARATOR'
    if value.startswith(('@', '`', '%', '*', '&', '#', '?')) or re.match(r'-(?:[ \t]|$)', value):
        return 'PROFILE_INLINE_INDICATOR'
    return 'PROFILE_INLINE_CHARACTERS'


def reference_position_code(line, anchor_indent, raw_line, parse_anchor):
    if anchor_indent is not None:
        return 'PROFILE_REF_NESTED'
    if re.match(r'^ *- +\*[A-Za-z0-9_-]+ *$', line):
        return 'PROFILE_REF_SEQUENCE_ALIAS'
    if re.match(r'^ *- +&[A-Za-z0-9_-]+(?: +.*)?$', line):
        return 'PROFILE_REF_SEQUENCE_ANCHOR'
    inline = re.match(r'^ *[^:]+: +&[A-Za-z0-9_-]+ +(?P<value>\S.*)$', line)
    if inline:
        value = inline['value']
        if value.startswith(('|', '>')):
            return 'PROFILE_REF_INLINE_BLOCK_SCALAR'
        if value.startswith(('[', '{')):
            return 'PROFILE_REF_INLINE_FLOW'
        if value.startswith('!'):
            return 'PROFILE_REF_INLINE_TAG'
        return inline_scalar_rejection(raw_line, parse_anchor)
    if re.match(r'^ *[&*]', line):
        return 'PROFILE_REF_KEY_OPERATOR'
    if re.match(r'^ *[^:]+: +[&*][A-Za-z0-9_-]+ *$', line):
        return 'PROFILE_REF_KEY_FORMAT'
    return 'PROFILE_REF_EMBEDDED_OR_OTHER'


def compose_brace_code(line):
    value = line.lstrip(' ')
    if value.startswith('- '):
        value = value[2:].lstrip(' ')
    key = re.match(r'(?:[A-Za-z_][A-Za-z0-9_.-]*|""): +', value)
    if key is not None:
        value = value[key.end():]
    if value.startswith('{'):
        return 'PROFILE_FLOW_MAPPING'
    if '${' in value:
        return 'PROFILE_DOLLAR_BRACE'
    return 'PROFILE_CURLY_BRACE'


def compose_bracket_code(line, bracket_line, list_keys, external_keys):
    if len(line) > 16 * 1024:
        return 'PROFILE_BRACKET_LINE_BOUND'
    match = bracket_line.fullmatch(line)
    if match is None:
        return 'PROFILE_BRACKET_LINE_SHAPE'
    key, value = match['key'], match['value']
    if key is not None and key.lower() in external_keys:
        return 'PROFILE_BRACKET_EXTERNAL_KEY'
    if not value.startswith('['):
        return 'PROFILE_BRACKET_SCALAR'
    if not value.endswith(']'):
        return 'PROFILE_BRACKET_UNCLOSED_OR_CONTINUATION'
    if key is None or (key not in list_keys and not key.startswith('x-')):
        return 'PROFILE_BRACKET_LIST_KEY'
    body = value[1:-1]
    if '[' in body or ']' in body:
        return 'PROFILE_BRACKET_LIST_NESTED'
    items = [item.strip(' ') for item in body.split(',')]
    if len(items) > 128:
        return 'PROFILE_BRACKET_LIST_BOUND'
    if any(not item for item in items):
        return 'PROFILE_BRACKET_LIST_EMPTY_ITEM'
    if any(re.search(r':(?:[ \t]|$)|^-(?:[ \t]|$)', item) for item in items):
        return 'PROFILE_BRACKET_LIST_MAPPING_ITEM'
    return 'PROFILE_BRACKET_LIST_ITEM'


def compose_profile_source(source):
    selected_names = {'ReleaseError', 'demand', 'directory', 'file_read', 'compose_structural_view',
                      'compose_inline_interpolation_view', 'compose_inline_scalar_anchor', 'validate_compose_references',
                      'compose_literal_brackets_allowed', 'validate_compose_input_profile', 'declared_env_files'}
    constants = {'COMPOSE_INLINE_ANCHOR_KEY', 'COMPOSE_INLINE_ANCHOR_PREFIX', 'COMPOSE_INLINE_INTERPOLATION',
                 'COMPOSE_LITERAL_LIST_KEYS', 'COMPOSE_BRACKET_LINE', 'COMPOSE_EXTERNAL_KEYS',
                 'COMPOSE_EMPTY_COLLECTION', 'COMPOSE_LITERAL_LIST_ITEM', 'COMPOSE_BRACKET_SCALAR'}
    selected = {}
    for node in ast.parse(source).body:
        if isinstance(node, (ast.FunctionDef, ast.ClassDef)) and node.name in selected_names:
            selected[node.name] = node
        elif (isinstance(node, ast.Assign) and len(node.targets) == 1 and
              isinstance(node.targets[0], ast.Name) and node.targets[0].id in constants):
            selected[node.targets[0].id] = node
    if selected.keys() != selected_names | constants:
        raise ValueError('incomplete pinned profile source')
    module = ast.Module(body=list(selected.values()), type_ignores=[])
    sites = sorted((node for node in ast.walk(module)
                    if isinstance(node, ast.Constant) and node.value == 'COMPOSE_EXTERNAL_PROFILE'),
                   key=lambda node: (node.lineno, node.col_offset))
    if len(sites) != len(COMPOSE_PROFILE_CODES):
        raise ValueError('unknown pinned profile layout')
    for node, code in zip(sites, COMPOSE_PROFILE_CODES):
        node.value = code
    refinements = {
        'PROFILE_CURLY_BRACE': 'compose_brace_code(line)',
        'PROFILE_SQUARE_BRACKET': ('compose_bracket_code(line, COMPOSE_BRACKET_LINE, '
                                   'COMPOSE_LITERAL_LIST_KEYS, COMPOSE_EXTERNAL_KEYS)'),
        'COMPOSE_REFERENCE_POSITION': ('reference_position_code(line, anchor_indent, raw_line, '
                                       'compose_inline_scalar_anchor)'),
    }
    for code, expression in refinements.items():
        checks = [node for node in ast.walk(module)
                  if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == 'demand'
                  and len(node.args) == 2 and isinstance(node.args[1], ast.Constant) and node.args[1].value == code]
        if len(checks) != 1:
            raise ValueError('unknown pinned diagnostic check')
        check = checks[0]
        check.args[1] = ast.IfExp(
            test=check.args[0], body=check.args[1], orelse=ast.parse(expression, mode='eval').body,
        )
    return ast.unparse(module)


def build_api_compose_profile_payload(ref):
    if regular_blob(ref, COMPOSE_CONTROLLER) != COMPOSE_CONTROLLER_BLOB:
        raise ValueError('unexpected release controller')
    baseline = api_baseline_spec(verify_source(ref, ref, verify_diff=False))
    profile = compose_profile_source(git('cat-file', 'blob', COMPOSE_CONTROLLER_BLOB).decode('utf-8'))
    print('API_BASELINE = ' + repr(baseline))
    print('API_COMPOSE_PROFILE = ' + repr(profile))
    sys.stdout.write(git('cat-file', 'blob', regular_blob(ref, PROBE_PATH)).decode('utf-8'))


def api_snapshot_controller_source(source):
    definitions = {
        'ReleaseError', 'Host', 'demand', 'canonical', 'digest', 'closed_json', 'bounded',
        'directory', 'file_read', 'protected_sha256', 'env_map', 'compose_structural_view',
        'compose_inline_interpolation_view', 'compose_inline_scalar_anchor', 'env_file_literal',
        'compose_inline_env_files', 'validate_compose_references', 'compose_literal_brackets_allowed',
        'validate_compose_input_profile', 'declared_env_files', 'assert_effective_api_model',
        'runtime_fingerprint', 'canonical_web_api_origin', 'sibling_identity', 'verify_oracle_ledger',
    }
    constants = {
        'SHA', 'HASH', 'IMAGE_ID', 'DIGEST', 'DOCKER', 'ENV', 'BACKUPS', 'OVERRIDE', 'PRESERVED',
        'MAX_OUTPUT', 'MAX_COMPOSE_FILE_ENTRIES', 'MAX_DISTINCT_COMPOSE_FILES',
        'MAX_ORDERED_COMPOSE_BYTES', 'BASELINE_ARCHIVE_SCHEMA', 'LEDGER_SQL',
    }
    selected = {}
    module = ast.parse(source)
    imports = [node for node in module.body if isinstance(node, (ast.Import, ast.ImportFrom))]
    for node in module.body:
        if isinstance(node, (ast.FunctionDef, ast.ClassDef)) and node.name in definitions:
            selected[node.name] = node
        elif isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            name = node.targets[0].id
            if name in constants or name.startswith('COMPOSE_'):
                selected[name] = node
    if not definitions | constants <= selected.keys():
        raise ValueError('incomplete pinned snapshot source')
    host = selected['Host']
    host.body = [node for node in host.body if isinstance(node, ast.FunctionDef)
                 and node.name in SNAPSHOT_HOST_METHODS]
    if {node.name for node in host.body} != SNAPSHOT_HOST_METHODS:
        raise ValueError('incomplete read-only snapshot methods')
    return ast.unparse(ast.Module(body=imports + list(selected.values()), type_ignores=[]))


def api_ledger_archived_checksums(ref):
    archived = {}
    for name, pinned_blob in LEDGER_ARCHIVE_BLOBS.items():
        path = f'scripts/fixtures/pc-crop-w1-lineage/{name}.sql'
        if regular_blob(ref, path) != pinned_blob:
            raise ValueError('unexpected accepted ledger archive')
        archived[name] = hashlib.sha256(git('cat-file', 'blob', pinned_blob)).hexdigest()
    return archived


def build_api_snapshot_payload(ref):
    if regular_blob(ref, COMPOSE_CONTROLLER) != SNAPSHOT_CONTROLLER_BLOB:
        raise ValueError('unexpected snapshot controller')
    baseline = api_baseline_spec(verify_source(ref, ref, verify_diff=False))
    controller = api_snapshot_controller_source(git('cat-file', 'blob', SNAPSHOT_CONTROLLER_BLOB).decode('utf-8'))
    print('API_BASELINE = ' + repr(baseline))
    print('API_SNAPSHOT_CONTROLLER = ' + repr(controller))
    sys.stdout.write(git('cat-file', 'blob', regular_blob(ref, PROBE_PATH)).decode('utf-8'))


def build_api_ledger_payload(ref):
    baseline = api_baseline_spec(verify_source(ref, ref, verify_diff=False))
    if regular_blob(ref, COMPOSE_CONTROLLER) != LEDGER_CONTROLLER_BLOB:
        raise ValueError('unexpected ledger controller')
    source = git('cat-file', 'blob', LEDGER_CONTROLLER_BLOB).decode('utf-8')
    controller = {'__name__': 'api_ledger_source', '__file__': str(Path(COMPOSE_CONTROLLER).resolve())}
    exec(compile(source, '<pinned-api-ledger-source>', 'exec'), controller)
    expected = controller['source_migrations'](ref)
    archived = api_ledger_archived_checksums(ref)
    if expected.keys() & archived.keys():
        raise ValueError('archived ledger names overlap current migrations')
    print('API_BASELINE = ' + repr(baseline))
    print('API_LEDGER_EXPECTED = ' + repr(expected))
    print('API_LEDGER_ARCHIVED = ' + repr(archived))
    print('API_LEDGER_CONTROLLER = ' + repr(api_snapshot_controller_source(source)))
    sys.stdout.write(git('cat-file', 'blob', regular_blob(ref, PROBE_PATH)).decode('utf-8'))


def api_ledger_program(sql):
    return r"""
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({log: []});
const timer = setTimeout(() => process.exit(1), 14000);
async function readLedger() {
  try {
    const rows = await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '5s'");
      const mode = await tx.$queryRawUnsafe("SELECT current_setting('transaction_read_only') AS value");
      if (mode.length !== 1 || mode[0].value !== 'on') throw Error('READ_ONLY_REQUIRED');
      const ledger = await tx.$queryRawUnsafe(__LEDGER_SQL__);
      if (ledger.length > 5000) throw Error('LEDGER_LIMIT');
      return ledger;
    }, {maxWait: 2000, timeout: 10000, isolationLevel: 'RepeatableRead'});
    process.stdout.write(JSON.stringify(rows) + '\n');
  } catch (_) {
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    clearTimeout(timer);
  }
}
readLedger().catch(() => process.exit(1));
""".replace('__LEDGER_SQL__', json.dumps(sql), 1)


def classify_api_ledger(rows, expected, archived, controller):
    try:
        controller['verify_oracle_ledger'](rows, expected)
        return 'LEDGER_MATCHES_SOURCE'
    except controller['ReleaseError']:
        pass
    if type(rows) is not list or not 0 < len(rows) <= 5000:
        return 'LEDGER_ROW_SHAPE'
    findings, seen = set(), set()
    unknown = []
    markers = 0
    for row in rows:
        if (type(row) is not dict or set(row) != {'migration_name', 'checksum', 'finished', 'rolled_back', 'steps'} or
                type(row['migration_name']) is not str or type(row['checksum']) is not str or
                type(row['finished']) is not bool or type(row['rolled_back']) is not bool):
            return 'LEDGER_ROW_SHAPE'
        name, checksum = row['migration_name'], row['checksum']
        if name == LEDGER_INITIAL and checksum == LEDGER_INITIAL_MARKER:
            markers += 1
        else:
            if name in seen:
                findings.add('duplicate_name')
            seen.add(name)
            if name not in expected:
                unknown.append(row)
            elif expected[name] != checksum:
                findings.add('checksum_mismatch')
        if not row['finished']:
            findings.add('unfinished')
        if row['rolled_back']:
            findings.add('rolled_back')
        if type(row['steps']) is not int or row['steps'] < 0:
            findings.add('invalid_steps')
    if markers > 1:
        findings.add('duplicate_name')
    missing = expected.keys() - seen
    if markers and LEDGER_INITIAL in missing:
        findings.add('legacy_initial_marker_only')
        missing.remove(LEDGER_INITIAL)
    if missing:
        findings.add('missing_source_entry')
    if unknown:
        exact_archive = (len(unknown) == len(archived) and {row['migration_name'] for row in unknown} == archived.keys()
                         and all(archived[row['migration_name']] == row['checksum'] and row['finished']
                                 and not row['rolled_back'] and type(row['steps']) is int and row['steps'] >= 0
                                 for row in unknown))
        findings.add('exact_archived_migrations' if exact_archive else 'unknown_name')
    mask = sum(1 << index for index, name in enumerate(LEDGER_FINDINGS) if name in findings)
    return f'LEDGER_DIFF_{mask:03X}' if mask else 'NOT_PROVEN'


def validate_api_ledger(value):
    mask = re.fullmatch(r'LEDGER_DIFF_([0-9A-F]{3})', value)
    if value in LEDGER_CODES or (mask is not None and 0 < int(mask[1], 16) < 1 << len(LEDGER_FINDINGS)):
        return value
    return 'NOT_PROVEN'


def api_ledger_details(value):
    value = validate_api_ledger(value)
    if not value.startswith('LEDGER_DIFF_'):
        return value
    mask = int(value.rsplit('_', 1)[1], 16)
    return ', '.join(name for index, name in enumerate(LEDGER_FINDINGS) if mask & 1 << index)


def observe_api_ledger(scope, source, expected, archived):
    if os.getuid() != 0 or os.geteuid() != 0:
        return 'NOT_PROVEN'
    controller = {'__name__': 'api_ledger_controller',
                  '__file__': '/run/pc-api-only-ledger-observer/scripts/release/api-only-release-controller.py'}
    exec(compile(source, '<pinned-api-ledger-controller>', 'exec'), controller)
    try:
        with ExitStack() as resources:
            try:
                resources.enter_context(controller['Host']().lock())
            except BlockingIOError:
                return 'LEDGER_LOCK_BUSY'
            binding = api_binding()
            if binding[1] != scope['observedImageId']:
                return 'LEDGER_BASELINE_CHANGED'
            program = api_ledger_program(controller['LEDGER_SQL'])
            raw = controller['bounded'](controller['DOCKER'] + [
                '--config', '/proc/self/fd', 'exec', binding[0], '/nodejs/bin/node', '-e', program,
            ], timeout=17)
            if api_binding() != binding:
                return 'LEDGER_BASELINE_CHANGED'
            return classify_api_ledger(controller['closed_json'](raw), expected, archived, controller)
    except (controller['ReleaseError'], OSError, ValueError, TypeError, KeyError, subprocess.SubprocessError):
        return 'NOT_PROVEN'


def catalog_oracle_inputs(ref):
    baseline = verify_source(ref, ref, verify_diff=False)
    target = CATALOG_ORACLE['target_sha']
    if any(regular_blob(commit, COMPOSE_CONTROLLER) != CATALOG_CONTROLLER_BLOB for commit in (target, ref)):
        raise ValueError('unexpected catalog controller')
    git('merge-base', '--is-ancestor', target, ref)
    return baseline, (target, CATALOG_ORACLE['api_digest'], CATALOG_ORACLE['migration_digest'], CATALOG_POSTGRES)


def api_catalog_section_hashes(catalog, digest):
    if type(catalog) is not dict or catalog.keys() != {'profile', *CATALOG_SECTIONS}:
        raise ValueError('unexpected catalog sections')
    profile = catalog['profile']
    if type(profile) is not dict or profile.keys() != set(CATALOG_PROFILE):
        raise ValueError('unexpected catalog profile')
    return {name: digest(value) for name, value in {
        **profile, **{name: catalog[name] for name in CATALOG_SECTIONS},
    }.items()}


def replay_catalog_oracle(controller, inputs):
    original = controller['digest']
    captured = {}

    def observed_digest(value):
        result = original(value)
        if result == CATALOG_ORACLE['catalog_sha256']:
            captured.update(api_catalog_section_hashes(value, original))
        return result

    controller['digest'] = observed_digest
    try:
        receipt = controller['generate_oracle'](*inputs[:3])
    finally:
        controller['digest'] = original
    if (any(receipt.get(name) != expected for name, expected in CATALOG_ORACLE.items()) or
            captured.keys() != {*CATALOG_PROFILE, *CATALOG_SECTIONS}):
        raise ValueError('isolated catalog oracle did not reproduce')
    return captured


def build_api_catalog_payload(ref, checkout):
    baseline, inputs = catalog_oracle_inputs(ref)
    controller_path = Path(checkout).resolve() / COMPOSE_CONTROLLER
    pinned = git('cat-file', 'blob', CATALOG_CONTROLLER_BLOB)
    if controller_path.read_bytes() != pinned:
        raise ValueError('catalog checkout controller differs')
    controller = {'__name__': 'api_catalog_source', '__file__': str(controller_path)}
    exec(compile(pinned, '<pinned-catalog-source>', 'exec'), controller)
    expected = replay_catalog_oracle(controller, inputs)
    source = api_snapshot_controller_source(git('cat-file', 'blob', LEDGER_CONTROLLER_BLOB).decode('utf-8'))
    print('API_BASELINE = ' + repr(api_baseline_spec(baseline)))
    print('API_CATALOG_EXPECTED = ' + repr(expected))
    print('API_CATALOG_CONTROLLER = ' + repr(source))
    print('API_CATALOG_PROGRAMS = ' + repr({client: controller['database_program'](client)
                                            for client in ('default', 'registration')}))
    sys.stdout.write(git('cat-file', 'blob', regular_blob(ref, PROBE_PATH)).decode('utf-8'))


def classify_api_catalog(records, expected, digest):
    record_keys = {'ledger', 'catalog', 'principal'}
    default = records['default']
    if type(default) is not dict or default.keys() != record_keys:
        return 'NOT_PROVEN'
    actual = api_catalog_section_hashes(default['catalog'], digest)
    differences = {name for name, value in actual.items() if expected[name] != value}
    if digest(default['principal']) != CATALOG_ORACLE['principal_sha256']['default']:
        differences.add('default_principal')
    registration = records.get('registration')
    if type(registration) is not dict or registration.keys() != record_keys:
        differences.add('registration_unavailable')
    else:
        if digest(registration['catalog']) != digest(default['catalog']):
            differences.add('registration_catalog_differs')
        if digest(registration['principal']) != CATALOG_ORACLE['principal_sha256']['registration']:
            differences.add('registration_principal')
    mask = sum(1 << index for index, name in enumerate(CATALOG_FINDINGS) if name in differences)
    return f'CATALOG_DIFF_{mask:05X}' if mask else 'CATALOG_MATCHES_ORACLE'


def validate_api_catalog(value):
    mask = re.fullmatch(r'CATALOG_DIFF_([0-9A-F]{5})', value)
    if value in CATALOG_CODES or (mask is not None and 0 < int(mask[1], 16) < 1 << len(CATALOG_FINDINGS)):
        return value
    return 'NOT_PROVEN'


def api_catalog_details(value):
    value = validate_api_catalog(value)
    if not value.startswith('CATALOG_DIFF_'):
        return value
    mask = int(value.rsplit('_', 1)[1], 16)
    return ', '.join(name for index, name in enumerate(CATALOG_FINDINGS) if mask & 1 << index)


def observe_api_catalog(scope, source, programs, expected):
    if os.getuid() != 0 or os.geteuid() != 0:
        return 'NOT_PROVEN'
    controller = {'__name__': 'api_catalog_controller',
                  '__file__': '/run/pc-api-only-catalog-observer/scripts/release/api-only-release-controller.py'}
    exec(compile(source, '<pinned-api-catalog-controller>', 'exec'), controller)
    try:
        with ExitStack() as resources:
            try:
                resources.enter_context(controller['Host']().lock())
            except BlockingIOError:
                return 'CATALOG_LOCK_BUSY'
            binding = api_binding()
            if binding[1] != scope['observedImageId']:
                return 'CATALOG_BASELINE_CHANGED'
            commands = controller['DOCKER'] + ['--config', '/proc/self/fd', 'exec', binding[0], '/nodejs/bin/node', '-e']
            records = {}
            for client in ('default', 'registration'):
                try:
                    raw = controller['bounded'](commands + [programs[client]], timeout=40)
                    records[client] = controller['closed_json'](raw)
                except (controller['ReleaseError'], OSError, subprocess.SubprocessError):
                    if client == 'default':
                        raise
                if api_binding() != binding:
                    return 'CATALOG_BASELINE_CHANGED'
            return classify_api_catalog(records, expected, controller['digest'])
    except (controller['ReleaseError'], OSError, ValueError, TypeError, KeyError, subprocess.SubprocessError):
        return 'NOT_PROVEN'


def api_snapshot_change(before, after):
    if before.keys() != set(SNAPSHOT_FIELDS) or after.keys() != before.keys():
        return 'NOT_PROVEN'
    bits = sum(1 << index for index, field in enumerate(SNAPSHOT_FIELDS) if before[field] != after[field])
    return f'SNAPSHOT_DIFF_{bits:03X}' if bits else 'SNAPSHOT_STABLE_IN_SAMPLE'


def validate_api_snapshot(value):
    mask = re.fullmatch(r'SNAPSHOT_DIFF_([0-9A-F]{3})', value)
    if value in SNAPSHOT_CODES or (mask is not None and 0 < int(mask[1], 16) < 1 << len(SNAPSHOT_FIELDS)):
        return value
    return 'NOT_PROVEN'


def api_snapshot_details(value):
    value = validate_api_snapshot(value)
    if not value.startswith('SNAPSHOT_DIFF_'):
        return value
    bits = int(value.rsplit('_', 1)[1], 16)
    return ', '.join(field for index, field in enumerate(SNAPSHOT_FIELDS) if bits & 1 << index)


def api_snapshot_read_allowed(args, compose):
    if args in (['ps', '-aq', '--no-trunc'], ['volume', 'ls', '-q']):
        return True
    if len(args) == 3 and args[:2] == ['container', 'inspect']:
        return re.fullmatch(r'[0-9a-f]{64}', args[2]) is not None
    if len(args) == 3 and args[:2] == ['image', 'inspect']:
        # The pinned Host.image validates the local identity or immutable reference.
        return not args[2].startswith('-')
    if len(args) == 21 and args[:2] == ['volume', 'inspect']:
        return all(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,254}', name) for name in args[2:])
    if len(args) == 5 and args[0] == 'exec':
        return re.fullmatch(r'[0-9a-f]{64}', args[1]) is not None and args[2:] == [
            '/nodejs/bin/node', '-e', SNAPSHOT_READY_PROBE,
        ]
    return compose is not None and args in (
        compose + ['config', '--format', 'json'], compose[:-2] + ['config', '--format', 'json'],
    )


def sample_api_snapshot(host, scope, controller):
    names = sorted(host.run(['volume', 'ls', '-q']).decode('ascii').splitlines())
    if len(names) != len(set(names)) or len(names) != 19 or controller['digest'](names) != SNAPSHOT_VOLUME_DIGEST:
        return 'SNAPSHOT_INVENTORY_CHANGED'
    intent = {
        'baseline_sha': scope['revision'], 'baseline_image_id': scope['observedImageId'],
        'baseline_publication': {'schema': controller['BASELINE_ARCHIVE_SCHEMA']},
        'original_volumes': names,
    }
    first = host.snapshot(intent)
    if first['revision'] != intent['baseline_sha'] or first['image_id'] != intent['baseline_image_id']:
        return 'SNAPSHOT_BASELINE_ID_CHANGED'
    if first['ready'] is not True:
        return 'SNAPSHOT_BASELINE_NOT_READY'
    for index in range(3):
        if not snapshot_inputs_match(host, controller['file_read']):
            return 'SNAPSHOT_INPUT_DRIFT'
        result = api_snapshot_change(first, host.snapshot(intent))
        if result != 'SNAPSHOT_STABLE_IN_SAMPLE':
            return result
        if host.effective_api_image_id() != first['image_id']:
            return 'SNAPSHOT_BASELINE_ID_CHANGED'
        if index < 2:
            time.sleep(1)
    return 'SNAPSHOT_STABLE_IN_SAMPLE'


def snapshot_inputs_match(host, read_file):
    return all(read_file(path, optional=True) == record for path, record in host.inputs.items())


def observe_api_snapshot(scope, source):
    if os.getuid() != 0 or os.geteuid() != 0:
        return 'NOT_PROVEN'
    fake_file = '/run/pc-api-only-snapshot-observer/scripts/release/api-only-release-controller.py'
    controller = {'__name__': 'api_snapshot_controller', '__file__': fake_file}
    exec(compile(source, '<pinned-api-snapshot-controller>', 'exec'), controller)

    class ReadOnlyHost(controller['Host']):
        def configure(self, api, intent=None):
            super().configure(api, intent)
            self.captured_override = controller['file_read'](self.override_path, optional=True)
            if self.captured_override is not None and controller['declared_env_files'](
                    self.captured_override['bytes'], self.working):
                raise ValueError('unexpected managed override environment files')

        def run(self, args, **kwargs):
            if not api_snapshot_read_allowed(args, self.compose):
                raise ValueError('outside snapshot Docker commands')
            if args[0] == 'compose':
                if not snapshot_inputs_match(self, controller['file_read']):
                    raise controller['ReleaseError']('COMPOSE_INPUT_DRIFT')
                override = controller['file_read'](self.override_path, optional=True)
                includes_override = args == self.compose + ['config', '--format', 'json']
                if override != self.captured_override or includes_override != (override is not None):
                    raise controller['ReleaseError']('COMPOSE_OVERRIDE_DRIFT')
            return controller['bounded'](controller['DOCKER'] + ['--config', str(self.root / 'registry')] + args,
                                         **kwargs)

    class SampleDeadline(Exception):
        pass

    def expired(_signal, _frame):
        raise SampleDeadline()

    host = ReadOnlyHost()
    if host.root.exists():
        return 'NOT_PROVEN'
    previous = signal.signal(signal.SIGALRM, expired)
    try:
        signal.setitimer(signal.ITIMER_REAL, 75)
        with ExitStack() as resources:
            try:
                resources.enter_context(host.lock())
            except BlockingIOError:
                return 'SNAPSHOT_LOCK_BUSY'
            return sample_api_snapshot(host, scope, controller)
    except SampleDeadline:
        return 'SNAPSHOT_DEADLINE'
    except controller['ReleaseError'] as error:
        return {'COMPOSE_INPUT_DRIFT': 'SNAPSHOT_INPUT_DRIFT',
                'COMPOSE_OVERRIDE_DRIFT': 'SNAPSHOT_OVERRIDE_DRIFT'}.get(str(error), 'NOT_PROVEN')
    except (OSError, ValueError, TypeError, KeyError):
        return 'NOT_PROVEN'
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous)


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


def validate_api_compose_profile(value):
    return value if value in (*COMPOSE_PROFILE_CODES, *COMPOSE_FLOW_CODES, *REFERENCE_POSITION_CODES,
                              'PROFILE_COMPATIBLE', 'PROFILE_OTHER_UNSUPPORTED') else 'NOT_PROVEN'


def classify_api_compose_profile(working, files, profile):
    shape = api_compose_shape(working, files)
    if shape == 'NOT_PROVEN':
        return shape
    total, _, duplicates, empty, _ = map(int, shape.split('_')[1:])
    if total > 128 or total - duplicates > 16 or empty:
        return 'NOT_PROVEN'
    namespace = {'os': os, 'stat': stat, 'Path': Path, 're': re, 'compose_brace_code': compose_brace_code,
                 'compose_bracket_code': compose_bracket_code,
                 'reference_position_code': reference_position_code}
    exec(compile(profile, '<pinned-api-compose-profile>', 'exec'), namespace)
    try:
        for path in dict.fromkeys(str(Path(working) / value.strip()) for value in files.split(',')):
            contents = namespace['file_read'](path)['bytes']
            namespace['declared_env_files'](contents, working)
    except namespace['ReleaseError'] as error:
        reason = str(error)
        if reason.startswith(('DIRECTORY_', 'PROTECTED_FILE_')):
            return 'NOT_PROVEN'
        return reason if validate_api_compose_profile(reason) != 'NOT_PROVEN' else 'PROFILE_OTHER_UNSUPPORTED'
    except (OSError, UnicodeError):
        return 'NOT_PROVEN'
    return 'PROFILE_COMPATIBLE'


def observe_api_compose_profile(baseline, profile):
    if os.getuid() != 0 or os.geteuid() != 0:
        return 'NOT_PROVEN'
    before = api_binding()
    if before[1] != baseline['observedImageId']:
        return 'NOT_PROVEN'
    format_string = ('{{json (index .Config.Labels "com.docker.compose.project.working_dir")}}\n'
                     '{{json (index .Config.Labels "com.docker.compose.project.config_files")}}')
    parts = docker_read('container', 'inspect', '--format', format_string, before[0])
    if len(parts) != 2:
        return 'NOT_PROVEN'
    result = classify_api_compose_profile(*(json.loads(part) for part in parts), profile)
    final_parts = docker_read('container', 'inspect', '--format', format_string, before[0])
    return result if api_binding() == before and final_parts == parts else 'NOT_PROVEN'


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
    profile = compose_profile_source(git('cat-file', 'blob', COMPOSE_CONTROLLER_BLOB).decode('utf-8'))
    for data, expected in (
        (b'services:\n  api:\n    image: fixture\n', 'PROFILE_COMPATIBLE'),
        (b'services:\n\tapi: fixture\n', 'PROFILE_TAB_INDENT'),
        (b'include: private.yml\n', 'PROFILE_INDIRECT_KEY'),
        (b'x-block: &base\n  KEY: fixture\nservices:\n  api:\n    environment: *base\n', 'PROFILE_COMPATIBLE'),
        (b'x-block: &base\n  KEY: fixture\n  SUB: *base\n', 'PROFILE_REF_NESTED'),
        (b'x-block: &base\n  KEY: fixture\nvalues:\n  - *base\n', 'PROFILE_REF_SEQUENCE_ALIAS'),
        (b'values:\n  - &base fixture\n', 'PROFILE_REF_SEQUENCE_ANCHOR'),
        (b'x-value: &base fixture\nother: *base\n', 'PROFILE_COMPATIBLE'),
        (b'x-value: &base "fixture"\nother: *base\n', 'PROFILE_COMPATIBLE'),
        (b'x-value: &base first\nother: *base trailing\n', 'PROFILE_REF_EMBEDDED_OR_OTHER'),
        (b'x-value: &base first\nother: &next second: nested\n', 'PROFILE_INLINE_COLON_SEPARATOR'),
        (b'x-value : &base fixture\n', 'PROFILE_INLINE_KEY_SPACE'),
        (b'"key with space": &base fixture\n', 'PROFILE_INLINE_KEY_SHAPE'),
        (b'"key: with colon": &base fixture\n', 'PROFILE_INLINE_KEY_SHAPE'),
        (b'x-value: &' + b'a' * 65 + b' fixture\n', 'PROFILE_INLINE_NAME_BOUND'),
        (b'x-value: &base "fixture" extra\n', 'PROFILE_INLINE_QUOTED_FORM'),
        (b'x-value: &base ${FIXTURE:-safe}\n', 'PROFILE_COMPATIBLE'),
        (b'x-value: &base pre/${FIXTURE:-safe?}/post # private fixture\n', 'PROFILE_COMPATIBLE'),
        (b'x-value: &base ${OUTER:-${INNER:-safe}}\n', 'PROFILE_COMPATIBLE'),
        (b'x-value: &base ${FIXTURE:-value^}\n', 'PROFILE_INLINE_INTERPOLATION'),
        (b'x-value: &base fixture\t# private fixture\n', 'PROFILE_INLINE_COMMENT_SPACE'),
        (b'x-value: &base - fixture\n', 'PROFILE_INLINE_INDICATOR'),
        (b'x-value: &base name(value)\n', 'PROFILE_INLINE_CHARACTERS'),
        (b'x-value: &base ?' + b'x' * (16 * 1024) + b'\n', 'PROFILE_INLINE_LINE_BOUND'),
        (b'x-value: &base |\n  fixture\n', 'PROFILE_REF_INLINE_BLOCK_SCALAR'),
        (b'x-value: &base [fixture]\n', 'PROFILE_REF_INLINE_FLOW'),
        (b'x-value: &base !custom fixture\n', 'PROFILE_REF_INLINE_TAG'),
        (b'*base: fixture\n', 'PROFILE_REF_KEY_OPERATOR'),
        (b'"quoted key": *base\n', 'PROFILE_REF_KEY_FORMAT'),
        (b'x-value: echo *fixture\n', 'PROFILE_REF_EMBEDDED_OR_OTHER'),
        (b'services: {api: {image: fixture}}\n', 'PROFILE_FLOW_MAPPING'),
        (b'x-values: {item: ${OUTER:-${INNER:-fixture}}}\n', 'PROFILE_FLOW_MAPPING'),
        (b'x-value: first' + b' ' * (512 * 1024) + b'{tail}\n', 'PROFILE_CURLY_BRACE'),
        (b'x-values: [one, two]\n', 'PROFILE_COMPATIBLE'),
        (b'x-value: fixture[digits]\n', 'PROFILE_COMPATIBLE'),
        (b'x-values: [one, two]\nx-other: prefix{suffix}\n', 'PROFILE_CURLY_BRACE'),
        (b'x-values: [one,\n  two]\n', 'PROFILE_BRACKET_UNCLOSED_OR_CONTINUATION'),
        (b'x-values: [one, [two]]\n', 'PROFILE_BRACKET_LIST_NESTED'),
        (b'x-values: [one, two: value]\n', 'PROFILE_BRACKET_LIST_MAPPING_ITEM'),
        (b'x-values: [one, -]\n', 'PROFILE_BRACKET_LIST_MAPPING_ITEM'),
        (b'x-values: [one, , two]\n', 'PROFILE_BRACKET_LIST_EMPTY_ITEM'),
        (b'x-values: [one, two!bad]\n', 'PROFILE_BRACKET_LIST_ITEM'),
        (b'x-values: [' + b'a,' * 128 + b'a]\n', 'PROFILE_BRACKET_LIST_BOUND'),
        (b'x-values: [' + b'a' * (16 * 1024) + b']\n', 'PROFILE_BRACKET_LINE_BOUND'),
        (b'custom: [one, two]\n', 'PROFILE_BRACKET_LIST_KEY'),
        (b'env_file: [local.env]\n', 'PROFILE_BRACKET_EXTERNAL_KEY'),
        (b'x-value: fixture[digits] trailing\n', 'PROFILE_BRACKET_SCALAR'),
        (b'x-value: prefix{suffix}\n', 'PROFILE_CURLY_BRACE'),
        (b'x-value: ${OUTER:-${INNER:-safe}}\n', 'PROFILE_DOLLAR_BRACE'),
        (b'x-value: fixture }\n', 'PROFILE_CURLY_BRACE'),
        (b'x-value: "\\u0061"\n', 'PROFILE_ENCODED_INPUT'),
        (b'x-value: fixture\n<<: fixture\n', 'PROFILE_DIRECTIVE'),
        (b'services:\n  api: !unrecognized fixture\n', 'PROFILE_TAG'),
    ):
        fixture = profile + '\ndef file_read(_path): return {"bytes": ' + repr(data) + '}\n'
        assert classify_api_compose_profile('/srv/fixture', 'one.yml,one.yml', fixture) == expected
        assert validate_api_compose_profile(expected) == expected
    assert validate_api_compose_profile('/private/file.yml') == 'NOT_PROVEN'

    snapshot_source = api_snapshot_controller_source(git('cat-file', 'blob', SNAPSHOT_CONTROLLER_BLOB).decode('utf-8'))
    ledger = {}
    ledger_source = api_snapshot_controller_source(git('cat-file', 'blob', LEDGER_CONTROLLER_BLOB).decode('utf-8'))
    exec(compile(ledger_source, '<api-ledger-test>', 'exec'), ledger)
    initial_sha = '2d3708fa99e4ee855c7b9fe69dc4e4506a317ffed34330e3955f5e995d35ffdd'
    latest = '20261116000000_fixture'
    expected_ledger = {LEDGER_INITIAL: initial_sha, latest: '1' * 64}
    initial_row = {'migration_name': LEDGER_INITIAL, 'checksum': initial_sha,
                   'finished': True, 'rolled_back': False, 'steps': 1}
    latest_row = {**initial_row, 'migration_name': latest, 'checksum': '1' * 64}
    marker = {**initial_row, 'checksum': LEDGER_INITIAL_MARKER}
    archived = api_ledger_archived_checksums(git('rev-parse', 'HEAD').decode('ascii').strip())
    archive_rows = [{**initial_row, 'migration_name': name, 'checksum': checksum}
                    for name, checksum in archived.items()]
    for rows, expected_result in (
        ([initial_row, latest_row], 'LEDGER_MATCHES_SOURCE'),
        ([initial_row, marker, latest_row], 'LEDGER_MATCHES_SOURCE'),
        ([marker, latest_row], 'legacy_initial_marker_only'),
        ([marker, marker, latest_row], 'legacy_initial_marker_only, duplicate_name'),
        ([initial_row, {**latest_row, 'checksum': '2' * 64}], 'checksum_mismatch'),
        ([initial_row, {**latest_row, 'migration_name': 'UNTRUSTED_VALUE'}], 'unknown_name, missing_source_entry'),
        ([initial_row, {**latest_row, 'finished': False, 'rolled_back': True, 'steps': True}],
         'unfinished, rolled_back, invalid_steps'),
        ([initial_row, marker, latest_row, *archive_rows], 'exact_archived_migrations'),
        ([initial_row, marker, latest_row, *archive_rows[:-1]], 'unknown_name'),
        ([initial_row, latest_row, *archive_rows[:-1], {**archive_rows[-1], 'checksum': '0' * 64}], 'unknown_name'),
        ([initial_row, latest_row, *archive_rows, archive_rows[0]], 'unknown_name, duplicate_name'),
        ([{'private_value': 'must not escape'}], 'LEDGER_ROW_SHAPE'),
    ):
        assert api_ledger_details(classify_api_ledger(rows, expected_ledger, archived, ledger)) == expected_result
    for invalid in ('LEDGER_DIFF_000', 'LEDGER_DIFF_FFF', 'LEDGER_DIFF_1z', 'UNTRUSTED_VALUE'):
        assert validate_api_ledger(invalid) == 'NOT_PROVEN'
    ledger_program = api_ledger_program(ledger['LEDGER_SQL'])
    assert ledger_program.index('SET TRANSACTION READ ONLY') < ledger_program.index('FROM public._prisma_migrations')
    assert 'LIMIT 5001' in ledger_program
    digest = ledger['digest']
    catalog = {**dict.fromkeys(CATALOG_SECTIONS, []),
               'profile': {'postgres_major': 16, 'encoding': 'UTF8', 'collation': {'provider': 'c'}}}
    default_principal, registration_principal = {'role': 'default'}, {'role': 'registration'}
    catalog_ref = {**CATALOG_ORACLE, 'catalog_sha256': digest(catalog), 'principal_sha256': {
        'default': digest(default_principal), 'registration': digest(registration_principal),
    }}
    fixture_controller = {'digest': digest}

    def fixture_oracle(*_args):
        fixture_controller['digest'](catalog)
        return catalog_ref

    fixture_controller['generate_oracle'] = fixture_oracle
    with patch.dict(globals(), {'CATALOG_ORACLE': catalog_ref}):
        expected_catalog = replay_catalog_oracle(fixture_controller, ('a', 'b', 'c', 'd'))
        assert fixture_controller['digest'] is digest
        first = {'ledger': [], 'catalog': catalog, 'principal': default_principal}
        second = {'ledger': None, 'catalog': catalog, 'principal': registration_principal}
        records = {'default': first, 'registration': second}
        assert classify_api_catalog(records, expected_catalog, digest) == 'CATALOG_MATCHES_ORACLE'
        changed = {**catalog, 'tables': [{'private': 'must not be emitted'}]}
        changed_default = {**first, 'catalog': changed}
        outcome = classify_api_catalog({'default': changed_default}, expected_catalog, digest)
        assert api_catalog_details(outcome) == 'tables, registration_unavailable'
        changed_auth = {**second, 'catalog': changed, 'principal': {}}
        outcome = classify_api_catalog({'default': first, 'registration': changed_auth}, expected_catalog, digest)
        assert api_catalog_details(outcome) == 'registration_principal, registration_catalog_differs'
        fixture_controller['generate_oracle'] = lambda *_: {**fixture_oracle(), 'isolated_cleanup': 'FAILED'}
        try:
            replay_catalog_oracle(fixture_controller, ('a', 'b', 'c', 'd'))
        except ValueError:
            assert fixture_controller['digest'] is digest
        else:
            raise AssertionError('unverified oracle reference was accepted')
    for invalid in ('CATALOG_DIFF_00000', 'CATALOG_DIFF_FFFFFF', 'CATALOG_TABLE_PRIVATE'):
        assert validate_api_catalog(invalid) == 'NOT_PROVEN'
    snapshot_controller = {'__name__': 'test_snapshot_controller'}
    exec(compile(snapshot_source, '<snapshot-source-test>', 'exec'), snapshot_controller)
    snapshot_host = snapshot_controller['Host']
    assert {name for name in vars(snapshot_host) if callable(getattr(snapshot_host, name))} == SNAPSHOT_HOST_METHODS
    fixture_id = 'f' * 64
    docker_calls = []
    ready_host = SimpleNamespace(inspect=lambda _: {'State': {'Running': True}},
                                 run=lambda args, **_: docker_calls.append(args))
    assert snapshot_host.ready(ready_host, fixture_id) is True
    assert len(docker_calls) == 1 and api_snapshot_read_allowed(docker_calls[0], None)
    for rejected in (
        ['exec', fixture_id, '/nodejs/bin/node', '-e', 'process.exit(0)'],
        ['exec', fixture_id, '/bin/sh', '-c', 'printf fixture'],
        ['image', 'inspect', '--format=fixture'],
        ['volume', 'rm', 'fixture'],
        ['compose', 'up', '-d'],
    ):
        assert not api_snapshot_read_allowed(rejected, None)

    scope = {'revision': 'a' * 40, 'observedImageId': 'sha256:' + 'b' * 64}
    first = dict.fromkeys(SNAPSHOT_FIELDS)
    first.update(revision=scope['revision'], image_id=scope['observedImageId'], ready=True)
    second = {**first, 'ready': False, 'siblings': 'fixture'}
    assert api_snapshot_change(first, second) == 'SNAPSHOT_DIFF_088'
    assert api_snapshot_details('SNAPSHOT_DIFF_088') == 'ready, siblings'
    assert api_snapshot_change(first, {**first, 'extra': True}) == 'NOT_PROVEN'
    for invalid in ('SNAPSHOT_DIFF_000', 'SNAPSHOT_DIFF_800', 'SNAPSHOT_DIFF_00a', '/private/file'):
        assert validate_api_snapshot(invalid) == 'NOT_PROVEN'
    controller_fixture = {'digest': lambda _: SNAPSHOT_VOLUME_DIGEST, 'BASELINE_ARCHIVE_SCHEMA': 'fixture',
                          'file_read': lambda path, **_: path}
    volumes_fixture = '\n'.join(f'fixture{i}' for i in range(19)).encode()
    observations = iter((first, second))
    fixture_host = SimpleNamespace(run=lambda _: volumes_fixture, snapshot=lambda _: next(observations),
                                   effective_api_image_id=lambda: scope['observedImageId'],
                                   inputs={'/fixture': '/fixture'})
    assert sample_api_snapshot(fixture_host, scope, controller_fixture) == 'SNAPSHOT_DIFF_088'
    fixture_host.snapshot = lambda _: first
    with patch('time.sleep') as sleep:
        assert sample_api_snapshot(fixture_host, scope, controller_fixture) == 'SNAPSHOT_STABLE_IN_SAMPLE'
        assert sleep.call_count == 2
    fixture_host.inputs['/fixture'] = 'changed'
    def unexpected_render():
        raise AssertionError('Compose was reached after protected input drift')

    fixture_host.effective_api_image_id = unexpected_render
    after_drift = iter((first,))
    fixture_host.snapshot = lambda _: next(after_drift)
    assert sample_api_snapshot(fixture_host, scope, controller_fixture) == 'SNAPSHOT_INPUT_DRIFT'
    fixture_host.run = lambda _: b'fixture'
    assert sample_api_snapshot(fixture_host, scope, controller_fixture) == 'SNAPSHOT_INVENTORY_CHANGED'

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
        elif sys.argv[1:] == ['--api-compose-profile']:
            print(observe_api_compose_profile(api_baseline_spec(globals()['API_BASELINE']), globals()['API_COMPOSE_PROFILE']))
        elif sys.argv[1:] == ['--api-snapshot']:
            print(observe_api_snapshot(api_baseline_spec(globals()['API_BASELINE']), globals()['API_SNAPSHOT_CONTROLLER']))
        elif sys.argv[1:] == ['--api-ledger']:
            print(observe_api_ledger(api_baseline_spec(globals()['API_BASELINE']),
                                     globals()['API_LEDGER_CONTROLLER'], globals()['API_LEDGER_EXPECTED'],
                                     globals()['API_LEDGER_ARCHIVED']))
        elif sys.argv[1:] == ['--api-catalog']:
            print(observe_api_catalog(api_baseline_spec(globals()['API_BASELINE']),
                                       globals()['API_CATALOG_CONTROLLER'], globals()['API_CATALOG_PROGRAMS'],
                                       globals()['API_CATALOG_EXPECTED']))
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
        elif len(sys.argv) == 3 and sys.argv[1] == '--build-api-compose-profile-payload':
            build_api_compose_profile_payload(sys.argv[2])
        elif len(sys.argv) == 3 and sys.argv[1] == '--build-api-snapshot-payload':
            build_api_snapshot_payload(sys.argv[2])
        elif len(sys.argv) == 3 and sys.argv[1] == '--build-api-ledger-payload':
            build_api_ledger_payload(sys.argv[2])
        elif len(sys.argv) == 3 and sys.argv[1] == '--catalog-oracle-inputs':
            print(*catalog_oracle_inputs(sys.argv[2])[1], sep='\n')
        elif len(sys.argv) == 4 and sys.argv[1] == '--build-api-catalog-payload':
            build_api_catalog_payload(sys.argv[2], sys.argv[3])
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
        elif len(sys.argv) == 3 and sys.argv[1] == '--validate-api-compose-profile':
            print(validate_api_compose_profile(sys.argv[2]))
        elif len(sys.argv) == 3 and sys.argv[1] == '--validate-api-snapshot':
            print(validate_api_snapshot(sys.argv[2]))
        elif len(sys.argv) == 3 and sys.argv[1] == '--api-snapshot-details':
            print(api_snapshot_details(sys.argv[2]))
        elif len(sys.argv) == 3 and sys.argv[1] == '--validate-api-ledger':
            print(validate_api_ledger(sys.argv[2]))
        elif len(sys.argv) == 3 and sys.argv[1] == '--api-ledger-details':
            print(api_ledger_details(sys.argv[2]))
        elif len(sys.argv) == 3 and sys.argv[1] == '--validate-api-catalog':
            print(validate_api_catalog(sys.argv[2]))
        elif len(sys.argv) == 3 and sys.argv[1] == '--api-catalog-details':
            print(api_catalog_details(sys.argv[2]))
        elif len(sys.argv) == 5 and sys.argv[1] == '--reconcile':
            print('BOOT_AFTER_LEGACY_CUTOFF' if reconcile(sys.argv[2], int(sys.argv[3]), int(sys.argv[4]))
                  else 'NOT_PROVEN')
        else:
            raise SystemExit(2)
    except (OSError, ValueError, TypeError, AttributeError, KeyError, subprocess.SubprocessError):
        raise SystemExit(1) from None
