#!/usr/bin/env python3
"""Fail closed when a GitHub Actions workflow cannot start.

An unstartable workflow does not fail loudly: GitHub records a startup_failure
run with zero jobs, so the automation silently never executes while every push
to the branch collects a red check. This guard turns that into an explicit,
attributable CI failure.

Unparseable YAML is only one way to get there. A workflow whose YAML is valid
is still rejected at parse time if it references a context that is not
available at that position, and the symptom is identical — zero jobs, and the
`on:` filters are never even evaluated, so the phantom failure appears on
every branch rather than only on the ones the workflow targets. That is how
`p0-fgis-first-confirmed-lot-audit.yml` accumulated 445 red runs without ever
executing a step: it read `runner.temp` from an `env:` block, where the
`runner` context does not exist.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import yaml

WORKFLOW_DIR = Path(".github/workflows")

# https://docs.github.com/actions/learn-github-actions/contexts#context-availability
# `env:` blocks are evaluated before a runner is assigned, so `runner`, `job`,
# `steps` and `env` itself are unavailable in them. Step-level `env:` is not
# checked here: at that point the full context set is available.
WORKFLOW_ENV_CONTEXTS = frozenset({"github", "secrets", "inputs", "vars"})
JOB_ENV_CONTEXTS = frozenset(
    {"github", "needs", "strategy", "matrix", "vars", "secrets", "inputs"}
)

CONTEXT_REFERENCE = re.compile(r"\$\{\{[^}]*?\b([a-zA-Z_][a-zA-Z0-9_-]*)\s*\.")


def context_violations(
    block: object, allowed: frozenset[str], where: str
) -> list[str]:
    """Report every context an `env:` block reads that it may not read."""
    if not isinstance(block, dict):
        return []
    problems = []
    for name, value in block.items():
        for context in sorted(set(CONTEXT_REFERENCE.findall(str(value)))):
            if context not in allowed:
                problems.append(
                    f"{where} `{name}` reads the `{context}` context, "
                    f"which is not available there"
                )
    return problems


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

        for problem in context_violations(
            document.get("env"), WORKFLOW_ENV_CONTEXTS, "workflow env:"
        ):
            failures.append(f"{path}: {problem}")

        jobs = document.get("jobs")
        if isinstance(jobs, dict):
            for job_id, job in jobs.items():
                if not isinstance(job, dict):
                    continue
                for problem in context_violations(
                    job.get("env"), JOB_ENV_CONTEXTS, f"job `{job_id}` env:"
                ):
                    failures.append(f"{path}: {problem}")

    for failure in failures:
        print(failure, file=sys.stderr)
    if failures:
        problem = "problem" if len(failures) == 1 else "problems"
        print(f"\n{len(failures)} {problem} across {len(workflows)} workflows", file=sys.stderr)
        return 1

    print(
        f"all {len(workflows)} workflows parse, declare triggers and jobs, "
        f"and read only available contexts from their env blocks"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
