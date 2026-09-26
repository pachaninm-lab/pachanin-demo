# UX, ФГИС и банки — полный контур исполнения MASTER v2.1

Точка сверки: `main=67dfca2e6f2169d1bb5a9838621708b05b1497ee`, 25.09.2026. Этот реестр задаёт объём работы и порядок проверки, а не объявляет его выполненным. Последняя подтверждённая web revision на REG.RU: `952a305849224a46d96256ca2621f0438c8165cc`; новая приёмка требует проверки фактически запущенного exact SHA. Официальный прогресс остаётся `5/100` до приёмки полного блока. Источники: MASTER v2.1, `R1_1_EXACT_INVENTORY_2026-09-20.md`, текущие route/component imports и задачи #5372, #5370, #5525, #5526, #5530, #5531, #5535, #5580.

## UX охватывает весь продукт

| Требования | Реальный объём | Оставшаяся проверка |
| --- | --- | --- |
| UX-001–003 | Один PublicHeader на всех достижимых страницах: Home, About, How, Gekta/AI, Trust, Contact, legal, Login, Register, Docs; одинаковые геометрия, навигация и RU/EN/ZH/mobile. | Сверить фактические маршруты, инварианты header и публичную live матрицу. Это PUBLIC lane; ACCOUNT_2_PRODUCT не меняет публичный landing по действующему handoff. |
| UX-004, R11 | Один существующий AppShellV4, tokens, navigation, status/action vocabulary для всех защищённых зон; Action Center, inbox, notifications, search, settings, support. | Инвентаризировать forks и подключать существующие primitives, не создавать второй shell. Подтвердить permission-aware поиск, дедупликацию, settings scope/effective date/rollback и support audit без скрытого доступа. |
| UX-005–006 | Каждая ролевая главная: «где я, состояние, обязательный шаг, срок, деньги, последствия» за 5–10 секунд. | Server-derived action/policy/permission contract для каждой роли. Очередь по `updatedAt` остаётся навигацией; UNKNOWN не заменяется первой строкой. #5535 и CORE producer handoff. |
| UX-007–010 | loading, empty, partial, stale/degraded/offline, forbidden, validation/retryable/non-retryable error, conflict, unknown external result, security hold, success; draft/validation/units; mobile tables/filter/sort/export; consequence confirmation. | Экранная матрица и interaction/keyboard/mobile/visual tests для каждого рабочего маршрута; нельзя считать наличие общего компонента приёмкой всех экранов. |
| ROL-001–006, R11-006 | 13 production кабинетов, разрешения на объекты/действия и controlled Founder open/return с real actor/effective role/audit. | CORE #5580 и R1 owner handoff, затем 13/13 first login/main work/settings/mobile/error/outage/exception/recovery, denied/high-risk и возврат на exact live SHA. |

### Проверенная карта 13 входов

Маршруты и роли взяты из R1.1 inventory и сверены с текущими `page.tsx`. В восьми строках production branch `firstCustomerWorkspaceRequired()` рендерит `FirstCustomerWorkspace` из `first-customer-workspace-server.ts` вместо больших legacy page bodies. Его данные: server session/profile, organization и scoped Deal/shipment/lab queue. Наличие ссылки в очереди не доказывает priority, deadline или money impact.

| № | Кабинет | Production route | Текущий вход | Следующая предметная приёмка |
| ---: | --- | --- | --- | --- |
| 1 | Оператор | `/platform-v7/operator` | собственная page, canonical Deal/outbox reads | triage, ownership, conflict/recovery, server task authority |
| 2 | Покупатель | `/platform-v7/buyer` | FirstCustomerWorkspace | первый вход, Deal journey и честный UNKNOWN; следующий Product vertical #5604 prerequisite |
| 3 | Продавец | `/platform-v7/seller` | FirstCustomerWorkspace | farmer-first end-to-end #5371, реальные партии/сделки и отрицательные состояния |
| 4 | Логистика | `/platform-v7/logistics` | FirstCustomerWorkspace | shipment plan, назначение, outage/recovery, роль/права |
| 5 | Водитель | `/platform-v7/driver/field` | FirstCustomerWorkspace | mobile/offline evidence, повторная отправка и конфликт синхронизации |
| 6 | Сюрвейер | `/platform-v7/surveyor` | FirstCustomerWorkspace | осмотр/акт, evidence, разрешённое подтверждение |
| 7 | Элеватор | `/platform-v7/elevator` | FirstCustomerWorkspace | приёмка/вес/расхождение, quantity и recovery |
| 8 | Лаборатория | `/platform-v7/lab` | FirstCustomerWorkspace | образец/протокол, quality conflict и evidence |
| 9 | Банк и бухгалтерия | `/platform-v7/bank` | FirstCustomerWorkspace | операция/сверка/ограничение, provider linkage без ложной финальности |
| 10 | Сотрудник организации | `/platform-v7/profile` | собственная page, auth profile | membership, team/settings, revoked/forbidden и role change |
| 11 | Арбитр | `/platform-v7/arbitrator` | собственная page, disputes read | dispute/evidence/decision authority, error/recovery |
| 12 | Комплаенс | `/platform-v7/compliance` | собственная page | review/restriction/reason, permission/step-up |
| 13 | Руководитель | `/platform-v7/executive` | собственная page, Deal/dispute/outbox reads | sourced health/drill-down, freshness и no fake KPI |

