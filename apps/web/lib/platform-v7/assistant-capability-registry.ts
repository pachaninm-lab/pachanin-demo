/**
 * Verifiable capability registry for TAI platform answers.
 *
 * Every statement TAI makes about the platform itself has to come from here.
 * A capability carries the attestation level it was verified at, the source that
 * proves it, and the exact-main revision the verification was taken against — so
 * an answer can be traced back to evidence instead of to model fluency.
 *
 * The registry is deliberately conservative: a capability that only exists as
 * code is IMPLEMENTED, never LIVE_CONFIRMED, and an external system nobody has
 * signed a contract with is NOT_CONNECTED regardless of how complete the
 * adapter looks.
 */

export type PlatformKnowledgeLocale = 'ru' | 'en' | 'zh';

/**
 * How far a capability has been verified.
 *
 * LIVE_CONFIRMED        — observed working on the production contour.
 * IMPLEMENTED           — present and covered in code, not observed live.
 * PARTIALLY_IMPLEMENTED — present with a limitation that must be stated.
 * NOT_CONNECTED         — an interface exists, the counterparty does not.
 * NOT_ATTESTED          — no evidence of industrial-grade operation.
 */
export type PlatformCapabilityStatus =
  | 'LIVE_CONFIRMED'
  | 'IMPLEMENTED'
  | 'PARTIALLY_IMPLEMENTED'
  | 'NOT_CONNECTED'
  | 'NOT_ATTESTED';

export type PlatformKnowledgeSectionId =
  | 'platform_security'
  | 'data_protection'
  | 'privacy'
  | 'roles_permissions'
  | 'tenant_isolation'
  | 'mfa'
  | 'audit'
  | 'sessions'
  | 'documents'
  | 'backups'
  | 'recovery'
  | 'retention'
  | 'deletion'
  | 'exports'
  | 'integrations'
  | 'api_security'
  | 'incident_response'
  | 'availability'
  | 'pricing_usage'
  | 'support'
  | 'legal_compliance';

export type PlatformCapability = Readonly<{
  id: string;
  section: PlatformKnowledgeSectionId;
  status: PlatformCapabilityStatus;
  /** Repository path or governance document that proves the status. */
  source: string;
  version: string;
  attestedAt: string;
  /** exact-main revision the attestation was taken against. */
  exactMainSha: string;
  /** The strongest phrasing allowed for this capability, per locale. */
  allowed: Readonly<Record<PlatformKnowledgeLocale, string>>;
  /** Claims that must never appear in an answer citing this capability. */
  forbidden: readonly string[];
}>;

/**
 * exact-main the current attestation round was taken against.
 *
 * Every capability below was checked against this revision. A later revision may
 * strengthen a status, but only after a new verification round — the constant is
 * not bumped because time passed.
 */
export const CAPABILITY_ATTESTATION_EXACT_MAIN = '35cc81e9deb275ea372aa9abbfa27bfd49b43a57';
export const CAPABILITY_REGISTRY_VERSION = 'tai-platform-capability-registry-2026-08-01.v1';

/** What each attestation level permits an answer to assert. */
export const CAPABILITY_STATUS_RULES: Readonly<Record<PlatformCapabilityStatus, Readonly<{
  mayAssertLive: boolean;
  mayAssertImplemented: boolean;
  mustStateLimitation: boolean;
  mustDenyIndustrialReadiness: boolean;
}>>> = {
  LIVE_CONFIRMED: { mayAssertLive: true, mayAssertImplemented: true, mustStateLimitation: false, mustDenyIndustrialReadiness: false },
  IMPLEMENTED: { mayAssertLive: false, mayAssertImplemented: true, mustStateLimitation: false, mustDenyIndustrialReadiness: false },
  PARTIALLY_IMPLEMENTED: { mayAssertLive: false, mayAssertImplemented: true, mustStateLimitation: true, mustDenyIndustrialReadiness: false },
  NOT_CONNECTED: { mayAssertLive: false, mayAssertImplemented: true, mustStateLimitation: true, mustDenyIndustrialReadiness: true },
  NOT_ATTESTED: { mayAssertLive: false, mayAssertImplemented: false, mustStateLimitation: true, mustDenyIndustrialReadiness: true },
} as const;

const BASE = {
  version: CAPABILITY_REGISTRY_VERSION,
  attestedAt: '2026-08-01',
  exactMainSha: CAPABILITY_ATTESTATION_EXACT_MAIN,
} as const;

