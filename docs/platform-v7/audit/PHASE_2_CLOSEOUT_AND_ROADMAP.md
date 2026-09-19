# Phase 2 Closeout & Next-Phase Roadmap (platform-v7)

Status: **controlled-pilot / pre-integration · docs-only · NO code change.**
This document closes Phase 2 (the narrow, safe role-cockpit pass) and lays out a
controlled roadmap for the remaining, higher-risk work so it is **not** attempted
as another "quick fix". It changes no product code, no `layout.tsx`, no routes, no
role-lock/RBAC/backend, and `apps/landing` is untouched.

Honest framing (do not overstate):
- Phase 2 fixed **consistency and coupling** issues. It did **not** make cabinet
  isolation secure, did **not** add server-side enforcement, and did **not**
  collapse the duplicate route surface. Those remain open and are described below
  as gated work, not as done.

---

## 1. Phase 2 result — what shipped (narrow, safe PRs)

Phase 2 was executed as small, single-concern PRs, each green on all required CI
checks (autopilot-guard, ci, build, web-unit, qodana, codeql, dependency-review,
plan, dry-run) and merged via squash:

| PR | # | Concern | Nature |
|---|---|---|---|
| PR-1 | #1951 | Role-lock de-polling | removed a 50ms `setInterval`; event/state-driven |
| PR-2 | #1952 | support/investor routing decision | explicit internal/non-core classification |
| PR-3 | #1953 | Canonical bank route | `/bank` canonical, `/bank/clean` → redirect alias |
| PR-4 | #1954 | Arbitrator legacy import | relocated cockpit off the legacy `v7r` route tree |
| PR-5 | #1955 | Loading-state consistency | `loading.tsx` for the 5 layout-less role segments |
| PR-6 | #1956 | Surveyor empty-state | canonical `EmptyState` for the assignment list |

