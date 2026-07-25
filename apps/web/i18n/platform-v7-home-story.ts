export type PlatformV7HomeStoryCopy = {
  nav: { how: string; tai: string; roles: string; maturity: string };
  heroMap: {
    eyebrow: string;
    title: string;
    items: readonly [string, string][];
    solution: string;
    solutionText: string;
    audiences: readonly string[];
  };
  process: {
    eyebrow: string;
    title: string;
    lead: string;
    steps: readonly { index: string; title: string; text: string }[];
    lifecycleLabel: string;
    lifecycleText: string;
  };
  ai: {
    eyebrow: string;
    title: string;
    lead: string;
    detectedLabel: string;
    detected: string;
    conclusionLabel: string;
    conclusion: string;
    impactLabel: string;
    impact: string;
    nextLabel: string;
    next: string;
    sourceLabel: string;
    source: string;
    confidenceLabel: string;
    confidence: string;
    cta: string;
  };
  roles: { eyebrow: string; title: string; lead: string; proof: string; cta: string };
  maturity: {
    eyebrow: string;
    title: string;
    lead: string;
    metrics: readonly [string, string][];
    pillars: readonly [string, string][];
    foot: string;
    primary: string;
    secondary: string;
  };
};

const ru: PlatformV7HomeStoryCopy = {
  nav: { how: 'Как работает', tai: 'TAI в Сделке', roles: 'Выгода по ролям', maturity: 'Промышленный контур' },
  heroMap: {
    eyebrow: 'Что обычно ломает расчёт',
    title: 'Цена уже согласована, а исполнение расходится по разным системам',
    items: [
      ['Логистика', 'Рейс завершён, но приёмка не закрыта'],
      ['Качество', 'Показатель вышел за договорный допуск'],
      ['Документы', 'Не хватает подписи или актуальной версии'],
      ['Деньги', 'Выплата остановлена без понятного основания'],
    ],
    solution: 'Прозрачная Цена',
    solutionText: 'Связывает событие, роль, документ и денежное последствие в одной Сделке.',
    audiences: [
      'Продавцу — понять, что мешает получить расчёт',
      'Покупателю — принять товар без скрытого риска',
      'Партнёру — исполнить свою часть без разрыва данных',
    ],
  },
  process: {
    eyebrow: 'Как платформа решает проблему',
    title: 'Одна Сделка связывает участников, события, документы и деньги',
    lead: 'Платформа ведёт процесс после согласования цены. Собственный AI TAI работает внутри контекста Сделки и помогает участнику быстрее принять проверяемое решение.',
    steps: [
      { index: '01', title: 'Собирает факты', text: 'Условия, партия, рейс, приёмка, качество, документы, подписи и деньги остаются в одном контексте.' },
      { index: '02', title: 'TAI понимает контекст', text: 'Сопоставляет этап, роль, правила, события и доступные доказательства конкретной Сделки.' },
      { index: '03', title: 'Показывает решение', text: 'Объясняет блокер, ответственного, влияние на срок и деньги, а также требуемое действие.' },
      { index: '04', title: 'Продолжает исполнение', text: 'Человек подтверждает критическое действие, а система фиксирует основание и переводит Сделку дальше.' },
    ],
    lifecycleLabel: '19 этапов без разрыва между системами',
    lifecycleText: 'От условий и допуска до логистики, лаборатории, расчёта, спора, доказательств и закрытия.',
  },
  ai: {
    eyebrow: 'TAI в работе',
    title: 'Не чат ради чата — AI, встроенный в конкретную Сделку',
    lead: 'На одном экране видно, что произошло, почему остановился расчёт, на каком основании сделан вывод и что требуется подтвердить дальше.',
    detectedLabel: 'Обнаружено',
    detected: 'Влажность выше договорного допуска на 0,8 п.п.; акт расхождений не подписан покупателем.',
    conclusionLabel: 'Вывод',
    conclusion: 'Окончательный расчёт нельзя продолжить по текущему основанию.',
    impactLabel: 'Влияние',
    impact: 'Резерв сохранён; денежный риск локализован до подтверждения нового правила расчёта.',
    nextLabel: 'Подготовлено',
    next: 'Подтвердить протокол, подписать акт и применить договорное правило перерасчёта.',
    sourceLabel: 'Основание',
    source: 'Протокол лаборатории L-204 · версия спецификации · акт приёмки',
    confidenceLabel: 'Надёжность вывода',
    confidence: 'Высокая',
    cta: 'Посмотреть TAI подробнее',
  },
  roles: {
    eyebrow: 'Выгода для каждого участника',
    title: 'Одна ситуация — разные решения для каждой роли',
    lead: 'Переключите роль и посмотрите, какой риск, действие, доказательство и денежное последствие видит конкретный участник.',
    proof: 'Публичный сценарий показывает логику интерфейса и не меняет роль, права или доступ к данным.',
    cta: 'Открыть полный сценарий Сделки',
  },
  maturity: {
    eyebrow: 'Промышленный уровень',
    title: 'Отраслевой процесс, промышленная архитектура, проверяемое доверие',
    lead: 'Платформа охватывает не один экран, а полный контур исполнения: роли, этапы, доказательства, права, интеграции и действия TAI работают на единой модели Сделки.',
    metrics: [['12', 'ролей в одном контуре'], ['19', 'этапов Сделки'], ['3', 'языка интерфейса']],
    pillars: [
      ['Отраслевой сценарий', 'От допуска и логистики до лаборатории, перерасчёта, спора, доказательств и закрытия.'],
      ['Российский контур', 'Private cloud и on-premise без обязательной зависимости от зарубежных AI API.'],
      ['Контроль доступа', 'Роль, организация, права и контекст определяются сервером.'],
      ['Доказательства и аудит', 'Версии документов, события, решения и основания сохраняются для проверки.'],
      ['Управляемые интеграции', 'ФГИС, ЭДО, банки, ERP, лаборатории и телематика подключаются через адаптеры.'],
      ['Человек контролирует критические действия', 'TAI анализирует и готовит действие, но не подписывает документы и не выпускает деньги сам.'],
    ],
    foot: 'Доверие создаётся не обещанием, а видимым основанием каждого перехода Сделки.',
    primary: 'Обсудить подключение',
    secondary: 'Открыть Сделку в работе',
  },
};

