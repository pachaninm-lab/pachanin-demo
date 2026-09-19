import { PublicExperienceLink } from './PublicExperienceAnalytics';
import { PublicExperienceIcon, type PublicExperienceIconName } from './PublicExperienceIcon';
import styles from './PublicAiMarketingBlock.module.css';

type Locale = 'ru' | 'en' | 'zh';

type Capability = {
  icon: PublicExperienceIconName;
  title: string;
  body: string;
};

type MarketingCopy = {
  eyebrow: string;
  title: string;
  lead: string;
  capabilities: Capability[];
  maturity: string;
  cta: string;
  scenario: {
    aria: string;
    badge: string;
    context: string;
    title: string;
    reasonLabel: string;
    reason: string;
    impactLabel: string;
    impact: string;
    actionLabel: string;
    action: string;
    control: string;
  };
};

const COPY: Record<Locale, MarketingCopy> = {
  ru: {
    eyebrow: 'ИИ работает в платформе',
    title: 'Увидеть риск. Понять причину. Быстрее перейти к действию.',
    lead: 'В рабочих кабинетах ИИ «Прозрачной Цены» анализирует доступный ход сделки, документы, логистику, качество и денежные основания. Система выявляет блокеры, объясняет их влияние и формирует следующий шаг для ответственного участника.',
    capabilities: [
      {
        icon: 'risk',
        title: 'Выявляет риск',
        body: 'Отмечает, когда срок, документ, качество, маршрут или основание расчёта отклоняются от сценария.',
      },
      {
        icon: 'documents',
        title: 'Объясняет на фактах',
        body: 'Связывает сигнал с событием, документом, источником, ответственным, дедлайном и суммой влияния.',
      },
      {
        icon: 'intelligence',
        title: 'Формирует следующий шаг',
        body: 'Предлагает запрос, чек-лист, уведомление или сценарий эскалации с учётом роли и контекста сделки.',
      },
    ],
    maturity: 'ИИ работает только в доступном ролевом контуре и не заменяет полномочия участников: критические действия остаются за человеком и требуют подтверждения.',
    cta: 'Посмотреть, как ИИ помогает моей роли',
    scenario: {
      aria: 'Пример сигнала ИИ по демонстрационной сделке',
      badge: 'Пример сигнала ИИ',
      context: 'Покупатель · Пшеница 3 класса · 500 т',
      title: 'Расчёт под риском задержки',
      reasonLabel: 'Причина',
      reason: 'Не подтверждён лабораторный протокол. До контрольного срока — 6 часов.',
      impactLabel: 'Влияние',
      impact: '6,9 млн ₽ остаются под риском задержки; следующая отгрузка может не попасть в окно.',
      actionLabel: 'Следующий шаг',
      action: 'ИИ формирует рекомендацию запросить протокол и показывает основания для проверки.',
      control: 'Отправку и любые критические действия подтверждает пользователь.',
    },
  },
  en: {
    eyebrow: 'AI is active in the platform',
    title: 'See the risk. Understand the cause. Move to action faster.',
    lead: 'In authenticated workspaces, Transparent Price AI analyses accessible deal progress, documents, logistics, quality and payment grounds. It identifies blockers, explains their impact and prepares the next step for the responsible participant.',
    capabilities: [
      {
        icon: 'risk',
        title: 'Identifies risk',
        body: 'Flags when a deadline, document, quality result, route or settlement ground diverges from the agreed flow.',
      },
      {
        icon: 'documents',
        title: 'Explains with evidence',
        body: 'Connects each signal to the event, document, source, owner, deadline and financial impact.',
      },
      {
        icon: 'intelligence',
        title: 'Prepares the next step',
        body: 'Proposes a request, checklist, notice or escalation path for the role and deal context.',
      },
    ],
    maturity: 'AI operates only within the accessible role scope and does not replace participant authority: consequential actions remain with people and require confirmation.',
    cta: 'See how AI supports my role',
    scenario: {
      aria: 'Example AI signal for the demonstration deal',
      badge: 'Example AI signal',
      context: 'Buyer · Class 3 wheat · 500 t',
      title: 'Settlement is at risk of delay',
      reasonLabel: 'Reason',
      reason: 'The laboratory protocol has not been confirmed. Six hours remain before the control deadline.',
      impactLabel: 'Impact',
      impact: 'RUB 6.9m remains exposed to delay, and the next shipment may miss its window.',
      actionLabel: 'Next step',
      action: 'AI recommends requesting the protocol and shows the evidence grounds for review.',
      control: 'The user confirms sending and every consequential action.',
    },
  },
  zh: {
    eyebrow: 'AI 已在平台中运行',
    title: '发现风险，理解原因，更快进入下一步。',
    lead: '在已授权工作区内，“透明价格”AI 分析可访问的交易进度、文件、物流、质量和付款依据，识别阻塞点、解释其影响，并为责任方准备下一步。',
    capabilities: [
      {
        icon: 'risk',
        title: '识别风险',
        body: '当期限、文件、质量结果、路线或结算依据偏离约定流程时，系统会提示。',
      },
      {
        icon: 'documents',
        title: '基于事实进行解释',
        body: '每个信号都会关联事件、文件、来源、责任方、期限和资金影响。',
      },
      {
        icon: 'intelligence',
        title: '准备下一步',
        body: '根据角色和交易上下文提出请求、检查清单、通知或升级路径。',
      },
    ],
    maturity: 'AI 仅在可访问的角色范围内工作，不取代交易参与方的权限；重要操作仍由人工执行并确认。',
    cta: '查看 AI 如何支持我的角色',
    scenario: {
      aria: '演示交易中的 AI 信号示例',
      badge: 'AI 信号示例',
      context: '买方 · 三等小麦 · 500 吨',
      title: '结算存在延迟风险',
      reasonLabel: '原因',
      reason: '实验室报告尚未确认，距离控制期限还有 6 小时。',
      impactLabel: '影响',
      impact: '690 万卢布仍面临延迟风险，下一批发运可能错过时间窗口。',
      actionLabel: '下一步',
      action: 'AI 建议请求报告，并显示供审核的依据。',
      control: '发送和任何重要操作都由用户确认。',
    },
  },
};

