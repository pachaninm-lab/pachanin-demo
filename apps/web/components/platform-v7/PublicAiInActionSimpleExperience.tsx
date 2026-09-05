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
  hero: { eyebrow: string; title: string; lead: string; status: string; statusNote: string; primary: string; secondary: string; line: string[] };
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
      title: 'Гекта объясняет состояние Сделки и следующий шаг по доступным основаниям',
      lead: 'Она сопоставляет разрешённые пользователю события, документы и источники, показывает риск и готовит вариант следующего действия. Подтверждение критического действия остаётся у человека и серверных правил платформы.',
      status: 'Проверяемые границы',
      statusNote: 'Неподключённый источник не показывается подключённым. Неизвестные или устаревшие данные не превращаются в положительный вывод.',
      primary: 'Посмотреть по ролям',
      secondary: 'Вернуться к Сделке',
      line: ['Состояние Сделки', 'Причина и влияние', 'Подтверждающие основания', 'Разрешённый следующий шаг'],
    },
    role: {
      eyebrow: 'Ролевой разбор',
      title: 'Одна Сделка — девять понятных рабочих перспектив',
      lead: 'Публичный выбор ниже только меняет объяснение. Реальная роль и доступ определяются сервером после регистрации и проверки организации.',
      scope: 'Что важно роли', blocker: 'Что мешает', impact: 'Что это меняет', action: 'Следующий шаг', evidence: 'На что опирается вывод',
      scenarios: {
        seller: { tab: 'Продавец', scope: 'Лот, исполнение, документы и готовность расчёта', blocker: 'Не хватает подтверждения одного из оснований закрытия Сделки.', impact: 'Окончательный расчёт ещё не готов.', action: 'Показать недостающее основание и ответственного.', evidence: ['Условия Сделки', 'Приёмка', 'Документы'] },
        buyer: { tab: 'Покупатель', scope: 'Условия, приёмка, качество и основание оплаты', blocker: 'Качество ещё не подтверждено доступным источником.', impact: 'Оплату нельзя считать готовой к следующему шагу.', action: 'Проверить результат качества и связанные документы.', evidence: ['Условия', 'Приёмка', 'Протокол качества'] },
        logistics: { tab: 'Логистика', scope: 'Рейс, маршрут, сроки и подтверждение доставки', blocker: 'Одно транспортное событие требует подтверждения.', impact: 'Доставка ещё не считается полностью подтверждённой.', action: 'Показать контрольную точку и владельца действия.', evidence: ['Рейс', 'Маршрут', 'Транспортные события'] },
        driver: { tab: 'Водитель', scope: 'Назначенный рейс и ближайшее действие', blocker: 'Требуется подтверждение контрольной точки.', impact: 'Следующий этап доставки пока не открыт.', action: 'Показать одну конкретную операцию без чужих данных.', evidence: ['Рейс', 'Маршрут', 'Разрешённые документы'] },
        storage: { tab: 'Элеватор / хранение', scope: 'Приёмка, вес, размещение и статус партии', blocker: 'Приёмка не закрыта полным набором фактов.', impact: 'Партия остаётся в промежуточном состоянии.', action: 'Показать, какой факт должен подтвердить элеватор.', evidence: ['Вес', 'Акт приёмки', 'Статус партии'] },
        laboratory: { tab: 'Лаборатория', scope: 'Проба, методика, результат и протокол', blocker: 'Результат должен быть связан с конкретной пробой.', impact: 'Качество нельзя использовать как подтверждённое основание.', action: 'Проверить цепочку проба → методика → результат.', evidence: ['Проба', 'Методика', 'Протокол'] },
        surveyor: { tab: 'Сюрвейер', scope: 'Независимая проверка количества и качества', blocker: 'Сторонам требуется независимое доказательство.', impact: 'Решение по расхождению ещё не опирается на нейтральное заключение.', action: 'Собрать доступные факты для независимой проверки.', evidence: ['Акты', 'Протоколы', 'Фото и измерения'] },
        bank: { tab: 'Банк / финансы', scope: 'Расчётные основания и финансовые блокеры', blocker: 'Основание денежного действия ещё не подтверждено полностью.', impact: 'Финансовый контур не должен переходить к следующему действию.', action: 'Показать перечень подтверждённых и недостающих оснований.', evidence: ['Приёмка', 'Качество', 'Документы', 'Расчётная версия'] },
        employee: { tab: 'Сотрудник платформы', scope: 'Операционные сроки, доказательства и эскалации', blocker: 'Сделка остановилась между участниками или основаниями.', impact: 'Нужно быстро определить причину и владельца действия.', action: 'Показать ответственного, срок и разрешённый следующий шаг.', evidence: ['Лента событий', 'Роли', 'Версии документов', 'Журнал решений'] },
      },
    },
    documents: {
      eyebrow: 'Документы и основания', title: 'Гекта помогает проверить связь документа со Сделкой',
      lead: 'Проверяется тип, версия, реквизиты, подпись, связь с событием и актуальность. Неподтверждённая информация остаётся неподтверждённой.',
      cards: [['Комплектность', 'Есть ли нужный документ для текущего этапа', 'Показывается фактический статус'], ['Реквизиты', 'Совпадают ли партия, масса, участники и даты', 'Сверка без автоматического подтверждения'], ['Подпись и версия', 'Какая версия действует и кем подтверждена', 'Автоподписание запрещено'], ['Защита', 'Источник, происхождение и безопасная обработка файла', 'Неизвестный файл не становится основанием']],
      resultTitle: 'Что получает пользователь', result: 'Понятный список подтверждённых оснований и того, что ещё требует проверки.',
      safety: 'Гекта не подписывает документ, не выбирает сертификат и не меняет Сделку самостоятельно.',
    },
    risk: {
      eyebrow: 'Риски и деньги', title: 'Риск переводится в понятное влияние и действие',
      lead: 'Вместо абстрактного предупреждения пользователь видит, что именно заблокировано, кто отвечает и какое подтверждение требуется.',
      metrics: [['Денежное влияние', 'Требует основания', 'Без выдуманной суммы реальной Сделки'], ['Срок', 'По правилам Сделки', 'Показывается доступный контрольный срок'], ['Уровень', 'По подтверждённым фактам', 'Без догадки при нехватке данных']],
      conclusion: 'Принцип Гекты', conclusionValue: 'Сначала подтверждённое основание — затем следующий разрешённый шаг.',
    },
    actions: {
      eyebrow: 'Подготовленные действия', title: 'Гекта готовит вариант — человек подтверждает — система исполняет по правилам',
      lead: 'Гекта не получает самостоятельного права подписи, отправки или движения денег. Значимое действие проходит отдельную проверяемую цепочку.',
      steps: ['Обнаружить проблему', 'Показать причину и основание', 'Подготовить вариант действия', 'Проверить роль и организацию', 'Показать предварительный результат', 'Получить подтверждение пользователя', 'При необходимости вызвать разрешённый сервис', 'Сохранить результат и квитанцию', 'Обновить Сделку и аудит'],
      rule: 'Без разрешённой команды значимое действие не исполняется. Повторные команды защищаются идемпотентностью.',
    },
    evidence: {
      eyebrow: 'Источники и доказательства', title: 'Вывод объясняется через источник, статус и актуальность',
      lead: 'Если подтверждения нет, Гекта должна сказать об этом прямо, а не заполнять пробел предположением.',
      rows: [['Карточка Сделки', 'Иллюстративный пример', 'Показывает структуру, не реальные данные'], ['Приёмка', 'Иллюстративный пример', 'Статус объясняет механику'], ['Документы', 'Иллюстративный пример', 'Подтверждение определяется источником'], ['Внешняя система', 'Отдельное подключение', 'Не считается доступной без подтверждённого обмена']],
      freshness: 'Публичный пример не обращается к данным реальных организаций и не имитирует live-ответ внешней системы.',
    },
    security: {
      eyebrow: 'Безопасность', title: 'Гекта работает внутри полномочий платформы',
      lead: 'Идентичность, роль, организация, разрешённые инструменты и аудит определяются сервером до использования интеллектуального слоя.',
      cards: [['Изоляция организаций', 'Публичный выбор роли не даёт доступа к данным другой организации.'], ['Секреты и подпись', 'Пароли, токены и закрытые ключи электронной подписи не передаются Гекте.'], ['Контроль действий', 'Критическое действие требует реального полномочия и подтверждения.'], ['Проверяемость', 'Ответ показывает основания и отказывается от положительного вывода при недостатке данных.']],
    },
    limitations: {
      eyebrow: 'Границы возможностей', title: 'Что Гекта не делает сама',
      lead: 'Эти ограничения важнее внутренних технических статусов: посетителю должно быть понятно, кто реально принимает решение.',
      items: ['Неподключённая внешняя система не отображается как подключённая.', 'Недоступный или устаревший источник не даёт положительного подтверждения.', 'Публичная Гекта не имеет доступа к данным личных кабинетов.', 'Гекта не назначает роль и не меняет права доступа.', 'Гекта не подписывает, не отправляет и не выпускает деньги без разрешённого человеческого действия.', 'Данные государственных личных кабинетов не извлекаются обходным screen scraping.'],
    },
    connection: {
      eyebrow: 'Подключение', title: 'Рабочие источники подключаются отдельно и только с подтверждёнными правами',
      lead: 'Для каждой организации отдельно определяется, какие сотрудники, источники и официальные интерфейсы доступны. Публичная страница не доказывает наличие конкретного подключения.',
      modes: [['Рабочие кабинеты', 'Ролевая Гекта внутри разрешённых процессов Сделки'], ['Публичная Гекта', 'Общие знания без доступа к данным организаций'], ['Корпоративный API', 'Только разрешённые чтения и подготовка действий'], ['Внешние источники', 'Официальный API, публичный реестр, подтверждённый импорт или разрешённый оператор']],
      primary: 'Зарегистрироваться', secondary: 'Вернуться на главную',
      note: 'Фактическая доступность каждого внешнего источника подтверждается отдельно. Публичная страница не выдаёт неподключённый контур за работающий.',
    },
  },
  en: {
    hero: { eyebrow: 'Gekta inside the Deal', title: 'Gekta explains Deal state and the next step from available evidence', lead: 'It compares events, documents and sources that the user is allowed to see, explains risk and prepares a possible next action. Critical confirmation remains with people and server-side platform rules.', status: 'Verifiable boundaries', statusNote: 'A disconnected source is never shown as connected. Unknown or stale data never becomes a positive conclusion.', primary: 'View by role', secondary: 'Return to the Deal', line: ['Deal state', 'Cause and impact', 'Supporting evidence', 'Next permitted action'] },
    role: { eyebrow: 'Role-aware explanation', title: 'One Deal, nine understandable public perspectives', lead: 'Choosing a role here only changes the explanation. Real role and access are determined server-side after registration and organisation verification.', scope: 'What matters to the role', blocker: 'What blocks progress', impact: 'What changes', action: 'Next step', evidence: 'Evidence used', scenarios: {
      seller: { tab: 'Seller', scope: 'Lot, execution, documents and settlement readiness', blocker: 'One closing ground still requires confirmation.', impact: 'Final settlement is not ready yet.', action: 'Show the missing ground and responsible party.', evidence: ['Deal terms', 'Acceptance', 'Documents'] },
      buyer: { tab: 'Buyer', scope: 'Terms, acceptance, quality and payment basis', blocker: 'Quality is not yet confirmed by an available source.', impact: 'Payment must not be treated as ready.', action: 'Check the quality result and linked documents.', evidence: ['Terms', 'Acceptance', 'Quality protocol'] },
      logistics: { tab: 'Logistics', scope: 'Trip, route, timing and delivery evidence', blocker: 'One transport event still needs confirmation.', impact: 'Delivery is not fully confirmed.', action: 'Show the checkpoint and action owner.', evidence: ['Trip', 'Route', 'Transport events'] },
      driver: { tab: 'Driver', scope: 'Assigned trip and nearest action', blocker: 'A checkpoint confirmation is required.', impact: 'The next delivery step is not open yet.', action: 'Show one concrete action without unrelated data.', evidence: ['Trip', 'Route', 'Permitted documents'] },
      storage: { tab: 'Elevator / storage', scope: 'Acceptance, weight, placement and lot status', blocker: 'Acceptance is missing one confirmed fact.', impact: 'The lot remains in an intermediate state.', action: 'Show which fact the elevator must confirm.', evidence: ['Weight', 'Acceptance act', 'Lot status'] },
      laboratory: { tab: 'Laboratory', scope: 'Sample, method, result and protocol', blocker: 'The result must be linked to a specific sample.', impact: 'Quality cannot be used as confirmed evidence yet.', action: 'Check the sample → method → result chain.', evidence: ['Sample', 'Method', 'Protocol'] },
      surveyor: { tab: 'Surveyor', scope: 'Independent quantity and quality verification', blocker: 'The parties need independent evidence.', impact: 'The discrepancy decision lacks a neutral conclusion.', action: 'Assemble available facts for independent review.', evidence: ['Acts', 'Protocols', 'Photos and measurements'] },
      bank: { tab: 'Bank / finance', scope: 'Settlement grounds and financial blockers', blocker: 'The money-action basis is not fully confirmed.', impact: 'The financial circuit must not move to the next action.', action: 'Show confirmed and missing grounds.', evidence: ['Acceptance', 'Quality', 'Documents', 'Calculation version'] },
      employee: { tab: 'Platform employee', scope: 'Operational deadlines, evidence and escalation', blocker: 'The Deal is stuck between participants or grounds.', impact: 'The cause and action owner must be identified quickly.', action: 'Show owner, deadline and next permitted step.', evidence: ['Event timeline', 'Roles', 'Document versions', 'Decision log'] },
    } },
    documents: { eyebrow: 'Documents and grounds', title: 'Gekta helps verify how a document relates to the Deal', lead: 'Type, version, details, signature, event linkage and freshness are checked. Unconfirmed information remains unconfirmed.', cards: [['Completeness', 'Whether the current stage has the required document', 'Actual status is shown'], ['Details', 'Whether lot, weight, parties and dates match', 'Comparison without automatic approval'], ['Signature and version', 'Which version is current and who confirmed it', 'Automatic signing is prohibited'], ['Protection', 'Source, provenance and safe file handling', 'An unknown file cannot become evidence']], resultTitle: 'What the user gets', result: 'A clear list of confirmed grounds and what still needs verification.', safety: 'Gekta does not sign documents, choose certificates or change a Deal by itself.' },
    risk: { eyebrow: 'Risk and money', title: 'Risk becomes a clear impact and action', lead: 'Instead of an abstract warning, the user sees what is blocked, who owns the action and what confirmation is required.', metrics: [['Money impact', 'Requires evidence', 'No invented amount from a real Deal'], ['Deadline', 'Defined by Deal rules', 'Only available control timing is shown'], ['Level', 'Based on confirmed facts', 'No guess when data is missing']], conclusion: 'Gekta principle', conclusionValue: 'Confirmed evidence first, then the next permitted step.' },
    actions: { eyebrow: 'Prepared actions', title: 'Gekta prepares an option — a person confirms — the system executes by rule', lead: 'Gekta has no independent signing, submission or money-movement authority. A consequential action follows a separate verifiable chain.', steps: ['Detect the problem', 'Show cause and evidence', 'Prepare an action option', 'Check role and organisation', 'Show a preview', 'Receive user confirmation', 'Call an allowed service if required', 'Store result and receipt', 'Update Deal and audit'], rule: 'No consequential action runs without an authorised command. Repeats are protected by idempotency.' },
    evidence: { eyebrow: 'Sources and evidence', title: 'A conclusion resolves to source, status and freshness', lead: 'When confirmation is missing, Gekta states that directly rather than filling the gap with an assumption.', rows: [['Deal card', 'Illustrative example', 'Explains structure, not real data'], ['Acceptance', 'Illustrative example', 'Status explains platform mechanics'], ['Documents', 'Illustrative example', 'Confirmation depends on the source'], ['External system', 'Separate connection', 'Not available until exchange is confirmed']], freshness: 'The public example does not access real organisation data or imitate a live external-system response.' },
    security: { eyebrow: 'Security', title: 'Gekta operates inside platform authority', lead: 'Identity, role, organisation, allowed tools and audit are determined server-side before the intelligence layer is used.', cards: [['Organisation isolation', 'A public role choice does not grant access to another organisation’s data.'], ['Secrets and signing', 'Passwords, tokens and private signing keys are never passed to Gekta.'], ['Action control', 'A critical action requires real authority and confirmation.'], ['Verifiability', 'Answers show grounds and avoid positive confirmation when evidence is insufficient.']] },
    limitations: { eyebrow: 'Capability boundaries', title: 'What Gekta does not do by itself', lead: 'These boundaries matter more than internal technical status codes because visitors need to know who really makes the decision.', items: ['A disconnected external system is never shown as connected.', 'Unavailable or stale data cannot produce positive confirmation.', 'Public Gekta has no access to private workspaces.', 'Gekta does not assign roles or change access rights.', 'Gekta cannot sign, submit or release money without an authorised human action.', 'Government account data is not collected through bypass screen scraping.'] },
    connection: { eyebrow: 'Connection', title: 'Working sources connect separately and only with confirmed rights', lead: 'Each organisation separately determines which employees, sources and official interfaces are available. A public page does not prove a named connection exists.', modes: [['Workspaces', 'Role-aware Gekta inside permitted Deal processes'], ['Public Gekta', 'General knowledge without organisation data'], ['Corporate API', 'Only permitted reads and prepared actions'], ['External sources', 'Official API, public registry, verified import or authorised operator']], primary: 'Register', secondary: 'Return home', note: 'Actual availability of every external source is confirmed separately. The public page never presents a disconnected circuit as working.' },
  },
  zh: {
    hero: { eyebrow: '交易中的 Gekta', title: 'Gekta 根据可用依据解释交易状态和下一步', lead: '它对照用户获准查看的事件、文件和来源，解释风险并准备下一步操作方案。关键操作仍由人员和平台服务器规则确认。', status: '可核验边界', statusNote: '未连接来源不会显示为已连接。未知或过期数据不会变成正面结论。', primary: '按角色查看', secondary: '返回交易', line: ['交易状态', '原因与影响', '支持依据', '允许的下一步'] },
    role: { eyebrow: '角色化说明', title: '一笔交易，九个清晰的公开视角', lead: '这里选择角色只改变说明方式。真实角色和访问权限在注册并完成机构核验后由服务器确定。', scope: '角色关注点', blocker: '阻塞原因', impact: '影响', action: '下一步', evidence: '使用的依据', scenarios: {
      seller: { tab: '卖方', scope: '批次、履约、文件和结算准备状态', blocker: '关闭交易仍缺少一项确认依据。', impact: '最终结算尚未准备完成。', action: '显示缺失依据和责任方。', evidence: ['交易条件', '验收', '文件'] },
      buyer: { tab: '买方', scope: '条件、验收、质量和付款依据', blocker: '质量尚未由可用来源确认。', impact: '付款不能视为准备完成。', action: '检查质量结果及相关文件。', evidence: ['条件', '验收', '质量报告'] },
      logistics: { tab: '物流', scope: '运输、路线、时限和交付证明', blocker: '一项运输事件仍需确认。', impact: '交付尚未完全确认。', action: '显示检查点和操作负责人。', evidence: ['运输任务', '路线', '运输事件'] },
      driver: { tab: '司机', scope: '已分配运输任务和最近操作', blocker: '需要确认一个检查点。', impact: '下一交付步骤尚未开放。', action: '仅显示一个具体操作，不展示无关数据。', evidence: ['运输任务', '路线', '允许的文件'] },
      storage: { tab: '筒仓 / 仓储', scope: '验收、重量、存放和批次状态', blocker: '验收还缺一项已确认事实。', impact: '批次仍处于中间状态。', action: '显示筒仓需要确认的事实。', evidence: ['重量', '验收单', '批次状态'] },
      laboratory: { tab: '实验室', scope: '样品、方法、结果和报告', blocker: '结果必须关联到具体样品。', impact: '质量暂时不能作为已确认依据。', action: '检查样品 → 方法 → 结果链。', evidence: ['样品', '方法', '报告'] },
      surveyor: { tab: '检验机构', scope: '独立数量和质量核验', blocker: '双方需要独立证据。', impact: '差异决定尚缺中立结论。', action: '汇总可用事实供独立核验。', evidence: ['记录', '报告', '照片和测量'] },
      bank: { tab: '银行 / 金融', scope: '结算依据和金融阻塞项', blocker: '资金操作依据尚未完全确认。', impact: '金融闭环不能进入下一操作。', action: '显示已确认和缺失依据。', evidence: ['验收', '质量', '文件', '计算版本'] },
      employee: { tab: '平台员工', scope: '运营期限、证据和升级', blocker: '交易停滞在参与方或依据之间。', impact: '需要快速确定原因和操作负责人。', action: '显示负责人、期限和允许的下一步。', evidence: ['事件时间线', '角色', '文件版本', '决定日志'] },
    } },
    documents: { eyebrow: '文件与依据', title: 'Gekta 帮助核验文件如何关联到交易', lead: '检查类型、版本、信息、签名、事件关联和时效。未确认信息始终保持未确认。', cards: [['完整性', '当前阶段是否具备所需文件', '显示实际状态'], ['信息', '批次、重量、参与方和日期是否一致', '核对但不自动批准'], ['签名与版本', '当前有效版本以及由谁确认', '禁止自动签名'], ['保护', '来源、可追溯性和安全文件处理', '未知文件不能成为依据']], resultTitle: '用户得到什么', result: '清晰列出已确认依据以及仍需核验的内容。', safety: 'Gekta 不会自行签署文件、选择证书或修改交易。' },
    risk: { eyebrow: '风险与资金', title: '风险被转换为清晰影响和操作', lead: '用户看到的不是抽象警告，而是具体阻塞项、责任方和需要的确认。', metrics: [['资金影响', '需要依据', '不虚构真实交易金额'], ['期限', '由交易规则确定', '只显示可用控制期限'], ['级别', '基于已确认事实', '数据不足时不猜测']], conclusion: 'Gekta 原则', conclusionValue: '先有已确认依据，再进入允许的下一步。' },
    actions: { eyebrow: '准备的操作', title: 'Gekta 准备方案 — 人员确认 — 系统按规则执行', lead: 'Gekta 没有独立签名、发送或资金移动权限。重要操作经过独立、可核验链路。', steps: ['发现问题', '显示原因和依据', '准备操作方案', '检查角色和机构', '显示预览', '获得用户确认', '需要时调用允许的服务', '保存结果和回执', '更新交易和审计'], rule: '没有授权命令，不执行重要操作。重复命令受幂等机制保护。' },
    evidence: { eyebrow: '来源与证据', title: '结论可以追溯到来源、状态和时效', lead: '缺少确认时，Gekta 会直接说明，而不是用假设填补空白。', rows: [['交易卡', '说明性示例', '解释结构，不是真实数据'], ['验收', '说明性示例', '状态用于解释平台机制'], ['文件', '说明性示例', '确认取决于来源'], ['外部系统', '独立接入', '交换确认前不视为可用']], freshness: '公开示例不访问真实机构数据，也不模拟外部系统的实时响应。' },
    security: { eyebrow: '安全', title: 'Gekta 在平台权限控制内运行', lead: '身份、角色、机构、允许工具和审计在智能层使用前由服务器确定。', cards: [['机构隔离', '公开角色选择不会授予其他机构数据访问权。'], ['秘密与签名', '密码、令牌和签名私钥不会传给 Gekta。'], ['操作控制', '关键操作需要真实权限和确认。'], ['可核验性', '回答显示依据；证据不足时不会给出正面确认。']] },
    limitations: { eyebrow: '能力边界', title: 'Gekta 不会自行完成什么', lead: '这些边界比内部技术状态代码更重要，因为访客需要知道真正由谁作出决定。', items: ['未连接外部系统不会显示为已连接。', '不可用或过期数据不能产生正面确认。', '公开 Gekta 无法访问私人工作空间。', 'Gekta 不分配角色，也不改变访问权限。', '没有获授权的人类操作，Gekta 不能签名、发送或释放资金。', '不会通过绕过式 screen scraping 获取政府账户数据。'] },
    connection: { eyebrow: '接入', title: '工作来源独立接入，并且只在权限确认后使用', lead: '每个机构单独确定可用员工、来源和官方接口。公开页面不能证明具体接入已经存在。', modes: [['工作空间', '获准交易流程中的角色化 Gekta'], ['公开 Gekta', '不访问机构数据的通用知识'], ['企业 API', '仅允许的读取和准备操作'], ['外部来源', '官方 API、公开登记、已验证导入或获授权运营方']], primary: '注册', secondary: '返回首页', note: '每个外部来源的实际可用性需要单独确认。公开页面不会把未连接闭环显示为工作中。' },
  },
};

