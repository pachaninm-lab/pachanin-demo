# PC-CROP Federal Accounting — Gap Matrix (Wave 0 Truth Audit)

Источник целевого состояния: `CLAUDE_CODE_PC_CROP_AUTONOMOUS_EXECUTION_FINAL_2026-08-15`
(SHA-256 `b3e892eac9532129cea90d8cbfe4e1af048259ad190dd987fcdb058df38125d4`, 104 981 байт).

Исходное состояние: live `main` = `9b07e3190ab48476cba46082a99c01d5fba1bedc`.
Аудит выполнен чтением кода, а не документации. Каждый verdict привязан к файлу.

Maturity language по `autopilot-state.json`: **pre-integration / industrial-integration-ready-no-go**.
Ни один пункт ниже не является заявлением о подключённой внешней интеграции.

---

## 0. Как читать

| Verdict | Значение |
|---|---|
| `EXISTS` | Семантически эквивалентная реализация найдена в коде |
| `PARTIAL` | Есть основа, но контракт ТЗ не покрыт |
| `MISSING` | В коде отсутствует |
| `CONFLICT` | Существующая реализация противоречит буквальному тексту ТЗ |

Действие по разделу 5 ТЗ: если `EXISTS`/`PARTIAL` → **EXTEND**, не дублировать.

---

## 1. Identity / organization / job profiles / capabilities (вес 5%)

| Требование ТЗ | Что есть в live-коде | Verdict | Действие |
|---|---|---|---|
| Organization / Tenant | `Organization` c `tenantId`, `@@unique([id, tenantId])` — `apps/api/prisma/schema.prisma` | EXISTS | EXTEND |
| Membership | `UserOrg` (`role`, `status`, `isOrgAdmin`, `isDefault`, `version`) | EXISTS | EXTEND |
| MFA | `User.mfaEnabled/mfaSecret/mfaBackup`, модуль `apps/api/src/modules/mfa` | EXISTS | EXTEND |
| 9 рыночных ролей | `ORGANIZATION_HUMAN_ROLES` — `apps/api/src/modules/auth/organization-role-policy.ts` | EXISTS | **НЕ ТРОГАТЬ** (§T) |
| `job_profile` (11 значений §6) | — | MISSING | NEW |
| `membership_capabilities` (§7, ~45 capability) | — | MISSING | NEW |
| `membership_delegations` (§8) | — | MISSING | NEW |
| `signing_authorities` (§29) | `UkepCertificate` — сертификат, но без authority/МЧД/лимитов/типов документов | PARTIAL | EXTEND |

### CONFLICT-1 — `ACCOUNTING` уже занята банком

ТЗ §6: «Не переиспользовать существующую ACCOUNTING как бухгалтера хозяйства».

Live-код это подтверждает независимо:
`apps/api/src/modules/auth/registration-application.service.ts:34` → `bank: Role.ACCOUNTING`.
`apps/api/src/modules/settlement-engine/settlement-engine.controller.ts` выдаёт `ACCOUNTING`
права на `request_reserve` / `request_release` (движение денег).

Вывод: `ACCOUNTING` — это **роль банковского сотрудника в расчётном контуре**, а не бухгалтер
организации. Предложенный ТЗ путь совместимости (`user_orgs.role = GUEST` + `job_profile = ACCOUNTANT`)
корректен и не ломает `ROLE_CEILING`. Расширять надо `job_profile`, отдельной осью от `role`.

---

## 2. Security baseline / IAM / RLS (вес 8%)

| Требование | Live-код | Verdict |
|---|---|---|
| RLS FORCE | 42 файла с `FORCE ROW LEVEL SECURITY` (`infra/sql/*`, миграции) | EXISTS |
| Разделённые DB-принципалы | `infra/kind/production-like/postgresql-principals-bootstrap.sql`, PR #2287 | EXISTS |
| Audit | `AuditEvent`, модуль `apps/api/src/modules/audit` | EXISTS |
| Staff JIT / break-glass | `apps/api/src/modules/staff-access` | PARTIAL |
| `security_events` / `security_incidents` | Только `AuditEvent` | PARTIAL |
| `security_requirements_registry` (§32) | — | MISSING |
| Threat model (§33) | — | MISSING |
| Negative-тесты cross-tenant | `apps/api/test/tenant-leakage.e2e-spec.ts`, `scripts/sql/identity-rls-*.sql` | EXISTS |

