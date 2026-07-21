import '@/styles/platform-v7-public-header.css';
import '@/styles/platform-v7-public-mobile-safe-area.css';
import '@/styles/platform-v7-i18n-cjk.css';
import '@/styles/platform-v7-public-product-experience-v3.css';
import '@/styles/platform-v7-public-product-experience-v3-refinement.css';
import '@/styles/platform-v7-public-product-experience-v4.css';
import '@/styles/platform-v7-public-product-entry-variants.css';
import '@/styles/platform-v7-public-product-experience-v5.css';
import '@/styles/platform-v7-public-intelligence-layer.css';
import type { Metadata } from 'next';
import { Sparkles } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import { PublicLocaleLink } from '@/components/platform-v7/PublicLocaleLink';
import { PublicDealPreview } from '@/components/platform-v7/PublicDealPreview';
import { PublicExperienceIcon } from '@/components/platform-v7/PublicExperienceIcon';
import { PublicHeroIntelligenceStatus } from '@/components/platform-v7/PublicHeroIntelligenceStatus';
import { PublicStageIntelligenceCoverage } from '@/components/platform-v7/PublicStageIntelligenceCoverage';
import { PublicRoleIntelligenceSummary } from '@/components/platform-v7/PublicRoleIntelligenceSummary';
import { PublicEvidenceIntelligencePanel } from '@/components/platform-v7/PublicEvidenceIntelligencePanel';
import { PublicGovernmentDataContour } from '@/components/platform-v7/PublicGovernmentDataContour';
import { PublicAiGovernanceStrip } from '@/components/platform-v7/PublicAiGovernanceStrip';
import { PublicContextualAssistantPrompts } from '@/components/platform-v7/PublicContextualAssistantPrompts';
import {
  PublicExperienceLink,
  PublicExperiencePageView,
  PublicExperienceScrollCoordinator,
} from '@/components/platform-v7/PublicExperienceAnalytics';
import { getPublicProductExperienceCopy } from '@/i18n/public-product-experience-v3';
import { getPublicProductExperienceV4Copy } from '@/i18n/public-product-experience-v4';
import { TOUR_STAGES, type TourPerspective } from '@/lib/platform-v7/public-product-experience-state';

