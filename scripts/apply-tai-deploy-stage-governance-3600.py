#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

STATE = Path("docs/platform-v7/autopilot/autopilot-state.json")
QUEUE = Path("docs/platform-v7/execution-queue.md")
TARGET_BRANCH = "fix/tai-deploy-internal-stage-evidence-v5-20260802"
TARGET_PATHS = [
    ".github/workflows/apply-tai-deploy-internal-stage-evidence.yml",
    "docs/platform-v7/autopilot/scopes/tai-deploy-internal-stage-evidence-20260802.json",
    "scripts/apply-tai-deploy-internal-stage-evidence.py",
    "scripts/check-tai-reg-ru-deploy.mjs",
    "scripts/tai-reg-ru-deploy.sh",
]
QUEUE_BLOCK = """
CONCURRENT P0 AUTHORIZATION — TAI REG.RU INTERNAL DEPLOY STAGE EVIDENCE:
- branch: `fix/tai-deploy-internal-stage-evidence-v5-20260802`;
- purpose: materialize deterministic root-only internal stage codes after standalone TAI deployment run `30746507765` returned only `TAI_STANDALONE_DEPLOY_EXECUTION_FAILED`;
- allowed paths:
  - `.github/workflows/apply-tai-deploy-internal-stage-evidence.yml`
  - `docs/platform-v7/autopilot/scopes/tai-deploy-internal-stage-evidence-20260802.json`
  - `scripts/apply-tai-deploy-internal-stage-evidence.py`
  - `scripts/check-tai-reg-ru-deploy.mjs`
  - `scripts/tai-reg-ru-deploy.sh`
- boundaries: REG.RU only; local Qwen3-8B; 0 ₽ new recurring cost; no tenant, RBAC, financial, public-port or direct-Docker authority expansion;
- completion: exact-head checks, zero unresolved review threads, merge to main, then rerun canonical images → preflight → activation → standalone deployment → strict postflight;
- production PASS remains forbidden until the exact-main REG.RU deployment and live acceptance succeed.
""".strip()

state = json.loads(STATE.read_text(encoding="utf-8"))
scopes = state.setdefault("approvedConcurrentScopes", {})
existing = scopes.get(TARGET_BRANCH)
if existing not in (None, TARGET_PATHS):
    raise SystemExit(f"Conflicting existing scope for {TARGET_BRANCH}: {existing!r}")
scopes[TARGET_BRANCH] = TARGET_PATHS
STATE.write_text(json.dumps(state, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

queue = QUEUE.read_text(encoding="utf-8")
if QUEUE_BLOCK not in queue:
    marker = "\nGOVERNING SPECIFICATION:\n"
    if queue.count(marker) != 1:
        raise SystemExit("execution queue insertion marker is ambiguous")
    queue = queue.replace(marker, f"\n{QUEUE_BLOCK}\n\nGOVERNING SPECIFICATION:\n", 1)
    QUEUE.write_text(queue, encoding="utf-8")

verified = json.loads(STATE.read_text(encoding="utf-8"))
if verified.get("approvedConcurrentScopes", {}).get(TARGET_BRANCH) != TARGET_PATHS:
    raise SystemExit("approvedConcurrentScopes materialization failed")
if QUEUE_BLOCK not in QUEUE.read_text(encoding="utf-8"):
    raise SystemExit("execution queue materialization failed")
print("TAI_DEPLOY_STAGE_GOVERNANCE_3600=APPLIED")
