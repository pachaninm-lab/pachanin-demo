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
type RoleKey = 'buyer' | 'seller' | 'bank';

type RoleScenario = {
  tab: string;
  scope: string;
  blocker: string;
  impact: string;
  action: string;
  evidence: string[];
};

type Copy = {
  hero: {
    eyebrow: string;
    title: string;
    lead: string;
    status: string;
    statusNote: string;
    primary: string;
    secondary: string;
    line: string[];
  };
  role: {
    eyebrow: string;
    title: string;
    lead: string;
    scope: string;
    blocker: string;
    impact: string;
    action: string;
    evidence: string;
    scenarios: Record<RoleKey, RoleScenario>;
  };
  documents: {
    eyebrow: string;
    title: string;
    lead: string;
    cards: Array<[string, string, string]>;
    resultTitle: string;
    result: string;
    safety: string;
  };
  risk: {
    eyebrow: string;
    title: string;
    lead: string;
    metrics: Array<[string, string, string]>;
    conclusion: string;
    conclusionValue: string;
  };
  actions: {
    eyebrow: string;
    title: string;
    lead: string;
    steps: string[];
    rule: string;
  };
  evidence: {
    eyebrow: string;
    title: string;
    lead: string;
    rows: Array<[string, string, string]>;
    freshness: string;
  };
  security: {
    eyebrow: string;
    title: string;
    lead: string;
    cards: Array<[string, string]>;
  };
  limitations: {
    eyebrow: string;
    title: string;
    lead: string;
    items: string[];
  };
  connection: {
    eyebrow: string;
    title: string;
    lead: string;
    modes: Array<[string, string]>;
    primary: string;
    secondary: string;
    note: string;
  };
};