function resolveLocale(locale: string): Locale {
  if (locale === 'en' || locale === 'zh') return locale;
  return 'ru';
}

export function PublicAiMarketingBlock({
  locale,
  roleEntryHref,
}: {
  locale: string;
  roleEntryHref: string;
}) {
  const ui = COPY[resolveLocale(locale)];

  return (
    <section
      id='ai-copilot'
      className={`pc-ppe-section ${styles.section}`}
      aria-labelledby='pc-ppe-ai-title'
      data-testid='platform-v7-ai-current-value'
    >
      <div className={styles.panel}>
        <div className={styles.copy}>
          <span className='pc-ppe-section-eyebrow'>{ui.eyebrow}</span>
          <h2 id='pc-ppe-ai-title'>{ui.title}</h2>
          <p className={styles.lead}>{ui.lead}</p>

          <ul className={styles.capabilities}>
            {ui.capabilities.map((capability) => (
              <li key={capability.title}>
                <span className={styles.capabilityIcon} aria-hidden='true'>
                  <PublicExperienceIcon name={capability.icon} size={22} />
                </span>
                <div>
                  <strong>{capability.title}</strong>
                  <p>{capability.body}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className={styles.maturity} role='note'>
            <span aria-hidden='true'><PublicExperienceIcon name='check' size={18} /></span>
            <span>{ui.maturity}</span>
          </p>

          <PublicExperienceLink
            href={roleEntryHref}
            className={styles.cta}
            eventName='ai_current_value_role_cta'
            locale={locale}
            params={{ source: 'home_ai_current_value' }}
          >
            <span>{ui.cta}</span>
            <PublicExperienceIcon name='arrow' size={20} />
          </PublicExperienceLink>
        </div>

        <article className={styles.scenario} aria-label={ui.scenario.aria}>
          <div className={styles.scenarioTopline}>
            <span className={styles.scenarioBadge}>{ui.scenario.badge}</span>
            <PublicExperienceIcon name='intelligence' size={24} />
          </div>
          <p className={styles.scenarioContext}>{ui.scenario.context}</p>
          <h3>{ui.scenario.title}</h3>

          <dl className={styles.scenarioFacts}>
            <div>
              <dt>{ui.scenario.reasonLabel}</dt>
              <dd>{ui.scenario.reason}</dd>
            </div>
            <div>
              <dt>{ui.scenario.impactLabel}</dt>
              <dd>{ui.scenario.impact}</dd>
            </div>
            <div>
              <dt>{ui.scenario.actionLabel}</dt>
              <dd>{ui.scenario.action}</dd>
            </div>
          </dl>

          <p className={styles.control}>
            <span aria-hidden='true'><PublicExperienceIcon name='check' size={18} /></span>
            <span>{ui.scenario.control}</span>
          </p>
        </article>
      </div>
    </section>
  );
}
