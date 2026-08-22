# PC-CROP Federal Accounting — accountant organization-member context repair

Date: 2026-08-18
Project lock: `PC-CROP-FEDERAL-ACCOUNTING`
Issue: #4321
Base main: `18384323f7b77746f39797a50518f70f407fc763`

## Proven mismatch

The accounting identity model intentionally separates market role from job profile:

- a bookkeeper may be `user_orgs.role = GUEST`;
- their actual organization function is `job_profile = ACCOUNTANT`, `CHIEF_ACCOUNTANT` or `EXTERNAL_ACCOUNTANT`;
- `Role.ACCOUNTING` remains the bank/settlement actor and must not be reused for a farm bookkeeper.

The capability resolver already follows that model. The generic PostgreSQL transaction helper did not: it rejected every `Role.GUEST` before the database could resolve the ACTIVE organization membership and job profile. The AccountingController class role fence also excluded GUEST, so the intended bookkeeper compatibility model could not reach even the task-first work queue.

## Organization-member transaction authority

The generic `deriveTrustedRlsContext` / `withTrustedContext` path remains unchanged in security meaning: `GUEST` is still denied there.

A separate `withOrganizationMemberContext` path is introduced for reviewed organization-member contours. It:

1. requires authenticated user id, session id, tenant id and organization id;
2. sets the same transaction-local identity context;
3. immediately calls PostgreSQL `public.app_pc_crop_membership_id()`;
4. refuses with `organization_membership_required` unless PostgreSQL resolves an ACTIVE membership for the current authenticated identity and organization;
5. runs the business callback only after that proof.

The role label therefore does not become authority. A forged organization/tenant, revoked membership or missing membership fails before business work.

## Task-first accounting

The work queue operations intended for a real accountant now use the organization-member context:

- open task list;
- task projection/viewer context;
- manual task/note creation;
- task transition.

Task list additionally requires server-resolved `accounting.dashboard.read`. Manual creation still requires `accounting.task.manage`, and transition still runs the existing task policy against server-resolved capabilities and the live system condition.

An unprofiled GUEST therefore receives no task rows. The word `GUEST` never grants accounting access by itself.

Derived task creation stays on the generic trusted context and is not widened in this slice.

## Exact HTTP role admission

Nest `RolesGuard` uses handler metadata as an override of class metadata. GUEST is therefore admitted only on the exact handlers whose repositories were migrated and capability-gated:

- `GET /accounting/tasks`
- `POST /accounting/tasks`
- `POST /accounting/tasks/:taskId/transition`
- `GET /accounting/tasks/projection`
- `GET /accounting/connections`
- `GET /accounting/connections/attestations`
- `POST /accounting/connections/attestations/subjects`
- `POST /accounting/connections/attestations/:subjectId`

The class fence remains unchanged for document generation, advances, payments, services, period close, reconciliation and other non-migrated accounting endpoints. This is deliberate: those surfaces need their own capability-first migration before a GUEST-compatible accountant may reach them.

## Capability result

The focused contract proves the intended separation:

`GUEST + ACCOUNTANT`:

- can read the accounting dashboard/tasks;
- can manage daily tasks;
- can read integrations and sync/map 1C;
- cannot configure 1C/EDO/integrations merely because the market role is GUEST;
- cannot close the accounting package;
- cannot gain `documents.sign` from the profile.

`GUEST + EXTERNAL_ACCOUNTANT`:

- gets the daily bookkeeping core;
- does not get provider configuration;
- does not get period close/reconciliation authority;
- does not get legal signing authority.

Unprofiled GUEST gets baseline identity capabilities only.

## Connection Center and attestation

`ConnectionCenterRepository` uses the organization-member transaction path and resolves capabilities from durable `job_profile`/delegations using `WorkTaskRepository.capabilitiesWithin`.

No `integrations.read` → no connection metadata.

`ConnectionAttestationRepository` uses the same member transaction path but keeps its existing gates:

- read requires `integrations.read`;
- subject registration requires `integrations.configure`;
- gate attestation requires `integrations.configure` plus verified MFA;
- database four-person/version/hash-chain rules remain authority.

## Claims deliberately not made

- document/money/period/reconciliation endpoints are not yet migrated for GUEST accountants;
- no 1C/EDO connection was created;
- no provider was contacted;
- no production mutation;
- merge/CI are not production acceptance.

New mandatory recurring cost: **0 RUB**.
