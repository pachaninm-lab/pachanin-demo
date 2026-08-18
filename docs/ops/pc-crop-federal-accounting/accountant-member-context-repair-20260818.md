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

The capability resolver already follows that model. The generic PostgreSQL transaction helper did not: it rejected every `Role.GUEST` before the database could resolve the ACTIVE organization membership and job profile. That made the intended compatibility model unreachable for any repository using the generic helper.

## What this slice changes

The generic `deriveTrustedRlsContext` / `withTrustedContext` path remains unchanged in security meaning: `GUEST` is still denied there.

A separate `withOrganizationMemberContext` path is introduced for reviewed organization-member contours. It:

1. requires authenticated user id, session id, tenant id and organization id;
2. sets the same transaction-local identity context;
3. immediately calls PostgreSQL `public.app_pc_crop_membership_id()`;
4. refuses with `organization_membership_required` unless PostgreSQL resolves an ACTIVE membership for the current authenticated identity and organization;
5. runs the business callback only after that proof.

The role label therefore does not become authority. A forged organization/tenant, revoked membership or missing membership fails before business work.

## Connection Center migration

`ConnectionCenterRepository` now uses the organization-member transaction path and then resolves capabilities from durable `job_profile`/delegations using the existing `WorkTaskRepository.capabilitiesWithin` authority.

No `integrations.read` → no connection metadata.

`ConnectionAttestationRepository` moves to the same member transaction path but keeps its existing gates:

- read requires `integrations.read`;
- subject registration requires `integrations.configure`;
- gate attestation requires `integrations.configure` plus verified MFA;
- database four-person/version/hash-chain rules remain authority.

## What is deliberately still closed

This slice does **not** add `GUEST` to AccountingController routes yet. The HTTP role fence remains closed until the task-first repository and exact route methods are migrated together to capability-first authorization. That keeps this repair from accidentally opening document, money, period-close or other accounting endpoints to an unprofiled GUEST.

The follow-up route slice must prove:

- `GUEST + ACCOUNTANT` can open the work queue;
- `GUEST + EXTERNAL_ACCOUNTANT` gets only its intended bookkeeping capabilities;
- unprofiled `GUEST` receives no accounting/connection data;
- non-target accounting endpoints remain behind their existing role/capability fences.

## Claims deliberately not made

- no external accountant can reach the accounting HTTP routes from this slice alone;
- no 1C/EDO connection was created;
- no provider was contacted;
- no production mutation;
- merge/CI are not production acceptance.

New mandatory recurring cost: **0 RUB**.
