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
.pc-v6-hero h1.pc-v6-hero-title {
  max-width: 13ch;
  margin: 0;
  color: var(--pc-v6-ink);
  font-family: var(--pc-v6-font-display);
  font-size: clamp(48px, 5vw, 64px);
  font-weight: 730;
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
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
  font-size: 18px;
  font-weight: 400;
  line-height: 1.5;
  letter-spacing: -.006em;
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
    max-width: 34ch;
    margin-bottom: 9px;
    font-size: 12.5px;
    line-height: 1.3;
  }
  .pc-v6-hero h1.pc-v6-hero-title {
    max-width: 100%;
    font-size: clamp(33px, 8.7vw, 36px);
    line-height: 1;
    letter-spacing: -.04em;
  }
  .pc-v6-hero-title-accent {
    margin-top: 5px;
  }
  .pc-v6-hero-copy > p.pc-v6-hero-lead {
    max-width: 42ch;
    margin-top: 12px;
    font-size: 14.5px;
    line-height: 1.38;
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
