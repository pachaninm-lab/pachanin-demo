# Platform v7 operational status

Date: 2026-04-24

## Current production baseline

Main commit: `6265dfcb3b97563266a15d9180a01a30fab99b90`

Production deploy status:

- `pachanin-canonical-web`: success
- `pachanin-demo-api`: success
- `pachanin-demo-api-ovdc`: success

Public web URL:

- `https://pachanin-web.vercel.app`

## Active smoke coverage

### Production Smoke

Runs:

- manually through GitHub Actions;
- automatically at `06:15`, `10:15`, `14:15`, `18:15` UTC.

Checks:

- critical `platform-v7` routes;
- HTTP response;
- rendered body size;
- basic Next.js/HTML response shape.

### Mobile Smoke

Runs:

- manually through GitHub Actions;
- automatically at `06:45`, `10:45`, `14:45`, `18:45` UTC.

Checks:

- critical `platform-v7` routes at 375px viewport;
- horizontal overflow;
- visible brand/header;
- broken visible images.

## Critical routes

- `/platform-v7`
- `/platform-v7/control-tower`
- `/platform-v7/deals`
- `/platform-v7/deals/DL-9102`
- `/platform-v7/buyer`
- `/platform-v7/compliance`
- `/platform-v7/field`
- `/platform-v7/disputes/DK-2024-89`

## Recently closed runtime gaps

- Buyer: crop filters, sorting, price per tonne, quality risk in cards.
- Compliance: actor filter, date range filter, filtered CSV export.
- Field: role preview for operator/admin, driver route progress, persistent offline queue.
- Dispute detail: downloadable evidence pack.
- Control Tower: Russian-facing copy for transport, checks and money release wording.
- Help/status/not-found/shell copy: guarded against old mixed-language copy.

## Automation added

- `scripts/smoke-web.mjs`
- `scripts/smoke-check.mjs`
- `.github/workflows/production-smoke.yml`
- `.github/workflows/mobile-smoke.yml`
- `apps/web/playwright.production.config.ts`
- `apps/web/tests/e2e/platform-v7-mobile-smoke.spec.ts`
- `apps/web/tests/e2e/platform-v7-visual-smoke.spec.ts`

## Cleaned up PR queue

The old PR queue was closed or neutralized. Do not merge these old branches back into main without fresh rebase and review:

- `#4`: old startup/layout state.
- `#7`: old ops/n8n pack, not runtime-critical.
- `#9`: old platform-v4 handoff.
- `#11`: old middleware patch, superseded by current main.
- `#22`: large conflict PR. Relevant pieces were extracted through small PRs; full merge is unsafe.

## Rule for future changes

1. Do not merge runtime work while production web/API deploy is pending or red.
2. Keep every change small and route-scoped.
3. Run or wait for Production Smoke and Mobile Smoke after meaningful deploys.
4. If smoke is red, fix the failing route first.
5. Do not revive old PRs unless they are recreated from current green main.
