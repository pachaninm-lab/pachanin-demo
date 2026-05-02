# Platform V7 finish roadmap

## Purpose

This document is the execution roadmap from the completed fast-safe hardening pass to the final controlled-pilot finish.

The goal is not to add decorative screens. The goal is to make Platform V7 maximally clear, useful, safe, and trustworthy for real grain-market users: seller, buyer, logistics, driver, elevator, lab, bank, arbitrator, compliance, operator, and investor.

This roadmap does not claim production-ready, fully live, or fully integrated status.

## Non-negotiable rules

1. Work in small PRs.
2. Merge only after green CI.
3. Deploy every merged pass.
4. Do not touch `apps/landing` for Platform V7 work.
5. Do not rewrite Platform V7 architecture.
6. Do not add real external integrations without separate credentials, contracts, and validation.
7. Do not invent missing bank, GPS, FGIS, EDO, ETRN, lab, or document data.
8. Do not weaken tests to pass CI.
9. If a gate fails, fix the cause.
10. Keep all maturity claims honest.

## Current status

Fast-safe hardening pass: complete.

QA-pass started:

- QA-01: live smoke QA plan merged.
- Current QA-pass progress after QA-01: 5% complete / 95% remaining.

## Finish definition

Platform V7 reaches controlled-pilot finish when all of the following are true:

1. Live smoke routes pass on the canonical URL.
2. Visual regression screenshots exist and are green.
3. Lighthouse baseline exists and blocks regressions.
4. Responsive overflow gates remain green.
5. Forbidden-copy gates remain green in English and Russian.
6. Driver shell remains isolated.
7. Role leakage deep tests are green.
8. Old key actions provide visible feedback.
9. Manual actions require a reason where needed.
10. Money wording is safe and consistent.
11. DocumentsMatrix has action wiring where safe.
12. EvidencePack supports decision workflow where safe.
13. Investor mode remains honest.
14. Final end-to-end demo flow is clear in 3 to 5 minutes.
15. No changes touch `apps/landing`.

## Stage QA-01 — live smoke QA plan

Status: done.

Already completed:

- Added canonical live smoke plan.
- Listed priority routes.
- Listed role-specific checks.
- Listed exit criteria.
- Listed out-of-scope items.

Expected progress: 5%.

## Stage QA-02 — finish roadmap

Goal:

Create this roadmap as the source of truth for all remaining work.

Scope:

- Document all remaining stages.
- Define progress percentages.
- Define merge and deploy discipline.
- Define exact finish criteria.

Acceptance:

- Roadmap merged.
- CI green.
- Deploy green.
- `apps/landing` unchanged.

Expected progress after merge: 10%.

## Stage QA-03 — automated live route smoke

Goal:

Turn the live smoke plan into automated route checks where possible.

Routes:

- `/platform-v7`
- `/platform-v7/control-tower`
- `/platform-v7/bank`
- `/platform-v7/driver/field`
- `/platform-v7/disputes`
- `/platform-v7/seller`
- `/platform-v7/buyer`
- `/platform-v7/logistics`
- `/platform-v7/elevator`
- `/platform-v7/lab`
- `/platform-v7/connectors`
- `/platform-v7/investor`

Checks:

- Route returns 200.
- Page has first-screen content.
- Page has no crash shell.
- Page has no forbidden copy.
- Page has no horizontal overflow.

Acceptance:

- Automated route smoke green.
- CI green.
- Deploy green.

Expected progress after merge: 18%.

## Stage QA-04 — visual regression screenshots

Goal:

Protect the visual state of priority routes.

Viewports:

- 390 x 844
- 1440 x 900

Routes:

- `/platform-v7`
- `/platform-v7/control-tower`
- `/platform-v7/bank`
- `/platform-v7/driver/field`
- `/platform-v7/disputes`
- `/platform-v7/seller`
- `/platform-v7/buyer`
- `/platform-v7/logistics`

Checks:

- No clipped header.
- No hidden CTA.
- No overlapping sticky element.
- No broken driver field shell.
- No broken money/document/evidence blocks.

Acceptance:

- Screenshot baseline exists.
- Visual diff threshold defined.
- CI green.
- Deploy green.

Expected progress after merge: 28%.

## Stage QA-05 — Lighthouse baseline

Goal:

Add performance and accessibility baseline.

Initial target:

- Performance must not regress below current baseline.
- Accessibility target: 95+.
- Best Practices target: 95+.
- LCP target: 2.5s or lower.
- INP target: 200ms or lower.
- CLS target: 0.1 or lower.

Routes:

- `/platform-v7`
- `/platform-v7/control-tower`
- `/platform-v7/driver/field`
- `/platform-v7/bank`

Acceptance:

- Lighthouse baseline recorded.
- Regression threshold added.
- CI green.
- Deploy green.

Expected progress after merge: 38%.

## Stage QA-06 — accessibility and field usability pass

Goal:

Make the platform easier to use in real operational conditions.

Focus:

- Button sizes.
- Touch target spacing.
- Focus states.
- Mobile readability.
- Driver one-hand use.
- Elevator/lab mobile cards.
- Sticky CTA overlap prevention.

Acceptance:

- Driver, elevator, lab, bank, control tower mobile routes pass.
- No small dangerous actions.
- No unreadable mobile tables.
- CI green.
- Deploy green.

