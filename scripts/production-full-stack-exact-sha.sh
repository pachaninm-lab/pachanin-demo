#!/usr/bin/env bash
set -Eeuo pipefail

ACTION="${1:-}"
TARGET_SHA="${2:-}"
RUN_ID="${3:-manual}"
INTAKE_REQUEST_NUMBER="${4:-}"
INTAKE_CORRELATION_ID="${5:-}"
API_IMAGE="${PC_API_IMAGE:-}"
WEB_IMAGE="${PC_WEB_IMAGE:-}"
MIGRATION_IMAGE="${PC_MIGRATION_IMAGE:-}"
OUTBOX_WORKER_IMAGE="${PC_OUTBOX_WORKER_IMAGE:-}"
EXACT_IMAGE_SOURCE="${PC_EXACT_IMAGE_SOURCE:-registry}"
API_IMAGE_ID="${PC_API_IMAGE_ID:-}"
WEB_IMAGE_ID="${PC_WEB_IMAGE_ID:-}"
MIGRATION_IMAGE_ID="${PC_MIGRATION_IMAGE_ID:-}"
OUTBOX_WORKER_IMAGE_ID="${PC_OUTBOX_WORKER_IMAGE_ID:-}"
OUTBOX_POLICY_FILE="${PC_OUTBOX_POLICY_FILE:-}"
KAFKA_IMAGE='confluentinc/cp-kafka@sha256:24cdd3a7fa89d2bed150560ebea81ff1943badfa61e51d66bb541a6b0d7fb047'
KAFKA_SERVICE='ir20-kafka'
OUTBOX_SERVICE='outbox-worker'
SCRIPT_ORIGIN="${BASH_SOURCE[0]:-}"
IMAGE_BINDING_VERIFIER="${PC_RELEASE_IMAGE_BINDING_VERIFIER:-${SCRIPT_ORIGIN%/*}/release/verify-production-image-binding.py}"
PROD_DIR_B64="${PC_PROD_DIR_B64:-}"
PROD_COMPOSE_B64="${PC_PROD_COMPOSE_B64:-}"
PROD_PROJECT_B64="${PC_PROD_PROJECT_B64:-}"
BACKUP_EVIDENCE_B64="${PC_PROD_BACKUP_EVIDENCE_FILE_B64:-${PC_BACKUP_EVIDENCE_FILE_B64:-}}"
STATE_ROOT="/var/lib/pc-release-authority"
STATE_FILE="$STATE_ROOT/full-stack-${RUN_ID}.state"
outbox_runtime_env_file=""
OUTBOX_RUNTIME_ENV_PREEXISTED=0
BASELINE_WORKER_PRESENT=0
BASELINE_BROKER_PRESENT=0

RELEASE_ROLLBACK_ARMED=0
RELEASE_ROLLBACK_ACTIVE=0
API_WEB_MUTATED=0
ROLLBACK_API_WEB_COMPLETE=0
ROLLBACK_IR20_COMPLETE=0
fail() {
  local code="$1" rc="${2:-1}"
  printf 'ERROR_CODE=%s\n' "$code" >&2
  if [[ "${RELEASE_ROLLBACK_ARMED:-0}" == 1 && "${RELEASE_ROLLBACK_ACTIVE:-0}" == 0 ]]; then
    rollback_and_exit "$rc"
  fi
  exit "$rc"
}
decode() { [[ -z "$1" ]] || printf '%s' "$1" | base64 -d; }
trim() { local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }

[[ "$ACTION" =~ ^(audit|deploy|rollback|verify-intake|observe-ir20)$ ]] || fail INVALID_ACTION 2
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || fail INVALID_TARGET_SHA 3
[[ "$RUN_ID" =~ ^[A-Za-z0-9._:-]{1,128}$ ]] || fail INVALID_RUN_ID 4
[[ "$EXACT_IMAGE_SOURCE" =~ ^(registry|pinned-ssh)$ ]] || fail INVALID_EXACT_IMAGE_SOURCE 130

prod_dir=''; prod_compose=''; prod_project=''; backup_evidence=''
if [[ "$ACTION" != audit ]]; then
  prod_dir="$(decode "$PROD_DIR_B64")"
  prod_compose="$(decode "$PROD_COMPOSE_B64")"
  prod_project="$(decode "$PROD_PROJECT_B64")"
  backup_evidence="$(decode "$BACKUP_EVIDENCE_B64")"
fi
auth_opaque_token_env_file=""
staff_database_env_file=""
password_reset_delivery_env_file=""
transactional_mail_env_file=""
gekta_api_runtime_env_file=""
gekta_web_runtime_env_file=""

