export type HomeLocale = 'ru' | 'en' | 'zh';
export type ClaimStatus = 'FACT' | 'ARCHITECTURE' | 'PLANNED' | 'PARTNER_DEPENDENT';

export type HomeClaim = {
  status: ClaimStatus;
  text: string;
};

const ru = {
  nav: { how: 'Как работает', participants: 'Участникам', tai: 'TAI', integrations: 'Интеграции', status: 'Статус', login: 'Войти', connect: 'Подключить организацию' },
  hero: {
    kicker: 'Цифровая инфраструктура исполнения сделок в растениеводстве',
    title: 'Сделка под контролем — от условий и товара до расчёта и закрытия',
    lead: 'Одна цифровая карточка связывает участников, торги, логистику, приёмку, лабораторию, документы, государственные контуры, финансирование, деньги, споры и доказательства.',
    primary: 'Посмотреть сделку в работе',
    secondary: 'Подключить организацию',
    tertiary: 'Как работает TAI',
  },
  category: {
    eyebrow: 'Категория продукта',
    title: 'Не площадка объявлений. Контур исполнения сделки.',
    text: 'Платформа не заканчивается после выбора цены или контрагента. Она сопровождает фактическое исполнение до расчёта, закрытия и сохранения доказательств.',
    marketplace: 'Marketplace',
    marketplaceText: 'Помогает найти предложение и договориться.',
    platform: 'Прозрачная Цена',
    platformText: 'Связывает условия, исполнение, качество, документы, деньги и спор вокруг одной Сделки.',
  },
  lifecycle: {
    eyebrow: 'Единый контур',
    title: 'Путь Сделки',
    lead: 'Каждый этап имеет ответственного, основание завершения, возможный блокер и денежное последствие.',
    phases: ['Условия', 'Допуск', 'Торги', 'Сделка', 'Договор', 'Финансирование', 'Перевозка', 'Приёмка', 'Качество', 'Документы', 'Госсистемы', 'Деньги', 'Спор', 'Доказательства', 'Закрытие', 'Аналитика'],
  },
  scenario: {
    eyebrow: 'Интерактивный сценарий работы платформы',
    title: 'Разберите исполнение сделки за 90 секунд',
    lead: 'Партия подсолнечника прибыла на приёмку. Показатель качества отличается от допуска, документ не подписан, выплата зарезервирована.',
    status: 'Расчёт заблокирован',
    blocker: 'Влажность выше допуска на 0,8 п.п. и отсутствует подпись под актом расхождений.',
    owner: 'Ответственные: лаборатория и покупатель',
    money: 'Средства зарезервированы. Release запрещён до подтверждения основания.',
    next: 'Следующий шаг: подписать акт и выбрать правило перерасчёта.',
    evidence: 'Основания: протокол лаборатории, акт приёмки, версия спецификации.',
  },
  tai: {
    eyebrow: 'TAI внутри Сделки',
    title: 'Интеллектуальный операционный слой, а не отдельный чат',
    text: 'TAI анализирует состояние Сделки, документы и события, объясняет блокировки, показывает риск и помогает подготовить следующий шаг.',
    modes: ['Публичный — объясняет платформу без закрытых данных', 'Ролевой — работает только в пределах прав пользователя и организации', 'Операционный — анализирует Сделку и готовит действия для подтверждения человеком'],
    boundaries: 'TAI не меняет роль или организацию, не подписывает документы, не выпускает деньги, не выбирает победителя и не принимает решение по спору.',
    source: 'Источник: протокол лаборатории № L-204',
    freshness: 'Актуальность: 22.07.2026',
    confidence: 'Уверенность: высокая',
    action: 'Подготовлен проект акта расхождений — требуется подтверждение пользователя.',
  },
  crops: {
    eyebrow: 'Охват растениеводства',
    title: 'Единая архитектура сделки для разных товарных категорий',
    lead: 'Категории различаются качеством, хранением, логистикой, документами, приёмкой и формулой цены. Статус покрытия показывается отдельно.',
    groups: [
      ['Зерновые', 'Реализовано'],
      ['Масличные и бобовые', 'В реализации'],
      ['Технические культуры', 'Архитектурно предусмотрено'],
      ['Овощи и картофель', 'Требует отраслевой настройки'],
      ['Плодово-ягодная продукция', 'Требует отраслевой настройки'],
      ['Семена и посадочный материал', 'Требует партнёрской интеграции'],
    ],
  },
  money: {
    eyebrow: 'Финансовое исполнение',
    title: 'Деньги связаны с подтверждёнными событиями Сделки',
    chain: 'Резервирование → исполнение → подтверждение → release → сверка → закрытие',
    exception: 'При отклонении: блокировка → спор → доказательства → решение → перерасчёт',
  },
  integrations: {
    eyebrow: 'Интеграционный контур',
    title: 'Платформа оркестрирует процессы и не подменяет внешние системы',
    items: [
      ['ФГИС «Зерно» / СДИЗ', 'Техническая готовность'],
      ['ЭДО / КЭП', 'Предусмотрено'],
      ['ГИС ЭПД', 'Партнёрская зависимость'],
      ['Банковские API', 'Согласование'],
      ['ERP / CRM', 'Архитектурно предусмотрено'],
      ['Лаборатории / телематика', 'Не подтверждено'],
    ],
  },
  federal: {
    eyebrow: 'Федеральный класс',
    title: 'Спроектировано как инфраструктура, а не локальный сервис',
    pillars: ['Единая событийная модель Сделки', 'Server-authoritative RBAC', 'Tenant isolation', 'Непрерывный audit trail', 'Горизонтальное масштабирование', 'Интеграционная архитектура'],
  },
  maturity: {
    eyebrow: 'Честный статус зрелости',
    title: 'Архитектурная готовность не подменяет production-доказательства',
    cards: [
      ['Работает', 'Только функции, подтверждённые кодом и эксплуатационными evidence.'],
      ['Контролируемое подключение', 'Технически реализовано, но массовая эксплуатация ещё не подтверждена.'],
      ['Зависит от партнёра', 'Банк, государственная система, ЭДО или иной внешний контур.'],
      ['Целевая архитектура', 'Спроектировано, но не принято как production-функция.'],
    ],
  },
  participants: {
    eyebrow: 'Ценность для участников',
    title: 'Не список функций, а управляемый результат',
    cards: [
      ['Продавец', 'Видит, что требуется для оплаты и кто задерживает переход Сделки.'],
      ['Покупатель', 'Получает связанные подтверждения товара, количества, качества и приёмки.'],
      ['Логистика', 'Работает с рейсом, документами и отклонениями в одном контуре.'],
      ['Хранение', 'Фиксирует приёмку, вес, размещение и основания передачи товара.'],
      ['Лаборатория', 'Передаёт результат с привязкой к партии, пробе и документу.'],
      ['Банк / compliance', 'Получает события, денежные основания и воспроизводимый audit trail.'],
    ],
  },
  final: { title: 'Подключите организацию к единому контуру Сделки', lead: 'Начните с управляемого сценария, ролей, статусов интеграций и критериев приёмки.', primary: 'Подключить организацию', secondary: 'Посмотреть сделку в работе' },
  footer: 'Цифровая инфраструктура исполнения сделок в растениеводстве. Статусы функций и интеграций публикуются без завышения зрелости.',
} as const;

