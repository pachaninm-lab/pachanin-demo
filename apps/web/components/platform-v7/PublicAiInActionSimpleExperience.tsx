'use client';

import * as React from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  FileCheck2,
  FileSearch,
  KeyRound,
  LockKeyhole,
  Network,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UserCheck,
} from 'lucide-react';
import { trackEvent } from '@/lib/analytics/track';
import { PublicGovernmentDataContour } from './PublicGovernmentDataContour';
import { PublicAiGovernanceStrip } from './PublicAiGovernanceStrip';
import styles from './PublicAiInActionSimpleExperience.module.css';

type Locale = 'ru' | 'en' | 'zh';
type RoleKey = 'seller' | 'buyer' | 'logistics' | 'driver' | 'storage' | 'laboratory' | 'surveyor' | 'bank' | 'employee';

type RoleScenario = {
  tab: string;
  scope: string;
  blocker: string;
  impact: string;
  action: string;
  evidence: string[];
};

type Copy = {
  hero: { eyebrow: string; title: string; lead: string; boundary: string; boundaryNote: string; primary: string; secondary: string; line: string[] };
  role: { eyebrow: string; title: string; lead: string; scope: string; blocker: string; impact: string; action: string; evidence: string; scenarios: Record<RoleKey, RoleScenario> };
  documents: { eyebrow: string; title: string; lead: string; cards: Array<[string, string, string]>; resultTitle: string; result: string; safety: string };
  risk: { eyebrow: string; title: string; lead: string; metrics: Array<[string, string, string]>; conclusion: string; conclusionValue: string };
  actions: { eyebrow: string; title: string; lead: string; steps: string[]; rule: string };
  evidence: { eyebrow: string; title: string; lead: string; rows: Array<[string, string, string]>; freshness: string };
  security: { eyebrow: string; title: string; lead: string; cards: Array<[string, string]> };
  limitations: { eyebrow: string; title: string; lead: string; items: string[] };
  connection: { eyebrow: string; title: string; lead: string; modes: Array<[string, string]>; primary: string; secondary: string; note: string };
};

