# Integration Connect Guide

Что осталось, чтобы превратить пилот в боевой контур: **подключить**, а не переписывать.
Весь транспортный слой уже готов и покрыт тестами — на каждую систему остаётся только
(1) задать env, (2) написать `Live<Name>Adapter` по эталону, (3) выверить endpoint/маппинг под реальный API.

## Что уже готово (общий слой, `src/live/`)

| Компонент | Файл | Назначение |
|---|---|---|
| HTTP-клиент | `http-integration-client.ts` | timeout, retry+backoff+jitter, idempotency-key, auth-заголовки, нормализация ошибок, PII-маскирование логов, health-check |
| Auth | `auth.ts` | `noAuth`, `apiKeyAuth`, `bearerAuth`, `oauth2ClientCredentials` (с кэшем токена) |
| Конфиг | `integration-config.ts` | чтение `<NAME>_*` из env + **fail-closed** `assertLiveReady` |
| Фабрика клиента | `build-client.ts` | `config → HttpIntegrationClient` c нужным auth |
| База адаптера | `live-adapter-base.ts` | реализует `IntegrationAdapter` (name/version/mode/execute/health) |
| Реестр по режиму | `live-registry.ts` | `configureIntegrationsFromEnv()` — подменяет mock на live по `<NAME>_MODE` |
| **Эталоны** | `live-bank.adapter.ts`, `live-fgis-zerno.adapter.ts` | два готовых live-адаптера как шаблон |

Все ветки покрыты unit-тестами (fake `fetch`, без реальной сети).

## Конвенция env (на каждую систему `<NAME>`)

```
<NAME>_MODE            disabled | stub | sandbox | live     # по умолчанию stub (mock)
<NAME>_BASE_URL        https://api.vendor.example/v1         # обязателен для sandbox/live
<NAME>_AUTH            none | api_key | bearer | oauth2
<NAME>_API_KEY_HEADER  X-API-Key                             # для api_key
<NAME>_API_KEY         ...
<NAME>_BEARER_TOKEN    ...                                   # для bearer
<NAME>_OAUTH_TOKEN_URL / _OAUTH_CLIENT_ID / _OAUTH_CLIENT_SECRET / _OAUTH_SCOPE   # для oauth2
<NAME>_TIMEOUT_MS      15000
<NAME>_MAX_RETRIES     3
```

При `MODE=live/sandbox` и отсутствии обязательных полей приложение **падает на старте** (`assertLiveReady`) — тихой деградации в mock не будет.

## Как подключить одну систему (3 шага)

1. **env** — задать `<NAME>_MODE=live` + `BASE_URL` + auth-поля.
2. **Live-адаптер** — если ещё нет: скопировать `LiveBankAdapter`, реализовать методы интерфейса через `this.http.request(...)`, зарегистрировать в `LIVE_ADAPTER_FACTORIES` (`live-registry.ts`).
3. **Маппинг** — выверить пути и поля запроса/ответа под реальный API вендора (места помечены `VENDOR MAPPING`).

Затем на старте API однократно вызвать `configureIntegrationsFromEnv()` — он подменит mock на live там, где `MODE=live`.

## Матрица систем

| Adapter (`NAME`) | Система | Тип auth | Live-класс | Осталось |
|---|---|---|---|---|
| `BANK` | Банк / эскроу (Сбер и др.) | oauth2 / mTLS | ✅ `LiveBankAdapter` | endpoint+маппинг, mTLS на деплое |
| `FGIS_ZERNO` | ФГИС «Зерно» (СДИЗ) | api_key / oauth2 | ✅ `LiveFgisZernoAdapter` | endpoint+маппинг |
| `DIADOK` | ЭДО Контур.Диадок (УПД/акты) | oauth2 | ⬜ по эталону | + вебхуки статусов |
| `CRYPTOPRO_DSS` | КриптоПро DSS (КЭП/МЧД) | oauth2 / mTLS | ⬜ по эталону | подпись/проверка, сертификаты |
| `GIS_EPD` | ГИС ЭПД (перевозочные) | api_key | ⬜ по эталону | endpoint+маппинг |
| `RZD_ETRAN` | РЖД ЭТРАН (ж/д накладные) | bearer | ⬜ по эталону | endpoint+маппинг |
| `FNS` | ФНС (проверка контрагента) | api_key | ⬜ по эталону | endpoint+маппинг |
| `FTS` | ФТС (таможня/экспорт) | api_key | ⬜ по эталону | endpoint+маппинг |
| `RSHN` | Россельхознадзор | api_key | ⬜ по эталону | endpoint+маппинг |
| `AML_ROSFINMONITORING` | Росфинмониторинг (AML) | api_key | ⬜ по эталону | endpoint+маппинг |
| `BKI_NBKI` | БКИ / НБКИ | bearer | ⬜ по эталону | endpoint+маппинг |
| `TAKSKOM` | Такском (ЭДО/ОФД) | oauth2 | ⬜ по эталону | endpoint+маппинг |
| `GPS` | GPS-трекинг (Wialon/ATI) | api_key | ⬜ по эталону | endpoint+маппинг |
| `MARINE_TRAFFIC` | Marine Traffic (суда) | api_key | ⬜ по эталону | endpoint+маппинг |
| `SMEV` | СМЭВ (гос-межвед) | mTLS | ⬜ по эталону | СМЭВ-конверты, mTLS |

✅ — эталон готов · ⬜ — пишется копипастой эталона (интерфейс уже есть, транспорт общий)

## Отдельно от адаптеров (инфраструктура боевого запуска)

- **Секреты/сертификаты**: боевые ключи (КриптоПро, mTLS банка/СМЭВ) + ротация; `assertLiveReady` уже проверяет наличие header-креды.
- **Вебхуки**: приём с проверкой подписи уже есть (`security/webhook-security`, контроллеры ФГИС/ЭДО/bank-callback) — сверить секреты по вендору.
- **Состояние**: вынести in-memory (пользователи, lockout, эскроу-кэш) в Redis/БД для многоинстансности.
- **Контрактные тесты** против sandbox каждой системы до перевода `MODE=live`.