const en = {
  ...ru,
  nav: { how: 'How it works', participants: 'Participants', tai: 'TAI', integrations: 'Integrations', status: 'Status', login: 'Sign in', connect: 'Connect organisation' },
  hero: { kicker: 'Digital infrastructure for crop transaction execution', title: 'The deal under control — from product terms to settlement and closure', lead: 'One digital deal record connects participants, trading, logistics, acceptance, laboratory results, documents, public systems, financing, money, disputes and evidence.', primary: 'View the deal in action', secondary: 'Connect organisation', tertiary: 'How TAI works' },
  category: { eyebrow: 'Product category', title: 'Not a listings marketplace. A deal execution contour.', text: 'The platform does not stop after price or counterparty selection. It manages execution through settlement, closure and retained evidence.', marketplace: 'Marketplace', marketplaceText: 'Helps find an offer and reach an agreement.', platform: 'Transparent Price', platformText: 'Connects terms, execution, quality, documents, money and disputes around one Deal.' },
  lifecycle: { eyebrow: 'Single contour', title: 'Deal lifecycle', lead: 'Every stage has an owner, completion evidence, possible blocker and financial consequence.', phases: ['Terms','Admission','Trading','Deal','Contract','Financing','Transport','Acceptance','Quality','Documents','Public systems','Money','Dispute','Evidence','Closure','Analytics'] },
  scenario: { eyebrow: 'Interactive platform scenario', title: 'Understand execution in 90 seconds', lead: 'A sunflower lot reached acceptance. Quality differs from tolerance, one document is unsigned, and the payout is reserved.', status: 'Settlement blocked', blocker: 'Moisture is 0.8 pp above tolerance and the discrepancy act is unsigned.', owner: 'Owners: laboratory and buyer', money: 'Funds are reserved. Release is prohibited until the basis is confirmed.', next: 'Next action: sign the act and select the price adjustment rule.', evidence: 'Evidence: laboratory protocol, acceptance act, specification version.' },
  final: { title: 'Connect your organisation to the Deal execution contour', lead: 'Start with a controlled scenario, roles, integration statuses and acceptance criteria.', primary: 'Connect organisation', secondary: 'View the deal in action' },
  footer: 'Digital infrastructure for crop transaction execution. Function and integration status is published without overstating maturity.',
} as const;

