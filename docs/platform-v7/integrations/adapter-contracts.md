# Adapter Contracts — platform-v7

Master-ТЗ 3+ §19 supporting doc. Все внешние контуры имеют live-ready контракты
**без live-вызовов** (mock provider сейчас, live provider placeholder).

## Адаптеры (как в коде)

| Adapter | Реализация | Mock provider |
|---------|------------|---------------|
| BankAdapter | `bank-adapter-emulator.ts`, `bank-webhooks.ts` | ✓ |
| FgisAdapter | `fgis-adapter-emulator.ts` | ✓ |
| EdoAdapter | `edo-adapter-emulator.ts` | ✓ |
| EpdAdapter | `epd-adapter-emulator.ts` | ✓ |
| ElevatorAdapter | `weighing-model.ts`, `logistics-receiving-gate.ts` | ✓ |
| LabAdapter | `quality-model.ts`, `quality-control-gate.ts` | ✓ |
| GpsAdapter | `logistics/*`, `trip-state-model.ts` | ✓ |
| NotificationAdapter | `shellNotifications.ts`, notification model | ✓ |
| AiProviderAdapter | `ai/*`, `decision-recommendation.ts` | ✓ |
| ErpExportAdapter | `audit-evidence-export.ts`, `case-pack.ts` | ✓ |

Общие контракты и реестр: `external-adapters.ts`, `integrations/**`, `connector-model.ts`,
`integration-readiness.ts`, `api-contracts.ts`, `api-payload-validator.ts`.

## Требования к каждому адаптеру (§19)

request schema, response schema, error schema, status mapping, retry policy, timeout,
idempotency, replay, integration journal, mock provider, live provider placeholder,
**no live credentials**.

## DoD

- Каждый внешний обмен логируется (integration journal + audit).
- Каждый adapter имеет mock provider.
- Live provider добавляется без переписывания deal runtime (порт стабилен).
- Ошибка внешней системы не ломает сделку (retry/idempotency/manual fallback, §33).

Тесты: `platformV7RuntimeIntegration.test`, `platformV7ApiContracts.test`,
`platformV7ServiceBoundaryRunner.test`.

## Остаток (live-only, §43)

Реальные credentials, договоры и live-эндпойнты банка/ФГИС/ЭДО/ЭПД/элеватора/лаборатории/GPS.
Подключаются заменой mock provider на live за стабильным портом.
