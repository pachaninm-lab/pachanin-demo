# platform-v7 runtime domain split — 2026-06-23

This file turns #1982 into separate non-UI PR domains. None of these domains should be hidden inside role-cabinet UI PRs.

## Domain split

| Domain | Purpose | First safe PR | Explicit non-goals |
| --- | --- | --- | --- |
| data | persistent deal state model | docs-only entity and ownership contract | no migrations, no DB credentials, no production data |
| runtime | deal state machine and action journal | docs-only state/action contract | no live mutations, no server action wiring |
| access | server-side roles and organization isolation | docs-only access matrix | no auth/session implementation inside UI PR |
| money | ledger and reconciliation basis | docs-only ledger event taxonomy | no real bank transfer, no balance claim |
| documents | evidence chain and document workflow | docs-only evidence lifecycle | no EDO/live provider integration |
| integrations | adapter readiness for bank/EDO/FGIS/EPD/GPS/elevator/lab | docs-only adapter mode matrix | no live API keys, no callbacks |
| load | high-volume readiness | docs-only load model and target scenarios | no synthetic production claim |
| ops | monitoring, logs, alerts, rollback | docs-only runbook skeleton | no production monitoring claim |
| QA | regression gate | docs-only acceptance matrix | no broad automated rewrite |

## Readiness truth gate

Do not mark platform-v7 as live-ready until all of these exist in real implementation and are verified:

1. persistent database-backed deal state;
2. server-side role and organization isolation;
3. auditable deal state machine and action journal;
4. document/evidence workflow;
5. money ledger and reconciliation basis;
6. logistics/quality/acceptance lifecycle;
7. external adapter modes;
8. load testing;
9. monitoring, logs, alerts, rollback;
10. operational ownership and incident handling.

Until then, the correct status is controlled-pilot / pre-integration.
