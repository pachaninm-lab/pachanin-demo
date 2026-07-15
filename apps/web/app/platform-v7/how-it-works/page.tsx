import '@/styles/platform-v7-public-header.css';
import '@/styles/platform-v7-public-mobile-safe-area.css';
import '@/styles/platform-v7-i18n-cjk.css';
import '@/styles/platform-v7-public-product-experience-v3.css';
import '@/styles/platform-v7-public-product-experience-v3-refinement.css';
import '@/styles/platform-v7-public-product-experience-v4.css';
import '@/styles/platform-v7-public-product-entry-variants.css';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import { PublicLocaleLink } from '@/components/platform-v7/PublicLocaleLink';
import { PublicDealEntryGate } from '@/components/platform-v7/PublicDealEntryGate';
import { PublicExperienceIcon } from '@/components/platform-v7/PublicExperienceIcon';
import { PublicExperienceScrollCoordinator } from '@/components/platform-v7/PublicExperienceAnalytics';
import { getPublicProductEntryVariantsCopy } from '@/i18n/public-product-entry-variants';
import { getPublicProductExperienceCopy } from '@/i18n/public-product-experience-v3';
import { getPublicProductExperienceV4Copy } from '@/i18n/public-product-experience-v4';
import {
  normalizeTourEntryVariant,
  normalizeTourState,
} from '@/lib/platform-v7/public-product-experience-state';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const copy = getPublicProductExperienceCopy(locale);
  return {
    title: copy.explorer.metaTitle,
    description: copy.explorer.metaDescription,
    alternates: {
      canonical: '/platform-v7/how-it-works',
      languages: {
        ru: '/platform-v7/how-it-works?lang=ru',
        en: '/platform-v7/how-it-works?lang=en',
        zh: '/platform-v7/how-it-works?lang=zh',
      },
    },
    robots: { index: true, follow: true },
  };
}

export default async function PublicDealFromInsidePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const locale = await getLocale();
  const copy = getPublicProductExperienceCopy(locale);
  const ui = getPublicProductExperienceV4Copy(locale);
  const entryCopy = getPublicProductEntryVariantsCopy(locale);
  const chrome = await getTranslations('publicEntry.chrome');
  const initialEntry = normalizeTourEntryVariant(searchParams?.entry);
  const initialState = normalizeTourState(searchParams ?? {});

  return (
    <main id='main-content' className='pc-ppe-page' data-testid='platform-v7-deal-from-inside'>
      <a className='pc-skip-link' href='#pc-ppe-explorer-title'>{chrome('skipToContent')}</a>
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
        <header className='pc-ppe-explorer-intro'>
          <div>
            <span className='pc-ppe-kicker'>{ui.explorer.kicker}</span>
            <h1 id='pc-ppe-explorer-title'>{ui.explorer.title}</h1>
            <p>{ui.explorer.lead}</p>
          </div>
          <div className='pc-ppe-explorer-intro-actions'>
            <a href={`/platform-v7?lang=${encodeURIComponent(locale)}`} className='pc-ppe-back-link'>
              <PublicExperienceIcon name='arrow' size={18} style={{ transform: 'rotate(180deg)' }} />
              <span>{ui.explorer.backHome}</span>
            </a>
          </div>
        </header>

        <PublicDealEntryGate
          copy={copy}
          entryCopy={entryCopy}
          locale={locale}
          initialEntry={initialEntry}
          initialState={initialState}
        />
        <noscript>
          <a href='/platform-v7/register' className='pc-ppe-primary-button'>{ui.explorer.connect}</a>
        </noscript>
      </div>
    </main>
  );
}
