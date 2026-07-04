'use client';

import * as React from 'react';

type Lang = 'ru' | 'en' | 'zh';
type Dict = Record<string, string>;
type Dicts = Record<'en' | 'zh', Dict>;
type SourceText = Text & { __p7SourceText?: string; __pcCopySource?: string };

const LANGUAGE_KEY = 'pc-v7-language';
const SCOPES = ['.pc-v7-public-entry', '.pc-v7-login-single', '.p7-contact-page', '.pc-shell-root-v4', '.seller-cockpit'] as const;

const HOME = {
  ru: { brand: 'Прозрачная Цена', login: 'Войти', process: 'Порядок сделки', demoNav: 'Демонстрация', contactNav: 'Обращение', kicker: 'Единый вход в контур исполнения', h1: ['Главный риск сделки', 'начинается после', 'согласования цены'], lead: 'Прозрачная Цена — цифровой контур исполнения зерновой сделки: рейс, приёмка, качество, документы, деньги, спор и доказательства в одном процессе.', primary: 'Подключить организацию', demo: 'Демонстрационная сделка', contact: 'Направить обращение' },
  en: { brand: 'Transparent Price', login: 'Sign in', process: 'Deal flow', demoNav: 'Demo', contactNav: 'Request', kicker: 'Single entry to the execution circuit', h1: ['The main transaction risk', 'starts after', 'the price is agreed'], lead: 'Transparent Price is a digital execution circuit for a grain transaction: trip, acceptance, quality, documents, money, dispute, and evidence in one process.', primary: 'Connect an organisation', demo: 'Demo deal', contact: 'Send request' },
  zh: { brand: '透明价格', login: '登录', process: '交易流程', demoNav: '演示', contactNav: '请求', kicker: '进入执行闭环的统一入口', h1: ['交易的主要风险', '开始于', '价格确认之后'], lead: '透明价格是粮食交易的数字执行闭环：运输、验收、质量、文件、资金、争议和证据在一个流程中管理。', primary: '接入组织', demo: '演示交易', contact: '发送请求' },
} as const;

