# Staff Access Control Plane

Status: target architecture and implementation contract. This document does not assert that production migration, staff identities, JIT grants or break-glass operation have been activated.

## Purpose

The platform separates business-participant authority from internal staff authority. A staff member never becomes a buyer, seller, bank, laboratory, surveyor or arbitrator merely by opening that cabinet. The authenticated actor remains the real staff user; the target organization, user and surface role are recorded as an effective subject.

## Governing rules

1. Deny by default and authorize every request on the server.
2. No ADMIN or SUPPORT role bypasses route or tenant authorization.
3. Staff roles are stored separately from `user_orgs` business memberships.
4. `PLATFORM_OWNER` receives global control-plane visibility, but customer-context access is still reasoned, time-bound and audited.
5. View-as is read-only. Assisted and operations modes expose only named permissions.
6. Developer and SRE access is eligible/JIT by default, scoped to a resource and time window.
7. Financial, signature, laboratory-finalization, bank-callback and arbitration outcomes cannot be executed through view-as, assisted or break-glass sessions.
8. Critical actions require step-up MFA and approvals from distinct users; requesters cannot approve their own action.
9. Break-glass is short-lived, separately notified, fully audited and followed by review.
10. Every audit record preserves actual actor and effective subject separately.

## Staff roles

- `PLATFORM_OWNER`
- `PLATFORM_ADMIN`
- `SUPPORT_L1`
- `SUPPORT_L2`
- `OPERATIONS_AGENT`
- `OPERATIONS_SUPERVISOR`
- `FINANCE_OPS`
- `COMPLIANCE_STAFF`
- `DEVELOPER`
- `SRE_ONCALL`
- `SECURITY_AUDITOR`
- `BREAK_GLASS_ADMIN`

## Access modes

- `CONTROL_PLANE`: staff workspace without customer impersonation.
- `VIEW_AS`: read-only projection of a customer cabinet.
- `ASSISTED`: bounded support actions tied to a ticket.
- `OPERATIONS`: state-machine operations explicitly assigned to platform operations.
- `JIT_PRIVILEGED`: temporary privileged diagnostics or administration.
- `BREAK_GLASS`: emergency-only access with a maximum 15-minute lifetime.

## Required audit dimensions

`actor_user_id`, `staff_role`, `target_tenant_id`, `target_organization_id`, `target_user_id`, `target_role`, `access_mode`, `grant_id`, `access_session_id`, `reason`, `ticket_id`, `approvers`, `mfa_level`, `ip_hash`, `user_agent_hash`, `correlation_id`, action, resource, outcome, previous hash and current hash.

## Production activation gates

- production auth API and PostgreSQL are deployed;
- forward-only migration is reviewed and applied through change control;
- first owner is bootstrapped through a one-time audited procedure;
- staff MFA and step-up MFA are verified;
- notification channel for JIT and break-glass events is configured;
- cross-tenant, expiry, revocation, self-approval and critical-action tests are green;
- owner and support workflows pass browser, accessibility and mobile acceptance;
- monitoring, access reviews and incident runbooks are operational.
