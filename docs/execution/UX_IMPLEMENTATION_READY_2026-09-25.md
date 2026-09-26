# UX implementation ready — full product and 13 cabinets

Baseline: MASTER v2.1, `main` `bfbcd7642e54678153073a6d864695739b550b9c` at 25 September 2026. This is an execution contract, not UX acceptance or a deployment record. Re-resolve `main`, the active hosting revision, and the server role registry before each implementation slice. The companion route and dependency inventory is #5605; it is not a substitute for this acceptance plan.

## CURRENT STATE

- `apps/web/components/v7r/AppShellV4.tsx` is the existing authenticated shell. Public header ownership is separate from the authenticated shell; MASTER REQ-UX-001–003 still covers every reachable public route.
- Eight production role roots select `FirstCustomerWorkspace` through `firstCustomerWorkspaceRequired()`: seller, buyer, logistics, driver/field, surveyor, elevator, lab, and bank. The server snapshot in `apps/web/lib/first-customer-workspace-server.ts` supplies identity, organization and a scoped Deal/shipment/sample queue. Its order is recency, not server action priority. The screen therefore says UNKNOWN for the required next step.
- Operator, employee/profile, arbitrator, compliance and executive have distinct route bodies. The complete 13-root list and factual imports are in `docs/execution/R1_1_EXACT_INVENTORY_2026-09-20.md`; changes to that server registry require a new inventory, not an invented fourteenth role.
- Seller, Deal 360, role-mode and truthful bank/FGIS presentation have bounded prior work. Their PRs, green tests and controlled-pilot wording do not prove the complete 13/13 journey, mobile, accessibility, language or live acceptance.
- The current buyer source vertical is gated by #5604's immutable guard, then a separate trusted-base state-only admission. Its five exact planned paths are `FirstCustomerWorkspace.tsx`, its new module CSS, `designSystemV8MoneyRoles.test.ts`, a focused buyer UX test and its scope manifest. No buyer source edit is authorized by the guard alone.

## KEEP

Keep the existing AppShellV4, design-system-v8 tokens and transaction cockpit primitives; server-derived role/tenant access; canonical Deal, Inventory, money, dispute, regulatory and provider authorities; fail-closed UNKNOWN states; audit/correlation; existing route constants and field workflows. Keep the production branch from falling back to legacy demo cards. Preserve the real actor during Founder VIEW_AS and the read-only limit until CORE's server authority is accepted.

## GAPS

| Surface | Required completion |
| --- | --- |
| Public Home, About, How, Gekta/AI, Trust, Contact, legal, Docs, Login and Register | One PublicHeader geometry and navigation, RU/EN/ZH, mobile, keyboard, links, conversion and truthful product language; PUBLIC ownership and exact live acceptance. |
| Common authenticated UI | One task vocabulary and status semantics in shell/navigation, Action Center, inbox, notifications, search, settings, support, document/evidence views and Gekta context. |
| Each of 13 cabinets | First login, state/required action, real object work, settings, exception, outage/recovery, cross-role handoff, denied state and mobile path. A role root rendering a shared queue is not completion. |
| Every critical screen | Loading, empty, partial, stale, degraded, offline, forbidden, validation and retryable/non-retryable errors, conflict, unknown external outcome, security hold and success as applicable. |
| Data presentation | No fabricated money, deadline, provider, government applicability or primary action; source, freshness, evidence, permission and next safe step visible. |
| Accessibility and languages | WCAG 2.2 AA, keyboard/focus/screen reader/reflow/reduced motion, real mobile browsers, RU/EN/ZH meaning and format parity. |

## ROOT CAUSES

The shared landing is a safe access and queue projection, not eight complete role workspaces. Legacy route bodies contain static stories behind a nonproduction branch; those cannot become live fallbacks. Server queue order is not a priority contract. Core bank-operation linkage, per-Deal regulatory applicability and actor-wide VIEW_AS authority have separate unresolved handoffs. A screen-by-screen design cannot correct those missing server facts locally.

## TARGET

For each server-authorized role, the first five to ten seconds show the role and organization, verified state with freshness, one authoritative next action or explicit UNKNOWN, blocker/owner, deadline and money impact only if the API supplies them, the effect of action, and an accessible route to the complete object. Shared shell, public product language and design tokens stay coherent. All 13 real role journeys and public routes pass the MASTER matrix on an exact REG.RU revision.

## ARCHITECTURE

