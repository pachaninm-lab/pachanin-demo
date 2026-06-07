# ФИНАЛЬНОЕ MASTER-ТЗ

## platform-v7 / «Прозрачная Цена»

Доведение до зрелой рабочей платформы исполнения зерновой сделки с production-like runtime,
профессиональными эмуляторами внешних интеграций, ролевым onboarding, AI-ready контуром,
идеальным light/dark режимом и premium UX/UI.

---

## 0. Контрольная точка

### Уже закрыто

- Stage 3 — RBAC / ACL / роли / права доступа
- Stage 4 — MoneyTree / Document Matrix / Bank Basis / Action Boundary / Final QA
- Stage 5.0 — Runtime Inventory
- Stage 5.3 — Persistence Port Interfaces
- Stage 5.4 — DTO / Validation Schemas

### Где остановились

- Последний закрытый слой: PR 5.4 — DTO / Validation Schemas
- Следующий обязательный PR: **PR 5.1 — Application Service Layer**

### Что нельзя делать сейчас

- нельзя переписывать платформу с нуля
- нельзя начинать визуал до service layer / mock persistence / server actions
- нельзя подключать UI к декоративным mock-объектам
- нельзя начинать внешние adapters до базового runtime
- нельзя начинать AI-ассистентов без AI Integration Gateway
- нельзя делать product-entry как обычный лендинг

---

## 1. Главная цель

Нужно сделать реальную зрелую рабочую платформу, а не платформу, которая просто выглядит готовой.

**Единственное временное ограничение:** живые внешние интеграции пока не подключены.

Но платформа должна работать как полноценный продукт:

```
Product Entry
→ регистрация / открытый просмотр
→ выбор роли
→ role cockpit
→ партия / RFQ
→ сделка
→ документы
→ рейс
→ приёмка
→ качество
→ деньги
→ спор
→ доказательства
→ закрытие
```

Платформа должна быть: зрелой, рабочей, удобной, понятной, дорогой визуально,
технологичной, профессиональной по коду, готовой к live-интеграциям,
готовой к подключению AI-функций по ролям.

---

## 2. Главный продуктовый принцип

Платформа должна быть настоящей, а не «выглядеть настоящей». Это значит:

- кнопки работают
- состояния меняются
- роли ограничены
- документы блокируют действия
- деньги не меняются без банкового события
- повторное событие не двигает деньги повторно
- аудит пишется
- idempotency работает
- ошибки объясняются
- UI подключён к runtime
- эмуляторы внешних систем работают через adapter layer
- AI-функции подключаются через отдельный AI Gateway
- код выглядит как работа профессиональной инженерной команды

---

## 3. Статус внешних интеграций

### 3.1. Как должно быть

Внешние live-интеграции временно заменяются полноценными pre-integration adapters.

Пользователь не должен видеть дешёвые слова: демо, мок, симуляция, песочница, эмуляция, fake.

Нельзя писать ложные утверждения:
- банк подключён / ФГИС подключён / ЭДО подключён
- живые интеграции активны
- платформа выпускает деньги
- платформа гарантирует оплату

### 3.2. Правильная модель интерфейса

В пользовательском слое:

- Событие принято
- Основание сформировано
- Ожидается подтверждение внешнего контура
- Подтверждение получено
- Требуется ручная проверка
- Обнаружено расхождение
- Повторное событие не применено

В одном аккуратном системном месте:

> Внешние контуры подключаются по договору и доступам. Текущий контур готов к подключению внешних систем.

Где можно показать: footer, system info modal, connection status panel, trust/security page,
partner onboarding, technical integration page.

Где нельзя постоянно показывать: hero, каждая кнопка, каждая карточка, каждый статус,
каждый role cockpit, каждый action feedback.

---

## 4. Главная runtime-архитектура

Любое рабочее действие должно идти только так:

```
UI
→ Server Action
→ DTO Validation
→ Application Service
→ Persistence Adapter
→ Idempotency Store
→ Action Boundary
→ Domain Logic
→ Audit Sink
→ External Adapter Event
→ Persisted Result
→ UI State Update
```

Запрещено:

- UI → domain function
- UI → hardcoded mock state
- UI → random scenario object
- Server Action → direct MoneyTree mutation
- Service → direct p7ConfirmBankRelease
- Service → direct Document Matrix mutation
- Component → fake status
- module-level Map/Set as persistence
- global arrays as runtime state

