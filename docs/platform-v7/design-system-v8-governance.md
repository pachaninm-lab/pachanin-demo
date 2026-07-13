# Design System v8 governance

## Status

Design System v8 is the controlled visual and interaction layer for accepted Transaction UX surfaces. Acceptance is evidence-based and route-scoped. It does not mean that every historical Platform v7 route has been migrated or removed.

The current runtime has two explicit presentation boundaries:

- `PlatformV7DesignSystemV8Runtime` for accepted v8 routes. It loads generated tokens and the governed component CSS Modules only.
- `PlatformV7FullStyleRuntime` for public supporting, historical and partially migrated routes. It is the only registered compatibility boundary allowed to own v9 and legacy platform-v7 global style imports.

The route decision is server-side and uses `apps/web/lib/platform-v7/design-system-v8-routes.ts`. A historical route cannot inherit v8 acceptance merely because it renders inside the protected shell.

## Source of truth

- Token source: `packages/design-tokens/tokens.json`.
- Runtime token CSS: `packages/design-tokens/tokens.css`.
- Component package: `packages/design-system-v8`.
- Governance registry: `design-governance-v8.json`.
- Automated enforcement: `scripts/check-design-system-v8.mjs` and the `Design System v8 Gate` workflow.

The mandatory token hierarchy is:

1. `core` — palette, spacing, radius, typography, dimensions and motion.
2. `semantic` — action, text, surface, border and status meaning.
3. `component` — reusable component contracts.
4. `context` — domain contracts such as bank release confirmation.

Product components may consume semantic, component or context tokens. Raw values remain inside the token and design-system layers.

## Governed surface

The governed surface includes:

- all files under `packages/design-system-v8/src`;
- all files under `apps/web/components/transaction-ux`;
- `AppShellV4` and its CSS Module;
- `RoleIntentDashboard` and the canonical Deals registry;
- the accepted route registry and v8 runtime boundary;
- active protected-shell controls: shell policy, language switch and calculator;
- every product file registered in `migratedFiles`.

A migrated product file must consume `@pc/design-system-v8` or the governed `transaction-ux` boundary. Local copies of accepted patterns are prohibited.

## Prohibited patterns

Inside the governed surface CI rejects:

- React inline style objects;
- `dangerouslySetInnerHTML` or runtime `<style>` elements;
- literal HEX, RGB, RGBA, HSL or HSLA colors;
- `!important`;
- imports from legacy v9 or platform-v7 global style bundles.

The legacy compatibility runtime is excluded from the governed v8 surface by design. CI verifies that the accepted v8 runtime cannot import or mount it.

Imperative measurement may set a documented CSS custom property for a real DOM dimension. It cannot inject rules, colors or authority state.

## Component acceptance contract

A v8 component must define or deliberately inherit the states relevant to its task:

- default, hover and focus-visible;
- disabled and loading;
- empty, stale, offline and error;
- no access, conflict and pending external confirmation;
- success.

The owning template must demonstrate relevant states before route acceptance. Mobile, keyboard, reduced-motion, forced-colors and RU/EN/ZH remain mandatory.

## Migration rule

Migration is route-by-route and reversible:

1. register the target route and user task;
2. replace local patterns with governed primitives/domain components;
3. register the files and the route classification;
4. add RU/EN/ZH copy;
5. cover mobile, keyboard, reduced-motion and forced-colors;
6. pass visual, accessibility, typecheck, build and regression gates;
7. remove the legacy runtime only for that accepted route.

Big-bang replacement is prohibited.

## Accepted Transaction UX slices

### Foundation and active shell

Accepted:

- DTCG-compatible token source and generated CSS;
- reusable v8 primitives and domain components;
- fixed header, drawer, command palette and mobile bottom navigation;
- theme, notification, language and calculator controls;
- declarative role/field shell policy through scoped CSS Modules;
- no runtime CSS injection in the active protected shell;
- stable `.pc-v4-actions` mount contract for header utilities;
- explicit route-level separation from the legacy global CSS bundle.

### Canonical Deal Workspace

