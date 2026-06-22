# Phase 4 — Server-Side Cabinet Enforcement Design (platform-v7)

Status: **controlled-pilot / pre-integration · docs-only · NO code change.**
This is the **design** for moving cabinet (role) isolation from client-only to
server-verified. It writes no product code, no backend implementation, no route
rewrite, no `layout.tsx`, touches no `apps/landing`, and makes no production-ready
claims. Implementation is explicitly deferred to gated phases 4B–4D.

Honest framing (do not overstate):
- This is a **design**, not a fix. Cabinet isolation remains client-only until the
  gated rollout (4C+) lands and is verified.
- The API **already** has real server-side RBAC, object-scope and audit-on-deny
  (see §1.2). The gap is specifically the **platform-v7 web cabinet route layer**.

---

## 1. Current problem (verified)

### 1.1 Web cabinet isolation is client-only
- Middleware derives role from the **URL path**, then a cookie — not from a verified
  identity: `resolvePlatformV7PathRole()` (`apps/web/middleware.ts:181`) maps the path
  prefix to a role; `resolveRole()` (`:197`) uses that path-role first, then the
  `pc-role` cookie (`:201`). It sets `x-pc-role` and persists `pc-role`. There is **no
  cross-role 403/redirect** at the server.
- The real lock is **client JS**: `PlatformV7SingleEntryGuard` and
  `PlatformV7RoleLockFix` read `sessionStorage['pc-v7-active-role']` and
  `router.replace` on mismatch; `cabinet-access-policy.ts` runs in the browser.
- **Login is unauthenticated** in the platform-v7 demo shell: a user picks any of the
  12 roles, which sets the session key / `pc-role` cookie with no credential check.
- **Implication:** before hydration, with JS disabled, or via direct SSR/deep link, the
  target cabinet's shell renders. A `pc-role` cookie or a path prefix is sufficient to
  "become" a role for the **web shell**. This is the standing TЗ rule: *frontend
  role-lock is insufficient; server-side enforcement must be in roadmap/реализации.*

### 1.2 The API already enforces identity + RBAC + object-scope + audit
This is the asset to build on, **not** to rewrite:
- **Identity is real, JWT-based**: `apps/api/src/modules/auth/auth.service.ts` issues
  JWTs (`jsonwebtoken`) over bcrypt-hashed credentials; each user binds `{ id, email,
  role, orgId }`.
- **Role gate**: `RolesGuard` (`apps/api/src/common/guards/roles.guard.ts`) checks
  `@Roles(...)` against `req.user`.
- **Object scope + audit-on-deny**: `ActionExecutorService.assertObjectScope()`
  (`apps/api/src/common/action-executor/action-executor.service.ts:77`) enforces
  executive-read-only, driver-own-shipment, and **cross-organization denial**, each
  writing an `audit.log(...)` entry before throwing `ForbiddenException`. The full
  `execute()` pipeline (`:156`) is *permission → object scope → state gates → fn →
  audit*.
- **Web ↔ API seam exists**: server fetches send auth headers
  (`apps/web/lib/api-server.ts`, `serverAuthHeaders()`), and a token refresh path
  exists (`apps/web/lib/api.ts` `/api/auth/refresh`).

**So the gap is narrow and specific:** the web cabinet **route** layer does not bind to
the verified JWT identity the API already trusts. Two role notions coexist — the web
shell's URL/cookie role, and the API's JWT `req.user.role/orgId`.

### 1.3 Why this is the priority over duplicate routes
A crooked alias route is a UX/maintenance issue. A cabinet that *renders* for an
unauthenticated/wrong role is a **trust/security** issue for a bank/pilot context.
Phase 4 (this) ranks above Phase 5 (route cleanup).

## 2. Target model

A single, server-verified identity is the source of truth for cabinet access.

- **Identity / session boundary**: the verified **JWT session** (the API's existing
  user) is authoritative. The web shell must read the role from a server-verifiable
  session (httpOnly cookie / token), **not** from the URL path or a writable
  `pc-role` cookie.
- **Company / user / role binding**: `{ userId, role, orgId }` comes from the JWT —
  the same triple the API already trusts. The web "active role" must equal the session
  role (oversight roles aside, per `OVERSIGHT_ROLES`).
- **Server-side cabinet access check**: a server boundary (see §3) decides, per
  request, whether the session's role may open the requested cabinet path — reusing
  the existing `canRoleAccessCabinet(role, path)` *logic* but fed a **verified** role.
- **Object-scope access**: data stays gated by the API's `assertObjectScope` (org /
  ownership / read-only) — unchanged; the design only makes the **web route** agree
  with it.
- **Denied / rejected audit event**: every server-side cabinet denial emits an audit
  event (same shape/sink as `ActionExecutorService` denials), so blocked cross-cabinet
  attempts are observable.

