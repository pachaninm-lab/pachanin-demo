import {
  capabilitiesForSection,
  weakestStatus,
  type PlatformKnowledgeLocale,
  type PlatformKnowledgeSectionId,
} from './assistant-capability-registry';

/**
 * Platform knowledge sections — what TAI is allowed to say about the platform
 * itself, in the order a person actually wants to hear it.
 *
 * Each section holds one answer per language, shaped as: what is true → why →
 * what it means concretely → one next step. Nothing here describes routing,
 * confidence or infrastructure; that vocabulary belongs to logs, not to a reader.
 *
 * Every section names the capabilities it rests on, so an answer degrades with
 * the evidence: a section built on a NOT_CONNECTED capability cannot be phrased
 * as a working integration no matter how the question is asked.
 */

export type PlatformKnowledgeSource = Readonly<{ label: string; href: string }>;

export type PlatformSectionCopy = Readonly<{
  title: string;
  /** The answer itself, first sentence first. */
  direct: string;
  /** Why it works that way. */
  explain: string;
  /** What it means in practice. */
  specifics: readonly string[];
  /** Exactly one next question or action. */
  next: string;
  /** Used when the question genuinely has two readings. */
  clarify: string;
}>;

export type PlatformKnowledgeSection = Readonly<{
  id: PlatformKnowledgeSectionId;
  capabilities: readonly string[];
  /** Terms that place a question in this section, per language. */
  match: Readonly<Record<PlatformKnowledgeLocale, readonly string[]>>;
  sources: readonly PlatformKnowledgeSource[];
  copy: Readonly<Record<PlatformKnowledgeLocale, PlatformSectionCopy>>;
}>;

export const PLATFORM_KNOWLEDGE_VERSION = 'platform-knowledge-sections-2026-08-01.v1';

const S = {
  home: { label: 'Главная платформы', href: '/platform-v7' },
  how: { label: 'Как работает сделка', href: '/platform-v7/how-it-works' },
  secure: { label: 'Безопасная зерновая сделка', href: '/platform-v7/secure-grain-deal' },
  fgis: { label: 'ФГИС «Зерно»', href: '/platform-v7/fgis-zerno' },
  privacy: { label: 'Конфиденциальность', href: '/platform-v7/privacy' },
  contact: { label: 'Связаться с проектом', href: '/platform-v7/contact' },
} as const;

