export type HomeLocale = 'ru' | 'en' | 'zh';

const ru = {
  a11y: { site: 'Прозрачная Цена', nav: 'Главная навигация', menu: 'Меню', controlTower: 'Сценарий текущего состояния Сделки' },
  nav: { how: 'Как работает', participants: 'Сценарий Сделки', money: 'Расчёты', integrations: 'Интеграции', status: 'Контроль', login: 'Войти', connect: 'Подключить организацию' },
  hero: {
    primary: 'Посмотреть Сделку в работе',
    secondary: 'Подключить организацию',
    tertiary: 'Как работает TAI',
    proofLabel: 'Принципы исполнения Сделки',
    proofs: ['Одна карточка Сделки', 'Переходы по основаниям', 'Деньги связаны с событиями'],
  },
  tower: {
    sampleLabel: 'Сценарий исполнения',
    deal: 'Подсолнечник · 1 200 т',
    stage: 'Приёмка и качество',
    progressLabel: 'Прогресс сценария Сделки',
    statusLabel: 'Статус', status: 'Расчёт остановлен', deviation: 'Отклонение качества',
    ownerLabel: 'Ответственный', owner: 'Лаборатория и покупатель', deadline: 'Следующее действие до 16:30',
    moneyLabel: 'Деньги', money: 'Резерв сохранён', release: 'Выплата ожидает основания',
    nextLabel: 'Следующий шаг', next: 'Подписать акт', nextNote: 'Затем применить правило перерасчёта',
    taiTitle: 'TAI объяснил остановку', taiText: 'Влажность выше допуска, акт не подписан. Проект следующего действия подготовлен.',
  },
  trust: {
    label: 'Контур доверия платформы',
    items: [
      ['Единая Сделка', 'Товар, участники, рейс, качество, документы и деньги связаны между собой.'],
      ['Проверяемый переход', 'Следующий этап открывается только при наличии роли, события и основания.'],
      ['История доказательств', 'Версии документов, действия, отклонения и решения сохраняются вместе.'],
      ['Контроль по ролям', 'Каждый участник видит свой контекст и доступные ему действия.'],
    ],
  },
  category: {
    eyebrow: 'Главное отличие',
    title: 'Платформа ведёт Сделку после выбора цены',
    text: 'После согласования условий начинается самая дорогая часть сделки: исполнение, качество, документы, расчёты и возможный спор.',
    marketplace: 'Площадка предложений', marketplaceText: 'Помогает найти цену и контрагента.',
    platform: 'Прозрачная Цена', platformText: 'Ведёт исполнение до расчёта, доказательств и закрытия Сделки.',
  },
  lifecycle: {
    eyebrow: 'Контур исполнения',
    title: 'Весь путь Сделки — в одной системе',
    lead: 'На каждом этапе видны статус, ответственный, подтверждающее основание, влияние на деньги и следующий шаг.',
    hint: 'Проведите по этапам вправо, чтобы увидеть полный путь.',
    phases: ['Условия', 'Допуск', 'Торги', 'Победитель', 'Сделка', 'Договор', 'Финансирование', 'Перевозка', 'Приёмка', 'Хранение', 'Лаборатория', 'Документы', 'Госсистемы', 'Расчёт', 'Спор', 'Доказательства', 'Перерасчёт', 'Закрытие', 'Аналитика'],
  },
  scenario: {
    eyebrow: 'Сценарий исполнения',
    title: 'Разберите отклонение за 90 секунд',
    lead: 'Партия прибыла на приёмку. Фактическая влажность выше допуска, акт расхождений не подписан, резерв денег сохранён.',
    dealLabel: 'Товар и объём', dealValue: 'Подсолнечник · 1 200 т',
    stageLabel: 'Текущий этап', stageValue: 'Приёмка и лаборатория',
    blockerLabel: 'Что остановило Сделку', blocker: 'Влажность выше допуска на 0,8 п.п.; подписи покупателя под актом расхождений нет.',
    ownerLabel: 'Кто отвечает', owner: 'Лаборатория и покупатель',
    status: 'Расчёт остановлен',
    money: 'Деньги остаются зарезервированными до подтверждения нового основания расчёта.',
    next: 'Следующий шаг: подтвердить протокол, подписать акт и выбрать договорное правило перерасчёта.',
    evidence: 'Основания: проба, протокол лаборатории, акт приёмки и версия спецификации.',
    cta: 'Открыть полный сценарий',
  },
  tai: {
    eyebrow: 'TAI внутри Сделки',
    title: 'Объясняет проблему и готовит действие',
    text: 'TAI собирает статусы, документы и события в короткий ответ: что произошло, почему остановилось, кто отвечает и что требуется подтвердить.',
    mode: 'Помощник по Сделке',
    answer: 'Окончательный расчёт остановлен: влажность выше согласованного допуска, а акт расхождений ещё не подтверждён покупателем.',
    modes: ['На публичной странице работает без доступа к закрытым данным', 'В кабинете учитывает роль и права организации', 'В Сделке анализирует доступные документы и готовит действие'],
    boundaries: 'TAI не меняет права, не подписывает документы, не выпускает деньги и не решает спор вместо человека.',
    source: 'Основание сценария: протокол лаборатории № L-204',
    freshness: 'Контекст: приёмка и качество',
    confidence: 'Надёжность вывода: высокая',
    action: 'Проект акта расхождений подготовлен и ждёт подтверждения пользователя.',
  },
  crops: {
    eyebrow: 'Растениеводство',
    title: 'Единая модель Сделки учитывает специфику товара',
    lead: 'Общий контур исполнения сохраняется, а требования к качеству, хранению, перевозке и документам задаются для конкретной категории.',
    groups: [
      ['Зерновые', 'Партия · качество · СДИЗ'],
      ['Масличные и бобовые', 'Допуски · лаборатория · перерасчёт'],
      ['Технические культуры', 'Спецификация · хранение · приёмка'],
      ['Овощи и картофель', 'Сортность · упаковка · температурный режим'],
      ['Плодово-ягодная продукция', 'Качество · сроки · холодовая цепь'],
      ['Семена и посадочный материал', 'Партия · документы · прослеживаемость'],
    ],
  },
  money: {
    eyebrow: 'Деньги внутри Сделки',
    title: 'Выплата — по подтверждённым событиям',
    lead: 'Расчёт не живёт отдельно от исполнения. Резерв, частичная или окончательная выплата, возврат и сверка связаны с правилами конкретной Сделки.',
    chain: 'Резервирование → исполнение → подтверждение → выплата → сверка → закрытие',
    steps: ['Основание видно', 'Статус денег понятен', 'События сохраняются'],
    exception: 'При отклонении: остановка → доказательства → решение → перерасчёт → выплата или возврат.',
  },
  integrations: {
    eyebrow: 'Интеграционный контур',
    title: 'Внешнее событие становится частью конкретной Сделки',
    lead: 'Платформа связывает идентификатор, источник, время и результат внешнего события с этапом, документом и денежным последствием.',
    hubLabel: 'Главный объект системы', hub: 'Сделка', hubText: 'Единый контекст исполнения и доказательств',
    items: [
      ['ФГИС «Зерно» / СДИЗ', 'Партия и прослеживаемость'],
      ['ЭДО / КЭП', 'Подписание и обмен документами'],
      ['ГИС ЭПД', 'Перевозочные документы и события'],
      ['Банковские API', 'Резервирование, выплаты и сверка'],
      ['ERP / CRM', 'Данные, статусы и учёт'],
      ['Лаборатории / телематика', 'Качество, маршрут и фактические события'],
    ],
    note: 'Состав, права и режим обмена определяются отдельно для каждого подключения организации.',
  },
  federal: {
    eyebrow: 'Контроль и безопасность',
    title: 'Критические действия требуют основания',
    lead: 'Права, контекст, версия данных и повторный запрос проверяются до изменения состояния Сделки.',
    pillars: [
      ['Одна карточка Сделки', 'Все связанные объекты остаются в едином контексте.'],
      ['Ролевой доступ', 'Права определяются системой, а не адресом страницы или клиентом.'],
      ['Изоляция организаций', 'Данные и действия разделяются по организации и полномочиям.'],
      ['Неизменяемая история', 'Ключевые события и основания сохраняются для проверки.'],
      ['Защита от повторов', 'Критические запросы обрабатываются идемпотентно.'],
      ['API-контур', 'Интеграции подключаются через управляемые адаптеры.'],
    ],
    foot: 'Архитектура не требует отдельного обходного процесса для мобильного интерфейса, интеграций или масштабирования.',
  },
  faq: {
    eyebrow: 'Коротко о главном', title: 'Частые вопросы',
    items: [
      ['Это marketplace?', 'Нет. Поиск условий может быть частью процесса, но основная задача платформы — контролировать исполнение Сделки после выбора цены.'],
      ['TAI выполняет действия сам?', 'TAI анализирует, объясняет и готовит действие. Критические операции требуют проверки прав и подтверждения человека.'],
      ['Как подключаются внешние системы?', 'Через управляемые API-адаптеры. Внешнее событие связывается со Сделкой и получает проверяемый источник.'],
      ['Платформа работает только с зерном?', 'Нет. Единая модель Сделки применяется к категориям растениеводства с учётом их качества, хранения, логистики и документов.'],
      ['Как начать подключение?', 'Оставьте основные данные организации. После проверки сценария будет определён состав ролей, интеграций и следующий шаг.'],
    ],
  },
  final: { title: 'Подключите организацию к контуру Сделки', lead: 'Начните с рабочего сценария. Платформа свяжет участников, исполнение, документы и расчёты без разрыва между системами.', primary: 'Начать подключение', secondary: 'Посмотреть Сделку в работе' },
  footer: { note: 'Единая цифровая инфраструктура исполнения агросделки: от условий и торгов до расчёта, доказательств и закрытия.', privacy: 'Конфиденциальность', contacts: 'Контакты' },
} as const;

