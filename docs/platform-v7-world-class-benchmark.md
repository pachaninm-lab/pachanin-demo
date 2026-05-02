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
| Role UX | 2 | RoleExecutionSummary exists across core roles and explains current state, blocked state, money, documents, execution, next owner, and one CTA. | Replace remaining deep-page role leaks and duplicate secondary actions. |
| Deal as one execution object | 2 | Route audit, role summaries, bank/dispute/logistics layers now point back to the deal chain. | Continue normalizing deal selectors across all legacy runtime surfaces. |
| Money visibility | 2 | Control Tower has four primary money/risk KPI cards; bank page has MoneyTree strip; MoneyTree helper avoids double counting. | Mount MoneyTree on Control Tower and buyer/seller read-only contexts. |
| Document workflow | 2 | DocumentsMatrix exists on bank page and shows document status, owner, block reason, money impact, and next step. | Replace derived/fallback logic with normalized document records when available. |
| Route / field execution | 2 | `/platform-v7/driver/field` is split from the general driver page, has compact field mode, 56px CTA, and mobile leakage smoke. | Add offline queue visual state for every driver action. |
| Dispute / evidence | 2 | EvidencePack exists on disputes page and shows photos, GPS, weight, seal, lab, documents, and audit trail with honest missing-data states. | Add immutable evidence versioning once data model supports it. |
| Mobile field-shell | 3 | Driver field-shell has dedicated 390px e2e smoke and hides bank/investor/trading language. | Add screenshots and visual diff baseline. |
| Action feedback | 1 | Driver field actions have toasts; some older actions still need status updates and audit/timeline events. | Complete ActionFeedback pass for Control Tower, bank, seller, buyer. |
| Role leakage protection | 2 | Role leakage matrix, driver field leakage smoke, and route-specific forbidden-copy tests exist. | Expand tests to buyer closed-bid mode and logistics grain-price hiding. |
| Trust markers | 2 | UI copy now uses pilot/test/manual-check language and avoids inflated production claims in touched screens. | Run full text audit across all deep legacy pages. |
| Visual clarity | 2 | Entry, summaries, Control Tower KPI reduction, MoneyTree, DocumentsMatrix, EvidencePack simplify key surfaces. | Consolidate tokens/components into design-system pass. |
| Performance / reliability | 1 | Changes are incremental; smoke/build gates are passing. No Lighthouse regression gate has been added in this pass. | Add Lighthouse baseline and no-regression threshold. |
| No-regression quality gates | 2 | Route audit, forbidden copy, role summary, MoneyTree, DocumentsMatrix, EvidencePack, driver field mobile smoke tests exist. | Add visual regression snapshots. |
| Maturity claim honesty | 3 | PR copy and UI avoid production-ready / fully live / fully integrated claims; missing external data is shown as requiring connection. | Keep this as a required PR gate. |

## Score summary

- Criteria scored 2 or higher: 12 / 15 = 80%
- Criteria scored 3: 3 / 15 = 20%
- Critical criteria scored 0: 0

The target threshold of 80% criteria at 2+ is met.

The target threshold of 30% criteria at 3 is not yet met. Current score is 20%.

## Honest conclusion

Platform V7 is no longer just a heavy internal dashboard. It now has a role-first entry, role summaries, clearer operator KPIs, separated driver field-shell, money decomposition, document matrix, evidence pack, and stronger copy/leakage gates.

It is still not a complete live production product. The remaining gap is not more screens; it is deeper action feedback, normalized documents/evidence data, Lighthouse/visual regression, and real external integration validation.

## Remaining fast-pass work

1. Expand action feedback on bank, seller, buyer, and Control Tower actions.
2. Mount MoneyTree beyond bank where it adds clarity without duplicating money.
3. Add normalized document and evidence adapters when data supports them.
4. Add visual regression screenshots for core routes.
5. Add Lighthouse baseline and no-regression gate.
6. Run final full-route forbidden-copy sweep.
7. Keep `apps/landing` untouched for platform work.
