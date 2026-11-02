#!/usr/bin/env python3
"""Classify one immutable routing vector; never skip PC-CROP-07B acceptance."""
import json
import hashlib
import os
import re
import stat
import subprocess
import sys
from pathlib import Path


BRANCH = 'fix/protected-entry-locale-5580-20261011'
MANIFEST = 'docs/platform-v7/autopilot/scopes/protected-entry-locale-5580-20261011.json'
MANIFEST_BLOB = '21fae00fe9c50555a386109c995bf327cadec5c9'
PINS = (
    ('apps/web/middleware.ts', 'fcf36722990a429513d7b304361dbe2428ba3a62',
     'd778d95a76f5202c15da6368372447ea498df41e'),
    ('apps/web/next.config.js', '7f5a895c112cbf19f675c7473a2700652ca848a3',
     '0c8c80852df01456ba1c5d41ec0ebdf66e85b0ea'),
    ('apps/web/app/platform-v7/integrations/page.tsx', '7621fd99e140688ce5ca46240578d7e21fb36dee',
     '2a83714b4e82545e4d2e53157dfc1277a307675d'),
    ('apps/web/tests/unit/platformV7BankPaymentBasisRoutesManifest.test.ts',
     'fff4b75ad6fdc2f240311cb16e7dea3e21f3971c', 'd6e864371ae76d09efddc8761b14f432d995a3c5'),
)
PATHS = sorted(pin[0] for pin in PINS)
OUTSIDE_PATHS = sorted(path for path in PATHS if path != PINS[2][0])
COMBINED_BRANCH = 'fix/pc-crop-predecessor-5580-20261011'
COMBINED_MANIFEST = 'docs/platform-v7/autopilot/scopes/pc-crop-predecessor-5580-20261011.json'
COMBINED_OUTSIDE_PATHS = sorted([
    'scripts/pc-crop-predecessor-trigger-governance.mjs',
    'scripts/test-pc-crop-predecessor-07b-compat.mjs',
    '.github/workflows/pc-crop-predecessor-trigger-governance.yml',
    'scripts/p7-source-controlled-scope.mjs',
])
COMBINED_PINNED_PATHS = [
    '.github/workflows/pc-crop-07b.yml',
    'scripts/verify-pc-crop-07b-routing-compat.py',
    'scripts/test-pc-crop-07b-routing-compat.py',
    'apps/web/tests/unit/platformV7IntegrationControlTower.test.ts',
]
COMBINED_ALLOWED_PATHS = [
    'scripts/pc-crop-predecessor-trigger-governance.mjs',
    'scripts/test-pc-crop-predecessor-07b-compat.mjs',
    '.github/workflows/pc-crop-predecessor-trigger-governance.yml',
    'scripts/p7-source-controlled-scope.mjs',
    *COMBINED_PINNED_PATHS,
]


def regular_working_manifest():
    file = Path(COMBINED_MANIFEST)
    require(stat.S_ISREG(file.lstat().st_mode))
    return file.read_bytes()


def require(ok):
    if not ok:
        raise ValueError('PC_CROP_07B_PINNED_ROUTING_REJECTED')


def git(*args):
    return subprocess.check_output(['git', *args], stderr=subprocess.DEVNULL, timeout=30)


def verify(environ, evidence):
    event = environ['EVENT_NAME']
    require((event == 'pull_request' and environ.get('GITHUB_HEAD_REF') == BRANCH)
            or (event == 'push' and environ.get('GITHUB_REF') == 'refs/heads/main'))
    head = environ['EXACT_HEAD']
    require(bool(re.fullmatch('[0-9a-f]{40}', head)))
    base = git('rev-parse', environ['PINNED_SCOPE_BASE'] + '^{commit}').decode().strip()
    require(bool(re.fullmatch('[0-9a-f]{40}', base)))
    require(git('rev-parse', 'HEAD^{commit}').decode().strip() == head)
    git('merge-base', '--is-ancestor', base, head)
    require((evidence / 'changed-files.txt').read_bytes()
            == ''.join(path + '\n' for path in PATHS).encode())
    require((evidence / 'out-of-scope.txt').read_bytes()
            == ''.join(path + '\n' for path in OUTSIDE_PATHS).encode())
    # Compare complete trees, not just the merge-base diff or supplied evidence.
    require(git('diff', '--no-renames', '--name-only', '-z', base, head)
            == b''.join(path.encode() + b'\0' for path in PATHS))
    for path, before, after in (*PINS, (MANIFEST, MANIFEST_BLOB, MANIFEST_BLOB)):
        for ref, blob in ((base, before), (head, after)):
            require(git('ls-tree', ref, '--', path)
                    == f'100644 blob {blob}\t{path}\n'.encode())
    accepted = git('show', base + ':' + MANIFEST)
    require(git('show', head + ':' + MANIFEST) == accepted)
    manifest = json.loads(accepted.decode('utf-8'))
    require(manifest['schemaVersion'] == 'platform-v7.concurrent-scope.v1')
    require(manifest['branch'] == BRANCH and manifest['status'] == 'active')
    require(manifest['owner'] == 'ACCOUNT_1_CORE' and manifest['contributor'] == 'ACCOUNT_2_PRODUCT')
    require(manifest['allowedPaths'] == [pin[0] for pin in PINS])
    require(manifest['sourcePins'] == [dict(path=p, mode='100644', beforeBlob=b, afterBlob=a)
                                       for p, b, a in PINS[:3]])
    require(manifest['testBeforeBlob'] == PINS[3][1])
    return base, head


