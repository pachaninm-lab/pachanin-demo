# platform-v7 Claude Code Executor Mode

## What this is

Claude Code is the **human-grade executor** for complex platform-v7 tasks.
The fallback autopilot is the **background conveyor** that keeps the loop
running unattended between Claude Code executions.

The two modes coexist and never conflict:

| Layer | Trigger | Scope | Merges via |
|-------|---------|-------|-----------|
| Fallback autopilot | Schedule / watchdog | `agentWritableScope` from SOT | Reconcile gate |
| Claude Code executor | GitHub issue labeled `platform-v7` | `allowedCurrentScope` from SOT | Same guard + CI |

The fallback autopilot does **not** touch anything outside `agentWritableScope`.
Claude Code may use the full `allowedCurrentScope` for complex tasks.

---

## How to run a Claude Code executor task

1. Open a GitHub issue with label `platform-v7`.
2. Write the task body using [`claude-code-task-template.md`](./claude-code-task-template.md).
3. Claude Code reads the issue, reads the SOT (`autopilot-state.json`), and
   verifies that all planned changes are within `allowedCurrentScope`.
4. Claude Code opens **one narrow PR** per logical change, never a batch.
5. The PR must pass `platform-v7 autopilot guard` + `ci` + `build`.
6. On merge the SOT is not auto-advanced — Claude Code PRs are additive, not
   slice-advancing, unless the task explicitly targets a SOT advance.

---

## Handoff rule: Claude stalls → fallback keeps running

If a Claude Code session ends without completing the task:

- The fallback autopilot continues running on its own schedule (every 5 min
  via agent runner, every 30 min via loop, every 10 min watchdog).
- Fallback will **not** touch files outside its `agentWritableScope`.
- Open Claude Code PRs are safe — the reconcile gate ignores PRs that are not
  labeled `agent-generated`.
- The next Claude Code session can resume by reading the open PR or the issue.

No human intervention is required to keep the background loop alive.

---

## Audit marker for Claude Code PRs

Every Claude Code PR must include a commit or file that makes its origin
identifiable. See [`claude-code-audit-marker.md`](./claude-code-audit-marker.md).

---

## Acceptance checklist for Claude Code PRs

See [`claude-code-pr-checklist.md`](./claude-code-pr-checklist.md).

---

## Maturity

Maturity remains **controlled-pilot / pre-integration** for all Claude Code
executor PRs. No production-ready claims. No fake-live claims.
