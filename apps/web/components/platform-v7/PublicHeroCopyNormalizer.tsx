'use client';

import * as React from 'react';

type Lang = 'ru' | 'en' | 'zh';
type SourceText = Text & { __pcPublicSource?: string; __pcRoleSource?: string };

function currentLang(): Lang {
  const stored = window.localStorage.getItem('pc-v7-language');
  return stored === 'en' || stored === 'zh' ? stored : 'ru';
}

function setText(target: Element | null, value: string) {
  if (target && target.textContent !== value) target.textContent = value;
}

function setLastText(link: HTMLElement | null, value: string) {
  if (!link) return;
  const nodes = Array.from(link.childNodes);
  const textNode = nodes.reverse().find((node) => node.nodeType === Node.TEXT_NODE);
  if (textNode) {
    textNode.textContent = value;
    return;
  }
  link.append(document.createTextNode(value));
}

const copy = {
  ru: {
    brand: 'Прозрачная Цена',
    login: 'Войти',
    process: 'Порядок сделки',
    demoNav: 'Демонстрация',
    contactNav: 'Обращение',
    kicker: 'Единый вход в контур исполнения',
    h1: ['Главный риск сделки', 'начинается после', 'согласования цены'],
    lead: 'Прозрачная Цена — цифровой контур исполнения зерновой сделки: рейс, приёмка, качество, документы, деньги, спор и доказательства в одном процессе.',
    primary: 'Подключить организацию',
    demo: 'Демонстрационная сделка',
    contact: 'Направить обращение',
  },
  en: {
    brand: 'Transparent Price',
    login: 'Sign in',
    process: 'Deal flow',
    demoNav: 'Demo',
    contactNav: 'Request',
    kicker: 'Single entry to the execution circuit',
    h1: ['The main transaction risk', 'starts after', 'the price is agreed'],
    lead: 'Transparent Price is a digital execution circuit for a grain transaction: trip, acceptance, quality, documents, money, dispute, and evidence in one process.',
    primary: 'Connect an organisation',
    demo: 'Demo deal',
    contact: 'Send request',
  },
  zh: {
    brand: '透明价格',
    login: '登录',
    process: '交易流程',
    demoNav: '演示',
    contactNav: '请求',
    kicker: '进入执行闭环的统一入口',
    h1: ['交易的主要风险', '开始于', '价格确认之后'],
    lead: '透明价格是粮食交易的数字执行闭环：运输、验收、质量、文件、资金、争议和证据在一个流程中管理。',
    primary: '接入组织',
    demo: '演示交易',
    contact: '发送请求',
  },
} as const;

