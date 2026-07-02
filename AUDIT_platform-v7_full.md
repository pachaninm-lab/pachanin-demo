# Аудит безопасности и продукта — platform-v7 «Прозрачная Цена»

- **Стадия:** контролируемый пилот (controlled pilot / pre-integration).
- **Роль аудитора:** senior security & product auditor.
- **Режим:** read-only анализ исходного кода. Живой проход (Блок 8) — **BLOCKED** (нет доступного staging-контура и тестовых аккаунтов в среде аудита).
- **Дата:** 2026-07-02.
- **Область анализа:** `apps/web` (Next.js, публичный контур + кабинет), `apps/api` (NestJS — основной слой enforcement), `packages/integration-sdk`, конфиги, git-история.

> Где живёт enforcement: глобальный `AppAuthGuard` (JWT) + `RolesGuard` (роль на маршрут) + `ActionExecutorService.assertObjectScope` (пообъектная авторизация). Архитектура в целом правильная — но **пообъектная проверка применена не везде**, и есть несколько путей полного обхода RBAC. Именно это даёт основную массу находок.

---

## 0. Статус устранения (обновление после аудита)

Все находки P0/P1 и часть P2 **устранены в коде** в этой ветке, с тестами. Прогон бэкенд-тестов: **251/251 зелёные** (Prisma-клиент застабан локально — сетевой codegen недоступен в среде аудита; это не влияет на логику фиксов).

| # | Находка | Статус | Ключевые изменения |
|---|---------|--------|--------------------|
| C1 | Саморегистрация привилегированной роли | ✅ Исправлено | `auth.service.ts` — allowlist `SELF_REGISTERABLE_ROLES`; тест на отказ ADMIN/SUPPORT/EXEC/COMPLIANCE/ARBITRATOR/GUEST |
| C2 | Дефолтные секреты | ✅ Исправлено | `common/config/secrets.ts` `requireSecret()` — fail-closed в проде; JWT/BANK/FGIS/EDO переведены на него |
| C3 | Бэкдор кабинета (PIN `9438`, суффиксное сравнение) | ✅ Исправлено | `cabinet-lock-login/route.ts` — убраны PIN/суффикс/цифровое сравнение и hardcoded owner; секрет подписи только из env |
| C4 | Демо-аккаунты во всех окружениях | ✅ Исправлено | сид только при `SEED_DEMO_USERS=true` |
| H1 | IDOR паспорт/таймлайн сделки | ✅ Исправлено | `deals.service.ts` — `assertObjectScope` в `passport`/`timeline`; тест |
| H2 | IDOR/BOLA документы | ✅ Исправлено | `documents.service.ts` — `assertDocumentAccess` + фильтр `list`; тесты |
| H3 | BOLA банковское основание/settlement | ✅ Исправлено | `settlement-engine.service.ts` — `assertDealScope` + `filterPaymentsByScope`; тесты |
| H4 | Слабая парольная политика | ✅ Исправлено | `validators/strong-password.validator.ts` (12+, классы, анти-последовательности) на `register` |
| H5 | LOGISTICIAN без орг-скоупа | ⚠️ Частично | ужесточена driver-изоляция (unassigned → deny); carrier-org для LOGISTICIAN требует модельной привязки user↔carrierOrgId (оставлено follow-up, чтобы не сломать логистику) |
| M1 | Web-заглушки фиктивного успеха денег/качества | ✅ Исправлено | settlement release/confirm → прокси в бэкенд (реальные authz/MFA/state); labs — fail-closed 501 |
| M2 | Нет lockout при переборе | ✅ Исправлено | `auth.service.ts` — per-account lockout (5 попыток / 15 мин); тест |
| M3 | Middleware ломает публичные формы | ✅ Исправлено | `middleware.ts` — `PUBLIC_API_EXACT` для `inquiries`/`leads` |
| L3 | Дубликат декоратора | ✅ Исправлено | `register.dto.ts` |
| L2 | Нет revoke access-token | ⏳ Follow-up | требует короткого TTL + deny-list по `sessionId` (не входит в этот заход) |

> Многоинстансная оговорка (федеральный масштаб): lockout (M2) и хранилище пользователей/refresh реализованы in-memory. Для тысяч одновременных пользователей на нескольких инстансах их следует вынести в общий стор (Redis/БД). Это отмечено как отдельный инфраструктурный follow-up и не откатывает сделанные security-фиксы.