Planning artifacts that preceded execution (also docs-only): Professional Codebase
Audit (#1944), Role Cockpit Audit (#1949), End-to-End Sandbox Deal Flow Audit
(#1950).

## 2. What was actually fixed

- **Role-lock no longer busy-polls** the router (PR-1) — enforcement is now driven
  by navigation + store reactivity + history/focus events; behavior-preserving.
- **support / investor are explicitly classified** (PR-2): `support` = internal
  oversight-only contour, `investor` = non-core oversight-only aggregate; neither
  is a `PlatformRole`; participants are denied **by explicit policy** rather than by
  incidental `allowedPrefixes` fallthrough; no participant-visible route-switch.
- **One canonical bank cabinet** (PR-3): `/platform-v7/bank`; the legacy
  `/bank/clean` "clean room" is a thin redirect alias; the bank role home + nav were
  aligned to canonical (also resolving a contradictory test expectation).
- **Arbitrator cockpit decoupled from the legacy `v7r` route tree** (PR-4): the
  dispute-room component was relocated **byte-identically** into a canonical
  `components/platform-v7` component; the active page imports that.
- **Consistent loading UX** (PR-5) for the role cabinets without a dedicated
  `layout.tsx` (lab, surveyor, compliance, arbitrator, support).
- **Surveyor empty-state** (PR-6) for its static assignment list.

All of the above were **routing / import / additive UI-state** changes. None touched
money/MoneyEngine/SettlementEngine, Prisma schema, package/lockfiles, `next.config`,
`apps/landing`, or backend runtime.

## 3. What was deliberately NOT touched (and why)

- **Server-side cabinet enforcement** — out of every Phase 2 PR. The cabinet lock is
  still client-only; fixing it is a backend/RBAC change, not a cockpit tweak.
- **Duplicate route surface** (deals/lots/batches/rfq + ~25 grain pages) — a
  large-surface migration, not a small cleanup.
- **Generic cross-role empty-path** in the shared `RoleExecutionCockpitContent` —
  it renders for multiple roles; a point fix there changes several cabinets at once
  without an impact map.
- **Compliance empty-state** — Compliance has **no page-local list**; its data comes
  from the shared, always-populated cockpit components, so there was no narrow
  page-level gap to close (see §6).

The guiding rule for Phase 2: *touch the boundary, not the cabinet.* The items above
break that rule and are therefore gated.

## 4. Risk #1 — client-only role isolation (GATED)

**Finding (verified earlier):** middleware derives role from the URL, not from an
identity; the real lock is client JS (`PlatformV7SingleEntryGuard` +
`PlatformV7RoleLockFix` reading `sessionStorage`), and login is unauthenticated
(demo). Before hydration / with JS disabled / via direct SSR, a deep link renders the
target cabinet's shell.

**Why it cannot be a quick fix:**
- It requires a **server-side cabinet enforcement** layer (middleware/route handlers
  that check an authenticated identity, not a path prefix).
- That depends on **backend / API / session boundary**: a real identity provider,
  a session/token the server can verify, and per-cabinet authorization checks.
- It intersects the API's existing `RolesGuard` + object-scope model — the web shell
  and the API must agree on the role/identity source of truth.

**Do not** attempt this by editing cockpit components or the client guards — that
would only move the client-only lock around. It needs a design pass first (Phase 4).

## 5. Risk #4 — duplicate route / surface (GATED)

**Finding:** a large `/platform-v7/**` surface with duplicate/legacy clusters —
`deals/[id]` vs `…/clean` vs `demo/deals` vs `investor/deals`; `lots` vs legacy
`lot`; `batches/new|create|view`; `buyer/rfq/new|create|detail|[rfqId]`; and ~25
`*/grain/page.tsx` clones across top-level dirs.

**Why it cannot be a quick fix:**
- Routes are referenced from many cabinets, navs, command palettes, manifests, and
  tests; redirecting/removing any one can break links, nav items, and route-audit
  tests across roles (Phase 2 PR-3 already showed how entangled even a single route
  is — ~13 tests + ~20 link sites for one bank page).
- Collapsing duplicates is a **migration**, not a deletion: each cluster needs a
  chosen canonical, alias redirects, link updates, and test updates.

**Required first:** a complete **route inventory** (every `/platform-v7/**` page, who
links to it, which tests render it, canonical vs alias vs orphan) before any cleanup
PR. That is Phase 3.

## 6. Risk — generic cross-role empty-path (GATED)

`RoleExecutionCockpitContent` (driven by `PRIMARY_ROLE_EXECUTION_COCKPITS`) maps
`kpis`, `operations`, contract items and statuses, and is used by **seller, buyer,
operator, bank, compliance**. Adding a generic empty-state there is reasonable for
consistency but **cannot be done point-wise**: one change affects five cabinets at
once. It needs an **impact map** (which roles, which lists, what "empty" means per
list, what copy) and its own scoped PR — not a bundled tweak.

## 7. Proposed next phases (no code until approved)

- **Phase 3 — Route inventory (docs-only).** Enumerate every `/platform-v7/**`
  route; for each, record: canonical / alias / orphan, link sites, tests that render
  it, and a proposed disposition. Output: a route-map doc + a prioritized,
  **reversible** migration list. No code.
- **Phase 4 — Server-side role enforcement design (docs-only).** Specify the
  identity/session boundary, where enforcement lives (middleware vs route handlers),
  how it reconciles with the API `RolesGuard`/object-scope, the rollout behind a
  flag, and a test plan. No code; explicitly a design before any backend/RBAC change.
- **Phase 5 — Controlled cleanup PRs (only after the above are approved).** Small,
  single-cluster route migrations and the generic empty-path, each with its impact
  map, alias redirects, and updated tests — gated on owner approval per cluster.

## 8. Honesty gate

Do not claim from this document: "secure role isolation", "server-side RBAC done",
"routes deduplicated", "production-ready". Allowed framing: *Phase 2 closed as a
narrow, safe consistency pass; the high-risk items (server-side enforcement,
route-surface cleanup, shared cockpit empty-path) are identified, gated, and
sequenced behind docs-only design phases (3–4) before any code (Phase 5).*

This document changes no code. It is a closeout and a plan.
