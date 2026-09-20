`SELL_CROP`, `BUY_CROP`, `OWN_TRANSPORT`, `PROVIDE_LOGISTICS`, `PROVIDE_EXPEDITION`, `STORE_CROP`, `PROVIDE_ELEVATOR_SERVICES`, `PROVIDE_LAB_TESTING`, `PROVIDE_SURVEYING`, `PROVIDE_FINANCING`, `PROVIDE_INSURANCE`, `ACCOUNTING_INTEGRATION`, `API_INTEGRATION`.

`[REQ-ARC-011]` Одна организация может иметь несколько capabilities одновременно.

`[REQ-ARC-012]` Availability функции определяется серверной композицией role, organization capability, entitlement, policy version, evidence и external capability maturity.

`[REQ-ARC-013]` Изменяемые провайдеры и правила задаются через versioned `Provider`, `Adapter`, `IntegrationBinding`, `RulePack`, `CommercialRuleSet`, `SettlementScheme` и `DocumentProvider`.

`[REQ-ARC-014]` Новый стандартный партнёр не требует изменения Deal Engine.

## 3 3 Provider neutral ports

Минимальные порты:

`BankPort`, `PaymentPort`, `EDOPort`, `EPDPort`, `GovernmentSystemPort`, `LogisticsPort`, `LaboratoryPort`, `SurveyorPort`, `ElevatorPort`, `InsurancePort`, `AccountingPort`, `IdentityVerificationPort`.

`[REQ-INT-001]` Adapter переводит внешний контракт в канонический; provider-specific поля не протекают в core без versioned extension envelope.

`[REQ-INT-002]` Для каждого capability хранить maturity: `DISCOVERED`, `PUBLIC_SPEC_VERIFIED`, `CONTRACT_MAPPED`, `ADAPTER_IMPLEMENTED`, `CONTRACT_TESTED`, `EXTERNAL_ACCESS_PENDING`, `CONTRACT_PENDING`, `LIVE_TESTING`, `LIVE_ACCEPTED`, `DEGRADED`, `SUSPENDED`.

`[REQ-INT-003]` UI показывает фактическую maturity и не обещает недоступное действие.

`[REQ-INT-004]` Webhook, polling, file import, manual confirmation и operator-assisted режим могут сосуществовать как разные bindings одного канонического порта.

# 4 Функциональная модель сделки

## 4 1 Активация после регистрации

`[REQ-FUN-001]` Первый вход не заканчивается сообщением «объектов нет». Пользователь получает роль-ориентированный старт и одно основное действие.

`[REQ-FUN-002]` Seller: добавить существующую, подтверждаемую или будущую продукцию.

`[REQ-FUN-003]` Buyer: создать потребность или найти предложение.

`[REQ-FUN-004]` Logistics: добавить транспорт/услугу или принять запрос.

`[REQ-FUN-005]` Laboratory, Surveyor, Elevator и finance provider: описать услугу, географию, SLA, цену/правило расчёта и доступность.

`[REQ-FUN-006]` Empty state всегда объясняет пользу, безопасное следующее действие, требуемые данные и альтернативный путь.

## 4 2 Inventory и progressive trust

`[REQ-INV-001]` Партия создаётся вручную, импортом 1С, подтверждением/импортом ФГИС, загрузкой реестра/документа или assisted flow.

`[REQ-INV-002]` Поддерживаются `EXISTING_PHYSICAL`, `STORED_CONFIRMED`, `EXPECTED_HARVEST`, `FUTURE_CONTRACTED`.

`[REQ-INV-003]` Хранить независимые оси доверия: existence, quantity, quality, location, custody, ownership/disposal right, encumbrance, regulatory, document, signature.

`[REQ-INV-004]` Уровни: `DECLARED`, `DOCUMENTS_PROVIDED`, `PARTIALLY_VERIFIED`, `VERIFIED`, `UNDER_REVIEW`, `CONFLICT_DETECTED`.