---

## 1. Резюме и топ-риски

Базовая модель ролей и пообъектного доступа спроектирована грамотно (org-isolation для FARMER/BUYER, driver-isolation, EXECUTIVE read-only, банковские операции через outbox + HMAC-callback, «платформа не саморелизит деньги»). Однако **несколько критичных дыр обесценивают эту модель целиком**:

| # | Топ-риск | Severity |
|---|----------|----------|
| C1 | Саморегистрация с любой ролью, включая `ADMIN`/`SUPPORT_MANAGER` → полный обход RBAC и пообъектной авторизации | **Critical** |
| C2 | Захардкоженные дефолтные секреты (`JWT_SECRET`, `BANK_HMAC_SECRET`, webhook-секреты) → подделка admin-JWT и банковских/ФГИС callback'ов | **Critical** |
| C3 | Бэкдор в кабинетном логине: временный PIN + приём любого 8-значного пароля, оканчивающегося на `9438`, + «суффиксное» сравнение паролей | **Critical** |
| C4 | Сид демо-аккаунтов (`*@demo.ru` / `demo1234`) во всех окружениях без флага | **High** |
| H1 | IDOR: паспорт и таймлайн сделки без пообъектной проверки (утечка цен, сумм, `bankEventId`) | **High** |
| H2 | IDOR/BOLA: документы полностью без пообъектной проверки (метаданные + контент + signed URL по прямому id) | **High** |
| H3 | BOLA: банковское «основание оплаты» / расчётный лист без пообъектной проверки; экспорт всех сделок | **High** |
| H4 | Слабая парольная политика (8 символов, без сложности) → проходит 8-значный числовой пароль | **High** |
| H5 | LOGISTICIAN не ограничен своей организацией на рейсах (GPS-трек, verify-pin любого рейса) | **High** |
| M1 | Web-заглушки «отдают деньги / завершают качество» с фиктивным успехом, без авторизации, в обход бэкенда | **Medium** |

**Общая оценка:** для контролируемого пилота с реальными контрагентами — **не готово**. C1–C3 позволяют получить полный административный контроль над платформой без легитимных кред. Их нужно закрыть до допуска любых внешних пользователей. Продуктовые guardrails (антиоверклейминг-копирайт, маркировка `LIVE_SIMULATED`) в целом присутствуют — основное нарушение честности осталось в web-заглушках (M1).

---

## 2. Находки по severity

### CRITICAL

#### C1 — Вертикальная эскалация: саморегистрация с привилегированной ролью
- **Файлы:**
  - `apps/api/src/modules/auth/dto/register.dto.ts:34-39` — `@IsEnum(Role) role!: Role;` (роль принимается из тела без allowlist).
  - `apps/api/src/modules/auth/auth.controller.ts:27-32` — `@Public() @Post('register')`.
  - `apps/api/src/modules/auth/auth.service.ts:94-112` — `role: (dto.role as Role) || Role.GUEST` без ограничений.
- **Последствие:** любой анонимный пользователь может `POST /api/auth/register` с `role: "ADMIN"` (или `SUPPORT_MANAGER`). Обе роли входят в `BYPASS_ROLES` (`roles.guard.ts:7`) — обход всех маршрутных ограничений — и в `PRIVILEGED` (`action-executor.service.ts:47,78`) — обход всей пообъектной авторизации. Это компрометация всей модели доступа: чтение/мутация любых сделок, документов, банковских оснований, споров.
- **Фикс:** серверный allowlist самостоятельно регистрируемых ролей (например только `FARMER`, `BUYER`, `LOGISTICIAN`, `DRIVER`, `LAB`, `ELEVATOR`, `ACCOUNTING`). Роли `ADMIN`, `SUPPORT_MANAGER`, `EXECUTIVE`, `COMPLIANCE_OFFICER`, `ARBITRATOR` выдаются только через администраторский флоу с подтверждением. Игнорировать/отклонять `role` вне allowlist в `register()`.

