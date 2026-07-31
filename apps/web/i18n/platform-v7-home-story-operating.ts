import { getPlatformV7HomeStoryCopy as getBaseStoryCopy } from './platform-v7-home-story';

const operatingCopy = {
  ru: {
    nav: {
      difference: 'Преимущества',
      functions: '7 шагов Сделки',
      deal: 'Сделка в работе',
      roles: 'Для участников',
      tai: 'ИИ в агробизнесе',
    },
    heroDeal: {
      sampleLabel: 'Сделка в работе',
      proof: 'Лот, торги, поставка, качество, решения и расчёт связаны в одной истории Сделки.',
    },
    proof: [
      { label: '12 ролей', text: 'Все участники работают в одной Сделке и видят свою ответственность' },
      { label: '19 этапов', text: 'От условий и торгов до расчёта, спора, доказательств и аналитики' },
      { label: 'RU · EN · ZH', text: 'Единый интерфейс и сценарии на русском, английском и китайском' },
      { label: 'TAI внутри Сделки', text: 'ИИ сопоставляет факты, источники, риск и следующий шаг' },
    ],
    difference: {
      eyebrow: 'Единая система исполнения',
      title: 'От лота и торгов до расчёта и закрытия — одна управляемая Сделка',
      lead: 'Платформа объединяет участников, товар, логистику, качество, документы, деньги и спор. Каждый блок показывает текущее состояние, ответственного, основание и действие.',
      boundary: 'ERP/1С, логистика, лаборатория, документы, государственные и финансовые контуры работают вокруг одной версии Сделки.',
    },
    functions: {
      title: 'Сделка проходит семь связанных шагов в одной рабочей системе',
      lead: 'Каждый шаг меняет общую историю Сделки, доступные действия, документы, риск и расчёт.',
      items: [
        {
          index: '01',
          title: 'Лот и условия',
          text: 'Товар, объём, качество, базис, допуски, документы и правила расчёта.',
          result: 'Стороны работают по одной зафиксированной версии условий.',
        },
        {
          index: '02',
          title: 'Торги и выбор предложения',
          text: 'Допуск участников, предложения, ставки, сравнение условий и выбор победителя.',
          result: 'Выбранное предложение превращается в управляемую Сделку.',
        },
        {
          index: '03',
          title: 'Поставка',
          text: 'Транспорт, водитель, маршрут, рейс, контрольные точки, вес и приёмка.',
          result: 'Движение партии и исполнение подтверждены событиями и документами.',
        },
        {
          index: '04',
          title: 'Лабораторное отклонение',
          text: 'Проба, методика, протокол, версия спецификации и величина отклонения.',
          result: 'Расхождение связано с товаром, ответственным и денежным последствием.',
        },
        {
          index: '05',
          title: 'Анализ TAI',
          text: 'ИИ сопоставляет условия, события, документы, полномочия и источники.',
          result: 'Участник получает объяснение риска и допустимые следующие действия.',
        },
        {
          index: '06',
          title: 'Решение участника',
          text: 'Пересчёт, повторная проверка, принятие результата или открытие разногласия.',
          result: 'Решение фиксируется вместе с основанием, ролью, сроком и версией данных.',
        },
        {
          index: '07',
          title: 'Расчёт или спор',
          text: 'Частичный или окончательный расчёт, удержание, возврат, спор и закрытие.',
          result: 'Деньги и спор опираются на подтверждённое исполнение и доказательства.',
        },
        {
          index: '08',
          title: 'Доказательства и аналитика',
          text: 'Неизменяемая история, документы, решения, KPI, API и отчётность.',
          result: 'Организация контролирует результат каждой Сделки и всего портфеля.',
        },
      ],
      summaryTitle: 'Семь шагов работают как одна Сделка',
      summaryText: 'Отклонение в поставке сразу отражается в качестве, документах, решении, расчёте, споре и аналитике.',
      moreLabel: 'Показать шаги 5–8',
    },
    process: {
      title: 'Полный путь сохраняет одну версию фактов для всех участников',
      lead: 'Пользователь всегда видит текущую фазу, подтверждённое основание, ответственного, влияние на расчёт и следующий шаг.',
    },
    demo: {
      eyebrow: 'Сделка в работе',
      title: 'Переключите состояние и посмотрите, как меняются действия и расчёт',
      lead: 'Норма, отклонение и спор используют одну историю товара, документов, решений и полномочий.',
      statesLabel: 'Состояние Сделки',
      openDeal: 'Перейти к полному сценарию Сделки',
    },
    demoStates: [
      {
        actionTitle: 'Сделка готова к расчёту',
        actionText: 'Уполномоченный участник проверяет основание и подтверждает действие. Платформа сохраняет решение в истории Сделки.',
      },
      {
        actionTitle: 'Покупатель видит варианты решения',
        actionText: 'Платформа связывает отклонение с договором, протоколом и допустимыми действиями: пересчёт, повторная проверка или разногласие.',
      },
      {
        actionTitle: 'Спор управляется в едином контуре',
        actionText: 'Позиции сторон, версии документов, сроки, спорная сумма и доказательства сохраняются до решения.',
      },
    ],
    roles: {
      title: 'Каждый участник работает в одной Сделке и видит свой результат',
      lead: 'Продавец, покупатель, логистика, водитель, элеватор, лаборатория, сюрвейер, банк, оператор, комплаенс, арбитр и руководитель используют одну версию фактов.',
      scenarioTitle: 'Сделка глазами каждой роли',
      scenarioLead: 'Переключение роли показывает её данные, ответственность, действие, основание и денежное последствие.',
    },
    tai: {
      eyebrow: 'ИИ в агробизнесе',
      title: 'TAI анализирует Сделку и переводит данные в конкретное действие',
      lead: 'Он сопоставляет условия, события, документы и полномочия, объясняет отклонение и показывает следующий шаг с источниками.',
      state: 'Высокая уверенность · данные Сделки сопоставлены',
      limit: 'TAI показывает факты, риски и варианты действий. Критические решения подтверждает уполномоченный участник.',
      cta: 'Посмотреть ИИ в работе',
    },
    faq: {
      items: [
        {
          question: 'Что получает организация кроме торгов?',
          answer: 'Полный контур исполнения: условия, поставку, приёмку, качество, документы, расчёт, спор, доказательства и аналитику в одной Сделке.',
        },
        {
          question: 'Как система работает при отклонении?',
          answer: 'Платформа связывает отклонение с условием, источником, ответственным, сроком, денежным последствием и допустимым решением.',
        },
        {
          question: 'Как контролируются права и решения?',
          answer: 'Каждое действие выполняется в пределах роли, а основание, версия данных, участник и результат сохраняются в истории Сделки.',
        },
        {
          question: 'Как начать работу?',
          answer: 'Укажите организацию, выберите роль и рабочую задачу. Система зарегистрирует обращение и выдаст номер следующего шага.',
        },
      ],
    },
  },
  en: {
    nav: {
      difference: 'Advantages',
      functions: '7 Deal steps',
      deal: 'Deal in action',
      roles: 'For participants',
      tai: 'AI for agribusiness',
    },
    heroDeal: {
      sampleLabel: 'Deal in action',
      proof: 'Lot, bidding, delivery, quality, decisions and settlement remain connected in one Deal history.',
    },
    proof: [
      { label: '12 roles', text: 'Every participant works in one Deal and sees their responsibility' },
      { label: '19 stages', text: 'From terms and bidding to settlement, dispute, evidence and analytics' },
      { label: 'RU · EN · ZH', text: 'One interface and operating scenarios in Russian, English and Chinese' },
      { label: 'TAI inside the Deal', text: 'AI matches facts, sources, risk and the next step' },
    ],
    difference: {
      eyebrow: 'Unified execution system',
      title: 'From lot and bidding to settlement and closure — one controlled Deal',
      lead: 'The platform unites participants, product, logistics, quality, documents, money and disputes. Every block shows state, owner, evidence and action.',
      boundary: 'ERP, logistics, laboratory, document, government and financial workflows operate around one Deal version.',
    },
    functions: {
      title: 'The Deal moves through seven connected steps in one operating system',
      lead: 'Every step updates the shared Deal history, permitted actions, documents, risk and settlement.',
      items: [
        { index: '01', title: 'Lot and terms', text: 'Product, volume, quality, basis, tolerances, documents and settlement rules.', result: 'All parties use one fixed version of the terms.' },
        { index: '02', title: 'Bidding and award', text: 'Participant admission, offers, bids, term comparison and winner selection.', result: 'The selected offer becomes a controlled Deal.' },
        { index: '03', title: 'Delivery', text: 'Vehicle, driver, route, trip, checkpoints, weight and acceptance.', result: 'Lot movement and execution are confirmed by events and documents.' },
        { index: '04', title: 'Laboratory deviation', text: 'Sample, method, protocol, specification version and deviation value.', result: 'The discrepancy is tied to product, owner and monetary impact.' },
        { index: '05', title: 'TAI analysis', text: 'AI compares terms, events, documents, authority and sources.', result: 'The participant receives a risk explanation and permitted next actions.' },
        { index: '06', title: 'Participant decision', text: 'Recalculation, recheck, acceptance or opening a discrepancy.', result: 'The decision is retained with evidence, role, deadline and data version.' },
        { index: '07', title: 'Settlement or dispute', text: 'Partial or final settlement, hold, refund, dispute and closure.', result: 'Money and disputes rely on confirmed execution and evidence.' },
        { index: '08', title: 'Evidence and analytics', text: 'Immutable history, documents, decisions, KPI, API and reporting.', result: 'The organisation controls every Deal and the complete portfolio.' },
      ],
      summaryTitle: 'Seven steps operate as one Deal',
      summaryText: 'A delivery deviation immediately affects quality, documents, the decision, settlement, dispute and analytics.',
      moreLabel: 'Show steps 5–8',
    },
    process: {
      title: 'The complete path keeps one version of facts for every participant',
      lead: 'The user always sees the current phase, confirmed evidence, owner, settlement impact and next step.',
    },
    demo: {
      eyebrow: 'Deal in action',
      title: 'Switch the state and see how actions and settlement change',
      lead: 'Normal execution, deviation and dispute use one history of product, documents, decisions and authority.',
      statesLabel: 'Deal state',
      openDeal: 'Open the complete Deal scenario',
    },
    demoStates: [
      { actionTitle: 'The Deal is ready for settlement', actionText: 'An authorised participant verifies the evidence and confirms the action. The platform retains the decision in the Deal history.' },
      { actionTitle: 'The buyer sees the available decisions', actionText: 'The platform links the deviation to the contract, protocol and permitted actions: recalculation, recheck or discrepancy.' },
      { actionTitle: 'The dispute stays in one controlled workflow', actionText: 'Party positions, document versions, deadlines, disputed amount and evidence remain connected until resolution.' },
    ],
    roles: {
      title: 'Every participant works in one Deal and sees their outcome',
      lead: 'Seller, buyer, logistics, driver, storage, laboratory, surveyor, bank, operator, compliance, arbitrator and executive use one version of facts.',
      scenarioTitle: 'The Deal from every role',
      scenarioLead: 'Changing the role shows its data, responsibility, action, evidence and monetary consequence.',
    },
    tai: {
      eyebrow: 'AI for agribusiness',
      title: 'TAI analyses the Deal and turns data into a concrete action',
      lead: 'It compares terms, events, documents and authority, explains the deviation and shows the next step with sources.',
      state: 'High confidence · Deal data matched',
      limit: 'TAI shows facts, risks and action options. Critical decisions are confirmed by an authorised participant.',
      cta: 'See AI in action',
    },
    faq: {
      items: [
        { question: 'What does the organisation get beyond trading?', answer: 'The complete execution workflow: terms, delivery, acceptance, quality, documents, settlement, dispute, evidence and analytics in one Deal.' },
        { question: 'How does the system handle a deviation?', answer: 'The platform links the deviation to the term, source, owner, deadline, monetary impact and permitted decision.' },
        { question: 'How are authority and decisions controlled?', answer: 'Every action stays within the role, while evidence, data version, participant and outcome remain in the Deal history.' },
        { question: 'How do we start?', answer: 'Provide the organisation, select the role and operating task. The system registers the request and returns a number for the next step.' },
      ],
    },
  },
  zh: {
    nav: {
      difference: '平台优势',
      functions: '交易七步',
      deal: '交易运行',
      roles: '参与方价值',
      tai: '农业商业 AI',
    },
    heroDeal: {
      sampleLabel: '交易运行',
      proof: '批次、竞价、交付、质量、决定与结算保存在同一笔交易历史中。',
    },
    proof: [
      { label: '12 个角色', text: '所有参与方在同一笔交易中工作，并看到自己的责任' },
      { label: '19 个阶段', text: '从条件和竞价到结算、争议、证据与分析' },
      { label: 'RU · EN · ZH', text: '俄语、英语和中文使用同一界面与业务场景' },
      { label: '交易内的 TAI', text: 'AI 对照事实、来源、风险与下一步' },
    ],
    difference: {
      eyebrow: '统一执行系统',
      title: '从批次和竞价到结算与关闭，始终由同一笔交易管理',
      lead: '平台连接参与方、商品、物流、质量、文件、资金与争议。每个模块都显示状态、责任方、依据和操作。',
      boundary: 'ERP、物流、实验室、文件、政府与金融流程都围绕同一版本的交易运行。',
    },
    functions: {
      title: '交易在同一工作系统中通过七个相互关联的步骤',
      lead: '每一步都会更新共同交易历史、允许的操作、文件、风险和结算。',
      items: [
        { index: '01', title: '批次与条件', text: '商品、数量、质量、交付条件、容差、文件和结算规则。', result: '各方使用同一固定版本的条件。' },
        { index: '02', title: '竞价与选择', text: '参与资格、报价、出价、条件比较和中选。', result: '中选报价转化为受控交易。' },
        { index: '03', title: '交付', text: '车辆、司机、路线、运输、控制点、称重与验收。', result: '批次流转和履约由事件与文件确认。' },
        { index: '04', title: '实验室偏差', text: '样品、方法、报告、规格版本和偏差数值。', result: '差异与商品、责任方及资金影响关联。' },
        { index: '05', title: 'TAI 分析', text: 'AI 对照条件、事件、文件、权限和来源。', result: '参与方获得风险解释和允许的下一步。' },
        { index: '06', title: '参与方决定', text: '重算、复检、接受结果或提出异议。', result: '决定与依据、角色、期限和数据版本一起保存。' },
        { index: '07', title: '结算或争议', text: '部分或最终结算、冻结、退款、争议与关闭。', result: '资金与争议以已确认履约和证据为依据。' },
        { index: '08', title: '证据与分析', text: '不可变历史、文件、决定、KPI、API 和报告。', result: '机构可以控制每笔交易和完整交易组合。' },
      ],
      summaryTitle: '七个步骤共同构成同一笔交易',
      summaryText: '交付偏差会立即影响质量、文件、决定、结算、争议和分析。',
      moreLabel: '显示第 5–8 步',
    },
    process: {
      title: '完整流程为所有参与方保留同一套事实',
      lead: '用户始终可以看到当前阶段、已确认依据、责任方、结算影响与下一步。',
    },
    demo: {
      eyebrow: '交易运行',
      title: '切换状态，查看操作与结算如何变化',
      lead: '正常执行、偏差与争议使用同一套商品、文件、决定与权限历史。',
      statesLabel: '交易状态',
      openDeal: '打开完整交易场景',
    },
    demoStates: [
      { actionTitle: '交易已具备结算条件', actionText: '获授权的参与方核验依据并确认操作，平台将决定保存在交易历史中。' },
      { actionTitle: '买方可以看到可选决定', actionText: '平台把偏差与合同、报告和允许的操作关联起来：重算、复检或提出异议。' },
      { actionTitle: '争议始终在同一受控流程中处理', actionText: '各方立场、文件版本、期限、争议金额与证据在解决前保持关联。' },
    ],
    roles: {
      title: '所有参与方在同一笔交易中工作，并看到自己的结果',
      lead: '卖方、买方、物流、司机、仓储、实验室、检验机构、银行、运营方、合规、仲裁方和管理者使用同一套事实。',
      scenarioTitle: '从每个角色查看交易',
      scenarioLead: '切换角色即可看到其数据、责任、操作、依据与资金后果。',
    },
    tai: {
      eyebrow: '农业商业 AI',
      title: 'TAI 分析交易，并把数据转化为具体行动',
      lead: '它对照条件、事件、文件与权限，解释偏差，并附带来源给出下一步。',
      state: '高置信度 · 交易数据已完成比对',
      limit: 'TAI 展示事实、风险和操作选项，关键决定由获授权的参与方确认。',
      cta: '查看 AI 如何工作',
    },
    faq: {
      items: [
        { question: '除竞价外，机构还能获得什么？', answer: '条件、交付、验收、质量、文件、结算、争议、证据与分析都集中在同一笔交易中。' },
        { question: '系统如何处理偏差？', answer: '平台把偏差与条件、来源、责任方、期限、资金影响和允许的决定关联起来。' },
        { question: '权限和决定如何受控？', answer: '每项操作都在角色范围内执行，依据、数据版本、参与方和结果保存在交易历史中。' },
        { question: '如何开始使用？', answer: '填写机构信息，选择角色和工作任务。系统会登记申请，并生成下一步所需的编号。' },
      ],
    },
  },
} as const;

export function getPlatformV7HomeStoryCopy(locale: string) {
  const base = getBaseStoryCopy(locale);
  const localized = locale === 'en' ? operatingCopy.en : locale === 'zh' ? operatingCopy.zh : operatingCopy.ru;

  return {
    ...base,
    nav: { ...base.nav, ...localized.nav },
    heroDeal: { ...base.heroDeal, ...localized.heroDeal },
    proof: localized.proof,
    difference: { ...base.difference, ...localized.difference },
    functions: { ...base.functions, ...localized.functions, items: localized.functions.items },
    process: { ...base.process, ...localized.process },
    demo: {
      ...base.demo,
      ...localized.demo,
      states: base.demo.states.map((state, index) => ({
        ...state,
        ...(localized.demoStates[index] ?? {}),
      })),
    },
    roles: { ...base.roles, ...localized.roles },
    tai: { ...base.tai, ...localized.tai },
    faq: { ...base.faq, ...localized.faq },
  };
}