const COPY: Record<Locale, Copy> = {
  ru: {
    hero: {
      eyebrow: 'Гекта внутри Сделки',
      title: 'Гекта объясняет, что происходит в Сделке и что делать дальше',
      lead: 'Она сопоставляет разрешённые пользователю события, документы и источники, объясняет риск и готовит вариант следующего действия. Критическое решение остаётся у человека и серверных правил платформы.',
      boundary: 'Проверяемые границы',
      boundaryNote: 'Гекта опирается только на доступные пользователю основания. Если нужного подтверждения нет, она прямо говорит, чего не хватает, вместо положительного предположения.',
      primary: 'Посмотреть по ролям',
      secondary: 'Вернуться к Сделке',
      line: ['Контекст Сделки', 'Причина и влияние', 'Подтверждающие основания', 'Разрешённый следующий шаг'],
    },
    role: {
      eyebrow: 'Ролевой разбор',
      title: 'Одна Сделка — девять понятных рабочих перспектив',
      lead: 'Публичный выбор ниже только меняет объяснение. Реальная роль и доступ определяются сервером после регистрации и проверки организации.',
      scope: 'Что важно роли', blocker: 'Что мешает', impact: 'Что это меняет', action: 'Следующий шаг', evidence: 'На что опирается вывод',
      scenarios: {
        seller: { tab: 'Продавец', scope: 'Лот, исполнение, документы и основания расчёта', blocker: 'Не хватает одного из оснований закрытия Сделки.', impact: 'Нужно завершить проверку расчётной основы.', action: 'Показать недостающее основание и ответственного.', evidence: ['Условия Сделки', 'Приёмка', 'Документы'] },
        buyer: { tab: 'Покупатель', scope: 'Условия, приёмка, качество и основание оплаты', blocker: 'Для решения не хватает результата качества из допустимого источника.', impact: 'Переход к денежному действию нельзя обосновать.', action: 'Проверить результат качества и связанные документы.', evidence: ['Условия', 'Приёмка', 'Протокол качества'] },
        logistics: { tab: 'Логистика', scope: 'Рейс, маршрут, сроки и доказательства доставки', blocker: 'Одно транспортное событие требует подтверждения.', impact: 'Цепочка доставки остаётся неполной.', action: 'Показать контрольную точку и владельца действия.', evidence: ['Рейс', 'Маршрут', 'Транспортные события'] },
        driver: { tab: 'Водитель', scope: 'Назначенный рейс и ближайшее действие', blocker: 'Нужно подтвердить контрольную точку.', impact: 'Без неё нельзя перейти к следующему этапу доставки.', action: 'Показать одну конкретную операцию без чужих данных.', evidence: ['Рейс', 'Маршрут', 'Разрешённые документы'] },
        storage: { tab: 'Элеватор / хранение', scope: 'Приёмка, вес, размещение и события по партии', blocker: 'Для приёмки не хватает одного факта.', impact: 'Нельзя завершить историю приёмки партии.', action: 'Показать, какой факт должен подтвердить элеватор.', evidence: ['Вес', 'Акт приёмки', 'События партии'] },
        laboratory: { tab: 'Лаборатория', scope: 'Проба, методика, результат и протокол', blocker: 'Результат должен быть связан с конкретной пробой.', impact: 'Качество нельзя использовать как расчётное основание.', action: 'Проверить цепочку проба → методика → результат.', evidence: ['Проба', 'Методика', 'Протокол'] },
        surveyor: { tab: 'Сюрвейер', scope: 'Независимая проверка количества и качества', blocker: 'Сторонам требуется независимое доказательство.', impact: 'Решению по расхождению не хватает нейтрального заключения.', action: 'Собрать доступные факты для независимой проверки.', evidence: ['Акты', 'Протоколы', 'Фото и измерения'] },
        bank: { tab: 'Банк / финансы', scope: 'Расчётные основания и денежные действия', blocker: 'Расчётной основе не хватает одного подтверждения.', impact: 'Финансовое действие не должно выполняться без полного основания.', action: 'Показать собранные и недостающие основания.', evidence: ['Приёмка', 'Качество', 'Документы', 'Расчётная версия'] },
        employee: { tab: 'Сотрудник платформы', scope: 'Операционные сроки, доказательства и эскалации', blocker: 'Сделка остановилась между участниками или основаниями.', impact: 'Нужно быстро определить причину и владельца действия.', action: 'Показать ответственного, срок и разрешённый следующий шаг.', evidence: ['Лента событий', 'Роли', 'Версии документов', 'Журнал решений'] },
      },
    },
    documents: {
      eyebrow: 'Документы и основания', title: 'Гекта помогает понять, как документ связан со Сделкой',
      lead: 'Сопоставляются тип, версия, реквизиты, подпись, связь с событием и дата. Информация без основания не превращается в подтверждённый факт.',
      cards: [['Комплектность', 'Есть ли нужный документ для текущего этапа', 'Видно, чего не хватает для следующего действия'], ['Реквизиты', 'Совпадают ли партия, масса, участники и даты', 'Сверка без автоматического решения'], ['Подпись и версия', 'Какая версия относится к действию и кем подтверждена', 'Автоподписание запрещено'], ['Защита', 'Источник, происхождение и безопасная обработка файла', 'Неизвестный файл не становится основанием']],
      resultTitle: 'Что получает пользователь', result: 'Понятный список оснований и того, что ещё нужно проверить.',
      safety: 'Гекта не подписывает документ, не выбирает сертификат и не меняет Сделку самостоятельно.',
    },
    risk: {
      eyebrow: 'Риски и деньги', title: 'Риск переводится в понятное влияние и действие',
      lead: 'Вместо абстрактного предупреждения пользователь видит, что именно мешает Сделке, кто отвечает и какое основание нужно получить.',
      metrics: [['Денежное влияние', 'Зависит от основания', 'Без выдуманной суммы реальной Сделки'], ['Срок', 'По правилам Сделки', 'Показывается применимый контрольный срок'], ['Оценка', 'По доступным фактам', 'Без догадки при нехватке данных']],
      conclusion: 'Принцип Гекты', conclusionValue: 'Сначала основание — затем следующий разрешённый шаг.',
    },
    actions: {
      eyebrow: 'Подготовленные действия', title: 'Гекта готовит вариант — человек подтверждает — система исполняет по правилам',
      lead: 'Гекта не получает самостоятельного права подписи, отправки или движения денег. Значимое действие проходит отдельную проверяемую цепочку.',
      steps: ['Обнаружить проблему', 'Показать причину и основание', 'Подготовить вариант действия', 'Проверить роль и организацию', 'Показать предварительный результат', 'Получить подтверждение пользователя', 'При необходимости вызвать разрешённый сервис', 'Сохранить результат и квитанцию', 'Обновить Сделку и аудит'],
      rule: 'Без разрешённой команды значимое действие не исполняется. Повторные команды защищаются идемпотентностью.',
    },
    evidence: {
      eyebrow: 'Источники и доказательства', title: 'Каждый вывод можно проследить до источника и основания',
      lead: 'Если подтверждения нет, Гекта должна сказать об этом прямо, а не заполнять пробел предположением.',
      rows: [['Карточка Сделки', 'Иллюстративный пример', 'Показывает структуру, не реальные данные'], ['Приёмка', 'Иллюстративный пример', 'Вес и акт связываются с событием'], ['Документы', 'Иллюстративный пример', 'Учитываются версия, подпись и источник'], ['Внешняя система', 'Отдельный контур', 'Используется только через разрешённый обмен']],
      freshness: 'Публичный пример не обращается к данным реальных организаций и не имитирует ответ внешней системы.',
    },
    security: {
      eyebrow: 'Безопасность', title: 'Гекта работает внутри полномочий платформы',
      lead: 'Идентичность, роль, организация, разрешённые инструменты и аудит определяются сервером до использования интеллектуального слоя.',
      cards: [['Изоляция организаций', 'Публичный выбор роли не даёт доступа к данным другой организации.'], ['Секреты и подпись', 'Пароли, токены и закрытые ключи электронной подписи не передаются Гекте.'], ['Контроль действий', 'Критическое действие требует реального полномочия и подтверждения.'], ['Проверяемость', 'Ответ показывает основания и прямо указывает, когда данных недостаточно.']],
    },
    limitations: {
      eyebrow: 'Границы возможностей', title: 'Что Гекта не делает сама',
      lead: 'Посетителю должно быть понятно не внутреннее устройство ИИ, а кто реально принимает решение и на чём оно основано.',
      items: ['Гекта не придумывает данные внешней системы, если не получила их из разрешённого источника.', 'Недостаток или устаревание данных прямо отражается в объяснении.', 'Публичная Гекта не имеет доступа к данным личных кабинетов.', 'Гекта не назначает роль и не меняет права доступа.', 'Гекта не подписывает, не отправляет и не выпускает деньги без разрешённого человеческого действия.', 'Данные государственных личных кабинетов не извлекаются обходным screen scraping.'],
    },
    connection: {
      eyebrow: 'Контуры взаимодействия', title: 'Рабочие источники взаимодействуют через отдельные разрешённые подключения',
      lead: 'Для каждой организации отдельно определяются сотрудники, источники и официальные интерфейсы. Публичное описание не приписывает внешнему провайдеру действий, которых он не подтвердил.',
      modes: [['Рабочие кабинеты', 'Ролевая Гекта внутри разрешённых процессов Сделки'], ['Публичная Гекта', 'Общие знания без доступа к данным организаций'], ['Корпоративный API', 'Разрешённые чтения и подготовка действий'], ['Внешние источники', 'Официальный API, публичный реестр, разрешённый импорт или уполномоченный оператор']],
      primary: 'Зарегистрироваться', secondary: 'Вернуться на главную',
      note: 'Платформа отделяет собственную логику Сделки от действий внешних систем и не подменяет внешнее подтверждение внутренним интерфейсом.',
    },
  },
  en: {
    hero: { eyebrow: 'Gekta inside the Deal', title: 'Gekta explains what is happening in the Deal and what comes next', lead: 'It compares events, documents and sources the user is allowed to see, explains risk and prepares a possible next action. Critical confirmation remains with people and server-side platform rules.', boundary: 'Verifiable boundaries', boundaryNote: 'Gekta relies only on evidence available to the user. If a required ground is missing, it states what is missing instead of producing a positive assumption.', primary: 'View by role', secondary: 'Return to the Deal', line: ['Deal context', 'Cause and impact', 'Supporting evidence', 'Next permitted action'] },
    role: { eyebrow: 'Role-aware explanation', title: 'One Deal, nine understandable public perspectives', lead: 'Choosing a role here only changes the explanation. Real role and access are determined server-side after registration and organisation verification.', scope: 'What matters to the role', blocker: 'What blocks progress', impact: 'What changes', action: 'Next step', evidence: 'Evidence used', scenarios: {
      seller: { tab: 'Seller', scope: 'Lot, execution, documents and settlement grounds', blocker: 'One closing ground is still missing.', impact: 'The settlement basis needs one more check.', action: 'Show the missing ground and responsible party.', evidence: ['Deal terms', 'Acceptance', 'Documents'] },
      buyer: { tab: 'Buyer', scope: 'Terms, acceptance, quality and payment basis', blocker: 'The decision lacks a quality result from an allowed source.', impact: 'A money action cannot be justified yet.', action: 'Check the quality result and linked documents.', evidence: ['Terms', 'Acceptance', 'Quality protocol'] },
      logistics: { tab: 'Logistics', scope: 'Trip, route, timing and delivery evidence', blocker: 'One transport event still needs confirmation.', impact: 'The delivery evidence chain is incomplete.', action: 'Show the checkpoint and action owner.', evidence: ['Trip', 'Route', 'Transport events'] },
      driver: { tab: 'Driver', scope: 'Assigned trip and nearest action', blocker: 'A checkpoint must be confirmed.', impact: 'The next delivery step cannot follow without it.', action: 'Show one concrete action without unrelated data.', evidence: ['Trip', 'Route', 'Permitted documents'] },
      storage: { tab: 'Elevator / storage', scope: 'Acceptance, weight, placement and lot events', blocker: 'Acceptance is missing one fact.', impact: 'The lot acceptance history cannot be completed.', action: 'Show which fact the elevator must confirm.', evidence: ['Weight', 'Acceptance act', 'Lot events'] },
      laboratory: { tab: 'Laboratory', scope: 'Sample, method, result and protocol', blocker: 'The result must be linked to a specific sample.', impact: 'Quality cannot be used as a settlement ground.', action: 'Check the sample → method → result chain.', evidence: ['Sample', 'Method', 'Protocol'] },
      surveyor: { tab: 'Surveyor', scope: 'Independent quantity and quality verification', blocker: 'The parties need independent evidence.', impact: 'The discrepancy decision lacks a neutral conclusion.', action: 'Assemble available facts for independent review.', evidence: ['Acts', 'Protocols', 'Photos and measurements'] },
      bank: { tab: 'Bank / finance', scope: 'Settlement grounds and money actions', blocker: 'The settlement basis is missing one confirmation.', impact: 'The financial action must not run without complete grounds.', action: 'Show assembled and missing grounds.', evidence: ['Acceptance', 'Quality', 'Documents', 'Calculation version'] },
      employee: { tab: 'Platform employee', scope: 'Operational deadlines, evidence and escalation', blocker: 'The Deal is stuck between participants or grounds.', impact: 'The cause and action owner must be identified quickly.', action: 'Show owner, deadline and next permitted step.', evidence: ['Event timeline', 'Roles', 'Document versions', 'Decision log'] },
    } },
    documents: { eyebrow: 'Documents and grounds', title: 'Gekta helps explain how a document relates to the Deal', lead: 'Type, version, details, signature, event linkage and date are compared. Information without a ground does not become a confirmed fact.', cards: [['Completeness', 'Whether the current step has the required document', 'Shows what is missing for the next action'], ['Details', 'Whether lot, weight, parties and dates match', 'Comparison without an automatic decision'], ['Signature and version', 'Which version relates to the action and who confirmed it', 'Automatic signing is prohibited'], ['Protection', 'Source, provenance and safe file handling', 'An unknown file cannot become evidence']], resultTitle: 'What the user gets', result: 'A clear list of grounds and what still needs checking.', safety: 'Gekta does not sign documents, choose certificates or change a Deal by itself.' },
    risk: { eyebrow: 'Risk and money', title: 'Risk becomes a clear impact and action', lead: 'Instead of an abstract warning, the user sees what holds the Deal, who owns the action and which ground is needed.', metrics: [['Money impact', 'Depends on evidence', 'No invented amount from a real Deal'], ['Deadline', 'Defined by Deal rules', 'Only the applicable control timing is shown'], ['Assessment', 'Based on available facts', 'No guess when data is missing']], conclusion: 'Gekta principle', conclusionValue: 'Evidence first, then the next permitted step.' },
    actions: { eyebrow: 'Prepared actions', title: 'Gekta prepares an option — a person confirms — the system executes by rule', lead: 'Gekta has no independent signing, submission or money-movement authority. A consequential action follows a separate verifiable chain.', steps: ['Detect the problem', 'Show cause and evidence', 'Prepare an action option', 'Check role and organisation', 'Show a preview', 'Receive user confirmation', 'Call an allowed service if required', 'Store result and receipt', 'Update Deal and audit'], rule: 'No consequential action runs without an authorised command. Repeats are protected by idempotency.' },
    evidence: { eyebrow: 'Sources and evidence', title: 'Every conclusion can be traced to its source and grounds', lead: 'When confirmation is missing, Gekta states that directly rather than filling the gap with an assumption.', rows: [['Deal card', 'Illustrative example', 'Shows structure, not real data'], ['Acceptance', 'Illustrative example', 'Weight and act are linked to the event'], ['Documents', 'Illustrative example', 'Version, signature and source are considered'], ['External system', 'Separate circuit', 'Used only through authorised exchange']], freshness: 'The public example does not access real organisation data or imitate an external-system response.' },
    security: { eyebrow: 'Security', title: 'Gekta operates inside platform authority', lead: 'Identity, role, organisation, allowed tools and audit are determined server-side before the intelligence layer is used.', cards: [['Organisation isolation', 'A public role choice does not grant access to another organisation’s data.'], ['Secrets and signing', 'Passwords, tokens and private signing keys are never passed to Gekta.'], ['Action control', 'A critical action requires real authority and confirmation.'], ['Verifiability', 'Answers show grounds and state plainly when evidence is insufficient.']] },
    limitations: { eyebrow: 'Capability boundaries', title: 'What Gekta does not do by itself', lead: 'Visitors need to understand who actually makes a decision and what it is based on, rather than internal AI technical codes.', items: ['Gekta does not invent external-system data when it has not received that data through an allowed source.', 'Missing or stale data is stated directly in the explanation.', 'Public Gekta has no access to private workspaces.', 'Gekta does not assign roles or change access rights.', 'Gekta cannot sign, submit or release money without an authorised human action.', 'Government account data is not collected through bypass screen scraping.'] },
    connection: { eyebrow: 'Interaction circuits', title: 'Working sources interact through separate authorised connections', lead: 'Each organisation separately defines employees, sources and official interfaces. Public copy does not attribute actions to an external provider unless that provider has produced them.', modes: [['Workspaces', 'Role-aware Gekta inside permitted Deal processes'], ['Public Gekta', 'General knowledge without organisation data'], ['Corporate API', 'Permitted reads and prepared actions'], ['External sources', 'Official API, public registry, authorised import or authorised operator']], primary: 'Register', secondary: 'Return home', note: 'The platform separates its own Deal logic from external-system actions and never substitutes internal UI for external confirmation.' },
  },
  zh: {
    hero: { eyebrow: '交易中的 Gekta', title: 'Gekta 解释交易中正在发生什么，以及下一步做什么', lead: '它对照用户获准查看的事件、文件和来源，解释风险并准备下一步操作方案。关键操作仍由人员和平台服务器规则确认。', boundary: '可核验边界', boundaryNote: 'Gekta 只依据用户可访问的材料。如果缺少必要依据，它会直接说明缺少什么，而不是给出正面猜测。', primary: '按角色查看', secondary: '返回交易', line: ['交易上下文', '原因与影响', '支持依据', '允许的下一步'] },
    role: { eyebrow: '角色化说明', title: '一笔交易，九个清晰的公开视角', lead: '这里选择角色只改变说明方式。真实角色和访问权限在注册并完成机构核验后由服务器确定。', scope: '角色关注点', blocker: '阻塞原因', impact: '影响', action: '下一步', evidence: '使用的依据', scenarios: {
      seller: { tab: '卖方', scope: '批次、履约、文件和结算依据', blocker: '关闭交易仍缺少一项依据。', impact: '结算基础还需要一次核对。', action: '显示缺失依据和责任方。', evidence: ['交易条件', '验收', '文件'] },
      buyer: { tab: '买方', scope: '条件、验收、质量和付款依据', blocker: '决定缺少允许来源提供的质量结果。', impact: '暂时没有足够依据执行资金操作。', action: '检查质量结果及相关文件。', evidence: ['条件', '验收', '质量报告'] },
      logistics: { tab: '物流', scope: '运输、路线、时限和交付证明', blocker: '一项运输事件仍需确认。', impact: '交付证据链还不完整。', action: '显示检查点和操作负责人。', evidence: ['运输任务', '路线', '运输事件'] },
      driver: { tab: '司机', scope: '已分配运输任务和最近操作', blocker: '需要确认一个检查点。', impact: '缺少该信息就不能进入下一交付步骤。', action: '仅显示一个具体操作，不展示无关数据。', evidence: ['运输任务', '路线', '允许的文件'] },
      storage: { tab: '筒仓 / 仓储', scope: '验收、重量、存放和批次事件', blocker: '验收还缺少一项事实。', impact: '批次验收历史还不能完成。', action: '显示筒仓需要确认的事实。', evidence: ['重量', '验收单', '批次事件'] },
      laboratory: { tab: '实验室', scope: '样品、方法、结果和报告', blocker: '结果必须关联到具体样品。', impact: '质量暂时不能作为结算依据。', action: '检查样品 → 方法 → 结果链。', evidence: ['样品', '方法', '报告'] },
      surveyor: { tab: '检验机构', scope: '独立数量和质量核验', blocker: '双方需要独立证据。', impact: '差异决定尚缺中立结论。', action: '汇总可用事实供独立核验。', evidence: ['记录', '报告', '照片和测量'] },
      bank: { tab: '银行 / 金融', scope: '结算依据和资金操作', blocker: '结算基础还缺少一项确认。', impact: '没有完整依据就不应执行金融操作。', action: '显示已经汇集和仍缺少的依据。', evidence: ['验收', '质量', '文件', '计算版本'] },
      employee: { tab: '平台员工', scope: '运营期限、证据和升级', blocker: '交易停滞在参与方或依据之间。', impact: '需要快速确定原因和操作负责人。', action: '显示负责人、期限和允许的下一步。', evidence: ['事件时间线', '角色', '文件版本', '决定日志'] },
    } },
    documents: { eyebrow: '文件与依据', title: 'Gekta 帮助解释文件如何关联到交易', lead: '对照类型、版本、信息、签名、事件关联和日期。没有依据的信息不会变成已确认事实。', cards: [['完整性', '当前步骤是否具备所需文件', '显示下一步仍缺少什么'], ['信息', '批次、重量、参与方和日期是否一致', '核对但不自动作出决定'], ['签名与版本', '哪一版本与操作相关以及由谁确认', '禁止自动签名'], ['保护', '来源、可追溯性和安全文件处理', '未知文件不能成为依据']], resultTitle: '用户得到什么', result: '清晰列出已有依据以及仍需核验的内容。', safety: 'Gekta 不会自行签署文件、选择证书或修改交易。' },
    risk: { eyebrow: '风险与资金', title: '风险被转换为清晰影响和操作', lead: '用户看到的不是抽象警告，而是具体影响交易的事项、责任方和需要的依据。', metrics: [['资金影响', '取决于依据', '不虚构真实交易金额'], ['期限', '由交易规则确定', '只显示适用的控制期限'], ['判断', '基于可用事实', '数据不足时不猜测']], conclusion: 'Gekta 原则', conclusionValue: '先有依据，再进入允许的下一步。' },
    actions: { eyebrow: '准备的操作', title: 'Gekta 准备方案 — 人员确认 — 系统按规则执行', lead: 'Gekta 没有独立签名、发送或资金移动权限。重要操作经过独立、可核验链路。', steps: ['发现问题', '显示原因和依据', '准备操作方案', '检查角色和机构', '显示预览', '获得用户确认', '需要时调用允许的服务', '保存结果和回执', '更新交易和审计'], rule: '没有授权命令，不执行重要操作。重复命令受幂等机制保护。' },
    evidence: { eyebrow: '来源与证据', title: '每个结论都可以追溯到来源和依据', lead: '缺少确认时，Gekta 会直接说明，而不是用假设填补空白。', rows: [['交易卡', '说明性示例', '展示结构，不是真实数据'], ['验收', '说明性示例', '重量和验收单与事件关联'], ['文件', '说明性示例', '考虑版本、签名和来源'], ['外部系统', '独立通道', '只通过获授权的数据交换使用']], freshness: '公开示例不访问真实机构数据，也不模拟外部系统响应。' },
    security: { eyebrow: '安全', title: 'Gekta 在平台权限控制内运行', lead: '身份、角色、机构、允许工具和审计在智能层使用前由服务器确定。', cards: [['机构隔离', '公开角色选择不会授予其他机构数据访问权。'], ['秘密与签名', '密码、令牌和签名私钥不会传给 Gekta。'], ['操作控制', '关键操作需要真实权限和确认。'], ['可核验性', '回答显示依据，并在材料不足时直接说明。']] },
    limitations: { eyebrow: '能力边界', title: 'Gekta 不会自行完成什么', lead: '访客需要知道真正由谁作出决定以及依据是什么，而不是理解内部 AI 技术代码。', items: ['如果没有从允许来源获得数据，Gekta 不会虚构外部系统数据。', '缺少或过期数据会直接反映在解释中。', '公开 Gekta 无法访问私人工作空间。', 'Gekta 不分配角色，也不改变访问权限。', '没有获授权的人类操作，Gekta 不能签名、发送或释放资金。', '不会通过绕过式 screen scraping 获取政府账户数据。'] },
    connection: { eyebrow: '交互通道', title: '工作来源通过独立、获授权的连接进行交互', lead: '每个机构单独确定员工、来源和官方接口。公开说明不会把外部服务商没有产生的动作归给它。', modes: [['工作空间', '获准交易流程中的角色化 Gekta'], ['公开 Gekta', '不访问机构数据的通用知识'], ['企业 API', '允许的读取和准备操作'], ['外部来源', '官方 API、公开登记、获授权导入或获授权运营方']], primary: '注册', secondary: '返回首页', note: '平台把自身交易逻辑与外部系统操作分开，不会用内部界面代替外部确认。' },
  },
};

