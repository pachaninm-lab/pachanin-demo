import { getLocale, getTranslations } from 'next-intl/server';
import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Download,
  FileCheck2,
  FlaskConical,
  Link2,
  LogIn,
  MapPinned,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Waypoints,
} from 'lucide-react';
import { PublicSiteHeader } from './PublicSiteHeader';
import { PublicLocaleLink } from './PublicLocaleLink';
import { PublicExperienceLink, PublicExperiencePageView } from './PublicExperienceAnalytics';
import { PublicDealRoleScenario } from './PublicDealRoleScenario';
import { OrganizationConnectForm } from './OrganizationConnectForm';
import { PlatformV7AccountingClosureValue } from './PlatformV7AccountingClosureValue';
import { getPlatformV7HomeCopy } from '@/i18n/platform-v7-home-v3';
import { getPlatformV7HeroMessage } from '@/i18n/platform-v7-hero-message';
import { getPlatformV7HomeStoryCopy } from '@/i18n/platform-v7-home-story';
import { GEKTA_PATHS } from '@/lib/gekta/content';
import { GektaFloatingEntry } from '@/components/gekta/GektaFloatingEntry';
import '@/styles/platform-v7-public-assistant.css';
import '@/styles/platform-v7-public-assistant-shortcut.css';
import '@/styles/platform-v7-public-assistant-mobile-fix.css';
import '@/styles/platform-v7-unified-modal-fullscreen.css';
import styles from './PlatformV7StrategicHomeStory.module.css';

type Locale = 'ru' | 'en' | 'zh';
type SectionHeaderProps = { id: string; eyebrow: string; title: string; lead?: string };

function SectionHeader({ id, eyebrow, title, lead }: SectionHeaderProps) {
  return (
    <div className='pc-v6-section-head'>
      <span>{eyebrow}</span>
      <h2 id={id}>{title}</h2>
      {lead ? <p>{lead}</p> : null}
    </div>
  );
}

const functionIcons = [
  CircleDollarSign,
  FileCheck2,
  MapPinned,
  FlaskConical,
  FileCheck2,
  CircleDollarSign,
  TriangleAlert,
  ShieldCheck,
] as const;

const proofIcons = [Link2, ShieldCheck, FileCheck2, Sparkles] as const;
const stateInputClasses = [styles.stateNormal, styles.stateDeviation, styles.stateDispute] as const;
const stateTabClasses = [styles.tabNormal, styles.tabDeviation, styles.tabDispute] as const;
const statePanelClasses = [styles.panelNormal, styles.panelDeviation, styles.panelDispute] as const;

const TRUST_COPY = {
  ru: {
    eyebrow: 'Доверие и контроль',
    title: 'Понятно, что подтверждает платформа — и где требуется внешнее подключение',
    lead: 'Права и переходы контролируются системой, основания сохраняются в истории Сделки, а внешние интеграции не считаются активными без подтверждённого подключения организации.',
    cards: [
      ['Ролевые полномочия', 'Публичный выбор роли ничего не открывает. Реальные права назначаются после регистрации и проверки организации.'],
      ['Проверяемая история', 'Состояния, документы, решения и основания остаются связаны с конкретной Сделкой.'],
      ['Честная граница интеграций', '1С, ЭДО, финансовые и государственные контуры подключаются отдельно; доступность и права подтверждаются до обмена.'],
    ],
    trust: 'Открыть центр доверия',
    contact: 'Связаться с платформой',
  },
  en: {
    eyebrow: 'Trust and control',
    title: 'See what the platform verifies — and where an external connection is still required',
    lead: 'Roles and transitions are system-controlled, evidence remains in the Deal history, and external integrations are not presented as active until the organisation connection is confirmed.',
    cards: [
      ['Role authority', 'Choosing a role publicly grants nothing. Actual permissions follow registration and organisation verification.'],
      ['Verifiable history', 'States, documents, decisions and evidence remain linked to the specific Deal.'],
      ['Honest integration boundary', '1C, EDI, financial and government systems connect separately; availability and rights are confirmed before exchange.'],
    ],
    trust: 'Open Trust Center',
    contact: 'Contact the platform',
  },
  zh: {
    eyebrow: '信任与控制',
    title: '明确平台已确认什么，以及哪些部分仍需要外部接入',
    lead: '角色和状态转换由系统控制，依据保留在交易历史中；在机构接入未确认前，不会把外部集成描述为已启用。',
    cards: [
      ['角色权限', '公开页面选择角色不会授予任何权限。真实权限在注册和机构核验后确定。'],
      ['可核验历史', '状态、文件、决定和依据都与具体交易保持关联。'],
      ['诚实的集成边界', '1C、电子单据、金融和政府系统需要独立接入；数据交换前必须确认可用性与权限。'],
    ],
    trust: '打开信任中心',
    contact: '联系平台',
  },
} as const;

