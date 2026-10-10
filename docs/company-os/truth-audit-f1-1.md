# Company OS v1.0 — Truth Audit F1.1

Date: 2026-08-15
Parent: #4152
Slice: #4158
Authority baseline: `9bcf73cc4f8f3773a03d197768f9d7be0c4d5f9f`
Production authority: REG.RU VPS only
New recurring cost: 0 ₽

## 1. Finding

F1 established one server-authoritative capabilities contract, but Master Specification §19.2 still had a structural gap: `/staff` endpoints did not have one machine-verifiable authorization/audit classification authority. Existing security was split across global authentication, durable assignment checks, `StaffAccessGuard`, mode metadata, permission metadata and service-level ownership/MFA checks.

That is secure in many individual paths but insufficient as a governance invariant because a newly added route could omit the expected combination without a dedicated endpoint-classification gate.

## 2. Route inventory

The F1.1 checker enumerates Nest route metadata from all three current staff controllers:

- `StaffAccessController`;
- `StaffCapabilitiesController`;
- `StaffWorkspaceController`.

Current inventory: **47 `/staff` routes**.

Every route must have exactly one source-controlled policy entry. A route without an entry, a duplicate policy, or a policy with no current controller route fails the contract test.

## 3. Authorization classes

F1.1 defines six non-overlapping classes:

1. `STAFF_SELF_AUTHORITY_READ` — actor-only authority discovery before a privileged access session exists.
2. `STAFF_SELF_GOVERNANCE_MUTATION` — actor-owned request/grant/session lifecycle.
3. `STAFF_EMERGENCY_MUTATION` — break-glass activation/end lifecycle.
4. `STAFF_PRIVILEGED_READ` — active staff access session + exact mode + exact permission.
5. `STAFF_PRIVILEGED_MUTATION` — active staff access session + exact mode + exact permission for bounded non-critical mutations.
6. `STAFF_CRITICAL_MUTATION` — privileged or policy-sensitive mutations that must remain in the critical evidence class.

Audit classes are bound in the same registry:

- `STANDARD_READ`;
- `SENSITIVE_READ`;
- `MUTATION`;
- `CRITICAL_MUTATION`.

The test rejects GET routes mapped to mutation audit classes and POST routes mapped to read audit classes. Emergency and critical authorization classes must map to `CRITICAL_MUTATION`.

## 4. Self-authority boundary

Actor-only reads are limited to exact non-parameterized paths:

- `GET /staff/assignments/me`;
- `GET /staff/access/requests`;
- `GET /staff/access/sessions`;
- `GET /staff/capabilities/me`.

These routes do not require an already-active JIT/control-plane session because they are needed to discover and establish staff authority. The gate forbids dynamic target selectors in this class.

Actor-owned self-governance mutations are explicitly limited to:

- `POST /staff/access/requests` — target scope remains server validated;
- `POST /staff/access/grants/:id/activate` — grant ownership is enforced by the service/repository path;
- `POST /staff/access/sessions/:id/end` — only the actor's active session can be ended by this self route.

## 5. Emergency boundary

Break-glass lifecycle is not classified as ordinary self-governance:

- activation and direct end are `STAFF_EMERGENCY_MUTATION`;
- the workspace emergency end route is also `STAFF_EMERGENCY_MUTATION` even though it additionally requires an active privileged staff session.

This preserves the stronger reason/ticket/duration/notification/evidence semantics already present in the emergency services.

## 6. Privileged boundary consistency

For every policy with `requiresAccessSession = true`, the checker compares the declared policy against actual Nest metadata and requires:

- `StaffAccessGuard` at method or controller level;
- exact `StaffAccessMode[]` equality;
- exact `StaffPermission[]` equality;
- at least one mode and permission.

Self-authority/self-governance routes must not accidentally acquire `StaffAccessGuard`, privileged mode or permission metadata, because that would make pre-session authority discovery impossible and would signal a classification contradiction.

## 7. Registration review gap closed

Before F1.1, `GET /staff/registration/applications` performed a durable `STAFF_REQUEST_READ` ceiling check in the controller/service path but did **not** require an active `CONTROL_PLANE` staff access session.

That route is a cross-user platform review queue and is not actor-only authority discovery.

F1.1 adds:

- `StaffAccessGuard`;
- `StaffAccessMode.CONTROL_PLANE`;
- `StaffPermission.STAFF_REQUEST_READ`;

while retaining the durable assignment ceiling check. The decision endpoint continues to require `CONTROL_PLANE + STAFF_REQUEST_APPROVE` and the durable ceiling check.

## 8. Negative acceptance

The contract tests contain explicit negative fixtures proving:

- an added unclassified `/staff` route produces a coverage error;
- contradictory privileged mode metadata does not satisfy the declared policy;
- duplicate/stale policy entries are rejected by the same coverage logic;
- self reads cannot be parameterized into cross-user/tenant routes;
- emergency/critical routes cannot be downgraded to ordinary mutation audit classes.

## 9. What F1.1 does not claim

F1.1 is **not** the complete Company OS Evidence Plane or final Master Capability/Role/Object/SoD/Audit matrix.

It establishes the endpoint authorization/audit classification gate required to prevent silent growth of unclassified staff API surface. Runtime evidence emission remains provided by the existing staff services/interceptors and will be unified further in later Company OS evidence/policy slices.

It also does not create the dedicated `control.процент-агро.рф` security boundary; that remains #4159 after this gate is accepted.

## 10. Acceptance rule

F1.1 is accepted only when:

1. governance scope is merged;
2. implementation diff stays inside the five authorized paths;
3. all 47 current routes classify exactly once;
4. registration review list is session-bound;
5. API typecheck/unit/RLS/security/CI exact-head checks pass;
6. no production mutation occurs.

Merge/build alone is not production evidence.