const SECTIONS: readonly PlatformKnowledgeSection[] = [
  {
    id: 'platform_security',
    capabilities: ['server_authoritative_access', 'tenant_isolation', 'mfa_critical_actions', 'audit_trail'],
    match: {
      ru: ['как защищаются данные', 'защита данных', 'как защищены данные', 'данные защищены', 'безопасность платформы', 'это безопасно', 'насколько безопасно', 'защищена ли платформа', 'взлом', 'утечка данных', 'кибербезопасность', 'информационная безопасность'],
      en: ['how is data protected', 'data protection', 'is my data safe', 'is it secure', 'platform security', 'security of the platform', 'data breach', 'hacked', 'information security', 'cybersecurity'],
      zh: ['数据如何保护', '数据保护', '数据安全吗', '安全吗', '平台安全', '数据泄露', '被黑', '信息安全', '网络安全'],
    },
    sources: [S.secure, S.privacy],
    copy: {
      ru: {
        title: 'Как защищаются данные',
        direct: 'Защита строится на нескольких уровнях: доступ назначает сервер по роли и организации, данные разных организаций изолированы, чувствительные операции требуют дополнительного подтверждения, а изменения фиксируются в журнале аудита.',
        explain: 'Ключевое здесь — что решение о доступе принимает не браузер. Роль читается из подписанной сессии, а организация подставляется сервером, поэтому подменить их со стороны клиента нельзя.',
        specifics: [
          'Учётная запись и вход: сессия подписана и ограничена по сроку, критические действия требуют дополнительного подтверждения.',
          'Документы и Сделки: видны участникам в пределах роли, вместе с версией, источником и временем.',
          'Действия с деньгами и подписями: отдельная проверка полномочий и запись в журнал аудита.',
          'Помощник: работает на локальной модели и не имеет прямого доступа к базе — он получает только подготовленный контекст.',
        ],
        next: 'Могу отдельно показать, кто именно имеет доступ к каждому типу данных и какие действия ему разрешены — по учётной записи, документам, Сделке или платежам.',
        clarify: 'Ты спрашиваешь о персональных данных, документах или данных Сделки?',
      },
      en: {
        title: 'How data is protected',
        direct: 'Protection works in layers: the server assigns access by role and organization, data of different organizations is isolated, sensitive operations require an extra confirmation, and changes land in an audit journal.',
        explain: 'The important part is that the browser never decides access. The role is read from a signed session and the organization is applied server-side, so neither can be swapped from the client.',
        specifics: [
          'Account and sign-in: the session is signed and time-bounded, and critical actions ask for an extra confirmation.',
          'Documents and Deals: visible to participants within their role, together with version, source and time.',
          'Money and signature actions: a separate authority check plus an audit record.',
          'The assistant: runs on a local model with no direct database access — it only receives prepared context.',
        ],
        next: 'I can walk through who has access to each data type and what they may do with it — account, documents, Deal or payments.',
        clarify: 'Do you mean personal data, documents, or Deal data?',
      },
      zh: {
        title: '数据如何得到保护',
        direct: '保护分为多层：服务器按角色和组织分配访问权限，不同组织的数据相互隔离，敏感操作需要额外确认，所有变更都会记入审计日志。',
        explain: '关键在于访问权限不由浏览器决定。角色来自已签名的会话，组织由服务器确定，因此客户端无法替换二者。',
        specifics: [
          '账户与登录：会话经过签名并有有效期，关键操作需要额外确认。',
          '文件与交易：仅对参与方在其角色范围内可见，并保存版本、来源和时间。',
          '资金与签署操作：单独的权限校验并写入审计日志。',
          '助手：运行在本地模型上，没有数据库直连权限，只接收准备好的上下文。',
        ],
        next: '我可以逐项说明每类数据由谁访问、可以执行哪些操作——账户、文件、交易或支付。',
        clarify: '你指的是个人数据、文件，还是交易数据？',
      },
    },
  },
  {
    id: 'data_protection',
    capabilities: ['transport_security', 'model_data_boundary', 'tenant_isolation'],
    match: {
      ru: ['шифрование', 'шифруются ли', 'где хранятся данные', 'где физически', 'на каких серверах', 'передача данных', 'хранение данных', 'дата-центр', 'облако'],
      en: ['encryption', 'encrypted', 'where is data stored', 'which servers', 'data transfer', 'data storage', 'data center', 'cloud'],
      zh: ['加密', '数据存储在哪', '哪些服务器', '数据传输', '数据存放', '数据中心', '云'],
    },
    sources: [S.privacy, S.secure],
    copy: {
      ru: {
        title: 'Где и как хранятся данные',
        direct: 'Данные лежат в базе на собственном сервере в России, трафик между браузером и платформой идёт по защищённому соединению, а внутренние вызовы помощника подписываются и без действительной подписи не принимаются.',
        explain: 'Отдельный принцип: модель не ходит в базу. Помощник получает подготовленный контекст, поэтому у генерации нет способа «случайно» достать чужую запись.',
        specifics: [
          'База данных — единственный источник истины по Сделке; интерфейс не хранит параллельную копию состояния.',
          'Текст вопроса к помощнику не уходит во внешний облачный сервис: модель локальная.',
          'Сквозного шифрования между участниками Сделки нет — платформа обязана читать данные, чтобы проверять права и исполнение.',
        ],
        next: 'Показать, какие данные вообще попадают в Сделку и какие из них видит каждая роль?',
        clarify: 'Тебя интересует хранение персональных данных или данных Сделки и документов?',
      },
      en: {
        title: 'Where and how data is stored',
        direct: 'Data lives in a database on our own server in Russia, browser traffic runs over a secured connection, and the assistant’s internal calls are signed and rejected without a valid signature.',
        explain: 'A separate principle: the model never queries the database. It receives prepared context, so generation has no path to reach someone else’s record by accident.',
        specifics: [
          'The database is the single source of truth for a Deal; the interface keeps no parallel copy of state.',
          'Question text does not leave for an external cloud service — the model is local.',
          'There is no end-to-end encryption between Deal participants: the platform must read the data to enforce rights and execution.',
        ],
        next: 'Want me to show which data a Deal contains and what each role sees of it?',
        clarify: 'Are you asking about personal data, or about Deal and document data?',
      },
      zh: {
        title: '数据存储在哪里、如何存储',
        direct: '数据保存在位于俄罗斯的自有服务器的数据库中，浏览器流量通过加密连接传输，助手的内部调用带签名，签名无效即被拒绝。',
        explain: '另一个原则是模型不查询数据库。助手只接收准备好的上下文，因此生成过程无法“顺手”取到他人的记录。',
        specifics: [
          '数据库是交易的唯一事实来源，界面不保存并行的状态副本。',
          '提问文本不会发送到外部云服务——模型是本地的。',
          '交易参与方之间没有端到端加密：平台必须读取数据才能校验权限和履约。',
        ],
        next: '需要我说明一笔交易包含哪些数据、每个角色分别能看到什么吗？',
        clarify: '你问的是个人数据，还是交易和文件数据？',
      },
    },
  },
  {
    id: 'privacy',
    capabilities: ['privacy_boundary_public_assistant', 'tenant_isolation', 'data_subject_rights'],
    match: {
      ru: ['конфиденциальность', 'персональные данные', 'приватность', '152-фз', 'кто видит мои данные', 'сотрудник платформы', 'кто увидит', 'кто это увидит', 'коммерческая тайна'],
      en: ['privacy', 'personal data', 'gdpr', 'who sees my data', 'platform employee', 'who will see', 'trade secret', 'confidential'],
      zh: ['隐私', '个人数据', '谁能看到我的数据', '平台员工', '谁会看到', '商业秘密', '保密'],
    },
    sources: [S.privacy],
    copy: {
      ru: {
        title: 'Кто видит твои данные',
        direct: 'Данные Сделки видят только её участники в пределах своей роли, и данные разных организаций друг другу не доступны. Публичный помощник на сайте не видит кабинетов вообще — ему нечего раскрыть, даже если попросить.',
        explain: 'Сотрудник платформы — не исключение из правил, а отдельная роль со своими ограничениями: доступ операторов и поддержки ограничен назначенной задачей и так же попадает в журнал аудита.',
        specifics: [
          'Участник другой организации не может открыть твою Сделку — организация подставляется сервером.',
          'Условия сделки видны сторонам сделки, а не всем пользователям платформы.',
          'Каждое обращение к чувствительным данным оставляет запись: кто, что и когда смотрел.',
        ],
        next: 'Разобрать конкретный случай: кто увидит документ, условия сделки или платёжные реквизиты?',
        clarify: 'Речь о персональных данных сотрудника или о коммерческих условиях сделки?',
      },
      en: {
        title: 'Who sees your data',
        direct: 'Deal data is visible to its participants within their role, and organizations cannot reach each other’s data. The public assistant on the site sees no workspace at all — there is nothing for it to disclose.',
        explain: 'A platform employee is not an exception to the rules but a role with its own limits: operator and support access is bounded by the assigned task and lands in the audit journal too.',
        specifics: [
          'A member of another organization cannot open your Deal — the organization is applied server-side.',
          'Deal terms are visible to the parties of that Deal, not to every platform user.',
          'Each access to sensitive data leaves a record of who looked at what and when.',
        ],
        next: 'Want to take a concrete case — who sees a document, the deal terms, or payment details?',
        clarify: 'Do you mean an employee’s personal data, or the commercial terms of a deal?',
      },
      zh: {
        title: '谁能看到你的数据',
        direct: '交易数据只对参与方在其角色范围内可见，不同组织之间无法互相访问。网站上的公共助手根本看不到工作台——即使被要求，也没有可披露的内容。',
        explain: '平台员工不是规则之外的例外，而是一种有自身限制的角色：运营和支持人员的访问受指派任务限制，同样会记入审计日志。',
        specifics: [
          '其他组织的成员无法打开你的交易——组织由服务器确定。',
          '交易条件只对该交易的当事方可见，而不是对全部平台用户。',
          '每次访问敏感数据都会留下记录：谁、看了什么、何时查看。',
        ],
        next: '要不要具体分析某个场景：谁能看到文件、交易条件或支付信息？',
        clarify: '你说的是员工个人数据，还是交易的商业条件？',
      },
    },
  },
  {
    id: 'roles_permissions',
    capabilities: ['rbac_roles', 'server_authoritative_access', 'server_cabinet_rbac_enforcement'],
    match: {
      ru: ['роли', 'права доступа', 'кто отвечает', 'полномочия', 'кто может изменить', 'кто подтверждает', 'разграничение доступа', 'кому разрешено', 'кто имеет доступ'],
      en: ['roles', 'permissions', 'who is responsible', 'authority', 'who can change', 'who confirms', 'access rights', 'who is allowed', 'who has access'],
      zh: ['角色', '权限', '谁负责', '授权', '谁可以修改', '谁来确认', '访问权限', '谁被允许', '谁有权限'],
    },
    sources: [S.how, S.secure],
    copy: {
      ru: {
        title: 'Роли и права',
        direct: 'Роль выдаёт сервер по подтверждённому членству в организации, и она определяет и видимость данных, и набор доступных действий. Пользователь не выбирает роль сам.',
        explain: 'Поэтому «кто отвечает» на каждом шаге — не вопрос договорённости в переписке: у следующего действия по Сделке всегда есть роль-владелец.',
        specifics: [
          'Продавец, покупатель, логистика, водитель, элеватор, лаборатория, сюрвейер, банк, оператор, комплаенс, арбитр и руководитель видят разные проекции одной Сделки.',
          'Действие, недоступное роли, не просто спрятано в интерфейсе — оно отклоняется на сервере.',
          'Серверная проверка кабинетов сейчас работает в наблюдательном режиме: расхождения фиксируются, границу держат серверные данные и доменные проверки.',
        ],
        next: 'Показать права конкретной роли — например, что доступно водителю или банку?',
        clarify: 'Тебя интересует своя роль или распределение прав между всеми участниками?',
      },
      en: {
        title: 'Roles and permissions',
        direct: 'The server grants the role from verified membership in an organization, and that role defines both data visibility and the available actions. Users do not pick their own role.',
        explain: 'So "who is responsible" at each step is not a matter of agreement in chat: every next action on a Deal has an owning role.',
        specifics: [
          'Seller, buyer, logistics, driver, elevator, laboratory, surveyor, bank, operator, compliance, arbitrator and executive see different projections of one Deal.',
          'An action a role may not perform is not merely hidden in the UI — it is rejected on the server.',
          'Server-side cabinet checking currently runs in report mode: mismatches are recorded while server data and domain checks hold the boundary.',
        ],
        next: 'Want the permissions of a specific role — say, what a driver or a bank can do?',
        clarify: 'Do you mean your own role, or how rights are split across all participants?',
      },
      zh: {
        title: '角色与权限',
        direct: '角色由服务器根据组织内已验证的成员关系授予，它同时决定数据可见性和可执行的操作。用户不能自行选择角色。',
        explain: '因此每一步“谁负责”不取决于沟通中的约定：交易的下一步操作始终有一个归属角色。',
        specifics: [
          '卖方、买方、物流、司机、粮库、实验室、检验、银行、运营、合规、仲裁和管理层看到同一笔交易的不同视图。',
          '角色无权执行的操作不只是在界面隐藏，而是在服务器端被拒绝。',
          '服务器端工作台校验目前处于观察模式：记录不一致，边界由服务器数据和领域校验维持。',
        ],
        next: '需要看某个具体角色的权限吗，例如司机或银行？',
        clarify: '你关心的是自己的角色，还是所有参与方之间的权限划分？',
      },
    },
  },
  {
    id: 'tenant_isolation',
    capabilities: ['tenant_isolation', 'server_authoritative_access'],
    match: {
      ru: ['изоляция', 'чужая организация', 'другая компания', 'чужие данные', 'чужую сделку', 'разные компании', 'мультитенант'],
      en: ['isolation', 'another organization', 'other company', 'other users data', 'another deal', 'multi-tenant', 'tenant'],
      zh: ['隔离', '其他组织', '别的公司', '他人数据', '别人的交易', '多租户'],
    },
    sources: [S.secure, S.privacy],
    copy: {
      ru: {
        title: 'Изоляция организаций',
        direct: 'Организация подставляется сервером из подтверждённой сессии и участвует в каждом запросе к данным, поэтому запросить Сделку чужой компании нельзя даже прямым обращением к API.',
        explain: 'Изоляция держится на двух уровнях сразу — на уровне запроса и на уровне базы, — чтобы ошибка в одном месте не открывала данные целиком.',
        specifics: [
          'Идентификатор организации не принимается из браузера ни в каком виде.',
          'Помощник получает контекст только текущей организации и текущего диалога.',
          'Промышленной эксплуатацией эта изоляция пока не подтверждена — она проверена кодом и тестами.',
        ],
        next: 'Разобрать, что происходит, когда одна организация участвует сразу в нескольких Сделках?',
        clarify: 'Речь про разделение между компаниями или про разделение ролей внутри одной компании?',
      },
      en: {
        title: 'Organization isolation',
        direct: 'The organization comes from the verified session server-side and takes part in every data query, so another company’s Deal cannot be requested even by calling the API directly.',
        explain: 'Isolation holds at two levels at once — the query and the database — so a mistake in one place does not open the data wholesale.',
        specifics: [
          'The organization identifier is never accepted from the browser in any form.',
          'The assistant receives context of the current organization and the current conversation only.',
          'This isolation is not yet confirmed by industrial operation — it is verified by code and tests.',
        ],
        next: 'Want to look at what happens when one organization takes part in several Deals at once?',
        clarify: 'Do you mean separation between companies, or separation of roles inside one company?',
      },
      zh: {
        title: '组织隔离',
        direct: '组织由服务器从已验证会话中确定，并参与每一次数据查询，因此即使直接调用 API 也无法获取其他公司的交易。',
        explain: '隔离同时在查询层和数据库层生效，使某一处的疏漏不会导致数据整体暴露。',
        specifics: [
          '任何形式的组织标识都不从浏览器接受。',
          '助手只接收当前组织和当前对话的上下文。',
          '该隔离尚未经过工业级运行验证——目前由代码和测试保证。',
        ],
        next: '要不要看看一个组织同时参与多笔交易时会怎样？',
        clarify: '你指的是公司之间的隔离，还是同一公司内部的角色隔离？',
      },
    },
  },
  {
    id: 'mfa',
    capabilities: ['mfa_critical_actions', 'session_boundary'],
    match: {
      ru: ['двухфакторн', 'mfa', '2fa', 'код подтверждения', 'подтверждение входа', 'дополнительное подтверждение'],
      en: ['two-factor', 'mfa', '2fa', 'verification code', 'login confirmation', 'extra confirmation'],
      zh: ['双因素', '两步验证', 'mfa', '验证码', '登录确认', '额外确认'],
    },
    sources: [S.secure],
    copy: {
      ru: {
        title: 'Подтверждение входа и операций',
        direct: 'Вход поддерживает многофакторное подтверждение, а денежные операции и подписи требуют отдельного подтверждения даже внутри уже открытой сессии.',
        explain: 'Смысл в том, чтобы украденная вкладка не превращалась автоматически в право распорядиться деньгами: критическое действие проверяется отдельно от факта входа.',
        specifics: [
          'Подтверждение проверяется на сервере, а не в интерфейсе.',
          'Отказ в подтверждении не оставляет операцию наполовину выполненной.',
          'Обязательная MFA для всех пользователей — вопрос политики организации, а не текущая настройка по умолчанию.',
        ],
        next: 'Показать, какие именно действия требуют повторного подтверждения?',
        clarify: 'Тебя интересует вход в систему или подтверждение денежных операций?',
      },
      en: {
        title: 'Confirming sign-in and operations',
        direct: 'Sign-in supports multi-factor confirmation, and money or signature actions require a separate confirmation even inside an already open session.',
        explain: 'The point is that a stolen tab does not automatically become the right to move money: a critical action is checked separately from the fact of signing in.',
        specifics: [
          'The confirmation is verified on the server, not in the interface.',
          'A declined confirmation does not leave the operation half-applied.',
          'Mandatory MFA for every user is an organization policy question, not the current default.',
        ],
        next: 'Want the list of actions that ask for a repeat confirmation?',
        clarify: 'Do you mean signing in, or confirming money operations?',
      },
      zh: {
        title: '登录与操作确认',
        direct: '登录支持多因素确认，资金和签署类操作即使在已登录的会话中也需要单独确认。',
        explain: '目的在于：被盗用的页面不会自动等同于动用资金的权利，关键操作与登录事实分开校验。',
        specifics: [
          '确认在服务器端校验，而不是在界面上。',
          '确认被拒绝时，操作不会停留在半完成状态。',
          '是否对所有用户强制 MFA 属于组织政策问题，并非当前默认设置。',
        ],
        next: '需要看看哪些操作会要求再次确认吗？',
        clarify: '你问的是登录，还是资金操作的确认？',
      },
    },
  },
  {
    id: 'audit',
    capabilities: ['audit_trail', 'audit_evidence_export'],
    match: {
      ru: ['аудит', 'журнал', 'история изменений', 'кто менял', 'логи', 'кто смотрел', 'след действий'],
      en: ['audit', 'journal', 'change history', 'who changed', 'logs', 'who viewed', 'action trail'],
      zh: ['审计', '日志', '变更历史', '谁修改', '记录', '谁查看', '操作痕迹'],
    },
    sources: [S.secure, S.how],
    copy: {
      ru: {
        title: 'Журнал аудита',
        direct: 'Критические действия и изменения записываются в журнал: кто, что, когда и на каком основании. Запись создаёт сервер, а не интерфейс.',
        explain: 'Поэтому спор опирается на события, а не на переписку: у каждого утверждения есть источник, время и версия.',
        specifics: [
          'Журнал по Сделке можно выгрузить набором с контрольной суммой.',
          'Просмотр чувствительных данных тоже оставляет след.',
          'Юридическую значимость выгрузки нужно подтверждать отдельно — сама по себе она доказательство, а не решение.',
        ],
        next: 'Показать, как выглядит доказательная база по одной Сделке?',
        clarify: 'Тебе нужен журнал по действиям пользователей или по одной конкретной Сделке?',
      },
      en: {
        title: 'Audit journal',
        direct: 'Critical actions and changes are recorded: who, what, when and on which basis. The record is created by the server, not by the interface.',
        explain: 'That is why a dispute rests on events rather than on messages: every statement has a source, a time and a version.',
        specifics: [
          'A Deal’s journal can be exported as a checksummed set.',
          'Viewing sensitive data also leaves a trace.',
          'Legal weight of an export must be established separately — on its own it is evidence, not a decision.',
        ],
        next: 'Want to see what the evidence set for one Deal looks like?',
        clarify: 'Do you need the journal of user actions, or of one specific Deal?',
      },
      zh: {
        title: '审计日志',
        direct: '关键操作和变更都会被记录：谁、做了什么、何时、依据是什么。记录由服务器生成，而不是界面。',
        explain: '因此争议依据的是事件而不是聊天记录：每条陈述都有来源、时间和版本。',
        specifics: [
          '某笔交易的日志可以按带校验和的方式导出。',
          '查看敏感数据同样会留下痕迹。',
          '导出的法律效力需要单独确认——它本身是证据，而不是结论。',
        ],
        next: '需要看看一笔交易的证据集合是什么样的吗？',
        clarify: '你需要的是用户操作日志，还是某一笔交易的日志？',
      },
    },
  },
  {
    id: 'sessions',
    capabilities: ['session_boundary', 'server_authoritative_access'],
    match: {
      ru: ['сессия', 'выход из системы', 'как восстановить доступ', 'забыл пароль', 'не могу войти', 'потерял доступ', 'вход в систему'],
      en: ['session', 'sign out', 'restore access', 'forgot password', 'cannot log in', 'lost access', 'login'],
      zh: ['会话', '退出登录', '恢复访问', '忘记密码', '无法登录', '失去访问', '登录'],
    },
    sources: [S.secure, S.contact],
    copy: {
      ru: {
        title: 'Сессии и восстановление доступа',
        direct: 'Сессия подписана и ограничена по сроку: истёкший или подменённый токен роли не даёт, а выход закрывает доступ сразу. Восстановление доступа идёт через администратора организации, а не через помощника.',
        explain: 'Помощник намеренно не умеет выдавать доступ — иначе разговор в чате стал бы способом обойти проверку прав.',
        specifics: [
          'Забытый пароль восстанавливается штатной процедурой входа.',
          'Если сотрудник уволился, доступ снимает администратор организации, и это попадает в журнал.',
          'Ни один помощник не выдаёт роль, не расширяет полномочия и не подтверждает личность.',
        ],
        next: 'Подсказать, к кому обратиться за восстановлением доступа в твоей организации?',
        clarify: 'Ты не можешь войти сам или нужно закрыть доступ другому сотруднику?',
      },
      en: {
        title: 'Sessions and restoring access',
        direct: 'The session is signed and time-bounded: an expired or forged token grants no role, and signing out closes access immediately. Access is restored through the organization administrator, not through the assistant.',
        explain: 'The assistant deliberately cannot grant access — otherwise a chat conversation would become a way around the permission check.',
        specifics: [
          'A forgotten password is restored through the standard sign-in procedure.',
          'When an employee leaves, the organization administrator revokes access and that lands in the journal.',
          'No assistant grants a role, widens authority or verifies identity.',
        ],
        next: 'Want me to point to who restores access in your organization?',
        clarify: 'Are you unable to sign in yourself, or do you need to revoke another employee’s access?',
      },
      zh: {
        title: '会话与恢复访问',
        direct: '会话经过签名并有有效期：过期或伪造的令牌不会授予角色，登出会立即关闭访问。恢复访问需通过组织管理员，而不是助手。',
        explain: '助手被有意设计为无法授予访问权限，否则聊天就会成为绕过权限校验的途径。',
        specifics: [
          '忘记密码通过标准登录流程恢复。',
          '员工离职时由组织管理员收回权限，并记入日志。',
          '任何助手都不会授予角色、扩大权限或验证身份。',
        ],
        next: '需要我说明在你的组织里由谁负责恢复访问吗？',
        clarify: '是你自己无法登录，还是需要收回其他员工的权限？',
      },
    },
  },
  {
    id: 'documents',
    capabilities: ['document_access_control', 'audit_trail', 'evidence_retention'],
    match: {
      ru: ['кто видит мои документы', 'доступ к документам', 'документы сделки', 'версия документа', 'подпись документа', 'кэп', 'эцп'],
      en: ['who sees my documents', 'document access', 'deal documents', 'document version', 'document signature', 'electronic signature'],
      zh: ['谁能看到我的文件', '文件访问', '交易文件', '文件版本', '文件签署', '电子签名'],
    },
    sources: [S.how, S.privacy],
    copy: {
      ru: {
        title: 'Документы и доступ к ним',
        direct: 'Документ видят участники той Сделки, к которой он относится, и только в пределах своей роли. Вместе с документом хранятся версия, источник и время — подменить их незаметно нельзя.',
        explain: 'Документ не живёт отдельно от Сделки: именно связь с Сделкой и определяет, кому он виден и что на его основании разрешено.',
        specifics: [
          'Загрузка новой версии не стирает предыдущую — обе остаются в истории.',
          'Обращение к документу оставляет запись в журнале.',
          'Сквозного шифрования у документов нет: платформа читает их, чтобы проверять права и связь со Сделкой.',
        ],
        next: 'Разобрать конкретный комплект — например, документы приёмки или расчёта?',
        clarify: 'Речь о документах твоей организации или о документах контрагента в общей Сделке?',
      },
      en: {
        title: 'Documents and access to them',
        direct: 'A document is visible to participants of the Deal it belongs to, within their role. Version, source and time are stored with it, so it cannot be swapped unnoticed.',
        explain: 'A document does not live apart from its Deal: that link is exactly what determines who sees it and what it authorizes.',
        specifics: [
          'Uploading a new version does not erase the previous one — both stay in history.',
          'Accessing a document leaves a journal record.',
          'Documents are not end-to-end encrypted: the platform reads them to check rights and the Deal link.',
        ],
        next: 'Want to go through a specific set — acceptance or settlement documents, for example?',
        clarify: 'Do you mean your organization’s documents, or a counterparty’s documents in a shared Deal?',
      },
      zh: {
        title: '文件及其访问',
        direct: '文件仅对其所属交易的参与方在其角色范围内可见。版本、来源和时间随文件一同保存，无法被悄悄替换。',
        explain: '文件不会脱离交易独立存在：正是这种关联决定了谁能看到它、它能作为什么依据。',
        specifics: [
          '上传新版本不会删除旧版本，两者都保留在历史中。',
          '访问文件会留下日志记录。',
          '文件没有端到端加密：平台需要读取它们以校验权限和交易关联。',
        ],
        next: '要不要看某一组具体文件，例如验收或结算文件？',
        clarify: '你指的是本组织的文件，还是共同交易中对方的文件？',
      },
    },
  },
  {
    id: 'backups',
    capabilities: ['backup_authority', 'release_rollback'],
    match: {
      ru: ['резервное копирование', 'резервная копия', 'бэкап', 'копия базы'],
      en: ['backup', 'backups', 'database copy', 'snapshot'],
      zh: ['备份', '数据库副本', '快照'],
    },
    sources: [S.secure],
    copy: {
      ru: {
        title: 'Резервные копии',
        direct: 'Перед изменением production база определяется однозначно и снимается дамп, поэтому у каждого выката есть точка возврата. Регулярное расписание копий и регулярная проверка восстановления пока не подтверждены — обещать их нельзя.',
        explain: 'Разница принципиальная: точка возврата на выкате защищает от неудачного релиза, но не заменяет план восстановления после потери данных.',
        specifics: [
          'Определение боевой базы проверяется до любых изменений и останавливает выкат при расхождении.',
          'Дамп снимается на той же базе, которую действительно использует активный API.',
          'Отдельного графика хранения копий и регулярных учений по восстановлению сейчас нет.',
        ],
        next: 'Показать, как устроен откат неудачного выката?',
        clarify: 'Тебя интересует защита от сбоя выката или восстановление после потери данных?',
      },
      en: {
        title: 'Backups',
        direct: 'Before a production change the database is resolved unambiguously and a dump is taken, so every release has a rollback point. A regular backup schedule and regular restore drills are not confirmed yet — they must not be promised.',
        explain: 'The distinction matters: a release rollback point protects against a bad deployment, but does not replace a recovery plan for data loss.',
        specifics: [
          'The production database authority is verified before any change and stops the release on a mismatch.',
          'The dump is taken from the same database the active API actually uses.',
          'There is currently no separate retention schedule for copies and no regular restore drill.',
        ],
        next: 'Want to see how rollback of a failed release works?',
        clarify: 'Do you mean protection against a failed release, or recovery after data loss?',
      },
      zh: {
        title: '备份',
        direct: '在变更生产环境前会明确确定数据库并生成转储，因此每次发布都有回滚点。定期备份计划和定期恢复演练尚未确认——不能作出承诺。',
        explain: '这个区别很重要：发布回滚点能应对失败的部署，但不能替代数据丢失后的恢复方案。',
        specifics: [
          '任何变更前都会校验生产数据库归属，不一致时停止发布。',
          '转储取自活动 API 实际使用的同一个数据库。',
          '目前没有单独的副本保留计划，也没有定期恢复演练。',
        ],
        next: '需要看看失败发布的回滚是如何工作的吗？',
        clarify: '你关心的是发布失败的防护，还是数据丢失后的恢复？',
      },
    },
  },
  {
    id: 'recovery',
    capabilities: ['release_rollback', 'backup_authority', 'availability'],
    match: {
      ru: ['что произойдет при сбое', 'что будет при сбое', 'при сбое', 'авария', 'падение системы', 'откат', 'восстановление после сбоя', 'если произойдет ошибка'],
      en: ['what happens on failure', 'outage', 'system down', 'rollback', 'disaster recovery', 'if an error occurs'],
      zh: ['故障时会怎样', '宕机', '系统故障', '回滚', '灾难恢复', '出错时'],
    },
    sources: [S.secure, S.contact],
    copy: {
      ru: {
        title: 'Что происходит при сбое',
        direct: 'Незавершённая операция не остаётся наполовину выполненной: состояние Сделки меняет сервер, а повторная отправка не создаёт вторую операцию. Неудачный выкат откатывается на предыдущую подтверждённую версию — этот путь уже отрабатывал на production.',
        explain: 'Основная защита здесь — идемпотентность: повтор после обрыва связи безопасен, потому что операция определяется своим идентификатором, а не фактом нажатия кнопки.',
        specifics: [
          'Сбой внешнего провайдера не должен повреждать Сделку — он фиксируется как недоставленное событие.',
          'Полевые действия могут накапливаться в ограниченной очереди и досылаться позже.',
          'Подтверждённого SLA по времени восстановления нет: контур один, нагрузочных доказательств пока нет.',
        ],
        next: 'Разобрать конкретный сценарий — обрыв связи у водителя или недоступность банка?',
        clarify: 'Речь о сбое на твоей стороне или о недоступности самой платформы?',
      },
      en: {
        title: 'What happens on failure',
        direct: 'An interrupted operation does not stay half-applied: the server owns Deal state, and a retry does not create a second operation. A failed release rolls back to the previous confirmed revision — that path has already been exercised on production.',
        explain: 'The core protection is idempotency: retrying after a dropped connection is safe because the operation is identified by its own key, not by the fact a button was pressed.',
        specifics: [
          'A provider failure must not corrupt the Deal — it is recorded as an undelivered event.',
          'Field actions can queue in a bounded buffer and be sent later.',
          'There is no confirmed recovery-time SLA: there is one contour and no load evidence yet.',
        ],
        next: 'Want to walk a concrete scenario — a driver losing connectivity, or a bank being unavailable?',
        clarify: 'Do you mean a failure on your side, or the platform itself being unavailable?',
      },
      zh: {
        title: '发生故障时会怎样',
        direct: '被中断的操作不会停留在半完成状态：交易状态由服务器掌握，重试不会产生第二笔操作。发布失败会回滚到上一份已确认版本——该路径已在生产环境执行过。',
        explain: '核心保护是幂等性：断线后重试是安全的，因为操作由自身标识确定，而不是由是否点击按钮决定。',
        specifics: [
          '外部供应商故障不应破坏交易——它会被记录为未送达事件。',
          '现场操作可在受限队列中缓存并稍后补发。',
          '目前没有确认的恢复时间 SLA：只有一个环境，也还没有负载证据。',
        ],
        next: '要不要分析具体场景，比如司机断网或银行不可用？',
        clarify: '你指的是你这边的故障，还是平台本身不可用？',
      },
    },
  },
  {
    id: 'retention',
    capabilities: ['evidence_retention', 'audit_trail'],
    match: {
      ru: ['сколько хранится', 'срок хранения', 'как долго хранятся', 'хранение документов'],
      en: ['how long is it stored', 'retention period', 'how long do you keep', 'document retention'],
      zh: ['保存多久', '保留期限', '保存多长时间', '文件保留'],
    },
    sources: [S.privacy],
    copy: {
      ru: {
        title: 'Сроки хранения',
        direct: 'Срок хранения привязан к Сделке и правовому основанию, а не к бессрочному накоплению: документ и доказательство живут столько, сколько нужно для исполнения, отчётности и возможного спора.',
        explain: 'Поэтому «удалить сейчас» и «хранить до конца срока» — не противоречие: часть данных обязана остаться, и у этого есть названное основание.',
        specifics: [
          'Документы Сделки хранятся, пока действуют обязательства и сроки предъявления претензий.',
          'Записи журнала аудита нельзя удалять выборочно — иначе журнал перестаёт быть доказательством.',
          'Конкретные сроки по каждому виду документа зависят от договора и законодательства, а не задаются помощником.',
        ],
        next: 'Разобрать срок по конкретному типу документа — договор, акт приёмки или протокол лаборатории?',
        clarify: 'Тебя интересуют документы Сделки или персональные данные сотрудников?',
      },
      en: {
        title: 'Retention periods',
        direct: 'Retention is bound to the Deal and its legal basis rather than to unlimited accumulation: a document or evidence lives as long as execution, reporting and a possible dispute require.',
        explain: 'So "delete now" and "keep until the term ends" are not a contradiction: some data must remain, and there is a named basis for it.',
        specifics: [
          'Deal documents are kept while obligations and claim periods are in force.',
          'Audit journal entries cannot be deleted selectively — otherwise the journal stops being evidence.',
          'Exact periods per document type follow the contract and the law, not the assistant.',
        ],
        next: 'Want the period for a specific document type — contract, acceptance act or laboratory protocol?',
        clarify: 'Do you mean Deal documents, or employees’ personal data?',
      },
      zh: {
        title: '保存期限',
        direct: '保存期限与交易及其法律依据绑定，而不是无限期堆积：文件和证据保存到履约、报告和可能争议所需的时间为止。',
        explain: '因此“立即删除”和“保存到期限结束”并不矛盾：部分数据必须保留，并且有明确依据。',
        specifics: [
          '交易文件在义务和索赔期限有效期间保留。',
          '审计日志条目不能被选择性删除，否则日志将不再是证据。',
          '各类文件的具体期限取决于合同和法律，而不是由助手规定。',
        ],
        next: '需要某类文件的具体期限吗，比如合同、验收单或实验室报告？',
        clarify: '你指的是交易文件，还是员工个人数据？',
      },
    },
  },
  {
    id: 'deletion',
    capabilities: ['data_subject_rights', 'evidence_retention'],
    match: {
      ru: ['можно ли удалить', 'а можно удалить', 'удалить мои данные', 'удаление данных', 'право на забвение', 'отозвать согласие'],
      en: ['can i delete', 'delete my data', 'data deletion', 'right to be forgotten', 'withdraw consent'],
      zh: ['可以删除吗', '删除我的数据', '数据删除', '被遗忘权', '撤回同意'],
    },
    sources: [S.privacy, S.contact],
    copy: {
      ru: {
        title: 'Удаление данных',
        direct: 'Запрос на доступ, исправление и удаление персональных данных обрабатывается отдельным маршрутом. Данные, которые обязаны остаться по договору или закону, сохраняются — с явным указанием основания, а не молча.',
        explain: 'Полностью стереть историю исполненной Сделки нельзя: на ней держатся расчёты, отчётность и возможный спор, поэтому удаляется то, что удаляемо, и это фиксируется.',
        specifics: [
          'Персональные данные сотрудника и данные Сделки — разные категории с разными правилами.',
          'Удаление фиксируется в журнале: видно, что и когда было удалено.',
          'Мгновенного удаления из всех резервных копий не бывает — это относится к любой системе с копиями.',
        ],
        next: 'Оформить запрос по конкретной категории данных — учётная запись, документы или переписка?',
        clarify: 'Речь про твою учётную запись или про данные организации в Сделках?',
      },
      en: {
        title: 'Deleting data',
        direct: 'Access, correction and deletion requests for personal data run through a dedicated route. Records that must remain under contract or law are kept — with the basis stated explicitly, not silently.',
        explain: 'The history of an executed Deal cannot be erased wholesale: settlements, reporting and a possible dispute rest on it, so what can be deleted is deleted and recorded.',
        specifics: [
          'An employee’s personal data and Deal data are different categories with different rules.',
          'Deletion is written to the journal: what was removed and when stays visible.',
          'Instant deletion from every backup does not exist — that is true of any system with copies.',
        ],
        next: 'Want to raise a request for a specific category — account, documents or messages?',
        clarify: 'Do you mean your own account, or the organization’s data inside Deals?',
      },
      zh: {
        title: '删除数据',
        direct: '个人数据的访问、更正和删除请求通过专门流程处理。依合同或法律必须保留的记录会保留，并明确说明依据，而不是默默保留。',
        explain: '已履约交易的历史无法整体抹除：结算、报告和可能的争议都以其为依据，因此能删除的会被删除并记录在案。',
        specifics: [
          '员工个人数据与交易数据属于不同类别，规则不同。',
          '删除操作会写入日志：删除了什么、何时删除都可查。',
          '任何带副本的系统都不存在从所有备份中即时删除。',
        ],
        next: '需要针对某一类数据提交请求吗——账户、文件还是消息？',
        clarify: '你指的是你的账户，还是交易中的组织数据？',
      },
    },
  },
  {
    id: 'exports',
    capabilities: ['audit_evidence_export', 'document_access_control'],
    match: {
      ru: ['выгрузка', 'экспорт', 'скачать данные', 'выгрузить отчет', 'забрать свои данные'],
      en: ['export', 'download data', 'export report', 'take my data out', 'data portability'],
      zh: ['导出', '下载数据', '导出报告', '带走我的数据', '数据可携'],
    },
    sources: [S.how, S.privacy],
    copy: {
      ru: {
        title: 'Выгрузка данных',
        direct: 'Журнал и доказательства по Сделке выгружаются набором с контрольной суммой, поэтому выгрузку можно проверить, а не только показать.',
        explain: 'Контрольная сумма нужна именно для спора: она отличает «вот выгрузка из системы» от «вот файл, который кто-то отредактировал».',
        specifics: [
          'Выгрузка ограничена правами роли — она не расширяет доступ.',
          'В набор попадают события, документы и их версии, а не только итоговая таблица.',
          'Юридическая значимость выгрузки требует отдельной оценки: это доказательство, а не решение.',
        ],
        next: 'Показать, что войдёт в выгрузку по одной Сделке?',
        clarify: 'Тебе нужна выгрузка по Сделке или отчёт по всем сделкам организации?',
      },
      en: {
        title: 'Exporting data',
        direct: 'A Deal’s journal and evidence export as a checksummed set, so the export can be verified rather than merely displayed.',
        explain: 'The checksum exists for disputes: it separates "this came out of the system" from "this is a file someone edited".',
        specifics: [
          'An export is bounded by the role’s rights — it never widens access.',
          'The set contains events, documents and their versions, not only a summary table.',
          'Legal weight of an export needs separate assessment: it is evidence, not a decision.',
        ],
        next: 'Want to see what a single Deal’s export contains?',
        clarify: 'Do you need an export for one Deal, or a report across the organization’s deals?',
      },
      zh: {
        title: '数据导出',
        direct: '交易的日志和证据以带校验和的集合导出，因此导出结果可被验证，而不仅仅是展示。',
        explain: '校验和正是为争议而设：它区分“这是系统导出的”和“这是有人编辑过的文件”。',
        specifics: [
          '导出受角色权限限制，不会扩大访问范围。',
          '集合包含事件、文件及其版本，而不只是汇总表。',
          '导出的法律效力需单独评估：它是证据，不是结论。',
        ],
        next: '需要看看单笔交易的导出包含什么吗？',
        clarify: '你需要单笔交易的导出，还是组织全部交易的报表？',
      },
    },
  },
  {
    id: 'integrations',
    capabilities: ['external_integrations', 'api_boundary'],
    match: {
      ru: ['интеграция', '1с', 'erp', 'crm', 'эдо', 'фгис', 'сдиз', 'api', 'обмен данными', 'подключить систему'],
      en: ['integration', 'erp', 'crm', 'edi', 'api', 'data exchange', 'connect system', 'accounting system'],
      zh: ['集成', 'erp', 'crm', '电子单证', 'api', '数据交换', '对接系统'],
    },
    sources: [S.fgis, S.contact],
    copy: {
      ru: {
        title: 'Интеграции',
        direct: 'Интерфейсы для 1С, ERP, ЭДО, ФГИС «Зерно» и банков спроектированы, но живого подключения сейчас нет: для него нужны договор, реквизиты и отдельная приёмка. Говорить, что интеграция работает, было бы неправдой.',
        explain: 'Архитектурная готовность и работающее подключение — разные вещи, и путать их дороже всего именно в интеграциях, где ошибка видна только в реальном обмене.',
        specifics: [
          'У каждой интеграции отдельные реквизиты, очередь отправки, подпись и сверка.',
          'Повторный callback от внешней системы не создаёт вторую операцию.',
          'Недоступность внешней системы не должна повреждать Сделку — событие остаётся недоставленным, а не потерянным.',
        ],
        next: 'Обсудить конкретную систему на твоей стороне — что и в какую сторону должно передаваться?',
        clarify: 'Тебя интересует обмен документами или обмен данными Сделки?',
      },
      en: {
        title: 'Integrations',
        direct: 'Interfaces for accounting systems, ERP, EDI, grain-government systems and banks are designed, but there is no live connection today: it needs a contract, credentials and separate acceptance. Saying an integration works would be untrue.',
        explain: 'Architectural readiness and a working connection are different things, and conflating them is most expensive precisely in integrations, where the error only shows in real exchange.',
        specifics: [
          'Each integration has its own credentials, outbound queue, signature and reconciliation.',
          'A repeated callback from an external system does not create a second operation.',
          'An unavailable external system must not corrupt the Deal — the event stays undelivered rather than lost.',
        ],
        next: 'Want to discuss a specific system on your side — what should flow, and in which direction?',
        clarify: 'Do you mean document exchange, or Deal data exchange?',
      },
      zh: {
        title: '系统集成',
        direct: '面向财务系统、ERP、电子单证、粮食政务系统和银行的接口已设计，但目前没有真实连接：这需要合同、凭据和单独验收。声称集成已在运行是不真实的。',
        explain: '架构就绪与实际连接是两回事，而在集成领域混淆二者代价最高，因为错误只有在真实交换中才会暴露。',
        specifics: [
          '每个集成都有独立凭据、发送队列、签名和对账。',
          '外部系统重复回调不会产生第二笔操作。',
          '外部系统不可用不应破坏交易——事件保持为未送达而不是丢失。',
        ],
        next: '要不要讨论你这边的具体系统：需要传输什么、方向如何？',
        clarify: '你关心的是文件交换，还是交易数据交换？',
      },
    },
  },
  {
    id: 'api_security',
    capabilities: ['api_boundary', 'server_authoritative_access', 'transport_security'],
    match: {
      ru: ['api безопасность', 'ключ api', 'токен доступа', 'защита api', 'подпись запроса', 'вебхук'],
      en: ['api security', 'api key', 'access token', 'protect the api', 'request signature', 'webhook'],
      zh: ['api 安全', 'api 密钥', '访问令牌', '接口保护', '请求签名', 'webhook'],
    },
    sources: [S.secure],
    copy: {
      ru: {
        title: 'Безопасность API',
        direct: 'Каждый запрос проверяется по трём осям: корректность структуры, права роли и повторность операции. Внутренние вызовы помощника дополнительно подписываются и без действительной подписи не принимаются.',
        explain: 'Идемпотентность здесь часть безопасности, а не только надёжности: повтор запроса не должен становиться способом провести операцию дважды.',
        specifics: [
          'Роль и организация берутся из проверенной сессии, а не из тела запроса.',
          'Ответ на неавторизованный запрос не раскрывает, существует ли объект.',
          'Открытого публичного API для интеграции сейчас нет — доступ выдаётся адресно.',
        ],
        next: 'Разобрать, как выглядит защищённый обмен для конкретного сценария интеграции?',
        clarify: 'Речь о доступе твоей системы к платформе или о вызовах платформы к твоей системе?',
      },
      en: {
        title: 'API security',
        direct: 'Every request is checked along three axes: schema validity, role rights and operation replay. The assistant’s internal calls are additionally signed and rejected without a valid signature.',
        explain: 'Idempotency here is part of security, not only reliability: a repeated request must not become a way to perform an operation twice.',
        specifics: [
          'Role and organization come from the verified session, never from the request body.',
          'An unauthorized response does not reveal whether the object exists.',
          'There is no open public integration API today — access is granted specifically.',
        ],
        next: 'Want to walk through a secured exchange for a concrete integration scenario?',
        clarify: 'Do you mean your system calling the platform, or the platform calling your system?',
      },
      zh: {
        title: 'API 安全',
        direct: '每个请求都会从三个方面校验：结构是否正确、角色权限、以及是否重复调用。助手的内部调用还需带签名，签名无效即被拒绝。',
        explain: '这里的幂等性属于安全而不仅是可靠性：重复请求不应成为让操作执行两次的途径。',
        specifics: [
          '角色和组织来自已验证会话，而不是请求体。',
          '未授权的响应不会泄露对象是否存在。',
          '目前没有开放的公共集成 API——权限按需授予。',
        ],
        next: '需要针对具体集成场景说明安全交换流程吗？',
        clarify: '你指的是你的系统调用平台，还是平台调用你的系统？',
      },
    },
  },
  {
    id: 'incident_response',
    capabilities: ['incident_response', 'audit_trail', 'release_rollback'],
    match: {
      ru: ['инцидент', 'что если утечка', 'реагирование', 'уведомите ли', 'взломали'],
      en: ['incident', 'what if there is a breach', 'response', 'will you notify', 'compromised'],
      zh: ['事件', '发生泄露怎么办', '响应', '会通知吗', '被入侵'],
    },
    sources: [S.secure, S.contact],
    copy: {
      ru: {
        title: 'Реагирование на инциденты',
        direct: 'Честно: формального регламента с дежурствами и сроками уведомления сейчас нет. Есть журнал аудита, по которому восстанавливается картина произошедшего, откат выката и прямой контакт проекта.',
        explain: 'Заявлять процесс реагирования, которого нет, опаснее, чем признать его отсутствие: именно на такой заявке строят ожидания, которые потом не выполняются.',
        specifics: [
          'Журнал позволяет установить, что именно и когда происходило.',
          'Неудачный выкат откатывается на предыдущую подтверждённую версию.',
          'Сроков уведомления и SLA по инцидентам обещать нельзя — они не утверждены.',
        ],
        next: 'Обсудить, какой регламент реагирования нужен твоей организации в договоре?',
        clarify: 'Тебя интересует реакция на технический сбой или на утечку данных?',
      },
      en: {
        title: 'Incident response',
        direct: 'Honestly: there is no formal procedure with on-call rotation and notification deadlines yet. There is an audit journal that reconstructs what happened, release rollback and a direct project contact.',
        explain: 'Claiming a response process that does not exist is worse than admitting its absence: such claims are exactly what expectations get built on and then broken.',
        specifics: [
          'The journal makes it possible to establish what happened and when.',
          'A failed release rolls back to the previous confirmed revision.',
          'Notification deadlines and incident SLAs cannot be promised — none are approved.',
        ],
        next: 'Want to discuss which response terms your organization needs in the contract?',
        clarify: 'Do you mean response to a technical outage, or to a data breach?',
      },
      zh: {
        title: '事件响应',
        direct: '实话说：目前还没有包含值班和通知时限的正式流程。现有的是可还原事件经过的审计日志、发布回滚以及项目的直接联系人。',
        explain: '声称一个并不存在的响应流程比承认其缺失更危险：正是这类声明会让期望落空。',
        specifics: [
          '日志可用于确定发生了什么以及何时发生。',
          '发布失败会回滚到上一份已确认版本。',
          '通知时限和事件 SLA 无法承诺——尚未批准。',
        ],
        next: '要不要讨论你的组织在合同中需要哪些响应条款？',
        clarify: '你指的是技术故障的响应，还是数据泄露的响应？',
      },
    },
  },
  {
    id: 'availability',
    capabilities: ['availability', 'release_rollback'],
    match: {
      ru: ['доступность', 'sla', 'аптайм', 'нагрузка', 'сколько пользователей выдержит', 'масштабирование'],
      en: ['availability', 'sla', 'uptime', 'load', 'how many users', 'scaling'],
      zh: ['可用性', 'sla', '在线率', '负载', '能支持多少用户', '扩展'],
    },
    sources: [S.secure, S.contact],
    copy: {
      ru: {
        title: 'Доступность и масштаб',
        direct: 'Сейчас это один production-контур без подтверждённого SLA. Архитектура рассчитана на горизонтальное масштабирование, но нагрузочных и отказоустойчивых доказательств пока нет, поэтому цифру доступности назвать нельзя.',
        explain: 'Разница между «спроектировано под масштаб» и «проверено под нагрузкой» — это ровно то, что отличает пилот от промышленной эксплуатации.',
        specifics: [
          'API и обработчики событий разделены и могут масштабироваться отдельно.',
          'Очереди и идемпотентность рассчитаны на повторную обработку без дублей.',
          'Нагрузочные, отказоустойчивые и длительные испытания пока не проведены.',
        ],
        next: 'Обсудить ожидаемую нагрузку твоей организации и что для неё потребуется?',
        clarify: 'Тебя интересует текущее состояние или целевые требования по нагрузке?',
      },
      en: {
        title: 'Availability and scale',
        direct: 'Today this is a single production contour without a confirmed SLA. The architecture targets horizontal scaling, but load and failover evidence does not exist yet, so no availability figure can be quoted.',
        explain: 'The gap between "designed for scale" and "verified under load" is exactly what separates a pilot from industrial operation.',
        specifics: [
          'The API and event workers are separated and can scale independently.',
          'Queues and idempotency are designed for reprocessing without duplicates.',
          'Load, failover and soak testing have not been performed yet.',
        ],
        next: 'Want to discuss your organization’s expected load and what it would require?',
        clarify: 'Do you mean the current state, or target load requirements?',
      },
      zh: {
        title: '可用性与规模',
        direct: '目前只有一个生产环境，没有确认的 SLA。架构面向横向扩展，但尚无负载和故障切换证据，因此无法给出可用性数字。',
        explain: '“为规模设计”和“经负载验证”之间的差距，正是试点与工业化运行的区别。',
        specifics: [
          'API 与事件处理进程分离，可分别扩展。',
          '队列和幂等设计支持重复处理而不产生重复数据。',
          '负载、故障切换和长时间运行测试尚未开展。',
        ],
        next: '要不要讨论你的组织预期负载以及相应需求？',
        clarify: '你问的是当前状态，还是目标负载要求？',
      },
    },
  },
  {
    id: 'pricing_usage',
    capabilities: ['pricing_model'],
    match: {
      ru: ['сколько стоит', 'сколько это стоит', 'цена платформы', 'тариф', 'подписка', 'бесплатно ли', 'условия оплаты'],
      en: ['how much does it cost', 'price of the platform', 'pricing', 'subscription', 'is it free', 'payment terms'],
      zh: ['多少钱', '平台价格', '收费', '订阅', '免费吗', '付款条件'],
    },
    sources: [S.contact],
    copy: {
      ru: {
        title: 'Стоимость',
        direct: 'Публично утверждённого тарифа нет, поэтому назвать цифру нельзя — придумывать её тем более. Стоимость зависит от объёма сделок, состава ролей, интеграций и требований к размещению.',
        explain: 'Для такой инфраструктуры реалистичны подписка, комиссия за успешно исполненную сделку, платные корпоративные модули или их сочетание — но выбор модели пока не утверждён.',
        specifics: [
          'Интеграции с банками и государственными системами могут стоить отдельно.',
          'Внедрение считается по числу организаций, систем и юридических согласований.',
          'Расчёт для конкретной компании требует данных по объёму и процессам.',
        ],
        next: 'Собрать вводные для расчёта: сколько сделок в месяц и какие роли участвуют?',
        clarify: 'Тебе нужна модель ценообразования или ориентир по стоимости внедрения?',
      },
      en: {
        title: 'Pricing',
        direct: 'No publicly approved tariff exists, so no figure can be quoted — and inventing one would be worse. Cost depends on deal volume, roles, integrations and hosting requirements.',
        explain: 'For infrastructure like this, subscription, a fee per executed deal, paid enterprise modules or a combination are all realistic — but the model is not approved yet.',
        specifics: [
          'Bank and government integrations may be priced separately.',
          'Implementation is sized by organizations, systems and legal approvals.',
          'A quote for a specific company needs volume and process data.',
        ],
        next: 'Want to gather the inputs — deals per month and which roles take part?',
        clarify: 'Do you need the pricing model, or a ballpark for implementation cost?',
      },
      zh: {
        title: '价格',
        direct: '目前没有公开批准的价目表，因此无法给出数字——凭空编造更不可取。费用取决于交易量、角色构成、集成和部署要求。',
        explain: '对于这类基础设施，订阅、按成交收费、企业模块收费或其组合都是现实选项，但模式尚未确定。',
        specifics: [
          '银行和政务系统集成可能单独计费。',
          '实施成本按组织数量、系统数量和法务审批评估。',
          '针对具体公司的报价需要交易量和流程数据。',
        ],
        next: '要不要先收集输入：每月交易量和参与角色？',
        clarify: '你需要的是定价模式，还是实施成本的大致范围？',
      },
    },
  },
  {
    id: 'support',
    capabilities: ['multilingual_answers', 'privacy_boundary_public_assistant'],
    match: {
      ru: ['поддержка', 'связаться', 'помощь оператора', 'как вас найти', 'написать в поддержку'],
      en: ['support', 'contact', 'operator help', 'how to reach you', 'write to support'],
      zh: ['支持', '联系', '客服帮助', '如何联系', '联系支持'],
    },
    sources: [S.contact],
    copy: {
      ru: {
        title: 'Поддержка',
        direct: 'Я отвечаю на русском, английском и китайском и стараюсь довести вопрос до конкретного шага. Если нужен человек — есть прямой контакт проекта.',
        explain: 'Разделение простое: я объясняю, как устроена платформа и что делать дальше, а решения по доступу, деньгам и договорам принимают люди с полномочиями.',
        specifics: [
          'Публичный помощник не видит кабинетов и не может проверить твою учётную запись.',
          'После входа доступен помощник, который работает в рамках твоей роли.',
          'Часы работы и SLA поддержки определяются коммерческими условиями.',
        ],
        next: 'Сформулировать обращение так, чтобы поддержке хватило контекста с первого раза?',
        clarify: 'Тебе нужен ответ по платформе или помощь с конкретной Сделкой в кабинете?',
      },
      en: {
        title: 'Support',
        direct: 'I answer in Russian, English and Chinese and try to take a question through to a concrete step. If you need a person, there is a direct project contact.',
        explain: 'The split is simple: I explain how the platform works and what to do next, while decisions about access, money and contracts are made by people with authority.',
        specifics: [
          'The public assistant sees no workspace and cannot check your account.',
          'After signing in there is an assistant that works within your role.',
          'Support hours and SLA follow commercial terms.',
        ],
        next: 'Want help phrasing the request so support has full context the first time?',
        clarify: 'Do you need an answer about the platform, or help with a specific Deal in your workspace?',
      },
      zh: {
        title: '支持',
        direct: '我支持俄语、英语和中文，并会尽量把问题推进到具体步骤。如果需要人工，可以直接联系项目。',
        explain: '分工很简单：我解释平台如何运作以及下一步该做什么，而涉及权限、资金和合同的决定由有权限的人做出。',
        specifics: [
          '公共助手看不到工作台，也无法核查你的账户。',
          '登录后可以使用在你角色范围内工作的助手。',
          '支持时间和 SLA 取决于商业条款。',
        ],
        next: '需要我帮你把问题描述清楚，让支持一次就掌握全部背景吗？',
        clarify: '你需要的是平台方面的解答，还是工作台中某笔具体交易的帮助？',
      },
    },
  },
  {
    id: 'legal_compliance',
    capabilities: ['legal_boundary', 'audit_trail', 'data_subject_rights'],
    match: {
      ru: ['юридическ', 'комплаенс', 'соответствие требованиям', 'закон', 'ответственность', 'договор с платформой', 'сертификация'],
      en: ['legal', 'compliance', 'regulatory', 'law', 'liability', 'contract with the platform', 'certification'],
      zh: ['法律', '合规', '监管要求', '法规', '责任', '与平台的合同', '认证'],
    },
    sources: [S.privacy, S.contact],
    copy: {
      ru: {
        title: 'Право и комплаенс',
        direct: 'Платформа отделяет информационную помощь от юридически значимых действий: я объясняю и готовлю черновик, но решение принимает уполномоченный человек, а не помощник.',
        explain: 'Поэтому доказательства собираются с источником, временем и версией — чтобы позиция стороны опиралась на события системы, а не на пересказ.',
        specifics: [
          'Персональные данные обрабатываются по назначенному основанию и с ограниченным доступом.',
          'Автоматизация не должна создавать правовые последствия без подтверждения человеком.',
          'Сертификаций и отраслевых аттестаций платформа сейчас не имеет — заявлять их нельзя.',
        ],
        next: 'Разобрать конкретный вопрос — обработка персональных данных или доказательства по спору?',
        clarify: 'Речь про требования к платформе или про юридическую сторону твоей сделки?',
      },
      en: {
        title: 'Legal and compliance',
        direct: 'The platform separates informational help from legally significant actions: I explain and draft, while an authorized person — not the assistant — decides.',
        explain: 'That is why evidence is collected with source, time and version: a party’s position should rest on system events rather than on retelling.',
        specifics: [
          'Personal data is processed on a named basis and with bounded access.',
          'Automation must not create legal effects without human confirmation.',
          'The platform holds no certifications or industry attestations today — none may be claimed.',
        ],
        next: 'Want to take a concrete question — personal data processing, or evidence for a dispute?',
        clarify: 'Do you mean requirements on the platform, or the legal side of your own deal?',
      },
      zh: {
        title: '法律与合规',
        direct: '平台将信息帮助与具有法律效力的操作分开：我负责解释和起草，由有权限的人而非助手做出决定。',
        explain: '因此证据都带有来源、时间和版本，使当事方的主张基于系统事件而不是转述。',
        specifics: [
          '个人数据按明确依据处理，并限制访问范围。',
          '自动化不得在没有人工确认的情况下产生法律后果。',
          '平台目前没有任何认证或行业资质——不能作此声称。',
        ],
        next: '要不要讨论具体问题：个人数据处理，还是争议证据？',
        clarify: '你指的是对平台的要求，还是你自己交易的法律问题？',
      },
    },
  },
] as const;