const en: PlatformV7HomeStoryCopy = {
  nav: { how: 'How it works', tai: 'TAI in the Deal', roles: 'Value by role', maturity: 'Industrial framework' },
  heroMap: {
    eyebrow: 'What usually breaks settlement',
    title: 'The price is agreed, but execution is split across disconnected systems',
    items: [
      ['Logistics', 'The trip is complete, but acceptance is still open'],
      ['Quality', 'A result is outside contractual tolerance'],
      ['Documents', 'A signature or current version is missing'],
      ['Money', 'Payout is paused without a clear basis'],
    ],
    solution: 'Transparent Price',
    solutionText: 'Connects the event, role, document and monetary consequence in one Deal.',
    audiences: ['Seller — see what prevents settlement', 'Buyer — accept product without hidden risk', 'Partner — perform its part without broken data'],
  },
  process: {
    eyebrow: 'How the platform solves it',
    title: 'One Deal connects participants, events, documents and money',
    lead: 'The platform manages execution after price agreement. Its own AI, TAI, works inside Deal context and helps each participant make a faster, verifiable decision.',
    steps: [
      { index: '01', title: 'Collects facts', text: 'Terms, lot, trip, acceptance, quality, documents, signatures and money remain in one context.' },
      { index: '02', title: 'TAI understands context', text: 'It connects the stage, role, rules, events and permitted evidence of the specific Deal.' },
      { index: '03', title: 'Shows the decision', text: 'It explains the blocker, owner, schedule and monetary impact, and the required action.' },
      { index: '04', title: 'Continues execution', text: 'A person confirms critical action, while the system records the basis and advances the Deal.' },
    ],
    lifecycleLabel: '19 stages without system gaps',
    lifecycleText: 'From terms and admission to logistics, laboratory, settlement, dispute, evidence and closure.',
  },
  ai: {
    eyebrow: 'TAI in action',
    title: 'Not chat for its own sake — AI embedded in a specific Deal',
    lead: 'One view shows what happened, why settlement paused, which evidence supports the conclusion and what must be confirmed next.',
    detectedLabel: 'Detected', detected: 'Moisture is 0.8 percentage points above contractual tolerance; the buyer has not signed the discrepancy act.',
    conclusionLabel: 'Conclusion', conclusion: 'Final settlement cannot proceed on the current basis.',
    impactLabel: 'Impact', impact: 'The reserve remains in place; monetary risk is contained until a revised settlement rule is confirmed.',
    nextLabel: 'Prepared', next: 'Confirm the protocol, sign the act and apply the contractual recalculation rule.',
    sourceLabel: 'Evidence', source: 'Laboratory protocol L-204 · specification version · acceptance act',
    confidenceLabel: 'Confidence', confidence: 'High', cta: 'Explore TAI',
  },
  roles: {
    eyebrow: 'Value for every participant',
    title: 'One situation — a different decision for every role',
    lead: 'Switch roles to see the risk, action, evidence and monetary consequence relevant to each participant.',
    proof: 'This public scenario demonstrates interface logic and does not change roles, permissions or data access.',
    cta: 'Open the complete Deal scenario',
  },
  maturity: {
    eyebrow: 'Industrial level',
    title: 'Industry process, industrial architecture and verifiable trust',
    lead: 'The platform covers an execution system rather than a single screen: roles, stages, evidence, permissions, integrations and TAI actions share one Deal model.',
    metrics: [['12', 'roles in one framework'], ['19', 'Deal stages'], ['3', 'interface languages']],
    pillars: [
      ['Industry workflow', 'From admission and logistics to laboratory, recalculation, dispute, evidence and closure.'],
      ['Russian deployment framework', 'Private cloud and on-premise without mandatory reliance on foreign AI APIs.'],
      ['Access control', 'Role, organisation, permissions and context are determined by the server.'],
      ['Evidence and audit', 'Document versions, events, decisions and supporting grounds remain available for verification.'],
      ['Governed integrations', 'State systems, EDI, banks, ERP, laboratories and telematics connect through adapters.'],
      ['Human control of critical actions', 'TAI analyses and prepares actions but does not sign documents or release funds by itself.'],
    ],
    foot: 'Trust comes from the visible basis of every Deal transition, not from a promise.',
    primary: 'Discuss connection', secondary: 'Open a Deal in action',
  },
};

