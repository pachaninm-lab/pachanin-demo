import { getPlatformV7HomeStoryCopy as getBaseStoryCopy } from './platform-v7-home-story';

const operatingCopy = {
  ru: {
    nav: {
      difference: 'Преимущества',
      functions: '7 шагов Сделки',
      deal: 'Сделка в работе',
      roles: 'Для участников',
      tai: 'Как помогает Гекта',
    },
    heroDeal: {
      sampleLabel: 'Одна Сделка от условий до расчёта',
      proof: 'Товар, условия, участники, логистика, качество, документы и расчёт связаны в одной истории Сделки.',
    },
    proof: [
      { label: '9 ролей', text: 'Каждый участник видит свою часть одной Сделки, свою ответственность и следующий шаг' },
      { label: '7 шагов', text: 'От товара и контрагента до документов, расчёта, закрытия и исключений' },
      { label: 'RU · EN · ZH', text: 'Одна продуктовая логика на русском, английском и китайском' },
      { label: 'Гекта внутри Сделки', text: 'Аграрный интеллект объясняет факты, основания, риск и варианты следующего действия' },
    ],
    difference: {
      eyebrow: 'Единая система исполнения',
      title: 'От товара и предложения до расчёта и закрытия — одна управляемая Сделка',
      lead: 'Платформа объединяет участников, товар, логистику, качество, документы, деньги и исключения. Пользователь видит, что происходит, кто отвечает, на чём основано действие и что делать дальше.',
      boundary: 'Учёт, ЭДО, логистика, лабораторные, государственные и финансовые контуры работают вокруг одной версии Сделки и подключаются через отдельные контуры взаимодействия.',
    },
    functions: {
      title: 'Сделка проходит семь связанных шагов в одной рабочей системе',
      lead: 'Каждый шаг продолжает одну и ту же историю: меняются задачи, документы, участники и основания, но Сделка не распадается на отдельные сервисы.',
      items: [
        {
          index: '01',
          title: 'Товар, потребность и условия',
          text: 'Товар или потребность, объём, качество, базис, допуски, документы и правила расчёта.',
          result: 'Участники начинают с одной понятной версии предмета и условий.',
        },
        {
          index: '02',
          title: 'Рынок, контрагент и предложение',
          text: 'Поиск, сравнение, допуск участников, предложения, ставки и выбор подходящего контрагента.',
          result: 'Коммерческая договорённость становится частью общей истории Сделки.',
        },
        {
          index: '03',
          title: 'Переговоры, Сделка и договор',
          text: 'Версии условий, согласование, договор, полномочия, подпись и связанные документы.',
          result: 'Стороны работают по одной согласованной версии условий и обязательств.',
        },
        {
          index: '04',
          title: 'Сервисы и логистика',
          text: 'Перевозка, водитель, маршрут, рейсы, элеватор, лаборатория, сюрвейер и другие услуги вокруг Сделки.',
          result: 'Каждая услуга связана с конкретной партией, задачей и ответственным участником.',
        },
        {
          index: '05',
          title: 'Приёмка, качество и проверки',
          text: 'Вес, приёмка, проба, методика, протокол, отклонения и подтверждающие материалы.',
          result: 'Фактическое исполнение можно сопоставить с согласованными условиями.',
        },
        {
          index: '06',
          title: 'Документы, расчёт и учёт',
          text: 'Основания расчёта, документы, ЭДО, финансовый контур, бухгалтерские данные и передача в учёт.',
          result: 'Расчёт и учёт опираются на ту же историю исполнения, а не на отдельную переписку.',
        },
        {
          index: '07',
          title: 'Закрытие и исключения',
          text: 'Закрытие Сделки, перерасчёт, удержание, возврат, спор, доказательства и итоговая история.',
          result: 'Нормальный путь и исключения остаются внутри одного управляемого процесса.',
        },
      ],
      summaryTitle: 'Семь шагов работают как одна Сделка',
      summaryText: 'Гекта, документы, логистика, качество и расчёт не становятся отдельными историями — они сопровождают одну Сделку от начала до закрытия.',
      moreLabel: 'Показать все шаги',
    },
    process: {
      title: 'Прокрутите одну Сделку от начала до закрытия',
      lead: 'На каждом шаге меняется рабочий контекст: что происходит, что видит участник, какие данные и документы нужны и какое действие идёт следующим.',
    },
    demo: {
      eyebrow: 'Одна Сделка в разных ситуациях',
      title: 'Сравните обычный путь, отклонение и спор внутри одной истории',
      lead: 'Это не отдельные режимы платформы, а три ситуации одной Сделки с общими условиями, документами, участниками и основаниями.',
      statesLabel: 'Ситуация Сделки',
      openDeal: 'Открыть полный сценарий Сделки',
    },
    demoStates: [
      {
        actionTitle: 'Основание расчёта собрано',
        actionText: 'Уполномоченный участник видит связанные факты и документы и подтверждает разрешённое действие. Решение остаётся в истории Сделки.',
      },
      {
        actionTitle: 'Покупатель видит варианты решения',
        actionText: 'Платформа связывает отклонение с договором, протоколом и допустимыми действиями: пересчёт, повторная проверка или разногласие.',
      },
      {
        actionTitle: 'Разногласие остаётся в общей истории',
        actionText: 'Позиции сторон, версии документов, сроки, спорная сумма и доказательства сохраняются до решения.',
      },
    ],
    roles: {
      title: 'Одна Сделка выглядит по-разному для каждой роли',
      lead: 'Продавец, покупатель, логистика, водитель, элеватор или хранение, лаборатория, сюрвейер, банк или финансы и сотрудник платформы используют одну версию фактов.',
      scenarioTitle: 'Сделка глазами вашей роли',
      scenarioLead: 'Переключение роли меняет рабочий акцент: данные, ответственность, действие, основание и денежное последствие — сама Сделка остаётся той же.',
    },
    tai: {
      eyebrow: 'Гекта · аграрный интеллект',
      title: 'Гекта работает внутри контекста Сделки',
      lead: 'Она сопоставляет условия, события, документы и полномочия, объясняет расхождения и помогает понять следующий допустимый шаг с опорой на источники.',
      state: 'Факты · основания · следующий шаг',
      limit: 'Гекта объясняет, сравнивает и готовит варианты действий. Критические решения подтверждает уполномоченный участник.',
      cta: 'Посмотреть Гекту в работе',
    },
    gektaProduct: {
      eyebrow: 'Отдельный продукт экосистемы',
      title: 'Гекта — самостоятельный аграрный ИИ',
      lead: 'AI-продукт «Прозрачной Цены» для сельского хозяйства и агробизнеса: растениеводство, животноводство, техника, хранение, логистика, документы и экономика хозяйства в одном диалоге.',
      cta: 'Открыть Гекту',
      navLabel: 'Гекта',
    },
    faq: {
      items: [
        {
          question: 'Что получает организация кроме торгов?',
          answer: 'Единую рабочую историю: условия, контрагента, договор, услуги, поставку, приёмку, качество, документы, расчёт, учёт и исключения в одной Сделке.',
        },
        {
          question: 'Что происходит при отклонении?',
          answer: 'Платформа связывает расхождение с условием, источником, ответственным, сроком, денежным последствием и допустимыми вариантами решения.',
        },
        {
          question: 'Как контролируются права и решения?',
          answer: 'Каждое действие выполняется в пределах роли, а основание, версия данных, участник и результат сохраняются в истории Сделки.',
        },
        {
          question: 'Как начать работу?',
          answer: 'Пройдите регистрацию, подтвердите организацию и войдите в рабочий кабинет своей роли. Публичная помощь с подключением остаётся отдельным каналом.',
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
      tai: 'How Gekta helps',
    },
    heroDeal: {
      sampleLabel: 'One Deal from terms to settlement',
      proof: 'Product, terms, participants, logistics, quality, documents and settlement stay connected in one Deal history.',
    },
    proof: [
      { label: '9 roles', text: 'Each participant sees their part of the same Deal, their responsibility and the next action' },
      { label: '7 steps', text: 'From product and counterparty to documents, settlement, closure and exceptions' },
      { label: 'RU · EN · ZH', text: 'One product logic in Russian, English and Chinese' },
      { label: 'Gekta inside the Deal', text: 'Agricultural intelligence explains facts, evidence, risk and possible next actions' },
    ],
    difference: {
      eyebrow: 'Unified execution system',
      title: 'From product and offer to settlement and closure — one controlled Deal',
      lead: 'The platform unites participants, product, logistics, quality, documents, money and exceptions. The user sees what is happening, who is responsible, what an action is based on and what comes next.',
      boundary: 'Accounting, EDI, logistics, laboratory, government and financial workflows operate around one Deal version and connect through separate interaction circuits.',
    },
    functions: {
      title: 'The Deal moves through seven connected steps in one operating system',
      lead: 'Each step continues the same history: tasks, documents, participants and evidence change, but the Deal never breaks into unrelated services.',
      items: [
        { index: '01', title: 'Product, demand and terms', text: 'Product or demand, volume, quality, basis, tolerances, documents and settlement rules.', result: 'Participants start from one clear version of the subject and terms.' },
        { index: '02', title: 'Market, counterparty and offer', text: 'Discovery, comparison, participant admission, offers, bids and counterparty selection.', result: 'The commercial agreement becomes part of the shared Deal history.' },
        { index: '03', title: 'Negotiation, Deal and contract', text: 'Term versions, agreement, contract, authority, signature and related documents.', result: 'The parties work from one agreed version of terms and obligations.' },
        { index: '04', title: 'Services and logistics', text: 'Freight, driver, route, trips, storage, laboratory, surveyor and other services around the Deal.', result: 'Every service stays linked to the exact lot, task and responsible participant.' },
        { index: '05', title: 'Acceptance, quality and verification', text: 'Weight, acceptance, sample, method, protocol, deviations and supporting evidence.', result: 'Actual execution can be compared with the agreed terms.' },
        { index: '06', title: 'Documents, settlement and accounting', text: 'Settlement basis, documents, EDI, financial workflow, accounting data and accounting handoff.', result: 'Settlement and accounting rely on the same execution history rather than separate correspondence.' },
        { index: '07', title: 'Closure and exceptions', text: 'Deal closure, recalculation, hold, refund, dispute, evidence and final history.', result: 'The ordinary path and exceptions remain inside one controlled process.' },
      ],
      summaryTitle: 'Seven steps operate as one Deal',
      summaryText: 'Gekta, documents, logistics, quality and settlement do not become separate stories — they accompany the same Deal from start to closure.',
      moreLabel: 'Show all steps',
    },
    process: {
      title: 'Scroll one Deal from start to closure',
      lead: 'At every step the working context changes: what is happening, what the participant sees, which data and documents matter and which action comes next.',
    },
    demo: {
      eyebrow: 'One Deal in different situations',
      title: 'Compare the ordinary path, a deviation and a dispute inside one history',
      lead: 'These are not separate platform modes; they are three situations of the same Deal with shared terms, documents, participants and evidence.',
      statesLabel: 'Deal situation',
      openDeal: 'Open the complete Deal scenario',
    },
    demoStates: [
      { actionTitle: 'Settlement basis is assembled', actionText: 'An authorised participant sees the linked facts and documents and confirms the permitted action. The decision remains in the Deal history.' },
      { actionTitle: 'The buyer sees the available decisions', actionText: 'The platform links the deviation to the contract, protocol and permitted actions: recalculation, recheck or discrepancy.' },
      { actionTitle: 'The disagreement remains in the shared history', actionText: 'Party positions, document versions, deadlines, disputed amount and evidence remain connected until resolution.' },
    ],
    roles: {
      title: 'The same Deal looks different for each role',
      lead: 'Seller, buyer, logistics, driver, elevator or storage, laboratory, surveyor, bank or finance and platform employee use one version of facts.',
      scenarioTitle: 'The Deal from your role',
      scenarioLead: 'Changing the role changes the working emphasis — data, responsibility, action, evidence and monetary consequence — while the Deal itself stays the same.',
    },
    tai: {
      eyebrow: 'Gekta · agricultural intelligence',
      title: 'Gekta works inside the Deal context',
      lead: 'It compares terms, events, documents and authority, explains discrepancies and helps identify the next permitted step with supporting sources.',
      state: 'Facts · evidence · next action',
      limit: 'Gekta explains, compares and prepares action options. Critical decisions are confirmed by an authorised participant.',
      cta: 'See Gekta in action',
    },
    gektaProduct: {
      eyebrow: 'A separate ecosystem product',
      title: 'Gekta — a standalone agricultural AI',
      lead: 'The Transparent Price AI product for farming and agribusiness: crops, livestock, machinery, storage, logistics, documents and farm economics in one conversation.',
      cta: 'Open Gekta',
      navLabel: 'Gekta',
    },
    faq: {
      items: [
        { question: 'What does the organisation get beyond trading?', answer: 'One working history for terms, counterparty, contract, services, delivery, acceptance, quality, documents, settlement, accounting and exceptions.' },
        { question: 'What happens when something deviates?', answer: 'The platform links the discrepancy to the term, source, responsible party, deadline, monetary consequence and permitted decision options.' },
        { question: 'How are authority and decisions controlled?', answer: 'Every action stays within the role, while evidence, data version, participant and outcome remain in the Deal history.' },
        { question: 'How do we start?', answer: 'Register, verify the organisation and enter the workspace for your role. Public connection assistance remains a separate help channel.' },
      ],
    },
  },
  zh: {
    nav: {
      difference: '平台优势',
      functions: '交易七步',
      deal: '交易运行',
      roles: '参与方价值',
      tai: 'Gekta 如何帮助',
    },
    heroDeal: {
      sampleLabel: '一笔交易从条件到结算',
      proof: '商品、条件、参与方、物流、质量、文件和结算始终保存在同一笔交易历史中。',
    },
    proof: [
      { label: '9 个角色', text: '每个参与方都看到同一笔交易中与自己相关的部分、责任和下一步' },
      { label: '7 个步骤', text: '从商品与交易方一直到文件、结算、关闭和异常处理' },
      { label: 'RU · EN · ZH', text: '俄语、英语和中文使用同一套产品逻辑' },
      { label: '交易内的 Gekta', text: '农业智能解释事实、依据、风险和可选的下一步操作' },
    ],
    difference: {
      eyebrow: '统一执行系统',
      title: '从商品和报价到结算与关闭，始终由同一笔交易管理',
      lead: '平台连接参与方、商品、物流、质量、文件、资金与异常。用户可以看到正在发生什么、谁负责、操作依据是什么以及下一步要做什么。',
      boundary: '会计、电子单据、物流、实验室、政府和金融流程都围绕同一版本的交易运行，并通过独立交互通道接入。',
    },
    functions: {
      title: '交易在同一工作系统中通过七个相互关联的步骤',
      lead: '每一步都延续同一段历史：任务、文件、参与方和依据会变化，但交易不会被拆成互不相干的服务。',
      items: [
        { index: '01', title: '商品、需求与条件', text: '商品或需求、数量、质量、交付条件、容差、文件和结算规则。', result: '参与方从同一套清晰的商品和条件开始。' },
        { index: '02', title: '市场、交易方与报价', text: '发现、比较、参与资格、报价、竞价和交易方选择。', result: '商业约定成为共同交易历史的一部分。' },
        { index: '03', title: '协商、交易与合同', text: '条件版本、协商、合同、权限、签署和关联文件。', result: '各方按照同一版已协商条件和义务工作。' },
        { index: '04', title: '服务与物流', text: '运输、司机、路线、车次、仓储、实验室、检验机构和其他交易服务。', result: '每项服务都与具体批次、任务和责任方关联。' },
        { index: '05', title: '验收、质量与核验', text: '重量、验收、样品、方法、报告、偏差和支持材料。', result: '实际履约可以与协商条件进行对照。' },
        { index: '06', title: '文件、结算与会计', text: '结算依据、文件、电子单据、金融流程、会计数据和会计交接。', result: '结算和会计使用同一履约历史，而不是分散沟通。' },
        { index: '07', title: '关闭与异常', text: '交易关闭、重算、冻结、退款、争议、证据和最终历史。', result: '正常流程和异常始终留在同一受控流程内。' },
      ],
      summaryTitle: '七个步骤共同构成同一笔交易',
      summaryText: 'Gekta、文件、物流、质量和结算不会变成独立故事，而是从开始到关闭都围绕同一笔交易工作。',
      moreLabel: '显示全部步骤',
    },
    process: {
      title: '向下滚动一笔交易，从开始看到关闭',
      lead: '每一步都会改变工作上下文：正在发生什么、参与方看到什么、需要哪些数据和文件，以及下一步操作是什么。',
    },
    demo: {
      eyebrow: '同一笔交易中的不同情况',
      title: '在同一段历史中比较正常流程、偏差和争议',
      lead: '这些不是三个平台模式，而是同一笔交易中的三种情况，共用条件、文件、参与方和依据。',
      statesLabel: '交易情况',
      openDeal: '打开完整交易场景',
    },
    demoStates: [
      { actionTitle: '结算依据已经汇集', actionText: '获授权的参与方可以看到相关事实和文件，并确认允许的操作。决定继续保留在交易历史中。' },
      { actionTitle: '买方可以看到可选决定', actionText: '平台把偏差与合同、报告和允许的操作关联起来：重算、复检或提出异议。' },
      { actionTitle: '分歧继续保留在共同历史中', actionText: '各方立场、文件版本、期限、争议金额与证据在解决前保持关联。' },
    ],
    roles: {
      title: '同一笔交易对每个角色呈现不同工作重点',
      lead: '卖方、买方、物流、司机、筒仓或仓储、实验室、检验机构、银行或金融以及平台员工使用同一套事实。',
      scenarioTitle: '从你的角色查看交易',
      scenarioLead: '切换角色会改变工作重点——数据、责任、操作、依据和资金影响——但交易本身保持不变。',
    },
    tai: {
      eyebrow: 'Gekta · 农业智能',
      title: 'Gekta 在交易上下文中工作',
      lead: '它对照条件、事件、文件与权限，解释差异，并结合来源帮助理解允许的下一步。',
      state: '事实 · 依据 · 下一步',
      limit: 'Gekta 负责解释、比较并准备操作选项，关键决定由获授权的参与方确认。',
      cta: '查看 Gekta 如何工作',
    },
    gektaProduct: {
      eyebrow: '生态中的独立产品',
      title: 'Gekta — 独立的农业人工智能',
      lead: '“透明价格”面向农业生产与农业经营的 AI 产品：种植、畜牧、农业机械、仓储、物流、文件与经营经济，都在同一个对话中。',
      cta: '打开 Gekta',
      navLabel: 'Gekta',
    },
    faq: {
      items: [
        { question: '除竞价外，机构还能获得什么？', answer: '条件、交易方、合同、服务、交付、验收、质量、文件、结算、会计和异常都保留在同一段工作历史中。' },
        { question: '发生偏差时会怎样？', answer: '平台把差异与条件、来源、责任方、期限、资金影响和允许的决定选项关联起来。' },
        { question: '权限和决定如何受控？', answer: '每项操作都在角色范围内执行，依据、数据版本、参与方和结果保存在交易历史中。' },
        { question: '如何开始使用？', answer: '完成注册和机构核验后进入对应角色的工作空间。公开接入协助继续作为独立帮助渠道。' },
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
    gektaProduct: localized.gektaProduct,
    faq: { ...base.faq, ...localized.faq },
  };
}
