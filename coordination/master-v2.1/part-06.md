Рекомендуемая логика очереди: R0 release authority; общие prerequisites R6 и защищённого core; R1 Founder/13; R2 public shell; необходимые data contracts и R3/R4; R5 ФНС; затем по зависимостям защищённый R7 с обязательными для выбранного коридора R8/R9; оставшиеся R8/R9 capabilities; R10; R11; R12. Окончательная очередь опирается на текущий код, без повторной реализации существующего.

| **Дополнительный slice**        | **Владелец** | **Результат и обязательные семейства**                               |
|---------------------------------|--------------|----------------------------------------------------------------------|
| Channels and private draft      | R7           | ORI и IVX 001–003; 4 origins, private visibility, stock conservation |
| Forward and storage             | R7 и R9      | IVX 004–007; future-to-physical, warehouse/corridor rules            |
| Constitution and tranches       | R7           | PD; принятие условий и независимые физические/финансовые отгрузки    |
| Quality and basis               | R7           | QLX и SBX; sample custody, formula, approved amount basis            |
| Dispute and authority           | R7           | DPX; scoped hold, undisputed release, four-eyes                      |
| Bank and compliance             | R9 с R7      | BNX; contract-backed capability, reconciliation и restrictions       |
| Regulatory and accounting       | R8 и R9      | ACX; ФГИС/СДИЗ/OTC, ЭПД, 1С, four-way reconciliation                 |
| Evidence and field UX           | R7 и R11     | EVX; bundle, Passport, offline pending, incident readiness           |
| Economics and commercialization | R3 и R4      | ECX и GTX; измерение value, CM2, CAC и CRM без фиктивных фактов      |
| Subscription billing            | R9           | BLX; отдельный A23, не блокирует бесподписочную сделку               |
| Corporate and legal             | R1 и R12     | CPX и LGX; реестры, RACI, claims, applicable external approvals      |
| Gekta product domains           | R10          | GKX и существующий AI lifecycle                                      |

Семейства выше дополняют, а не заменяют REQ основных R-разделов. У общего REQ ровно один delivery owner; остальные R перечисляются как consumers. Один evidence может закрывать несколько условий, но баллы не дублируются. Применимые legal/security/DR требования действуют перед каждым затронутым запуском, а не откладываются до R12.

Для внешнего блокера разрешён только явно записанный переход: остановить заблокированный slice в безопасном состоянии, зафиксировать недостающее полномочие и dependency impact, затем выбрать действительно независимый разрешённый slice. Если сам переход требует новой authority, Codex останавливается и запрашивает её. Blocked slice не считается production-complete.

## R0 Фактическое состояние и release authority 5 points

### Цель

Устранить governance/review/release blockage, получить достоверную карту remaining scope и единый воспроизводимый путь exact-head → exact-SHA production.

### Атомарные срезы

1.  `R0.1` Repository, PR, CI, migration и production inventory.
2.  `R0.2` Qwen/Mistral review-provider authority и fail-closed validator.
3.  `R0.3` Exact-head admission, immutable evidence и main-drift handling.
4.  `R0.4` Exact-current-main REG.RU release rehearsal и live smoke.

### Требования и приёмка

`[REQ-R0-001]` Review verdict принимается только от authorized pinned provider/model contract и относится к exact head SHA.

`[REQ-R0-002]` Старый review не переносится на новый SHA; rerun без анализа причины не считается исправлением.

`[REQ-R0-003]` CI не зависит от floating packages, unavailable offline metadata или непроверенного download at release time.

`[REQ-R0-004]` Main drift автоматически инвалидирует stale evidence или требует доказанной merge-base совместимости.

`[REQ-R0-005]` Release содержит source SHA, image digest, migrations, SBOM, provenance и rollback target.

`[REQ-R0-006]` Live endpoint, version endpoint, DB schema head и deployed image подтверждают один exact release.

`R0_PASS`: review/admission воспроизводим; current main выпускается на REG.RU; live smoke, rollback readiness и evidence PASS.

## R1 Founder CEO Control Center и 13 ЛК 7 points

### Атомарные срезы

1.  `R1.1` Server-side inventory фактических 13 кабинетов и полномочий.
2.  `R1.2` Controlled open-as-role session.
3.  `R1.3` CEO overview и decision queue.
4.  `R1.4` Cash/runway, pipeline, client P&L, AR/DSO, forecast, retention, hiring и scale gates.
5.  `R1.5` 13/13 desktop/mobile live acceptance и возврат в Control Center.

### Требования и приёмка

`[REQ-R1-001]` Company Health объединяет business, operations, finance, risk и system health, но каждая цифра имеет источник и drill-down.

`[REQ-R1-002]` P0/P1 queue показывает owner, deadline, impact, next action и escalation.

`[REQ-R1-003]` Founder role-mode не создаёт служебную роль в домене и не ослабляет tenant/role authority.

`[REQ-R1-004]` 13/13 кабинетов открываются, выполняют разрешённое read/action, возвращаются в Control Center и корректно обрабатывают denied/high-risk actions.

