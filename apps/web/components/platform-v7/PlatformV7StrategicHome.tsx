import { Suspense } from 'react';
import { useLocale } from 'next-intl';
import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
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
import { getPlatformV7HomeCopy } from '@/i18n/platform-v7-home-v3';
import { getPlatformV7HeroMessage } from '@/i18n/platform-v7-hero-message';
import { getPlatformV7HomeStoryCopy } from '@/i18n/platform-v7-home-story';
import '@/styles/platform-v7-public-assistant.css';
import '@/styles/platform-v7-public-assistant-shortcut.css';
import '@/styles/platform-v7-public-assistant-mobile-fix.css';
import '@/styles/platform-v7-unified-modal-fullscreen.css';
import styles from './PlatformV7StrategicHomeStory.module.css';

type SectionHeaderProps = {
  id: string;
  eyebrow: string;
  title: string;
  lead?: string;
};

type PublicHomeLocale = 'ru' | 'en' | 'zh';

const SKIP_TO_CONTENT: Record<PublicHomeLocale, string> = {
  ru: 'Перейти к основному содержанию',
  en: 'Skip to main content',
  zh: '跳到主要内容',
};

function publicHomeLocale(value: string): PublicHomeLocale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

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
const trustIcons = [ShieldCheck, FileCheck2, TriangleAlert, CheckCircle2] as const;

const stateInputClasses = [styles.stateNormal, styles.stateDeviation, styles.stateDispute] as const;
const stateTabClasses = [styles.tabNormal, styles.tabDeviation, styles.tabDispute] as const;
const statePanelClasses = [styles.panelNormal, styles.panelDeviation, styles.panelDispute] as const;

