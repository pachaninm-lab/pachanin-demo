# Phase 3 — Route Inventory (`/platform-v7/**`)

Status: **controlled-pilot / pre-integration · docs-only · NO code change.**
This is the route map that must exist **before** any duplicate-route cleanup
(Risk #4). It enumerates the `/platform-v7/**` surface, marks canonical / alias /
orphan-candidate / keep, and produces a prioritized, **reversible** migration list
for a future Phase 5 — gated, one cluster per PR. It changes no code, no routes, no
`layout.tsx`, no role-lock/RBAC/backend, and `apps/landing` is untouched.

Honest framing (do not overstate):
- This is an **inventory**, not a cleanup. Nothing is migrated here.
- Dispositions are **proposals with evidence**, not decisions. Each one needs the
  per-route verification in §7 before any Phase 5 PR.

---

## 1. Method & its limits

- Routes enumerated from `app/platform-v7/**/page.tsx` (181 pages).
- Alias/redirect pages detected as `redirect(...)` pages under ~15 lines.
- "refs" = literal link-site count via `grep` over `apps/web/{app,components,lib}`
  (excluding `.next` and tests). **This is a hint, not the truth.** Literal grep
  **misses**: dynamic links (`/deals/${id}/clean`), middleware rewrites/redirects,
  command-palette/manifest entries built from constants, and test render imports.
  Example: `deals/[id]/clean` shows 0 literal refs yet is the canonical detail page
  reached via the `deals/[id]` redirect. So a low/zero ref count is a **candidate
  signal**, never a delete warrant.
- Per PR-3 evidence, even one route can have ~20 link sites + ~13 test importers —
  so §7's full verification is mandatory before touching anything.

## 2. Surface summary

- **181** `page.tsx` routes total.
- **10** existing alias/redirect pages (the established canonicalization pattern).
- **20** `*/grain/page.tsx` clones (74-line templates, per-dir placeholder data).
- **1** catch-all: `/platform-v7/[...slug]`.

## 3. Existing alias/redirect pages (canonicalization already in use)

These already follow the "thin `redirect()` page → canonical" pattern and are the
template for all Phase 5 migrations:

| Alias route | → target |
|---|---|
| `/field` | `driver/field` |
| `/driver` | `driver/field` |
| `/marketplace` | `lots` |
| `/market` | `lots` |
| `/integrations` | `connectors` |
| `/analytics` | `executive` |
| `/domain-core` | execution-map |
| `/bank/clean` | `bank` (PR-3) |
| `/deals/[id]` | `deals/[id]/clean` |
| `/dispute/[id]` | `disputes/[id]` |

## 4. Duplicate clusters — proposed dispositions (evidence-based)

Disposition keys: **CANONICAL** (keep as the one true route) · **ALIAS→x**
(reversible redirect to canonical) · **ORPHAN?** (low/zero literal refs — verify,
likely alias) · **KEEP** (role-scoped or distinct surface) · **VERIFY** (needs §7).

### 4.1 Lots / lot
| Route | refs | Disposition |
|---|---|---|
| `lots`, `lots/[lotId]`, `lots/create`, `lots/compare` | 63 (head) | **CANONICAL** |
| `lot/[id]`, `lot/create` (singular legacy) | 0 | **ORPHAN?** → ALIAS→`lots` |
| `buyer/lots`, `seller/lots`, `seller/lots/new` | — | **KEEP** (role-scoped) |
| `buyer-lot`, `fgis-to-lot` | 3 / — | **VERIFY** (distinct entry flows) |

### 4.2 Batches
| Route | refs | Disposition |
|---|---|---|
| `batches`, `batches/[batchId]` | — | **CANONICAL** |
| `batches/view` | 2 | **VERIFY** (pick one of new/create/view) |
| `batches/new` | 1 | **VERIFY** |
| `batches/create` | 0 | **ORPHAN?** → ALIAS→ chosen canonical |
| `seller/batches`, `seller/batches/new` | — | **KEEP** (role-scoped) |

### 4.3 RFQ
| Route | refs | Disposition |
|---|---|---|
| `buyer/rfq`, `buyer/rfq/[rfqId]`, `buyer/rfq/new` | — | **CANONICAL** (buyer RFQ) |
| `buyer/rfq/detail` | 1 | **ORPHAN?** → ALIAS→`buyer/rfq/[rfqId]` |
| `buyer/rfq/create` | 1 | **ORPHAN?** → ALIAS→`buyer/rfq/new` |
| `market-rfq`, `seller/rfq` | — | **KEEP** (distinct surfaces) |

### 4.4 Deals
| Route | Disposition |
|---|---|
| `deals`, `deals/[id]/clean` (+ `[id]/{audit,money,quality,documents,logistics,disputes,review,evidence-pack,transport-documents}`) | **CANONICAL** (detail = `/clean` via the `deals/[id]` redirect) |
| `deals/compare` | **KEEP** |
| `deals/grain-quality|grain-release|grain-sdiz|grain-weight` | **VERIFY** (grain template family — see §4.5) |
| `demo/deals/[id]` | **KEEP-as-DEMO** (gate out of product nav, §5) |
| `investor/deals/[dealId]` | **KEEP** (non-core investor aggregate, oversight-only per PR-2) |
| `buyer/deals`, `seller/deals` | **KEEP** (role-scoped) |

### 4.5 `*/grain` template family (20 pages)
All 20 are 74-line structurally-identical templates with per-dir placeholder data
(`anti-bypass`, `bank`, `lab`, `security`, `data-room`, `documents`, `integrations`,
`readiness`, `settlement`, `arbitrator`, `compliance`, `control-tower`, `driver`,
`elevator`, `executive`, `logistics`, `operator`, `reports`, `support`, `surveyor`).
They **are linked** (grain links exist in-app), so they are **not pure orphans**.
Disposition: **VERIFY as one family** — this needs its **own impact map** (which are
linked, from where, what each is meant to be) before any consolidation. Do **not**
touch piecemeal. Treat as a dedicated Phase 5 sub-effort.

## 5. Dev / pilot / secondary surfaces (classify, don't break)

| Route | refs | Note |
|---|---|---|
| `runtime-status`, `health` | 0 / 0 | **ORPHAN?** — dev/status pages; verify before gating |
| `deploy-check`, `simulator` | 3 / 3 | dev/pilot — **gate out of product nav** candidate |
| `role-preview`, `auctions`, `audit-log` | 1 each | low-use — **VERIFY** |
| `trading` | 4 | **VERIFY** (product vs experiment) |
| `operator-cockpit`, `offer-log`, `deal-drafts` | 7 / 7 / 11 | in active use — **KEEP** |
| `[...slug]` catch-all | — | **KEEP** (fallback; confirm it routes/410s sanely) |

These are not duplicates; the goal is to **classify** product vs dev/pilot so the
product nav and route-audit are honest — not to delete.

## 6. Risks & rules for any future route change (Phase 5)

1. **Alias, don't delete.** Replace a retired route's page with a thin `redirect()`
   to canonical (the §3 pattern). Reversible; no broken deep links.
2. **One cluster per PR**, gated on owner approval — never a broad sweep.
3. **Update every link site and test** in the same PR (PR-3 showed ~20 links + ~13
   tests for a single page). A migration that leaves stale links/tests is a regression.
4. **Role-scoped and oversight routes stay** (buyer/seller/investor/demo variants are
   intentional, not duplicates).
5. **No `layout.tsx`, role-lock, RBAC, or backend change** rides along with a route
   migration — those are separate, gated efforts (Risk #1 / Phase 4).

## 7. Required per-route verification before a Phase 5 PR

For each route proposed for ALIAS/removal, record (and attach to the PR):
- **Link sites**: literal + dynamic/template-literal + manifest/command/nav constants.
- **Middleware**: any rewrite/redirect/role-mapping that references the path.
- **Tests**: every unit/e2e that imports the page module or navigates to the path.
- **Chosen canonical** + the alias target, and the rollback (restore the page file).

## 8. Prioritized, reversible migration backlog (proposals only — no code now)

Ordered lowest-risk first. Each is a **separate, gated** Phase 5 PR after §7:
1. `lot/[id]`, `lot/create` → ALIAS→`lots` (0 literal refs; verify dynamic/tests).
2. `batches/create` → ALIAS→ chosen `batches` canonical (0 refs); then reconcile
   `batches/new` vs `view`.
3. `buyer/rfq/detail` → ALIAS→`buyer/rfq/[rfqId]`; `buyer/rfq/create` → ALIAS→`buyer/rfq/new`.
4. `runtime-status` / `health` — verify, then gate or alias.
5. `deploy-check` / `simulator` / `role-preview` / `trading` — classify product vs
   dev; gate out of product nav as needed (no deletion).
6. **`*/grain` family** — dedicated impact map first, then consolidate (largest, last).

## 9. Honesty gate

Do not claim from this document: "routes deduplicated", "surface cleaned",
"orphans removed". Allowed framing: *Phase 3 produced a route inventory with
evidence-based, reversible disposition proposals; nothing is migrated; each Phase 5
cleanup is gated, one cluster per PR, alias-not-delete, with full link+test
verification first.*

This document changes no code. It is an inventory and a gated plan.
