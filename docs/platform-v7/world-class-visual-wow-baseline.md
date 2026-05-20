# Platform-v7 Visual Wow Core — PR-0 baseline

Status: inventory-only baseline. PR-0 must not change UI, routes, domain logic, MoneyTree, data-testid, backend, database, auth, RBAC, packages, lock files, or landing.

Base commit reviewed: `56a66b0ff56f2e3a74da9da2c1dfd3e1acc5e4ee`.

## Scope

Platform-v7 remains a controlled-pilot / pre-integration execution contour for an off-exchange grain deal. Follow-up work must improve clarity and visual quality without implying live external confirmations or production maturity.

Allowed follow-up zones:

- `apps/web/app/platform-v7`
- `apps/web/components/platform-v7`
- `apps/web/components/v7r`
- `apps/web/lib/platform-v7`
- `apps/web/lib/domain`
- `apps/web/tests`
- `docs`
- `apps/web/styles/platform-v7-final-polish.css` only when strictly scoped to platform-v7

Blocked unless separately approved:

- `apps/landing`
- backend, database, migrations, live integrations
- MoneyTree domain invariants
- auth/RBAC core
- existing `data-testid` contracts
- package and lock files

## Real shell and design foundation observed

The current platform-v7 codebase already contains a real shell and visual foundation:

- `apps/web/app/platform-v7/layout.tsx`
- `apps/web/components/v7r/AppShellV4.tsx`
- `apps/web/components/platform-v7/MoneySpineStrip.tsx`
- `apps/web/components/platform-v7/CommandPalette.tsx`
- `apps/web/components/v7r/CommandPalette.tsx`
- `apps/web/components/v9/layout/IdentityControl.tsx`
- `apps/web/styles/platform-v7-final-polish.css`

Conclusion: follow-up Visual Wow work must extend the current shell and primitives. It must not rewrite AppShell from scratch.

## Existing component base observed

Existing platform-v7 assets include:

- `P7Card.tsx`
- `P7UiPrimitives.tsx`
- `BatonStrip.tsx`
- `ReleasePipelineStrip.tsx`
- `MoneySpineStrip.tsx`
- `RoleLensGate.tsx`
- `DealSeal.tsx`
- `ControlTowerOperatorPanel.tsx`
- `ExecutionSimulationActionPanel.tsx`

Conclusion: do not create a second design system. New visual intelligence components must reuse or complement these assets.

## Observed role and route surfaces

Observed route/page surfaces include at least:

- `/platform-v7`
- `/platform-v7/deals`
- `/platform-v7/deals/[id]/clean`
- `/platform-v7/bank`
- `/platform-v7/bank/release-safety`
- `/platform-v7/surveyor`

Follow-up route inventory must verify seller, buyer, logistics, driver/field, elevator, lab, arbitrator, compliance, executive, investor, support, help, profile, connectors, integrations, audit-log, lots, and RFQ surfaces before broad edits.

## Money, bank, documents, evidence, journal baseline

Existing signals:

- `MoneySpineStrip` gives role-filtered reserve / hold / dispute visibility.
- `ReleasePipelineStrip` gives deterministic gates around FGIS, lab, weight, EDO, dispute, and bank release-safety.
- `DealSeal` is a platform record, not a payment instrument.
- `BatonStrip` supports role handoff clarity.
- `RoleLensGate` supports role-aware visibility.
- Existing tests include platform-v7 design and lexicon coverage.

Conclusion: Cause-to-Money work should connect existing assets instead of inventing parallel money semantics.

## Visual Intelligence Layer rules

Follow-up components must be presentational-first:

- receive props only;
- do not fetch;
- do not mutate domain state;
- do not create new business statuses;
- do not alter MoneyTree invariants;
- do not imply live external confirmation;
- degrade cleanly on 390x844 mobile;
- preserve existing data-testid values.

## Mobile risk map

Mandatory viewport: 390x844.

Risk zones:

- sticky header and money strip stacking;
- role selector / identity menu width;
- command palette on narrow screens;
- bottom action dock overlap;
- long deal IDs, amounts, routes, and document names;
- bank release-safety pipeline compression;
- driver and field screens must avoid bank / investor / general-money leakage;
- timeline and evidence sections must collapse instead of causing horizontal overflow.

Hard invariant: document width must not exceed viewport width.

## Follow-up PR order

PR-1: Visual primitives — DealStatusEdge, TrustDot, SmartSectionSummary, DocumentImpactChip, ProofRibbon.

PR-2: Execution Header — extend the current shell/header pattern; do not rewrite AppShell.

PR-3: Deal Workspace Core — CauseLine, MoneyLockHalo, UnlockPath, DealMiniMap, FocusDetailMode, MagneticActionDock.

PR-4: Timeline and Evidence — EvidenceStrengthMeter, TimelineChapters, TimelineWithImpact, proof/evidence gap summaries.

PR-5: Role Cockpit Pass — use existing role boundaries; driver stays field-grade; bank stays clean basis/amount/documents/risk/journal.

PR-6: Mobile Field Pass — 390x844, no horizontal overflow, bottom action dock, compact cards.

PR-7: System Pages Pass — lots, control-tower, disputes, connectors, integrations, audit-log, investor, help, profile, not-found.

PR-8: Action Preview / Receipt — preview before important action, receipt after action, journal feedback, no fake external confirmation.

PR-9: Copy / Trust / Maturity Cleanup — remove visible dev/fake-live language while preserving an honest pre-integration trust layer.

PR-10: QA / Tests — route smoke, mobile overflow, single primary CTA, role leakage, driver isolation, bank language, trust markers, action preview/receipt.

## PR-0 merge gate

PR-0 is valid only if the diff contains exactly:

`docs/platform-v7/world-class-visual-wow-baseline.md`

Any UI, route, CSS, test, domain, package, lock, or landing change in PR-0 is invalid.

## Progress accounting

This PR only closes the factual baseline step.

- Before PR-0: 72.4% confirmed.
- After PR-0 branch and PR creation: 72.7% prepared in GitHub.
- After merge and green checks: 72.9% confirmed.

Do not raise confirmed progress above 72.9% from PR-0 alone.
