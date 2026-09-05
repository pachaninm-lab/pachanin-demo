import '@/styles/platform-v7-public-header.css';
import '@/styles/platform-v7-public-mobile-safe-area.css';
import '@/styles/platform-v7-i18n-cjk.css';
import '@/styles/platform-v7-public-product-experience-v3.css';
import '@/styles/platform-v7-public-product-experience-v3-refinement.css';
import '@/styles/platform-v7-public-product-experience-v4.css';
import '@/styles/platform-v7-public-product-entry-variants.css';
import '@/styles/platform-v7-public-product-experience-v5.css';
import '@/styles/platform-v7-public-deal-explorer-mobile.css';
import '@/styles/platform-v7-public-deal-journey-v5.css';
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
import { getPublicDealJourneyV5Copy } from '@/i18n/public-deal-journey-v5';
import {
  DEFAULT_TOUR_STATE,
  normalizeTourEntryVariant,
  normalizeTourState,
} from '@/lib/platform-v7/public-product-experience-state';

type Locale = 'ru' | 'en' | 'zh';

const PAGE_COPY: Record<Locale, Readonly<{
  title: string;
  description: string;
  kicker: string;
  heading: string;
  lead: string;
  exampleNotice: string;
  register: string;
  back: string;
}>> = {
  ru: {
    title: 'Как проходит агросделка — Прозрачная Цена',
    description: 'Путь одной сделки в растениеводстве: условия, выбор контрагента, договорённости, доставка, приёмка, качество, документы, расчёт и закрытие.',
    kicker: 'Как работает Сделка',
    heading: 'От условий до закрытия — один понятный путь',
    lead: 'Сначала разберите обычное успешное исполнение. Затем при необходимости переключитесь на частичную приёмку или спор и посмотрите, как меняются действия, документы и расчётные основания.',
    exampleNotice: 'Ниже используется вымышленный пример. Он объясняет механику платформы и не содержит реальных сделок, организаций или банковских операций.',
    register: 'Зарегистрироваться',
    back: 'На главную',
  },
  en: {
    title: 'How an agricultural Deal works — Transparent Price',
    description: 'One crop-trade journey from terms and counterparty selection through delivery, acceptance, quality, documents, settlement and closure.',
    kicker: 'How a Deal works',
    heading: 'One clear path from terms to closure',
    lead: 'Start with ordinary successful execution. If needed, switch to partial acceptance or dispute and see how actions, documents and settlement grounds change.',
    exampleNotice: 'The flow below uses fictional data to explain platform mechanics. It contains no real deals, organisations or banking operations.',
    register: 'Register',
    back: 'Back to home',
  },
  zh: {
    title: '农业交易如何运行 — 透明价格',
    description: '一笔种植业交易从条件和交易方选择，到交付、验收、质量、文件、结算与关闭的完整路径。',
    kicker: '交易如何运行',
    heading: '从条件到关闭，一条清晰路径',
    lead: '先查看普通成功履约流程。如有需要，再切换到部分验收或争议，了解操作、文件和结算依据如何变化。',
    exampleNotice: '下方使用虚构数据说明平台机制，不包含真实交易、机构或银行操作。',
    register: '注册',
    back: '返回首页',
  },
};

function localeOf(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = localeOf(await getLocale());
  const copy = PAGE_COPY[locale];
  return {
    title: copy.title,
    description: copy.description,
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
  const normalizedLocale = localeOf(locale);
  const pageCopy = PAGE_COPY[normalizedLocale];
  const copy = getPublicProductExperienceCopy(locale);
  const ui = getPublicProductExperienceV4Copy(locale);
  const journeyUi = getPublicDealJourneyV5Copy(locale);
  const entryCopy = getPublicProductEntryVariantsCopy(locale);
  const chrome = await getTranslations('publicEntry.chrome');
  const initialEntry = normalizeTourEntryVariant(searchParams?.entry);
  const initialState = normalizeTourState(searchParams ?? {}, {
    ...DEFAULT_TOUR_STATE,
    stage: 'terms',
    perspective: 'buyer',
  });
  const localizedHref = (path: string) => `${path}?lang=${encodeURIComponent(normalizedLocale)}`;
  const registerHref = localizedHref('/platform-v7/register');
  const loginHref = localizedHref('/platform-v7/login');
  const homeHref = localizedHref('/platform-v7');
  const nav = (
    <>
      <a href={`${homeHref}#deal-path`}>{ui.header.howItWorks}</a>
      <a href={`${homeHref}#participants`}>{ui.header.participants}</a>
      <a href={`${homeHref}#trust`}>{ui.header.reliability}</a>
    </>
  );

  return (
    <main id='main-content' className='pc-ppe-page' data-testid='platform-v7-deal-from-inside'>
      <a className='pc-skip-link' href='#pc-ppe-explorer-title'>{chrome('skipToContent')}</a>
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
            <a href={loginHref} className='entry-login'>{copy.header.signIn}</a>
            <a href={registerHref} className='pc-ppe-primary-button'>{pageCopy.register}</a>
          </div>
        }
      />

      <div className='pc-ppe-shell'>
        <header className='pc-ppe-explorer-intro'>
          <div>
            <span className='pc-ppe-kicker'>{pageCopy.kicker}</span>
            <h1 id='pc-ppe-explorer-title'>{pageCopy.heading}</h1>
            <p>{pageCopy.lead}</p>
            <div className='pc-ppe-demo-banner' role='note'>{pageCopy.exampleNotice}</div>
          </div>
          <div className='pc-ppe-explorer-intro-actions'>
            <a href={homeHref} className='pc-ppe-back-link'>
              <PublicExperienceIcon name='arrow' size={18} style={{ transform: 'rotate(180deg)' }} />
              <span>{pageCopy.back}</span>
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
          <a href={registerHref} className='pc-ppe-primary-button'>{pageCopy.register}</a>
        </noscript>
      </div>

      <footer className='pc-ppe-footer'>
        <div className='pc-ppe-shell pc-ppe-footer-grid'>
          <div className='pc-ppe-footer-brand'>
            <strong>Прозрачная Цена</strong>
            <p>{ui.footer.note}</p>
          </div>
          <nav aria-label={copy.header.aria}>
            <a href={localizedHref('/platform-v7/about')}>{ui.footer.about}</a>
            <a href={localizedHref('/platform-v7/status')}>{ui.footer.status}</a>
            <a href={localizedHref('/platform-v7/privacy')}>{ui.footer.privacy}</a>
            <a href={localizedHref('/platform-v7/terms')}>{ui.footer.terms}</a>
            <a href={localizedHref('/platform-v7/contact')}>{ui.footer.contact}</a>
          </nav>
          <small>{ui.footer.disclaimer}</small>
          <span>© {new Date().getUTCFullYear()} Прозрачная Цена</span>
        </div>
      </footer>
    </main>
  );
}
