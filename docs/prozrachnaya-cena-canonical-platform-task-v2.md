Дата: 26 апреля 2026. Статус: рабочий документ для product / engineering / Codex / QA / банка / инвестора.

Главный принцип: добавляем только то, что усиливает платформу как операционную систему агросделки. Market layer создаёт ликвидность; execution layer доводит сделку до денег; trust layer делает контур доказуемым и банково пригодным.

# ПРОЗРАЧНАЯ ЦЕНА — КАНОНИЧЕСКОЕ ТЗ V2.0

## 0. Статус документа и цель

Документ фиксирует итоговую каноническую модель развития «Прозрачной Цены» с учётом master backlog, конкурентной разведки, deep analysis, проектных документов и решений из рабочего чата.

Цель: создать не обычный маркетплейс, не тяжёлую ERP и не демо-витрину, а операционную систему агросделки: от выставления товара и торгов до безопасного расчёта, документов, логистики, качества, спора и доказательств.

Текущий корректный статус: сильная предпилотная сборка / pilot-ready с сопровождением. Боевой production-контур, live-интеграции и промышленная устойчивость не считаются подтверждёнными до controlled pilot и реальных сделок.

Каноническая формула: фермер выставляет товар -> покупатель покупает / торгуется / создаёт RFQ -> победитель автоматически переходит в сделку -> деньги резервируются -> логистика контролируется -> приёмка и качество подтверждаются -> документы / СДИЗ / ЭДО собираются -> спор разбирается по доказательствам -> деньги выпускаются или возвращаются -> репутация и история остаются в платформе.

## 1. Нерушимая стратегическая доктрина

- Платформа развивается только в сторону ликвидности, исполнения, доказательности, банковой пригодности, регуляторной совместимости, операционной простоты, масштабируемости и защиты от обхода.
- Market layer обязателен: фермер должен выставлять товар, покупатель должен покупать, торговаться, создавать RFQ и сравнивать офферы.
- Market layer — только вход. Стратегический moat строится в execution layer: договор, резерв денег, логистика, приёмка, лаборатория, СДИЗ, ЭДО, выпуск средств, спор и доказательства.
- Запрещено превращать платформу в обычную доску объявлений, где стороны нашли контакт и ушли в WhatsApp.
1.1. **[P0]** Ввести в продуктовую документацию принцип: «Не просто найти цену. Довести сделку до денег». — Единая рамка для команды, инвестора, банка и региона.
1.2. **[P0]** Закрепить модель: Market Layer приводит сделку, Execution Layer удерживает деньги, документы и ответственность. — Платформа не конкурирует лоб в красном океане маркетплейсов.
1.3. **[P0]** Ввести стратегический фильтр задач: каждая функция должна усиливать ликвидность, сделку, деньги, документы, доказательства, банк, регуляторику или масштабируемость. — Шумовые функции не попадают в roadmap.
1.4. **[P0]** Запретить claims шире фактов: production-ready, ФГИС подключен, банк работает, гарантия оплаты — только при подтверждённом live-основании. — Снижение DD, банкового и юридического риска.

## 2. Четыре слоя канонической платформы

- Market Layer — вход в сделку: лоты, торги, RFQ, офферы, купить сейчас, matching, сравнение предложений.
- Execution Layer — ядро: сделка, договор, деньги, логистика, приёмка, лаборатория, документы, ФГИС/СДИЗ, ЭДО/ЭПД, выпуск, возврат, спор, доказательства.
- Trust Layer — защита: RBAC, полномочия, подписи, 2FA, immutable audit, evidence chain, bank events, anti-fraud, anti-bypass, degradation mode.
- Intelligence Layer — ускорение решений: risk scoring, matching, price reference, AI, investor dashboard, unit economics, bank-ready dossier, region analytics.
2.1. **[P0]** Разделить навигацию и доменную модель на Market / Execution / Trust / Intelligence. — Архитектура становится читаемой и масштабируемой.
2.2. **[P0]** Для каждого экрана указать слой, владельца, главный объект, затрагиваемые деньги и доказательный след. — Ни один экран не существует «для красоты».

## 3. P0-фундамент: единый источник истины

Без единого источника истины любая новая функция усиливает хаос. Сначала доменная модель, KPI truth-source и state-machine, потом визуальный polish.

