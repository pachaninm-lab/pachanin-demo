# Platform v7 role inventory

Status: controlled-pilot / pre-integration.

This is a documentation-only inventory for platform-v7 role routes, navigation surfaces, and screen contracts before follow-up implementation PRs.

## Scope

Audited areas:

- `apps/web/app/platform-v7/**`
- `apps/web/components/platform-v7/**`
- `apps/web/components/v7r/**`
- `apps/web/lib/platform-v7/**`
- `apps/web/stores/**`
- `apps/web/tests/unit/platformV7*.test.ts`

Out of scope:

- `apps/landing/**`
- backend, database, migrations, live integrations, secrets, deployment config, lockfiles
- runtime or UI changes

## Current roles

| Role | Home route | Main responsibility |
|---|---|---|
| operator | `/platform-v7/control-tower` | control tower, blockers, queues, escalation |
| buyer | `/platform-v7/buyer` | procurement, acceptance, reserve, documents |
| seller | `/platform-v7/seller` | batches, offers, documents, acceptance |
| logistics | `/platform-v7/logistics` | trips, routes, documents, deviations |
| driver | `/platform-v7/driver` / `/platform-v7/driver/field` | field route and event confirmation |
| surveyor | `/platform-v7/surveyor` | inspection and evidence capture |
| elevator | `/platform-v7/elevator` | queue, weighing, unloading, acts |
| lab | `/platform-v7/lab` | samples, quality, protocols |
| bank | `/platform-v7/bank` / `/platform-v7/bank/clean` | payment basis review, holds, bank events |
| arbitrator | `/platform-v7/arbitrator` | disputes, evidence, decision basis |
| compliance | `/platform-v7/compliance` | admission, authority, risks, document checks |
| executive | `/platform-v7/executive` | portfolio view, money at risk, blockers |

## Observations

- `routes.ts` exposes a broad route surface for deals, lots, seller, buyer, money, documents, bank, disputes, logistics, field roles, compliance, reports and AI.
- `shellRoutes.ts` contains role home routes and role navigation lists.
- Several current role navigation lists include the AI route as a normal nav item. Follow-up work should move AI out of primary bottom navigation into a role-bound contextual surface.
- Some roles have a very small primary route list while their actual execution duties require a clearer split between bottom navigation and secondary drawer links.
- Operator and executive roles can legitimately see broad platform surfaces, but field and transaction roles need stricter route boundaries.
- Command Palette and Recent Items must be role-safe after login and must not expose role migration as an ordinary shortcut.

## Required screen contract

Each role cabinet should show, in this order:

1. current execution status;
2. active blocker;
3. one primary next action;
4. money or business impact;
5. documents and evidence required for the next step;
6. operational objects owned by the role;
7. next responsible party;
8. details below the first decision layer.

## Follow-up PR plan

### PR-1: Shell actions and AI placement

- calculator remains a header utility on protected platform pages;
- support/help remains available without breaking header layout;
- logout is not a primary mobile header action;
- AI is not a bottom-navigation item;
- public pages stay outside the protected shell.

### PR-2: Role navigation safety

- introduce one canonical role navigation registry;
- generate bottom navigation from the registry;
- keep each role at a maximum of five direct bottom destinations;
- exclude AI, logout, menu and role switch from bottom navigation;
- keep drawer links secondary and role-bound;
- make Command Palette and Recent Items role-safe;
- redirect foreign-role access to the active role home or a controlled access boundary.

### PR-3: Role cabinet function exposure

- expose all role-owned functions in the correct cabinet layer;
- use seller as the first complete pattern;
- apply the same execution-first pattern to buyer, logistics, driver, elevator, lab, bank, arbitrator, compliance, executive, operator and surveyor;
- avoid long unstructured scroll and cross-role visual migration.

### PR-4: Mobile, copy and regression pass

- check 375/390/430px mobile widths;
- keep tap targets practical for field use;
- keep bottom navigation and drawer stable across roles;
- keep maturity wording at controlled-pilot / pre-integration;
- add regression tests for role navigation and screen contracts.

## Wording guardrails

Do not claim production readiness, fully live integrations, active bank connection, active FGIS/EDO/EPD connection, guaranteed payment, automatic release of funds, or fully closed dispute risk unless backed by live credentials, contracts, production access and real transaction validation.

Allowed wording: controlled-pilot, pre-integration, mock provider, adapter-ready after specific tests, pending live credentials, pending bank review, requires validation on real transactions.

## Acceptance criteria

- docs-only change;
- no product code change;
- no `apps/landing` change;
- no `apps/web/public/mockServiceWorker.js` change;
- no backend/API/database/migration/live integration change;
- no deployment config or lockfile change;
- follow-up PRs remain small, sequential and reviewable.