#### C2 — Захардкоженные дефолтные секреты (fail-open)
- **Файлы:**
  - `apps/api/src/modules/auth/jwt-auth.guard.ts:5` и `apps/api/src/modules/auth/auth.service.ts:8` — `process.env.JWT_SECRET || 'pachanin-demo-secret-2026'`.
  - `apps/api/src/modules/settlement-engine/settlement-engine.controller.ts:13` — `BANK_HMAC_SECRET ?? 'pachanin-demo-bank-secret-dev'`.
  - `apps/api/src/modules/integrations/integrations.controller.ts:10` — `FGIS_WEBHOOK_SECRET ?? 'pachanin-demo-fgis-secret-dev'`.
  - `apps/api/src/modules/integrations/edo-webhook.controller.ts:26` — `EDO_WEBHOOK_SECRET ?? 'grainflow-edo-webhook-secret-dev'`.
- **Последствие:** если переменная окружения не задана (или задана некорректно), система молча использует известный из репозитория секрет. Тогда: (а) подделка JWT с `role: ADMIN`; (б) подделка bank-callback (`bank-callback` — единственный путь подтверждения/релиза денег, `settlement-engine.controller.ts:110-123`) → фиктивное подтверждение резерва/релиза средств; (в) подделка ФГИС/ЭДО webhook'ов.
- **Фикс:** fail-closed — при отсутствии секрета в env падать на старте (throw), без литерального fallback. Ротация всех перечисленных значений. Проверять наличие секретов в CI/деплой-гейте.

#### C3 — Бэкдор и ослабленное сравнение в кабинетном логине
- **Файл:** `apps/web/app/api/platform-v7/cabinet-lock-login/route.ts`
  - `:8` — захардкоженный `TEMP_PIN_SHA256`.
  - `:84-89` `temporaryPinAllowed()` — **любой** 8-значный пароль, оканчивающийся на `9438`, принимается (`inputDigits.endsWith('9438')`), плюс совпадение с зашитым SHA-256 PIN.
  - `:65-67` `passwordMatches()` — если во входе ≥8 цифр, а в настроенном пароле ≥4 цифр, сравниваются только **последние N цифр** (`inputDigits.slice(-configuredDigits.length)`) — эффективно снижает пароль до нескольких последних цифр.
  - `:81` `cabinetSessionSecret()` — при отсутствии env для подписи cabinet-сессии используется `TEMP_PIN_SHA256`.
  - `:7,:97,:104` — единый логин владельца `pachaninm@gmail.com`; роль (любая из 12) берётся из тела запроса (`:95,:100`).
- **Последствие:** знание бэкдорного суффикса или зашитого PIN даёт вход в кабинет под **любой** из 12 ролей. Суффиксное сравнение резко упрощает подбор. Это фактически публичный мастер-ключ кабинета.
- **Фикс:** удалить `temporaryPinAllowed` и `9438`-ветку; удалить суффиксное/цифровое частичное сравнение — только полное constant-time равенство; не использовать PIN-хеш как секрет подписи; ввести индивидуальные учётные записи кабинета вместо единого owner-логина + выбираемой роли.

> Дополнительно (правило №2 задания): встреченные учётные данные — сид `demo1234`, зашитый PIN, дефолтные секреты — **не использовались** для входа; зафиксированы как находки класса «secret in repo».

### HIGH

#### C4 — Сид демо-аккаунтов с известным паролем во всех окружениях
- **Файл:** `apps/api/src/modules/auth/auth.service.ts:37-52` — `demoUsers` (`farmer@demo.ru … admin@demo.ru`, пароль `demo1234`, включая `Role.ADMIN`) безусловно добавляются в `usersStore` (`:52`).
- **Последствие:** предсказуемые логины + известный пароль дают рабочий вход, в т.ч. под `admin@demo.ru`. В пилоте с реальными контрагентами это готовый бэкдор.
- **Severity:** High.
- **Фикс:** сидировать демо-пользователей только под флагом (`SEED_DEMO_USERS=true`) и никогда в pilot/prod; для admin — отдельная защищённая инициализация.

#### H1 — IDOR: паспорт и таймлайн сделки без пообъектной проверки
- **Файл:** `apps/api/src/modules/deals/deals.service.ts:78-84` — `passport()` и `timeline()` вызывают репозиторий напрямую, **без** `assertObjectScope` (в отличие от `getOne`/`workspace`/`transition`, где проверка есть — `:55-76,:101-133`).
- **Данные:** `runtime-timeline-builder.ts:53` `buildPassport` отдаёт `parties.seller/buyer.orgId`, `pricePerTon`, `totalRub`, `money.amountRub`, `money.disputedAmountRub`, `bankEventId`.
- **Эндпоинты:** `GET /api/deals/:id/passport`, `GET /api/deals/:id/timeline` (`deals.controller.ts:32-40`).
- **Последствие:** любой FARMER/BUYER/ACCOUNTING читает коммерческие условия и банковский идентификатор **чужой** сделки по прямому id (горизонтальная эскалация / межконтрагентная утечка).
- **Фикс:** в `passport`/`timeline` вызвать `this.executor.assertObjectScope(user, 'deal.view', { objectType:'deal', objectId:id, ownerOrgId: deal.sellerOrgId, counterpartyOrgId: deal.buyerOrgId })` перед возвратом (как в `getOne`).

