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
import { getLocale, getTranslations } from 'next-intl/server';
import { PublicAiInActionSimpleExperience } from '@/components/platform-v7/PublicAiInActionSimpleExperience';
import { PublicLocaleLink } from '@/components/platform-v7/PublicLocaleLink';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import {
  PublicExperiencePageView,
  PublicExperienceScrollCoordinator,
} from '@/components/platform-v7/PublicExperienceAnalytics';
import { getPublicProductExperienceCopy } from '@/i18n/public-product-experience-v3';
import { getPublicProductExperienceV4Copy } from '@/i18n/public-product-experience-v4';

export const metadata: Metadata = {
  title: 'Паспорт интеллектуального контура TAI — Прозрачная Цена',
  description: 'Роль TAI в исполнении сделки: ролевой анализ, документы, государственные основания, риски, подготовленные действия, доказательства, безопасность и ограничения.',
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
    title: 'Паспорт интеллектуального контура TAI — Прозрачная Цена',
    description: 'Как TAI формирует проверяемый вывод, готовит разрешённое действие и оставляет решение за человеком.',
    url: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/ai-in-action',
    siteName: 'Прозрачная Цена',
    locale: 'ru_RU',
    type: 'website',
  },
};

const PAGE_COPY = {
  ru: {
    role: 'Роль TAI',
    documents: 'Документы',
    government: 'Госданные',
    security: 'Безопасность',
    connection: 'Подключение',
    home: 'На главную',
  },
  en: {
    role: 'TAI role',
    documents: 'Documents',
    government: 'Government data',
    security: 'Security',
    connection: 'Connection',
    home: 'Home',
  },
  zh: {
    role: 'TAI 角色',
    documents: '文件',
    government: '政府数据',
    security: '安全',
    connection: '连接',
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
      <a href='#role'>{pageCopy.role}</a>
      <a href='#documents'>{pageCopy.documents}</a>
      <a href='#government-data'>{pageCopy.government}</a>
      <a href='#security'>{pageCopy.security}</a>
      <a href='#connection'>{pageCopy.connection}</a>
      <a href='/platform-v7'>{pageCopy.home}</a>
    </>
  );

  return (
    <main id='main-content' className='pc-ppe-page pc-ai-in-action-page' data-testid='platform-v7-ai-in-action-authority'>
      <span data-ai-experience-route='/platform-v7/ai-in-action' hidden>tai-intelligence-contour-passport</span>
      <a className='pc-skip-link' href='#pc-ai-passport-title'>{chrome('skipToContent')}</a>
      <PublicExperiencePageView locale={locale} name='ai_in_action_opened' />
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

      <PublicAiInActionSimpleExperience locale={locale} />

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
