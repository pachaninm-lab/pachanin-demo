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

type Locale = 'ru' | 'en' | 'zh';

const PAGE_COPY = {
  ru: {
    title: 'Гекта в работе — Прозрачная Цена',
    description: 'Как Гекта помогает участникам агросделки понимать контекст Сделки, документы, риски и следующий шаг, сохраняя критическое решение за человеком и правилами платформы.',
    role: 'По ролям', documents: 'Документы', government: 'Госданные', security: 'Безопасность', connection: 'Границы', home: 'На главную', register: 'Зарегистрироваться', trust: 'Доверие',
  },
  en: {
    title: 'Gekta in action — Transparent Price',
    description: 'How Gekta helps agricultural Deal participants understand Deal context, documents, risk and the next step while critical decisions remain with people and platform rules.',
    role: 'By role', documents: 'Documents', government: 'Government data', security: 'Security', connection: 'Boundaries', home: 'Home', register: 'Register', trust: 'Trust',
  },
  zh: {
    title: 'Gekta 如何工作 — 透明价格',
    description: 'Gekta 如何帮助农业交易参与方理解交易上下文、文件、风险和下一步，同时关键决定仍由人员和平台规则控制。',
    role: '按角色', documents: '文件', government: '政府数据', security: '安全', connection: '边界', home: '首页', register: '注册', trust: '信任',
  },
} as const;

const AI_PUBLIC_CLEANUP_CSS = `
.pc-ai-in-action-page .pc-public-government-source-grid button small,
.pc-ai-in-action-page .pc-public-government-result-unchecked,
.pc-ai-in-action-page .pc-public-government-result dl > div:has(.pc-public-government-status-button),
.pc-ai-in-action-page .pc-public-government-result dl > div:has(code),
.pc-ai-in-action-page .pc-public-government-section .pc-ppe-section-header > small {
  display: none !important;
}
`;

function localeOf(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = localeOf(await getLocale());
  const pageCopy = PAGE_COPY[locale];
  return {
    title: pageCopy.title,
    description: pageCopy.description,
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
      googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
    },
    openGraph: {
      title: pageCopy.title,
      description: pageCopy.description,
      url: '/platform-v7/ai-in-action',
      siteName: 'Прозрачная Цена',
      locale: locale === 'en' ? 'en_US' : locale === 'zh' ? 'zh_CN' : 'ru_RU',
      type: 'website',
    },
  };
}

export default async function PublicAiInActionPage() {
  const locale = await getLocale();
  const localeKey = localeOf(locale);
  const pageCopy = PAGE_COPY[localeKey];
  const copy = getPublicProductExperienceCopy(locale);
  const ui = getPublicProductExperienceV4Copy(locale);
  const chrome = await getTranslations('publicEntry.chrome');
  const suffix = `?lang=${encodeURIComponent(localeKey)}`;

  const nav = (
    <>
      <a href='#role'>{pageCopy.role}</a>
      <a href='#documents'>{pageCopy.documents}</a>
      <a href='#government-data'>{pageCopy.government}</a>
      <a href='#security'>{pageCopy.security}</a>
      <a href='#connection'>{pageCopy.connection}</a>
      <a href={`/platform-v7${suffix}`}>{pageCopy.home}</a>
    </>
  );

  return (
    <main id='main-content' className='pc-ppe-page pc-ai-in-action-page' data-testid='platform-v7-ai-in-action-authority'>
      <style>{AI_PUBLIC_CLEANUP_CSS}</style>
      <span data-ai-experience-route='/platform-v7/ai-in-action' hidden>gekta-intelligence-contour-passport</span>
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
        actions={
          <div className='pc-v6-header-actions'>
            <a href={`/platform-v7/login${suffix}`} className='entry-login'>{copy.header.signIn}</a>
            <a href={`/platform-v7/register${suffix}`} className='pc-ppe-primary-button'>{pageCopy.register}</a>
          </div>
        }
      />

      <PublicAiInActionSimpleExperience locale={locale} />

      <footer className='pc-ppe-footer'>
        <div className='pc-ppe-shell pc-ppe-footer-grid'>
          <div className='pc-ppe-footer-brand'><strong>Прозрачная Цена</strong><p>{ui.footer.note}</p></div>
          <nav aria-label={copy.header.aria}>
            <a href={`/platform-v7/about${suffix}`}>{ui.footer.about}</a>
            <a href={`/platform-v7/trust${suffix}`}>{pageCopy.trust}</a>
            <a href={`/platform-v7/privacy${suffix}`}>{ui.footer.privacy}</a>
            <a href={`/platform-v7/terms${suffix}`}>{ui.footer.terms}</a>
            <a href={`/platform-v7/contact${suffix}`}>{ui.footer.contact}</a>
          </nav>
          <small>{ui.footer.disclaimer}</small>
          <span>© {new Date().getUTCFullYear()} Прозрачная Цена</span>
        </div>
      </footer>
    </main>
  );
}