def verify_combined(environ, evidence):
    """Classify only the complete eight-leaf repair admitted by immutable BASE."""
    event = environ['EVENT_NAME']
    require((event == 'pull_request' and environ.get('GITHUB_HEAD_REF') == COMBINED_BRANCH)
            or (event == 'push' and environ.get('GITHUB_REF') == 'refs/heads/main'))
    head = environ['EXACT_HEAD']
    require(bool(re.fullmatch('[0-9a-f]{40}', head)))
    base = git('rev-parse', '--verify', '--end-of-options',
               environ['PINNED_SCOPE_BASE'] + '^{commit}').decode().strip()
    require(bool(re.fullmatch('[0-9a-f]{40}', base)) and base != head)
    require(git('rev-parse', 'HEAD^{commit}').decode().strip() == head)
    git('merge-base', '--is-ancestor', base, head)
    paths = sorted(COMBINED_ALLOWED_PATHS)
    require((evidence / 'changed-files.txt').read_bytes()
            == ''.join(path + '\n' for path in paths).encode())
    require((evidence / 'out-of-scope.txt').read_bytes()
            == ''.join(path + '\n' for path in COMBINED_OUTSIDE_PATHS).encode())
    require(git('diff', '--no-renames', '--name-only', '-z', base, head)
            == b''.join(path.encode() + b'\0' for path in paths))
    accepted = git('show', base + ':' + COMBINED_MANIFEST)
    blob = hashlib.sha1(b'blob ' + str(len(accepted)).encode() + b'\0' + accepted).hexdigest()
    entry = f'100644 blob {blob}\t{COMBINED_MANIFEST}\n'.encode()
    require(git('ls-tree', base, '--', COMBINED_MANIFEST) == entry
            and git('ls-tree', head, '--', COMBINED_MANIFEST) == entry)
    require(git('show', head + ':' + COMBINED_MANIFEST) == accepted
            and regular_working_manifest() == accepted)
    scope = json.loads(accepted.decode('utf-8'))
    require(scope['schemaVersion'] == 'platform-v7.concurrent-scope.v1'
            and scope['status'] == 'active' and scope['branch'] == COMBINED_BRANCH
            and scope['owner'] == 'ACCOUNT_1_CORE' and scope['contributor'] == 'ACCOUNT_2_PRODUCT'
            and scope['allowedPaths'] == COMBINED_ALLOWED_PATHS)
    pins = scope['pinnedCompatibilitySource']
    require(len(pins) == 4 and [pin['path'] for pin in pins] == COMBINED_PINNED_PATHS)
    # The complete workflow and sole FGIS assertion stay fixed. Only the two
    # classifier scripts receive new separately reviewed admission pins.
    require(pins[0]['afterBlob'] == '80b574492cbdc6a4549849886dda3d4ba61926f8'
            and pins[0]['sha256'] == 'bd1ceffd85e2de0c46914e3d75c3ec9a234d698ff8db08124a227a11d807c412'
            and pins[3]['afterBlob'] == 'c1158e456ca42bdb1a887b9885cd3128d48a0bcf'
            and pins[3]['sha256'] == '926f5ebc9e77970bbcf9963a61531d8b6a4a5ec5cf63b7879fdac8e60f1a720b')
    for path in paths:
        require(bool(re.fullmatch(rb'100644 blob [0-9a-f]{40}\t' + re.escape(path.encode()) + rb'\n',
                                  git('ls-tree', head, '--', path))))
    for pin in pins:
        require(pin['mode'] == '100644' and bool(re.fullmatch('[0-9a-f]{40}', pin['afterBlob']))
                and bool(re.fullmatch('[0-9a-f]{64}', pin['sha256'])))
        require(git('ls-tree', head, '--', pin['path'])
                == f"100644 blob {pin['afterBlob']}\t{pin['path']}\n".encode())
        require(hashlib.sha256(git('show', head + ':' + pin['path'])).hexdigest() == pin['sha256'])
    return base, head


def main():
    try:
        evidence = Path(os.environ['EVIDENCE_DIR'])
        if os.environ.get('EVENT_NAME') == 'pull_request' and os.environ.get('GITHUB_HEAD_REF') == COMBINED_BRANCH:
            base, head = verify_combined(os.environ, evidence)
            kind = 'COMBINED'
        else:
            try:
                base, head = verify(os.environ, evidence)
                kind = 'ROUTING'
            except Exception:
                # Main push can carry either separately reviewed finite vector.
                # A PR from any other branch never falls back to combined scope.
                require(os.environ.get('EVENT_NAME') == 'push'
                        and os.environ.get('GITHUB_REF') == 'refs/heads/main')
                base, head = verify_combined(os.environ, evidence)
                kind = 'COMBINED'
    except Exception:
        # No protected metadata, subprocess output or exception text is emitted.
        print('PC_CROP_07B_PINNED_ROUTING_REJECTED', file=sys.stderr)
        return 1
    print(f'PC_CROP_07B_PINNED_{kind}_PASS head={head} base={base}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
