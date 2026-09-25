# R1.1 exact inventory — Founder/CEO + 13 production cabinets

Status: **R1.1 INVENTORY / current-main grounded**  
MASTER: `PC-CROP_CODEX_MASTER_TZ_v2.1_2026-09-12`  
Exact baseline main/production: `5da8e80744908413102214f91dd68018911b892e`  
Team Hub: #5469  
Parallel PRODUCT head observed before this inventory pass: PR #5465; no exact path overlap with this governance PR.

This document is evidence for R1.1 only. It is not R1 PRODUCTION_PASS and it does not grant implementation authority outside the admitted R1 scope.

## 1. MASTER acceptance being inventoried

R1 = 7 points. The applicable MASTER requirements are:

- `REQ-ROL-001`: exact 13 production cabinets come from actual server-side role/route registry.
- `REQ-ROL-002`: role × object × read/create/update/approve/sign/pay/admin matrix.
- `REQ-ROL-003`: role changes do not create leaks/dead ends; access is recomputed server-side.
- `REQ-ROL-004`: Founder/CEO controlled “open as role” to all 13 cabinets without replacing identity, tenant or audit actor.
- `REQ-ROL-005`: open/return preserves context and special-mode banner shows organization, role and limits.
- `REQ-ROL-006`: Founder action in role mode has real actor, effective role, reason and audit; high-risk action keeps ordinary authority + MFA.
- `REQ-R1-001`: Company Health combines business/operations/finance/risk/system health with source + drill-down per value.
- `REQ-R1-002`: P0/P1 queue has owner, deadline, impact, next action and escalation.
- `REQ-R1-003`: Founder role-mode adds no domain service role and weakens no tenant/role authority.
- `REQ-R1-004`: 13/13 open, permitted read/action, return, denied/high-risk acceptance.
- `REQ-R1-005`: no fake/demo fallback and no client-selected role authority.

R1_PASS remains: exact-SHA live 13/13 matrix PASS, Founder metrics real-data-only, security negative tests PASS.

## 2. Exact production cabinet registry — 13/13

Primary current registry for owner-cabinet roots:
`apps/web/lib/platform-v7/control-host.ts :: OWNER_CONTROLLED_CABINET_TARGETS`.

API-role → verified-cabinet binding:
`apps/web/lib/platform-v7/verified-session.ts :: API_ROLE_TO_CABINET`.

| # | Cabinet | Canonical root | API/business role authority | Current owner-target state |
|---:|---|---|---|---|
| 1 | Operator | `/platform-v7/operator` | `SUPPORT_MANAGER` / `ADMIN` → `operator` | route exists; owner shortcut exists |
| 2 | Buyer | `/platform-v7/buyer` | `BUYER` → `buyer` | route exists; owner shortcut exists |
| 3 | Seller | `/platform-v7/seller` | `FARMER` → `seller` | route exists; owner shortcut exists |
| 4 | Logistics | `/platform-v7/logistics` | `LOGISTICIAN` → `logistics` | route exists; owner shortcut exists |
| 5 | Driver | `/platform-v7/driver/field` | `DRIVER` → `driver` | route exists; owner shortcut exists |
| 6 | Surveyor | `/platform-v7/surveyor` | `SURVEYOR` → `surveyor` | route exists; owner shortcut exists |
| 7 | Elevator | `/platform-v7/elevator` | `ELEVATOR` → `elevator` | route exists; owner shortcut exists |
| 8 | Laboratory | `/platform-v7/lab` | `LAB` → `lab` | route exists; owner shortcut exists |
| 9 | Bank / accounting | `/platform-v7/bank` | `ACCOUNTING` or `BANK` → `bank` | route exists; owner shortcut exists |
| 10 | Organization employee | `/platform-v7/profile` | `GUEST` → `organization` | 13th cabinet exists; not a PlatformRole |
| 11 | Arbitrator | `/platform-v7/arbitrator` | `ARBITRATOR` → `arbitrator` | route exists; owner shortcut exists |
| 12 | Compliance | `/platform-v7/compliance` | `COMPLIANCE_OFFICER` → `compliance` | route exists; owner shortcut exists |
| 13 | Executive | `/platform-v7/executive` | `EXECUTIVE` → `executive` | route exists; owner shortcut exists |

**KEEP:** exact count/route identity can be derived without inventing roles.  
**Finding:** several legacy role registries are narrower or structurally different. For example `shared/role-contract.ts` lacks SURVEYOR/ARBITRATOR/COMPLIANCE and `apps/api/src/platform-v7/rbac/permissions.ts` lacks SURVEYOR and organization employee while also containing internal `support`. They cannot be used as the sole 13-cabinet authority. R1 must preserve a single explicit mapping from the canonical 13 roots to underlying server roles.

## 3. Current business permission envelope

