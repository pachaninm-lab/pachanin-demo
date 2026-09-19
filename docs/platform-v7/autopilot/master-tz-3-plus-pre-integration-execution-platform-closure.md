# MASTER-ТЗ 3+ — Pre-Integration Execution Platform Closure

platform-v7 / «Прозрачная Цена»

Статус документа: **source-of-truth закрытия внутреннего execution-контура.**
Зрелость (честно): `pre-integration execution platform · controlled-pilot · adapter-ready · external confirmation pending`.

> Этот документ — docs-only фиксация Master-ТЗ 3+ (§44.3) и gap-аудит (§44.2).
> Продуктовый runtime этим документом не меняется. Реализация идёт отдельными узкими PR (M3-x).

---

## 1. Главный вопрос ТЗ

Платформа внутри уже работает как execution runtime или только показывает интерфейс исполнения?

**Ответ по факту кода (gap-аудит ниже):** внутренний контур сделки в основном уже реализован
в предыдущих этапах (Stage 1–20, VP-1…VP-8). Master-ТЗ 3+ — это **закрытие, аудит и консолидация**,
а не стройка с нуля. Остаток сводится к внешним live-интеграциям, договорам и реальным сделкам (§43).

---

## 2. Честный статус (§3)

Разрешено: `pre-integration`, `controlled-pilot`, `adapter-ready`, `production-like simulation`,
`external confirmation pending`, `bank review pending`, `pending live credentials`, `mock provider`,
«основание подготовлено», «к передаче во внешний контур», «требуется подтверждение внешней системы».

Запрещено (и не используется в UI): `production-ready`, `fully live`, `fully integrated`,
`bank connected`, `FGIS connected`, `EDO connected`, `платформа гарантирует оплату`,
«платформа сама выпускает деньги».

UI-гигиена (§4): в пользовательском UI не должно быть слов `демо / пилот / mock / sandbox / test mode /
тестовый режим / черновик / экспериментальный экран`. Проверяется copy-гардами
(`platformV7CopyGuard`, `platformV7RuntimeCopyGuard`, `platformV7ExecutionSurfaceCopyGuard`,
`driverFieldShellPolish`, `surveyorEvidencePolish`, `labQualityPolish`, `elevatorExecutionPolish`).

---

## 3. Gap-аудит: раздел ТЗ → реализация → статус

Легенда статуса: **closed** (есть runtime + UI + тесты), **partial** (есть основа, нужна доводка/binding),
**docs** (нужна документация), **live-only** (остаётся только внешняя live-интеграция).