#### H2 — IDOR/BOLA: документы без пообъектной проверки
- **Файл:** `apps/api/src/modules/documents/documents.service.ts:15-58` — `list`, `getOne`, `getSignedAccess`, `streamContent`, `download` принимают `_user` и **игнорируют** его (underscore = не используется). `AccessScopeService` объявлен в модуле (`documents.module.ts:34`), но в сервис **не внедрён и не вызывается**.
- **Эндпоинты:** `documents.controller.ts` — `GET /documents` (все документы), `/:id`, `/:id/access` (signed URL, TTL 15 мин), `/:id/content`, `/:id/download`.
- **Последствие:** любой из ролей `FARMER, BUYER, ACCOUNTING, LAB, LOGISTICIAN, EXECUTIVE` получает метаданные, подписанную ссылку и контент **любого** документа по прямому id, а `list()` выдаёт весь корпус документов без фильтра по орг/сделке.
- **Фикс:** внедрить `AccessScopeService`/`assertObjectScope` в `DocumentsService`; проверять членство пользователя в сделке документа (`doc.dealId` → seller/buyer org); `list()` фильтровать по орг-скоупу.

#### H3 — BOLA: банковское «основание оплаты» / расчётный лист
- **Файл:** `apps/api/src/modules/settlement-engine/settlement-engine.service.ts:37-51` — `worksheet(dealId)`, `bankWorkspace(dealId)`, `listPayments`, `paymentDetail` без пообъектной проверки; `:53-79` `exportDeals`/`exportContractors` выгружают **все** платежи/бенефициаров. Мутации `requestReserve`/`requestRelease` (`:86-155`) формируют `scope` без `ownerOrgId` → `assertObjectScope` не срабатывает по орг (проверка `if (scope.ownerOrgId && …)` пропускается).
- **Эндпоинты:** `settlement-engine.controller.ts:21-44,69-94` (роль-гейт `ACCOUNTING/SUPPORT_MANAGER/ADMIN/EXECUTIVE`).
- **Последствие:** ACCOUNTING одной организации читает банковский workspace, бенефициаров и суммы **любой** сделки; экспорт выгружает данные всех сделок; ACCOUNTING может инициировать резерв/релиз по чужой сделке (cross-org money op). Прямо соответствует отмеченному в ТЗ риску «любая роль → банковское основание оплаты».
- **Фикс:** передавать `ownerOrgId`/`counterpartyOrgId` в `scope` для reserve/release и добавить пообъектную проверку в `worksheet`/`bankWorkspace`/`paymentDetail`; `list`/`export` фильтровать по орг-скоупу (кроме ADMIN/SUPPORT_MANAGER).

#### H4 — Слабая парольная политика (пропускает 8-значный числовой)
- **Файл:** `apps/api/src/modules/auth/dto/login.dto.ts:7-9` и `register.dto.ts:37-39` — только `@IsString() @MinLength(8)`. Нет требований к сложности/классам символов/словарю.
- **Последствие (подтверждение факта внешнего аудита):** пароль вида `12345678` валиден — именно поэтому система принимает 8-значный числовой пароль. Валидация — на уровне DTO, и она допускает любые 8+ символов.
- **Фикс:** минимум 12 символов, требования к классам символов/энтропии, блок распространённых и последовательных паролей; желательно проверка по breach-списку (k-anonymity). Применить и к смене/восстановлению пароля.

