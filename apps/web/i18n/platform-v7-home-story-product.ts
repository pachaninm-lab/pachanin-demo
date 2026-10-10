import { getPlatformV7HomeStoryCopy as getOperatingStoryCopy } from './platform-v7-home-story-operating';

type Locale = 'ru' | 'en' | 'zh';
type Step = Readonly<{ index: string; title: string; text: string; result: string }>;
type DemoNormal = Readonly<{
  status: string;
  title: string;
  summary: string;
  kpis: readonly Readonly<{ label: string; value: string }>[];
  events: readonly Readonly<{ meta: string; title: string; text: string }>[];
  actionTitle: string;
  actionText: string;
  actionCta: string;
}>;

const PRODUCT_COPY: Record<Locale, {
  navFunctions: string;
  heroSampleLabel: string;
  proof: readonly Readonly<{ label: string; text: string }>[];
  differenceLead: string;
  differenceBoundary: string;
  functionsTitle: string;
  functionsLead: string;
  functionsSummaryTitle: string;
  functionsSummaryText: string;
  functionsMore: string;
  functionItems: readonly Step[];
  processTitle: string;
  processLead: string;
  processPhases: readonly Step[];
  processMore: string;
  fullPathLabel: string;
  fullPathText: string;
  stagesLabel: string;
  demoTitle: string;
  demoLead: string;
  demoNormal: DemoNormal;
  rolesTitle: string;
  rolesLead: string;
  rolesScenarioTitle: string;
  rolesScenarioLead: string;
  taiState: string;
  taiLimit: string;
  faqStartQ: string;
  faqStartA: string;
  accountingQ: string;
  accountingA: string;
  externalSystemsQ: string;
  externalSystemsA: string;
}> = {
  ru: {
    navFunctions: 'Возможности',
    heroSampleLabel: 'Вымышленный пример Сделки',
    proof: [
      { label: '9 ролей', text: 'Продавец, покупатель, логистика, водитель, элеватор/хранение, лаборатория, сюрвейер, банк/финансы и сотрудник платформы' },
      { label: '7 шагов', text: 'Один понятный путь от товара и условий до расчёта и закрытия' },
      { label: 'RU · EN · ZH', text: 'Публичные сценарии доступны на русском, английском и китайском' },
      { label: 'Гекта', text: 'Аграрный интеллект помогает понять факты, риск и следующий разрешённый шаг' },
    ],
    differenceLead: 'Платформа ведёт агросделку как один процесс: товар и условия → торги → Сделка и договор → поставка → приёмка и качество → документы и основания расчёта → расчёт и закрытие.',
    differenceBoundary: 'Отклонение или спор не являются обязательным этапом. Они подключаются как исключение, когда зафиксированные факты требуют отдельного решения.',
    functionsTitle: 'Что платформа контролирует на всём пути Сделки',
    functionsLead: 'Это не дополнительные этапы. Возможности работают поперёк семи шагов и помогают каждой роли видеть свои данные, основания и следующий шаг.',
    functionsSummaryTitle: 'Одна Сделка — один источник контекста',
    functionsSummaryText: 'Условия, исполнение, качество, документы, расчётные основания, исключения и аналитика остаются связанными между собой.',
    functionsMore: 'Показать все возможности',
    functionItems: [
      { index: '01', title: 'Условия и торги', text: 'Товар, объём, качество, базис, допуски, предложения и ставки.', result: 'Понятно, на каких условиях стороны переходят к Сделке.' },
      { index: '02', title: 'Исполнение поставки', text: 'Перевозчик, водитель, маршрут, рейс, контрольные точки и фактическая доставка.', result: 'Поставка связана с конкретной Сделкой и ответственными.' },
      { index: '03', title: 'Приёмка и качество', text: 'Вес, размещение, проба, методика, протокол и зафиксированные расхождения.', result: 'Фактическое исполнение сопоставлено с согласованными условиями.' },
      { index: '04', title: 'Документы и доказательства', text: 'Версии, подписи, комплектность и связь документа с событием и партией.', result: 'Основание не теряется в переписке и остаётся проверяемым.' },
      { index: '05', title: 'Расчётные основания', text: 'Платформа показывает, какие основания уже есть и чего ещё не хватает.', result: 'Финансовое действие не допускается без достаточного основания.' },
      { index: '06', title: 'Контроль и Гекта', text: 'Гекта объясняет доступные факты и риски, а система сохраняет роли, сроки, исключения и историю решений.', result: 'Пользователь получает понятный следующий шаг без передачи ИИ самостоятельных полномочий.' },
    ],
    processTitle: 'Семь шагов обычной агросделки',
    processLead: 'Сначала показан нормальный успешный путь. Отклонение, перерасчёт или спор появляются отдельной веткой только при необходимости.',
    processPhases: [
      { index: '01', title: 'Товар и условия', text: 'Продукция, объём, качество, базис, допуски, документы и правила расчёта.', result: 'Зафиксировано, что именно и на каких условиях предлагается.' },
      { index: '02', title: 'Торги и контрагент', text: 'Допуск участников, предложения, ставки, сравнение условий и выбор второй стороны.', result: 'Выбран контрагент и согласованы коммерческие условия.' },
      { index: '03', title: 'Сделка и договор', text: 'Обязательства сторон, договорные условия, роли, сроки и основания исполнения.', result: 'Можно переходить к физическому исполнению обязательств.' },
      { index: '04', title: 'Логистика и поставка', text: 'Перевозчик, водитель, транспорт, маршрут, рейс и события доставки.', result: 'Партия доставлена и связана с фактами исполнения.' },
      { index: '05', title: 'Приёмка и качество', text: 'Вес, размещение, проба, лабораторный результат и проверка соответствия условиям.', result: 'Фактическое количество и качество сопоставлены с условиями.' },
      { index: '06', title: 'Документы и основания расчёта', text: 'Комплект документов, версии, подписи и проверка наступления расчётных оснований.', result: 'Понятно, есть ли основание переходить к финансовому действию.' },
      { index: '07', title: 'Расчёт и закрытие', text: 'Фиксация финансового результата, сверка исполнения и закрытие обязательств.', result: 'Сделка завершена с сохранённой историей оснований.' },
    ],
    processMore: 'Показать шаги 4–7',
    fullPathLabel: 'Обычный путь',
    fullPathText: 'Товар и условия → торги и контрагент → Сделка и договор → логистика и поставка → приёмка и качество → документы и основания расчёта → расчёт и закрытие.',
    stagesLabel: 'Показать 7 шагов',
    demoTitle: 'Обычное исполнение — основной сценарий',
    demoLead: 'Ниже показан вымышленный пример Сделки: норма идёт первой, а отклонение и спор показаны как отдельные исключения, а не обязательные этапы.',
    demoNormal: {
      status: 'Факты и основания',
      title: 'Поставка соответствует условиям примера',
      summary: 'Вес и качество соответствуют условиям примера. Следующий шаг — проверить комплект документов и основания расчёта.',
      kpis: [
        { label: 'Вес', value: '1 200,4 т · по данным примера' },
        { label: 'Качество', value: '12,1% · в допуске примера' },
        { label: 'Следующий шаг', value: 'Документы и основания расчёта' },
      ],
      events: [
        { meta: 'Сегодня, 09:42', title: 'Факт приёмки', text: 'Вес и партия связаны с событием приёмки в вымышленном примере.' },
        { meta: 'Сегодня, 09:51', title: 'Факт качества', text: 'Лабораторный результат примера соответствует условиям Сделки.' },
        { meta: 'Далее', title: 'Проверка документов', text: 'Следующий этап проверяет комплектность, версии, подписи и расчётные основания.' },
      ],
      actionTitle: 'Следующий шаг — документы',
      actionText: 'Проверьте комплектность, версии и подписи. После этого видно, достаточно ли оснований для финансового действия.',
      actionCta: 'Перейти к документам',
    },
    rolesTitle: 'Покажите платформу глазами моей роли',
    rolesLead: 'Девять публичных ролей объясняют пользу без изменения реальных прав доступа. Полномочия назначаются системой после регистрации и проверки организации.',
    rolesScenarioTitle: 'Что видит и делает каждая роль',
    rolesScenarioLead: 'Выберите роль, чтобы увидеть её задачу, основание, следующий шаг и влияние на расчёт.',
    taiState: 'Пример анализа · по данным сценария',
    taiLimit: 'Гекта объясняет доступные факты, риски и варианты действий. Она не назначает роли, не меняет права, не подписывает документы и не запускает движение денег.',
    faqStartQ: 'Как начать работу?',
    faqStartA: 'Зарегистрируйтесь в платформе. После регистрации и проверки организации система определит доступный рабочий контур для вашей роли. Если потребуется помощь с подключением, используйте отдельную форму обращения.',
    accountingQ: 'Как бухгалтер работает с 1С и ЭДО?',
    accountingA: 'Внешние системы используются через отдельные управляемые адаптеры. Платформа связывает данные внешнего учётного или документного контура со Сделкой только когда они получены из разрешённого источника. Схема обмена и права организации определяются до передачи данных.',
    externalSystemsQ: 'Нужны ли 1С, банк или госсистемы до регистрации?',
    externalSystemsA: 'Нет. Регистрация не зависит от внешних систем. Обмен с конкретным внешним контуром настраивается отдельно, когда организации нужен соответствующий сценарий и есть права и основание для передачи данных.',
  },
  en: {
    navFunctions: 'Capabilities',
    heroSampleLabel: 'Fictional Deal example',
    proof: [
      { label: '9 roles', text: 'Seller, buyer, logistics, driver, elevator/storage, laboratory, surveyor, bank/finance and platform employee' },
      { label: '7 steps', text: 'One clear path from product and terms to settlement and closure' },
      { label: 'RU · EN · ZH', text: 'Public scenarios are available in Russian, English and Chinese' },
      { label: 'Gekta', text: 'Agricultural intelligence helps explain facts, risk and the next permitted step' },
    ],
    differenceLead: 'The platform runs an agricultural Deal as one process: product and terms → bidding → Deal and contract → delivery → acceptance and quality → documents and settlement grounds → settlement and closure.',
    differenceBoundary: 'A deviation or dispute is not a mandatory stage. It becomes an exception branch only when recorded facts require a separate decision.',
    functionsTitle: 'What the platform controls across the Deal journey',
    functionsLead: 'These are not extra stages. The capabilities work across the seven steps and help each role see its data, evidence and next action.',
    functionsSummaryTitle: 'One Deal, one source of context',
    functionsSummaryText: 'Terms, execution, quality, documents, settlement grounds, exceptions and analytics stay connected.',
    functionsMore: 'Show all capabilities',
    functionItems: [
      { index: '01', title: 'Terms and bidding', text: 'Product, volume, quality, basis, tolerances, offers and bids.', result: 'The basis for moving into a Deal is explicit.' },
      { index: '02', title: 'Delivery execution', text: 'Carrier, driver, route, trip, checkpoints and actual delivery.', result: 'Delivery remains tied to the exact Deal and responsible parties.' },
      { index: '03', title: 'Acceptance and quality', text: 'Weight, placement, sample, method, protocol and recorded discrepancies.', result: 'Actual execution is compared with the agreed terms.' },
      { index: '04', title: 'Documents and evidence', text: 'Versions, signatures, completeness and relationship to events and lots.', result: 'Evidence remains traceable instead of being lost in correspondence.' },
      { index: '05', title: 'Settlement grounds', text: 'The platform shows which grounds are present and which are still missing.', result: 'A financial action requires a sufficient basis.' },
      { index: '06', title: 'Control and Gekta', text: 'Gekta explains available facts and risk while the system retains roles, deadlines, exceptions and decision history.', result: 'The user gets a clear next step without granting AI independent authority.' },
    ],
    processTitle: 'Seven steps of an ordinary agricultural Deal',
    processLead: 'The normal successful journey comes first. Deviation, recalculation or dispute appears as a separate branch only when needed.',
    processPhases: [
      { index: '01', title: 'Product and terms', text: 'Product, volume, quality, basis, tolerances, documents and settlement rules.', result: 'What is offered and on which terms is fixed.' },
      { index: '02', title: 'Bidding and counterparty', text: 'Admission, offers, bids, term comparison and counterparty selection.', result: 'The counterparty and commercial terms are agreed.' },
      { index: '03', title: 'Deal and contract', text: 'Party obligations, contract terms, roles, deadlines and execution grounds.', result: 'The obligations provide the basis for physical execution.' },
      { index: '04', title: 'Logistics and delivery', text: 'Carrier, driver, vehicle, route, trip and delivery events.', result: 'The lot is delivered with linked execution evidence.' },
      { index: '05', title: 'Acceptance and quality', text: 'Weight, placement, sample, laboratory result and conformity check.', result: 'Actual quantity and quality are compared with the terms.' },
      { index: '06', title: 'Documents and settlement grounds', text: 'Document set, versions, signatures and verification of settlement grounds.', result: 'It is clear whether there is a basis for a financial action.' },
      { index: '07', title: 'Settlement and closure', text: 'Recording the financial result, reconciling execution and closing obligations.', result: 'The Deal closes with a retained evidence history.' },
    ],
    processMore: 'Show steps 4–7',
    fullPathLabel: 'Ordinary journey',
    fullPathText: 'Product and terms → bidding and counterparty → Deal and contract → logistics and delivery → acceptance and quality → documents and settlement grounds → settlement and closure.',
    stagesLabel: 'Show the 7 steps',
    demoTitle: 'Ordinary execution is the primary scenario',
    demoLead: 'The section below is a fictional Deal example: normal execution comes first, while deviation and dispute are separate exceptions rather than mandatory stages.',
    demoNormal: {
      status: 'Facts and grounds',
      title: 'Delivery matches the example Deal terms',
      summary: 'Weight and quality match the example terms. The next step is to review documents and settlement grounds.',
      kpis: [
        { label: 'Weight', value: '1,200.4 t · example data' },
        { label: 'Quality', value: '12.1% · within example tolerance' },
        { label: 'Next step', value: 'Documents and settlement grounds' },
      ],
      events: [
        { meta: 'Today, 09:42', title: 'Acceptance fact', text: 'Weight and lot are linked to the acceptance event in the fictional example.' },
        { meta: 'Today, 09:51', title: 'Quality fact', text: 'The example laboratory result matches the Deal terms.' },
        { meta: 'Next', title: 'Document review', text: 'The next step checks completeness, versions, signatures and settlement grounds.' },
      ],
      actionTitle: 'Next step — documents',
      actionText: 'Review completeness, versions and signatures. The available grounds then show whether a financial action may proceed.',
      actionCta: 'Go to documents',
    },
    rolesTitle: 'Show me the platform from my role',
    rolesLead: 'Nine public roles explain value without changing real access rights. Authority is assigned by the system after registration and organisation verification.',
    rolesScenarioTitle: 'What each role sees and does',
    rolesScenarioLead: 'Choose a role to see its task, evidence, next action and settlement impact.',
    taiState: 'Illustrative analysis · scenario data',
    taiLimit: 'Gekta explains available facts, risks and action options. It does not assign roles, change access rights, sign documents or initiate money movement.',
    faqStartQ: 'How do I start?',
    faqStartA: 'Register on the platform. After registration and organisation verification, the system determines the workspace available to your role. If connection help is needed, use the separate assistance form.',
    accountingQ: 'How does an accountant work with 1C and EDI?',
    accountingA: 'External systems are used through separate managed adapters. The platform links external accounting or document data to the Deal only when the data comes from an authorised source. The exchange scheme and organisation rights are determined before data transfer.',
    externalSystemsQ: 'Are 1C, a bank or government systems required before registration?',
    externalSystemsA: 'No. Registration does not depend on external systems. Exchange with a specific external system is configured separately when the organisation needs that workflow and has the rights and basis for data transfer.',
  },
  zh: {
    navFunctions: '平台能力',
    heroSampleLabel: '虚构交易示例',
    proof: [
      { label: '9 个角色', text: '卖方、买方、物流、司机、筒仓/仓储、实验室、检验机构、银行/金融和平台员工' },
      { label: '7 个步骤', text: '从商品与条件到结算与关闭的一条清晰路径' },
      { label: 'RU · EN · ZH', text: '公开场景支持俄语、英语和中文' },
      { label: 'Gekta', text: '农业智能帮助解释事实、风险和允许的下一步' },
    ],
    differenceLead: '平台把农业交易作为一个流程管理：商品与条件 → 竞价 → 交易与合同 → 物流交付 → 验收与质量 → 文件与结算依据 → 结算与关闭。',
    differenceBoundary: '偏差或争议不是必经阶段。只有在已记录事实需要单独决定时，才进入异常分支。',
    functionsTitle: '平台在整条交易路径中控制什么',
    functionsLead: '这些不是额外阶段。相关能力贯穿七个步骤，帮助每个角色查看自己的数据、依据和下一步。',
    functionsSummaryTitle: '同一笔交易，同一上下文来源',
    functionsSummaryText: '条件、履约、质量、文件、结算依据、异常和分析始终保持关联。',
    functionsMore: '显示全部能力',
    functionItems: [
      { index: '01', title: '条件与竞价', text: '商品、数量、质量、基准、容差、报价和竞价。', result: '进入交易的商业依据清晰可见。' },
      { index: '02', title: '交付履约', text: '承运方、司机、路线、运输任务、检查点和实际交付。', result: '交付始终关联到具体交易和责任方。' },
      { index: '03', title: '验收与质量', text: '重量、入库、样品、方法、报告和已记录差异。', result: '实际履约与约定条件完成对照。' },
      { index: '04', title: '文件与证据', text: '版本、签名、完整性以及文件与事件、批次的关系。', result: '依据保持可追溯，不会丢失在分散沟通中。' },
      { index: '05', title: '结算依据', text: '平台显示已有依据以及仍然缺少的依据。', result: '金融操作需要充分依据。' },
      { index: '06', title: '控制与 Gekta', text: 'Gekta 解释可用事实和风险，系统保存角色、期限、异常和决定历史。', result: '用户得到清晰下一步，同时不会把独立权限交给 AI。' },
    ],
    processTitle: '普通农业交易的七个步骤',
    processLead: '先展示正常成功路径。只有确有需要时，偏差、重算或争议才作为单独分支出现。',
    processPhases: [
      { index: '01', title: '商品与条件', text: '商品、数量、质量、基准、容差、文件和结算规则。', result: '明确提供什么以及采用哪些条件。' },
      { index: '02', title: '竞价与交易方', text: '准入、报价、竞价、条件比较和交易方选择。', result: '确定交易方并确认商业条件。' },
      { index: '03', title: '交易与合同', text: '双方义务、合同条件、角色、期限和履约依据。', result: '相关义务构成进入实际履约的依据。' },
      { index: '04', title: '物流与交付', text: '承运方、司机、车辆、路线、运输任务和交付事件。', result: '批次完成交付并关联履约依据。' },
      { index: '05', title: '验收与质量', text: '重量、入库、样品、实验室结果和符合性检查。', result: '实际数量与质量已与条件完成对照。' },
      { index: '06', title: '文件与结算依据', text: '文件完整性、版本、签名以及结算依据核验。', result: '清楚知道是否存在进入金融操作的依据。' },
      { index: '07', title: '结算与关闭', text: '记录金融结果、核对履约并关闭义务。', result: '交易关闭，同时保留完整依据历史。' },
    ],
    processMore: '显示第 4–7 步',
    fullPathLabel: '普通路径',
    fullPathText: '商品与条件 → 竞价与交易方 → 交易与合同 → 物流与交付 → 验收与质量 → 文件与结算依据 → 结算与关闭。',
    stagesLabel: '显示 7 个步骤',
    demoTitle: '普通履约是主要场景',
    demoLead: '下面展示的是虚构交易示例：先显示正常履约，偏差和争议仅作为独立异常情况，不是每笔交易的必经阶段。',
    demoNormal: {
      status: '事实与依据',
      title: '交付符合示例交易条件',
      summary: '重量和质量符合示例条件。下一步是核验文件与结算依据。',
      kpis: [
        { label: '重量', value: '1,200.4 吨 · 示例数据' },
        { label: '质量', value: '12.1% · 符合示例容差' },
        { label: '下一步', value: '文件与结算依据' },
      ],
      events: [
        { meta: '今天 09:42', title: '验收事实', text: '重量和批次与虚构示例中的验收事件关联。' },
        { meta: '今天 09:51', title: '质量事实', text: '示例实验室结果符合交易条件。' },
        { meta: '下一步', title: '核验文件', text: '下一阶段检查文件完整性、版本、签名和结算依据。' },
      ],
      actionTitle: '下一步 — 文件',
      actionText: '核验完整性、版本和签名；随后可以根据已有依据判断是否进入金融操作。',
      actionCta: '进入文件核验',
    },
    rolesTitle: '从我的角色理解平台',
    rolesLead: '九个公开角色用于解释价值，不会改变真实访问权限。实际权限在注册并完成机构核验后由系统确定。',
    rolesScenarioTitle: '每个角色看到什么、做什么',
    rolesScenarioLead: '选择角色即可查看其任务、依据、下一步以及对结算的影响。',
    taiState: '分析示例 · 使用场景数据',
    taiLimit: 'Gekta 用于解释可用事实、风险和操作选项。它不会分配角色、改变访问权限、签署文件或发起资金流转。',
    faqStartQ: '如何开始使用？',
    faqStartA: '先在平台注册。完成注册和机构核验后，系统会根据角色确定可用工作空间。如需接入协助，请使用独立的帮助表单。',
    accountingQ: '会计人员如何使用 1C 和电子单据系统？',
    accountingA: '外部系统通过独立、受管理的适配器使用。只有当外部会计或电子文件数据来自获授权来源时，平台才把这些数据关联到交易。数据传输前需确定机构的交换方案和权限。',
    externalSystemsQ: '注册前必须具备 1C、银行或政府系统吗？',
    externalSystemsA: '不需要。注册不依赖外部系统。只有当机构需要相应流程，并具备数据传输权限和依据时，才单独配置与具体外部系统的数据交换。',
  },
};

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
    heroDeal: { ...copy.heroDeal, sampleLabel: local.heroSampleLabel },
    proof: local.proof,
    difference: { ...copy.difference, lead: local.differenceLead, boundary: local.differenceBoundary },
    functions: {
      ...copy.functions,
      title: local.functionsTitle,
      lead: local.functionsLead,
      items: local.functionItems,
      summaryTitle: local.functionsSummaryTitle,
      summaryText: local.functionsSummaryText,
      moreLabel: local.functionsMore,
    },
    process: {
      ...copy.process,
      title: local.processTitle,
      lead: local.processLead,
      phases: local.processPhases,
      moreLabel: local.processMore,
      fullPathLabel: local.fullPathLabel,
      fullPathText: local.fullPathText,
      stagesLabel: local.stagesLabel,
    },
    demo: {
      ...copy.demo,
      title: local.demoTitle,
      lead: local.demoLead,
      stages: local.processPhases.map((phase) => phase.title),
      states: copy.demo.states.map((state, index) => index === 0 ? { ...state, ...local.demoNormal } : state),
    },
    roles: {
      ...copy.roles,
      title: local.rolesTitle,
      lead: local.rolesLead,
      scenarioTitle: local.rolesScenarioTitle,
      scenarioLead: local.rolesScenarioLead,
    },
    tai: {
      ...copy.tai,
      state: local.taiState,
      limit: local.taiLimit,
    },
    faq: {
      ...copy.faq,
      items: [
        ...faqWithoutLegacyStart,
        { question: local.accountingQ, answer: local.accountingA },
        { question: local.externalSystemsQ, answer: local.externalSystemsA },
        { question: local.faqStartQ, answer: local.faqStartA },
      ],
    },
  };
}

/** Stable acceptance vocabulary for the public presentation. */
export const platformV7HomepageProductCopyAcceptance = {
  ru: { system: 'Полный контур агросделки собран в одной рабочей системе', unity: 'Все функции работают как единая Сделка', authority: 'Критические решения подтверждает уполномоченный участник.', roles: '9 ролей', journey: '7 шагов', primaryAction: 'Зарегистрироваться' },
  en: { system: 'The complete agricultural Deal workflow in one operating system', unity: 'Every capability works as one Deal', authority: 'Critical decisions are confirmed by an authorised participant.', roles: '9 roles', journey: '7 steps', primaryAction: 'Register' },
  zh: { system: '完整农业交易流程集中在同一工作系统', unity: '所有能力共同构成同一笔交易', authority: '关键决定由获授权的参与方确认。', roles: '9 个角色', journey: '7 个步骤', primaryAction: '注册' },
} as const;
