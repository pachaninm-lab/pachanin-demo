# Фаза 2 — исполнение сделки: находки и архитектурное решение

Дата: 17.07.2026. Продолжение `CANONICAL_SCENARIO.md` (этапы 4–10) и
`PHASE1_BACKLOG.md`. Живой прогон конвейера исполнения по сделке из аукциона
(`deal-7d972618-…`, статус DRAFT).

## Что уже работает

- Командная модель исполнения (`deal-command.policy.ts`) описывает весь путь
  DRAFT → … → CLOSED: допуск, договор, резерв, логистика, погрузка, рейс,
  прибытие, вес, осмотр, лаборатория, приёмка, документы, выплата, закрытие —
  с ролями, переходами и внешними операциями (банк как callback).
- Каждая команда — атомарная, с optimistic-версией, идемпотентностью и аудитом
  (`industrial-deal-command.gateway.ts`).
- Сделка создаётся из аукциона с участниками FARMER (продавец) и BUYER
  (покупатель) в tenant'е сделки.

## Блокер B0-Э1: исполнение строго одно-tenant, нет назначения участников

`industrial-deal-command.gateway` для КАЖДОЙ команды требует активную запись
`deal_participants`, совпадающую по `dealId + tenantId(сделки) + org + user +
role + status=ACTIVE`. Ролей оверсайта в обход нет.

Следствия (проверено живьём):
1. Оператор/админ не может даже прочитать сделку (`DEAL_PARTICIPANT_REQUIRED`),
   пока не назначен её участником.
2. Мост «аукцион → сделка» (`prisma-deal.repository` bindDeal) создаёт только
   FARMER и BUYER. Логистика, водитель, элеватор, сюрвейер, лаборатория,
   комплаенс, банк-роль — не назначаются нигде: **штатного пути назначить
   участника сделки не существует.**
3. Все участники обязаны быть в **одном tenant'е** со сделкой
   (`deals_select` RLS: `tenantId = current_tenant`, участник в том же tenant).
   Но реальная сделка — это разные компании из разных tenant'ов (покупатель,
   элеватор, перевозчик, лаборатория). Одно-tenant модель это не поддерживает.

## Архитектурное решение (нужно владельцу продукта)

Аукцион уже решён кросс-tenant через SECURITY DEFINER функции и обезличенную
витрину (фаза 1). Исполнение сделки требует того же решения. Два пути:

**A. Сделка — tenant-нейтральна, доступ по участию (рекомендуется).**
Снять из RLS сделки равенство tenant'а и опираться на строки
`deal_participants` (организация участника + активный статус) как на источник
доступа, независимо от tenant. Назначение участника — привилегированное
серверное действие (SECURITY DEFINER, как auction.record_admission), с
проверкой: организация VERIFIED+KYC, пользователь ACTIVE и член организации с
этой ролью. Это единая модель с аукционом и естественно ложится на
федеральный масштаб.

