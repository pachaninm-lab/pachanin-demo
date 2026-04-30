# P0-04 Agent Workpack — Role Dashboards + Continuity

Status: active stacked PR
Branch: `codex/p0-04-role-dashboards-continuity`
Base: `codex/p0-02-p0-03-domain-action-core`

## Scope

Build a role-specific continuity layer across `platform-v7` without claiming live integrations.

Core chain:

`role screen -> deal -> next allowed action -> disabled reason -> evidence -> audit -> timeline -> money impact`

## Agent 1 — Domain Continuity Agent

Objective: ensure every role screen is connected to the same execution domain model.

Acceptance criteria:

- `RoleContinuityPanel` uses `execution-simulation` domain-core.
- Buyer, seller, bank, logistics, driver, lab have role-specific continuity content.
- Each role shows one selected deal, owner, status, amount, money blocker state.
- No production-money or live-integration claims.
- No duplicate domain fixture layer.

Current status:

- Done: shared panel exists.
- Done: driver/lab pages are wired.
- Done: buyer/seller/bank/logistics layouts are wired.
- Next: add role-specific allowed action handoff.

## Agent 2 — Action Handoff Agent

Objective: each role must see the next allowed action and why it is blocked when unavailable.

Acceptance criteria:

- For each role, show action label, target action type, owner role, and disabled reason.
- Use domain-core action/guard language where possible.
- Do not fire live integration actions.
- Do not mutate state in passive role dashboards until action dispatch is explicitly wired.
- Buyer/seller/bank/logistics/driver/lab semantics differ.

Target role handoffs:

- buyer: request reserve / open dispute / check documents.
- seller: create lot / publish lot / close blocker.
- bank: confirm reserve / release request readiness.
- logistics: assign driver / confirm route step.
- driver: confirm arrival / capture evidence.
- lab: create lab protocol / move to acceptance.

## Agent 3 — Evidence Chain Agent

Objective: every role dashboard must show evidence context in a way that can support disputes.

Acceptance criteria:

- Evidence block visible on all six role continuity panels.
- Evidence types are readable and role-relevant.
- Dispute-related deals show a stronger money/blocker signal.
- Empty states must be explicit and not look like a bug.

## Agent 4 — UX / Operator Clarity Agent

Objective: reduce role dashboard ambiguity.

Acceptance criteria:

- First screen answers: what deal, what status, who owns next step, what action, what evidence, what money impact.
- No mixed English/Russian except technical identifiers and entity names.
- Use controlled pilot / sandbox wording only.
- Mobile-friendly grid with no horizontal overflow.

## Agent 5 — QA / Release Agent

Objective: keep every step build-safe.

Acceptance criteria:

- Unit tests cover all six roles.
- CI build must pass after every wiring pass.
- PR body must show current progress and known limits.
- No merge until P0-02/P0-03 base PR is ready/merged or stacked merge order is resolved.

## Current progress

Overall platform backlog: 17% done / 83% left.
P0-04: 38% done / 62% left.

## Next execution order

1. Add role-specific action handoff block inside `RoleContinuityPanel`.
2. Extend tests to assert action labels for buyer/seller/bank/logistics/driver/lab.
3. Run CI build.
4. Update PR #376 description.