## 3. Where enforcement lives (layers, single source of truth)

The JWT identity is the single source of truth; each layer reads it, none invents its
own role:

1. **Web route layer** — middleware + server components / route handlers verify the
   session (httpOnly cookie/token), resolve the **session role**, and apply the cabinet
   access decision server-side (redirect to the role home or 403 on mismatch). This
   replaces URL/`pc-role`-derived role *as the authority* (client guards may remain as
   a fast-path UX, but are no longer the security boundary).
2. **API / server actions** — continue to require the JWT; server actions that read
   deal/cabinet data run through the API.
3. **API `RolesGuard`** — unchanged; the allow-list gate on controllers.
4. **Object-scope checker** — `ActionExecutorService.assertObjectScope` unchanged; the
   org/ownership/read-only authority for objects.
5. **Audit journal** — `AuditService` receives both the existing API denials and the
   **new web cabinet-denial events**, for one observable trail.

## 4. Minimal safe rollout

Strictly incremental, reversible, flag-gated — never a big-bang switch:

1. **Feature flag** — e.g. `PLATFORM_V7_SERVER_CABINET_RBAC` (off by default). Nothing
   changes until it is on.
2. **Report-only** — with the flag in `report` mode, the server boundary **computes**
   the access decision and **emits the audit event** on would-be-denials, but does
   **not** redirect/block. Lets us measure false positives against real navigation
   before enforcing.
3. **Block-mode for one cabinet** — enable enforcement for a single, well-bounded
   cabinet first (proposed: **bank**, now canonical post-PR-3), redirecting foreign
   sessions to their role home. Validate no loops, no breakage.
4. **Expand by role** — turn on block-mode role-by-role (or cabinet-by-cabinet),
   each step gated on owner approval and green checks, with the flag as the rollback.

## 5. What must NOT be done

- **Do not "fix" this with client guards.** Hardening `PlatformV7SingleEntryGuard` /
  `PlatformV7RoleLockFix` only moves a client-only lock around — it is not server
  enforcement.
- **Do not rewrite the whole auth stack.** Reuse the existing JWT identity, `RolesGuard`
  and `assertObjectScope`. This is a binding/reconciliation effort, not a new auth system.
- **Do not break current cabinets.** Report-only first; block-mode only behind the flag,
  one cabinet at a time; the role home redirect must be loop-free.
- **No fake production-ready / "secure" claims.** Until 4C+ ships and is verified, the
  honest status stays *client-only isolation; server-side enforcement designed, gated,
  not yet enforced.*

## 6. Test plan (for 4B+ — specified now, executed later)

- **Foreign cabinet blocked**: a session bound to role A cannot open role B's cabinet
  (server redirect to A's home or 403), including before hydration / JS disabled.
- **Direct URL no access**: deep-linking `/platform-v7/<other-role>` with a mismatched
  session does not render the foreign shell server-side.
- **API object isolation**: the API does not return another org's objects (existing
  `assertObjectScope` cross-org denial — add explicit coverage).
- **Denied event audited**: each server-side cabinet denial writes an audit event
  (assert sink + shape).
- **Allowed path unbroken**: a session opening its own cabinet (and oversight opening
  any) is never blocked; shared routes (`/open`, `/login`, `/ai`, `/status`) stay open.
- **No redirect loop**: mismatch → role-home redirect terminates (home is always
  allowed for its own role); report-only emits but never redirects.

## 7. Migration plan (phased, gated)

- **Phase 4A — Design (this doc).** docs-only. ✅
- **Phase 4B — Report-only scaffold.** Behind `PLATFORM_V7_SERVER_CABINET_RBAC=report`:
  server reads the verified session, computes the cabinet decision, emits audit events
  on would-be-denials; **no redirect/block**. Smallest code surface; reversible by flag.
- **Phase 4C — One-role/one-cabinet enforcement.** Block-mode for a single cabinet
  (bank) behind the flag; full §6 test suite; owner-approved.
- **Phase 4D — All-role rollout.** Expand block-mode role-by-role after approval, flag
  as rollback; only then update the honesty status to "server-side cabinet enforcement
  enforced for «…»".

Each of 4B–4D is a separate, gated PR. None starts without explicit owner approval and
green required checks.

## 8. Honesty gate

Do not claim from this document: "secure role isolation", "server-side RBAC done",
"cabinets are locked", "production-ready". Allowed framing: *the API already enforces
identity/RBAC/object-scope/audit; web cabinet isolation is still client-only; Phase 4
designs a flag-gated, report-only-first path to bind web cabinet access to the verified
JWT identity, reusing the existing API enforcement — designed, not yet enforced.*

This document changes no code. It is a design and a gated plan.
