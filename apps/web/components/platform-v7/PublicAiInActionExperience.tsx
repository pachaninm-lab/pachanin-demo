'use client';

import * as React from 'react';
import { PublicExperienceIcon, type PublicExperienceIconName } from './PublicExperienceIcon';
import styles from './PublicAiInActionExperience.module.css';

type Locale = 'ru' | 'en' | 'zh';
type RoleKey = 'buyer' | 'seller' | 'operator';
type ScenarioKey = 'documents' | 'quality' | 'logistics';

type Fact = {
  label: string;
  value: string;
  source: string;
  detail: string;
  icon: PublicExperienceIconName;
  attention?: boolean;
};

type Scenario = {
  label: string;
  short: string;
  title: string;
  reason: string;
  impact: string;
  deadline: string;
  money: string;
  facts: Fact[];
  actions: Record<RoleKey, { owner: string; action: string; outcome: string }>;
};

type Copy = {
  hero: { eyebrow: string; title: string; lead: string; primary: string; secondary: string; badges: string[] };
  labels: {
    scenario: string;
    role: string;
    facts: string;
    evidence: string;
    analysis: string;
    result: string;
    reason: string;
    impact: string;
    deadline: string;
    money: string;
    owner: string;
    next: string;
    previous: string;
    nextStep: string;
    play: string;
    pause: string;
    reset: string;
    confirm: string;
    confirmed: string;
    control: string;
    useful: string;
    adjust: string;
    usefulDone: string;
    adjustDone: string;
    running: string;
    paused: string;
    reduced: string;
  };
  phases: Array<{ short: string; label: string; description: string; result: string; icon: PublicExperienceIconName }>;
  roles: Record<RoleKey, { label: string; focus: string; icon: PublicExperienceIconName }>;
  scenarios: Record<ScenarioKey, Scenario>;
  principles: {
    eyebrow: string;
    title: string;
    lead: string;
    items: Array<{ title: string; body: string; icon: PublicExperienceIconName }>;
  };
  boundary: {
    eyebrow: string;
    title: string;
    lead: string;
    cards: Array<{ label: string; value: string; note: string; icon: PublicExperienceIconName }>;
  };
  final: { eyebrow: string; title: string; lead: string; primary: string; secondary: string };
};