Current coarse server permission matrix:
`apps/api/src/platform-v7/rbac/permissions.ts :: PLATFORM_V7_PERMISSION_MATRIX`.

| Cabinet | Current explicit authority in that matrix |
|---|---|
| Seller | deal read/write own-object; logistics read own; quality read own; money read own; dispute read/write own |
| Buyer | seller envelope + money release **request** on own-object |
| Bank | deal read tenant; money read/basis review tenant; audit read tenant |
| Logistics | deal read tenant; logistics read/write tenant |
| Driver | deal read own-object; logistics read/write own-object |
| Elevator | deal read tenant; logistics read tenant; quality read/write tenant |
| Lab | deal read tenant; quality read/write tenant |
| Arbitrator | dispute read/write tenant; audit read tenant |
| Compliance | deal read tenant; money read tenant; audit read tenant |
| Executive | platform-readonly deal/logistics/quality/money/dispute/audit |
| Operator | tenant deal read/write; logistics read/write; quality read; dispute read; audit read |
| Surveyor | **not represented in this matrix** |
| Organization employee | **not represented as a PlatformV7Role in this matrix** |

Additional route/resource matrices exist in `apps/web/lib/commercial-route-guards.ts`, `provider-assignment-access.ts`, role route policies and domain services.

**Classification for REQ-ROL-002: EXTEND_EXISTING.** Existing matrices are useful regression authorities, but there is no one canonical 13 × object × verb matrix covering read/create/update/approve/sign/pay/admin. Surveyor and organization employee coverage must be made explicit rather than inferred from unrelated UI registries.

## 4. Existing Founder / staff authority that must be reused

Primary server authority:
- `apps/api/src/modules/staff-access/staff-access.types.ts`
- `staff-access.service.ts`
- `staff-access.controller.ts`
- `staff-capabilities.service.ts`
- `staff-projection.service.ts`
- `staff-delegated-access.guard.ts`
- durable `auth.staff_*` tables/migrations.

Existing staff modes:
`CONTROL_PLANE`, `VIEW_AS`, `ASSISTED`, `OPERATIONS`, `JIT_PRIVILEGED`, `BREAK_GLASS`.

Existing `PLATFORM_OWNER` facts:
- durable active assignment is required;
- staff capabilities are server-derived from current durable assignments;
- every staff mode requires MFA; recent-MFA is separately measured;
- session permissions are clipped against current `ROLE_PERMISSION_CEILING`;
- sessions store actual actor plus effective tenant/org/user/role and expiry;
- `VIEW_AS` is guarded as read-only and target organization/role must match the session;
- critical staff actions are a separate two-person/one-time path;
- forbidden staff actions include money reserve/release, beneficiary change, bank callback confirm, document sign, lab finalize, acceptance sign, arbitration decision and evidence delete;
- staff audit is append-only/hash-chained and records actual actor and effective subject dimensions.

Useful existing endpoints include:
- `GET /staff/capabilities/me`
- `GET /staff/assignments/me`
- `POST /staff/access/requests`
- `POST /staff/access/grants/:id/activate`
- `POST /staff/access/sessions/:id/end`
- `POST /staff/access/sessions/:id/revoke`
- `GET /staff/organizations`
- `GET /staff/organizations/:organizationId/users`
- `GET /staff/organizations/:organizationId/cabinet/:role` under `VIEW_AS`
- `GET /staff/audit/events`
- critical-action request/decision/consume endpoints.

**KEEP:** this is the canonical authority substrate for R1. No new “Founder domain role” is required.

## 5. Current owner direct-cabinet shortcut — why it is not R1 PASS evidence

Files:
- `apps/web/app/platform-v7/staff/open-cabinet/route.ts`
- `apps/web/lib/platform-v7/controlled-test-organizations.ts`
- `apps/web/lib/platform-v7/owner-controlled-cabinet-server.ts`
- middleware/control-host owner-root checks.

Positive properties:
- owner must have active `PLATFORM_OWNER` + MFA;
- the owner bearer identity is not replaced with a buyer/seller/etc API identity;
- signed HttpOnly cabinet session carries role/org/tenant;
- protected business routes still use server-side signed context;
- ordinary business API authorization is not bypassed.

Blocking properties for MASTER R1:
- real production owner opening is still bound to `controlledCabinetContext(role)`;
- those contexts use `tenant-canonical-test` and controlled test organizations;
- the shortcut emits owner session cookies directly rather than using the durable staff `VIEW_AS` access-session/audit model;
- the direct open has no durable reason/ticket/session audit equal to REQ-ROL-006;
- current acceptance tests intentionally describe the data as controlled/test.

**Classification: REMOVE_OR_SUPERSEDE for R1 production path, while preserving it only as a bounded test/fixture contour if still needed by regression.**

## 6. Client-selected role / tenant status

