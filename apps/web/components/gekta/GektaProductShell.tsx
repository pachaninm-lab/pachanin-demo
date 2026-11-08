import Link from 'next/link';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import { GektaDiscoverySections } from './GektaDiscoverySections';
import { GektaExperienceFrame } from './GektaExperienceFrame';
import { GektaHero } from './GektaHero';
import { GektaViewportAuthority } from './GektaViewportAuthority';
import { GEKTA_PATHS, type GektaLocale } from '@/lib/gekta/content';
import { getGektaApplicationSchema, getGektaFaqSchema, safeJsonLd } from '@/lib/gekta/seo';

const mobileTouchContract = `
[data-gekta-chat-workspace='true'] {
  -webkit-text-size-adjust: none;
  text-size-adjust: none;
}

[data-gekta-chat-workspace='true'] button {
  -webkit-appearance: none;
  appearance: none;
  font-family: inherit;
}

@media (max-width: 767px) {
  /* WebKit keeps UA border/background/shadow values on otherwise unstyled
     icon buttons even after appearance:none. Reset only the two neutral
     mobile controls that intentionally inherit the surrounding surface. */
  [data-gekta-chat-workspace='true'] header > button:first-child,
  [data-gekta-chat-workspace='true'] [data-gekta-drop-target='true'] > button {
    border: 0;
    background-color: transparent;
    box-shadow: none;
  }

  [data-gekta-chat-workspace='true']:not(.overflow-hidden) {
    height: auto !important;
    min-height: var(--gekta-visual-viewport-height, 100dvh) !important;
    overflow: visible !important;
  }
  [data-gekta-chat-workspace='true']:not(.overflow-hidden) > div {
    height: auto !important;
    min-height: var(--gekta-visual-viewport-height, 100dvh) !important;
  }
  [data-gekta-chat-workspace='true']:not(.overflow-hidden) main {
    min-height: var(--gekta-visual-viewport-height, 100dvh);
  }
  [data-gekta-chat-workspace='true']:not(.overflow-hidden) main > div:first-of-type {
    min-height: 0;
    overflow: visible;
    overscroll-behavior-y: auto;
    scroll-behavior: auto !important;
    touch-action: pan-y;
    -webkit-overflow-scrolling: touch;
  }
  [data-gekta-chat-workspace='true']:not(.overflow-hidden) main > div:last-of-type:empty {
    display: none;
  }
  [data-gekta-chat-workspace='true'] header > button,
  [data-gekta-chat-workspace='true'] [data-gekta-header-new-chat='true'] {
    min-width: 44px;
    min-height: 44px;
  }

  /* iOS zooms focused form controls below 16px, which changes viewport geometry
     mid-gesture and feels like a frozen/jumping interface. Keep every text-entry
     control at a stable readable size and every primary form action touch-safe. */
  [data-gekta-chat-workspace='true'] input:not([type='checkbox']):not([type='radio']):not([type='file']),
  [data-gekta-chat-workspace='true'] select,
  [data-gekta-chat-workspace='true'] textarea {
    font-size: 16px !important;
  }
  [data-gekta-chat-workspace='true'] input:not([type='checkbox']):not([type='radio']):not([type='file']),
  [data-gekta-chat-workspace='true'] select,
  [data-gekta-phone-card='true'] button {
    min-height: 44px;
  }

  /* Only an entered conversation owns the visual viewport. Discovery remains
     normal document flow so iOS browser touch scrolling never gets trapped. */
  [data-gekta-chat-workspace='true'].overflow-hidden {
    position: fixed;
    inset-inline: 0;
    top: var(--gekta-visual-viewport-top, 0px);
    z-index: 40;
    width: 100%;
    height: var(--gekta-visual-viewport-height, 100dvh) !important;
    min-height: 0 !important;
    max-height: var(--gekta-visual-viewport-height, 100dvh);
    overflow: hidden;
  }
  [data-gekta-chat-workspace='true'].overflow-hidden > div {
    height: 100% !important;
    min-height: 0 !important;
  }
  [data-gekta-chat-workspace='true'].overflow-hidden main > div:first-of-type {
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior-y: contain;
    scroll-behavior: auto !important;
    touch-action: pan-y;
    -webkit-overflow-scrolling: touch;
  }

  /* Before a conversation starts, keep the page in normal flow and pin only
     the same composer node when its own textarea has focus. Search/settings
     fields may open the keyboard too, but must never pull the composer over a
     drawer or dialog. The portal parent stays unchanged through keyboard
     cycles, so focus/caret and iOS touch ownership remain stable. */
  html[data-gekta-keyboard-open='true'] [data-gekta-chat-workspace='true']:not(.overflow-hidden):has(#gekta-composer-input:focus) [data-gekta-composer-root='true'] {
    position: fixed;
    inset-inline: 0;
    top: calc(
      var(--gekta-visual-viewport-top, 0px) +
      var(--gekta-visual-viewport-height, 100dvh) -
      var(--gekta-composer-height, 108px)
    );
    z-index: 70;
    width: 100%;
    max-width: none;
    min-width: 0;
    margin: 0;
    background: #fcfbf7;
    box-shadow: 0 -10px 32px rgba(15, 23, 42, 0.08);
  }
  html[data-gekta-keyboard-open='true'] [data-gekta-chat-workspace='true']:not(.overflow-hidden):has(#gekta-composer-input:focus) main > div:first-of-type {
    padding-bottom: calc(var(--gekta-composer-height, 108px) + 16px) !important;
  }

  [data-gekta-chat-workspace='true'] [data-gekta-scroll-to-bottom='true'],
  [data-gekta-chat-workspace='true'] button[aria-label='Scroll to bottom'] {
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
    bottom: calc(var(--gekta-composer-height, 116px) + 12px) !important;
  }
  html[data-gekta-keyboard-open='true'] #gekta-composer-boundary {
    display: none !important;
  }
}
`;

