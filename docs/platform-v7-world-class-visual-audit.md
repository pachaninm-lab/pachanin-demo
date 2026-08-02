# platform-v7 world-class visual audit + route canonicalization plan

Generated: 2026-05-04  
Scope: `apps/web/app/platform-v7`, `apps/web/components/platform-v7`, `apps/web/components/v7r`, `apps/web/lib/platform-v7`, `apps/web/styles`  
Protected scope: `apps/landing` must not be changed.  
Product stage: `controlled-pilot / simulation-grade`. This audit does not claim production readiness, live integrations, live payouts, or completed external connectors.

## 0. Source discipline

This file is PR-1 of the visual polish track. It is documentation-only and does not change runtime behavior.

Observed from repository state:

- `apps/web/app/platform-v7/page.tsx` renders `PlatformRolesHub`.
- `apps/web/app/platform-v7/layout.tsx` wraps the route with `AppShellV3`, `ToastProvider`, `ShellCopyNormalizer`, `AiShellEnhancer`, and `RoleExecutionSummaryGate`.
- `apps/web/lib/platform-v7/route-audit.ts` covers only P0 smoke and target-fast-pass routes, not the full visual route contour.
- `apps/web/lib/platform-v7/navigation.ts` confirms role-specific route navigation and current route splits.
- `apps/web/lib/platform-v7/design/tokens.ts` exists, but its token scale does not fully match the requested world-class visual system.
- Existing `docs/codebase-map.md` already flags route drift, duplicate routes and catch-all masking risk.

Not run from this ChatGPT session:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- Playwright screenshots
- Lighthouse
- Vercel preview verification

These checks must be run by CI/Vercel before merge.

## 1. Visual audit verdict

Score is based on static code and route-map inspection, not on fresh device screenshots.

| Area | Score / 100 | Verdict |
|---|---:|---|
| First impression | 73 | Root route has a guided execution hub, but the first screen still reads partly as role/demo navigation, not fully as premium bank-grade command center. |
| Trust | 78 | Status honesty is present, but duplicate routes and support/system screens can dilute confidence. |
| Visual hierarchy | 72 | Strong copy blocks exist, but page density, repeated cards and inline styles weaken rhythm. |
| Mobile | 68 | Mobile intent exists; full route contour still needs table-to-card, sticky and field-shell QA. |
| Desktop | 74 | Responsive grids exist; desktop still risks card wall rather than executive operating system. |
| Role clarity | 81 | Role constraints are explicitly represented in the hub and navigation. Leakage must be tested route-by-route. |
| Accessibility | 66 | CSS files exist; focus-visible, keyboard, target-size and sticky overlap still need systematic QA. |
| Consistency | 64 | Tokens and primitives exist, but inline styling and multiple shells create visual drift. |
| Premium feel | 70 | Calm palette and strong typography exist; needs less assembled-card feeling, more operating-system composition. |
| Bank-grade confidence | 72 | Money/document/release logic is visible; fake-live and duplicate-route risks must be closed before bank/investor demo. |

Current visual readiness: **71.8 / 100**  
Target after PR-8: **88-92 / 100 for controlled-pilot demo**, without claiming production readiness.

## 2. Route-map

