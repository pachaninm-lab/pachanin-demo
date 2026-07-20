import '@/styles/platform-v7-public-header.css';
import '@/styles/platform-v7-public-mobile-safe-area.css';
import '@/styles/platform-v7-i18n-cjk.css';
import '@/styles/platform-v7-public-product-experience-v3.css';
import '@/styles/platform-v7-public-product-experience-v3-refinement.css';
import '@/styles/platform-v7-public-product-experience-v4.css';
import '@/styles/platform-v7-public-product-entry-variants.css';
import '@/styles/platform-v7-public-product-experience-v5.css';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import { PublicLocaleLink } from '@/components/platform-v7/PublicLocaleLink';
import { PublicDealPreview } from '@/components/platform-v7/PublicDealPreview';
import { PublicExperienceIcon } from '@/components/platform-v7/PublicExperienceIcon';
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
  description: 'Одна история исполнения зерновой сделки: участники, перевозка, приёмка, качество, документы, деньги, риски и спор.',
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
  ru: {
    stageCounter: 'Этап 1 из 10',
    currentStage: 'Условия сделки',
    nextStage: 'Далее: проверка допуска',
    showAllStages: 'Посмотреть весь путь сделки с начала',
  },
  en: {
    stageCounter: 'Stage 1 of 10',
    currentStage: 'Deal terms',
    nextStage: 'Next: admission checks',
    showAllStages: 'View the full deal path from the beginning',
  },
  zh: {
    stageCounter: '第 1 阶段，共 10 阶段',
    currentStage: '交易条件',
    nextStage: '下一步：准入检查',
    showAllStages: '从头查看完整交易路径',
  },
} as const;

