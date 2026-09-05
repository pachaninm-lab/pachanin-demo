import { getPlatformV7HomeStoryCopy as getOperatingStoryCopy } from './platform-v7-home-story-operating';

type Locale = 'ru' | 'en' | 'zh';

const PRODUCT_COPY = {
  ru: {
    navFunctions: '8 шагов Сделки',
    proof: [
      { label: '9 ролей', text: 'Публичное объяснение для продавца, покупателя, логистики, водителя, элеватора, лаборатории, сюрвейера, банка и сотрудника платформы' },
      { label: 'Одна Сделка', text: 'Условия, исполнение, документы, качество и расчёт остаются в одном контексте' },
      { label: 'RU · EN · ZH', text: 'Публичные сценарии доступны на русском, английском и китайском' },
      { label: 'Гекта', text: 'Аграрный интеллект сопоставляет доступные факты, источники, риск и следующий шаг' },
    ],
    differenceLead: 'Платформа ведёт агросделку как единый процесс: от условий и торгов до поставки, качества, документов, расчёта и закрытия. Каждая роль видит свой контекст, ответственность и следующий шаг.',
    differenceBoundary: 'Внешние системы подключаются через отдельные управляемые интеграции. Наличие интеграции, права доступа и фактический обмен подтверждаются для конкретного подключения организации.',
    functionsTitle: 'Восемь связанных шагов одной Сделки',
    functionsLead: 'Обычный успешный путь остаётся основным сценарием; отклонение или спор подключаются только когда для них появляется основание.',
    functionsSummaryTitle: 'Восемь шагов — один управляемый контекст',
    functionsSummaryText: 'Состояние каждого шага связано с участником, основанием, документами и последующим действием.',
    functionsMore: 'Показать шаги 5–8',
    processTitle: 'Понятный путь от условий до закрытия',
    processLead: 'Пользователь видит, где находится Сделка сейчас, что уже подтверждено и какое действие требуется дальше.',
    demoTitle: 'Сначала — обычное исполнение. При необходимости — отклонение или спор',
    demoLead: 'Пример показывает три состояния одной Сделки. Отклонение и спор — исключения, а не обязательный путь каждого пользователя.',
    rolesTitle: 'Покажите мне платформу глазами моей роли',
    rolesLead: 'Девять публичных ролей объясняют пользу без изменения реальных прав доступа. Полномочия назначаются системой после регистрации и проверки организации.',
    rolesScenarioTitle: 'Что видит и делает каждая роль',
    rolesScenarioLead: 'Выберите роль, чтобы увидеть её задачу, основание, следующую операцию и влияние на расчёт.',
    faqStartQ: 'Как начать работу?',
    faqStartA: 'Зарегистрируйтесь в платформе. После регистрации и проверки организации система определит доступный рабочий контур для вашей роли. Если потребуется помощь с подключением, используйте отдельную форму обращения.',
    accountingQ: 'Как бухгалтер работает с 1С и ЭДО?',
    accountingA: 'Платформа может связывать подтверждённые данные и статусы Сделки с внешним учётным и документным контуром через отдельное подключение. Конкретная схема, доступность интеграции и права подтверждаются для организации до обмена данными.',
  },
  en: {
    navFunctions: '8 Deal steps',
    proof: [
      { label: '9 roles', text: 'Public value explanation for seller, buyer, logistics, driver, elevator/storage, laboratory, surveyor, bank and platform employee' },
      { label: 'One Deal', text: 'Terms, execution, documents, quality and settlement stay in one context' },
      { label: 'RU · EN · ZH', text: 'Public scenarios are available in Russian, English and Chinese' },
      { label: 'Gekta', text: 'Agricultural intelligence matches available facts, sources, risk and the next step' },
    ],
    differenceLead: 'The platform runs an agricultural Deal as one process from terms and bidding through delivery, quality, documents, settlement and closure. Every role sees its own context, responsibility and next step.',
    differenceBoundary: 'External systems connect through separate managed integrations. Availability, access rights and actual data exchange are confirmed for each organisation connection.',
    functionsTitle: 'Eight connected steps of one Deal',
    functionsLead: 'The ordinary successful path is the primary scenario; deviation or dispute appears only when evidence requires it.',
    functionsSummaryTitle: 'Eight steps, one controlled context',
    functionsSummaryText: 'Each step is linked to a participant, evidence, documents and the next permitted action.',
    functionsMore: 'Show steps 5–8',
    processTitle: 'A clear path from terms to closure',
    processLead: 'The user sees where the Deal is now, what is already verified and what action is required next.',
    demoTitle: 'Ordinary execution first; deviation or dispute only when needed',
    demoLead: 'The example shows three states of one Deal. Deviation and dispute are exceptions, not a mandatory path for every user.',
    rolesTitle: 'Show me the platform from my role',
    rolesLead: 'Nine public roles explain value without changing real access rights. Authority is assigned by the system after registration and organisation verification.',
    rolesScenarioTitle: 'What each role sees and does',
    rolesScenarioLead: 'Choose a role to see its task, evidence, next action and settlement impact.',
    faqStartQ: 'How do I start?',
    faqStartA: 'Register on the platform. After registration and organisation verification, the system determines the workspace available to your role. If connection help is needed, use the separate assistance form.',
    accountingQ: 'How does an accountant work with 1C and EDI?',
    accountingA: 'The platform can link verified Deal data and statuses to an external accounting or document workflow through a separate connection. The exact scheme, integration availability and access rights are confirmed for the organisation before data exchange.',
  },
  zh: {
    navFunctions: '交易 8 个步骤',
    proof: [
      { label: '9 个角色', text: '面向卖方、买方、物流、司机、筒仓/仓储、实验室、检验机构、银行和平台员工的公开价值说明' },
      { label: '同一笔交易', text: '条件、履约、文件、质量和结算保持在同一上下文中' },
      { label: 'RU · EN · ZH', text: '公开场景支持俄语、英语和中文' },
      { label: 'Gekta', text: '农业智能对照可用事实、来源、风险和下一步' },
    ],
    differenceLead: '平台把农业交易作为一个完整流程管理：从条件和竞价，到交付、质量、文件、结算和关闭。每个角色都能看到自己的上下文、责任和下一步。',
    differenceBoundary: '外部系统通过独立的受控集成接入。实际可用性、访问权限和数据交换需要针对具体机构接入进行确认。',
    functionsTitle: '同一笔交易的八个关联步骤',
    functionsLead: '普通成功履约是主要场景；只有在存在依据时，才进入偏差或争议。',
    functionsSummaryTitle: '八个步骤，一个受控上下文',
    functionsSummaryText: '每一步都与参与方、依据、文件和允许的下一步关联。',
    functionsMore: '显示第 5–8 步',
    processTitle: '从条件到关闭的清晰路径',
    processLead: '用户可以看到交易当前所处位置、已确认内容以及下一步需要完成的操作。',
    demoTitle: '先展示普通履约；必要时再处理偏差或争议',
    demoLead: '示例展示同一笔交易的三种状态。偏差和争议属于例外，而不是每个用户的必经路径。',
    rolesTitle: '从我的角色理解平台',
    rolesLead: '九个公开角色用于解释价值，不会改变真实访问权限。实际权限在注册并完成机构核验后由系统确定。',
    rolesScenarioTitle: '每个角色看到什么、做什么',
    rolesScenarioLead: '选择角色即可查看其任务、依据、下一步以及对结算的影响。',
    faqStartQ: '如何开始使用？',
    faqStartA: '先在平台注册。完成注册和机构核验后，系统会根据角色确定可用工作空间。如需接入协助，请使用独立的帮助表单。',
    accountingQ: '会计人员如何使用 1C 和电子单据系统？',
    accountingA: '平台可以通过独立接入，把已确认的交易数据和状态关联到外部会计或电子文件流程。具体方案、集成可用性和访问权限必须在数据交换前针对机构确认。',
  },
} as const;

