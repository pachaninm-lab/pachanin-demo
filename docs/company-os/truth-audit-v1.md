# Company OS v1.0 — Truth Audit F1

Date: 2026-08-15
Issue: #4152
Specification: `COMPANY OPERATING & CONTROL SYSTEM · MASTER INDUSTRIAL SPECIFICATION v1.0` (14.08.2026)
Production authority: REG.RU VPS only
New recurring cost: 0 ₽

## 1. Exact source baseline

- Specification baseline: `23c22f39085b69015211f1eee7cc2509ac135022`.
- Initial live `main` checked before F1 authorization: `b74a710a2df0baa0a05ed034abbbf78c81aa6190`.
- Governance and implementation branches were then synchronized to live `main` `7511d04fb5e3442c92eb28e36d3b1c46d63897ec` before F1 review.
- The specification baseline is 43 commits behind that synchronized live baseline and is not used as implementation authority.
- The concurrent delta `b74a710… → 7511d04…` changes three auth-mail/Gekta diagnostic workflow files only; it does not intersect the F1 API/web code paths.
- F1 is intentionally additive and does not rewrite the existing platform or staff identity architecture.

## 2. Existing authority that must be reused

Status: `EXISTS`.

The current repository already contains a durable staff-access control plane with:

- `auth.staff_assignments` and server-side active-assignment resolution;
- staff access requests and approvals;
- grants and time-bounded access sessions;
- CONTROL_PLANE / VIEW_AS / ASSISTED / OPERATIONS / JIT_PRIVILEGED / BREAK_GLASS access modes;
- critical-action requests;
- role permission ceilings (`ROLE_PERMISSION_CEILING`);
- staff event/audit services and PostgreSQL-backed staff authority;
- global API authentication that enriches `/staff` requests from server-side staff assignments rather than JWT/client staff-role claims.

Decision: **do not create a second staff-auth system**.

## 3. Current staff web entry

Status before F1: `PARTIAL`.

Existing route: `/platform-v7/staff`.

Before F1 the server-rendered staff page performed these steps:

1. revalidated the access token through `/auth/me`;
2. called `/staff/assignments/me`;
3. interpreted assignment statuses in the web layer;
4. constructed `staffRoles` in the web layer;
5. checked `identity.mfaVerified` in the web layer;
6. rendered the current staff shell and operational/owner surfaces.

Separately, the global `StaffControlCenterEntry` client navigation fetched `/api/staff/assignments/me` and independently interpreted `ACTIVE/ELIGIBLE` assignment statuses to decide whether the staff entry icon should be visible.

Risk: the API remained authoritative for assignments, but two web surfaces duplicated authority interpretation instead of consuming one canonical capabilities contract.

F1 correction:

- the server-rendered staff page keeps `/auth/me` revalidation but consumes `/staff/capabilities/me` for staff authority;
- the capabilities response is parsed fail-closed and its actor id must match `/auth/me`;
- the global navigation entry consumes `/api/staff/capabilities/me` through a dedicated same-origin read-only BFF;
- that BFF forwards only the server-held access token, rejects redirects, validates the upstream response against the strict capabilities contract and never touches the privileged staff access-session cookie/header;
- navigation visibility is therefore based on a successfully parsed MFA-verified server capabilities contract, not on client interpretation of assignment status.

## 4. Capabilities endpoint

Status before F1: `MISSING`.

The Master Specification requires a server-authoritative `GET /staff/capabilities/me` contract. No such route existed on the checked baseline.

F1 adds a dedicated read-only controller/service inside the existing `StaffAccessModule`. It does not alter `StaffAccessService`, role definitions, database schema or migrations.

The F1 response contains:

- canonical staff identity subset;
- active server-side assignments;
- staff roles derived from those assignments;
- deduplicated permissions from existing role permission ceilings;
- task/workspace hints derived server-side from durable roles;
- authentication assurance (`mfaVerified`, timestamp, recent-MFA indicator);
- sanitized active privileged-session metadata;
- active server-resolved scope projections from those sessions.

The response never contains the stored session token hash, raw access credential, raw reason or ticket payload.

## 5. Security boundary

### Existing

Status: `PARTIAL`.

The application already has global bearer-token authentication, staff assignment enrichment for `/staff` routes, MFA state, explicit staff modes, access-session resolution, permission ceilings, security headers in the web middleware and protected staff surfaces.

### Still missing from the target Company OS

