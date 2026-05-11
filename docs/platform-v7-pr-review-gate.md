# Platform-v7 PR Final Review Gate

Applies to every PR that touches platform-v7 code, tests, or docs.

This protocol exists because PR #1062 was initially treated as ready before the actual patch was fully clean. The final merge was safe only after manual patch inspection, removal of generated/public file drift, wording cleanup in bank/disputes/logistics, and updated tests.

## Mandatory sequence

Do not call a PR ready until every step below is complete.

### 1. Changed files first

List every changed file before reviewing intent.

```bash
git diff --name-only origin/main...HEAD
```

A PR is not ready if any file appears outside the task scope.

Allowed by default:

- `apps/web/app/platform-v7/**`
- `apps/web/components/platform-v7/**`
- `apps/web/components/v7r/**`
- `apps/web/lib/platform-v7/**`
- `apps/web/lib/domain/**`
- `apps/web/tests/**`
- `docs/**`

Hard stop unless the task explicitly expands scope:

- `apps/landing/**`
- `apps/web/public/**`
- generated worker files
- global CSS files
- lock files or package files caused by tooling side effects
- any route or component outside platform-v7 scope

### 2. Scope check

For each changed file, write one of:

- in scope
- out of scope and reverted
- intentionally expanded by the issue

If an out-of-scope file exists, stop. Revert it before any claim that the PR is ready.

### 3. Actual patch inspection

Inspect the actual patch, not the PR body.

```bash
git diff origin/main...HEAD -- <file>
```

Check every added and removed line for:

- accidental generated-file drift
- stale branch leftovers
- copy copied from old PRs
- deleted imports that are still needed
- new imports that are unused
- links to `/platform-v7/demo/`
- user-visible internal implementation words
- wording that exceeds controlled-pilot status

The actual patch is the source of truth. If PR body and patch disagree, patch wins.

### 4. Controlled-pilot wording check

Platform-v7 must not claim more than controlled-pilot / pre-integration status.

Use cautious wording:

- `пилотный контур`
- `пилотный сценарий`
- `ожидает банковского подтверждения`
- `банковское событие`
- `ручная сверка`
- `пилотный протокол качества`
- `лабораторный контур качества`
- `причина остановки`
- `ответственный`
- `удержание`
- `проверка выплаты`

Do not use user-facing claims that imply:

- production or fully live status
- completed external integration without proof
- platform-controlled payment action
- final external document confirmation without live proof
- automatic resolution of bank, dispute, logistics, or document conditions

Role pages must explain execution state, next actor, missing document, and effect on money without implying the platform itself controls bank-side money movement.

### 5. Tests and Vercel

Before merge:

```bash
cd apps/web && vitest run
```

Or, for a narrow PR, run the relevant file-level test and state the exact command.

Then wait for Vercel checks:

- `pachanin-canonical-web`
- `pachanin-demo-api`
- `pachanin-demo-api-ovdc`
- `pachanin-demo-landing`

A PR is not ready while any required check is pending or failing.

## Required report format

Every future platform-v7 PR must include this report before merge:

```text
REVIEW GATE REPORT — PR #<number>

1. Changed files:
   - <file>

2. Scope:
   All files in allowed scope: YES / NO
   Out-of-scope files reverted: YES / NO / N/A

3. Actual patch:
   Actual patch inspected: YES / NO
   Unintended lines found: YES / NO
   Action taken: <summary>

4. Controlled-pilot wording:
   User-facing wording checked: YES / NO
   Overclaim found: YES / NO
   Action taken: <summary>

5. Tests and Vercel:
   Tests run: <command or N/A with reason>
   Test result: PASS / FAIL / N/A
   Vercel result: GREEN / PENDING / FAIL

Final decision:
   READY / NOT READY
```

Do not write READY unless every answer above is clean.

## Stop conditions

| Trigger | Required action |
|---|---|
| File outside allowed scope | Revert before continuing |
| Generated/public file drift | Revert before continuing |
| Actual patch differs from PR body | Fix body or patch; patch remains source of truth |
| User-facing overclaim | Replace with controlled-pilot wording |
| Old stale PR wording reappears | Remove and rebuild from current main |
| Vercel pending | Wait; do not merge |
| Vercel failed | Debug and fix before merge |
| Tests failed | Fix code or test before merge |

## Lesson from PR #1062

PR #1062 was useful, but it exposed two process risks:

1. A generated/public file appeared because tooling changed it during the test run.
2. Some role-handoff lines initially used wording that was too strong for controlled-pilot framing.

Both were caught only by inspecting changed files and the actual patch. The final merge happened only after the generated/public file was removed, bank/disputes/logistics wording was corrected, and tests were updated to guard against old wording.

## Quick commands

```bash
git diff --name-only origin/main...HEAD
git diff origin/main...HEAD
cd apps/web && vitest run
cd apps/web && vitest run tests/unit/roleExecutionHandoff.test.tsx
```