`[REQ-INV-005]` Неподтверждённый товар разрешено публиковать с заметной маркировкой «Наличие не подтверждено», рисками и запретом юридически значимых шагов, требующих подтверждения.

`[REQ-INV-006]` Пользователь может продолжить разрешённый policy путь после явного risk acknowledgement; система хранит versioned текст предупреждения, actor, time и context.

`[REQ-INV-007]` Seller upload не становится independent evidence. Источник, владелец, метод, freshness и конфликтность evidence видимы.

`[REQ-INV-008]` Reservation и availability защищают от double sell при параллельных предложениях, разделении партии, частичной отгрузке и отмене.

`[REQ-INV-009]` Quantity ledger объясняет исходное количество, reservations, shipped, accepted, disputed, remaining и corrections.

## 4 3 Market procurement и переговоры

`[REQ-MKT-001]` Marketplace работает в обе стороны: seller lots и buyer procurement requests.

`[REQ-MKT-002]` Сделка может возникнуть из marketplace, private procurement, invitation, known counterparty или external partner lead без клонирования core.

`[REQ-MKT-003]` Предложение versioned и включает цену, количество, Incoterm/условия поставки, качество, сроки, место, документы, services и settlement scheme.

`[REQ-MKT-004]` Переговоры сохраняют immutable историю offer/counteroffer/accept/reject/expire и показывают diff.

`[REQ-MKT-005]` Seller видит netback; buyer — landed cost. Формула раскрывает цену, логистику, хранение, лабораторию, страхование, финансирование, комиссии, скидки и quality adjustments.

`[REQ-MKT-006]` Поиск и фильтры охватывают культуру, качество, количество, регион, сроки, verification, delivery, price basis и доступные services.

`[REQ-MKT-007]` Ranking не использует скрытый обязательный score; критерии объяснимы, versioned и не создают дискриминацию без бизнес-основания.

## 4 4 Deal документы и подпись

`[REQ-DEA-001]` Deal 360 показывает состояние, участников, ответственность, next action, сроки, товар, цену, документы, проверки, логистику, деньги, события, спор и audit в разрешённом объёме.

`[REQ-DEA-002]` Contract Engine формирует versioned contract snapshot из accepted commercial terms; изменение после принятия создаёт новую версию и повторное согласование.

`[REQ-DEA-003]` Document Engine поддерживает generated, uploaded, signed, delivered, accepted, corrected, cancelled и archived states с lineage.

`[REQ-DEA-004]` Подпись проверяет полномочия, сертификат, МЧД/основание, тип подписи, digest документа, timestamp и результат внешней проверки.

`[REQ-DEA-005]` Private key никогда не передаётся и не хранится платформой вне допустимого сертифицированного контура.

`[REQ-DEA-006]` UI до подписи показывает документ, версию, последствия, подписанта и полномочие; после подписи показывает проверяемое evidence.

`[REQ-DEA-007]` Нельзя подменять юридическую подпись checkbox, typed name или внутренним статусом.

## 4 5 Услуги и исполнение

`[REQ-SRV-001]` Service Marketplace охватывает логистику, экспедирование, элеватор, лабораторию, surveyor, страхование, финансирование и иные расширяемые услуги.

`[REQ-SRV-002]` Commercial Rule Engine поддерживает subscription, access fee, per ton, per trip, per hour, fixed, percent, success fee, capped percent и manual quote.

`[REQ-SRV-003]` Плательщик услуги определяется правилом, условиями сделки и подтверждением сторон, а не жёстко зашивается.

`[REQ-SRV-004]` Логистика поддерживает own fleet, external provider, direct carrier, split loads, замену машины/водителя, reroute, delay, cancellation, partial delivery и proof of delivery.

`[REQ-SRV-005]` Driver field mode mobile-first: крупные цели, минимум ввода, слабая сеть, локальный draft, безопасный retry, фото/гео/время с provenance.