const COPY: Record<Locale, Copy> = {
  ru: {
    hero: {
      eyebrow: 'Паспорт интеллектуального контура',
      title: 'TAI — доказательный уровень исполнения сделки',
      lead: 'TAI понимает доступное состояние сделки, связывает события с документами и официальными основаниями, объясняет риск и готовит следующее разрешённое действие. Человек сохраняет контроль.',
      status: 'NOT_ATTESTED',
      statusNote: 'Промышленная аттестация TAI и внешних адаптеров не завершена. Ни один неподтверждённый источник не показывается подключённым.',
      primary: 'Посмотреть ролевой разбор',
      secondary: 'Вернуться к сделке',
      line: ['Состояние сделки', 'Причина и влияние', 'Проверяемые основания', 'Подготовленное действие'],
    },
    role: {
      eyebrow: '1–2 · Роль и ролевой разбор',
      title: 'Один контур — разные выводы для каждой роли',
      lead: 'TAI получает роль и организационный контекст только с сервера. Пользователь видит выводы в пределах своих полномочий, а не универсальный ответ для всех участников.',
      scope: 'Контекст роли', blocker: 'Критический блокер', impact: 'Влияние', action: 'Следующее действие', evidence: 'Основания',
      scenarios: {
        buyer: { tab: 'Покупатель', scope: 'Условия, приёмка, качество, документы и расчёт', blocker: 'Лабораторный протокол не подтверждён.', impact: '6,9 млн ₽ остаются заблокированными до подтверждения качества.', action: 'Подготовить запрос лаборатории и перечень недостающих оснований.', evidence: ['Карточка сделки', 'Акт приёмки', 'Реестр документов'] },
        seller: { tab: 'Продавец', scope: 'Готовность партии, отгрузка, документы и оплата', blocker: 'Версия протокола не связана с принятой партией.', impact: 'Покупатель не может подтвердить наступление денежного основания.', action: 'Сверить партию, реквизиты протокола и подготовить подтверждение.', evidence: ['Партия продавца', 'Рейс', 'Лабораторный протокол'] },
        bank: { tab: 'Банк', scope: 'Комплектность оснований и финансовые ограничения', blocker: 'В доказательном комплекте отсутствует подтверждённый документ качества.', impact: 'Платёж не может перейти в исполняемое состояние.', action: 'Показать сторонам точный перечень обязательных оснований без раскрытия лишних данных.', evidence: ['Условия расчёта', 'Статус документов', 'Аудит подтверждений'] },
      },
    },
    documents: {
      eyebrow: '3 · Работа с документами',
      title: 'Документ проверяется как основание, а не как вложение',
      lead: 'Контур сопоставляет тип, версию, реквизиты, подписи, связь со Сделкой и допустимую актуальность. Неизвестная или неподтверждённая информация не превращается в положительный вывод.',
      cards: [
        ['Комплектность', 'Есть ли обязательный документ для текущего этапа', '1 документ требует подтверждения'],
        ['Реквизиты', 'Совпадают ли партия, масса, участники и даты', 'Сверка подготовлена'],
        ['Подпись и версия', 'Какая версия действует и кем она подтверждена', 'Автоподписание запрещено'],
        ['Защита', 'Антивирус, изоляция, provenance и защита от prompt injection', 'Неизвестный файл помещается в карантин'],
      ],
      resultTitle: 'Доказательный результат',
      result: 'Расчёт остаётся заблокированным: подтверждённая версия лабораторного протокола отсутствует.',
      safety: 'TAI не подписывает документ, не выбирает сертификат и не меняет Сделку самостоятельно.',
    },
    risk: {
      eyebrow: '5 · Риски и денежные последствия',
      title: 'Риск переводится в срок, деньги и точку вмешательства',
      lead: 'TAI показывает не абстрактную опасность, а конкретное влияние на исполнение: что заблокировано, сколько времени осталось и кто должен действовать.',
      metrics: [['Деньги под риском', '6,9 млн ₽', 'Сценарная сумма, не реальная сделка'], ['Контрольное окно', '6 часов', 'До перехода к эскалации'], ['Уровень', 'Требует внимания', 'Критическое нарушение не подтверждено']],
      conclusion: 'Вывод TAI',
      conclusionValue: 'Сначала подтвердить документ качества; только затем переводить Сделку к расчёту.',
    },
    actions: {
      eyebrow: '6 · Подготовленные действия',
      title: 'TAI готовит — человек подтверждает — адаптер исполняет',
      lead: 'Модель не получает права подписи или отправки. Значимое действие проходит отдельную проверяемую цепочку.',
      steps: ['Обнаружить проблему', 'Показать причину и основание', 'Подготовить проект данных', 'Проверить роль и организацию', 'Открыть предварительный просмотр', 'Получить подтверждение пользователя', 'При необходимости вызвать сервис подписи', 'Отправить через официальный адаптер', 'Сохранить квитанцию', 'Обновить Сделку и аудит'],
      rule: 'Повторная отправка защищена идемпотентностью. Без новой разрешённой команды операция не дублируется.',
    },
    evidence: {
      eyebrow: '7 · Источники и доказательства',
      title: 'Каждый вывод можно разложить до источника и времени проверки',
      lead: 'TAI отвечает только в пределах доступных доказательств. При отсутствии подтверждения интерфейс показывает «не проверено».',
      rows: [['Карточка сделки', 'DEAL-DEMO-240721', 'Публичный сценарий · 14:32'], ['Акт приёмки', 'ACT-DEMO-V3', 'Публичный сценарий · 14:28'], ['Реестр документов', 'DOC-REG-DEMO', 'Протокол не подтверждён'], ['Государственное основание', '—', 'Не проверено: официальное подключение не подтверждено']],
      freshness: 'Публичный пример не обращается к данным реальных организаций и не имитирует live-ответ государственной системы.',
    },
    security: {
      eyebrow: '8 · Безопасность',
      title: 'Ролевой ИИ работает внутри ограничений платформы',
      lead: 'Идентичность, роль, организация, разрешённые инструменты и аудит определяются серверным контуром до обращения к модели.',
      cards: [['Изоляция организаций', 'TAI не получает данные другого tenant и не принимает tenant с клиента.'], ['Секреты и подпись', 'Пароли ЕСИА, access tokens и закрытые ключи электронной подписи не передаются модели.'], ['Контроль действий', 'Привилегированная запись требует роли, подтверждения, идемпотентности и аудита.'], ['Проверяемость', 'Ответ содержит источники, актуальность, ограничения и отказ при недостатке данных.']],
    },
    limitations: {
      eyebrow: '9 · Ограничения',
      title: 'Граница возможностей показывается прямо',
      lead: 'TAI не должен производить впечатление большей зрелости, чем подтверждено эксплуатационными доказательствами.',
      items: ['Общий статус остаётся NOT_ATTESTED до отдельной промышленной приёмки.', 'Неподключённая государственная система не отображается как подключённая.', 'Недоступный или устаревший источник не даёт положительного подтверждения.', 'Публичный помощник не имеет доступа к данным личных кабинетов.', 'TAI не подписывает, не отправляет и не выпускает деньги без человека.', 'Screen scraping государственных личных кабинетов запрещён.'],
    },
    connection: {
      eyebrow: '10 · Корпоративное подключение и API',
      title: 'Подключение строится вокруг прав организации и официальных интерфейсов',
      lead: 'Организация подключает сотрудников, роли, разрешённые источники и адаптеры. Фактический статус каждого соединения хранится в серверном реестре.',
      modes: [['Рабочие кабинеты', 'Ролевой TAI внутри Сделки и доступных пользователю процессов'], ['Публичный помощник', 'Только общие знания о платформе без доступа к организациям'], ['Корпоративный API', 'Контролируемые чтения, подготовка действий, подтверждение и квитанции'], ['Государственные адаптеры', 'Только официальный API, публичный реестр, подтверждённый импорт или оператор']],
      primary: 'Подключить организацию',
      secondary: 'Вернуться на главную',
      note: 'Production остаётся в собственном VPS-контуре платформы. Перенос на Netlify или Vercel не выполняется.',
    },
  },
  en: {
    hero: { eyebrow: 'Intelligence contour passport', title: 'TAI is the evidence layer of deal execution', lead: 'TAI understands the permitted deal state, links events to documents and official grounds, explains risk, and prepares the next allowed action. A person remains in control.', status: 'NOT_ATTESTED', statusNote: 'Industrial attestation of TAI and external adapters is incomplete. No unconfirmed source is shown as connected.', primary: 'View role analysis', secondary: 'Return to the deal', line: ['Deal state', 'Cause and impact', 'Verifiable grounds', 'Prepared action'] },
    role: { eyebrow: '1–2 · Role and role analysis', title: 'One contour — different conclusions for each role', lead: 'TAI receives role and organisation context from the server. A participant sees only conclusions within authorised scope.', scope: 'Role context', blocker: 'Critical blocker', impact: 'Impact', action: 'Next action', evidence: 'Grounds', scenarios: {
      buyer: { tab: 'Buyer', scope: 'Terms, acceptance, quality, documents, and settlement', blocker: 'The laboratory report is not confirmed.', impact: '₽6.9m remains blocked until quality is confirmed.', action: 'Prepare a laboratory request and the missing-ground list.', evidence: ['Deal card', 'Acceptance act', 'Document registry'] },
      seller: { tab: 'Seller', scope: 'Lot readiness, shipment, documents, and payment', blocker: 'The report version is not linked to the accepted lot.', impact: 'The buyer cannot confirm the payment ground.', action: 'Reconcile the lot and report details and prepare confirmation.', evidence: ['Seller lot', 'Trip', 'Laboratory report'] },
      bank: { tab: 'Bank', scope: 'Ground completeness and financial restrictions', blocker: 'The evidence package lacks a confirmed quality document.', impact: 'Payment cannot enter an executable state.', action: 'Show the parties the exact mandatory-ground list without exposing extra data.', evidence: ['Settlement terms', 'Document status', 'Confirmation audit'] },
    } },
    documents: { eyebrow: '3 · Documents', title: 'A document is checked as a ground, not just an attachment', lead: 'The contour reconciles type, version, details, signatures, Deal linkage, and freshness. Unknown data never becomes a positive result.', cards: [['Completeness', 'Whether the current stage has every mandatory document', '1 document needs confirmation'], ['Details', 'Whether lot, weight, parties, and dates match', 'Reconciliation prepared'], ['Signature and version', 'Which version is valid and who confirmed it', 'Automatic signing prohibited'], ['Protection', 'Malware checks, isolation, provenance, and prompt-injection defence', 'Unknown files enter quarantine']], resultTitle: 'Evidence result', result: 'Settlement remains blocked because the confirmed laboratory report is missing.', safety: 'TAI does not sign a document, choose a certificate, or change the Deal by itself.' },
    risk: { eyebrow: '5 · Risk and financial impact', title: 'Risk becomes a deadline, money, and intervention point', lead: 'TAI shows the concrete execution impact: what is blocked, how much time remains, and who must act.', metrics: [['Money at risk', '₽6.9m', 'Scenario value, not a real deal'], ['Control window', '6 hours', 'Until escalation'], ['Level', 'Needs attention', 'No critical violation confirmed']], conclusion: 'TAI conclusion', conclusionValue: 'Confirm the quality document first; only then move the Deal toward settlement.' },
    actions: { eyebrow: '6 · Prepared actions', title: 'TAI prepares — a person confirms — an adapter executes', lead: 'The model has no signing or submission authority. Consequential actions follow a separate controlled chain.', steps: ['Detect the problem', 'Show cause and ground', 'Prepare data draft', 'Check role and organisation', 'Open preview', 'Receive user confirmation', 'Call signing service if required', 'Submit through official adapter', 'Store receipt', 'Update Deal and audit'], rule: 'Idempotency prevents duplicate submission. No repeat occurs without a new authorised command.' },
    evidence: { eyebrow: '7 · Sources and evidence', title: 'Every conclusion resolves to a source and check time', lead: 'TAI answers only within available evidence. Missing confirmation is displayed as “not checked”.', rows: [['Deal card', 'DEAL-DEMO-240721', 'Public scenario · 14:32'], ['Acceptance act', 'ACT-DEMO-V3', 'Public scenario · 14:28'], ['Document registry', 'DOC-REG-DEMO', 'Report not confirmed'], ['Government ground', '—', 'Not checked: official connection unconfirmed']], freshness: 'The public example does not access real organisation data or imitate a live government-system response.' },
    security: { eyebrow: '8 · Security', title: 'Role-aware AI operates inside platform controls', lead: 'Identity, role, organisation, allowed tools, and audit are determined server-side before the model is used.', cards: [['Organisation isolation', 'TAI receives no other tenant data and does not accept tenant selection from the client.'], ['Secrets and signing', 'ESIA passwords, access tokens, and private signing keys are never sent to the model.'], ['Action control', 'Privileged writes require role, confirmation, idempotency, and audit.'], ['Verifiability', 'Answers include sources, freshness, limitations, and abstention when evidence is insufficient.']] },
    limitations: { eyebrow: '9 · Limitations', title: 'Capability boundaries are explicit', lead: 'TAI must not appear more mature than the operational evidence supports.', items: ['Overall status remains NOT_ATTESTED until separate industrial acceptance.', 'A disconnected government system is never shown as connected.', 'Unavailable or stale data cannot produce a positive confirmation.', 'The public assistant has no workspace access.', 'TAI cannot sign, submit, or release money without a person.', 'Screen scraping of government accounts is prohibited.'] },
    connection: { eyebrow: '10 · Corporate connection and API', title: 'Connection is built around organisation rights and official interfaces', lead: 'An organisation connects staff, roles, allowed sources, and adapters. Actual connection status remains server-authoritative.', modes: [['Workspaces', 'Role-aware TAI inside the Deal and authorised processes'], ['Public assistant', 'General platform knowledge without organisation access'], ['Corporate API', 'Controlled reads, prepared actions, confirmation, and receipts'], ['Government adapters', 'Official API, public registry, verified import, or accredited operator only']], primary: 'Connect organisation', secondary: 'Return home', note: 'Production remains in the platform’s own VPS contour. No migration to Netlify or Vercel.' },
  },
  zh: {
    hero: { eyebrow: '智能链路说明', title: 'TAI 是交易执行的证据层', lead: 'TAI 理解获准访问的交易状态，把事件与文件和官方依据连接起来，解释风险，并准备下一项允许的操作。最终控制权属于人。', status: 'NOT_ATTESTED', statusNote: 'TAI 和外部适配器的工业认证尚未完成。任何未确认来源都不会显示为已连接。', primary: '查看角色分析', secondary: '返回交易', line: ['交易状态', '原因与影响', '可核验依据', '准备的操作'] },
    role: { eyebrow: '1–2 · 角色与角色分析', title: '一个链路，为不同角色形成不同结论', lead: 'TAI 的角色和组织上下文只来自服务器。参与方只能看到权限范围内的结论。', scope: '角色上下文', blocker: '关键阻塞项', impact: '影响', action: '下一步', evidence: '依据', scenarios: {
      buyer: { tab: '买方', scope: '条件、验收、质量、文件和结算', blocker: '实验室报告尚未确认。', impact: '质量确认前，690 万卢布仍被锁定。', action: '准备实验室请求和缺失依据清单。', evidence: ['交易卡', '验收单', '文件登记'] },
      seller: { tab: '卖方', scope: '货物准备、发运、文件和付款', blocker: '报告版本未与已验收批次关联。', impact: '买方无法确认付款依据。', action: '核对批次和报告信息并准备确认。', evidence: ['卖方批次', '运输', '实验室报告'] },
      bank: { tab: '银行', scope: '依据完整性和金融限制', blocker: '证据包缺少已确认的质量文件。', impact: '付款不能进入执行状态。', action: '向双方显示准确的必需依据清单，不披露额外数据。', evidence: ['结算条件', '文件状态', '确认审计'] },
    } },
    documents: { eyebrow: '3 · 文件', title: '文件作为依据核验，而不是普通附件', lead: '链路核对类型、版本、信息、签名、与交易的关联和时效。未知信息不会变成正面结果。', cards: [['完整性', '当前阶段是否具备全部必需文件', '1 份文件需要确认'], ['信息', '批次、重量、参与方和日期是否一致', '已准备核对'], ['签名与版本', '哪个版本有效、由谁确认', '禁止自动签名'], ['保护', '恶意软件检查、隔离、来源追踪和提示注入防护', '未知文件进入隔离区']], resultTitle: '证据结果', result: '由于缺少已确认的实验室报告，结算仍被阻塞。', safety: 'TAI 不会自行签署文件、选择证书或修改交易。' },
    risk: { eyebrow: '5 · 风险与资金影响', title: '风险被转换为期限、资金和干预点', lead: 'TAI 显示具体执行影响：什么被阻塞、剩余多少时间、谁需要行动。', metrics: [['风险资金', '690 万卢布', '示例金额，不是真实交易'], ['控制窗口', '6 小时', '距离升级流程'], ['级别', '需要处理', '尚未确认严重违规']], conclusion: 'TAI 结论', conclusionValue: '先确认质量文件，然后才能推进结算。' },
    actions: { eyebrow: '6 · 准备的操作', title: 'TAI 准备 — 人确认 — 适配器执行', lead: '模型没有签名或发送权限。重要操作经过独立、可核验的链路。', steps: ['发现问题', '显示原因和依据', '准备数据草稿', '检查角色和组织', '打开预览', '获得用户确认', '需要时调用签名服务', '通过官方适配器发送', '保存回执', '更新交易和审计'], rule: '幂等机制防止重复发送。没有新的授权命令，不会重复操作。' },
    evidence: { eyebrow: '7 · 来源与证据', title: '每个结论都能追溯到来源和核验时间', lead: 'TAI 只在已有证据范围内回答。缺少确认时显示“未核验”。', rows: [['交易卡', 'DEAL-DEMO-240721', '公开示例 · 14:32'], ['验收单', 'ACT-DEMO-V3', '公开示例 · 14:28'], ['文件登记', 'DOC-REG-DEMO', '报告未确认'], ['政府依据', '—', '未核验：正式连接未确认']], freshness: '公开示例不访问真实组织数据，也不模拟政府系统的实时响应。' },
    security: { eyebrow: '8 · 安全', title: '基于角色的 AI 在平台控制内运行', lead: '身份、角色、组织、允许的工具和审计在模型调用前由服务器确定。', cards: [['组织隔离', 'TAI 不接收其他租户数据，也不接受客户端选择租户。'], ['秘密与签名', 'ESIA 密码、访问令牌和私钥不会传给模型。'], ['操作控制', '特权写入需要角色、确认、幂等和审计。'], ['可核验性', '回答包含来源、时效、限制；证据不足时拒绝确认。']] },
    limitations: { eyebrow: '9 · 限制', title: '能力边界明确展示', lead: 'TAI 的表现不得超过运营证据所支持的成熟度。', items: ['完成独立工业验收前，总体状态保持 NOT_ATTESTED。', '未连接的政府系统不会显示为已连接。', '不可用或过期数据不能产生正面确认。', '公开助手无法访问工作区。', '没有人的确认，TAI 不能签名、发送或释放资金。', '禁止抓取政府账户页面。'] },
    connection: { eyebrow: '10 · 企业连接与 API', title: '连接围绕组织权限和官方接口构建', lead: '组织连接员工、角色、允许的来源和适配器。实际连接状态由服务器权威保存。', modes: [['工作区', '交易和获授权流程中的角色化 TAI'], ['公开助手', '不访问组织数据的一般平台知识'], ['企业 API', '受控读取、准备操作、确认和回执'], ['政府适配器', '仅官方 API、公开登记、已验证导入或认可运营商']], primary: '连接组织', secondary: '返回首页', note: '生产环境保留在平台自有 VPS 链路中，不迁移到 Netlify 或 Vercel。' },
  },
};

