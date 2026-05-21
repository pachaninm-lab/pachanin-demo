# Platform V7 PR Stack Handoff · 2026-05-16

This handoff documents the local reviewable stack for `platform-v7` / `Прозрачная Цена`.

Current top branch:

- `test/platform-v7-qa-public-smoke-20260515`
- current head: see `git log --oneline --decorate --max-count=12`
- base: `origin/main` at `4ddeb7ef`

GitHub push is blocked in this environment because HTTPS credentials are unavailable:

- `fatal: could not read Username for 'https://github.com': Device not configured`

Local executable JS checks are also blocked because this clone has no package manager binary or `node_modules`:

- missing: `pnpm`, `npm`, `yarn`, `bun`, `corepack`, `vitest`, `playwright`, `tsc`
- available: bundled `node`

## PR 1 — Freeze Platform V7 Execution Surface

Branch:

- `audit/platform-v7-execution-freeze-20260515`

Commit:

- `1bba03f1 docs(platform-v7): freeze execution surface and pr map`

Summary:

- Captures the current `main` baseline.
- Inventories open PRs and marks old visual work as non-merge candidates unless revalidated.
- Documents route, shell, component and visual-system map for platform-v7.
- Identifies clear duplicate PR candidates only after diff comparison.

Changed files:

- `docs/platform-v7-execution-freeze-2026-05-15.md`

Checks run:

- GitHub API PR inventory.
- Local branch/base inspection.
- Static diff comparison for selected old visual PRs.

Risk:

- Documentation-only.

## PR 2 — Design System Foundation

Branch:

- `feat/platform-v7-design-foundation-20260515`

Commit:

- `25a9d27e feat(platform-v7): add grain execution design foundation`

Summary:

- Adds the shared light-first execution design system.
- Defines role labels, status tones, operational card grammar, action labels and required mobile viewports.
- Adds reusable canvas, grid, KPI, status badge, action and operational-card components.
- Keeps dark mode explicit, not default.

Changed files:

- `apps/web/components/platform-v7/ExecutionDesignSystem.module.css`
- `apps/web/components/platform-v7/ExecutionDesignSystem.tsx`
- `apps/web/lib/platform-v7/design/execution-cockpit.ts`
- `apps/web/tests/unit/platformV7ExecutionDesignSystem.test.tsx`

Checks run:

- `git diff --check`
- Static scan of touched UI/model files for maturity/payment overclaim copy.

Risk:

- New components and model only; no existing route behavior changed in this PR.

## PR 3 — Shell/Header Consolidation

Branch:

- `feat/platform-v7-shell-consolidation-20260515`

Commit:

- `38a9835d feat(platform-v7): consolidate light execution shell`

Summary:

- Makes `AppShellV4` light-first by default.
- Keeps dark mode only when explicitly stored with the current light-default version marker.
- Compacts header offsets on desktop, mobile and low-height screens.
- Hides non-critical meta pressure on mobile.

Changed files:

- `apps/web/components/v7r/AppShellV4.tsx`
- `apps/web/tests/unit/platformV7LightThemeDefault.test.ts`

Checks run:

- `git diff --check`
- Static source review.

Risk:

- Shell defaults and header spacing are visible across platform-v7.
- Existing stored dark preference is version-gated to avoid stale dark-first UI.

## PR 4 — Primary Role Unification

Branch:

- `feat/platform-v7-primary-role-unification-20260515`

Commit:

- `4139b140 feat(platform-v7): unify primary execution roles`

Summary:

- Adds a shared role execution cockpit model and renderer.
- Unifies seller, buyer, operator/control-tower, bank and compliance around the same five-second role grammar.
- Removes local hero/metric duplication from seller, buyer and bank entry screens.
- Keeps bank language limited to status, basis, documents, hold and stop reason.

Changed files:

- `apps/web/app/platform-v7/bank/page.tsx`
- `apps/web/app/platform-v7/buyer/page.tsx`
- `apps/web/app/platform-v7/compliance/page.tsx`
- `apps/web/app/platform-v7/control-tower/page.tsx`
- `apps/web/app/platform-v7/seller/page.tsx`
- `apps/web/components/platform-v7/RoleExecutionCockpit.tsx`
- `apps/web/lib/platform-v7/role-execution-cockpit.ts`
- `apps/web/tests/e2e/platform-v7-buyer-cockpit-pass.spec.ts`
- `apps/web/tests/e2e/platform-v7-seller-cockpit-pass.spec.ts`
- `apps/web/tests/unit/buyerExecutionPolish.test.tsx`
- `apps/web/tests/unit/platformV7PrimaryRoleCockpit.test.tsx`
- `apps/web/tests/unit/sellerExecutionPolish.test.tsx`

Checks run:

- `git diff --check`
- Static source scan for changed UI/model files.
- Unit/e2e expectation updates reviewed against visible copy.

Risk:

- High visual impact on primary role first screens.
- Existing detailed strips/lists remain below the new cockpit, reducing workflow disruption.

## PR 5 — Operational Role Unification

Branch:

- `feat/platform-v7-operational-role-unification-20260515`

Commit:

- `136f344b feat(platform-v7): unify operational execution roles`

Summary:

- Extends the shared cockpit model to logistics, driver, elevator, lab, surveyor, arbitrator and executive.
- Replaces scattered role hero sections with the same visual and content grammar.
- Keeps driver ultra-simple: one trip, one main action, offline queue, GPS, photo, seal and weight.
- Removes driver-visible bank/investor/control/cross-deal language from the field page.

Changed files:

- `apps/web/app/platform-v7/arbitrator/page.tsx`
- `apps/web/app/platform-v7/bank/grain/page.tsx`
- `apps/web/app/platform-v7/driver/field/page.tsx`
- `apps/web/app/platform-v7/elevator/grain/page.tsx`
- `apps/web/app/platform-v7/elevator/page.tsx`
- `apps/web/app/platform-v7/executive/page.tsx`
- `apps/web/app/platform-v7/lab/page.tsx`
- `apps/web/app/platform-v7/logistics/grain/page.tsx`
- `apps/web/app/platform-v7/logistics/page.tsx`
- `apps/web/app/platform-v7/roles/page.tsx`
- `apps/web/app/platform-v7/surveyor/page.tsx`
- `apps/web/lib/platform-v7/role-execution-cockpit.ts`
- `apps/web/tests/e2e/platform-v7-driver-field-mobile-pass.spec.ts`
- `apps/web/tests/e2e/platform-v7-mobile-smoke.spec.ts`
- `apps/web/tests/e2e/platform-v7-role-leakage-deep.spec.ts`
- `apps/web/tests/e2e/platform-v7-route-audit.spec.ts`
- `apps/web/tests/e2e/platform-v7-visual-smoke.spec.ts`
- `apps/web/tests/unit/arbitratorDecisionPolish.test.tsx`
- `apps/web/tests/unit/bankRoutes.test.tsx`
- `apps/web/tests/unit/driverFieldShellPolish.test.tsx`
- `apps/web/tests/unit/elevatorExecutionPolish.test.tsx`
- `apps/web/tests/unit/labQualityPolish.test.tsx`
- `apps/web/tests/unit/logisticsExecutionPolish.test.tsx`
- `apps/web/tests/unit/platformV7DriverRoleIsolation.test.ts`
- `apps/web/tests/unit/platformV7OperationalRoleCockpit.test.tsx`
- `apps/web/tests/unit/surveyorEvidencePolish.test.tsx`

Checks run:

- `git diff --check`
- Driver source scan for cross-role language.
- Stale visible-copy checks updated for operational roles.

Risk:

- High visual impact on operational entry screens.
- Field-role isolation is intentionally stricter for the driver page.

## PR 6 — Mobile Excellence Gates

Branch:

- `feat/platform-v7-mobile-excellence-20260515`

Commit:

- `545ac68b test(platform-v7): expand mobile execution viewport gates`

Summary:

- Expands mobile coverage to the required viewport set.
- Adds compact header assertions across primary execution routes.
- Adds driver primary-action visibility checks across mobile, landscape and low-height desktop.

Changed files:

- `apps/web/tests/e2e/platform-v7-mobile-excellence-pass.spec.ts`

Checks run:

- `git diff --check`
- Static Playwright spec review.

Risk:

- Test-only.
- The new coverage may expose existing low-height/header issues in CI.

## PR 7 — QA/Public Smoke

Branch:

- `test/platform-v7-qa-public-smoke-20260515`

Commits:

- `b5293abe test(platform-v7): broaden public smoke execution coverage`
- `de2662e0 fix(platform-v7): avoid nested execution main landmarks`
- `09a26baa fix(platform-v7): remove cockpit jargon from executive copy`
- this handoff document commit

Summary:

- Expands public smoke to seller, buyer, logistics, driver, elevator, lab, surveyor, bank, executive and grain release.
- Keeps screenshot artifacts in the smoke run.
- Adds public smoke audit assertions for the expanded route set and stricter copy guard terms.
- Changes `ExecutionCanvas` from a nested landmark to a section-level canvas.
- Removes internal shorthand from executive cockpit copy.

Changed files:

- `apps/web/components/platform-v7/ExecutionDesignSystem.tsx`
- `apps/web/lib/platform-v7/role-execution-cockpit.ts`
- `apps/web/tests/e2e/platform-v7-public-smoke.spec.ts`
- `apps/web/tests/unit/platformV7ExecutionDesignSystem.test.tsx`
- `apps/web/tests/unit/platformV7PublicSmoke.test.ts`

Checks run:

- `git diff --check origin/main..HEAD`
- Static scan of touched cockpit files for maturity/payment overclaim copy.
- Static scan for stale executive shorthand in touched files.

Risk:

- Mostly test and semantic markup.
- Public smoke route expansion can surface deployed-route regressions once CI runs.

## Global Notes

- `apps/landing` was not touched.
- Root and app package manifests and lock files were not modified.
- Deployment config was not modified.
- `public/generated` was not touched.
- The final local stack is clean with `git status --short`.
- Full CI, PR creation and canonical deploy verification still require GitHub credentials and installed JS dependencies.