`[REQ-SRV-006]` Laboratory, surveyor и elevator evidence независимы от seller declaration, versioned, связаны с batch/load/sample и могут быть оспорены.

`[REQ-SRV-007]` Quality adjustment объясняет формулу, исходные показатели, допуски, результат, автора и документальное основание.

## 4 6 Деньги расчёты и выручка

`[REQ-FIN-001]` Единый double-entry ledger отделяет participant funds, platform funds, fees, taxes, holds, refunds, corrections и external payment evidence.

`[REQ-FIN-002]` Settlement plan поддерживает `DIRECT_B2B`, `SAFE_DEAL`, `NOMINAL`, `LETTER_OF_CREDIT`, `COMPOSITE`, `EXTERNAL_PAYMENT` как versioned schemes.

`[REQ-FIN-003]` Bank-neutral core не объявляет оплату финальной до provider evidence или разрешённого ручного подтверждения с audit и reconciliation.

`[REQ-FIN-004]` PlatformFee фиксирует rule version, base, rate, cap, amount, payer, accrual, due, paid, refunded и tax treatment.

`[REQ-FIN-005]` GMV, participant money, platform revenue, cash и profit не смешиваются.

`[REQ-FIN-006]` Поддерживаются partial payment, overpayment, underpayment, refund, hold, dispute, charge/correction, failed payment и unknown outcome.

`[REQ-FIN-007]` Treasury ООО показывает bank accounts, actual cash, 13-week forecast, receivables, payables, expected fees, partner expenses, taxes и runway без fake/demo values.

`[REQ-FIN-008]` Каждая денежная цифра имеет drill-down до ledger entries, deal, rule, provider evidence и audit.

## 4 7 Споры исключения и закрытие

`[REQ-DSP-001]` Dispute/Claims Engine поддерживает частичный и полный спор по количеству, качеству, сроку, документу, логистике и оплате.

`[REQ-DSP-002]` Спор не стирает исходные события; решение создаёт versioned adjustment и права на дальнейшее действие.

`[REQ-DSP-003]` SLA/Deadline Engine рассчитывает сроки по policy, календарю, timezone и событию, предупреждает и эскалирует.

`[REQ-DSP-004]` Exception Engine предлагает допустимый следующий путь при недоступной ФГИС, отсутствии API, позднем документе, замене транспорта, split batch, отсутствии МЧД и иных реальных отклонениях.

`[REQ-DSP-005]` Сделка закрывается только после согласованности товара, документов, regulatory obligations, исполнения, settlement и unresolved claims.

`[REQ-DSP-006]` После закрытия формируются immutable closing snapshot, документы, accounting export и аналитические события.

## 4 8 Четыре канала одной сделки

Публичный рынок, закрытые закупки, собственная существующая сделка и внешнее привлечение используют один Deal Engine. Первый платный процесс запускается на одной культуре, одном покупателе или приёмной площадке и одном коридоре. Он включает реальное исключение по качеству и его влияние на расчёт. Ликвидность открытого рынка не является предварительным условием платного Private Procurement, BYOD или Partner flow. При этом открытый Marketplace остаётся обязательным стратегическим контуром, а не удаляется из scope.

`[REQ-ORI-001]` Сохранять `DealOrigin`: `PLATFORM_MARKETPLACE`, `PRIVATE_PROCUREMENT`, `BYOD_EXISTING_RELATIONSHIP`, `PARTNER_EXTERNAL_VENUE`. Имена сопоставить с существующей схемой, а не создавать дубли enum.

`[REQ-ORI-002]` Origin содержит внешний reference, владельца источника, версию attribution policy, acquisition cost bucket, referral fee rule, data rights, first touch, дату создания и campaign ID. Источник не меняет права и финальность сделки.

