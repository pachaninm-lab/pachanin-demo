# Commercial expansion gap analysis

## Итог

Из шести запрошенных направлений два уже есть в продукте частично и их надо не изобретать заново, а доводить до жёсткого execution-grade состояния:
- страхование внутри workflow;
- расширение на смежные культуры.

Четыре направления не имеют полного готового модуля, но у них уже есть сильный фундамент и их правильно строить как расширение текущего execution rail, а не как отдельные витрины:
- второй bank adapter (РСХБ);
- ESG по сделке;
- AI по quality delta и предиктивному спору;
- экспортные маршрутные шаблоны.

## Что уже есть в репозитории

### 1. Страхование
Есть UI-контур страхования, экран расчёта премии, привязка к dealId и оформление полиса из контекста сделки.
Есть E2E-цепочка dispute -> insurance -> claim в локальном deep-readiness зеркале.
Но до идеала не хватает главного: страхование пока не является обязательным event-driven слоем release policy.

### 2. Банки
Текущий bank rail ориентирован на Сбер.
Есть общие integration contracts для банка как системы reserve / hold / release.
В локальном зеркале уже есть справочный entry по Россельхозбанку, но нет полноценного adapter parity со Сбером.

### 3. ESG
Прямого ESG-модуля нет.
Но уже есть то, на чём он должен строиться: маршрут, транспорт, distance, shipment context, export pack и evidence layer.

### 4. AI quality / predictive arbitration
Прямого модуля нет.
Но уже есть lab, dispute, settlement, risk scoring и evidence pack.
Это значит, что базовый predictive слой можно ставить поверх уже существующих данных.

### 5. Экспортные маршрутные шаблоны
Есть export packs, route-planner foundation и экспортный контур в моделях компаний и логистики.
Нет готовых corridor templates по Тамбову с документными воротами и release blockers.

### 6. Смежные культуры
Культуры уже заведены шире одной пшеницы.
Но rollout нельзя делать просто через список культур — нужны отдельные quality, settlement, document и dispute rules для каждой культуры.

## Как доводить до идеала

### 1. Страхование внутри workflow
Делать как обязательный execution layer:
- offer на этапе deal_created / contracting;
- issue policy до loading / gate-in;
- привязка claim-event к route, weighbridge, lab protocol и shortage;
- claim clearance как release gate;
- insurance artifacts входят в evidence pack и dispute pack.

### 2. Адаптер РСХБ
Делать не как отдельный UI-клон, а как второй provider в единой bank abstraction:
- один canonical payment intent;
- один release policy engine;
- provider-specific mapping для reserve / hold / release / statement callback / credit application;
- один read-model для deal finance cockpit.

### 3. ESG
Делать минимальный, честный слой:
- считать CO2e по ton-km и типу транспорта;
- сохранять расчёт в evidence pack;
- помечать методику как pilot default, пока нет внешней верификации;
- не обещать «зелёный сертификат» как официальный документ платформы без внешнего стандарта.

### 4. AI quality / predictive dispute
Делать строго assistive, не decision-making:
- прогноз price delta по культуре и лабораторным отклонениям;
- dispute outcome probability;
- обязательное объяснение факторов;
- запрет на auto-decision без человека.

### 5. Экспортные маршруты
Делать как corridor templates:
- Тамбов -> Новороссийск;
- Тамбов -> Астрахань;
- этапы маршрута;
- обязательные документы;
- портовые blockers;
- release gate только после export-doc readiness.

### 6. Смежные культуры
Делать только после execution proof:
- сначала 5+ закрытых release-ready сделок по пшенице;
- потом ячмень;
- потом подсолнечник;
- для каждой культуры свой quality delta table, own basis, own dispute policy.

## Приоритет внедрения

P0:
1. Страхование внутри workflow.
2. РСХБ adapter.
3. Predictive quality delta / dispute assist.

P1:
4. Экспортные маршрутные шаблоны для Тамбовского пилота.
5. Rollout ячменя.

P2:
6. ESG-трекер.
7. Rollout подсолнечника.

## Что сделано сейчас

Добавлен typed domain module `packages/domain-core/src/commercial-expansion.ts`, в котором собраны:
- event rules для страхования;
- реестр bank rails Сбер / РСХБ;
- базовый расчёт углеродного следа сделки;
- расчёт ожидаемой quality delta;
- predictive dispute scoring;
- экспортные corridor templates;
- gated policy для rollout смежных культур.

Это честный preintegration слой: логика уже описана и формализована в коде, но её ещё нужно подключить к текущим controller / runtime / UI surface.