function localeOf(locale: string): Locale {
  return locale === 'en' || locale === 'zh' ? locale : 'ru';
}

export async function PlatformV7StrategicHome() {
  const locale = await getLocale();
  const normalizedLocale = localeOf(locale);
  const copy = getPlatformV7HomeCopy(locale);
  const heroMessage = getPlatformV7HeroMessage(locale);
  const story = getPlatformV7HomeStoryCopy(locale);
  const chrome = await getTranslations('publicEntry.chrome');
  const trustCopy = TRUST_COPY[normalizedLocale];
  const presentationDownloadLabel = normalizedLocale === 'en'
    ? 'Download presentation (PDF)'
    : normalizedLocale === 'zh'
      ? '下载演示文稿（PDF）'
      : 'Скачать презентацию (PDF)';

  const registerHref = `/platform-v7/register?lang=${encodeURIComponent(normalizedLocale)}`;
  const loginHref = `/platform-v7/login?lang=${encodeURIComponent(normalizedLocale)}`;
  const contactHref = `/platform-v7/contact?lang=${encodeURIComponent(normalizedLocale)}`;
  const trustHref = `/platform-v7/trust?lang=${encodeURIComponent(normalizedLocale)}`;
  const dealHref = `/platform-v7/how-it-works?lang=${encodeURIComponent(normalizedLocale)}&entry=deal&stage=terms&lens=execution&perspective=buyer`;
  const taiHref = `/platform-v7/ai-in-action?lang=${encodeURIComponent(normalizedLocale)}`;
  const gektaProductHref = GEKTA_PATHS[normalizedLocale];
  const normalState = story.demo.states[0]!;

  const nav = (
    <>
      <a href='#participants'>{story.nav.roles}</a>
      <a href='#deal-path'>{story.nav.deal}</a>
      <a href='#functions'>{story.nav.functions}</a>
      <a href='#trust'>{copy.nav.status}</a>
      <a href='#tai'>{story.nav.tai}</a>
      <a href={gektaProductHref} data-nav-product='gekta'>{story.gektaProduct.navLabel}</a>
    </>
  );

  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://процент-агро.рф/#organization',
        name: 'Прозрачная Цена',
        url: 'https://процент-агро.рф/',
      },
      {
        '@type': 'WebSite',
        '@id': 'https://процент-агро.рф/#website',
        url: 'https://процент-агро.рф/',
        name: 'Прозрачная Цена',
        publisher: { '@id': 'https://процент-агро.рф/#organization' },
        inLanguage: ['ru', 'en', 'zh'],
      },
    ],
  }).replace(/</g, '\\u003c');

  return (
    <div className={`pc-v6-page pc-v7-public-entry ${styles.root}`} data-testid='platform-v7-root-execution-cockpit'>
      <a className='pc-skip-link' href='#main-content'>{chrome('skipToContent')}</a>
      <PublicExperiencePageView locale={locale} name='home_v3_view' />
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: structuredData }} />

      <PublicSiteHeader
        ariaLabel={copy.a11y.site}
        brandHomeLabel={copy.a11y.site}
        navLabel={copy.a11y.nav}
        menuLabel={copy.a11y.menu}
        nav={nav}
        showMobileMenu
        localeControl={<PublicLocaleLink />}
        actions={
          <div className='pc-v6-header-actions'>
            <a href={loginHref} className='entry-login' aria-label={copy.nav.login}>
              <LogIn aria-hidden='true' size={18} strokeWidth={1.9} />
              <span>{copy.nav.login}</span>
            </a>
            <a href={registerHref} className='pc-v6-header-cta'>{copy.nav.connect}</a>
          </div>
        }
      />

      <main id='main-content' tabIndex={-1}>
        <div className='pc-v6-shell'>
          <section className={`pc-v6-hero ${styles.hero}`} aria-labelledby='pc-v6-title'>
            <div className={`pc-v6-hero-copy ${styles.heroCopy}`}>
              <span className='pc-v6-kicker'>{heroMessage.kicker}</span>
              <h1 id='pc-v6-title' className='pc-v6-hero-title'>
                <span className='pc-v6-hero-title-main'>{heroMessage.title}</span>
                <span className='pc-v6-hero-title-accent'>{heroMessage.accent}</span>
              </h1>
              <p className='pc-v6-hero-lead'>{heroMessage.lead}</p>
              <div className='pc-v6-actions'>
                <PublicExperienceLink
                  href={registerHref}
                  className='pc-v6-primary'
                  eventName='registration_open'
                  locale={locale}
                  params={{ source: 'home_v5_hero' }}
                >
                  {copy.hero.secondary}<ArrowRight aria-hidden='true' size={18} />
                </PublicExperienceLink>
                <PublicExperienceLink
                  href='#live'
                  className='pc-v6-secondary'
                  eventName='deal_demo_open'
                  locale={locale}
                  params={{ source: 'home_v5_hero' }}
                >
                  {copy.hero.primary}<ArrowRight aria-hidden='true' size={17} />
                </PublicExperienceLink>
                <a
                  href='/downloads/prozrachnaya-tsena-presentation.pdf'
                  download='Прозрачная_Цена_и_ГЕКТА.pdf'
                  type='application/pdf'
                  className='pc-v6-secondary'
                  data-testid='platform-v7-presentation-download'
                >
                  {presentationDownloadLabel}<Download aria-hidden='true' size={18} />
                </a>
              </div>
            </div>

            <div
              className={`${styles.heroDeal} pc-v6-control-tower`}
              role='group'
              aria-label={copy.a11y.controlTower}
              data-testid='platform-v7-deal-card'
            >
              <div className={styles.heroDealHeader}>
                <div>
                  <span>{story.heroDeal.sampleLabel}</span>
                  <strong>{story.heroDeal.product}</strong>
                  <small>{story.heroDeal.route}</small>
                </div>
                <b>{normalState.status}</b>
              </div>
              <div
                className={`${styles.heroDealProgress} pc-public-deal-stage-rail pc-public-deal-stage-rail--hero`}
                role='progressbar'
                aria-label={story.demo.stageLabel}
                aria-valuemin={1}
                aria-valuemax={story.demo.stages.length}
                aria-valuenow={story.demo.stages.length}
              >
                {story.demo.stages.map((stage) => (
                  <span key={stage} className={styles.progressDone}>
                    <i aria-hidden='true' />
                    <small>{stage}</small>
                  </span>
                ))}
              </div>
              <div className={styles.heroDealBody}>
                <article>
                  <span>{story.heroDeal.stageLabel}</span>
                  <strong>{normalState.title}</strong>
                </article>
                {normalState.kpis.slice(0, 2).map((kpi) => (
                  <article key={kpi.label}>
                    <span>{kpi.label}</span>
                    <strong>{kpi.value}</strong>
                  </article>
                ))}
                <article className={styles.settlementItem}>
                  <span>{normalState.actionTitle}</span>
                  <strong><CheckCircle2 aria-hidden='true' size={17} />{normalState.actionCta}</strong>
                </article>
              </div>
              <div className={styles.heroDealProof}>
                <FileCheck2 aria-hidden='true' size={18} />
                <span>{normalState.summary}</span>
              </div>
            </div>
          </section>

          <section className={styles.proofStrip} aria-label={copy.hero.proofLabel}>
            {story.proof.map((item, index) => {
              const Icon = proofIcons[index] ?? CheckCircle2;
              return (
                <article key={item.label}>
                  <Icon aria-hidden='true' />
                  <div><strong>{item.label}</strong><span>{item.text}</span></div>
                </article>
              );
            })}
          </section>

          <section id='participants' className={`pc-v6-section ${styles.section}`} aria-labelledby='participants-title'>
            <SectionHeader id='participants-title' eyebrow={story.roles.eyebrow} title={story.roles.title} lead={story.roles.lead} />
            <div className={styles.benefitGrid}>
              {story.roles.benefits.map((benefit) => (
                <article key={benefit.title}><strong>{benefit.title}</strong><span>{benefit.text}</span></article>
              ))}
            </div>
            <div className={styles.roleScenarioHeader}>
              <div><strong>{story.roles.scenarioTitle}</strong><span>{story.roles.scenarioLead}</span></div>
            </div>
            <div className={styles.roleScenario}>
              <PublicDealRoleScenario locale={locale} />
            </div>
          </section>

          <section id='difference' className={`pc-v6-section ${styles.section}`} aria-labelledby='difference-title'>
            <SectionHeader id='difference-title' eyebrow={story.difference.eyebrow} title={story.difference.title} lead={story.difference.lead} />
            <div className={styles.comparisonSurface}>
              <input className={styles.moreContentToggle} type='checkbox' id='difference-more-toggle' aria-controls='difference-comparison-rows' />
              <div className={styles.comparisonTable} role='table' aria-labelledby='difference-title'>
                <div className={styles.comparisonHeader} role='row'>
                  {story.difference.headers.map((header) => <strong key={header} role='columnheader'>{header}</strong>)}
                </div>
                <div id='difference-comparison-rows' className={styles.comparisonRows} role='rowgroup'>
                  {story.difference.rows.map((row, index) => (
                    <div key={row.criterion} className={`${styles.comparisonRow} ${index > 1 ? styles.comparisonExtraRow : ''}`} role='row' data-comparison-row='true'>
                      <strong role='rowheader'>{row.criterion}</strong>
                      <span role='cell'>{row.typical}</span>
                      <span role='cell'><CheckCircle2 aria-hidden='true' />{row.platform}</span>
                    </div>
                  ))}
                </div>
              </div>
              <label className={styles.moreContentLabel} htmlFor='difference-more-toggle'>
                {story.difference.moreLabel}<ArrowRight aria-hidden='true' size={16} />
              </label>
            </div>
            <div className={styles.honestBoundary}><ShieldCheck aria-hidden='true' /><p>{story.difference.boundary}</p></div>
          </section>

          <section id='deal-path' className={`pc-v6-section ${styles.section}`} aria-labelledby='deal-path-title'>
            <SectionHeader id='deal-path-title' eyebrow={story.process.eyebrow} title={story.process.title} lead={story.process.lead} />
            <div className={styles.phaseGrid}>
              {story.process.phases.slice(0, 3).map((phase) => (
                <article key={phase.index} className={styles.phaseCard}>
                  <span>{phase.index}</span><h3>{phase.title}</h3><p>{phase.text}</p>
                  <small><b>{story.process.resultLabel}:</b> {phase.result}</small>
                </article>
              ))}
              <input className={styles.moreContentToggle} type='checkbox' id='phases-more-toggle' aria-controls='phases-more-cards' />
              <label className={styles.moreContentLabel} htmlFor='phases-more-toggle'>
                {story.process.moreLabel}<ArrowRight aria-hidden='true' size={16} />
              </label>
              <div id='phases-more-cards' className={styles.morePhaseGrid}>
                {story.process.phases.slice(3).map((phase) => (
                  <article key={phase.index} className={styles.phaseCard}>
                    <span>{phase.index}</span><h3>{phase.title}</h3><p>{phase.text}</p>
                    <small><b>{story.process.resultLabel}:</b> {phase.result}</small>
                  </article>
                ))}
              </div>
            </div>
            <div className={styles.fullPath}>
              <span>{story.process.fullPathLabel}</span>
              <strong>{story.process.fullPathText}</strong>
              <details className={styles.fullStages}>
                <summary>{story.process.stagesLabel}<ArrowRight aria-hidden='true' size={16} /></summary>
                <div className='pc-v6-lifecycle' role='list' tabIndex={0} aria-label={copy.lifecycle.title}>
                  {copy.lifecycle.phases.map((phase: string, index: number) => <div key={phase} role='listitem'><i>{index + 1}</i><span>{phase}</span></div>)}
                </div>
              </details>
            </div>
          </section>

          <section id='functions' className={`pc-v6-section ${styles.section}`} aria-labelledby='functions-title'>
            <SectionHeader id='functions-title' eyebrow={story.functions.eyebrow} title={story.functions.title} lead={story.functions.lead} />
            <div className={styles.functionGrid}>
              {story.functions.items.slice(0, 4).map((item, index) => {
                const Icon = functionIcons[index] ?? CheckCircle2;
                return (
                  <article key={item.index} className={styles.functionCard}>
                    <div className={styles.cardTop}><span>{item.index}</span><Icon aria-hidden='true' /></div>
                    <h3>{item.title}</h3><p>{item.text}</p><small><b>{story.functions.resultLabel}:</b> {item.result}</small>
                  </article>
                );
              })}
              <input className={styles.moreContentToggle} type='checkbox' id='functions-more-toggle' aria-controls='functions-more-cards' />
              <label className={styles.moreContentLabel} htmlFor='functions-more-toggle'>
                {story.functions.moreLabel}<ArrowRight aria-hidden='true' size={16} />
              </label>
              <div id='functions-more-cards' className={styles.moreCardGrid}>
                {story.functions.items.slice(4).map((item, innerIndex) => {
                  const index = innerIndex + 4;
                  const Icon = functionIcons[index] ?? CheckCircle2;
                  return (
                    <article key={item.index} className={styles.functionCard}>
                      <div className={styles.cardTop}><span>{item.index}</span><Icon aria-hidden='true' /></div>
                      <h3>{item.title}</h3><p>{item.text}</p><small><b>{story.functions.resultLabel}:</b> {item.result}</small>
                    </article>
                  );
                })}
              </div>
            </div>
            <div className={styles.functionSummary}>
              <Waypoints aria-hidden='true' />
              <div><strong>{story.functions.summaryTitle}</strong><span>{story.functions.summaryText}</span></div>
            </div>
          </section>

          <PlatformV7AccountingClosureValue locale={locale} />

          <section id='live' className={`pc-v6-section ${styles.section} ${styles.liveSection}`} aria-labelledby='live-title'>
            <SectionHeader id='live-title' eyebrow={story.demo.eyebrow} title={story.demo.title} lead={story.demo.lead} />
            <fieldset className={styles.stateDemo}>
              <legend className={styles.srOnly}>{story.demo.statesLabel}</legend>
              {story.demo.states.map((state, index) => (
                <input key={state.key} className={`${styles.stateInput} ${stateInputClasses[index] ?? ''}`} type='radio' name='public-deal-state' id={`public-deal-state-${state.key}`} defaultChecked={index === 0} />
              ))}
              <div className={styles.stateTabs} role='presentation'>
                {story.demo.states.map((state, index) => (
                  <label key={state.key} className={`${styles.stateTab} ${stateTabClasses[index] ?? ''}`} htmlFor={`public-deal-state-${state.key}`}>{state.tab}</label>
                ))}
              </div>
              <div className={styles.statePanels}>
                {story.demo.states.map((state, index) => (
                  <article key={state.key} className={`${styles.statePanel} ${statePanelClasses[index] ?? ''}`} data-state={state.key}>
                    <div className={styles.demoHeader}>
                      <div><span>{story.heroDeal.product}</span><small>{story.heroDeal.route}</small></div><b>{state.status}</b>
                    </div>
                    <div className={`${styles.demoStageRail} pc-public-deal-stage-rail pc-public-deal-stage-rail--demo`} aria-label={story.demo.stageLabel}>
                      {story.demo.stages.map((stage, stageIndex) => (
                        <span key={stage} className={stageIndex < 4 ? styles.stageDone : stageIndex === 4 ? styles.stageCurrent : undefined}><i>{stageIndex + 1}</i><small>{stage}</small></span>
                      ))}
                    </div>
                    <div className={styles.demoContent}>
                      <div className={styles.demoPrimary}>
                        <span className={styles.demoPerspective}>{story.demo.roleLabel}: <b>{story.demo.role}</b></span>
                        <h3>{state.title}</h3><p>{state.summary}</p>
                        <div className={styles.demoKpis}>{state.kpis.map((kpi) => <div key={kpi.label}><span>{kpi.label}</span><strong>{kpi.value}</strong></div>)}</div>
                      </div>
                      <div className={styles.demoEvents}>
                        {state.events.map((event) => (
                          <article key={`${event.meta}-${event.title}`}><i aria-hidden='true' /><div><span>{event.meta}</span><strong>{event.title}</strong><p>{event.text}</p></div></article>
                        ))}
                      </div>
                      <div className={styles.demoAction}>
                        <ScanSearch aria-hidden='true' /><div><strong>{state.actionTitle}</strong><p>{state.actionText}</p></div><span>{state.actionCta}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </fieldset>
            <div className={styles.liveFooter}>
              <span>{story.demo.lead}</span>
              <PublicExperienceLink href={dealHref} className='pc-v6-primary' eventName='open_deal_scenario' locale={locale} params={{ source: 'home_v5_live_deal' }}>
                {story.demo.openDeal}<ArrowRight aria-hidden='true' size={18} />
              </PublicExperienceLink>
            </div>
          </section>

          <section id='trust' className={`pc-v6-section ${styles.section}`} aria-labelledby='trust-title'>
            <SectionHeader id='trust-title' eyebrow={trustCopy.eyebrow} title={trustCopy.title} lead={trustCopy.lead} />
            <div className={styles.benefitGrid}>
              {trustCopy.cards.map(([title, text]) => <article key={title}><strong>{title}</strong><span>{text}</span></article>)}
            </div>
            <div className={styles.liveFooter}>
              <a href={trustHref} className='pc-v6-primary'>{trustCopy.trust}<ArrowRight aria-hidden='true' size={17} /></a>
              <a href={contactHref} className='pc-v6-secondary'>{trustCopy.contact}</a>
            </div>
          </section>

          <section id='tai' className={`pc-v6-section ${styles.section} ${styles.taiSection}`} aria-labelledby='tai-title'>
            <SectionHeader id='tai-title' eyebrow={story.tai.eyebrow} title={story.tai.title} lead={story.tai.lead} />
            <div className={styles.taiLayout}>
              <div className={styles.taiCapabilities}>
                {story.tai.capabilities.map((capability, index) => {
                  const Icon = functionIcons[index + 4] ?? Sparkles;
                  return <article key={capability.title}><Icon aria-hidden='true' /><div><strong>{capability.title}</strong><span>{capability.text}</span></div></article>;
                })}
                <ul>{story.tai.principles.map((principle) => <li key={principle}><CheckCircle2 aria-hidden='true' />{principle}</li>)}</ul>
              </div>
              <div className={styles.taiAnalysis} data-testid='platform-v7-ai-analysis'>
                <div className={styles.taiAnalysisHeader}><Sparkles aria-hidden='true' /><strong>{story.tai.analysisLabel}</strong><span>{story.tai.state}</span></div>
                <div className={styles.taiRows}>
                  {story.tai.rows.map((row, index) => <article key={row.label} id={index === 2 ? 'money' : undefined}><span>{row.label}</span><strong>{row.value}</strong></article>)}
                </div>
                <div className={styles.taiSources}><b>{story.tai.sourcesLabel}</b><div>{story.tai.sources.map((source) => <span key={source}>{source}</span>)}</div></div>
                <p className={styles.taiLimit}>{story.tai.limit}</p>
                <PublicExperienceLink href={taiHref} className={styles.taiLink} eventName='tai_detail_open' locale={locale} params={{ source: 'home_v5_tai' }}>
                  {story.tai.cta}<ArrowRight aria-hidden='true' size={17} />
                </PublicExperienceLink>
              </div>
            </div>
            <div className={styles.gektaProduct} data-gekta-product-entry='true'>
              <div className={styles.gektaProductBody}>
                <span className={styles.gektaProductEyebrow}>{story.gektaProduct.eyebrow}</span>
                <h3 id='gekta-product-title'>{story.gektaProduct.title}</h3><p>{story.gektaProduct.lead}</p>
              </div>
              <PublicExperienceLink href={gektaProductHref} className={styles.gektaProductLink} eventName='gekta_product_open' locale={locale} params={{ source: 'home_tai_product_block' }}>
                {story.gektaProduct.cta}<ArrowRight aria-hidden='true' size={17} />
              </PublicExperienceLink>
            </div>
          </section>

          <section id='faq' className={`pc-v6-section ${styles.section} ${styles.faqSection}`} aria-labelledby='faq-title'>
            <SectionHeader id='faq-title' eyebrow={story.faq.eyebrow} title={story.faq.title} />
            <div className={styles.faqList}>
              {story.faq.items.map((item, index) => (
                <details key={item.question} open={index === 0}><summary><span>{item.question}</span><i aria-hidden='true'>+</i></summary><p>{item.answer}</p></details>
              ))}
            </div>
          </section>

          <section className='pc-v6-final' aria-labelledby='registration-title'>
            <h2 id='registration-title'>{copy.final.title}</h2>
            <p>{copy.final.lead}</p>
            <div className='pc-v6-actions'>
              <PublicExperienceLink href={registerHref} className='pc-v6-primary' eventName='registration_open' locale={locale} params={{ source: 'home_v5_final' }}>
                {copy.final.primary}<ArrowRight aria-hidden='true' size={18} />
              </PublicExperienceLink>
              <PublicExperienceLink href='#connect-organization' className='pc-v6-secondary' eventName='open_organization_connect' locale={locale} params={{ source: 'home_v5_final' }}>
                {copy.final.secondary}
              </PublicExperienceLink>
            </div>
          </section>

          <OrganizationConnectForm locale={locale} />
        </div>
      </main>

      <footer className='pc-v6-footer'>
        <div className='pc-v6-shell'>
          <strong>{copy.a11y.site}</strong>
          <p>{copy.footer.note}</p>
          <nav>
            <a href={trustHref}>{copy.nav.status}</a>
            <a href={`/platform-v7/privacy?lang=${encodeURIComponent(normalizedLocale)}`}>{copy.footer.privacy}</a>
            <a href={contactHref}>{copy.footer.contacts}</a>
          </nav>
        </div>
      </footer>

      <GektaFloatingEntry locale={normalizedLocale} />
    </div>
  );
}