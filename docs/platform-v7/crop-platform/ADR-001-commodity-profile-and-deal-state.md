# ADR-001: Versioned CommodityProfile + parallel Deal state dimensions

Status: `PROPOSED_FOR_PC-CROP-00_ACCEPTANCE`  
Baseline: `6f074942b46e226982e646c6f688886504b712ce`  
Issue: `#2871`

## Context

Текущий код уже имеет канонический `Deal`, PostgreSQL persistence, event/outbox foundations, документы, логистику, лабораторию, деньги и споры. Одновременно часть grain-specific атрибутов находится непосредственно в `Deal`, а состояние выражается преимущественно одним `status`. Расширение на всё растениеводство нельзя делать копированием моделей по культурам или раздуванием одного enum.

## Decision A — Commodity Profile

Выбран **versioned registry внутри существующего modular monolith**, с отдельной доменной моделью и pinned reference на Lot/Deal.

### Рассмотренные варианты

| Вариант | Скорость | Риск | Масштаб | Обратимость | Решение |
|---|---:|---:|---:|---:|---|
| Hard-coded branches по культурам | высокая сначала | критический | низкий | низкая | отклонён |
| JSON blob непосредственно в Deal | высокая | высокий drift/validation | средний | средняя | отклонён |
| YAML/JSON files как runtime authority | средняя | deployment coupling | средний | высокая | только seed/import |
| Отдельный Commodity microservice | низкая | distributed consistency | высокий | средняя | преждевременно |
| Versioned registry в modular monolith | средняя | контролируемый | высокий | высокая | выбран |
| Полностью внешний master-data provider | низкая | vendor/access lock-in | высокий | низкая | только adapter source |

### Обязательная модель

`CommodityProfile` содержит stable identity и lifecycle. Каждая `CommodityProfileVersion` содержит:

- product codes and purpose;
- archetype A–F;
- units/conversions;
- quality indicators, methods, precision and missing-value rules;
- sampling/control-sample rules;
- document and registry requirements;
- storage/temperature/shelf-life/packaging;
- acceptance and price-delta policy references;
- release blockers;
- source/legal mappings and effective dates;
- RU/EN/ZH display layer separated from authoritative codes.

Lifecycle: `DRAFT → REVIEW → APPROVED → EFFECTIVE → DEPRECATED → REVOKED`.

Published version is immutable. Correction creates a new version. Lot/Deal pins exact version and hash.

## Decision B — Deal state

Выбрана **многомерная state model с детерминированным projection**, совместимая с текущим `Deal.status` на переходном периоде.

Dimensions:

- `legalState`
- `moneyState`
- `physicalState`
- `qualityState`
- `documentState`
- `disputeState`
- `closureState`

### Рассмотренные варианты

| Вариант | Плюс | Критический минус | Решение |
|---|---|---|---|
| Один расширенный enum | простота чтения | комбинаторный взрыв | отклонён |
| Несколько независимых enum без projection | простота записи | противоречивый UX | отклонён |
| Workflow engine как единственный authority | timers/retries | lock-in и dual authority | отклонён |
| Чистое event sourcing ядра | сильная история | слишком большой migration blast radius | отклонён сейчас |
| Parallel dimensions + projection + events | управляемая миграция | требует строгих invariants | выбран |
| Новый crop-specific state machine | изоляция | параллельный Deal authority | запрещён |

### Migration strategy

1. Добавить dimension fields/read model без удаления legacy `status`.
2. Ввести pure projection `deriveDealState(dimensions, blockers)`.
3. На переходном этапе писать dimensions и legacy projection в одной транзакции.
4. Добавить drift detector: legacy status обязан совпадать с projection.
5. Перевести UI/read API на dimensions + derived status.
6. Удаление legacy authority — отдельный ADR и migration evidence.

## Invariants

- State transition выполняется server-side command policy.
- Pinned CommodityProfileVersion не меняется после award/signing иначе чем formal amendment.
- Dimension update не обходят release blockers.
- Partial acceptance создаёт остаток и денежную корректировку, а не переписывает исходный lot.
- External pending state не выдаётся за success.
- ИИ может объяснять и готовить command, но не является transition authority.

## Consequences

Положительные:

- новая культура добавляется данными и правилами;
- UI получает объяснимые параллельные состояния;
- внешние workflow engines можно подключать как timer/execution capability без передачи domain authority;
- rollback возможен через feature flag и dual-read validation.

Стоимость:

- требуется schema/model validation, approval workflow, cache invalidation и migration/backfill;
- нужны E2E/race/tenant tests для каждого dimension transition;
- необходимо устранить расширение legacy Float-полей в новых моделях.

## Acceptance required before runtime implementation

- exact-head gap-map and dependency plan;
- schema draft for profile/version/indicator/requirement;
- projection truth table and property tests;
- migration/backfill/rollback plan;
- UX state map;
- legal source mapping marked `REVERIFY_BEFORE_REGULATED_RELEASE`.