Status: `MISSING` / outside F1.

- dedicated `control.процент-агро.рф` host boundary;
- host-only privileged cookies scoped to the control host;
- separate production Caddy/DNS acceptance for the control host;
- final phishing-resistant WebAuthn/passkey policy for high privilege;
- complete Company OS capability-driven specialist navigation and workspaces beyond the existing staff entry;
- complete employee lifecycle authority and JML automation;
- full Party/Relationship/Partner 360 model;
- WorkItem/SLA/Case operating system;
- unified Approval Center across all Company OS domains;
- complete Unified Evidence Event contract and tamper-evident chain across every target domain;
- Company OS master capability/role/object/SoD/audit/integration matrices;
- full Employee/Manager/Owner/Partner/Fraud/Incident/DR production E2E acceptance.

Decision: **do not claim Company OS production readiness after F1**.

## 6. Role-model gap

Status: `PARTIAL`.

Current staff roles include:

- PLATFORM_OWNER
- PLATFORM_ADMIN
- SUPPORT_L1 / SUPPORT_L2
- OPERATIONS_AGENT / OPERATIONS_SUPERVISOR
- FINANCE_OPS
- COMPLIANCE_STAFF
- DEVELOPER
- SRE_ONCALL
- SECURITY_AUDITOR
- BREAK_GLASS_ADMIN

Roles named in the Company OS target model but not yet represented as dedicated current staff roles include, among others:

- ACCOUNT_MANAGER
- REGISTRATION_REVIEWER
- FRAUD_ANALYST
- QUALITY_REVIEWER
- CONTRACT_MANAGER
- DATA_STEWARD
- HR_STAFF

Decision: do not add these roles in F1. Role expansion requires a separate capability/SoD matrix slice so new standing privilege is not introduced casually.

## 7. Company OS capability matrix — F1 truth

| Capability | Status before F1 | F1 result |
|---|---|---|
| Persistent staff identity/auth | EXISTS | reused |
| Active staff assignments | EXISTS | reused |
| Role permission ceilings | EXISTS | reused |
| MFA state | EXISTS | reused |
| Time-bounded privileged access sessions | EXISTS | exposed only as sanitized metadata |
| Break-glass framework | EXISTS | unchanged |
| Critical-action framework | EXISTS | unchanged |
| `GET /staff/capabilities/me` | MISSING | implemented |
| Web consumption of canonical staff capabilities | PARTIAL | implemented for server page and global staff navigation entry |
| Dedicated read-only capabilities BFF | MISSING | implemented without privileged staff-session credential access |
| Company OS control host | MISSING | deferred to separate infrastructure slice |
| Employee/Manager/Owner target workspaces | PARTIAL | not accepted by F1 |
| Unified Company OS Evidence Plane | PARTIAL | not accepted by F1 |
| People/JML | MISSING/PARTIAL | deferred |
| Partner 360 | PARTIAL/MISSING | deferred |
| WorkItem/SLA/Case | PARTIAL/MISSING | deferred |
| Finance/Risk full control centers | PARTIAL | deferred |
| Full production E2E | MISSING | deferred |

## 8. F1 invariants

1. No new database table or migration.
2. No new standing permission or staff role.
3. No client-selected staff authority.
4. No staff access without verified MFA and an active server-side assignment.
5. `capabilities` is a union of existing `ROLE_PERMISSION_CEILING` values only.
6. Active scope is derived from server-side privileged sessions only.
7. Session credential material is never returned.
8. Server and client web parsing is fail-closed.
9. `/auth/me` actor id and `/staff/capabilities/me` actor id must match on the server-rendered entry.
10. The client navigation uses a dedicated read-only BFF and never receives or sends the privileged `x-staff-access-session` credential.
11. F1 performs no DNS, Caddy, Compose, secret, migration or production mutation.

## 9. Next vertical slice after F1 acceptance

`F2 — control-host security boundary` should be authorized separately and only after F1 exact-head review/CI:

1. `control.процент-агро.рф` DNS and certificate plan;
2. Caddy host routing to the existing application without creating a second auth authority;
3. control-host-only privileged session/cookie boundary;
4. strict Origin/CSRF and noindex/no-store verification;
5. secure redirect from legacy staff entry where appropriate;
6. live REG.RU evidence with exact OCI revision, host routing and rollback proof.

Application merge, green CI or image publication alone must not be called deployment.
