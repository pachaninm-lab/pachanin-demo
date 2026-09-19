# Seller route continuity finding — 2026-06-24

Linked board: #1974 #1984 #1982 #1981 #1976 #1978 #1979

## Scope

Docs-only product/UX audit note for the active seller cabinet functional pass.

## Finding

The seller cabinet contains working-route cards where the label implies a direct seller action, but at least two targets need route continuity verification before they can be treated as production-grade actions:

- `sellerPaths` includes `href: '/platform-v7/seller/lots/new'` for publishing a lot.
- Current route inventory/search shows `apps/web/app/platform-v7/seller/lots/page.tsx`, while the matching `/seller/lots/new/page.tsx` route was not found in the current tree.
- `sellerPaths` includes `href: '/platform-v7/seller/rfq'` for checking requests.
- Current route inventory/search shows seller matching surfaces such as `apps/web/app/platform-v7/seller/matches/page.tsx`, while a concrete `/seller/rfq/page.tsx` route was not found in the current tree.

## Product risk

The seller first screen is now aligned around deal state, blocker, money at risk, responsible side and next action. However, route cards in the seller work area must obey the cabinet standard:

- every button leads to a real route/action/section; or
- it is rendered as disabled with a clear reason.

A visible action that points to a missing or ambiguous route breaks role continuity and feels like a demo surface, even when the first screen itself is correct.

## Safe next fix PR

Create one narrow UI/test PR after this audit note:

1. In `apps/web/app/platform-v7/seller/page.tsx`, retarget seller route cards only to existing seller routes, or convert unavailable actions to an explicit disabled/readiness state.
2. Add/extend a static guard in `apps/web/tests/unit/platformV7RoleUxRegressions.test.ts` so seller route-card hrefs do not point to absent `/new` or `/rfq` pages unless those pages exist.
3. Do not touch `apps/landing`, backend, DB, auth, session, API, package files or lockfiles.
4. Do not add live-readiness claims.

## Non-goals

- No runtime implementation.
- No new backend routes.
- No persistence or money-flow changes.
- No broad role-shell rewrite.

## Readiness impact

No readiness percentage increase. This is a seller-cabinet continuity finding under the current 72% controlled-pilot / pre-integration state.
