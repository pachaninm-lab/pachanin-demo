import {
  knowledgeSection,
  sectionStatus,
  type PlatformKnowledgeSource,
} from './platform-knowledge-sections';
import {
  type PlatformCapabilityStatus,
  type PlatformKnowledgeLocale,
  type PlatformKnowledgeSectionId,
} from './assistant-capability-registry';
import type { AssistantSafetyReason } from './assistant-relevance-router';

/**
 * Turns a routing decision into text a person can read.
 *
 * Every answer follows the same shape — what is true, why, what it means, one
 * next step — because that is the order a reader needs, not because a template
 * is cheap. Nothing here mentions routing, confidence, model names or
 * infrastructure: those belong to logs.
 *
 * The maturity line is generated from the capability registry rather than
 * written by hand, so an answer cannot claim more than its evidence allows even
 * if the section copy is later edited.
 */

export type ComposedAssistantAnswer = Readonly<{
  section: PlatformKnowledgeSectionId | null;
  title: string;
  answer: string;
  facts: readonly string[];
  maturity: string;
  sources: readonly PlatformKnowledgeSource[];
  suggestions: readonly string[];
  capabilities: readonly string[];
}>;

/** The 12 cabinet roles, each with the thing that role actually cares about. */
const ROLE_FOCUS: Readonly<Record<string, Readonly<Record<PlatformKnowledgeLocale, string>>>> = {
  seller: {
    ru: 'основание выплаты и статус документов по твоей отгрузке',
    en: 'the payout basis and document status for your shipment',
    zh: '你这批发运的付款依据和文件状态',
  },
  buyer: {
    ru: 'блокеры приёмки и то, что мешает закрыть расчёт',
    en: 'acceptance blockers and what is holding settlement',
    zh: '验收阻碍以及结算受阻的原因',
  },
  logistics: {
    ru: 'рейсы, прибытие и подтверждения по перевозке',
    en: 'trips, arrival and transport confirmations',
    zh: '班次、到达和运输确认',
  },
  driver: {
    ru: 'что делать на точке и какие подтверждения нужны сейчас',
    en: 'what to do at the point and which confirmations are needed now',
    zh: '在现场该做什么、现在需要哪些确认',
  },
  elevator: {
    ru: 'приёмку, взвешивание и оформление партии',
    en: 'acceptance, weighing and lot paperwork',
    zh: '验收、称重和批次单据',
  },
  lab: {
    ru: 'протоколы качества и их связь со Сделкой',
    en: 'quality protocols and how they attach to the Deal',
    zh: '质量报告及其与交易的关联',
  },
  surveyor: {
    ru: 'фиксацию фактов осмотра и расхождений',
    en: 'recording inspection facts and variances',
    zh: '检验事实和差异的记录',
  },
  bank: {
    ru: 'основания резерва и выплаты по Сделке',
    en: 'reserve and payout bases for the Deal',
    zh: '交易的资金预留与付款依据',
  },
  operator: {
    ru: 'очередь блокеров и владельца следующего действия',
    en: 'the blocker queue and the owner of the next action',
    zh: '阻碍队列和下一步的责任人',
  },
  compliance: {
    ru: 'проверки контрагентов и риски по Сделке',
    en: 'counterparty checks and Deal risks',
    zh: '交易对手核查与交易风险',
  },
  arbitrator: {
    ru: 'доказательства и основания решения по спору',
    en: 'evidence and the basis for a dispute decision',
    zh: '证据与争议裁决依据',
  },
  executive: {
    ru: 'деньги под риском и узкие места по портфелю сделок',
    en: 'money at risk and bottlenecks across the deal portfolio',
    zh: '风险资金和交易组合中的瓶颈',
  },
};