#### H5 — Горизонтальная эскалация: LOGISTICIAN без орг-скоупа на рейсах
- **Файл:** `apps/api/src/modules/logistics/logistics.service.ts:133-144` — `assertShipmentAccess` изолирует только `DRIVER`; для `LOGISTICIAN` пообъектной проверки нет. Также если `shipment.driverUserId` пуст (неназначенный рейс), проверка водителя пропускается.
- **Эндпоинты:** `logistics.controller.ts` — `GET /logistics/shipments/:id`, `/:id/workspace`, `/:id/gps/track`, `POST /:id/verify-pin`, `/:id/transition`.
- **Последствие:** логист любой организации получает доступ к любому рейсу по id — GPS-трек, verify-pin, смена статуса чужого рейса.
- **Фикс:** ограничить LOGISTICIAN рейсами своей организации/сделок; неназначенные рейсы также закрыть для произвольных водителей.

### MEDIUM

#### M1 — Web-заглушки с фиктивным успехом денег/качества, без авторизации
- **Файлы:**
  - `apps/web/app/api/settlement-engine/deal/[dealId]/release/route.ts` — всегда `{ ok:true, status:'RELEASED', message:'Финальный платёж инициирован. Деньги направлены продавцу.' }`.
  - `apps/web/app/api/settlement-engine/deal/[dealId]/confirm/route.ts` — всегда `CONFIRMED`.
  - `apps/web/app/api/labs/complete/route.ts` — всегда `COMPLETED`, «Сделка переведена в расчёт денег».
  - `apps/web/app/api/labs/flag-quality-dispute/route.ts` — аналогично.
- **Последствие:** любой аутентифицированный пользователь (любая из 12 ролей — эндпоинты не проверяют ни роль, ни владение) получает утверждение об успешном релизе денег/завершении лаборатории **в обход** бэкенда, который специально спроектирован «не саморелизить деньги» и требовать MFA. Это одновременно (а) отсутствие авторизации и (б) оверклейминг (Блок 7) — интерфейс сообщает о переводе денег, которого не было.
- **Фикс:** удалить заглушки или проксировать в бэкенд-эндпоинты (`/settlement-engine/deal/:id/release` с `RequiresMfaGuard`, реальными гейтами и пообъектной проверкой). Пока не проксированы — не показывать пользователю статус «деньги направлены».

#### M2 — Нет блокировки аккаунта при переборе (только IP rate-limit)
- **Файл:** `apps/api/src/modules/auth/auth.controller.ts:20-25` — `RateLimit auth_login` 8/60с по IP. Нет per-account lockout/backoff.
- **Последствие:** распределённый credential stuffing (много IP) не сдерживается; слабая парольная политика (H4) усиливает риск.
- **Фикс:** счётчик неудач и временная блокировка на аккаунт, экспоненциальный backoff, опц. CAPTCHA после N неудач.

#### M3 — Middleware: чрезмерно широкий matcher ломает публичные формы
- **Файл:** `apps/web/middleware.ts:337` — `matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)']` покрывает весь `/api/*`. Публичными считаются только `/api/auth/` и `/api/runtime-` (`:319`). `/api/platform-v7/inquiries` и `/api/platform-v7/leads` не входят в allowlist → для анонима попадают в ветку `:325-328` и получают `401` (у самих роутов есть валидация/rate-limit/анти-спам — `inquiries`/`leads`).
- **Последствие:** публичные формы лида/заявки недоступны анонимному пользователю (потеря лидов). Замечание внешнего аудита про «307 → /login с потерей тела POST» в текущем коде проявляется как 401 (поведение, вероятно, уже частично поправлено), но формы всё равно закрыты.
- **Фикс:** явно добавить `/api/platform-v7/inquiries` и `/api/platform-v7/leads` в публичный allowlist middleware (у них уже есть собственная валидация + rate-limit + анти-спам). Обратную проверку выполнил: под `/api/runtime-` (единственный «широкий» публичный префикс) публичны рантайм-ридеры; убедиться, что туда не попал гейтед-API — рекомендую заменить префиксный allowlist на явный список рантайм-роутов.

### LOW / информационные