type WidenCopy<T> = T extends string
  ? string
  : T extends readonly (infer Item)[]
    ? readonly WidenCopy<Item>[]
    : T extends object
      ? { -readonly [Key in keyof T]: WidenCopy<T[Key]> }
      : T;

type HomeCopy = WidenCopy<typeof ru>;

const en: HomeCopy = {
  a11y: { site: 'Transparent Price', nav: 'Main navigation', menu: 'Menu', controlTower: 'Deal status scenario' },
  nav: { how: 'How it works', participants: 'Deal scenario', money: 'Settlement', integrations: 'Integrations', status: 'Control', login: 'Sign in', connect: 'Connect organisation' },
  hero: { primary: 'See a Deal in action', secondary: 'Connect organisation', tertiary: 'How TAI works', proofLabel: 'Deal execution principles', proofs: ['One Deal record', 'Evidence-based transitions', 'Money linked to events'] },
  tower: {
    sampleLabel: 'Execution scenario', deal: 'Sunflower · 1,200 t', stage: 'Acceptance and quality', progressLabel: 'Deal scenario progress',
    statusLabel: 'Status', status: 'Settlement paused', deviation: 'Quality deviation',
    ownerLabel: 'Owner', owner: 'Laboratory and buyer', deadline: 'Next action due 16:30',
    moneyLabel: 'Money', money: 'Reserve retained', release: 'Payout awaits evidence',
    nextLabel: 'Next action', next: 'Sign the discrepancy act', nextNote: 'Then apply the contractual recalculation rule',
    taiTitle: 'TAI explained the pause', taiText: 'Moisture exceeds tolerance and the act is unsigned. The next action has been prepared.',
  },
  trust: { label: 'Platform trust framework', items: [
    ['One Deal', 'Product, participants, trip, quality, documents and money remain connected.'],
    ['Verifiable transition', 'The next stage requires a role, an event and supporting evidence.'],
    ['Evidence history', 'Document versions, actions, deviations and decisions stay together.'],
    ['Role-based control', 'Each participant sees their context and permitted actions.'],
  ] },
  category: { eyebrow: 'Key difference', title: 'The platform does not stop after price selection', text: 'Once terms are agreed, the costly part begins: execution, quality, documents, settlement and possible disputes.', marketplace: 'Offer marketplace', marketplaceText: 'Helps find a price and counterparty.', platform: 'Transparent Price', platformText: 'Carries execution through settlement, evidence and Deal closure.' },
  lifecycle: { eyebrow: 'Execution framework', title: 'The complete Deal path in one system', lead: 'Every stage shows status, owner, supporting evidence, monetary impact and the next action.', hint: 'Swipe right through the stages to see the full path.', phases: ['Terms', 'Admission', 'Auction', 'Winner', 'Deal', 'Contract', 'Financing', 'Transport', 'Acceptance', 'Storage', 'Laboratory', 'Documents', 'State systems', 'Settlement', 'Dispute', 'Evidence', 'Recalculation', 'Closure', 'Analytics'] },
  scenario: {
    eyebrow: 'Execution scenario', title: 'Understand a deviation in 90 seconds', lead: 'The lot has reached acceptance. Measured moisture exceeds tolerance, the discrepancy act is unsigned and the money reserve remains in place.',
    dealLabel: 'Product and volume', dealValue: 'Sunflower · 1,200 t', stageLabel: 'Current stage', stageValue: 'Acceptance and laboratory',
    blockerLabel: 'What stopped the Deal', blocker: 'Moisture is 0.8 percentage points above tolerance; the buyer has not signed the discrepancy act.', ownerLabel: 'Who owns it', owner: 'Laboratory and buyer',
    status: 'Settlement paused', money: 'Funds remain reserved until a revised settlement basis is confirmed.', next: 'Next action: confirm the protocol, sign the act and select the contractual recalculation rule.', evidence: 'Evidence: sample, laboratory protocol, acceptance act and specification version.', cta: 'Open the full scenario',
  },
  tai: {
    eyebrow: 'TAI inside the Deal', title: 'Explains the issue and prepares an action', text: 'TAI turns statuses, documents and events into a short answer: what happened, why it stopped, who owns it and what must be confirmed.', mode: 'Deal assistant',
    answer: 'Final settlement is paused: moisture exceeds the agreed tolerance and the buyer has not yet confirmed the discrepancy act.',
    modes: ['On the public page it has no access to restricted data', 'In the workspace it respects organisation roles and permissions', 'Inside a Deal it analyses permitted documents and prepares an action'],
    boundaries: 'TAI does not change permissions, sign documents, release money or decide a dispute instead of a person.', source: 'Scenario basis: laboratory protocol L-204', freshness: 'Context: acceptance and quality', confidence: 'Confidence: high', action: 'A draft discrepancy act is prepared and awaiting user confirmation.',
  },
  crops: { eyebrow: 'Crop trade', title: 'One Deal model adapts to the product', lead: 'The execution framework stays consistent while quality, storage, transport and document rules are configured for each category.', groups: [
    ['Grains', 'Lot · quality · traceability'], ['Oilseeds and pulses', 'Tolerances · laboratory · recalculation'], ['Industrial crops', 'Specification · storage · acceptance'], ['Vegetables and potatoes', 'Grade · packaging · temperature'], ['Fruit and berries', 'Quality · timing · cold chain'], ['Seed and planting material', 'Lot · documents · traceability'],
  ] },
  money: { eyebrow: 'Money inside the Deal', title: 'Payout follows confirmed events', lead: 'Settlement is not detached from execution. Reservation, partial or final payout, return and reconciliation follow the rules of the specific Deal.', chain: 'Reservation → execution → confirmation → payout → reconciliation → closure', steps: ['Evidence is visible', 'Money status is clear', 'Events are retained'], exception: 'On deviation: pause → evidence → decision → recalculation → payout or return.' },
  integrations: { eyebrow: 'Integration framework', title: 'An external event becomes part of a specific Deal', lead: 'The platform links an external identifier, source, time and outcome to the stage, document and monetary consequence.', hubLabel: 'Primary system object', hub: 'Deal', hubText: 'Unified execution and evidence context', items: [
    ['FGIS Grain / traceability', 'Lot identity and traceability'], ['EDI / digital signature', 'Document signing and exchange'], ['Electronic transport documents', 'Transport documents and events'], ['Banking APIs', 'Reservation, payout and reconciliation'], ['ERP / CRM', 'Data, status and accounting'], ['Laboratories / telematics', 'Quality, route and physical events'],
  ], note: 'Scope, permissions and exchange mode are defined for each organisation connection.' },
  federal: { eyebrow: 'Control and security', title: 'Critical actions require verifiable evidence', lead: 'Permissions, context, data version and replay safety are checked before a Deal state changes.', pillars: [
    ['One Deal record', 'All related objects remain in one context.'], ['Role-based access', 'Permissions come from the system, not a URL or client choice.'], ['Organisation isolation', 'Data and actions are separated by organisation and authority.'], ['Immutable history', 'Key events and evidence remain available for verification.'], ['Replay protection', 'Critical requests are processed idempotently.'], ['API framework', 'Integrations connect through governed adapters.'],
  ], foot: 'The architecture does not require a separate bypass process for mobile use, integrations or scaling.' },
  faq: { eyebrow: 'Key questions', title: 'Frequently asked questions', items: [
    ['Is this a marketplace?', 'No. Price discovery may be part of the flow, but the platform primarily controls Deal execution after price selection.'], ['Does TAI act autonomously?', 'TAI analyses, explains and prepares an action. Critical operations require permission checks and human confirmation.'], ['How do external systems connect?', 'Through governed API adapters. Each external event is linked to a Deal and a verifiable source.'], ['Is the platform limited to grain?', 'No. The common Deal model supports crop categories while preserving their quality, storage, logistics and document rules.'], ['How do we start?', 'Provide the organisation basics. After scenario review, the required roles, integrations and next step are defined.'],
  ] },
  final: { title: 'Connect your organisation to one Deal framework', lead: 'Start with an operating scenario. The platform connects participants, execution, documents and settlement without gaps between systems.', primary: 'Start connection', secondary: 'See a Deal in action' },
  footer: { note: 'Unified digital infrastructure for agricultural Deal execution, from terms and trading to settlement, evidence and closure.', privacy: 'Privacy', contacts: 'Contacts' },
};