const MATURITY: Readonly<Record<PlatformCapabilityStatus, Readonly<Record<PlatformKnowledgeLocale, string>>>> = {
  LIVE_CONFIRMED: {
    ru: 'Это проверено на действующем контуре.',
    en: 'This is verified on the running contour.',
    zh: '这一点已在运行环境中验证。',
  },
  IMPLEMENTED: {
    ru: 'Механизм реализован и покрыт тестами; отдельного подтверждения промышленной эксплуатации пока нет.',
    en: 'The mechanism is implemented and covered by tests; industrial operation is not separately confirmed yet.',
    zh: '该机制已实现并有测试覆盖；工业级运行尚未单独确认。',
  },
  PARTIALLY_IMPLEMENTED: {
    ru: 'Часть механизма работает с ограничением — оно названо выше, а не спрятано.',
    en: 'Part of the mechanism carries a limitation — it is stated above rather than hidden.',
    zh: '该机制的一部分存在限制——上文已说明，而非隐去。',
  },
  NOT_CONNECTED: {
    ru: 'Интерфейс есть, живого подключения нет — называть это работающей интеграцией нельзя.',
    en: 'The interface exists, the live connection does not — it must not be called a working integration.',
    zh: '接口存在但没有真实连接——不能称其为已运行的集成。',
  },
  NOT_ATTESTED: {
    ru: 'Промышленная готовность здесь не подтверждена, поэтому обещать её я не буду.',
    en: 'Industrial readiness is not attested here, so I will not promise it.',
    zh: '此处的工业级就绪未获证实，因此我不会作出承诺。',
  },
};

const ROLE_LEAD: Readonly<Record<PlatformKnowledgeLocale, string>> = {
  ru: 'В твоей роли это чаще всего упирается в',
  en: 'In your role this usually comes down to',
  zh: '在你的角色下，这通常涉及',
};

function bullet(items: readonly string[]): string {
  return items.map((item) => `— ${item}`).join('\n');
}

/**
 * Builds the answer for a platform knowledge section.
 *
 * `clarify` appends the section's narrowing question *after* the useful part of
 * the answer — never instead of it. A reader who asked an ambiguous question
 * still leaves with something they can act on.
 */
export function composePlatformSectionAnswer(
  sectionId: PlatformKnowledgeSectionId,
  locale: PlatformKnowledgeLocale,
  options: Readonly<{ clarify?: boolean; role?: string | null }> = {},
): ComposedAssistantAnswer | null {
  const section = knowledgeSection(sectionId);
  if (!section) return null;
  const copy = section.copy[locale];
  const status = sectionStatus(sectionId);

  const parts = [copy.direct, copy.explain, bullet(copy.specifics)];

  const focus = options.role ? ROLE_FOCUS[options.role]?.[locale] : undefined;
  if (focus) parts.push(`${ROLE_LEAD[locale]} ${focus}.`);

  parts.push(options.clarify ? `${copy.next} ${copy.clarify}` : copy.next);

  return Object.freeze({
    section: sectionId,
    title: copy.title,
    answer: parts.join('\n\n'),
    facts: copy.specifics,
    maturity: MATURITY[status][locale],
    sources: section.sources,
    suggestions: suggestionsFor(sectionId, locale),
    capabilities: section.capabilities,
  });
}

/**
 * Suggestions are neighbouring questions, not a menu the reader must choose from.
 *
 * They exist so a reader can go deeper in one tap; the answer above them is
 * already complete without them.
 */
function suggestionsFor(sectionId: PlatformKnowledgeSectionId, locale: PlatformKnowledgeLocale): readonly string[] {
  const neighbours: Readonly<Record<PlatformKnowledgeSectionId, readonly PlatformKnowledgeSectionId[]>> = {
    platform_security: ['privacy', 'roles_permissions', 'documents'],
    data_protection: ['platform_security', 'retention', 'deletion'],
    privacy: ['documents', 'tenant_isolation', 'audit'],
    roles_permissions: ['tenant_isolation', 'audit', 'sessions'],
    tenant_isolation: ['privacy', 'roles_permissions', 'api_security'],
    mfa: ['sessions', 'audit', 'platform_security'],
    audit: ['exports', 'documents', 'privacy'],
    sessions: ['mfa', 'roles_permissions', 'platform_security'],
    documents: ['privacy', 'retention', 'exports'],
    backups: ['recovery', 'availability', 'retention'],
    recovery: ['backups', 'availability', 'integrations'],
    retention: ['deletion', 'documents', 'privacy'],
    deletion: ['retention', 'privacy', 'data_protection'],
    exports: ['audit', 'documents', 'api_security'],
    integrations: ['api_security', 'documents', 'availability'],
    api_security: ['integrations', 'roles_permissions', 'audit'],
    incident_response: ['audit', 'recovery', 'availability'],
    availability: ['recovery', 'backups', 'pricing_usage'],
    pricing_usage: ['integrations', 'support', 'availability'],
    support: ['pricing_usage', 'sessions', 'privacy'],
    legal_compliance: ['privacy', 'retention', 'audit'],
  };
  return (neighbours[sectionId] || [])
    .map((id) => knowledgeSection(id)?.copy[locale].title)
    .filter((title): title is string => Boolean(title));
}

