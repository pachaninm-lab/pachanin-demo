`[REQ-PD-004]` Пустое обязательное поле, истёкшее полномочие, несовпадение принятой версии или неподтверждённая обязательная capability запрещают переход. UI объясняет конкретную причину и следующее допустимое действие.

## 4 11 Отгрузки и независимые транши

`[REQ-PD-005]` Каждая Shipment имеет собственный SettlementTranche и идентификаторы в весе, пробе, лаборатории, документах, банковской инструкции, удержании, возврате и споре. Агрегат сделки не становится альтернативным финансовым ledger.

`[REQ-PD-006]` Физические checkpoints: загрузка, передача перевозчику, путь, разгрузка, приёмка. Для каждого хранить автора, authority, время события и записи, location и evidence. Title, custody, risk, acceptance и разрешение выплаты изменяются по разным правилам.

`[REQ-PD-007]` Утрата груза не порождает автоматическую выплату. Недостача связывается с принятой массой и локальным спором. Незатронутые отгрузки продолжаются, если нет отдельного юридического или compliance-основания общего ограничения.

`[REQ-PD-008]` Суммы транша отражают gross, quality/document adjustments, accepted, disputed, released, held и refunded. Не складывать поля, которые описывают разные срезы одного обязательства. Отдельно задать равенства обязательства, обеспеченных средств и движений с валютой, знаками и rounding policy.

`[REQ-PD-009]` Property/concurrency tests доказывают: release не превышает допустимого остатка и approved basis; disputed/held объём не выплачивается; повтор операции не меняет баланс; корректировка не удаляет прошлое движение.

## 4 12 Качество и цепочка проб

`[REQ-QLX-001]` Хранить три независимые оси: commercial quality, regulatory safety, phytosanitary/route eligibility. Хорошее коммерческое качество не отменяет запрет оборота или ограничение маршрута.

`[REQ-QLX-002]` Loading и receiving — отдельные контрольные точки. Проба содержит exact batch/tranche/trip, место, метод, сборщика и полномочие, оборудование, время, пломбу, custody transfers, retention, lab protocol и retest links.

`[REQ-QLX-003]` LabResult версионирован, содержит методику, единицы, измеренные показатели, источник и применимость лаборатории. Неверная проба, нарушенная пломба, несовместимые методики или недоступная исходная версия создают review, а не молчаливую замену результата.

`[REQ-QLX-004]` Evidence hierarchy устанавливается конституцией и применимым договором: согласованный акт; арбитражная контрольная проба; назначенная лаборатория; погрузочная проба; вспомогательные фото/датчики. Фото и AI не заменяют лабораторное полномочие. Оспаривание акта учитывается явно.

`[REQ-QLX-005]` Quality adjustment рассчитывается детерминированно по согласованной версии формулы с exact sample/result references. Нет исходного evidence — нет автоматического назначения виновного или новой формулы задним числом.

## 4 13 Основание итоговой суммы

SettlementBasis объясняет, почему разрешена конкретная сумма. Оно не означает банковскую оплату и не заменяет внешний статус.

`[REQ-SBX-001]` Basis содержит deal/tranche, versions конституции, tariff и rule packs, payer/payee, quantity/quality facts, документы и услуги, adjustments/holds, approved amount/currency, расчётную трассу, approvals и hash.

`[REQ-SBX-002]` Состояния: `DRAFT`, `EVIDENCE_INCOMPLETE`, `REVIEW_REQUIRED`, `APPROVED`, `SUPERSEDED`. Материальное изменение исходного evidence или условий инвалидирует применимость старого basis и создаёт новую версию.

`[REQ-SBX-003]` Каждая необратимая settlement instruction ссылается на текущий `APPROVED` не superseded basis. Проверка authority, ограничения и остаток выполняется атомарно при создании инструкции; race между изменением basis и отправкой закрыт outbox/pre-dispatch revalidation.

`[REQ-SBX-004]` Финансовая карта показывает товар, услуги, комиссию, налоги по применимой policy, payer/payee, источник денег, waterfall, held/disputed/eligible суммы и их основания. Оценка стоимости отделена от обязательства, начисление — от подтверждённого движения.

## 4 14 Споры и полномочия

`[REQ-DPX-001]` Dispute обязательно задаёт scope shipment/tranche/indicator, disputed quantity/amount, основание расчёта, evidence, deadline, next owner и допустимые действия. Пустой или завышенный scope не принимается.

`[REQ-DPX-002]` Удерживается спорная часть; undisputed release разрешён только конституцией, approved basis, банковским контрактом и compliance. Общий hold допускается по отдельному доказанному основанию, а не как побочный эффект спора одной машины.

`[REQ-DPX-003]` Молчание стороны по умолчанию ведёт к escalation. Автоматическое действие по сроку допустимо только при заранее согласованном законном правиле и поддержке банка, с точным deadline и audit.

