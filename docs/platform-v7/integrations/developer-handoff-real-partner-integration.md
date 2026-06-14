# Developer Handoff — подключение реальных партнёров (§43)

Цель документа: дать разработчику интеграции одну карту — где именно подменить
симуляцию на боевой контур, какой контракт реализовать, какие переменные
окружения и доступы нужны. Платформа спроектирована так, что код приложения,
доменная логика и UI **не меняются** при переходе mock → real: меняется только
реализация адаптеров и регистрация боевого реестра.

## 1. Один шов на всё — фабрика адаптеров

| Что | Файл | Роль |
|-----|------|------|
| Контракт адаптера | `apps/web/lib/platform-v7/external-adapters.ts` | `PlatformV7ExternalAdapter<TRequest, TResponse>`, типы запросов по системам, `PlatformV7AdapterRegistry` |
| Симуляция (по умолчанию) | `external-adapters.ts` → `platformV7CreateMockAdapterRegistry()` | мок-реестр для пилота/песочницы |
| Переключатель mock↔real | `apps/web/lib/platform-v7/adapter-factory.ts` | `platformV7CreateAdapterRegistry()` + регистрация боевого реестра |
| Образец боевого адаптера | `apps/web/lib/platform-v7/adapters/real-adapter-template.ts` | копируется и заполняется реальными вызовами |
| Брендинг/статусы партнёров | `apps/web/lib/platform-v7/integrations/providerRegistry.ts` | публичные ярлыки, гейт `canClaimProviderLive` |
| Контракты готовности | `apps/web/lib/platform-v7/integration-readiness.ts` | можно ли показывать внешнее подтверждение и влиять на деньги |

### Как подключить партнёра (порядок шагов)

1. Скопируйте `real-adapter-template.ts` и реализуйте `call()`/`healthCheck()` —
   реальные вызовы API партнёра, сохраняя контракт `PlatformV7ExternalCallResult`
   (поле `doesNotConfirmExternally: true` обязательно — внешний адаптер сам факт
   не подтверждает, подтверждение приходит ответным событием и сверкой).
2. Соберите боевой реестр: `createRealAdapterRegistryFromConfig(config)`.
3. Зарегистрируйте его один раз при старте приложения:
   ```ts
   platformV7RegisterRealAdapterRegistry(() => createRealAdapterRegistryFromConfig(config));
   ```
4. Переключите окружение: `NEXT_PUBLIC_PLATFORM_V7_ENVIRONMENT=production`.
   Только `production` переводит фабрику в режим `real` (см.
   `platformV7ResolveAdapterMode`). До регистрации боевого реестра режим `real`
   падает с понятной ошибкой — молчаливой подмены данных не будет.

## 2. Карта швов по партнёрам

Каждый партнёр имеет один и тот же паттерн: **интерфейс запроса** в
`external-adapters.ts`, **мок** в `*-adapter-emulator.ts`, **точку подмены** в
реестре. Боевая реализация — это новый класс/функция, реализующая
`PlatformV7ExternalAdapter`.

| Партнёр | Система | Интерфейс запроса | Мок-эмулятор | Что нужно для live |
|---------|---------|-------------------|--------------|--------------------|
| Банк (эскроу/безопасная сделка) | `bank` | `PlatformV7BankRequest` | `bank-adapter-emulator.ts` | Договор, номинальный счёт, credentials, callback-эндпоинт подтверждений |
| ФГИС «Зерно» / СДИЗ | `fgis` | `PlatformV7FgisRequest` | `fgis-adapter-emulator.ts` | Доступ к контуру ФГИС, сверка маршрута СДИЗ |
| ЭДО (СБИС/Диадок) | `edo` | `PlatformV7DocumentExchangeRequest` | `edo-adapter-emulator.ts` | Договор с оператором ЭДО, КЭП, статусы подписания |
| ГИС ЭПД / ЭТрН | `epd` | `PlatformV7TransportDocumentRequest` | `epd-adapter-emulator.ts` | Договор с оператором ИС ЭПД, доступы, маршрут титулов |
| Логистика / GPS-телематика | `logistics` | `PlatformV7LogisticsAdapterRequest` | мок-фабрика (без класса-эмулятора) | Подключение телематики (Wialon/Сфера), события маршрута |
| Лаборатория | `lab` | `PlatformV7LabAdapterRequest` | мок-фабрика + домен `quality-model.ts` | Договор с лабораторией, формат протокола качества |
| 1С / учётный контур | `oneC` | `PlatformV7OneCAdapterRequest` | мок-фабрика | Доступ к 1С/учётной системе |
| Уведомления | `notification` | базовый запрос | мок-фабрика | Провайдер рассылок |

Доменное влияние (вес/качество/деньги) считается **отдельно** от транспорта
вызова и остаётся неизменным:
- вес: `calculateElevatorWeightImpact()` в `deal-execution-source-of-truth.ts`;
- качество: `calculateLabQualityImpact()` там же;
- деньги/основание: `selectDealMoneyState()`, `isSdizLifecycleBlockingMoneyRelease()`.

## 3. Персистентность (БД)

| Что | Файл | Замена на боевую БД |
|-----|------|---------------------|
| Контракты портов | `apps/web/lib/platform-v7/runtime/persistence-ports.ts` | реализовать `P7RuntimeUnitOfWork` (8 репозиториев) поверх реальной БД |
| Мок-хранилище (in-memory) | `apps/web/lib/platform-v7/runtime/mock-persistence-adapter.ts` | заменить на адаптер БД с теми же сигнатурами |
| Прикладной сервис | `apps/web/lib/platform-v7/runtime/application-service.ts` | не меняется — работает через `P7ApplicationServiceDependencies` |

Идемпотентность, версионирование (optimistic concurrency), транзакции и аудит
уже заложены в контракт портов — боевой адаптер обязан их соблюсти.

## 4. Гейты честности (нельзя обойти)

- `canClaimProviderLive()` (`providerRegistry.ts`) допускает статус «боевой» только
  при наличии договора, credentials, callback-ов и подтверждённых операций.
  `assertProviderLiveClaimIsAllowed()` бросает ошибку, если это не так.
- `integration-readiness.ts` держит все системы в `requires_connection` /
  `manual_review` до реального подключения: внешнее подтверждение и влияние на
  деньги заблокированы, пока контур не подтверждён.
- `platformV7CanShowAsLive()` (`environment.ts`) показывает «боевой» только в
  `production`.

## 5. Переменные окружения

| Переменная | Назначение | Значение для пилота |
|------------|------------|---------------------|
| `NEXT_PUBLIC_PLATFORM_V7_ENVIRONMENT` | режим контура (pilot/sandbox/demo/production) | `pilot` |
| `BANK_*`, `FGIS_*`, `EDO_*`, `EPD_*`, `LOGISTICS_*`, `LAB_*` | базовые URL и ключи партнёров | задаются на этапе live |

Конкретный набор полей на партнёра описывается в `RealAdapterEndpointConfig`
(`real-adapter-template.ts`) и расширяется под требования партнёра (mTLS,
идентификаторы организации и т.п.).

## 6. Что остаётся owner-side (§43)

Подключение фабрики готово. Вне кода остаётся: подписание договоров, получение
API-доступов и credentials, открытие номинального счёта, юридическая проверка,
security review и реальные пилотные сделки. После этого — реализация боевых
адаптеров по образцу и регистрация боевого реестра.