| Route | Type | Primary role | Visual status | Main risk | Fix | Priority |
|---|---|---|---|---|---|---|
| `/platform-v7` | Core entry | All | Partial premium hub | Still reads partly as role/demo index | Build premium command-center hero with deal spine, one primary CTA and Deal 360 CTA | P0 |
| `/platform-v7/seller` | Core role | Seller | Needs polish | Seller may not instantly understand why money is not released | Show my lot / bid accepted / money not released / documents / next step above fold | P0 |
| `/platform-v7/buyer` | Core role | Buyer | Needs polish | Buyer may confuse bid, reserve and credit scenario | Show my bid / my reserve / my financing scenario / closed bids hidden | P0 |
| `/platform-v7/logistics` | Core role | Logistics | Needs polish | Logistics may look like general dashboard, not post-winner execution inbox | Split into inbox + route assignment + driver dispatch story | P0 |
| `/platform-v7/logistics/inbox` | Core role | Logistics | Must verify route file | Missing from current smoke list | Confirm file, visual state and link from logistics after winner selected | P0 |
| `/platform-v7/driver` | Core field | Driver | Exists | Risk of desktop-shell feeling for mobile role | Convert into field-app shell: one trip, big map/status, one action, offline queue | P0 |
| `/platform-v7/driver/field` | Field shell | Driver | Exists in audit list | Duplicate with `/driver` | Canonicalize: `/driver` external route, `/driver/field` internal/redirect or focused child | P0 |
| `/platform-v7/field` | Extended/duplicate | Field roles | Risk | Duplicate field cabinet | Merge into driver/elevator/surveyor field model or mark as service route | P1 |
| `/platform-v7/elevator` | Core field | Elevator | Needs polish | Receiving may leak commercial/bank context | Show only weight, quality, act, deviation and payout impact | P0 |
| `/platform-v7/lab` | Extended field | Lab | Needs polish | Can look like dry form/archive | Show sample, protocol, source, status, dispute/release impact | P1 |
| `/platform-v7/surveyor` | Extended field | Surveyor | Needs polish | Inspector route may not connect to dispute/money impact | Tie acts to evidence pack, amount impact and SLA | P1 |
| `/platform-v7/surveyor/acts/[id]` | Extended detail | Surveyor/compliance | Needs verification | Act may be isolated from Deal 360 | Add deal link, evidence chain and document source | P1 |
| `/platform-v7/bank` | Core money | Bank | Needs audit polish | Fake payout / unclear release blockers | Show reserve, hold, release candidate, blockers, no payout without conditions | P0 |
| `/platform-v7/bank/factoring` | Extended money | Bank/buyer | Needs polish | Credit product can leak to wrong roles | Keep buyer-only financing scenario and bank-only control view | P1 |
| `/platform-v7/bank/escrow` | Extended money | Bank | Needs polish | Escrow naming may conflict with nominal-account logic | Use reserve/protected-settlement language unless legal basis confirmed | P1 |
| `/platform-v7/bank/events/[id]` | Money detail | Bank/operator | Needs polish | Event detail can look technical | Translate callbacks/events into business-readable bank events | P1 |
| `/platform-v7/documents` | Core audit | All/compliance | Target-fast-pass | Docs can look like archive instead of release gate | Use source -> owner -> status -> payout impact | P0 |
| `/platform-v7/disputes` | Core dispute | Arbitrator/operator | Exists | Disputes may not show money impact fast enough | Show reason, amount impact, SLA, evidence, owner, next action | P0 |
| `/platform-v7/disputes/[id]` | Dispute detail | Arbitrator | Needs verification | Detail may be detached from money/documents | Canonical detail route with evidence chain and release impact | P0 |
| `/platform-v7/dispute/[id]` | Duplicate dispute detail | Arbitrator | Risk | Singular/plural duplicate | Redirect or remove from nav; canonical = `/disputes/[id]` | P0 |
| `/platform-v7/connectors` | Core integrations | Operator/partner | Target-fast-pass | Can imply live integrations | External canonical term: Подключения; every card must show simulation/access-required | P0 |
| `/platform-v7/integrations` | Duplicate integrations | Operator | Risk | Duplicate terminology | Redirect to `/connectors` or mark internal service route | P0 |
| `/platform-v7/control-tower` | Extended ops/core | Operator | Exists | Can feel like dev-dashboard | Rebuild as blocker queue with amount impact, SLA, owner, next action, journal | P0 |
| `/platform-v7/operator` | Extended ops/duplicate | Operator | Risk | Duplicate operational center | Define as operator personal cabinet or redirect to control tower | P1 |
| `/platform-v7/operator-cockpit/queues` | Extended ops | Operator | Needs polish | Queue may feel internal/dev | Convert into clean production-style queue without tech garbage | P1 |
| `/platform-v7/deals` | Extended core | All permitted roles | Exists | Deal list may not reconcile with KPIs | Use one source of truth and role-filtered visibility | P0 |
| `/platform-v7/deals/[dealId]` | Deal 360 | All permitted roles | Critical | Deal detail is the trust anchor | Deal 360 must show money/cargo/docs/dispute/next action in first viewport | P0 |
| `/platform-v7/deals/DL-9106/clean` | Core demo Deal 360 | All permitted roles | Critical | Demo anchor must be perfect | Make this the best single screen: bank-grade, evidence-grade, role-safe | P0 |
| `/platform-v7/lots` | Extended commercial | Seller/buyer/operator | Exists | Can look like marketplace listing | Reframe as execution-ready lots and deal entry, not classified board | P1 |
| `/platform-v7/lots/LOT-2403` | Core lot detail | Seller/buyer | Critical | Lot can feel like product card | Show lot as first stage of controlled deal, not marketplace SKU | P0 |
| `/platform-v7/lots/create` | Seller action | Seller | Mentioned in nav | Mobile risk | Maintain mobile-safe creation with clear document/readiness gates | P1 |
| `/platform-v7/procurement` | Extended buyer | Buyer | Exists | Can look separate from deal execution | Connect to buyer bid/reserve/deal route | P1 |
| `/platform-v7/marketplace` | Risk route | Commercial | Critical risk | Wrong positioning as marketplace | Rename/reframe/redirect; never external primary route | P0 |
| `/platform-v7/market` | Additional market route | Commercial | Found in search | Same marketplace drift | Audit and reframe to demand/lot execution, or hide | P1 |
| `/platform-v7/companies/[inn]` | Extended entity | Compliance/operator | Needs polish | PII/commercial leakage | Role-gated company dossier, no excessive exposure | P1 |
| `/platform-v7/compliance` | Extended legal | Compliance | Exists | Can become dry archive | Show legal risk, document, basis, status, action and audit trail | P1 |
| `/platform-v7/ai` | Support/system | Operator/all | Risk | AI gimmick / false decisioning | AI only explains blockers and drafts; never decides or releases money | P1 |
| `/platform-v7/demo` | Support/demo | Investor/all | Exists | Can be link list instead of guided story | Make 3-minute guided deal route, not navigation page | P0 |
| `/platform-v7/notifications` | Support/system | All | Needs polish | Notification noise | Only events tied to money, cargo, docs, dispute, next action | P1 |
| `/platform-v7/profile` | Support/system | All | Exists | Generic/dev profile | Bring to platform visual system; role, org, permissions, security | P2 |
| `/platform-v7/register` | Support/system | New org | Exists | Onboarding may overpromise production | State controlled pilot, access request, role/org verification | P1 |
| `/platform-v7/auth` | Support/system | User | Exists | Auth route can feel dev | Bank-grade login/access screen; no mock/dev copy | P1 |
| `/platform-v7/login` | Support/system | User | Found in search | Duplicate auth | Canonicalize with `/auth` | P1 |
| `/platform-v7/deploy-check` | Support/service | Internal | Critical | Dev/service screen exposed externally | Remove from public nav and gate as internal service | P0 |
| `/platform-v7/[...slug]` | System catch-all | All | Critical risk | Masks broken links and false green smoke | Hard 404 for unknown; allow only explicit compatibility redirects | P0 |
| `/platform-v7/roles` | Support/demo | All | Exists | Role switcher may feel like dev tool | Keep only as guided access selector, not core demo start | P1 |
| `/platform-v7/investor` | Support/partner | Investor | Exists | Could look like shallow metrics deck | Show maturity, proof, runway, pilots, risks without inflated claims | P1 |
| `/platform-v7/executive` | Extended exec | Executive | Exists | Can duplicate analytics/control tower | Executive read-only cockpit with no operational override | P1 |
| `/platform-v7/analytics` | Extended analysis | Operator/executive | Found in search | Dashboard drift | Tie metrics to deals and source formulas | P2 |
| `/platform-v7/reports` | Support/analysis | Operator/executive | Found in search | Archive feel | Use audit reports with deal links and export boundaries | P2 |
| `/platform-v7/data-room` | Support/investor | Investor | Found in search | Overexposure / stale maturity claims | Gate claims and mark proof vs hypothesis | P2 |
| `/platform-v7/status` | Support/system | All/internal | Found in search | Could reveal service/debug state | Make external-safe status or internal-only | P2 |
| `/platform-v7/security` | Support/trust | All/partner | Found in search | Legal/security claims risk | Only verified security controls; no production overclaim | P2 |
| `/platform-v7/about` | Support/info | All | Found in search | Marketing tone drift | Execution positioning, no marketplace language | P2 |
| `/platform-v7/docs` | Support/info | All | Found in search | Internal docs exposed | External-safe, role-based, no dev junk | P2 |
| `/platform-v7/help` | Support/info | All | Found in search | Generic help | Convert to execution help by role | P2 |
| `/platform-v7/trust` | Support/trust | Bank/investor | Found in search | Trust claims may exceed proof | Align with legal maturity wording | P2 |
| `/platform-v7/terms` | Support/legal | All | Found in search | Legal mismatch | Align with legal master document | P2 |
| `/platform-v7/privacy` | Support/legal | All | Found in search | Legal mismatch | Align with personal data rules | P2 |
| `/platform-v7/oferta` | Support/legal | All | Found in search | Duplicates legal terms | Canonicalize with terms/legal docs | P2 |
| `/platform-v7/pricing` | Support/commercial | Buyer/seller | Found in search | Monetization overclaim | Use controlled-pilot pricing and model assumptions only | P2 |
| `/platform-v7/roadmap` | Support/product | Investor/partner | Found in search | Roadmap can overpromise | Mark target, hypothesis and confirmed blocks separately | P2 |
| `/platform-v7/support` | Support/help | All | Found in search | Generic support | Tie support categories to deal/cargo/money/docs/dispute | P2 |

