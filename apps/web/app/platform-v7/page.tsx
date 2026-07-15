import '@/styles/platform-v7-public-header.css';
import '@/styles/platform-v7-public-mobile-safe-area.css';
import '@/styles/platform-v7-i18n-cjk.css';
import '@/styles/platform-v7-public-product-experience-v3.css';
import '@/styles/platform-v7-public-product-experience-v3-refinement.css';
import '@/styles/platform-v7-public-product-experience-v4.css';
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
import type { TourPerspective } from '@/lib/platform-v7/public-product-experience-state';

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
      href={`/platform-v7/how-it-works?lang=${encodeURIComponent(locale)}&lens=participants&perspective=${perspective}`}
      className='pc-ppe-perspective-card'
      eventName='perspective_selected'
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
  const contourStages = ['terms', 'admission', 'deal', 'logistics', 'acceptance', 'documents', 'settlement'] as const;

  return (
    <main id='main-content' className='pc-ppe-page' data-testid='platform-v7-root-execution-cockpit'>
      <a className='pc-skip-link' href='#pc-ppe-hero-title'>{chrome('skipToContent')}</a>
      <PublicExperiencePageView locale={locale} name='home_view' />
      <PublicExperienceScrollCoordinator />

      <PublicSiteHeader
        ariaLabel={copy.header.aria}
        brandHomeLabel={copy.header.brandHome}
        navLabel={copy.header.aria}
        menuLabel={copy.header.aria}
        showMobileMenu={false}
        localeControl={<PublicLocaleLink />}
        actions={<a href='/platform-v7/login' className='entry-login'>{copy.header.signIn}</a>}
      />

      <div className='pc-ppe-shell'>
        <section className='pc-ppe-hero pc-ppe-hero-copy-only' aria-labelledby='pc-ppe-hero-title'>
          <div className='pc-ppe-hero-copy'>
            <span className='pc-ppe-kicker'>{ui.home.hero.kicker}</span>
            <h1 id='pc-ppe-hero-title'>{ui.home.hero.title}</h1>
            <p>{ui.home.hero.lead}</p>
            <div className='pc-ppe-hero-actions'>
              <PublicExperienceLink
                href={`/platform-v7/how-it-works?lang=${encodeURIComponent(locale)}`}
                className='pc-ppe-primary-button'
                eventName='home_primary_cta_click'
                locale={locale}
                params={{ source: 'hero' }}
              >
                <span>{ui.home.hero.primary}</span>
                <PublicExperienceIcon name='arrow' size={20} />
              </PublicExperienceLink>
              <PublicExperienceLink
                href='/platform-v7/register'
                className='pc-ppe-secondary-button'
                eventName='home_connect_click'
                locale={locale}
                params={{ source: 'hero' }}
              >
                {ui.home.hero.secondary}
              </PublicExperienceLink>
            </div>
          </div>

          <div className='pc-ppe-hero-contour' aria-label={ui.home.hero.progressAria}>
            <div className='pc-ppe-hero-contour-desktop' aria-hidden='true'>
              {contourStages.map((stage, index) => (
                <span key={stage} data-active={stage === 'acceptance' ? 'true' : 'false'}>
                  <i>{index + 1}</i>
                  <b>{copy.explorer.stages[stage].label}</b>
                </span>
              ))}
            </div>
            <div className='pc-ppe-hero-progress-mobile'>
              <span>{ui.home.hero.stageCounter}</span>
              <strong>{ui.home.hero.currentStage}</strong>
              <small>{ui.home.hero.nextStage}</small>
              <a
                href={`/platform-v7/how-it-works?lang=${encodeURIComponent(locale)}&entry=deal&stage=acceptance`}
                aria-label={ui.home.hero.showAllStages}
              >
                <PublicExperienceIcon name='arrow' size={20} />
              </a>
            </div>
          </div>
        </section>

        <section className='pc-ppe-section' aria-label={copy.home.preview.eyebrow}>
          <PublicDealPreview copy={copy} locale={locale} />
        </section>

        <section className='pc-ppe-section' aria-labelledby='pc-ppe-perspectives-title'>
          <div className='pc-ppe-section-header'>
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
          <div className='pc-ppe-proof-panel'>
            <h2 id='pc-ppe-proof-title'>{copy.home.proof.title}</h2>
            <ul className='pc-ppe-proof-list'>
              {copy.home.proof.rows.map((row) => (
                <li key={row}>
                  <span><PublicExperienceIcon name='check' size={19} /></span>
                  <strong>{row}</strong>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className='pc-ppe-final-cta' aria-labelledby='pc-ppe-final-title'>
          <h2 id='pc-ppe-final-title'>{ui.home.final.title}</h2>
          <div className='pc-ppe-final-actions'>
            <PublicExperienceLink
              href={`/platform-v7/how-it-works?lang=${encodeURIComponent(locale)}`}
              className='pc-ppe-primary-button'
              eventName='deal_xray_open'
              locale={locale}
              params={{ source: 'final_cta' }}
            >
              <span>{ui.home.final.primary}</span>
              <PublicExperienceIcon name='arrow' size={20} />
            </PublicExperienceLink>
            <PublicExperienceLink
              href='/platform-v7/register'
              className='pc-ppe-secondary-button'
              eventName='connect_cta_click'
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
        <div className='pc-ppe-shell'>© {new Date().getUTCFullYear()} Прозрачная Цена</div>
      </footer>
    </main>
  );
}