1. Treat `AppShellV4` and design-system-v8 as shared visual primitives; route-specific workspaces compose them. Do not introduce a second shell or a browser role registry.
2. Server session/profile and object-scoped APIs supply role, organization, queue, action decision, permissions, version, source/freshness and evidence. Client layout may reorder *navigation* only. The canonical server action decision alone may designate a primary obligation.
3. Use a typed presentation projection with `AVAILABLE | BLOCKED | UNKNOWN | NONE` for action, plus explicit data availability/freshness and separate money/regulatory/provider axes. An absent field remains UNKNOWN; a stale response does not become completed state.
4. A role-specific workspace owns task order and explanation; shared primitives own form, status, focus, mobile table and error behavior. Gekta advice is visually identified as advice and cannot grant authority.
5. Public routes use the one PublicHeader contract through the PUBLIC lane. Coordinate shared language and status tokens with PRODUCT; do not change `apps/landing` or public source from an unadmitted PRODUCT branch.

## EXACT FILES / MODULES

- Shared protected UI: `apps/web/components/v7r/AppShellV4.tsx`, `.module.css`; `apps/web/components/transaction-ux/OperationalDecisionCockpit.tsx`, `.module.css`; `apps/web/components/platform-v7/FirstCustomerWorkspace.tsx`; `apps/web/lib/first-customer-workspace-server.ts`; `apps/web/lib/platform-v7/navigation.ts` and `routes.ts`.
- Role roots: `apps/web/app/platform-v7/{operator,buyer,seller,logistics,surveyor,elevator,lab,bank,profile,arbitrator,compliance,executive}/page.tsx` and `apps/web/app/platform-v7/driver/field/page.tsx` (driver root redirects/renders according to registry). Verify exact imports and route security at each slice.
- Shared adjacent routes: `apps/web/app/platform-v7/{notifications,support}/page.tsx`, `apps/web/components/platform-v7/staff/StaffControlCenter.tsx`, Deal workspace components under `apps/web/components/platform-v7/`, and server-side search/settings modules discovered per admitted slice.
- Immediate buyer slice: the five paths pinned in #5604's later state-only admission. Its local CSS must use existing tokens, and focused tests must render buyer in RU/EN/ZH for ready/empty/forbidden/degraded and owner-controlled paths. No broader source path is implicitly admitted by this document.
- Public files and tests: enumerate exact Home, supporting pages, PublicHeader and auth entry imports in the separate PUBLIC PR before mutation. Do not infer a single path from URL naming.

## DATA / SCHEMA

No UX slice changes a canonical DB owner or creates a presentation-owned money/priority table. Display organization, actor, membership, object ID, version, status, source timestamp, `fetchedAt`, decision timestamp, correlation and evidence references only when provided by the accepted server contract. The count of a capped list is a visible minimum or UNKNOWN total. Saved views and drafts require their own authorized persistence contract, tenant scope, retention and rollback; browser storage cannot become legal evidence or a durable command queue.

## API / CONTRACTS

- Before replacing buyer/seller/other UNKNOWN primary action, consume a CORE decision envelope with stable decision/version, availability, action/object/target, blocker, owner, impact, result, permission/step-up, source and freshness. #5534 is the farmer-first producer; #5535 covers the seven other shared roles. No local ranking from `updatedAt`, `nextAction` text or first row.
- Founder role mode consumes accepted staff access BFF; #5580 must enforce one actor-wide live protected session with typed conflict before 13/13 live acceptance. The browser cannot choose an effective tenant or API role.
- Bank screen consumes #5525 operation→binding→provider read authority. Regulatory screen consumes #5526 per-Deal applicability and #5370 Grain→Inventory reconciliation. Until those exact handoffs, render NOT EXPOSED/UNKNOWN separately from availability or external finality.
- Search, notifications, settings and support need typed scoped read/write contracts with server permission and version checks. Define those at each bounded slice rather than treating a generic client store as authority.

## UX

Use task labels and real business object names, not internal module codes. Explain disabled actions with the blocking rule, owner and recovery path. Keep queue navigation distinct from primary obligation. Use tabular numerals and visible units for quantities/money; never show zero when the source is unavailable. On narrow screens give tables an intentional summary/detail alternative, persistent context and touch targets; test safe areas and 200% zoom. For forms preserve drafts and explicit consequence review; for mutation show object, change, money/legal effect, recipient, irreversibility and recovery. RU is editorial source, while EN/ZH keep legal meaning and local dates/units rather than literal word order.

## SECURITY

Navigation is never permission. Server-side tenant/organization/object/action authorization gates all reads, exports and writes. Revocation or a mid-Deal role change must remove cached sensitive data and revalidate before action. VIEW_AS exposes the real actor, effective role, organization, reason, expiry and read-only limit; high-risk actions require ordinary authority and MFA. Never place credential values, signature material or another tenant's count in UI telemetry, errors, DOM or exports.