---

## 5. Обязательный принцип разработки

Работать только через доработку текущей архитектуры:

- маленькие PR
- узкий scope
- минимальный diff
- без переписывания рабочих модулей
- без изменения business logic без необходимости
- без касания apps/landing без отдельного разрешения
- без глобального redesign до runtime binding

Каждый PR должен быть: reviewable, маленький, логически завершённый,
с тестами, без лишних файлов, без следов AI/vibe coding.

---

## 6. Полный список оставшихся PR

### Runtime-блок

| PR | Название |
|----|---------|
| **PR 5.1** | Application Service Layer ← **CURRENT** |
| PR 5.5 | Mock Persistence Adapter |
| PR 5.2 | Server Action Wrappers |
| PR 5.6 | Runtime Integration Tests |
| PR 5.7 | Final Stage 5 QA |

### External Adapters-блок (только после Stage 5)

| PR | Название |
|----|---------|
| PR 6.1 | External Adapter Interfaces |
| PR 6.2 | Bank Adapter Emulator |
| PR 6.3 | FGIS / SDIZ Adapter Emulator |
| PR 6.4 | EDO / EPD Adapter Emulator |
| PR 6.5 | Logistics / GPS Adapter Emulator |
| PR 6.6 | Lab / Surveyor Adapter Emulator |
| PR 6.7 | 1C / ERP Adapter Emulator |
| PR 6.8 | External Calls Journal / Replay / Error Simulation |

### AI-ready блок (только после runtime/adapters)

| PR | Название |
|----|---------|
| PR AI-0 | AI Integration Architecture |
| PR AI-1 | AI Gateway Interfaces |
| PR AI-2 | Role AI Assistant Contracts |
| PR AI-3 | AI Mock Provider |
| PR AI-4 | AI Audit / Safety / Permission Layer |
| PR AI-5 | Role-specific AI UX Entry Points |
| PR AI-6 | AI QA / Prompt Safety / Data Boundary Tests |

### Product Entry / Onboarding-блок (только после runtime foundation)

| PR | Название |
|----|---------|
| PR UI-0 | Product Entry & Onboarding Architecture |
| PR UI-0A | Universal Usability & Hidden Role Learning |
| PR UI-1 | Product Entry Screen |
| PR UI-2 | Role Onboarding Wizard |
| PR UI-3 | Registration / Access Request Forms |
| PR UI-4 | Open Role Preview |
| PR UI-5 | Runtime-Aware Role Cockpit Entry |
| PR UI-6 | Mobile / Accessibility Pass |

### Theme / Visual-блок (только после runtime binding)

| PR | Название |
|----|---------|
| PR THEME-1 | Light/Dark Theme Audit |
| PR THEME-2 | Theme Token Consolidation |
| PR THEME-3 | Role Cockpit Theme Pass |
| PR THEME-4 | Mobile Theme Pass |
| PR THEME-5 | Accessibility / Contrast / Focus States |
| PR THEME-6 | Final Theme Regression QA |

### Role Cockpit / UX-блок

| PR | Название |
|----|---------|
| PR UX-1 | Deal Workspace Runtime Binding |
| PR UX-2 | Seller / Buyer Cockpit |
| PR UX-3 | Logistics / Driver Cockpit |
| PR UX-4 | Elevator / Lab / Surveyor Cockpit |
| PR UX-5 | Bank / Compliance / Arbitrator Cockpit |
| PR UX-6 | Executive / Operator Cockpit |
| PR UX-7 | Money Gate / Document Matrix / Evidence Stack |

---

## 7. PR 5.1 — Application Service Layer

### Цель

Создать application service layer, который связывает:
DTO validation, persistence ports, idempotency, audit, action-boundary, domain result, typed service result.

### Файлы

```
apps/web/lib/platform-v7/runtime/application-service.ts
apps/web/lib/platform-v7/runtime/application-service-types.ts
apps/web/tests/unit/platformV7RuntimeApplicationServices.test.ts
```

### Обязательные сервисы

- `P7MoneyExecutionService`
- `P7DocumentExecutionService`
- `P7BankBasisExecutionService`
- `P7ReleaseWorkflowService`
- `P7DisputeSettlementService`