const zh: PlatformV7HomeStoryCopy = {
  nav: { how: '运行方式', tai: '交易中的 TAI', roles: '各角色价值', maturity: '工业级闭环' },
  heroMap: {
    eyebrow: '通常导致结算中断的原因',
    title: '价格已经确定，但执行仍分散在不同系统中',
    items: [['物流', '运输已完成，但验收尚未关闭'], ['质量', '检测结果超出合同容差'], ['文件', '缺少签名或最新版本'], ['资金', '付款暂停且依据不清晰']],
    solution: '透明价格',
    solutionText: '在一笔交易中关联事件、角色、文件与资金后果。',
    audiences: ['卖方 — 看清什么阻碍结算', '买方 — 在无隐藏风险的情况下验收', '合作方 — 在数据不中断的情况下完成自身环节'],
  },
  process: {
    eyebrow: '平台如何解决问题',
    title: '一笔交易连接参与方、事件、文件与资金',
    lead: '平台在价格确定后继续管理执行。自有 AI TAI 在交易上下文中工作，帮助每个参与方更快作出可核验决策。',
    steps: [
      { index: '01', title: '汇集事实', text: '条件、批次、运输、验收、质量、文件、签名与资金保留在同一上下文。' },
      { index: '02', title: 'TAI 理解上下文', text: '关联具体交易的阶段、角色、规则、事件与允许访问的证据。' },
      { index: '03', title: '显示决策', text: '说明阻塞项、责任方、时间与资金影响以及所需行动。' },
      { index: '04', title: '继续执行', text: '人工确认关键行动，系统记录依据并推进交易。' },
    ],
    lifecycleLabel: '19 个阶段，无系统断点', lifecycleText: '从条件与准入，到物流、实验室、结算、争议、证据与关闭。',
  },
  ai: {
    eyebrow: 'TAI 实际运行', title: '不是为了聊天而聊天，而是嵌入具体交易的 AI',
    lead: '一个界面说明发生了什么、为何结算暂停、结论依据以及下一步需要确认什么。',
    detectedLabel: '已发现', detected: '水分比合同容差高 0.8 个百分点；买方尚未签署差异单。',
    conclusionLabel: '结论', conclusion: '无法依据当前条件继续最终结算。',
    impactLabel: '影响', impact: '资金预留保持；在新结算规则确认前，资金风险受到控制。',
    nextLabel: '已准备', next: '确认报告、签署差异单并应用合同重算规则。',
    sourceLabel: '依据', source: '实验室报告 L-204 · 规格版本 · 验收单', confidenceLabel: '结论可靠度', confidence: '高', cta: '进一步了解 TAI',
  },
  roles: {
    eyebrow: '每个参与方的价值', title: '同一场景，为每个角色提供不同决策',
    lead: '切换角色，查看该参与方对应的风险、行动、依据与资金后果。',
    proof: '公开场景仅展示界面逻辑，不会更改角色、权限或数据访问。', cta: '打开完整交易场景',
  },
  maturity: {
    eyebrow: '工业级能力', title: '行业流程、工业架构与可核验信任',
    lead: '平台覆盖完整执行闭环，而非单一页面：角色、阶段、证据、权限、集成和 TAI 行动基于同一交易模型。',
    metrics: [['12', '个角色'], ['19', '个交易阶段'], ['3', '种界面语言']],
    pillars: [
      ['行业流程', '从准入与物流，到实验室、重算、争议、证据与关闭。'],
      ['俄罗斯部署闭环', '支持私有云与本地部署，不强制依赖境外 AI API。'],
      ['访问控制', '角色、机构、权限与上下文由服务器确定。'],
      ['证据与审计', '文件版本、事件、决定与依据均可核验。'],
      ['受控集成', '政府系统、电子文件、银行、ERP、实验室与车联网通过适配器接入。'],
      ['关键行动由人工控制', 'TAI 负责分析与准备行动，但不会自行签署文件或释放资金。'],
    ],
    foot: '信任来自每次交易流转的可见依据，而不是口号。', primary: '讨论机构接入', secondary: '查看交易运行',
  },
};

export function getPlatformV7HomeStoryCopy(locale: string): PlatformV7HomeStoryCopy {
  return locale === 'en' ? en : locale === 'zh' ? zh : ru;
}