resolve_compose_authority() {
  if [[ -n "$prod_dir" && -n "$prod_compose" ]]; then return; fi
  mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
  (( ${#web_ids[@]} == 1 )) || fail COMPOSE_WEB_AUTHORITY_AMBIGUOUS 10
  local web_id="${web_ids[0]}"
  prod_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
  prod_compose="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"
  prod_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
  [[ -n "$prod_dir" && -n "$prod_compose" && -n "$prod_project" ]] || fail COMPOSE_LABEL_AUTHORITY_MISSING 11
}

# Audit is an observation, never migration/deploy eligibility. Run before the
# legacy deployment environment/service resolvers and all release state writes.
if [[ "$ACTION" == audit ]]; then
  PC_AUDIT_SOURCE_SHA="$TARGET_SHA" PC_AUDIT_RUN_ID="$RUN_ID" python3 -I - <<'PY_MIGRATION_AUTHORITY_AUDIT'
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import tempfile
import selectors
import signal
import time
import shutil
from contextlib import contextmanager
from datetime import datetime, timezone
from urllib.parse import urlsplit, parse_qsl

# Reused unchanged event-only grammar and MIT upstream bundle from accepted
# .github/workflows/production-web-exact-sha.yml blob at base0143943. No installed
# YAML package, constructor, network fetch, or runtime code discovery is used.
# The source bundle is PyYAML6.0.3, exact ZIP17723B/SHA256
# 2cab6ed6ea68aa815e7492fc084162a44bd6c926c60a13f416c8199829824850.
_YAML_EVENT_TYPES = None
LIMIT = 2 * 1024 * 1024
DEADLINE = time.monotonic() + 120
class ObserverDeadline(Exception):
    pass
class UnsupportedModel(ValueError):
    def __init__(self, reason=None, stage=None):
        super().__init__('COMPOSE_INPUT_INVALID')

class DuplicateJSON(ValueError):
    pass

def unique(pairs):
    out = {}
    for key, value in pairs:
        if key in out:
            raise DuplicateJSON()
        out[key] = value
    return out

def decode(raw):
    return json.loads(raw.decode('utf-8', errors='strict'), object_pairs_hook=unique)

PYYAML_LICENSE = 'Copyright (c) 2017-2021 Ingy döt Net\nCopyright (c) 2006-2016 Kirill Simonov\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of\nthis software and associated documentation files (the "Software"), to deal in\nthe Software without restriction, including without limitation the rights to\nuse, copy, modify, merge, publish, distribute, sublicense, and/or sell copies\nof the Software, and to permit persons to whom the Software is furnished to do\nso, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n'

PYYAML_EVENT_ZIP_BYTES = 17723

PYYAML_EVENT_ZIP_SHA256 = '2cab6ed6ea68aa815e7492fc084162a44bd6c926c60a13f416c8199829824850'

PYYAML_EVENT_MEMBERS = {'error.py': (2533, '021f73fada072546c4f63f8cf18a7181244ce4280b09cc15cc980b2d1176171a'), 'tokens.py': (2573, '953408cd2570f0c83dc2fe39f7e4e388e41eeb05738aa69196a5f6ffcf6ba79e'), 'events.py': (2445, 'e74fd392c810884e2ea7e94aa3f57e9c1cbeb402319083d0c58e6a0e1282787c'), 'reader.py': (6794, 'd1d9b38ab3a20c6e17a38d519ee412ecaf6b918df18c78956ac7c330d4ea08dc'), 'scanner.py': (51279, '60433788b652690c17710460da5d91e0c753d3318fd85f5e1e42862a71f25906'), 'parser.py': (25495, '8a55a9e6fbe0a07146cef3990c8b45a068c3e83e369e1959ad9ca30306b4a09a'), 'LICENSE': (1101, '8d3928f9dc4490fd635707cb88eb26bd764102a7282954307d3e5167a577e8a4')}

PYYAML_EVENT_BUNDLE = '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'

def event_parser_types():
    global _YAML_EVENT_TYPES
    if _YAML_EVENT_TYPES is not None:
        return _YAML_EVENT_TYPES
    # Only pinned upstream source is compiled. Protected YAML is input data;
    # no composer, resolver, constructor, installed yaml import or disk cache.
    import base64
    import builtins
    import io
    import types
    import zipfile
    try:
        archive = base64.b64decode(PYYAML_EVENT_BUNDLE, validate=True)
        if len(archive) != PYYAML_EVENT_ZIP_BYTES or hashlib.sha256(archive).hexdigest() != PYYAML_EVENT_ZIP_SHA256:
            raise ValueError('BUNDLE')
        modules = {}
        def trusted_import(name, globals=None, locals=None, fromlist=(), level=0):
            if level == 1 and name in modules:
                return modules[name]
            if level == 0 and name in ('codecs', 're'):
                return builtins.__import__(name, globals, locals, fromlist, level)
            raise ImportError('BUNDLE_IMPORT')
        with zipfile.ZipFile(io.BytesIO(archive)) as zipped:
            if zipped.namelist() != list(PYYAML_EVENT_MEMBERS):
                raise ValueError('MEMBERS')
            for name, (length, digest) in PYYAML_EVENT_MEMBERS.items():
                info = zipped.getinfo(name)
                if info.file_size != length:
                    raise ValueError('SIZE')
                raw = zipped.read(name)
                if len(raw) != length or hashlib.sha256(raw).hexdigest() != digest:
                    raise ValueError('DIGEST')
                if name == 'LICENSE':
                    continue
                key = name[:-3]
                module = types.ModuleType('_pc_yaml603.' + key)
                module.__package__ = '_pc_yaml603'
                module.__dict__['__builtins__'] = dict(vars(builtins), __import__=trusted_import)
                exec(compile(raw, '<pc-pyyaml603-' + key + '>', 'exec'), module.__dict__)
                modules[key] = module
        Reader, Scanner, Parser = modules['reader'].Reader, modules['scanner'].Scanner, modules['parser'].Parser
        class EventParser(Reader, Scanner, Parser):
            def __init__(self, text):
                Reader.__init__(self, text)
                Scanner.__init__(self)
                Parser.__init__(self)
            def get_token(self):
                token = Scanner.get_token(self)
                # The real scanner recognizes directives; unknown directives
                # are otherwise discarded by Parser.process_directives.
                if isinstance(token, modules['tokens'].DirectiveToken):
                    raise UnsupportedModel('YAML_DIRECTIVE', 'FORMAT_CLOSURE')
                return token
        _YAML_EVENT_TYPES = (EventParser, modules['events'])
        return _YAML_EVENT_TYPES
    except Exception:
        raise UnsupportedModel('YAML_PARSER_BUNDLE', 'FORMAT_CLOSURE') from None

def closed_compose_bytes(raw, trusted_hardening):
    # Sole existing custom-tag exception: exact accepted source-owned hardening
    # bytes, bound by the whole-head/driver hash. No untrusted !reset exception.
    trusted = hashlib.sha256(raw).hexdigest() == trusted_hardening
    try:
        text = raw.decode('utf-8', errors='strict')
    except UnicodeError:
        raise UnsupportedModel('ENCODING_UTF8', 'FORMAT_CLOSURE') from None
    forbidden = {'include', 'extends', 'build', 'develop', 'provider'}
    if any(c in text for c in ('\0', '\r', '\t')):
        raise UnsupportedModel('YAML_CONTROL_OR_ESCAPE', 'FORMAT_CLOSURE')
    if not text.strip():
        raise UnsupportedModel('YAML_EMPTY', 'FORMAT_CLOSURE')
    # Preserve strict JSON diagnostics, then apply the same event-cost limits.
    # Non-JSON flow mappings continue to the real YAML scanner/parser.
    if text.lstrip().startswith('{'):
        try:
            value = decode(raw)
        except DuplicateJSON:
            raise UnsupportedModel('JSON_DUPLICATE', 'FORMAT_CLOSURE') from None
        except (ValueError, UnicodeError, RecursionError):
            value = None
        if value is not None:
            def walk(item):
                pending = [item]
                while pending:
                    child = pending.pop()
                    if isinstance(child, dict):
                        for key, value in child.items():
                            if not isinstance(key, str) or key.lower() in forbidden or key == '<<':
                                raise UnsupportedModel('JSON_FORBIDDEN_KEY', 'FORMAT_CLOSURE')
                            pending.append(value)
                    elif isinstance(child, list):
                        pending.extend(child)
            if not isinstance(value, dict) or set(value) - {'name', 'version', 'services', 'networks', 'volumes', 'configs', 'secrets'}:
                raise UnsupportedModel('JSON_ROOT_SHAPE', 'FORMAT_CLOSURE')
            walk(value)
    try:
        EventParser, E = event_parser_types()
        parser = EventParser(text)
        stack, anchors, names = [], {}, set()
        root, documents, events, aliases = None, 0, 0, 0
        def deny(code):
            raise UnsupportedModel(code, 'FORMAT_CLOSURE')
        def bounds(meta):
            if meta['nodes'] > 65536 or meta['bytes'] > 4 * LIMIT:
                deny('YAML_EXPANSION_BOUND')
            if meta['depth'] > 64:
                deny('YAML_DEPTH_BOUND')
        def attach(meta, scalar=None):
            nonlocal root
            bounds(meta)
            if not stack:
                if root is not None or meta['kind'] != 'map':
                    deny('YAML_ROOT_SHAPE')
                root = meta
                return
            parent = stack[-1]
            if parent['kind'] == 'map' and parent['key']:
                if meta['kind'] != 'scalar' or scalar is None:
                    deny('YAML_COMPLEX_KEY')
                if scalar.lower() in forbidden:
                    deny('YAML_FORBIDDEN_KEY')
                if scalar in parent['keys']:
                    deny('YAML_DUPLICATE_KEY')
                parent['keys'].add(scalar)
                if len(stack) == 1 and scalar not in ('name', 'version', 'services', 'networks', 'volumes', 'configs', 'secrets') and not scalar.startswith('x-'):
                    deny('YAML_ROOT_KEY')
                parent['key'] = False
            elif parent['kind'] == 'map':
                parent['key'] = True
            parent['nodes'] += meta['nodes']
            parent['bytes'] += meta['bytes']
            parent['aliases'] += meta['aliases']
            parent['depth'] = max(parent['depth'], meta['depth'] + 1)
            bounds(parent)
        def reserve(anchor):
            if anchor is None:
                return
            if not isinstance(anchor, str) or not 0 < len(anchor) <= 128 or anchor in names or len(names) >= 128:
                deny('YAML_ANCHOR_BOUND')
            names.add(anchor)
        while parser.check_event():
            if DEADLINE is not None and time.monotonic() >= DEADLINE:
                raise ObserverDeadline()
            event = parser.get_event()
            events += 1
            if events > 65536:
                deny('YAML_EVENT_BOUND')
            if isinstance(event, E.DocumentStartEvent):
                documents += 1
                if documents != 1 or event.version is not None or event.tags:
                    deny('YAML_DOCUMENT_BOUND')
            elif isinstance(event, (E.StreamStartEvent, E.StreamEndEvent, E.DocumentEndEvent)):
                continue
            elif isinstance(event, E.AliasEvent):
                aliases += 1
                if aliases > 1024:
                    deny('YAML_ALIAS_BOUND')
                if any(frame['anchor'] is not None for frame in stack) or event.anchor not in anchors:
                    deny('YAML_ALIAS_GRAPH')
                if stack and stack[-1]['kind'] == 'map' and stack[-1]['key']:
                    deny('YAML_COMPLEX_KEY')
                meta = dict(anchors[event.anchor])
                meta['nodes'] += 1
                meta['aliases'] += 1
                attach(meta)
            elif isinstance(event, (E.MappingStartEvent, E.SequenceStartEvent, E.ScalarEvent)):
                if event.tag is not None and not (trusted and event.tag == '!reset'):
                    deny('YAML_TAG')
                reserve(event.anchor)
                is_key = stack and stack[-1]['kind'] == 'map' and stack[-1]['key']
                if is_key and (not isinstance(event, E.ScalarEvent) or event.anchor is not None):
                    deny('YAML_COMPLEX_KEY')
                if isinstance(event, E.ScalarEvent):
                    meta = {'kind': 'scalar', 'nodes': 1, 'bytes': len(event.value.encode('utf-8')), 'depth': 1, 'aliases': 0}
                    bounds(meta)
                    if event.anchor is not None:
                        anchors[event.anchor] = dict(meta)
                    attach(meta, event.value)
                else:
                    if len(stack) >= 64:
                        deny('YAML_DEPTH_BOUND')
                    stack.append({'kind': 'map' if isinstance(event, E.MappingStartEvent) else 'seq',
                                  'nodes': 1, 'bytes': 0, 'depth': 1, 'aliases': 0, 'key': True, 'keys': set(), 'anchor': event.anchor})
            elif isinstance(event, (E.MappingEndEvent, E.SequenceEndEvent)):
                frame = stack.pop()
                if frame['kind'] == 'map' and not frame['key']:
                    deny('YAML_SYNTAX')
                meta = {key: frame[key] for key in ('kind', 'nodes', 'bytes', 'depth', 'aliases')}
                if frame['anchor'] is not None:
                    anchors[frame['anchor']] = dict(meta)
                attach(meta)
            else:
                deny('YAML_SYNTAX')
        if documents != 1 or stack or root is None:
            deny('YAML_SYNTAX')
        return {key: root[key] for key in ('nodes', 'bytes', 'depth', 'aliases')}
    except UnsupportedModel:
        raise
    except Exception:
        raise UnsupportedModel('YAML_SYNTAX', 'FORMAT_CLOSURE') from None

report = {
    'schema': 'pc.migration-authority-audit.v2',
    'configuration_basis': 'SEALED_FILES_NO_ENV_RESOLUTION',
    'environment_authority': 'NOT_OBSERVED',
    'source_sha': os.environ['PC_AUDIT_SOURCE_SHA'],
    'run_id': os.environ['PC_AUDIT_RUN_ID'],
    'observed_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'observation': 'INCOMPLETE', 'result': 'HOLD',
    'compose': 'NOT_PROVEN', 'migration': 'NOT_PROVEN',
    'migration_database': 'NOT_PROVEN', 'migration_principal': 'NOT_PROVEN',
    'migration_credential_reference': 'NOT_PROVEN',
    'runtime_api_revision': 'NOT_PROVEN', 'runtime_web_revision': 'NOT_PROVEN',
    'runtime_api_health': 'NOT_PROVEN', 'runtime_web_health': 'NOT_PROVEN',
    'backup_metadata': 'NOT_PROVEN', 'backup_integrity': 'NOT_PROVEN',
    'capacity': 'NOT_PROVEN', 'docker_available_kib': 0,
    'docker_available_inodes': 0, 'temporary_available_kib': 0,
    'observed_volume_count': 0, 'reserve19_authority': 'NOT_PROVEN',
    'observed_volume_set_sha256': 'NOT_PROVEN',
    'model_sha256': 'NOT_PROVEN', 'input_stability': 'NOT_PROVEN',
    'private_cleanup': 'COMPLETE', 'production_mutation': 'NONE',
    'release_eligibility': 'NOT_GRANTED', 'reject_reason': 'READ_FAILED',
}

def command(args, limit=2 * 1024 * 1024):
    # PIPE reads are bounded while produced: no raw-output disk allocation.
    # Each subprocess has an owned process group, always killed and reaped.
    environment = {key: os.environ[key] for key in ('PATH', 'LANG', 'LC_ALL') if key in os.environ}
    environment['DOCKER_HOST'] = 'unix:///var/run/docker.sock'
    process = None
    mask = signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGALRM, signal.SIGTERM, signal.SIGHUP})
    output = bytearray()
    deadline = min(DEADLINE, time.monotonic() + 20)
    try:
        try:
            process = subprocess.Popen(args, stdout=subprocess.PIPE,
                                       stderr=subprocess.DEVNULL, env=environment,
                                       start_new_session=True)
        finally:
            signal.pthread_sigmask(signal.SIG_SETMASK, mask)
        with selectors.DefaultSelector() as ready:
            ready.register(process.stdout, selectors.EVENT_READ)
            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise ValueError('READ_FAILED')
                if not ready.select(min(remaining, .1)):
                    continue
                part = os.read(process.stdout.fileno(), min(65536, limit + 1 - len(output)))
                if not part:
                    break
                output.extend(part)
                if len(output) > limit:
                    raise ValueError('READ_FAILED')
        if process.wait(timeout=max(.001, deadline-time.monotonic())):
            raise ValueError('READ_FAILED')
        return bytes(output).decode('utf-8', errors='strict').strip()
    finally:
        # Even an exited leader may leave descendants holding its stdout.
        if process is not None:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.stdout.close()
            process.wait(timeout=2)


def selector(name):
    value = os.environ.get(name, '')
    if not value:
        return ''
    if len(value) > 16384:
        raise ValueError('SELECTOR_INVALID')
    decoded = base64.b64decode(value, validate=True).decode('utf-8')
    if not decoded or decoded != decoded.strip() or any(ord(c) < 32 for c in decoded):
        raise ValueError('SELECTOR_INVALID')
    return decoded

def selected_file(path):
    if not Path(path).is_absolute() or str(Path(path).resolve(strict=True)) != path:
        raise ValueError('COMPOSE_INPUT_INVALID')
    # No glob, secret-file search, symlink traversal, or production input write.
    with open(path, 'rb', opener=lambda p, flags: os.open(p, flags | os.O_NOFOLLOW)) as f:
        info = os.fstat(f.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_mode & 0o022 or info.st_size > 2 * 1024 * 1024:
            raise ValueError('COMPOSE_INPUT_INVALID')
        value = f.read(2 * 1024 * 1024 + 1)
        after = os.fstat(f.fileno())
        if (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns) != (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns):
            raise ValueError('INPUTS_CHANGED')
    if len(value) > 2 * 1024 * 1024:
        raise ValueError('COMPOSE_INPUT_INVALID')
    return value

def container(identifier, project, service):
    if not re.fullmatch('[a-f0-9]{64}', identifier):
        raise ValueError('RUNTIME_AMBIGUOUS')
    labels = json.loads(command(['docker', 'inspect', '--format', '{{json .Config.Labels}}', identifier], 65536))
    if not isinstance(labels, dict) or labels.get('com.docker.compose.project') != project or labels.get('com.docker.compose.service') != service:
        raise ValueError('PROJECT_MISMATCH')
    fields = command(['docker', 'inspect', '--format', '{{.Image}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}', identifier], 1024).split('|')
    if len(fields) != 3 or not re.fullmatch('sha256:[a-f0-9]{64}', fields[0]):
        raise ValueError('RUNTIME_INVALID')
    image = json.loads(command(['docker', 'image', 'inspect', '--format', '{{json .Config.Labels}}', fields[0]], 65536))
    if not isinstance(image, dict):
        raise ValueError('RUNTIME_INVALID')
    revision = image.get('org.opencontainers.image.revision', '')
    revision = revision if isinstance(revision, str) and re.fullmatch('[a-f0-9]{40}', revision) else 'NOT_PROVEN'
    health = 'HEALTHY' if fields[1:] == ['running', 'healthy'] else 'RUNNING' if fields[1:] == ['running', 'none'] else 'UNHEALTHY'
    # Compose labels establish only this runtime's configured file identity.
    configured = labels.get('com.docker.compose.project.config_files')
    working = labels.get('com.docker.compose.project.working_dir')
    binding = isinstance(configured, str) and working == directory
    if binding:
        try:
            configured_files = [str(Path(x.strip()) if Path(x.strip()).is_absolute() else Path(working) / x.strip()) for x in configured.split(',')]
            binding = configured_files == files
        except Exception:
            binding = False
    return revision, health, hashlib.sha256(json.dumps([labels, fields, image], sort_keys=True).encode()).hexdigest(), binding

class SnapshotCleanupError(ValueError):
    pass

@contextmanager
def sealed_compose_inputs(files, directory, project):
    snapshot_directory = None
    snapshot_identity = None
    try:
        if not 1 <= len(files) <= 128:
            raise ValueError('COMPOSE_INPUT_INVALID')
        before, raw_bytes = {}, 0
        for path in files:
            if path not in before:
                raw = selected_file(path)
                raw_bytes += len(raw)
                if raw_bytes > 32 * 1024 * 1024:
                    raise ValueError('COMPOSE_INPUT_INVALID')
                before[path] = raw
        # Same accepted web model accounting: cache event metadata by content
        # digest, but charge EVERY ordered -f input, including duplicates,
        # before any Compose invocation or snapshot allocation.
        costs, total = {}, {'nodes': 0, 'bytes': 0, 'aliases': 0, 'depth': 0}
        for path in files:
            raw = before[path]
            digest = hashlib.sha256(raw).hexdigest()
            if digest not in costs:
                costs[digest] = closed_compose_bytes(raw, 'bd430c5cb208c897148ab7794792264defce7108028bb0151d786064e4ecb67b')
            cost = costs[digest]
            for key in ('nodes', 'bytes', 'aliases'):
                total[key] += cost[key]
            total['depth'] = max(total['depth'], cost['depth'])
            if total['nodes'] > 65536 or total['bytes'] > 4 * LIMIT or total['aliases'] > 1024 or total['depth'] > 64:
                raise UnsupportedModel('YAML_MODEL_RESOURCE_BOUND', 'MODEL_RESOURCE')
        allocation_mask = signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGALRM, signal.SIGTERM, signal.SIGHUP})
        try:
            snapshot_directory = Path(tempfile.mkdtemp(prefix='pc-migration-readonly-audit-'))
            snapshot_identity = snapshot_directory.lstat()
        finally:
            signal.pthread_sigmask(signal.SIG_SETMASK, allocation_mask)
        if stat.S_IMODE(snapshot_identity.st_mode) != 0o700 or snapshot_identity.st_uid != os.geteuid():
            raise ValueError('COMPOSE_INPUT_INVALID')
        snapshot_paths = {}
        for path, raw in before.items():
            target = snapshot_directory / str(len(snapshot_paths))
            fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
            with os.fdopen(fd, 'wb') as output:
                output.write(raw)
            snapshot_paths[path] = str(target)
        dc = ['docker', 'compose', '--env-file', '/dev/null', '--project-directory', directory]
        if project:
            dc += ['--project-name', project]
        for file in files:
            dc += ['-f', snapshot_paths[file]]
        config_command = dc + ['config', '--no-env-resolution', '--no-interpolate', '--format', 'json']
        model = decode(command(config_command).encode())
        yield before, config_command, model
    finally:
        if snapshot_directory is not None:
            try:
                if snapshot_identity is None:
                    raise ValueError()
                identity = snapshot_directory.lstat()
                if (identity.st_dev, identity.st_ino, identity.st_uid, stat.S_IMODE(identity.st_mode)) != (snapshot_identity.st_dev, snapshot_identity.st_ino, os.geteuid(), 0o700):
                    raise ValueError()
                shutil.rmtree(snapshot_directory)
                if snapshot_directory.exists():
                    raise ValueError()
            except Exception:
                raise SnapshotCleanupError('READ_FAILED') from None

def observer_interrupted(signum, frame):
    raise ObserverDeadline()
for observed_signal in (signal.SIGALRM, signal.SIGTERM, signal.SIGHUP):
    signal.signal(observed_signal, observer_interrupted)