### MoneyExecutionService

Методы: `requestRelease`, `confirmRelease`, `confirmRefund`, `confirmHold`, `startManualReview`

Порядок:
1. validate DTO
2. load MoneyTree
3. load idempotency context
4. reserve idempotency key
5. `executePlatformV7MoneyAction` / `executePlatformV7BankBasisAction`
6. save MoneyTree
7. record idempotency result
8. append audit
9. return typed result

### DocumentExecutionService

Методы: `uploadDocument`, `confirmDocument`, `rejectDocument`, `sendDocument`, `markManualReview`

Порядок:
1. validate DTO
2. load Document Matrix
3. load idempotency context
4. reserve idempotency key
5. `executePlatformV7DocumentAction`
6. save Document Matrix
7. record idempotency result
8. append audit
9. return typed result

### BankBasisExecutionService

Методы: `sendBankBasis`, `confirmBankRelease`, `rejectBankRelease`, `confirmBankRefund`, `confirmBankHold`, `startBankManualReview`

Порядок:
1. validate DTO
2. load MoneyTree + BankBasis
3. load idempotency context
4. reserve idempotency key
5. `executePlatformV7BankBasisAction`
6. save MoneyTree + BankBasis through unit of work
7. record idempotency result
8. append audit / appendMany
9. return typed result

### ReleaseWorkflowService

Методы: `prepareRelease`, `requestRelease`, `sendBasisToBank`, `handleBankEvent`, `getReleaseStatus`

Thin orchestration layer. Не дублирует release gate и не вызывает domain напрямую.

### DisputeSettlementService

Методы: `openDispute`, `attachEvidence`, `prepareArbitrationBasis`, `applyArbitrationOutcomeToBankBasis`, `getDisputeMoneyImpact`

Не двигает деньги напрямую. Деньги меняются только через bank/action-boundary path.

### Запрещённые прямые вызовы в service layer

```
platformV7ApplyMoneyOperation
platformV7ReleaseGate
p7ConfirmBankRelease
p7ConfirmBankRefund
p7ConfirmBankHold
p7MarkBankBasisSent
p7BuildBankBasisPayload
p7BuildArbitrationBasisPayload
platformV7DocumentsBlockingStage
isBankBasisReady
platformV7DocumentMatrixReadiness
```

### Разрешено

```
executePlatformV7MoneyAction
executePlatformV7DocumentAction
executePlatformV7BankBasisAction
```

---

## 8. PR 5.5 — Mock Persistence Adapter

### Цель

Создать полноценный runtime persistence layer без реальной DB. Это не тестовый мок
и не временная заглушка в UI. Это adapter, который потом заменяется реальной DB
без переписывания сервисов.

### Реализовать

- `P7MoneyTreeRepository`
- `P7DocumentMatrixRepository`
- `P7BankBasisRepository`
- `P7DisputeSettlementRepository`
- `P7ActionExecutionRepository`
- `P7ExternalCallRepository`
- `P7IdempotencyStore`
- `P7AuditEventSink`
- `P7RuntimeUnitOfWork`

### Должен поддерживать

load/save MoneyTree, Document Matrix, Bank Basis, Dispute state, Action Execution,
External Calls, Idempotency, append audit events, return duplicate result,
simulate conflict / not_found / duplicate bankEventId / expectedVersion conflict,
seed scenarios, reset only in test/open walkthrough context.

### Запрещено

- module-level Map / Set
- global arrays
- hidden singleton store
- mock persistence inside UI
- random state in component

### Допустимо

- state inside explicit adapter instance
- `createP7MockRuntimeStore(seed)`
- version tokens
- seeded scenarios
- controlled reset

---

## 9. PR 5.2 — Server Action Wrappers

### Обязательные actions

```
createOpenWalkthroughSessionAction
selectRolePreviewAction
saveOnboardingDraftAction
createLotDraftAction
createRfqDraftAction
uploadDocumentAction
confirmDocumentAction
rejectDocumentAction
requestReleaseAction
sendBankBasisAction
confirmBankReleaseAction
confirmBankRefundAction
confirmBankHoldAction
openDisputeAction
attachEvidenceAction
submitArbitrationDecisionAction
```