const zh = {
  ...ru,
  nav: { how: '工作方式', participants: '参与方', tai: 'TAI', integrations: '集成', status: '状态', login: '登录', connect: '接入机构' },
  hero: { kicker: '种植业交易执行数字基础设施', title: '从商品条件到结算与关闭，交易全程受控', lead: '一张数字交易卡连接参与方、交易、物流、验收、实验室、文件、政府系统、融资、资金、争议与证据。', primary: '查看交易运行', secondary: '接入机构', tertiary: 'TAI 如何工作' },
  category: { eyebrow: '产品类别', title: '不是信息发布平台，而是交易执行链路。', text: '平台不会在价格或交易对手确定后结束，而是持续管理执行、结算、关闭和证据留存。', marketplace: '信息平台', marketplaceText: '帮助寻找报价并达成意向。', platform: '透明价格', platformText: '围绕同一笔交易连接条件、执行、质量、文件、资金和争议。' },
  lifecycle: { eyebrow: '统一链路', title: '交易路径', lead: '每个阶段都有责任人、完成依据、潜在阻塞项和资金影响。', phases: ['条件','准入','交易','成交','合同','融资','运输','验收','质量','文件','政府系统','资金','争议','证据','关闭','分析'] },
  scenario: { eyebrow: '平台交互场景', title: '90 秒了解交易执行', lead: '一批葵花籽到达验收环节。质量指标偏离允许范围，一份文件未签署，付款已预留。', status: '结算已阻塞', blocker: '水分高于允许值 0.8 个百分点，差异确认单尚未签署。', owner: '责任方：实验室与买方', money: '资金已预留。在依据确认前禁止释放。', next: '下一步：签署差异确认单并选择价格调整规则。', evidence: '依据：实验室报告、验收单、规格版本。' },
  final: { title: '将机构接入统一交易执行链路', lead: '从受控场景、角色、集成状态和验收标准开始。', primary: '接入机构', secondary: '查看交易运行' },
  footer: '种植业交易执行数字基础设施。功能与集成状态按真实成熟度公开。',
} as const;

export const PLATFORM_V7_HOME_COPY = { ru, en, zh } as const;

export function getPlatformV7HomeCopy(locale: string) {
  return PLATFORM_V7_HOME_COPY[locale === 'en' || locale === 'zh' ? locale : 'ru'];
}