const publicText = {
  en: {
    'Что контролирует платформа': 'What the platform controls',
    'После согласования цены под контролем остаётся главное: рейс, приёмка, документы, качество и основание для оплаты.': 'After the price is agreed, the key items remain under control: trip, acceptance, documents, quality, and payment grounds.',
    'Деньги': 'Money',
    'Основание для расчёта видно до выпуска оплаты.': 'The settlement basis is visible before payment release.',
    'Документы': 'Documents',
    'СДИЗ, ЭДО, транспортные документы и акты связаны с событиями сделки.': 'SDIZ, EDI, transport documents, and acts are linked to deal events.',
    'Логистика': 'Logistics',
    'Рейс, водитель, маршрут и контрольные точки находятся в одном контуре.': 'Trip, driver, route, and checkpoints are in one circuit.',
    'Качество': 'Quality',
    'Приёмка и лабораторные показатели учитываются до окончательного расчёта.': 'Acceptance and laboratory indicators are considered before final settlement.',
    'Как проходит сделка': 'How the deal works',
    'На каждом этапе видно, что уже подтверждено, что требует действия и кто отвечает за следующий шаг.': 'At each stage it is clear what is confirmed, what requires action, and who owns the next step.',
    'Цена': 'Price',
    'Цена, объём, базис и допуски качества зафиксированы до рейса.': 'Price, volume, basis, and quality tolerances are fixed before the trip.',
    'Сделка': 'Deal',
    'Стороны, партия и условия исполнения сведены в единый контур.': 'Parties, lot, and execution terms are consolidated in one circuit.',
    'Рейс': 'Trip',
    'Маршрут, водитель, транспорт и контрольные точки назначены.': 'Route, driver, vehicle, and checkpoints are assigned.',
    'Приёмка': 'Acceptance',
    'Вес, факт поставки и расхождения фиксируются на элеваторе.': 'Weight, delivery fact, and discrepancies are recorded at the elevator.',
    'Расчёт': 'Settlement',
    'Оплата проводится после подтверждения оснований.': 'Payment is made after the grounds are confirmed.',
    'Спор': 'Dispute',
    'Разбор ведётся по зафиксированным данным.': 'Review is based on recorded data.',
    'Выберите свою роль в сделке': 'Select your role in the deal',
    'Сначала выберите роль участника сделки. После этого вход выполняется по логину, паролю и организации.': 'First select the participant role. Then sign in using login, password, and organisation.',
    'Подать заявку на роль': 'Apply for role',
  },
  zh: {
    'Что контролирует платформа': '平台控制什么',
    'После согласования цены под контролем остаётся главное: рейс, приёмка, документы, качество и основание для оплаты.': '价格确认后，关键事项仍在控制中：运输、验收、文件、质量和付款依据。',
    'Деньги': '资金',
    'Основание для расчёта видно до выпуска оплаты.': '付款释放前可以看到结算依据。',
    'Документы': '文件',
    'СДИЗ, ЭДО, транспортные документы и акты связаны с событиями сделки.': 'SDIZ、电子文件流、运输文件和验收文件与交易事件关联。',
    'Логистика': '物流',
    'Рейс, водитель, маршрут и контрольные точки находятся в одном контуре.': '运输、司机、路线和检查点都在一个闭环中。',
    'Качество': '质量',
    'Приёмка и лабораторные показатели учитываются до окончательного расчёта.': '最终结算前会考虑验收和实验室指标。',
    'Как проходит сделка': '交易流程',
    'На каждом этапе видно, что уже подтверждено, что требует действия и кто отвечает за следующий шаг.': '每个阶段都能看到已确认事项、待处理事项以及下一步负责人。',
    'Цена': '价格',
    'Цена, объём, базис и допуски качества зафиксированы до рейса.': '价格、数量、基准和质量容差在运输前固定。',
    'Сделка': '交易',
    'Стороны, партия и условия исполнения сведены в единый контур.': '各方、批次和执行条件被整合到一个闭环。',
    'Рейс': '运输',
    'Маршрут, водитель, транспорт и контрольные точки назначены.': '路线、司机、车辆和检查点已分配。',
    'Приёмка': '验收',
    'Вес, факт поставки и расхождения фиксируются на элеваторе.': '重量、交付事实和差异在粮仓记录。',
    'Расчёт': '结算',
    'Оплата проводится после подтверждения оснований.': '付款在依据确认后执行。',
    'Спор': '争议',
    'Разбор ведётся по зафиксированным данным.': '复盘基于已记录数据。',
    'Выберите свою роль в сделке': '选择你在交易中的角色',
    'Сначала выберите роль участника сделки. После этого вход выполняется по логину, паролю и организации.': '先选择交易参与方角色，然后使用登录名、密码和组织进入。',
    'Подать заявку на роль': '申请角色',
  },
} as const;