const COPY: Record<Locale, Copy> = {
  ru: {
    hero: {
      eyebrow: 'ИИ работает в платформе',
      title: 'От события сделки — к понятному действию',
      lead: 'Интерактивный показ объясняет, как ИИ собирает разрешённые факты, связывает их с документами и сроками, выявляет риск, раскрывает причину и готовит следующий шаг для конкретной роли.',
      primary: 'Запустить сценарий',
      secondary: 'Посмотреть границы',
      badges: ['Ролевой доступ', 'Серверные факты', 'Только чтение', 'Подтверждение человеком'],
    },
    labels: {
      scenario: 'Сценарий',
      role: 'Показать со стороны',
      facts: 'Поток фактов',
      evidence: 'Открытое основание',
      analysis: 'Контур анализа',
      result: 'Результат для участника',
      reason: 'Причина',
      impact: 'Влияние',
      deadline: 'Контрольный срок',
      money: 'Деньги под риском',
      owner: 'Ответственный',
      next: 'Следующий шаг',
      previous: 'Назад',
      nextStep: 'Далее',
      play: 'Запустить',
      pause: 'Пауза',
      reset: 'Сначала',
      confirm: 'Подтвердить демонстрационный шаг',
      confirmed: 'Шаг подтверждён в демонстрации',
      control: 'ИИ готовит решение, но не отправляет запросы и не меняет состояние сделки без действия пользователя.',
      useful: 'Полезно',
      adjust: 'Нужна корректировка',
      usefulDone: 'Объяснение отмечено как полезное.',
      adjustDone: 'Отмечено: объяснение нужно уточнить.',
      running: 'Сценарий выполняется',
      paused: 'Обезличенная демонстрация',
      reduced: 'Автовоспроизведение отключено настройкой уменьшения движения.',
    },
    phases: [
      { short: 'Факты', label: 'Собирает разрешённый контекст', description: 'Сервер передаёт только события и документы, доступные выбранной роли.', result: 'Контекст собран без выхода за ролевую границу.', icon: 'documents' },
      { short: 'Связи', label: 'Связывает события и основания', description: 'Срок, документ, рейс и денежное основание складываются в одну причинную цепочку.', result: 'Виден источник каждого вывода.', icon: 'execution' },
      { short: 'Риск', label: 'Выявляет отклонение', description: 'ИИ сравнивает текущий ход сделки с согласованным сценарием исполнения.', result: 'Риск обнаружен до критического срока.', icon: 'risk' },
      { short: 'Почему', label: 'Объясняет причину и влияние', description: 'Результат раскрывает, какой факт вызвал сигнал и что он меняет для сделки.', result: 'Участник видит причину, срок и деньги под риском.', icon: 'intelligence' },
      { short: 'Действие', label: 'Готовит следующий шаг', description: 'ИИ формирует ролевую рекомендацию и оставляет критическое действие за человеком.', result: 'Следующий шаг готов к подтверждению.', icon: 'check' },
    ],
    roles: {
      buyer: { label: 'Покупатель', focus: 'Поставка и расчёт', icon: 'buyer' },
      seller: { label: 'Продавец', focus: 'Исполнение и оплата', icon: 'seller' },
      operator: { label: 'Оператор', focus: 'Блокеры и SLA', icon: 'operator' },
    },
    scenarios: {
      documents: {
        label: 'Документы',
        short: 'Протокол не подтверждён',
        title: 'Расчёт под риском задержки',
        reason: 'Лабораторный протокол отсутствует, а до контрольного срока остаётся 6 часов.',
        impact: 'Расчёт не получает подтверждённого основания; следующая отгрузка может выйти из окна.',
        deadline: '6 часов',
        money: '6,9 млн ₽',
        facts: [
          { label: 'Сделка', value: 'Пшеница 3 класса · 500 т', source: 'Карточка сделки', detail: 'Цена, объём и базис зафиксированы в доступном ролевом контуре.', icon: 'execution' },
          { label: 'Приёмка', value: 'Вес подтверждён', source: 'Акт приёмки v3', detail: 'Элеватор подтвердил фактический вес и время приёмки.', icon: 'elevator' },
          { label: 'Лаборатория', value: 'Протокол отсутствует', source: 'Реестр документов', detail: 'Ожидаемый лабораторный протокол не связан со сделкой.', icon: 'lab', attention: true },
          { label: 'Расчёт', value: 'Основание неполное', source: 'Денежный контур', detail: 'Выпуск расчёта требует подтверждённого качества и полного комплекта документов.', icon: 'money', attention: true },
        ],
        actions: {
          buyer: { owner: 'Покупатель → лаборатория', action: 'Запросить протокол и открыть основания проверки', outcome: 'Проверить качество до выпуска расчёта' },
          seller: { owner: 'Продавец → лаборатория', action: 'Приложить протокол к сделке и уведомить покупателя', outcome: 'Восстановить комплектность документов' },
          operator: { owner: 'Оператор', action: 'Создать эскалацию по SLA лаборатории', outcome: 'Снять блокер до контрольного срока' },
        },
      },
      quality: {
        label: 'Качество',
        short: 'Показатель вне допуска',
        title: 'Партия может перейти в спор',
        reason: 'Белок 11,2% при согласованном минимуме 12,0%. Результат лаборатории требует сверки.',
        impact: 'Цена или объём приёмки могут измениться; расчёт остаётся заблокированным до решения сторон.',
        deadline: 'до 14:30',
        money: '1,8 млн ₽',
        facts: [
          { label: 'Условия', value: 'Белок ≥ 12,0%', source: 'Спецификация сделки', detail: 'Допуск качества зафиксирован до отгрузки.', icon: 'documents' },
          { label: 'Проба', value: 'Связана с партией', source: 'Акт отбора пробы', detail: 'Проба имеет связь с рейсом, партией и временем отбора.', icon: 'surveyor' },
          { label: 'Результат', value: 'Белок 11,2%', source: 'Лабораторный протокол', detail: 'Показатель отклоняется от согласованного минимума на 0,8 п.п.', icon: 'lab', attention: true },
          { label: 'Расчёт', value: 'Ожидает решения', source: 'Денежный контур', detail: 'До подтверждения сценария урегулирования выпуск денег недоступен.', icon: 'money', attention: true },
        ],
        actions: {
          buyer: { owner: 'Покупатель', action: 'Открыть сверку качества и предложить сценарий приёмки', outcome: 'Принять решение на подтверждённых показателях' },
          seller: { owner: 'Продавец', action: 'Проверить протокол и запросить повторную пробу при необходимости', outcome: 'Защитить позицию доказательствами' },
          operator: { owner: 'Оператор', action: 'Собрать пакет расхождения и запустить регламент урегулирования', outcome: 'Не допустить неуправляемого спора' },
        },
      },
      logistics: {
        label: 'Логистика',
        short: 'Сдвиг ETA на 4 часа',
        title: 'Рейс может пропустить окно приёмки',
        reason: 'Расчётное прибытие сместилось на 4 часа и выходит за подтверждённое окно элеватора.',
        impact: 'Возникает риск простоя, переноса приёмки и связанных затрат.',
        deadline: 'до 17:00',
        money: '82 тыс. ₽',
        facts: [
          { label: 'Рейс', value: 'TR-2048', source: 'Карточка рейса', detail: 'Рейс связан с текущей партией и ответственными участниками.', icon: 'logistics' },
          { label: 'Маршрут', value: 'Тамбов → Воронеж', source: 'Маршрут исполнения', detail: 'Контрольные точки и плановое время прибытия зафиксированы.', icon: 'driver' },
          { label: 'ETA', value: '+4 часа', source: 'Событие движения', detail: 'Текущее расчётное прибытие выходит за окно приёмки.', icon: 'risk', attention: true },
          { label: 'Простой', value: 'Тариф после 17:00', source: 'Транспортные условия', detail: 'После контрольного времени начинает действовать тариф ожидания.', icon: 'money', attention: true },
        ],
        actions: {
          buyer: { owner: 'Покупатель → элеватор', action: 'Согласовать новое окно и подтвердить изменение', outcome: 'Избежать неопределённого ожидания машины' },
          seller: { owner: 'Продавец → логистика', action: 'Подтвердить новый ETA и влияние на срок поставки', outcome: 'Сохранить проверяемый след исполнения' },
          operator: { owner: 'Оператор', action: 'Запустить согласование между водителем, логистикой и элеватором', outcome: 'Снять межролевой блокер до простоя' },
        },
      },
    },
    principles: {
      eyebrow: 'Что происходит внутри',
      title: 'Не чат ради чата, а объяснимый слой исполнения',
      lead: 'Рабочий контур сочетает ограниченный доступ, фактические основания, понятное объяснение и контроль человека.',
      items: [
        { title: 'Видит разрешённый контекст', body: 'Роль и доступ проверяются сервером. Чужие сделки и документы не попадают в анализ.', icon: 'participants' },
        { title: 'Опирается на основания', body: 'Каждый вывод связан со сроком, документом, рейсом, качеством или денежным событием.', icon: 'documents' },
        { title: 'Объясняет вывод', body: 'Пользователь видит не только сигнал, но и причину, влияние, ответственного и срок.', icon: 'intelligence' },
        { title: 'Оставляет решение человеку', body: 'ИИ готовит следующий шаг; отправка и критические действия требуют подтверждения.', icon: 'compliance' },
      ],
    },
    boundary: {
      eyebrow: 'Проверяемые границы',
      title: 'Что ИИ делает — и чего не делает',
      lead: 'Публичная страница показывает обезличенный сценарий. Рабочий помощник действует внутри подтверждённой роли и не подменяет полномочия участников.',
      cards: [
        { label: 'Данные', value: 'Только доступная роль', note: 'Сервер ограничивает факты текущей организацией и полномочиями.', icon: 'participants' },
        { label: 'Режим', value: 'Только чтение', note: 'ИИ объясняет и рекомендует, но сам не меняет состояние сделки.', icon: 'documents' },
        { label: 'Действие', value: 'Подтверждает человек', note: 'Запрос, эскалация и любое значимое действие остаются за пользователем.', icon: 'check' },
        { label: 'Объяснение', value: 'Основания видимы', note: 'Причина и влияние связаны с конкретными фактами, документами и сроками.', icon: 'intelligence' },
      ],
    },
    final: {
      eyebrow: 'Следующий шаг',
      title: 'Посмотрите ИИ внутри своего ролевого контура',
      lead: 'Подключённая организация получает помощника, который объясняет доступные сделки, блокеры, основания и следующий шаг.',
      primary: 'Войти в платформу',
      secondary: 'Разобрать демонстрационную сделку',
    },
  },
  en: {
    hero: {
      eyebrow: 'AI is active in the platform',
      title: 'From a deal event to an understandable action',
      lead: 'The interactive walkthrough shows how AI collects permitted facts, connects them to documents and deadlines, identifies risk, explains the cause and prepares the next step for a specific role.',
      primary: 'Run the scenario',
      secondary: 'See the boundaries',
      badges: ['Role-scoped access', 'Server facts', 'Read-only', 'Human confirmation'],
    },
    labels: {
      scenario: 'Scenario', role: 'View as', facts: 'Fact stream', evidence: 'Open evidence', analysis: 'Analysis layer', result: 'Participant result', reason: 'Reason', impact: 'Impact', deadline: 'Control deadline', money: 'Money at risk', owner: 'Owner', next: 'Next step', previous: 'Back', nextStep: 'Next', play: 'Play', pause: 'Pause', reset: 'Restart', confirm: 'Confirm demonstrative step', confirmed: 'Step confirmed in the demonstration', control: 'AI prepares the decision but does not send requests or change deal state without user action.', useful: 'Useful', adjust: 'Needs adjustment', usefulDone: 'The explanation was marked useful.', adjustDone: 'Noted: the explanation needs refinement.', running: 'Scenario is running', paused: 'Anonymised demonstration', reduced: 'Autoplay is disabled by the reduced-motion preference.',
    },
    phases: [
      { short: 'Facts', label: 'Collects permitted context', description: 'The server supplies only events and documents available to the selected role.', result: 'Context is collected without crossing the role boundary.', icon: 'documents' },
      { short: 'Links', label: 'Connects events and grounds', description: 'Deadlines, documents, trips and payment grounds form one causal chain.', result: 'The source of every conclusion is visible.', icon: 'execution' },
      { short: 'Risk', label: 'Identifies deviation', description: 'AI compares the current deal flow with the agreed execution scenario.', result: 'Risk is surfaced before the control deadline.', icon: 'risk' },
      { short: 'Why', label: 'Explains cause and impact', description: 'The result shows which fact triggered the signal and what it changes.', result: 'The participant sees the cause, deadline and money at risk.', icon: 'intelligence' },
      { short: 'Action', label: 'Prepares the next step', description: 'AI prepares a role-specific recommendation and leaves the consequential action to the person.', result: 'The next step is ready for confirmation.', icon: 'check' },
    ],
    roles: {
      buyer: { label: 'Buyer', focus: 'Delivery and settlement', icon: 'buyer' },
      seller: { label: 'Seller', focus: 'Execution and payment', icon: 'seller' },
      operator: { label: 'Operator', focus: 'Blockers and SLA', icon: 'operator' },
    },
    scenarios: {
      documents: {
        label: 'Documents', short: 'Protocol not confirmed', title: 'Settlement is at risk of delay', reason: 'The laboratory protocol is missing, with six hours left before the control deadline.', impact: 'Settlement has no confirmed ground, and the next shipment may miss its window.', deadline: '6 hours', money: 'RUB 6.9m',
        facts: [
          { label: 'Deal', value: 'Class 3 wheat · 500 t', source: 'Deal record', detail: 'Price, volume and basis are fixed inside the permitted role scope.', icon: 'execution' },
          { label: 'Acceptance', value: 'Weight confirmed', source: 'Acceptance act v3', detail: 'The elevator confirmed actual weight and acceptance time.', icon: 'elevator' },
          { label: 'Laboratory', value: 'Protocol missing', source: 'Document registry', detail: 'The expected laboratory protocol is not linked to the deal.', icon: 'lab', attention: true },
          { label: 'Settlement', value: 'Ground incomplete', source: 'Money layer', detail: 'Release requires confirmed quality and a complete document set.', icon: 'money', attention: true },
        ],
        actions: {
          buyer: { owner: 'Buyer → laboratory', action: 'Request the protocol and open the review grounds', outcome: 'Verify quality before settlement release' },
          seller: { owner: 'Seller → laboratory', action: 'Attach the protocol and notify the buyer', outcome: 'Restore document completeness' },
          operator: { owner: 'Operator', action: 'Create an SLA escalation for the laboratory', outcome: 'Remove the blocker before the deadline' },
        },
      },
      quality: {
        label: 'Quality', short: 'Indicator outside tolerance', title: 'The lot may enter a dispute', reason: 'Protein is 11.2% against an agreed minimum of 12.0%. The result requires review.', impact: 'Price or accepted volume may change; settlement remains blocked until the parties decide.', deadline: 'by 14:30', money: 'RUB 1.8m',
        facts: [
          { label: 'Terms', value: 'Protein ≥ 12.0%', source: 'Deal specification', detail: 'The quality tolerance was fixed before shipment.', icon: 'documents' },
          { label: 'Sample', value: 'Linked to the lot', source: 'Sampling act', detail: 'The sample is linked to the trip, lot and collection time.', icon: 'surveyor' },
          { label: 'Result', value: 'Protein 11.2%', source: 'Laboratory protocol', detail: 'The indicator is 0.8 percentage points below the agreed minimum.', icon: 'lab', attention: true },
          { label: 'Settlement', value: 'Awaiting decision', source: 'Money layer', detail: 'Release is unavailable until a resolution scenario is confirmed.', icon: 'money', attention: true },
        ],
        actions: {
          buyer: { owner: 'Buyer', action: 'Open quality review and propose an acceptance scenario', outcome: 'Decide on confirmed indicators' },
          seller: { owner: 'Seller', action: 'Review the protocol and request a repeat sample if needed', outcome: 'Protect the position with evidence' },
          operator: { owner: 'Operator', action: 'Assemble the deviation pack and start the resolution procedure', outcome: 'Prevent an unmanaged dispute' },
        },
      },
      logistics: {
        label: 'Logistics', short: 'ETA shifted by 4 hours', title: 'The trip may miss the acceptance window', reason: 'Estimated arrival moved by four hours and now falls outside the confirmed elevator window.', impact: 'Waiting time, rescheduling and related costs become likely.', deadline: 'by 17:00', money: 'RUB 82k',
        facts: [
          { label: 'Trip', value: 'TR-2048', source: 'Trip record', detail: 'The trip is linked to the current lot and responsible participants.', icon: 'logistics' },
          { label: 'Route', value: 'Tambov → Voronezh', source: 'Execution route', detail: 'Control points and planned arrival are fixed.', icon: 'driver' },
          { label: 'ETA', value: '+4 hours', source: 'Movement event', detail: 'Current estimated arrival falls outside the acceptance window.', icon: 'risk', attention: true },
          { label: 'Waiting', value: 'Tariff after 17:00', source: 'Transport terms', detail: 'The waiting tariff starts after the control time.', icon: 'money', attention: true },
        ],
        actions: {
          buyer: { owner: 'Buyer → elevator', action: 'Coordinate a new window and confirm the change', outcome: 'Avoid indefinite vehicle waiting' },
          seller: { owner: 'Seller → logistics', action: 'Confirm the new ETA and delivery-time impact', outcome: 'Keep a verifiable execution trail' },
          operator: { owner: 'Operator', action: 'Coordinate driver, logistics and elevator', outcome: 'Remove the cross-role blocker before waiting costs' },
        },
      },
    },
    principles: {
      eyebrow: 'What happens inside',
      title: 'Not chat for its own sake, but an explainable execution layer',
      lead: 'The working layer combines restricted access, factual grounds, understandable explanation and human control.',
      items: [
        { title: 'Sees permitted context', body: 'Role and access are verified by the server. Other deals and documents never enter the analysis.', icon: 'participants' },
        { title: 'Uses evidence', body: 'Every conclusion is tied to a deadline, document, trip, quality result or money event.', icon: 'documents' },
        { title: 'Explains the result', body: 'The user sees the signal, cause, impact, owner and deadline.', icon: 'intelligence' },
        { title: 'Leaves action to people', body: 'AI prepares the next step; sending and consequential actions require confirmation.', icon: 'compliance' },
      ],
    },
    boundary: {
      eyebrow: 'Verifiable boundaries',
      title: 'What AI does — and does not do',
      lead: 'The public page uses an anonymised scenario. The working assistant operates inside a verified role and does not replace participant authority.',
      cards: [
        { label: 'Data', value: 'Accessible role only', note: 'The server limits facts to the current organisation and permissions.', icon: 'participants' },
        { label: 'Mode', value: 'Read-only', note: 'AI explains and recommends but does not change deal state.', icon: 'documents' },
        { label: 'Action', value: 'Confirmed by a person', note: 'Requests, escalations and consequential actions remain with the user.', icon: 'check' },
        { label: 'Explanation', value: 'Evidence is visible', note: 'Cause and impact are tied to specific facts, documents and deadlines.', icon: 'intelligence' },
      ],
    },
    final: {
      eyebrow: 'Next step', title: 'See AI inside your role scope', lead: 'A connected organisation gets an assistant that explains accessible deals, blockers, grounds and next steps.', primary: 'Sign in', secondary: 'Review the demonstration deal',
    },
  },
  zh: {
    hero: {
      eyebrow: 'AI 已在平台中运行', title: '从交易事件到清晰行动', lead: '交互式演示展示 AI 如何收集获授权事实、关联文件与期限、识别风险、解释原因，并为特定角色准备下一步。', primary: '启动场景', secondary: '查看边界', badges: ['角色权限', '服务器事实', '只读模式', '人工确认'],
    },
    labels: {
      scenario: '场景', role: '角色视角', facts: '事实流', evidence: '当前依据', analysis: '分析层', result: '参与方结果', reason: '原因', impact: '影响', deadline: '控制期限', money: '风险金额', owner: '负责人', next: '下一步', previous: '上一步', nextStep: '下一步', play: '播放', pause: '暂停', reset: '重新开始', confirm: '确认演示步骤', confirmed: '演示步骤已确认', control: 'AI 准备决策，但未经用户操作不会发送请求或改变交易状态。', useful: '有帮助', adjust: '需要调整', usefulDone: '该解释已标记为有帮助。', adjustDone: '已记录：解释需要调整。', running: '场景正在运行', paused: '匿名演示', reduced: '系统根据减少动态效果的设置关闭了自动播放。',
    },
    phases: [
      { short: '事实', label: '收集获授权上下文', description: '服务器只提供当前角色可访问的事件和文件。', result: '在不跨越角色边界的情况下完成上下文收集。', icon: 'documents' },
      { short: '关联', label: '关联事件与依据', description: '期限、文件、运输和付款依据形成一条因果链。', result: '每个结论的来源都清晰可见。', icon: 'execution' },
      { short: '风险', label: '识别偏差', description: 'AI 将当前交易进度与约定的履约场景进行比较。', result: '在控制期限前发现风险。', icon: 'risk' },
      { short: '原因', label: '解释原因与影响', description: '结果说明触发信号的事实以及它对交易的影响。', result: '参与方看到原因、期限和风险金额。', icon: 'intelligence' },
      { short: '行动', label: '准备下一步', description: 'AI 形成角色化建议，重要操作仍由人工执行。', result: '下一步已准备好等待确认。', icon: 'check' },
    ],
    roles: {
      buyer: { label: '买方', focus: '交付与结算', icon: 'buyer' },
      seller: { label: '卖方', focus: '履约与付款', icon: 'seller' },
      operator: { label: '运营方', focus: '阻塞与 SLA', icon: 'operator' },
    },
    scenarios: {
      documents: {
        label: '文件', short: '报告未确认', title: '结算存在延迟风险', reason: '实验室报告缺失，距离控制期限还有 6 小时。', impact: '结算缺少已确认依据，下一批发运可能错过窗口。', deadline: '6 小时', money: '690 万卢布',
        facts: [
          { label: '交易', value: '三等小麦 · 500 吨', source: '交易记录', detail: '价格、数量和基准在授权角色范围内已固定。', icon: 'execution' },
          { label: '收货', value: '重量已确认', source: '收货单 v3', detail: '粮库确认了实际重量和收货时间。', icon: 'elevator' },
          { label: '实验室', value: '报告缺失', source: '文件登记册', detail: '预期的实验室报告尚未关联到交易。', icon: 'lab', attention: true },
          { label: '结算', value: '依据不完整', source: '资金层', detail: '释放结算需要已确认质量和完整文件集。', icon: 'money', attention: true },
        ],
        actions: {
          buyer: { owner: '买方 → 实验室', action: '请求报告并打开审核依据', outcome: '在释放结算前核验质量' },
          seller: { owner: '卖方 → 实验室', action: '附加报告并通知买方', outcome: '恢复文件完整性' },
          operator: { owner: '运营方', action: '创建实验室 SLA 升级', outcome: '在期限前解除阻塞' },
        },
      },
      quality: {
        label: '质量', short: '指标超出允许范围', title: '批次可能进入争议', reason: '蛋白质为 11.2%，低于约定最低值 12.0%，需要复核。', impact: '价格或接收数量可能变化；双方决定前结算保持阻断。', deadline: '14:30 前', money: '180 万卢布',
        facts: [
          { label: '条件', value: '蛋白质 ≥ 12.0%', source: '交易规格', detail: '质量允许范围在发运前已固定。', icon: 'documents' },
          { label: '样品', value: '已关联批次', source: '取样单', detail: '样品与运输、批次和取样时间相关联。', icon: 'surveyor' },
          { label: '结果', value: '蛋白质 11.2%', source: '实验室报告', detail: '指标比约定最低值低 0.8 个百分点。', icon: 'lab', attention: true },
          { label: '结算', value: '等待决定', source: '资金层', detail: '确认处理方案前无法释放资金。', icon: 'money', attention: true },
        ],
        actions: {
          buyer: { owner: '买方', action: '启动质量复核并提出接收方案', outcome: '基于已确认指标作出决定' },
          seller: { owner: '卖方', action: '核对报告并在需要时请求复检', outcome: '用证据保护立场' },
          operator: { owner: '运营方', action: '汇总偏差材料并启动处理流程', outcome: '避免争议失控' },
        },
      },
      logistics: {
        label: '物流', short: 'ETA 延后 4 小时', title: '车辆可能错过收货窗口', reason: '预计到达时间延后四小时，超出粮库确认的时间窗口。', impact: '可能产生等待、改期和相关费用。', deadline: '17:00 前', money: '8.2 万卢布',
        facts: [
          { label: '运输', value: 'TR-2048', source: '运输记录', detail: '运输与当前批次及责任方相关联。', icon: 'logistics' },
          { label: '路线', value: '坦波夫 → 沃罗涅日', source: '履约路线', detail: '控制点和计划到达时间已固定。', icon: 'driver' },
          { label: 'ETA', value: '+4 小时', source: '移动事件', detail: '当前预计到达时间超出收货窗口。', icon: 'risk', attention: true },
          { label: '等待', value: '17:00 后计费', source: '运输条件', detail: '控制时间后开始计算等待费用。', icon: 'money', attention: true },
        ],
        actions: {
          buyer: { owner: '买方 → 粮库', action: '协调新窗口并确认变更', outcome: '避免车辆无限等待' },
          seller: { owner: '卖方 → 物流', action: '确认新 ETA 及其对交付期限的影响', outcome: '保留可验证的履约轨迹' },
          operator: { owner: '运营方', action: '协调司机、物流与粮库', outcome: '在产生等待费用前解除跨角色阻塞' },
        },
      },
    },
    principles: {
      eyebrow: '内部如何工作', title: '不是为了聊天，而是可解释的履约层', lead: '工作层结合受限访问、事实依据、清晰解释和人工控制。',
      items: [
        { title: '只查看授权上下文', body: '服务器验证角色与权限，其他交易和文件不会进入分析。', icon: 'participants' },
        { title: '使用事实依据', body: '每个结论都关联期限、文件、运输、质量结果或资金事件。', icon: 'documents' },
        { title: '解释输出', body: '用户看到信号、原因、影响、负责人和期限。', icon: 'intelligence' },
        { title: '由人工执行操作', body: 'AI 准备下一步；发送和重要操作需要人工确认。', icon: 'compliance' },
      ],
    },
    boundary: {
      eyebrow: '可验证边界', title: 'AI 做什么，以及不做什么', lead: '公开页面使用匿名场景。工作助手只在已验证角色范围内运行，不替代参与方权限。',
      cards: [
        { label: '数据', value: '仅当前角色可访问', note: '服务器将事实限制在当前组织和权限范围内。', icon: 'participants' },
        { label: '模式', value: '只读', note: 'AI 解释并提出建议，但不会改变交易状态。', icon: 'documents' },
        { label: '操作', value: '由人工确认', note: '请求、升级和重要操作仍由用户执行。', icon: 'check' },
        { label: '解释', value: '依据清晰可见', note: '原因和影响与具体事实、文件和期限相关联。', icon: 'intelligence' },
      ],
    },
    final: {
      eyebrow: '下一步', title: '在你的角色范围内体验 AI', lead: '接入组织后，助手会解释可访问的交易、阻塞、依据和下一步。', primary: '登录平台', secondary: '查看演示交易',
    },
  },
};

