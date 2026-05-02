# Platform V7 World-Class Benchmark Gate

## Status

Platform V7 is now materially closer to a role-first B2B/agro execution product for a controlled pilot.

This document is a benchmark gate, not a production-readiness claim. External integrations, banking actions, live document exchange, live GPS, and real transaction execution still require separate contracts, credentials, test evidence, and pilot validation.

## Benchmark scale

- 0 — absent
- 1 — partial
- 2 — present and understandable
- 3 — stronger than most comparable B2B/agro interfaces in clarity or execution logic

## Benchmark table

| Criterion | Score | Current evidence | Next step |
| --- | ---: | --- | --- |
| Onboarding / first entry | 3 | `/platform-v7` opens a scenario-based entry instead of dumping users into an operator dashboard. | Add guided first-run hints per role. |
| Role UX | 2 | RoleExecutionSummary, role route policy, and driver route hint exist. | Extend route hints beyond driver and deepen buyer/seller/logistics leakage checks. |
| Deal as one execution object | 2 | Money, document, evidence, dispute, action-feedback, and manual-action layers point back to deal context. | Continue normalizing deal selectors across legacy runtime surfaces. |
| Money visibility | 2 | Bank has MoneyTree strip; Control Tower has money/risk KPI structure; helper logic avoids independent duplicate sums. | Mount MoneyTree read-only summary where it clarifies seller/buyer/operator flows. |
| Document workflow | 3 | DocumentsMatrix shows document status, owner, block reason, money impact, next step, and honest metadata gaps. | Connect actual document actions step by step. |
| Route / field execution | 2 | `/platform-v7/driver/field` is separated from the general platform shell and covered by leakage/mobile smoke. | Add offline queue visual state for every driver action. |
| Dispute / evidence | 3 | EvidencePack shows evidence categories plus metadata slots and marks missing geo/hash/version as requiring connection. | Add immutable evidence versioning once data model supports it. |
| Mobile field-shell | 3 | Driver field-shell has dedicated smoke coverage and hides bank/investor/trading language. | Add screenshots and visual diff baseline. |
| Action feedback | 2 | Action result helper, result strip, manual-action helper, and Control Tower manual-action strip exist. | Connect helpers to more older buttons in seller/buyer/bank/operator flows. |
| Role leakage protection | 2 | Role leakage matrix, route policy helper, driver field leakage smoke, and forbidden-copy tests exist. | Expand tests to buyer closed-bid mode and logistics grain-price hiding. |
| Trust markers | 3 | Forbidden-copy gates, metadata gaps, and pilot/test wording prevent inflated live claims in touched screens. | Expand copy gate with Russian claim variants. |
| Visual clarity | 2 | Entry, summaries, Control Tower layers, MoneyTree, DocumentsMatrix, EvidencePack, and manual-action strip simplify key surfaces. | Consolidate more shared UI tokens and add visual snapshots. |
| Performance / reliability | 1 | Build, route, forbidden-copy, metadata, manual-action, and responsive overflow gates exist. Lighthouse is not automated yet. | Add Lighthouse baseline and no-regression threshold. |
| No-regression quality gates | 3 | Route screen, responsive overflow across 375/390/414/768/1440, forbidden copy, metadata, manual action, and leakage gates exist. | Add visual regression screenshots. |
| Maturity claim honesty | 3 | PR copy and UI avoid production-ready / fully live / fully integrated claims; missing external data is shown as requiring connection. | Keep this as a required PR gate. |

## Score summary

- Criteria scored 2 or higher: 14 / 15 = 93%
- Criteria scored 3: 6 / 15 = 40%
- Critical criteria scored 0: 0

The target threshold of 80% criteria at 2+ is met.

The target threshold of 30% criteria at 3 is met.

## Honest conclusion

Platform V7 is no longer just a heavy internal dashboard. It now has a role-first entry, role summaries, clearer operator KPIs, separated driver field-shell, money decomposition, document matrix, evidence pack, manual-action reason discipline, and stronger copy/leakage/responsive gates.

It is still not a complete live production product. The remaining gap is not more screens; it is deeper action feedback, broader old-button wiring, Lighthouse/visual regression, and real external integration validation.

## Remaining fast-pass work

1. Add visual regression screenshots for core routes.
2. Add Lighthouse baseline and no-regression gate.
3. Connect manual-action reasons to more actual operator actions.
4. Connect action feedback helpers to more seller, buyer, bank, and Control Tower buttons.
5. Extend route policy hints beyond the driver route.
6. Expand copy gate with Russian overclaim variants.
7. Keep `apps/landing` untouched for platform work.