const DICTS: Dicts = {
  en: {
    'Прозрачная Цена': 'Transparent Price', 'Войти': 'Sign in', 'Регистрация': 'Registration', 'Выход': 'Exit', 'Назад': 'Back', 'Справка': 'Help', 'Открыть': 'Open', 'Раскрыть': 'Expand', 'раскрыть': 'expand',
    'Статус': 'Status', 'Следующее действие': 'Next action', 'Ответственный': 'Owner', 'Источник': 'Source', 'Сумма влияния': 'Impact amount', 'Сумма': 'Amount', 'Владелец': 'Owner', 'Культура': 'Crop', 'Объём, т': 'Volume, t',
    'Деньги': 'Money', 'Документы': 'Documents', 'Логистика': 'Logistics', 'Качество': 'Quality', 'Сделка': 'Deal', 'Рейс': 'Trip', 'Приёмка': 'Acceptance', 'Расчёт': 'Settlement', 'Спор': 'Dispute', 'Блокер': 'Blocker',
    'Оператор': 'Operator', 'Покупатель': 'Buyer', 'Продавец': 'Seller', 'Водитель': 'Driver', 'Элеватор': 'Elevator', 'Лаборатория': 'Laboratory', 'Сюрвейер': 'Surveyor', 'Банк': 'Bank', 'Комплаенс': 'Compliance', 'Арбитр': 'Arbitrator', 'Руководитель': 'Executive',
    'Главный риск сделки': 'The main transaction risk', 'начинается после': 'starts after', 'согласования цены': 'the price is agreed', 'Подключить организацию': 'Connect an organisation', 'Демонстрационная сделка': 'Demo deal', 'Направить обращение': 'Send request', 'Что контролирует платформа': 'What the platform controls', 'Как проходит сделка': 'How the deal works', 'Выберите свою роль в сделке': 'Select your role in the deal', 'Подать заявку на роль': 'Apply for role',
    'Главный блокер': 'Main blocker', 'Сделок в работе': 'Deals in progress', 'Открытых споров': 'Open disputes', 'Деньги под риском': 'Money at risk', 'Журнал событий': 'Event journal', 'Рабочие действия и передача': 'Work actions and handoff', 'Деньги и банковская проверка': 'Money and bank review', 'Документы для проверки': 'Documents for review', 'Что мешает выплате': 'What blocks payout',
    'Калькулятор комиссии': 'Commission calculator', 'Факторинг': 'Factoring', 'Экспортный калькулятор': 'Export calculator', 'ФТС · Таможенные декларации': 'FTS · Customs declarations', 'ЭДО · Электронный документооборот': 'EDI · Electronic document flow',

    'Кабинет покупателя · запрос → резерв → логистика': 'Buyer workspace · request → reserve → logistics', 'Подтвердить резерв,': 'Confirm the reserve,', 'чтобы сделка пошла в исполнение': 'so the deal can move into execution', 'Ключевые показатели закупки': 'Key procurement metrics', 'Резерв · ждёт банк': 'Reserve · awaiting bank', 'Под удержанием · вес': 'Held · weight', 'Уверенность к поставке': 'Delivery confidence', 'Деньги и резерв': 'Money and reserve', 'Обзор закупки': 'Procurement overview', 'Деньги, резерв и удержание': 'Money, reserve, and hold', 'Документы и СДИЗ покупателя': 'Buyer documents and SDIZ', 'Блокеры и путь разблокировки': 'Blockers and unblock path', 'Закупки, партии и маршруты покупателя': 'Buyer procurement, lots, and routes',
    'ПРОДАВЕЦ · КАБИНЕТ СДЕЛКИ': 'SELLER · DEAL WORKSPACE', 'Главный рабочий статус продавца': 'Seller main operating status', 'остановлено · ждёт ЭТрН': 'stopped · awaiting E-TTN', 'СДИЗ и ЭТрН не закрыты': 'SDIZ and E-TTN are not closed', 'Закрыть документы, чтобы передать основание банку': 'Close documents to transfer the basis to the bank', 'На проверку банку': 'For bank review', 'Кабинет продавца · сделка → документы → деньги': 'Seller workspace · deal → documents → money', 'Закройте документы': 'Close the documents', 'для банка': 'for the bank', 'Подготовить документы': 'Prepare documents', 'Партии и лоты': 'Lots and listings', 'Что важно продавцу сейчас': 'What matters to the seller now', 'Состояние сделки продавца': 'Seller deal status', 'Партии, лоты и маршруты продавца': 'Seller lots, listings, and routes',
    'BANK · Проверка выплаты': 'BANK · Payout review', 'Кабинет банка': 'Bank workspace', 'Сначала основание, потом банковская проверка': 'Basis first, then bank review', 'Проверка выплаты': 'Payout review', 'Карточка сделки': 'Deal card', '5 секунд для банка': '5 seconds for the bank', 'Деньги не двигаются, пока нет основания': 'Money does not move until there is a basis', 'Платформа деньги не передаёт без банка': 'The platform does not transfer money without the bank', 'Деньги под контролем банка': 'Money under bank control', 'В резерве': 'In reserve', 'К передаче банку сейчас': 'For bank transfer now', 'Под удержанием': 'Held', 'Требуют проверки': 'Require review', 'Денежная очередь': 'Money queue', 'Резерв': 'Reserve', 'Удержано': 'Held', 'Документы и основания': 'Documents and grounds', 'Внешние контуры': 'External circuits', 'Условия банковской проверки выплаты': 'Bank payout review conditions', 'Рекомендации и доказательства': 'Recommendations and evidence', 'Передача между ролями и журнал': 'Role handoff and journal',
    'SUPPORT_MANAGER · Центр управления': 'SUPPORT_MANAGER · Control tower', 'Центр управления': 'Control tower', 'Рабочий стол оператора': 'Operator workspace', 'Блокеры, деньги и': 'Blockers, money, and', 'следующий ответственный': 'next owner', 'Сделок под контролем': 'Deals under control', 'Стоп-блокеров': 'Stop blockers', 'Удержано по спорам': 'Held in disputes', 'Банк-операций в очереди': 'Bank operations in queue', 'Разобрать критические': 'Review critical cases', 'Матрица документов': 'Document matrix', 'Контроль первого экрана': 'First-screen control', 'Операционный контроль первого экрана': 'First-screen operating control', 'Очередь блокеров': 'Blocker queue', 'Причинные связи и сводка по блокерам': 'Cause links and blocker summary', 'детали остановки денег': 'money stop details', 'Сквозные действия': 'Cross-role actions', 'Единый inbox задач': 'Unified task inbox', 'Inbox оператора': 'Operator inbox', 'Операционные KPI': 'Operational KPIs', 'KPI-панель оператора': 'Operator KPI panel', 'СДИЗ не подтверждён': 'SDIZ is not confirmed', 'ЭТрН ждёт подписи грузополучателя': 'E-TTN awaits consignee signature', 'Протокол качества ожидается': 'Quality protocol is pending', 'Отклонение веса': 'Weight deviation', 'Что произошло': 'What happened', 'Что заблокировано': 'What is blocked', 'Кто отвечает': 'Who is responsible', 'Движение денег остановлено': 'Money movement is stopped', 'Удержание не снимается': 'Hold is not released', 'останавливает деньги': 'stops money', 'ждёт подтверждения': 'awaits confirmation',

    'Руководитель · только просмотр': 'Executive · read-only', 'Стратегический контроль.': 'Strategic control.', 'Фокус на результате.': 'Focus on the result.', 'Исполнительная панель: деньги, споры, блокеры и портфель без права действия.': 'Executive dashboard: money, disputes, blockers, and portfolio without action rights.', 'Ключевые показатели руководителя': 'Executive key metrics', 'Деньги в блоке': 'Blocked money', 'Банк ожидает': 'Bank awaits', 'Портфель': 'Portfolio', 'Юнит-экономика (BI)': 'Unit economics (BI)', 'из runtime-сделок': 'from runtime deals', 'Динамика цен на зерно': 'Grain price trend', 'Сделок пока нет': 'No deals yet',
    'Кабинет логистики': 'Logistics workspace', 'Логистика сделки': 'Deal logistics', 'Рейсы и маршруты': 'Trips and routes', 'Водители': 'Drivers', 'Маршрут': 'Route', 'Транспорт': 'Vehicle', 'Пломба': 'Seal', 'ГИС ЭПД': 'GIS EPD', 'ЭТрН': 'E-TTN', 'Отклонение маршрута': 'Route deviation', 'Контрольные точки': 'Checkpoints', 'Активные рейсы': 'Active trips', 'Рейсы с блокерами': 'Trips with blockers', 'Назначить водителя': 'Assign driver', 'Открыть рейс': 'Open trip',
    'Кабинет водителя': 'Driver workspace', 'Полевой режим': 'Field mode', 'Текущий рейс': 'Current trip', 'Следующая точка': 'Next point', 'Фотофиксация': 'Photo evidence', 'Офлайн-доказательства': 'Offline evidence', 'Передать статус': 'Submit status', 'Прибыл на погрузку': 'Arrived for loading', 'Прибыл на выгрузку': 'Arrived for unloading',
    'Кабинет элеватора': 'Elevator workspace', 'Приёмка зерна': 'Grain acceptance', 'Вес брутто': 'Gross weight', 'Вес нетто': 'Net weight', 'Акт расхождения': 'Discrepancy act', 'Хранение': 'Storage', 'Партия на приёмке': 'Lot at acceptance', 'Зафиксировать вес': 'Record weight',
    'Кабинет лаборатории': 'Laboratory workspace', 'Лабораторный контур': 'Laboratory circuit', 'Проба': 'Sample', 'Протокол качества': 'Quality protocol', 'Показатели качества': 'Quality indicators', 'Влажность': 'Moisture', 'Клейковина': 'Gluten', 'Натура': 'Test weight', 'Заражённость': 'Infestation', 'Подтвердить протокол': 'Confirm protocol',
    'Кабинет сюрвейера': 'Surveyor workspace', 'Осмотр': 'Inspection', 'Фиксация фактов': 'Fact recording', 'Фото': 'Photo', 'Заключение': 'Conclusion', 'Независимый доказательный слой': 'Independent evidence layer',
    'Кабинет арбитра': 'Arbitrator workspace', 'Разбор спора': 'Dispute review', 'Пакет доказательств': 'Evidence package', 'Решение по фактам': 'Fact-based decision', 'Удержание': 'Hold', 'Снять удержание': 'Release hold', 'Оставить удержание': 'Keep hold',
    'Кабинет комплаенса': 'Compliance workspace', 'KYC/AML проверка': 'KYC/AML review', 'Риск сделки': 'Deal risk', 'Проверка участника': 'Participant review', 'Доступы и действия': 'Access and actions', 'Блокировать действие': 'Block action', 'Разрешить действие': 'Allow action',
  },
  zh: {
    'Прозрачная Цена': '透明价格', 'Войти': '登录', 'Регистрация': '注册', 'Выход': '退出', 'Назад': '返回', 'Справка': '帮助', 'Открыть': '打开', 'Раскрыть': '展开', 'раскрыть': '展开',
    'Статус': '状态', 'Следующее действие': '下一步动作', 'Ответственный': '负责人', 'Источник': '来源', 'Сумма влияния': '影响金额', 'Сумма': '金额', 'Владелец': '所有者', 'Культура': '作物', 'Объём, т': '数量，吨',
    'Деньги': '资金', 'Документы': '文件', 'Логистика': '物流', 'Качество': '质量', 'Сделка': '交易', 'Рейс': '运输', 'Приёмка': '验收', 'Расчёт': '结算', 'Спор': '争议', 'Блокер': '阻断项',
    'Оператор': '运营方', 'Покупатель': '买方', 'Продавец': '卖方', 'Водитель': '司机', 'Элеватор': '粮仓', 'Лаборатория': '实验室', 'Сюрвейер': '检验员', 'Банк': '银行', 'Комплаенс': '合规', 'Арбитр': '仲裁员', 'Руководитель': '管理层',
    'Главный риск сделки': '交易的主要风险', 'начинается после': '开始于', 'согласования цены': '价格确认之后', 'Подключить организацию': '接入组织', 'Демонстрационная сделка': '演示交易', 'Направить обращение': '发送请求', 'Что контролирует платформа': '平台控制什么', 'Как проходит сделка': '交易流程', 'Выберите свою роль в сделке': '选择你在交易中的角色', 'Подать заявку на роль': '申请角色',
    'Главный блокер': '主要阻断项', 'Сделок в работе': '进行中的交易', 'Открытых споров': '未结争议', 'Деньги под риском': '风险资金', 'Журнал событий': '事件日志', 'Рабочие действия и передача': '工作动作和交接', 'Деньги и банковская проверка': '资金和银行审核', 'Документы для проверки': '审核文件', 'Что мешает выплате': '阻碍付款的事项', 'Калькулятор комиссии': '佣金计算器', 'Факторинг': '保理', 'Экспортный калькулятор': '出口计算器', 'ФТС · Таможенные декларации': '联邦海关 · 报关单', 'ЭДО · Электронный документооборот': 'EDI · 电子文件流',
    'Кабинет покупателя · запрос → резерв → логистика': '买方工作区 · 请求 → 预留 → 物流', 'Подтвердить резерв,': '确认预留资金，', 'чтобы сделка пошла в исполнение': '使交易进入执行', 'Ключевые показатели закупки': '采购关键指标', 'Резерв · ждёт банк': '预留 · 等待银行', 'Под удержанием · вес': '冻结 · 重量', 'Уверенность к поставке': '交付信心', 'Деньги и резерв': '资金和预留', 'Обзор закупки': '采购概览', 'Деньги, резерв и удержание': '资金、预留和冻结', 'Документы и СДИЗ покупателя': '买方文件和SDIZ', 'Блокеры и путь разблокировки': '阻断项和解锁路径', 'Закупки, партии и маршруты покупателя': '买方采购、批次和路线',
    'ПРОДАВЕЦ · КАБИНЕТ СДЕЛКИ': '卖方 · 交易工作区', 'Главный рабочий статус продавца': '卖方主要工作状态', 'остановлено · ждёт ЭТрН': '已停止 · 等待E-TTN', 'СДИЗ и ЭТрН не закрыты': 'SDIZ和E-TTN未关闭', 'Закрыть документы, чтобы передать основание банку': '关闭文件以将依据提交给银行', 'На проверку банку': '提交银行审核', 'Кабинет продавца · сделка → документы → деньги': '卖方工作区 · 交易 → 文件 → 资金', 'Закройте документы': '关闭文件', 'для банка': '用于银行', 'Подготовить документы': '准备文件', 'Партии и лоты': '批次和挂牌', 'Что важно продавцу сейчас': '卖方现在需要关注什么', 'Состояние сделки продавца': '卖方交易状态', 'Партии, лоты и маршруты продавца': '卖方批次、挂牌和路线',
    'BANK · Проверка выплаты': '银行 · 付款审核', 'Кабинет банка': '银行工作区', 'Сначала основание, потом банковская проверка': '先形成依据，再进行银行审核', 'Проверка выплаты': '付款审核', 'Карточка сделки': '交易卡片', '5 секунд для банка': '银行5秒视图', 'Деньги не двигаются, пока нет основания': '没有依据，资金不流转', 'Платформа деньги не передаёт без банка': '没有银行，平台不转移资金', 'Деньги под контролем банка': '银行控制下的资金', 'В резерве': '预留中', 'К передаче банку сейчас': '当前提交银行', 'Под удержанием': '冻结中', 'Требуют проверки': '需要审核', 'Денежная очередь': '资金队列', 'Резерв': '预留', 'Удержано': '已冻结', 'Документы и основания': '文件和依据', 'Внешние контуры': '外部闭环', 'Условия банковской проверки выплаты': '银行付款审核条件', 'Рекомендации и доказательства': '建议和证据', 'Передача между ролями и журнал': '角色交接和日志',
    'SUPPORT_MANAGER · Центр управления': 'SUPPORT_MANAGER · 控制中心', 'Центр управления': '控制中心', 'Рабочий стол оператора': '运营方工作台', 'Блокеры, деньги и': '阻断项、资金和', 'следующий ответственный': '下一负责人', 'Сделок под контролем': '受控交易', 'Стоп-блокеров': '停止型阻断项', 'Удержано по спорам': '争议冻结金额', 'Банк-операций в очереди': '银行操作队列', 'Разобрать критические': '处理关键项', 'Матрица документов': '文件矩阵', 'Контроль первого экрана': '第一屏控制', 'Операционный контроль первого экрана': '第一屏运营控制', 'Очередь блокеров': '阻断项队列', 'Причинные связи и сводка по блокерам': '原因关系和阻断项摘要', 'детали остановки денег': '资金停止详情', 'Сквозные действия': '跨角色动作', 'Единый inbox задач': '统一任务收件箱', 'Inbox оператора': '运营方收件箱', 'Операционные KPI': '运营KPI', 'KPI-панель оператора': '运营KPI面板', 'СДИЗ не подтверждён': 'SDIZ未确认', 'ЭТрН ждёт подписи грузополучателя': 'E-TTN等待收货方签名', 'Протокол качества ожидается': '等待质量报告', 'Отклонение веса': '重量偏差', 'Что произошло': '发生了什么', 'Что заблокировано': '被阻断内容', 'Кто отвечает': '谁负责', 'Движение денег остановлено': '资金流转已停止', 'Удержание не снимается': '冻结未解除', 'останавливает деньги': '停止资金', 'ждёт подтверждения': '等待确认',
    'Руководитель · только просмотр': '管理层 · 只读', 'Стратегический контроль.': '战略控制。', 'Фокус на результате.': '聚焦结果。', 'Исполнительная панель: деньги, споры, блокеры и портфель без права действия.': '管理面板：资金、争议、阻断项和组合，仅查看，无操作权限。', 'Ключевые показатели руководителя': '管理层关键指标', 'Деньги в блоке': '被阻断资金', 'Банк ожидает': '银行等待', 'Портфель': '组合', 'Юнит-экономика (BI)': '单位经济模型（BI）', 'из runtime-сделок': '来自运行交易', 'Динамика цен на зерно': '粮食价格趋势', 'Сделок пока нет': '暂无交易',
    'Кабинет логистики': '物流工作区', 'Логистика сделки': '交易物流', 'Рейсы и маршруты': '运输和路线', 'Водители': '司机', 'Маршрут': '路线', 'Транспорт': '车辆', 'Пломба': '封签', 'ГИС ЭПД': 'GIS EPD', 'ЭТрН': 'E-TTN', 'Отклонение маршрута': '路线偏差', 'Контрольные точки': '检查点', 'Активные рейсы': '活动运输', 'Рейсы с блокерами': '有阻断项的运输', 'Назначить водителя': '分配司机', 'Открыть рейс': '打开运输',
    'Кабинет водителя': '司机工作区', 'Полевой режим': '现场模式', 'Текущий рейс': '当前运输', 'Следующая точка': '下一地点', 'Фотофиксация': '照片证据', 'Офлайн-доказательства': '离线证据', 'Передать статус': '提交状态', 'Прибыл на погрузку': '已到达装货点', 'Прибыл на выгрузку': '已到达卸货点',
    'Кабинет элеватора': '粮仓工作区', 'Приёмка зерна': '粮食验收', 'Вес брутто': '毛重', 'Вес нетто': '净重', 'Акт расхождения': '差异单据', 'Хранение': '仓储', 'Партия на приёмке': '验收批次', 'Зафиксировать вес': '记录重量',
    'Кабинет лаборатории': '实验室工作区', 'Лабораторный контур': '实验室闭环', 'Проба': '样品', 'Протокол качества': '质量报告', 'Показатели качества': '质量指标', 'Влажность': '水分', 'Клейковина': '面筋', 'Натура': '容重', 'Заражённость': '感染度', 'Подтвердить протокол': '确认报告',
    'Кабинет сюрвейера': '检验员工作区', 'Осмотр': '检查', 'Фиксация фактов': '事实记录', 'Фото': '照片', 'Заключение': '结论', 'Независимый доказательный слой': '独立证据层',
    'Кабинет арбитра': '仲裁员工作区', 'Разбор спора': '争议复盘', 'Пакет доказательств': '证据包', 'Решение по фактам': '基于事实的决定', 'Удержание': '冻结', 'Снять удержание': '解除冻结', 'Оставить удержание': '保留冻结',
    'Кабинет комплаенса': '合规工作区', 'KYC/AML проверка': 'KYC/AML审核', 'Риск сделки': '交易风险', 'Проверка участника': '参与方审核', 'Доступы и действия': '访问和操作', 'Блокировать действие': '阻止操作', 'Разрешить действие': '允许操作',
  },
};

function currentLang(): Lang {
  const stored = window.localStorage.getItem(LANGUAGE_KEY);
  return stored === 'en' || stored === 'zh' ? stored : 'ru';
}
function normalize(value: string) { return value.replace(/\s+/g, ' ').trim(); }
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
    if (from.length < 4 || !next.includes(from)) continue;
    next = next.split(from).join(to);
  }
  return next;
}
function setText(target: Element | null, value: string) { if (target && target.textContent !== value) target.textContent = value; }
function setLastText(link: HTMLElement | null, value: string) {
  if (!link) return;
  const node = Array.from(link.childNodes).reverse().find((item) => item.nodeType === Node.TEXT_NODE);
  if (node) { node.textContent = value; return; }
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
  if (contact) { contact.setAttribute('href', '/platform-v7/contact'); setLastText(contact, home.contact); }
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
    return () => { observer.disconnect(); timers.forEach((timer) => window.clearTimeout(timer)); window.clearInterval(interval); window.removeEventListener('resize', applyAll); };
  }, []);
  return null;
}