Accepted:

- one server-authoritative Deal;
- task-first next action and blocker states;
- idempotency and optimistic concurrency preserved;
- bank callback remains external confirmation;
- token-only responsive presentation.

### Twelve role roots

Operator, buyer, seller, logistics, driver, surveyor, elevator, laboratory, bank, compliance, arbitrator and executive use the shared `RoleIntentDashboard` contract. It loads participant-scoped Deals, prioritizes required action, preserves server RBAC and supports loading, empty, error, pagination, retry and RU/EN/ZH.

### Canonical Deals registry

`/platform-v7/deals` validates participant-scoped server pages, uses a server cursor, preserves prior rows on later-page failure, deduplicates by Deal ID and exports only loaded rows. It does not introduce client authority.

The accepted Deal execution route is `/platform-v7/deals/:dealId/execution`. Other Deal subroutes remain historical until separately registered.

### Documents, disputes and money

Accepted routes:

- `/platform-v7/documents` — Deal-scoped document readiness, no synthetic global archive;
- `/platform-v7/disputes` — server-registered dispute queue and evidence path;
- `/platform-v7/money` — Deal-scoped money work with reserve, hold, request, callback and reconciliation separated;
- `/platform-v7/bank/release-safety` — read-only payout-readiness checks.

These routes cannot manufacture external registry facts, sign for a party, confirm a bank callback or move money.

### Canonical auction routes

Accepted routes:

- `/platform-v7/auction`;
- `/platform-v7/auction/import`;
- `/platform-v7/auction/admission`;
- `/platform-v7/auction/bids`;
- `/platform-v7/auction/deal-basis`.

The UI:

- loads tenant-scoped lots from authenticated `/lots/my`;
- loads one workspace from `/auctions/lots/:lotId/workspace`;
- requires `POSTGRESQL` / `AUCTION` proof with tenant, actor, version and observation time;
- cross-checks tenant, actor and selected lot identity;
- rejects incomplete or contradictory bid, award and Deal envelopes;
- places no bid, cancels no bid, chooses no winner and creates no Deal;
- exposes a Deal link only for `dealCreated=true` with a non-empty server-issued `dealId`;
- fails closed without authority.

The backend read authority is now PostgreSQL-backed in the dedicated `auction` schema with FORCE RLS, explicit read grants, single-winner constraints and tenant/lot/Deal consistency checks. This proves the read envelope consumed by the UI. It does not prove live FGIS/SDIZ connectivity, bid/award command processing, an externally operated auction or production-scale traffic.

### Physical execution chain

Accepted routes:

- `/platform-v7/deal-logistics`;
- `/platform-v7/deal-acceptance`;
- `/platform-v7/deal-documents-basis`.

The chain keeps Deal, trip, lot, carrier, vehicle, driver, elevator, weight, quality, documents and evidence linked and fail-closed. Current physical execution projections do not by themselves prove PostgreSQL-authoritative logistics/acceptance/document persistence or live integrations.

## Legacy isolation boundary

Accepted v8 routes are enumerated, not inferred by broad prefix. This prevents routes such as historical Deal views, notifications and execution-map pages from silently receiving a v8 acceptance claim.

The compatibility bundle remains available for those historical routes until each route completes:

- data-authority verification;
- interaction migration;
- token and accessibility migration;
- regression and build evidence;
- explicit route registration.

Removing a legacy stylesheet globally before its remaining consumers are migrated is prohibited.

## Remaining boundary

Still separate from v8 UI acceptance:

- auction mutation authority and immutable bid journal;
- live FGIS/SDIZ, EDI, state e-transport, qualified-signature and bank integrations;
- PostgreSQL-authoritative physical execution persistence where not yet proven;
- historical and secondary routes outside the accepted registry;
- production operating scale and observed availability.

## Decision authority

A new interaction pattern requires:

- an uncovered user task;
- a documented state model;
- mobile and desktop behavior;
- accessibility behavior;
- RU/EN/ZH content;
- an owner;
- CI evidence.

Route-local visual invention is not a valid reason for a new pattern.