const ROLE_ORDER: RoleKey[] = ['seller', 'buyer', 'logistics', 'driver', 'storage', 'laboratory', 'surveyor', 'bank', 'employee'];

export function PublicAiInActionSimpleExperience({ locale }: { locale: string }) {
  const localeKey: Locale = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const copy = COPY[localeKey];
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
                <a href='/platform-v7#deal-path' className={styles.secondary}>{copy.hero.secondary}</a>
              </div>
            </div>
            <aside className={styles.statusPanel} aria-label={copy.hero.status}>
              <div><ShieldCheck size={20} aria-hidden='true' /><span>{copy.hero.status}</span></div>
              <p>{copy.hero.statusNote}</p>
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
          <div className={styles.documentGrid}>{copy.documents.cards.map(([title, body, status], index) => <article key={title}><span>{index + 1}</span><div><h3>{title}</h3><p>{body}</p><small>{status}</small></div></article>)}</div>
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
          <div className={styles.evidenceTable} role='table' aria-label={copy.evidence.title}>{copy.evidence.rows.map(([source, id, status]) => <div key={`${source}-${id}`} role='row'><span role='cell'><Database size={16} aria-hidden='true' />{source}</span><code role='cell'>{id}</code><strong role='cell'>{status}</strong></div>)}</div>
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
          <div className={styles.heroActions}><a href='/platform-v7/register' className={styles.primary}>{copy.connection.primary}<ArrowRight size={18} aria-hidden='true' /></a><a href='/platform-v7' className={styles.secondary}>{copy.connection.secondary}</a></div>
        </div>
      </section>
    </div>
  );
}