Security baseline — самая сильная часть существующей платформы. Дублировать нельзя, только расширять.

---

## 3. Документы / договоры / regulatory (вес 7%)

| Требование | Live-код | Verdict |
|---|---|---|
| Server-authoritative документы | `DealDocument`, модуль `documents`, PR #2410 | PARTIAL |
| `accounting_documents` + версии + хеши (§15) | — | MISSING |
| `contract_versions` / `commercial_legal_terms` (§13) | — | MISSING |
| `DocumentFormatRegistry` (§15) | — | MISSING |
| `document_numbering_policies` (§16) | — | MISSING |
| `organization_accounting_profiles` (§17) | — | MISSING |
| `regulatory_rules` + версии (§17) | `CommodityProfileVersion` — версионирование есть как паттерн | PARTIAL |
| Correction workflow | `packages/domain-core/src/document-correction-workflow.ts` | PARTIAL |

---

## 4. Accounting task engine / UX (вес 6%)

| Требование | Live-код | Verdict |
|---|---|---|
| `/platform-v7/accounting` (§9) | Маршрут отсутствует (проверено обходом `apps/web/app/platform-v7/`) | MISSING |
| `work_tasks` (§9) | — | MISSING |
| `/deals/[id]/accounting` (§11) | — | MISSING |
| Task-first UX, KPI, вкладки | — | MISSING |

Ближайший существующий аналог — `operator-case-center.ts` и `action-decision-engine.ts` в `domain-core`:
паттерн «действие с причиной» уже есть, `WorkTask` должен наследовать его, а не изобретать заново.

---

## 5. Деньги: авансы / услуги / платежи / сверка (вес 6%)

| Требование | Live-код | Verdict |
|---|---|---|
| `payments` | `Payment`, `LedgerEntry`, `double-entry-ledger.ts` | EXISTS |
| Банковская сверка | `bank-reconciliation`, `ReconciliationRun`, `ReconciliationCursor`, `BankStatementEntry` | EXISTS |
| Идемпотентность callback | `WebhookIdempotency`, `BankKeyRevocation` | EXISTS |
| `payment_allocations` / `payment_evidence` (§20) | — | MISSING |
| `settlement_schedules` / `prepayments` (§18) | `settlement-engine` — расчёты есть, аванс как сущность нет | PARTIAL |
| `related_services` / `cost_allocations` (§19) | `service-providers`, `service-provider-registry.ts` | PARTIAL |
| `accounting_period_closes` / closure snapshot (§21) | — | MISSING |
| Money как integer/decimal (§65) | `packages/domain-core/src/money.ts` | EXISTS |

---

## 6. Connection Center + Integration Core (вес 4% + 6%)

