# platform-v7 Claude Code Audit Marker

## Purpose

The fallback autopilot writes `docs/platform-v7/autopilot/audit/agent-engine-{RUN_ID}.json`
with `engine: "fallback"` or `engine: "openai"` on every generated PR.

Claude Code executor PRs do not go through the agent runner, so they produce no
`agent-engine-*.json` file automatically. This document defines the lightweight
marker that makes Claude Code PRs identifiable in repo history.

## Required marker

Every Claude Code executor PR must include **one of** the following:

### Option A — PR body tag (no file needed)

Include this line verbatim in the PR body:

```
executor: claude-code
```

Example PR body suffix:
```
---
executor: claude-code
issue: #<issue-number>
maturity: controlled-pilot / pre-integration
```

### Option B — Audit JSON (for tasks that modify `docs/platform-v7/autopilot/**`)

Commit a file at:
```
docs/platform-v7/autopilot/audit/claude-code-<ISSUE_NUMBER>-<slug>.json
```

With content:
```json
{
  "executor": "claude-code",
  "issueNumber": <number>,
  "timestamp": "<ISO-8601>",
  "prScope": ["<list of changed files>"],
  "fallbackAutopilotActive": true,
  "maturity": "controlled-pilot / pre-integration"
}
```

## How to distinguish in repo history

| Field | Fallback autopilot PR | Claude Code executor PR |
|-------|----------------------|------------------------|
| Branch prefix | `p7-agent/` | any (typically `claude/`) |
| Labels | `agent-generated`, `automerge` | no `agent-generated` label |
| Audit file | `agent-engine-{RUN_ID}.json` | `claude-code-{issue}-{slug}.json` or PR body tag |
| `engine` field | `fallback` / `openai` | n/a (Claude Code, not OpenAI API) |
| Merge trigger | Reconcile gate (automated) | Human / automerge after CI green |

## This PR's marker

This PR (implementing issue #1653) uses Option A (PR body tag) and also commits
this audit marker file as Option B proof-of-concept.

Audit record: `docs/platform-v7/autopilot/audit/claude-code-1653-executor-mode.json`
