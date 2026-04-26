# platform-v7 E1.4/E2 handoff

Generated: 2026-04-26
Branch: `feat/canonical-platform-task-v2`
PR: #168

## Progress

- E0/E1 foundation: **100% done / 0% remaining**.
- E1.4/E2 incremental block: **100% done / 0% remaining for this PR scope**.

This is not the full production-polish program. This PR closes the canonical domain/KPI/registry foundation and prepares the next migration PR.

## What is now canonical

### Domain

Canonical layer lives under:

```text
apps/web/lib/platform-v7/domain/
```

Key files:

- `canonical.ts`
- `types.ts`
- `status-mapper.ts`
- `legacy-deal-adapter.ts`
- `domain-deal-adapter.ts`
- `money.ts`
- `kpi.ts`
- `selectors.ts`
- `audit.ts`
- `rbac.ts`
- `index.ts`

### Registry

Canonical read-only registry lives at:

```text
apps/web/lib/domain/canonicalRegistry.ts
```

It currently builds from existing `DomainDeal` fixtures and returns:

- canonical deals;
- canonical Control Tower KPI;
- canonical Investor KPI.

### Hooks

Registry-backed canonical hooks live at:

```text
apps/web/lib/domain/canonicalHooks.ts
```

Current hooks:

- `useCanonicalRegistryDeals()`
- `useCanonicalRegistryControlTowerKpis()`
- `useCanonicalRegistryInvestorKpis()`

## Control Tower status

`DomainControlTowerSummary` now uses registry-backed canonical KPI for:

- `В резерве`
- `Под удержанием`
- `К выпуску`
- `Деньги под риском`

It still uses the legacy KPI path for:

- `Интеграционные стопы`
- `Транспортные стопы`
- `SLA срочно`

These should migrate in the next PR after equivalent canonical definitions are added.

## Risk KPI decision

Old Control Tower risk formula used:

```text
holdAmount + 10% of reservedAmount for deals with hold/dispute
```

Canonical ledger-level risk remains event-based and narrower. For Control Tower, this PR adds:

```text
calculateControlTowerMoneyAtRisk()
```

This keeps the operator KPI conservative and prevents risk understatement.

## Verification added

Tests added or expanded:

- `apps/web/tests/unit/platformV7CanonicalDomain.test.ts`
- `apps/web/tests/unit/domainSelectors.test.ts`
- `apps/web/tests/unit/platformV7Command.test.ts`
- `apps/web/tests/unit/canonicalKpiDiff.test.ts`
- `apps/web/tests/unit/riskKpiMigrationSafety.test.ts`
- `apps/web/tests/unit/canonicalFixtureRegistry.test.ts`

## CI status before handoff

Last verified before this handoff note:

- `typecheck` — success
- `test` — success
- `build` — success
- main `CI` — success
- `Node CI` — success

## Next PR scope

Do not keep expanding PR #168 indefinitely. Next PR should be separate and focused:

### E1.5 — fixture/runtime migration

1. Create a canonical fixture source path.
2. Move current runtime `DomainDeal` fixture transformation into that source.
3. Keep old selectors as compatibility adapters.
4. Add regression tests proving old UI totals equal registry totals where formulas are intentionally identical.
5. Migrate integration stops, transport stops and SLA critical to canonical definitions.
6. Only then remove duplicated fixture logic.

## Do not do yet

- Do not delete old fixtures in the same PR.
- Do not claim live integrations.
- Do not claim production readiness.
- Do not switch runtime stores before regression tests exist.
- Do not change money-action behavior until E2 state-machine actions and audit events are wired.
