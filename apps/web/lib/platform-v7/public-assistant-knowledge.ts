export type PublicAssistantLocale = 'ru' | 'en' | 'zh';

export type PublicAssistantTopicId =
  | 'overview'
  | 'deal_path'
  | 'roles'
  | 'auction'
  | 'physical_execution'
  | 'documents'
  | 'money'
  | 'disputes'
  | 'integrations'
  | 'security'
  | 'assistant';

export type PublicAssistantSource = Readonly<{
  label: string;
  href: string;
}>;

export type PublicAssistantAnswer = Readonly<{
  knowledgeVersion: string;
  topic: PublicAssistantTopicId;
  title: string;
  answer: string;
  facts: readonly string[];
  maturity: string;
  confidence: 'high' | 'medium';
  actionAllowed: false;
  sources: readonly PublicAssistantSource[];
  suggestions: readonly string[];
}>;

type TopicCopy = Readonly<{
  title: string;
  answer: string;
  facts: readonly string[];
  maturity: string;
  suggestions: readonly string[];
}>;

type TopicDefinition = Readonly<{
  id: PublicAssistantTopicId;
  keywords: Readonly<Record<PublicAssistantLocale, readonly string[]>>;
  copy: Readonly<Record<PublicAssistantLocale, TopicCopy>>;
  sources: readonly PublicAssistantSource[];
}>;

export const PUBLIC_ASSISTANT_KNOWLEDGE_VERSION = 'public-platform-knowledge-2026-07-17.v1';

const sharedSources = {
  home: { label: 'Главная платформы', href: '/platform-v7' },
  how: { label: 'Как работает сделка', href: '/platform-v7/how-it-works' },
  security: { label: 'Безопасная зерновая сделка', href: '/platform-v7/secure-grain-deal' },
  fgis: { label: 'ФГИС «Зерно»', href: '/platform-v7/fgis-zerno' },
  privacy: { label: 'Конфиденциальность', href: '/platform-v7/privacy' },
  contact: { label: 'Связаться с проектом', href: '/platform-v7/contact' },
} as const;