const zh: HomeCopy = {
  a11y: { site: '透明价格', nav: '主导航', menu: '菜单', controlTower: '交易状态场景' },
  nav: { how: '运行方式', participants: '交易场景', money: '结算', integrations: '集成', status: '控制', login: '登录', connect: '接入机构' },
  hero: { primary: '查看交易运行', secondary: '接入机构', tertiary: 'TAI 如何工作', proofLabel: '交易执行原则', proofs: ['一笔交易记录', '基于依据的流转', '资金关联事件'] },
  tower: {
    sampleLabel: '执行场景', deal: '葵花籽 · 1,200 吨', stage: '验收与质量', progressLabel: '交易场景进度',
    statusLabel: '状态', status: '结算暂停', deviation: '质量偏差', ownerLabel: '责任方', owner: '实验室与买方', deadline: '下一步截止 16:30',
    moneyLabel: '资金', money: '预留保持', release: '付款等待依据', nextLabel: '下一步', next: '签署差异单', nextNote: '随后应用合同重算规则',
    taiTitle: 'TAI 已解释暂停原因', taiText: '水分超出容差且差异单未签署，下一步行动已准备。',
  },
  trust: { label: '平台信任框架', items: [
    ['同一笔交易', '商品、参与方、运输、质量、文件与资金保持关联。'], ['可核验流转', '下一阶段必须具备角色、事件与依据。'], ['证据历史', '文件版本、操作、偏差与决定共同保存。'], ['按角色控制', '每个参与方只看到自身上下文和允许的操作。'],
  ] },
  category: { eyebrow: '核心差异', title: '平台不会在确定价格后结束', text: '条件确定后，真正昂贵的环节才开始：执行、质量、文件、结算与争议。', marketplace: '信息撮合平台', marketplaceText: '帮助寻找价格和交易对手。', platform: '透明价格', platformText: '持续管理执行、结算、证据直至交易关闭。' },
  lifecycle: { eyebrow: '执行闭环', title: '完整交易路径位于同一系统', lead: '每个阶段都显示状态、责任方、依据、资金影响与下一步。', hint: '向右滑动阶段以查看完整路径。', phases: ['条件', '准入', '竞价', '中选', '交易', '合同', '融资', '运输', '验收', '仓储', '实验室', '文件', '政府系统', '结算', '争议', '证据', '重算', '关闭', '分析'] },
  scenario: {
    eyebrow: '执行场景', title: '90 秒看懂一次偏差', lead: '货批已到达验收。实测水分高于容差，差异单尚未签署，资金预留保持。',
    dealLabel: '商品与数量', dealValue: '葵花籽 · 1,200 吨', stageLabel: '当前阶段', stageValue: '验收与实验室', blockerLabel: '交易停止原因', blocker: '水分比容差高 0.8 个百分点；买方尚未签署差异单。', ownerLabel: '责任方', owner: '实验室与买方',
    status: '结算暂停', money: '在新的结算依据确认前，资金保持预留。', next: '下一步：确认报告、签署差异单并选择合同重算规则。', evidence: '依据：样品、实验室报告、验收单与规格版本。', cta: '打开完整场景',
  },
  tai: {
    eyebrow: '交易内的 TAI', title: '解释问题并准备行动', text: 'TAI 将状态、文件与事件整理成简短答案：发生了什么、为何停止、谁负责以及需要确认什么。', mode: '交易助手', answer: '最终结算已暂停：水分超出约定容差，买方尚未确认差异单。',
    modes: ['公开页面不访问受限数据', '工作区内遵守机构角色与权限', '交易内分析允许访问的文件并准备行动'], boundaries: 'TAI 不更改权限、不签署文件、不释放资金，也不会代替人工裁决争议。', source: '场景依据：实验室报告 L-204', freshness: '上下文：验收与质量', confidence: '结论可靠度：高', action: '差异单草稿已准备，等待用户确认。',
  },
  crops: { eyebrow: '种植业', title: '统一交易模型适配具体商品', lead: '执行闭环保持一致，同时为每个品类配置质量、仓储、运输与文件规则。', groups: [
    ['谷物', '批次 · 质量 · 追溯'], ['油料与豆类', '容差 · 实验室 · 重算'], ['经济作物', '规格 · 仓储 · 验收'], ['蔬菜与马铃薯', '等级 · 包装 · 温控'], ['水果与浆果', '质量 · 时效 · 冷链'], ['种子与种植材料', '批次 · 文件 · 追溯'],
  ] },
  money: { eyebrow: '交易内资金', title: '付款依据已确认事件', lead: '结算不与执行分离。预留、部分或最终付款、退款与对账遵循具体交易规则。', chain: '预留 → 执行 → 确认 → 付款 → 对账 → 关闭', steps: ['依据可见', '资金状态明确', '事件留痕'], exception: '发生偏差时：暂停 → 证据 → 决定 → 重算 → 付款或退款。' },
  integrations: { eyebrow: '集成闭环', title: '外部事件成为具体交易的一部分', lead: '平台将外部标识、来源、时间和结果关联到阶段、文件与资金后果。', hubLabel: '系统核心对象', hub: '交易', hubText: '统一的执行与证据上下文', items: [
    ['粮食监管 / 追溯', '批次与追溯'], ['电子文件 / 数字签名', '签署与文件交换'], ['电子运输文件', '运输文件与事件'], ['银行 API', '预留、付款与对账'], ['ERP / CRM', '数据、状态与核算'], ['实验室 / 车联网', '质量、路线与实际事件'],
  ], note: '每个机构接入的范围、权限与交换模式单独确定。' },
  federal: { eyebrow: '控制与安全', title: '关键操作必须具有可核验依据', lead: '交易状态改变前，系统检查权限、上下文、数据版本与重复请求。', pillars: [
    ['一笔交易记录', '所有关联对象保持在同一上下文。'], ['按角色访问', '权限由系统确定，而非网址或客户端选择。'], ['机构隔离', '数据与操作按机构和权限分离。'], ['不可变历史', '关键事件与依据可供核验。'], ['防重复处理', '关键请求采用幂等处理。'], ['API 闭环', '集成通过受控适配器接入。'],
  ], foot: '移动端、集成和扩展无需另建绕行流程。' },
  faq: { eyebrow: '核心问题', title: '常见问题', items: [
    ['这是 marketplace 吗？', '不是。价格发现可以是流程的一部分，但平台的主要任务是管理确定价格后的交易执行。'], ['TAI 会自主执行吗？', 'TAI 分析、解释并准备行动。关键操作必须经过权限检查和人工确认。'], ['外部系统如何接入？', '通过受控 API 适配器接入。每个外部事件都与交易及可核验来源关联。'], ['平台只支持谷物吗？', '不是。统一交易模型支持多类种植业商品，并保留其质量、仓储、物流与文件规则。'], ['如何开始接入？', '先提供机构基本信息。场景审核后确定角色、集成范围与下一步。'],
  ] },
  final: { title: '将机构接入统一交易闭环', lead: '从一个运营场景开始。平台在系统之间无断点地连接参与方、执行、文件与结算。', primary: '开始接入', secondary: '查看交易运行' },
  footer: { note: '农业交易执行的统一数字基础设施：从条件与交易到结算、证据与关闭。', privacy: '隐私', contacts: '联系方式' },
};

export function getPlatformV7HomeCopy(locale: string): HomeCopy {
  return locale === 'en' ? en : locale === 'zh' ? zh : ru;
}
