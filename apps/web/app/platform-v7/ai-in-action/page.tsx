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
import { PublicAiInActionExperience } from '@/components/platform-v7/PublicAiInActionExperience';
import { PublicLocaleLink } from '@/components/platform-v7/PublicLocaleLink';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import {
  PublicExperiencePageView,
  PublicExperienceScrollCoordinator,
} from '@/components/platform-v7/PublicExperienceAnalytics';
import { getPublicProductExperienceCopy } from '@/i18n/public-product-experience-v3';
import { getPublicProductExperienceV4Copy } from '@/i18n/public-product-experience-v4';

export const metadata: Metadata = {
  title: 'Как ИИ работает в платформе — Прозрачная Цена',
  description: 'Интерактивный разбор: как ИИ видит блокер сделки, связывает разрешённые факты с документами и сроками, объясняет риск и готовит следующий шаг под подтверждением человека.',
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
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    title: 'Как ИИ работает в платформе — Прозрачная Цена',
    description: 'Конкретный ролевой AI-разбор: блокер, основания, срок, деньги под риском и следующий шаг.',
    url: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/ai-in-action',
    siteName: 'Прозрачная Цена',
    locale: 'ru_RU',
    type: 'website',
  },
};

const PAGE_COPY = {
  ru: {
    scenario: 'Разбор',
    result: 'Результат',
    boundaries: 'Границы',
    home: 'На главную',
  },
  en: {
    scenario: 'Analysis',
    result: 'Result',
    boundaries: 'Boundaries',
    home: 'Home',
  },
  zh: {
    scenario: '分析',
    result: '结果',
    boundaries: '边界',
    home: '首页',
  },
} as const;

export default async function PublicAiInActionPage() {
  const locale = await getLocale();
  const localeKey = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const pageCopy = PAGE_COPY[localeKey];
  const copy = getPublicProductExperienceCopy(locale);
  const ui = getPublicProductExperienceV4Copy(locale);
  const chrome = await getTranslations('publicEntry.chrome');

  const nav = (
    <>
      <a href='#scenario'>{pageCopy.scenario}</a>
      <a href='#result'>{pageCopy.result}</a>
      <a href='#boundaries'>{pageCopy.boundaries}</a>
      <a href='/platform-v7'>{pageCopy.home}</a>
    </>
  );

  return (
    <main id='main-content' className='pc-ppe-page pc-ai-in-action-page' data-testid='platform-v7-ai-in-action-authority'>
      <span data-ai-experience-route='/platform-v7/ai-in-action' hidden>
        interactive-animated-ai-explainer
      </span>
      <a className='pc-skip-link' href='#pc-ai-demo-title'>{chrome('skipToContent')}</a>
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

      <PublicAiInActionExperience locale={locale} />

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