## 3. Defect table

| Screen | Problem | Why critical | Fix | Priority |
|---|---|---|---|---|
| `/platform-v7` | First viewport is not yet unmistakably premium command center | First impression defines bank/investor confidence | Deal spine hero, subtle premium surface, one primary CTA, one Deal 360 CTA | P0 |
| All route contour | Audit list covers fewer routes than actual platform-v7 surface | Unchecked screens can destroy demo trust | Generate route manifest and run visual QA over all routes | P0 |
| `/connectors` + `/integrations` | Duplicate terms | Creates doubt about architecture and maturity | External canonical route = `/connectors`; `/integrations` redirect/internal | P0 |
| `/dispute/[id]` + `/disputes/[id]` | Duplicate dispute details | Risk of conflicting evidence/money state | Canonical route = `/disputes/[id]`; singular redirects | P0 |
| `/field` + `/driver` + `/driver/field` | Duplicate field shells | Driver can see wrong shell or inconsistent UX | Canonical driver field app and role-specific field children | P0 |
| `/control-tower` + `/operator` | Duplicate ops center | Operator trust breaks if queues differ | Control Tower = execution center; Operator = personal/operator profile or redirect | P1 |
| `/marketplace` and `/market` | Wrong product positioning | Platform can be read as marketplace/classifieds | Rename/reframe as execution lot entry or hide | P0 |
| `/deploy-check` | Service screen exposed as user route | Looks like dev/debug surface | Remove from nav and gate as internal service | P0 |
| `/[...slug]` | Catch-all can hide broken links | False green smoke and broken confidence | Unknown routes must 404; only explicit compatibility redirects allowed | P0 |
| Bank routes | Possible fake payout perception | Legal/banking risk | No payout/release CTA unless all preconditions displayed and satisfied | P0 |
| Documents route | Internal file status may look like legal completion | Regulatory and bank-readiness risk | Split internal platform status vs external legal status | P0 |
| AI route | AI may look like decision-maker | Legal/trust risk | AI explains blockers/prepares drafts only; no decision/release authority | P1 |
| System/legal/info routes | Can contain stale claims | Due diligence risk | Align all claims with controlled-pilot/simulation-grade language | P1 |
| Mobile tables | Potential compressed desktop | Field users lose task clarity | Convert tables to mobile cards with one main action | P0 |
| Sticky actions | Potential overlap | Blocks task completion | Add safe-area padding, no overlap, 44px touch targets | P0 |
| Inline styles | Visual drift | Premium feel degrades screen by screen | Move repeated patterns to primitives/tokens only where safe | P1 |
| Dark mode | Possible partial/inert mode | Bad trust signal | Either fully support or remove false toggle | P1 |
| Role navigation | Role switcher can feel like dev tool | Demo trust loss | Make role switcher productized and role-safe | P1 |