3.1. **[P0]** Создать /src/domain: types, fixtures, store, actions, kpi, state-machines, money, documents, evidence, rbac, audit, integrations, quality, logistics. — Доменная архитектура вместо хардкода в UI.
3.2. **[P0]** Описать строгие типы: Deal, Lot, RFQ, Offer, Auction, Bid, Counterparty, User, Role, Permission, MoneyEvent, SmartContract, BankReservation, Document, TransportDocument, FgisRecord, SberKorusRecord, TransportRoute, Vehicle, Driver, Elevator, LabProtocol, QualityPassport, SurveyorAct, Dispute, Evidence, AuditEvent, IntegrationEvent, WebhookEvent, Notification, RiskFlag, SlaRule. — Все основные объекты имеют единый контракт.
3.3. **[P0]** Убрать хардкод DL-*, LOT-*, DK-*, TDP-*, FAC-* из компонентов. — UI больше не является источником данных.
3.4. **[P0]** Собрать единый набор fixtures для controlled pilot: сделки, лоты, RFQ, офферы, споры, документы, money events, audit events, transport events, lab protocols, evidence packs, компании, роли. — Все страницы работают на одной базе.
3.5. **[P0]** Создать KPI-калькуляторы: controlTower, bank, investor, seller, buyer, operator, risk, unitEconomics. — Все суммы считаются функциями, а не руками в JSX.
3.6. **[P0]** Добавить tooltip-формулы и drill-down ко всем KPI. — Оператор, банк и инвестор видят происхождение цифр.
3.7. **[P0]** Добавить тесты целостности: Control Tower = Bank, reserve = RESERVE events, release = RELEASE events, спорная сумма = hold по dispute, /deals = store. — Математика не может разъехаться незаметно.

## 4. Каноническая state-machine сделки

Сделка — главный управляемый объект платформы. Лот и торг создают вход, но только сделка удерживает деньги, документы и ответственность.

4.1. **[P0]** Ввести статусы: DRAFT, COUNTERPARTY_CHECK, OFFER_ACCEPTED, CONTRACT_DRAFT, CONTRACT_SIGNED, MONEY_RESERVED, LOGISTICS_PLANNED, LOADING, IN_TRANSIT, ARRIVED, WEIGHING, LAB_ANALYSIS, ACCEPTANCE_PENDING, ACCEPTED, DOCUMENTS_PENDING, DOCUMENTS_COMPLETE, RELEASE_PENDING, PARTIAL_RELEASED, DISPUTED, FINAL_RELEASED, CLOSED, CANCELED, DEGRADED. — Единая карта жизненного цикла сделки.
4.2. **[P0]** Для каждого статуса задать владельца, обязательные поля, документы, деньги, доступные действия, запреты, SLA, блокеры, следующий статус, поведение при ошибке и audit event. — Система знает, кто и что должен сделать дальше.
4.3. **[P0]** Запретить опасные переходы: release без документов, final release при открытом споре, accepted без веса/лаборатории, release без bank reservation, silent edit подписанных объектов. — Юридически и денежно опасные действия невозможны.
4.4. **[P0]** Визуализировать сделку крупными фазами: цена/допуск, договор, деньги, логистика, приёмка, лаборатория, документы, выпуск денег, спор/архив. — Сделка читается за 5 секунд.
4.5. **[P0]** Покрыть state-machine unit-тестами на все переходы и негативные сценарии. — Изменение статусов не ломает сделку без сигнала.

## 5. Market Layer: фермер, лоты, торги, RFQ

Фермер должен иметь возможность выставить товар, а покупатель — купить, торговаться или создать RFQ. Но результат market layer всегда должен переходить в draft deal.

5.1. **[P0]** Создать полноценный lot creation: культура, класс, объём, регион, место хранения, базис, стартовая/минимальная цена, шаг торгов, срок торгов, частичная продажа, качество, документы, фото, ФГИС/СДИЗ, условия оплаты, доставка, элеватор, рейтинг, risk score, visibility. — Фермер выставляет товар как сделочный объект, а не объявление.
5.2. **[P0]** Добавить режимы продажи: купить сейчас, аукцион вверх, закрытые офферы, запрос цены, частичная продажа, операторская продажа. — Платформа покрывает разные рыночные привычки.
5.3. **[P0]** Сделать карточку лота с ценой, качеством, документами, ФГИС/СДИЗ, базисом, сроком, логистикой, риском, seller rating и CTA: купить, ставка, оффер, запрос документов, сравнение, создать сделку. — Покупатель понимает, что покупает и что будет после покупки.
5.4. **[P0]** Добавить buyer search/filter: культура, класс, регион, объём, цена, базис, качество, документы, ФГИС/СДИЗ, рейтинг, дата отгрузки, доставка, расстояние, risk score, готовность к сделке, кредит. — Лоты можно реально выбирать.
5.5. **[P1]** Сделать RFQ wizard: культура, объём, регион, качество, базис, срок, бюджет, документы, ФГИС/СДИЗ, логистика, оплата, кредит, дедлайн, список продавцов, публичный/закрытый режим. — Покупатель создаёт структурированный спрос.
5.6. **[P1]** Добавить сравнение офферов: цена/т, сумма, объём, качество, базис, дистанция, логистика, срок, документы, ФГИС readiness, seller rating, dispute history, bank readiness, risk score, итоговая стоимость. — Выбор поставщика становится рациональным.
5.7. **[P0]** После покупки/победы автоматически создавать draft deal с lot/RFQ/auction link, условиями, дедлайнами, правилами отказа, правилами спора, risk score и next owner. — Сделка не уходит из платформы после торгов.

