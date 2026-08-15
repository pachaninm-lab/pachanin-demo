# Evidence Index — PC-CROP Federal Accounting

Правило §H/§77: интерфейс, PR, merge и деплой не являются доказательством.
Здесь фиксируются только проверяемые наблюдения с указанием источника.

Секреты в этот файл не попадают (§G).

---

| ID | Наблюдение | Источник | Дата |
|---|---|---|---|
| EV-001 | Контракт идентифицирован: SHA-256 `b3e892ea…8125d4`, 104 981 байт, 3877 строк, 84 раздела | `sha256sum` загруженного файла | 2026-08-15 |
| EV-002 | Live main при старте `ba847b28c3756b83abd5a424cfeb9af48649fd89` | `git rev-parse origin/main` | 2026-08-15 |
| EV-003 | Live main после аудита `9b07e3190ab48476cba46082a99c01d5fba1bedc` — drift подтверждён | `git fetch origin main` | 2026-08-15 |
| EV-004 | `ACCOUNTING` = банковская роль | `apps/api/src/modules/auth/registration-application.service.ts:34` | 2026-08-15 |
| EV-005 | `ACCOUNTING` управляет движением денег | `apps/api/src/modules/deals/deal-command.policy.ts:45,56` | 2026-08-15 |
| EV-006 | 9 рыночных ролей | `apps/api/src/modules/auth/organization-role-policy.ts` | 2026-08-15 |
| EV-007 | `job_profile`/`capabilities`/`delegations` отсутствуют | `apps/api/prisma/schema.prisma`, модель `UserOrg` | 2026-08-15 |
| EV-008 | RLS FORCE в 42 файлах | `grep -rl "FORCE ROW LEVEL SECURITY" infra/sql apps/api/prisma/migrations` | 2026-08-15 |
| EV-009 | 155 миграций Prisma | `ls apps/api/prisma/migrations` | 2026-08-15 |
| EV-010 | 68 моделей/enum в схеме; `fraud_*`, `work_tasks`, `accounting_*`, `contract_versions`, `integration_connections` отсутствуют | `grep -E "^model \|^enum " schema.prisma` | 2026-08-15 |
| EV-011 | ФГИС-контур: 11 моделей `FgisGrain*` | `schema.prisma` | 2026-08-15 |
| EV-012 | `/platform-v7/accounting` и `/platform-v7/settings/connections` отсутствуют | обход `apps/web/app/platform-v7/` | 2026-08-15 |
| EV-013 | Модуль `anti-fraud` присутствует | `ls apps/api/src/modules/` | 2026-08-15 |
| EV-014 | governance: `forbiddenZones` = `apps/web`, `packages`, lockfiles, production migration/credentials | `docs/platform-v7/autopilot/autopilot-state.json` | 2026-08-15 |
| EV-015 | `allowedCurrentScope` привязан к IR-10.4 Settlement PostgreSQL Authority | там же | 2026-08-15 |
| EV-016 | `lockedUntilCurrentGreen` включает IR-20, IR-21 | там же | 2026-08-15 |
| EV-017 | `noAutoMerge`, `noDirectPushToMain`, `controlledPilotOnly` | `docs/platform-v7/autopilot/progress.json` | 2026-08-15 |
| EV-018 | Роль Claude по governance — reviewer/architect/risk auditor | `AGENTS.md` | 2026-08-15 |
| EV-019 | Production недостижим: `connect_rejected`, 403 CONNECT, `xn--80affnb9admdi3d.xn--p1ai:443` | `$HTTPS_PROXY/__agentproxy/status` | 2026-08-15 |
| EV-020 | Последние 30 прогонов на main: 19 skipped, 11 in_progress, 0 success | GitHub Actions API | 2026-08-15 |
| EV-021 | 100+ открытых PR (обрыв списка на 100; старейший наблюдавшийся #2199) | GitHub API | 2026-08-15 |
| EV-022 | 243 workflow-файла | `ls .github/workflows` | 2026-08-15 |
| EV-023 | Диспетчер независимо подтверждает блокер: «IR-10.4 … is not green/closed/mergeable. Dispatcher will not advance» | `node scripts/p7-autopilot-dispatcher.mjs` | 2026-08-15 |
| EV-024 | Тот же скрипт удаляет `noSelfModifyingWorkflow` и `noDirectPushToMain` из `progress.json` и ослабляет codex-prompt (см. R-11); откачено, в коммит не попало | `git diff` после запуска dispatcher | 2026-08-15 |
| EV-025 | `check-production-hosting-authority.mjs` → PASS (exact-SHA release authority на REG.RU подтверждён как механизм) | запуск скрипта | 2026-08-15 |
| EV-026 | Wave 1 CI зелёный на `ed4acac`: 12 roles/RLS/DR restore, persistent sessions, PostgreSQL 16 RLS tenant isolation, API unit tests + TypeScript, Security Gate, CodeQL, migration gate, autopilot guard | GitHub check runs PR #4216 | 2026-08-15 |
| EV-027 | Единственное настоящее падение — дрейф `prisma migrate diff`; воспроизведён локально на PostgreSQL 16 до исправления | job 95053443095 + локальный прогон | 2026-08-15 |
| EV-028 | Три «красных» агрегирующих гейта — артефакты отмены вытесненного прогона: шаг `test "cancelled" = success` на старом SHA `f76138e6` | jobs 95054272429, 95054479144 | 2026-08-15 |
| EV-029 | Инварианты Wave 1 проверены на живой БД: 5 CHECK-ограничений, RLS enable+force с 0 policy, отказ на `documents.sign` в делегировании, self-делегирование, перевёрнутое окно, пустой набор, cross-tenant FK, подделанный `job_profile` | psql на локальном PostgreSQL 16 | 2026-08-15 |

---

## Отсутствующие доказательства (обязательны для 100% по §H)

| Требование §U/§83 | Статус |
|---|---|
| Exact-SHA production revision | НЕ ПОЛУЧЕНО (EV-019) |
| Seller journey end-to-end | НЕ ПОЛУЧЕНО |
| Buyer journey end-to-end | НЕ ПОЛУЧЕНО |
| Внешний бухгалтер, 0 утечек между организациями | НЕ ПОЛУЧЕНО |
| Backup restore proof | НЕ ПОЛУЧЕНО |
| Ransomware drill | НЕ ПОЛУЧЕНО |
| 1С / ЭДО / ФГИС / ЭПД внешние ID | НЕ ПОЛУЧЕНО (vendor credentials отсутствуют) |
