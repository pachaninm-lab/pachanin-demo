import type {
  AuctionAuthorityInvariant,
  AuctionAuthorityRouteProps,
  AuctionAuthorityStep,
} from '@/components/transaction-ux/AuctionAuthorityRoute';

type Locale = 'ru' | 'en' | 'zh';
export type AuctionAuthorityRouteKey = 'overview' | 'import' | 'admission' | 'bids' | 'deal-basis';

export type AuctionAuthorityRouteCopy = Omit<AuctionAuthorityRouteProps, 'testId' | 'steps' | 'labels'> & {
  metadataTitle: string;
  metadataDescription: string;
  steps: AuctionAuthorityStep[];
  labels: AuctionAuthorityRouteProps['labels'];
};

const ROUTES: Array<{ key: AuctionAuthorityRouteKey; href: string }> = [
  { key: 'overview', href: '/platform-v7/auction' },
  { key: 'import', href: '/platform-v7/auction/import' },
  { key: 'admission', href: '/platform-v7/auction/admission' },
  { key: 'bids', href: '/platform-v7/auction/bids' },
  { key: 'deal-basis', href: '/platform-v7/auction/deal-basis' },
];

const BASE = {
  ru: {
    labels: {
      blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат',
      nextAction: 'Следующее безопасное действие', prioritySection: 'Главная задача аукциона', factsSection: 'Неизменяемые правила аукциона',
    },
    stepsHeading: 'Цепочка аукциона и перехода в Сделку',
    invariantsHeading: 'Системные инварианты',
    current: 'текущий этап', unavailable: 'нет серверного состояния',
    stepTitles: {
      overview: 'Контур аукциона', import: 'Импорт партии', admission: 'Допуск', bids: 'Ставки', 'deal-basis': 'Основание Сделки',
    },
    stepDetails: {
      overview: 'Выбор серверно зарегистрированного лота и контроль всей цепочки.',
      import: 'ФГИС/СДИЗ, владелец, масса, качество и документы из подтверждённого источника.',
      admission: 'Проверка лота, продавца, покупателей, полномочий и лимитов до торгов.',
      bids: 'Неизменяемый журнал допущенных ставок с конкурентным контролем.',
      'deal-basis': 'Серверная фиксация победителя и идемпотентное создание канонической Сделки.',
    },
  },
  en: {
    labels: {
      blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result',
      nextAction: 'Next safe action', prioritySection: 'Primary auction task', factsSection: 'Non-negotiable auction rules',
    },
    stepsHeading: 'Auction-to-Deal execution chain',
    invariantsHeading: 'System invariants',
    current: 'current phase', unavailable: 'no server state',
    stepTitles: {
      overview: 'Auction control', import: 'Lot import', admission: 'Admission', bids: 'Bids', 'deal-basis': 'Deal basis',
    },
    stepDetails: {
      overview: 'Select a server-registered lot and control the complete execution chain.',
      import: 'FGIS/SDIZ, owner, mass, quality and documents from a confirmed source.',
      admission: 'Validate lot, seller, buyers, authority and limits before bidding.',
      bids: 'Append-only admitted bids with concurrency control.',
      'deal-basis': 'Server-side winner lock and idempotent creation of the canonical Deal.',
    },
  },
  zh: {
    labels: {
      blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果',
      nextAction: '下一项安全操作', prioritySection: '主要竞价任务', factsSection: '不可绕过的竞价规则',
    },
    stepsHeading: '从竞价到交易的执行链',
    invariantsHeading: '系统不变量',
    current: '当前阶段', unavailable: '无服务器状态',
    stepTitles: {
      overview: '竞价控制', import: '批次导入', admission: '准入', bids: '报价', 'deal-basis': '交易依据',
    },
    stepDetails: {
      overview: '选择服务器登记的批次并控制完整执行链。',
      import: '来自已确认来源的监管批次、SDIZ、所有者、重量、质量和文件。',
      admission: '竞价前校验批次、卖方、买方、权限和限额。',
      bids: '带并发控制的只追加合格报价日志。',
      'deal-basis': '服务器锁定中标方，并幂等创建规范交易。',
    },
  },
} as const;

function buildSteps(locale: Locale, current: AuctionAuthorityRouteKey): AuctionAuthorityStep[] {
  const base = BASE[locale];
  return ROUTES.map((route) => ({
    href: route.href,
    title: base.stepTitles[route.key],
    detail: base.stepDetails[route.key],
    status: route.key === current ? base.current : base.unavailable,
    tone: route.key === current ? 'information' : 'neutral',
  }));
}

