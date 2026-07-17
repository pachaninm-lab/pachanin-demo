import type { PublicAssistantLocale, PublicAssistantSource } from './public-assistant-knowledge';

export type ProspectTopicId =
  | 'audience' | 'value' | 'pricing' | 'onboarding' | 'implementation'
  | 'buyer_value' | 'seller_value' | 'bank_value' | 'logistics_value'
  | 'quality' | 'finance' | 'tax_accounting' | 'legal' | 'security'
  | 'integrations' | 'analytics' | 'reliability' | 'comparison' | 'support';

export type ProspectAnswer = Readonly<{
  knowledgeVersion: string;
  topic: ProspectTopicId;
  title: string;
  answer: string;
  facts: readonly string[];
  maturity: string;
  confidence: 'high' | 'medium';
  actionAllowed: false;
  sources: readonly PublicAssistantSource[];
  suggestions: readonly string[];
}>;

type Copy = Readonly<{ title: string; answer: string; facts: readonly string[]; maturity: string; suggestions: readonly string[] }>;
type Topic = Readonly<{ id: ProspectTopicId; keywords: Readonly<Record<PublicAssistantLocale, readonly string[]>>; copy: Readonly<Record<PublicAssistantLocale, Copy>>; sources: readonly PublicAssistantSource[] }>;

export const PROSPECT_KNOWLEDGE_VERSION = 'public-prospect-knowledge-2026-07-17.v1';

const S = {
  home: { label: 'Главная платформы', href: '/platform-v7' },
  how: { label: 'Как работает сделка', href: '/platform-v7/how-it-works' },
  secure: { label: 'Безопасная зерновая сделка', href: '/platform-v7/secure-grain-deal' },
  fgis: { label: 'ФГИС «Зерно»', href: '/platform-v7/fgis-zerno' },
  privacy: { label: 'Конфиденциальность', href: '/platform-v7/privacy' },
  contact: { label: 'Связаться с проектом', href: '/platform-v7/contact' },
} as const;