const TOPICS: readonly TopicDefinition[] = [
  {
    id: 'overview',
    keywords: {
      ru: ['что это', 'платформа', 'прозрачная цена', 'назначение', 'зачем'],
      en: ['what is', 'platform', 'transparent price', 'purpose', 'why'],
      zh: ['是什么', '平台', '透明价格', '用途', '为什么'],
    },
    copy: {
      ru: {
        title: 'Что такое «Прозрачная Цена»',
        answer: 'Это единый цифровой контур исполнения внебиржевой зерновой сделки. Главный объект системы — Сделка, а остальные функции связывают условия, допуск, торги, физическое исполнение, документы, деньги, спор и доказательства в одну контролируемую историю.',
        facts: ['Не marketplace и не доска объявлений.', 'Состояние сделки определяется доменными правилами и серверными данными.', 'Каждый участник видит только разрешённый ему контур.'],
        maturity: 'Публичный помощник объясняет целевую модель и подтверждённые функции, но не заявляет неподключённые внешние интеграции как действующие.',
        suggestions: ['Покажи путь сделки', 'Какие роли участвуют?', 'Как защищаются данные?'],
      },
      en: {
        title: 'What Transparent Price is',
        answer: 'It is a unified digital execution layer for an OTC grain deal. The Deal is the primary system object, while admission, auction, physical execution, documents, money, disputes and evidence form one controlled history around it.',
        facts: ['It is not a marketplace or classifieds board.', 'Deal state comes from domain rules and server-authoritative data.', 'Each participant sees only the permitted scope.'],
        maturity: 'The public assistant explains the target model and verified functions without presenting unconnected external integrations as live.',
        suggestions: ['Show the deal path', 'Which roles participate?', 'How is data protected?'],
      },
      zh: {
        title: '“透明价格”是什么',
        answer: '这是一个用于执行场外粮食交易的统一数字化基础设施。交易是系统的核心对象，准入、竞价、实物履约、文件、资金、争议和证据围绕同一条受控历史运行。',
        facts: ['不是普通市场平台或分类信息板。', '交易状态由领域规则和服务器权威数据决定。', '每个参与方只能看到获授权的范围。'],
        maturity: '公共助手只解释目标模式和已确认功能，不把尚未连接的外部集成描述为已上线。',
        suggestions: ['展示交易流程', '有哪些角色？', '数据如何保护？'],
      },
    },
    sources: [sharedSources.home, sharedSources.how],
  },
  {
    id: 'deal_path',
    keywords: {
      ru: ['этап', 'путь сделки', 'как работает', 'процесс', 'контур сделки'],
      en: ['stage', 'deal path', 'how it works', 'process', 'deal flow'],
      zh: ['阶段', '交易流程', '如何运作', '过程', '履约链路'],
    },
    copy: {
      ru: {
        title: 'Путь сделки',
        answer: 'Канонический контур: условия и цена → допуск → аукцион → создание Сделки → логистика → приёмка → лаборатория → документы → резерв и расчёт → спор при необходимости → доказательства → закрытие → аналитика.',
        facts: ['Каждый этап фиксирует событие, ответственного и основание.', 'Следующий шаг выводится из текущего состояния Сделки.', 'Деньги и спор не являются отдельными сервисами — они входят в исполнение Сделки.'],
        maturity: 'Внешние банковские и государственные шаги считаются подключёнными только после отдельного подтверждения интеграции.',
        suggestions: ['Как устроен аукцион?', 'Что происходит после доставки?', 'Как закрывается сделка?'],
      },
      en: {
        title: 'Deal execution path',
        answer: 'The canonical flow is: terms and price → admission → auction → Deal creation → logistics → acceptance → laboratory → documents → reserve and settlement → dispute when required → evidence → closure → analytics.',
        facts: ['Every stage records an event, owner and basis.', 'The next action is derived from the current Deal state.', 'Money and disputes are part of Deal execution, not detached services.'],
        maturity: 'Bank and government steps are treated as connected only after separate integration acceptance.',
        suggestions: ['How does the auction work?', 'What happens after delivery?', 'How is a deal closed?'],
      },
      zh: {
        title: '交易履约流程',
        answer: '标准流程为：条件与价格 → 准入 → 竞价 → 创建交易 → 物流 → 验收 → 实验室 → 文件 → 资金预留与结算 → 必要时争议 → 证据 → 关闭 → 分析。',
        facts: ['每个阶段记录事件、责任方和依据。', '下一步由当前交易状态推导。', '资金和争议属于交易履约的一部分。'],
        maturity: '银行和政府步骤只有在单独完成集成验收后才被视为已连接。',
        suggestions: ['竞价如何运作？', '交付后发生什么？', '交易如何关闭？'],
      },
    },
    sources: [sharedSources.how],
  },
  {
    id: 'roles',
    keywords: {
      ru: ['роль', 'участник', 'покупатель', 'продавец', 'водитель', 'банк', 'лаборатория'],
      en: ['role', 'participant', 'buyer', 'seller', 'driver', 'bank', 'laboratory'],
      zh: ['角色', '参与方', '买方', '卖方', '司机', '银行', '实验室'],
    },
    copy: {
      ru: {
        title: 'Роли участников',
        answer: 'Платформа поддерживает 12 рабочих ролей: покупатель, продавец, логистика, водитель, элеватор, лаборатория, сюрвейер, банк, оператор, комплаенс, арбитр и руководитель. Один вход определяет роль и организацию на сервере.',
        facts: ['Роль не выбирается через URL.', 'Права не хранятся как доверенные данные в браузере.', 'Одна и та же Сделка показывается каждой роли в разрешённой проекции.'],
        maturity: 'Полномочия внешних организаций начинают действовать только после реального onboarding и договорного допуска.',
        suggestions: ['Что видит покупатель?', 'Что делает банк?', 'Как работает один вход?'],
      },
      en: {
        title: 'Participant roles',
        answer: 'The platform supports 12 operating roles: buyer, seller, logistics, driver, elevator, laboratory, surveyor, bank, operator, compliance, arbitrator and executive. A single sign-in resolves role and organization on the server.',
        facts: ['Role is not selected through the URL.', 'Permissions are not trusted from browser storage.', 'The same Deal is projected differently for each authorized role.'],
        maturity: 'External organization authority starts only after real onboarding and contractual admission.',
        suggestions: ['What does a buyer see?', 'What does the bank do?', 'How does single sign-in work?'],
      },
      zh: {
        title: '参与方角色',
        answer: '平台支持12种工作角色：买方、卖方、物流、司机、粮库、实验室、检验员、银行、运营、合规、仲裁员和管理层。统一登录后由服务器确定角色和组织。',
        facts: ['不能通过URL选择角色。', '浏览器存储中的权限不会被视为可信。', '同一交易会按每个角色的授权范围展示。'],
        maturity: '外部组织权限只有在真实入驻和合同准入后才生效。',
        suggestions: ['买方能看到什么？', '银行做什么？', '统一登录如何工作？'],
      },
    },
    sources: [sharedSources.how, sharedSources.security],
  },
  {
    id: 'auction',
    keywords: {
      ru: ['аукцион', 'торги', 'ставка', 'победитель', 'лот'],
      en: ['auction', 'bid', 'winner', 'lot', 'trading'],
      zh: ['竞价', '拍卖', '出价', '中标方', '批次'],
    },
    copy: {
      ru: {
        title: 'Аукцион как часть Сделки',
        answer: 'Аукцион работает с реальным лотом, допуском, неизменяемой историей ставок и детерминированным выбором победителя. Результат должен автоматически создавать основание для канонической Сделки и дальнейшего исполнения.',
        facts: ['Правила торгов нельзя обходить через интерфейс.', 'Две победившие ставки для одного результата недопустимы.', 'История ставок сохраняется для аудита и спора.'],
        maturity: 'Интеграция торгов с внешними государственными системами указывается отдельно и не считается активной по умолчанию.',
        suggestions: ['Что происходит после победы?', 'Как контролируется допуск?', 'Можно ли изменить ставку задним числом?'],
      },
      en: {
        title: 'Auction as part of the Deal',
        answer: 'The auction operates on a real lot, admission status, immutable bid history and deterministic winner selection. Its result forms the basis for the canonical Deal and subsequent execution.',
        facts: ['Trading rules cannot be bypassed through the UI.', 'Two winning outcomes for one auction are prohibited.', 'Bid history remains available for audit and dispute evidence.'],
        maturity: 'Any government-system trading integration is reported separately and is not assumed live.',
        suggestions: ['What happens after winning?', 'How is admission controlled?', 'Can a bid be changed retroactively?'],
      },
      zh: {
        title: '竞价是交易的一部分',
        answer: '竞价基于真实批次、准入状态、不可变的出价历史和确定性的中标方选择。结果会形成标准交易及后续履约的依据。',
        facts: ['不能通过界面绕过交易规则。', '同一次竞价不能出现两个中标结果。', '出价历史保留用于审计和争议证据。'],
        maturity: '与政府系统的竞价集成需单独说明，默认不视为已上线。',
        suggestions: ['中标后发生什么？', '准入如何控制？', '能否追溯修改出价？'],
      },
    },
    sources: [sharedSources.how],
  },
  {
    id: 'physical_execution',
    keywords: {
      ru: ['логистика', 'перевозка', 'приёмка', 'вес', 'качество', 'лаборатория', 'рейс'],
      en: ['logistics', 'transport', 'acceptance', 'weight', 'quality', 'laboratory', 'trip'],
      zh: ['物流', '运输', '验收', '重量', '质量', '实验室', '车次'],
    },
    copy: {
      ru: {
        title: 'Физическое исполнение',
        answer: 'После создания Сделки платформа связывает перевозчика и рейс с приёмкой, весом, лабораторным качеством и документными основаниями. Отклонения не скрываются: они становятся фактом, блокером, риском или основанием спора.',
        facts: ['Рейс относится к конкретной Сделке.', 'Масса и качество сохраняются как проверяемые значения.', 'Расхождение должно иметь ответственного и доказательство.'],
        maturity: 'Телематика, ГИС ЭПД и внешние лабораторные системы считаются активными только после подтверждённого подключения.',
        suggestions: ['Как фиксируется вес?', 'Что делать при отклонении качества?', 'Кто отвечает за рейс?'],
      },
      en: {
        title: 'Physical execution',
        answer: 'After Deal creation, the platform links carrier and trip data with acceptance, weight, laboratory quality and documentary basis. Deviations become explicit facts, blockers, risks or dispute grounds.',
        facts: ['Each trip belongs to a specific Deal.', 'Weight and quality are stored as verifiable values.', 'A discrepancy must have an owner and evidence.'],
        maturity: 'Telematics, electronic transport documents and external laboratory systems are live only after confirmed connection.',
        suggestions: ['How is weight recorded?', 'What happens on a quality deviation?', 'Who owns the trip?'],
      },
      zh: {
        title: '实物履约',
        answer: '创建交易后，平台把承运方和车次与验收、重量、实验室质量及文件依据关联起来。偏差会成为明确事实、阻塞、风险或争议依据。',
        facts: ['每个车次属于特定交易。', '重量和质量作为可验证数值保存。', '差异必须有责任方和证据。'],
        maturity: '车联网、电子运输文件和外部实验室系统只有在确认连接后才视为上线。',
        suggestions: ['重量如何记录？', '质量偏差如何处理？', '谁负责车次？'],
      },
    },
    sources: [sharedSources.how],
  },
  {
    id: 'documents',
    keywords: {
      ru: ['документ', 'подпись', 'доказательство', 'версия', 'акт', 'накладная'],
      en: ['document', 'signature', 'evidence', 'version', 'act', 'waybill'],
      zh: ['文件', '签名', '证据', '版本', '验收单', '运单'],
    },
    copy: {
      ru: {
        title: 'Документы и доказательства',
        answer: 'Документ рассматривается как часть исполнения Сделки: событие → документ → версия → подпись или проверка → действие. Для спора и расчёта важны происхождение, хеш, версия, полномочия подписанта и связь с событием.',
        facts: ['Новая версия не должна незаметно заменять предыдущую.', 'Модель не меняет документ и не подписывает его.', 'Доказательства должны быть доступны уполномоченным участникам и аудиту.'],
        maturity: 'КЭП и ЭДО считаются действующими только после юридической и технической интеграции.',
        suggestions: ['Каких документов не хватает?', 'Как сравниваются версии?', 'Что входит в evidence pack?'],
      },
      en: {
        title: 'Documents and evidence',
        answer: 'A document is part of Deal execution: event → document → version → signature or verification → action. Settlement and disputes depend on provenance, hash, version, signer authority and event linkage.',
        facts: ['A new version must not silently replace the previous one.', 'The model does not alter or sign documents.', 'Evidence remains available to authorized participants and audit.'],
        maturity: 'Qualified signatures and EDI are active only after legal and technical integration.',
        suggestions: ['Which documents are missing?', 'How are versions compared?', 'What is included in an evidence pack?'],
      },
      zh: {
        title: '文件与证据',
        answer: '文件属于交易履约链路：事件 → 文件 → 版本 → 签名或核验 → 动作。结算和争议需要来源、哈希、版本、签署权限以及与事件的关联。',
        facts: ['新版本不能无痕替换旧版本。', '模型不能修改或签署文件。', '证据只向授权参与方和审计开放。'],
        maturity: '合格电子签名和电子数据交换只有在法律及技术集成后才视为启用。',
        suggestions: ['缺少哪些文件？', '如何比较版本？', '证据包包含什么？'],
      },
    },
    sources: [sharedSources.how, sharedSources.security],
  },
  {
    id: 'money',
    keywords: {
      ru: ['деньги', 'банк', 'выплата', 'резерв', 'эскроу', 'номинальный', 'release', 'расчёт'],
      en: ['money', 'bank', 'payout', 'reserve', 'escrow', 'nominal', 'release', 'settlement'],
      zh: ['资金', '银行', '付款', '预留', '托管', '名义账户', '释放', '结算'],
    },
    copy: {
      ru: {
        title: 'Банковский контур и деньги',
        answer: 'Деньги являются частью состояния Сделки. Платформа проектирует резервирование, подтверждённые основания, частичные выплаты, release по событиям, callback, reconciliation, удержание и спор. ИИ не подтверждает движение денег.',
        facts: ['Банковский callback проверяется сервером.', 'Повтор события не должен создавать повторное денежное движение.', 'Выплата разрешается только по подтверждённому основанию и полномочиям.'],
        maturity: 'Реальный номинальный счёт, escrow или кредит появляются только после договора и приёмки конкретного банка.',
        suggestions: ['Что блокирует выплату?', 'Как работает резерв?', 'Что происходит при споре?'],
      },
      en: {
        title: 'Banking and money',
        answer: 'Money is part of Deal state. The platform is designed for reservation, verified basis, partial payouts, event-based release, callbacks, reconciliation, holds and disputes. AI never confirms money movement.',
        facts: ['Bank callbacks are verified server-side.', 'A repeated event must not create duplicate money movement.', 'Payout is allowed only on verified basis and authority.'],
        maturity: 'A real nominal account, escrow or credit facility exists only after contract and acceptance by a specific bank.',
        suggestions: ['What blocks payout?', 'How does reservation work?', 'What happens during a dispute?'],
      },
      zh: {
        title: '银行与资金',
        answer: '资金属于交易状态的一部分。平台面向资金预留、已验证依据、部分付款、按事件释放、回调、对账、冻结和争议进行设计。AI不能确认资金流转。',
        facts: ['银行回调在服务器端验证。', '重复事件不能造成重复资金变动。', '付款必须基于已验证依据和权限。'],
        maturity: '真实名义账户、托管或信贷只有在与具体银行签约并完成验收后才存在。',
        suggestions: ['什么阻止付款？', '资金预留如何工作？', '争议期间会发生什么？'],
      },
    },
    sources: [sharedSources.security, sharedSources.contact],
  },
  {
    id: 'disputes',
    keywords: {
      ru: ['спор', 'претензия', 'арбитр', 'удержание', 'заморозка', 'evidence'],
      en: ['dispute', 'claim', 'arbitrator', 'hold', 'freeze', 'evidence'],
      zh: ['争议', '索赔', '仲裁员', '冻结', '扣留', '证据'],
    },
    copy: {
      ru: {
        title: 'Спор и доказательства',
        answer: 'Спор не удаляет историю исполнения. Он фиксирует предмет, стороны, спорные деньги, события, документы и доказательства. Решение принимается уполномоченным контуром, а не моделью.',
        facts: ['Денежные операции могут быть удержаны по правилам Сделки.', 'Каждое доказательство связано с источником и временем.', 'Решение и частичное решение должны оставлять audit trail.'],
        maturity: 'Внешний арбитраж или юридически значимый порядок вводится только после утверждения правил и договоров.',
        suggestions: ['Что входит в доказательства?', 'Кто принимает решение?', 'Как спор влияет на деньги?'],
      },
      en: {
        title: 'Disputes and evidence',
        answer: 'A dispute preserves the execution history. It records the subject, parties, affected money, events, documents and evidence. The decision belongs to an authorized process, never the model.',
        facts: ['Money operations may be held under Deal rules.', 'Each evidence item is linked to source and time.', 'Full and partial decisions must leave an audit trail.'],
        maturity: 'External arbitration or legally binding procedure begins only after approved rules and contracts.',
        suggestions: ['What belongs in evidence?', 'Who makes the decision?', 'How does a dispute affect money?'],
      },
      zh: {
        title: '争议与证据',
        answer: '争议不会删除履约历史。系统记录争议事项、各方、受影响资金、事件、文件和证据。决定由获授权流程作出，而不是由模型作出。',
        facts: ['资金操作可依据交易规则被冻结。', '每项证据都关联来源和时间。', '完整或部分裁决必须保留审计轨迹。'],
        maturity: '外部仲裁或具有法律效力的流程只有在规则和合同获批后才启动。',
        suggestions: ['证据包括什么？', '谁作出决定？', '争议如何影响资金？'],
      },
    },
    sources: [sharedSources.how, sharedSources.security],
  },
  {
    id: 'integrations',
    keywords: {
      ru: ['интеграция', 'фгис', 'сдиз', 'эдо', 'гис эпд', 'есиа', 'erp', 'crm', 'подключено'],
      en: ['integration', 'fgis', 'edi', 'esia', 'erp', 'crm', 'connected', 'government'],
      zh: ['集成', '政府系统', '电子数据交换', 'ERP', 'CRM', '已连接'],
    },
    copy: {
      ru: {
        title: 'Статус внешних интеграций',
        answer: 'Архитектура предусматривает ФГИС «Зерно», СДИЗ, ЭДО, ГИС ЭПД, КЭП, ЕСИА, ERP, CRM и банки. Наличие интерфейса или адаптера не означает действующее внешнее подключение.',
        facts: ['Статус каждой интеграции должен быть отдельным: предусмотрена, реализован адаптер, тестируется, принята, эксплуатируется.', 'Без credentials и договора контур должен завершаться fail-closed.', 'Публичный помощник не обещает неподтверждённое подключение.'],
        maturity: 'По умолчанию внешние интеграции считаются NOT_CONNECTED, пока нет отдельного подтверждения.',
        suggestions: ['Как может работать ФГИС?', 'Что требуется для банка?', 'Как подтверждается production-интеграция?'],
      },
      en: {
        title: 'External integration status',
        answer: 'The architecture accounts for grain government systems, electronic documents, qualified signatures, identity, ERP, CRM and banks. A UI or adapter does not mean a live external connection.',
        facts: ['Each integration needs a separate status: planned, adapter implemented, testing, accepted or operating.', 'Without credentials and contract the path must fail closed.', 'The public assistant never promises an unverified connection.'],
        maturity: 'External integrations are NOT_CONNECTED by default until separately proven.',
        suggestions: ['How may government integration work?', 'What is required for a bank?', 'How is production integration accepted?'],
      },
      zh: {
        title: '外部集成状态',
        answer: '架构考虑了粮食政府系统、电子文件、合格电子签名、身份、ERP、CRM和银行。存在界面或适配器并不代表外部连接已上线。',
        facts: ['每个集成都必须单独标注：规划、适配器完成、测试、验收或运营。', '没有凭证和合同必须安全失败。', '公共助手不会承诺未经验证的连接。'],
        maturity: '默认情况下外部集成为NOT_CONNECTED，直到单独证明。',
        suggestions: ['政府系统如何集成？', '银行需要什么？', '生产集成如何验收？'],
      },
    },
    sources: [sharedSources.fgis, sharedSources.contact],
  },
  {
    id: 'security',
    keywords: {
      ru: ['безопасность', 'доступ', 'чужие данные', 'rbac', 'персональные данные', 'аудит', 'изоляция'],
      en: ['security', 'access', 'foreign data', 'rbac', 'personal data', 'audit', 'isolation'],
      zh: ['安全', '访问', '他人数据', '权限', '个人数据', '审计', '隔离'],
    },
    copy: {
      ru: {
        title: 'Безопасность и границы доступа',
        answer: 'Авторизация должна быть серверной: пользователь, организация, membership, роль и участие в Сделке проверяются до выдачи фактов. Модель не получает прямой доступ к базе данных и не повышает полномочия.',
        facts: ['Tenant и role isolation обязательны.', 'Критические действия требуют отдельного подтверждения, а для денег и подписей — повышенного assurance.', 'Запросы и ответы должны иметь аудит без лишнего хранения секретных данных.'],
        maturity: 'Архитектурная готовность не равна подтверждённой эксплуатации; нужны нагрузка, red-team, мониторинг и история работы.',
        suggestions: ['Может ли помощник видеть чужую сделку?', 'Кто подтверждает деньги?', 'Как ведётся аудит?'],
      },
      en: {
        title: 'Security and access boundaries',
        answer: 'Authorization is server-authoritative: user, organization, membership, role and Deal participation are checked before facts are returned. The model has no direct database access and cannot elevate privileges.',
        facts: ['Tenant and role isolation are mandatory.', 'Critical actions require separate confirmation; money and signatures require higher assurance.', 'Queries and answers need audit without unnecessary secret retention.'],
        maturity: 'Architecture readiness is not proven operation; load, red-team, monitoring and operating history are still required.',
        suggestions: ['Can the assistant see another deal?', 'Who confirms money?', 'How is audit recorded?'],
      },
      zh: {
        title: '安全与访问边界',
        answer: '授权由服务器控制：在返回事实前检查用户、组织、成员关系、角色和交易参与关系。模型不能直接访问数据库，也不能提升权限。',
        facts: ['必须实现租户和角色隔离。', '关键动作需要单独确认；资金和签名需要更高保障级别。', '请求和回答需要审计，同时避免不必要地保存敏感数据。'],
        maturity: '架构就绪不等于已证明运营；仍需负载、红队、监控和运营历史。',
        suggestions: ['助手能看到其他交易吗？', '谁确认资金？', '如何记录审计？'],
      },
    },
    sources: [sharedSources.security, sharedSources.privacy],
  },
  {
    id: 'assistant',
    keywords: {
      ru: ['помощник', 'ии', 'ai', 'чат', 'что умеешь', 'можешь сделать'],
      en: ['assistant', 'ai', 'chat', 'what can you do', 'can you execute'],
      zh: ['助手', '人工智能', '聊天', '能做什么', '能否执行'],
    },
    copy: {
      ru: {
        title: 'Два разных помощника',
        answer: 'На главной работает публичный помощник по знаниям платформы. Он не знает пользователей и Сделки. После входа доступен ролевой помощник Сделки, который получает только серверно разрешённый контекст текущего ЛК и остаётся read-only до отдельной приёмки командного контура.',
        facts: ['Публичный режим не использует данные ЛК.', 'Приватный режим проверяет доступ при каждом запросе.', 'Ни один помощник не выпускает деньги, не подписывает документы и не принимает решение по спору.'],
        maturity: 'Публичный режим работает на версионированной базе знаний; подключение внешней генеративной модели указывается отдельно.',
        suggestions: ['Что знает публичный помощник?', 'Что доступно после входа?', 'Почему действия запрещены?'],
      },
      en: {
        title: 'Two separate assistants',
        answer: 'The home page provides a public platform-knowledge assistant with no user or Deal data. After sign-in, the role-scoped Deal assistant receives only server-authorized workspace context and remains read-only until a separately accepted command layer exists.',
        facts: ['Public mode never uses workspace data.', 'Private mode rechecks access on every request.', 'Neither assistant releases money, signs documents or decides disputes.'],
        maturity: 'Public mode uses a versioned knowledge base; any external generative model connection is reported separately.',
        suggestions: ['What does the public assistant know?', 'What becomes available after sign-in?', 'Why are actions prohibited?'],
      },
      zh: {
        title: '两个独立助手',
        answer: '主页提供不含用户或交易数据的公共平台知识助手。登录后，角色范围内的交易助手只接收服务器授权的工作区上下文，并在命令层单独验收前保持只读。',
        facts: ['公共模式不使用工作区数据。', '私有模式每次请求都会重新检查访问权限。', '两个助手都不能释放资金、签署文件或裁决争议。'],
        maturity: '公共模式使用版本化知识库；任何外部生成模型连接都需单独说明。',
        suggestions: ['公共助手知道什么？', '登录后有哪些能力？', '为什么禁止执行动作？'],
      },
    },
    sources: [sharedSources.home, sharedSources.security],
  },
] as const;

