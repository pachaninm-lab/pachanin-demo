#!/usr/bin/env python3
# Align the all-role Chromium organization-team assertion with the PostgreSQL
# projection contract: hasFreshMfa is a privileged organization-admin exposure
# flag, not a raw statement that the current session completed MFA.

from __future__ import annotations

import re
import sys
from pathlib import Path


OLD = '''      || proof.team.hasFreshMfa !== true
      || proof.team.isOrganizationAdmin !== (process.env.PC_P0_BROWSER_ADMIN === 'true')) {
      fail('P0_CHROMIUM_PERMITTED_READ_INVALID');
    }
'''

NEW = '''      || proof.team.hasFreshMfa !== (process.env.PC_P0_BROWSER_ADMIN === 'true')
      || proof.team.isOrganizationAdmin !== (process.env.PC_P0_BROWSER_ADMIN === 'true')) {
      fail('P0_CHROMIUM_PERMITTED_READ_INVALID');
    }
'''


def main() -> int:
    if len(sys.argv) != 2:
        print('P0_EMPLOYEE_TEAM_MFA_OVERLAY_ERROR=USAGE', file=sys.stderr)
        return 2

    path = Path(sys.argv[1])
    if not path.is_file():
        print('P0_EMPLOYEE_TEAM_MFA_OVERLAY_ERROR=EXECUTOR_MISSING', file=sys.stderr)
        return 3

    try:
        source = path.read_text(encoding='utf-8')
        count = source.count(OLD)
        if count != 1:
            raise RuntimeError(f'PATCH_CARDINALITY_EMPLOYEE_TEAM_MFA={count}')

        patched = source.replace(OLD, NEW, 1)
        if OLD in patched:
            raise RuntimeError('LEGACY_UNCONDITIONAL_TEAM_MFA_ASSERTION_REMAINS')
        if patched.count(NEW) != 1:
            raise RuntimeError('EMPLOYEE_TEAM_MFA_ASSERTION_MISSING')
        if "proof.team.isOrganizationAdmin !== (process.env.PC_P0_BROWSER_ADMIN === 'true')" not in patched:
            raise RuntimeError('ORGANIZATION_ADMIN_FAIL_CLOSED_ASSERTION_MISSING')
        if "code=\"$(totp \"${MFA_SECRET[$label]}\")\"" not in patched:
            raise RuntimeError('TOTP_LOGIN_PROOF_MISSING')

        path.write_text(patched, encoding='utf-8')
    except Exception as error:
        safe = re.sub(r'[^A-Z0-9_=|:-]', '_', str(error).upper())[:300]
        print(
            f"P0_EMPLOYEE_TEAM_MFA_OVERLAY_ERROR={safe or 'UNKNOWN'}",
            file=sys.stderr,
        )
        return 4

    print('P0_ALL_ROLE_EMPLOYEE_TEAM_MFA_PRIVILEGE_CONTRACT=PASS')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
