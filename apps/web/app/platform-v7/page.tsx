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
  gap: 28px;
  padding-top: 42px;
  padding-bottom: 54px;
}
.pc-v6-hero-copy {
  min-width: 0;
  text-rendering: auto;
}
.pc-v6-hero .pc-v6-kicker {
  max-width: 48ch;
  margin-bottom: 12px;
  color: var(--pc-v6-green);
  font-size: 14px;
  font-weight: 680;
  line-height: 1.38;
  letter-spacing: 0;
  text-transform: none;
}
.pc-v6-hero h1.pc-v6-hero-title {
  max-width: 15ch;
  margin: 0;
  color: var(--pc-v6-ink);
  font-family: var(--pc-v6-font-display);
  font-size: clamp(38px, 9.4vw, 42px);
  font-weight: 710;
  line-height: 1.035;
  letter-spacing: -0.041em;
  text-wrap: balance;
}
.pc-v6-hero-brand {
  display: inline;
  color: var(--pc-v6-green);
  font-size: 0.62em;
  font-weight: 700;
  line-height: 1.12;
  letter-spacing: -0.026em;
}
.pc-v6-hero-brand::after {
  content: '';
  display: block;
  height: 8px;
}
.pc-v6-hero-title-line { display: inline; }
.pc-v6-hero-copy > p.pc-v6-hero-lead {
  max-width: 60ch;
  margin: 18px 0 0;
  color: var(--pc-v6-muted);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
  font-size: 17px;
  font-weight: 400;
  line-height: 1.54;
  letter-spacing: -0.006em;
  text-wrap: wrap;
}
.pc-v6-hero-proofs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-top: 18px;
}
.pc-v6-hero-proofs span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #3f5148;
  font-size: 13px;
  font-weight: 560;
  line-height: 1.35;
}
.pc-v6-hero-proofs svg { flex: 0 0 auto; color: var(--pc-v6-green); }
html[data-p7-language='zh'] * {
  letter-spacing: 0 !important;
  word-break: keep-all;
  overflow-wrap: anywhere;
}
html[data-p7-language='zh'] h1,
html[data-p7-language='zh'] h2,
html[data-p7-language='zh'] h3 { line-height: 1.14; }
@supports (content-visibility: auto) {
  .pc-v6-category,
  .pc-v6-crops,
  .pc-v6-integrations,
  .pc-v6-assurance,
  .pc-v6-faq,
  .pc-v6-final {
    content-visibility: auto;
    contain-intrinsic-size: auto 680px;
  }
}
@media (max-width: 374px) {
  .pc-v6-hero { gap: 22px; padding-top: 32px; padding-bottom: 44px; }
  .pc-v6-hero .pc-v6-kicker { margin-bottom: 10px; font-size: 13px; }
  .pc-v6-hero h1.pc-v6-hero-title { max-width: none; font-size: 34px; font-weight: 700; line-height: 1.045; letter-spacing: -0.036em; text-wrap: wrap; }
  .pc-v6-hero-brand { font-size: 0.6em; }
  .pc-v6-hero-brand::after { height: 7px; }
  .pc-v6-hero-copy > p.pc-v6-hero-lead { margin-top: 15px; font-size: 16px; line-height: 1.5; }
  .pc-v6-hero-proofs { display: grid; gap: 7px; margin-top: 15px; }
}
@media (min-width: 375px) and (max-width: 767px) {
  .pc-v6-hero { gap: 24px; padding-top: 34px; padding-bottom: 46px; }
  .pc-v6-hero h1.pc-v6-hero-title { max-width: 15ch; font-size: clamp(35px, 9.2vw, 37px); font-weight: 700; line-height: 1.04; letter-spacing: -0.037em; text-wrap: wrap; }
  .pc-v6-hero-copy > p.pc-v6-hero-lead { margin-top: 16px; font-size: 16px; line-height: 1.5; }
}
@media (min-width: 768px) and (max-width: 1023px) {
  .pc-v6-hero { grid-template-columns: minmax(0, 1fr); gap: 38px; padding-top: 64px; padding-bottom: 74px; }
  .pc-v6-hero-copy { max-width: 760px; }
  .pc-v6-hero h1.pc-v6-hero-title { max-width: 16ch; font-size: clamp(46px, 6.3vw, 54px); line-height: 1.025; }
  .pc-v6-hero-copy > p.pc-v6-hero-lead { margin-top: 21px; font-size: 18px; line-height: 1.54; }
  .pc-v6-control-tower { max-width: 760px; }
}
@media (min-width: 1024px) {
  .pc-v6-hero {
    grid-template-columns: minmax(0, 1.03fr) minmax(410px, .97fr);
    align-items: center;
    gap: 52px;
    min-height: min(760px, calc(100dvh - 64px));
    padding-top: 72px;
    padding-bottom: 82px;
  }
  .pc-v6-hero h1.pc-v6-hero-title { max-width: 16ch; font-size: clamp(50px, 4.65vw, 59px); line-height: 1.018; }
  .pc-v6-hero-copy > p.pc-v6-hero-lead { margin-top: 22px; font-size: 18px; line-height: 1.54; }
}
@media (min-width: 1280px) {
  .pc-v6-hero { grid-template-columns: minmax(0, 1.07fr) minmax(440px, .93fr); gap: 68px; padding-top: 82px; padding-bottom: 92px; }
  .pc-v6-hero h1.pc-v6-hero-title { max-width: 16ch; font-size: 61px; }
  .pc-v6-hero-copy > p.pc-v6-hero-lead { max-width: 58ch; font-size: 19px; }
}
:lang(zh) .pc-v6-hero h1.pc-v6-hero-title { max-width: 11em; letter-spacing: -0.015em; }
:lang(zh) .pc-v6-hero-brand { letter-spacing: 0; }
`;

export const metadata: Metadata = {
  title: 'Прозрачная Цена — контроль исполнения агросделки от цены до расчёта',
  description: 'Единый цифровой контур Сделки: товар, участники, торги, логистика, приёмка, качество, документы, деньги, спор, доказательства и закрытие.',
  keywords: [
    'цифровая инфраструктура агросделки',
    'исполнение внебиржевой сделки в АПК',
    'контроль агросделки после цены',
    'логистика и приёмка сельхозпродукции',
    'качество документы расчёты спор доказательства',
    'TAI Transparent Agro Intelligence',
  ],
  alternates: {
    canonical: '/platform-v7',
    languages: {
      ru: '/platform-v7?lang=ru',
      en: '/platform-v7?lang=en',
      zh: '/platform-v7?lang=zh',
      'x-default': '/platform-v7',
    },
  },
  openGraph: {
    type: 'website',
    title: 'Прозрачная Цена — контроль исполнения Сделки',
    description: 'Одна Сделка связывает товар, участников, логистику, качество, документы и деньги до расчёта и закрытия. TAI объясняет блокеры, риски и следующий шаг.',
    url: '/platform-v7',
    siteName: 'Прозрачная Цена',
    locale: 'ru_RU',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Прозрачная Цена — контроль исполнения Сделки',
    description: 'Единая цифровая инфраструктура агросделки с TAI: от цены до расчёта, доказательств и закрытия.',
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

export default function PlatformV7RootPage() {
  return <><style>{CRITICAL_HOME_CSS}</style><PlatformV7StrategicHome /></>;
}
