# Evidence & Dispute Runtime — platform-v7

Master-ТЗ 3+ §27–28 supporting doc.

## Evidence (§27)

`lib/platform-v7/evidence-ledger.ts`, `evidence-model.ts`, `evidence-pack.ts`,
`evidence-readiness-matrix.ts`, `evidence-retention.ts`, `evidence-release-guard.ts`.

EvidenceItem: type, source, actor, role, linked deal/trip/document/dispute, timestamp,
geotag, hash/checksum, immutable flag, access scope.

Типы: Photo, Geo, Time, Document, Weight, Quality, Trip, Comment, ExternalAdapter.

DoD: evidence нельзя незаметно изменить (hash + immutable, `document-fingerprinting.ts`);
evidence связано с объектом сделки; evidence pack экспортируется
(`audit-evidence-export.ts`, `case-pack.ts`). Тест: `platformV7EvidencePackDisputeGating.spec`.

## Dispute (§28)

`lib/platform-v7/dispute-engine.ts`, `dispute-model.ts`, `dispute-evidence-pack.ts`,
`dispute-close-check.ts`, server-gate `server-dispute-gate.ts`. UI: `app/platform-v7/disputes/**`.

Типы споров: вес, качество, документы, задержка рейса, простой, приёмка, оплата,
удержание, возврат, подмена партии.

Сценарий: Open → Classify → Attach evidence → Request missing → Assign arbitrator →
Freeze money → Decision → Financial consequence → Close → Reopen/appeal.

DoD: спор — runtime-объект; может блокировать деньги (money hold); решение меняет money
state; evidence автоматически связан со спором. Тесты: `platformV7DisputeEngine.test`,
`platformV7DealStateDisputeEvidence.test`, `evidenceDisputeContinuityPanel.test`.

## Связь evidence ↔ спор ↔ деньги

`dispute-engine.ts` ставит hold через `money-safety.ts`; решение арбитра
(`platformV7DisputeDecisionRoleBoundary.test`) переводит деньги в partial release / refund
через `bank-release-decision.ts`. Спор основан на evidence pack, а не на звонках.
