# platform-v7 reality audit — 2026-06-23

Linked queue: #1974, #1984, #1981, #1982, #1976, #1978, #1979.

## Status truth

platform-v7 must stay labelled as **controlled-pilot / pre-integration** until runtime layers are proven. The public entry currently uses controlled-pilot language and explicitly says bank, EDO and FGIS/EPD external connections require access, contracts and real-deal validation. That is the correct maturity boundary.

Do not claim live readiness from UI polish, route availability, static role pages or sandbox models.

## Evidence checked in this pass

- Public entry route: `apps/web/app/platform-v7/page.tsx`.
- Role shell route map: `apps/web/lib/platform-v7/shellRoutes.ts`.
- Existing state document: `docs/platform-v7-state-of-product.md`.

No product files were changed in this PR.

## Audit findings

| ID | Area | Finding | Risk | Fix type | Next PR |
|---|---|---|---|---|---|
| A1 | Public entry | Public entry routes role cards to `/platform-v7/login`, which is safe, but the Help and Menu icon buttons have no visible destination or disabled reason. | Medium: dead-action perception on first screen. | UI, exact public entry file only. | Small PR: replace inert icon buttons with real help/menu routes or disabled state with reason. |
| A2 | Public entry | Public route says controlled pilot and external integrations require access/contracts/validation. | Low: correct truth boundary. | No fix. | Keep wording; do not upgrade to live language. |
| A3 | Role shell | `allowedPrefixes` is limited to each role home plus shared AI/profile/status prefixes. This supports role isolation. | Low: keep guard stable. | No fix. | Future role PRs must not broaden allowed prefixes. |
| A4 | Role navigation | Bottom navigation defines many child routes per role. Exact child-route existence must be verified before cabinet PRs to avoid dead nav. | High if routes are missing. | Audit/UI by exact role. | Seller pass first, then buyer, bank, operator/executive, compliance, lab/elevator/field. |
| A5 | Runtime readiness | State doc lists sandbox/manual/controlled-pilot/live labels and says unproven live access must remain sandbox or controlled-pilot. | Low: correct truth boundary. | No fix. | Align #1982 real-operation PRs to data/runtime/access/money/docs/integrations/load/ops domains. |
| A6 | State freshness | Existing state doc is dated 2026-04-27 and references old deployment/status details. | Medium: stale control surface can mislead execution agents. | Docs-only. | Small PR: refresh product state without claiming live readiness. |

## Small PR queue from this audit

1. **UI/public-entry dead-action pass**
   - Scope: `apps/web/app/platform-v7/page.tsx` only.
   - Goal: Help/Menu must point to real route/section or safe disabled state with clear reason.
   - Forbidden: apps/landing, backend, DB, auth, session, API, package, lockfiles.

2. **Docs/state freshness pass**
   - Scope: docs only.
   - Goal: refresh state date, hosting gate language and readiness status while preserving controlled-pilot / pre-integration truth.
   - Forbidden: product code and unsupported live claims.

3. **Seller cabinet exact-route audit/fix**
   - Scope: exact seller cabinet files only after identifying them.
   - Goal: first screen shows what happened, what is blocked, money at risk, responsible party and next action.
   - Gate: #1978 review and #1979 cabinet smoke checklist.

4. **Role nav existence audit**
   - Scope: route map plus exact missing role route stubs only if safe.
   - Goal: every bottom-nav item either exists, anchors to a real section or is safely disabled with a reason.
   - Split by role; do not broaden to all platform-v7.

5. **#1982 real-operation domain PRs**
   - Split separately into data, runtime, access, money, documents, integrations, load, ops and QA.
   - No UI PR may hide backend, DB, auth, session, API, package or lockfile changes.

## Merge gate for this docs-only PR

- Changed files must be under `docs/platform-v7/audit/` only.
- `apps/landing` diff must be zero.
- Backend, DB, auth, session, API, package and lockfiles must be untouched.
- Netlify preview is not product-relevant for this docs-only state PR unless branch protection requires it.
- Current status remains controlled-pilot / pre-integration.
