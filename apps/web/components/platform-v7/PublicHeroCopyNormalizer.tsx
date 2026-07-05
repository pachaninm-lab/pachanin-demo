'use client';

import * as React from 'react';

type Lang = 'ru' | 'en' | 'zh';
type Dict = Record<string, string>;
type Dicts = Record<'en' | 'zh', Dict>;
type SourceText = Text & { __p7SourceText?: string; __pcCopySource?: string };

const LANGUAGE_KEY = 'pc-v7-language';
const SCOPES = ['.pc-v7-public-entry', '.pc-v7-login-single', '.p7-contact-page', '.pc-shell-root-v4', '.seller-cockpit'] as const;

const HOME = {
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

const COMMON_EN: Dict = {
  'Прозрачная Цена': 'Transparent Price',
  'Войти': 'Sign in',
  'Регистрация': 'Registration',
  'Выход': 'Exit',
  'Назад': 'Back',
  'Справка': 'Help',
  'Открыть': 'Open',
  'Раскрыть': 'Expand',
  'раскрыть': 'expand',
  'Статус': 'Status',
  'Следующее действие': 'Next action',
  'Ответственный': 'Owner',
  'Источник': 'Source',
  'Сумма влияния': 'Impact amount',
  'Сумма': 'Amount',
  'Владелец': 'Owner',
  'Культура': 'Crop',
  'Объём, т': 'Volume, t',
  'Деньги': 'Money',
  'Документы': 'Documents',
  'Логистика': 'Logistics',
  'Качество': 'Quality',
  'Сделка': 'Deal',
  'Рейс': 'Trip',
  'Приёмка': 'Acceptance',
  'Расчёт': 'Settlement',
  'Спор': 'Dispute',
  'Блокер': 'Blocker',
  'Оператор': 'Operator',
  'Покупатель': 'Buyer',
  'Продавец': 'Seller',
  'Водитель': 'Driver',
  'Элеватор': 'Elevator',
  'Лаборатория': 'Laboratory',
  'Сюрвейер': 'Surveyor',
  'Банк': 'Bank',
  'Комплаенс': 'Compliance',
  'Арбитр': 'Arbitrator',
  'Руководитель': 'Executive',
  'Главный риск сделки': 'The main transaction risk',
  'начинается после': 'starts after',
  'согласования цены': 'the price is agreed',
  'Подключить организацию': 'Connect an organisation',
  'Демонстрационная сделка': 'Demo deal',
  'Направить обращение': 'Send request',
  'Что контролирует платформа': 'What the platform controls',
  'Как проходит сделка': 'How the deal works',
  'Выберите свою роль в сделке': 'Select your role in the deal',
  'Подать заявку на роль': 'Apply for role',
  'Логин': 'Login',
  'Пароль': 'Password',
  'Организация': 'Organisation',
  'Зарегистрироваться': 'Register',
  'Войти в кабинет': 'Sign in to workspace',
  'Войти как оператор': 'Sign in as operator',
  'Войти как покупатель': 'Sign in as buyer',
  'Войти как продавец': 'Sign in as seller',
  'Войти как логистика': 'Sign in as logistics',
  'Войти как водитель': 'Sign in as driver',
  'Войти как элеватор': 'Sign in as elevator',
  'Войти как лаборатория': 'Sign in as laboratory',
  'Войти как сюрвейер': 'Sign in as surveyor',
  'Войти как банк': 'Sign in as bank',
  'Войти как комплаенс': 'Sign in as compliance',
  'Войти как арбитр': 'Sign in as arbitrator',
  'Войти как руководитель': 'Sign in as executive',
};

const COMMON_ZH: Dict = {
  'Прозрачная Цена': '透明价格',
  'Войти': '登录',
  'Регистрация': '注册',
  'Выход': '退出',
  'Назад': '返回',
  'Справка': '帮助',
  'Открыть': '打开',
  'Раскрыть': '展开',
  'раскрыть': '展开',
  'Статус': '状态',
  'Следующее действие': '下一步动作',
  'Ответственный': '负责人',
  'Источник': '来源',
  'Сумма влияния': '影响金额',
  'Сумма': '金额',
  'Владелец': '所有者',
  'Культура': '作物',
  'Объём, т': '数量，吨',
  'Деньги': '资金',
  'Документы': '文件',
  'Логистика': '物流',
  'Качество': '质量',
  'Сделка': '交易',
  'Рейс': '运输',
  'Приёмка': '验收',
  'Расчёт': '结算',
  'Спор': '争议',
  'Блокер': '阻断项',
  'Оператор': '运营方',
  'Покупатель': '买方',
  'Продавец': '卖方',
  'Водитель': '司机',
  'Элеватор': '粮仓',
  'Лаборатория': '实验室',
  'Сюрвейер': '检验员',
  'Банк': '银行',
  'Комплаенс': '合规',
  'Арбитр': '仲裁员',
  'Руководитель': '管理层',
  'Главный риск сделки': '交易的主要风险',
  'начинается после': '开始于',
  'согласования цены': '价格确认之后',
  'Подключить организацию': '接入组织',
  'Демонстрационная сделка': '演示交易',
  'Направить обращение': '发送请求',
  'Что контролирует платформа': '平台控制什么',
  'Как проходит сделка': '交易流程',
  'Выберите свою роль в сделке': '选择你在交易中的角色',
  'Подать заявку на роль': '申请角色',
  'Логин': '登录名',
  'Пароль': '密码',
  'Организация': '组织',
  'Зарегистрироваться': '注册',
  'Войти в кабинет': '进入工作区',
  'Войти как оператор': '以运营方身份登录',
  'Войти как покупатель': '以买方身份登录',
  'Войти как продавец': '以卖方身份登录',
  'Войти как логистика': '以物流身份登录',
  'Войти как водитель': '以司机身份登录',
  'Войти как элеватор': '以粮仓身份登录',
  'Войти как лаборатория': '以实验室身份登录',
  'Войти как сюрвейер': '以检验员身份登录',
  'Войти как банк': '以银行身份登录',
  'Войти как комплаенс': '以合规身份登录',
  'Войти как арбитр': '以仲裁员身份登录',
  'Войти как руководитель': '以管理层身份登录',
};

const PUBLIC_EN: Dict = {
  'Контур исполнения после цены': 'Execution after price agreement',
  'Сделка не заканчивается на согласованной цене': 'A deal does not end at the agreed price',
  'Главный риск начинается дальше: рейс, приёмка, качество, документы, расчёт, спор и доказательства должны быть связаны в один проверяемый процесс.': 'The main risk starts next: trip, acceptance, quality, documents, settlement, dispute, and evidence must be connected in one verifiable process.',
  'Видит место остановки': 'Shows where the deal stopped',
  'Показывает, где сделка требует действия: рейс, вес, качество, документ, расчёт или спор.': 'Shows where the deal needs action: trip, weight, quality, document, settlement, or dispute.',
  'Фиксирует следующий шаг': 'Records the next step',
  'Связывает задачу с ролью участника: продавец, покупатель, логистика, элеватор, лаборатория, банк или арбитр.': 'Links the task to the participant role: seller, buyer, logistics, elevator, laboratory, bank, or arbitrator.',
  'Собирает основание': 'Builds the basis',
  'Факты исполнения, документы и статусы складываются в проверяемую базу для расчёта и разбора расхождений.': 'Execution facts, documents, and statuses form a verifiable basis for settlement and discrepancy review.',
  'После согласования цены под контролем остаётся главное: рейс, приёмка, документы, качество и основание для оплаты.': 'After the price is agreed, the key items remain under control: trip, acceptance, documents, quality, and payment grounds.',
  'Основание для расчёта видно до выпуска оплаты.': 'The settlement basis is visible before payment release.',
  'СДИЗ, ЭДО, транспортные документы и акты связаны с событиями сделки.': 'SDIZ, EDI, transport documents, and acts are linked to deal events.',
  'Рейс, водитель, маршрут и контрольные точки находятся в одном контуре.': 'Trip, driver, route, and checkpoints are in one circuit.',
  'Приёмка и лабораторные показатели учитываются до окончательного расчёта.': 'Acceptance and laboratory indicators are considered before final settlement.',
  'На каждом этапе видно, что уже подтверждено, что требует действия и кто отвечает за следующий шаг.': 'At each stage it is clear what is confirmed, what requires action, and who owns the next step.',
  'Цена, объём, базис и допуски качества зафиксированы до рейса.': 'Price, volume, basis, and quality tolerances are fixed before the trip.',
  'Стороны, партия и условия исполнения сведены в единый контур.': 'Parties, lot, and execution terms are consolidated in one circuit.',
  'Маршрут, водитель, транспорт и контрольные точки назначены.': 'Route, driver, vehicle, and checkpoints are assigned.',
  'Вес, факт поставки и расхождения фиксируются на элеваторе.': 'Weight, delivery fact, and discrepancies are recorded at the elevator.',
  'Документы сверяются с событиями исполнения.': 'Documents are reconciled with execution events.',
  'Оплата проводится после подтверждения оснований.': 'Payment is made after the grounds are confirmed.',
  'Разбор ведётся по зафиксированным данным.': 'Review is based on recorded data.',
  'Сделки, блокеры, SLA и контрольные действия.': 'Deals, blockers, SLA, and control actions.',
  'Поставка, качество, документы и риски оплаты.': 'Delivery, quality, documents, and payment risks.',
  'Партия, рейс, приёмка и основание для оплаты.': 'Lot, trip, acceptance, and payment basis.',
  'Рейсы, водители, движение и отклонения по маршруту.': 'Trips, drivers, movement, and route deviations.',
  'Маршрут, точки рейса, фото и офлайн-доказательства.': 'Route, trip checkpoints, photos, and offline evidence.',
  'Приёмка, хранение, вес и статусы партии.': 'Acceptance, storage, weight, and lot statuses.',
  'Анализы, показатели качества и связь с приёмкой.': 'Tests, quality indicators, and link to acceptance.',
  'Осмотр, фиксация фактов и независимый доказательный слой.': 'Inspection, fact recording, and independent evidence layer.',
  'Основания для финансирования и расчётов по подтверждённым событиям.': 'Grounds for financing and settlement based on confirmed events.',
  'Доступы, действия участников и контроль правил.': 'Access, participant actions, and rule control.',
  'Спор, расхождения, пакет доказательств и решение по фактам.': 'Dispute, discrepancies, evidence package, and fact-based decision.',
  'Расчёты, блокеры, роли, споры и ход исполнения.': 'Settlements, blockers, roles, disputes, and execution progress.',
  'Статус без догадок': 'Status without guessing',
  'Единая картина по этапам и участникам.': 'One view across stages and participants.',
  'Юридически значимый след': 'Legally relevant trail',
  'События и документы связаны с исполнением сделки.': 'Events and documents are tied to deal execution.',
  'Контроль документов': 'Document control',
  'Комплектность, версии, сроки и ответственные под контролем.': 'Completeness, versions, deadlines, and owners are under control.',
  'Основа для расчётов': 'Settlement basis',
  'Расчёт опирается на подтверждённые события.': 'Settlement relies on confirmed events.',
  'Демонстрационная сделка': 'Demo deal',
  'ЕДИНЫЙ ВХОД': 'SINGLE ENTRY',
  'Единый вход': 'Single entry',
  'Вход в рабочую платформу': 'Sign in to the working platform',
  'Введите корпоративные данные для доступа к рабочему контуру.': 'Enter corporate credentials to access the working circuit.',
  'Выберите один рабочий кабинет': 'Select one workspace',
};

const PUBLIC_ZH: Dict = {
  'Контур исполнения после цены': '价格确认后的执行闭环',
  'Сделка не заканчивается на согласованной цене': '交易不会在价格确认后结束',
  'Главный риск начинается дальше: рейс, приёмка, качество, документы, расчёт, спор и доказательства должны быть связаны в один проверяемый процесс.': '主要风险从下一步开始：运输、验收、质量、文件、结算、争议和证据必须连接成一个可核验流程。',
  'Видит место остановки': '显示交易停止位置',
  'Показывает, где сделка требует действия: рейс, вес, качество, документ, расчёт или спор.': '显示交易需要处理的位置：运输、重量、质量、文件、结算或争议。',
  'Фиксирует следующий шаг': '记录下一步',
  'Связывает задачу с ролью участника: продавец, покупатель, логистика, элеватор, лаборатория, банк или арбитр.': '将任务与参与方角色关联：卖方、买方、物流、粮仓、实验室、银行或仲裁员。',
  'Собирает основание': '形成依据',
  'Факты исполнения, документы и статусы складываются в проверяемую базу для расчёта и разбора расхождений.': '执行事实、文件和状态形成可核验依据，用于结算和差异复盘。',
  'После согласования цены под контролем остаётся главное: рейс, приёмка, документы, качество и основание для оплаты.': '价格确认后，关键事项仍在控制中：运输、验收、文件、质量和付款依据。',
  'Основание для расчёта видно до выпуска оплаты.': '付款释放前可以看到结算依据。',
  'СДИЗ, ЭДО, транспортные документы и акты связаны с событиями сделки.': 'SDIZ、电子文件流、运输文件和验收文件与交易事件关联。',
  'Рейс, водитель, маршрут и контрольные точки находятся в одном контуре.': '运输、司机、路线和检查点都在一个闭环中。',
  'Приёмка и лабораторные показатели учитываются до окончательного расчёта.': '最终结算前会考虑验收和实验室指标。',
  'На каждом этапе видно, что уже подтверждено, что требует действия и кто отвечает за следующий шаг.': '每个阶段都能看到已确认事项、待处理事项以及下一步负责人。',
  'Цена, объём, базис и допуски качества зафиксированы до рейса.': '价格、数量、基准和质量容差在运输前固定。',
  'Стороны, партия и условия исполнения сведены в единый контур.': '各方、批次和执行条件被整合到一个闭环。',
  'Маршрут, водитель, транспорт и контрольные точки назначены.': '路线、司机、车辆和检查点已分配。',
  'Вес, факт поставки и расхождения фиксируются на элеваторе.': '重量、交付事实和差异在粮仓记录。',
  'Документы сверяются с событиями исполнения.': '文件与执行事件核对。',
  'Оплата проводится после подтверждения оснований.': '付款在依据确认后执行。',
  'Разбор ведётся по зафиксированным данным.': '复盘基于已记录数据。',
  'Сделки, блокеры, SLA и контрольные действия.': '交易、阻断项、SLA和控制动作。',
  'Поставка, качество, документы и риски оплаты.': '交付、质量、文件和付款风险。',
  'Партия, рейс, приёмка и основание для оплаты.': '批次、运输、验收和付款依据。',
  'Рейсы, водители, движение и отклонения по маршруту.': '运输、司机、移动和路线偏差。',
  'Маршрут, точки рейса, фото и офлайн-доказательства.': '路线、运输节点、照片和离线证据。',
  'Приёмка, хранение, вес и статусы партии.': '验收、仓储、重量和批次状态。',
  'Анализы, показатели качества и связь с приёмкой.': '检测、质量指标和验收关联。',
  'Осмотр, фиксация фактов и независимый доказательный слой.': '检查、事实记录和独立证据层。',
  'Основания для финансирования и расчётов по подтверждённым событиям.': '基于已确认事件的融资和结算依据。',
  'Доступы, действия участников и контроль правил.': '访问权限、参与方动作和规则控制。',
  'Спор, расхождения, пакет доказательств и решение по фактам.': '争议、差异、证据包和基于事实的决定。',
  'Расчёты, блокеры, роли, споры и ход исполнения.': '结算、阻断项、角色、争议和执行进度。',
  'Статус без догадок': '无猜测状态',
  'Единая картина по этапам и участникам.': '按阶段和参与方统一视图。',
  'Юридически значимый след': '具有法律意义的记录',
  'События и документы связаны с исполнением сделки.': '事件和文件与交易执行关联。',
  'Контроль документов': '文件控制',
  'Комплектность, версии, сроки и ответственные под контролем.': '完整性、版本、期限和负责人都在控制中。',
  'Основа для расчётов': '结算依据',
  'Расчёт опирается на подтверждённые события.': '结算基于已确认事件。',
  'Демонстрационная сделка': '演示交易',
  'ЕДИНЫЙ ВХОД': '统一入口',
  'Единый вход': '统一入口',
  'Вход в рабочую платформу': '登录工作平台',
  'Введите корпоративные данные для доступа к рабочему контуру.': '输入企业凭证以访问工作闭环。',
  'Выберите один рабочий кабинет': '选择一个工作区',
};

const BUYER_EN: Dict = {
  'Мой резерв': 'My reserve',
  'Под удержанием': 'Held',
  'ожидает банковского подтверждения': 'awaits bank confirmation',
  'спорная часть по весу и качеству': 'disputed part by weight and quality',
  'Денежный резерв': 'Money reserve',
  'ожидает банк': 'awaiting bank',
  'КОРОТКИЙ ФАКТ': 'SHORT FACT',
  'Сделка не переходит к логистике до банковского статуса': 'The deal does not move to logistics before bank status',
  'БЛОКЕР / ПРИЧИНА': 'BLOCKER / REASON',
  'Резерв ещё не подтверждён банком': 'The reserve has not yet been confirmed by the bank',
  'ОСНОВАНИЕ': 'BASIS',
  'Платформа показывает запрос и причину ожидания; банк подтверждает статус': 'The platform shows the request and waiting reason; the bank confirms the status',
  'СЛЕДУЮЩИЙ ШАГ': 'NEXT STEP',
  'Запросить подтверждение резерва': 'Request reserve confirmation',
  'Деньги, резерв и удержание': 'Money, reserve, and hold',
  'Документы и СДИЗ покупателя': 'Buyer documents and SDIZ',
  'Блокеры и путь разблокировки': 'Blockers and unblock path',
  'Рабочие действия и передача': 'Work actions and handoff',
  'Журнал событий': 'Event journal',
  'Подтвердить резерв,': 'Confirm the reserve,',
  'чтобы сделка пошла в исполнение': 'so the deal can move into execution',
  'Покупатель видит не доску партий, а контур закупки: запрос, выбранную партию, ставку, резерв, удержание, документы и причину, почему сделка ещё не перешла к логистике.': 'The buyer sees not a lot board, but a procurement circuit: request, selected lot, bid, reserve, hold, documents, and the reason the deal has not moved to logistics yet.',
  'главный блокер': 'main blocker',
  'резерв ждёт подтверждение банка': 'reserve awaits bank confirmation',
  'логистика не стартует до статуса банка': 'logistics does not start before bank status',
};

const BUYER_ZH: Dict = {
  'Мой резерв': '我的预留',
  'Под удержанием': '冻结中',
  'ожидает банковского подтверждения': '等待银行确认',
  'спорная часть по весу и качеству': '重量和质量争议部分',
  'Денежный резерв': '资金预留',
  'ожидает банк': '等待银行',
  'КОРОТКИЙ ФАКТ': '简要事实',
  'Сделка не переходит к логистике до банковского статуса': '银行状态确认前，交易不进入物流',
  'БЛОКЕР / ПРИЧИНА': '阻断项 / 原因',
  'Резерв ещё не подтверждён банком': '预留尚未由银行确认',
  'ОСНОВАНИЕ': '依据',
  'Платформа показывает запрос и причину ожидания; банк подтверждает статус': '平台显示请求和等待原因；银行确认状态',
  'СЛЕДУЮЩИЙ ШАГ': '下一步',
  'Запросить подтверждение резерва': '请求确认预留',
  'Деньги, резерв и удержание': '资金、预留和冻结',
  'Документы и СДИЗ покупателя': '买方文件和SDIZ',
  'Блокеры и путь разблокировки': '阻断项和解锁路径',
  'Рабочие действия и передача': '工作动作和交接',
  'Журнал событий': '事件日志',
  'Подтвердить резерв,': '确认预留资金，',
  'чтобы сделка пошла в исполнение': '使交易进入执行',
  'Покупатель видит не доску партий, а контур закупки: запрос, выбранную партию, ставку, резерв, удержание, документы и причину, почему сделка ещё не перешла к логистике.': '买方看到的不是批次看板，而是采购闭环：请求、选定批次、报价、预留、冻结、文件以及交易尚未进入物流的原因。',
  'главный блокер': '主要阻断项',
  'резерв ждёт подтверждение банка': '预留等待银行确认',
  'логистика не стартует до статуса банка': '银行状态确认前物流不启动',
};

const ROLE_EN: Dict = {
  'Кабинет логистики': 'Logistics workspace',
  'Кабинет водителя': 'Driver workspace',
  'Кабинет элеватора': 'Elevator workspace',
  'Кабинет лаборатории': 'Laboratory workspace',
  'Кабинет сюрвейера': 'Surveyor workspace',
  'Кабинет арбитра': 'Arbitrator workspace',
  'Кабинет комплаенса': 'Compliance workspace',
  'Кабинет банка': 'Bank workspace',
  'Кабинет продавца · сделка → документы → деньги': 'Seller workspace · deal → documents → money',
  'Рабочий стол оператора': 'Operator workspace',
  'Руководитель · только просмотр': 'Executive · read-only',
};

const ROLE_ZH: Dict = {
  'Кабинет логистики': '物流工作区',
  'Кабинет водителя': '司机工作区',
  'Кабинет элеватора': '粮仓工作区',
  'Кабинет лаборатории': '实验室工作区',
  'Кабинет сюрвейера': '检验员工作区',
  'Кабинет арбитра': '仲裁员工作区',
  'Кабинет комплаенса': '合规工作区',
  'Кабинет банка': '银行工作区',
  'Кабинет продавца · сделка → документы → деньги': '卖方工作区 · 交易 → 文件 → 资金',
  'Рабочий стол оператора': '运营方工作台',
  'Руководитель · только просмотр': '管理层 · 只读',
};

const DICTS: Dicts = {
  en: { ...COMMON_EN, ...PUBLIC_EN, ...BUYER_EN, ...ROLE_EN },
  zh: { ...COMMON_ZH, ...PUBLIC_ZH, ...BUYER_ZH, ...ROLE_ZH },
};

const SAFE_FRAGMENT_KEYS = new Set([
  'Главный риск сделки',
  'начинается после',
  'согласования цены',
  'Подключить организацию',
  'Демонстрационная сделка',
  'Направить обращение',
  'Под удержанием',
  'Следующее действие',
  'Ответственный',
  'Главный блокер',
  'Деньги под риском',
]);

function currentLang(): Lang {
  const stored = window.localStorage.getItem(LANGUAGE_KEY);
  return stored === 'en' || stored === 'zh' ? stored : 'ru';
}

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function allowFragment(source: string, from: string) {
  if (SAFE_FRAGMENT_KEYS.has(from)) return true;
  if (normalize(source) === from) return true;
  if (from.length < 8) return false;
  return /[\s·→/—,:;«»()]/.test(from);
}

function translate(source: string, lang: Lang) {
  if (lang === 'ru') return source;
  const raw = source || '';
  const key = normalize(raw);
  if (!key) return raw;
  const dict = DICTS[lang];
  const exact = dict[key];
  if (exact) return exact;

  let next = raw;
  for (const [from, to] of Object.entries(dict).sort((a, b) => b[0].length - a[0].length)) {
    if (!allowFragment(raw, from) || !next.includes(from)) continue;
    next = next.split(from).join(to);
  }
  return next;
}

function setText(target: Element | null, value: string) {
  if (target && target.textContent !== value) target.textContent = value;
}

function setLastText(link: HTMLElement | null, value: string) {
  if (!link) return;
  const node = Array.from(link.childNodes).reverse().find((item) => item.nodeType === Node.TEXT_NODE);
  if (node) {
    node.textContent = value;
    return;
  }
  link.append(document.createTextNode(value));
}

function applyHome(lang: Lang) {
  const home = HOME[lang];
  setText(document.querySelector('.pc-v7-public-entry .entry-brand strong'), home.brand);
  setLastText(document.querySelector<HTMLElement>('.pc-v7-public-entry .entry-login'), home.login);
  document.querySelectorAll<HTMLAnchorElement>('.pc-v7-public-entry .entry-nav a').forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (href === '#process') link.textContent = home.process;
    if (href === '/platform-v7/demo') link.textContent = home.demoNav;
    if (href === '/platform-v7/contact') link.textContent = home.contactNav;
  });
  setText(document.querySelector('.pc-v7-public-entry .entry-kicker'), home.kicker);
  document.querySelectorAll('.pc-v7-public-entry #entry-hero-title span').forEach((node, index) => setText(node, home.h1[index] || ''));
  setText(document.querySelector('.pc-v7-public-entry .entry-hero-copy p'), home.lead);
  setLastText(document.querySelector<HTMLElement>('.pc-v7-public-entry .entry-primary-cta'), home.primary);
  setLastText(document.querySelector<HTMLElement>('.pc-v7-public-entry .entry-secondary-cta'), home.demo);
  const contact = document.querySelector<HTMLAnchorElement>('.pc-v7-public-entry .entry-register-cta');
  if (contact) {
    contact.setAttribute('href', '/platform-v7/contact');
    setLastText(contact, home.contact);
  }
}