`[REQ-R1-005]` Fake/demo fallback и client-selected role отсутствуют.

`R1_PASS`: exact-SHA live 13/13 matrix PASS, Founder metrics real-data-only, security negative tests PASS.

## R2 Public Shell и главная 5 points

### Атомарные срезы

1.  `R2.1` Единый PublicHeader component и tokens.
2.  `R2.2` Главная, value proposition, доверие и conversion path.
3.  `R2.3` Все публичные дочерние маршруты.
4.  `R2.4` RU/EN/ZH, mobile, accessibility, SEO и link integrity.

### Требования и приёмка

`[REQ-R2-001]` Один header contract покрывает полный route inventory; visual regression доказывает одинаковые размеры и позицию логотипа.

`[REQ-R2-002]` Дополнительная функция страницы располагается в предусмотренном contextual slot.

`[REQ-R2-003]` Все ссылки дают корректный маршрут, back/forward, canonical URL, metadata и отсутствие 404/redirect loop.

`[REQ-R2-004]` Главная объясняет продукт, полный путь сделки, доверие, Гекту, роли и CTA регистрации без неподтверждённых обещаний.

`[REQ-R2-005]` Desktop и mobile acceptance проходит на реальных production assets; logo не исчезает и не прыгает.

`R2_PASS`: public route matrix, header visual regression, i18n, accessibility, SEO/indexing и live conversion path PASS.

## R3 Аналитический dashboard 6 points

### Атомарные срезы

1.  `R3.1` Canonical metric catalog и data lineage.
2.  `R3.2` Deal/GMV/funnel/role activity analytics.
3.  `R3.3` Commodity, region, quality, timing и loss reasons.
4.  `R3.4` Filters, comparison, drill-down, export и alerts.

### Требования и приёмка

`[REQ-R3-001]` Метрики включают deals, GMV, average ticket, conversion, time-to-deal, active organizations/users by role, funnel, commodities, regions, loss reasons, retention и take rate.

`[REQ-R3-002]` Каждая метрика имеет owner, formula, grain, dimensions, timezone, freshness, exclusion rules и version.

`[REQ-R3-003]` Один и тот же KPI не рассчитывается независимо на frontend и backend.

`[REQ-R3-004]` Drill-down сходится с PostgreSQL source rows; export учитывает permissions и tenant.

`[REQ-R3-005]` Empty/low-volume данные не заменяются demo.

`R3_PASS`: metric reconciliation на контрольном наборе, live real-data dashboard, performance, permissions и export PASS.

## R4 Финансовый dashboard 7 points

### Атомарные срезы

1.  `R4.1` Ledger/settlement/revenue canonical views.
2.  `R4.2` Начислено, получено, AR/AP и cash flow.
3.  `R4.3` Holds, refunds, disputes, escrow/nominal/external money.
4.  `R4.4` Margin per deal, partner costs, taxes и forecast.
5.  `R4.5` Reconciliation, alerts, exports и audit drill-down.

### Требования и приёмка

`[REQ-R4-001]` Dashboard отдельно показывает GMV, platform accrued revenue, collected revenue, participant money, cash, AR, AP, refunds, holds, partner costs, gross margin и forecast.

`[REQ-R4-002]` 13-week cash calendar использует фактические balances и versioned forecast assumptions.

`[REQ-R4-003]` Client P&L и margin per deal воспроизводимы из ledger.

`[REQ-R4-004]` Bank/provider discrepancy становится reconciliation case, а не silently overwritten value.

`[REQ-R4-005]` Экспорт в бухгалтерию имеет cutoff, currency, tax fields, source refs и digest.

`R4_PASS`: ledger-to-dashboard reconciliation = 100%; unknown/unbalanced entries = 0; exact-SHA live money drill-down PASS.

## R5 ФНС ЕГРЮЛ ЕГРИП 6 points

### Атомарные срезы

1.  `R5.1` Синхронизация существующего substantive контура с current main.
2.  `R5.2` Registry generations, source digest, finality и publication race.
3.  `R5.3` Поиск/проверка UI и API.
4.  `R5.4` Встраивание evidence в organization, counterparty и deal preflight.
5.  `R5.5` Load, security и live acceptance.

### Требования и приёмка

`[REQ-R5-001]` Сохраняются immutable registry generations, deterministic digest, lineage и PostgreSQL authority.

`[REQ-R5-002]` Concurrent publication не выдаёт смешанное поколение.

`[REQ-R5-003]` Load acceptance не менее 50 001 records и текущего подтверждённого baseline.

`[REQ-R5-004]` Проверка показывает source date, freshness, status, identifiers, material risks и limits; не даёт юридическую гарантию.

`[REQ-R5-005]` Source unavailable/stale/conflict приводит к явному состоянию и policy-based preflight.

`[REQ-R5-006]` Результат доступен в карточке контрагента и сделки; cross-tenant leak = 0.

`R5_PASS`: exact-head substantive CI, independent review, merge, REG.RU live query, organization/deal integration и negative cases PASS.

