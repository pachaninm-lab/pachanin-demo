# Governance Blocker — PC-CROP Federal Accounting Programme

Статус: **BLOCKED — требуется решение владельца**
Дата фиксации: 2026-08-15
Live main на момент фиксации: `9b07e3190ab48476cba46082a99c01d5fba1bedc`

---

## 1. Суть

Autonomous Execution Contract требует реализовать 17 workstreams (waves 1–12): identity, документы,
бухгалтерский контур, деньги, Connection Center, Integration Core, 1С, ЭДО, Зерно, ЭПД, ГЕКТА,
anti-fraud, SOC, DR и production acceptance.

Репозиторий содержит собственный **committed governance**, который в настоящий момент запрещает
агенту писать код в зоны, необходимые для всех этих waves.

Раздел C самого контракта задаёт иерархию источников истины:

> 1. Фактическое live-состояние production и external authority.
> 2. Текущий main репозитория.
> 3. Доказанные server/domain invariants существующей архитектуры.
> 4. Это Autonomous Execution Contract.
> 5. MASTER ТЗ ниже.

Governance репозитория — это уровни 2–3. Контракт — уровень 4. **Контракт сам подчиняет себя
governance.** Раздел E дополнительно запрещает обход governance.

Поэтому это не отказ от выполнения контракта, а исполнение его собственного правила приоритетов.

---

## 2. Доказательства (файлы в main, не пересказ)

### 2.1 `AGENTS.md`

> - Work only inside the current `allowedCurrentScope` from `autopilot-state.json`.
> - Do not touch platform-v7 UI, visual, theme, onboarding, adapters, server actions, AI gateway,
>   **DB/migrations** or lockfiles unless the current step explicitly allows it.
> - **Claude should be used as reviewer, architect and risk auditor. Claude should not write
>   competing implementation PRs for the same current step.**
> - One PR equals one narrow current step.

### 2.2 `docs/platform-v7/autopilot/autopilot-state.json`

`current` = `"IR-10.4 Settlement PostgreSQL Authority"` — совершенно другой workstream.
`currentStatus` = `"in_progress"`, `openBlockers` непустой ⇒ текущий шаг **не зелёный**.

`forbiddenZones` включает:

```
apps/web
packages
package.json
pnpm-lock.yaml
live integration activation
production migration execution
production credentials and secret material
```

`allowedCurrentScope` / `agentWritableScope` — узкий список файлов расчётного контура
(`modules/settlement-engine/**`, `deal-command*`, миграция `20260713*_settlement_postgresql_authority`).

`lockedUntilCurrentGreen`:

```
IR-10.5 Disputes PostgreSQL Authority
IR-20 Canonical Durable Outbox
IR-21 Durable Integration Inbox
IR-22 Persistent Partner API and Outbound Webhooks
IR-30 through IR-90 in dependency order
```

### 2.3 `docs/platform-v7/autopilot/progress.json`

```json
"rules": { "noAutoMerge": true, "noDirectPushToMain": true, "controlledPilotOnly": true }
```

---

## 3. Конкретный конфликт по waves

| Wave контракта | Нужная зона записи | Статус по governance |
|---|---|---|
| 1 Identity / job_profile / capabilities | `schema.prisma` + новая миграция + `packages/domain-core` | `packages` в forbiddenZones; миграции вне разрешённого префикса `20260713*_settlement_postgresql_authority` |
| 2 Документы / договоры | новые таблицы + `apps/web` | forbiddenZones |
| 3 Accounting task-first UX | `apps/web/app/platform-v7/accounting` | `apps/web` в forbiddenZones |
| 4 Деньги | `modules/settlement-engine/**` — **единственная разрешённая зона**, но для IR-10.4, а не для авансов | конфликт с «no competing implementation PRs» |
| 5 Connection Center + Integration Core | `apps/web` + новые таблицы | forbiddenZones + IR-21 в `lockedUntilCurrentGreen` |
| 6 1С | новый модуль + миграции | вне scope |
| 7 ЭДО | новый модуль + миграции + OAuth | вне scope + «live integration activation» запрещена |
| 8 Зерно / ЭПД | расширение FGIS | вне scope |
| 9 ГЕКТА work bridge | `modules/gekta` + `apps/web` | вне scope |
| 10 Anti-Fraud | `modules/anti-fraud` + миграции | вне scope |
| 11 SOC / DR | infra + production | «production migration execution» запрещено |
| 12 Production acceptance | live production | сетевой блокер, см. §4 |

Разрешённых зон, пересекающихся с waves 1–12, **нет** ни одной.

---

## 4. Второй, независимый блокер: production недостижим

Сетевая политика окружения отклоняет исходящее соединение к домену:

```
kind:   connect_rejected
detail: gateway answered 403 to CONNECT (policy denial or upstream failure)
host:   xn--80affnb9admdi3d.xn--p1ai:443
```

Источник: `$HTTPS_PROXY/__agentproxy/status`.

Матрица §H требует для последних 25% каждого workstream:
`+10%` exact-SHA production deployment и `+15%` real production acceptance.
Оба недостижимы из этой сессии независимо от governance. Это ограничение окружения,
а не платформы: на машине с доступом к REG.RU оно снимается.

---

## 5. Что требуется от владельца

Минимальное действие — **одно решение по governance**, оформленное как изменение
`autopilot-state.json` (это акт владельца, не агента):

1. Зарегистрировать программу в `approvedConcurrentScopes` — репозиторий уже имеет этот механизм
   и использует его для 5+ параллельных веток. Заготовка scope-файла:
   `docs/platform-v7/autopilot/scopes/pc-crop-federal-accounting.json` (создан, помечен `proposed`).
2. Либо снять `lockedUntilCurrentGreen` для IR-20/IR-21, от которых зависят waves 5–8,
   либо явно принять, что программа стартует только после зелёного IR-10.4.
3. Явно подтвердить или отменить правило `AGENTS.md` «Claude should not write competing
   implementation PRs» применительно к этой программе.

Пока пункты 1–3 не решены, любой implementation-PR по waves 1–12 будет по определению
scope-violation и по правилу review («If changed files exceed allowed scope, block merge»)
подлежит блокировке на ревью. Писать такой PR — значит гарантированно производить отклоняемую работу.

---

## 6. Что уже подготовлено

- Полный truth audit против live-кода — `gap-matrix.md`.
- Durable execution state — `execution-state.json`.
- Реестр рисков, включая риск дублирования архитектуры — `risk-register.md`.
- Матрицы приёмки — `security-acceptance.md`, `production-acceptance.md`.
- Совместимость интеграций — `integration-compatibility.md`.
- Проект scope-файла для регистрации программы.
- Handoff для продолжения без повторного анализа — `continuation-handoff.md`.

## 7. Заблокированный процент

`97%` из `100%` по матрице §H. Разблокированная и выполненная часть — `1.8%`.

## 8. Какой acceptance станет возможен после решения

После регистрации scope: Wave 1 (identity/job_profile/capabilities) — 5% веса, из них
до 60% достижимо оффлайн (код + тесты), т.е. `+3.0%`; остальное требует merge и production.
Аналогично для waves 2–4, 9, 10 — они не требуют внешних vendor-договоров.
Waves 6–8 дополнительно требуют vendor credentials (1С / Диадок / Saby / ФГИС) — это отдельный,
уже описанный в §Q контракта коммерческий трек, не устраняемый из репозитория.
