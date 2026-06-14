# Role & Bank Question Coverage Matrix

platform-v7 / «Прозрачная Цена» — Master-ТЗ 3+ §10.

Назначение: доказать, что платформа отвечает на вопросы банка (Россельхозбанк), банковских
разработчиков, комплаенса, юристов, инвестора, региона и всех ролей сделки.

Формат: вопрос → ответ платформы → где видно в UI → где в runtime → объект данных → тест → риск → статус.
Статусы: **closed** / partial / не закрыто. Матрица обновляется после каждого M3-этапа (§10 DoD).

> Правило: ТЗ нельзя считать закрытым, если по критическому вопросу стоит «не закрыто».

---

## A. Идентичность, роль, организация, доступ

| Вопрос | Ответ платформы | UI | Runtime | Объект | Тест | Риск | Статус |
|--------|-----------------|----|---------|--------|------|------|--------|
| Кто вошёл? | Сессия привязана к участнику и роли | shell header, `/login` | `auth`, `role-canonical.ts` | Participant/Session | `role-header.test` | подмена пользователя | closed |
| Какая роль? | Роль определяет кокпит и права | role hero, nav | `role-access.ts`, `roles.ts` | Role | `platformV7Roles.test` | эскалация прав | closed |
| К какой организации относится? | Участник связан с организацией (ИНН/ОГРН) | register/profile | `onboarding-documents.ts` | Participant.org | `platformV7OnboardingDocuments.test` | смешение организаций | closed |
| Что он видит / не видит? | Role lens фильтрует данные | каждый кокпит | `role-lens.ts`, `anti-leak-filter.ts` | RoleScope | `platformV7RoleLeakage.test` | утечка чужих данных | closed |
| Почему не видит чужое? | Server-side RBAC + scoped shell | — | `security-rbac.ts`, `rbac-route-guard.ts`, `ScopedShellGuard` | AccessDecision | `platformV7SecurityRbac.test` | обход по URL | closed |
| Что может / запрещено? | Матрица действий по роли | action-кнопки | `action-permission-boundary.ts`, `action-policy-roles` | ActionPolicy | `platformV7ActionPolicyRoles.test` | недопустимое действие | closed |
| Доступ по URL не обходит права? | Route-guard + server gate | redirect/403 | `rbac-route-guard.ts`, `deal-access-gate.ts` | RouteAccess | `platformV7RouteAccessBoundary.test` | прямой обход роута | closed |

## B. Сделка, блокеры, ответственный

| Вопрос | Ответ | UI | Runtime | Объект | Тест | Риск | Статус |
|--------|-------|----|---------|--------|------|------|--------|
| Где сделка / её состояние? | Server-side state machine | deal cockpit | `execution-state-machine.ts`, `deal-state-model.ts` | Deal.state | `platformV7StateTransitionContracts.test` | рассинхрон состояния | closed |
| Что заблокировано и почему? | Blocker с причиной и источником | Smart Blocker Cards | `execution-gate-helper.ts`, `*-gate.ts` | Blocker | `platformV7MoneyReadinessConsistency.test` | непрозрачная блокировка | closed |
| Кто ответственный / что дальше? | nextOwner + nextAction | cause-to-money line | `role-execution-cockpit.ts` | NextAction | `roleExecutionHandoff.test` | потеря ответственности | closed |
| Что будет после действия? | Action preview + receipt | After Action Receipt | `action-feedback.ts`, `feedback-runner.ts` | ActionReceipt | `platformV7ActionFeedbackPreviewCurrentMain.test` | неожиданный эффект | closed |

## C. Деньги и банк

| Вопрос | Ответ | UI | Runtime | Объект | Тест | Риск | Статус |
|--------|-------|----|---------|--------|------|------|--------|
| Почему деньги не движутся? | Release невозможен без условий (док/вес/качество/acceptance/спор) | Money Gate | `money-safety.ts`, `evidence-release-guard.ts` | ReleaseEligibility | `platformV7ReleaseGuard.test` | преждевременная выплата | closed |
| Что передаётся банку / где основание? | Основание выплаты собирается из закрытых условий | bank cockpit | `bank-basis.ts`, `bank-payment-basis-runtime-action.ts` | PaymentBasis | `platformV7BankBasis.test` | выплата без основания | closed |
| Как доказать, что платформа не выпускает деньги сама? | Release только по банковскому событию; ledger без авто-release | bank clean room | `bank-ledger.ts`, `direct-money-boundaries.ts` | MoneyEvent | `platformV7BankActionBoundary.test` | claim «платформа платит» | closed |
| Сверка с банком / дубли? | Reconciliation статусы + duplicate detection | reconciliation | `bank-reconciliation.ts` | Reconciliation | `bank-reconciliation` тесты | двойная выплата | closed |
| Как обрабатывается ручная проверка? | ManualReview статус + журнал | manual review | `bank-manual-review.ts` | ManualReview | `support-sla.test` | потеря ручной задачи | closed |

