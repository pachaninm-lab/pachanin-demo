# platform-v7 reality audit — 2026-06-23

Linked queue: #1974, #1984, #1981, #1982, #1978, #1979.

## Truth status

platform-v7 must remain described as controlled-pilot / pre-integration until the real runtime layers exist. UI cabinet improvements do not equal live high-volume deal readiness.

## Audit frame

This audit converts #1981 into narrow follow-up work and aligns the findings with #1982 without mixing UI, runtime, data, access, integration, load, money, document, ops, or QA scopes.

## Findings

| ID | Area | Risk | Priority | Layer | Finding | Follow-up PR scope |
| --- | --- | --- | --- | --- | --- | --- |
| RA-001 | Status truth | High | P0 | shared copy / docs | Any claim that implies live execution, persistence, bank confirmation, external callback, or production integration would be unsupported until #1982 runtime layers exist. | Small copy guard PR only if exact claim file is found. |
| RA-002 | Role first screen | High | P0 | role cabinet | Each role first screen must expose: what happened, what is blocked, money at risk, responsible party, next action. Seller remains first role pass per #1976. | One seller cabinet PR, exact seller files only. |
| RA-003 | Dead actions | Medium | P1 | role cabinet / route guard | Main CTAs must route to a real route/action/section or safe disabled state with a clear reason. | One role PR per cabinet; do not patch all roles together. |
| RA-004 | Role isolation | High | P0 | shared shell / route guard | No role-switch leakage or cross-role action surfacing should be introduced by cabinet fixes. | Separate shell/route PR only if exact shared file is identified. |
| RA-005 | Mobile shell | Medium | P1 | CSS / shell | Cabinet work must preserve header, bottom navigation where expected, and avoid horizontal overflow at 390x844. | QA checklist update or exact CSS PR only after a concrete broken file is identified. |
| RA-006 | Runtime readiness gap | High | P0 | runtime / data / access / ops | Current queue still needs persistence, server-side roles, state machine, documents/evidence, money ledger, integrations, load, monitoring, and operational controls. | Separate domain PRs from #1982; never hidden inside UI PRs. |

## Safe execution sequence

1. Run #1978 gate before any merge.
2. Continue #1976 seller cabinet pass in one narrow PR over exact seller cabinet files only.
3. After seller PR, run #1979 smoke checklist.
4. Repeat by role: buyer, bank, operator/executive, compliance, lab/elevator/field roles where exact files exist.
5. Convert #1982 readiness into separate PR families: data, runtime, access, money, documents, integrations, load, ops, QA.

## Merge gate checklist for follow-up PRs

- `apps/landing` diff is zero.
- No backend, DB, auth, session, API, package, or lockfile changes inside UI PRs.
- Scope matches exactly one issue/layer.
- Status remains controlled-pilot / pre-integration.
- CTAs have a real route/action/section or a safe disabled reason.
- Mobile shell and role isolation are preserved.
- Netlify preview is successful when relevant.

## Next small PR candidates

### PR A — seller first-screen functional pass

Type: UI.  
Issue: #1976.  
Allowed scope: exact seller cabinet files only.  
Goal: seller first screen answers what happened, what is blocked, money at risk, responsible party, and next action.

### PR B — copy truth guard

Type: docs / UI copy.  
Issue: #1981 / #1982.  
Allowed scope: exact copy files only after search identifies unsupported maturity claims.  
Goal: remove unsupported live-readiness language without changing runtime behavior.

### PR C — runtime data contract seed

Type: data / runtime docs.  
Issue: #1982.  
Allowed scope: docs/platform-v7 runtime/data contract only.  
Goal: specify persistent deal state, action journal, and evidence requirements before implementation.

## Decision

Proceed with seller cabinet pass next unless there is an already-open clean PR to merge or a red PR requiring a narrow allowed fix.
