# platform-v7 entry surface and mobile shell gap audit

Scope: platform-v7 only. This is a docs-only audit. It does not change product code, backend, DB, integrations, packages, lockfiles, deployment settings, or apps/landing.

Status basis:

- PR #1963 merged route-backed bottom navigation for role shells.
- PR #1964 merged scoped mobile hardening for platform-v7 entry and shell spacing.
- PR #1965 merged a maturity-copy normalization pass.
- PR #1962 remains outside the current autonomous merge lane because it is open, not mergeable, and touches verified cabinet session issuance/API/middleware/session behavior.

## Problem statement

The current product risk is no longer only missing routes. The sharper risk is trust loss on first contact: the public entry and role surfaces can look light, decorative, or toy-like while the product is intended to feel like a heavy B2B/agri-fintech execution system.

This audit fixes the next code direction before another visual pass is attempted. The goal is not more UI decoration. The goal is operational density: a user should immediately understand deal state, money at risk, blocker, responsible role, next action, and evidence basis.

## Non-negotiable product constraints

1. `/platform-v7` and public entry routes must not behave like a carousel-first consumer app.
2. Mobile at 390x844 must have no horizontal overflow, clipped cards, missing shell, or bottom dock collision.
3. The first screen must expose one primary business action, not a set of equal decorative tiles.
4. Role cards are navigation, not marketing badges. They must remain compact, stable, and readable.
5. Once a user enters a role cabinet, the UI must not visually encourage jumping into unrelated cabinets.
6. The shell must keep route-backed navigation visible and usable where the user is inside platform-v7.
7. Copy cleanup must not be used as a fake maturity layer. The interface must still honestly avoid live-bank/live-FGIS/live-EDO/live-payment claims.

## Main visual gaps to close next

### 1. Public entry hierarchy

Risk: the entry screen can still feel like a child app if role cards, process cards, and CTA blocks compete equally.

Required direction:

- one dominant hero;
- one primary CTA;
- compact role selector;
- no carousel-like horizontal card rail;
- no clipped public-process cards;
- secondary links visually subordinate;
- background image or texture must stay quiet, low-opacity, and never reduce text contrast.

Acceptance test:

- At 390x844, a user sees the platform name, headline, primary CTA, and role entry without horizontal scroll.
- No public-entry section requires sideways swiping to understand the product.

### 2. Role cockpit maturity

Risk: route-backed navigation can be technically correct while the role cockpit still reads as a shallow dashboard.

Required direction:

Each role cockpit must show above the fold:

- current object or queue;
- blocking reason;
- money/document/logistics/quality impact;
- responsible party;
- next action;
- evidence or audit basis.

Acceptance test:

- A seller understands what blocks payment.
- A buyer understands full-price exposure and document risk.
- A logistician understands trip exception and next dispatch action.
- A driver sees one field-grade task, not a dense office dashboard.
- A bank sees only a clean basis for review, never a claim that the platform releases money itself.

### 3. Shell consistency

Risk: the header, bottom dock, and role shell can still disappear or collide on some role routes after mobile hardening.

Required direction:

- shared platform-v7 shell remains mounted on role routes;
- bottom nav uses real routes, not hash anchors;
- safe-area spacing protects fixed bottom controls;
- no role page should render as a naked content page unless explicitly designed as a field-only route.

Acceptance test:

- `/platform-v7/seller`, `/platform-v7/buyer`, `/platform-v7/bank`, `/platform-v7/logistics`, `/platform-v7/driver/field` retain their intended shell/navigation behavior on mobile.

### 4. Role migration and cabinet isolation UX

Risk: even if server-side role enforcement is report-only, the visible UI can still imply that changing cabinets is normal.

Required direction:

- role selection belongs before cabinet entry;
- inside a cabinet, cross-cabinet switching must be hidden or clearly demoted to admin/support flows;
- no dashboard should present unrelated role cabinets as primary actions;
- client UX must align with future server-side cabinet enforcement, but must not claim enforcement is complete.

Acceptance test:

- A driver cannot visually treat bank/arbitrator/buyer cabinets as normal next steps.
- A seller cannot visually switch to buyer as a primary navigation action.

### 5. Claim safety

Risk: copy normalization can remove obvious immature words while leaving implied fake maturity.

Forbidden visible implications:

- bank connected;
- FGIS connected;
- EDO connected;
- payment guaranteed;
- platform releases money;
- live production execution;
- fully integrated contour;
- federal-scale readiness as a current fact.

Allowed direction:

- controlled execution contour;
- pre-integration basis;
- connection status;
- bank review basis;
- evidence package;
- audit trail;
- role-specific next action.

## Next safe PR sequence

### PR-A: public entry surface hardening

Scope:

- platform-v7 public entry only;
- no apps/landing;
- no backend/session/auth/API;
- no package/lockfile;
- no live-integration claims.

Target:

- remove carousel-like behavior if present;
- enforce vertical mobile public-entry sections;
- strengthen hero/action hierarchy;
- keep all 12 roles visible or discoverable without horizontal overflow.

### PR-B: role cockpit above-fold density

Scope:

- one role at a time, starting with seller or buyer;
- presentational-first;
- no business-logic rewrite.

Target:

- blocker + money/document impact above fold;
- one primary action;
- evidence/audit basis visible;
- secondary content moved into progressive detail.

### PR-C: cabinet isolation UX cleanup

Scope:

- shell/navigation copy and visible role switch affordances;
- no server enforcement change;
- no redirect/block-mode unless separately approved.

Target:

- remove visual encouragement to jump between unrelated cabinets;
- align visible navigation with report-only server RBAC direction;
- preserve support/admin/debug paths only where justified.

## Done criteria for this audit track

The track is not done when the screen is prettier. It is done when a cold mobile user can answer five questions in under ten seconds:

1. What deal or queue am I looking at?
2. What is blocked?
3. How does it affect money?
4. Who owns the next action?
5. What proof or document supports the decision?

Until those five questions are answered on mobile, the platform may have many screens but still does not feel like a serious execution system.
