# Continuation Handoff — PC-CROP Federal Accounting

Назначение (§G контракта): позволить продолжить работу **без повторного анализа**.
Читать этот файл первым, затем `execution-state.json`, затем `gap-matrix.md`.

---

## 1. Где остановились и почему

Выполнен Wave 0 (Truth Audit). Waves 1–12 не начаты.
Причина — не исчерпание работы, а `GOV-1..GOV-5` в `governance-blocker.md`:
committed governance репозитория не даёт агенту writable-зоны ни для одного wave,
а §C самого контракта ставит governance выше контракта.

Засчитано по §H: **1.8%** из 100%.

## 2. Что НЕ надо переделывать

Эти факты установлены чтением live-кода и перепроверять их не требуется:

1. `UserOrg` — это membership; `job_profile`/`capabilities`/`delegations` отсутствуют.
2. `ACCOUNTING` — банковская роль (`registration-application.service.ts:34`), не бухгалтер.
   9 рыночных ролей в `organization-role-policy.ts` трогать нельзя.
3. RLS FORCE присутствует в 42 файлах; tenant-leakage e2e существует.
4. Durable outbox есть (`OutboxEntry`, `workers/runtime-outbox-db`, PR #2378).
   Durable **inbox** общего назначения — нет (IR-21, заблокирован).
5. ФГИС-контур зрелый: 11 моделей `FgisGrain*`. Дублировать нельзя.
6. `/platform-v7/accounting` и `/platform-v7/settings/connections` не существуют.
7. Модуль `anti-fraud` существует, но `fraud_*` сущностей в схеме нет.
8. Production недостижим из окружения с сетевой политикой, отклоняющей CONNECT к домену.

## 3. Первый шаг после разблокировки

Wave 1, вертикальный срез по §K (expand → dual-compatible → migrate → verify → contract):

1. `job_profile` как **отдельная ось** от `user_orgs.role`, nullable, дефолт отсутствует.
2. `membership_capabilities` — резолвер capability из (`role`, `job_profile`, delegations).
3. Юнит-тесты резолвера: матрица 11 job_profile × ~45 capability, включая negative-кейсы.
4. Regression #3785 (9 ролей) и прогон tenant-leakage до открытия PR.
5. Только затем — миграция и API.

Точка входа для чтения: `apps/api/src/modules/auth/organization-role-policy.ts`.

## 4. Обязательные проверки перед любым PR

По `AGENTS.md`:

```
node scripts/p7-autopilot-dispatcher.mjs
bash scripts/p7-autopilot-guard.sh
node scripts/check-production-hosting-authority.mjs
pnpm typecheck
pnpm test
```

Плюс §F: `git fetch origin main` и сверка базы непосредственно перед PR —
main сдвигался в течение одного аудита.

## 5. Формулировки

Держаться `maturityLanguage`: `pre-integration`, `industrial-integration-ready-no-go`.
Запрещены (`AGENTS.md`): `production-ready`, `fully live`, `ЭДО подключён`, `ФГИС подключён`,
`банк подключён`, `платформа гарантирует оплату`.

## 6. Расходы

Новых обязательных расходов не введено: **0 ₽**.
Внешние опции (1С-партнёрство, Диадок, Saby, оператор ЭПД) остаются НЕАКТИВИРОВАННЫМИ.
