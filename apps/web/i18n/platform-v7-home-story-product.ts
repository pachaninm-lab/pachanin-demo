import { getPlatformV7HomeStoryCopy as getBaseStoryCopy } from './platform-v7-home-story';

const productCopy = {
  ru: {
    nav: {
      difference: 'Преимущества',
      functions: 'Возможности',
      deal: 'Сделка в работе',
      roles: 'Для участников',
      tai: 'ИИ в агробизнесе',
    },
    heroDeal: {
      sampleLabel: 'Сценарий Сделки',
      proof: 'Товар, события, документы, решения и расчёт связаны в единой истории Сделки.',
    },
    proof: [
      { label: 'Единая Сделка', text: 'Торги, поставка, качество, документы и расчёт связаны между собой' },
      { label: 'Ролевой контроль', text: 'Каждый участник видит свою зону работы и следующий шаг' },
      { label: 'Проверяемая история', text: 'События, версии документов и решения сохраняются в Сделке' },
      { label: 'TAI внутри процесса', text: 'ИИ объясняет отклонения, риски и доступные действия' },
    ],
    difference: {
      eyebrow: 'Единая система исполнения',
      title: 'От согласования цены до закрытия Сделки — один управляемый процесс',
      lead: 'Платформа связывает участников, товар, логистику, качество, документы, расчёты и спор. Пользователь видит текущее состояние, ответственного и следующий шаг.',
      boundary: 'Все функции работают вокруг единого объекта Сделки и общей версии фактов.',
    },
    functions: {
      title: 'Полный контур агросделки собран в одной рабочей системе',
      lead: 'Каждый блок решает конкретную задачу пользователя и влияет на исполнение, документы, риск и расчёт.',
      summaryTitle: 'Все функции работают как единая Сделка',
      summaryText: 'Изменение в поставке отражается в приёмке, документах, рисках, доступных действиях и готовности расчёта.',
    },
    process: {
      title: 'Сделка проходит шесть понятных фаз — без разрыва между участниками',
      lead: 'На каждом шаге система показывает факты, ответственного, основание перехода и действие, которое продвигает Сделку дальше.',
    },
    demo: {
      eyebrow: 'Сделка в работе',
      title: 'Посмотрите, как система управляет нормой, отклонением и спором',
      lead: 'При изменении ситуации платформа обновляет факты, ответственность, доступные действия и готовность расчёта.',
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
        actionText: 'Позиции сторон, версии документов, сроки и доказательства сохраняются в одной истории до решения.',
      },
    ],
    roles: {
      title: 'Каждый участник работает в одном процессе и видит свою зону ответственности',
      lead: 'Продавец, покупатель, логистика, лаборатория, финансы и контроль используют общую версию фактов и разные полномочия.',
      scenarioTitle: 'Посмотрите Сделку глазами нужной роли',
      scenarioLead: 'Переключение роли показывает её данные, ответственность, доступные действия и результат.',
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
          question: 'Что получает бизнес кроме торгов?',
          answer: 'Единый контур исполнения: договор, поставку, приёмку, качество, документы, расчёт, спор, доказательства и аналитику в одной Сделке.',
        },
        {
          question: 'Как платформа помогает при отклонении?',
          answer: 'Система связывает отклонение с условиями, источниками, ответственным, сроком и допустимым действием, чтобы решение принималось по одной версии фактов.',
        },
        {
          question: 'Кто принимает окончательные решения?',
          answer: 'Уполномоченный участник действует в пределах своей роли. TAI объясняет ситуацию и готовит варианты, а платформа фиксирует основание и результат.',
        },
        {
          question: 'Как начать работу?',
          answer: 'Заполните короткую заявку организации, выберите роль и задачу. Система зарегистрирует обращение и выдаст номер для следующего шага.',
        },
      ],
    },
  },
  en: {
    nav: {
      difference: 'Advantages',
      functions: 'Capabilities',
      deal: 'Deal in action',
      roles: 'For participants',
      tai: 'AI for agribusiness',
    },
    heroDeal: {
      sampleLabel: 'Deal scenario',
      proof: 'Product, events, documents, decisions and settlement remain connected in one Deal history.',
    },
    proof: [
      { label: 'One Deal', text: 'Trading, delivery, quality, documents and settlement remain connected' },
      { label: 'Role-based control', text: 'Each participant sees their work area and next step' },
      { label: 'Verifiable history', text: 'Events, document versions and decisions remain in the Deal' },
      { label: 'TAI in the process', text: 'AI explains deviations, risks and permitted actions' },
    ],
    difference: {
      eyebrow: 'Unified execution system',
      title: 'From price agreement to Deal closure — one controlled process',
      lead: 'The platform connects participants, product, logistics, quality, documents, settlement and disputes. Users see the current state, responsible party and next step.',
      boundary: 'Every capability works around one Deal object and one shared version of facts.',
    },
    functions: {
      title: 'The complete agricultural Deal workflow in one operating system',
      lead: 'Each capability solves a concrete user task and affects execution, documents, risk and settlement.',
      summaryTitle: 'Every capability works as one Deal',
      summaryText: 'A delivery change is reflected in acceptance, documents, risk, permitted actions and settlement readiness.',
    },
    process: {
      title: 'The Deal moves through six clear phases without hand-off gaps',
      lead: 'At every step the system shows the facts, responsible party, transition evidence and the action that moves the Deal forward.',
    },
    demo: {
      eyebrow: 'Deal in action',
      title: 'See how the system handles normal execution, a deviation and a dispute',
      lead: 'When the situation changes, the platform updates facts, accountability, permitted actions and settlement readiness.',
      statesLabel: 'Deal state',
      openDeal: 'Open the complete Deal scenario',
    },
    demoStates: [
      {
        actionTitle: 'The Deal is ready for settlement',
        actionText: 'An authorised participant verifies the evidence and confirms the action. The platform retains the decision in the Deal history.',
      },
      {
        actionTitle: 'The buyer sees the available decisions',
        actionText: 'The platform links the deviation to the contract, protocol and permitted actions: recalculation, recheck or discrepancy.',
      },
      {
        actionTitle: 'The dispute stays in one controlled workflow',
        actionText: 'Party positions, document versions, deadlines and evidence remain in one history until resolution.',
      },
    ],
    roles: {
      title: 'Every participant works in one process and sees their responsibility',
      lead: 'Seller, buyer, logistics, laboratory, finance and control use one version of facts with different authorities.',
      scenarioTitle: 'View the Deal from the relevant role',
      scenarioLead: 'Changing the role shows its data, responsibility, permitted actions and outcome.',
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
        {
          question: 'What does the business get beyond trading?',
          answer: 'One execution workflow for contract, delivery, acceptance, quality, documents, settlement, dispute, evidence and analytics inside a single Deal.',
        },
        {
          question: 'How does the platform handle a deviation?',
          answer: 'The system links the deviation to terms, sources, the responsible party, deadline and permitted action so the decision uses one version of facts.',
        },
        {
          question: 'Who makes the final decisions?',
          answer: 'An authorised participant acts within their role. TAI explains the situation and prepares options while the platform retains the evidence and outcome.',
        },
        {
          question: 'How do we start?',
          answer: 'Submit the short organisation form, select the role and task. The system registers the request and returns a number for the next step.',
        },
      ],
    },
  },
  zh: {
    nav: {
      difference: '平台优势',
      functions: '平台能力',
      deal: '交易运行',
      roles: '参与方价值',
      tai: '农业商业 AI',
    },
    heroDeal: {
      sampleLabel: '交易场景',
      proof: '商品、事件、文件、决定与结算都保存在同一笔交易历史中。',
    },
    proof: [
      { label: '同一笔交易', text: '竞价、交付、质量、文件与结算始终相互关联' },
      { label: '按角色控制', text: '每个参与方只看到自己的工作范围和下一步' },
      { label: '可核验历史', text: '事件、文件版本与决定保存在交易中' },
      { label: '流程内的 TAI', text: 'AI 解释偏差、风险与允许的操作' },
    ],
    difference: {
      eyebrow: '统一执行系统',
      title: '从价格确定到交易关闭，始终由同一流程管理',
      lead: '平台连接参与方、商品、物流、质量、文件、结算与争议。用户能够看到当前状态、责任方和下一步。',
      boundary: '所有能力都围绕同一笔交易和同一套事实运行。',
    },
    functions: {
      title: '完整农业交易流程集中在同一工作系统',
      lead: '每项能力都解决具体用户任务，并直接影响执行、文件、风险与结算。',
      summaryTitle: '所有能力共同构成同一笔交易',
      summaryText: '交付变化会同步反映到验收、文件、风险、允许的操作和结算准备状态。',
    },
    process: {
      title: '交易通过六个清晰阶段推进，参与方之间不再脱节',
      lead: '每一步都显示事实、责任方、流转依据以及推动交易继续的操作。',
    },
    demo: {
      eyebrow: '交易运行',
      title: '查看系统如何处理正常执行、偏差与争议',
      lead: '情况变化时，平台会同步更新事实、责任、允许的操作和结算准备状态。',
      statesLabel: '交易状态',
      openDeal: '打开完整交易场景',
    },
    demoStates: [
      {
        actionTitle: '交易已具备结算条件',
        actionText: '获授权的参与方核验依据并确认操作，平台将决定保存在交易历史中。',
      },
      {
        actionTitle: '买方可以看到可选决定',
        actionText: '平台把偏差与合同、报告和允许的操作关联起来：重算、复检或提出异议。',
      },
      {
        actionTitle: '争议始终在同一受控流程中处理',
        actionText: '各方立场、文件版本、期限与证据在解决前统一保存在一条历史中。',
      },
    ],
    roles: {
      title: '所有参与方在同一流程中工作，并看到自己的责任范围',
      lead: '卖方、买方、物流、实验室、金融与控制角色使用同一套事实，并拥有不同权限。',
      scenarioTitle: '从所需角色查看交易',
      scenarioLead: '切换角色即可看到其数据、责任、允许的操作与结果。',
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
        {
          question: '除竞价外，企业还能获得什么？',
          answer: '合同、交付、验收、质量、文件、结算、争议、证据与分析都集中在同一笔交易的执行流程中。',
        },
        {
          question: '平台如何处理偏差？',
          answer: '系统把偏差与条件、来源、责任方、期限和允许的操作关联起来，使决定基于同一套事实。',
        },
        {
          question: '谁作出最终决定？',
          answer: '获授权的参与方在其角色范围内操作。TAI 解释情况并准备选项，平台保存依据和结果。',
        },
        {
          question: '如何开始使用？',
          answer: '填写简短的机构申请，选择角色和任务。系统会登记申请，并生成下一步所需的编号。',
        },
      ],
    },
  },
} as const;

export function getPlatformV7HomeStoryCopy(locale: string) {
  const base = getBaseStoryCopy(locale);
  const localized = locale === 'en' ? productCopy.en : locale === 'zh' ? productCopy.zh : productCopy.ru;

  return {
    ...base,
    nav: { ...base.nav, ...localized.nav },
    heroDeal: { ...base.heroDeal, ...localized.heroDeal },
    proof: localized.proof,
    difference: { ...base.difference, ...localized.difference },
    functions: { ...base.functions, ...localized.functions },
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