## R6 Config Foundation 6 points

### Атомарные срезы

1.  `R6.1` OrganizationCapabilities.
2.  `R6.2` Provider Registry и capability maturity.
3.  `R6.3` ServiceOffering.
4.  `R6.4` IntegrationBinding.
5.  `R6.5` CommercialRules и RulePacks.
6.  `R6.6` PostgreSQL authority, policy versioning и production acceptance.

### Требования и приёмка

`[REQ-R6-001]` Все конфигурационные объекты versioned, tenant-safe, auditable и имеют effective period.

`[REQ-R6-002]` Rule evaluation deterministic и сохраняет применённую version в deal/service/fee snapshot.

`[REQ-R6-003]` Invalid combination fail-closed с объяснимой ошибкой.

`[REQ-R6-004]` Binding меняется без изменения Canonical Core и проходит contract test.

`[REQ-R6-005]` UI configuration доступен только уполномоченным ролям и показывает последствия.

`R6_PASS`: все шесть объектов live на REG.RU, migration/schema/tenant/concurrency/rollback tests PASS.

## R7 Revenue Slice до комиссии ООО 18 points

### Атомарные срезы

1.  `R7.1` Inventory/Batch и подтверждаемость.
2.  `R7.2` Marketplace lot и procurement request.
3.  `R7.3` Offer/negotiation/acceptance.
4.  `R7.4` Canonical Deal и commercial snapshot.
5.  `R7.5` Contract/documents/signing preflight.
6.  `R7.6` Required verification и regulatory applicability.
7.  `R7.7` Logistics/execution/quality/acceptance.
8.  `R7.8` Settlement obligation и payment evidence.
9.  `R7.9` PlatformFee accrual/collection/reconciliation.
10. `R7.10` Accounting close, dispute/exception и full live E2E.

### Требования и приёмка

`[REQ-R7-001]` Один реальный разрешённый сценарий проходит весь путь без ручной правки БД, fake provider success или административного обхода.

`[REQ-R7-002]` В каждом шаге видны actor, state, prerequisites, next action, deadline, money impact и evidence.

`[REQ-R7-003]` Соседняя роль видит согласованное каноническое состояние после каждого события.

`[REQ-R7-004]` Комиссия ООО начисляется только по versioned commercial rule и отделена от денег участников.

`[REQ-R7-005]` При отсутствии внешнего live access используются реальные внутренние workflow и честный external pending; это не разрешает объявить внешний этап `LIVE_ACCEPTED`.

`[REQ-R7-006]` Первый revenue path не блокирует расширение на другие банки, логистов, ЭДО и ФГИС.

`R7_PASS`: full cross-role exact-SHA production E2E, ledger balance, fee evidence, documents, audit/outbox, retry, negative и recovery acceptance PASS.

## R8 Regulatory Core и ФГИС 14 points

### Атомарные срезы

1.  `R8.1` External Source Registry и capability contracts.
2.  `R8.2` Universal Regulatory Core, applicability и blocking stages.
3.  `R8.3` ФГИС Зерно read: dictionaries, lots, СДИЗ, delta sync.
4.  `R8.4` Grain → Inventory projection, double-sell и conflicts.
5.  `R8.5` Grain mutations, ACK, unknown outcome и reconciliation.
6.  `R8.6` ЕФГИС ЗСН fields/crop rotation/geometry.
7.  `R8.7` ФГИС Семеноводство sale/status/buyer confirmation.
8.  `R8.8` Сатурн metadata-driven products/batches/usage plan/act.
9.  `R8.9` ГИС ЭПД state machine и provider-neutral delivery.
10. `R8.10` Conditional Argus-Fito, VetIS и Росаккредитация applicability.
11. `R8.11` Security, signing, retry/degraded UX, performance и live acceptance.

### Regulatory core

`[REQ-R8-001]` Applicability учитывает commodity profile, OKPD2/TNVED при применимости, origin, destination, production field, seed/pesticide facts, transport, deal stage и current law/policy version.

`[REQ-R8-002]` Blocking stages: publication, bidding, deal creation, deal acceptance, contract signing, shipment planning/start, delivery acceptance, settlement и deal close.

`[REQ-R8-003]` Для каждого требования результат: applicable/not applicable/unknown, source, rule version, explanation, required evidence, blocking stage и override authority.

`[REQ-R8-004]` External evidence имеет raw encrypted payload reference, normalized projection, provider, external id, operation, source time, received time, digest, signature/transport evidence и freshness.

`[REQ-R8-005]` Freshness: `CURRENT`, `STALE`, `SOURCE_UNAVAILABLE`, `CONFLICT`, `SUPERSEDED`, `REVOKED`, `NOT_VERIFIED`.

### ФГИС Зерно

`[REQ-R8-006]` P0 read capabilities: dictionaries, list/get lots и list/get СДИЗ по подтверждённому официальному контракту.

`[REQ-R8-007]` Grain lot projection не становится отдельной партией: она подтверждает/конфликтует с Canonical Inventory Batch.
