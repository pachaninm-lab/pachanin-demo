# platform-v7 E1.5 fixture source handoff

Generated: 2026-04-26
Branch: `feat/canonical-platform-task-v2`
PR: #168

## Progress

E1.5 fixture/runtime migration slice: **100% done / 0% remaining for this PR scope**.

This does not remove old fixtures yet. It creates the safe bridge needed before deleting or rewriting any legacy runtime data.

## What changed

### Runtime fixture source

Added:

```text
apps/web/lib/domain/fixtureSource.ts
```

It builds a read-only fixture source from the existing runtime data:

- `DEALS`
- `DISPUTES`

and adapts them into:

- `DomainDeal[]`
- `DomainDispute[]`

### Canonical registry source

Updated:

```text
apps/web/lib/domain/canonicalRegistry.ts
```

It now builds from `runtimeFixtureSource`, not directly from selector-level `domainDeals`.

### Domain selectors source

Updated:

```text
apps/web/lib/domain/selectors.ts
```

`domainDeals` and `domainDisputes` now read from `runtimeFixtureSource`.

Compatibility runtime selectors are preserved:

- `selectRuntimeDeals()`
- `selectRuntimeDisputes()`
- `selectRuntimeRfqs()`
- `selectRuntimeCallbacks()`
- `selectRuntimeNotifications()`
- `selectRuntimeNotificationGroups()`

## Verification

Added:

```text
apps/web/tests/unit/runtimeFixtureBridge.test.ts
```

It verifies:

- `domainDeals` equals `runtimeFixtureSource.deals`;
- `domainDisputes` equals `runtimeFixtureSource.disputes`;
- selector counters stay aligned with `runtimeFixtureSource`.

## CI status before this handoff

Last verified before this note:

- `typecheck` — success
- `test` — success
- `build` — success
- main `CI` — success
- `Node CI` — success

## What remains for next PR

### E1.6 / E2 source-of-truth migration

1. Move runtime fixture construction out of `v7r/data` into a canonical fixture package/file.
2. Keep `v7r/data` as compatibility/export layer during migration.
3. Add canonical definitions for:
   - integration stops;
   - transport stops;
   - SLA critical.
4. Replace remaining legacy Control Tower KPI dependencies after equivalent canonical definitions exist.
5. Add regression tests proving old screens remain stable.
6. Only after that remove duplicated fixture logic.

## Explicit non-claims

- Old fixtures were not deleted.
- Runtime stores were not rewritten.
- Live integrations were not claimed.
- Production readiness was not claimed.