export function PlatformV7StrategicHome() {
  const locale = publicHomeLocale(useLocale());
  const copy = getPlatformV7HomeCopy(locale);
  const heroMessage = getPlatformV7HeroMessage(locale);
  const story = getPlatformV7HomeStoryCopy(locale);

  const dealHref = `/platform-v7/how-it-works?lang=${encodeURIComponent(locale)}&entry=deal&stage=terms&lens=execution&perspective=buyer`;
  const taiHref = `/platform-v7/ai-in-action?lang=${encodeURIComponent(locale)}`;

  const nav = (
    <>
      <a href='#difference'>{story.nav.difference}</a>
      <a href='#functions'>{story.nav.functions}</a>
      <a href='#live'>{story.nav.deal}</a>
      <a href='#participants'>{story.nav.roles}</a>
      <a href='#tai'>{story.nav.tai}</a>
      <a href='#maturity'>{story.nav.trust}</a>
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
  }).replace(/</g, '\u003c');

  return (
    <div className={`pc-v6-page pc-v7-public-entry ${styles.root}`} data-testid='platform-v7-root-execution-cockpit'>
      <a className='pc-skip-link' href='#main-content'>{SKIP_TO_CONTENT[locale]}</a>
      <PublicExperiencePageView locale={locale} name='home_v3_view' />
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: structuredData }} />

      <PublicSiteHeader
        ariaLabel={copy.a11y.site}
        brandHomeLabel={copy.a11y.site}
        navLabel={copy.a11y.nav}
        menuLabel={copy.a11y.menu}
        nav={nav}
        showMobileMenu
        localeControl={
          <Suspense fallback={null}>
            <PublicLocaleLink />
          </Suspense>
        }
        actions={
          <div className='pc-v6-header-actions'>
            <a href='/platform-v7/login' className='entry-login' aria-label={copy.nav.login}>
              <LogIn aria-hidden='true' size={18} strokeWidth={1.9} />
              <span>{copy.nav.login}</span>
            </a>
            <a href='#connect-organization' className='pc-v6-header-cta'>{copy.nav.connect}</a>
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
                href='#live'
                className='pc-v6-primary'
                eventName='deal_demo_open'
                locale={locale}
                params={{ source: 'home_v4_hero' }}
              >
                {copy.hero.primary}<ArrowRight aria-hidden='true' size={19} />
              </PublicExperienceLink>
              <PublicExperienceLink
                href='#connect-organization'
                className='pc-v6-secondary'
                eventName='connection_start'
                locale={locale}
                params={{ source: 'home_v4_hero' }}
              >
                {copy.hero.secondary}<ArrowRight aria-hidden='true' size={17} />
              </PublicExperienceLink>
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
              <b>{story.heroDeal.status}</b>
            </div>
            <div
              className={styles.heroDealProgress}
              role='progressbar'
              aria-label={story.demo.stageLabel}
              aria-valuemin={1}
              aria-valuemax={6}
              aria-valuenow={5}
            >
              {story.demo.stages.map((stage, index) => (
                <span key={stage} className={index < 4 ? styles.progressDone : index === 4 ? styles.progressActive : undefined}>
                  <i aria-hidden='true' />
                  <small>{index + 1}</small>
                </span>
              ))}
            </div>
            <div className={styles.heroDealBody}>
              <article>
                <span>{story.heroDeal.stageLabel}</span>
                <strong>{story.heroDeal.stage}</strong>
              </article>
              <article className={styles.deviationItem}>
                <span>{story.heroDeal.deviationLabel}</span>
                <strong><TriangleAlert aria-hidden='true' size={17} />{story.heroDeal.deviation}</strong>
              </article>
              <article>
                <span>{story.heroDeal.ownerLabel}</span>
                <strong>{story.heroDeal.owner}</strong>
                <small><b>{story.heroDeal.actionLabel}:</b> {story.heroDeal.action}</small>
              </article>
              <article className={styles.settlementItem}>
                <span>{story.heroDeal.settlementLabel}</span>
                <strong><CircleDollarSign aria-hidden='true' size={17} />{story.heroDeal.settlement}</strong>
              </article>
            </div>
            <div className={styles.heroDealProof}>
              <FileCheck2 aria-hidden='true' size={18} />
              <span>{story.heroDeal.proof}</span>
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

        <section id='difference' className={`pc-v6-section ${styles.section}`} aria-labelledby='difference-title'>
          <SectionHeader id='difference-title' eyebrow={story.difference.eyebrow} title={story.difference.title} lead={story.difference.lead} />
          <div className={styles.comparisonSurface}>
            <input
              className={styles.moreContentToggle}
              type='checkbox'
              id='difference-more-toggle'
              aria-controls='difference-comparison-rows'
            />
            <div className={styles.comparisonTable} role='table' aria-labelledby='difference-title'>
              <div className={styles.comparisonHeader} role='row'>
                {story.difference.headers.map((header) => <strong key={header} role='columnheader'>{header}</strong>)}
              </div>
              <div id='difference-comparison-rows' className={styles.comparisonRows} role='rowgroup'>
                {story.difference.rows.map((row, index) => (
                  <div
                    key={row.criterion}
                    className={`${styles.comparisonRow} ${index > 1 ? styles.comparisonExtraRow : ''}`}
                    role='row'
                    data-comparison-row='true'
                  >
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
          <div className={styles.honestBoundary}>
            <ShieldCheck aria-hidden='true' />
            <p>{story.difference.boundary}</p>
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
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                  <small><b>{story.functions.resultLabel}:</b> {item.result}</small>
                </article>
              );
            })}
            <input
              className={styles.moreContentToggle}
              type='checkbox'
              id='functions-more-toggle'
              aria-controls='functions-more-cards'
            />
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
                      <h3>{item.title}</h3>
                      <p>{item.text}</p>
                      <small><b>{story.functions.resultLabel}:</b> {item.result}</small>
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

        <section id='deal-path' className={`pc-v6-section ${styles.section}`} aria-labelledby='deal-path-title'>
          <SectionHeader id='deal-path-title' eyebrow={story.process.eyebrow} title={story.process.title} lead={story.process.lead} />
          <div className={styles.phaseGrid}>
            {story.process.phases.slice(0, 3).map((phase) => (
              <article key={phase.index} className={styles.phaseCard}>
                <span>{phase.index}</span>
                <h3>{phase.title}</h3>
                <p>{phase.text}</p>
                <small><b>{story.process.resultLabel}:</b> {phase.result}</small>
              </article>
            ))}
            <input
              className={styles.moreContentToggle}
              type='checkbox'
              id='phases-more-toggle'
              aria-controls='phases-more-cards'
            />
            <label className={styles.moreContentLabel} htmlFor='phases-more-toggle'>
              {story.process.moreLabel}<ArrowRight aria-hidden='true' size={16} />
            </label>
            <div id='phases-more-cards' className={styles.morePhaseGrid}>
                {story.process.phases.slice(3).map((phase) => (
                  <article key={phase.index} className={styles.phaseCard}>
                    <span>{phase.index}</span>
                    <h3>{phase.title}</h3>
                    <p>{phase.text}</p>
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
              <div className='pc-v6-lifecycle' role='list' aria-label={copy.lifecycle.title}>
                {copy.lifecycle.phases.map((phase: string, index: number) => <div key={phase} role='listitem'><i>{index + 1}</i><span>{phase}</span></div>)}
              </div>
            </details>
          </div>
        </section>

        <section id='live' className={`pc-v6-section ${styles.section} ${styles.liveSection}`} aria-labelledby='live-title'>
          <SectionHeader id='live-title' eyebrow={story.demo.eyebrow} title={story.demo.title} lead={story.demo.lead} />
          <fieldset className={styles.stateDemo}>
            <legend className={styles.srOnly}>{story.demo.statesLabel}</legend>
            {story.demo.states.map((state, index) => (
              <input
                key={state.key}
                className={`${styles.stateInput} ${stateInputClasses[index] ?? ''}`}
                type='radio'
                name='public-deal-state'
                id={`public-deal-state-${state.key}`}
                defaultChecked={index === 1}
              />
            ))}
            <div className={styles.stateTabs} role='presentation'>
              {story.demo.states.map((state, index) => (
                <label
                  key={state.key}
                  className={`${styles.stateTab} ${stateTabClasses[index] ?? ''}`}
                  htmlFor={`public-deal-state-${state.key}`}
                >
                  {state.tab}
                </label>
              ))}
            </div>
            <div className={styles.statePanels}>
              {story.demo.states.map((state, index) => (
                <article
                  key={state.key}
                  className={`${styles.statePanel} ${statePanelClasses[index] ?? ''}`}
                  data-state={state.key}
                >
                  <div className={styles.demoHeader}>
                    <div>
                      <span>{story.heroDeal.product}</span>
                      <small>{story.heroDeal.route}</small>
                    </div>
                    <b>{state.status}</b>
                  </div>
                  <div className={styles.demoStageRail} aria-label={story.demo.stageLabel}>
                    {story.demo.stages.map((stage, stageIndex) => (
                      <span key={stage} className={stageIndex < 4 ? styles.stageDone : stageIndex === 4 ? styles.stageCurrent : undefined}>
                        <i>{stageIndex + 1}</i><small>{stage}</small>
                      </span>
                    ))}
                  </div>
                  <div className={styles.demoContent}>
                    <div className={styles.demoPrimary}>
                      <span className={styles.demoPerspective}>{story.demo.roleLabel}: <b>{story.demo.role}</b></span>
                      <h3>{state.title}</h3>
                      <p>{state.summary}</p>
                      <div className={styles.demoKpis}>
                        {state.kpis.map((kpi) => <div key={kpi.label}><span>{kpi.label}</span><strong>{kpi.value}</strong></div>)}
                      </div>
                    </div>
                    <div className={styles.demoEvents}>
                      {state.events.map((event) => (
                        <article key={`${event.meta}-${event.title}`}>
                          <i aria-hidden='true' />
                          <div><span>{event.meta}</span><strong>{event.title}</strong><p>{event.text}</p></div>
                        </article>
                      ))}
                    </div>
                    <div className={styles.demoAction}>
                      <ScanSearch aria-hidden='true' />
                      <div><strong>{state.actionTitle}</strong><p>{state.actionText}</p></div>
                      <span>{state.actionCta}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </fieldset>
          <div className={styles.liveFooter}>
            <span>{story.demo.lead}</span>
            <PublicExperienceLink
              href={dealHref}
              className='pc-v6-primary'
              eventName='open_deal_scenario'
              locale={locale}
              params={{ source: 'home_v4_live_deal' }}
            >
              {story.demo.openDeal}<ArrowRight aria-hidden='true' size={18} />
            </PublicExperienceLink>
          </div>
        </section>

        <section id='participants' className={`pc-v6-section ${styles.section}`} aria-labelledby='participants-title'>
          <SectionHeader id='participants-title' eyebrow={story.roles.eyebrow} title={story.roles.title} lead={story.roles.lead} />
          <div className={styles.roleGroupGrid}>
            {story.roles.groups.map((group) => (
              <article key={group.title} className={styles.roleGroupCard}>
                <span>{group.subroles}</span>
                <h3>{group.title}</h3>
                <dl>
                  <div><dt>{story.roles.labels.see}</dt><dd>{group.see}</dd></div>
                  <div><dt>{story.roles.labels.do}</dt><dd>{group.do}</dd></div>
                  <div><dt>{story.roles.labels.get}</dt><dd>{group.get}</dd></div>
                </dl>
              </article>
            ))}
          </div>
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

        <section id='tai' className={`pc-v6-section ${styles.section} ${styles.taiSection}`} aria-labelledby='tai-title'>
          <SectionHeader id='tai-title' eyebrow={story.tai.eyebrow} title={story.tai.title} lead={story.tai.lead} />
          <div className={styles.taiLayout}>
            <div className={styles.taiCapabilities}>
              {story.tai.capabilities.map((capability, index) => {
                const Icon = functionIcons[index + 4] ?? Sparkles;
                return (
                  <article key={capability.title}>
                    <Icon aria-hidden='true' />
                    <div><strong>{capability.title}</strong><span>{capability.text}</span></div>
                  </article>
                );
              })}
              <ul>
                {story.tai.principles.map((principle) => <li key={principle}><CheckCircle2 aria-hidden='true' />{principle}</li>)}
              </ul>
            </div>
            <div className={styles.taiAnalysis} data-testid='platform-v7-ai-analysis'>
              <div className={styles.taiAnalysisHeader}>
                <Sparkles aria-hidden='true' />
                <strong>{story.tai.analysisLabel}</strong>
                <span>{story.tai.state}</span>
              </div>
              <div className={styles.taiRows}>
                {story.tai.rows.map((row, index) => (
                  <article key={row.label} id={index === 2 ? 'money' : undefined}>
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </article>
                ))}
              </div>
              <div className={styles.taiSources}>
                <b>{story.tai.sourcesLabel}</b>
                <div>{story.tai.sources.map((source) => <span key={source}>{source}</span>)}</div>
              </div>
              <p className={styles.taiLimit}>{story.tai.limit}</p>
              <PublicExperienceLink
                href={taiHref}
                className={styles.taiLink}
                eventName='tai_detail_open'
                locale={locale}
                params={{ source: 'home_v4_tai' }}
              >
                {story.tai.cta}<ArrowRight aria-hidden='true' size={17} />
              </PublicExperienceLink>
            </div>
          </div>
        </section>

        <section id='maturity' className={`pc-v6-section ${styles.section}`} aria-labelledby='maturity-title'>
          <SectionHeader id='maturity-title' eyebrow={story.trust.eyebrow} title={story.trust.title} lead={story.trust.lead} />
          <div className={styles.trustGrid}>
            {story.trust.items.map((item, index) => {
              const Icon = trustIcons[index] ?? ShieldCheck;
              return (
                <article key={item.title}><Icon aria-hidden='true' /><div><strong>{item.title}</strong><span>{item.text}</span></div></article>
              );
            })}
          </div>
          <div className={styles.metrics}>
            {story.trust.metrics.map((metric) => <article key={metric.label}><strong>{metric.value}</strong><span>{metric.label}</span></article>)}
          </div>
          <div className={styles.architectureNote}>
            <ShieldCheck aria-hidden='true' />
            <p>{story.trust.architectureNote}</p>
          </div>

          <div id='integrations' className={styles.integrations} aria-labelledby='integrations-title'>
            <div className={styles.subsectionHeader}>
              <h3 id='integrations-title'>{story.trust.integrationTitle}</h3>
              <span>{story.trust.statusBadge}</span>
            </div>
            <div className={styles.integrationTable} role='table' aria-labelledby='integrations-title'>
              <div className={styles.integrationHeader} role='row'>
                {story.trust.headers.map((header) => <strong key={header} role='columnheader'>{header}</strong>)}
              </div>
              <div className={styles.integrationRows} role='rowgroup'>
                {story.trust.integrations.map((integration) => (
                  <div key={integration.system} className={styles.integrationRow} role='row' data-integration-row='true'>
                    <strong role='rowheader'>{integration.system}</strong>
                    <span role='cell'>{integration.scenario}</span>
                    <span role='cell'>{integration.boundary}</span>
                    <b role='cell'>{integration.status}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.evidenceLadder}>
            <h3>{story.trust.ladderTitle}</h3>
            <ol>{story.trust.ladder.map((level, index) => <li key={level}><span>{index + 1}</span><strong>{level}</strong></li>)}</ol>
            <p>{story.trust.publicationRule}</p>
          </div>
          <div className={styles.trustActions}>
            <PublicExperienceLink
              href='#connect-organization'
              className='pc-v6-primary'
              eventName='connection_start'
              locale={locale}
              params={{ source: 'home_v4_trust' }}
            >
              {story.trust.cta}<ArrowRight aria-hidden='true' size={18} />
            </PublicExperienceLink>
          </div>
        </section>

        <section id='faq' className={`pc-v6-section ${styles.section} ${styles.faqSection}`} aria-labelledby='faq-title'>
          <SectionHeader id='faq-title' eyebrow={story.faq.eyebrow} title={story.faq.title} />
          <div className={styles.faqList}>
            {story.faq.items.map((item, index) => (
              <details key={item.question} open={index === 0}>
                <summary><span>{item.question}</span><i aria-hidden='true'>+</i></summary>
                <p>{item.answer}</p>
              </details>
            ))}
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
            <a href='/platform-v7/status'>{copy.nav.status}</a>
            <a href='/platform-v7/privacy'>{copy.footer.privacy}</a>
            <a href='/platform-v7/contact'>{copy.footer.contacts}</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