## D. Документы и внешние системы

| Вопрос | Ответ | UI | Runtime | Объект | Тест | Риск | Статус |
|--------|-------|----|---------|--------|------|------|--------|
| Какой документ нужен / lifecycle? | Документы имеют статусы и блокируют release | documents matrix | `document-matrix.ts` | Document | `document-matrix-completeness.test` | неполный комплект | closed |
| Что требует ФГИС/СДИЗ? | СДИЗ — blocker-логика | blocker card | `fgis-runtime-action.ts`, `sdiz-lifecycle` | SdizCheck | `sdiz-lifecycle.test` | партия без СДИЗ | closed |
| Что требует ЭДО/ЭПД? | Подпись/транспортный документ — blocker | doc/transport gate | `epd-adapter-emulator.ts`, `logistics-transport-documents-gate.ts` | Edo/EpdStatus | `epd-package.test` | рейс без основания | closed |
| Как обрабатывается timeout/отказ внешней системы? | Retry/idempotency/manual fallback; сделка не ломается | integration journal | `external-adapters.ts`, `idempotency-key-helper.ts` | IntegrationEvent | `platformV7RuntimeIntegration.test` | каскадный сбой | closed |
| Как восстановить событие после сбоя? | Audit trail + persistence snapshot | — | `audit-trail.ts`, `persistence-snapshot.ts` | AuditEvent | `platformV7ServerAuditBoundary.test` | потеря события | closed |

## E. Доказательства, спор, неизменность

| Вопрос | Ответ | UI | Runtime | Объект | Тест | Риск | Статус |
|--------|-------|----|---------|--------|------|------|--------|
| Где доказательство / журнал? | Evidence pack + audit, exportable | evidence/journal | `evidence-pack.ts`, `audit-evidence-export.ts` | EvidenceItem | `platformV7EvidencePackDisputeGating.spec` | спор «на словах» | closed |
| Как доказать, что участник не подменил документ? | Fingerprint/hash + immutable evidence | — | `document-fingerprinting.ts`, `evidence-ledger.ts` | Evidence.hash | `platformV7RiskDocumentSecurityLayer.test` | подмена документа | closed |
| Как доказать, что водитель не видит деньги? | Field scope скрывает деньги/банк | driver/field | `visible-field-filter`, `driver-cockpit-state.ts` | RoleScope | `driverFieldShellPolish.test` | утечка денег водителю | closed |
| Как доказать, что лаборатория не меняет сумму? | Lab scope без денежного блока | lab cockpit | `quality-model.ts`, role lens | RoleScope | `labQualityPolish.test` | подмена суммы | closed |
| Как доказать, что банк не редактирует сделку/качество? | Bank action boundary | bank cockpit | `bank-release-decision.ts`, action boundary | ActionPolicy | `actionTargetLabelsBankBoundary.test` | банк меняет сделку | closed |
| Спор основан на evidence, а не на звонках? | Dispute требует evidence pack | dispute | `dispute-engine.ts`, `dispute-evidence-pack.ts` | Dispute | `platformV7DisputeEngine.test` | произвол в споре | closed |

## F. Fraud / Compliance

| Вопрос | Ответ | UI | Runtime | Объект | Тест | Риск | Статус |
|--------|-------|----|---------|--------|------|------|--------|
| Как исключается обход (bypass)? | Anti-bypass сигналы + manual review | bypass risk | `anti-bypass.ts`, `bypass-risk-score.ts` | RiskSignal | `platformV7AntiBypass.test` | обход платформы | closed |
| Как закрывается дубль сделки/платежа? | Fingerprint + idempotency + reconciliation | — | `deal-fingerprint.ts`, `idempotency-key-helper.ts` | IdempotencyKey | `platformV7ServerIdempotencyBoundary.test` | двойная операция | closed |
| Compliance может блокировать сделку? | KYC/AML статусы → blocker | compliance | `onboarding-kyc.ts`, `bank-compliance-pilot.ts` | ComplianceCheck | `bank-compliance-115-pdn.test` | сделка без проверки | closed |

---

## Открытые пункты (partial — план M3)

- **Question Matrix наполнение** до полного списка ролей §10 — M3-2.
- **Product Entry visual** (register/login premium + статусы заявки) — M3-1.
- **Observability health-экраны** — M3-4.
- **BI binding к runtime** — M3-5.
- **Единый M3 e2e** (7 сценариев §38) — M3-6.

Критических вопросов со статусом «не закрыто» — нет. Открытые пункты — доводка и live-only (§43).
