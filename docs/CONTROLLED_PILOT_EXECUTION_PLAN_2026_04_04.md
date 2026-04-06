# Controlled pilot execution plan · 2026-04-04

## Цель пилота

Не доказать, что интерфейс красивый, а закрыть 5–10 реальных сделок по execution rail:
- цена;
- сделка;
- логистика;
- приёмка;
- качество;
- документы;
- деньги;
- спор / доказательства.

## Регион

Тамбовская область.

## Обязательные роли пилота

- seller / farmer;
- buyer;
- logistician;
- driver;
- receiving / elevator;
- lab;
- accounting;
- operator.

## Обязательные сценарии

- lot -> match -> deal;
- deal -> docs;
- dispatch -> receiving;
- quality delta;
- hold / release;
- dispute / resolution;
- mobile offline replay.

## Что считается успехом пилота

### Minimum success
- 5 закрытых сделок;
- 0 потерянных money events;
- 0 ownerless disputes;
- 0 dead-end в operator path.

### Strong success
- 10 закрытых сделок;
- хотя бы 1 live connector без manual fallback;
- хотя бы 1 insurance-aware release;
- подтверждённый partial release на uncontested amount.

## Что нужно до live smoke

- поднять web/api/runtime stack;
- закрыть env на runtime host;
- прогнать smoke:api;
- прогнать smoke:web;
- прогнать pilot:smoke;
- подтвердить 7 critical routes 200/302.

## Что нельзя скрывать в пилоте

- manual operator layer;
- sandbox connectors;
- not production-ready bank / insurance links;
- known limitations по fallback surfaces.

## Жёсткий вывод

Пилот можно запускать как controlled pilot.
Нельзя пока честно называть это live-integrated industrial runtime, пока не подтверждён живой smoke и не поднят runtime stack.
