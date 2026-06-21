# Professional Codebase Audit (platform-v7)

Status: **controlled-pilot / pre-integration · docs-only audit · NO runtime
change**. This audit records, from verified repository facts, where the codebase
still carries prototype/"vibe-coded" residue, and lays out a prioritized,
**scoped** cleanup plan so the codebase reads as the work of a strong
professional team. It changes no code; it is the planning artifact for Phase 1.

Honest framing (do not overstate):
- This is an **audit**, not a cleanup. Nothing here is fixed yet.
- Findings below were each verified against the code (file:line), not assumed.

Method: a read-only Code Hygiene scan over `apps/api/src` and `apps/web`
(excluding `.next`, `node_modules`, `dist`, and `docs/platform-v7/audit/**`),
then each high-value finding re-verified by hand.

---

## 1. Overall verdict

The **backend core is in good shape**: no AI/generation traces in code, no
fake-maturity copy in shipping code (only guardrails and test assertions that
*ban* such phrases), and `runtime-core.service.ts` has been decomposed into
stateless engines. The residue is concentrated in **`apps/web`** and in a few
**repo-root scratch artifacts** — leftover redeploy/scratch files, an unrouted
legacy UI tree, duplicate config and money/format helpers, and unguarded browser
logging. None of it is dangerous; all of it makes the project look less mature
than the backend actually is.

**Scope note:** most UI findings live under autopilot **forbidden zones**
(`apps/web/components/platform-v7`, `apps/web/components/v7r`,
`apps/web/lib/platform-v7`, `apps/web/app/platform-v7`). Cleanups there require an
explicit owner-approved scope advance and the Frontend/UX gate; they are **not**
done in this docs PR.

---

## 2. Verified findings

### 2.1 Repo-root + web scratch / marker files (junk) — ✅ C1 DONE
Removed 11 confirmed-unused scratch/marker files (each verified unreferenced by
scripts/tests/build/config before deletion): `ok.txt`, `zzz.txt`, `tmp_test.txt`,
`tmp-test.txt`, `notes_ui_test.txt`, `tmp-control-fix-marker.txt`, `redeploy.txt`,
`trigger-20260411-1925.txt`, `TRIGGER_PRODUCTION_REDEPLOY.txt`,
`ui_preview_routes.txt`, and `apps/web/tmp_route_switch_test.txt`.

**Left in place (out of C1 scope — noted, not deleted here):**
- `apps/web/public/deploy-trigger*.txt` + `apps/web/public/p1-batch-note.txt` —
  under `public/` (served static assets); deletion belongs to a separate,
  scoped step.
- `apps/web/app/api/commercial/expansion.txt` — under the autopilot **forbidden**
  zone `apps/web/app/api`; not touched.
- `.github/test.txt`, `docs/ops/deploy-trigger-2026-04-18.txt` — outside the C1
  allowed scope (root + the one apps/web scratch file).

### 2.2 Two conflicting Next configs — confirmed
`apps/web/next.config.js` **and** `apps/web/next.config.mjs` both exist. Only one
is used by the build; the other is dead and misleading. `next.config.mjs` sets
`ignoreBuildErrors` / `ignoreDuringBuilds`, which — if it is the active one —
hides type/lint failures. **Risk: medium** (a maintainer can edit the dead one
and see no effect; or build errors are silently ignored).

### 2.3 Unrouted legacy `v9` UI tree — confirmed
`apps/web/components/v9/**` (Sidebar, RoleSwitcher, PhaseTimeline,
DealReadinessMatrix, BatchPassport, …) and `apps/web/lib/v9/**` are **not
imported by any route** under `apps/web/app` (`rg -l "components/v9" apps/web/app`
returns nothing). They are referenced only by other `v9` files and unit tests — a
parallel, dead UI tree alongside the active `platform-v7`/`v7r` surface. Inflates
the code + test surface and confuses which UI is canonical.

### 2.4 Duplicate money / status formatters — confirmed
- `formatMoney` defined twice with **different signatures**:
  `apps/web/lib/v7r/helpers.ts:1` (`formatMoney(value: number)`) vs
  `apps/web/lib/platform-v7/grain-execution/format.ts:7`
  (`formatMoney(amount: MoneyAmount, …)`); plus a third variant
  `formatMoneyGateAmount` in `components/v7r/MoneyGateRing.tsx`.
- `statusLabel` (`lib/v7r/helpers.ts`) vs `readableStatus`
  (`grain-execution/format.ts`).
→ **Risk: medium** — divergent rounding / ₽ placement between surfaces; money
formatting should have one source of truth.

