# Ролевой ИИ-помощник «Прозрачной Цены»

## 1. Суть

Помощник — единый разговорный интерфейс к разрешённому контуру исполнения Сделки:

`роль → организация → доступные сделки → рабочее пространство → подтверждённые факты → объяснение → следующий шаг`.

Он должен ощущаться как внимательный компетентный сотрудник, но всегда честно остаётся ИИ. Живость создаётся не имитацией человека, а следующими свойствами:

- естественный диалог и сохранение краткого контекста беседы;
- понимание текущего экрана и выбранной сделки;
- приветствие по времени суток;
- видимый статус «На связи»;
- понятные стадии работы: проверка доступа, сбор фактов, сверка рисков, формирование ответа;
- возможность остановить запрос;
- практический вывод, причина, следующий шаг и уточняющие вопросы;
- спокойный профессиональный тон без ложной эмоциональности и антропоморфизации.

## 2. Текущий статус

| Контур | Статус |
|---|---|
| Разговорный UI | `IMPLEMENTED_AND_VERIFIED_IN_CODE` |
| Серверный role/deal scope | `IMPLEMENTED_AND_VERIFIED_IN_CODE` |
| Структурированный ответ `assistant_decision_v2` | `IMPLEMENTED_AND_VERIFIED_IN_CODE` |
| Бесплатный локальный deterministic provider | `IMPLEMENTED_AND_VERIFIED_IN_CODE` |
| Синтетический demo-контур | `IMPLEMENTED_AND_EXPLICITLY_LABELLED` |
| Локальный OpenAI-compatible provider | `SUPPORTED_NOT_PRODUCTION_PROVEN` |
| Корпоративный российский LLM provider | `NOT_CONNECTED` |
| Изменение состояния сделки | `PROHIBITED_READ_ONLY` |
| Production эксплуатация внешней модели | `NOT_PROVEN` |

Текущий режим — `READ_ONLY`. Денежные, юридические, лабораторные, банковские и арбитражные решения находятся вне authority модели.

## 3. Архитектурная граница

```text
Authenticated user
  ↓
AI Assistant API
  ↓
RequestUser + membership + tenant + role
  ↓
DealRegistryQueryService.listAccessible
  ↓
DealsService.workspace только после access check
  ↓
Context minimization + sensitive-field exclusion
  ↓
Structured Decision Builder
  ↓
Local deterministic / approved OpenAI-compatible provider
  ↓
Text + decision card + evidence + citations
  ↓
Immutable audit metadata
```

Модель не имеет прямого доступа к PostgreSQL, object storage, банковским callback, state machine или доменным командам.

## 4. Граница доступа

Помощник не принимает `role`, `tenantId`, `orgId`, membership или полномочия из браузера. Для каждого запроса API заново использует `RequestUser`, созданный серверным auth-контуром.

Последовательность:

1. Получить participant-scoped реестр через `DealRegistryQueryService.listAccessible(..., user)`.
2. Найти явный или контекстный `dealId` только внутри разрешённого реестра.
3. Вернуть `404 AI_ASSISTANT_DEAL_NOT_AVAILABLE`, если сделка недоступна.
4. Только после этого вызвать `DealsService.workspace(dealId, user)`.
5. Удалить персональные, банковские, секретные, внутренние и role-private поля.
6. Сформировать ответ и audit event `AI_ASSISTANT_QUERY`.
7. Хранить в audit hash вопроса, длину и служебные метаданные, но не полный текст.

Чужой tenant, организация, кабинет, скрытый compliance-сигнал или внутренняя заметка другой стороны не должны попадать ни в prompt, ни в structured decision, ни в логи.

## 5. Контракт ответа `assistant_decision_v2`

Текстовый ответ сопровождается машиночитаемой карточкой:

```json
{
  "summary": "Сделка 2408 — документы собраны",
  "reason": "Ожидается подтверждённое основание выплаты",
  "nextAction": "Запросить разрешение выплаты",
  "ownerRole": "seller",
  "deadlineAt": "2026-07-18T12:00:00.000Z",
  "moneyAtRiskKopecks": "1500000000",
  "confidence": "high",
  "actionAllowed": false,
  "actionKind": "NONE",
  "intent": "money",
  "evidence": [],
  "followUps": [],
  "dataFreshnessAt": "2026-07-17T10:00:00.000Z"
}
```

Назначение контракта:

- одинаковое понимание ответа UI, audit и будущими eval-тестами;
- отображение карточек вместо неструктурированного полотна;
- отделение факта от объяснения модели;
- явная фиксация `actionAllowed=false`;
- контроль свежести и уверенности;
- возможность безопасно заменить модель без изменения продукта.

## 6. Пользовательские поверхности

### Плавающий помощник

Доступен во всех private `platform-v7` workspace и сохраняет единый стиль взаимодействия. Публичные страницы продолжают использовать человеческий канал поддержки.

### Полноэкранный workspace

Канонический маршрут: `/platform-v7/assistant`.

Совместимый маршрут `/platform-v7/ai` перенаправляет на канонический, чтобы не создавать две истории и два разных UX.

### Контекст сделки

На маршрутах `/platform-v7/deals/:id/...` UI передаёт только идентификатор текущего экрана. Сервер самостоятельно подтверждает, что сделка входит в разрешённый реестр.