**B. Копировать/линковать организации-участники в tenant сделки.**
Проще по RLS, но плодит дубликаты организаций и расходится с реальностью
(одна организация — много сделок в разных tenant'ах). Не рекомендуется.

## Что сделано в этой фазе (building block, независим от выбора A/B)

`POST /api/deals/:id/participants` — назначение участника сделки оператором
(SUPPORT_MANAGER/ADMIN/COMPLIANCE_OFFICER), с обязательным основанием,
проверкой организации/пользователя/членства и записью
`DEAL_PARTICIPANT_ASSIGNED` в `audit_events`. Реализовано для случая, когда
организация участника уже в tenant'е сделки; кросс-tenant включается выбором
пути A (снятие tenant-равенства + SECURITY DEFINER).

## Решение принято: A (реализовано и проверено живьём)

- Миграция `dealx.participant_tenant` (SECURITY DEFINER) — исполнение сделки
  идёт в доверенном RLS-контексте tenant'а сделки по подтверждённому участию,
  независимо от tenant'а токена. RLS денежной сделки не ослаблена.
- Шлюз и репозиторий переведены на участие вместо равенства tenant'а.
- Проверено живьём: элеватор из другого tenant'а назначен и читает сделку;
  посторонний (не участник) получает 403. 422 юнит-теста зелёные.

## Банковский шов (Фаза 3) — реализован и проверен

`POST /api/webhooks/bank` — вход подтверждений банка (РСХБ). HMAC-SHA256,
обязательный timestamp (окно 300с), идемпотентность по eventId. Ведёт шаги
`confirm_reserve`/`confirm_release`. Fail-closed проверено живьём: нет/неверная
подпись → 401, старый timestamp → 401, плохая operation → 400, валидная подпись
без платформенно-выпущенной операции → 409 `BANK_OPERATION_NOT_PENDING`.
Детали контракта — `CANONICAL_SCENARIO.md` §5.1.

## Что осталось для сквозного живого прогона до CLOSED

Механика готова (кросс-tenant участие + банковский шов). Не хватает **актёрского
состава ролей исполнения** в локальной БД: сейчас есть FARMER, BUYER, ELEVATOR;
для полного пути нужны также COMPLIANCE_OFFICER (допуск), LOGISTICIAN, DRIVER,
SURVEYOR, LAB, ACCOUNTING. Оверсайт-роли (COMPLIANCE_OFFICER) требуют MFA при
входе — актёр должен пройти enrollment.

Два способа поднять состав (решение владельца продукта):
- **Gated demo-seed** (санкционировано §0.1): идемпотентный сид под флагом
  `SEED_DEMO_DATA` создаёт полный канонический состав (организации VERIFIED+KYC,
  активные пользователи, членства, MFA для оверсайта). Быстро, воспроизводимо,
  подходит для показа.
- **Реальный путь регистрации** для каждого актёра: регистрация → верификация
  организации оператором → KYC → выдача роли → enrollment MFA. Максимально
  честно, но дольше и вручную.

После поднятия состава участники назначаются через реальный
`POST /api/deals/:id/participants`, и конвейер проходится всеми ролями:
допуск → аукцион → договор → резерв (банк) → логистика → рейс → приёмка → вес →
осмотр → лаборатория → приёмка → документы → выплата (банк) → закрытие.

## Живой прогон 17.07.2026 (реальный путь, без обхода)

По реальным эндпоинтам проведён комплаенс-офицер из **своего** tenant'а:
регистрация → верификация организации оператором (`PATCH /api/organizations/
:id/status` → VERIFIED+KYC APPROVED) → выдача роли (`PATCH /api/admin/users/
:id/role` COMPLIANCE_OFFICER) → enrollment MFA → назначение участником
(`POST /api/deals/:id/participants`). Затем исполнение сделки командами:

| Шаг | Актёр | Итог |
|-----|-------|------|
| DEAL_PARTICIPANT_ASSIGNED | ADMIN | ASSIGNED (кросс-tenant комплаенс) |
| approve_admission | COMPLIANCE_OFFICER (чужой tenant) | SUCCESS → ADMISSION_APPROVED |
| publish_auction | FARMER | SUCCESS → AUCTION_OPEN |
| place_winning_bid | BUYER | SUCCESS → AUCTION_WON |

Это подтверждает живьём: кросс-tenant участник (решение A) исполняет доменные
команды денежной сделки с полным аудитом.

### Доведено живьём до RESERVED (реальный денежный путь)

Поднят полный состав ролей через реальные эндпоинты (регистрация → верификация
организации → выдача роли где нужно → назначение участником `POST /api/deals/
:id/participants`): COMPLIANCE_OFFICER, FARMER, BUYER, LOGISTICIAN, DRIVER,
SURVEYOR, LAB (в tenant сделки), ACCOUNTING, SUPPORT_MANAGER, ELEVATOR — из них
LOGISTICIAN/DRIVER/SURVEYOR/LAB/ACCOUNTING **из своих tenant'ов** (кросс-tenant).
Исполнено командами:

| Шаг | Актёр | Итог |
|-----|-------|------|
| approve_admission | COMPLIANCE_OFFICER (чужой tenant) | → ADMISSION_APPROVED |
| publish_auction | FARMER | → AUCTION_OPEN |
| place_winning_bid | BUYER | → AUCTION_WON |
| seller_sign_contract | FARMER | → SELLER_SIGNED (реальный договор+evidence) |
| buyer_sign_contract | BUYER | → CONTRACT_SIGNED (договор SIGNED+immutable) |
| request_reserve | BUYER (step-up MFA) | → RESERVE_REQUESTED (settlement-операция) |
| **confirm_reserve** | **БАНК (settlement bank-callback)** | **→ RESERVED, payment RESERVED, bank_op CONFIRMED, ref RSHB-RESERVE-0001** |

Денежный резерв подтверждён **авторитетным** швом
`POST /api/settlement-engine/bank-callback` (реестр ключей партнёра, канонная
подпись). Это и есть боевой шов РСХБ.

### Важные находки (для доведения до CLOSED)

1. **Дубль банковского шва устранён.** Ранее в этой фазе был добавлен
   `POST /api/webhooks/bank` (на легаси `gateway.executeBankCallback`). Он
   избыточен: для settlement-сделок `confirm_reserve/confirm_release`
   маршрутизируются в settlement-engine, а прямой вызов даёт 403
   `VERIFIED_BANK_CALLBACK_REQUIRED`. Дубль удалён — единственный денежный путь
   `settlement-engine/bank-callback`.
2. **`finalize_lab` требует прохождения custody-цепочки labs (это НЕ дефект).**
   Уточнение прежней записи: исполняет `finalize_lab` не легаси
   `DealCommandService`, а переопределение в `PostgresqlDealCommandService`
   (`SettlementAwareDealCommandService extends PostgresqlDealCommandService
   extends DealCommandService`). Оно требует пробу в статусе
   `ANALYSIS_IN_PROGRESS`, подписанта `SIGNATORY` (authorized_actors),
   purpose-bound protocol-evidence, и переводит пробу в `FINALIZED` — полностью
   согласованно с триггерами labs. Легаси-ветка `finalize_lab` в
   `deal-command.service` (PENDING→DONE) перехватывается до `super.execute` и
   никогда не исполняется (мёртвый код, вводящий в заблуждение — кандидат на
   удаление). Чтобы пройти шаг живьём, нужно провести пробу по реальным
   эндпоинтам labs: `POST /labs/samples` → `/collect` → `/custody` →
   `/tests` → (ANALYSIS_IN_PROGRESS), затем доменная команда `finalize_lab`
   подписантом. Это подсистема, а не баг.
3. **Логистический нормализованный допуск — глубокий граф.** `assign_logistics`
   требует verified carrier/vehicle/driver/facility **в tenant сделки** с
   immutable-evidence (deal_documents type EVIDENCE_FILE, статус VERIFIED),
   связкой `driver_vehicle_links` и допуском `logistics.deal_admissions`. Для
   живого прогона логистики нужен либо gated-seed этого графа, либо драйвер по
   реальным эндпоинтам подсистемы logistics.

Итог: денежный контур (резерв) и весь путь до RESERVED доказаны живьём на
реальных швах. До CLOSED осталось: (2) исправить `finalize_lab` под custody-
модель labs и (3) поднять граф logistics; после этого — вес/осмотр/лаборатория/
приёмка/документы/выплата/закрытие проходят теми же командами.