## 6. Deal Workspace

6.1. **[P0]** Переделать /deals/[id] в workspace с табами: обзор, условия, деньги, логистика, приёмка, лаборатория, документы, ФГИС/СДИЗ, ЭДО/ЭПД, спор, evidence, журнал, чат/комментарии, история изменений. — Все слои сделки доступны в одном месте.
6.2. **[P0]** Sticky deal header: ID, статус, сумма, seller, buyer, money state, document state, FGIS state, EDO state, next owner, SLA, risk score, primary action. — Контекст сделки не теряется.
6.3. **[P0]** Deal readiness matrix: контрагенты, полномочия, договор, резерв, рейс, погрузка, вес, приёмка, лаборатория, документы, СДИЗ, ЭДО, спор, выпуск денег. — Видно, что готово и что блокирует.
6.4. **[P0]** Next action engine: что делать сейчас, кто владелец, почему важно, какие деньги затронуты, что будет после, что блокирует, deadline, что делать при ошибке. — Пользователь не думает, где следующий шаг.

## 7. Денежный контур и банк

Деньги — главный рычаг удержания сделки внутри платформы. Без reserve/hold/release/refund платформа остаётся витриной.

7.1. **[P0]** Переделать /bank в hub: ledger, reservations, beneficiaries, smart-contracts, releases, returns, manual-review, reconciliation, webhooks, factoring, credit, settings. — Банк становится рабочим контуром.
7.2. **[P0]** Ввести MoneyEvent: reserve requested/created/confirmed, hold created/updated/released, partial/final release requested/executed, refund requested/executed, bank rejected, manual review, reconciliation mismatch, commission, factoring, credit. — Каждое движение денег имеет событие.
7.3. **[P0]** Idempotency-Key для reserve, hold, release, partial release, refund, cancel, factoring advance, credit request, commission, webhook replay. — Повтор команды не создаёт дубль выплаты.
7.4. **[P0]** Beneficiaries: ЮЛ, ИП, ФЛ, самозанятый, ИНН, ОГРН, КПП, счёт, БИК, банк, статус, история изменений, freeze при смене реквизитов, связь с контрагентом/договором/smart-contract. — Банк видит получателей денег структурно.
7.5. **[P0]** Smart-contract сделки: ID, dealId, стороны, total/reserved/released/hold/refund amounts, release steps, trigger events, beneficiary, idempotency key, status, dispute/refund/close rules. — Деньги привязаны к событиям сделки.
7.6. **[P0]** Manual review банка: чеклист по резерву, контрагентам, полномочиям, договору, ФГИС/СДИЗ, ЭДО/ЭПД/ЭТрН, лаборатории, приёмке, спору, комплаенсу, SLA, reconciliation. — Банк принимает решение по проверяемому пакету.
7.7. **[P0]** Reconciliation: платформа показывает X, банк подтвердил Y, разница Z, ответственный, решение, audit. — Расхождения не продолжают сделку молча.
7.8. **[P1]** Разделить factoring и buyer-side credit: /bank/factoring для продавца, /bank/credit для покупателя. — Не смешиваются разные банковые продукты.

## 8. Документы, ЭДО, СДИЗ, подписи

Документный слой — gate денег и evidence, а не папка для PDF.

8.1. **[P0]** Document Registry: договор, спецификация, приложение, счёт, УПД, ТТН, ТрН, ЭТрН, заявка, поручение экспедитору, экспедиторская/складская расписка, СДИЗ, lab protocol, паспорт качества, акт приёмки, акт расхождения, весовой билет, сюрвейерский акт, решение арбитра, банковское подтверждение, претензии, акт ручного исключения. — Все документы классифицированы.
8.2. **[P0]** Поля документа: ID, dealId, тип, версия, статус, required/optional, owner, uploaded/signed by, signature type, created/signed at, source, hash, file, linked event, immutable, replacement reason, validation, blocking reason. — Документ пригоден для аудита и спора.
8.3. **[P0]** Document gates: деньги не выпускаются без обязательного документа, подписи, валидной версии, ЭДО/СДИЗ/ФГИС статуса, если они обязательны. — Документы реально блокируют release.
8.4. **[P1]** ЭДО/ЭПД статусы: platform draft, sent to EDO, signed by sender/carrier/receiver, sent to GIS EPD, confirmed/rejected, replaced, archived. — PDF не маскируется под ЭДО.
8.5. **[P0/P1]** СберКорус пакет: ЭТрН, заявка, поручение, экспедиторская расписка, складская расписка, tree-view подписей, PDF preview, mobile signing, Госключ/ПЭП fallback, webhook log, white-list indicator, counter обязательного ЭДО, методы web/1C/connector/API. — Транспортный ЭДО готовится к реальному рынку.