export const metadata: Metadata = {
  title: 'Прозрачная Цена — исполнение зерновой сделки',
  description: 'Одна история исполнения сделки в АПК: участники, перевозка, приёмка, качество, документы, государственные основания, деньги, риски и спор.',
  alternates: {
    canonical: '/platform-v7',
    languages: {
      ru: '/platform-v7?lang=ru',
      en: '/platform-v7?lang=en',
      zh: '/platform-v7?lang=zh',
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};

const firstStageCopy = {
  ru: { stageCounter: 'Этап 1 из 10', currentStage: 'Условия сделки', nextStage: 'Далее: проверка допуска', showAllStages: 'Посмотреть весь путь сделки с начала' },
  en: { stageCounter: 'Stage 1 of 10', currentStage: 'Deal terms', nextStage: 'Next: admission checks', showAllStages: 'View the full deal path from the beginning' },
  zh: { stageCounter: '第 1 阶段，共 10 阶段', currentStage: '交易条件', nextStage: '下一步：准入检查', showAllStages: '从头查看完整交易路径' },
} as const;

const HOME_COPY = {
  ru: {
    nav: { how: 'Как работает', participants: 'Участники', intelligence: 'ИИ-контур', government: 'Госданные', reliability: 'Надёжность' },
    kicker: 'Исполнение внебиржевой сделки в АПК',
    title: 'Сделка под контролем — от условий до расчёта',
    lead: 'Одна карточка связывает участников, перевозку, приёмку, качество, документы, государственные основания, деньги и спор. На каждом этапе видны ответственный, следующее действие и причина блокировки.',
    aiLine: 'TAI анализирует доступный контекст сделки, выявляет расхождения и показывает подтверждённое следующее действие.',
    aiLink: 'Изучить TAI',
    finalAi: 'Изучить TAI',
  },
  en: {
    nav: { how: 'How it works', participants: 'Participants', intelligence: 'AI contour', government: 'Government data', reliability: 'Reliability' },
    kicker: 'Execution of off-exchange agricultural deals',
    title: 'The deal under control — from terms to settlement',
    lead: 'One card connects participants, transport, acceptance, quality, documents, government grounds, money, and disputes. Every stage shows the owner, next action, and reason for a blocker.',
    aiLine: 'TAI analyses the available deal context, detects discrepancies, and shows a confirmed next action.',
    aiLink: 'Explore TAI',
    finalAi: 'Explore TAI',
  },
  zh: {
    nav: { how: '工作方式', participants: '参与方', intelligence: 'AI 链路', government: '政府数据', reliability: '可靠性' },
    kicker: '农业场外交易执行',
    title: '从交易条件到结算，全程受控',
    lead: '一张交易卡连接参与方、运输、验收、质量、文件、政府依据、资金和争议。每个阶段都显示负责人、下一步操作和阻塞原因。',
    aiLine: 'TAI 分析可用的交易上下文，发现差异，并显示已确认的下一步操作。',
    aiLink: '了解 TAI',
    finalAi: '了解 TAI',
  },
} as const;

function PerspectiveCard({
  perspective,
  locale,
  label,
  value,
}: {
  perspective: TourPerspective;
  locale: string;
  label: string;
  value: string;
}) {
  return (
    <PublicExperienceLink
      href={`/platform-v7/how-it-works?lang=${encodeURIComponent(locale)}&entry=deal&lens=execution&perspective=${perspective}`}
      className='pc-ppe-perspective-card'
      eventName='role_selected'
      locale={locale}
      params={{ perspective, source: 'home' }}
    >
      <span><PublicExperienceIcon name={perspective} size={22} /></span>
      <span className='pc-ppe-perspective-copy'>
        <strong>{label}</strong>
        <small>{value}</small>
        <PublicRoleIntelligenceSummary perspective={perspective} locale={locale} />
      </span>
      <PublicExperienceIcon name='arrow' size={20} />
    </PublicExperienceLink>
  );
}

export default async function PlatformV7RootPage() {
  const locale = await getLocale();
  const copy = getPublicProductExperienceCopy(locale);
  const ui = getPublicProductExperienceV4Copy(locale);
  const chrome = await getTranslations('publicEntry.chrome');
  const allPrimaryPerspectives = copy.home.perspectives.primary as readonly TourPerspective[];
  const primaryPerspectives = allPrimaryPerspectives.slice(0, 5);
  const secondaryPerspectives: readonly TourPerspective[] = [
    ...allPrimaryPerspectives.slice(5),
    ...(copy.home.perspectives.secondary as readonly TourPerspective[]),
  ];
  const contourStages = TOUR_STAGES;
  const localeKey = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const start = firstStageCopy[localeKey];
  const home = HOME_COPY[localeKey];
  const startDealHref = `/platform-v7/how-it-works?lang=${encodeURIComponent(locale)}&entry=deal&stage=terms&lens=execution&perspective=buyer`;
  const aiExperienceHref = `/platform-v7/ai-in-action?lang=${encodeURIComponent(locale)}`;
  const stageCoverage = contourStages.map((stage) => ({ id: stage, label: copy.explorer.stages[stage].label }));
  const nav = (
    <>
      <a href='#deal-example'>{home.nav.how}</a>
      <a href='#participants'>{home.nav.participants}</a>
      <a href='#ai-copilot'>{home.nav.intelligence}</a>
      <a href='#government-data'>{home.nav.government}</a>
      <a href='#reliability'>{home.nav.reliability}</a>
    </>
  );

  return (
    <main id='main-content' className='pc-ppe-page' data-testid='platform-v7-root-execution-cockpit'>
      <a className='pc-skip-link' href='#pc-ppe-hero-title'>{chrome('skipToContent')}</a>
      <PublicExperiencePageView locale={locale} name='home_view' />
      <PublicExperienceScrollCoordinator />
      <PublicContextualAssistantPrompts locale={locale} />

      <PublicSiteHeader
        ariaLabel={copy.header.aria}
        brandHomeLabel={copy.header.brandHome}
        navLabel={copy.header.aria}
        menuLabel={ui.header.menu}
        nav={nav}
        showMobileMenu
        localeControl={<PublicLocaleLink />}
        actions={<a href='/platform-v7/login' className='entry-login'>{copy.header.signIn}</a>}
      />

      <div className='pc-ppe-shell'>
        <section className='pc-ppe-hero pc-ppe-hero-copy-only pc-public-intelligence-hero' aria-labelledby='pc-ppe-hero-title'>
          <div className='pc-ppe-hero-copy'>
            <span className='pc-ppe-kicker'>{home.kicker}</span>
            <h1 id='pc-ppe-hero-title'>{home.title}</h1>
            <p>{home.lead}</p>
            <PublicHeroIntelligenceStatus locale={locale} mode='metrics' />
            <div id='ai-copilot' className='pc-public-hero-ai-line' role='note'>
              <Sparkles size={17} aria-hidden='true' />
              <span>{home.aiLine}</span>
              <PublicExperienceLink
                href={aiExperienceHref}
                eventName='ai_in_action_opened'
                locale={locale}
                params={{ source: 'home_ai_line' }}
              >
                {home.aiLink}<PublicExperienceIcon name='arrow' size={17} />
              </PublicExperienceLink>
            </div>
            <div className='pc-ppe-hero-actions'>
              <PublicExperienceLink
                href={startDealHref}
                className='pc-ppe-primary-button'
                eventName='deal_preview_opened'
                locale={locale}
                params={{ source: 'hero', stage: 'terms' }}
              >
                <span>{ui.home.hero.primary}</span>
                <PublicExperienceIcon name='arrow' size={20} />
              </PublicExperienceLink>
              <PublicExperienceLink
                href='/platform-v7/register'
                className='pc-ppe-secondary-button'
                eventName='organization_connect_started'
                locale={locale}
                params={{ source: 'hero' }}
              >
                {ui.home.hero.secondary}
              </PublicExperienceLink>
            </div>
          </div>

          <div className='pc-ppe-hero-contour' role='group' aria-label={ui.home.hero.progressAria}>
            <PublicHeroIntelligenceStatus locale={locale} mode='status' />
            <div className='pc-ppe-hero-contour-desktop' aria-hidden='true'>
              {contourStages.map((stage, index) => (
                <span key={stage} data-active={stage === 'terms' ? 'true' : 'false'}>
                  <i>{index + 1}</i>
                  <b>{copy.explorer.stages[stage].label}</b>
                </span>
              ))}
            </div>
            <div className='pc-ppe-hero-progress-mobile'>
              <span>{start.stageCounter}</span>
              <strong>{start.currentStage}</strong>
              <small>{start.nextStage}</small>
              <a href={startDealHref} aria-label={start.showAllStages}><PublicExperienceIcon name='arrow' size={20} /></a>
            </div>
            <PublicStageIntelligenceCoverage locale={locale} stages={stageCoverage} />
          </div>
        </section>

        <section id='deal-example' className='pc-ppe-section' aria-label={ui.home.preview.demoLabel}>
          <PublicDealPreview copy={copy} locale={locale} />
        </section>

        <section id='participants' className='pc-ppe-section' aria-labelledby='pc-ppe-perspectives-title'>
          <div className='pc-ppe-section-header'>
            <span className='pc-ppe-section-eyebrow'>{ui.home.perspectives.eyebrow}</span>
            <h2 id='pc-ppe-perspectives-title'>{ui.home.perspectives.title}</h2>
            <p>{ui.home.perspectives.lead}</p>
          </div>
          <div className='pc-ppe-perspective-grid' role='group' aria-labelledby='pc-ppe-perspectives-title'>
            {primaryPerspectives.map((perspective) => (
              <PerspectiveCard key={perspective} perspective={perspective} locale={locale} label={copy.explorer.perspectives[perspective].label} value={copy.explorer.perspectives[perspective].value} />
            ))}
          </div>
          <details className='pc-ppe-all-participants'>
            <summary><span>{ui.home.perspectives.more}</span><PublicExperienceIcon name='arrow' size={20} /></summary>
            <div className='pc-ppe-perspective-grid' role='group' aria-label={ui.home.perspectives.more}>
              {secondaryPerspectives.map((perspective) => (
                <PerspectiveCard key={perspective} perspective={perspective} locale={locale} label={copy.explorer.perspectives[perspective].label} value={copy.explorer.perspectives[perspective].value} />
              ))}
            </div>
          </details>
        </section>

        <section id='evidence-contour' className='pc-ppe-section' aria-labelledby='pc-ppe-proof-title'>
          <div className='pc-ppe-section-header'>
            <span className='pc-ppe-section-eyebrow'>{ui.home.proof.eyebrow}</span>
            <h2 id='pc-ppe-proof-title'>{ui.home.proof.title}</h2>
            <p>{ui.home.proof.lead}</p>
          </div>
          <PublicEvidenceIntelligencePanel
            locale={locale}
            steps={ui.home.proof.steps}
            resultLabel={ui.home.proof.resultLabel}
            resultValue={ui.home.proof.resultValue}
          />
        </section>

        <PublicGovernmentDataContour locale={locale} />

        <section id='reliability' className='pc-ppe-section' aria-labelledby='pc-ppe-trust-title'>
          <div className='pc-ppe-section-header'>
            <span className='pc-ppe-section-eyebrow'>{ui.home.trust.eyebrow}</span>
            <h2 id='pc-ppe-trust-title'>{ui.home.trust.title}</h2>
            <p>{ui.home.trust.lead}</p>
          </div>
          <div className='pc-ppe-trust-grid'>
            {ui.home.trust.cards.map((card) => (
              <article key={card.title} className='pc-ppe-trust-card'>
                <span>{card.title}</span>
                <strong>{card.value}</strong>
                <p>{card.note}</p>
                <a href={card.href}>{card.link}<PublicExperienceIcon name='arrow' size={17} /></a>
              </article>
            ))}
          </div>
          <PublicAiGovernanceStrip locale={locale} />
        </section>

        <section className='pc-ppe-final-cta' aria-labelledby='pc-ppe-final-title'>
          <h2 id='pc-ppe-final-title'>{ui.home.final.title}</h2>
          <p>{ui.home.final.lead}</p>
          <div className='pc-ppe-final-actions pc-public-final-actions'>
            <PublicExperienceLink href={startDealHref} className='pc-ppe-primary-button' eventName='deal_preview_opened' locale={locale} params={{ source: 'final_cta', stage: 'terms' }}>
              <span>{ui.home.final.primary}</span><PublicExperienceIcon name='arrow' size={20} />
            </PublicExperienceLink>
            <PublicExperienceLink href='/platform-v7/register' className='pc-ppe-secondary-button' eventName='organization_connect_started' locale={locale} params={{ source: 'final_cta' }}>
              {ui.home.final.secondary}
            </PublicExperienceLink>
            <PublicExperienceLink href={aiExperienceHref} className='pc-ppe-secondary-button' eventName='ai_in_action_opened' locale={locale} params={{ source: 'final_cta' }}>
              {home.finalAi}
            </PublicExperienceLink>
          </div>
          <p className='pc-ppe-final-signin'>{ui.home.final.signInPrefix} <a href='/platform-v7/login'>{ui.home.final.signIn}</a></p>
        </section>
      </div>

      <footer className='pc-ppe-footer'>
        <div className='pc-ppe-shell pc-ppe-footer-grid'>
          <div className='pc-ppe-footer-brand'><strong>Прозрачная Цена</strong><p>{ui.footer.note}</p></div>
          <nav aria-label={copy.header.aria}>
            <a href='/platform-v7/about'>{ui.footer.about}</a>
            <a href='/platform-v7/status'>{ui.footer.status}</a>
            <a href='/platform-v7/privacy'>{ui.footer.privacy}</a>
            <a href='/platform-v7/terms'>{ui.footer.terms}</a>
            <a href='/platform-v7/contact'>{ui.footer.contact}</a>
          </nav>
          <small>{ui.footer.disclaimer}</small>
          <span>© {new Date().getUTCFullYear()} Прозрачная Цена</span>
        </div>
      </footer>
    </main>
  );
}