/**
 * The only non-answer for an on-topic question: a redirect.
 *
 * It states what this assistant is for and invites the reader to name the side
 * of their question that touches it. It never reports a classifier decision, a
 * registered knowledge gap or a confidence value — a reader can do nothing with
 * those, and they made the previous version feel like a broken form.
 */
export function composeRedirectAnswer(locale: PlatformKnowledgeLocale): ComposedAssistantAnswer {
  const copy = {
    ru: {
      title: 'Это не моя область',
      answer: [
        'Здесь я не помогу — я занимаюсь агробизнесом и платформой «Прозрачная Цена».',
        'Это сделки и торги, логистика и перевозка, приёмка, лаборатория и хранение, документы, деньги и споры, а также работа личных кабинетов и интеграций. Рядом с этим — экономика хозяйства, налоги и учёт, кредиты и страхование, кадры и автоматизация.',
        'Если у твоего вопроса есть сторона, которая касается хозяйства, торговли или платформы, назови её — разберём по существу.',
      ].join('\n\n'),
      suggestions: ['Как проходит сделка от торгов до расчёта?', 'Как защищаются данные?', 'Что влияет на цену зерна?'],
    },
    en: {
      title: 'Outside what I work on',
      answer: [
        'I cannot help with that — I work on agribusiness and the Transparent Price platform.',
        'That means deals and bidding, logistics and transport, acceptance, laboratory and storage, documents, money and disputes, plus how workspaces and integrations work. Next to it: farm economics, tax and accounting, credit and insurance, staffing and automation.',
        'If your question has a side that touches farming, trading or the platform, name it and we will go into it properly.',
      ].join('\n\n'),
      suggestions: ['How does a deal run from bidding to settlement?', 'How is data protected?', 'What drives the grain price?'],
    },
    zh: {
      title: '这不属于我的范围',
      answer: [
        '这方面我帮不上——我专注于农业经营和“透明价格”平台。',
        '包括交易与竞价、物流与运输、验收、实验室与仓储、文件、资金与争议，以及工作台和集成的运作方式。与之相邻的还有农场经济、税务与会计、信贷与保险、人员与自动化。',
        '如果你的问题有涉及农业、贸易或平台的一面，说出来，我们可以深入讨论。',
      ].join('\n\n'),
      suggestions: ['一笔交易从竞价到结算如何进行？', '数据如何得到保护？', '什么因素影响粮价？'],
    },
  }[locale];

  return Object.freeze({
    section: null,
    title: copy.title,
    answer: copy.answer,
    facts: [],
    maturity: '',
    sources: [{ label: 'Главная платформы', href: '/platform-v7' }],
    suggestions: copy.suggestions,
    capabilities: [],
  });
}

/**
 * Safety refusals say what cannot be done and why, in the reader's terms.
 *
 * For foreign data the honest answer is not "denied" but "there is nothing here
 * to show": the public contour holds no workspace data at all, and implying it
 * merely withholds the data would be a lie in the other direction.
 */