const SCENARIO_KEYS: ScenarioKey[] = ['documents', 'quality', 'logistics'];
const ROLE_KEYS: RoleKey[] = ['buyer', 'seller', 'operator'];

function resolveLocale(locale: string): Locale {
  if (locale === 'en' || locale === 'zh') return locale;
  return 'ru';
}

export function PublicAiInActionExperience({ locale }: { locale: string }) {
  const localeKey = resolveLocale(locale);
  const ui = COPY[localeKey];
  const [scenarioKey, setScenarioKey] = React.useState<ScenarioKey>('documents');
  const [roleKey, setRoleKey] = React.useState<RoleKey>('buyer');
  const [phaseIndex, setPhaseIndex] = React.useState(0);
  const [playing, setPlaying] = React.useState(true);
  const [selectedFact, setSelectedFact] = React.useState(0);
  const [confirmed, setConfirmed] = React.useState(false);
  const [feedback, setFeedback] = React.useState<'useful' | 'adjust' | null>(null);
  const [reducedMotion, setReducedMotion] = React.useState(false);

  const scenario = ui.scenarios[scenarioKey];
  const role = ui.roles[roleKey];
  const roleAction = scenario.actions[roleKey];
  const phase = ui.phases[phaseIndex] ?? ui.phases[0]!;
  const visibleFactCount = Math.min(scenario.facts.length, Math.max(1, phaseIndex + 1));
  const factIndex = Math.min(selectedFact, visibleFactCount - 1);
  const activeFact = scenario.facts[factIndex] ?? scenario.facts[0]!;

  React.useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      setReducedMotion(media.matches);
      if (media.matches) setPlaying(false);
    };
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);

  React.useEffect(() => {
    if (!playing || reducedMotion) return;
    const timer = window.setInterval(() => {
      setPhaseIndex((current) => (current + 1) % ui.phases.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [playing, reducedMotion, ui.phases.length]);

  const reset = React.useCallback(() => {
    setPhaseIndex(0);
    setSelectedFact(0);
    setConfirmed(false);
    setFeedback(null);
  }, []);

  const changeScenario = (next: ScenarioKey) => {
    setScenarioKey(next);
    reset();
  };

  const changeRole = (next: RoleKey) => {
    setRoleKey(next);
    reset();
  };

  const sectionTitle = localeKey === 'ru'
    ? 'Посмотрите работу ИИ по шагам'
    : localeKey === 'en'
      ? 'See the AI flow step by step'
      : '逐步查看 AI 的工作过程';
  const sectionLead = localeKey === 'ru'
    ? 'Переключайте сценарий и роль, запускайте анимацию, открывайте основания и подтверждайте демонстрационный следующий шаг.'
    : localeKey === 'en'
      ? 'Switch scenario and role, play the animation, open evidence and confirm a demonstrative next step.'
      : '切换场景与角色，播放动画，查看依据并确认演示中的下一步。';
  const factBoundary = localeKey === 'ru'
    ? 'ИИ получает только факты, доступные выбранной роли.'
    : localeKey === 'en'
      ? 'AI receives only facts available to the selected role.'
      : 'AI 只接收当前角色可访问的事实。';

  return (
    <div className={styles.experience} data-phase={phaseIndex} data-playing={playing ? 'true' : 'false'}>
      <section className={styles.hero} aria-labelledby='pc-ai-demo-title'>
        <div className={styles.shell}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <span className='pc-ppe-kicker'>{ui.hero.eyebrow}</span>
              <h1 id='pc-ai-demo-title'>{ui.hero.title}</h1>
              <p>{ui.hero.lead}</p>
              <div className={styles.heroActions}>
                <a href='#scenario' className={styles.primaryLink}><span>{ui.hero.primary}</span><PublicExperienceIcon name='arrow' size={20} /></a>
                <a href='#boundaries' className={styles.secondaryLink}>{ui.hero.secondary}</a>
              </div>
              <ul className={styles.heroBadges} aria-label={ui.hero.eyebrow}>
                {ui.hero.badges.map((badge, index) => (
                  <li key={badge}>
                    <PublicExperienceIcon name={index === 0 ? 'participants' : index === 1 ? 'documents' : index === 2 ? 'compliance' : 'check'} size={17} />
                    <span>{badge}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.heroVisual} aria-hidden='true'>
              <div className={styles.heroGridLines} />
              <span className={styles.heroSignal} data-position='one'><i /></span>
              <span className={styles.heroSignal} data-position='two'><i /></span>
              <span className={styles.heroSignal} data-position='three'><i /></span>
              <div className={styles.heroCore}>
                <span className={styles.heroCoreIcon}><PublicExperienceIcon name='intelligence' size={40} /></span>
                <strong>AI</strong>
                <small>{phase.short}</small>
              </div>
              <div className={styles.heroOutput}>
                <span>{scenario.short}</span>
                <strong>{scenario.title}</strong>
                <small>{roleAction.action}</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id='scenario' className={styles.scenarioSection} aria-labelledby='pc-ai-scenario-title'>
        <div className={styles.shell}>
          <header className={styles.sectionHeader}>
            <span className='pc-ppe-section-eyebrow'>{ui.hero.eyebrow}</span>
            <h2 id='pc-ai-scenario-title'>{sectionTitle}</h2>
            <p>{sectionLead}</p>
          </header>

          <div className={styles.selectorGrid}>
            <fieldset className={styles.selector}>
              <legend>{ui.labels.scenario}</legend>
              <div className={styles.segmented}>
                {SCENARIO_KEYS.map((key) => (
                  <button key={key} type='button' aria-pressed={scenarioKey === key} data-active={scenarioKey === key ? 'true' : 'false'} onClick={() => changeScenario(key)}>{ui.scenarios[key].label}</button>
                ))}
              </div>
            </fieldset>
            <fieldset className={styles.selector}>
              <legend>{ui.labels.role}</legend>
              <div className={styles.segmented}>
                {ROLE_KEYS.map((key) => (
                  <button key={key} type='button' aria-pressed={roleKey === key} data-active={roleKey === key ? 'true' : 'false'} onClick={() => changeRole(key)}>
                    <PublicExperienceIcon name={ui.roles[key].icon} size={17} />
                    {ui.roles[key].label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className={styles.runStatus} role='status' aria-live='polite'>
            <span data-live={playing && !reducedMotion ? 'true' : 'false'} />
            <strong>{playing && !reducedMotion ? ui.labels.running : ui.labels.paused}</strong>
            <span>{phase.label}: {phase.result}</span>
          </div>

          <ol className={styles.phaseTrack} aria-label={ui.labels.analysis}>
            {ui.phases.map((item, index) => (
              <li key={item.label} data-state={index < phaseIndex ? 'complete' : index === phaseIndex ? 'active' : 'pending'}>
                <button type='button' aria-current={index === phaseIndex ? 'step' : undefined} onClick={() => setPhaseIndex(index)}>
                  <span className={styles.phaseIndex}>{index + 1}</span>
                  <span className={styles.phaseIcon}><PublicExperienceIcon name={item.icon} size={19} /></span>
                  <span><strong>{item.short}</strong><small>{item.label}</small></span>
                </button>
              </li>
            ))}
          </ol>

          <div className={styles.cockpit}>
            <article className={styles.factPanel}>
              <header>
                <div><span>{ui.labels.facts}</span><h3>{scenario.short}</h3></div>
                <small>{visibleFactCount}/{scenario.facts.length}</small>
              </header>
              <p>{factBoundary}</p>
              <ul className={styles.factList}>
                {scenario.facts.map((fact, index) => {
                  const visible = index < visibleFactCount;
                  const selected = visible && index === factIndex;
                  return (
                    <li key={`${scenarioKey}-${fact.label}`} data-visible={visible ? 'true' : 'false'}>
                      <button type='button' disabled={!visible} aria-pressed={selected} data-selected={selected ? 'true' : 'false'} data-tone={fact.attention ? 'attention' : 'confirmed'} onClick={() => setSelectedFact(index)}>
                        <span className={styles.factIcon}><PublicExperienceIcon name={fact.icon} size={19} /></span>
                        <span><small>{fact.label}</small><strong>{visible ? fact.value : '••••••••'}</strong></span>
                        <i aria-hidden='true' />
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className={styles.evidenceDetail} aria-live='polite'>
                <span>{ui.labels.evidence}</span>
                <strong>{activeFact.source}</strong>
                <p>{activeFact.detail}</p>
              </div>
            </article>

            <article className={styles.aiPanel} aria-labelledby='pc-ai-core-title'>
              <header><span>{ui.labels.analysis}</span><small>read_only</small></header>
              <div className={styles.aiStage}>
                <div className={styles.orbit} aria-hidden='true'>
                  <span className={styles.orbitRing} data-ring='one' />
                  <span className={styles.orbitRing} data-ring='two' />
                  <span className={styles.orbitRing} data-ring='three' />
                  <span className={styles.scanner} />
                  <span className={styles.orbitNode} data-node='one' />
                  <span className={styles.orbitNode} data-node='two' />
                  <span className={styles.orbitNode} data-node='three' />
                  <div className={styles.aiOrb}><PublicExperienceIcon name={phase.icon} size={34} /></div>
                </div>
                <div className={styles.aiNarrative} role='status' aria-live='polite'>
                  <span>{phase.short}</span>
                  <h3 id='pc-ai-core-title'>{phase.label}</h3>
                  <p>{phase.description}</p>
                  <strong>{phase.result}</strong>
                </div>
              </div>
              <dl className={styles.aiContracts}>
                <div><dt>scope</dt><dd>{role.label}</dd></div>
                <div><dt>facts</dt><dd>{visibleFactCount} verified</dd></div>
                <div><dt>action</dt><dd>confirmation_required</dd></div>
              </dl>
            </article>

            <article className={styles.decisionPanel} data-ready={phaseIndex >= 3 ? 'true' : 'false'}>
              <header>
                <div><span>{ui.labels.result}</span><small>{role.label} · {role.focus}</small></div>
                <span className={styles.riskBadge}><PublicExperienceIcon name='risk' size={17} />{scenario.short}</span>
              </header>
              <h3>{phaseIndex >= 2 ? scenario.title : '—'}</h3>
              <div className={styles.decisionReason} data-visible={phaseIndex >= 3 ? 'true' : 'false'}>
                <span>{ui.labels.reason}</span><p>{scenario.reason}</p>
              </div>
              <dl className={styles.metrics}>
                <div><dt>{ui.labels.impact}</dt><dd>{phaseIndex >= 3 ? scenario.impact : '—'}</dd></div>
                <div><dt>{ui.labels.deadline}</dt><dd>{phaseIndex >= 2 ? scenario.deadline : '—'}</dd></div>
                <div><dt>{ui.labels.money}</dt><dd>{phaseIndex >= 2 ? scenario.money : '—'}</dd></div>
                <div><dt>{ui.labels.owner}</dt><dd>{phaseIndex >= 4 ? roleAction.owner : '—'}</dd></div>
              </dl>
              <div className={styles.nextAction} data-visible={phaseIndex >= 4 ? 'true' : 'false'}>
                <span>{ui.labels.next}</span><strong>{roleAction.action}</strong><p>{roleAction.outcome}</p>
              </div>
              <button type='button' className={styles.confirmButton} disabled={phaseIndex < 4 || confirmed} data-confirmed={confirmed ? 'true' : 'false'} onClick={() => setConfirmed(true)}>
                <PublicExperienceIcon name='check' size={19} />
                <span>{confirmed ? ui.labels.confirmed : ui.labels.confirm}</span>
              </button>
              <p className={styles.controlNote}>{ui.labels.control}</p>
              <div className={styles.feedback}>
                <span>{feedback === 'useful' ? ui.labels.usefulDone : feedback === 'adjust' ? ui.labels.adjustDone : ''}</span>
                <div>
                  <button type='button' aria-pressed={feedback === 'useful'} onClick={() => setFeedback('useful')}>{ui.labels.useful}</button>
                  <button type='button' aria-pressed={feedback === 'adjust'} onClick={() => setFeedback('adjust')}>{ui.labels.adjust}</button>
                </div>
              </div>
            </article>
          </div>

          <div className={styles.transportControls}>
            <button type='button' onClick={() => setPhaseIndex((current) => (current - 1 + ui.phases.length) % ui.phases.length)}>
              <span className={styles.reverseArrow}><PublicExperienceIcon name='arrow' size={19} /></span>{ui.labels.previous}
            </button>
            <button type='button' className={styles.playButton} onClick={() => setPlaying((current) => !current)} aria-pressed={playing}>
              <PublicExperienceIcon name={playing ? 'pause' : 'play'} size={19} />{playing ? ui.labels.pause : ui.labels.play}
            </button>
            <button type='button' onClick={() => setPhaseIndex((current) => (current + 1) % ui.phases.length)}>
              {ui.labels.nextStep}<PublicExperienceIcon name='arrow' size={19} />
            </button>
            <button type='button' onClick={reset}>{ui.labels.reset}</button>
          </div>
          {reducedMotion ? <p className={styles.reducedMotionNote}>{ui.labels.reduced}</p> : null}
        </div>
      </section>

      <section id='principles' className={styles.principlesSection} aria-labelledby='pc-ai-principles-title'>
        <div className={styles.shell}>
          <header className={styles.sectionHeader}>
            <span className='pc-ppe-section-eyebrow'>{ui.principles.eyebrow}</span>
            <h2 id='pc-ai-principles-title'>{ui.principles.title}</h2>
            <p>{ui.principles.lead}</p>
          </header>
          <div className={styles.principleGrid}>
            {ui.principles.items.map((item, index) => (
              <article key={item.title}>
                <span className={styles.principleNumber}>{String(index + 1).padStart(2, '0')}</span>
                <span className={styles.principleIcon}><PublicExperienceIcon name={item.icon} size={24} /></span>
                <h3>{item.title}</h3><p>{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id='boundaries' className={styles.boundarySection} aria-labelledby='pc-ai-boundary-title'>
        <div className={styles.shell}>
          <header className={styles.sectionHeader}>
            <span className='pc-ppe-section-eyebrow'>{ui.boundary.eyebrow}</span>
            <h2 id='pc-ai-boundary-title'>{ui.boundary.title}</h2>
            <p>{ui.boundary.lead}</p>
          </header>
          <div className={styles.boundaryGrid}>
            {ui.boundary.cards.map((card) => (
              <article key={card.label}>
                <span className={styles.boundaryIcon}><PublicExperienceIcon name={card.icon} size={23} /></span>
                <small>{card.label}</small><strong>{card.value}</strong><p>{card.note}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.finalSection} aria-labelledby='pc-ai-final-title'>
        <div className={styles.shell}>
          <div className={styles.finalPanel}>
            <span className='pc-ppe-section-eyebrow'>{ui.final.eyebrow}</span>
            <h2 id='pc-ai-final-title'>{ui.final.title}</h2>
            <p>{ui.final.lead}</p>
            <div className={styles.finalActions}>
              <a href='/platform-v7/login' className={styles.primaryLink}><span>{ui.final.primary}</span><PublicExperienceIcon name='arrow' size={20} /></a>
              <a href={`/platform-v7/how-it-works?lang=${localeKey}&entry=deal`} className={styles.secondaryLink}>{ui.final.secondary}</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
