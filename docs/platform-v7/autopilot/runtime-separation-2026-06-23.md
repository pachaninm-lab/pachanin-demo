# platform-v7 runtime separation marker

Linked issues: #1982 #1984

UI polish cannot be counted as runtime readiness.

## Separate PR tracks required

- Data: persistent database-backed deal state.
- Access: server-side roles and organization isolation.
- Runtime: deal state machine and action journal.
- Documents: evidence chain and document workflow.
- Money: ledger and reconciliation basis.
- Integrations: bank, EDO, FGIS, EPD, GPS, elevator and lab adapter modes.
- Load: many concurrent users and degradation behavior.
- Ops: monitoring, logs, alerts, rollback and backup.

## Gate

None of these tracks should be hidden inside role-cabinet UI PRs.