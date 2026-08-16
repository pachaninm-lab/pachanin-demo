# Integration Compatibility — PC-CROP Federal Accounting

§Q контракта: разработку нельзя блокировать ожиданием коммерческого договора.
Для каждого vendor: provider-neutral интерфейс → адаптер по официальной документации →
staging/test credentials если доступны → contract tests → production активация только
с реальными официальными credentials.

§R: новых обязательных расходов **0 ₽**. Клиентские лицензии 1С/ЭДО/КЭП — расходы клиента.

---

## 1. Сводка

| Vendor | Provider-neutral слой | Адаптер | Test creds | Prod creds | Макс. достижимо без договора |
|---|---|---|---|---|---|
| 1С (локальная/сервер) | нет | нет | н/д | нет | 60% от 8% = 4.8% |
| 1С:Фреш | нет | нет | нет | нет | требует partner track |
| Диадок (Контур) | нет | нет | нет | нет | 60% от 7% = 4.2% (совместно с Saby) |
| Saby (Тензор) | нет | нет | нет | нет | — |
| ФГИС «Зерно» | **есть основа** | `FgisGrainExchange` + провайдерские конфигурации/аттестации | неизвестно | не подтверждено | 60% от 4% = 2.4% |
| ГИС ЭПД | нет | нет | нет | нет | 60% от 4% = 2.4% |
| Банк | **есть** | `bank-reconciliation`, `BankStatementEntry`, `WebhookIdempotency`, ротация ключей | — | — | вне периметра этой программы |

Итого по waves 6–8: без vendor-договоров недостижимо примерно **9.2%** из 23% веса.

## 2. ФГИС «Зерно» — единственная зрелая интеграция

Существующие модели (`apps/api/prisma/schema.prisma`):

```
FgisGrainExchange
FgisGrainAcknowledgement
FgisGrainSdizProjection
FgisGrainSdizProjectionBatch
FgisGrainProviderConfiguration
FgisGrainProviderAttestation
FgisGrainTenantReadAuthorization
FgisGrainTenantReadProviderClaim
FgisGrainTenantReadAudit
FgisGrainTenantReadAuditHead
```

Присутствуют версионирование провайдера, аттестации и аудит чтения по тенантам —
то есть именно то, что §27 требует от `GrainIntegrationAdapter`.

**Вывод.** `GrainSdizReference` из §27 не создавать заново. Требуется маппинг полей
`external_sdiz_id` / `operation_type` / `external_status` / `external_revision` /
`provider_api_version` на существующую `FgisGrainSdizProjection` и дополнение недостающих.

## 3. 1С — что уже можно строить без vendor-договора

По §Q полностью реализуемо оффлайн:

- `ConnectorInstallation` / `OrganizationBinding` (одна база — много юрлиц, §23);
- typed command allowlist (7 команд §23) без произвольного SQL/кода;
- pairing по одноразовому коду с TTL → machine identity;
- self-discovery payload и `OneCCompatibilityProfile` registry;
- pull-протокол `/connector/v1/*` и состояния синхронизации;
- contract tests протокола.

Не реализуемо без внешних решений: сертификация «1С:Совместимо», публикация в 1С:Фреш,
production-приёмка на реальной базе клиента.

## 4. ЭДО — маршрутизация до адаптеров

§25 задаёт `EdoRoute`: `ONE_C_EDO`, `DIRECT_DIADOC`, `DIRECT_SABY`, `OTHER_ADAPTER`, `MANUAL`.
Важное архитектурное следствие: если клиент уже работает через 1С-ЭДО, второй канал не подключать.
Значит порядок реализации — сначала маршрут `ONE_C_EDO` поверх 1С-коннектора, и только затем
прямые адаптеры Диадок/Saby.

Provider-neutral состояния (§25) реализуемы и тестируемы оффлайн полностью,
включая ключевое правило: **timeout после отправки → `UNKNOWN`, не «успех»**,
и обязательная reconciliation перед retry.

## 5. Что требуется от владельца для перехода к production-доле

| Vendor | Минимальное внешнее действие |
|---|---|
| 1С | Регистрация в «1С:Совместимо» / partner track для Фреш |
| Диадок | Регистрация приложения + письменные multi-tenant SaaS-условия |
| Saby | Письменные API/SaaS-условия, лимиты и scopes |
| ФГИС «Зерно» | Подтверждение действующих production-доступов оператора |
| ГИС ЭПД | Договор с оператором ИС ЭПД |

Ни одно из них не выполняется из репозитория и ни одно не оплачивается платформой
без отдельного решения владельца (§R).