## 4. PR plan

### PR-1 - Route map + visual audit + canonicalization plan

Scope:

- Add this document.
- Do not change runtime.
- Do not touch `apps/landing`.

Acceptance:

- Documentation-only.
- Route risks explicitly identified.
- No production-ready/live-integrated claims.

### PR-2 - Visual tokens + typography + shared surfaces

Scope:

- Normalize `PLATFORM_V7_TOKENS` to requested scale:
  - colors: `background`, `surface`, `surfaceMuted`, `border`, `textPrimary`, `textSecondary`, `textMuted`, `success`, `warning`, `danger`, `info`, `bank`, `logistics`, `document`, `dispute`.
  - radii: xs 6, sm 10, md 14, lg 20, xl 28.
  - spacing: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 56.
  - shadows: none, soft, elevated, command.
  - typography: display, h1, h2, h3, body, caption, micro.
- Add `P7Page`, `P7Section`, `P7Toolbar`, `P7Hero`, `P7DealSpine`.
- Keep old primitives backward-compatible.

### PR-3 - Hero / guided hub wow layer

Scope:

- Replace root hub first viewport with premium command center.
- Add visual chain:
  `LOT-2403 -> ставка -> DL-9106 -> резерв -> LOG-REQ-2403 -> TRIP-SIM-001 -> приемка -> документы -> деньги -> спор`.