signal.setitimer(signal.ITIMER_REAL, max(.001, DEADLINE-time.monotonic()))
try:
    directory = selector('PC_PROD_DIR_B64')
    selection = selector('PC_PROD_COMPOSE_B64')
    project = selector('PC_PROD_PROJECT_B64')
    if bool(directory) != bool(selection):
        raise ValueError('SELECTOR_INVALID')
    if not directory:
        ids = command(['docker', 'ps', '--no-trunc', '-q', '--filter', 'label=com.docker.compose.service=web'], 65536).splitlines()
        if len(ids) != 1 or not re.fullmatch('[a-f0-9]{64}', ids[0]):
            raise ValueError('PROJECT_AMBIGUOUS')
        labels = json.loads(command(['docker', 'inspect', '--format', '{{json .Config.Labels}}', ids[0]], 65536))
        directory = labels.get('com.docker.compose.project.working_dir', '')
        selection = labels.get('com.docker.compose.project.config_files', '')
        project = labels.get('com.docker.compose.project', '')
    if not isinstance(directory, str) or len(directory) > 4096 or any(ord(c) < 32 for c in directory) or not Path(directory).is_absolute() or not Path(directory).is_dir() or not isinstance(selection, str) or len(selection) > 16384 or any(ord(c) < 32 for c in selection):
        raise ValueError('SELECTOR_INVALID')
    if project and not re.fullmatch('[A-Za-z0-9][A-Za-z0-9_.-]{0,127}', project):
        raise ValueError('PROJECT_AMBIGUOUS')
    files = [x.strip() for x in selection.split(',')]
    if not 1 <= len(files) <= 128 or any(not x for x in files):
        raise ValueError('SELECTOR_INVALID')
    files = [str(Path(x) if Path(x).is_absolute() else Path(directory) / x) for x in files]
    if sum(os.stat(x, follow_symlinks=False).st_size for x in set(files)) > 32 * 1024 * 1024:
        raise ValueError('COMPOSE_INPUT_INVALID')
    with sealed_compose_inputs(files, directory, project) as (before, config_command, model):
        name = model.get('name')
        if not isinstance(name, str) or not re.fullmatch('[A-Za-z0-9][A-Za-z0-9_.-]{0,127}', name) or (project and project != name):
            raise ValueError('PROJECT_MISMATCH')
        project = name
        services = model.get('services')
        if not isinstance(services, dict) or not all(isinstance(services.get(x), dict) for x in ('api', 'web')):
            raise ValueError('RUNTIME_INVALID')
        identities = {}
        runtime_error = 'NONE'
        for role in ('api', 'web'):
            try:
                identifiers = command(['docker', 'ps', '--all', '--no-trunc', '-q', '--filter', 'label=com.docker.compose.project=' + project, '--filter', 'label=com.docker.compose.service=' + role], 65536).splitlines()
                if len(identifiers) != 1:
                    raise ValueError('RUNTIME_AMBIGUOUS')
                identities[role] = (identifiers[0], container(identifiers[0], project, role))
                report['runtime_' + role + '_revision'], report['runtime_' + role + '_health'] = identities[role][1][:2]
            except Exception as error:
                runtime_error = str(error) if str(error) in ('READ_FAILED', 'PROJECT_MISMATCH', 'RUNTIME_INVALID', 'RUNTIME_AMBIGUOUS') else 'RUNTIME_INVALID'
        candidates = []
        for name, service in services.items():
            if not isinstance(service, dict):
                raise ValueError('RUNTIME_INVALID')
            image = str(service.get('image') or '')
            cmd = service.get('command')
            cmd = ' '.join(str(x) for x in cmd) if isinstance(cmd, list) else str(cmd or '')
            if re.search(r'(^|[-_])(migrate|migration)([-_]|$)', name, re.I) or 'grainflow-migration' in image or ('prisma' in cmd and 'migrate' in cmd):
                candidates.append(name)
        report['migration'] = 'MISSING' if not candidates else 'ONE' if len(candidates) == 1 else 'AMBIGUOUS'
        if len(candidates) == 1:
            def environment(service):
                env = service.get('environment') or {}
                if isinstance(env, list):
                    env = dict(x.split('=', 1) for x in env if isinstance(x, str) and '=' in x)
                return env if isinstance(env, dict) else {}
            env = environment(services[candidates[0]])
            api = environment(services['api'])
            def authority(value):
                if not isinstance(value, str) or '$' in value or any(ord(c) < 32 for c in value):
                    return None
                u = urlsplit(value)
                if u.scheme not in ('postgres', 'postgresql') or not u.username or not u.password or not u.hostname or not u.path.strip('/'):
                    return None
                return u.hostname.lower(), u.port or 5432, u.path, tuple(sorted(parse_qsl(u.query, keep_blank_values=True)))
            migration = authority(env.get('DATABASE_URL'))
            current = authority(api.get('AUTH_DATABASE_URL') or api.get('DATABASE_URL'))
            if migration:
                report['migration_credential_reference'] = 'CONFIG_PRESENT'
            if migration and current:
                report['migration_database'] = 'CONFIG_PARITY' if migration == current else 'CONFIG_MISMATCH'
            # A configured URL or matching database never proves the actual
            # dedicated principal/DDL privilege. No runtime credential is reused.
        report['compose'] = 'MATCH' if len(identities) == 2 and all(value[1][3] for value in identities.values()) else 'NOT_PROVEN'
        report['model_sha256'] = hashlib.sha256(json.dumps(model, sort_keys=True).encode()).hexdigest()
        try:
            docker_directory = command(['docker', 'info', '--format', '{{.DockerRootDir}}'], 4096)
            if not Path(docker_directory).is_absolute():
                raise ValueError()
            space = os.statvfs(docker_directory)
            temporary = os.statvfs(tempfile.gettempdir())
            report.update(capacity='MEASURED', docker_available_kib=space.f_bavail * space.f_frsize // 1024,
                          docker_available_inodes=space.f_favail,
                          temporary_available_kib=temporary.f_bavail * temporary.f_frsize // 1024)
        except Exception:
            pass
        try:
            volumes = command(['docker', 'volume', 'ls', '-q'], 65536).splitlines()
            if len(volumes) > 4096 or any(not re.fullmatch('[A-Za-z0-9][A-Za-z0-9_.-]{0,255}', v) for v in volumes):
                raise ValueError()
            report['observed_volume_count'] = len(set(volumes))
            report['observed_volume_set_sha256'] = hashlib.sha256('\n'.join(sorted(set(volumes))).encode()).hexdigest()
        except Exception:
            pass
        try:
            backup = selector('PC_PROD_BACKUP_EVIDENCE_FILE_B64') or selector('PC_BACKUP_EVIDENCE_FILE_B64')
            if backup and Path(backup).is_absolute():
                with open(backup, 'rb', opener=lambda p, flags: os.open(p, flags | os.O_NOFOLLOW)) as f:
                    info = os.fstat(f.fileno())
                    if stat.S_ISREG(info.st_mode) and info.st_uid == 0 and stat.S_IMODE(info.st_mode) in (0o400, 0o440, 0o600, 0o640) and info.st_size > 0:
                        report['backup_metadata'] = 'PRESENT_PRIVATE'
            # Metadata does not establish freshness, DB linkage, restore/integrity
            # or a preserved19-volume baseline. Those remain NOT_PROVEN/HOLD.
        except Exception:
            pass
        # Only sealed configuration bytes and observed Engine identities are covered.
        # Implicit .env/service env_file values were never read or claimed stable.
        stable = all(selected_file(x) == raw for x, raw in before.items())
        stable = stable and decode(command(config_command).encode()) == model
        for role, (identifier, value) in identities.items():
            stable = stable and command(['docker', 'ps', '--all', '--no-trunc', '-q', '--filter', 'label=com.docker.compose.project=' + project, '--filter', 'label=com.docker.compose.service=' + role], 65536).splitlines() == [identifier] and container(identifier, project, role) == value
        report['input_stability'] = ('UNCHANGED' if stable else 'CHANGED') if runtime_error == 'NONE' else 'NOT_PROVEN'
        report['observation'] = 'COMPLETE' if stable and runtime_error == 'NONE' else 'INCOMPLETE'
        report['reject_reason'] = runtime_error if runtime_error != 'NONE' else 'NONE' if stable else 'INPUTS_CHANGED'
except Exception as error:
    allowed = {'READ_FAILED', 'SELECTOR_INVALID', 'COMPOSE_INPUT_INVALID', 'PROJECT_AMBIGUOUS',
               'PROJECT_MISMATCH', 'RUNTIME_INVALID', 'RUNTIME_AMBIGUOUS', 'INPUTS_CHANGED'}
    if isinstance(error, SnapshotCleanupError):
        report['private_cleanup'] = 'NOT_PROVEN'
    code = str(error)
    report['reject_reason'] = code if code in allowed else 'READ_FAILED'
signal.setitimer(signal.ITIMER_REAL, 0)
print(json.dumps(report, separators=(',', ':'), sort_keys=True))
PY_MIGRATION_AUTHORITY_AUDIT
  exit 0
fi

resolve_compose_authority
[[ -d "$prod_dir" ]] || fail PRODUCTION_DIRECTORY_INVALID 12

resolve_auth_opaque_token_env_file() {
  auth_opaque_token_env_file="${PC_AUTH_OPAQUE_TOKEN_ENV_FILE:-$prod_dir/.pc-auth-opaque-token.env}"
  [[ "$auth_opaque_token_env_file" == "$prod_dir"/* ]] || fail AUTH_OPAQUE_TOKEN_ENV_FILE_OUTSIDE_PRODUCTION_DIRECTORY 17
  [[ -f "$auth_opaque_token_env_file" && ! -L "$auth_opaque_token_env_file" ]] || fail AUTH_OPAQUE_TOKEN_ENV_FILE_MISSING 18
  [[ "$(stat -c '%a:%u:%g' "$auth_opaque_token_env_file")" == '600:0:0' ]] || fail AUTH_OPAQUE_TOKEN_ENV_FILE_PERMISSIONS_INVALID 19
  python3 - "$auth_opaque_token_env_file" <<'PY' || fail AUTH_OPAQUE_TOKEN_ENV_FILE_CONTENT_INVALID 22
import hashlib
import hmac
import re
import sys

raw = open(sys.argv[1], 'rb').read()
if not raw.endswith(b'\n') or b'\r' in raw or b'\0' in raw:
    raise SystemExit(1)
try:
    lines = raw[:-1].decode('ascii').split('\n')
except UnicodeDecodeError:
    raise SystemExit(1)
if len(lines) != 2:
    raise SystemExit(1)
opaque_match = re.fullmatch(r'AUTH_OPAQUE_TOKEN_DIGEST_KEY=([A-Fa-f0-9]{64,})', lines[0])
pepper_match = re.fullmatch(r'AUTH_TOKEN_PEPPER=([a-f0-9]{64})', lines[1])
if not opaque_match or not pepper_match:
    raise SystemExit(1)
expected = hmac.new(
    opaque_match.group(1).encode('ascii'),
    b'pc-auth-generic-hash-pepper:v1',
    hashlib.sha256,
).hexdigest()
if not hmac.compare_digest(pepper_match.group(1), expected):
    raise SystemExit(1)
PY
}

resolve_auth_opaque_token_env_file

resolve_staff_database_env_file() {
  staff_database_env_file="${PC_STAFF_DATABASE_ENV_FILE:-$prod_dir/.pc-staff-database.env}"
  [[ "$staff_database_env_file" == "$prod_dir"/* ]] || fail STAFF_DATABASE_ENV_FILE_OUTSIDE_PRODUCTION_DIRECTORY 52
  [[ -f "$staff_database_env_file" && ! -L "$staff_database_env_file" ]] || fail STAFF_DATABASE_ENV_FILE_MISSING 53
  [[ "$(stat -c '%a:%u:%g' "$staff_database_env_file")" == '600:0:0' ]] || fail STAFF_DATABASE_ENV_FILE_PERMISSIONS_INVALID 54
  [[ "$(wc -l < "$staff_database_env_file" | tr -d '[:space:]')" == 1 ]] || fail STAFF_DATABASE_ENV_FILE_CONTENT_INVALID 55
  python3 - "$staff_database_env_file" <<'PY' || fail STAFF_DATABASE_ENV_FILE_CONTENT_INVALID 56
import sys
from urllib.parse import urlsplit

line = open(sys.argv[1], encoding='utf-8').read().rstrip('\n')
if not line.startswith('STAFF_DATABASE_URL='):
    raise SystemExit(1)
url = urlsplit(line.split('=', 1)[1])
if url.scheme not in ('postgresql', 'postgres') or url.username != 'pc_staff_runtime' or not url.password or not url.hostname or not url.path.strip('/'):
    raise SystemExit(1)
PY
}

resolve_staff_database_env_file

resolve_password_reset_runtime_env_files() {
  password_reset_delivery_env_file="${PC_PASSWORD_RESET_DELIVERY_ENV_FILE:-$prod_dir/.pc-password-reset-delivery.env}"
  transactional_mail_env_file="${PC_TRANSACTIONAL_MAIL_ENV_FILE:-$prod_dir/.pc-transactional-mail.env}"
  [[ "$password_reset_delivery_env_file" == "$prod_dir"/* ]] || fail PASSWORD_RESET_DELIVERY_ENV_FILE_OUTSIDE_PRODUCTION_DIRECTORY 59
  [[ "$transactional_mail_env_file" == "$prod_dir"/* ]] || fail TRANSACTIONAL_MAIL_ENV_FILE_OUTSIDE_PRODUCTION_DIRECTORY 60
  [[ -f "$password_reset_delivery_env_file" && ! -L "$password_reset_delivery_env_file" ]] || fail PASSWORD_RESET_DELIVERY_ENV_FILE_MISSING 61
  [[ -f "$transactional_mail_env_file" && ! -L "$transactional_mail_env_file" ]] || fail TRANSACTIONAL_MAIL_ENV_FILE_MISSING 62
  [[ "$(stat -c '%a:%u:%g' "$password_reset_delivery_env_file")" == '600:0:0' ]] || fail PASSWORD_RESET_DELIVERY_ENV_FILE_PERMISSIONS_INVALID 63
  [[ "$(stat -c '%a:%u:%g' "$transactional_mail_env_file")" == '600:0:0' ]] || fail TRANSACTIONAL_MAIL_ENV_FILE_PERMISSIONS_INVALID 64
  python3 - "$password_reset_delivery_env_file" <<'PY' || fail PASSWORD_RESET_DELIVERY_ENV_FILE_CONTENT_INVALID 65
import re
import sys

raw = open(sys.argv[1], encoding='utf-8').read()
if not raw.endswith('\n') or '\r' in raw or '\0' in raw:
    raise SystemExit(1)
lines = raw.rstrip('\n').split('\n')
if len(lines) != 2:
    raise SystemExit(1)
values = {}
for line in lines:
    name, separator, value = line.partition('=')
    if not separator or name in values or not re.fullmatch(r'[A-Fa-f0-9]{96}', value):
        raise SystemExit(1)
    values[name] = value
if set(values) != {'PASSWORD_RESET_DELIVERY_KEY', 'REGISTRATION_DELIVERY_KEY'}:
    raise SystemExit(1)
if values['PASSWORD_RESET_DELIVERY_KEY'] == values['REGISTRATION_DELIVERY_KEY']:
    raise SystemExit(1)
PY
  python3 - "$transactional_mail_env_file" <<'PY' || fail TRANSACTIONAL_MAIL_ENV_FILE_CONTENT_INVALID 66
import re
import sys

raw = open(sys.argv[1], encoding='utf-8').read()
if not raw.endswith('\n') or '\r' in raw or '\0' in raw:
    raise SystemExit(1)
lines = raw.rstrip('\n').split('\n')
if not 2 <= len(lines) <= 5:
    raise SystemExit(1)
values = {}
for line in lines:
    name, separator, value = line.partition('=')
    if not separator or name in values or not value or value != value.strip():
        raise SystemExit(1)
    if not re.fullmatch(r'[A-Z][A-Z0-9_]*', name):
        raise SystemExit(1)
    if any(ord(char) < 33 or ord(char) > 126 for char in value) or any(char in value for char in "#'\"\\"):
        raise SystemExit(1)
    values[name] = value
email = re.compile(r'^[^@\s]{1,64}@[^@\s]{1,189}$')
if set(values) == {'RESEND_API_KEY', 'RESEND_FROM_EMAIL'}:
    if len(values['RESEND_API_KEY']) < 20 or len(values['RESEND_API_KEY']) > 512 or not email.fullmatch(values['RESEND_FROM_EMAIL']):
        raise SystemExit(1)
    raise SystemExit(0)
required = {'PC_SMTP_HOST', 'PC_SMTP_USER', 'PC_SMTP_PASS'}
allowed = required | {'PC_SMTP_PORT', 'PC_MAIL_FROM'}
if not required.issubset(values) or not set(values).issubset(allowed):
    raise SystemExit(1)
if not re.fullmatch(r'[A-Za-z0-9.-]{1,253}', values['PC_SMTP_HOST']):
    raise SystemExit(1)
if len(values['PC_SMTP_USER']) > 254 or len(values['PC_SMTP_PASS']) > 512:
    raise SystemExit(1)
port = values.get('PC_SMTP_PORT', '465')
sender = values.get('PC_MAIL_FROM', values['PC_SMTP_USER'])
if not port.isdigit() or not 1 <= int(port) <= 65535 or not email.fullmatch(sender):
    raise SystemExit(1)
PY
}

resolve_gekta_runtime_env_files() {
  gekta_api_runtime_env_file="${PC_GEKTA_API_RUNTIME_ENV_FILE:-$prod_dir/.pc-gekta-api-runtime.env}"
  gekta_web_runtime_env_file="${PC_GEKTA_WEB_RUNTIME_ENV_FILE:-$prod_dir/.pc-gekta-web-runtime.env}"
  [[ "$gekta_api_runtime_env_file" == "$prod_dir"/* ]] || fail GEKTA_API_RUNTIME_ENV_FILE_OUTSIDE_PRODUCTION_DIRECTORY 68
  [[ "$gekta_web_runtime_env_file" == "$prod_dir"/* ]] || fail GEKTA_WEB_RUNTIME_ENV_FILE_OUTSIDE_PRODUCTION_DIRECTORY 69
  [[ -f "$gekta_api_runtime_env_file" && ! -L "$gekta_api_runtime_env_file" ]] || fail GEKTA_API_RUNTIME_ENV_FILE_MISSING 70
  [[ -f "$gekta_web_runtime_env_file" && ! -L "$gekta_web_runtime_env_file" ]] || fail GEKTA_WEB_RUNTIME_ENV_FILE_MISSING 71
  [[ "$(stat -c '%a:%u:%g' "$gekta_api_runtime_env_file")" == '600:0:0' ]] || fail GEKTA_API_RUNTIME_ENV_FILE_PERMISSIONS_INVALID 72
  [[ "$(stat -c '%a:%u:%g' "$gekta_web_runtime_env_file")" == '600:0:0' ]] || fail GEKTA_WEB_RUNTIME_ENV_FILE_PERMISSIONS_INVALID 73
  python3 - "$gekta_api_runtime_env_file" <<'PY' || fail GEKTA_API_RUNTIME_ENV_FILE_CONTENT_INVALID 74
import re
import sys

raw = open(sys.argv[1], encoding='utf-8').read()
if not raw.endswith('\n') or '\r' in raw or '\0' in raw:
    raise SystemExit(1)
lines = raw.rstrip('\n').split('\n')
if len(lines) != 2:
    raise SystemExit(1)
values = {}
for line in lines:
    name, separator, value = line.partition('=')
    if not separator or name in values:
        raise SystemExit(1)
    values[name] = value
if set(values) != {'GEKTA_PHONE_ENCRYPTION_KEY', 'GEKTA_PHONE_LOOKUP_PEPPER'}:
    raise SystemExit(1)
if not re.fullmatch(r'[A-Fa-f0-9]{64}', values['GEKTA_PHONE_ENCRYPTION_KEY']):
    raise SystemExit(1)
if not re.fullmatch(r'[A-Fa-f0-9]{96}', values['GEKTA_PHONE_LOOKUP_PEPPER']):
    raise SystemExit(1)
PY
  python3 - "$gekta_web_runtime_env_file" <<'PY' || fail GEKTA_WEB_RUNTIME_ENV_FILE_CONTENT_INVALID 75
import re
import sys

raw = open(sys.argv[1], encoding='utf-8').read()
if not raw.endswith('\n') or '\r' in raw or '\0' in raw:
    raise SystemExit(1)
lines = raw.rstrip('\n').split('\n')
if len(lines) != 2:
    raise SystemExit(1)
values = {}
for line in lines:
    name, separator, value = line.partition('=')
    if not separator or name in values or not re.fullmatch(r'[A-Fa-f0-9]{96}', value):
        raise SystemExit(1)
    values[name] = value
if set(values) != {'MFA_LOGIN_TICKET_SECRET', 'GEKTA_ANONYMOUS_SESSION_SECRET'}:
    raise SystemExit(1)
if values['MFA_LOGIN_TICKET_SECRET'] == values['GEKTA_ANONYMOUS_SESSION_SECRET']:
    raise SystemExit(1)
PY
  python3 - "$gekta_api_runtime_env_file" "$gekta_web_runtime_env_file" <<'PY' || fail GEKTA_RUNTIME_PURPOSE_SEPARATION_INVALID 76
import sys

def values(path):
    return dict(line.split('=', 1) for line in open(path, encoding='utf-8').read().rstrip('\n').split('\n'))

api = values(sys.argv[1])
web = values(sys.argv[2])
purpose_secrets = {
    api['GEKTA_PHONE_LOOKUP_PEPPER'],
    web['MFA_LOGIN_TICKET_SECRET'],
    web['GEKTA_ANONYMOUS_SESSION_SECRET'],
}
if len(purpose_secrets) != 3:
    raise SystemExit(1)
PY
}

if [[ "$ACTION" == deploy ]]; then
  resolve_password_reset_runtime_env_files
  resolve_gekta_runtime_env_files
fi

IFS=',' read -r -a raw_files <<< "$prod_compose"
compose_files=()
full_override="$prod_dir/compose.production-full-stack-image.override.yml"
for raw in "${raw_files[@]}"; do
  file="$(trim "$raw")"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$prod_dir/$file"
  [[ -f "$file" ]] || fail PROTECTED_COMPOSE_FILE_MISSING 13
  [[ "$file" == "$full_override" ]] || compose_files+=("$file")
done
(( ${#compose_files[@]} >= 1 )) || fail COMPOSE_AUTHORITY_EMPTY 14

dc=(docker compose --project-directory "$prod_dir")
[[ -z "$prod_project" ]] || dc+=(--project-name "$prod_project")
for file in "${compose_files[@]}"; do dc+=(-f "$file"); done

compose_json="$(mktemp)"
"${dc[@]}" config --format json > "$compose_json"
service_inventory="$(python3 - "$compose_json" <<'PY'
import json, re, sys
cfg = json.load(open(sys.argv[1], encoding='utf-8'))
services = cfg.get('services') or {}
for required in ('api', 'web'):
    if required not in services:
        raise SystemExit(f'MISSING:{required}')
candidates = []
postgres = []
for name, service in services.items():
    image = str(service.get('image') or '')
    command = service.get('command')
    command = ' '.join(command) if isinstance(command, list) else str(command or '')
    if re.search(r'(^|[-_])(migrate|migration)([-_]|$)', name, re.I) or 'grainflow-migration' in image or ('prisma' in command and 'migrate' in command):
        candidates.append(name)
    if image.startswith('postgres:') or '/postgres:' in image:
        postgres.append(name)
if len(candidates) != 1:
    raise SystemExit(f'MIGRATION_COUNT:{len(candidates)}')
print(candidates[0])
print(postgres[0] if len(postgres) == 1 else '')
PY
)" || fail COMPOSE_SERVICE_DISCOVERY_FAILED 15
migration_service="$(printf '%s\n' "$service_inventory" | sed -n '1p')"
postgres_service="$(printf '%s\n' "$service_inventory" | sed -n '2p')"
rm -f "$compose_json"

compose_id() { "${dc[@]}" ps -q "$1" | head -1; }
api_id="$(compose_id api)"
web_id="$(compose_id web)"
[[ -n "$api_id" && -n "$web_id" ]] || fail TARGET_RUNTIME_MISSING 16
api_runtime_network_name=""
api_runtime_proxy_cidrs=""
resolve_api_runtime_network_authority() {
  local -a network_names
  local network_ipam
  mapfile -t network_names < <(docker inspect --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$api_id" | sed '/^[[:space:]]*$/d' | sort -u)
  (( ${#network_names[@]} == 1 )) || fail API_RUNTIME_NETWORK_CARDINALITY_INVALID 125
  api_runtime_network_name="${network_names[0]}"
  [[ "$api_runtime_network_name" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$ ]] || fail API_RUNTIME_NETWORK_NAME_INVALID 126
  network_ipam="$(docker network inspect --format '{{json .IPAM.Config}}' "$api_runtime_network_name" 2>/dev/null)" || fail API_RUNTIME_NETWORK_NOT_FOUND 127
  api_runtime_proxy_cidrs="$(python3 - "$network_ipam" <<'PY'
import ipaddress
import json
import sys

rows = json.loads(sys.argv[1])
if not isinstance(rows, list) or not 1 <= len(rows) <= 4:
    raise SystemExit(1)
private_v4 = tuple(ipaddress.ip_network(value) for value in ('10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'))
private_v6 = ipaddress.ip_network('fc00::/7')
cidrs = []
for row in rows:
    if not isinstance(row, dict) or not isinstance(row.get('Subnet'), str):
        raise SystemExit(1)
    network = ipaddress.ip_network(row['Subnet'], strict=False)
    if network.prefixlen == 0:
        raise SystemExit(1)
    if network.version == 4:
        if not any(network.subnet_of(parent) for parent in private_v4):
            raise SystemExit(1)
    elif not network.subnet_of(private_v6):
        raise SystemExit(1)
    cidrs.append(network.with_prefixlen)
if len(set(cidrs)) != len(cidrs):
    raise SystemExit(1)
print(','.join(cidrs))
PY
)" || fail API_RUNTIME_PROXY_CIDR_INVALID 129
  [[ -n "$api_runtime_proxy_cidrs" ]] || fail API_RUNTIME_PROXY_CIDR_INVALID 129
}
if [[ "$ACTION" == deploy || "$ACTION" == rollback ]]; then
  resolve_api_runtime_network_authority
fi
baseline_api_image="$(docker inspect --format '{{.Config.Image}}' "$api_id")"
baseline_web_image="$(docker inspect --format '{{.Config.Image}}' "$web_id")"
baseline_api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
baseline_web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"

# These helpers return failures to their caller. Only the outer release flow
# may invoke fail/rollback; a command-substitution subshell must not roll back.
runtime_isolation_error() {
  printf 'ERROR_CODE=%s\n' "$1" >&2
  return 1
}

validate_container_ids() {
  local ids="$1" allow_empty="${2:-0}" id
  local -A seen=()
  if [[ -z "$ids" ]]; then
    [[ "$allow_empty" == 1 ]] && return 0
    runtime_isolation_error TARGET_CONTAINER_MISSING; return 1
  fi
  while IFS= read -r id; do
    [[ "$id" =~ ^[0-9a-f]{64}$ ]] || { runtime_isolation_error CONTAINER_ID_INVALID; return 1; }
    [[ ! -v "seen[$id]" ]] || { runtime_isolation_error CONTAINER_ID_DUPLICATED; return 1; }
    seen[$id]=1
  done <<< "$ids"
}

resolve_release_runtime_project() {
  local api_project web_project
  api_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$api_id" 2>/dev/null)" || { runtime_isolation_error TARGET_PROJECT_UNREADABLE; return 1; }
  web_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id" 2>/dev/null)" || { runtime_isolation_error TARGET_PROJECT_UNREADABLE; return 1; }
  [[ "$api_project" =~ ^[a-z0-9][a-z0-9_-]*$ && "$api_project" == "$web_project" ]] || { runtime_isolation_error TARGET_PROJECT_MISMATCH; return 1; }
  [[ -z "$prod_project" || "$prod_project" == "$api_project" ]] || { runtime_isolation_error TARGET_PROJECT_MISMATCH; return 1; }
  runtime_project="$api_project"
}

verify_release_container() {
  local id="$1" service="$2" identity
  identity="$(docker inspect --format '{{.Id}} {{ index .Config.Labels "com.docker.compose.project" }} {{ index .Config.Labels "com.docker.compose.service" }}' "$id" 2>/dev/null)" || { runtime_isolation_error TARGET_IDENTITY_UNREADABLE; return 1; }
  [[ "$identity" == "$id $runtime_project $service" ]] || { runtime_isolation_error TARGET_IDENTITY_MISMATCH; return 1; }
}

release_service_id() {
  local service="$1" id
  id="$("${dc[@]}" ps -q "$service" 2>/dev/null)" || { runtime_isolation_error TARGET_DISCOVERY_FAILED; return 1; }
  validate_container_ids "$id" || return 1
  [[ "$id" != *$'\n'* ]] || { runtime_isolation_error TARGET_RUNTIME_AMBIGUOUS; return 1; }
  verify_release_container "$id" "$service" || return 1
  printf '%s\n' "$id"
}

release_watchtower_ids() {
  local ids id
  ids="$(docker ps -aq --no-trunc --filter "label=com.docker.compose.project=$runtime_project" --filter 'label=com.docker.compose.service=watchtower' 2>/dev/null)" || { runtime_isolation_error WATCHTOWER_DISCOVERY_FAILED; return 1; }
  validate_container_ids "$ids" 1 || return 1
  [[ -n "$ids" ]] || return 0
  while IFS= read -r id; do
    verify_release_container "$id" watchtower || return 1
  done <<< "$ids"
  printf '%s\n' "$ids" | LC_ALL=C sort
}

optional_release_service_id() {
  local service="$1" ids id
  ids="$(docker ps -aq --no-trunc --filter "label=com.docker.compose.project=$runtime_project" --filter "label=com.docker.compose.service=$service" 2>/dev/null)" || { runtime_isolation_error TARGET_DISCOVERY_FAILED; return 1; }
  validate_container_ids "$ids" 1 || return 1
  [[ "$ids" != *$'\n'* ]] || { runtime_isolation_error TARGET_RUNTIME_AMBIGUOUS; return 1; }
  [[ -n "$ids" ]] || return 0
  id="$ids"
  verify_release_container "$id" "$service" || return 1
  printf '%s\n' "$id"
}

snapshot_unrelated() {
  local output="$1" require_retired="${2:-0}" all_ids target_api target_web target_worker target_broker watchtower_ids id
  local -A targets=() running=()
  [[ "$require_retired" =~ ^[01]$ ]] || { runtime_isolation_error SNAPSHOT_MODE_INVALID; return 1; }
  all_ids="$(docker ps -q --no-trunc 2>/dev/null)" || { runtime_isolation_error RUNTIME_SNAPSHOT_FAILED; return 1; }
  validate_container_ids "$all_ids" || return 1
  target_api="$(release_service_id api)" || return 1
  target_web="$(release_service_id web)" || return 1
  target_worker="$(optional_release_service_id "$OUTBOX_SERVICE")" || return 1
  target_broker="$(optional_release_service_id "$KAFKA_SERVICE")" || return 1
  [[ "$target_api" != "$target_web" ]] || { runtime_isolation_error TARGET_IDENTITY_MISMATCH; return 1; }
  while IFS= read -r id; do running[$id]=1; done <<< "$all_ids"
  [[ -v "running[$target_api]" && -v "running[$target_web]" ]] || { runtime_isolation_error TARGET_SNAPSHOT_CHANGED; return 1; }
  targets[$target_api]=1; targets[$target_web]=1
  [[ -z "$target_worker" ]] || targets[$target_worker]=1
  [[ -z "$target_broker" ]] || targets[$target_broker]=1
  watchtower_ids="$(release_watchtower_ids)" || return 1
  if [[ -n "$watchtower_ids" ]]; then
    while IFS= read -r id; do
      if [[ "$require_retired" == 1 && -v "running[$id]" ]]; then runtime_isolation_error WATCHTOWER_RUNNING_AFTER_RETIREMENT; return 1; fi
      targets[$id]=1
    done <<< "$watchtower_ids"
  fi
  if [[ "$require_retired" == 1 ]]; then verify_watchtower_retirement "$watchtower_ids" || return 1; fi
  {
    while IFS= read -r id; do [[ -v "targets[$id]" ]] || printf '%s\n' "$id"; done <<< "$all_ids"
  } | LC_ALL=C sort > "$output"
}

verify_watchtower_retirement() {
  local ids="$1" id state
  [[ -n "$ids" ]] || return 0
  while IFS= read -r id; do
    state="$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}} {{.State.Running}}' "$id" 2>/dev/null)" || { runtime_isolation_error WATCHTOWER_STATE_UNREADABLE; return 1; }
    [[ "$state" == 'no false' ]] || { runtime_isolation_error WATCHTOWER_NOT_RETIRED; return 1; }
  done <<< "$ids"
}

retire_release_watchtower() {
  local ids after_ids id
  ids="$(release_watchtower_ids)" || return 1
  if [[ -n "$ids" ]]; then
    while IFS= read -r id; do
      docker update --restart=no "$id" >/dev/null 2>&1 || { runtime_isolation_error WATCHTOWER_UPDATE_FAILED; return 1; }
      docker stop "$id" >/dev/null 2>&1 || { runtime_isolation_error WATCHTOWER_STOP_FAILED; return 1; }
    done <<< "$ids"
  fi
  after_ids="$(release_watchtower_ids)" || return 1
  [[ "$after_ids" == "$ids" ]] || { runtime_isolation_error WATCHTOWER_SET_CHANGED; return 1; }
  verify_watchtower_retirement "$ids"
}

runtime_project=""
resolve_release_runtime_project || fail RUNTIME_PROJECT_VALIDATION_FAILED 78

write_override() {
  local api_image="$1" web_image="$2" migration_image="$3" destination="$4"
  local include_password_reset_runtime="${5:-0}" worker_image="${6:-}" include_ir20="${7:-0}"
  [[ "$include_password_reset_runtime" =~ ^[01]$ ]] || fail PASSWORD_RESET_RUNTIME_OVERRIDE_MODE_INVALID 67
  [[ "$include_ir20" =~ ^[01]$ ]] || fail IR20_RUNTIME_OVERRIDE_MODE_INVALID 84
  [[ -n "$api_runtime_proxy_cidrs" ]] || fail API_RUNTIME_PROXY_CIDR_INVALID 129
  umask 077
  cat > "$destination.tmp" <<YAML
services:
  api:
    image: ${api_image}
    pull_policy: never
    environment:
      OUTBOX_WORKER_ENABLED: "false"
      TRUST_PROXY_MODE: "cidr"
      TRUSTED_PROXY_CIDRS: "$api_runtime_proxy_cidrs"
    env_file:
      - ${auth_opaque_token_env_file}
      - ${staff_database_env_file}
$(if [[ "$include_password_reset_runtime" == 1 ]]; then
  printf '      - %s\n' "${password_reset_delivery_env_file}"
  printf '      - %s\n' "${gekta_api_runtime_env_file}"
fi)
  web:
    image: ${web_image}
    pull_policy: never
$(if [[ "$include_password_reset_runtime" == 1 ]]; then
  printf '    env_file:\n'
  printf '      - %s\n' "${password_reset_delivery_env_file}"
  printf '      - %s\n' "${transactional_mail_env_file}"
  printf '      - %s\n' "${gekta_web_runtime_env_file}"
fi)
  ${migration_service}:
    image: ${migration_image}
    pull_policy: never
YAML
  if [[ "$include_ir20" == 1 ]]; then
    [[ -n "$worker_image" && -n "$outbox_runtime_env_file" ]] || fail IR20_RUNTIME_INPUT_MISSING 85
    cat >> "$destination.tmp" <<YAML
  $KAFKA_SERVICE:
    image: $KAFKA_IMAGE
    pull_policy: never
    restart: unless-stopped
    environment:
      KAFKA_NODE_ID: "1"
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://$KAFKA_SERVICE:9092
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,CONTROLLER:PLAINTEXT
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: "1"
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: "1"
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: "1"
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: "false"
      KAFKA_LOG_DIRS: /var/lib/kafka/data
      CLUSTER_ID: MkU3OEVBNTcwNTJENDM2Qk
      KAFKA_HEAP_OPTS: -Xms256m -Xmx512m
    volumes:
      - pc_ir20_kafka_data:/var/lib/kafka/data
    networks:
      - ir20_api_runtime
    healthcheck:
      test: ["CMD-SHELL", "kafka-topics --bootstrap-server 127.0.0.1:9092 --list >/dev/null 2>&1"]
      interval: 10s
      timeout: 5s
      retries: 30
      start_period: 20s
    security_opt:
      - no-new-privileges:true
  $OUTBOX_SERVICE:
    image: $worker_image
    pull_policy: never
    restart: unless-stopped
    env_file:
      - $outbox_runtime_env_file
    networks:
      - ir20_api_runtime
    depends_on:
      $KAFKA_SERVICE:
        condition: service_healthy
    read_only: true
    tmpfs:
      - /tmp:size=64m,mode=1777
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    stop_grace_period: 90s
    healthcheck:
      test: ["CMD", "/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:3002/ready',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 10s
      timeout: 5s
      retries: 18
      start_period: 10s
volumes:
  pc_ir20_kafka_data:
    name: pc_ir20_kafka_data
networks:
  ir20_api_runtime:
    external: true
    name: $api_runtime_network_name
YAML
  fi
  mv "$destination.tmp" "$destination"
  chmod 0600 "$destination"
}

dc_target=("${dc[@]}" -f "$full_override")

expected_pinned_image_id() {
  case "$1" in
    api) printf '%s\n' "$API_IMAGE_ID" ;;
    web) printf '%s\n' "$WEB_IMAGE_ID" ;;
    migration) printf '%s\n' "$MIGRATION_IMAGE_ID" ;;
    outbox-worker) printf '%s\n' "$OUTBOX_WORKER_IMAGE_ID" ;;
    *) return 1 ;;
  esac
}

verify_image() {
  local component="$1" image="$2" expected_id="${3:-}" actual_id revision expected_ref
  if [[ "$EXACT_IMAGE_SOURCE" == registry ]]; then
    [[ -f "$IMAGE_BINDING_VERIFIER" ]] || fail IMAGE_BINDING_VERIFIER_MISSING 81
    python3 "$IMAGE_BINDING_VERIFIER" pull-verify "$component" "$TARGET_SHA" "$image" >/dev/null 2>&1 || fail IMAGE_BINDING_FAILED 20
    return
  fi
  expected_ref="pc-crop-transfer/$component:$TARGET_SHA"
  [[ "$image" == "$expected_ref" ]] || fail PRELOADED_IMAGE_REFERENCE_INVALID 131
  [[ "$expected_id" =~ ^sha256:[0-9a-f]{64}$ ]] || fail PRELOADED_IMAGE_ID_REQUIRED 132
  actual_id="$(docker image inspect --format '{{.Id}}' "$image" 2>/dev/null || true)"
  revision="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$image" 2>/dev/null || true)"
  [[ "$actual_id" == "$expected_id" ]] || fail PRELOADED_IMAGE_ID_MISMATCH 133
  [[ "$revision" == "$TARGET_SHA" ]] || fail IMAGE_REVISION_MISMATCH 20
}

verify_runtime_image() {
  local component="$1" image="$2" container_id="$3" expected_id actual_id container_image_id configured_ref revision state
  if [[ "$EXACT_IMAGE_SOURCE" == registry ]]; then
    [[ -f "$IMAGE_BINDING_VERIFIER" ]] || return 1
    python3 "$IMAGE_BINDING_VERIFIER" runtime "$component" "$TARGET_SHA" "$image" "$container_id" 2>/dev/null
    return
  fi
  [[ "$image" == "pc-crop-transfer/$component:$TARGET_SHA" ]] || return 1
  expected_id="$(expected_pinned_image_id "$component")" || return 1
  [[ "$expected_id" =~ ^sha256:[0-9a-f]{64}$ ]] || return 1
  actual_id="$(docker image inspect --format '{{.Id}}' "$image" 2>/dev/null || true)"
  container_image_id="$(docker inspect --format '{{.Image}}' "$container_id" 2>/dev/null || true)"
  configured_ref="$(docker inspect --format '{{.Config.Image}}' "$container_id" 2>/dev/null || true)"
  revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$container_id" 2>/dev/null || true)"
  state="$(docker inspect --format '{{.State.Running}}' "$container_id" 2>/dev/null || true)"
  [[ "$actual_id" == "$expected_id" && "$container_image_id" == "$expected_id" ]] || return 1
  [[ "$configured_ref" == "$image" && "$revision" == "$TARGET_SHA" && "$state" == true ]] || return 1
  printf '%s\n' "$TARGET_SHA"
}

verify_local_runtime_revision() {
  local image="$1" container_id="$2" expected_revision="$3" image_id container_image_id configured_ref image_revision container_revision_value state
  is_revision "$expected_revision" || return 1
  image_id="$(docker image inspect --format '{{.Id}}' "$image" 2>/dev/null || true)"
  container_image_id="$(docker inspect --format '{{.Image}}' "$container_id" 2>/dev/null || true)"
  configured_ref="$(docker inspect --format '{{.Config.Image}}' "$container_id" 2>/dev/null || true)"
  image_revision="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$image" 2>/dev/null || true)"
  container_revision_value="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$container_id" 2>/dev/null || true)"
  state="$(docker inspect --format '{{.State.Running}}' "$container_id" 2>/dev/null || true)"
  [[ "$image_id" =~ ^sha256:[0-9a-f]{64}$ && "$container_image_id" == "$image_id" ]] || return 1
  [[ "$configured_ref" == "$image" && "$image_revision" == "$expected_revision" && "$container_revision_value" == "$expected_revision" && "$state" == true ]] || return 1
  printf '%s\n' "$expected_revision"
}

wait_api() {
  local id attempt
  for attempt in $(seq 1 30); do
    id="$("${dc_target[@]}" ps -q api | head -1)"
    if [[ -n "$id" ]] && docker exec "$id" /nodejs/bin/node -e "fetch('http://127.0.0.1:3001/ready',{signal:AbortSignal.timeout(4000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"; then return 0; fi
    sleep 4
  done
  return 1
}

verify_api_auth_hash_keys() {
  local id="$1"
  [[ -n "$id" ]] || return 1
  docker exec -i "$id" /nodejs/bin/node --input-type=commonjs - <<'NODE'
const { createHmac, timingSafeEqual } = require('node:crypto');
const opaque = String(process.env.AUTH_OPAQUE_TOKEN_DIGEST_KEY ?? '').trim();
const pepper = String(process.env.AUTH_TOKEN_PEPPER ?? '').trim();
if (!/^[A-Fa-f0-9]{64,}$/.test(opaque) || !/^[a-f0-9]{64}$/.test(pepper)) process.exit(1);
const expected = createHmac('sha256', opaque).update('pc-auth-generic-hash-pepper:v1', 'utf8').digest();
const actual = Buffer.from(pepper, 'hex');
if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) process.exit(1);
process.stdout.write('API_AUTH_HASH_KEYS=VALID\n');
NODE
}

redact_api_startup_log() {
  sed -E \
    -e 's#([A-Za-z][A-Za-z0-9+.-]*://)[^[:space:]@/]+@#\1[REDACTED]@#g' \
    -e 's#(password|token|secret|authorization|api[_-]?key)([[:space:]]*[:=][[:space:]]*)[^[:space:],;}]+#\1\2[REDACTED]#gI'
}

emit_api_startup_diagnostics() {
  local id state restart_count exit_code oom_killed
  id="$("${dc_target[@]}" ps -q api | head -1)"
  printf 'API_STARTUP_DIAGNOSTICS_BEGIN\n' >&2
  if [[ -z "$id" ]]; then
    printf 'API_STARTUP_CONTAINER=missing\n' >&2
    printf 'API_STARTUP_DIAGNOSTICS_END\n' >&2
    return 0
  fi

  state="$(docker inspect --format '{{.State.Status}}' "$id" 2>/dev/null || true)"
  restart_count="$(docker inspect --format '{{.RestartCount}}' "$id" 2>/dev/null || true)"
  exit_code="$(docker inspect --format '{{.State.ExitCode}}' "$id" 2>/dev/null || true)"
  oom_killed="$(docker inspect --format '{{.State.OOMKilled}}' "$id" 2>/dev/null || true)"
  printf 'API_STARTUP_CONTAINER_STATE=%s\n' "${state:-unknown}" >&2
  printf 'API_STARTUP_RESTART_COUNT=%s\n' "${restart_count:-unknown}" >&2
  printf 'API_STARTUP_EXIT_CODE=%s\n' "${exit_code:-unknown}" >&2
  printf 'API_STARTUP_OOM_KILLED=%s\n' "${oom_killed:-unknown}" >&2
  printf 'API_STARTUP_LOG_TAIL_BEGIN\n' >&2
  docker logs --tail 80 "$id" 2>&1 | redact_api_startup_log >&2 || true
  printf 'API_STARTUP_LOG_TAIL_END\n' >&2
  printf 'API_STARTUP_DIAGNOSTICS_END\n' >&2
}

classify_broker_startup_failure() {
  local id="$1" sample reason=UNKNOWN
  sample="$(docker logs --tail 160 "$id" 2>&1 || true)"
  if grep -Eqi 'InconsistentClusterIdException|cluster[._ -]?id.*(mismatch|does not match)|Expected .*cluster' <<< "$sample"; then
    reason=CLUSTER_ID_MISMATCH
  elif grep -Eqi 'No space left on device|ENOSPC' <<< "$sample"; then
    reason=NO_SPACE_LEFT
  elif grep -Eqi 'Permission denied|AccessDeniedException|EACCES' <<< "$sample"; then
    reason=PERMISSION_DENIED
  elif grep -Eqi 'OutOfMemoryError|Cannot allocate memory|Killed process' <<< "$sample"; then
    reason=MEMORY_EXHAUSTED
  elif grep -Eqi 'Address already in use|BindException' <<< "$sample"; then
    reason=PORT_BIND_CONFLICT
  elif grep -Eqi 'meta\.properties|KRaft|quorum|controller' <<< "$sample"; then
    reason=KRAFT_METADATA_OR_CONTROLLER
  fi
  printf '%s' "$reason"
}

emit_broker_startup_diagnostics() {
  local id state health restart_count exit_code oom_killed reason
  id="$("${dc_target[@]}" ps -aq "$KAFKA_SERVICE" | head -1)"
  printf 'KAFKA_STARTUP_DIAGNOSTICS_BEGIN\n' >&2
  if [[ -z "$id" ]]; then
    printf 'KAFKA_STARTUP_CONTAINER=missing\n' >&2
    printf 'KAFKA_STARTUP_REASON_CLASS=CONTAINER_MISSING\n' >&2
    printf 'KAFKA_STARTUP_LOG_TAIL_BEGIN\nKAFKA_STARTUP_LOG_TAIL_END\n' >&2
    printf 'KAFKA_STARTUP_DIAGNOSTICS_END\n' >&2
    return 0
  fi
  state="$(docker inspect --format '{{.State.Status}}' "$id" 2>/dev/null || true)"
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id" 2>/dev/null || true)"
  restart_count="$(docker inspect --format '{{.RestartCount}}' "$id" 2>/dev/null || true)"
  exit_code="$(docker inspect --format '{{.State.ExitCode}}' "$id" 2>/dev/null || true)"
  oom_killed="$(docker inspect --format '{{.State.OOMKilled}}' "$id" 2>/dev/null || true)"
  reason="$(classify_broker_startup_failure "$id")"
  [[ "$reason" =~ ^(UNKNOWN|CLUSTER_ID_MISMATCH|NO_SPACE_LEFT|PERMISSION_DENIED|MEMORY_EXHAUSTED|PORT_BIND_CONFLICT|KRAFT_METADATA_OR_CONTROLLER)$ ]] || reason=UNKNOWN
  printf 'KAFKA_STARTUP_CONTAINER_STATE=%s\n' "${state:-unknown}" >&2
  printf 'KAFKA_STARTUP_HEALTH=%s\n' "${health:-unknown}" >&2
  printf 'KAFKA_STARTUP_RESTART_COUNT=%s\n' "${restart_count:-unknown}" >&2
  printf 'KAFKA_STARTUP_EXIT_CODE=%s\n' "${exit_code:-unknown}" >&2
  printf 'KAFKA_STARTUP_OOM_KILLED=%s\n' "${oom_killed:-unknown}" >&2
  printf 'KAFKA_STARTUP_REASON_CLASS=%s\n' "$reason" >&2
  printf 'KAFKA_STARTUP_LOG_TAIL_BEGIN\n' >&2
  docker logs --tail 120 "$id" 2>&1 | redact_api_startup_log >&2 || true
  printf 'KAFKA_STARTUP_LOG_TAIL_END\n' >&2
  printf 'KAFKA_STARTUP_DIAGNOSTICS_END\n' >&2
}

recover_broker_once() {
  printf 'IR20_BROKER_RECOVERY=ATTEMPTED\n' >&2
  "${dc_target[@]}" up -d --no-deps --pull never --force-recreate "$KAFKA_SERVICE" || {
    printf 'IR20_BROKER_RECOVERY=FAILED\n' >&2
    return 1
  }
  if wait_broker; then
    printf 'IR20_BROKER_RECOVERY=PASS\n' >&2
    return 0
  fi
  emit_broker_startup_diagnostics
  printf 'IR20_BROKER_RECOVERY=FAILED\n' >&2
  return 1
}

emit_worker_startup_diagnostics() {
  local id state health restart_count exit_code oom_killed
  id="$("${dc_target[@]}" ps -q "$OUTBOX_SERVICE" | head -1)"
  printf 'OUTBOX_WORKER_STARTUP_DIAGNOSTICS_BEGIN\n' >&2
  if [[ -z "$id" ]]; then
    printf 'OUTBOX_WORKER_STARTUP_CONTAINER=missing\n' >&2
    printf 'OUTBOX_WORKER_STARTUP_DIAGNOSTICS_END\n' >&2
    return 0
  fi

  state="$(docker inspect --format '{{.State.Status}}' "$id" 2>/dev/null || true)"
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id" 2>/dev/null || true)"
  restart_count="$(docker inspect --format '{{.RestartCount}}' "$id" 2>/dev/null || true)"
  exit_code="$(docker inspect --format '{{.State.ExitCode}}' "$id" 2>/dev/null || true)"
  oom_killed="$(docker inspect --format '{{.State.OOMKilled}}' "$id" 2>/dev/null || true)"
  printf 'OUTBOX_WORKER_STARTUP_CONTAINER_STATE=%s\n' "${state:-unknown}" >&2
  printf 'OUTBOX_WORKER_STARTUP_HEALTH=%s\n' "${health:-unknown}" >&2
  printf 'OUTBOX_WORKER_STARTUP_RESTART_COUNT=%s\n' "${restart_count:-unknown}" >&2
  printf 'OUTBOX_WORKER_STARTUP_EXIT_CODE=%s\n' "${exit_code:-unknown}" >&2
  printf 'OUTBOX_WORKER_STARTUP_OOM_KILLED=%s\n' "${oom_killed:-unknown}" >&2
  printf 'OUTBOX_WORKER_READY_BODY_BEGIN\n' >&2
  docker exec "$id" /nodejs/bin/node -e "fetch('http://127.0.0.1:3002/ready',{signal:AbortSignal.timeout(4000)}).then(async r=>{process.stdout.write(await r.text()); process.exit(r.ok?0:1)}).catch(e=>{process.stderr.write(String(e&&e.message||e)); process.exit(1)})" 2>&1 | redact_api_startup_log >&2 || true
  printf '\nOUTBOX_WORKER_READY_BODY_END\n' >&2
  printf 'OUTBOX_WORKER_STARTUP_LOG_TAIL_BEGIN\n' >&2
  docker logs --tail 120 "$id" 2>&1 | redact_api_startup_log >&2 || true
  printf 'OUTBOX_WORKER_STARTUP_LOG_TAIL_END\n' >&2
  printf 'OUTBOX_WORKER_STARTUP_DIAGNOSTICS_END\n' >&2
}

wait_web() {
  local id state attempt
  for attempt in $(seq 1 30); do
    id="$("${dc_target[@]}" ps -q web | head -1)"
    state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || true)"
    [[ "$state" == healthy ]] && return 0
    sleep 4
  done
  return 1
}
wait_broker() {
  local id state attempt
  for attempt in $(seq 1 60); do
    id="$("${dc_target[@]}" ps -q "$KAFKA_SERVICE" | head -1)"
    state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || true)"
    [[ "$state" == healthy ]] && return 0
    sleep 2
  done
  return 1
}

wait_worker() {
  local id state attempt
  for attempt in $(seq 1 60); do
    id="$("${dc_target[@]}" ps -q "$OUTBOX_SERVICE" | head -1)"
    state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || true)"
    if [[ "$state" == healthy ]] && docker exec "$id" /nodejs/bin/node -e "fetch('http://127.0.0.1:3002/ready',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then return 0; fi
    sleep 2
  done
  return 1
}

verify_broker_image() {
  docker pull "$KAFKA_IMAGE" >/dev/null 2>&1 || fail KAFKA_IMAGE_PULL_FAILED 86
  python3 - "$KAFKA_IMAGE" <<'PY' || fail KAFKA_IMAGE_BINDING_FAILED 87
import json,re,subprocess,sys
ref=sys.argv[1]
if not re.fullmatch(r'confluentinc/cp-kafka@sha256:[0-9a-f]{64}',ref): raise SystemExit(1)
p=subprocess.run(['docker','image','inspect',ref],capture_output=True,text=True,timeout=30)
if p.returncode: raise SystemExit(1)
rows=json.loads(p.stdout)
if len(rows)!=1 or ref not in (rows[0].get('RepoDigests') or []): raise SystemExit(1)
PY
}

resolve_outbox_runtime_env_file() {
  outbox_runtime_env_file="${PC_OUTBOX_RUNTIME_ENV_FILE:-$prod_dir/.pc-ir20-outbox-worker.env}"
  [[ "$outbox_runtime_env_file" == "$prod_dir"/* ]] || fail OUTBOX_RUNTIME_ENV_FILE_OUTSIDE_PRODUCTION_DIRECTORY 88
  [[ ! -L "$outbox_runtime_env_file" ]] || fail OUTBOX_RUNTIME_ENV_FILE_SYMLINK 89
  [[ ! -f "$outbox_runtime_env_file" ]] || OUTBOX_RUNTIME_ENV_PREEXISTED=1
}

validate_outbox_runtime_env_file() {
  [[ -f "$outbox_runtime_env_file" && ! -L "$outbox_runtime_env_file" ]] || return 1
  [[ "$(stat -c '%a:%u:%g' "$outbox_runtime_env_file")" == '600:0:0' ]] || return 1
  python3 - "$outbox_runtime_env_file" "$KAFKA_SERVICE" <<'PY'
import re,sys
from urllib.parse import urlsplit
raw=open(sys.argv[1],encoding='utf-8').read()
if not raw.endswith('\n') or '\r' in raw or '\0' in raw: raise SystemExit(1)
pairs={}
for line in raw.rstrip('\n').split('\n'):
    k,sep,v=line.partition('=')
    if not sep or k in pairs or not re.fullmatch(r'[A-Z][A-Z0-9_]*',k): raise SystemExit(1)
    pairs[k]=v
required={'DATABASE_URL','KAFKA_BROKERS','KAFKA_REQUIRED','OUTBOX_WORKER_ENABLED','RUNTIME_COMPONENT','NODE_ENV','OUTBOX_WORKER_HEALTH_PORT','OUTBOX_WORKER_INTERVAL_MS','OUTBOX_WORKER_BATCH_SIZE','OUTBOX_WORKER_HEARTBEAT_MS'}
if set(pairs)!=required: raise SystemExit(1)
u=urlsplit(pairs['DATABASE_URL'])
if u.scheme not in ('postgresql','postgres') or u.username!='app_outbox' or not u.password or not u.hostname or not u.path.strip('/'): raise SystemExit(1)
if pairs['KAFKA_BROKERS']!=sys.argv[2]+':9092' or pairs['KAFKA_REQUIRED']!='true' or pairs['OUTBOX_WORKER_ENABLED']!='true' or pairs['RUNTIME_COMPONENT']!='outbox-worker' or pairs['NODE_ENV']!='production': raise SystemExit(1)
if pairs['OUTBOX_WORKER_HEALTH_PORT']!='3002' or pairs['OUTBOX_WORKER_INTERVAL_MS']!='1000' or pairs['OUTBOX_WORKER_BATCH_SIZE']!='25' or pairs['OUTBOX_WORKER_HEARTBEAT_MS']!='20000': raise SystemExit(1)
PY
}

migration_database_url() {
  local json rc
  json="$(mktemp)"; "${dc[@]}" config --format json > "$json"
  set +e
  python3 - "$json" "$migration_service" <<'PY'
import json,sys
svc=(json.load(open(sys.argv[1],encoding='utf-8')).get('services') or {}).get(sys.argv[2]) or {}
env=svc.get('environment') or {}
if isinstance(env,list): env=dict(x.split('=',1) for x in env if isinstance(x,str) and '=' in x)
v=str(env.get('DATABASE_URL') or '').strip()
if not v or '\n' in v or '\r' in v or '\0' in v: raise SystemExit(1)
print(v)
PY
  rc=$?; set -e; rm -f "$json"; return "$rc"
}

apply_outbox_policy() {
  [[ -n "$OUTBOX_POLICY_FILE" && "$OUTBOX_POLICY_FILE" == /tmp/pc-ir20-outbox-policy-* && -f "$OUTBOX_POLICY_FILE" && ! -L "$OUTBOX_POLICY_FILE" ]] || fail OUTBOX_POLICY_FILE_INVALID 121
  [[ "$(stat -c '%u:%g' "$OUTBOX_POLICY_FILE")" == '0:0' ]] || fail OUTBOX_POLICY_FILE_OWNER_INVALID 122
  "${dc_target[@]}" run --rm --no-deps --pull never -T "$migration_service" node_modules/prisma/build/index.js db execute --stdin --schema prisma/schema.prisma < "$OUTBOX_POLICY_FILE" >/dev/null 2>&1 || fail OUTBOX_POLICY_APPLY_FAILED 123
  printf 'IR20_OUTBOX_POLICY_APPLIED=1\n'
}
provision_outbox_runtime() {
  resolve_outbox_runtime_env_file
  if [[ "$OUTBOX_RUNTIME_ENV_PREEXISTED" == 1 ]]; then
    validate_outbox_runtime_env_file || fail EXISTING_OUTBOX_RUNTIME_ENV_FILE_INVALID 90
  else
    local migration_url password worker_url sql temp
    migration_url="$(migration_database_url)" || fail MIGRATION_DATABASE_URL_UNAVAILABLE_FOR_OUTBOX 91
    password="$(python3 -c 'import secrets; print(secrets.token_hex(48))')"; [[ "$password" =~ ^[A-Fa-f0-9]{96}$ ]] || fail OUTBOX_PASSWORD_GENERATION_FAILED 92
    worker_url="$(printf '%s\0%s' "$migration_url" "$password" | python3 -c '
import sys
from urllib.parse import quote,urlsplit,urlunsplit
source,password=sys.stdin.buffer.read().split(b"\0",1); u=urlsplit(source.decode().strip()); password=password.decode().strip()
if u.scheme not in ("postgresql","postgres") or not u.hostname or not u.path.strip("/") or not u.username or not u.password: raise SystemExit(1)
host=u.hostname
if ":" in host and not host.startswith("["): host="["+host+"]"
if u.port: host=host+":"+str(u.port)
print(urlunsplit((u.scheme,"app_outbox:"+quote(password,safe="")+"@"+host,u.path,u.query,"")))
')" || fail OUTBOX_DATABASE_URL_BUILD_FAILED 93
    sql="$(printf '%s\0' "$password" | python3 -c '
import sys
p=sys.stdin.buffer.read().split(b"\0",1)[0].decode()
if len(p)!=96 or any(c not in "0123456789abcdefABCDEF" for c in p): raise SystemExit(1)
print("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '\''app_outbox'\'') THEN RAISE EXCEPTION '\''app_outbox missing'\''; END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '\''app_outbox'\'' AND (rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN RAISE EXCEPTION '\''app_outbox unsafe'\''; END IF; ALTER ROLE app_outbox LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '\''"+p+"'\''; END $$;")
')" || fail OUTBOX_RUNTIME_SQL_BUILD_FAILED 94
    printf '%s\n' "$sql" | "${dc_target[@]}" run --rm --no-deps --pull never -T "$migration_service" node_modules/prisma/build/index.js db execute --stdin --schema prisma/schema.prisma >/dev/null 2>&1 || fail OUTBOX_RUNTIME_PASSWORD_PROVISION_FAILED 95
    temp="$(mktemp "$prod_dir/.pc-ir20-outbox-worker.env.XXXXXX")"
    {
      printf 'DATABASE_URL=%s\n' "$worker_url"; printf 'KAFKA_BROKERS=%s:9092\n' "$KAFKA_SERVICE"
      printf 'KAFKA_REQUIRED=true\nOUTBOX_WORKER_ENABLED=true\nRUNTIME_COMPONENT=outbox-worker\nNODE_ENV=production\n'
      printf 'OUTBOX_WORKER_HEALTH_PORT=3002\nOUTBOX_WORKER_INTERVAL_MS=1000\nOUTBOX_WORKER_BATCH_SIZE=25\nOUTBOX_WORKER_HEARTBEAT_MS=20000\n'
    } > "$temp"
    chown 0:0 "$temp"; chmod 0600 "$temp"; mv "$temp" "$outbox_runtime_env_file"
    unset migration_url password worker_url sql temp
    validate_outbox_runtime_env_file || fail OUTBOX_RUNTIME_ENV_FILE_VERIFICATION_FAILED 96
  fi
}

worker_node() { "${dc_target[@]}" run --rm --no-deps --pull never -T --entrypoint /nodejs/bin/node "$OUTBOX_SERVICE" - "$@"; }

verify_ir20_runtime_network_parity() {
  local current_api current_worker current_broker
  local -a api_networks worker_networks broker_networks
  current_api="$("${dc_target[@]}" ps -q api | head -1)"
  current_worker="$("${dc_target[@]}" ps -q "$OUTBOX_SERVICE" | head -1)"
  current_broker="$("${dc_target[@]}" ps -q "$KAFKA_SERVICE" | head -1)"
  [[ -n "$current_api" && -n "$current_worker" && -n "$current_broker" ]] || return 1
  mapfile -t api_networks < <(docker inspect --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$current_api" | sed '/^[[:space:]]*$/d' | sort -u)
  mapfile -t worker_networks < <(docker inspect --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$current_worker" | sed '/^[[:space:]]*$/d' | sort -u)
  mapfile -t broker_networks < <(docker inspect --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$current_broker" | sed '/^[[:space:]]*$/d' | sort -u)
  (( ${#api_networks[@]} == 1 && ${#worker_networks[@]} == 1 && ${#broker_networks[@]} == 1 )) || return 1
  [[ "${api_networks[0]}" == "$api_runtime_network_name"     && "${worker_networks[0]}" == "$api_runtime_network_name"     && "${broker_networks[0]}" == "$api_runtime_network_name" ]]
}

worker_principal_smoke() {
  worker_node <<'NODE' >/dev/null 2>&1
const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient();
(async()=>{const rows=await p.$queryRawUnsafe(`
SELECT current_user='app_outbox' AS u,current_setting('row_security')='on' AS rls,r.rolsuper AS su,r.rolbypassrls AS br,r.rolcreatedb AS cdb,r.rolcreaterole AS cr,r.rolreplication AS rep,r.rolinherit AS inh,
has_table_privilege(current_user,'public.outbox_entries','SELECT') AS sel,
has_table_privilege(current_user,'public.outbox_entries','INSERT') OR has_any_column_privilege(current_user,'public.outbox_entries','INSERT') AS ins,
has_table_privilege(current_user,'public.outbox_entries','DELETE') AS del,
has_table_privilege(current_user,'public.deals','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(current_user,'public.deals','SELECT,INSERT,UPDATE,REFERENCES') AS deal,
has_schema_privilege(current_user,'auth','USAGE') AS auth,
(SELECT bool_and(has_column_privilege(current_user,'public.outbox_entries',n,'UPDATE')) FROM unnest(ARRAY['status','retryCount','nextRetryAt','lastError','lastErrorCode','lastErrorCategory','lastAttemptAt','manualReviewAt','sentAt','confirmedAt','failedAt','deadLetterAt','leaseOwner','leaseToken','leaseExpiresAt','heartbeatAt']) n) AS upd FROM pg_roles r WHERE r.rolname=current_user`);
const x=rows[0]; if(!x||!x.u||!x.rls||x.su||x.br||x.cdb||x.cr||x.rep||x.inh||!x.sel||!x.upd||x.ins||x.del||x.deal||x.auth) throw Error('BOUNDARY');
const cat=await p.$queryRawUnsafe(`SELECT c.relrowsecurity AS rls,c.relforcerowsecurity AS force,to_regprocedure('public.outbox_expired_attempt_reclaim_guard()') IS NOT NULL AS fence FROM pg_class c WHERE c.oid=to_regclass('public.outbox_entries')`);
if(cat.length!==1||!cat[0].rls||!cat[0].force||!cat[0].fence) throw Error('CATALOG');
})().catch(()=>process.exitCode=1).finally(()=>p.$disconnect());
NODE
}

ensure_kafka_topics() {
  local id; id="$("${dc_target[@]}" ps -q "$KAFKA_SERVICE" | head -1)"; [[ -n "$id" ]] || return 1
  for topic in grainflow.domain.events grainflow.bank.events; do docker exec "$id" kafka-topics --bootstrap-server 127.0.0.1:9092 --create --if-not-exists --topic "$topic" --partitions 3 --replication-factor 1 >/dev/null 2>&1 || return 1; done
  for topic in grainflow.domain.events grainflow.bank.events; do docker exec "$id" kafka-topics --bootstrap-server 127.0.0.1:9092 --describe --topic "$topic" >/dev/null 2>&1 || return 1; done
}

verify_first_broker_restart_persistence() {
  [[ "$BASELINE_BROKER_PRESENT" == 0 ]] || return 0
  local id before after; id="$("${dc_target[@]}" ps -q "$KAFKA_SERVICE" | head -1)"; [[ -n "$id" ]] || return 1
  before="$(docker exec "$id" kafka-topics --bootstrap-server 127.0.0.1:9092 --list 2>/dev/null | grep -E '^(grainflow\.domain\.events|grainflow\.bank\.events)$' | sort)"
  [[ "$before" == $'grainflow.bank.events\ngrainflow.domain.events' ]] || return 1
  docker restart "$id" >/dev/null; wait_broker || return 1
  id="$("${dc_target[@]}" ps -q "$KAFKA_SERVICE" | head -1)"
  after="$(docker exec "$id" kafka-topics --bootstrap-server 127.0.0.1:9092 --list 2>/dev/null | grep -E '^(grainflow\.domain\.events|grainflow\.bank\.events)$' | sort)"
  [[ "$after" == "$before" ]]
}


is_revision() {
  local revision="$1"
  [[ "${#revision}" == 40 && "$revision" != *[!0123456789abcdef]* ]]
}

# One container's build revision, or a non-zero status if it cannot be read.
container_revision() {
  docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$1"
}

rollback_images() {
  local restored_api_id restored_web_id restored_worker_id worker_id broker_id
  ROLLBACK_API_WEB_COMPLETE=0
  ROLLBACK_IR20_COMPLETE=0
  [[ -f "$STATE_FILE" ]] || return 1
  # shellcheck disable=SC1090
  source "$STATE_FILE"
  is_revision "$BASELINE_API_REVISION" || return 1
  is_revision "$BASELINE_WEB_REVISION" || return 1
  resolve_outbox_runtime_env_file

  if [[ "${BASELINE_WORKER_PRESENT:-0}" == 1 ]]; then
    is_revision "${BASELINE_WORKER_REVISION:-}" || return 1
    write_override "$BASELINE_API_IMAGE" "$BASELINE_WEB_IMAGE" "$MIGRATION_IMAGE" "$full_override" 0 "$BASELINE_WORKER_IMAGE" 1
  else
    write_override "$BASELINE_API_IMAGE" "$BASELINE_WEB_IMAGE" "$MIGRATION_IMAGE" "$full_override"
  fi
  "${dc_target[@]}" config --quiet

  if [[ "$ACTION" == rollback || "${API_WEB_MUTATED:-0}" == 1 ]]; then
    "${dc_target[@]}" up -d --no-deps --pull never api web
    wait_api && wait_web || return 1
  fi

  restored_api_id="$("${dc_target[@]}" ps -q api | head -1)"
  restored_web_id="$("${dc_target[@]}" ps -q web | head -1)"
  [[ -n "$restored_api_id" && -n "$restored_web_id" ]] || return 1
  restored_api_revision="$(container_revision "$restored_api_id")" || return 2
  restored_web_revision="$(container_revision "$restored_web_id")" || return 2
  is_revision "$restored_api_revision" || return 2
  is_revision "$restored_web_revision" || return 2
  [[ "$restored_api_revision" == "$BASELINE_API_REVISION" && "$restored_web_revision" == "$BASELINE_WEB_REVISION" ]] || return 3
  ROLLBACK_API_WEB_COMPLETE=1

  if [[ "${BASELINE_WORKER_PRESENT:-0}" == 1 ]]; then
    "${dc_target[@]}" up -d --no-deps --pull never "$KAFKA_SERVICE"
    if ! wait_broker; then
      emit_broker_startup_diagnostics
      recover_broker_once || return 4
    fi
    "${dc_target[@]}" up -d --no-deps --pull never "$OUTBOX_SERVICE"
    wait_worker || return 1
    restored_worker_id="$("${dc_target[@]}" ps -q "$OUTBOX_SERVICE" | head -1)"
    [[ "$(verify_local_runtime_revision "$BASELINE_WORKER_IMAGE" "$restored_worker_id" "$BASELINE_WORKER_REVISION" 2>/dev/null)" == "$BASELINE_WORKER_REVISION" ]] || return 3
    ROLLBACK_IR20_COMPLETE=1
  else
    worker_id="$(optional_release_service_id "$OUTBOX_SERVICE")" || return 1
    broker_id="$(optional_release_service_id "$KAFKA_SERVICE")" || return 1
    [[ -z "$worker_id" ]] || docker rm -f "$worker_id" >/dev/null 2>&1 || return 1
    [[ -z "$broker_id" ]] || docker rm -f "$broker_id" >/dev/null 2>&1 || return 1
    if [[ "${OUTBOX_RUNTIME_ENV_PREEXISTED:-0}" == 0 && -f "$outbox_runtime_env_file" ]]; then
      printf '%s\n' "ALTER ROLE app_outbox NOLOGIN PASSWORD NULL;" | "${dc_target[@]}" run --rm --no-deps --pull never -T "$migration_service" node_modules/prisma/build/index.js db execute --stdin --schema prisma/schema.prisma >/dev/null 2>&1 || return 1
      rm -f "$outbox_runtime_env_file"
    fi
    ROLLBACK_IR20_COMPLETE=1
  fi
}

rollback_and_exit() {
  local rc="${1:-1}" rollback_status=0
  if [[ "${RELEASE_ROLLBACK_ACTIVE:-0}" == 1 ]]; then
    exit "$rc"
  fi
  RELEASE_ROLLBACK_ACTIVE=1
  trap - ERR
  rollback_images || rollback_status=$?
  printf 'DEPLOYMENT_COMPLETE=0\n' >&2
  printf 'ROLLBACK_ATTEMPTED=1\n' >&2
  printf 'ROLLBACK_API_WEB_COMPLETE=%s\n' "${ROLLBACK_API_WEB_COMPLETE:-0}" >&2
  printf 'ROLLBACK_IR20_COMPLETE=%s\n' "${ROLLBACK_IR20_COMPLETE:-0}" >&2
  if [[ "$rollback_status" == 0 && "${ROLLBACK_API_WEB_COMPLETE:-0}" == 1 && "${ROLLBACK_IR20_COMPLETE:-0}" == 1 ]]; then
    printf 'ROLLBACK_COMPLETE=1\n' >&2
    printf 'ROLLBACK_FAILED=0\n' >&2
    printf 'RESTORED_API_REVISION=%s\n' "${restored_api_revision:-unknown}" >&2
    printf 'RESTORED_WEB_REVISION=%s\n' "${restored_web_revision:-unknown}" >&2
  else
    printf 'ROLLBACK_COMPLETE=0\n' >&2
    printf 'ROLLBACK_FAILED=1\n' >&2
  fi
  exit "$rc"
}

verify_durable_intake_local_postgres() {
  local pg_id sql result audit_id outbox_id
  pg_id="$(compose_id "$postgres_service")"
  [[ -n "$pg_id" ]] || fail POSTGRES_RUNTIME_MISSING 43
  sql="SELECT CASE WHEN count(*) = 1 AND bool_and(a.action = 'public:organization-intake:create' AND a.outcome = 'SUCCESS' AND a.\"correlationId\" = r.\"correlationId\") AND bool_and(o.type = 'PUBLIC_ORGANIZATION_CONNECTION_REQUESTED' AND o.\"correlationId\" = r.\"correlationId\" AND o.\"auditId\" = r.\"auditEventId\" AND NOT (o.payload ?| ARRAY['organizationName','inn','contactName','position','phone','email','payloadHash'])) THEN 'PASS' ELSE 'FAIL' END || '|' || min(r.\"auditEventId\") || '|' || min(r.\"outboxEntryId\") FROM public.public_organization_connection_requests r JOIN public.audit_events a ON a.id = r.\"auditEventId\" JOIN public.outbox_entries o ON o.id = r.\"outboxEntryId\" WHERE r.\"requestNumber\" = '$INTAKE_REQUEST_NUMBER' AND r.\"correlationId\" = '$INTAKE_CORRELATION_ID';"
  result="$(docker exec "$pg_id" sh -ceu 'test -n "${POSTGRES_USER:-}"; test -n "${POSTGRES_DB:-}"; psql -v ON_ERROR_STOP=1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --tuples-only --no-align --command "$1"' sh "$sql" | tr -d '[:space:]')"
  [[ "$result" =~ ^PASS\|audit-[A-Za-z0-9-]+\|outbox-[A-Za-z0-9-]+$ ]] || fail DURABLE_INTAKE_EVIDENCE_FAILED 44
  IFS='|' read -r _ audit_id outbox_id <<< "$result"
  printf 'DURABLE_INTAKE_EVIDENCE_MODE=COMPOSE_POSTGRES_DIRECT_JOIN\n'
  printf 'DURABLE_INTAKE_AUDIT_ID=%s\n' "$audit_id"
  printf 'DURABLE_INTAKE_OUTBOX_ID=%s\n' "$outbox_id"
}

verify_durable_intake_external_postgres() {
  local exact_api_id exact_api_revision result release_prefix release_run_id
  exact_api_id="$(compose_id api)"
  [[ -n "$exact_api_id" ]] || fail API_RUNTIME_MISSING_FOR_DB_EVIDENCE 45
  exact_api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$exact_api_id")"
  [[ "$exact_api_revision" == "$TARGET_SHA" ]] || fail API_DB_EVIDENCE_REVISION_MISMATCH 46

  release_prefix="release-intake:${TARGET_SHA}:"
  [[ "$INTAKE_CORRELATION_ID" == "$release_prefix"* ]] || fail EXTERNAL_POSTGRES_RELEASE_RUN_ID_UNAVAILABLE 47
  release_run_id="${INTAKE_CORRELATION_ID#"$release_prefix"}"
  [[ "$release_run_id" =~ ^[A-Za-z0-9._:-]{1,64}$ ]] || fail EXTERNAL_POSTGRES_RELEASE_RUN_ID_INVALID 48

  result="$(docker exec -i "$exact_api_id" /nodejs/bin/node - "$TARGET_SHA" "$release_run_id" "$INTAKE_REQUEST_NUMBER" "$INTAKE_CORRELATION_ID" <<'NODE'
const { createHash } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

const [targetSha, runId, requestNumber, correlationId] = process.argv.slice(2);
const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
};

if (!/^[0-9a-f]{40}$/.test(targetSha ?? '')
  || !/^[A-Za-z0-9._:-]{1,128}$/.test(runId ?? '')
  || !/^PC-[0-9]{8}-[0-9A-F]{12}$/.test(requestNumber ?? '')
  || !/^[A-Za-z0-9._:-]{8,128}$/.test(correlationId ?? '')) {
  fail('EXTERNAL_POSTGRES_EVIDENCE_INPUT_INVALID');
  process.exit(1);
}

const sha7 = targetSha.slice(0, 7);
const idempotencyKey = `release-intake:${targetSha}:${runId}`;
const request = {
  organizationName: `ООО Системная проверка Прозрачная Цена ${sha7} ${runId}`,
  inn: '7707083893',
  contactName: 'Системный оператор',
  position: 'Release acceptance',
  phone: '+74950000000',
  email: `release-${sha7}-${runId}@procent-agro.test`.toLowerCase(),
  organizationRole: 'PUBLIC_INDUSTRY_PARTNER',
  scenario: 'EXTERNAL_INTEGRATION',
  locale: 'ru',
  consentVersion: 'public-organization-connect-v1',
};
const payloadHash = createHash('sha256').update(JSON.stringify(request)).digest('hex');
const prisma = new PrismaClient();

(async () => {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT request_number, request_status, replay, correlation_id FROM public.lookup_public_organization_connection_request($1, $2)',
    idempotencyKey,
    payloadHash,
  );
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error('EXTERNAL_POSTGRES_REQUEST_LOOKUP_FAILED');
  const row = rows[0];
  if (row.request_number !== requestNumber
    || row.request_status !== 'NEW'
    || row.replay !== true
    || row.correlation_id !== correlationId) {
    throw new Error('EXTERNAL_POSTGRES_REQUEST_EVIDENCE_MISMATCH');
  }

  const constraints = await prisma.$queryRawUnsafe(`
    SELECT
      count(*)::int AS constraint_count,
      bool_and(contype = 'f' AND convalidated AND confdeltype = 'r') AS constraints_valid,
      bool_and(
        (conname = 'public_org_connection_requests_audit_fkey' AND confrelid = 'public.audit_events'::regclass)
        OR
        (conname = 'public_org_connection_requests_outbox_fkey' AND confrelid = 'public.outbox_entries'::regclass)
      ) AS targets_valid
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.public_organization_connection_requests'::regclass
      AND conname IN (
        'public_org_connection_requests_audit_fkey',
        'public_org_connection_requests_outbox_fkey'
      )
  `);
  const constraint = constraints[0];
  if (constraint?.constraint_count !== 2
    || constraint?.constraints_valid !== true
    || constraint?.targets_valid !== true) {
    throw new Error('EXTERNAL_POSTGRES_FK_EVIDENCE_INVALID');
  }

  const attributes = await prisma.$queryRawUnsafe(`
    SELECT count(*)::int AS not_null_count
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.public_organization_connection_requests'::regclass
      AND attname IN ('auditEventId', 'outboxEntryId')
      AND attnotnull
      AND NOT attisdropped
  `);
  if (attributes[0]?.not_null_count !== 2) throw new Error('EXTERNAL_POSTGRES_FK_COLUMNS_NULLABLE');

  process.stdout.write('PASS|REFERENTIAL_INTEGRITY|REFERENTIAL_INTEGRITY\n');
})()
  .catch((error) => {
    process.stderr.write(`${String(error?.message ?? error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
NODE
)" || fail EXTERNAL_POSTGRES_DURABLE_INTAKE_EVIDENCE_FAILED 49

  [[ "$result" == 'PASS|REFERENTIAL_INTEGRITY|REFERENTIAL_INTEGRITY' ]] || fail EXTERNAL_POSTGRES_DURABLE_INTAKE_EVIDENCE_INVALID 51
  printf 'DURABLE_INTAKE_EVIDENCE_MODE=EXTERNAL_POSTGRES_API_SECURITY_DEFINER\n'
  printf 'DURABLE_INTAKE_AUDIT_ID=REFERENTIAL_INTEGRITY_CONFIRMED\n'
  printf 'DURABLE_INTAKE_OUTBOX_ID=REFERENTIAL_INTEGRITY_CONFIRMED\n'
}

verify_durable_intake() {
  [[ "$INTAKE_REQUEST_NUMBER" =~ ^PC-[0-9]{8}-[0-9A-F]{12}$ ]] || fail INTAKE_REQUEST_NUMBER_INVALID 40
  [[ "$INTAKE_CORRELATION_ID" =~ ^[A-Za-z0-9._:-]{8,128}$ ]] || fail INTAKE_CORRELATION_ID_INVALID 41

  if [[ -n "$postgres_service" ]]; then
    verify_durable_intake_local_postgres
  else
    verify_durable_intake_external_postgres
  fi

  printf 'DURABLE_INTAKE_DB=PASS\n'
  verify_live_outbox_delivery
}

verify_live_outbox_delivery() {
  [[ "$INTAKE_CORRELATION_ID" =~ ^[A-Za-z0-9._:-]{8,128}$ ]] || fail LIVE_OUTBOX_CORRELATION_INVALID 98
  worker_node "$INTAKE_CORRELATION_ID" <<'NODE' || fail LIVE_OUTBOX_DELIVERY_FAILED 99
const {PrismaClient}=require('@prisma/client'); const correlation=process.argv[2]; const p=new PrismaClient(); const bad=new Set(['DEAD','DEAD_LETTER','MANUAL_REVIEW']);
(async()=>{const deadline=Date.now()+120000; while(Date.now()<deadline){const rows=await p.$queryRawUnsafe('SELECT status FROM public.outbox_entries WHERE "correlationId"=$1 ORDER BY "createdAt" DESC LIMIT 1',correlation); if(rows.length===1){const s=String(rows[0].status); if(s==='SENT'||s==='CONFIRMED'){process.stdout.write('IR20_LIVE_OUTBOX_DELIVERY=PASS\n');return;} if(bad.has(s)) throw Error('BAD');} await new Promise(r=>setTimeout(r,1000));} throw Error('TIMEOUT');})().catch(()=>process.exitCode=1).finally(()=>p.$disconnect());
NODE
}

if [[ "$ACTION" == verify-intake ]]; then
  verify_durable_intake
  exit 0
fi

if [[ "$ACTION" == observe-ir20 ]]; then
  resolve_outbox_runtime_env_file; validate_outbox_runtime_env_file || fail OUTBOX_RUNTIME_ENV_FILE_INVALID 100
  local_worker="$(optional_release_service_id "$OUTBOX_SERVICE")" || fail IR20_WORKER_DISCOVERY_FAILED 101
  local_broker="$(optional_release_service_id "$KAFKA_SERVICE")" || fail IR20_BROKER_DISCOVERY_FAILED 102
  [[ -n "$local_worker" && -n "$local_broker" ]] || fail IR20_RUNTIME_MISSING 103
  worker_revision="$(verify_runtime_image outbox-worker "$OUTBOX_WORKER_IMAGE" "$local_worker")" || fail IR20_WORKER_IMAGE_BINDING_FAILED 104
  [[ "$worker_revision" == "$TARGET_SHA" ]] || fail IR20_WORKER_REVISION_MISMATCH 105
  initial_worker_restarts="$(docker inspect --format '{{.RestartCount}}' "$local_worker")"; initial_broker_restarts="$(docker inspect --format '{{.RestartCount}}' "$local_broker")"
  [[ "$initial_worker_restarts" =~ ^[0-9]+$ && "$initial_broker_restarts" =~ ^[0-9]+$ ]] || fail IR20_RESTART_COUNTER_INVALID 106
  observation_started_at="$(date +%s)"
  observation_deadline=$((observation_started_at + 1800))
  while true; do
    current_worker="$(optional_release_service_id "$OUTBOX_SERVICE")" || fail IR20_WORKER_DISCOVERY_FAILED 101
    current_broker="$(optional_release_service_id "$KAFKA_SERVICE")" || fail IR20_BROKER_DISCOVERY_FAILED 102
    [[ "$current_worker" == "$local_worker" && "$current_broker" == "$local_broker" ]] || fail IR20_RUNTIME_IDENTITY_CHANGED 107
    [[ "$(docker inspect --format '{{.RestartCount}}' "$current_worker")" == "$initial_worker_restarts" ]] || fail IR20_WORKER_RESTARTED 108
    [[ "$(docker inspect --format '{{.RestartCount}}' "$current_broker")" == "$initial_broker_restarts" ]] || fail IR20_BROKER_RESTARTED 109
    docker exec "$current_worker" /nodejs/bin/node -e "fetch('http://127.0.0.1:3002/ready',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1 || fail IR20_WORKER_NOT_READY 110
    docker exec "$current_broker" kafka-topics --bootstrap-server 127.0.0.1:9092 --list >/dev/null 2>&1 || fail IR20_BROKER_NOT_READY 111
    observation_now="$(date +%s)"
    (( observation_now >= observation_deadline )) && break
    observation_sleep=$((observation_deadline - observation_now))
    (( observation_sleep > 10 )) && observation_sleep=10
    sleep "$observation_sleep"
  done
  observation_elapsed=$(( $(date +%s) - observation_started_at ))
  (( observation_elapsed >= 1800 )) || fail IR20_OBSERVATION_TOO_SHORT 124
  printf 'IR20_RUNTIME_OBSERVATION=PASS\nIR20_OBSERVATION_SECONDS=%s\n' "$observation_elapsed"; exit 0
fi

if [[ "$ACTION" == rollback ]]; then
  # This action is a fresh process invoked only after the deploy action already
  # advanced API/Web and later acceptance failed. Restore API/Web unconditionally
  # to the baseline recorded by that deployment run.
  API_WEB_MUTATED=1
  # Distinguished on purpose. A rollback that restored the wrong revision and a
  # rollback whose verification could not run are different incidents with
  # different responses, and reporting both as AUTOMATIC_ROLLBACK_FAILED cost an
  # investigation round. None of these is a success and none may be treated as
  # one — the run still fails, it just says which check failed.
  rollback_rc=0
  rollback_images || rollback_rc=$?
  case "$rollback_rc" in
    0) : ;;
    2) fail ROLLBACK_REVISION_UNREADABLE 57 ;;
    3) fail ROLLBACK_REVISION_MISMATCH 58 ;;
    *) fail AUTOMATIC_ROLLBACK_FAILED 50 ;;
  esac
  printf 'ROLLBACK_COMPLETE=1\n'
  printf 'RESTORED_API_REVISION=%s\n' "$restored_api_revision"
  printf 'RESTORED_WEB_REVISION=%s\n' "$restored_web_revision"
  printf 'ROLLBACK_CONTAINER_REVISIONS_VERIFIED=1\n'
  exit 0
fi

printf 'COMPOSE_AUTHORITY_RESOLVED=1\n'
printf 'MIGRATION_SERVICE_RESOLVED=1\n'
printf 'BASELINE_API_REVISION=%s\n' "$baseline_api_revision"
printf 'BASELINE_WEB_REVISION=%s\n' "$baseline_web_revision"

if [[ "$ACTION" == audit ]]; then
  printf 'AUDIT_COMPLETE=1\n'
  exit 0
fi

[[ -n "$API_IMAGE" && -n "$WEB_IMAGE" && -n "$MIGRATION_IMAGE" && -n "$OUTBOX_WORKER_IMAGE" ]] || fail EXACT_IMAGES_REQUIRED 21
verify_image api "$API_IMAGE" "$API_IMAGE_ID"; verify_image web "$WEB_IMAGE" "$WEB_IMAGE_ID"; verify_image migration "$MIGRATION_IMAGE" "$MIGRATION_IMAGE_ID"; verify_image outbox-worker "$OUTBOX_WORKER_IMAGE" "$OUTBOX_WORKER_IMAGE_ID"; verify_broker_image
printf 'EXACT_IMAGE_SOURCE=%s\n' "$EXACT_IMAGE_SOURCE"

# Shared release-authority root: traverse-only for the runner group. `chmod 0700`
# here preserved the group and stripped its `--x`, which is exactly the state the
# host was found in — and it lands after the controller has set 0710, because this
# release and the preflight both fire on the same image build. The runner then
# cannot reach runner-input and activation dies before the controller is invoked.
install -d -m 0710 -o root -g pcactions "$STATE_ROOT"
umask 077
baseline_worker_id="$(optional_release_service_id "$OUTBOX_SERVICE")" || fail OUTBOX_BASELINE_DISCOVERY_FAILED 112
baseline_broker_id="$(optional_release_service_id "$KAFKA_SERVICE")" || fail KAFKA_BASELINE_DISCOVERY_FAILED 113
if [[ -n "$baseline_worker_id" ]]; then BASELINE_WORKER_PRESENT=1; baseline_worker_image="$(docker inspect --format '{{.Config.Image}}' "$baseline_worker_id")"; baseline_worker_revision="$(container_revision "$baseline_worker_id")"; is_revision "$baseline_worker_revision" || fail OUTBOX_BASELINE_REVISION_INVALID 114; else baseline_worker_image=''; baseline_worker_revision=''; fi
[[ -z "$baseline_broker_id" ]] || BASELINE_BROKER_PRESENT=1
[[ "$BASELINE_WORKER_PRESENT" == "$BASELINE_BROKER_PRESENT" ]] || fail IR20_BASELINE_TOPOLOGY_PARTIAL 121
resolve_outbox_runtime_env_file
cat > "$STATE_FILE" <<STATE
BASELINE_API_IMAGE='$baseline_api_image'
BASELINE_WEB_IMAGE='$baseline_web_image'
BASELINE_API_REVISION='$baseline_api_revision'
BASELINE_WEB_REVISION='$baseline_web_revision'
BASELINE_WORKER_PRESENT='$BASELINE_WORKER_PRESENT'
BASELINE_WORKER_IMAGE='$baseline_worker_image'
BASELINE_WORKER_REVISION='$baseline_worker_revision'
BASELINE_BROKER_PRESENT='$BASELINE_BROKER_PRESENT'
OUTBOX_RUNTIME_ENV_PREEXISTED='$OUTBOX_RUNTIME_ENV_PREEXISTED'
MIGRATION_IMAGE='$MIGRATION_IMAGE'
STATE
chmod 0600 "$STATE_FILE"

before_ids="$(mktemp)"
after_ids="$(mktemp)"
snapshot_unrelated "$before_ids" || fail RUNTIME_ISOLATION_FAILED 79
mutated=0
on_error() {
  local rc=$?
  trap - ERR
  if [[ "${RELEASE_ROLLBACK_ARMED:-0}" == 1 ]]; then
    rollback_and_exit "$rc"
  fi
  printf 'DEPLOYMENT_COMPLETE=0\n' >&2
  printf 'ROLLBACK_ATTEMPTED=0\n' >&2
  printf 'ROLLBACK_COMPLETE=0\n' >&2
  printf 'ROLLBACK_FAILED=0\n' >&2
  exit "$rc"
}
trap on_error ERR

if [[ -n "$postgres_service" ]]; then
  pg_id="$(compose_id "$postgres_service")"
  [[ -n "$pg_id" ]] || fail POSTGRES_RUNTIME_MISSING 22
  backup_dir="$STATE_ROOT/backups"
  mkdir -p "$backup_dir"
  chmod 0700 "$backup_dir"
  backup_name="predeploy-${TARGET_SHA}-${RUN_ID}.backup"
  docker exec "$pg_id" sh -ceu 'umask 077; : "${POSTGRES_USER:?}"; : "${POSTGRES_DB:?}"; pg_dump --format=custom --no-owner --no-acl --username="$POSTGRES_USER" --file="$1" "$POSTGRES_DB"' sh "/tmp/$backup_name"
  docker cp "$pg_id:/tmp/$backup_name" "$backup_dir/$backup_name" >/dev/null
  docker exec "$pg_id" rm -f "/tmp/$backup_name"
  chmod 0600 "$backup_dir/$backup_name"
  [[ -s "$backup_dir/$backup_name" ]] || fail BACKUP_EMPTY 23
  sha256sum "$backup_dir/$backup_name" > "$backup_dir/$backup_name.sha256"
  chmod 0600 "$backup_dir/$backup_name.sha256"
  printf 'BACKUP_MODE=LOGICAL_COMPOSE_POSTGRES\n'
elif [[ -n "$backup_evidence" && -f "$backup_evidence" ]]; then
  [[ "$(stat -c '%a' "$backup_evidence")" =~ ^(400|440|600|640)$ ]] || fail BACKUP_EVIDENCE_PERMISSIONS 24
  grep -Fq 'STATUS=PASS' "$backup_evidence" || fail BACKUP_EVIDENCE_INVALID 25
  printf 'BACKUP_MODE=PROTECTED_EXTERNAL_EVIDENCE\n'
else
  fail BACKUP_AUTHORITY_UNAVAILABLE 26
fi

RELEASE_ROLLBACK_ARMED=1
mutated=1
if [[ "$BASELINE_WORKER_PRESENT" == 1 ]]; then docker stop "$baseline_worker_id" >/dev/null; fi
write_override "$API_IMAGE" "$WEB_IMAGE" "$MIGRATION_IMAGE" "$full_override" 1
"${dc_target[@]}" config --quiet
"${dc_target[@]}" run --rm --no-deps --pull never "$migration_service"
printf 'MIGRATION_COMPLETE=1\n'
apply_outbox_policy
provision_outbox_runtime
write_override "$API_IMAGE" "$WEB_IMAGE" "$MIGRATION_IMAGE" "$full_override" 1 "$OUTBOX_WORKER_IMAGE" 1
"${dc_target[@]}" config --quiet
"${dc_target[@]}" up -d --no-deps --pull never "$KAFKA_SERVICE"
if wait_broker; then
  printf 'IR20_BROKER_RECOVERY=NOT_REQUIRED\n'
else
  emit_broker_startup_diagnostics
  recover_broker_once || fail KAFKA_READINESS_FAILED 115
fi
ensure_kafka_topics || fail KAFKA_TOPIC_AUTHORITY_FAILED 116
verify_first_broker_restart_persistence || fail KAFKA_PERSISTENCE_PROOF_FAILED 117
"${dc_target[@]}" up -d --no-deps --pull never "$OUTBOX_SERVICE"
if ! wait_worker; then emit_worker_startup_diagnostics; fail OUTBOX_WORKER_READINESS_FAILED 118; fi
verify_ir20_runtime_network_parity || fail IR20_RUNTIME_NETWORK_PARITY_FAILED 128
worker_principal_smoke || fail OUTBOX_PRINCIPAL_BOUNDARY_FAILED 97
API_WEB_MUTATED=1
"${dc_target[@]}" up -d --no-deps --pull never api
if ! wait_api; then emit_api_startup_diagnostics; fail API_READINESS_FAILED 30; fi
new_api_id="$("${dc_target[@]}" ps -q api | head -1)"; verify_api_auth_hash_keys "$new_api_id" || fail API_AUTH_HASH_KEYS_INVALID 77
"${dc_target[@]}" up -d --no-deps --pull never web; wait_web || fail WEB_HEALTH_FAILED 31

retire_release_watchtower || fail WATCHTOWER_RETIREMENT_FAILED 80

snapshot_unrelated "$after_ids" 1 || fail RUNTIME_ISOLATION_FAILED 79
cmp -s "$before_ids" "$after_ids" || fail NON_TARGET_CONTAINER_CHANGED 32
rm -f "$before_ids" "$after_ids"

new_api_id="$("${dc_target[@]}" ps -q api | head -1)"; new_web_id="$("${dc_target[@]}" ps -q web | head -1)"
new_worker_id="$("${dc_target[@]}" ps -q "$OUTBOX_SERVICE" | head -1)"; new_broker_id="$("${dc_target[@]}" ps -q "$KAFKA_SERVICE" | head -1)"
[[ -n "$new_worker_id" && -n "$new_broker_id" ]] || fail IR20_RUNTIME_MISSING 103
new_api_revision="$(verify_runtime_image api "$API_IMAGE" "$new_api_id")" || fail RUNNING_API_IMAGE_BINDING_FAILED 82
new_web_revision="$(verify_runtime_image web "$WEB_IMAGE" "$new_web_id")" || fail RUNNING_WEB_IMAGE_BINDING_FAILED 83
new_worker_revision="$(verify_runtime_image outbox-worker "$OUTBOX_WORKER_IMAGE" "$new_worker_id")" || fail RUNNING_OUTBOX_WORKER_IMAGE_BINDING_FAILED 119
if [[ "$new_api_revision" != "$TARGET_SHA" || "$new_web_revision" != "$TARGET_SHA" || "$new_worker_revision" != "$TARGET_SHA" ]]; then
  printf 'RUNNING_API_REVISION=%s\n' "${new_api_revision:-unknown}" >&2; printf 'RUNNING_WEB_REVISION=%s\n' "${new_web_revision:-unknown}" >&2; printf 'RUNNING_OUTBOX_WORKER_REVISION=%s\n' "${new_worker_revision:-unknown}" >&2; fail RUNNING_REVISION_MISMATCH 33
fi
[[ "$(docker inspect --format '{{.Config.Image}}' "$new_broker_id")" == "$KAFKA_IMAGE" ]] || fail RUNNING_KAFKA_IMAGE_BINDING_FAILED 120
RELEASE_ROLLBACK_ARMED=0; mutated=0; trap - ERR
printf 'DEPLOYED_API_REVISION=%s\n' "$new_api_revision"; printf 'DEPLOYED_WEB_REVISION=%s\n' "$new_web_revision"; printf 'DEPLOYED_OUTBOX_WORKER_REVISION=%s\n' "$new_worker_revision"
printf 'IR20_KAFKA_READY=1\n'
printf 'IR20_OUTBOX_WORKER_READY=1\n'
printf 'WATCHTOWER_RETIRED=1\n'
printf 'DEPLOYMENT_COMPLETE=1\n'
