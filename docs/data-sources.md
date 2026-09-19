# platform-v7 data sources

Generated: 2026-04-24
Repo: `pachaninm-lab/pachanin-demo`
App contour: `apps/web`

## Purpose

This document records the current dispersed data sources before E1 Unified Data Layer. It is the working baseline for removing KPI drift, duplicate deal fixtures and hidden mock stores.

## Search signals already found

Search term `DL-9` appears in these relevant areas:

| Source | Path | Risk |
|---|---|---|
| v7r data | `apps/web/lib/v7r/data.ts` | likely primary UI fixture source; must be audited before E1 |
| MSW handlers | `apps/web/mocks/handlers.ts` | mock API source; must not duplicate business facts after E1 |
| JSON deals fixtures | `apps/web/mocks/fixtures/deals.json` | explicit deal fixture file; candidate for migration into domain fixtures |
| JSON disputes fixtures | `apps/web/mocks/fixtures/disputes.json` | dispute fixture source |
| JSON bank events fixtures | `apps/web/mocks/fixtures/bank-events.json` | money/bank event source |
| JSON batches fixtures | `apps/web/mocks/fixtures/batches.json` | physical batch / lot-like data |
| JSON RFQ fixtures | `apps/web/mocks/fixtures/rfq.json` | procurement/RFQ fixture source |
| field store | `apps/web/stores/useFieldRuntimeStore.ts` | runtime store; may create local state drift |
| commercial store | `apps/web/stores/useCommercialRuntimeStore.ts` | lots/RFQ/commercial runtime; must be reconciled with domain store |
| shared runtime | `shared/runtime-store.ts` | shared runtime source |
| shared snapshot | `shared/runtime-snapshot.ts` | snapshot source; potential duplicate source of truth |
| pilot data | `apps/web/lib/pilot-data.ts` | pilot fixture source; must be classified as pilot/demo/mock |
| pilot runtime server | `apps/web/lib/pilot-runtime-server.ts` | server-side pilot data access |
| runtime server/client | `apps/web/lib/runtime-server.ts`, `apps/web/lib/runtime-client.ts` | runtime data bridge |
| tambov fixtures | `config/fixtures/tambov-pilot-fixtures.json` | pilot cluster fixtures |

## Other search signals

Search term `LOT-` appears in:

| Source | Path | Risk |
|---|---|---|
| API lots route | `apps/web/app/api/lots/route.ts` | local API fixture / proxy risk |
| API lots service | `apps/api/src/modules/lots/lots.service.ts` | backend/API source |
| commercial store | `apps/web/stores/useCommercialRuntimeStore.ts` | client runtime state |
| pilot data | `apps/web/lib/pilot-data.ts` | pilot source |
| lots server | `apps/web/lib/lots-server.ts` | server-side lots source |
| v7r data | `apps/web/lib/v7r/data.ts` | UI fixture source |
| tambov fixtures | `config/fixtures/tambov-pilot-fixtures.json` | pilot fixture source |

## Initial classification

| Class | Paths | E1 decision |
|---|---|---|
| UI fixture / demo data | `apps/web/lib/v7r/data.ts`, `apps/web/lib/pilot-data.ts` | migrate canonical entities into `/apps/web/src/domain/fixtures` or agreed domain path; leave UI-only view models separate |
| MSW/API mock | `apps/web/mocks/handlers.ts`, `apps/web/mocks/fixtures/*.json` | handlers should read from domain fixtures or simulate transport only |
| Client runtime stores | `apps/web/stores/useFieldRuntimeStore.ts`, `apps/web/stores/useCommercialRuntimeStore.ts` | keep UI/session state only; no independent deal/money truth |
| Shared runtime | `shared/runtime-store.ts`, `shared/runtime-snapshot.ts` | verify if production API/API package depends on them before moving |
| Backend-like API | `apps/api/src/**`, `apps/web/app/api/**` | should not silently diverge from web domain fixtures in demo mode |
| Pilot configuration | `config/fixtures/tambov-pilot-fixtures.json`, `config/modes/*.env.example` | keep as pilot seed/config, not UI hardcoded truth |

## Canonical E1 target

Create a single domain layer for web runtime:

```text
apps/web/src/domain/
  types/
  fixtures/
  store/
  actions/
  kpi/
  money/
  quality/
```

If repository convention prefers `apps/web/lib/domain/` over `apps/web/src/domain/`, document the decision in the E1 report before moving code.

## Required entities for E1

- deals
- lots
- disputes
- counterparties
- money / ledger
- transport
- users / roles
- quality
- documents

## Hard rules for E1

1. No page or component should own canonical deal facts.
2. MSW should simulate transport, not define a second business truth.
3. `DL-*`, `LOT-*`, `DK-*`, `FAC-*` hardcoded strings in components should trend to zero.
4. KPI functions must be pure and tested.
5. Store writes must create action log events when they change money/status/dispute state.

## Verification commands for E1

```bash
grep -r "DL-9" apps/web --include="*.ts*" -n
grep -r "LOT-" apps/web --include="*.ts*" -n
grep -r "DK-2024" apps/web --include="*.ts*" -n
grep -r "FAC-" apps/web --include="*.ts*" -n
grep -r "fixtures\|mock\|seed\|data" apps/web -n
pnpm --filter @pc/web test
pnpm --filter @pc/web build
```

## E0 limitation

This map is based on GitHub code search, not a full local clone. It must be expanded by Codex/local CI using `find`, `tree`, `grep`, build and test output.