const ROLE_ORDER: RoleKey[] = ['buyer', 'seller', 'bank'];

export function PublicAiInActionSimpleExperience({ locale }: { locale: string }) {
  const localeKey: Locale = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const copy = COPY[localeKey];
  const [role, setRole] = React.useState<RoleKey>('buyer');
  const scenario = copy.role.scenarios[role];

  return (
    <div className={styles.page}>
      <section id='role' className={styles.hero} aria-labelledby='pc-ai-passport-title'>
        <div className={styles.shell}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}><Sparkles size={16} aria-hidden='true' />{copy.hero.eyebrow}</span>
              <h1 id='pc-ai-passport-title'>{copy.hero.title}</h1>
              <p>{copy.hero.lead}</p>
              <div className={styles.heroActions}>
                <a href='#role-analysis' className={styles.primary}>{copy.hero.primary}<ArrowRight size={18} aria-hidden='true' /></a>
                <a href='/platform-v7#deal-example' className={styles.secondary}>{copy.hero.secondary}</a>
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
          <header className={styles.sectionHeader}>
            <span className={styles.eyebrow}>{copy.role.eyebrow}</span>
            <h2 id='pc-ai-role-title'>{copy.role.title}</h2>
            <p>{copy.role.lead}</p>
          </header>
          <div className={styles.roleTabs} role='tablist' aria-label={copy.role.title}>
            {ROLE_ORDER.map((key) => (
              <button key={key} type='button' role='tab' aria-selected={role === key} aria-controls='pc-ai-role-result' onClick={() => { setRole(key); trackEvent('role_intelligence_opened', { role: key, source: 'ai_passport', locale: localeKey }); }}>{copy.role.scenarios[key].tab}</button>
            ))}
          </div>
          <div id='pc-ai-role-result' className={styles.roleResult} role='tabpanel' aria-live='polite'>
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
          <header className={styles.sectionHeader}>
            <span className={styles.eyebrow}>{copy.documents.eyebrow}</span>
            <h2 id='pc-ai-documents-title'>{copy.documents.title}</h2>
            <p>{copy.documents.lead}</p>
          </header>
          <div className={styles.documentGrid}>
            {copy.documents.cards.map(([title, body, status], index) => (
              <article key={title}><span>{index + 1}</span><div><h3>{title}</h3><p>{body}</p><small>{status}</small></div></article>
            ))}
          </div>
          <aside className={styles.documentResult}>
            <FileCheck2 size={22} aria-hidden='true' />
            <div><span>{copy.documents.resultTitle}</span><strong>{copy.documents.result}</strong><small><LockKeyhole size={14} aria-hidden='true' />{copy.documents.safety}</small></div>
          </aside>
        </div>
      </section>

      <div className={styles.governmentWrap}>
        <div className={styles.shell}><PublicGovernmentDataContour locale={localeKey} /></div>
      </div>

      <section id='risks-money' className={styles.section} aria-labelledby='pc-ai-risk-title'>
        <div className={styles.shell}>
          <header className={styles.sectionHeader}>
            <span className={styles.eyebrow}>{copy.risk.eyebrow}</span>
            <h2 id='pc-ai-risk-title'>{copy.risk.title}</h2>
            <p>{copy.risk.lead}</p>
          </header>
          <div className={styles.metricGrid}>
            {copy.risk.metrics.map(([label, value, note], index) => (
              <article key={label}>{index === 0 ? <Banknote aria-hidden='true' /> : index === 1 ? <Clock3 aria-hidden='true' /> : <CircleAlert aria-hidden='true' />}<span>{label}</span><strong>{value}</strong><small>{note}</small></article>
            ))}
          </div>
          <aside className={styles.darkConclusion}><Sparkles size={20} aria-hidden='true' /><div><span>{copy.risk.conclusion}</span><strong>{copy.risk.conclusionValue}</strong></div></aside>
        </div>
      </section>

      <section id='prepared-actions' className={`${styles.section} ${styles.softSection}`} aria-labelledby='pc-ai-actions-title'>
        <div className={styles.shell}>
          <header className={styles.sectionHeader}>
            <span className={styles.eyebrow}>{copy.actions.eyebrow}</span>
            <h2 id='pc-ai-actions-title'>{copy.actions.title}</h2>
            <p>{copy.actions.lead}</p>
          </header>
          <ol className={styles.actionFlow}>
            {copy.actions.steps.map((step, index) => <li key={step}><span>{index + 1}</span><strong>{step}</strong>{index < copy.actions.steps.length - 1 ? <ArrowRight size={16} aria-hidden='true' /> : null}</li>)}
          </ol>
          <p className={styles.actionRule}><BadgeCheck size={17} aria-hidden='true' />{copy.actions.rule}</p>
        </div>
      </section>

      <section id='evidence' className={styles.section} aria-labelledby='pc-ai-evidence-title'>
        <div className={styles.shell}>
          <header className={styles.sectionHeader}>
            <span className={styles.eyebrow}>{copy.evidence.eyebrow}</span>
            <h2 id='pc-ai-evidence-title'>{copy.evidence.title}</h2>
            <p>{copy.evidence.lead}</p>
          </header>
          <div className={styles.evidenceTable} role='table' aria-label={copy.evidence.title}>
            {copy.evidence.rows.map(([source, id, status]) => (
              <div key={`${source}-${id}`} role='row'><span role='cell'><Database size={16} aria-hidden='true' />{source}</span><code role='cell'>{id}</code><strong role='cell'>{status}</strong></div>
            ))}
          </div>
          <p className={styles.evidenceNote}><ScanSearch size={17} aria-hidden='true' />{copy.evidence.freshness}</p>
        </div>
      </section>

      <section id='security' className={`${styles.section} ${styles.softSection}`} aria-labelledby='pc-ai-security-title'>
        <div className={styles.shell}>
          <header className={styles.sectionHeader}>
            <span className={styles.eyebrow}>{copy.security.eyebrow}</span>
            <h2 id='pc-ai-security-title'>{copy.security.title}</h2>
            <p>{copy.security.lead}</p>
          </header>
          <div className={styles.securityGrid}>
            {copy.security.cards.map(([title, body], index) => <article key={title}>{index === 0 ? <Network aria-hidden='true' /> : index === 1 ? <KeyRound aria-hidden='true' /> : index === 2 ? <UserCheck aria-hidden='true' /> : <ShieldCheck aria-hidden='true' />}<h3>{title}</h3><p>{body}</p></article>)}
          </div>
          <PublicAiGovernanceStrip locale={localeKey} />
        </div>
      </section>

      <section id='limitations' className={styles.section} aria-labelledby='pc-ai-limitations-title'>
        <div className={styles.shell}>
          <header className={styles.sectionHeader}>
            <span className={styles.eyebrow}>{copy.limitations.eyebrow}</span>
            <h2 id='pc-ai-limitations-title'>{copy.limitations.title}</h2>
            <p>{copy.limitations.lead}</p>
          </header>
          <ul className={styles.limitations}>{copy.limitations.items.map((item) => <li key={item}><TriangleAlert size={17} aria-hidden='true' /><span>{item}</span></li>)}</ul>
        </div>
      </section>

      <section id='connection' className={`${styles.section} ${styles.connectionSection}`} aria-labelledby='pc-ai-connection-title'>
        <div className={styles.shell}>
          <header className={styles.sectionHeader}>
            <span className={styles.eyebrow}>{copy.connection.eyebrow}</span>
            <h2 id='pc-ai-connection-title'>{copy.connection.title}</h2>
            <p>{copy.connection.lead}</p>
          </header>
          <div className={styles.connectionGrid}>{copy.connection.modes.map(([title, body]) => <article key={title}><h3>{title}</h3><p>{body}</p></article>)}</div>
          <p className={styles.productionNote}><ShieldCheck size={17} aria-hidden='true' />{copy.connection.note}</p>
          <div className={styles.heroActions}>
            <a href='/platform-v7/register' className={styles.primary}>{copy.connection.primary}<ArrowRight size={18} aria-hidden='true' /></a>
            <a href='/platform-v7' className={styles.secondary}>{copy.connection.secondary}</a>
          </div>
        </div>
      </section>
    </div>
  );
}