const roleText = {
  en: {
    'Кабинет покупателя · запрос → резерв → логистика': 'Buyer workspace · request → reserve → logistics',
    'Подтвердить резерв,': 'Confirm the reserve,',
    'чтобы сделка пошла в исполнение': 'so the deal can move into execution',
    'Покупатель видит не доску партий, а контур закупки: запрос, выбранную партию, ставку, резерв, удержание, документы и причину, почему сделка ещё не перешла к логистике.': 'The buyer sees not a lot board, but a procurement circuit: request, selected lot, bid, reserve, hold, documents, and the reason the deal has not moved to logistics yet.',
    'главный блокер': 'main blocker',
    'резерв ждёт подтверждение банка': 'reserve awaits bank confirmation',
    'логистика не стартует до статуса банка': 'logistics does not start before bank status',
    'Ключевые показатели закупки': 'Key procurement metrics',
    'Сделок в работе': 'Deals in progress',
    'Резерв · ждёт банк': 'Reserve · awaiting bank',
    'Под удержанием · вес': 'Held · weight',
    'Открытых споров': 'Open disputes',
    'готовность': 'readiness',
    'Уверенность к поставке': 'Delivery confidence',
    'Резерв ждёт банковского подтверждения': 'Reserve awaits bank confirmation',
    'Динамика готовности · сценарий': 'Readiness trend · scenario',
    'Деньги и резерв': 'Money and reserve',
    'Открыть сделку': 'Open deal',
    'Контур исполнения · Внешние подключения требуют договоров': 'Execution circuit · External connections require contracts',
    'операционный срез покупателя': 'buyer operating snapshot',
    'Что делать сейчас': 'What to do now',
    'Экран: платформа показывает причину, деньги и маршрут. Банковское подтверждение обязательно для передачи средств.': 'Screen: the platform shows the reason, money, and route. Bank confirmation is required before funds movement.',
    'Что произошло': 'What happened',
    'Что блокирует': 'What blocks it',
    'Деньги под риском': 'Money at risk',
    'Ответственный': 'Owner',
    'Следующий шаг': 'Next step',
    'Открыть маршрут': 'Open route',
    'Обзор закупки': 'Procurement overview',
    'заявка · партия · статус': 'request · lot · status',
    'Деньги, резерв и удержание': 'Money, reserve, and hold',
    'Документы и СДИЗ покупателя': 'Buyer documents and SDIZ',
    'Блокеры и путь разблокировки': 'Blockers and unblock path',
    'Рабочие действия и передача': 'Work actions and handoff',
    'Журнал событий': 'Event journal',
    'Закупки, партии и маршруты покупателя': 'Buyer procurement, lots, and routes',
    'Кредитное бюро · Скоринг контрагентов': 'Credit bureau · Counterparty scoring',
    'Избранные лоты и поставщики': 'Favourite lots and suppliers',
    'Открыть': 'Open',
    'Статус': 'Status',
    'Следующее действие': 'Next action',
    'ПРОДАВЕЦ · КАБИНЕТ СДЕЛКИ': 'SELLER · DEAL WORKSPACE',
    'Главный рабочий статус продавца': 'Seller main operating status',
    'Главный блокер': 'Main blocker',
    'остановлено · ждёт ЭТрН': 'stopped · awaiting E-TTN',
    'СДИЗ и ЭТрН не закрыты': 'SDIZ and E-TTN are not closed',
    'Закрыть документы, чтобы передать основание банку': 'Close documents to transfer the basis to the bank',
    'Резерв виден, но банк не получает основание для проверки выплаты.': 'The reserve is visible, but the bank does not receive the basis to review payout.',
    'На проверку банку': 'For bank review',
    'готовность денег; это ещё не выплата': 'money readiness; this is not a payout yet',
    'продавец': 'seller',
    'закрыть документы': 'close documents',
    'банковская проверка выплаты остановлена до подтверждения документного пакета': 'bank payout review is stopped until the document package is confirmed',
    'Выплаты по месяцу': 'Monthly payouts',
    'данные демо': 'demo data',
    'Кабинет продавца · сделка → документы → деньги': 'Seller workspace · deal → documents → money',
    'Закройте документы': 'Close the documents',
    'для банка': 'for the bank',
    'Первый экран показывает статус сделки, блокер, деньги под риском, ответственного и следующий безопасный шаг.': 'The first screen shows deal status, blocker, money at risk, owner, and the next safe step.',
    'что мешает выплате': 'what blocks payout',
    'к проверке банком сейчас 0 ₽': 'currently ₽0 for bank review',
    'Резерв · не выплата': 'Reserve · not payout',
    'К проверке банком': 'For bank review',
    'Подготовить документы': 'Prepare documents',
    'Партии и лоты': 'Lots and listings',
    'контроль первого экрана': 'first-screen control',
    'Что важно продавцу сейчас': 'What matters to the seller now',
    'Статус не говорит о готовой выплате. Сначала нужен закрытый пакет документов.': 'Status does not mean payout is ready. A closed document package is needed first.',
    'контур исполнения: партия, лот, резерв покупателя, СДИЗ, ЭТрН, приёмка': 'execution circuit: lot, listing, buyer reserve, SDIZ, E-TTN, acceptance',
    'сделка передаёт основание банку после закрытия всех документных условий.': 'the deal transfers the basis to the bank after all document conditions are closed.',
    'Блокер': 'Blocker',
    'Открыть сделку DL-9106': 'Open deal DL-9106',
    'Перейти к документам': 'Go to documents',
    'Состояние сделки продавца': 'Seller deal status',
    'партия · лот · блокер · следующий шаг': 'lot · listing · blocker · next step',
    'Документы для проверки': 'Documents for review',
    'СДИЗ · ЭТрН · акт · протокол': 'SDIZ · E-TTN · act · protocol',
    'Деньги и банковская проверка': 'Money and bank review',
    'Что мешает выплате': 'What blocks payout',
    'причина → действие → проверка': 'reason → action → review',
    'Чтобы передать сделку на проверку банком:': 'To send the deal for bank review:',
    'Закрыть СДИЗ в ФГИС «Зерно»': 'Close SDIZ in FGIS Grain',
    'Подписать ЭТрН': 'Sign E-TTN',
    'Отправить пакет документов в банк': 'Send document package to the bank',
    'исполнение: что продавец отправляет и ожидает': 'execution: what the seller sends and awaits',
    '3 последних события': 'last 3 events',
    'Партии, лоты и маршруты продавца': 'Seller lots, listings, and routes',
    'детали продаж': 'sales details',
    'рабочие маршруты продавца': 'seller work routes',
    'лоты продавца': 'seller listings',
    'Мои лоты — inline-редактирование': 'My listings — inline editing',
    'Динамика закупочных цен': 'Procurement price trend',
    'Калькулятор комиссии': 'Commission calculator',
    'Факторинг': 'Factoring',
    'Экспортный калькулятор': 'Export calculator',
    'ФТС · Таможенные декларации': 'FTS · Customs declarations',
    'Шаблоны документов · Договор / Акт / УПД / ЭТрН / СДИЗ': 'Document templates · Contract / Act / UPD / E-TTN / SDIZ',
    'ЭДО · Электронный документооборот': 'EDI · Electronic document flow',
  },
  zh: {
    'Кабинет покупателя · запрос → резерв → логистика': '买方工作区 · 请求 → 预留 → 物流',
    'Подтвердить резерв,': '确认预留资金，',
    'чтобы сделка пошла в исполнение': '使交易进入执行',
    'Покупатель видит не доску партий, а контур закупки: запрос, выбранную партию, ставку, резерв, удержание, документы и причину, почему сделка ещё не перешла к логистике.': '买方看到的不是批次看板，而是采购闭环：请求、选定批次、报价、预留、冻结、文件以及交易尚未进入物流的原因。',
    'главный блокер': '主要阻断项',
    'резерв ждёт подтверждение банка': '预留等待银行确认',
    'логистика не стартует до статуса банка': '银行状态确认前物流不启动',
    'Ключевые показатели закупки': '采购关键指标',
    'Сделок в работе': '进行中的交易',
    'Резерв · ждёт банк': '预留 · 等待银行',
    'Под удержанием · вес': '冻结 · 重量',
    'Открытых споров': '未结争议',
    'готовность': '准备度',
    'Уверенность к поставке': '交付信心',
    'Резерв ждёт банковского подтверждения': '预留等待银行确认',
    'Динамика готовности · сценарий': '准备度趋势 · 场景',
    'Деньги и резерв': '资金和预留',
    'Открыть сделку': '打开交易',
    'Контур исполнения · Внешние подключения требуют договоров': '执行闭环 · 外部连接需要合同',
    'операционный срез покупателя': '买方运营快照',
    'Что делать сейчас': '现在要做什么',
    'Экран: платформа показывает причину, деньги и маршрут. Банковское подтверждение обязательно для передачи средств.': '本屏显示原因、资金和路线。资金转移前必须有银行确认。',
    'Что произошло': '发生了什么',
    'Что блокирует': '阻断原因',
    'Деньги под риском': '风险资金',
    'Ответственный': '负责人',
    'Следующий шаг': '下一步',
    'Открыть маршрут': '打开路线',
    'Обзор закупки': '采购概览',
    'заявка · партия · статус': '请求 · 批次 · 状态',
    'Деньги, резерв и удержание': '资金、预留和冻结',
    'Документы и СДИЗ покупателя': '买方文件和SDIZ',
    'Блокеры и путь разблокировки': '阻断项和解锁路径',
    'Рабочие действия и передача': '工作动作和交接',
    'Журнал событий': '事件日志',
    'Закупки, партии и маршруты покупателя': '买方采购、批次和路线',
    'Кредитное бюро · Скоринг контрагентов': '征信机构 · 交易对手评分',
    'Избранные лоты и поставщики': '收藏批次和供应商',
    'Открыть': '打开',
    'Статус': '状态',
    'Следующее действие': '下一步动作',
    'ПРОДАВЕЦ · КАБИНЕТ СДЕЛКИ': '卖方 · 交易工作区',
    'Главный рабочий статус продавца': '卖方主要工作状态',
    'Главный блокер': '主要阻断项',
    'остановлено · ждёт ЭТрН': '已停止 · 等待E-TTN',
    'СДИЗ и ЭТрН не закрыты': 'SDIZ和E-TTN未关闭',
    'Закрыть документы, чтобы передать основание банку': '关闭文件以将依据提交给银行',
    'Резерв виден, но банк не получает основание для проверки выплаты.': '预留可见，但银行尚未收到审核付款的依据。',
    'На проверку банку': '提交银行审核',
    'готовность денег; это ещё не выплата': '资金准备状态；尚非付款',
    'продавец': '卖方',
    'закрыть документы': '关闭文件',
    'банковская проверка выплаты остановлена до подтверждения документного пакета': '文件包确认前，银行付款审核已停止',
    'Выплаты по месяцу': '月度付款',
    'данные демо': '演示数据',
    'Кабинет продавца · сделка → документы → деньги': '卖方工作区 · 交易 → 文件 → 资金',
    'Закройте документы': '关闭文件',
    'для банка': '用于银行',
    'Первый экран показывает статус сделки, блокер, деньги под риском, ответственного и следующий безопасный шаг.': '第一屏显示交易状态、阻断项、风险资金、负责人和下一步安全动作。',
    'что мешает выплате': '阻碍付款的事项',
    'к проверке банком сейчас 0 ₽': '当前提交银行审核为0卢布',
    'Резерв · не выплата': '预留 · 非付款',
    'К проверке банком': '提交银行审核',
    'Подготовить документы': '准备文件',
    'Партии и лоты': '批次和挂牌',
    'контроль первого экрана': '第一屏控制',
    'Что важно продавцу сейчас': '卖方现在需要关注什么',
    'Статус не говорит о готовой выплате. Сначала нужен закрытый пакет документов.': '状态不代表付款已准备好。首先需要关闭文件包。',
    'контур исполнения: партия, лот, резерв покупателя, СДИЗ, ЭТрН, приёмка': '执行闭环：批次、挂牌、买方预留、SDIZ、E-TTN、验收',
    'сделка передаёт основание банку после закрытия всех документных условий.': '所有文件条件关闭后，交易将依据提交给银行。',
    'Блокер': '阻断项',
    'Открыть сделку DL-9106': '打开交易DL-9106',
    'Перейти к документам': '转到文件',
    'Состояние сделки продавца': '卖方交易状态',
    'партия · лот · блокер · следующий шаг': '批次 · 挂牌 · 阻断项 · 下一步',
    'Документы для проверки': '审核文件',
    'СДИЗ · ЭТрН · акт · протокол': 'SDIZ · E-TTN · 单据 · 报告',
    'Деньги и банковская проверка': '资金和银行审核',
    'Что мешает выплате': '阻碍付款的事项',
    'причина → действие → проверка': '原因 → 动作 → 审核',
    'Чтобы передать сделку на проверку банком:': '要将交易提交银行审核：',
    'Закрыть СДИЗ в ФГИС «Зерно»': '在FGIS Grain中关闭SDIZ',
    'Подписать ЭТрН': '签署E-TTN',
    'Отправить пакет документов в банк': '将文件包发送给银行',
    'исполнение: что продавец отправляет и ожидает': '执行：卖方发送和等待的内容',
    '3 последних события': '最近3个事件',
    'Партии, лоты и маршруты продавца': '卖方批次、挂牌和路线',
    'детали продаж': '销售详情',
    'рабочие маршруты продавца': '卖方工作路线',
    'лоты продавца': '卖方挂牌',
    'Мои лоты — inline-редактирование': '我的挂牌 — 内联编辑',
    'Динамика закупочных цен': '采购价格趋势',
    'Калькулятор комиссии': '佣金计算器',
    'Факторинг': '保理',
    'Экспортный калькулятор': '出口计算器',
    'ФТС · Таможенные декларации': '联邦海关 · 报关单',
    'Шаблоны документов · Договор / Акт / УПД / ЭТрН / СДИЗ': '文件模板 · 合同 / 单据 / UPD / E-TTN / SDIZ',
    'ЭДО · Электронный документооборот': 'EDI · 电子文件流',
  },
} as const;

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeTextLayer(root: Element | null, selected: Lang, mapSet: typeof publicText | typeof roleText, sourceKey: '__pcPublicSource' | '__pcRoleSource') {
  if (!root) return;
  const map = selected === 'ru' ? null : mapSet[selected];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!normalize(node.nodeValue || '')) return NodeFilter.FILTER_REJECT;
      if (node.parentElement?.closest('.p7-translator-root,[data-p7-no-translate],script,style,noscript')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node = walker.nextNode() as SourceText | null;
  while (node) {
    const source = node[sourceKey] || node.nodeValue || '';
    node[sourceKey] = source;
    const next = map ? map[normalize(source) as keyof typeof map] : source;
    if (next && node.nodeValue !== next) node.nodeValue = next;
    node = walker.nextNode() as SourceText | null;
  }
}

