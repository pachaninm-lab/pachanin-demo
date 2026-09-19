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
- the document readiness, dispute queue, money hub, bank payout-readiness, canonical auction and physical execution routes;
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

Seller, buyer and bank use one governed money-and-obligation contract. Reserve, hold, release request and bank-confirmed release remain different states; the UI cannot manufacture a callback or release funds. The shared contract exposes localizable meta and accessibility labels for RU, EN and ZH.

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

### Dispute queue

The `/platform-v7/disputes` route uses server-registered disputes as the primary queue. It:

- calculates open count and held amount from the server-backed dispute model;
- keeps evidence readiness, recommendations, decision package and feedback behind progressive disclosure;
- removes scenario mock data from the authority path;
- links every dispute to its Deal and audit trail;
- keeps the arbitrator, operator and bank as distinct decision authorities;
- supports RU, EN and ZH route copy;
- cannot alter laboratory facts, sign documents for a party or release held money.

### Money hub

The `/platform-v7/money` route is a governed entry into money work for a specific server-authorized Deal. It:

- removes fixture-derived portfolio totals and hard-coded Deal amounts;
- does not aggregate money across organizations without a server-confirmed payment set;
- starts from the participant-scoped canonical Deal registry;
- keeps reserve, hold, payout request, callback confirmation and reconciliation as distinct states;
- treats the request as an outbox command, not movement of money;
- supports RU, EN and ZH, including money cockpit labels and accessibility labels.

### Bank payout-readiness route

The `/platform-v7/bank/release-safety` route is a governed server-authorized entry into payout checks for a specific Deal. It:

- removes fixture-derived `canonicalDomainDeals`, hard-coded Deal IDs and client-side readiness aggregation;
- requires the user to select a participant-scoped Deal before reviewing actual server blockers;
- differentiates reserve, hold, release request and bank-confirmed movement of money;
- contains no HTTP mutation or command that can confirm or execute release;
- reserves RESERVED and RELEASED confirmation for a verified bank callback;
- routes callback error, conflict or reconciliation mismatch to manual review;
- supports RU, EN and ZH route copy and localized cockpit labels.

This UI acceptance does not assert live bank connectivity or PostgreSQL-authoritative Settlement where those backend acceptance gates remain separate. It proves that the active views do not overstate authority or synthesize money status.

### Canonical auction routes

The `/platform-v7/auction`, `/auction/import`, `/auction/admission`, `/auction/bids` and `/auction/deal-basis` routes are governed read-only entry points into auction execution. They:

- load accessible lots only through authenticated `/lots/my`, without local seeds or a public-report fallback;
- preserve the selected `lotId` across overview, import, admission, bids and Deal-basis stages;
- validate the `/auctions/lots/:lotId/workspace` response before displaying readiness, bid aggregates or the execution bridge;
- require explicit `POSTGRESQL` / `AUCTION` authority proof with tenant, actor, version and observation time;
- cross-check tenant, actor and selected lot identity between the lot registry and workspace envelopes;
- fail closed when the lot is not in the server-confirmed accessible set or the workspace response is unavailable, invalid or inconsistent;
- do not place or cancel bids, choose a winner, manufacture an award or create a Deal in the browser;
- show a Deal link only when the server returns `dealCreated=true` and a non-empty canonical `dealId`;
- keep the former bridge and FGIS engine modules as type-only compatibility contracts with no runtime fixtures or selectors;
- remove hard-coded FGIS lots, SDIZ identifiers, buyers, bids, winners and Deal IDs from the active authority path;
- support RU, EN and ZH and preserve governed mobile, keyboard, reduced-motion and forced-colors behavior.

This acceptance proves the fail-closed authority boundary of the active auction UI. It does not prove that the current backend already exposes the required PostgreSQL authority envelopes, a complete immutable bid journal, bid/award command processing or live FGIS/SDIZ integration. Until those contracts are available and valid, the auction routes intentionally remain unavailable rather than substituting local data.

### Physical Deal execution chain

The governed physical chain consists of `/platform-v7/deal-logistics`, `/platform-v7/deal-acceptance` and `/platform-v7/deal-documents-basis`. It:

- keeps Deal, trip, lot, certificate, carrier, vehicle, driver, elevator, weight, quality and evidence visibly linked;
- blocks driver and acceptance transitions until carrier admission is complete;
- blocks the document basis until acceptance is signed and all quality and evidence checks are complete;
- blocks bank payout-readiness until every mandatory document item is confirmed;
- removes route-local inline styles and uses one responsive execution cockpit for mobile and desktop;
- supports RU, EN and ZH for stages, statuses, facts, blockers and authority boundaries;
- cannot sign documents, confirm an external registry fact, create a bank status or move money.

The data engines currently used by these three routes are local execution projections. Their governed UX and fail-closed transitions do not prove PostgreSQL-authoritative logistics, acceptance or document persistence, live external integrations or confirmed production operation.

## Remaining boundary

Detailed settlement operations, auction backend command authority, server-authoritative logistics/acceptance/document persistence, historical routes and other non-critical pages are not automatically accepted merely because they render under the v8 shell. Each route or backend authority must be registered, migrated and proven before its legacy implementation can be removed. Production operating maturity and live external integrations remain separate acceptance questions.

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