const CAPABILITIES: readonly PlatformCapability[] = [
  {
    ...BASE,
    id: 'server_authoritative_access',
    section: 'platform_security',
    status: 'IMPLEMENTED',
    source: 'apps/web/middleware.ts, apps/web/lib/platform-v7/verified-session.ts',
    allowed: {
      ru: 'Доступ назначает сервер по подтверждённой сессии: роль читается из подписанного токена, а не из адреса страницы, localStorage или переключателя в браузере.',
      en: 'Access is assigned by the server from a verified session: the role comes from a signed token, not from the URL, local storage or a browser switch.',
      zh: '访问权限由服务器根据已验证会话分配：角色来自签名令牌，而不是网址、本地存储或浏览器中的切换。',
    },
    forbidden: [
      'роль можно выбрать в браузере',
      'the browser decides the role',
      'access is checked only on the client',
    ],
  },
  {
    ...BASE,
    id: 'tenant_isolation',
    section: 'tenant_isolation',
    status: 'IMPLEMENTED',
    source: 'apps/api/prisma/migrations/*_postgresql_authority/migration.sql (row level security), apps/api/src/modules',
    allowed: {
      ru: 'Данные разных организаций разделены на уровне запроса и на уровне базы: организация подставляется сервером, а не приходит из браузера.',
      en: 'Data of different organizations is separated at query level and in the database: the organization is applied by the server, never taken from the browser.',
      zh: '不同组织的数据在查询层和数据库层都被隔离：组织由服务器确定，不从浏览器获取。',
    },
    forbidden: [
      'изоляция организаций проверена промышленной эксплуатацией',
      'tenant isolation is proven by years of production use',
    ],
  },
  {
    ...BASE,
    id: 'rbac_roles',
    section: 'roles_permissions',
    status: 'IMPLEMENTED',
    source: 'apps/web/lib/platform-v7/role-canonical.ts, apps/web/lib/platform-v7/cabinet-access-policy.ts',
    allowed: {
      ru: 'Права определяются ролью в организации: каждая роль видит только свою проекцию Сделки и свой набор действий.',
      en: 'Permissions follow the role inside the organization: each role sees only its Deal projection and its own set of actions.',
      zh: '权限取决于组织内的角色：每个角色只能看到自己的交易视图和可执行操作。',
    },
    forbidden: [
      'любой пользователь может расширить свою роль',
      'a user can widen their own role',
    ],
  },
  {
    ...BASE,
    id: 'server_cabinet_rbac_enforcement',
    section: 'roles_permissions',
    status: 'PARTIALLY_IMPLEMENTED',
    source: 'apps/web/lib/platform-v7/server-cabinet-access.ts (report-only phase)',
    allowed: {
      ru: 'Серверная проверка кабинетов сейчас работает в наблюдательном режиме: расхождение фиксируется, но страницу пока закрывают серверные данные и доменные проверки, а не отдельный блокирующий слой.',
      en: 'Server-side cabinet checking currently runs in report mode: a mismatch is recorded, while the page itself is still bounded by server data and domain checks rather than a separate blocking layer.',
      zh: '服务器端的工作台校验目前处于观察模式：不一致会被记录，页面本身仍由服务器数据和领域校验限制，而不是独立的阻断层。',
    },
    forbidden: [
      'серверный RBAC полностью блокирует доступ к кабинетам',
      'server cabinet RBAC blocks every unauthorized page',
    ],
  },
  {
    ...BASE,
    id: 'mfa_critical_actions',
    section: 'mfa',
    status: 'IMPLEMENTED',
    source: 'apps/api/src/modules/auth (mfa-verify), apps/api/src/modules/settlement-engine/settlement-financial-mfa.guard.ts',
    allowed: {
      ru: 'Чувствительные операции требуют дополнительного подтверждения: вход с MFA и отдельная проверка на денежных и подписных действиях.',
      en: 'Sensitive operations require an extra confirmation: MFA sign-in plus a separate check on money and signature actions.',
      zh: '敏感操作需要额外确认：MFA 登录，以及资金和签署操作的单独校验。',
    },
    forbidden: [
      'MFA включена для всех пользователей по умолчанию',
      'MFA is already enforced for every user',
    ],
  },
  {
    ...BASE,
    id: 'audit_trail',
    section: 'audit',
    status: 'IMPLEMENTED',
    source: 'apps/api/prisma/schema.prisma (AuditLog), apps/web/lib/platform-v7/audit-trail.ts',
    allowed: {
      ru: 'Изменения и критические действия попадают в журнал аудита: кто, что, когда и на каком основании.',
      en: 'Changes and critical actions are written to an audit journal: who, what, when and on which basis.',
      zh: '变更和关键操作都会写入审计日志：谁、做了什么、何时以及依据是什么。',
    },
    forbidden: [
      'аудит невозможно обойти ни при каких условиях',
      'the audit trail cannot be bypassed under any circumstances',
    ],
  },
  {
    ...BASE,
    id: 'audit_evidence_export',
    section: 'exports',
    status: 'IMPLEMENTED',
    source: 'apps/web/lib/platform-v7/audit-evidence-export.ts',
    allowed: {
      ru: 'Журнал и доказательства по Сделке можно выгрузить набором с контрольной суммой, чтобы выгрузка была проверяемой.',
      en: 'The journal and Deal evidence can be exported as a checksummed set so the export itself stays verifiable.',
      zh: '交易日志和证据可以按带校验和的方式导出，使导出结果本身可被核验。',
    },
    forbidden: [
      'выгрузка юридически значима без отдельной проверки',
      'the export is legally binding on its own',
    ],
  },
  {
    ...BASE,
    id: 'session_boundary',
    section: 'sessions',
    status: 'IMPLEMENTED',
    source: 'apps/web/lib/platform-v7/verified-session.ts, apps/web/app/api/platform-v7/cabinet-session/route.ts',
    allowed: {
      ru: 'Сессия ограничена по сроку и подписана: истёкший или подменённый токен не даёт роли, а выход закрывает доступ сразу.',
      en: 'The session is signed and time-bounded: an expired or forged token grants no role, and signing out closes access immediately.',
      zh: '会话经过签名并有有效期：过期或伪造的令牌不会授予角色，登出会立即关闭访问。',
    },
    forbidden: [
      'сессию невозможно украсть',
      'sessions cannot be stolen',
    ],
  },
  {
    ...BASE,
    id: 'document_access_control',
    section: 'documents',
    status: 'IMPLEMENTED',
    source: 'apps/web/lib/platform-v7/documents, apps/api/src/modules/documents',
    allowed: {
      ru: 'Документ виден участникам Сделки в пределах их роли; версия, источник и время фиксируются вместе с документом.',
      en: 'A document is visible to Deal participants within their role; version, source and time are stored with it.',
      zh: '文件仅对交易参与方在其角色范围内可见；版本、来源和时间随文件一同保存。',
    },
    forbidden: [
      'документы шифруются end-to-end',
      'documents are end-to-end encrypted',
    ],
  },
  {
    ...BASE,
    id: 'evidence_retention',
    section: 'retention',
    status: 'IMPLEMENTED',
    source: 'apps/web/lib/platform-v7/evidence-retention (covered by apps/web/tests/unit/platformV7EvidenceRetention.test.ts)',
    allowed: {
      ru: 'У доказательств и документов есть срок хранения, привязанный к Сделке и правовому основанию, а не бессрочное накопление.',
      en: 'Evidence and documents have a retention period bound to the Deal and its legal basis rather than unlimited accumulation.',
      zh: '证据和文件的保存期限与交易及其法律依据绑定，而不是无限期堆积。',
    },
    forbidden: [
      'сроки хранения согласованы с каждым регулятором',
      'retention periods are approved by every regulator',
    ],
  },
  {
    ...BASE,
    id: 'data_subject_rights',
    section: 'deletion',
    status: 'IMPLEMENTED',
    source: 'apps/web/lib/platform-v7/data-subject-rights (covered by apps/web/tests/unit/platformV7DataSubjectRights.test.ts)',
    allowed: {
      ru: 'Запрос на доступ, исправление и удаление персональных данных обрабатывается отдельным маршрутом; данные, которые обязана хранить бухгалтерия или закон, остаются с указанием основания.',
      en: 'Access, correction and deletion requests for personal data run through a dedicated route; records the law or accounting requires stay, with the basis stated.',
      zh: '个人数据的访问、更正和删除请求通过专门流程处理；法律或财务要求保留的记录会保留并说明依据。',
    },
    forbidden: [
      'удаление стирает данные из всех резервных копий немедленно',
      'deletion instantly removes data from every backup',
    ],
  },
  {
    ...BASE,
    id: 'privacy_boundary_public_assistant',
    section: 'privacy',
    status: 'LIVE_CONFIRMED',
    source: 'apps/web/app/api/public-platform-assistant/route.ts, apps/web/app/api/restricted-public-platform-assistant/route.ts',
    allowed: {
      ru: 'Публичный помощник вообще не имеет доступа к личным кабинетам, Сделкам и документам — ему нечего раскрыть, даже если попросить.',
      en: 'The public assistant has no access to workspaces, Deals or documents at all — there is nothing for it to disclose, even on request.',
      zh: '公共助手完全无法访问工作台、交易和文件——即使被要求，也没有可披露的内容。',
    },
    forbidden: [
      'публичный помощник может показать данные вашей организации',
      'the public assistant can show your organization data',
    ],
  },
  {
    ...BASE,
    id: 'local_model_inference',
    section: 'platform_security',
    status: 'LIVE_CONFIRMED',
    source: 'docs/platform-v7/autopilot/scopes/tai-public-qwen-real-inference-20260801.json',
    allowed: {
      ru: 'Ответы формирует локальная модель на собственном сервере: текст вопроса не уходит во внешний облачный сервис.',
      en: 'Answers are produced by a local model on our own server: the question text is not sent to an external cloud service.',
      zh: '回答由部署在自有服务器上的本地模型生成：问题文本不会发送到外部云服务。',
    },
    forbidden: [
      'модель имеет прямой доступ к базе данных',
      'the model queries the database directly',
    ],
  },
  {
    ...BASE,
    id: 'model_data_boundary',
    section: 'data_protection',
    status: 'IMPLEMENTED',
    source: 'apps/web/lib/platform-v7/anti-leak-filter.ts, apps/web/app/api/restricted-public-platform-assistant/route.ts',
    allowed: {
      ru: 'У модели нет универсального доступа к базе и API: она получает только подготовленный контекст и не выполняет действия от имени пользователя.',
      en: 'The model has no general database or API access: it receives prepared context only and performs no actions on the user’s behalf.',
      zh: '模型没有通用的数据库或 API 权限：它只接收准备好的上下文，也不代表用户执行操作。',
    },
    forbidden: [
      'помощник может выполнить платёж',
      'the assistant can release a payment',
      'помощник подписывает документы',
    ],
  },
  {
    ...BASE,
    id: 'transport_security',
    section: 'data_protection',
    status: 'LIVE_CONFIRMED',
    source: 'infra (REG.RU TLS termination), scripts/tai-reg-ru-deploy.sh postflight',
    allowed: {
      ru: 'Трафик между браузером и платформой идёт по TLS, внутренние вызовы помощника подписываются и не принимаются без действительной подписи.',
      en: 'Browser-to-platform traffic runs over TLS, and the assistant’s internal calls are signed and rejected without a valid signature.',
      zh: '浏览器与平台之间的流量通过 TLS 传输，助手的内部调用带签名，签名无效则被拒绝。',
    },
    forbidden: [
      'данные шифруются end-to-end между участниками сделки',
      'deal data is end-to-end encrypted between participants',
    ],
  },
  {
    ...BASE,
    id: 'api_boundary',
    section: 'api_security',
    status: 'IMPLEMENTED',
    source: 'apps/web/lib/platform-v7/api-boundary-contracts.ts, apps/web/lib/platform-v7/anti-bypass.ts',
    allowed: {
      ru: 'API проверяет схему запроса, права роли и повторность операции; повторный вызов не создаёт вторую операцию.',
      en: 'The API validates the request schema, the role’s rights and operation replay; a repeated call does not create a second operation.',
      zh: 'API 会校验请求结构、角色权限和重复调用；重复请求不会产生第二笔操作。',
    },
    forbidden: [
      'публичный API открыт для интеграции прямо сейчас',
      'a public integration API is open today',
    ],
  },
  {
    ...BASE,
    id: 'external_integrations',
    section: 'integrations',
    status: 'NOT_CONNECTED',
    source: 'apps/web/lib/platform-v7/adapters, apps/api/src/modules/regulatory-integration',
    allowed: {
      ru: 'Интерфейсы для ФГИС «Зерно», ЭДО, 1С, ERP и банков спроектированы, но живое подключение требует договора, реквизитов и отдельной приёмки — сейчас его нельзя называть работающим.',
      en: 'Interfaces for grain-government systems, EDI, 1C, ERP and banks are designed, but a live connection needs a contract, credentials and separate acceptance — it must not be described as working today.',
      zh: '面向粮食政务系统、电子单证、1C、ERP 和银行的接口已设计，但真实连接需要合同、凭据和单独验收——目前不能称其为已在运行。',
    },
    forbidden: [
      'интеграция с ФГИС Зерно работает',
      'мы уже подключены к банку',
      'the ERP integration is live',
      '1С подключена',
    ],
  },
  {
    ...BASE,
    id: 'backup_authority',
    section: 'backups',
    status: 'PARTIALLY_IMPLEMENTED',
    source: 'scripts/tai-reg-ru-deploy.sh (pre-mutation database authority + dump), docs/platform-v7/autopilot/scopes/tai-postgres-authority-20260801.json',
    allowed: {
      ru: 'Перед изменением production база определяется однозначно и снимается дамп, поэтому у выката есть точка возврата. Регулярное расписание резервных копий и регулярная проверка восстановления пока не подтверждены.',
      en: 'Before a production change the database authority is resolved unambiguously and a dump is taken, so a release has a rollback point. A regular backup schedule and regular restore drills are not yet confirmed.',
      zh: '在变更生产环境前会明确确定数据库并生成转储，因此发布具备回滚点。定期备份计划和定期恢复演练尚未确认。',
    },
    forbidden: [
      'резервные копии снимаются каждый час',
      'hourly backups are in place',
      'восстановление проверяется регулярно',
    ],
  },
  {
    ...BASE,
    id: 'release_rollback',
    section: 'recovery',
    status: 'LIVE_CONFIRMED',
    source: 'scripts/tai-reg-ru-deploy.sh, scripts/check-tai-reg-ru-release-chain.mjs',
    allowed: {
      ru: 'Неуспешный выкат откатывается на предыдущую подтверждённую версию, и это уже отрабатывало на production-контуре.',
      en: 'A failed release rolls back to the previous confirmed revision, and that path has already been exercised on the production contour.',
      zh: '发布失败会回滚到上一份已确认的版本，该路径已在生产环境中实际执行过。',
    },
    forbidden: [
      'откат восстанавливает потерянные пользовательские данные',
      'rollback restores lost user data',
    ],
  },
  {
    ...BASE,
    id: 'incident_response',
    section: 'incident_response',
    status: 'NOT_ATTESTED',
    source: 'no dedicated incident-response runbook in the repository at the attested revision',
    allowed: {
      ru: 'Формального регламента реагирования на инциденты с дежурствами и сроками уведомления пока нет — есть журнал аудита, откат выката и контакт проекта. Заявлять промышленный процесс реагирования нельзя.',
      en: 'There is no formal incident-response procedure with on-call rotation and notification deadlines yet — there is an audit journal, release rollback and a project contact. An industrial response process must not be claimed.',
      zh: '目前还没有包含值班轮换和通知时限的正式事件响应流程——只有审计日志、发布回滚和项目联系人。不能声称已有工业级响应流程。',
    },
    forbidden: [
      'инциденты обрабатываются по SLA',
      'we notify about incidents within 24 hours',
      'incident response follows an agreed SLA',
    ],
  },
  {
    ...BASE,
    id: 'availability',
    section: 'availability',
    status: 'NOT_ATTESTED',
    source: 'single REG.RU production contour; no load, failover or soak evidence at the attested revision',
    allowed: {
      ru: 'Сейчас это один production-контур без подтверждённого SLA: архитектура рассчитана на горизонтальное масштабирование, но нагрузочных и отказоустойчивых доказательств пока нет.',
      en: 'Today this is a single production contour without a confirmed SLA: the architecture targets horizontal scaling, but load and failover evidence does not exist yet.',
      zh: '目前只有一个生产环境且没有确认的 SLA：架构面向横向扩展，但尚无负载和故障切换证据。',
    },
    forbidden: [
      'доступность 99,9%',
      '99.9% uptime',
      'отказоустойчивый кластер работает',
    ],
  },
  {
    ...BASE,
    id: 'multilingual_answers',
    section: 'support',
    status: 'LIVE_CONFIRMED',
    source: 'apps/web/app/api/restricted-public-platform-assistant/route.ts, .github/workflows/tai-public-agro-semantic-live-acceptance.yml',
    allowed: {
      ru: 'Помощник отвечает на русском, английском и китайском и передаёт ответ потоком по мере генерации.',
      en: 'The assistant answers in Russian, English and Chinese and streams the answer as it is generated.',
      zh: '助手支持俄语、英语和中文，并在生成过程中以流式返回回答。',
    },
    forbidden: [
      'помощник поддерживает любой язык',
      'the assistant supports every language',
    ],
  },
  {
    ...BASE,
    id: 'pricing_model',
    section: 'pricing_usage',
    status: 'NOT_ATTESTED',
    source: 'apps/web/lib/platform-v7/prospect-assistant-knowledge.ts (pricing topic)',
    allowed: {
      ru: 'Публично утверждённого тарифа нет, поэтому назвать конкретную цену нельзя: стоимость зависит от объёма сделок, состава ролей, интеграций и требований к размещению.',
      en: 'No publicly approved tariff exists, so a concrete price cannot be quoted: cost depends on deal volume, roles, integrations and hosting requirements.',
      zh: '目前没有公开批准的价目表，因此无法给出具体价格：费用取决于交易量、角色构成、集成和部署要求。',
    },
    forbidden: [
      'платформа бесплатна',
      'the platform is free',
      'подписка стоит',
    ],
  },
  {
    ...BASE,
    id: 'legal_boundary',
    section: 'legal_compliance',
    status: 'PARTIALLY_IMPLEMENTED',
    source: 'apps/web/lib/platform-v7/legal, apps/web/app/platform-v7/privacy',
    allowed: {
      ru: 'Платформа отделяет информационную помощь от юридически значимых действий: помощник объясняет и готовит черновик, но решение принимает уполномоченный человек.',
      en: 'The platform separates informational help from legally significant actions: the assistant explains and drafts, while an authorized person decides.',
      zh: '平台将信息帮助与具有法律效力的操作分开：助手负责解释和起草，由授权人员做出决定。',
    },
    forbidden: [
      'помощник даёт юридическое заключение',
      'the assistant provides legal advice',
      'платформа сертифицирована',
    ],
  },
] as const;