Общий экран восьми ролей сейчас показывает UNKNOWN для неподтверждённого обязательного следующего шага (#5589); это truth guard, а не полный UX этих восьми кабинетов. В каждой роли дополнительно нужны object journey, settings, action/error/outage/recovery и мобильная приёмка. Founder controlled mode не превращает тестовую организацию в customer authority.

## Банк и деньги

| Контур ТЗ | Текущее подтверждение | Осталось до PASS |
| --- | --- | --- |
| BNX-001–004, R9-004/006/007 | Canonical BankOperation, IntegrationBinding/ProviderCapability и reference adapters уже существуют; PRODUCT показывает неизвестное/сверку без ложного success. | CORE #5525: durable operation→binding→provider read projection с tenant/version/evidence. #5530: отдельные реальные Сбер/Альфа/Т-Банк contracts, org binding, credentials, callback trust, status/statement reconciliation и внешняя приёмка. Наличие адаптера и HTTP/ACK не равно операции конкретного банка или оплате. |
| BNX-005–007 | Запрет обхода ограничения и модель безопасной смены реквизитов заданы MASTER. | ProviderComplianceMatrix по договору, fail-closed restriction/reason/unlock authority; реквизиты через request/MFA/ownership/risk/cooling-off/effective version; отрицательные сценарии и audit в CORE. PRODUCT показывает server facts и последствия. |
| BNX-008, R9-001–003, ACX-004–008 | Finance/1С/ЭДО и settlement имеют существующие foundations, но не общую live приёмку. | Внешние условия кредита/гарантии/факторинга/страхования, provider-neutral docs, конкретная версия 1С, conflict/audit, ежедневная Bank↔Ledger↔Documents↔1С сверка, cash/revenue/VAT раздельно; PRODUCT не создаёт финансовую authority. |

После возможной внешней mutation timeout = `UNKNOWN/PENDING_RECONCILIATION`: тот же operation ID сначала сверяется по status/statement. Webhook не признаётся фактом без подписи/identity/amount/version/replay проверки и durable inbox. Миграция на другого провайдера не обходит действующее ограничение.

## ФГИС, документы и применимость

| Контур ТЗ | Текущее подтверждение | Осталось до PASS |
| --- | --- | --- |
| R8-001–005, R8-017 | Control Tower показывает capabilities/freshness без обещания legal applicability. | CORE #5526 возвращает APPLICABLE/NOT_APPLICABLE/UNKNOWN для Deal/batch/shipment с rule/version/effective interval/source/evidence/blocking stage; отсутствие факта = UNKNOWN. Источник/capability/ACK не означает законное принятие. |
| R8-006–010, ACX-003 | FGIS Grain contract 1.0.23 pinned, чтение/запись registry пока disabled или sandbox-only без живого доступа; ZSN public PDF source pinned. | #5370: lot/СДИЗ read+delta, immutable evidence, Grain→canonical Inventory и conflict/reconciliation; #5531: org/delegation, credentials, signature, operator, external E2E. Mutation/sign/cancel только после доказанных предпосылок. |
| R8-011–018, ACX-001–002 | Остальные government/EPD systems записаны как disabled/not assessed, а не подключённые. | Field geometry/right/season, seeds separate operations, Saturn metadata contract; EPD lifecycle и аккредитованный оператор, обязательный stage gate; Argus/VetIS/Росаккредитация только по server applicability. Никакой реальной юридической mutation ради теста. |

Внешняя блокировка записывается отдельно по системе/банку: владелец, `checkedAt`, нужный договор/доступ/сертификат/подпись/оператор, затронутая capability. Нельзя конвертировать её в PASS или подставлять фиктивный статус.

## Порядок работы и критерий окончания

1. Завершить PUBLIC #5559 и exact-main release sequencing; закрыть guard #5604 с независимой проверкой. Затем отдельный state-only buyer admission и его реализация на accepted base. Каждый дальнейший экран допускается узким scope.
2. Сохранить единые shell/status/action primitives; завершить role-by-role buyer → logistics/driver → elevator/lab/surveyor → bank/employee/operator/arbitrator/compliance/executive, с общими settings/search/notification/support и RU/EN/ZH/mobile/a11y. Публичные маршруты проходят по PUBLIC handoff. Роль-mode #5477 ждёт CORE #5580 и `READY_FOR_CONSUMER`.
3. После CORE read projections #5525/#5526 Product подключает только типизированные bank/FGIS server facts. Реальная активация #5530/#5531 требует внешних артефактов; R8/R9 внутренние контракты и внешняя приёмка фиксируются раздельно.
4. Для каждого vertical: exact-head tests/CI/security, независимый просмотр полного diff, author audit, SHA-bound merge, exact-current-main REG.RU image/revision и live функциональная/mobile/negative приёмка. Только 13/13 и все соответствующие UX/R8/R9/BNX/ACX acceptance cases дают полное закрытие блока; зелёный CI или документ сами по себе этого не доказывают.
