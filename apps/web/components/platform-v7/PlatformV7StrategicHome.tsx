import { getLocale, getTranslations } from 'next-intl/server';
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
import styles from './PlatformV7StrategicHomeStory.module.css';

function SectionHeader({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <div className='pc-v6-section-head'>
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      {lead ? <p>{lead}</p> : null}
    </div>
  );
}

const problemIcons = [MapPinned, FlaskConical, FileCheck2, CircleDollarSign] as const;

export async function PlatformV7StrategicHome() {
  const locale = await getLocale();
  const copy = getPlatformV7HomeCopy(locale);
  const heroMessage = getPlatformV7HeroMessage(locale);
  const story = getPlatformV7HomeStoryCopy(locale);
  const chrome = await getTranslations('publicEntry.chrome');
  const dealHref = `/platform-v7/how-it-works?lang=${encodeURIComponent(locale)}&entry=deal&stage=terms&lens=execution&perspective=buyer`;
  const taiHref = `/platform-v7/ai-in-action?lang=${encodeURIComponent(locale)}`;

  const towerTaiTitle = locale === 'en'
    ? 'TAI found two reasons for the pause'
    : locale === 'zh'
      ? 'TAI 发现两个暂停原因'
      : 'TAI нашёл две причины остановки';

  const nav = <>
    <a href='#deal-path'>{story.nav.how}</a>
    <a href='#tai'>{story.nav.tai}</a>
    <a href='#participants'>{story.nav.roles}</a>
    <a href='#maturity'>{story.nav.maturity}</a>
  </>;

  return (
    <main id='main-content' className='pc-v6-page pc-v7-public-entry' data-testid='platform-v7-root-execution-cockpit'>
      <a className='pc-skip-link' href='#pc-v6-title'>{chrome('skipToContent')}</a>
      <PublicExperiencePageView locale={locale} name='home_v3_view' />
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
            <a href='/platform-v7/login' className='entry-login' aria-label={copy.nav.login}>
              <LogIn aria-hidden='true' size={18} strokeWidth={1.9} />
              <span>{copy.nav.login}</span>
            </a>
            <a href='#connect-organization' className='pc-v6-header-cta'>{copy.nav.connect}</a>
          </div>
        }
      />

      <div className='pc-v6-shell'>
        <section className={`pc-v6-hero pc-v6-hero-unified ${styles.hero}`} aria-labelledby='pc-v6-title'>
          <div className='pc-v6-hero-copy pc-v6-hero-copy-unified'>
            <span className='pc-v6-kicker'>{heroMessage.kicker}</span>
            <h1 id='pc-v6-title' className='pc-v6-hero-title pc-v6-hero-title-unified'>
              <span className='pc-v6-hero-title-main'>{heroMessage.title}</span>
              <span className='pc-v6-hero-title-accent'>{heroMessage.accent}</span>
            </h1>
            <p className='pc-v6-hero-lead pc-v6-hero-lead-unified'>{heroMessage.lead}</p>
            <div className='pc-v6-actions pc-v6-hero-actions-unified'>
              <PublicExperienceLink href={dealHref} className='pc-v6-primary' eventName='hero_primary_cta' locale={locale} params={{ source: 'problem_first_home' }}>
                {copy.hero.primary}<ArrowRight size={19} />
              </PublicExperienceLink>
              <PublicExperienceLink href='#connect-organization' className='pc-v6-secondary' eventName='hero_secondary_cta' locale={locale} params={{ source: 'problem_first_home' }}>
                {copy.hero.secondary}<ArrowRight size={17} />
              </PublicExperienceLink>
            </div>
            <div className={styles.audienceRail} aria-label={story.heroMap.eyebrow}>
              {story.heroMap.audiences.map((audience) => <span key={audience}>{audience}</span>)}
            </div>
          </div>

          <aside className={styles.problemMap} aria-label={story.heroMap.title} data-testid='platform-v7-problem-map'>
            <div className={styles.problemHeader}>
              <span>{story.heroMap.eyebrow}</span>
              <strong>{story.heroMap.title}</strong>
            </div>
            <div className={styles.problemGrid}>
              {story.heroMap.items.map(([title, text], index) => {
                const Icon = problemIcons[index] ?? TriangleAlert;
                return <article key={title}><Icon aria-hidden='true' /><div><strong>{title}</strong><span>{text}</span></div></article>;
              })}
            </div>
            <div className={styles.solutionBar}>
              <Link2 aria-hidden='true' />
              <div><strong>{story.heroMap.solution}</strong><span>{story.heroMap.solutionText}</span></div>
            </div>
          </aside>
        </section>

        <section id='deal-path' className={`pc-v6-section ${styles.processSection}`} aria-labelledby='pc-v6-process-title'>
          <div id='pc-v6-process-title'><SectionHeader eyebrow={story.process.eyebrow} title={story.process.title} lead={story.process.lead} /></div>
          <div className={styles.processGrid}>
            {story.process.steps.map((step) => (
              <article key={step.index}>
                <span className={styles.processIndex}>{step.index}</span>
                <div><strong>{step.title}</strong><p>{step.text}</p></div>
              </article>
            ))}
          </div>
          <div className={styles.lifecycleSummary}>
            <Waypoints aria-hidden='true' />
            <div><strong>{story.process.lifecycleLabel}</strong><span>{story.process.lifecycleText}</span></div>
          </div>
          <div className='pc-v6-lifecycle' role='list' tabIndex={0} aria-label={copy.lifecycle.title}>
            {copy.lifecycle.phases.map((phase, index) => <div key={phase} role='listitem'><i>{index + 1}</i><span>{phase}</span></div>)}
          </div>
          <p className='pc-v6-scroll-hint' style={{ color: '#596a61' }}>{copy.lifecycle.hint}</p>
        </section>

        <section id='tai' className={`pc-v6-section ${styles.aiSection}`} aria-labelledby='pc-v6-ai-title'>
          <div id='pc-v6-ai-title'><SectionHeader eyebrow={story.ai.eyebrow} title={story.ai.title} lead={story.ai.lead} /></div>
          <div className={styles.aiDemo}>
            <div className={`${styles.aiCockpit} pc-v6-control-tower pc-v6-control-tower-unified`} aria-label={copy.a11y.controlTower}>
              <div className='pc-v6-ct-top'>
                <div><small>{copy.tower.sampleLabel}</small><span>{copy.tower.deal}</span></div>
                <b>{copy.tower.stage}</b>
              </div>
              <div className='pc-v6-ct-progress' role='progressbar' aria-label={copy.tower.progressLabel} aria-valuemin={1} aria-valuemax={5} aria-valuenow={3}>
                <span className='is-done' /><span className='is-done' /><span className='is-active' /><span /><span />
              </div>
              <div className='pc-v6-ct-grid'>
                <article><small>{copy.tower.statusLabel}</small><strong>{copy.tower.status}</strong><span className='pc-v6-status pc-v6-status-blocked'><TriangleAlert size={16} />{copy.tower.deviation}</span></article>
                <article><small>{copy.tower.ownerLabel}</small><strong>{copy.tower.owner}</strong><span>{copy.tower.deadline}</span></article>
                <article><small>{copy.tower.moneyLabel}</small><strong>{copy.tower.money}</strong><span className='pc-v6-status pc-v6-status-pending'><CircleDollarSign size={16} />{copy.tower.release}</span></article>
                <article><small>{copy.tower.nextLabel}</small><strong>{copy.tower.next}</strong><span>{copy.tower.nextNote}</span></article>
              </div>
              <div className='pc-v6-tai-strip pc-v6-tower-intelligence'>
                <Sparkles size={18} aria-hidden='true' />
                <div><strong>{towerTaiTitle}</strong><span>{copy.tower.taiText}</span></div>
                <PublicExperienceLink href={taiHref} className='pc-v6-tower-intelligence-link' eventName='open_tai' locale={locale} params={{ source: 'ai_demo_control_tower' }} aria-label={story.ai.cta}>
                  <ArrowRight size={18} aria-hidden='true' />
                </PublicExperienceLink>
              </div>
            </div>

            <div className={styles.aiAnalysis} aria-label={story.ai.title} data-testid='platform-v7-ai-analysis'>
              <div className={styles.aiAnalysisHeader}><ScanSearch aria-hidden='true' /><strong>TAI · Transparent Agro Intelligence</strong></div>
              <div className={styles.analysisGrid}>
                <article><span>{story.ai.detectedLabel}</span><strong>{story.ai.detected}</strong></article>
                <article><span>{story.ai.conclusionLabel}</span><strong>{story.ai.conclusion}</strong></article>
                <article><span>{story.ai.impactLabel}</span><strong>{story.ai.impact}</strong></article>
                <article><span>{story.ai.nextLabel}</span><strong>{story.ai.next}</strong></article>
              </div>
              <div className={styles.aiEvidence}>
                <span><b>{story.ai.sourceLabel}:</b> {story.ai.source}</span>
                <span><b>{story.ai.confidenceLabel}:</b> {story.ai.confidence}</span>
              </div>
              <PublicExperienceLink href={taiHref} className={styles.aiLink} eventName='open_tai' locale={locale} params={{ source: 'structured_ai_analysis' }}>
                {story.ai.cta}<ArrowRight size={17} aria-hidden='true' />
              </PublicExperienceLink>
            </div>
          </div>
        </section>

        <section id='participants' className={`pc-v6-section pc-v6-scenario ${styles.roleSection}`} aria-labelledby='pc-v6-roles-title'>
          <div id='pc-v6-roles-title'><SectionHeader eyebrow={story.roles.eyebrow} title={story.roles.title} lead={story.roles.lead} /></div>
          <PublicDealRoleScenario locale={locale} />
          <div className={styles.roleFooter}>
            <span>{story.roles.proof}</span>
            <PublicExperienceLink href={dealHref} className='pc-v6-primary' eventName='open_deal_scenario' locale={locale} params={{ source: 'twelve_role_scenario' }}>
              {story.roles.cta}<ArrowRight size={18} />
            </PublicExperienceLink>
          </div>
        </section>

        <section id='maturity' className={`pc-v6-section pc-v6-assurance ${styles.maturitySection}`} aria-labelledby='pc-v6-maturity-title'>
          <div id='pc-v6-maturity-title'><SectionHeader eyebrow={story.maturity.eyebrow} title={story.maturity.title} lead={story.maturity.lead} /></div>
          <div className={styles.metrics}>
            {story.maturity.metrics.map(([value, label]) => <article key={label}><strong>{value}</strong><span>{label}</span></article>)}
          </div>
          <div className={styles.maturityPillars}>
            {story.maturity.pillars.map(([title, text]) => <article key={title}><ShieldCheck aria-hidden='true' /><div><strong>{title}</strong><span>{text}</span></div></article>)}
          </div>
          <div className={styles.maturityFoot}><CheckCircle2 aria-hidden='true' /><span>{story.maturity.foot}</span></div>
          <div className={`pc-v6-actions ${styles.maturityActions}`}>
            <PublicExperienceLink href='#connect-organization' className='pc-v6-primary' eventName='open_organization_connect' locale={locale} params={{ source: 'maturity_block' }}>
              {story.maturity.primary}<ArrowRight size={18} />
            </PublicExperienceLink>
            <PublicExperienceLink href={dealHref} className='pc-v6-secondary' eventName='open_deal_scenario' locale={locale} params={{ source: 'maturity_block' }}>
              {story.maturity.secondary}<ArrowRight size={17} />
            </PublicExperienceLink>
          </div>
        </section>

        <OrganizationConnectForm locale={locale} />
      </div>

      <footer className='pc-v6-footer'>
        <div className='pc-v6-shell'>
          <strong>{copy.a11y.site}</strong>
          <p>{copy.footer.note}</p>
          <nav><a href='/platform-v7/status'>{copy.nav.status}</a><a href='/platform-v7/privacy'>{copy.footer.privacy}</a><a href='/platform-v7/contact'>{copy.footer.contacts}</a></nav>
        </div>
      </footer>
    </main>
  );
}
