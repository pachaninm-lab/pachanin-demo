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
  background: #fff;
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
.pc-v7-public-entry [data-testid='platform-v7-presentation-download'] {
  border-color: transparent !important;
  background: transparent !important;
  color: var(--pc-v6-muted) !important;
  box-shadow: none !important;
  padding-inline: 8px !important;
  font-weight: 600 !important;
}
.pc-v7-public-entry [data-testid='platform-v7-presentation-download']:hover,
.pc-v7-public-entry [data-testid='platform-v7-presentation-download']:focus-visible {
  border-color: var(--pc-v6-line) !important;
  background: var(--pc-v6-bg) !important;
  color: var(--pc-v6-ink) !important;
}
.pc-v7-public-entry [data-comparison-row='true'] > span:first-of-type {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.pc-v7-public-entry [data-comparison-row='true'] > span:first-of-type::before {
  content: '×';
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  display: inline-grid;
  place-items: center;
  margin-top: 1px;
  border: 2px solid #d92d2d;
  border-radius: 999px;
  color: #d92d2d;
  font-size: 18px;
  font-weight: 800;
  line-height: 1;
}
.pc-v7-public-entry .pc-public-deal-stage-rail--hero > span:nth-child(n + 6) > small {
  color: #56655d !important;
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
}
.pc-v6-hero .pc-v6-kicker {
  display: block;
  max-width: 44ch;
  margin-bottom: 12px;
  color: var(--pc-v6-green);
  font-size: 14px;
  font-weight: 750;
  line-height: 1.35;
  letter-spacing: 0;
  text-transform: none;
  white-space: pre-line;
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
.pc-v6-hero-title-accent { display: block; }
.pc-v6-hero-title-accent {
  margin-top: 8px;
  color: var(--pc-v6-green);
}
.pc-v6-hero-copy > p.pc-v6-hero-lead {
  max-width: 58ch;
  margin: 18px 0 0;
  color: var(--pc-v6-muted);
  font-family: Arial, sans-serif;
  font-size: 18px;
  font-weight: 400;
  line-height: 1.5;
  letter-spacing: -.006em;
}
.pc-v6-control-tower { align-self: start !important; }
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
  .pc-v7-public-entry #deal-path,
  .pc-v7-public-entry #live,
  .pc-v7-public-entry #tai,
  .pc-v7-public-entry #money,
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
  .pc-v7-public-entry [data-comparison-row='true'] > span:first-of-type::before {
    width: 18px;
    height: 18px;
    font-size: 16px;
  }
  .pc-v6-hero {
    gap: 16px;
    padding-top: 20px;
    padding-bottom: 26px;
  }
  .pc-v6-hero .pc-v6-kicker {
    width: 100%;
    max-width: 36ch;
    margin-bottom: 9px;
    font-size: clamp(12px, 3.45vw, 14px);
    line-height: 1.3;
    white-space: pre-line;
    text-wrap: balance;
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
    font-size: 15px;
    line-height: 1.42;
  }
}
@media (max-width: 430px) {
  .pc-v7-public-entry {
    --entry-public-header-base: 100px !important;
    --pc-public-header-base-height: 100px !important;
    --pc-public-header-total-height: calc(100px + var(--entry-public-header-offset)) !important;
    --entry-header-height: calc(var(--entry-public-header-base) + var(--entry-public-header-offset)) !important;
  }
  .pc-v7-public-entry[data-testid='platform-v7-root-execution-cockpit'] .pc-site-header {
    display: flex !important;
    flex-wrap: wrap !important;
    align-content: center !important;
    align-items: center !important;
    height: 100px !important;
    min-height: 100px !important;
    max-height: 100px !important;
    gap: 4px !important;
    padding-inline: 8px !important;
  }
  .pc-v7-public-entry[data-testid='platform-v7-root-execution-cockpit'] .pc-site-mobile-nav {
    top: calc(var(--entry-public-header-offset) + var(--entry-public-header-base) + 4px) !important;
    max-height: calc(100dvh - var(--entry-public-header-offset) - var(--entry-public-header-base) - 20px) !important;
  }
  [data-testid='platform-v7-root-execution-cockpit'] .pc-site-brand-mark {
    display: none !important;
  }
  .pc-v7-public-entry[data-testid='platform-v7-root-execution-cockpit'] .pc-site-brand {
    flex: 1 0 100% !important;
    width: 100% !important;
    min-width: 44px !important;
    min-height: 44px !important;
    gap: 0 !important;
    overflow: visible !important;
  }
  [data-testid='platform-v7-root-execution-cockpit'] .pc-site-brand-text {
    flex: 1 1 auto !important;
    min-width: 0 !important;
    overflow: visible !important;
  }
  .pc-v7-public-entry[data-testid='platform-v7-root-execution-cockpit'] .pc-site-brand-text strong {
    display: block !important;
    width: auto !important;
    max-width: none !important;
    min-width: 0 !important;
    overflow: visible !important;
    color: #071611 !important;
    font-size: 14px !important;
    line-height: 1.05 !important;
    letter-spacing: -.035em !important;
    white-space: nowrap !important;
    overflow-wrap: normal !important;
    word-break: normal !important;
    text-overflow: clip !important;
  }
  .pc-v7-public-entry[data-testid='platform-v7-root-execution-cockpit'] :is(
    .pc-site-brand,
    .pc-skip-link,
    .pc-site-mobile-menu > summary,
    .pc-site-locale-switch,
    .entry-login,
    .pc-v6-header-cta,
    label[for='difference-more-toggle'],
    label[for='phases-more-toggle'],
    label[for='functions-more-toggle']
  ) {
    min-width: 44px !important;
    min-height: 44px !important;
  }
  [data-testid='platform-v7-root-execution-cockpit'] .pc-site-actions {
    flex: 0 0 100% !important;
    width: 100% !important;
    min-width: 0 !important;
    justify-content: flex-end !important;
    gap: 4px !important;
  }
  [data-testid='platform-v7-root-execution-cockpit'] .pc-v6-header-actions {
    display: flex !important;
    flex: 0 1 auto !important;
    width: auto !important;
    min-width: 0 !important;
    align-items: center !important;
    justify-content: flex-end !important;
    gap: 4px !important;
  }
  [data-testid='platform-v7-root-execution-cockpit'] .pc-site-locale-switch {
    width: 44px !important;
    min-width: 44px !important;
    padding-inline: 4px !important;
  }
  [data-testid='platform-v7-root-execution-cockpit'] .pc-v6-header-cta {
    display: inline-flex !important;
    flex: 0 0 auto !important;
    width: auto !important;
    min-width: 44px !important;
    height: 44px !important;
    min-height: 44px !important;
    max-width: none !important;
    padding: 0 8px !important;
    overflow: visible !important;
    color: #fff !important;
    font-size: 11px !important;
    line-height: 1.05 !important;
    white-space: nowrap !important;
    text-align: center !important;
  }
  .pc-v7-public-entry[data-testid='platform-v7-root-execution-cockpit'] [data-testid='platform-v7-deal-card'] > div:first-child {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) !important;
    gap: 10px !important;
  }
  .pc-v7-public-entry[data-testid='platform-v7-root-execution-cockpit'] [data-testid='platform-v7-deal-card'] > div:first-child > div {
    min-width: 0 !important;
  }
  .pc-v7-public-entry[data-testid='platform-v7-root-execution-cockpit'] [data-testid='platform-v7-deal-card'] > div:first-child > b {
    justify-self: start !important;
    max-width: 100% !important;
    white-space: normal !important;
    text-align: left !important;
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
  title: 'Прозрачная Цена — единая система управления агросделкой',
  description: 'Условия, торги, поставка, качество, документы, расчёт и Гекта связаны в одной Сделке. Отклонения и споры подключаются только при необходимости.',
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
    title: 'Прозрачная Цена — единая система управления агросделкой',
    description: 'Одна агросделка от условий и выбора контрагента до поставки, качества, документов, расчёта и закрытия. Отклонение или спор — отдельная ветка, когда она действительно нужна.',
    url: '/platform-v7',
    siteName: 'Прозрачная Цена',
    locale: 'ru_RU',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Прозрачная Цена — управление агросделкой от цены до расчёта',
    description: 'Единая система управления агросделкой с аграрным интеллектом Гекта: от условий и поставки до документов, расчёта и закрытия.',
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