## CONCURRENCY

Use object version/ETag or the existing command receipt for stale edits. Disable duplicate UI submission but rely on server idempotency; after a lost POST response keep the same operation/idempotency identity until reconciliation. Multiple tabs must not create concurrent protected VIEW_AS grants; the server owns that invariant. Notification dedupe keys and quiet hours are server policy, not array-index behavior.

## FAILURE / RECOVERY

Distinguish an empty authoritative result from unavailable/partial/stale data; retain correlation and retry without invented success. Offline field capture is pending evidence until durable server ACK, with queued/retry/conflict display and no duplicate mutation. Bank/government/EPD timeout after possible mutation means UNKNOWN/PENDING_RECONCILIATION; never offer a fresh operation as a blind retry. On 401/403 or role change, discard prior tenant display and guide a safe re-entry; on 409 show current version and a permitted resolution.

## EXTERNAL BLOCKERS

Product UX may show a blocked capability, but live bank/FGIS/EPD status needs current contracts, organization bindings, credentials, signing/callback trust and external evidence owned by #5530/#5531 and the corresponding CORE handoffs. Log each blocker with provider/system, owner, checkedAt, exact missing artifact, affected flow, safe degraded state and prohibited maturity claim. A visual mock or browser fixture is never external acceptance.

## TESTS

- Component contracts: every role's identity/org access, UNKNOWN action, queue link and owner-controlled boundary; role-change/forbidden, empty, partial, stale, error, conflict and retry.
- Browser matrix: Safari iOS, Chrome Android, Chrome/Edge/Firefox desktop; 320/375/390/768/1280/1440 viewports where supported, 200% zoom, keyboard, screen reader labels, focus, reduced motion, safe area and no horizontal loss of data.
- RU/EN/ZH: longest labels, CJK fonts, dates, plural/units/decimal/currency, legal action terms; automated accessibility plus manual keyboard/screen reader acceptance.
- Cross-role E2E: seller batch→buyer request/offer→logistics/driver→elevator/lab/surveyor→bank/finance→operator/arbitrator/compliance→executive; each handoff preserves scoped object/evidence and denies unauthorized reads/actions.
- Negative: server outage, duplicate submission, lost response, stale version, revoked membership, cross-tenant route/export, stale regulatory source and provider restriction. No fixture success as live evidence.

## ACCEPTANCE

For each slice: exact admitted paths; full diff review by an independent nonauthor session, author audit, substantive exact-head CI/security/visual/accessibility, trusted readiness, SHA-bound merge and exact-current-main REG.RU image/revision/live tests. Aggregate UX PASS requires PublicHeader route matrix and 13/13 first login, main work, settings, mobile, error, external outage, exception and recovery; known P0/P1/P2 in acceptance scope = 0. Measure LCP ≤2.5 s, INP ≤200 ms and CLS ≤0.1 at p75 where field measurement is available. Green unit tests or one seller/buyer screen do not meet aggregate PASS.

## DEPENDENCIES

PUBLIC #5559 merged to main at baseline but needs exact-main release/live acceptance. #5604 guard must merge, followed by a new exact-base buyer state admission. #5605 inventory needs independent review and lawful merge. CORE #5580, #5534/#5535, #5525, #5526 and #5370 provide server facts; #5530/#5531 provide external activation evidence. Coordinate serial main/state writer slots through #5469. An incomplete dependency keeps its dependent UX state visibly UNKNOWN and its aggregate acceptance open.

## IMPLEMENTATION ORDER

1. Finish PUBLIC exact-main release and actual public route/mobile acceptance; keep source ownership with PUBLIC.
2. Merge #5604 after exact-head gates and nonauthor review. Rebase the one-file buyer admission on that exact main, test it through the accepted-base guard, independently review and merge. Then implement the buyer five-path vertical and accept it live.
3. Add server-owned action decisions farmer-first, then buyer and the other six shared roles; replace UNKNOWN only per accepted handoff. Complete each role object journey with one narrow admitted slice at a time.
4. Complete operator, employee, arbitrator, compliance and executive journeys, controlled Founder 13/13, then Action Center, inbox, notifications, search, settings, support, documents and Gekta context without a second shell.
5. Consume bank and regulatory CORE read contracts and only evidence-backed external maturity; run cross-role, weak-network, mobile, RU/EN/ZH and accessibility reality acceptance on the exact production revision.