## 9. ФГИС «Зерно» и РФ-регуляторика

Для РФ нельзя игнорировать ФГИС, СДИЗ, ЭДО, ЭПД, ЭТрН, КЭП/МЧД, 152-ФЗ, 115-ФЗ-friendly контур, НДС, 1С и банковые safe-deal rails.

9.1. **[P0]** Создать FGIS Hub: status, queue, operations, lots, sdiz, errors, audit, settings. — ФГИС становится операционным модулем, а не карточкой.
9.2. **[P0]** Pilot-ready операции: CreateLot, GetListLot, CreateSDIZ, GetListSDIZ, CreateSDIZElevator, GetListSDIZElevator, Ack, retry, error handling, manual mode. — Закрыт минимальный маршрут для controlled pilot.
9.3. **[P2]** Зрелые группы операций: Lots, SDIZ, GPB, GPB-SDIZ, GrainMonitor, VED Contract, RSHN documents. — Готовится полный API-контур.
9.4. **[P0]** В сделке показывать lotID, sdizID, sdizNumber, operation status, last sync, queue, error, retry, responsible, can release money yes/no, legal status sandbox/manual/live. — ФГИС влияет на readiness и деньги.
9.5. **[P1]** Учесть deep analysis: версия API, обработка ошибок ГАР, retry с экспоненциальной задержкой, кэширование статусов партий, circuit breaker, честный fallback. — Интеграция проектируется как устойчивый контур.
9.6. **[P1]** ЕСИА/СберБизнес ID: показывать причину падения, жизненный цикл токена, синхронизацию времени, retry, fallback, статус подписи. — Auth/integration failures становятся диагностируемыми.

## 10. Полевые роли

10.1. **[P0]** Driver PWA: manifest, service worker, offline queue, IndexedDB, camera, geolocation, upload retry, local hash, one-hand UI, touch targets, offline badge, sync, ЭТрН signing, incident report. — Водитель работает в поле и без связи.
10.2. **[P0]** Driver actions: принять рейс, pre-trip checklist, прибытие на погрузку, фото машины/пломбы/документов, погрузка, выезд, отклонение, фото, прибытие, подпись ЭТрН, sync offline. — Физический маршрут доказуем.
10.3. **[P0]** Elevator: gate queue, QR, сверка машины/водителя/сделки, въезд, вес до/после, фото табло, дельта, блокировка превышения, приёмка, СДИЗ, акт расхождения, TV/tablet mode. — Элеватор становится терминалом доказуемых событий.
10.4. **[P0]** Lab: inbox, protocols, protocol detail, arbitrage, ГОСТ, формы культур, авто-дельта, пересчёт цены, повторный анализ, QR/PDF/УКЭП, evidence. — Качество влияет на деньги и спор формально.
10.5. **[P1]** Surveyor: inbox, act creation, 8-пунктный checklist, 6+ фото, гео, время, подпись, заключение, связь с рейсом/лабораторией/evidence, эскалация в спор. — Сюрвейер даёт независимый evidence layer.
10.6. **[P1]** GPS/ГЛОНАСС: маршрут план/факт, geofence, ETA, stop detection, deviation, route replay, incident link. — Телематика становится доказательством, а не просто картой.

## 11. Dispute Room и Evidence Chain

11.1. **[P0]** Комната спора: header статус/сумма/SLA/owner, evidence продавца, evidence покупателя, evidence платформы, decision panel, timeline, chat, audit, money effect, PDF decision. — Спор становится делом, а не карточкой.
11.2. **[P0]** Evidence model: ID, type, source, author, timestamp, geo, linked object, SHA-256, file, version, chain of custody, visibility, legal status, immutable, replacement reason. — Доказательство воспроизводимо.
11.3. **[P0]** Типы evidence: фото, видео, PDF, lab protocol, surveyor act, ЭТрН, СДИЗ, весовой билет, GPS trace, audit log, bank webhook, переписка, акты исключения/легализации. — Покрыты реальные источники спора.
11.4. **[P0]** Decision engine: FULL_SELLER, FULL_BUYER, PARTIAL_PERCENT, PARTIAL_FIXED_AMOUNT, REJECT, NEED_MORE_EVIDENCE, SEND_TO_REANALYSIS. — Арбитр принимает структурированное решение.
11.5. **[P0/P1]** После decision: money effect, refund/release event, signed PDF, reputation update, audit event, bank trigger. — Решение спора меняет деньги и репутацию.