- CTA:
  - primary: `Пройти сделку за 3 минуты`
  - secondary: `Открыть Deal 360`
- Remove overloaded dashboard/card-wall feeling.

### PR-4 - Core role screens polish

Scope:

- Seller, buyer, logistics, logistics inbox, driver, elevator.
- Above-the-fold each role answers:
  - what is happening;
  - where money/cargo/docs are;
  - what is blocked;
  - who acts next;
  - what is hidden from this role.
- Driver becomes field-app experience.

### PR-5 - Bank/documents/disputes audit polish

Scope:

- Bank: money, reserve, release candidate, hold, blockers, no fake payout.
- Documents: source, owner, status, legal/external boundary, payout impact.
- Disputes: reason, amount impact, SLA, evidence, owner, next action.

### PR-6 - Connectors/integrations/canonical route cleanup

Scope:

- Canonicalize connectors/integrations.
- Canonicalize dispute/disputes.
- Canonicalize field/driver.
- Reframe/hide marketplace/market.
- Make catch-all strict.

### PR-7 - Extended/system routes polish

Scope:

- Control tower, operator, operator queues, lab, compliance, demo, notifications, profile, auth, register, investor, executive, support/legal/info routes.
- Remove dev/debug appearance.
- Make demo a 3-minute guided route.
- Keep deploy-check internal.

### PR-8 - Accessibility + mobile/desktop final QA

Scope:

- Keyboard navigation.
- Focus-visible.
- 44px touch targets.
- No sticky overlap.
- No horizontal mobile scroll.
- Table-to-card.
- Desktop max-width/split layout.
- Screenshots: 360, 375, 430, 768, 1024, 1280, 1366, 1440, 1728, 1920, 2560.

## 5. Merge checklist for every PR

- `pnpm typecheck`
- `pnpm lint` if configured
- `pnpm test`
- `pnpm build`
- Vercel `pachanin-canonical-web` preview success
- Mobile screenshots checked
- Desktop screenshots checked
- `apps/landing` unchanged
- No `production-ready`, `live-integrated`, `боевые выплаты`, `полностью интегрировано` claims
- No role permission regression
- No fake payout button
- No mobile horizontal scroll
- No sticky overlap
- Critical CTAs are touch-accessible
- Statuses are readable
- Catch-all does not mask broken links
- Duplicate routes have canonical decision

## 6. Final acceptance test

Platform-v7 visual layer is accepted when:

1. `/platform-v7` communicates in 3 seconds: this is execution, not marketplace.
2. Wow effect exists without cheap visual noise.
3. Mobile feels like a real product, not compressed desktop.
4. Desktop feels like a premium operating system, not a card dump.
5. Every role sees only its own surface.
6. Money, cargo, documents, dispute and next step are visible fast.
7. No route feels like raw demo/debug.
8. No screen looks materially worse than the core route.
9. No false live integration or production claim.
10. Extended routes do not weaken the core impression.
11. Duplicate/service routes do not create route chaos.
12. The platform can be shown to bank, region, investor and real deal participant as controlled-pilot/simulation-grade.