const SECTION_BY_ID = new Map(SECTIONS.map((section) => [section.id, section]));

export function allKnowledgeSections(): readonly PlatformKnowledgeSection[] {
  return SECTIONS;
}

export function knowledgeSection(id: PlatformKnowledgeSectionId): PlatformKnowledgeSection | null {
  return SECTION_BY_ID.get(id) ?? null;
}

/**
 * The strongest attestation a section may speak with — the weakest of the
 * capabilities it rests on, because one unverified leg makes the whole claim
 * unverified.
 */
export function sectionStatus(id: PlatformKnowledgeSectionId) {
  const section = knowledgeSection(id);
  if (!section) return 'NOT_ATTESTED' as const;
  return weakestStatus(section.capabilities);
}

/** Sections that describe security, privacy and access — used for the critical set. */
export const SECURITY_SECTIONS: readonly PlatformKnowledgeSectionId[] = [
  'platform_security', 'data_protection', 'privacy', 'roles_permissions',
  'tenant_isolation', 'mfa', 'audit', 'sessions', 'documents',
  'backups', 'recovery', 'retention', 'deletion', 'exports', 'api_security',
  'incident_response',
];

/** Every section covered by the registry has at least one attested capability. */
export function sectionsWithoutCapabilities(): readonly PlatformKnowledgeSectionId[] {
  return SECTIONS
    .filter((section) => section.capabilities.length === 0 || capabilitiesForSection(section.id).length === 0)
    .map((section) => section.id);
}