| Требование | Live-код | Verdict |
|---|---|---|
| `/platform-v7/settings/connections` (§22) | Отсутствует; есть `connectors/` и `integrations/` | MISSING |
| Outbox | `OutboxEntry`, `OutboxRedriveEvent`, `workers/runtime-outbox-db`, PR #2378 | EXISTS |
| Inbox | `RegulatoryIntegrationInboxEntry` + `...Conflict` | PARTIAL |
| `integration_connections` / `credentials` / `jobs` / `mappings` / `dead_letters` (§55) | — | MISSING |
| `IntegrationEvent` | `IntegrationEvent` | PARTIAL |
| Идемпотентность/concurrency (§56) | `version` на `Deal`/`UserOrg`/`Organization`, advisory locks (PR #2404) | EXISTS |

**Открытый блокер платформы** (из `autopilot-state.json`, не мой вывод):
> «Inbound webhook idempotency is process-memory outside the accepted bank callback slice and no
> general durable integration inbox exists.»

То есть IR-21 Durable Integration Inbox — предусловие для Wave 5–8 ТЗ, и оно **заблокировано** до
закрытия IR-10.4.

---

## 7. 1С / ЭДО / Зерно / ЭПД (вес 8% + 7% + 4% + 4%)

| Требование | Live-код | Verdict |
|---|---|---|
| `ConnectorInstallation` / `OrganizationBinding` (§23) | — | MISSING |
| Connector API `/connector/v1/*` (§23) | — | MISSING |
| `OneCCompatibilityProfile` (§23) | — | MISSING |
| `EdoRoute` / `EdoProviderAdapter` (§25) | — | MISSING |
| Диадок / Saby адаптеры (§26) | — | MISSING |
| ФГИС «Зерно» | **Развитый контур**: `FgisGrainExchange`, `FgisGrainSdizProjection(+Batch)`, `FgisGrainProviderConfiguration/Attestation`, `FgisGrainTenantRead*` (authorization/claim/audit/auditHead) | EXISTS |
| `grain_sdiz_references` (§27) | `FgisGrainSdizProjection` покрывает большую часть полей | PARTIAL |
| Transport ЭПД (§28) | `logistics`, `railway`, `route-planner`, `Shipment`, `Geofence`, `ShipmentGpsPoint` | PARTIAL |
| `transport_epd_references` | — | MISSING |

ФГИС-контур — второй по зрелости после security. Здесь особенно важен запрет дублирования:
`GrainIntegrationAdapter` из §27 должен быть надстройкой над `FgisGrainExchange`, а не заменой.

---

## 8. ГЕКТА (вес 7%)

| Требование | Live-код | Verdict |
|---|---|---|
| Единое имя ГЕКТА | `apps/api/src/modules/gekta`, `apps/tai`, `GektaAccount/Conversation/Message/Project` | EXISTS |
| Изоляция личной `/gekta` | `GektaAccount`, `gekta_product_session_scope`, `gekta_registration_identity` миграции | EXISTS |
| Organization-scoped work context (§30) | Разговоры не привязаны к `organization_id` | MISSING |
| Read models (§30, 12 штук) | — | MISSING |
| Prompt-injection защита (§44) | Не найдено выделенного контура | MISSING |
| ГЕКТА без mutation authority | `GektaOperatorAudit`, `tai-tools` — есть аудит инструментов | PARTIAL |

Риск дублирования высокий: `apps/tai` и `modules/gekta` уже сосуществуют. §30 требует **одно**
человеко-видимое имя — это ограничение на UX, а не повод создавать третий слой.

---

## 9. Anti-Fraud (вес 6%)

| Требование | Live-код | Verdict |
|---|---|---|
| Модуль | `apps/api/src/modules/anti-fraud` **существует** | PARTIAL |
| `fraud_signals` / `cases` / `decisions` / `rules` + версии (§41) | Нет как persisted-сущностей в `schema.prisma` | MISSING |
| Смена реквизитов → step-up/hold (§41) | Не найдено | MISSING |
| Two-person rule (§41) | Не найдено | MISSING |
| KYC/AML/санкции | `KycTask`, `Organization.kycStatus/amlStatus/sanctionHit`, модули `kyc`, `compliance` | EXISTS |

---

## 10. Fleet / SOC / DR (вес 7%)

| Требование | Live-код | Verdict |
|---|---|---|
| Backup / restore / DR | PR #2291 «Forward-only backup, restore and isolated DR rehearsal» | PARTIAL |
| Наблюдаемость | `infra/prometheus`, `grafana`, `loki`, `tempo`, `otel`, `clickhouse` | EXISTS |
| Incident playbooks (§49) | `docs/runbooks` | PARTIAL |
| Ransomware drill (§50) | Не доказан | MISSING |
| Fleet dashboard (§54) | — | MISSING |

`autopilot-state.json` прямо фиксирует: «provider PITR/restore … are unproven».

---

## 11. Production deployment + E2E (вес 8%)

| Требование | Состояние |
|---|---|
| Exact-SHA release | Механизм есть: `scripts/production-full-stack-exact-sha.sh`, `CANONICAL_DEPLOY.md` |
| Проверка live production | **НЕВОЗМОЖНА из этой сессии** |

Сетевая политика окружения отдаёт `403` на `CONNECT` к `xn--80affnb9admdi3d.xn--p1ai:443`
(подтверждено `$HTTPS_PROXY/__agentproxy/status`, `kind: connect_rejected`).
Следовательно стадии «+10% exact-SHA deployment» и «+15% production acceptance» из матрицы §H
недостижимы в этом окружении **для любого** workstream.

---

## Сводка по весам §H

| # | Workstream | Вес | Готовность | Зачтено |
|---|---|---|---|---|
| 1 | Truth audit + gap matrix | 3% | артефакт на ветке, сверен с live | 1.8% |
| 2–17 | Все остальные | 97% | governance-locked (см. `governance-blocker.md`) | 0% |
| | **ИТОГО** | **100%** | | **1.8%** |

Округление вверх запрещено §H. PR не считается готовностью. Числа выше — не оценка «на глаз»,
а применение стадийной матрицы §H к доказанному состоянию.
