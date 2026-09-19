#!/usr/bin/env python3
"""Fail closed when any GitHub Actions workflow is not parseable YAML.

An unparseable workflow does not fail loudly: GitHub records a startup_failure
run with zero jobs, so the automation silently never executes while every push
to the branch collects a red check. This guard turns that into an explicit,
attributable CI failure.
"""

from __future__ import annotations

import sys
from pathlib import Path

import yaml

WORKFLOW_DIR = Path(".github/workflows")


def main() -> int:
    workflows = sorted(
        path
        for pattern in ("*.yml", "*.yaml")
        for path in WORKFLOW_DIR.glob(pattern)
    )
    if not workflows:
        print(f"no workflows found under {WORKFLOW_DIR}", file=sys.stderr)
        return 2

    failures: list[str] = []
    for path in workflows:
        try:
            document = yaml.safe_load(path.read_text(encoding="utf-8"))
        except yaml.YAMLError as error:
            mark = getattr(error, "problem_mark", None)
            location = f" at line {mark.line + 1}, column {mark.column + 1}" if mark else ""
            failures.append(f"{path}: unparseable YAML{location}")
            continue
        if not isinstance(document, dict):
            failures.append(f"{path}: workflow must be a YAML mapping")
            continue
        # PyYAML resolves the unquoted `on:` key to the boolean True.
        if "jobs" not in document:
            failures.append(f"{path}: workflow declares no jobs")
        if "on" not in document and True not in document:
            failures.append(f"{path}: workflow declares no triggers")

    for failure in failures:
        print(failure, file=sys.stderr)
    if failures:
        print(f"\n{len(failures)} of {len(workflows)} workflows are invalid", file=sys.stderr)
        return 1

    print(f"all {len(workflows)} workflows parse and declare triggers and jobs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
