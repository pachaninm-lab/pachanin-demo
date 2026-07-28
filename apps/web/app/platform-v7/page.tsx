import '@/styles/platform-v7-strategic-home-v3.css';
import type { Metadata } from 'next';
import { PlatformV7StrategicHome } from '@/components/platform-v7/PlatformV7StrategicHome';

const CRITICAL_HOME_CSS = `
.pc-v7-public-entry {
  --pc-entry-font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
  --pc-entry-font-display: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
  --pc-v6-green: #087a3b;
  --pc-v6-green-dark: #07572e;
  --pc-v6-ink: #102019;
  --pc-v6-muted: #526159;
  --pc-v6-line: #d7e1db;
  --pc-v6-line-strong: #bfd0c6;
  --pc-v6-bg: #f5f8f6;
  --pc-v6-bg-strong: #edf5f0;
  --pc-v6-warn: #8a5400;
  --pc-v6-error: #a43132;
  --pc-v6-font-body: var(--pc-entry-font-body);
  --pc-v6-font-display: var(--pc-entry-font-display);
  --entry-public-header-offset: env(safe-area-inset-top, 0px);
  --entry-public-header-base: 64px;
  --entry-header-height: calc(var(--entry-public-header-base) + var(--entry-public-header-offset));
  min-height: 100dvh !important;
  padding-top: var(--entry-header-height) !important;
  background: #ffffff;
  color: var(--pc-v6-ink);
  font-family: var(--pc-entry-font-body);
  text-rendering: auto;
  -webkit-font-smoothing: antialiased;
}
.pc-v7-public-entry .pc-site-header {
  top: var(--entry-public-header-offset) !important;
  height: var(--entry-public-header-base) !important;
  min-height: var(--entry-public-header-base) !important;
  max-height: var(--entry-public-header-base) !important;
}
.pc-v6-hero {
  display: grid;
  align-items: center;
  gap: 42px;
  padding-top: 58px;
  padding-bottom: 42px;
}
.pc-v6-hero-copy {
  min-width: 0;
  max-width: 650px;
  text-rendering: auto;
}
.pc-v6-hero .pc-v6-kicker {
  max-width: 42ch;
  margin-bottom: 12px;
  color: var(--pc-v6-green);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: 0;
  text-transform: none;
}
html:lang(ru) .pc-v6-hero .pc-v6-kicker,
html[lang^='ru'] .pc-v6-hero .pc-v6-kicker,
html[data-p7-language='ru'] .pc-v6-hero .pc-v6-kicker {
  display: block;
  max-width: none;
  font-size: 0;
  line-height: 1;
  letter-spacing: 0;
  white-space: normal;
}
html:lang(ru) .pc-v6-hero .pc-v6-kicker::before,
html:lang(ru) .pc-v6-hero .pc-v6-kicker::after,
html[lang^='ru'] .pc-v6-hero .pc-v6-kicker::before,
html[lang^='ru'] .pc-v6-hero .pc-v6-kicker::after,
html[data-p7-language='ru'] .pc-v6-hero .pc-v6-kicker::before,
html[data-p7-language='ru'] .pc-v6-hero .pc-v6-kicker::after {
  display: block;
  color: var(--pc-v6-green);
}
html:lang(ru) .pc-v6-hero .pc-v6-kicker::before,
html[lang^='ru'] .pc-v6-hero .pc-v6-kicker::before,
html[data-p7-language='ru'] .pc-v6-hero .pc-v6-kicker::before {
  content: 'Платформа управления агросделками в растениеводстве';
  font-size: 13px;
  font-weight: 600;
  line-height: 1.25;
}
html:lang(ru) .pc-v6-hero .pc-v6-kicker::after,
html[lang^='ru'] .pc-v6-hero .pc-v6-kicker::after,
html[data-p7-language='ru'] .pc-v6-hero .pc-v6-kicker::after {
  content: 'с собственным искусственным интеллектом';
  margin-top: 3px;
  font-size: 17px;
  font-weight: 900;
  line-height: 1.16;
  letter-spacing: -.014em;
}
.pc-v6-hero h1.pc-v6-hero-title {
  max-width: 13ch;
  margin: 0;
  color: var(--pc-v6-ink);
  font-family: Arial, sans-serif;
  font-size: clamp(48px, 5vw, 64px);
  font-weight: 700;
  line-height: .98;
  letter-spacing: -.048em;
  text-wrap: balance;
}
.pc-v6-hero-title-main,
.pc-v6-hero-title-accent {
  display: block;
}
.pc-v6-hero-title-accent {
  margin-top: 8px;
  color: var(--pc-v6-green);
}
.pc-v6-hero-copy > p.pc-v6-hero-lead {
  max-width: 54ch;
  margin: 18px 0 0;
  color: var(--pc-v6-muted);
  font-family: Arial, sans-serif;
  font-size: 18px;
  font-weight: 400;
  line-height: 1.5;
  letter-spacing: -.006em;
}
.pc-v6-control-tower-unified {
  align-self: start;
  overflow: hidden;
}
.pc-v6-control-tower {
  align-self: start !important;
}
.pc-v6-tower-intelligence {
  display: grid !important;
  grid-template-columns: auto minmax(0, 1fr) 44px;
  align-items: center;
  gap: 10px !important;
  padding: 13px 14px 13px 18px !important;
  border-top: 1px solid #d3e3da !important;
  background: linear-gradient(90deg, #eaf7ef 0%, #f7fbf8 100%) !important;
}
.pc-v6-tower-intelligence > svg { color: var(--pc-v6-green); }
.pc-v6-tower-intelligence strong {
  display: block;
  color: #07572e;
  font-size: 14px;
  line-height: 1.3;
}
.pc-v6-tower-intelligence span {
  display: block;
  margin-top: 3px;
  color: #42584d;
  font-size: 12.5px;
  line-height: 1.42;
}
.pc-v6-tower-intelligence-link {
  width: 44px;
  height: 44px;
  display: inline-grid;
  place-items: center;
  border: 1px solid #c4dccd;
  border-radius: 12px;
  background: #fff;
  color: #07572e;
  text-decoration: none;
}
.pc-v6-tower-intelligence-link:focus-visible {
  outline: 3px solid rgba(8, 122, 59, .25);
  outline-offset: 2px;
}
.pc-v6-trust-after-lifecycle {
  margin-top: 0 !important;
  margin-bottom: 10px !important;
}
html[data-p7-language='zh'] * {
  letter-spacing: 0 !important;
  word-break: keep-all;
  overflow-wrap: anywhere;
}
html[data-p7-language='zh'] h1,
html[data-p7-language='zh'] h2,
html[data-p7-language='zh'] h3 { line-height: 1.14; }
@supports (content-visibility: auto) {
  .pc-v7-public-entry #participants,
  .pc-v7-public-entry #role-entry,
  .pc-v7-public-entry .pc-v6-category,
  .pc-v7-public-entry #deal-path,
  .pc-v7-public-entry #tai,
  .pc-v7-public-entry #money,
  .pc-v7-public-entry #integrations,
  .pc-v7-public-entry .pc-v6-crops,
  .pc-v7-public-entry #maturity,
  .pc-v7-public-entry #connect-organization,
  .pc-v7-public-entry .pc-v6-faq,
  .pc-v7-public-entry .pc-v6-final {
    content-visibility: visible !important;
    contain: none !important;
    contain-intrinsic-size: none !important;
  }
}
@media (max-width: 767px) {
  .pc-v7-public-entry {
    --entry-public-header-base: 48px;
    --entry-header-height: calc(var(--entry-public-header-base) + var(--entry-public-header-offset));
  }
  .pc-v6-hero {
    gap: 14px;
    padding-top: 18px;
    padding-bottom: 24px;
  }
  .pc-v6-hero .pc-v6-kicker {
    width: 100%;
    max-width: none;
    margin-bottom: 9px;
    font-size: 12.5px;
    line-height: 1.3;
    text-wrap: balance;
  }
  html:lang(ru) .pc-v6-hero .pc-v6-kicker,
  html[lang^='ru'] .pc-v6-hero .pc-v6-kicker,
  html[data-p7-language='ru'] .pc-v6-hero .pc-v6-kicker {
    font-size: 0;
    line-height: 1;
    white-space: normal;
  }
  html:lang(ru) .pc-v6-hero .pc-v6-kicker::before,
  html[lang^='ru'] .pc-v6-hero .pc-v6-kicker::before,
  html[data-p7-language='ru'] .pc-v6-hero .pc-v6-kicker::before {
    font-size: clamp(10px, 2.95vw, 12px);
    font-weight: 600;
    line-height: 1.2;
    letter-spacing: -.007em;
    white-space: nowrap;
  }
  html:lang(ru) .pc-v6-hero .pc-v6-kicker::after,
  html[lang^='ru'] .pc-v6-hero .pc-v6-kicker::after,
  html[data-p7-language='ru'] .pc-v6-hero .pc-v6-kicker::after {
    margin-top: 4px;
    font-size: clamp(14.5px, 4vw, 17px);
    font-weight: 900;
    line-height: 1.12;
    letter-spacing: -.02em;
    white-space: nowrap;
  }
  .pc-v6-hero h1.pc-v6-hero-title {
    max-width: 100%;
    font-size: clamp(33px, 8.7vw, 36px);
    line-height: 1;
    letter-spacing: -.04em;
  }
  .pc-v6-hero-title-accent { margin-top: 5px; }
  .pc-v6-hero-copy > p.pc-v6-hero-lead {
    max-width: 42ch;
    margin-top: 12px;
    font-size: 14.5px;
    line-height: 1.38;
  }
  .pc-v6-tower-intelligence {
    grid-template-columns: auto minmax(0, 1fr) 44px;
    gap: 8px !important;
    padding: 10px 10px 10px 12px !important;
  }
  .pc-v6-tower-intelligence strong { font-size: 12.5px; }
  .pc-v6-tower-intelligence span {
    display: -webkit-box;
    overflow: hidden;
    font-size: 11.5px;
    line-height: 1.35;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }
  .pc-v6-tower-intelligence-link { border-radius: 10px; }
  .pc-v6-trust-after-lifecycle {
    display: flex !important;
    gap: 10px !important;
    overflow-x: auto;
    margin: 0 -12px !important;
    padding: 2px 12px 12px;
    border: 0 !important;
    border-radius: 0 !important;
    background: transparent !important;
    scroll-snap-type: x mandatory;
    overscroll-behavior-inline: contain;
    scrollbar-width: none;
  }
  .pc-v6-trust-after-lifecycle::-webkit-scrollbar { display: none; }
  .pc-v6-trust-after-lifecycle article {
    flex: 0 0 min(78vw, 296px);
    min-height: 112px;
    scroll-snap-align: start;
    padding: 15px !important;
    border: 1px solid var(--pc-v6-line) !important;
    border-radius: 14px;
    background: #fff;
  }
}
@media (max-width: 359px) {
  .pc-v6-hero h1.pc-v6-hero-title { font-size: 31px; }
}
@media (min-width: 768px) {
  .pc-v6-hero { grid-template-columns: minmax(0, 1.02fr) minmax(380px, .98fr); }
}
:lang(zh) .pc-v6-hero h1.pc-v6-hero-title { max-width: 11em; letter-spacing: -.015em; }
:lang(zh) .pc-v6-hero-title-accent { letter-spacing: 0; }
`;

export const metadata: Metadata = {
  title: 'Прозрачная Цена — контроль исполнения агросделки от цены до расчёта',
  description: 'Товар, логистика, качество, документы, деньги, спор и доказательства связаны в одной Сделке. TAI объясняет блокеры, риски и следующий шаг.',
  alternates: {
    canonical: '/platform-v7',
    languages: {
      ru: '/platform-v7?lang=ru',
      en: '/platform-v7?lang=en',
      zh: '/platform-v7?lang=zh',
    },
  },
  openGraph: {
    type: 'website',
    title: 'Прозрачная Цена — контроль исполнения агросделки',
    description: 'Торги, логистика, качество, документы и деньги связаны в одной Сделке. TAI показывает основание и следующий шаг.',
    url: '/platform-v7',
    siteName: 'Прозрачная Цена',
    locale: 'ru_RU',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Прозрачная Цена — контроль исполнения Сделки',
    description: 'Единая цифровая инфраструктура агросделки и отдельный операционный AI-продукт TAI.',
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

export default async function PlatformV7RootPage() {
  const home = await PlatformV7StrategicHome();
  return <><style>{CRITICAL_HOME_CSS}</style>{home}</>;
}
