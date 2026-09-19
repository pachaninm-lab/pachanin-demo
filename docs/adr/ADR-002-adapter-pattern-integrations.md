# ADR-002: Adapter Pattern для всех внешних интеграций

**Статус:** Принято  
**Дата:** 2026-01-20  
**Авторы:** Backend Team  

## Контекст

GrainFlow интегрируется с 15+ внешними системами: ФГИС «Зерно», ФНС, КриптоПро DSS, Диадок, Такском, РЖД ЭТРАН, ГИС ЭПД, НБКИ, MarineTraffic, СМЭВ и др. Каждая требует сложного API с разными форматами. В early stage коммерческих контрактов ещё нет — нужны mock-реализации.

## Решение

Всё через `IntegrationAdapter` интерфейс + `IntegrationRegistry` синглтон:

```typescript
// packages/integration-sdk/src/adapter.interface.ts
interface IntegrationAdapter {
  readonly name: string;
  readonly version: string;
  readonly mode: 'mock' | 'sandbox' | 'live';
  execute(request: { action: string; [k: string]: unknown }): Promise<unknown>;
  healthCheck(): Promise<HealthStatus>;
}

// Регистрация
integrationRegistry.register('FNS', new MockFnsAdapter());
// Замена на live без изменения бизнес-логики:
integrationRegistry.register('FNS', new LiveFnsAdapter(apiKey));
```

Бизнес-логика использует только `integrationRegistry.get('FNS')` — не знает ни о mock, ни о live.

## Последствия

- `+` Mock → Live замена без изменения кода бизнес-логики
- `+` Независимое тестирование каждого адаптера
- `+` `healthCheckAll()` для мониторинга всех интеграций
- `+` Единая точка регистрации (registry.ts) — легко проверить список
- `-` Слабая типизация `execute()` с `unknown` return — требует type assertion

## Текущие адаптеры (15 mock-реализаций)

`FGIS_ZERNO`, `FNS`, `DIADOK`, `CRYPTOPRO_DSS`, `BANK`, `GPS`, `FTS`, `RSHN`, `AML_ROSFINMONITORING`, `RZD_ETRAN`, `GIS_EPD`, `BKI_NBKI`, `TAKSKOM`, `MARINE_TRAFFIC`, `SMEV`
