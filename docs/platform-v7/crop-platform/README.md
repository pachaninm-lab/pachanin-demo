# PC-CROP — расширение «Прозрачной Цены» на всё растениеводство

Статус: `GOVERNANCE_BASELINE_IN_PROGRESS`  
Master issue: `#2871`  
Exact-main baseline: `6f074942b46e226982e646c6f688886504b712ce`  
Production claim: `NOT_ATTESTED`

## Цель

Развивать существующий контур исполнения Сделки, а не создавать отдельный crop-продукт. Канонический агрегат остаётся `Deal`; товарные профили, происхождение, качество, логистика, документы, деньги, споры и доказательства присоединяются к нему через версионируемые правила и события.

## Неподвижные границы

- PostgreSQL и domain services — единственный authority для транзакционного состояния.
- Роль, tenant, membership и право на действие определяются сервером.
- Новые деньги, масса, объём, цена и корректировки — только fixed precision; legacy `Float` не расширяется.
- Внешние системы подключаются через adapter SPI, outbox/inbox, idempotency и reconciliation.
- Внешний ACK допускается только после durable persistence.
- Evidence не перезаписывается и не хранится только в AI/search/vector read model.
- TAI получает read/prepared-action tools без прямого privileged write.
- `live`, `production`, `available` и аналогичные статусы допустимы только при machine-readable evidence.

## Состав PC-CROP-00

| Файл | Назначение |
|---|---|
| `governance.v1.json` | Единый source/requirement/gap/plan/UX/acceptance registry |
| `UX-CONTRACT.md` | Обязательный intent-first UX, mobile/offline, accessibility и AI boundary |
| `ADR-001-commodity-profile-and-deal-state.md` | Решения по CommodityProfile и многомерному Deal state |

## Очерёдность после принятия baseline

1. `PC-CROP-01` — Canonical Commodity Profile Registry.
2. `PC-CROP-07` — Regulatory Integration Gateway core.
3. `PC-CROP-08` — FGIS Grain API 1.0.23 adapter.
4. `PC-CROP-02` — production passport и genealogy.
5. `PC-CROP-11/12` — quality/evidence/logistics/offline.
6. `PC-CROP-13/14` — settlement/dispute.
7. Rollout по архетипам только после соответствующих E2E, external evidence и legal activation gates.

## Граница текущего slice

Этот slice фиксирует архитектурную и UX-власть. Он не добавляет таблицы, внешние вызовы, секреты, новые production claims или параллельную state machine. Runtime-изменения начинаются отдельным узким PR после принятия ADR и gap-map.
