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
| EV-030 | Wave 2 срез 1 (signing authority): 38 тестов, полный API-пакет 1352 passed / 0 failed | `npx jest` | 2026-08-15 |
| EV-031 | Drift-гейт после обеих миграций PC-CROP: exit 0, «empty migration» | `prisma migrate diff --exit-code` на локальном PostgreSQL 16 | 2026-08-15 |
| EV-032 | 9 инвариантов signing authority отбиты живой БД: делегирование без/с пустой МЧД, пустой список типов документов, неизвестный режим подписи, перевёрнутое окно, отрицательный лимит, неизвестный тип authority, cross-tenant организация, дубль активной authority на тот же сертификат | psql, PostgreSQL 16 | 2026-08-15 |
| EV-033 | `signing_authorities`: RLS enabled + forced, 0 policy — отказ всем непривилегированным принципалам | `pg_class` / `pg_policies` | 2026-08-15 |
| EV-034 | Конвенция денег: `domain-core/money.ts` запрещает арифметику на `number`, все money-колонки схемы — BIGINT; полиси переведён на `bigint` до фиксации расхождения | чтение `money.ts` + `schema.prisma` | 2026-08-15 |
| EV-035 | Forward-only гейт проходит с обеими миграциями PC-CROP в списке | `platform-v7-forward-only-migration-check.mjs` | 2026-08-15 |
| EV-036 | Изоляция бухгалтерского контура: 9 проверок в RLS-гейте — свой ряд, подделка организации, подделка тенанта, двухорганизационный пользователь в обе стороны, получатель делегирования, отсутствие контекста, отказ на запись, отказ на удержанную колонку | `scripts/sql/pc-crop-accounting-rls-checks.sql` | 2026-08-15 |
| EV-037 | Проверка доказанно **способна упасть**: policy, доверяющая только `app.current_org_id` → 3 FAIL; выданный UPDATE → 1 FAIL; обе диверсии дают ненулевой код | преднамеренная диверсия на локальной БД | 2026-08-15 |
| EV-038 | Зависимость резолвера от гранта `pc_identity_bootstrap → user_orgs` измерена: при отзыве функция падает «permission denied», то есть fail-closed; грант сделан явным в миграции | `REVOKE` + повторный прогон | 2026-08-15 |
| EV-039 | Правило двух лиц в БД: ACTIVE-authority без одобрившего, одобривший = получатель, одобривший = выдавший, выдуманный id — все четыре отбиты | psql, PostgreSQL 16 | 2026-08-15 |
| EV-040 | Отозванная authority может не иметь одобрившего — история остаётся записываемой | там же | 2026-08-15 |
| EV-041 | Эскалация через цепочку делегирований отбита: делегат не может передать больше полученного | 40 тестов command-policy | 2026-08-15 |
| EV-042 | Самоодобрение ключуется по пользователю, а не по членству: человек с двумя членствами не одобрит себе выдачу сменой шляпы | там же | 2026-08-15 |

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
