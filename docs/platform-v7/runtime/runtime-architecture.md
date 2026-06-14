# Runtime Architecture — platform-v7 / «Прозрачная Цена»

Master-ТЗ 3+ §8 supporting doc. Описывает фактическую архитектуру внутреннего
execution-runtime (как реализовано в коде), статус — `pre-integration / controlled-pilot`.

## Слои

```
UI (app/platform-v7/**, components/platform-v7/**, components/v7r/**)
        │  читает view-model, не бизнес-логику
Runtime view-models (lib/platform-v7/runtime/*-cockpit-state.ts, entry-cockpit-state.ts)
        │  sourceMeta.runtimeBound:true
Application services (lib/platform-v7/runtime/application-service.ts, execution-action-core.ts)
        │  действия проходят guard → audit → persistence
Domain (lib/domain/**, lib/platform-v7/deal-state-model.ts, execution-state-machine.ts)
        │  state machine + инварианты
Persistence ports (runtime/persistence-ports.ts, persistence-contracts.ts, repository-contracts.ts)
        │  mock provider сейчас, DB-ready позже
Adapters (integrations/**, *-adapter-emulator.ts) → внешний контур (mock, live placeholder)
```

## Ключевые принципы (как в коде)

1. **Server-side источник истины.** Состояние сделки — `execution-state-machine.ts` /
   `deal-state-model.ts`; UI берёт из runtime view-model, не вычисляет сам.
2. **Действие = guard → audit → persist.** `execution-action-core.ts`,
   `server-action-contract-wrapper.ts`, `server-audit-boundary.ts`,
   `server-idempotency-boundary.ts`.
3. **RBAC server-side.** `security-rbac.ts`, `rbac-route-guard.ts`, `role-lens.ts`,
   `anti-leak-filter.ts`, `ScopedShellGuard`. Доступ по URL не обходит права.
4. **Деньги не движутся без основания и банковского события** — см. money-runtime.md.
5. **Идемпотентность и восстановление** — `idempotency-key-helper.ts`,
   `persistence-snapshot.ts`, `audit-trail.ts`.
6. **Честная зрелость.** Внешние подтверждения — pending; mock providers внутри.

## Объекты хранения (§15)

Deal, Lot, Batch/Party, Participant, Role, Trip, Vehicle, Driver, Elevator, LabResult,
Document, MoneyEvent, Dispute, Evidence, AuditEvent, ComplianceCheck, RiskSignal,
IntegrationEvent, Notification, ActionReceipt — контракты в `persistence-contracts.ts`,
`repository-contracts.ts`, адаптер `runtime/mock-persistence-adapter.ts`.

## State machine (§16)

`execution-state-machine.ts` + `state-transition-contracts.ts`: переходы Draft → … →
AcceptedClean/AcceptedWithDelta → MoneyReleasePending → Closed (+ Disputed/Cancelled),
с allowed/denied transitions, blockers, responsible role, required documents/evidence,
money impact, audit на каждый переход. Запрещённые переходы покрыты тестами
(`platformV7StateTransitionContracts.test`).