| § | Раздел | Существующая реализация (apps/web/lib/platform-v7, app/platform-v7) | Статус |
|---|--------|--------------------------------------------------------------------|--------|
| 11 | Product Entry: стартовая, регистрация, вход | `app/platform-v7/page.tsx`, `/open`, `/register`, `/login`, `/auth`, `/onboarding`, `/roles`, `runtime/entry-cockpit-state.ts`, `runtime/open-walkthrough.ts`, `onboarding-access-gate.ts` | partial (есть роуты; нужна premium-доводка register/login + статусы заявки) |
| 12 | Личные кабинеты ролей | `role-execution-cockpit.ts`, `RoleExecutionCockpit`, кокпиты buyer/bank/control-tower/driver/lab/elevator/surveyor/executive + premium-дизайн-система | closed (12 ролей, server-side RBAC) |
| 13 | Visual Product Rebuild | `components/platform-v7/premium/*`, `styles/platform-v7-premium-cockpit.css`, Living Deal паттерны | partial (единый premium-язык внедрён; остаются точечные паттерны) |
| 14 | UX-gate (no long scroll / progressive disclosure) | `CollapsibleSection`, `platform-v7-mobile-excellence.css`, mobile e2e | partial (нужен сквозной UX-аудит каждой роли до конца страницы) |
| 15 | Durable Persistence | `persistence-contracts.ts`, `persistence-repository.ts`, `persistence-snapshot.ts`, `persistence-queue.ts`, `repository-contracts.ts`, `runtime/persistence-ports.ts`, `runtime/mock-persistence-adapter.ts` | closed (mock provider, ports, idempotency, audit-on-write) |
| 16 | Deal Runtime State Machine | `execution-state-machine.ts`, `execution-state-machine-bridge.ts`, `deal-state-model.ts`, `state-transition-contracts.ts`, `execution-state-spine.ts` | closed |
| 17 | Money Runtime | `bank-ledger.ts`, `money-tree.ts`, `money-safety.ts`, `money-safety-audit.ts`, `direct-money-boundaries.ts`, `deal-execution-source-of-truth.ts` | closed (pre-bank ledger, no double release) |
| 18 | Bank Reconciliation | `bank-reconciliation.ts`, `bank-webhooks.ts`, `bank-manual-review.ts` | closed (mock bank events, mismatch, manual review) |
| 19 | Adapter Contract Hardening | `external-adapters.ts`, `integrations/*`, `bank/edo/epd/fgis-adapter-emulator.ts`, `connector-model.ts`, `integration-readiness.ts` | closed (mock providers + live placeholders) |
| 20 | ФГИС/СДИЗ Blockers | `fgis-adapter-emulator.ts`, `fgis-lot-passport.ts`, `fgis-runtime-action.ts`, `sdiz-lifecycle` тесты | closed |
| 21 | ЭДО/КЭП Document Runtime | `document-matrix.ts`, `document-money-decision-pack.ts`, `document-access-control.ts`, `document-fingerprinting.ts` | closed (lifecycle + blockers) |
| 22 | ЭПД/Transport Runtime | `epd-adapter-emulator.ts`, `logistics-transport-documents-gate.ts`, `trip-service-contract.ts`, `trip-state-model.ts` | closed |
| 23 | Elevator Runtime | `weighing-model.ts`, `logistics-receiving-gate.ts`, `FieldElevatorRuntime`, `WeighStationPanel` | closed (вес → server-side событие) |
| 24 | Laboratory Runtime | `quality-model.ts`, `quality-control-gate.ts`, `quality-discount.ts`, `quality-release-readiness.ts`, `FieldLabRuntime` | closed |
| 25 | GPS/Logistics Runtime | `logistics/*`, `logistics-chain.ts`, `trip-state-model.ts`, `driver-cockpit-state.ts` | partial (события рейса есть; geofence/deviation расширяемо) |
| 26 | Mobile Offline Runtime | `FieldDriverRuntime`, `OfflineSyncBanner`, offline queue в field runtimes | partial (баннер + очередь; нужен сквозной conflict/dup тест) |
| 27 | Evidence Runtime | `evidence-ledger.ts`, `evidence-model.ts`, `evidence-pack.ts`, `evidence-readiness-matrix.ts`, `evidence-retention.ts` | closed (immutable, linked, exportable) |
| 28 | Dispute Runtime | `dispute-engine.ts`, `dispute-model.ts`, `dispute-evidence-pack.ts`, `dispute-close-check.ts`, `server-dispute-gate.ts` | closed (money hold + decision) |
| 29 | Fraud / Anti-Bypass | `anti-bypass.ts`, `bypass-risk-score.ts`, `contact-vault.ts`, `deal-fingerprint.ts` | closed |
| 30 | KYC/AML/Compliance | `onboarding-kyc.ts`, `bank-compliance-pilot.ts`, `onboarding-compliance-queue.ts`, `onboarding-risk-score.ts` | closed (pre-bank, честно без «115-ФЗ live») |
| 31 | Server-Side Audit Trail | `audit-trail.ts`, `audit-events.ts`, `audit-event-helper.ts`, `audit-evidence-export.ts`, `server-audit-boundary.ts` | closed |
| 32 | Observability / Monitoring | `observability-contracts.ts`, `execution-observability-helper.ts` | partial (контракты есть; экраны health расширяемы) |
| 33 | SLA / Recovery / Idempotency | `idempotency-key-helper.ts`, `server-idempotency-boundary.ts`, `persistence-queue.ts`, `runtime-check-helper.ts` | closed |
| 34 | ERP / 1C Export | `audit-evidence-export.ts`, `case-pack.ts` | partial (экспорт пакета есть; CSV/XLSX матрица расширяема) |
| 35 | BI / Unit Economics | `investor-metrics.ts`, `investor-dashboard.ts`, `investor-roadmap.ts` | partial (метрики есть; привязка к runtime-событиям расширяема) |
| 36 | Rating / Reliability | `rating-model.ts`, `reliability-rating.ts`, `reputation.ts` | closed |
| 37 | AI Execution Layer | `ai/*`, `decision-recommendation.ts`, `QuietIntelligenceHint` | partial (role-scoped advice; mock provider) |
| 38 | Runtime Binding QA | сквозные сценарии в `tests/unit` + `tests/e2e` | partial (сценарии есть; нужен единый M3 e2e-набор) |
| 39 | Mobile/Field QA | `tests/e2e/platform-v7-mobile-*`, mobile-excellence css | partial |
| 40 | Netlify/Live Route QA | `platform-v7-dual-hosting-smoke.yml` (Netlify hard-gate) | partial (хост-baseline сменился — см. §QA) |

**Вывод аудита:** критические runtime-слои (persistence, state machine, money, reconciliation, documents,
evidence, dispute, audit, fraud, compliance, idempotency, rating) — **closed**. Остаток —
доводка (entry visual, UX-gate сквозной, observability-экраны, BI-binding, единый M3 e2e) и **live-only** (§43).

---

## 4. Очередь M3 (узкие PR, §44.6)

- **M3-0** — docs-only фиксация Master-ТЗ 3+ + gap-аудит + матрица вопросов (этот PR).
- **M3-1** — Product Entry visual+binding: premium `/register`, `/login`, статусы заявки (§11).
- **M3-2** — Question Coverage Matrix наполнение по критическим вопросам (§10).
- **M3-3** — UX-gate сквозной аудит ролей (no long scroll до конца страницы, §14).
- **M3-4** — Observability health-экраны (System/Integration/Deal/Money health, §32).
- **M3-5** — BI binding к runtime-событиям + pilot report export (§35).
- **M3-6** — Единый M3 runtime-binding e2e (7 сценариев §38) + mobile/field QA (§39).
- **M3-7** — supporting runtime docs (§8) синхронно с кодом, final readiness review (§41).

После каждого PR обновляется SOT и проверяется Netlify (§44.8–9).

---

## 5. Netlify baseline (§9, §40)

Актуальный host (по ТЗ): `https://vermillion-kitsune-0e7b97.netlify.app`.
Резервный smoke-gate в репозитории проверяет Netlify как жёсткий гейт; хост в smoke-workflow
обновляется отдельным hosting-PR при смене URL владельцем.

Ключевые маршруты QA: `/platform-v7/`, `/control-tower`, `/buyer`, `/bank`, `/driver/field`,
`/register`, `/login`.

---

## 6. Что останется после Master-ТЗ 3+ (§43)

Только внешнее: договоры, API-доступы, sandbox/live credentials, live-подключения
банка/ФГИС/ЭДО/ЭПД/элеватора/лаборатории/GPS, юридическая проверка, security review банка,
реальные controlled/live pilot-сделки и фактическая экономика на данных пилота.
