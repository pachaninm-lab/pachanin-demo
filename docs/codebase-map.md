# platform-v7 codebase map

Generated: 2026-04-24
Repo: `pachaninm-lab/pachanin-demo`
App contour: `apps/web`
Primary deployed Vercel project observed: `pachanin-canonical-web`
Public domain observed: `pachanin-web.vercel.app`

## Execution note

This file starts E0 Discovery. It is intentionally documentation-only and does not change runtime behavior.

The connected repository contains `platform-v7`, but the user-provided spec names `pachanin-web`. The accessible GitHub repository with the matching app is `pachaninm-lab/pachanin-demo`.

## Actual stack observed

Root package:
- package manager: `pnpm@10.2.1`
- root build: `pnpm --filter @pc/web build`
- root typecheck: `pnpm -r typecheck`

Web package:
- Next.js: `^14.2.16`
- React: `18.3.1`
- TypeScript: `^5.6.3`
- Zustand: `^5.0.12`
- TanStack Query: `^5.99.0`
- Sonner: `^2.0.7`
- Recharts: `^3.8.1`
- Playwright: `^1.59.1`
- axe-core / @axe-core/playwright present

Conflict with task spec:
- Spec assumes Next.js 15 / React 19.
- Repo currently uses Next.js 14 / React 18.
- Do not migrate framework versions inside early polish epics. First stabilize runtime and data layer.

## Known platform-v7 routes discovered

| Route | File | Data source / notes | Epic relevance |
|---|---|---|---|
| `/platform-v7` | `apps/web/app/platform-v7/page.tsx` | entry route; hardening note says direct redirect must become role-first entry | E2 / E4 |
| `/platform-v7/control-tower` | `apps/web/app/platform-v7/control-tower/page.tsx` | likely reads v7r/runtime data; has known `/platform-v9` link risk | E1 / E2 / E3 |
| `/platform-v7/deals` | `apps/web/app/platform-v7/deals/page.tsx` | deals overview | E1 / E5 |
| `/platform-v7/deals/loading` | `apps/web/app/platform-v7/deals/loading.tsx` | loading state exists | E12 |
| `/platform-v7/deals/[dealId]` | likely under `apps/web/app/platform-v7/deals/[dealId]/page.tsx` or catch-all mapping | detail route; hardening says macro phase, money table, status actions needed | E5 |
| `/platform-v7/disputes/[id]` | `apps/web/app/platform-v7/disputes/[id]/page.tsx` | dispute detail | E7 |
| `/platform-v7/dispute/[id]` | `apps/web/app/platform-v7/dispute/[id]/page.tsx` | singular duplicate route; must be checked for canonicalization | E2 / E7 |
| `/platform-v7/disputes` | `apps/web/app/platform-v7/disputes/page.tsx` | dispute list; KPI/evidence fields needed | E1 / E7 |
| `/platform-v7/bank` | `apps/web/app/platform-v7/bank/page.tsx` | bank runtime / ledger sources | E6 |
| `/platform-v7/bank/factoring` | `apps/web/app/platform-v7/bank/factoring/page.tsx` | factoring route present | E6 |
| `/platform-v7/bank/escrow` | `apps/web/app/platform-v7/bank/escrow/page.tsx` | escrow route present | E6 |
| `/platform-v7/bank/events/[id]` | `apps/web/app/platform-v7/bank/events/[id]/page.tsx` | bank event detail | E6 |
| `/platform-v7/seller` | `apps/web/app/platform-v7/seller/page.tsx` | seller cabinet; copy/upload behavior noted in hardening | E2 / E3 / E11 |
| `/platform-v7/buyer` | `apps/web/app/platform-v7/buyer/page.tsx` | buyer cabinet; sorting/filtering needed | E2 / E11 |
| `/platform-v7/driver` | `apps/web/app/platform-v7/driver/page.tsx` | driver route present | E8 |
| `/platform-v7/field` | `apps/web/app/platform-v7/field/page.tsx` | field role surface; role preview/offline queue needed | E8 / E10 |
| `/platform-v7/elevator` | `apps/web/app/platform-v7/elevator/page.tsx` | elevator workbench | E10 |
| `/platform-v7/lab` | `apps/web/app/platform-v7/lab/page.tsx` | lab workbench | E10 |
| `/platform-v7/lots` | `apps/web/app/platform-v7/lots/page.tsx` | lots list | E1 / E11 |
| `/platform-v7/procurement` | `apps/web/app/platform-v7/procurement/page.tsx` | procurement route | E11 |
| `/platform-v7/marketplace` | `apps/web/app/platform-v7/marketplace/page.tsx` | marketplace-like naming must be checked against execution positioning | E11 |
| `/platform-v7/logistics` | `apps/web/app/platform-v7/logistics/page.tsx` | logistics route | E8 / E9 / E10 |
| `/platform-v7/logistics/[routeId]` | `apps/web/app/platform-v7/logistics/[routeId]/page.tsx` | route detail | E8 / E9 |
| `/platform-v7/documents` | `apps/web/app/platform-v7/documents/page.tsx` | documents route | E5 / E9 / E12 |
| `/platform-v7/connectors` | `apps/web/app/platform-v7/connectors/page.tsx` | integrations/connectors | E9 / E14 |
| `/platform-v7/integrations` | `apps/web/app/platform-v7/integrations/page.tsx` | possible duplicate with connectors | E2 / E9 |
| `/platform-v7/compliance` | `apps/web/app/platform-v7/compliance/page.tsx` | compliance route; CSV export and filters noted | E12 / E14 |
| `/platform-v7/ai` | `apps/web/app/platform-v7/ai/page.tsx` | AI route | E13 |
| `/platform-v7/demo` | `apps/web/app/platform-v7/demo/page.tsx` | investor/demo E2E exists | E4 |
| `/platform-v7/notifications` | `apps/web/app/platform-v7/notifications/page.tsx` | notifications | E3 / E14 |
| `/platform-v7/profile` | `apps/web/app/platform-v7/profile/page.tsx` | profile | E2 / E12 |
| `/platform-v7/operator` | `apps/web/app/platform-v7/operator/page.tsx` | operator role surface | E2 / E3 |
| `/platform-v7/operator-cockpit/queues` | `apps/web/app/platform-v7/operator-cockpit/queues/page.tsx` | queue route | E3 / E14 |
| `/platform-v7/companies/[inn]` | `apps/web/app/platform-v7/companies/[inn]/page.tsx` | company detail | E1 / E12 |
| `/platform-v7/register` | `apps/web/app/platform-v7/register/page.tsx` | registration | E12 |
| `/platform-v7/auth` | `apps/web/app/platform-v7/auth/page.tsx` | auth route | E12 / E14 |
| `/platform-v7/deploy-check` | `apps/web/app/platform-v7/deploy-check/page.tsx` | deploy check route | E0 / E14 |
| `/platform-v7/surveyor/acts/[id]` | `apps/web/app/platform-v7/surveyor/acts/[id]/page.tsx` | surveyor act route | E7 / E10 |
| `/platform-v7/[...slug]` | `apps/web/app/platform-v7/[...slug]/page.tsx` | catch-all; must be audited to avoid masking 404 and broken links | E0 / E15 |