Server action должен: принять payload → сформировать DTO → передать DTO в service →
вернуть typed result. Не мутирует domain напрямую, не создаёт mock state внутри себя,
не обходит RBAC, не пишет fake-live status.

---

## 10. PR 5.6 — Runtime Integration Tests

Обязательные сценарии:

- clean release flow
- document blocks release
- bank basis sent / bank confirmation received
- duplicate bankEventId does not mutate twice
- duplicate idempotency key does not mutate
- denied role action writes audit
- driver cannot access money/bank
- bank cannot access driver field
- dispute holds money
- arbitration basis does not move money directly
- refund path / hold path / manual review path
- expectedVersion conflict / not_found state
- external adapter timeout / retry success

---

## 11. PR 5.7 — Final Stage 5 QA

Проверки:
- no direct domain calls from UI/service
- no module-level fake persistence
- no fake live copy
- no marketplace positioning
- apps/landing diff = 0
- typecheck / unit tests / runtime tests / role tests / build
- mobile overflow smoke / theme regression smoke

---

## 12. External Adapter Emulators

### Общий контракт

```typescript
interface P7ExternalAdapter<TRequest, TResponse> {
  readonly provider: 'mock' | 'real';
  readonly connectionMode: 'pre_integration' | 'live';
  call(request: TRequest): Promise<TResponse>;
  healthCheck(): Promise<P7AdapterHealth>;
}
```

### Обязательные adapters

Bank, FGIS/SDIZ, EDO, EPD, Logistics/GPS, Lab/Surveyor, 1C/ERP, Notification.

Каждый adapter поддерживает: success, pending, manual review, rejected, duplicate event,
timeout, retry, external error, health status, external call log, replay.

### Пользовательские статусы

- Событие принято
- Основание сформировано
- Ожидается подтверждение внешнего контура
- Подтверждение получено
- Требуется ручная проверка
- Обнаружено расхождение
- Повторное событие не применено

---

## 13. AI Integration Gateway

### Архитектура

```
AI Gateway
→ Role AI Policy
→ Permission Context
→ Data Scope
→ Prompt/Task Contract
→ AI Provider Adapter
→ Audit
→ Result
```

Gateway должен: получить роль пользователя → получить доступный data scope →
проверить, какие действия разрешены → сформировать задачу для AI →
вызвать provider adapter → проверить ответ → записать audit → вернуть безопасный result в UI.

### AI Mock Provider

Пользовательский текст:
- Помощник подготовил рекомендацию
- Рекомендация сформирована по данным сделки
- Проверьте перед применением

Технический слой: `provider: 'mock'`, `connectionMode: 'pre_integration'`.

### Запрещено

- AI принимает решение за банк
- AI выпускает деньги
- AI меняет документы без действия пользователя
- AI обходит RBAC
- AI видит данные вне роли
- AI генерирует юридически финальное решение без проверки

AI — помощник, не субъект сделки.

---

## 14. Product Entry Screen

Hero: **Цифровой контур исполнения зерновой сделки**

Подзаголовок: Условия, документы, логистика, приёмка, качество, деньги, спор
и доказательства — в одном управляемом процессе.

CTA: Выставить партию / Создать запрос на закупку / Открытый просмотр платформы / Войти

Нельзя показывать в hero: фейковые суммы, фейковые сделки, ID сделок,
«банк подтвердил», «12 500 000 ₽ в резерве».

Главный visual — показывать систему, не сделку:
`Условия → Документы → Рейс → Приёмка → Качество → Основание → Спор/Закрытие`

---

## 15. Регистрация и доступ

### Роли

Продавец/фермер, Покупатель, Трейдер/закупщик, Логистика, Водитель,
Элеватор, Лаборатория, Сюрвейер, Банк, Оператор, Руководитель.

### Модель доступа

- Продавец/фермер — self-serve, без оплаты за вход
- Покупатель — self-serve / request access, основной плательщик
- Трейдер — request access, основной плательщик
- Логистика — заявка / приглашение
- Водитель — код / ссылка рейса
- Элеватор / Лаборатория / Сюрвейер — партнёрское подключение
- Банк — партнёрский доступ
- Оператор — внутренний доступ
- Руководитель — enterprise / internal access

Неполная регистрация не блокирует открытый просмотр — блокирует только рабочие действия.

---

## 16. Открытый просмотр ролей

