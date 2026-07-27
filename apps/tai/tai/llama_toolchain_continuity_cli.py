"""CLI for proving that the recorded llama.cpp pin is still the declared one."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from tai.llama_toolchain_continuity import ContinuityStatus, verify_toolchain_continuity


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="tai-llama-toolchain-continuity",
        description="Verify that a recorded build acceptance still matches the authority.",
    )
    parser.add_argument("authority", type=Path)
    parser.add_argument("acceptance", type=Path)
    parser.add_argument("--output", type=Path)
    arguments = parser.parse_args(argv)

    report = verify_toolchain_continuity(
        authority_path=arguments.authority, acceptance_path=arguments.acceptance
    )
    payload = report.payload()
    rendered = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if arguments.output is not None:
        arguments.output.parent.mkdir(parents=True, exist_ok=True)
        arguments.output.write_text(rendered, encoding="utf-8")
    print(rendered, end="")

    # A broken pin is a failure, not a note in a report nobody reads.
    return 0 if report.status is ContinuityStatus.CONTINUOUS else 1


if __name__ == "__main__":  # pragma: no cover - module entry point
    raise SystemExit(main())