export function composeSafetyAnswer(
  locale: PlatformKnowledgeLocale,
  reason: AssistantSafetyReason,
): ComposedAssistantAnswer {
  const copy: Record<AssistantSafetyReason, Record<PlatformKnowledgeLocale, { title: string; answer: string }>> = {
    FOREIGN_DATA: {
      ru: {
        title: 'Чужие данные недоступны',
        answer: 'Данные другой организации я показать не могу — и не потому, что скрываю их: доступ определяется ролью и организацией на сервере, а у этого разговора такого доступа нет.\n\nЧто можно вместо этого: объяснить, кто и на каком основании видит данные Сделки, и как выглядит доступ для твоей роли.',
      },
      en: {
        title: 'Another organization’s data is out of reach',
        answer: 'I cannot show another organization’s data — not because it is being withheld: access is decided by role and organization on the server, and this conversation has none of it.\n\nWhat I can do instead: explain who sees Deal data and on what basis, and what access looks like for your role.',
      },
      zh: {
        title: '无法访问他人数据',
        answer: '我无法展示其他组织的数据——这并非隐瞒：访问权限由服务器按角色和组织判定，而本次对话并不具备该权限。\n\n可以替代的做法：说明谁能看到交易数据、依据是什么，以及你的角色拥有怎样的访问权限。',
      },
    },
    PRIVILEGE_ESCALATION: {
      ru: {
        title: 'Права выдаёт не чат',
        answer: 'Расширить доступ через разговор нельзя: роль назначается сервером по подтверждённому членству в организации, и помощник её не меняет.\n\nЕсли прав действительно не хватает, это решает администратор твоей организации — и такое изменение попадает в журнал аудита.',
      },
      en: {
        title: 'Chat does not grant rights',
        answer: 'Access cannot be widened through a conversation: the role is assigned by the server from verified membership, and the assistant does not change it.\n\nIf you genuinely lack rights, your organization’s administrator decides that — and the change lands in the audit journal.',
      },
      zh: {
        title: '聊天不能授予权限',
        answer: '无法通过对话扩大访问权限：角色由服务器根据已验证的成员关系分配，助手不会更改它。\n\n如果确实权限不足，应由你所在组织的管理员决定，并且该变更会记入审计日志。',
      },
    },
    CREDENTIAL_DISCLOSURE: {
      ru: {
        title: 'Секреты не передаются через чат',
        answer: 'Пароли, ключи и токены я не сообщаю и не запрашиваю — ни свои, ни чужие. Если такое значение уже попало в переписку, его стоит считать скомпрометированным и заменить.\n\nМогу объяснить, как устроен вход и подтверждение операций, без раскрытия секретов.',
      },
      en: {
        title: 'Secrets do not travel through chat',
        answer: 'I neither disclose nor request passwords, keys or tokens — mine or anyone else’s. If such a value has already been pasted into a conversation, treat it as compromised and rotate it.\n\nI can explain how sign-in and operation confirmation work without revealing any secret.',
      },
      zh: {
        title: '密钥不通过聊天传递',
        answer: '我既不会透露也不会索取密码、密钥或令牌——无论是谁的。如果这类值已被粘贴到对话中，应视为已泄露并立即更换。\n\n我可以在不泄露任何密钥的前提下说明登录和操作确认的机制。',
      },
    },
    HARMFUL_REQUEST: {
      ru: {
        title: 'С этим я не помогу',
        answer: 'С этим я не помогу.\n\nЕсли вопрос на самом деле про хозяйство — например, борьбу с вредителями, сохранность склада или безопасность работ в поле, — сформулируй его так, и разберём подробно.',
      },
      en: {
        title: 'I will not help with that',
        answer: 'I will not help with that.\n\nIf the question is actually about farming — pest control, protecting a store, or safety of field work — put it that way and we will go through it in detail.',
      },
      zh: {
        title: '这方面我不会提供帮助',
        answer: '这方面我不会提供帮助。\n\n如果问题其实与农业有关——例如虫害防治、仓储防护或田间作业安全——请这样表述，我们可以详细讨论。',
      },
    },
  };

  const selected = copy[reason][locale];
  return Object.freeze({
    section: null,
    title: selected.title,
    answer: selected.answer,
    facts: [],
    maturity: '',
    sources: [{ label: 'Конфиденциальность', href: '/platform-v7/privacy' }],
    suggestions: composeRedirectAnswer(locale).suggestions,
    capabilities: [],
  });
}

/** Cabinet roles the composer can speak to specifically. */
export const COMPOSER_KNOWN_ROLES: readonly string[] = Object.keys(ROLE_FOCUS);