`[REQ-DPX-004]` Resolution append-only: actor, MFA, reason, evidence, policy version, signed/approved terms и scope. Администратор, разработчик, support и Гекта не имеют прямого права менять итоговую сумму.

`[REQ-DPX-005]` `ApprovalRequest` реализует maker/checker двумя разными уполномоченными людьми, self-approval denial, expiry, threshold policy, revoke и step-up при исполнении. Устаревшее approval не подтверждает новую сумму или реквизиты.

## 4 15 Банковский контур и ограничения провайдера

`[REQ-BNX-001]` BankPort/MoneyProvider поддерживает подтверждённые контрактом reserve, hold, release, refund/return, status, statements и authenticated webhook. Возможность выключена, пока нет реального договорного и технического evidence. Название продукта банка не подтверждает capability.

`[REQ-BNX-002]` «Сбер Безопасные сделки» — первый целевой binding из MASTER, не уже подключённый банк. Исследовать его конкретный доступный юридическим лицам продукт и контракт; при отсутствии доступа оформить blocker. Альтернативный банк выбирается по согласованной схеме через тот же port.

`[REQ-BNX-003]` Timeout после mutation означает `UNKNOWN/PENDING_RECONCILIATION`. Нельзя утверждать ни «оплачено», ни «деньги не списались» без evidence. Перед повтором выполнить status/statement reconciliation с тем же operation identity.

`[REQ-BNX-004]` Webhook проверяется по подлинности, provider identity, operation ID, amount/currency, version и replay policy. Durable inbox предшествует ack; повтор и crash replay не дублируют финансовый эффект. Mismatch открывает incident и блокирует затронутый переход.

`[REQ-BNX-005]` ProviderComplianceMatrix фиксирует по конкретному договору обязанности банка и платформы, ограничения бенефициара/операции, reason codes, источники снятия и допустимые действия. `ProviderRestriction` снимается только проверенным внешним основанием или предусмотренным договором полномочием.

`[REQ-BNX-006]` Запрещено обходить ограничение переводом на другой binding, дроблением суммы, новым beneficiary или ручным unlock. Отказ банка не переписывается как бизнес-успех.

`[REQ-BNX-007]` Изменение банковских реквизитов проходит request, MFA, проверку полномочий и принадлежности счёта, уведомление существующих финансовых администраторов, risk review, предусмотренный cooling-off/four-eyes и effective version. Активные сделки не перенаправляются автоматически.

`[REQ-BNX-008]` Кредитный лимит покупателя, гарантия, факторинг, страхование урожая/груза являются внешними продуктами. `FinanceReadinessPack` и `RiskProtectionProfile` содержат условия, срок, evidence, policy/claim ID и disclosure referral fee; платформа не выдаёт себя за банк или страховщика.

## 4 16 ЭПД учёт и сверка

`[REQ-ACX-001]` «Сфера Перевозки» СберКорус — целевой первый EPD binding, а не подтверждённая текущая интеграция. Adapter нормализует document IDs, статусы, подписи, source timestamps, hash, correction/cancellation и внешние квитанции.

`[REQ-ACX-002]` Если ЭПД обязателен для действия выбранного маршрута, pending/rejected/unknown документ не даёт пройти соответствующий gate. Разрешённый нормативный аварийный порядок моделируется отдельно с evidence; outage сам по себе не разрешает бумажную подмену.

`[REQ-ACX-003]` Для ФГИС Зерно/СДИЗ сохраняются применимая версия правил, external IDs, квитанции, исправления, deadlines и reconciliation. HTTP 200 или внутренняя запись не подтверждают принятие внешней системой. OTC reporting имеет отдельную applicability и подтверждение подачи.

`[REQ-ACX-004]` 1С connector поддерживает конкретные проверенные configuration/release, canonical protocol, outbound-safe transport, external IDs и idempotency. Прямой доступ к БД 1С и arbitrary code/SQL endpoints запрещены.

`[REQ-ACX-005]` Сопоставить объекты с конфигурацией 1С: Deal с договором/заказом/спецификацией; отгрузку и приёмку с реализацией/поступлением/УПД; корректировку с УКД; услугу и комиссию с актом; agency с отчётом агента; банк с выпиской; возврат с коррекцией; закрытие со сверкой.

`[REQ-ACX-006]` Изменённый объект 1С не перезаписывается молча: `ACCOUNTING_CONFLICT`, сравнение versions, уполномоченное решение и audit. Выплата, отменённый ЭДО, дубль/потеря webhook и unknown incoming покрываются reconciliation cases.

`[REQ-ACX-007]` Ежедневная сверка Bank ↔ Ledger ↔ Documents ↔ 1С выявляет amount, currency, date, missing/duplicate и version mismatches. Возврат создаёт отдельную связанную корректировку с исходной операцией и внешним статусом.