function normalizeLocale(locale: string | null | undefined): PublicAssistantLocale {
  if (locale === 'en' || locale === 'zh') return locale;
  return 'ru';
}

function normalizeQuestion(question: string): string {
  return question.trim().toLocaleLowerCase('ru-RU').replace(/\s+/gu, ' ');
}

function scoreTopic(topic: TopicDefinition, question: string, locale: PublicAssistantLocale): number {
  return topic.keywords[locale].reduce((score, keyword) => score + (question.includes(keyword.toLocaleLowerCase('ru-RU')) ? Math.max(2, keyword.length) : 0), 0);
}

function topicById(id: PublicAssistantTopicId): TopicDefinition {
  return TOPICS.find((topic) => topic.id === id) ?? TOPICS[0];
}

export function publicAssistantCatalog(localeInput?: string | null) {
  const locale = normalizeLocale(localeInput);
  const overview = topicById('overview').copy[locale];
  return {
    knowledgeVersion: PUBLIC_ASSISTANT_KNOWLEDGE_VERSION,
    dataMode: 'public_knowledge' as const,
    actionAllowed: false as const,
    title: locale === 'en' ? 'Platform assistant' : locale === 'zh' ? '平台助手' : 'Помощник по платформе',
    description: overview.answer,
    starterPrompts: overview.suggestions,
    topics: TOPICS.map((topic) => ({ id: topic.id, title: topic.copy[locale].title })),
  };
}

export function answerPublicPlatformQuestion(questionInput: string, localeInput?: string | null): PublicAssistantAnswer {
  const locale = normalizeLocale(localeInput);
  const question = normalizeQuestion(questionInput);
  let selected = TOPICS[0];
  let bestScore = 0;

  for (const topic of TOPICS) {
    const score = scoreTopic(topic, question, locale);
    if (score > bestScore) {
      selected = topic;
      bestScore = score;
    }
  }

  const copy = selected.copy[locale];
  return {
    knowledgeVersion: PUBLIC_ASSISTANT_KNOWLEDGE_VERSION,
    topic: selected.id,
    title: copy.title,
    answer: copy.answer,
    facts: copy.facts,
    maturity: copy.maturity,
    confidence: bestScore > 0 ? 'high' : 'medium',
    actionAllowed: false,
    sources: selected.sources,
    suggestions: copy.suggestions,
  };
}