## 12. RBAC, Audit, Control Tower

12.1. **[P0]** Роли: продавец, покупатель, оператор, водитель, перевозчик, логист, элеватор, лаборатория, сюрвейер, банк, комплаенс, арбитр, администратор, интегратор, инвестор/read-only, регион/read-only, внешний аудитор/read-only. — Ролевая модель соответствует реальной сделке.
12.2. **[P0]** Права по объектам: C/R/U/D/A/S/E/O — create, read, update, delete, approve, sign, export, override. — Права не привязаны грубо к страницам.
12.3. **[P0/P1]** Critical actions требуют полномочий + audit + 2FA: release, refund, смена реквизитов, подпись, замена документа, закрытие спора, approve decision, override, retry bank event, freeze, permissions, export. — Критичные действия защищены.
12.4. **[P0]** AuditEvent: actor, role, organization, action, target, before/after, IP, user agent, timestamp, hash, result, reason, linked deal, risk impact, money impact. — Единый формат аудита.
12.5. **[P0]** Control Tower: KPI, деньги под риском, к выпуску, резерв, горящие SLA, интеграционные стопы, документы, споры, банк/manual review, полевые инциденты, очередь действий, журнал. — Оператор видит максимальный риск за 60 секунд.
12.6. **[P0]** Risk sorting: money impact + SLA breach + role criticality + integration blocker + dispute age + document criticality + fraud signal. — Очередь сортируется по реальному риску.

## 13. Seller и Buyer кабинеты

13.1. **[P0/P1]** Seller: onboarding, компания, реквизиты, полномочия, документы, лоты, торги, офферы, сделки, деньги, споры, репутация, уведомления, помощь оператора. — Продавец понимает, как выставить товар и когда получит деньги.
13.2. **[P0/P1]** Buyer: поиск лотов, RFQ, офферы, сравнение, торги, купить сейчас, резерв, кредит, логистика, приёмка, качество, споры, документы, избранное, saved search, аналитика закупки. — Покупатель понимает, что купить, почему это безопасно и где риск.
13.3. **[P0]** Quality deviation modal: принять скидку, запросить повторный анализ, открыть спор; показывать money effect. — Отклонение качества управляет деньгами.

## 14. Репутация, антифрод, антиобход, compliance

14.1. **[P1]** Репутация по фактам: сделки, объём, споры, процент споров, просрочки, документные ошибки, качество, возвраты, время закрытия, повторные сделки, отзывы, bank/field reliability. — Участники оцениваются по исполнению, не по словам.
14.2. **[P1]** Anti-bypass: поэтапное раскрытие контактов, masking, ограничение скачивания чувствительных документов, лог подозрительных действий, потеря рейтинга/банковых условий, внутренний чат, assisted mode. — Внутри платформы выгоднее, чем снаружи.
14.3. **[P0]** Anti-fraud flags: смена реквизитов перед выплатой, новый подписант, несовпадение водителя/машины, гео вне маршрута, фото без EXIF, частые отмены/споры, качество, повторяющиеся лаборатории, замены документов, manual override перед release. — Денежный риск ловится до выплаты.
14.4. **[P1]** KYB/Compliance: ИНН, ОГРН, КПП, директор, учредители, реквизиты, бенефициары, полномочия, стоп-факторы, risk score, inbox, freeze, limited/reject/request docs. — Контрагентский риск влияет на сделку и деньги.

## 15. Интеграции и деградационный режим

15.1. **[P0]** Connectors Hub: ФГИС, Сбер, СберКорус, ESIA, ЭДО, 1С, GPS, notifications, webhooks, AI provider, storage. — Все внешние контуры видны в одном месте.
15.2. **[P0]** Каждый коннектор показывает: status, mode sandbox/manual/live, last sync, queue, error rate, retries, credentials, owner, logs, health, degradation impact, linked deals. — Понятно, какая интеграция блокирует сделку.
15.3. **[P0]** Degradation включается при падении критических провайдеров: банк, ФГИС, ЭДО/ГИС ЭПД, GPS, auth, storage, 2+ провайдера. — Платформа не блефует при сбое.
15.4. **[P0]** При деградации блокировать release, final acceptance, final document completion, FGIS confirmation, dispute decision with money effect, critical export. — Необратимые действия остановлены.
15.5. **[P1]** Recovery: повторная синхронизация, сверка, ручное подтверждение, акт легализации, audit trail, снятие только ответственным. — Возврат из сбоя контролируем.