`[REQ-ACX-008]` Cash event, revenue recognition, VAT event и первичный документ хранятся раздельно. Tax/accounting rules зависят от лица, операции, режима и effective date; ставки и правовые сроки из исторических документов не хардкодить. Future-effective правила и closing dry-run включаются после профильной проверки.

## 4 17 Доказательства и паспорт сделки

`[REQ-EVX-001]` EvidenceLedger связывает event/correlation/scope IDs, actor, occurredAt/recordedAt, source, payloadHash, evidence refs и цепочку целостности. Hash-chain обнаруживает изменение, но не доказывает истинность самого факта и не заменяет электронную подпись.

`[REQ-EVX-002]` Общий server-side EvidenceService собирает bundle по сделке и траншу из доменных, физических, документарных и банковских evidence. Экспорт содержит человекочитаемую версию и machine manifest с hashes, версиями и проверкой целостности; права применяются к каждому включённому объекту.

`[REQ-EVX-003]` Evidence нельзя бесследно удалить или подменить. Исправление создаёт superseding record, legal hold и retention действуют отдельно от пользовательского удаления. Raw payload хранится защищённо и не попадает целиком в обычные логи.

`[REQ-EVX-004]` DealPassport показывает груз, деньги, next action, основание суммы, deadline и причину блокировки. Продавец/покупатель, водитель, лаборатория, элеватор, бухгалтер и staff получают разные разрешённые поля; водитель не видит товарную цену, провайдер — чужую маржу.

`[REQ-EVX-005]` Field workflow допускает encrypted local draft, resumable upload, очередь, last sync и conflict resolution. До server ack это draft/pending, не принятое evidence. При выходе/смене tenant локальные данные изолируются и очищаются по policy. Offline signing/payment success запрещён.

`[REQ-EVX-006]` До reserve/shipment назначены реальные incident primary и backup с рабочими контактами. Initial target: P0 acknowledgement ≤ 5 минут, обновление ≤ 30 минут; P1 acknowledgement ≤ 30 минут, обновление ≤ 2 часов. Более строгий договор имеет приоритет; staffing должен быть подтверждён, не выдуман Codex.

`[REQ-EVX-007]` Incident drill покрывает недоступность банка/ЭПД, несходящийся баланс и потерю связи. P0 включает fail-closed затронутого money path, P1 — локальный gate; после восстановления обязательны reconciliation, evidence и postmortem. Manual payout не является recovery.

`[REQ-RSK-001]` Counterparty Evidence Graph объединяет legal/KYB, regulatory, execution, quality, financial conduct и integrity facts с source, checkedAt, scope, expiry и correction history. Неизвестное/устаревшее поле не означает благонадёжность.

`[REQ-RSK-002]` Adverse conclusion имеет объяснимое основание, допустимый data purpose, human review там, где требуется, и appeal/correction. Гекта не создаёт скрытый обязательный score из переписки или чувствительных данных; чужие коммерческие данные не раскрываются публичным рейтингом.

## 4 18 Экономика клиента и платформы

`[REQ-ECX-001]` Landed Economics Engine рассчитывает seller net realized price и buyer landed cost из версии товарной цены, количества, quality adjustments, логистики, хранения, услуг, финансирования, тарифов и применимых налоговых правил. Показывать входы, единицы, источник, freshness, exclusions и rounding; запрещено считать налог дважды.

`[REQ-ECX-002]` Benchmark имеет право использования, источник, сегмент/базис/географию, метод, выборку и freshness. Market Stress Engine выполняет what-if по цене, ставке, маршруту, качеству и хранению; результат помечен сценарием, не прогнозной гарантией и не investment advice.

`[REQ-ECX-003]` Customer Value Ledger хранит подтверждённый клиентом baseline, after, окно измерения и ссылки на реальные events: время до расчёта, стоимость исключений, ручные минуты, потери/корректировки. ROI и сэкономленные деньги без baseline не публикуются как факт.

`[REQ-ECX-004]` NetPlatformRevenue = признанные собственные transaction/orchestration fees + SaaS + Gekta + раскрытые partner fees − refunds/credits по учётной policy. GMV, participant funds и ожидаемая комиссия не равны выручке или доступному cash ООО.

`[REQ-ECX-005]` CM1 = NetPlatformRevenue − прямые переменные bank/provider/integration/transaction-infrastructure costs. CM2 = CM1 − переменные verification/support/dispute/MarketOps/customer-success costs. Единую cost allocation policy версионировать и предотвращать двойной учёт.

`[REQ-ECX-006]` По каждому origin/segment/corridor считать CAC платящей когорты, payback, repeat, churn/retention, support intensity и human minutes × loaded cost. Не выводить LTV из единственной сделки; показывать размер когорты, окно и отсутствие наблюдений.