### Доступность

- RU / EN / ZH;
- mobile-first;
- keyboard navigation;
- Escape и focus trap;
- touch targets;
- reduced motion;
- `noindex` для private assistant route;
- отсутствие истории сделки в `localStorage` и `sessionStorage`.

## 7. Режимы данных

### `authoritative`

Используется реальная серверная сессия и подтверждённые данные Deal Core. Если backend недоступен, запрос завершается fail-closed. Синтетическая подмена запрещена.

### `synthetic_demo`

Разрешён только для явных `demo.*` session tokens. Свойства:

- постоянная заметная маркировка «Синтетические данные»;
- ролевое ограничение synthetic deals;
- `AI_ASSISTANT_DEAL_NOT_AVAILABLE` для недоступной demo-сделки;
- те же decision cards и UX, что в authoritative режиме;
- отсутствие реальных персональных, банковских и транзакционных данных;
- запрет утверждать, что выполнена реальная операция.

Эти режимы нельзя объединять, кешировать совместно или переключать незаметно для пользователя.

## 8. Бесплатный режим

```env
AI_ASSISTANT_PROVIDER=local
```

Дополнительный API, договор или оплата токенов не нужны. Ответы строятся из серверного read model и deterministic decision builder.

Этот режим пригоден для:

- разработки;
- внутренней проверки;
- UX-приёмки;
- демонстрации банку на синтетических данных;
- security и role-isolation тестов.

Он не является универсальной большой языковой моделью и не должен выдаваться за production-подключение внешнего GenAI.

## 9. Локальная модель

```env
AI_ASSISTANT_PROVIDER=openai-compatible
AI_ASSISTANT_BASE_URL=http://127.0.0.1:11434/v1/
AI_ASSISTANT_MODEL=qwen3:8b
AI_ASSISTANT_ALLOWED_HOSTS=127.0.0.1,localhost
```

Пример отдельного runtime:

```bash
ollama pull qwen3:8b
ollama serve
```

Требования:

- модель запускается отдельным сервисом, не внутри web process;
- host находится в allowlist;
- timeout и безопасный deterministic fallback обязательны;
- передаётся только минимизированный разрешённый контекст;
- документный и contextual text считается недоверенными данными, а не инструкциями;
- недоступность модели не меняет state сделки.

## 10. Корпоративный провайдер

До передачи реальных данных необходимы:

- корпоративный договор или оферта на юридическое лицо;
- российский контур обработки и хранения;
- утверждённая модель поручения обработки данных;
- запрет обучения на данных платформы;
- retention и deletion policy;
- incident notification;
- HTTPS и точный host allowlist;
- secret manager для ключей;
- SLA и fallback policy;
- правовая, security и нагрузочная приёмка.

Подключение провайдера не меняет Deal Core и server authorization boundary.

## 11. Запрещённые возможности

Помощник не может:

- подтверждать резерв, списание или выпуск денег;
- создавать или имитировать банковский callback;
- менять state machine Сделки;
- выбирать победителя аукциона;
- подписывать документ;
- менять лабораторный результат;
- открывать, закрывать или решать спор без доменной команды и полномочий;
- повышать права или переключать tenant/role;
- видеть чужую сделку или role-private поля;
- считать текст документа системной инструкцией;
- утверждать, что он человек или сотрудник организации.

## 12. Будущий command-контур

Командные AI-tools допускаются отдельным этапом после read-only acceptance.

Каждый tool должен использовать:

- существующую доменную команду;
- server-side reauthorization;
- idempotency key;
- optimistic concurrency;
- preview последствий;
- явное подтверждение пользователя;
- MFA/JIT/two-person approval по уровню риска;
- audit и outbox;
- fail-closed при конфликте состояния.

Модель никогда не становится authority.

## 13. Eval и security acceptance

Минимальный набор должен включать:

- запрос чужого tenant;
- запрос чужой сделки;
- попытку подменить роль через prompt/history;
- prompt injection внутри документа;
- скрытые банковские и compliance-поля;
- противоречащие версии документа;
- отсутствие банковского callback;
- частичную выплату и hold;
- просроченный рейс;
- отклонение веса/качества;
- открытый спор и evidence pack;
- запрос выполнить запрещённое действие;
- RU / EN / ZH;
- mobile, keyboard, reduced motion;
- provider outage и fallback.

Обязательные инварианты:

- cross-tenant leakage = 0;
- cross-role leakage = 0;
- unauthorized action = 0;
- critical action without confirmation = 0;
- fabricated deal fact = 0;
- audit coverage = 100%;
- every operational answer has freshness and source;
- synthetic/authoritative mode confusion = 0.

## 14. Честная зрелость

Реализованный контур улучшает UX и операционную понятность сделки, но не доказывает production-эксплуатацию внешней LLM, качество на реальных пользовательских диалогах или автономные действия.

Допустимая формулировка после CI и deployment acceptance:

> «Ролевой read-only ИИ-помощник с серверно подтверждённым контекстом сделки, структурированным ответом, синтетическим демонстрационным режимом и provider-neutral архитектурой».

Недопустимые формулировки:

- «полностью автономный сотрудник»;
- «принимает решения по сделке»;
- «подключён к банку или государственным системам»;
- «production-проверен на реальных пользователях», пока такого доказательства нет.
