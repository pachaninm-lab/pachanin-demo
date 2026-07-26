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
  nav: { how: 'Как работает', tai: 'TAI в Сделке', roles: 'Выгода по ролям', maturity: 'Архитектура и доверие' },
  heroMap: {
    eyebrow: 'Где после цены возникает риск',
    title: 'Цена уже согласована, но исполнение разорвано между системами',
    items: [
      ['Логистика', 'Рейс завершён — приёмка не закрыта'],
      ['Качество', 'Показатель вышел за договорный допуск'],
      ['Документы', 'Нет подписи или актуальной версии'],
      ['Деньги', 'Выплата остановлена без основания'],
    ],
    solution: 'Прозрачная Цена',
    solutionText: 'Связывает событие, роль, документ и деньги в одной Сделке.',
    audiences: [
      'Продавцу — получить расчёт вовремя',
      'Покупателю — принять товар без скрытого риска',
      'Партнёру — закрыть свой этап без ручной сверки',
    ],
  },
  process: {
    eyebrow: 'Как платформа решает проблему',
    title: 'Одна Сделка связывает участников, события, документы и деньги',
    lead: 'После согласования цены платформа ведёт исполнение, а TAI помогает быстрее принять проверяемое решение.',
    steps: [
      { index: '01', title: 'Собирает факты', text: 'Условия, партия, рейс, качество, документы и деньги остаются в одном контексте.' },
      { index: '02', title: 'TAI понимает контекст', text: 'Сопоставляет этап, роль, правила, события и доступные доказательства.' },
      { index: '03', title: 'Показывает решение', text: 'Объясняет блокер, ответственного, влияние на срок и деньги.' },
      { index: '04', title: 'Продолжает исполнение', text: 'Человек подтверждает критическое действие, система фиксирует основание и ведёт Сделку дальше.' },
    ],
    lifecycleLabel: '19 этапов без разрыва между системами',
    lifecycleText: 'От условий и допуска до логистики, лаборатории, расчёта, спора, доказательств и закрытия.',
  },
  ai: {
    eyebrow: 'TAI в работе',
    title: 'TAI работает внутри Сделки — не рядом с ней',
    lead: 'Связывает факты, правила и доказательства, показывает влияние на деньги и готовит следующий шаг.',
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
    title: 'Каждая роль видит своё решение',
    lead: 'Переключите роль и посмотрите её риск, действие, доказательство и денежное последствие.',
    proof: 'Публичный сценарий показывает логику интерфейса и не меняет роль, права или доступ к данным.',
    cta: 'Открыть полный сценарий Сделки',
  },
  maturity: {
    eyebrow: 'Архитектура промышленного класса',
    title: 'Единая модель Сделки — от роли до доказательства',
    lead: 'Контур спроектирован для масштабирования, контроля доступа и аудита. Зрелость эксплуатации и статусы интеграций подтверждаются только фактическими результатами.',
    metrics: [['12', 'ролей в одном контуре'], ['19', 'этапов Сделки'], ['3', 'языка интерфейса']],
    pillars: [
      ['Отраслевой сценарий', 'От допуска и логистики до лаборатории, перерасчёта, спора, доказательств и закрытия.'],
      ['Целевой российский контур', 'Private cloud и on-premise без обязательной зависимости от зарубежных AI API.'],
      ['Контроль доступа', 'Роль, организация, права и контекст определяются сервером.'],
      ['Доказательства и аудит', 'Версии документов, события, решения и основания сохраняются для проверки.'],
      ['Управляемые интеграции', 'ФГИС, ЭДО, банки, ERP, лаборатории и телематика подключаются через адаптеры.'],
      ['Человек контролирует критические действия', 'TAI анализирует и готовит действие, но не подписывает документы и не выпускает деньги сам.'],
    ],
    foot: 'Доверие создаётся видимым основанием каждого перехода и подтверждённым статусом каждой интеграции.',
    primary: 'Обсудить подключение',
    secondary: 'Открыть Сделку в работе',
  },
};