const COMMON_INVARIANTS: Record<Locale, AuctionAuthorityInvariant[]> = {
  ru: [
    { title: 'Клиент не определяет допуск', detail: 'Роль, организация, лот и право ставки проверяются сервером; URL, cookie и localStorage не являются authority.', tone: 'critical' },
    { title: 'Ставка не переписывается', detail: 'Принятая ставка фиксируется append-only событием с idempotency key, actor, временем и версией аукциона.', tone: 'information' },
    { title: 'Победитель фиксируется атомарно', detail: 'Закрытие окна ставок, проверка правил и winner lock выполняются одной серверной транзакцией с optimistic concurrency.', tone: 'warning' },
    { title: 'Победитель не создаёт деньги', detail: 'Результат торгов создаёт основание канонической Сделки. Резерв и движение денег остаются отдельным банковским контуром.', tone: 'information' },
  ],
  en: [
    { title: 'The client does not grant admission', detail: 'Role, organization, lot and bidding authority are verified by the server; URL, cookies and localStorage are not authority.', tone: 'critical' },
    { title: 'A bid is not rewritten', detail: 'An accepted bid is recorded as an append-only event with idempotency key, actor, timestamp and auction version.', tone: 'information' },
    { title: 'The winner is locked atomically', detail: 'Bidding close, rule validation and winner lock run in one server transaction with optimistic concurrency.', tone: 'warning' },
    { title: 'A winner does not create money', detail: 'The auction result creates the basis of a canonical Deal. Reserve and money movement remain a separate bank contour.', tone: 'information' },
  ],
  zh: [
    { title: '客户端不能授予准入', detail: '角色、组织、批次和报价权限由服务器验证；URL、cookie 和 localStorage 不是权威来源。', tone: 'critical' },
    { title: '报价不可被改写', detail: '已接受报价以只追加事件记录，并包含幂等键、操作者、时间和竞价版本。', tone: 'information' },
    { title: '中标方必须原子锁定', detail: '关闭报价窗口、校验规则和锁定中标方在一个带乐观并发控制的服务器事务中完成。', tone: 'warning' },
    { title: '中标方不会直接产生资金状态', detail: '竞价结果只形成规范交易的依据。资金预留和流转仍属于独立银行流程。', tone: 'information' },
  ],
};