Блок на product-entry странице. Требования:
- открытый просмотр не выглядит как игрушка
- рабочие действия ограничены
- UI не кричит «демо»
- не используются слова «мок», «симуляция», «песочница»

---

## 17. Universal Usability

Платформа должна быть понятна: молодым, пожилым, людям без цифрового опыта,
фермерам, водителям, банкам, операторам, руководителям.

**Правила:**
- экран понятен за 5 секунд
- одно главное действие
- крупные кнопки / простые русские формулировки
- статус дублируется текстом
- нет горизонтального скролла
- таблицы на mobile → карточки
- ошибка объясняет следующий шаг

**Минимумы:** body text ≥ 16px, touch target ≥ 48px, primary CTA ≥ 56px на mobile.

---

## 18. Hidden Role Learning

В каждой роли (скрыто по умолчанию):
- Как работать в этой роли
- Что сделать сначала
- Почему заблокировано
- Показать пример / Провести по шагам
- Словарь / Чеклист роли

---

## 19. Light / Dark Theme System

Единые design tokens, semantic colors, surface levels, border/shadow tokens,
status colors, focus states, disabled states, hover/active states.

**Light:** светлая тема по умолчанию, чистый белый/молочный фон, контрастный текст,
мягкие карточки, цвет только по смыслу, финансовая строгость.

**Dark:** не инверсия light, не «чёрная каша», не кислотные акценты,
читаемые карточки, чёткие границы, мягкий контраст.

**Theme QA viewports:** 360×800, 375×812, 390×844, 430×932, 768×1024, 1440×900, 1920×1080.

Theme switcher: единое место, работает на всех страницах, сохраняет состояние,
не ломает SSR/hydration, доступен с клавиатуры.

---

## 20. Монетизация

- Фермер — не платит за вход
- Покупатель / трейдер — основной плательщик (success fee / подписка / execution fee)
- Банк — партнёрская экономика
- Регион — контракт / пакет
- Водитель / логистика / элеватор / лаборатория — партнёрский контур

---

## 21. Engineering Quality

**Запрещено:** AI/vibe coding traces, гигантские компоненты, magic mocks в UI,
copy-paste state, domain logic in components, service bypass, module-level fake persistence,
комментарии «TODO AI», случайные console.log.

**Требуется:** маленькие модули, явные типы, dependency injection, typed results,
contract tests, integration tests, clear boundaries, no hidden global state,
reviewable commits, нормальные branch/PR/commit names.

---

## 22. Definition of Done

Платформа считается готовой, если:

1. Все действия работают через runtime, а не через UI mocks.
2. Есть зрелая product-entry страница.
3. Есть ролевой onboarding.
4. Есть открытый просмотр ролей.
5. Неполная регистрация не блокирует preview.
6. Рабочие действия требуют доступа.
7. Есть mock persistence adapter.
8. Есть external adapter emulators.
9. Есть AI Integration Gateway и AI mock provider.
10. AI не обходит RBAC и не принимает юридически/финансово финальные решения.
11. Деньги не меняются без банкового события.
12. Документы реально блокируют workflow.
13. Спор удерживает сумму и формирует evidence.
14. RBAC работает по роли и объекту.
15. Водитель видит только свой рейс.
16. Банк видит только деньги, основания, документы и журнал.
17. UI всегда показывает следующий шаг.
18. Ошибки понятны. Нет кнопок без результата.
19. Нет fake-live claims. Нет marketplace-позиционирования.
20. Код не выглядит как AI/vibe coding.
21. Нет module-level fake persistence. Нет прямых domain mutations из UI/service.
22. Всё работает на mobile.
23. Light/dark theme доведены до идеала. Theme switcher работает стабильно.
24. Есть скрытое обучение по ролям.
25. Есть полный QA: typecheck, unit, contract, runtime, role, mobile, accessibility, theme, forbidden-copy.

---

## 23. Следующая команда разработке

Стартовать только **PR 5.1 — Application Service Layer**.

Ничего не делать по UI, adapters, onboarding, visual polish, mock persistence,
server actions, AI gateway и theme-pass, пока PR 5.1 не закрыт и не прошёл review.

Коротко: мы стоим после PR 5.4. Следующий логичный шаг — PR 5.1.
Цель — соединить уже готовые DTO + persistence ports + action-boundary в application service layer.