const T: readonly Topic[] = [
  {
    id: 'audience',
    keywords: { ru: ['кому подходит','для кого','клиент','агрохолдинг','фермер','трейдер','элеватор','банк'], en: ['who is it for','customer','farmer','trader','elevator','bank'], zh: ['适合谁','客户','农场','贸易商','粮库','银行'] },
    copy: {
      ru: { title: 'Кому подходит платформа', answer: 'Платформа рассчитана на участников внебиржевой зерновой сделки: покупателей, продавцов, логистику, водителей, элеваторы, лаборатории, сюрвейеров, банки, операторов, комплаенс, арбитров и руководителей. Наибольшая ценность возникает там, где сделка проходит через несколько организаций, документов, физических событий и денежных оснований.', facts: ['Один вход определяет организацию и роль на сервере.','Каждая роль видит только разрешённую проекцию одной Сделки.','Подходит как крупным компаниям, так и участникам отдельной цепочки исполнения.'], maturity: 'Реальный onboarding внешних организаций требует отдельного договорного и операционного допуска.', suggestions: ['Что получит продавец?','Что получит банк?','Как начать внедрение?'] },
      en: { title: 'Who the platform is for', answer: 'The platform is designed for participants in OTC grain execution: buyers, sellers, logistics, drivers, elevators, laboratories, surveyors, banks, operators, compliance, arbitrators and executives. Its value is highest when execution spans several organizations, documents, physical events and payment bases.', facts: ['One sign-in resolves organization and role on the server.','Each role sees only its authorized Deal projection.','It supports both large enterprises and specialized participants.'], maturity: 'Real onboarding requires separate contractual and operational admission.', suggestions: ['What does a seller gain?','What does a bank gain?','How does implementation start?'] },
      zh: { title: '平台适合哪些客户', answer: '平台面向场外粮食交易的全部参与方：买方、卖方、物流、司机、粮库、实验室、检验员、银行、运营、合规、仲裁和管理层。交易跨越多个组织、文件、实物事件和付款依据时价值最大。', facts: ['统一登录后由服务器确定组织和角色。','每个角色只看到获授权的交易视图。','既适合大型企业，也适合单一环节参与方。'], maturity: '真实入驻需单独完成合同和运营准入。', suggestions: ['卖方能获得什么？','银行能获得什么？','如何开始实施？'] },
    }, sources: [S.home, S.how],
  },
  {
    id: 'value',
    keywords: { ru: ['выгода','эффект','зачем','roi','окупаемость','экономия','ценность','проблема'], en: ['benefit','value','roi','payback','saving','why'], zh: ['价值','收益','投资回报','节省','为什么'] },
    copy: {
      ru: { title: 'Экономический эффект', answer: 'Платформа должна сокращать цикл сделки, количество ручных сверок, неполных документов, задержек расчёта и споров без доказательств. Экономический эффект считается по времени закрытия, стоимости операций, предотвращённым потерям и доле сделок, завершённых внутри платформы.', facts: ['Основные метрики: длительность сделки, просрочки, ошибки документов и время до выплаты.','Доход платформы нельзя оценивать без GMV, Take Rate и contribution margin.','Точный ROI рассчитывается только на данных конкретной организации.'], maturity: 'Публичный помощник не обещает фиксированную окупаемость без исходных данных клиента.', suggestions: ['Какие данные нужны для расчёта ROI?','Как сокращаются споры?','Как контролируются деньги?'] },
      en: { title: 'Economic value', answer: 'The platform is intended to reduce deal cycle time, manual reconciliation, incomplete documents, settlement delays and evidence-poor disputes. Value is measured through closure time, operating cost, prevented losses and the share of deals completed inside the platform.', facts: ['Core metrics include cycle time, overdue actions, document errors and time to payout.','Platform economics require GMV, take rate and contribution margin.','Exact ROI depends on the customer baseline.'], maturity: 'No fixed payback is promised without customer data.', suggestions: ['What data is needed for ROI?','How are disputes reduced?','How is money controlled?'] },
      zh: { title: '经济价值', answer: '平台旨在缩短交易周期、减少人工核对、缺失文件、结算延迟和缺乏证据的争议。价值通过成交周期、运营成本、避免损失和平台内完成率衡量。', facts: ['核心指标包括周期、逾期、文件错误和付款时间。','平台经济需要GMV、抽成率和贡献利润。','准确ROI取决于客户基线。'], maturity: '没有客户数据时不承诺固定回收期。', suggestions: ['计算ROI需要什么？','如何减少争议？','如何控制资金？'] },
    }, sources: [S.home, S.how],
  },
  {
    id: 'pricing',
    keywords: { ru: ['цена','стоимость','тариф','комиссия','сколько стоит','платно','бесплатно'], en: ['price','pricing','fee','commission','cost','free'], zh: ['价格','收费','佣金','成本','免费'] },
    copy: {
      ru: { title: 'Стоимость и тарифная модель', answer: 'Финальная коммерческая модель не должна называться подтверждённой до утверждения тарифов. Для такой инфраструктуры возможны подписка, комиссия за успешно исполненную сделку, платные корпоративные модули или комбинация. Конкретная цена зависит от объёма сделок, состава ролей, интеграций, SLA и требований к размещению.', facts: ['Нет подтверждённого публичного тарифа — нельзя называть вымышленную цену.','Банковские и государственные интеграции могут иметь отдельную стоимость.','Для enterprise-клиента цена обычно требует расчёта нагрузки и внедрения.'], maturity: 'Коммерческие условия должны быть утверждены отдельно; помощник направляет запрос, а не придумывает тариф.', suggestions: ['Что входит во внедрение?','От чего зависит стоимость?','Как запросить расчёт?'] },
      en: { title: 'Pricing model', answer: 'A final commercial model must not be presented as confirmed before tariffs are approved. Possible structures include subscription, a fee per successfully executed deal, paid enterprise modules or a combination. Actual pricing depends on deal volume, roles, integrations, SLA and hosting requirements.', facts: ['No invented price is shown when no public tariff is approved.','Bank and government integrations may be priced separately.','Enterprise pricing normally requires workload and implementation sizing.'], maturity: 'Commercial terms require separate approval.', suggestions: ['What is included in implementation?','What affects price?','How do I request an estimate?'] },
      zh: { title: '价格与收费模式', answer: '在费率正式批准前，不应把商业模式描述为已确定。可采用订阅、按成功交易收费、企业模块收费或组合模式。实际价格取决于交易量、角色、集成、SLA和部署要求。', facts: ['没有公开费率时不虚构价格。','银行和政府集成可能单独收费。','企业价格通常需要评估负载和实施。'], maturity: '商业条件需单独批准。', suggestions: ['实施包含什么？','价格由什么决定？','如何申请报价？'] },
    }, sources: [S.contact],
  },
  {
    id: 'onboarding',
    keywords: { ru: ['подключиться','регистрация','начать','вступить','онбординг','доступ','аккаунт'], en: ['join','register','sign up','onboarding','start','account'], zh: ['注册','加入','开始','入驻','账户'] },
    copy: {
      ru: { title: 'Подключение организации', answer: 'Промышленный onboarding включает проверку организации, назначение ответственных, создание membership, определение ролей, настройку MFA, договорный допуск и проверку интеграционных реквизитов. Пользователь не выбирает роль самостоятельно: её выдаёт сервер по подтверждённому членству.', facts: ['Один вход для всей платформы.','Роли и tenant не доверяются браузеру.','Доступ к реальным Сделкам появляется после подтверждённого допуска.'], maturity: 'Публичная регистрация не равна автоматическому доступу к боевому контуру.', suggestions: ['Какие документы нужны организации?','Как устроены роли?','Нужна ли интеграция с ERP?'] },
      en: { title: 'Organization onboarding', answer: 'Industrial onboarding includes organization verification, responsible-person assignment, membership creation, role allocation, MFA setup, contractual admission and integration credential checks. Users do not self-select roles; the server resolves them from verified membership.', facts: ['One entry point for the platform.','Role and tenant are not trusted from the browser.','Real Deal access follows verified admission.'], maturity: 'Public registration does not automatically grant production access.', suggestions: ['Which organization documents are needed?','How do roles work?','Is ERP integration required?'] },
      zh: { title: '组织入驻', answer: '工业级入驻包括组织核验、责任人指定、成员关系、角色分配、MFA、合同准入和集成凭据检查。用户不能自行选择角色，服务器根据已验证成员关系确定。', facts: ['全平台统一入口。','浏览器中的角色和租户信息不可信。','真实交易访问需通过准入。'], maturity: '公开注册不等于自动获得生产权限。', suggestions: ['组织需要哪些文件？','角色如何工作？','是否必须集成ERP？'] },
    }, sources: [S.security, S.contact],
  },
  {
    id: 'implementation',
    keywords: { ru: ['внедрение','срок внедрения','пилот','миграция','обучение','запуск','интегратор'], en: ['implementation','deployment','migration','training','launch','pilot'], zh: ['实施','部署','迁移','培训','上线','试点'] },
    copy: {
      ru: { title: 'Как проходит внедрение', answer: 'Правильный путь: обследование процессов → модель ролей и данных → настройка сделки и документов → интеграционный контур → тестовые сценарии → controlled rollout → production acceptance. Архитектура не должна меняться между демонстрацией и production; меняются инфраструктура, реальные провайдеры и доказательства эксплуатации.', facts: ['Сначала фиксируются процессы и источники истины.','Миграции и интеграции проходят через идемпотентные и аудируемые интерфейсы.','Срок зависит от числа организаций, систем и юридических согласований.'], maturity: 'Точный срок нельзя назвать без обследования клиента.', suggestions: ['Что проверить до запуска?','Можно начать без интеграций?','Как обучаются пользователи?'] },
      en: { title: 'Implementation approach', answer: 'The proper path is process discovery → role and data model → Deal and document configuration → integrations → test scenarios → controlled rollout → production acceptance. Architecture should not be rewritten between demonstration and production; infrastructure, providers and operating evidence mature instead.', facts: ['Processes and truth sources are defined first.','Migrations and integrations use idempotent audited interfaces.','Timeline depends on organizations, systems and legal approvals.'], maturity: 'Exact timing requires customer discovery.', suggestions: ['What is checked before launch?','Can we start without integrations?','How are users trained?'] },
      zh: { title: '实施方式', answer: '正确路径是：流程调研→角色和数据模型→交易与文件配置→集成→测试场景→受控上线→生产验收。演示到生产不应重写架构，只提升基础设施、真实供应商和运营证据。', facts: ['先确定流程和事实来源。','迁移与集成采用幂等、可审计接口。','周期取决于组织、系统和法律审批。'], maturity: '没有客户调研不能给出准确周期。', suggestions: ['上线前检查什么？','可以不集成先开始吗？','如何培训用户？'] },
    }, sources: [S.how, S.contact],
  },
  {
    id: 'buyer_value',
    keywords: { ru: ['покупателю','покупатель','закупка','закупщику'], en: ['buyer','procurement','purchaser'], zh: ['买方','采购'] },
    copy: {
      ru: { title: 'Ценность для покупателя', answer: 'Покупатель получает контролируемый путь от допуска и выбора предложения до приёмки, качества, документов и расчёта. Главная выгода — видеть блокеры, основания выплаты, отклонения массы и качества и ответственного по каждому следующему действию.', facts: ['Аукцион связан с последующим исполнением.','Приёмка и лаборатория входят в одну историю Сделки.','Выплата объясняется через подтверждённые основания.'], maturity: 'Реальные банковские операции доступны только после подключения банка.', suggestions: ['Как проверяется качество?','Что блокирует выплату?','Как сравнивать сделки?'] },
      en: { title: 'Value for buyers', answer: 'A buyer gets a controlled path from admission and offer selection through acceptance, quality, documents and settlement. The main benefit is visibility into blockers, payout bases, mass and quality variances and the owner of each next action.', facts: ['Auction outcome connects to execution.','Acceptance and laboratory events share one Deal history.','Payout status is explained through verified bases.'], maturity: 'Live bank operations require a connected bank provider.', suggestions: ['How is quality verified?','What blocks payout?','How are deals compared?'] },
      zh: { title: '买方价值', answer: '买方可从准入和报价选择一直控制到验收、质量、文件和结算。核心价值是看到阻碍、付款依据、重量与质量偏差以及每一步责任人。', facts: ['竞价结果连接后续履约。','验收和实验室属于同一交易历史。','付款状态由已验证依据解释。'], maturity: '真实银行操作需连接银行。', suggestions: ['如何验证质量？','什么会阻止付款？','如何比较交易？'] },
    }, sources: [S.how, S.secure],
  },
  {
    id: 'seller_value',
    keywords: { ru: ['продавцу','продавец','поставщик','производитель'], en: ['seller','supplier','producer'], zh: ['卖方','供应商','生产者'] },
    copy: {
      ru: { title: 'Ценность для продавца', answer: 'Продавец получает прозрачные условия, неизменяемую историю торгов, контроль перевозки и приёмки, понятный комплект документов и видимость основания выплаты. Это снижает риск задержки расчёта из-за неизвестного блокера или неподтверждённого документа.', facts: ['История ставок и условий сохраняется.','Следующий шаг показывает ответственную роль.','Спор опирается на события и доказательства, а не на переписку вне платформы.'], maturity: 'Гарантия конкретного срока выплаты возможна только в рамках подключённого банковского продукта и договора.', suggestions: ['Когда продавец получает деньги?','Что делать при расхождении веса?','Как подать претензию?'] },
      en: { title: 'Value for sellers', answer: 'A seller gets transparent terms, immutable bidding history, transport and acceptance control, a clear document set and visibility into payout basis. This reduces settlement delays caused by unknown blockers or unverified documents.', facts: ['Bid and term history is retained.','The next action identifies the responsible role.','Disputes rely on events and evidence rather than off-platform messages.'], maturity: 'A guaranteed payout time requires a connected banking product and contract.', suggestions: ['When is the seller paid?','What happens on mass variance?','How is a claim filed?'] },
      zh: { title: '卖方价值', answer: '卖方获得透明条件、不可变竞价历史、运输与验收控制、明确文件清单和付款依据可见性，从而减少因未知阻碍或未确认文件造成的延迟。', facts: ['保留出价和条件历史。','下一步显示责任角色。','争议基于事件和证据。'], maturity: '具体付款期限保证需接入银行产品并签约。', suggestions: ['卖方何时收款？','重量不符怎么办？','如何提出索赔？'] },
    }, sources: [S.how, S.secure],
  },
  {
    id: 'bank_value',
    keywords: { ru: ['банку','банк','финансовой организации','кредитный комитет','комплаенс банка'], en: ['bank','financial institution','credit committee'], zh: ['银行','金融机构','授信委员会'] },
    copy: {
      ru: { title: 'Ценность для банка', answer: 'Банк получает событийный контур Сделки: кто допущен, какое основание сформировано, что подтверждено физическим исполнением, какие документы и доказательства существуют, когда допустим резерв или release. Модель не управляет деньгами — денежные команды принимает только банковский и доменный контур.', facts: ['Есть разделение ролей, MFA, аудит и подтверждение критических действий.','Callback, reconciliation и идемпотентность проектируются как обязательные механизмы.','Спор может замораживать денежные операции по правилам Сделки.'], maturity: 'Живое банковское подключение и SLA считаются готовыми только после отдельной интеграционной приёмки.', suggestions: ['Как устроен безопасный расчёт?','Какие события получает банк?','Как предотвращается двойная выплата?'] },
      en: { title: 'Value for banks', answer: 'A bank receives an event-driven Deal context: admission, execution basis, physical confirmations, documents, evidence and conditions for reserve or release. The model never controls money; payment commands remain in banking and domain authority.', facts: ['Role separation, MFA, audit and critical-action confirmation are built in.','Callbacks, reconciliation and idempotency are mandatory patterns.','A dispute can freeze monetary operations under Deal rules.'], maturity: 'Live bank integration and SLA require separate acceptance.', suggestions: ['How does safe settlement work?','Which events does a bank receive?','How is double payout prevented?'] },
      zh: { title: '银行价值', answer: '银行获得事件驱动的交易上下文：准入、履约依据、实物确认、文件、证据以及资金预留或释放条件。模型不控制资金，付款命令只属于银行和领域权威。', facts: ['具备角色隔离、MFA、审计和关键操作确认。','回调、对账和幂等是强制机制。','争议可按规则冻结资金操作。'], maturity: '真实银行集成和SLA需单独验收。', suggestions: ['安全结算如何工作？','银行接收哪些事件？','如何防止重复付款？'] },
    }, sources: [S.secure, S.privacy],
  },
  {
    id: 'logistics_value',
    keywords: { ru: ['логистике','перевозчику','водителю','доставка','маршрут','рейс'], en: ['logistics','carrier','driver','delivery','route','trip'], zh: ['物流','承运人','司机','交付','路线'] },
    copy: {
      ru: { title: 'Логистика и перевозка', answer: 'Логистический контур связывает перевозчика, водителя, транспортное задание, маршрут, прибытие, приёмку и доказательства с одной Сделкой. Это позволяет отличать ожидаемое событие от подтверждённого и не терять связь между рейсом, грузом и расчётом.', facts: ['Полевые действия могут поддерживать ограниченную offline-очередь.','Повторная отправка должна быть идемпотентной.','Водитель видит только необходимый ему контекст.'], maturity: 'Телематика и внешние перевозочные системы считаются подключёнными только после реальной интеграции.', suggestions: ['Что видит водитель?','Как фиксируется прибытие?','Что происходит при задержке?'] },
      en: { title: 'Logistics and transport', answer: 'The logistics layer links carrier, driver, transport assignment, route, arrival, acceptance and evidence to one Deal. This distinguishes expected from confirmed events and preserves the relation between trip, cargo and settlement.', facts: ['Field operations may use a bounded offline queue.','Retries must be idempotent.','Drivers see only the minimum required context.'], maturity: 'Telematics and external transport systems require real integration acceptance.', suggestions: ['What does a driver see?','How is arrival confirmed?','What happens on delay?'] },
      zh: { title: '物流与运输', answer: '物流层把承运人、司机、运输任务、路线、到达、验收和证据连接到同一交易，区分预期事件与已确认事件，并保持班次、货物和结算关联。', facts: ['现场操作可使用受限离线队列。','重试必须幂等。','司机只看到必要信息。'], maturity: '车联网和外部运输系统需实际集成验收。', suggestions: ['司机能看到什么？','如何确认到达？','延误时怎么办？'] },
    }, sources: [S.how],
  },
  {
    id: 'quality',
    keywords: { ru: ['качество','влажность','сорность','клейковина','лаборатория','анализ зерна','расхождение веса'], en: ['quality','moisture','impurity','gluten','laboratory','mass variance'], zh: ['质量','水分','杂质','面筋','实验室','重量偏差'] },
    copy: {
      ru: { title: 'Качество, масса и лаборатория', answer: 'Результаты приёмки и лаборатории фиксируются как отдельные подтверждённые факты с версиями и источниками. При конфликте помощник должен показать оба факта и расхождение, а не выбирать удобный результат. Критичные изменения требуют полномочий и аудита.', facts: ['Масса хранится с контролируемой точностью, деньги — без float.','Лабораторный результат нельзя менять через чат.','Расхождение может стать основанием для блокера или спора.'], maturity: 'Конкретные методы испытаний и нормативы зависят от договора, культуры и подключённой лаборатории.', suggestions: ['Что делать при расхождении?','Кто подтверждает протокол?','Как качество влияет на расчёт?'] },
      en: { title: 'Quality, mass and laboratory', answer: 'Acceptance and laboratory results are recorded as separate verified facts with versions and sources. On conflict, the assistant must show both facts and the variance rather than select a convenient result. Critical changes require authority and audit.', facts: ['Mass uses controlled precision and money avoids floating point.','Laboratory results cannot be edited through chat.','Variance may create a blocker or dispute basis.'], maturity: 'Specific methods and standards depend on contract, commodity and connected laboratory.', suggestions: ['What happens on variance?','Who confirms a protocol?','How does quality affect settlement?'] },
      zh: { title: '质量、重量与实验室', answer: '验收和实验室结果作为带版本和来源的独立事实记录。发生冲突时，助手显示双方事实和差异，而不是选择某一结果。关键变更需要权限和审计。', facts: ['重量采用受控精度，金额不用浮点。','不能通过聊天修改实验室结果。','差异可形成阻碍或争议依据。'], maturity: '具体检测方法和标准取决于合同、品种和实验室。', suggestions: ['出现差异怎么办？','谁确认报告？','质量如何影响结算？'] },
    }, sources: [S.how],
  },
  {
    id: 'finance',
    keywords: { ru: ['кредит','финансирование','факторинг','оборотные средства','отсрочка','лимит','залог'], en: ['credit','financing','factoring','working capital','limit','collateral'], zh: ['信贷','融资','保理','营运资金','额度','抵押'] },
    copy: {
      ru: { title: 'Финансирование сделки', answer: 'Платформа может формировать доказуемый цифровой контур для кредитного или расчётного продукта: участники, условия, события исполнения, документы, резерв и риски. Но решение о кредитовании, лимите и ставке принимает банк, а не помощник и не интерфейс платформы.', facts: ['Кредит должен быть связан с конкретной Сделкой и основаниями.','Автоматическое решение не должно нарушать права пользователя.','Подтверждённый продукт появляется только после договора с банком.'], maturity: 'Кредитные продукты и ставки не считаются доступными без подтверждённого банковского подключения.', suggestions: ['Что увидит банк?','Какие данные нужны для кредита?','Можно ли платить частями?'] },
      en: { title: 'Deal financing', answer: 'The platform can provide an evidence-based digital context for credit or settlement products: parties, terms, execution events, documents, reserve and risks. The bank—not the assistant or UI—decides credit, limits and rates.', facts: ['Credit should be tied to a specific Deal and evidence.','Automated decisions must not unlawfully affect user rights.','A product becomes live only after a bank contract.'], maturity: 'Credit products and rates are unavailable until a bank connection is confirmed.', suggestions: ['What does the bank see?','What data supports credit?','Can settlement be partial?'] },
      zh: { title: '交易融资', answer: '平台可为信贷或结算产品提供可证明的数字上下文：参与方、条件、履约事件、文件、预留和风险。但授信、额度和利率由银行决定。', facts: ['信贷应绑定具体交易和依据。','自动决策不得违法影响用户权利。','银行签约后产品才算上线。'], maturity: '未确认银行连接前，不提供信贷产品或利率。', suggestions: ['银行看到什么？','授信需要哪些数据？','可以分期结算吗？'] },
    }, sources: [S.secure, S.contact],
  },
  {
    id: 'tax_accounting',
    keywords: { ru: ['налог','ндс','бухгалтерия','проводка','учет','учёт','счет-фактура','акт сверки'], en: ['tax','vat','accounting','invoice','reconciliation'], zh: ['税','增值税','会计','发票','对账'] },
    copy: {
      ru: { title: 'Налоги и бухгалтерский учёт', answer: 'Платформа может хранить документы, статусы и события, необходимые для бухгалтерской сверки и интеграции с ERP/ЭДО. Она не заменяет бухгалтерскую систему и не даёт индивидуальное налоговое заключение. НДС, первичные документы и проводки определяются договором, статусом сторон и применимым законодательством.', facts: ['Источник бухгалтерской истины должен быть явно определён.','Повторная передача документа не должна создавать дубль.','Юридически значимые документы требуют проверки подписи и версии.'], maturity: 'Налоговые ответы носят общий информационный характер и требуют проверки специалистом по конкретной операции.', suggestions: ['Можно интегрировать 1С?','Как работает ЭДО?','Как исключаются дубли документов?'] },
      en: { title: 'Tax and accounting', answer: 'The platform can retain documents, statuses and events needed for accounting reconciliation and ERP/EDI integration. It does not replace an accounting system or provide transaction-specific tax advice. VAT, primary documents and postings depend on contracts, party status and applicable law.', facts: ['The accounting truth source must be explicit.','Document retries must not create duplicates.','Legally significant documents require signature and version checks.'], maturity: 'Tax information is general and requires specialist review for a concrete transaction.', suggestions: ['Can it integrate with ERP?','How does EDI work?','How are duplicates prevented?'] },
      zh: { title: '税务与会计', answer: '平台可保存会计核对和ERP/电子单证集成所需的文件、状态和事件，但不替代会计系统，也不提供个别税务结论。增值税、原始凭证和分录取决于合同、主体身份和适用法律。', facts: ['必须明确会计事实来源。','重传文件不得产生重复。','法律文件需验证签名和版本。'], maturity: '税务信息为一般说明，具体交易需专业人员核查。', suggestions: ['能否集成ERP？','电子单证如何工作？','如何防止重复文件？'] },
    }, sources: [S.privacy, S.contact],
  },
  {
    id: 'legal',
    keywords: { ru: ['закон','юридический','договор','оферта','ответственность','152-фз','персональные данные','коммерческая тайна'], en: ['law','legal','contract','liability','personal data','trade secret'], zh: ['法律','合同','责任','个人数据','商业秘密'] },
    copy: {
      ru: { title: 'Юридическая исполнимость', answer: 'Платформа должна отделять информационную помощь от юридически значимых действий. Договор, КЭП, полномочия, персональные данные, коммерческая тайна и решение по спору требуют самостоятельного правового контура. Помощник объясняет статус и готовит черновики, но не заменяет юриста и не принимает решение за уполномоченное лицо.', facts: ['Критические действия подтверждаются пользователем и сервером.','Автоматизированное решение не должно незаконно создавать правовые последствия.','Доказательства должны иметь источник, время, версию и аудит.'], maturity: 'Конкретная правовая оценка зависит от договора, роли сторон и применимого права.', suggestions: ['Как работает КЭП?','Что считается доказательством?','Кто принимает решение по спору?'] },
      en: { title: 'Legal enforceability', answer: 'The platform separates information assistance from legally significant actions. Contracts, qualified signatures, authority, personal data, trade secrets and dispute decisions require a dedicated legal control layer. The assistant explains and drafts but does not replace counsel or decide for an authorized person.', facts: ['Critical actions are confirmed by user and server.','Automation must not unlawfully create legal effects.','Evidence needs source, time, version and audit.'], maturity: 'Specific legal assessment depends on contract, party role and applicable law.', suggestions: ['How do electronic signatures work?','What counts as evidence?','Who decides a dispute?'] },
      zh: { title: '法律可执行性', answer: '平台把信息帮助与具有法律效力的操作分开。合同、合格电子签名、权限、个人数据、商业秘密和争议决定需要独立法律控制。助手可解释和起草，但不能替代律师或授权人决定。', facts: ['关键操作由用户和服务器确认。','自动化不得违法产生法律后果。','证据需包含来源、时间、版本和审计。'], maturity: '具体法律判断取决于合同、角色和适用法律。', suggestions: ['电子签名如何工作？','什么算证据？','谁决定争议？'] },
    }, sources: [S.privacy, S.secure],
  },
  {
    id: 'security',
    keywords: { ru: ['безопасность','утечка','взлом','шифрование','mfa','аудит','rbac','изоляция'], en: ['security','leak','hack','encryption','mfa','audit','rbac','isolation'], zh: ['安全','泄露','攻击','加密','多因素','审计','隔离'] },
    copy: {
      ru: { title: 'Безопасность и изоляция', answer: 'Безопасность строится на серверном RBAC, tenant isolation, MFA, минимизации данных, аудите, идемпотентности и запрете прямого доступа модели к базе. Публичный помощник не видит ЛК; приватный получает только разрешённый контекст текущей роли и Сделки.', facts: ['Роль не берётся из URL или localStorage.','Модель не получает универсальные SQL/API-инструменты.','Критические события имеют audit trail.'], maturity: 'Архитектурные механизмы не заменяют подтверждённую эксплуатацию, pentest и историю инцидентов.', suggestions: ['Может ли ИИ увидеть чужую сделку?','Как защищены документы?','Что происходит при сбое?'] },
      en: { title: 'Security and isolation', answer: 'Security relies on server-side RBAC, tenant isolation, MFA, data minimization, audit, idempotency and no direct model-to-database access. The public assistant has no workspace access; the private one receives only authorized role and Deal context.', facts: ['Role is not derived from URL or local storage.','The model has no universal SQL/API tools.','Critical events have an audit trail.'], maturity: 'Architecture does not replace proven operation, penetration testing or incident history.', suggestions: ['Can AI see another Deal?','How are documents protected?','What happens on failure?'] },
      zh: { title: '安全与隔离', answer: '安全依赖服务器RBAC、租户隔离、MFA、数据最小化、审计、幂等和禁止模型直连数据库。公共助手无法访问工作区；私有助手只接收当前角色和交易的授权上下文。', facts: ['角色不来自URL或本地存储。','模型没有通用SQL/API工具。','关键事件有审计轨迹。'], maturity: '架构不能替代真实运行、渗透测试和事故历史。', suggestions: ['AI能看到别人的交易吗？','文件如何保护？','故障时怎么办？'] },
    }, sources: [S.security, S.privacy],
  },
  {
    id: 'integrations',
    keywords: { ru: ['1с','erp','crm','api','эдо','фгис','сдиз','гис эпд','есиа','интеграция'], en: ['erp','crm','api','edi','government integration','integration'], zh: ['ERP','CRM','API','电子单证','政府集成','集成'] },
    copy: {
      ru: { title: 'Интеграции', answer: 'Целевая архитектура предусматривает API-интеграции с ERP, CRM, ЭДО, ФГИС «Зерно», СДИЗ, ГИС ЭПД, КЭП, ЕСИА, банками и транспортными системами. Каждая интеграция должна иметь отдельные credentials, inbox/outbox, подпись, идемпотентность, retry, reconciliation и статус подключения.', facts: ['Архитектурная возможность не равна действующему подключению.','Сбой внешнего провайдера не должен повреждать Сделку.','Повторный callback не создаёт повторную операцию.'], maturity: 'Конкретная интеграция считается активной только после договора, credentials и приёмки.', suggestions: ['Можно подключить 1С?','Как работает ФГИС «Зерно»?','Что происходит при недоступности банка?'] },
      en: { title: 'Integrations', answer: 'The target architecture supports API integration with ERP, CRM, EDI, grain-government systems, electronic transport documents, electronic signatures, identity providers, banks and transport systems. Each integration requires separate credentials, inbox/outbox, signatures, idempotency, retries, reconciliation and connection status.', facts: ['Architectural support is not a live connection.','Provider failure must not corrupt the Deal.','Repeated callbacks must not duplicate operations.'], maturity: 'An integration is live only after contract, credentials and acceptance.', suggestions: ['Can ERP be connected?','How do government systems connect?','What if a bank is unavailable?'] },
      zh: { title: '系统集成', answer: '目标架构支持ERP、CRM、电子单证、粮食政府系统、电子运输单证、电子签名、身份、银行和运输系统API集成。每个集成都需要独立凭据、收发箱、签名、幂等、重试、对账和连接状态。', facts: ['架构支持不等于已连接。','外部故障不能破坏交易。','重复回调不能产生重复操作。'], maturity: '合同、凭据和验收完成后才算上线。', suggestions: ['可以连接ERP吗？','政府系统如何连接？','银行不可用怎么办？'] },
    }, sources: [S.fgis, S.contact],
  },
  {
    id: 'analytics',
    keywords: { ru: ['аналитика','отчет','отчёт','дашборд','kpi','прогноз','риск сделок'], en: ['analytics','report','dashboard','kpi','forecast','deal risk'], zh: ['分析','报告','仪表板','指标','预测','交易风险'] },
    copy: {
      ru: { title: 'Аналитика и управление', answer: 'Аналитика строится на событиях Сделок: объём, сроки, блокеры, качество, документы, деньги, споры и действия ролей. Руководитель должен видеть не декоративные графики, а отклонения, сумму под риском, владельца проблемы и следующий шаг.', facts: ['Отчёты не должны создавать отдельный источник истины.','Метрики выводятся из серверных событий и версий.','Прогноз должен быть отделён от подтверждённого факта.'], maturity: 'Точность прогнозов требует реальной истории эксплуатации и проверки качества модели.', suggestions: ['Какие KPI доступны?','Как считается риск?','Можно выгружать отчёты?'] },
      en: { title: 'Analytics and management', answer: 'Analytics is built from Deal events: volume, deadlines, blockers, quality, documents, money, disputes and role actions. Executives need actionable deviations, money at risk, problem owner and next action—not decorative charts.', facts: ['Reports must not become a second truth source.','Metrics derive from server events and versions.','Forecasts are separated from confirmed facts.'], maturity: 'Forecast accuracy requires real operating history and model validation.', suggestions: ['Which KPIs are available?','How is risk calculated?','Can reports be exported?'] },
      zh: { title: '分析与管理', answer: '分析基于交易事件：数量、期限、阻碍、质量、文件、资金、争议和角色操作。管理层需要看到偏差、风险金额、问题责任人和下一步，而不是装饰性图表。', facts: ['报告不能成为第二事实来源。','指标来自服务器事件和版本。','预测与已确认事实分开。'], maturity: '预测准确性需要真实运行历史和模型验证。', suggestions: ['有哪些KPI？','风险如何计算？','能导出报告吗？'] },
    }, sources: [S.how],
  },
  {
    id: 'reliability',
    keywords: { ru: ['нагрузка','масштаб','отказ','резервирование','доступность','sla','восстановление','производительность'], en: ['load','scale','failure','availability','sla','recovery','performance'], zh: ['负载','扩展','故障','可用性','恢复','性能'] },
    copy: {
      ru: { title: 'Надёжность и масштабирование', answer: 'Целевая система проектируется для горизонтального масштабирования, нескольких экземпляров API и worker, PostgreSQL HA, очередей, идемпотентности, наблюдаемости, backup/restore и безопасной деградации. Промышленный статус требует не только кода, но и нагрузочных, fault-injection, restore и soak-доказательств.', facts: ['Повторные команды не должны создавать дубли.','Сбой worker не должен терять события.','Recovery проверяется машинными артефактами.'], maturity: 'Production-like acceptance не равна подтверждённой многолетней эксплуатации.', suggestions: ['Что происходит при сбое?','Как восстанавливаются данные?','Какой масштаб поддерживается?'] },
      en: { title: 'Reliability and scale', answer: 'The target system uses horizontal scaling, multiple API and worker replicas, PostgreSQL HA, queues, idempotency, observability, backup/restore and safe degradation. Industrial status requires load, fault-injection, restore and soak evidence—not code alone.', facts: ['Retries must not create duplicates.','Worker failure must not lose events.','Recovery is verified by machine-readable artifacts.'], maturity: 'Production-like acceptance is not long-term proven operation.', suggestions: ['What happens on failure?','How is data restored?','What scale is supported?'] },
      zh: { title: '可靠性与扩展', answer: '目标系统采用横向扩展、多API和worker副本、PostgreSQL高可用、队列、幂等、可观测性、备份恢复和安全降级。工业状态需要负载、故障注入、恢复和长时间运行证据。', facts: ['重试不能产生重复。','worker故障不能丢事件。','恢复通过机器可读证据验证。'], maturity: '类生产验收不等于长期真实运行。', suggestions: ['故障时怎么办？','数据如何恢复？','支持多大规模？'] },
    }, sources: [S.security],
  },
  {
    id: 'comparison',
    keywords: { ru: ['чем отличается','конкурент','маркетплейс','биржа','доска объявлений','зачем не авито','аналог'], en: ['different','competitor','marketplace','exchange','classifieds','alternative'], zh: ['区别','竞争对手','市场平台','交易所','分类信息','替代方案'] },
    copy: {
      ru: { title: 'Чем платформа отличается', answer: '«Прозрачная Цена» не заканчивается на поиске контрагента или цене. Её ядро — исполнение одной Сделки: допуск, аукцион, логистика, приёмка, лаборатория, документы, деньги, спор и доказательства. Поэтому сравнивать её нужно не только с торговыми площадками, но и с набором ERP, ЭДО, TMS, банковских и dispute-процессов, которые она связывает.', facts: ['Цена без исполнения не является завершённой ценностью.','Главный объект — Сделка, а не объявление.','Anti-bypass достигается полезностью исполнения и доказательств.'], maturity: 'Конкретное сравнение требует подтверждённых функций и условий каждого конкурента.', suggestions: ['Почему участники останутся внутри?','Чем отличается от биржи?','Можно использовать вместе с ERP?'] },
      en: { title: 'How the platform differs', answer: 'Transparent Price does not stop at matching or price discovery. Its core is execution of one Deal: admission, auction, logistics, acceptance, laboratory, documents, money, disputes and evidence. It should be compared not only with marketplaces but with the ERP, EDI, TMS, banking and dispute processes it connects.', facts: ['Price without execution is incomplete value.','The primary object is the Deal, not a listing.','Anti-bypass comes from execution and evidence utility.'], maturity: 'Specific competitor comparison requires verified current features and terms.', suggestions: ['Why will users stay inside?','How is it different from an exchange?','Can it coexist with ERP?'] },
      zh: { title: '平台的区别', answer: '“透明价格”不止于撮合或发现价格，核心是执行一笔交易：准入、竞价、物流、验收、实验室、文件、资金、争议和证据。因此不仅应与市场平台比较，也应与其连接的ERP、电子单证、运输、银行和争议流程比较。', facts: ['只有价格没有履约并不完整。','核心对象是交易而非广告。','防绕过来自履约和证据价值。'], maturity: '具体竞品比较需要核实现有功能和条件。', suggestions: ['为什么用户会留在平台？','与交易所有何不同？','能与ERP共存吗？'] },
    }, sources: [S.home, S.how],
  },
  {
    id: 'support',
    keywords: { ru: ['поддержка','помощь','связаться','оператор','не работает','ошибка','обучение'], en: ['support','help','contact','operator','not working','error','training'], zh: ['支持','帮助','联系','客服','错误','培训'] },
    copy: {
      ru: { title: 'Поддержка и сопровождение', answer: 'Помощник отвечает по подтверждённым знаниям и доступному контексту. Если уверенного ответа нет, он не выдумывает: запрашивает уточнение, выдаёт номер обращения и регистрирует пробел знаний без сохранения полного текста публичного вопроса. Человеческая поддержка остаётся отдельным каналом.', facts: ['Публичный и приватный помощники разделены.','Неотвеченный вопрос становится сигналом для улучшения базы знаний.','Критическая проблема должна иметь маршрут к оператору.'], maturity: 'Фактические часы и SLA поддержки утверждаются коммерческими условиями.', suggestions: ['Как связаться с проектом?','Что делать при ошибке?','Как обучаются пользователи?'] },
      en: { title: 'Support and assistance', answer: 'The assistant answers from verified knowledge and authorized context. If grounding is insufficient, it asks for clarification, provides a reference number and registers a knowledge gap without storing the full public question. Human support remains separate.', facts: ['Public and private assistants are separated.','An unanswered question becomes a knowledge-improvement signal.','Critical problems need an operator escalation route.'], maturity: 'Actual support hours and SLA depend on commercial terms.', suggestions: ['How do I contact the project?','What should I do on an error?','How are users trained?'] },
      zh: { title: '支持与服务', answer: '助手基于已验证知识和授权上下文回答。依据不足时不编造，而是请求澄清、提供编号，并在不保存完整公开问题的情况下登记知识缺口。人工支持保持独立。', facts: ['公共和私有助手分离。','未回答问题成为知识改进信号。','关键问题需要转交运营人员。'], maturity: '实际支持时间和SLA取决于商业条件。', suggestions: ['如何联系项目？','发生错误怎么办？','如何培训用户？'] },
    }, sources: [S.contact],
  },
];

function norm(value: string): string { return value.normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/gu, 'е').replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/gu, ' ').trim(); }
function score(topic: Topic, query: string, locale: PublicAssistantLocale): number { return topic.keywords[locale].reduce((sum, keyword) => sum + (query.includes(norm(keyword)) ? Math.max(4, keyword.length) : 0), 0); }

export function answerProspectQuestion(question: string, locale: PublicAssistantLocale): ProspectAnswer | null {
  const query = norm(question);
  let best: Topic | null = null;
  let bestScore = 0;
  for (const topic of T) {
    const current = score(topic, query, locale);
    if (current > bestScore) { best = topic; bestScore = current; }
  }
  if (!best || bestScore < 4) return null;
  const copy = best.copy[locale];
  return { knowledgeVersion: PROSPECT_KNOWLEDGE_VERSION, topic: best.id, title: copy.title, answer: copy.answer, facts: copy.facts, maturity: copy.maturity, confidence: bestScore >= 10 ? 'high' : 'medium', actionAllowed: false, sources: best.sources, suggestions: copy.suggestions };
}

export function prospectTopics(locale: PublicAssistantLocale) {
  return T.map((topic) => ({ id: topic.id, title: topic.copy[locale].title }));
}
