# Platform-v7 PR Final Review Gate

**Applies to:** every PR that touches `apps/web/app/platform-v7/**`, `apps/web/components/platform-v7/**`, `apps/web/tests/unit/**`, or `docs/**`.

This protocol was introduced after PR #1062 was declared ready before the actual patch was inspected, resulting in a scope violation (`apps/web/public/mockServiceWorker.js`) and forbidden wording that required a follow-up cleanup PR (#1063).

---

## Mandatory 5-step checklist

Complete every step in order. Do **not** declare the PR ready until all five pass.

### Step 1 — List changed files

```bash
git diff --name-only origin/main...HEAD
```

Write down the full list. Every file must be known and intentional before proceeding.

### Step 2 — Scope check

For each file in the list, verify it falls inside one of the allowed paths for this PR.

| Typical allowed paths | Typical out-of-scope paths |
|-----------------------|-----------------------------|
| `apps/web/app/platform-v7/**` | `apps/web/public/**` |
| `apps/web/components/platform-v7/**` | `apps/web/public/mockServiceWorker.js` |
| `apps/web/tests/unit/**` | `apps/web/package.json` (unless deps changed intentionally) |
| `docs/**` | `apps/web/package-lock.json`, `pnpm-lock.yaml` |
| `apps/web/lib/platform-v7/**` | Any file not listed in the issue's "allowed paths" |

**Stop condition:** If any file is outside allowed scope → revert or unstage it before continuing. Never commit side-effect files from `npm install` or tooling.

### Step 3 — Inspect the actual patch

```bash
git diff origin/main...HEAD -- <each changed file>
```

Read every added and removed line. Do not rely on a summary of what you intended to write. Verify:

- No lines were accidentally removed or left over from a previous branch.
- No debug, placeholder, or TODO content survived.
- Imports match what is actually used.
- `data-testid` attributes are present on components that tests query by testid.

**Stop condition:** Any unintended line found → fix before declaring ready.

### Step 4 — Content and wording check

Controlled-pilot framing rules. Every string visible to users must satisfy all of the following:

| Rule | Forbidden | Required instead |
|------|-----------|-----------------|
| No platform-controlled money release | "деньги выпускаются", "выпуск денег", "платформа выплачивает" | "банковское событие", "банк направляет уведомление", "пилотный контур требует ручной сверки" |
| No final external facts stated as done | "ЭТрН подписан", "акт закрыт" (as current fact) | "ЭТрН ожидает подписи", "акт готовится" |
| No internal dev terms in user-facing text | "денежный guard", "money guard", "workaround", "TODO", "stub" | Descriptive Russian business language |
| No live-payment claims | "live-выплата", "боевой callback" | Pilot/simulation framing |
| No /demo/ hrefs in platform-v7 components | `href="/demo/..."` | `/platform-v7/...` paths only |

For handoff components specifically: a `sends` item must describe what the role *submits or forwards*, not what the platform decides. A `blockedBy` item must describe the missing document or fact, not a system state.

**Stop condition:** Any forbidden phrase found → fix and re-run tests before declaring ready.

### Step 5 — Vercel / CI check

After pushing:

1. Open the PR on GitHub.
2. Wait for Vercel Preview deployment to complete (or confirm no build errors in CI).
3. Confirm the deployment URL is accessible and the changed pages render without a crash.
4. Run the unit tests locally one final time:

```bash
cd apps/web && /home/user/pachanin-demo/node_modules/.bin/vitest run
```

All tests must pass. Zero failures, zero unexpected skips.

**Stop condition:** Any build error, runtime crash, or test failure → fix before marking the PR ready for review.

---

## Required report format

Before posting "ready for review" on any PR, produce this report internally and verify each item:

```
REVIEW GATE REPORT — PR #<number>
==================================
Step 1 — Changed files:
  <list every file, one per line>

Step 2 — Scope:
  All files in scope: YES / NO
  Out-of-scope files found: <list or "none">
  Action taken: <"none needed" or description of revert>

Step 3 — Patch inspection:
  Unintended lines found: YES / NO
  Action taken: <"none needed" or description of fix>

Step 4 — Wording:
  Forbidden phrases found: YES / NO
  Phrases checked: <list key phrases scanned>
  Action taken: <"none needed" or description of fix>

Step 5 — CI/tests:
  Unit tests: PASS (<N> tests) / FAIL
  Vercel build: OK / ERROR / PENDING
  Action taken: <"none needed" or description of fix>

FINAL DECISION: READY / NOT READY
Reason if NOT READY: <description>
```

Do not post "READY" until every field shows a passing result.

---

## Stop conditions summary

| Trigger | Required action |
|---------|----------------|
| File outside allowed scope detected | Unstage/revert the file; do not push until removed |
| Unintended line in patch | Fix the line; re-inspect the full diff |
| Forbidden wording in user-facing string | Replace with approved framing; re-run tests |
| Test failure after wording fix | Fix test assertion to match new approved wording |
| Vercel build error | Fix build; do not declare ready until green |
| Rebase brings in external changes | Re-run tests immediately after rebase; re-inspect diff |

---

## Lesson from PR #1062

PR #1062 introduced `RoleExecutionHandoff` across six platform-v7 pages. The PR was declared ready without inspecting the full patch. This caused two problems:

1. **Scope violation** — `npm install` (run to install `@testing-library/react`) modified `apps/web/public/mockServiceWorker.js`. This generated file was staged and committed because `git diff --name-only` was not checked before committing. The file had to be reverted in cleanup PR #1063.

2. **Forbidden wording** — Several handoff items in bank, disputes, and logistics used wording that implied platform-controlled money movement or stated external document states as confirmed facts. This violated controlled-pilot framing and required a second pass in #1063.

**Root cause:** Declaring "ready" based on what was *intended* rather than what was *actually in the patch*.

**Prevention:** Steps 1–3 of this gate exist specifically to catch side-effect files and content that does not match intent. Never skip them.

---

## Quick reference — running tests

```bash
# From repo root:
cd apps/web && /home/user/pachanin-demo/node_modules/.bin/vitest run

# Check only platform-v7 handoff tests:
cd apps/web && /home/user/pachanin-demo/node_modules/.bin/vitest run tests/unit/roleExecutionHandoff.test.tsx
```

Expected output: all tests pass, exit code 0.