const BY_ID = new Map(CAPABILITIES.map((capability) => [capability.id, capability]));

export function allCapabilities(): readonly PlatformCapability[] {
  return CAPABILITIES;
}

export function capabilityById(id: string): PlatformCapability | null {
  return BY_ID.get(id) ?? null;
}

export function capabilitiesForSection(section: PlatformKnowledgeSectionId): readonly PlatformCapability[] {
  return CAPABILITIES.filter((capability) => capability.section === section);
}

/** The phrasing an answer may use for this capability in the requested language. */
export function allowedStatement(id: string, locale: PlatformKnowledgeLocale): string | null {
  return capabilityById(id)?.allowed[locale] ?? null;
}

/**
 * Whether a produced answer contains a claim the cited capabilities forbid.
 *
 * The check is substring-based on purpose: the forbidden list holds the exact
 * overstatements this registry exists to prevent, and a fuzzy matcher here would
 * be one more thing that can silently stop matching.
 */
export function forbiddenClaimIn(text: string, capabilityIds: readonly string[]): string | null {
  const haystack = text.toLocaleLowerCase('ru-RU');
  for (const id of capabilityIds) {
    const capability = capabilityById(id);
    if (!capability) continue;
    for (const claim of capability.forbidden) {
      if (haystack.includes(claim.toLocaleLowerCase('ru-RU'))) return claim;
    }
  }
  return null;
}

/** True when every cited capability may be presented as an operating function. */
export function isLiveConfirmed(capabilityIds: readonly string[]): boolean {
  return capabilityIds.length > 0
    && capabilityIds.every((id) => capabilityById(id)?.status === 'LIVE_CONFIRMED');
}

/** The weakest attestation among the cited capabilities — the one an answer must respect. */
export function weakestStatus(capabilityIds: readonly string[]): PlatformCapabilityStatus {
  const order: readonly PlatformCapabilityStatus[] = [
    'NOT_ATTESTED', 'NOT_CONNECTED', 'PARTIALLY_IMPLEMENTED', 'IMPLEMENTED', 'LIVE_CONFIRMED',
  ];
  let weakest: PlatformCapabilityStatus = 'LIVE_CONFIRMED';
  for (const id of capabilityIds) {
    const status = capabilityById(id)?.status;
    if (!status) continue;
    if (order.indexOf(status) < order.indexOf(weakest)) weakest = status;
  }
  return weakest;
}