Protected platform routes:
- ordinary business role is accepted from a cryptographically verified API/cabinet token;
- `verified-session.ts` rejects demo tokens and purpose/audience mismatch;
- protected layout/middleware re-checks role/org/tenant context;
- API `RolesGuard` has no staff/global bypass;
- staff customer-context access is separately authorized through durable staff sessions.

Presentation helpers still have role cookies/query helpers in public/legacy routing. These do **not** satisfy protected authority and must not be promoted into R1 authority.

**REQ-R1-005 current classification:** EXTEND_EXISTING because protected authority is server-side, but the R1 owner path still depends on controlled-test fallback and therefore cannot pass yet.

## 7. R1 requirement classification

| Requirement | Current classification | Exact remaining delta |
|---|---|---|
| REQ-ROL-001 exact 13 | **KEEP** | freeze canonical 13 mapping and regression-test drift |
| REQ-ROL-002 role×object×verbs | **EXTEND_EXISTING** | produce one server-owned matrix incl. surveyor + organization employee + approve/sign/pay/admin |
| REQ-ROL-003 role change safety | **EXTEND_EXISTING** | prove revocation/role-change mid-session/mid-Deal, stale session and recomputation cases |
| REQ-ROL-004 controlled open-as-role | **EXTEND_EXISTING → NEW production binding** | reuse staff access sessions; remove controlled-test target from production evidence; keep real actor |
| REQ-ROL-005 banner + return | **NEW_REQUIRED / PRODUCT handoff** | server contract for mode/org/role/limits/return; consume ACCOUNT_2_PRODUCT UI rather than redesign |
| REQ-ROL-006 actor/effective role/reason/audit | **KEEP substrate + EXTEND** | route all R1 role-mode through durable staff session/audit; high-risk denial regression |
| REQ-R1-001 Company Health | **NEW_REQUIRED** | real PostgreSQL aggregations across business/ops/finance/risk/system with metric source/drill-down |
| REQ-R1-002 P0/P1 queue | **NEW_REQUIRED** | normalized item with owner/deadline/impact/nextAction/escalation/source |
| REQ-R1-003 no service role/bypass | **KEEP substrate + EXTEND** | R1 contract test proving no new business/domain role and no tenant relaxation |
| REQ-R1-004 13/13 acceptance | **NEW_REQUIRED** | exact-SHA desktop/mobile open/read-or-action/return + denied/high-risk matrix on REG.RU |
| REQ-R1-005 no fake/client authority | **BLOCKING DELTA** | no controlled-test/demo/fake fallback in R1 production path; all role/target selection server validated |

## 8. Founder/CEO metrics inventory

Current main has executive/analytics surfaces and multiple legacy/demo/simulation metric helpers, but **no current-main `apps/api/src/modules/founder-control/**` module**.

Stale PR #5182 contains a prior Founder implementation but diverges materially from current main. It is not merge authority. Reuse is allowed only by manually porting and revalidating bounded backend contracts against current schemas/permissions.

Specific truth risk already visible in current code:
- `apps/api/src/modules/analytics/analytics.service.ts` returns mock economics when Prisma is unavailable. That path cannot feed R1 Founder metrics.
- several legacy web analytics/runtime snapshot files contain fixture/default values. They cannot feed R1 Company Health.
- existing staff `pendingApprovals` counts are access-control counts, not the MASTER P0/P1 business decision queue.

**R1.3/R1.4 requirement:** all Founder metrics and queue items must carry source/grain/freshness/drill-down and fail closed to explicit unavailable/empty rather than fabricated numeric values.

## 9. Safe serial execution after R1.1

1. **R1.2 server authority** — extend existing staff access plane for real authorized target org/tenant/role sessions; no UI redesign.
2. **R1.3 Company Health + P0/P1 contracts** — API/data layer only first; real-source contracts and drill-down.
3. **R1.4 finance/commercial metrics** — cash/runway, pipeline, client P&L, AR/DSO, forecast, retention, hiring/scale gates; real-data-only.
4. **R1.5 integration/acceptance** — consume PRODUCT UI handoff; 13/13 desktop/mobile live matrix, return/banners, denied/high-risk, exact-SHA REG.RU observation.
5. R1 points remain 0 until full R1 PRODUCTION_PASS.

## 10. R1.1 verdict

`REQ-ROL-001` inventory is proven from current main.

R1 is **not** production-passed. The most important factual blockers are:
1. current direct owner cabinet mode is controlled-test-bound;
2. role/object permission authority is fragmented and incomplete for the canonical 13;
3. Founder Company Health/P0-P1/financial data layer is absent from current main;
4. R1 live 13/13 and negative acceptance do not exist yet.

R1.1 can close after this inventory is admitted to trusted main. The safe next slice is R1.2 backend/server authority.