const en: PlatformV7HomeStoryCopy = {
  nav: { how: 'How it works', tai: 'TAI in the Deal', roles: 'Value by role', maturity: 'Architecture and trust' },
  heroMap: {
    eyebrow: 'Where risk appears after price agreement',
    title: 'The price is agreed, but execution is fragmented across systems',
    items: [
      ['Logistics', 'The trip is complete — acceptance is still open'],
      ['Quality', 'A result is outside contractual tolerance'],
      ['Documents', 'A signature or current version is missing'],
      ['Money', 'Payout is paused without a confirmed basis'],
    ],
    solution: 'Transparent Price',
    solutionText: 'Connects the event, role, document and money in one Deal.',
    audiences: ['Seller — receive settlement on time', 'Buyer — accept product without hidden risk', 'Partner — close its stage without manual reconciliation'],
  },
  process: {
    eyebrow: 'How the platform solves it',
    title: 'One Deal connects participants, events, documents and money',
    lead: 'After price agreement, the platform manages execution while TAI helps each participant make a faster, verifiable decision.',
    steps: [
      { index: '01', title: 'Collects facts', text: 'Terms, lot, trip, quality, documents and money remain in one context.' },
      { index: '02', title: 'TAI understands context', text: 'It connects the stage, role, rules, events and permitted evidence.' },
      { index: '03', title: 'Shows the decision', text: 'It explains the blocker, owner, schedule and monetary impact.' },
      { index: '04', title: 'Continues execution', text: 'A person confirms critical action; the system records the basis and advances the Deal.' },
    ],
    lifecycleLabel: '19 stages without system gaps',
    lifecycleText: 'From terms and admission to logistics, laboratory, settlement, dispute, evidence and closure.',
  },
  ai: {
    eyebrow: 'TAI in action',
    title: 'TAI works inside the Deal — not beside it',
    lead: 'It connects facts, rules and evidence, shows the monetary impact and prepares the next action.',
    detectedLabel: 'Detected', detected: 'Moisture is 0.8 percentage points above contractual tolerance; the buyer has not signed the discrepancy act.',
    conclusionLabel: 'Conclusion', conclusion: 'Final settlement cannot proceed on the current basis.',
    impactLabel: 'Impact', impact: 'The reserve remains in place; monetary risk is contained until a revised settlement rule is confirmed.',
    nextLabel: 'Prepared', next: 'Confirm the protocol, sign the act and apply the contractual recalculation rule.',
    sourceLabel: 'Evidence', source: 'Laboratory protocol L-204 · specification version · acceptance act',
    confidenceLabel: 'Confidence', confidence: 'High', cta: 'Explore TAI',
  },
  roles: {
    eyebrow: 'Value for every participant',
    title: 'Each role sees its own decision',
    lead: 'Switch roles to see the relevant risk, action, evidence and monetary consequence.',
    proof: 'This public scenario demonstrates interface logic and does not change roles, permissions or data access.',
    cta: 'Open the complete Deal scenario',
  },
  maturity: {
    eyebrow: 'Industrial-grade architecture',
    title: 'One Deal model — from role to evidence',
    lead: 'The framework is designed for scale, access control and audit. Operational maturity and integration status are stated only when supported by verified results.',
    metrics: [['12', 'roles in one framework'], ['19', 'Deal stages'], ['3', 'interface languages']],
    pillars: [
      ['Industry workflow', 'From admission and logistics to laboratory, recalculation, dispute, evidence and closure.'],
      ['Target Russian deployment framework', 'Private cloud and on-premise without mandatory reliance on foreign AI APIs.'],
      ['Access control', 'Role, organisation, permissions and context are determined by the server.'],
      ['Evidence and audit', 'Document versions, events, decisions and supporting grounds remain available for verification.'],
      ['Governed integrations', 'State systems, EDI, banks, ERP, laboratories and telematics connect through adapters.'],
      ['Human control of critical actions', 'TAI analyses and prepares actions but does not sign documents or release funds by itself.'],
    ],
    foot: 'Trust comes from a visible basis for each transition and a verified status for each integration.',
    primary: 'Discuss connection', secondary: 'Open a Deal in action',
  },
};

