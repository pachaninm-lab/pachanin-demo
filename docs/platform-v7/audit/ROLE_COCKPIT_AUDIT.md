# Role Cockpit Audit (platform-v7)

Status: **controlled-pilot / pre-integration · docs-only audit · NO code change**.
Read-only inspection of the 12 role cockpits, the shell / role-lock machinery, and
the `/platform-v7/**` route map (Phase 2). Findings were gathered with a
Frontend/UX agent and then **re-verified by hand** (file:line) — several agent
file paths were corrected during verification. No runtime/UI/cockpit code is
changed here.

Honest framing (do not overstate):
- This is an **audit**, not a fix. Nothing is changed.
- The most important finding (§2) is a real gap: **role isolation is
  client-only**. Do not claim the cabinets are securely isolated.

---

## 1. Shell / role-lock machinery (verified)

- **Single shell**: `AppShellV4` (`apps/web/components/v7r/AppShellV4.tsx`),
  rendered from `apps/web/app/platform-v7/layout.tsx:82`. It owns the header,
  the drawer/sidebar nav, and the bottom nav (`AppShellV4.tsx:454`, gated off
  only on `/platform-v7` and `/platform-v7/roles`, `items.slice(0,5)` from
  `platformV7NavByRole`). So every role with a resolved nav gets the same
  header + 5-item bottom nav.
- **Guards** (`layout.tsx:84-91`): `ScopedShellGuard`,
  `PlatformV7SingleEntryGuard`, `PlatformV7ShellUxController`,
  `RbacCabinetGuard`; plus `PlatformV7RoleLockFix` mounted from
  `app/platform-v7/template.tsx:13`.