## 16. AI как операционный помощник

16.1. **[P2]** Одна AI-кнопка с контекстом: роль, сделка, документы, журнал, подсказки, история. — AI не разбросан по страницам.
16.2. **[P2]** 8 агентов: оператор сделки, банк/деньги, документы/ЭДО, качество/лаборатория, логистика, закупщик, юрист/спор, инвестор/аналитик. — AI отвечает под роль и задачу.
16.3. **[P2]** RAG по deal timeline, documents, evidence, money events, dispute, lab protocol, transport events, integration logs. — Ответы опираются на данные сделки.
16.4. **[P1]** AI не выпускает деньги, не закрывает спор, не подписывает, не меняет реквизиты, не снимает блокер без человека, не даёт юридический вывод как факт. — AI не создаёт юридический и денежный риск.

## 17. UX/UI, mobile, performance, accessibility, QA

Интуитивность продукта определяется не красотой, а тем, понимает ли пользователь за 5 секунд: где он, что за объект, где деньги, что блокирует, кто следующий владелец, что нажать, какой риск и что будет при бездействии.

17.1. **[P0]** Создать design system: tokens, components, patterns, lexicon. Компоненты: Button, Card, StatusBadge, MoneyBadge, SlaBadge, RiskBadge, EnvironmentBadge, Timeline, DataTable, Empty/Error/Loading, ActionPanel, EvidenceCard, DocumentCard, MoneyEventCard, AuditEventRow, ReadinessMatrix, RoleSwitcher, CommandPalette. — Единый интерфейс без разнобоя.
17.2. **[P0]** Лексика: Центр управления, Пилотный режим, Сделка, Лот, Выпуск средств, Удержание, Доказательства, Спор, Приёмка, Резерв. Не смешивать RU UI с английским. — Интерфейс понятен рынку РФ.
17.3. **[P0]** Mobile-first 375px: header, nav, role switcher, cards, tables -> карточки, deal workspace, driver/elevator/lab/surveyor/dispute/bank/docs/market/auction/RFQ. — Полевые сценарии работают на телефоне.
17.4. **[P1]** Performance: Lighthouse >=90 сначала, затем >=95; code splitting, dynamic imports, lazy charts, virtualized lists, bundle budget, remove unused icons, cache, Web Vitals. — Платформа не выглядит тяжёлой ERP.
17.5. **[P1]** Accessibility: contrast AA, focus-visible, keyboard navigation, ARIA, modal focus trap, Esc close, reduced motion, screen reader labels, axe critical = 0. — Enterprise-grade качество интерфейса.
17.6. **[P0/P1]** Testing: unit для KPI/money/state-machine/RBAC/quality/idempotency/document gates/dispute; E2E для market->deal->money->field->dispute->release; contract для bank/FGIS/SberKorus/1C/webhooks/AI. — Критичные сценарии защищены тестами.

## 18. Investor, Demo, Data Room, экономика

18.1. **[P0]** Investor dashboard: GMV, active deals, take-rate, subscriptions, services, dispute rate, avg cycle, money under control, bank cost, CAC, payback, burn, runway, pipeline, pilot gates, risks, sandbox/live status. — Инвестор видит бизнес, не только интерфейс.
18.2. **[P0]** Demo tour: RFQ -> offer -> deal -> reserve -> route -> elevator weight -> lab deviation -> dispute -> evidence -> decision -> refund/release -> close -> metrics. — Суть продукта показывается за 3 минуты.
18.3. **[P1]** Data Room: product, financial model, legal, competitors, bank, integrations, pilot, team, risks, roadmap, security, source passport, cap table later, IP/code ownership. — DD-пакет собран.
18.4. **[P0]** Unit economics: GMV, revenue, take-rate, subscriptions, banking cost, EDO cost, support cost, manual touch cost, gross margin, contribution margin, CAC, LTV, payback, burn, runway. — Экономика не конфликтует с финмоделью.
18.5. **[P1]** Revenue streams: комиссия, seller/buyer subscription, corporate buyer control tower, setup fee, pilot support, dispute/evidence pack, integration package, bank/credit referral later, premium analytics, API later. — Модель не зависит только от слабой комиссии.

## 19. Глобальная архитектура и РФ-специфика

