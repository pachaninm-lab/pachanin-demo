# Design System v8 governance

## Status

Design System v8 is the controlled visual and interaction layer for the active Transaction UX surfaces. This status does not mean that every secondary route or historical Platform v7 component has already been removed. Migration acceptance remains evidence-based and route-scoped.

## Source of truth

- Token source: `packages/design-tokens/tokens.json`.
- Runtime CSS output: `packages/design-tokens/tokens.css`.
- Component package: `packages/design-system-v8`.
- Governance registry: `design-governance-v8.json`.
- Automated enforcement: `scripts/check-design-system-v8.mjs` and the `Design System v8 Gate` workflow.

The token hierarchy is mandatory:

1. `core` — raw palette, spacing, radius, typography, control dimensions and motion.
2. `semantic` — action, text, background, border and status meaning.
3. `component` — component contracts such as button and card.
4. `context` — domain-sensitive contracts such as bank release confirmation.

Product components may consume semantic, component or context tokens. Raw core values are reserved for the token and design-system layers.

## Governed components

The following are controlled by v8:

- all files under `packages/design-system-v8/src`;
- all files under `apps/web/components/transaction-ux`;
- the active `AppShellV4` TSX and CSS Module;
- the shared `RoleIntentDashboard` TSX and CSS Module used by all twelve business-role roots;
- the canonical deals registry page, list component and their CSS Modules;
- the document readiness route;
- every file registered in `migratedFiles` inside `design-governance-v8.json`.

A migrated product file must consume `@pc/design-system-v8` or the governed `transaction-ux` boundary. New local copies of a migrated pattern are not allowed.

## Prohibited patterns

Inside the governed scope CI rejects:

- React inline style objects;
- `dangerouslySetInnerHTML` used for local styling;
- literal HEX, RGB, RGBA, HSL or HSLA colors;
- `!important`;
- imports from legacy global platform-v7 or v9 style layers.

The token package is the only approved location for raw color values.

## Component acceptance contract

Every v8 component must define or deliberately inherit:

- default;
- hover;
- focus-visible;
- disabled when interactive;
- loading where asynchronous;
- empty where data-backed;
- stale where freshness matters;
- offline where actions depend on connectivity;
- error;
- no access;
- conflict;
- pending external confirmation;
- success.

Not every primitive renders every state itself. The owning template must demonstrate the relevant state before that template can be accepted.

## Migration rule

Migration is route-by-route and reversible:

1. register the target route and user task;
2. replace local patterns with v8 primitives/domain components;
3. add the migrated files to the governance registry;
4. add RU/EN/ZH copy before the route is accepted;
5. cover mobile, keyboard, forced-colors and reduced-motion states;
6. pass visual, accessibility and performance baselines;
7. remove legacy imports only after the route no longer depends on them.

Big-bang replacement is prohibited.

## Accepted Transaction UX slices

### Foundation

- DTCG-compatible token source and generated CSS runtime;
- reusable v8 primitives and `NextActionCard`;
- automated governance and concurrent-scope isolation.

### Active application shell

- fixed header and mobile bottom navigation;
- role-scoped drawer and command palette;
- notification and theme controls;
- no runtime style injection, inline style objects, literal colors or `!important`.

### Canonical Deal Workspace

- one server-authoritative Deal;
- task-first next action and blocker states;
- idempotency and optimistic concurrency preserved;
- bank callback remains an external-confirmation state;
- token-only responsive presentation.

### Field-role workspaces

The driver, surveyor, elevator and laboratory routes use governed field-role templates for mobile-first execution while preserving server-owned authority and the canonical Deal.

### Money and obligation workspaces

Seller, buyer and bank use one governed money-and-obligation contract. Reserve, hold, release request and bank-confirmed release remain different states; the UI cannot manufacture a callback or release funds.

### Operational and oversight workspaces

Operator, logistics, compliance, arbitrator and executive use one governed decision-cockpit contract. Business queues are separated from engineering observability, authority boundaries stay role-specific and executive remains read-only. The shared cockpit exposes localizable labels so new accepted surfaces do not leave Russian-only meta labels inside EN or ZH sessions.

### Twelve-role root cockpit

The operator, buyer, seller, logistics, driver, surveyor, elevator, laboratory, bank, compliance, arbitrator and executive root routes use one shared `RoleIntentDashboard` template. The template:

- loads only participant-scoped deals from the server;
- prioritizes a deal requiring action without hiding other deals;
- uses v8 primitives and semantic tokens;
- has loading, empty, error, pagination and retry states;
- supports RU, EN and ZH through `next-intl` locale selection;
- preserves server-owned RBAC and the canonical Deal Workspace.

### Canonical deals registry

The `/platform-v7/deals` route and `CanonicalDealsList` are governed v8 surfaces. The registry:

- accepts only participant-scoped server pages and validates the response envelope;
- uses a server-issued cursor, preserves loaded rows on later-page failure and deduplicates by Deal ID;
- displays server priority, deadline and integer-minor-unit money projections without introducing client authority;
- exports exactly the rows already loaded from the server;
- supports RU, EN and ZH for page copy, states, controls, labels and export headers;
- has loading, empty, access-denied, offline, invalid-response, export-error and pagination-error states;
- uses token-only mobile, keyboard, reduced-motion and forced-colors behavior.

### Document readiness route

The `/platform-v7/documents` route is a governed server-authoritative entry into document work for a specific Deal. It deliberately removes the former synthetic global archive and hard-coded Deal scenarios. The route:

- lists only Deals returned by the participant-scoped canonical registry;
- keeps documents inside the canonical Deal instead of creating an independent document source of truth;
- directs the user to the Deal workspace for the actual document step;
- treats document completeness as a payout-readiness condition without allowing the UI to release funds;
- treats FGIS, EDI, state e-transport, qualified-signature and bank states as externally confirmed facts, never local toggles;
- supports RU, EN and ZH, including cockpit meta labels and accessibility labels;
- inherits mobile, keyboard, reduced-motion and forced-colors behavior from governed v8 components.

## Remaining boundary

Payment and settlement views, dispute operations, auctions and other secondary routes are not automatically accepted merely because they render under the v8 shell. Each route must be registered, migrated and proven before its legacy styling can be removed. Production operating maturity and live external integrations remain separate acceptance questions.

## Decision authority

A new interaction pattern requires all of the following:

- a user task not covered by an existing pattern;
- a documented state model;
- mobile and desktop behavior;
- accessibility behavior;
- RU/EN/ZH content keys;
- an owner;
- CI coverage.

Route-local visual invention is not an acceptable reason for a new pattern.