## Layout and shared components observed

| Area | File | Note |
|---|---|---|
| v9 AppShell | `apps/web/components/v9/layout/AppShell.tsx` | hardening note requires skip-link and shortcuts overlay |
| v9 Header | `apps/web/components/v9/layout/Header.tsx` | hardening note requires mobile search and sandbox exit |
| v9 Sidebar | `apps/web/components/v9/layout/Sidebar.tsx` | hardening note requires version cleanup and mobile close behavior |
| v9 Command Palette | `apps/web/components/v9/layout/CommandPalette.tsx` | command/search layer |
| v9 AI drawer | `apps/web/components/v9/ai/AiDrawer.tsx` | AI assistant surface |
| v7r AppShell variants | `apps/web/components/v7r/AppShell.tsx`, `AppShellV2.tsx`, `AppShellV3.tsx` | possible competing shells; must be consolidated after discovery |
| v7r Command Palette | `apps/web/components/v7r/CommandPalette.tsx` | possible duplicate command palette |
| v7r CatchAllPage | `apps/web/components/v7r/CatchAllPage.tsx` | catch-all rendering must not hide route failures |

## Immediate route risks

1. `platform-v7` and `platform-v7r` coexist. This is a drift risk.
2. Hardening note confirms false `/platform-v9/` links inside platform-v7 pages.
3. `dispute/[id]` and `disputes/[id]` coexist. Need canonical route decision.
4. `connectors` and `integrations` coexist. Need nav/lexicon normalization.
5. Catch-all route may mask broken links and give false green link-crawler results.

## Required next discovery commands for local/CI run

```bash
find apps/web -type f \( -name "*.ts" -o -name "*.tsx" \) | head -200
find apps/web/app/platform-v7 -type f | sort
grep -r "export default" apps/web/app/platform-v7 --include="*.tsx" -l | sort
grep -r "platform-v9" apps/web/app/platform-v7 apps/web/components --include="*.ts*" -n
pnpm typecheck
pnpm --filter @pc/web test
pnpm --filter @pc/web build
```

## E0 status

- Static GitHub discovery started.
- Runtime build/Lighthouse cannot be honestly marked as run from this ChatGPT session because no local clone / dependency install / browser runtime was available here.
- The repository must run CI or a local Codex environment for build, Lighthouse and Playwright baseline.