- **Access policy**: `lib/platform-v7/cabinet-access-policy.ts` —
  `platformV7RbacEnforced()` returns `true`; `canRoleAccessCabinet(role, path)`
  allows shared paths, allows oversight roles, else delegates to
  `platformV7RoleCanOpenHref(role, path)` (the role's `allowedPrefixes`).
- **Oversight bypass**: `OVERSIGHT_ROLES = {'operator','executive'}`
  (`cabinet-access-policy.ts:14`) can open **every** cabinet.

## 2. CRITICAL: role isolation is CLIENT-ONLY (verified)

- **Middleware derives the role from the URL, not from an identity.**
  `resolvePlatformV7PathRole()` (`apps/web/middleware.ts:181-195`) maps the path
  prefix to a role, and `resolveRole()` (`:197-206`) uses that path-role first.
  So a server request to `/platform-v7/bank` is simply treated as role `bank`.
  Middleware does canon redirects, v7r→v7 rewrite, private-mode basic-auth and an
  "entry-seen" cookie gate — **no cross-role 403/redirect**.
- The real lock is **client JS**: `PlatformV7SingleEntryGuard` reads the locked
  role from `sessionStorage['pc-v7-active-role']` (set at `login/page.tsx`) and
  `router.replace`s to the role home on mismatch; `PlatformV7RoleLockFix`
  reinforces it on navigation events **and a `setInterval(…, 50)`**
  (`components/platform-v7/PlatformV7RoleLockFix.tsx:49`).
- **Login is unauthenticated** (demo): `login/page.tsx` lets a user pick any of
  the 12 roles with no credential check.
- **Implication:** before hydration / with JS disabled / via direct SSR, a deep
  link renders the target cabinet's shell. This matches the standing TЗ rule —
  *"Server-side enforcement должен быть в roadmap/реализации. Frontend role-lock
  недостаточен."* It must NOT be described as secure cabinet isolation.

## 3. Route map (`/platform-v7/**`) — 181 routes

The surface is large and carries duplicate/legacy clusters (all confirmed by the
file tree):

- **Deals**: `deals/[id]` vs `deals/[id]/clean` vs `demo/deals/[id]` vs
  `investor/deals/[dealId]` vs `buyer/deals` vs `seller/deals`; plus
  `deals/grain-quality|grain-release|grain-sdiz|grain-weight`.
- **Lots/lot**: `lots`, `lots/[lotId]`, `lots/create`, `lots/compare` vs the
  singular legacy `lot/[id]`, `lot/create`; plus `buyer-lot`, `fgis-to-lot`,
  `buyer/lots`, `seller/lots`.
- **Batches**: `batches/new` vs `batches/create` vs `batches/view` (clear 3-way
  dupe) vs `batches/[batchId]` vs `batches`; plus `seller/batches[/new]`.
- **RFQ**: `buyer/rfq/new` vs `create` vs `detail` vs `[rfqId]` vs `buyer/rfq`;
  plus `seller/rfq`, `market-rfq`.
- **`*/grain` sprawl**: ~25 `*/grain/page.tsx` cloned across nearly every
  top-level dir (`anti-bypass`, `readiness`, `settlement`, `data-room`,
  `security`, `documents`, `integrations`, …) — strong orphan/legacy candidates.
- **Demo / misc**: `demo/*`, `simulator`, `deploy-check`, `runtime-status`,
  `domain-core`, `role-preview` — pilot/dev surfaces mixed with product routes.

**Shell gaps:** the only no-shell paths are the explicit public allowlist in
`layout.tsx:52` (`/platform-v7`, `/open`, `/login`, `/register`, `/docs`).
Everything else renders inside `AppShellV4` — no accidental full-bleed escape
found.

**Role-switch dangers:** (a) middleware infers role from URL (so SSR "becomes"
the target role — §2); (b) oversight roles can deep-link into every cabinet;
(c) `RoleHeaderSwitcher.tsx` exists but is **unmounted** (dead) — not an active
switch path; (d) `support` and `investor` — **resolved in PR-2** (see §5 #5):
both are now classified explicitly as oversight-only (support = internal contour,
investor = non-core aggregate) and participants are denied by policy, not by
incidental `allowedPrefixes` fallthrough.

## 4. Per-role cockpit table (12 roles)

Route under `/platform-v7/<role>`. "Layout" = dedicated `layout.tsx` (all roles
still receive the root `AppShellV4` shell regardless).

| Role | route | layout | header/bottomnav | role-lock | first screen + CTA | money/docs/logistics/quality/dispute/evidence | empty/loading/error | broken btns | fake-live | mobile risk |
|---|---|---|---|---|---|---|---|---|---|---|
| Seller | ✅ | ✅ | ✅/✅ | client-locked to `seller` | CockpitHero + CTAs | money, СДИЗ/ЭТрН docs, deals, blockers, quality | server fetch + apiOnline; no `loading.tsx` | none | none | low (flex cards 220–280) |
| Buyer | ✅ | ✅ | ✅/✅ | locked `buyer`+`procurement` | CockpitHero + CTAs | money, docs, quality, blockers | server + apiOnline | none | none | low |
| Logistics | ✅ | ✅ | ✅/✅ | locked `logistics` | CockpitHero | rfq/routes/drivers/docs/deviations | server `getShipments` | none | none | low |
| Driver | ✅ (→`/driver/field`) | ✅ | ✅/✅ | locked `driver` | redirect to field cockpit | route/photo/status/support | field subtree — cannot fully determine statically | none | none | field shell mobile-tuned |
| Elevator | ✅ | ✅ | ✅/✅ | locked `elevator` | CockpitHero | queue/weight/acts/discrepancy | partial | none | none | low |
| Lab | ✅ | ❌ | ✅/✅ | locked `lab` | CockpitHero + hint | quality/protocol/delta/dispute; LiveApiStatusBar | **honest** static-data note when API down | none | none | responsive grid |
| Surveyor | ✅ | ❌ | ✅/✅ | locked `surveyor` | CockpitHero + BatonStrip | evidence/act; links to disputes | **static array, no empty/error** | none | none | responsive |
| Bank | ✅ (home `/bank/clean`) | ✅ | ✅/✅ | locked (clean/escrow/factoring/events/payment-basis) | CockpitHero + KPIs | money/holds/risks/docs/events | server-backed | none | none | low |
| Compliance | ✅ | ❌ | ✅/✅ | locked `compliance` | CockpitHero + anchor CTAs (`#admission`) | risks/blockers/docs/review | static | anchor CTAs (not broken) | none | low |
| Arbitrator | ✅ | ❌ | ✅/✅ | locked `arbitrator` (+`/disputes`) | CockpitHero + decision | evidence/positions/decision/money | server `getDisputes` + apiOnline | none | none | low |
| Support | ✅ (thin index) | ❌ | ✅/✅ | **NOT a participant role; unreachable by normal roles** (oversight only) | SupportIndexPage | cannot determine statically | cannot determine statically | none | none | cannot determine |
| Executive | ✅ | ✅ | ✅/✅ | **OVERSIGHT — opens all cabinets** | CockpitHero + signal wall | money/blockers/risks/reports (real runtime) | uses `EmptyState`, honest apiOnline | none | none | low |

Notable: **5 roles lack a dedicated layout** (Lab, Surveyor, Compliance,
Arbitrator, Support) — they still get the root shell, so the gap is consistency,
not a missing shell.

## 5. Risks

1. **Client-only role isolation** (§2) — the highest-priority gap; a "locked
   cabinet" is not enforced server-side.
2. ~~`PlatformV7RoleLockFix.tsx:49` runs a **50ms `setInterval`**~~ — **resolved in
   PR-1 (#1951)**: the polling timer was removed; the lock is now event-/state-driven
   (navigation + role reactivity + popstate/hashchange/focus), behavior-preserving.
3. ~~**Embedded legacy**: `arbitrator/page.tsx` imports
   `@/app/platform-v7r/arbitrator/page`~~ — **resolved in PR-4** (routing/import only,
   no cockpit rewrite): the dispute-room cockpit was relocated **verbatim** (byte-identical
   UI/logic) into a canonical component `@/components/platform-v7/ArbitratorDisputeRoom`,
   and the active page now imports that instead of a page default-export from the legacy
   `v7r` route tree. Covered by `platformV7ArbitratorCanonicalImport.test.ts`. Residual:
   the dead `app/platform-v7r/arbitrator` route still holds its own copy (untouched,
   read-only); removing the legacy `v7r` tree is a later gated cleanup.
4. **Large duplicate surface** (deals/lots/batches/rfq + ~25 grain pages) —
   orphan/confusion risk, inconsistent cockpits.
5. **`support`/`investor`** — **resolved in PR-2** as a routing/access decision
   (routing only, no cabinet rewrite):
   - **`support`** is an **internal support contour**, not a participant cabinet.
     Only oversight roles (operator/executive) open `/platform-v7/support*`;
     participants file/track cases via action-level `support.create_case`
     (`action-permission-boundary.ts`), not by entering the cabinet. `support` is
     **not** a `PlatformRole`.
   - **`investor`** is a **non-core, read-only aggregate route** — explicitly **not**
     a platform-v7 execution role and **not** a `PlatformRole`. The route stays
     registered for oversight aggregate view but is classified non-core and closed
     to participants. It is never added as a full deal role.
   - Enforcement: `cabinet-access-policy.ts` now denies both to non-oversight roles
     **explicitly** (`isPlatformV7InternalRoute` / `isPlatformV7NonCoreRoute`) rather
     than relying on incidental `allowedPrefixes` fallthrough; covered by
     `platformV7SupportInvestorRoutePolicy.test.ts`.
   - No participant-visible route-switch: confirmed no live nav/header links a
     participant into support/investor (`RoleHeaderSwitcher`, `AppShellV2/V3`,
     `MobileHeaderUtilities` are all **unmounted/dead**; the investor CTA in
     `RoleExecutionSummary` renders only inside the investor's own oversight view).
   - **Still gated** (not this PR): server-side enforcement of cabinet boundaries
     (the §1/§2 client-only gap), and removing the dead `support`/`investor` link
     sites is a later web cleanup.
6. **Dual bank entry** — **resolved in PR-3** as a routing decision (routing only,
   no bank cockpit rewrite, no money/business-logic change):
   - **Canonical bank cabinet = `/platform-v7/bank`** ("Кабинет банка") — the page
     linked from ~20 cross-app CTAs and rendered by ~13 component tests.
   - **`/platform-v7/bank/clean`** is reclassified as a **legacy "clean room"
     alias** and is now a thin server `redirect()` → `/platform-v7/bank`, not a
     second bank cockpit version.
   - The bank **role home** (`PLATFORM_V7_ROLE_ROUTES.bank`) and bank bottom-nav now
     point at the canonical `/bank` (in both `shellRoutes.ts` and the legacy
     `navigation.ts`); `allowedPrefixes` keeps `/bank/clean` so the alias stays
     reachable (it redirects). Covered by `platformV7BankCanonicalRoute.test.ts`.
   - Residual (harmless): a legacy command-palette entry in the unused `command.ts`
     still references `/bank/clean`; it resolves to canonical via the redirect.
     Physically collapsing the two page files is a later web cleanup.
7. **Loading/error consistency** — **partially resolved in PR-5** (additive, no
   cabinet rewrite): the five role segments without a dedicated `layout.tsx` (lab,
   surveyor, compliance, arbitrator, support) now each have a route-level
   `loading.tsx` rendering a shared neutral cockpit skeleton
   (`components/platform-v7/RoleCockpitLoading.tsx`, built on the canonical
   `Skeleton`). Error handling was already uniform via the root
   `app/platform-v7/error.tsx`, so no per-role `error.tsx` was added (would be
   redundant divergence). Covered by `platformV7RoleCockpitLoading.test.ts`.
   **Empty-state — resolved in PR-6 for the one real page-local gap**: the Surveyor
   cabinet's static assignment list now renders the canonical `EmptyState` when
   there are no assignments (content-local, additive, no redesign; covered by
   `platformV7SurveyorEmptyState.test.ts`). **Compliance** has **no page-local list**
   — its lists are rendered by shared, always-populated cockpit components
   (`RoleExecutionCockpitContent`, `ComplianceRuntime`), so there is no narrow
   page-level empty gap; a generic empty path for the shared cockpit would affect all
   five cockpit roles and is a separate, broader consistency item (not bundled here).

No fake-live copy and no obviously broken buttons (`#`/no-op) were found in the
inspected role pages — the C2 guard covers backend; a web-scoped copy guard is a
later item.

## 6. Recommended PR order (Phase 2 execution)

Each a separate, small PR under the Frontend/UX gate (server-side RBAC and the
duplicate-route cleanup are larger, gated efforts):

1. **Role Shell Consistency** — normalize header/bottom-nav/states across all 12
   cockpits; remove the 50ms `setInterval` (rely on navigation events); decide
   `support`/`investor` (gate out of the shell or add to allowed prefixes);
   inline the arbitrator cockpit off the legacy `v7r` import.
2. **Seller + Buyer** — first-screen/CTA/blockers/states polish.
3. **Logistics + Driver**.
4. **Elevator + Lab + Surveyor** — add empty/loading/error states.
5. **Bank + Compliance** — resolve dual bank entry; compliance states.
6. **Arbitrator + Support**.
7. **Executive**.
8. **Mobile / Desktop regression** (390×844).
9. **Role route / static guard tests** — and, separately and gated,
   **server-side cabinet enforcement** (the §2 fix) + duplicate-route triage.

## 7. Honesty gate

Do not claim: "secure role isolation", "cabinets are locked", "server-side RBAC",
"no cross-role access", "production-grade cockpits". Allowed framing:
*controlled-pilot; consistent client shell across roles; role-lock is client-only
and unauthenticated (demo); server-side cabinet enforcement and duplicate-route
cleanup are planned, not done.*

This document changes no code. It is an audit and a Phase-2 plan.