function skipElement(element: HTMLElement) {
  return Boolean(element.closest('script,style,noscript,svg,canvas,textarea,input,select,option,code,pre,.p7-translator-root,[data-p7-no-translate],[contenteditable="true"]'));
}

function applyText(root: ParentNode, lang: Lang) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const element = node.parentElement;
      if (!element || skipElement(element)) return NodeFilter.FILTER_REJECT;
      if (!normalize(node.nodeValue || '')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node = walker.nextNode() as SourceText | null;
  while (node) {
    const source = node.__p7SourceText || node.__pcCopySource || node.nodeValue || '';
    node.__pcCopySource = source;
    const next = translate(source, lang);
    if (node.nodeValue !== next) node.nodeValue = next;
    node = walker.nextNode() as SourceText | null;
  }
}

function applyAll() {
  const lang = currentLang();
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang === 'en' ? 'en' : 'ru-RU';
  document.documentElement.dataset.p7Language = lang;
  applyHome(lang);
  SCOPES.forEach((selector) => document.querySelectorAll(selector).forEach((root) => applyText(root, lang)));
}

export function PublicHeroCopyNormalizer() {
  React.useEffect(() => {
    applyAll();
    const schedule = () => window.requestAnimationFrame(applyAll);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const timers = [80, 220, 600, 1200, 2400].map((delay) => window.setTimeout(applyAll, delay));
    const interval = window.setInterval(applyAll, 900);
    window.addEventListener('resize', applyAll);
    return () => {
      observer.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearInterval(interval);
      window.removeEventListener('resize', applyAll);
    };
  }, []);
  return null;
}
