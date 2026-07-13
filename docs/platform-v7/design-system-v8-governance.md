# Design System v8 governance

## Status

Design System v8 is introduced as an additive controlled-migration layer. It does not claim that the legacy interface has already been removed or that every route has passed the final design gates.

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

The following are controlled by v8 immediately:

- all files under `packages/design-system-v8/src`;
- all files under `apps/web/components/transaction-ux`;
- every file registered in `migratedFiles` inside `design-governance-v8.json`.

A migrated product file must consume `@pc/design-system-v8`. New local copies of a migrated pattern are not allowed.

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
4. add RU/EN/ZH messages before the route is accepted;
5. cover mobile, keyboard, forced-colors and reduced-motion states;
6. pass visual, accessibility and performance baselines;
7. remove legacy imports only after the route no longer depends on them.

Big-bang replacement is prohibited.

## Current reference slice

The first migrated domain component is `NextActionCard`. The canonical Deal Workspace remains the reference Transaction UX slice, but its complete token and component migration is a separate acceptance step. Existing AppShellV4 and legacy role pages remain legacy until explicitly registered as migrated.

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
