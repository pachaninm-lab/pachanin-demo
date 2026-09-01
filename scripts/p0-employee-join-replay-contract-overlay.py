#!/usr/bin/env python3
# Align the generated all-role employee join replay assertion with the public BFF contract.

from __future__ import annotations

import re
import sys
from pathlib import Path


OLD_ASSERTION = """if p.get('status') != 'ACTIVATED' or p.get('replayed') is not True or p.get('notificationDelivered') is not False:
    raise SystemExit(1)
"""

NEW_ASSERTION = """if (
    p.get('status') != 'ACTIVATED'
    or p.get('nextAction') != 'LOGIN'
    or p.get('replayed') is not True
    or 'notificationDelivered' in p
):
    raise SystemExit(1)
"""


def safe(value: object) -> str:
    return re.sub(r"[^A-Z0-9_=|:-]", "_", str(value).upper())[:300] or "UNKNOWN"


def main() -> int:
    if len(sys.argv) != 2:
        print("P0_EMPLOYEE_JOIN_REPLAY_OVERLAY_ERROR=USAGE", file=sys.stderr)
        return 2

    path = Path(sys.argv[1])
    if not path.is_file():
        print("P0_EMPLOYEE_JOIN_REPLAY_OVERLAY_ERROR=EXECUTOR_MISSING", file=sys.stderr)
        return 3

    try:
        source = path.read_text(encoding="utf-8")
        count = source.count(OLD_ASSERTION)
        if count != 1:
            raise RuntimeError(f"PATCH_CARDINALITY_EMPLOYEE_JOIN_REPLAY={count}")
        if source.count("p.get('notificationDelivered') is not True") < 1:
            raise RuntimeError("FRESH_JOIN_DELIVERY_ASSERTION_MISSING")

        patched = source.replace(OLD_ASSERTION, NEW_ASSERTION, 1)
        invariants = {
            "OLD_ASSERTION_REMOVED": OLD_ASSERTION not in patched,
            "NEW_ASSERTION_UNIQUE": patched.count(NEW_ASSERTION) == 1,
            "ACTIVATED_REQUIRED": "p.get('status') != 'ACTIVATED'" in NEW_ASSERTION,
            "LOGIN_REQUIRED": "p.get('nextAction') != 'LOGIN'" in NEW_ASSERTION,
            "REPLAY_REQUIRED": "p.get('replayed') is not True" in NEW_ASSERTION,
            "PUBLIC_FIELD_OMISSION_REQUIRED": "'notificationDelivered' in p" in NEW_ASSERTION,
            "FRESH_DELIVERY_ASSERTION_PRESERVED": patched.count(
                "p.get('notificationDelivered') is not True"
            ) >= 1,
        }
        failed = [name for name, passed in invariants.items() if not passed]
        if failed:
            raise RuntimeError("INVARIANT_FAILED=" + "|".join(failed))

        path.write_text(patched, encoding="utf-8")
    except Exception as error:
        print(
            f"P0_EMPLOYEE_JOIN_REPLAY_OVERLAY_ERROR={safe(error)}",
            file=sys.stderr,
        )
        return 4

    print("P0_ALL_ROLE_EMPLOYEE_JOIN_REPLAY_PUBLIC_CONTRACT=PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