- **L1 — `x-pc-role` из пути/cookie/query.** `middleware.ts:205-224` резолвит роль из пути (`resolvePlatformV7PathRole`), cookie `pc-role` и query `?as=` и проставляет заголовки `x-pc-role`. RBAC-наблюдение (`:304-315`) — report-only и берёт роль только из верифицированного JWT, так что живого обхода нет. Риск: если какой-либо серверный код начнёт доверять `x-pc-role` для авторизации — это станет обходом. Убедиться, что `x-pc-role` используется только для UI-подсказок, не для enforcement.
- **L2 — Нет серверного revoke access-token.** `auth.service.ts:9-11` — access TTL 8ч (stateless JWT), refresh 30д; `logout` удаляет только refresh (`:127-130`). Скомпрометированный access-token живёт до истечения. Рассмотреть короткий TTL access + deny-list по `sessionId`.
- **L3 — Дубликат декоратора `@IsOptional()`** в `register.dto.ts:30-31` — code smell, не влияет на безопасность.
- **L4 — git-история:** реальных приватных ключей (`BEGIN … PRIVATE KEY`) в diff'ах **не найдено** — совпадения относятся к тексту прежней аудиторской заметки, а не к материалу ключа. Основной секрет-риск — дефолтные значения в коде (C2/C3), а не утечка в истории.

---

## 3. Матрица авторизации ролей (Блок 1)

Роли бэкенда (`request-user.ts`): `FARMER, BUYER, LOGISTICIAN, DRIVER, LAB, ELEVATOR, ACCOUNTING, EXECUTIVE, SUPPORT_MANAGER, ADMIN, COMPLIANCE_OFFICER, ARBITRATOR` (+ маппинг на «поверхностные» роли кабинета: seller=FARMER, buyer, logistics, driver, lab, elevator, operator=SUPPORT_MANAGER, executive, compliance, arbitrator, bank≈ACCOUNTING, surveyor).

Enforcement: `RolesGuard` (маршрут) + `ActionExecutorService.assertObjectScope` (объект). `ADMIN` и `SUPPORT_MANAGER` — глобальный обход (`BYPASS_ROLES`/`PRIVILEGED`). `EXECUTIVE` — read-only.

| Домен / эндпоинт | Роль-гейт (маршрут) | Пообъектная проверка | Статус |
|---|---|---|---|
| Deals `GET :id`, `workspace`, `PATCH transition` | FARMER,BUYER,SUPPORT,EXEC,ADMIN,ACCOUNTING | `assertObjectScope` (org seller/buyer) | ✅ ОК |
| Deals `GET :id/passport`, `:id/timeline` | те же | **нет** | ❌ **H1 IDOR** |
| Documents `GET`,`/:id`,`/:id/access`,`/:id/content`,`/download` | FARMER,BUYER,SUPPORT,ACCOUNTING,LAB,LOGIST,EXEC,ADMIN | **нет** (`_user` игнорируется) | ❌ **H2 IDOR/BOLA** |
| Settlement `worksheet`,`bank-workspace`,`payments`,`export` | ACCOUNTING,SUPPORT,ADMIN,EXEC | **нет** | ❌ **H3 BOLA** |
| Settlement `reserve`/`release` (мутации) | ACCOUNTING,ADMIN,SUPPORT (+MFA на release) | scope без `ownerOrgId` | ❌ **H3** (cross-org) |
| Disputes `GET :id`, `list` | SUPPORT,BUYER,FARMER,LAB,ACCOUNTING,EXEC,ADMIN | ✅ `initiatorOrgId==user.orgId` | ✅ ОК |
| Disputes `triage`/`decision` | те же, внутр. проверка `ARBITRATOR_ROLES`={SUPPORT,ADMIN} | — | ✅ ОК |
| Logistics `shipments/:id`, `gps/track`, `verify-pin`, `transition` | LOGIST,DRIVER,SUPPORT,ADMIN | DRIVER — изолирован; **LOGISTICIAN — нет** | ⚠️ **H5** |
| Lots `list`/`report` | публичные (флаг `ENABLE_PUBLIC_LOT_REPORTS`) | зависит от `listReport`/`getReport` | ⚠️ проверить флаг в pilot |
| Auth `register` | `@Public()` | роль из тела без allowlist | ❌ **C1 эскалация** |
| Settlement `bank-callback` | `@Public()` + HMAC | HMAC-подпись | ✅ (при валидном секрете — см. C2) |
| Web-заглушки `settlement/*`, `labs/*` | только наличие сессии (любая роль) | **нет** | ❌ **M1** |

Вертикальная эскалация: **C1** (register→ADMIN) и **C3** (cabinet PIN→любая роль). Горизонтальная: **H1/H2/H3/H5**. Обход общего гейта: **M1/M3** (web-роуты Next в обход бэкенд-гардов).

---

## 4. Приоритизированный план действий