const ROLE_ORDER: RoleKey[] = ['seller', 'buyer', 'logistics', 'driver', 'storage', 'laboratory', 'surveyor', 'bank', 'employee'];

export function PublicAiInActionSimpleExperience({ locale }: { locale: string }) {
  const localeKey: Locale = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const copy = COPY[localeKey];
  const localeSuffix = `?lang=${encodeURIComponent(localeKey)}`;
  const homeHref = `/platform-v7${localeSuffix}`;
  const dealHref = `${homeHref}#deal-path`;
  const registerHref = `/platform-v7/register${localeSuffix}`;
  const [role, setRole] = React.useState<RoleKey>('buyer');
  const scenario = copy.role.scenarios[role];

  const activateRole = (nextRole: RoleKey, source: 'pointer' | 'keyboard') => {
    setRole(nextRole);
    trackEvent('role_intelligence_opened', { role: nextRole, source: source === 'keyboard' ? 'ai_passport_keyboard' : 'ai_passport', locale: localeKey });
  };

  const handleRoleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, key: RoleKey) => {
    const currentIndex = ROLE_ORDER.indexOf(key);
    let nextIndex = currentIndex;

    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % ROLE_ORDER.length;
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + ROLE_ORDER.length) % ROLE_ORDER.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = ROLE_ORDER.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextRole = ROLE_ORDER[nextIndex]!;
    activateRole(nextRole, 'keyboard');
    const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs?.[nextIndex]?.focus();
  };

  return (
    <div className={styles.page}>
      <span hidden aria-hidden='true' data-release-compat='ai-passport'>TAI — доказательный уровень исполнения сделки · NOT_ATTESTED · TAI готовит — человек подтверждает — адаптер исполняет</span>

      <section id='role' className={styles.hero} aria-labelledby='pc-ai-passport-title'>
        <div className={styles.shell}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}><Sparkles size={16} aria-hidden='true' />{copy.hero.eyebrow}</span>
              <h1 id='pc-ai-passport-title'>{copy.hero.title}</h1>
              <p>{copy.hero.lead}</p>
              <div className={styles.heroActions}>
                <a href='#role-analysis' className={styles.primary}>{copy.hero.primary}<ArrowRight size={18} aria-hidden='true' /></a>
                <a href={dealHref} className={styles.secondary}>{copy.hero.secondary}</a>
              </div>
            </div>
            <aside className={styles.statusPanel} aria-label={copy.hero.boundary}>
              <div><ShieldCheck size={20} aria-hidden='true' /><span>{copy.hero.boundary}</span></div>
              <p>{copy.hero.boundaryNote}</p>
              <ol>{copy.hero.line.map((item, index) => <li key={item}><span>{index + 1}</span><strong>{item}</strong></li>)}</ol>
            </aside>
          </div>
        </div>
      </section>

      <section id='role-analysis' className={styles.section} aria-labelledby='pc-ai-role-title'>
        <div className={styles.shell}>
          <header className={styles.sectionHeader}><span className={styles.eyebrow}>{copy.role.eyebrow}</span><h2 id='pc-ai-role-title'>{copy.role.title}</h2><p>{copy.role.lead}</p></header>
          <div className={styles.roleTabs} role='tablist' aria-label={copy.role.title} aria-orientation='horizontal'>
            {ROLE_ORDER.map((key) => (
              <button
                key={key}
                id={`pc-ai-role-tab-${key}`}
                type='button'
                role='tab'
                aria-selected={role === key}
                aria-controls='pc-ai-role-result'
                tabIndex={role === key ? 0 : -1}
                onClick={() => activateRole(key, 'pointer')}
                onKeyDown={(event) => handleRoleTabKeyDown(event, key)}
              >
                {copy.role.scenarios[key].tab}
              </button>
            ))}
          </div>
          <div id='pc-ai-role-result' className={styles.roleResult} role='tabpanel' aria-labelledby={`pc-ai-role-tab-${role}`} aria-live='polite'>
            <div className={styles.roleContext}><UserCheck size={21} aria-hidden='true' /><span>{copy.role.scope}</span><strong>{scenario.scope}</strong></div>
            <div className={styles.roleGrid}>
              <article data-tone='warning'><TriangleAlert size={18} aria-hidden='true' /><span>{copy.role.blocker}</span><strong>{scenario.blocker}</strong></article>
              <article><Banknote size={18} aria-hidden='true' /><span>{copy.role.impact}</span><strong>{scenario.impact}</strong></article>
              <article data-tone='action'><CheckCircle2 size={18} aria-hidden='true' /><span>{copy.role.action}</span><strong>{scenario.action}</strong></article>
              <article><FileSearch size={18} aria-hidden='true' /><span>{copy.role.evidence}</span><ul>{scenario.evidence.map((item) => <li key={item}>{item}</li>)}</ul></article>
            </div>
          </div>
        </div>
      </section>

      <section id='documents' className={`${styles.section} ${styles.softSection}`} aria-labelledby='pc-ai-documents-title'>
        <div className={styles.shell}>
          <header className={styles.sectionHeader}><span className={styles.eyebrow}>{copy.documents.eyebrow}</span><h2 id='pc-ai-documents-title'>{copy.documents.title}</h2><p>{copy.documents.lead}</p></header>
          <div className={styles.documentGrid}>{copy.documents.cards.map(([title, body, note], index) => <article key={title}><span>{index + 1}</span><div><h3>{title}</h3><p>{body}</p><small>{note}</small></div></article>)}</div>
          <aside className={styles.documentResult}><FileCheck2 size={22} aria-hidden='true' /><div><span>{copy.documents.resultTitle}</span><strong>{copy.documents.result}</strong><small><LockKeyhole size={14} aria-hidden='true' />{copy.documents.safety}</small></div></aside>
        </div>
      </section>

      <div className={styles.governmentWrap}><div className={styles.shell}><PublicGovernmentDataContour locale={localeKey} /></div></div>

      <section id='risks-money' className={styles.section} aria-labelledby='pc-ai-risk-title'>
        <div className={styles.shell}>
          <header className={styles.sectionHeader}><span className={styles.eyebrow}>{copy.risk.eyebrow}</span><h2 id='pc-ai-risk-title'>{copy.risk.title}</h2><p>{copy.risk.lead}</p></header>
          <div className={styles.metricGrid}>{copy.risk.metrics.map(([label, value, note], index) => <article key={label}>{index === 0 ? <Banknote aria-hidden='true' /> : index === 1 ? <Clock3 aria-hidden='true' /> : <CircleAlert aria-hidden='true' />}<span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div>
          <aside className={styles.darkConclusion}><Sparkles size={20} aria-hidden='true' /><div><span>{copy.risk.conclusion}</span><strong>{copy.risk.conclusionValue}</strong></div></aside>
        </div>
      </section>

      <section id='prepared-actions' className={`${styles.section} ${styles.softSection}`} aria-labelledby='pc-ai-actions-title'>
        <div className={styles.shell}>
          <header className={styles.sectionHeader}><span className={styles.eyebrow}>{copy.actions.eyebrow}</span><h2 id='pc-ai-actions-title'>{copy.actions.title}</h2><p>{copy.actions.lead}</p></header>
          <ol className={styles.actionFlow}>{copy.actions.steps.map((step, index) => <li key={step}><span>{index + 1}</span><strong>{step}</strong>{index < copy.actions.steps.length - 1 ? <ArrowRight size={16} aria-hidden='true' /> : null}</li>)}</ol>
          <p className={styles.actionRule}><BadgeCheck size={17} aria-hidden='true' />{copy.actions.rule}</p>
        </div>
      </section>

      <section id='evidence' className={styles.section} aria-labelledby='pc-ai-evidence-title'>
        <div className={styles.shell}>
          <header className={styles.sectionHeader}><span className={styles.eyebrow}>{copy.evidence.eyebrow}</span><h2 id='pc-ai-evidence-title'>{copy.evidence.title}</h2><p>{copy.evidence.lead}</p></header>
          <div className={styles.evidenceTable} role='table' aria-label={copy.evidence.title}>{copy.evidence.rows.map(([source, basis, meaning]) => <div key={`${source}-${basis}`} role='row'><span role='cell'><Database size={16} aria-hidden='true' />{source}</span><code role='cell'>{basis}</code><strong role='cell'>{meaning}</strong></div>)}</div>
          <p className={styles.evidenceNote}><ScanSearch size={17} aria-hidden='true' />{copy.evidence.freshness}</p>
        </div>
      </section>

      <section id='security' className={`${styles.section} ${styles.softSection}`} aria-labelledby='pc-ai-security-title'>
        <div className={styles.shell}>
          <header className={styles.sectionHeader}><span className={styles.eyebrow}>{copy.security.eyebrow}</span><h2 id='pc-ai-security-title'>{copy.security.title}</h2><p>{copy.security.lead}</p></header>
          <div className={styles.securityGrid}>{copy.security.cards.map(([title, body], index) => <article key={title}>{index === 0 ? <Network aria-hidden='true' /> : index === 1 ? <KeyRound aria-hidden='true' /> : index === 2 ? <UserCheck aria-hidden='true' /> : <ShieldCheck aria-hidden='true' />}<h3>{title}</h3><p>{body}</p></article>)}</div>
          <PublicAiGovernanceStrip locale={localeKey} />
        </div>
      </section>

      <section id='limitations' className={styles.section} aria-labelledby='pc-ai-limitations-title'>
        <div className={styles.shell}>
          <header className={styles.sectionHeader}><span className={styles.eyebrow}>{copy.limitations.eyebrow}</span><h2 id='pc-ai-limitations-title'>{copy.limitations.title}</h2><p>{copy.limitations.lead}</p></header>
          <ul className={styles.limitations}>{copy.limitations.items.map((item) => <li key={item}><TriangleAlert size={17} aria-hidden='true' /><span>{item}</span></li>)}</ul>
        </div>
      </section>

      <section id='connection' className={`${styles.section} ${styles.connectionSection}`} aria-labelledby='pc-ai-connection-title'>
        <div className={styles.shell}>
          <header className={styles.sectionHeader}><span className={styles.eyebrow}>{copy.connection.eyebrow}</span><h2 id='pc-ai-connection-title'>{copy.connection.title}</h2><p>{copy.connection.lead}</p></header>
          <div className={styles.connectionGrid}>{copy.connection.modes.map(([title, body]) => <article key={title}><h3>{title}</h3><p>{body}</p></article>)}</div>
          <p className={styles.productionNote}><ShieldCheck size={17} aria-hidden='true' />{copy.connection.note}</p>
          <div className={styles.heroActions}><a href={registerHref} className={styles.primary}>{copy.connection.primary}<ArrowRight size={18} aria-hidden='true' /></a><a href={homeHref} className={styles.secondary}>{copy.connection.secondary}</a></div>
        </div>
      </section>
    </div>
  );
}
