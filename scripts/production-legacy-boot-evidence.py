"""Bounded, read-only evidence for the guest boot after run 41730479605."""

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import time


LEGACY_CUTOFF_MS = int(datetime(2026, 11, 3, 22, 26, tzinfo=timezone.utc).timestamp()) * 1000
JOURNAL_MAX_BYTES = 16 * 1024
EARLY_BOOT_US = 120 * 1_000_000
CLOCK_TOLERANCE_MS = 120_000
AUTHORITY = 'docs/platform-v7/autopilot/progress.json'
STATE = 'docs/platform-v7/autopilot/autopilot-state.json'
SOURCE_BRANCH = 'ops/gekta-legacy-boot-evidence-20261111'
SOURCE_PATHS = {'.github/workflows/production-legacy-boot-evidence.yml',
                'scripts/production-legacy-boot-evidence.py'}


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
    manifest = json.loads(accepted_content(base, head, AUTHORITY))['gektaLegacyBootEvidence']
    if (manifest['schemaVersion'] != 'platform-v7.concurrent-scope.v1' or
            manifest['status'] != 'active' or manifest['branch'] != SOURCE_BRANCH or
            manifest['productionInvocationAuthorized'] is not False or manifest['releaseAuthorized'] is not False or
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
    print('LEGACY_BOOT_SOURCE_PINS_PASS')


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
    print('PASS: 14 local boot evidence cases')


if __name__ == '__main__':
    try:
        if len(sys.argv) == 1:
            read_guest()
        elif sys.argv[1:] == ['--self-test']:
            self_test()
        elif len(sys.argv) == 4 and sys.argv[1] == '--verify-pr':
            verify_source(sys.argv[2], sys.argv[3], verify_diff=True)
        elif len(sys.argv) == 3 and sys.argv[1] == '--verify-main':
            verify_source(sys.argv[2], sys.argv[2], verify_diff=False)
        elif len(sys.argv) == 5 and sys.argv[1] == '--reconcile':
            print('BOOT_AFTER_LEGACY_CUTOFF' if reconcile(sys.argv[2], int(sys.argv[3]), int(sys.argv[4]))
                  else 'NOT_PROVEN')
        else:
            raise SystemExit(2)
    except (OSError, ValueError, TypeError, AttributeError, KeyError, subprocess.SubprocessError):
        raise SystemExit(1) from None
