# Stage 5 Risk Register

Status: inventory risk register only. No Stage 5 runtime implementation starts in PR 5.0.

| Risk | Why It Matters | Mitigation For Stage 5 |
| --- | --- | --- |
| UI directly calls domain logic | Domain primitives can be used without RBAC, idempotency, audit or duplicate checks. | UI and server wrappers must call service methods that call `executePlatformV7MoneyAction`, `executePlatformV7DocumentAction` or `executePlatformV7BankBasisAction`. |
| Bypass of action-boundary | Direct calls to MoneyTree, Document Matrix or Bank Basis can mutate state without permission/idempotency order. | Add service tests and code review gates banning direct mutation calls outside boundary-owned services. |
| Fake persistence through module-level state | Module-level `Set`, `Map` or singleton arrays can pass local tests while losing correctness across requests, workers or reloads. | Define persistence ports and inject test adapters explicitly; forbid hidden in-memory stores in runtime modules. |
| Fake live bank, FGIS or EDO claims | User-facing language can imply external integrations are connected before they exist. | Keep pre-integration language, run forbidden-copy checks and keep adapter/provider wording out of user-facing UI unless real integration is verified. |
| Idempotency without persistence | Duplicate prevention is only reliable if keys, operation ids and bank event ids are persisted across requests. | Introduce an idempotency store interface before service/runtime PRs mutate persistent state. |
| Audit payload not persisted | Stage 4 returns audit payloads, but critical actions still need durable audit records. | Add an audit event sink interface and require append coverage for allowed, denied, blocked and duplicate outcomes. |
| Service layer becomes manual orchestration mess | A large service that hand-rolls every flow can become hard to review and easy to bypass. | Keep small services by boundary: money, document, bank basis, release workflow and dispute settlement. Use typed inputs and focused tests. |
| Platform claims production-ready without DB/API/live integrations | Overstating maturity creates legal, banking and operational risk. | Keep status as production-like internal logic, controlled-pilot / pre-integration until persistence, API runtime and live integrations are actually implemented and verified. |
| Bank confirmation and bank-basis send collapse into one step | Merging `sent_to_bank` with `bank_confirmed` would reintroduce fake-release risk. | Keep first-class functions and tests for sent basis, bank event confirmation, reject, refund, hold and manual review paths. |
| Arbitration decision moves money directly | Arbitrator should decide dispute outcome, not execute bank movement. | Keep arbitration decision as basis evidence only; bank officer confirmation must remain the money movement boundary. |
| Mock adapter leaks into business semantics | Later real adapters should replace mock adapters without changing domain behavior. | Use stable adapter contracts and keep mock/real knowledge outside UI and core business decisions. |
| Partial persistence causes split-brain money state | MoneyTree can diverge from bank-basis state if one write succeeds and another fails. | Stage 5 persistence ports should support transaction or explicit unit-of-work semantics before runtime write paths expand. |

## PR 5.1+ Review Gates

- No new UI action can call domain mutation primitives directly.
- No service can keep processed idempotency keys in module-level state.
- No critical action can return success without an audit event sink append.
- No bank movement can occur without bank event id, idempotency key and bank officer scope.
- No release confirmation can bypass MoneyTree release gate semantics.
- No document readiness shortcut can mark bank basis ready without required documents.
- No runtime copy can claim live integrations, automatic bank confirmation or platform-operated money release.
