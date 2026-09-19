# platform-v7 next safe PR queue — from 2026-06-23 reality audit

This queue keeps #1981 aligned with #1982 and #1984. It is intentionally narrow. Do not combine these PRs.

## Current next action

Open a seller cabinet functional pass under #1976 after exact seller cabinet files are identified. The PR must only touch those files and must pass #1978 and #1979.

## PR queue

| Order | PR type | Issue | Scope | Forbidden in this PR | Acceptance |
| --- | --- | --- | --- | --- | --- |
| 1 | UI | #1976 | exact seller cabinet files | apps/landing, backend, DB, auth, session, API, package, lockfiles, other roles | Seller first screen states event, blocker, money at risk, responsible party, next action. CTAs route or are safely disabled. |
| 2 | QA | #1979 | seller smoke checklist result | product changes | Checklist result recorded after seller PR. |
| 3 | UI | #1981 | exact buyer cabinet files | same forbidden zones; no seller/bank/operator edits | Buyer first screen reaches the cabinet standard. |
| 4 | UI | #1981 | exact bank cabinet files | same forbidden zones; no buyer/seller edits | Bank first screen reaches the cabinet standard without money movement claims. |
| 5 | docs/runtime | #1982 | runtime state-machine contract docs only | UI/product code, backend implementation, API, DB migrations | Deal state machine, action journal, and guard boundaries specified. |
| 6 | docs/data | #1982 | persistent state model docs only | UI/product code, migrations, adapters | Deal, actor, organization, evidence, money, logistics, and acceptance entities specified. |
| 7 | docs/ops | #1982 | monitoring/rollback/runbook docs only | product code, secrets, live deploy changes | Logs, alerts, rollback, incident ownership, and live-readiness gates specified. |

## Standing merge gate

- One PR equals one layer.
- Keep platform-v7 status honest: controlled-pilot / pre-integration.
- Do not claim live readiness before persistence, server-side access, runtime actions, evidence workflow, money basis, integrations, load and ops exist.
- If a PR is red, fix only inside its allowed scope.
- If scope must broaden, close/split instead of patching through the gate.