const firstScreenAiCopy = {
  ru: {
    label: 'ИИ работает в платформе',
    text: 'В рабочих кабинетах ИИ анализирует доступные данные сделки, выявляет риски, объясняет причины и готовит следующий шаг. Критические действия остаются за участником и требуют подтверждения; ниже показан обезличенный демонстрационный сценарий.',
  },
  en: {
    label: 'AI is active in the platform',
    text: 'In authenticated workspaces, AI analyses accessible deal data, identifies risks, explains causes and prepares the next step. Consequential actions remain with the authorised participant and require confirmation; the scenario below is anonymised and demonstrative.',
  },
  zh: {
    label: 'AI 已在平台中运行',
    text: '在已授权工作区内，AI 分析可访问的交易数据、识别风险、解释原因并准备下一步。重要操作仍由获授权的参与方执行并确认；以下为匿名演示场景。',
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
      <span>
        <strong>{label}</strong>
        <small>{value}</small>
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
  const aiHero = firstScreenAiCopy[localeKey];
  const startDealHref = `/platform-v7/how-it-works?lang=${encodeURIComponent(locale)}&entry=deal&stage=terms&lens=execution&perspective=buyer`;
  const aiExperienceHref = `/platform-v7/ai-in-action?lang=${encodeURIComponent(locale)}`;
  const aiNavLabel = locale === 'ru' ? 'ИИ' : 'AI';
  const nav = (
    <>
      <a href='#deal-example'>{ui.header.howItWorks}</a>
      <a href='#ai-copilot'>{aiNavLabel}</a>
      <a href='#participants'>{ui.header.participants}</a>
      <a href='#reliability'>{ui.header.reliability}</a>
    </>
  );

  return (
    <main id='main-content' className='pc-ppe-page' data-testid='platform-v7-root-execution-cockpit'>
      <style>{`
        .pc-ppe-ai-status-link {
          width: fit-content;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: inherit;
          text-decoration: none;
          border-radius: 5px;
        }
        .pc-ppe-ai-status-link svg { transition: transform 160ms ease; }
        .pc-ppe-ai-status-link:hover strong,
        .pc-ppe-ai-status-link:focus-visible strong {
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .pc-ppe-ai-status-link:hover svg,
        .pc-ppe-ai-status-link:focus-visible svg { transform: translateX(3px); }
        .pc-ppe-ai-status-link:focus-visible {
          outline: 3px solid rgba(8, 122, 59, .2);
          outline-offset: 4px;
        }
        @media (prefers-reduced-motion: reduce) {
          .pc-ppe-ai-status-link svg { transition: none; }
        }
        @media (min-width: 821px) {
          .pc-ppe-page .pc-ppe-hero-contour-desktop {
            grid-template-columns: repeat(5, minmax(0, 1fr));
            grid-template-rows: repeat(2, minmax(92px, 1fr));
            align-items: start;
            gap: 18px 8px;
            min-height: 250px;
          }
          .pc-ppe-page .pc-ppe-hero-contour-desktop::before { display: none; }
          .pc-ppe-page .pc-ppe-hero-contour-desktop > span { align-content: start; }
          .pc-ppe-page .pc-ppe-hero-contour-desktop > span > b { max-width: 100px; }
        }
      `}</style>
      <a className='pc-skip-link' href='#pc-ppe-hero-title'>{chrome('skipToContent')}</a>
      <PublicExperiencePageView locale={locale} name='home_view' />
      <PublicExperienceScrollCoordinator />

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
        <section className='pc-ppe-hero pc-ppe-hero-copy-only' aria-labelledby='pc-ppe-hero-title'>
          <div className='pc-ppe-hero-copy'>
            <span className='pc-ppe-kicker'>{ui.home.hero.kicker}</span>
            <h1 id='pc-ppe-hero-title'>{ui.home.hero.title}</h1>
            <p>{ui.home.hero.lead}</p>
            <div
              id='ai-copilot'
              className='pc-ppe-public-status'
              role='note'
              aria-label={aiHero.label}
              data-testid='platform-v7-ai-current-value'
            >
              <PublicExperienceLink
                href={aiExperienceHref}
                className='pc-ppe-ai-status-link'
                eventName='ai_in_action_opened'
                locale={locale}
                params={{ source: 'home_ai_status' }}
              >
                <strong>{aiHero.label}</strong>
                <PublicExperienceIcon name='arrow' size={18} />
              </PublicExperienceLink>
              <span>{aiHero.text}</span>
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
              <a href={startDealHref} aria-label={start.showAllStages}>
                <PublicExperienceIcon name='arrow' size={20} />
              </a>
            </div>
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
              <PerspectiveCard
                key={perspective}
                perspective={perspective}
                locale={locale}
                label={copy.explorer.perspectives[perspective].label}
                value={copy.explorer.perspectives[perspective].value}
              />
            ))}
          </div>
          <details className='pc-ppe-all-participants'>
            <summary>
              <span>{ui.home.perspectives.more}</span>
              <PublicExperienceIcon name='arrow' size={20} />
            </summary>
            <div className='pc-ppe-perspective-grid' role='group' aria-label={ui.home.perspectives.more}>
              {secondaryPerspectives.map((perspective) => (
                <PerspectiveCard
                  key={perspective}
                  perspective={perspective}
                  locale={locale}
                  label={copy.explorer.perspectives[perspective].label}
                  value={copy.explorer.perspectives[perspective].value}
                />
              ))}
            </div>
          </details>
        </section>

        <section className='pc-ppe-section' aria-labelledby='pc-ppe-proof-title'>
          <div className='pc-ppe-evidence-panel'>
            <header>
              <span className='pc-ppe-section-eyebrow'>{ui.home.proof.eyebrow}</span>
              <h2 id='pc-ppe-proof-title'>{ui.home.proof.title}</h2>
              <p>{ui.home.proof.lead}</p>
            </header>
            <ol className='pc-ppe-evidence-chain'>
              {ui.home.proof.steps.map((step, index) => (
                <li key={step.label}>
                  <span aria-hidden='true'>{index + 1}</span>
                  <div>
                    <strong>{step.label}</strong>
                    <p>{step.value}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className='pc-ppe-evidence-result'>
              <strong>{ui.home.proof.resultLabel}</strong>
              <p>{ui.home.proof.resultValue}</p>
            </div>
          </div>
        </section>

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
        </section>

        <section className='pc-ppe-final-cta' aria-labelledby='pc-ppe-final-title'>
          <h2 id='pc-ppe-final-title'>{ui.home.final.title}</h2>
          <p>{ui.home.final.lead}</p>
          <div className='pc-ppe-final-actions'>
            <PublicExperienceLink
              href={startDealHref}
              className='pc-ppe-primary-button'
              eventName='deal_preview_opened'
              locale={locale}
              params={{ source: 'final_cta', stage: 'terms' }}
            >
              <span>{ui.home.final.primary}</span>
              <PublicExperienceIcon name='arrow' size={20} />
            </PublicExperienceLink>
            <PublicExperienceLink
              href='/platform-v7/register'
              className='pc-ppe-secondary-button'
              eventName='organization_connect_started'
              locale={locale}
              params={{ source: 'final_cta' }}
            >
              {ui.home.final.secondary}
            </PublicExperienceLink>
          </div>
          <p className='pc-ppe-final-signin'>
            {ui.home.final.signInPrefix} <a href='/platform-v7/login'>{ui.home.final.signIn}</a>
          </p>
        </section>
      </div>

      <footer className='pc-ppe-footer'>
        <div className='pc-ppe-shell pc-ppe-footer-grid'>
          <div className='pc-ppe-footer-brand'>
            <strong>Прозрачная Цена</strong>
            <p>{ui.footer.note}</p>
          </div>
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
