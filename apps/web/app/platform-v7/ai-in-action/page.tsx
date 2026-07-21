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
import { PublicLocaleLink } from '@/components/platform-v7/PublicLocaleLink';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import { SingleServerAiInActionExperience } from '@/components/platform-v7/SingleServerAiInActionExperience';
import { getPublicProductExperienceCopy } from '@/i18n/public-product-experience-v3';
import { getPublicProductExperienceV4Copy } from '@/i18n/public-product-experience-v4';

export const metadata: Metadata = {
  title: 'Как ИИ помогает в сделке — Прозрачная Цена',
  description: 'Интерактивный обезличенный сценарий: ИИ обнаруживает проблему, объясняет причину, показывает доказательства и готовит следующий разрешённый шаг.',
  alternates: {
    canonical: '/platform-v7/ai-in-action',
    languages: {
      ru: '/platform-v7/ai-in-action?lang=ru',
      en: '/platform-v7/ai-in-action?lang=en',
      zh: '/platform-v7/ai-in-action?lang=zh',
    },
  },
  robots: {
    index: true,
    follow: true,
  },
};

const PAGE_COPY = {
  ru: { scenario: 'Сценарии', flow: 'Как работает', boundaries: 'Границы', home: 'На главную' },
  en: { scenario: 'Scenarios', flow: 'How it works', boundaries: 'Boundaries', home: 'Home' },
  zh: { scenario: '场景', flow: '工作方式', boundaries: '边界', home: '首页' },
} as const;

export default async function SingleServerAiInActionPage() {
  const locale = await getLocale();
  const localeKey = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const pageCopy = PAGE_COPY[localeKey];
  const copy = getPublicProductExperienceCopy(locale);
  const ui = getPublicProductExperienceV4Copy(locale);
  const chrome = await getTranslations('publicEntry.chrome');

  const nav = (
    <>
      <a href='#scenario'>{pageCopy.scenario}</a>
      <a href='#flow'>{pageCopy.flow}</a>
      <a href='#boundaries'>{pageCopy.boundaries}</a>
      <a href={`/platform-v7?lang=${encodeURIComponent(localeKey)}`}>{pageCopy.home}</a>
    </>
  );

  return (
    <main id='main-content' className='pc-ppe-page' data-testid='single-server-ai-in-action-route'>
      <span data-ai-experience-route='/platform-v7/ai-in-action' hidden>
        single-server-ai-in-action
      </span>
      <a className='pc-skip-link' href='#pc-ss-ai-title'>{chrome('skipToContent')}</a>

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

      <SingleServerAiInActionExperience locale={localeKey} />

      <footer className='pc-ppe-footer'>
        <div className='pc-ppe-shell pc-ppe-footer-grid'>
          <div className='pc-ppe-footer-brand'>
            <strong>Прозрачная Цена</strong>
            <p>{ui.footer.note}</p>
          </div>
          <nav aria-label={copy.header.aria}>
            <a href='/platform-v7/about'>{ui.footer.about}</a>
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