const zh: PlatformV7HomeStoryCopy = {
  nav: { how: '运行方式', tai: '交易中的 TAI', roles: '各角色价值', maturity: '架构与信任' },
  heroMap: {
    eyebrow: '价格确定后风险出现在哪里',
    title: '价格已经确定，但履约仍分散在不同系统中',
    items: [['物流', '运输已完成，但验收尚未关闭'], ['质量', '检测结果超出合同容差'], ['文件', '缺少签名或最新版本'], ['资金', '付款暂停且依据尚未确认']],
    solution: '透明价格',
    solutionText: '在一笔交易中关联事件、角色、文件与资金。',
    audiences: ['卖方 — 按时获得结算', '买方 — 在无隐藏风险的情况下验收', '合作方 — 无需人工对账即可完成自身环节'],
  },
  process: {
    eyebrow: '平台如何解决问题',
    title: '一笔交易连接参与方、事件、文件与资金',
    lead: '价格确定后，平台继续管理履约，TAI 帮助参与方更快作出可核验决策。',
    steps: [
      { index: '01', title: '汇集事实', text: '条件、批次、运输、质量、文件与资金保留在同一上下文。' },
      { index: '02', title: 'TAI 理解上下文', text: '关联阶段、角色、规则、事件与允许访问的证据。' },
      { index: '03', title: '显示决策', text: '说明阻塞项、责任方、时间与资金影响。' },
      { index: '04', title: '继续执行', text: '人工确认关键行动，系统记录依据并推进交易。' },
    ],
    lifecycleLabel: '19 个阶段，无系统断点', lifecycleText: '从条件与准入，到物流、实验室、结算、争议、证据与关闭。',
  },
  ai: {
    eyebrow: 'TAI 实际运行', title: 'TAI 在交易内部工作，而不是位于交易之外',
    lead: '关联事实、规则与证据，说明资金影响并准备下一步行动。',
    detectedLabel: '已发现', detected: '水分比合同容差高 0.8 个百分点；买方尚未签署差异单。',
    conclusionLabel: '结论', conclusion: '无法依据当前条件继续最终结算。',
    impactLabel: '影响', impact: '资金预留保持；在新结算规则确认前，资金风险受到控制。',
    nextLabel: '已准备', next: '确认报告、签署差异单并应用合同重算规则。',
    sourceLabel: '依据', source: '实验室报告 L-204 · 规格版本 · 验收单', confidenceLabel: '结论可靠度', confidence: '高', cta: '进一步了解 TAI',
  },
  roles: {
    eyebrow: '每个参与方的价值', title: '每个角色看到自己的决策',
    lead: '切换角色，查看对应的风险、行动、依据与资金后果。',
    proof: '公开场景仅展示界面逻辑，不会更改角色、权限或数据访问。', cta: '打开完整交易场景',
  },
  maturity: {
    eyebrow: '工业级架构', title: '统一交易模型：从角色到证据',
    lead: '该闭环面向规模化、访问控制与审计设计。运行成熟度与集成状态仅在获得可核验结果后说明。',
    metrics: [['12', '个角色'], ['19', '个交易阶段'], ['3', '种界面语言']],
    pillars: [
      ['行业流程', '从准入与物流，到实验室、重算、争议、证据与关闭。'],
      ['目标俄罗斯部署闭环', '支持私有云与本地部署，不强制依赖境外 AI API。'],
      ['访问控制', '角色、机构、权限与上下文由服务器确定。'],
      ['证据与审计', '文件版本、事件、决定与依据均可核验。'],
      ['受控集成', '政府系统、电子文件、银行、ERP、实验室与车联网通过适配器接入。'],
      ['关键行动由人工控制', 'TAI 负责分析与准备行动，但不会自行签署文件或释放资金。'],
    ],
    foot: '信任来自每次流转的可见依据以及每个集成的已核验状态。', primary: '讨论机构接入', secondary: '查看交易运行',
  },
};

export function getPlatformV7HomeStoryCopy(locale: string): PlatformV7HomeStoryCopy {
  return locale === 'en' ? en : locale === 'zh' ? zh : ru;
}
