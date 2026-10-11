#!/usr/bin/env python3
"""Classify one immutable routing vector; never skip PC-CROP-07B acceptance."""
import json
import os
import re
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


def main():
    try:
        base, head = verify(os.environ, Path(os.environ['EVIDENCE_DIR']))
    except Exception:
        # No protected metadata, subprocess output or exception text is emitted.
        print('PC_CROP_07B_PINNED_ROUTING_REJECTED', file=sys.stderr)
        return 1
    print(f'PC_CROP_07B_PINNED_ROUTING_PASS head={head} base={base}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
