# Ролевой ИИ-помощник «Прозрачной Цены»

## Статус

- Целевая функция: персональный разговорный интерфейс к разрешённому контуру Сделки.
- Реализованный режим: `READ_ONLY`, серверно-авторизованный.
- Провайдер по умолчанию: `local-deterministic`, без внешнего API и платы за токены.
- Опциональный провайдер: локальный OpenAI-compatible endpoint, например Ollama.
- Production-зрелость внешней модели: не заявлена.
- Денежные, юридические, лабораторные, банковские и арбитражные решения: вне authority модели.

## Граница доступа

Помощник не принимает `role`, `tenantId`, `orgId` или права из браузера. Для каждого запроса API использует `RequestUser`, созданный серверным auth-контуром, и заново строит контекст через:

1. `DealRegistryQueryService.listAccessible(..., user)`;
2. participant-scoped PostgreSQL/RLS проекцию;
3. `DealsService.workspace(dealId, user)` только после подтверждения доступности сделки;
4. минимизацию контекста перед передачей модели;
5. audit event `AI_ASSISTANT_QUERY` без сохранения полного текста вопроса.

Явный `dealId`, отсутствующий в разрешённом реестре, возвращает fail-closed `404 AI_ASSISTANT_DEAL_NOT_AVAILABLE`. Демо-данные прокси для AI-маршрутов запрещены.

## Пользовательские поверхности

- На публичных страницах сохраняется форма поддержки.
- Внутри private `platform-v7` workspace отображается плавающий помощник.
- Полноэкранный маршрут: `/platform-v7/assistant`.
- Контекст текущей сделки определяется из серверно проверенного маршрута `/platform-v7/deals/:id/execution`.
- Поддерживаются RU/EN/ZH, клавиатура, Escape, focus trap, mobile bottom sheet и reduced motion.

## Бесплатный режим

Никакой дополнительной настройки не требуется:

```env
AI_ASSISTANT_PROVIDER=local
```

Ответы формируются детерминированно из доступного реестра и workspace. Это рабочий режим для разработки, внутренней проверки и банковской демонстрации на синтетическом/контролируемом контуре. Он не является универсальной LLM и не должен выдаваться за подключённый внешний GenAI-сервис.

## Локальная модель через Ollama

Пример конфигурации:

```env
AI_ASSISTANT_PROVIDER=openai-compatible
AI_ASSISTANT_BASE_URL=http://127.0.0.1:11434/v1/
AI_ASSISTANT_MODEL=qwen3:8b
AI_ASSISTANT_ALLOWED_HOSTS=127.0.0.1,localhost
```

Пример запуска модели вне приложения:

```bash
ollama pull qwen3:8b
ollama serve
```

API-ключ для локального Ollama не требуется. Приложение отправляет модели только минимизированный, уже разрешённый сервером контекст. Если локальная модель недоступна или возвращает ошибку, сервис безопасно переключается на `local-deterministic`.

## Подключение корпоративного провайдера

Провайдер должен предоставлять OpenAI-compatible `chat/completions`. Перед использованием реальных данных обязательны:

- корпоративный договор/оферта на юридическое лицо;
- российский контур обработки и хранения;
- запрет обучения на данных платформы;
- утверждённые retention и deletion policies;
- HTTPS;
- точный host allowlist;
- secret manager для API key;
- отдельная правовая и security-приёмка.

Пример:

```env
AI_ASSISTANT_PROVIDER=openai-compatible
AI_ASSISTANT_BASE_URL=https://approved-provider.example/v1/
AI_ASSISTANT_MODEL=approved-model
AI_ASSISTANT_API_KEY=from-secret-manager
AI_ASSISTANT_ALLOWED_HOSTS=approved-provider.example
```

## Запрещённые возможности

Помощник не может:

- подтверждать резерв или выпуск денег;
- создавать банковские callbacks;
- менять state machine Сделки;
- выбирать победителя аукциона;
- подписывать документы;
- менять лабораторный результат;
- открывать или решать спор без доменной команды и полномочий;
- видеть чужой tenant, организацию, кабинет или роль-private поля;
- использовать текст документа как системную инструкцию.

## Следующий уровень

Командные AI-tools допускаются только отдельным этапом после read-only acceptance. Каждый инструмент должен использовать существующую доменную команду, idempotency key, optimistic concurrency, подтверждение пользователя, MFA/JIT при необходимости, audit и outbox. Модель не становится authority ни на одном этапе.

## Приёмка текущего этапа

Обязательные проверки:

- API typecheck;
- web typecheck;
- Jest/Vitest unit tests;
- недоступная сделка не вызывает workspace read;
- prompt хранится в audit только как SHA-256 hash и длина;
- browser storage не содержит историю сделки;
- proxy не выдаёт demo response для AI;
- внешний host не вызывается без allowlist;
- direct Anthropic/OpenAI SaaS вызовы отсутствуют;
- assistant route имеет `noindex`;
- RU/EN/ZH и mobile layout присутствуют.