`[REQ-ORI-003]` Импорт ФГИС, 1С, файла или ручного ввода создаёт private draft. Публикация требует явного разрешения продавца; audience, grants и отзыв доступа проверяются PostgreSQL/RLS, API, поиском, экспортом и кешем. Угаданный ID не раскрывает объект.

`[REQ-ORI-004]` Private Procurement поддерживает приглашённых поставщиков, нормализованный RFQ, версии ответов, объяснимый выбор, историю решения и повторную закупку. Организатор не видит закрытые предложения другого tenant без соответствующего права.

`[REQ-ORI-005]` Liquidity Operations ведёт реальные supply/demand, сроки ответа, coverage исполнимых предложений и стоимость ручного сопровождения. Оператор не принимает коммерческое предложение от имени клиента.

`[REQ-ORI-006]` Исключить фиктивные объявления, wash/circular activity и скрытое продвижение. Sponsored placement отделить от независимого ranking; правила, конфликт интересов, reason и appeal доступны в пределах разрешённых данных.

`[REQ-ORI-007]` Самостоятельное согласование цены участниками и RFQ не подменять лицензируемыми торгами, клирингом или исполнением за участника. Новый trading mode проходит отдельную правовую классификацию.

## 4 9 Запасы будущий урожай и хранение

`[REQ-IVX-001]` `InventoryPosition` связывает владельца, товарный профиль, batch, место, количество и evidence. Title, custody, риск утраты и физическое местоположение — разные поля и состояния.

`[REQ-IVX-002]` Доступный объём учитывает reservation, pledge, encumbrance, quality/regulatory hold и исполненные отгрузки. Конкурентные резервы не могут превысить допустимый остаток; отрицательные количества и двойная продажа блокируются транзакционно.

`[REQ-IVX-003]` Split/merge, перемещение и переработка сохраняют genealogy и баланс количества с явными допустимыми потерями и преобразованиями единиц. История исходной партии не перезаписывается.

`[REQ-IVX-004]` ForwardDealProfile расширяет существующую сделку: `EXISTING_PHYSICAL`, `STORED_CONFIRMED`, `EXPECTED_HARVEST`, `FUTURE_CONTRACTED`; crop year, min/target/max объёма, confidence/source, ожидаемое качество, сроки и допуски поставки.

`[REQ-IVX-005]` Для будущего урожая фиксируются crop failure, substitution и termination rules, обязательства и их лимиты. Превращение прогноза в физическую партию создаёт новую доказанную версию; прогноз не выдаётся за подтверждённый складской остаток.

`[REQ-IVX-006]` Elevator liquidity node показывает подтверждённую оператором ёмкость, слоты, тарифы и warehouse documents; поддерживает sell-from-storage и dispatch без смешения title/custody. Сценарий hold-versus-sell является расчётом, не гарантией цены.

`[REQ-IVX-007]` `CommodityCorridorRulePack` задаёт культуру, базис, географию, quality thresholds, документы, regulatory obligations, execution slots, тарифы, партнёров и effective dates. Расширение на новый коридор не требует нового core.

## 4 10 Конституция сделки до исполнения

DealConstitution — согласованная сторонами структурированная версия правил конкретной сделки. Она опирается на существующий DealTermsVersion и не создаёт конкурирующий источник истины.

`[REQ-PD-001]` До резерва денег или начала исполнения обе стороны принимают одну неизменяемую версию DealConstitution с hash, timestamp, authority и доказательством согласия. Изменение требует новой версии и повторного принятия затронутыми сторонами.

`[REQ-PD-002]` В конституции обязательны предмет, количество/единица/допуск, цена, базис качества, методики, authority веса и весов, допуски контрольного взвешивания, место и событие перехода риска.

`[REQ-PD-003]` Конституция определяет кто, где и когда отбирает пробы; число проб, пломбы, срок хранения, основную и арбитражную лаборатории; документы по этапам; формулу корректировки, reserve/release/hold/refund rules, сроки и dispute SLA.