const PUBLIC_COPY = {
  ru: { nav: 'Навигация Гекты', menu: 'Открыть меню', platform: 'Платформа', trust: 'Доверие', contact: 'Контакты', open: 'К Гекте', language: 'Сменить язык', home: 'Прозрачная Цена — на главную' },
  en: { nav: 'Gekta navigation', menu: 'Open menu', platform: 'Platform', trust: 'Trust', contact: 'Contact', open: 'Open Gekta', language: 'Change language', home: 'Transparent Price — home' },
  zh: { nav: 'Gekta 导航', menu: '打开菜单', platform: '平台', trust: '信任', contact: '联系', open: '打开 Gekta', language: '切换语言', home: '透明价格 — 返回首页' },
};
const PUBLIC_CHROME = `.pc-gekta-public-header{min-height:64px}[data-gekta-experience='discovery']:has([role='dialog'][aria-modal='true'])>.pc-gekta-public-header{visibility:hidden}.pc-gekta-public-header a:focus-visible{outline:3px solid #087a3b;outline-offset:3px}`;

export function GektaProductShell({ locale }: { locale: GektaLocale }) {
  const copy = PUBLIC_COPY[locale];
  const paths = GEKTA_PATHS;
  const next = locale === 'ru' ? 'en' : locale === 'en' ? 'zh' : 'ru';
  const suffix = `?lang=${locale}`;
  const nav = <><Link href={`/platform-v7${suffix}`}>{copy.platform}</Link><Link href={`/platform-v7/trust${suffix}`}>{copy.trust}</Link><Link href={`/platform-v7/contact${suffix}`}>{copy.contact}</Link></>;
  const publicHeader = <PublicSiteHeader ariaLabel={copy.nav} brandHomeLabel={copy.home} brandHomeHref={`/platform-v7${suffix}`} navLabel={copy.nav} menuLabel={copy.menu} nav={nav} localeControl={<Link className='pc-site-locale-switch' href={paths[next]} aria-label={copy.language}>{locale.toUpperCase()}</Link>} actions={<a className='pc-v6-header-cta' href={`${paths[locale]}?chat=new`}>{copy.open}</a>} />;
  return (
    <main className='min-h-screen overflow-x-clip bg-[#fcfbf7]'>
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: safeJsonLd(getGektaApplicationSchema(locale)) }} />
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: safeJsonLd(getGektaFaqSchema(locale)) }} />
      <style dangerouslySetInnerHTML={{ __html: mobileTouchContract }} />
      <style>{PUBLIC_CHROME}</style>
      <GektaViewportAuthority />
      <GektaExperienceFrame locale={locale} publicHeader={publicHeader} hero={<GektaHero locale={locale} />} discovery={<GektaDiscoverySections locale={locale} />} />
    </main>
  );
}