### 2.5 Unguarded browser logging — confirmed
`apps/web/lib/observability.ts:3,12,14,20,22` ships five raw `console.log`
(`[pc:web]`/`[pc:audit]`/`[pc:ops]`) with no level/env gating — audit/ops events
print to every user's browser console. (Backend boot banner
`apps/api/src/main.ts:32` is low concern.) Ties to SR-3 (structured logging).

### 2.6 Oversized files (split candidates) — confirmed
Largest non-test sources: `lib/platform-v7/deal-execution-source-of-truth.ts`
(1275), `components/v7r/AppShellV3.tsx` (1037),
`modules/runtime-core/runtime-core.service.ts` (991 — backend, already partly
decomposed), `lib/platform-v7/runtime/application-service.ts` (802), and ~10 more
above ~520 lines. The top two are the clearest split candidates.

### 2.7 AI-style verbose / inconsistent naming — confirmed
Very long identifiers concentrated in `components/platform-v7` /
`components/v7r`, e.g. `PlatformV7BankPaymentBasisRuntimeResult`,
`createPlatformV7ExecutionMachineBridgeSnapshot`,
`buildDisputeEvidenceOperationalProjection`,
`platformV7ShellNotificationCenterModel`. Four parallel namespace prefixes
coexist for related domains: **`v7r`, `platform-v7`, `P7`, `v9`** — no single
naming convention.

### 2.8 TODO hygiene — minor
`apps/web/lib/v9/statuses.ts:3` TODO has an owner but no anchored date;
adapter-template TODOs (`real-adapter-template.ts:79`, `real-adapter-shell.ts:8`)
are acceptable (tagged `(integration)`, in intentionally-unwired templates).

### 2.9 Clean categories (no findings)
- **No AI/generation traces** in code ("generated by", "AI-generated", "vibe",
  "magic", "quick hack") — the only "vibe" hit is a regex matching "viber".
- **No fake-maturity copy** in shipping code — every hit is a guardrail
  definition or a `.not.toContainText` test assertion enforcing the ban.

---

## 3. Prioritized cleanup plan (each a separate, scoped PR)

Ordered by risk/scope. In-scope-safe first; forbidden-zone items need an explicit
scope advance + the Frontend/UX gate.

| # | Cleanup | Scope | Risk | Gate |
|---|---|---|---|---|
| C1 | Delete repo-root + `apps/web` scratch/marker `.txt` files (§2.1) | repo-root + apps/web | low | scope advance (root files) |
| C2 | Add a static guard test: forbid fake-live copy + AI/generation traces in `apps/api/src` and new docs | apps/api / scripts / docs | low | in-scope |
| C3 | Resolve the two Next configs — keep the build's canonical one, delete the dead one (§2.2) | apps/web | medium | needs-care + scope |
| C4 | Consolidate `formatMoney`/`statusLabel` into one shared util, re-export, remove dups (§2.4) | apps/web | medium | needs-care + scope |
| C5 | Gate `observability.ts` console output behind a debug/env flag (§2.5) | apps/web | low | scope |
| C6 | Remove the unrouted `v9` tree + its tests, or document why retained (§2.3) | apps/web | medium | needs-care + scope |
| C7 | Split the two largest UI files (§2.6) — only if behavior-preserving + tested | apps/web | medium-high | needs-care + scope |
| C8 | Naming convergence pass (pick one prefix; alias the rest) (§2.7) | apps/web | high (broad) | needs-care + scope |

**Backend-safe subset that can proceed now (in current autopilot scope):** C2
(static guard for forbidden copy / AI traces, targeting `apps/api/src` + docs).
All `apps/web` items (C1 root files included) require a scope advance because
`apps/web` is outside the current `allowedCurrentScope` and several paths are
autopilot forbidden zones.

---

## 4. Static guards to add (anti-regression)

To keep the codebase from sliding back:
- **Forbidden-copy guard** (C2): a test/script that fails if shipping code or new
  docs contain the §2.9 forbidden phrases (excluding guardrail definitions and
  `docs/platform-v7/audit/**` which legitimately quote them).
- **AI/generation-trace guard**: fail on "generated by AI", "AI-generated",
  "vibe-coded", etc. in `apps/api/src` and non-audit docs (do not touch historical
  PR text or git trailers).
- **No-console guard** (later, web-scoped): forbid raw `console.log` in
  `apps/web/lib`/`components` outside a debug shim.

---

## 5. What must NOT be claimed

This audit does not assert the codebase is "clean", "production-grade", or
"professionally complete" — it is a controlled-pilot codebase with verified
residue and a plan to remove it. Allowed framing: *backend core matured; UI tree
carries legacy/duplicate residue; cleanup planned and scoped, not done.*

This document changes no code. It is an audit and a cleanup contract.
