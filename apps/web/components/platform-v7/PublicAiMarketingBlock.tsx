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
    eyebrow: 'ИИ в целевой версии платформы',
    title: 'Раньше увидеть риск. Понять причину. Быстрее перейти к действию.',
    lead: 'После запуска полноценного ИИ «Прозрачная Цена» будет анализировать ход сделки, документы, логистику, качество и денежные основания. Система заранее покажет блокер, объяснит его влияние и подготовит следующий шаг для ответственного участника.',
    capabilities: [
      {
        icon: 'risk',
        title: 'Увидит риск до срыва',
        body: 'Отметит, когда срок, документ, качество, маршрут или основание расчёта начинают отклоняться от сценария.',
      },
      {
        icon: 'documents',
        title: 'Объяснит на фактах',
        body: 'Свяжет сигнал с событием, документом, источником, ответственным, дедлайном и суммой влияния.',
      },
      {
        icon: 'intelligence',
        title: 'Подготовит следующий шаг',
        body: 'Соберёт запрос, чек-лист, уведомление, пакет оснований или сценарий эскалации — по роли и контексту сделки.',
      },
    ],
    maturity: 'Целевой контур будет вводиться поэтапно. ИИ не заменит полномочия участников: критические действия останутся под подтверждением человека.',
    cta: 'Посмотреть ценность для своей роли',
    scenario: {
      aria: 'Пример будущего сигнала ИИ по демонстрационной сделке',
      badge: 'Пример будущего сигнала',
      context: 'Покупатель · Пшеница 3 класса · 500 т',
      title: 'Расчёт может задержаться',
      reasonLabel: 'Причина',
      reason: 'Не подтверждён лабораторный протокол. До контрольного срока — 6 часов.',
      impactLabel: 'Влияние',
      impact: '6,9 млн ₽ остаются под риском задержки; следующая отгрузка может не попасть в окно.',
      actionLabel: 'Следующий шаг',
      action: 'ИИ подготовит запрос протокола и пакет оснований для проверки.',
      control: 'Отправка и любые критические действия — только после подтверждения пользователя.',
    },
  },
  en: {
    eyebrow: 'AI in the target platform experience',
    title: 'See risk earlier. Understand the cause. Move to action faster.',
    lead: 'Once the full AI layer is launched, Transparent Price will analyse deal progress, documents, logistics, quality and payment grounds. It will surface blockers early, explain their impact and prepare the next step for the responsible participant.',
    capabilities: [
      {
        icon: 'risk',
        title: 'Sees risk before disruption',
        body: 'Flags when a deadline, document, quality result, route or settlement ground starts to diverge from the agreed flow.',
      },
      {
        icon: 'documents',
        title: 'Explains with evidence',
        body: 'Connects each signal to the event, document, source, owner, deadline and financial impact.',
      },
      {
        icon: 'intelligence',
        title: 'Prepares the next step',
        body: 'Builds a request, checklist, notice, evidence pack or escalation path for the role and deal context.',
      },
    ],
    maturity: 'The target experience will be introduced in stages. AI will not replace participant authority: consequential actions will remain subject to human confirmation.',
    cta: 'See the value for your role',
    scenario: {
      aria: 'Example of a future AI signal for the demonstration deal',
      badge: 'Example future signal',
      context: 'Buyer · Class 3 wheat · 500 t',
      title: 'Settlement may be delayed',
      reasonLabel: 'Reason',
      reason: 'The laboratory protocol has not been confirmed. Six hours remain before the control deadline.',
      impactLabel: 'Impact',
      impact: 'RUB 6.9m remains exposed to delay, and the next shipment may miss its window.',
      actionLabel: 'Next step',
      action: 'AI will prepare a protocol request and an evidence pack for review.',
      control: 'Sending and any consequential action will require user confirmation.',
    },
  },
  zh: {
    eyebrow: '平台目标版本中的 AI',
    title: '更早发现风险，理解原因，更快进入下一步。',
    lead: '完整 AI 上线后，“透明价格”将分析交易进度、文件、物流、质量和付款依据，提前提示阻塞点，解释其影响，并为责任方准备下一步。',
    capabilities: [
      {
        icon: 'risk',
        title: '在中断前发现风险',
        body: '当期限、文件、质量结果、路线或结算依据开始偏离约定流程时，系统会提前提示。',
      },
      {
        icon: 'documents',
        title: '基于事实进行解释',
        body: '每个信号都会关联事件、文件、来源、责任方、期限和资金影响。',
      },
      {
        icon: 'intelligence',
        title: '准备下一步行动',
        body: '根据角色和交易上下文，生成请求、检查清单、通知、依据包或升级路径。',
      },
    ],
    maturity: '目标形态将分阶段上线。AI 不会取代交易参与方的权限；重要操作仍需人工确认。',
    cta: '查看对您角色的价值',
    scenario: {
      aria: '演示交易中的未来 AI 信号示例',
      badge: '未来信号示例',
      context: '买方 · 三等小麦 · 500 吨',
      title: '结算可能延迟',
      reasonLabel: '原因',
      reason: '实验室报告尚未确认，距离控制期限还有 6 小时。',
      impactLabel: '影响',
      impact: '690 万卢布仍面临延迟风险，下一批发运可能错过时间窗口。',
      actionLabel: '下一步',
      action: 'AI 将准备报告请求和供审核的依据包。',
      control: '发送和任何重要操作都必须经过用户确认。',
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
      data-testid='platform-v7-ai-future-value'
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
            eventName='ai_future_value_role_cta'
            locale={locale}
            params={{ source: 'home_ai_future_value' }}
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