function localeOf(locale: string): Locale {
  return locale === 'en' || locale === 'zh' ? locale : 'ru';
}

export function getPlatformV7HomeStoryCopy(locale: string) {
  const normalized = localeOf(locale);
  const copy = getOperatingStoryCopy(normalized);
  const local = PRODUCT_COPY[normalized];
  const faqWithoutLegacyStart = copy.faq.items.filter((item) => {
    const question = String(item.question).toLowerCase();
    return !question.includes('начать работу') && !question.includes('start using') && !question.includes('开始使用');
  });

  return {
    ...copy,
    nav: { ...copy.nav, functions: local.navFunctions },
    proof: local.proof,
    difference: {
      ...copy.difference,
      lead: local.differenceLead,
      boundary: local.differenceBoundary,
    },
    functions: {
      ...copy.functions,
      title: local.functionsTitle,
      lead: local.functionsLead,
      summaryTitle: local.functionsSummaryTitle,
      summaryText: local.functionsSummaryText,
      moreLabel: local.functionsMore,
    },
    process: {
      ...copy.process,
      title: local.processTitle,
      lead: local.processLead,
    },
    demo: {
      ...copy.demo,
      title: local.demoTitle,
      lead: local.demoLead,
    },
    roles: {
      ...copy.roles,
      title: local.rolesTitle,
      lead: local.rolesLead,
      scenarioTitle: local.rolesScenarioTitle,
      scenarioLead: local.rolesScenarioLead,
    },
    faq: {
      ...copy.faq,
      items: [
        ...faqWithoutLegacyStart,
        { question: local.accountingQ, answer: local.accountingA },
        { question: local.faqStartQ, answer: local.faqStartA },
      ],
    },
  };
}

/** Stable acceptance vocabulary for the operating public presentation. */
export const platformV7HomepageProductCopyAcceptance = {
  ru: {
    system: 'Полный контур агросделки собран в одной рабочей системе',
    unity: 'Все функции работают как единая Сделка',
    authority: 'Критические решения подтверждает уполномоченный участник.',
    roles: '9 ролей',
    primaryAction: 'Зарегистрироваться',
  },
  en: {
    system: 'The complete agricultural Deal workflow in one operating system',
    unity: 'Every capability works as one Deal',
    authority: 'Critical decisions are confirmed by an authorised participant.',
    roles: '9 roles',
    primaryAction: 'Register',
  },
  zh: {
    system: '完整农业交易流程集中在同一工作系统',
    unity: '所有能力共同构成同一笔交易',
    authority: '关键决定由获授权的参与方确认。',
    roles: '9 个角色',
    primaryAction: '注册',
  },
} as const;