19.1. **[P1]** Universal core для мира: Lot, RFQ, Offer, Deal, MoneyEvent, Document, TransportEvent, QualityEvent, Evidence, Dispute, Audit, Reputation, IntegrationAdapter. — Платформа масштабируема за пределы РФ.
19.2. **[P2]** Local adapters для стран: regulation, bank rails, document types, quality standards, tax, language, units, transport rules, dispute rules, identity/signature. — Глобальность достигается адаптерами, а не переписыванием ядра.
19.3. **[P0/P1]** РФ-обязательный слой: ФГИС, СДИЗ, ЭДО, ЭПД, ЭТрН, КЭП, МЧД, ЕСИА/СберБизнес ID если используется, 152-ФЗ, 115-ФЗ-friendly, НДС, 1С, банковый номинальный счёт/safe deals, buyer credit отдельно от factoring, роль элеватора/лаборатории/перевозчика, manual exceptions в pilot. — Платформа пригодна для РФ, а не абстрактного рынка.

## 20. Что нельзя делать

20.1. **[STOP]** Не делать обычную доску объявлений и не раскрывать контакты до защищённой сделки без правил. — Сделка не уходит из платформы.
20.2. **[STOP]** Не останавливать процесс на «купил лот». Покупка всегда должна создавать сделку. — Market layer не уничтожает execution layer.
20.3. **[STOP]** Не выдавать sandbox за live, PDF за ЭДО, mock bank за работающий банк, demo за production. — Нет ложных обещаний.
20.4. **[STOP]** Не строить тяжёлую ERP и не заменять 1С, банк, ЭДО, GPS или юриста. — Платформа остаётся execution/orchestration layer.
20.5. **[STOP]** Не делать AI юридическим актором и не скрывать ручной труд. — Нет операционного и юридического самообмана.
20.6. **[STOP]** Не выпускать деньги без idempotency, документов, полномочий, audit и проверки открытых споров. — Денежный риск не допускается.

## 21. Порядок внедрения

Этап 1. **[P0]** Жёсткая база: state-of-platform, data layer, KPI truth-source, state-machine, action feedback, audit log, RBAC, claims-control, убрать конфликтующие цифры. — Платформа перестаёт быть лоскутной сборкой.
Этап 2. **[P0/P1]** Market entry: lot creation, lot card, buyer search, buy now, offers, RFQ, basic auction, auto-create deal. — Появляется коммерческий вход.
Этап 3. **[P0]** Deal + Money: deal workspace, bank ledger, beneficiaries, smart-contract, reserve, hold, release, refund, idempotency, reconciliation, webhooks. — Платформа становится банково пригодной.
Этап 4. **[P0/P1]** Documents + РФ-regulatory: document registry, gates, ФГИС, СДИЗ, СберКорус, ЭДО/ЭПД, signature model, PDF preview, hash. — Сделка получает юридический и регуляторный след.
Этап 5. **[P0/P1]** Field execution: Driver PWA, offline queue, elevator, weighing, lab, surveyor, GPS, incident flow. — Физическое исполнение становится доказуемым.
Этап 6. **[P0/P1]** Dispute + Evidence: evidence model, dispute room, decision engine, money effect, signed decision, reputation. — Спор решается по фактам и меняет деньги.
Этап 7. **[P1]** Enterprise-grade: security, observability, degradation, performance, accessibility, tests, contract tests, CI/CD gates. — Крупный партнёр видит зрелость.
Этап 8. **[P1/P2]** Scale: investor dashboard, demo, data room, unit economics, private/partner API, AI, premium analytics, global adapters. — Платформа готовится к масштабу.

## 22. Definition of Done: каноническая платформа

DoD-1. **[DoD]** Фермер может выставить товар, а покупатель купить/торговаться/RFQ. — Есть ликвидность.
DoD-2. **[DoD]** Победитель/покупка автоматически создаёт сделку со state-machine. — Market result не уходит в WhatsApp.
DoD-3. **[DoD]** Деньги резервируются, удерживаются, выпускаются или возвращаются только по событиям. — Денежный контур управляем.
DoD-4. **[DoD]** Документы являются gate денег, ФГИС/СДИЗ/ЭДО честно отражены. — Юридическая и регуляторная пригодность.
DoD-5. **[DoD]** Водитель, элеватор, лаборатория, сюрвейер создают доказуемые события. — Физическое исполнение связано с платформой.
DoD-6. **[DoD]** Спор решается через evidence room, decision создаёт money effect. — Спор решается по фактам.
DoD-7. **[DoD]** Audit log immutable, RBAC не даёт обходить полномочия, anti-fraud ловит риск до денег. — Нет тихих правок и скрытых суперправ.
DoD-8. **[DoD]** Investor dashboard не конфликтует с финмоделью, pilot dashboard показывает реальный статус, manual touch считается и снижается. — Проект защищаем в DD.
DoD-9. **[DoD]** Данные пригодны банку, региону и крупному покупателю. — Платформа становится стратегически важной.
DoD-10. **[DoD]** Пользователь всегда понимает следующий шаг. — Платформа проста, несмотря на сложность.

