# Platform v7 role inventory

Status: controlled-pilot / pre-integration.

Documentation-only inventory for role routes, shell navigation, and screen contracts.

## Scope

Reviewed areas:

- apps/web/app/platform-v7
- apps/web/components/platform-v7
- apps/web/components/v7r
- apps/web/lib/platform-v7
- apps/web/stores
- apps/web/tests/unit/platformV7*.test.ts

No runtime, integration, deployment, lockfile, API, DB, migration, or landing changes are included.

## Roles

| Role | Home route | Main responsibility |
|---|---|---|
| operator | /platform-v7/control-tower | control tower, blockers, queues, escalation |
| buyer | /platform-v7/buyer | procurement, acceptance, reserve, documents |
| seller | /platform-v7/seller | batches, offers, documents, acceptance |
| logistics | /platform-v7/logistics | trips, routes, documents, deviations |
| driver | /platform-v7/driver and /platform-v7/driver/field | field route and event confirmation |
| surveyor | /platform-v7/surveyor | inspection and evidence capture |
| elevator | /platform-v7/elevator | queue, weighing, unloading, acts |
| lab | /platform-v7/lab | samples, quality, protocols |
| bank | /platform-v7/bank and /platform-v7/bank/clean | payment basis review, holds, bank events |
| arbitrator | /platform-v7/arbitrator | disputes, evidence, decision basis |
| compliance | /platform-v7/compliance | admission, authority, risks, document checks |
| executive | /platform-v7/executive | portfolio view, money at risk, blockers |

## Current observations

- routes.ts exposes the broad platform-v7 route surface.
- shellRoutes.ts contains role home routes and current role navigation lists.
- AI currently appears as a normal navigation item for several roles and should move to a role-bound contextual surface.
- Bottom navigation should be limited to direct role destinations and should not include utility or session actions.
- Drawer links should hold secondary role functions.
- Command Palette and Recent Items should stay role-safe after login.
- Field roles need strict protection from visual or behavioral cabinet migration.

## Required role screen contract

Each role cabinet should show:

1. current execution status;
2. active blocker;
3. one primary next action;
4. money or business impact;
5. documents and evidence for the next step;
6. operational objects owned by the role;
7. next responsible party;
8. details below the first decision layer.

## Follow-up PR plan

PR-1: shell actions and AI placement.

- Keep calculator as a protected-shell header utility.
- Keep support/help available without breaking header layout.
- Remove logout from the primary mobile header.
- Keep AI out of bottom navigation.
- Keep public pages outside the protected shell.

PR-2: role navigation safety.

- Add one canonical role navigation registry.
- Generate bottom navigation from the registry.
- Keep each role to a maximum of five bottom destinations.
- Exclude AI, logout, menu, and role switching from bottom navigation.
- Keep drawer links secondary and role-bound.
- Make Command Palette and Recent Items role-safe.
- Redirect foreign-role access to the active role home or a controlled boundary.

PR-3: role cabinet function exposure.

- Expose role-owned functions in the correct cabinet layer.
- Use seller as the first full pattern.
- Apply the same execution-first pattern to buyer, logistics, driver, elevator, lab, bank, arbitrator, compliance, executive, operator, and surveyor.
- Avoid long unstructured scroll and cross-role migration.

PR-4: mobile, copy, and regression pass.

- Check 375, 390, and 430px mobile widths.
- Keep tap targets practical for field use.
- Keep bottom navigation and drawer stable across roles.
- Keep maturity wording at controlled-pilot / pre-integration.
- Add regression tests for role navigation and screen contracts.

## Acceptance criteria

- documentation only;
- no product code change;
- no landing change;
- no mock service worker change;
- no backend, API, database, migration, deployment, integration, or lockfile change;
- follow-up PRs remain small, sequential, and reviewable.
