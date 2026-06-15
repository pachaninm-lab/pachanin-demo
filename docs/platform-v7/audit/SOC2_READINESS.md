# SOC2_READINESS — platform-v7

Дата: 2026-06-15. Зрелость: controlled-pilot. Это readiness-чеклист по common
criteria, не сертификация (нужен аудитор + живой стенд + период наблюдения).

## Security controls — статус

| Контроль (CC) | Статус | Где / GAP |
|---------------|--------|-----------|
| Access control (CC6.1) | PARTIAL | RBAC-движок есть (`access-control.ts`), но enforcement за флагом + актор из body (SEC-001/SEC-002) |
| Logical access / least privilege | EXISTS | 27 ролей, deny-by-default, explicit-deny для money у driver/lab/elevator |
| Denied-access logging (CC6.x) | EXISTS | `auditDeniedAccess()`, `PlatformV7DeniedAccessAuditEvent` |
| Audit logs (CC7.2) | EXISTS | `audit-trail.ts`, `audit-event-helper.ts`, append-only; экспорт по сделке |
| Change management (CC8.1) | PARTIAL | Git/PR + required CI gates; нет формального CR/approval/rollback-журнала в продукте |
| Incident logging (CC7.3) | EXISTS | `runtime/observability-cockpit-state.ts` (incident journal), logistics-incident-engine |
| Monitoring (CC7.1) | EXISTS | health-cockpit + pilot-metrics; нет SLA-дашборда uptime/latency |
| Evidence export (CC3/CC4) | EXISTS | `audit-evidence-export.ts`, `dispute-evidence-pack.ts`, `evidence-ledger.ts` (chain-of-custody) |
| Data retention | EXISTS | `evidence-retention.ts` (legal hold, expiry); нет TTL персональных данных |
| Vendor/dependency mgmt | PARTIAL | `dependency-review.yml` gate (fail-on critical); SCA-скан owner-side |

## EXISTS — детали

- **Audit trail (append-only):** `audit-event-helper.ts` — `userDeletable:false`,
  append-only флаг, эскалация severity для money-влияющих границ;
  `server-audit-boundary.ts` блокирует серверное действие без корректного
  audit-event. Поля: actor, role, action, before/after (hash для статусов),
  timestamp, correlationId, entity. См. `audit/AUDIT_REPORT.md` и Audit Trail
  раздел ниже.
- **Evidence / chain-of-custody:** `evidence-ledger.ts` — `hash`/`prevHash`,
  детект broken-chain/duplicate; `evidence-retention.ts` — legal hold.
- **Incident journal:** `observability-cockpit-state.ts` — инциденты
  (integration failure, dispute, transport block) с severity ok/warning/critical.

## Audit Trail — соответствие требованию (actor/role/object/action/before-after/denied/timestamp/export)

| Поле | Статус | Источник |
|------|--------|----------|
| actor | EXISTS | `actorId` во всех audit-моделях |
| role | EXISTS | `actorRole` |
| object | EXISTS | `entityId`/`entityType` |
| action | EXISTS | `action`/`boundaryId` |
| before/after | PARTIAL | hash для status_changed; полный контент-hash — GAP |
| denied action | EXISTS | `auditDeniedAccess()` |
| timestamp | EXISTS | `occurredAt`/`createdAt` |
| export by deal | EXISTS | `audit-evidence-export.ts` (фильтр по dealId) |
| immutable-style | EXISTS (логически) | append-only/userDeletable:false; **durable persistence — GAP** |

## Находки

### SOC2-001 — Нет durable audit sink
- **Severity:** MEDIUM. **Affected:** `runtime/db-persistence-adapter.ts`
  (порт `audit` есть, БД нет — in-memory). **Risk:** до реальной БД аудит не
  переживает рестарт. **Fix:** реализовать `P7PersistenceDriver` поверх БД
  (append-only таблица, WORM/retention). **Test:** интеграционный на сохранение/
  чтение аудита. **Status:** owner-side (реальная БД + миграции).

### SOC2-002 — Нет формального change-management журнала в продукте
- **Severity:** LOW-MEDIUM. **Risk:** для аудитора нужен трекинг CR/approvals/
  rollback. Смягчение: Git history + required CI (ci/tsc, web-unit, build,
  autopilot-guard, CodeQL) + PR-review. **Fix:** политика change-management
  (документ) + связка деплой↔коммит. **Status:** owner-side (process/doc).

### SOC2-003 — Нет полного before/after контент-хеша
- **Severity:** LOW. **Fix:** хешировать before/after снапшоты сущности в
  audit-event. **Test:** на наличие обоих хешей при мутации. **Status:** future-PR
  (in-scope `lib/platform-v7/**`).

### SOC2-004 — Нет SLA-дашборда (uptime/latency/error-rate)
- **Severity:** LOW. Смягчение: health/pilot-metrics есть. **Fix:** добавить
  SLA-метрики при подключении реального APM. **Status:** owner-side.

## До сертификации (owner-side)
Реальная БД с WORM-аудитом, IdP+MFA, enforced-RBAC серверно (SEC-001/002),
APM/SLA, формальные политики (change-mgmt, incident-response, vendor-mgmt),
период наблюдения и внешний аудитор.
