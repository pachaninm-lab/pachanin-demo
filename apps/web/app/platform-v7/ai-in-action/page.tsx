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
import { PublicExperienceScrollCoordinator } from '@/components/platform-v7/PublicExperienceAnalytics';
import { getPublicProductExperienceCopy } from '@/i18n/public-product-experience-v3';
import { getPublicProductExperienceV4Copy } from '@/i18n/public-product-experience-v4';

const META = {
  ru: {
    title: 'Как ИИ работает в платформе — Прозрачная Цена',
    description: 'Интерактивный анимированный показ: как ролевой ИИ анализирует доступные факты сделки, выявляет риск, объясняет причину и готовит следующий шаг.',
    demo: 'Показ работы ИИ',
    capabilities: 'Возможности',
    control: 'Контроль',
  },
  en: {
    title: 'How AI works in the platform — Transparent Price',
    description: 'An interactive animated walkthrough of role-scoped AI analysing accessible deal facts, identifying risk, explaining the cause and preparing the next step.',
    demo: 'AI walkthrough',
    capabilities: 'Capabilities',
    control: 'Control',
  },
  zh: {
    title: '平台中的 AI 如何工作 — 透明价格',
    description: '交互动画演示角色范围 AI 如何分析可访问交易事实、识别风险、解释原因并准备下一步。',
    demo: 'AI 演示',
    capabilities: '能力',
    control: '控制',
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const key = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const meta = META[key];
  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: '/platform-v7/ai-in-action',
      languages: {
        ru: '/platform-v7/ai-in-action?lang=ru',
        en: '/platform-v7/ai-in-action?lang=en',
        zh: '/platform-v7/ai-in-action?lang=zh',
      },
    },
    robots: { index: true, follow: true },
  };
}

export default async function PlatformV7AiInActionPage() {
  const locale = await getLocale();
  const key = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const meta = META[key];
  const copy = getPublicProductExperienceCopy(locale);
  const ui = getPublicProductExperienceV4Copy(locale);
  const chrome = await getTranslations('publicEntry.chrome');
  const nav = (
    <>
      <a href='#ai-demo'>{meta.demo}</a>
      <a href='#capabilities'>{meta.capabilities}</a>
      <a href='#control'>{meta.control}</a>
    </>
  );

  return (
    <main id='main-content' className='pc-ppe-page' data-testid='platform-v7-ai-in-action-page'>
      <a className='pc-skip-link' href='#pc-ai-action-title'>{chrome('skipToContent')}</a>
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
