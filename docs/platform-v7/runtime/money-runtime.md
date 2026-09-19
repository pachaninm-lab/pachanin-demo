# Money Runtime — platform-v7

Master-ТЗ 3+ §17–18 supporting doc. Внутренний денежный контур до live-банка.

## Сущности (как в коде)

| ТЗ-сущность | Реализация |
|-------------|------------|
| MoneyLedger | `lib/platform-v7/bank-ledger.ts`, `money-tree.ts` |
| ReserveIntent / ReservePendingBank | `deal-execution-source-of-truth.ts`, `bank-basis.ts` |
| HoldState / DisputeHold | `dispute-engine.ts`, `money-safety.ts` |
| ReleaseEligibility | `money-safety.ts`, `evidence-release-guard.ts`, `quality-release-readiness.ts` |
| PartialRelease / RefundIntent | `bank-release-decision.ts` |
| CommissionCalculation | `price-calculators.ts`, `quality-discount.ts` |
| MoneyBlocker | `*-gate.ts`, `money-safety-audit.ts` |
| MoneyActionReceipt | `action-feedback.ts`, `audit-events.ts` |

## Инварианты (проверяются тестами)

1. **Без банка деньги не зарезервированы реально** — статус резерва ждёт банковского события
   (`bank-webhooks.ts` mock), `platformV7MoneyReserveRequestRuntime.test`.
2. **Release невозможен без условий** — документы + вес + качество + acceptance + отсутствие
   спора; `evidence-release-guard.ts`, `platformV7ReleaseGuard.test`.
3. **Спор → money hold** — `server-dispute-gate.ts`, `platformV7DisputeEngine.test`.
4. **No double release / refund** — `idempotency-key-helper.ts`,
   `server-money-operation-guard.ts`, `platformV7ServerActionRouteMoneyKey.test`.
5. **Платформа не выпускает деньги сама** — release только по банковскому событию;
   `direct-money-boundaries.ts`, `platformV7BankActionBoundary.test`.

## Reconciliation (§18)

`bank-reconciliation.ts`: статусы Expected / BankPending / BankConfirmed / Matched /
AmountMismatch / CounterpartyMismatch / DuplicateSuspected / MissingBankEvent /
MissingPlatformEvent / ManualReview / Resolved. Поля сверки: dealId, paymentId,
counterpartyId, amount, currency, status, date, purpose, bank reference, ledger status.
Mock bank event проходит сверку; расхождение и дубль выявляются; есть manual review и audit.

## Что видит банк (DoD §17)

Что платформа просит сделать с деньгами, на каком основании, какие blockers,
что нужно подтвердить, какой журнал событий сформирован — кокпит `app/platform-v7/bank/**`,
`bank-operations-dashboard.ts`, `bank-payment-basis-runtime-action.ts`.