const PHASES: Record<AuctionAuthorityRouteKey, Record<Locale, Omit<AuctionAuthorityRouteCopy, 'steps' | 'labels' | 'stepsHeading' | 'invariantsHeading'>>> = {
  overview: {
    ru: {
      metadataTitle: 'Аукцион', metadataDescription: 'Серверно управляемый путь от ФГИС-лота до канонической Сделки без локальных ставок и победителей.',
      eyebrow: 'Цена → допуск → ставки → победитель → Сделка',
      title: 'Аукцион не живёт отдельно от исполнения Сделки',
      description: 'Экран показывает правила и переходы, но не создаёт лот, ставку или победителя локально. Рабочий аукцион появляется только после ответа серверного контура и подтверждённого доступа участника.',
      statusLabel: 'серверный аукцион не выбран', statusTone: 'warning',
      priority: { title: 'Подтверди источник лота и организацию', description: 'До подтверждённого импорта нельзя рассчитывать допуск, принимать ставки, выбирать победителя или создавать Сделку.', blocker: 'нет server-issued auctionId и lot snapshot', owner: 'оператор + комплаенс', impact: 'торги и переход в Сделку закрыты', result: 'серверно зарегистрированный аукцион с audit trail' },
      facts: [
        { label: 'Источник лота', value: 'внешний контур + сервер', hint: 'локальная константа не заменяет ФГИС/СДИЗ' },
        { label: 'Допуск', value: 'server-side', hint: 'до открытия окна ставок' },
        { label: 'Журнал ставок', value: 'append-only', hint: 'с idempotency и concurrency control' },
        { label: 'Переход', value: 'winner lock → canonical Deal', hint: 'одна транзакция, один Deal ID' },
      ],
      boundary: 'Подключение ФГИС, реальный импорт лота и production auction API не считаются подтверждёнными без договоров, доступов и runtime evidence. UI не показывает вымышленные live-данные.',
      notice: { title: 'Почему здесь нет лота и лидирующей ставки', body: 'Ранее они были зашиты в клиентские файлы. Такой экран создавал ложную authority. Теперь отсутствие серверного аукциона отображается честно и блокирует дальнейшие состояния.', tone: 'warning' },
      primaryAction: { href: '/platform-v7/fgis-access', label: 'Подтвердить доступ ФГИС' }, secondaryAction: { href: '/platform-v7/deals', label: 'Открыть созданные Сделки' },
      invariants: COMMON_INVARIANTS.ru,
    },
    en: {
      metadataTitle: 'Auction', metadataDescription: 'Server-governed path from an FGIS lot to the canonical Deal without local bids or winners.',
      eyebrow: 'Price → admission → bids → winner → Deal',
      title: 'The auction is part of Deal execution',
      description: 'The screen exposes rules and transitions but does not create a lot, bid or winner locally. A working auction appears only after a server response and confirmed participant access.',
      statusLabel: 'no server auction selected', statusTone: 'warning',
      priority: { title: 'Confirm the lot source and organization', description: 'Admission, bids, winner selection and Deal creation remain blocked until the import is confirmed.', blocker: 'no server-issued auctionId or lot snapshot', owner: 'operator + compliance', impact: 'bidding and Deal transition are closed', result: 'server-registered auction with audit trail' },
      facts: [
        { label: 'Lot source', value: 'external system + server', hint: 'a local constant cannot replace FGIS/SDIZ' },
        { label: 'Admission', value: 'server-side', hint: 'before the bidding window opens' },
        { label: 'Bid journal', value: 'append-only', hint: 'with idempotency and concurrency control' },
        { label: 'Transition', value: 'winner lock → canonical Deal', hint: 'one transaction and one Deal ID' },
      ],
      boundary: 'FGIS connectivity, real lot import and a production auction API are not confirmed without contracts, credentials and runtime evidence. The UI does not show invented live data.',
      notice: { title: 'Why there is no lot or leading bid', body: 'Those values were previously hard-coded in client files and created false authority. The absence of a server auction is now explicit and blocks downstream states.', tone: 'warning' },
      primaryAction: { href: '/platform-v7/fgis-access', label: 'Confirm FGIS access' }, secondaryAction: { href: '/platform-v7/deals', label: 'Open created Deals' },
      invariants: COMMON_INVARIANTS.en,
    },
    zh: {
      metadataTitle: '竞价', metadataDescription: '从监管批次到规范交易的服务器管理路径，不使用本地报价或中标方。',
      eyebrow: '价格 → 准入 → 报价 → 中标方 → 交易',
      title: '竞价属于交易执行流程',
      description: '页面展示规则和状态转换，但不会在本地创建批次、报价或中标方。只有服务器返回结果并确认参与权限后，工作竞价才会出现。',
      statusLabel: '尚未选择服务器竞价', statusTone: 'warning',
      priority: { title: '确认批次来源和组织', description: '导入确认前，准入、报价、中标方选择和交易创建都保持阻塞。', blocker: '缺少服务器签发的 auctionId 和批次快照', owner: '运营方 + 合规', impact: '竞价和交易转换被关闭', result: '带审计记录的服务器登记竞价' },
      facts: [
        { label: '批次来源', value: '外部系统 + 服务器', hint: '本地常量不能替代监管批次/SDIZ' },
        { label: '准入', value: '服务器执行', hint: '必须在报价窗口开启前完成' },
        { label: '报价日志', value: '只追加', hint: '包含幂等和并发控制' },
        { label: '转换', value: '锁定中标方 → 规范交易', hint: '一个事务和一个交易 ID' },
      ],
      boundary: '没有合同、凭据和运行证据时，监管系统连接、真实批次导入和生产竞价 API 均不视为已确认。界面不会展示虚构的实时数据。',
      notice: { title: '为什么没有批次和领先报价', body: '这些值过去被硬编码在客户端文件中，形成了虚假权威。现在会明确显示服务器竞价缺失，并阻止后续状态。', tone: 'warning' },
      primaryAction: { href: '/platform-v7/fgis-access', label: '确认监管系统访问' }, secondaryAction: { href: '/platform-v7/deals', label: '打开已创建交易' },
      invariants: COMMON_INVARIANTS.zh,
    },
  },
  import: {
    ru: {
      metadataTitle: 'Импорт лота', metadataDescription: 'Требования к серверному импорту партии в аукцион без локального lot snapshot.',
      eyebrow: 'ФГИС/СДИЗ → серверный lot snapshot', title: 'Импорт — это проверяемый факт, а не карточка с данными',
      description: 'Партия допускается в аукционный контур только после серверной сверки источника, владельца, доступной массы, СДИЗ, качества и обязательных документов.',
      statusLabel: 'импорт не подтверждён', statusTone: 'warning',
      priority: { title: 'Получи server-issued lot snapshot', description: 'Локальный экран не может объявить партию импортированной или совпавшей с ФГИС.', blocker: 'нет ответа адаптера и связанного audit event', owner: 'оператор + комплаенс', impact: 'допуск и ставки заблокированы', result: 'immutable lot snapshot с source fingerprint' },
      facts: [
        { label: 'Организация', value: 'проверяется сервером', hint: 'ИНН и полномочия представителя' },
        { label: 'Партия', value: 'external lot ID', hint: 'без ручной подмены номера' },
        { label: 'Масса', value: 'integer kilograms', hint: 'доступная и уже заблокированная масса' },
        { label: 'Документы', value: 'source status', hint: 'СДИЗ, качество и обязательный комплект' },
      ],
      boundary: 'Экран не выполняет прямой импорт и не хранит копию ФГИС как источник истины. Он принимает только нормализованный серверный snapshot с provenance и временем получения.',
      notice: { title: 'Подтверждение отсутствует', body: 'До реального ответа внешнего адаптера нельзя показывать номер лота, владельца, массу, качество или СДИЗ как фактические данные.', tone: 'critical' },
      primaryAction: { href: '/platform-v7/fgis-access', label: 'Открыть доступ ФГИС' }, secondaryAction: { href: '/platform-v7/auction/admission', label: 'Правила допуска' },
      invariants: COMMON_INVARIANTS.ru,
    },
    en: {
      metadataTitle: 'Lot import', metadataDescription: 'Requirements for server-side lot import without a local lot snapshot.',
      eyebrow: 'FGIS/SDIZ → server lot snapshot', title: 'Import is a verifiable fact, not a data card',
      description: 'A lot enters the auction contour only after server validation of source, owner, available mass, SDIZ, quality and mandatory documents.',
      statusLabel: 'import is not confirmed', statusTone: 'warning',
      priority: { title: 'Obtain a server-issued lot snapshot', description: 'The local screen cannot declare a lot imported or matched with FGIS.', blocker: 'no adapter response and linked audit event', owner: 'operator + compliance', impact: 'admission and bids are blocked', result: 'immutable lot snapshot with source fingerprint' },
      facts: [
        { label: 'Organization', value: 'server-verified', hint: 'tax ID and representative authority' },
        { label: 'Lot', value: 'external lot ID', hint: 'without manual number substitution' },
        { label: 'Mass', value: 'integer kilograms', hint: 'available and already locked mass' },
        { label: 'Documents', value: 'source status', hint: 'SDIZ, quality and mandatory set' },
      ],
      boundary: 'The screen does not import directly and does not store an FGIS copy as authority. It accepts only a normalized server snapshot with provenance and retrieval time.',
      notice: { title: 'No confirmation is available', body: 'Until the external adapter responds, lot number, owner, mass, quality and SDIZ cannot be presented as facts.', tone: 'critical' },
      primaryAction: { href: '/platform-v7/fgis-access', label: 'Open FGIS access' }, secondaryAction: { href: '/platform-v7/auction/admission', label: 'Admission rules' },
      invariants: COMMON_INVARIANTS.en,
    },
    zh: {
      metadataTitle: '批次导入', metadataDescription: '不使用本地批次快照的服务器导入要求。',
      eyebrow: '监管批次/SDIZ → 服务器批次快照', title: '导入是可验证事实，不是数据卡片',
      description: '只有服务器完成来源、所有者、可用重量、SDIZ、质量和必备文件校验后，批次才能进入竞价流程。',
      statusLabel: '导入尚未确认', statusTone: 'warning',
      priority: { title: '获取服务器签发的批次快照', description: '本地页面不能宣称批次已导入或已与监管系统匹配。', blocker: '缺少适配器响应和关联审计事件', owner: '运营方 + 合规', impact: '准入和报价被阻塞', result: '带来源指纹的不可变批次快照' },
      facts: [
        { label: '组织', value: '服务器验证', hint: '税号和代表权限' },
        { label: '批次', value: '外部批次 ID', hint: '不得手工替换编号' },
        { label: '重量', value: '整数千克', hint: '可用重量和已锁定重量' },
        { label: '文件', value: '来源状态', hint: 'SDIZ、质量和必备文件集' },
      ],
      boundary: '页面不会直接执行导入，也不会把监管系统副本作为权威来源。它只接受带来源和获取时间的规范化服务器快照。',
      notice: { title: '尚无确认结果', body: '在外部适配器返回前，批次编号、所有者、重量、质量和 SDIZ 都不能作为事实展示。', tone: 'critical' },
      primaryAction: { href: '/platform-v7/fgis-access', label: '打开监管系统访问' }, secondaryAction: { href: '/platform-v7/auction/admission', label: '查看准入规则' },
      invariants: COMMON_INVARIANTS.zh,
    },
  },
  admission: {
    ru: {
      metadataTitle: 'Допуск к торгам', metadataDescription: 'Серверные правила допуска лота и покупателей до открытия ставок.',
      eyebrow: 'Импорт → проверки → решение о допуске', title: 'Цена не появляется раньше допуска',
      description: 'Лот, продавец и каждый покупатель проходят независимые серверные проверки. Неразрешённый review или block не может быть обойдён ссылкой на страницу ставок.',
      statusLabel: 'решение о допуске отсутствует', statusTone: 'warning',
      priority: { title: 'Закрой обязательные проверки на сервере', description: 'UI не повышает статус и не вычисляет admission из локального массива.', blocker: 'нет signed admission decision и версии аукциона', owner: 'комплаенс + оператор', impact: 'окно ставок остаётся закрытым', result: 'версионированное решение для лота и каждого покупателя' },
      facts: [
        { label: 'Лот', value: 'source match', hint: 'владелец, СДИЗ, масса и отсутствие двойной блокировки' },
        { label: 'Продавец', value: 'membership + authority', hint: 'право выставить конкретную партию' },
        { label: 'Покупатель', value: 'admission + limit', hint: 'право ставки и достаточный лимит' },
        { label: 'Решение', value: 'signed server fact', hint: 'с причиной, actor и auction version' },
      ],
      boundary: 'Переход на `/auction/bids` не открывает торги сам по себе. Endpoint ставок обязан повторно проверить admission и текущую версию аукциона.',
      notice: { title: 'Fail closed', body: 'Без server-issued admission decision список покупателей, лимиты и статус лота не отображаются как фактические.', tone: 'warning' },
      primaryAction: { href: '/platform-v7/auction/import', label: 'Проверить импорт' }, secondaryAction: { href: '/platform-v7/auction/bids', label: 'Правила ставок' },
      invariants: COMMON_INVARIANTS.ru,
    },
    en: {
      metadataTitle: 'Auction admission', metadataDescription: 'Server rules for lot and buyer admission before bids open.',
      eyebrow: 'Import → checks → admission decision', title: 'Price does not appear before admission',
      description: 'The lot, seller and every buyer pass independent server checks. An unresolved review or block cannot be bypassed by opening the bids URL.',
      statusLabel: 'no admission decision', statusTone: 'warning',
      priority: { title: 'Close mandatory checks on the server', description: 'The UI does not elevate status or calculate admission from a local array.', blocker: 'no signed admission decision or auction version', owner: 'compliance + operator', impact: 'the bidding window remains closed', result: 'versioned decision for the lot and every buyer' },
      facts: [
        { label: 'Lot', value: 'source match', hint: 'owner, SDIZ, mass and no double lock' },
        { label: 'Seller', value: 'membership + authority', hint: 'right to offer the specific lot' },
        { label: 'Buyer', value: 'admission + limit', hint: 'right to bid and sufficient limit' },
        { label: 'Decision', value: 'signed server fact', hint: 'with reason, actor and auction version' },
      ],
      boundary: 'Opening `/auction/bids` does not open bidding. The bid endpoint must re-check admission and the current auction version.',
      notice: { title: 'Fail closed', body: 'Without a server-issued admission decision, buyers, limits and lot status are not shown as facts.', tone: 'warning' },
      primaryAction: { href: '/platform-v7/auction/import', label: 'Review import' }, secondaryAction: { href: '/platform-v7/auction/bids', label: 'Bid rules' },
      invariants: COMMON_INVARIANTS.en,
    },
    zh: {
      metadataTitle: '竞价准入', metadataDescription: '报价开启前的批次和买方服务器准入规则。',
      eyebrow: '导入 → 检查 → 准入决定', title: '价格不能早于准入出现',
      description: '批次、卖方和每个买方都要经过独立服务器检查。未解决的复核或阻塞不能通过直接打开报价 URL 绕过。',
      statusLabel: '尚无准入决定', statusTone: 'warning',
      priority: { title: '在服务器关闭必备检查', description: 'UI 不会提升状态，也不会根据本地数组计算准入。', blocker: '缺少签名准入决定和竞价版本', owner: '合规 + 运营方', impact: '报价窗口保持关闭', result: '针对批次和每个买方的版本化决定' },
      facts: [
        { label: '批次', value: '来源匹配', hint: '所有者、SDIZ、重量以及无重复锁定' },
        { label: '卖方', value: '成员关系 + 权限', hint: '有权发布该具体批次' },
        { label: '买方', value: '准入 + 限额', hint: '有权报价且限额充足' },
        { label: '决定', value: '签名服务器事实', hint: '包含原因、操作者和竞价版本' },
      ],
      boundary: '打开 `/auction/bids` 本身不会开启报价。报价 endpoint 必须再次校验准入和当前竞价版本。',
      notice: { title: '默认拒绝', body: '没有服务器签发的准入决定时，不会把买方、限额和批次状态展示为事实。', tone: 'warning' },
      primaryAction: { href: '/platform-v7/auction/import', label: '检查导入' }, secondaryAction: { href: '/platform-v7/auction/bids', label: '查看报价规则' },
      invariants: COMMON_INVARIANTS.zh,
    },
  },
  bids: {
    ru: {
      metadataTitle: 'Ставки аукциона', metadataDescription: 'Append-only журнал ставок без локального лидера и вымышленного победителя.',
      eyebrow: 'Допуск → конкурентные ставки → закрытие окна', title: 'Лидер и победитель — разные серверные состояния',
      description: 'Пока сервер не вернул журнал конкретного аукциона, экран не показывает покупателей, цены, объёмы или лидера. Победитель появляется только после атомарного закрытия окна.',
      statusLabel: 'ставки не загружены с сервера', statusTone: 'warning',
      priority: { title: 'Выбери серверный аукцион с открытым окном', description: 'Локальный массив не может изображать журнал торгов или назначать `isWinner`.', blocker: 'нет auctionId, version и append-only bid stream', owner: 'аукционный сервис', impact: 'ставки и лидер не отображаются', result: 'проверяемый журнал + атомарный winner lock' },
      facts: [
        { label: 'Размещение', value: 'идемпотентная команда', hint: 'один ключ — один эффект' },
        { label: 'Конкуренция', value: 'optimistic concurrency', hint: 'stale version отклоняется' },
        { label: 'Отмена', value: 'нет удаления задним числом', hint: 'коррекция — отдельное аудируемое событие по правилам' },
        { label: 'Победитель', value: 'только после close', hint: 'детерминированное правило и атомарная фиксация' },
      ],
      boundary: 'UI не принимает ставки, не сортирует победителя и не меняет auction version. Эти операции принадлежат серверному командному сервису и append-only журналу.',
      notice: { title: 'Журнал пуст не потому, что ставок нет', body: 'Серверный аукцион не выбран. Показывать фиктивных покупателей и цены в этом состоянии запрещено.', tone: 'critical' },
      primaryAction: { href: '/platform-v7/auction/admission', label: 'Проверить допуск' }, secondaryAction: { href: '/platform-v7/auction/deal-basis', label: 'Условия перехода в Сделку' },
      invariants: COMMON_INVARIANTS.ru,
    },
    en: {
      metadataTitle: 'Auction bids', metadataDescription: 'Append-only bid journal without a local leader or invented winner.',
      eyebrow: 'Admission → competitive bids → window close', title: 'Leader and winner are different server states',
      description: 'Until the server returns the journal of a specific auction, the screen shows no buyers, prices, volumes or leader. A winner exists only after atomic close.',
      statusLabel: 'bids are not loaded from the server', statusTone: 'warning',
      priority: { title: 'Select a server auction with an open window', description: 'A local array cannot represent the trading journal or assign `isWinner`.', blocker: 'no auctionId, version or append-only bid stream', owner: 'auction service', impact: 'bids and leader are hidden', result: 'verifiable journal + atomic winner lock' },
      facts: [
        { label: 'Placement', value: 'idempotent command', hint: 'one key produces one effect' },
        { label: 'Concurrency', value: 'optimistic concurrency', hint: 'a stale version is rejected' },
        { label: 'Cancellation', value: 'no retroactive deletion', hint: 'a correction is a separate audited event under the rules' },
        { label: 'Winner', value: 'only after close', hint: 'deterministic rule and atomic lock' },
      ],
      boundary: 'The UI does not accept bids, rank a winner or change auction version. Those operations belong to the server command service and append-only journal.',
      notice: { title: 'The journal is not empty because there are no bids', body: 'No server auction is selected. Showing fictional buyers and prices in this state is prohibited.', tone: 'critical' },
      primaryAction: { href: '/platform-v7/auction/admission', label: 'Review admission' }, secondaryAction: { href: '/platform-v7/auction/deal-basis', label: 'Deal-transition conditions' },
      invariants: COMMON_INVARIANTS.en,
    },
    zh: {
      metadataTitle: '竞价报价', metadataDescription: '不使用本地领先者或虚构中标方的只追加报价日志。',
      eyebrow: '准入 → 竞争报价 → 关闭窗口', title: '领先者和中标方是不同服务器状态',
      description: '在服务器返回具体竞价日志前，页面不会显示买方、价格、数量或领先者。只有原子关闭窗口后，中标方才存在。',
      statusLabel: '尚未从服务器加载报价', statusTone: 'warning',
      priority: { title: '选择报价窗口已开启的服务器竞价', description: '本地数组不能代表交易日志，也不能设置 `isWinner`。', blocker: '缺少 auctionId、version 和只追加报价流', owner: '竞价服务', impact: '报价和领先者不显示', result: '可验证日志 + 原子中标锁定' },
      facts: [
        { label: '提交', value: '幂等命令', hint: '一个键只产生一个效果' },
        { label: '并发', value: '乐观并发控制', hint: '过期版本会被拒绝' },
        { label: '取消', value: '不得追溯删除', hint: '更正必须按规则作为独立审计事件' },
        { label: '中标方', value: '仅在关闭后产生', hint: '确定性规则和原子锁定' },
      ],
      boundary: 'UI 不接受报价、不排序中标方，也不改变竞价版本。这些操作属于服务器命令服务和只追加日志。',
      notice: { title: '日志为空不代表没有报价', body: '尚未选择服务器竞价。在此状态展示虚构买方和价格是被禁止的。', tone: 'critical' },
      primaryAction: { href: '/platform-v7/auction/admission', label: '检查准入' }, secondaryAction: { href: '/platform-v7/auction/deal-basis', label: '查看交易转换条件' },
      invariants: COMMON_INVARIANTS.zh,
    },
  },
  'deal-basis': {
    ru: {
      metadataTitle: 'Основание Сделки', metadataDescription: 'Атомарный переход зафиксированного победителя в каноническую Сделку без локального Deal ID.',
      eyebrow: 'Winner lock → canonical Deal transaction', title: 'Основание не равно созданной Сделке',
      description: 'После закрытия торгов сервер повторно проверяет лот, допуск, победившую ставку, цену и объём. Каноническая Сделка создаётся идемпотентно одной транзакцией и только затем открывается логистика.',
      statusLabel: 'winner lock и Deal отсутствуют', statusTone: 'warning',
      priority: { title: 'Дождись атомарного создания Сделки', description: 'UI не формирует Deal ID и не переводит локальную ставку в исполнение.', blocker: 'нет server-locked winner и create-deal receipt', owner: 'аукционный сервис + Deal command service', impact: 'логистика, документы и деньги не запускаются', result: 'одна каноническая Сделка с audit/outbox evidence' },
      facts: [
        { label: 'Winner lock', value: 'server transaction', hint: 'lot + bid + price + volume + version' },
        { label: 'Deal create', value: 'идемпотентно', hint: 'повтор не создаёт вторую Сделку' },
        { label: 'Audit/outbox', value: 'атомарно', hint: 'вместе с результатом перехода' },
        { label: 'Следующий экран', value: '/deals/{dealId}/execution', hint: 'только по server-issued Deal ID' },
      ],
      boundary: 'Переход победителя в Сделку не является client-side redirect. Сначала backend фиксирует winner lock и создаёт Deal, затем возвращает receipt и разрешённый URL. Без receipt логистика и деньги остаются закрыты.',
      notice: { title: 'Основание не готово', body: 'Нет серверно зафиксированного победителя и созданной канонической Сделки. Ранее локальный bridge подставлял вымышленные lot, bid и Deal ID; он удалён.', tone: 'critical' },
      primaryAction: { href: '/platform-v7/auction/bids', label: 'Вернуться к правилам ставок' }, secondaryAction: { href: '/platform-v7/deals', label: 'Открыть серверные Сделки' },
      invariants: COMMON_INVARIANTS.ru,
    },
    en: {
      metadataTitle: 'Deal basis', metadataDescription: 'Atomic transition from a locked winner to the canonical Deal without a local Deal ID.',
      eyebrow: 'Winner lock → canonical Deal transaction', title: 'A basis is not a created Deal',
      description: 'After bidding closes, the server re-validates lot, admission, winning bid, price and volume. The canonical Deal is created idempotently in one transaction; logistics opens only afterwards.',
      statusLabel: 'no winner lock or Deal', statusTone: 'warning',
      priority: { title: 'Wait for atomic Deal creation', description: 'The UI does not construct a Deal ID or move a local bid into execution.', blocker: 'no server-locked winner or create-deal receipt', owner: 'auction service + Deal command service', impact: 'logistics, documents and money remain closed', result: 'one canonical Deal with audit/outbox evidence' },
      facts: [
        { label: 'Winner lock', value: 'server transaction', hint: 'lot + bid + price + volume + version' },
        { label: 'Deal create', value: 'idempotent', hint: 'a retry cannot create a second Deal' },
        { label: 'Audit/outbox', value: 'atomic', hint: 'committed with the transition result' },
        { label: 'Next screen', value: '/deals/{dealId}/execution', hint: 'only with a server-issued Deal ID' },
      ],
      boundary: 'Winner-to-Deal transition is not a client-side redirect. The backend first locks the winner and creates the Deal, then returns a receipt and authorized URL. Without the receipt, logistics and money remain closed.',
      notice: { title: 'The basis is not ready', body: 'There is no server-locked winner or canonical Deal. The former local bridge inserted fictional lot, bid and Deal IDs; it has been removed.', tone: 'critical' },
      primaryAction: { href: '/platform-v7/auction/bids', label: 'Return to bid rules' }, secondaryAction: { href: '/platform-v7/deals', label: 'Open server Deals' },
      invariants: COMMON_INVARIANTS.en,
    },
    zh: {
      metadataTitle: '交易依据', metadataDescription: '从锁定中标方到规范交易的原子转换，不使用本地交易 ID。',
      eyebrow: '锁定中标方 → 规范交易事务', title: '交易依据不等于已创建交易',
      description: '报价关闭后，服务器会再次校验批次、准入、中标报价、价格和数量。规范交易在一个事务中幂等创建，之后才允许启动物流。',
      statusLabel: '尚无中标锁定或交易', statusTone: 'warning',
      priority: { title: '等待服务器原子创建交易', description: 'UI 不会构造交易 ID，也不会把本地报价转入执行。', blocker: '缺少服务器锁定的中标方和创建交易回执', owner: '竞价服务 + 交易命令服务', impact: '物流、文件和资金保持关闭', result: '一笔带审计/outbox 证据的规范交易' },
      facts: [
        { label: '中标锁定', value: '服务器事务', hint: '批次 + 报价 + 价格 + 数量 + 版本' },
        { label: '创建交易', value: '幂等', hint: '重试不会创建第二笔交易' },
        { label: '审计/outbox', value: '原子提交', hint: '与转换结果一起提交' },
        { label: '下一页面', value: '/deals/{dealId}/execution', hint: '只能使用服务器签发的交易 ID' },
      ],
      boundary: '从中标方到交易的转换不是客户端跳转。Backend 必须先锁定中标方并创建交易，再返回回执和授权 URL。没有回执时，物流和资金保持关闭。',
      notice: { title: '交易依据尚未就绪', body: '当前没有服务器锁定的中标方或规范交易。过去的本地 bridge 会填入虚构批次、报价和交易 ID；该逻辑已删除。', tone: 'critical' },
      primaryAction: { href: '/platform-v7/auction/bids', label: '返回报价规则' }, secondaryAction: { href: '/platform-v7/deals', label: '打开服务器交易' },
      invariants: COMMON_INVARIANTS.zh,
    },
  },
};

export function normalizeAuctionLocale(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

export function getAuctionAuthorityRouteCopy(route: AuctionAuthorityRouteKey, locale: Locale): AuctionAuthorityRouteCopy {
  const base = BASE[locale];
  const phase = PHASES[route][locale];
  return {
    ...phase,
    labels: base.labels,
    stepsHeading: base.stepsHeading,
    invariantsHeading: base.invariantsHeading,
    steps: buildSteps(locale, route),
  };
}