## 23. Нерезаемый список доработок

1. **[CORE]** Market Layer — Нерезаемый блок
2. **[CORE]** Lot creation — Нерезаемый блок
3. **[CORE]** Buyer search — Нерезаемый блок
4. **[CORE]** RFQ — Нерезаемый блок
5. **[CORE]** Auction — Нерезаемый блок
6. **[CORE]** Auto-create deal — Нерезаемый блок
7. **[CORE]** Deal Workspace — Нерезаемый блок
8. **[CORE]** Data Layer — Нерезаемый блок
9. **[CORE]** KPI truth-source — Нерезаемый блок
10. **[CORE]** State-machine — Нерезаемый блок
11. **[CORE]** Bank Ledger — Нерезаемый блок
12. **[CORE]** Beneficiaries — Нерезаемый блок
13. **[CORE]** Smart-contracts — Нерезаемый блок
14. **[CORE]** Reserve/Hold/Release/Refund — Нерезаемый блок
15. **[CORE]** Idempotency — Нерезаемый блок
16. **[CORE]** Reconciliation — Нерезаемый блок
17. **[CORE]** Webhooks — Нерезаемый блок
18. **[CORE]** Document Registry — Нерезаемый блок
19. **[CORE]** ФГИС/СДИЗ — Нерезаемый блок
20. **[CORE]** ЭДО/ЭПД/ЭТрН — Нерезаемый блок
21. **[CORE]** Signature/hash/versioning — Нерезаемый блок
22. **[CORE]** Driver PWA — Нерезаемый блок
23. **[CORE]** Elevator weighing — Нерезаемый блок
24. **[CORE]** Lab ГОСТ — Нерезаемый блок
25. **[CORE]** Surveyor acts — Нерезаемый блок
26. **[CORE]** GPS evidence — Нерезаемый блок
27. **[CORE]** Dispute Room — Нерезаемый блок
28. **[CORE]** Evidence Chain — Нерезаемый блок
29. **[CORE]** Decision Engine — Нерезаемый блок
30. **[CORE]** Audit Log — Нерезаемый блок
31. **[CORE]** RBAC — Нерезаемый блок
32. **[CORE]** Anti-fraud — Нерезаемый блок
33. **[CORE]** Anti-bypass — Нерезаемый блок
34. **[CORE]** Compliance/KYB — Нерезаемый блок
35. **[CORE]** Degradation Mode — Нерезаемый блок
36. **[CORE]** Investor Dashboard — Нерезаемый блок
37. **[CORE]** Demo Tour — Нерезаемый блок
38. **[CORE]** Data Room — Нерезаемый блок
39. **[CORE]** Unit Economics — Нерезаемый блок
40. **[CORE]** Observability — Нерезаемый блок
41. **[CORE]** Security — Нерезаемый блок
42. **[CORE]** Accessibility — Нерезаемый блок
43. **[CORE]** Performance — Нерезаемый блок
44. **[CORE]** Testing — Нерезаемый блок
45. **[CORE]** Legal claims-control — Нерезаемый блок
46. **[CORE]** Private API — Нерезаемый блок
47. **[CORE]** 1С export — Нерезаемый блок
48. **[CORE]** AI assistant — Нерезаемый блок
49. **[CORE]** Reputation engine — Нерезаемый блок
50. **[CORE]** Global adapter architecture — Нерезаемый блок

## 24. Первый инженерный sprint: E0-E4

Ниже — стартовая очередь, с которой нужно начинать реальные правки платформы. Это не весь roadmap, а первый безопасный пакет, без которого нельзя масштабировать разработку.

E0.1. **[P0]** Discovery: codebase map, routes map, data sources, current KPI conflicts, buttons without feedback, mocks and hardcoded IDs. — Документ state-of-platform.md.
E0.2. **[P0]** Claims/status audit: найти все sandbox/live/demo/production claims, investor цифры, take-rate, FGIS 100%, bank demo events. — Реестр конфликтующих публичных обещаний.
E1.1. **[P0]** Создать domain skeleton и типы ключевых объектов. — Начало единого источника истины.
E1.2. **[P0]** Перенести существующие demo fixtures в единое место без изменения UI. — Снижение риска регрессии.
E2.1. **[P0]** Добавить state-machine type и transition guard для сделки. — Невалидные переходы фиксируются кодом.
E3.1. **[P0]** Подключить action feedback pattern к 10 самым важным кнопкам. — Клики начинают иметь последствия.
E4.1. **[P0]** AuditEvent model + запись событий для ключевых actions. — Появляется доказуемость действий.
E4.2. **[P0]** Role/RBAC matrix skeleton без полного enforcement сначала. — Подготовка к полномочиям и security.