Expected progress after merge: 48%.

## Stage QA-07 — role leakage deep tests

Goal:

Make sure roles do not see unrelated data or controls.

Checks:

- Driver does not see bank, investor, trading, Control Tower, role switcher, reserves, or bids.
- Logistics does not see grain price, bank reserve, or trading bids.
- Buyer does not see other buyers' closed-mode bids.
- Seller does not see bank internal event logs.
- Bank does not see driver controls or trading actions outside money context.

Acceptance:

- Deep leakage tests green.
- CI green.
- Deploy green.

Expected progress after merge: 58%.

## Stage QA-08 — old action-click feedback

Goal:

Remove the remaining dead-button risk.

Routes:

- Seller.
- Buyer.
- Bank.
- Control Tower.
- Disputes.

Each action should show:

- Loading state.
- Success or error message.
- Status update.
- Next step.
- Manual reason when required.
- Journal or timeline event where existing adapters support it.

Acceptance:

- Key legacy buttons have visible feedback.
- No silent primary action remains in priority routes.
- CI green.
- Deploy green.

Expected progress after merge: 68%.

## Stage QA-09 — route hints beyond driver

Goal:

Help users return to the correct role workspace without adding a new auth system.

Add route hints for:

- Seller.
- Buyer.
- Logistics.
- Bank.
- Arbitrator.
- Compliance.
- Operator.

Acceptance:

- Role route hint works outside driver.
- No auth rewrite.
- No route removal.
- CI green.
- Deploy green.

Expected progress after merge: 75%.

## Stage QA-10 — MoneyTree wider read-only usage

Goal:

Make money status consistent across bank, operator, seller, and buyer views.

Rules:

- Reserved money is the container.
- Ready-to-release, held, blocked, dispute, and manual review are parts of the container.
- Do not double count money.
- Do not say the platform releases money.
- Say bank confirms release or release awaits bank confirmation.

Acceptance:

- MoneyTree or equivalent read-only summary appears where it clarifies money.
- Seller and buyer see money context without bank internals.
- CI green.
- Deploy green.

Expected progress after merge: 82%.

## Stage QA-11 — DocumentsMatrix action wiring

Goal:

Turn document status into safe next actions.

Actions:

- Request document.
- Open document check.
- Send to manual review.
- Retry document sending where simulated.
- Explain what money is blocked by missing documents.

Rules:

- No fake external confirmation.
- No fake signatures.
- Missing metadata remains visible.

Acceptance:

- Document actions show feedback.
- Missing external data is not invented.
- CI green.
- Deploy green.

Expected progress after merge: 88%.

## Stage QA-12 — EvidencePack decision wiring

Goal:

Make dispute handling clearer and safer.

Actions:

- Request evidence.
- Open evidence pack.
- Record decision reason.
- Show money impact.
- Preserve dispute history.

Rules:

- No dispute closure without reason.
- No invented GPS/hash/version.
- No hidden history.

Acceptance:

- Evidence decision flow is understandable.
- Manual reason is required where needed.
- CI green.
- Deploy green.

Expected progress after merge: 93%.

## Stage QA-13 — investor truth pass

Goal:

Make investor mode useful without inflated status.

Blocks:

- What is proven.
- What is in controlled pilot.
- What is simulated.
- What requires live connection.
- Operational load.
- Risks.
- Unit economics.
- Roadmap.

Acceptance:

- Investor route is honest and useful.
- No overclaim copy.
- CI green.
- Deploy green.

Expected progress after merge: 96%.

## Stage QA-14 — final end-to-end demo flow

Goal:

Show the full grain execution chain in 3 to 5 minutes.

Flow:

Lot -> bid -> accepted offer -> deal -> reserve -> logistics -> trip -> acceptance -> lab -> documents -> release or hold -> dispute -> evidence -> decision.

Rules:

- Demo is clearly marked as test scenario.
- Demo does not claim live integrations.
- Demo shows next action and role owner at every step.

Acceptance:

- Flow is clear for non-technical grain-market users.
- CI green.
- Deploy green.

Expected progress after merge: 99%.

## Stage QA-15 — final finish report

Goal:

Produce final report and stop adding work unless there is a concrete defect.

Report must include:

- What was done.
- What gates are green.
- What remains out of scope.
- What cannot be claimed.
- What can be shown to users/investors.
- Final controlled-pilot statement.

Acceptance:

- Final report merged.
- Deploy green.
- Canonical live route checked.

Expected progress after merge: 100%.

## Final statement allowed after completion

Allowed:

Platform V7 has reached a controlled-pilot finish as a role-first grain-trade execution UX. It is strong in role clarity, mobile field execution, money/document/evidence transparency, manual action discipline, and no-regression quality gates.

Not allowed:

- Production-ready.
- Fully live.
- Fully integrated.
- Complete product.
- Risk-free.
- Platform guarantees payment.
- Platform releases money by itself.
- Best in the world as an unsupported factual claim.

## Operating rhythm

For every stage:

1. Create small branch.
2. Change only scoped files.
3. Open PR.
4. Wait for CI green.
5. Merge only after green.
6. Check deploy.
7. Report progress percentage.
8. Move to next stage.
