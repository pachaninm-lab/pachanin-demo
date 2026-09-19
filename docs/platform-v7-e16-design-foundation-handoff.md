# platform-v7 E1.6/E2 design foundation handoff

Generated: 2026-04-26
Branch: `feat/e16-source-of-truth-design-foundation`
PR: #169

## Progress

- Overall platform-v7 Production Polish: **15.6% done / 84.4% remaining**.
- E1.6/E2 design foundation slice: **85% done / 15% remaining** before this handoff note.

This note documents the design-system foundation. It does not claim production readiness.

## What is now part of the design foundation

### Tokens

```text
apps/web/lib/platform-v7/design/tokens.ts
```

Defines semantic tokens for:

- core surfaces;
- borders;
- text;
- brand;
- money;
- evidence;
- integration;
- success;
- warning;
- danger;
- spacing;
- radius;
- typography;
- shadows;
- z-index.

### Contrast helpers

```text
apps/web/lib/platform-v7/design/contrast.ts
```

Defines:

- `relativeLuminance()`
- `contrastRatio()`
- `meetsWcagAaText()`
- `meetsWcagAaLargeTextOrUi()`

### UI primitives

```text
apps/web/components/platform-v7/P7Badge.tsx
apps/web/components/platform-v7/P7Card.tsx
apps/web/components/platform-v7/P7MetricCard.tsx
apps/web/components/platform-v7/P7MetricLinkCard.tsx
```

Current intended use:

- `P7Badge` — statuses and compact semantic indicators.
- `P7Card` — standard surface for platform cards and panels.
- `P7MetricCard` — KPI and metric cards.
- `P7MetricLinkCard` — linked KPI cards with formula/title support.

## Current migrated surfaces

### `DomainControlTowerSummary`

Migrated from local `StatCard` to `P7MetricLinkCard`.

Canonical KPI cards now use semantic tones:

- money at risk → `danger`
- hold → `danger`
- ready to release → `success`
- integration stops → `integration`
- transport stops → `warning`
- reserve → `money`

### `ControlTowerOperatorPanel`

Migrated to:

- `P7Card`
- `P7Badge`
- `PLATFORM_V7_TOKENS`

Preserved behavior:

- unblock action;
- action log;
- simulated bank callback;
- blocked amount calculation.

## Tests

```text
apps/web/tests/unit/platformV7Design.test.tsx
apps/web/tests/unit/p7MetricLinkCard.test.tsx
```

Covered:

- stable semantic colors;
- tone tokens;
- spacing/radius/typography values;
- contrast helpers;
- base text AA checks;
- semantic tone UI-AA checks;
- badge/card/metric-card rendering;
- metric link wrapper.

## Current deploy status before this note

Last verified commit before this handoff:

```text
bcc54e8457ca39d6b4c0d44181bcd8bc97902fba
```

Status:

- GitHub Actions CI — success;
- Repo automations — success;
- Labeler — success;
- Vercel deployment — READY.

Preview:

```text
pachanin-canonical-qe4y68yu2-pachaninm-3368s-projects.vercel.app
```

## Next safe steps

1. Add page/shell primitives:
   - `P7Page`
   - `P7Section`
   - `P7Toolbar`
2. Move Control Tower page-level layout to `P7Page/P7Section`.
3. Then migrate Hotlist / deal lists / dispute cards to P7 primitives.
4. Only after visual primitives stabilize, remove old duplicated inline style patterns.

## Explicit non-claims

- This does not introduce live integrations.
- This does not rewrite runtime stores.
- This does not change business logic.
- This does not make the platform production-ready.