function applyCopy() {
  const selected = currentLang();
  const c = copy[selected];
  document.documentElement.lang = selected === 'zh' ? 'zh-CN' : selected === 'en' ? 'en' : 'ru-RU';

  setText(document.querySelector('.pc-v7-public-entry .entry-brand strong'), c.brand);
  setLastText(document.querySelector<HTMLElement>('.pc-v7-public-entry .entry-login'), c.login);

  document.querySelectorAll<HTMLAnchorElement>('.pc-v7-public-entry .entry-nav a').forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (href === '#process') link.textContent = c.process;
    if (href === '/platform-v7/demo') link.textContent = c.demoNav;
    if (href === '/platform-v7/contact') link.textContent = c.contactNav;
  });

  setText(document.querySelector('.pc-v7-public-entry .entry-kicker'), c.kicker);
  document.querySelectorAll('.pc-v7-public-entry #entry-hero-title span').forEach((node, index) => setText(node, c.h1[index] || ''));
  setText(document.querySelector('.pc-v7-public-entry .entry-hero-copy p'), c.lead);
  setLastText(document.querySelector<HTMLElement>('.pc-v7-public-entry .entry-primary-cta'), c.primary);
  setLastText(document.querySelector<HTMLElement>('.pc-v7-public-entry .entry-secondary-cta'), c.demo);

  const contact = document.querySelector<HTMLAnchorElement>('.pc-v7-public-entry .entry-register-cta');
  if (contact) {
    contact.setAttribute('href', '/platform-v7/contact');
    setLastText(contact, c.contact);
  }

  normalizeTextLayer(document.querySelector('.pc-v7-public-entry'), selected, publicText, '__pcPublicSource');
  normalizeTextLayer(document.querySelector('.pc-shell-root-v4'), selected, roleText, '__pcRoleSource');
}

export function PublicHeroCopyNormalizer() {
  React.useEffect(() => {
    applyCopy();
    const timers = [80, 220, 600, 1200, 2400].map((delay) => window.setTimeout(applyCopy, delay));
    const interval = window.setInterval(applyCopy, 900);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