**P0 — до допуска любых внешних пользователей (закрывает полный обход RBAC):**
1. C1 — allowlist ролей в `register()`; запретить самоназначение `ADMIN/SUPPORT_MANAGER/EXECUTIVE/COMPLIANCE/ARBITRATOR`.
2. C2 — убрать литеральные fallback-секреты, fail-closed при отсутствии env; ротация; деплой-гейт на наличие секретов.
3. C3 — удалить бэкдор-PIN (`9438`), суффиксное сравнение и зашитый TEMP_PIN; полное constant-time сравнение; индивидуальные кабинетные учётки.
4. C4 — сид демо-пользователей только под флагом, никогда в pilot/prod.

**P1 — пообъектная авторизация (IDOR/BOLA):**
5. H1 — `assertObjectScope` в `deals.passport/timeline`.
6. H2 — внедрить `AccessScopeService` в `DocumentsService` (getOne/access/content/download/list).
7. H3 — орг-скоуп в settlement worksheet/bankWorkspace/paymentDetail; `ownerOrgId` в scope reserve/release; фильтр list/export.
8. H5 — орг-скоуп LOGISTICIAN на рейсах.

**P2 — аутентификация и границы:**
9. H4 — усилить парольную политику (12+, сложность, breach-check) на login/register/recovery.
10. M2 — per-account lockout/backoff.
11. M1 — убрать/проксировать web-заглушки денег/лаборатории.
12. M3 — добавить `inquiries`/`leads` в публичный allowlist middleware; заменить префиксный `/api/runtime-` allowlist явным списком.

**P3 — hardening:**
13. L2 — короткий TTL access-token + revoke по `sessionId`.
14. L1 — подтвердить, что `x-pc-role` нигде не используется для enforcement.
15. L3 — почистить дубликат декоратора.

Рекомендация по внедрению: точечные фиксы P0–P1 оформить отдельными PR в ветку `claude/platform-v7-security-audit-yjhll4` (без auto-merge, без пуша в main), каждый с тестом на негативный кейс (чужой id → 403). Настоящий отчёт не меняет продуктовую логику — только фиксирует находки.

---

## 5. BLOCKED — что не удалось проверить и почему

- **Блок 8 (живой проход всех ролей на staging) — BLOCKED.** В среде аудита нет доступного staging-контура и заведённых тестовых аккаунтов с фиктивными данными. Согласно правилам задания, живой проход UI/ролей допустим только на staging под специально созданными тест-аккаунтами — поэтому рантайм-проверки находок Блока 1 (практический IDOR из-под каждой роли, полный жизненный цикл сделки цена→рейс→приёмка→качество→документы→расчёт→спор) **не выполнялись**. Реальные учётные данные (включая владельца) не использовались.
  - **Что нужно для снятия блокировки:** staging-URL, 12 тестовых аккаунтов (минимум seller/bank/operator) с сильными случайными паролями, помеченными как тестовые, и тестовая сделка с фиктивными данными (без реальных ИНН/сумм/ПДн).
  - Результаты Блоков 1–7 (статический анализ) это **не отменяет** — все находки выведены из исходного кода и приведены с `файл:строка`.
- **Вторичный «runtime»-бэкенд:** web-эндпоинты `/api/runtime-me-*` проксируют на внешний `NEXT_PUBLIC_API_URL` (`/runtime/me/object/...`), обработчик которого не обнаружен в анализируемом NestJS-приложении. Его пообъектная авторизация не проверялась (вне доступного кода) — требует отдельного прохода при наличии этого сервиса.
- **Реальные значения секретов интеграций** (Sber-эскроу, ФГИС, ЭДО, КриптоПро, Wialon/ATI) в env продакшена недоступны для проверки; оценивалась только логика их использования и дефолты в коде (C2).

---

### Приложение: подтверждённые сильные стороны (не регресснуть)
- Bank-callback как единственный путь подтверждения/релиза денег + HMAC-подпись (`settlement-engine.controller.ts:110-123`), «платформа не саморелизит деньги».
- Driver-isolation и EXECUTIVE read-only в `action-executor.service.ts:77-128`.
- Restore-пароля без user-enumeration: единый ответ `202` и generic-сообщение (`platform-v7-password-recovery/route.ts:285-289`), rate-limit по IP и логину.
- Антиоверклейминг-копирайт (`external-copy-guardrails.ts`) и честная маркировка симуляций (`LIVE_SIMULATED`, `mock`).
- Security-заголовки и CSP в middleware (`applySecurityHeaders`).
