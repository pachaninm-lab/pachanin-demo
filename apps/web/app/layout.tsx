import './globals.css';
import '@/styles/platform-v7-dark-role-fixes.css';
import '@/styles/platform-v7-public-load-hotfix.css';
import type { Metadata, Viewport } from 'next';
import { ReactNode } from 'react';
import { Inter, Manrope, JetBrains_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { FeatureFlagsDevPanel } from '@/components/platform-v7/FeatureFlagsDevPanel';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-manrope',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const SITE_TITLE = 'Процент-Агро | Прозрачная Цена — цифровой контур зерновой сделки';
const SITE_DESCRIPTION = 'Процент-Агро — публичный контур проекта «Прозрачная Цена»: зерновая сделка после согласования цены, логистика, приёмка, качество, документы, расчёты, спор и доказательства.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: '%s · Процент-Агро',
  },
  description: SITE_DESCRIPTION,
  applicationName: 'Процент-Агро',
  keywords: [
    'Процент-Агро',
    'процент агро',
    'процент-агро.рф',
    'Прозрачная Цена',
    'зерновая сделка',
    'цифровой контур зерновой сделки',
    'агротрейд',
    'логистика зерна',
    'безопасная сделка зерно',
    'расчёты по зерновой сделке',
    'СДИЗ',
    'фгис зерно',
  ],
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    siteName: 'Процент-Агро',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0E6E60',
};

const themeScript = `(function(){try{var t=localStorage.getItem('pc-theme');if(t==='dark'||t==='light'||t==='high-contrast'){document.documentElement.setAttribute('data-theme',t);}else{document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`;

const HTML_LANG: Record<string, string> = { ru: 'ru', en: 'en', zh: 'zh-CN' };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={HTML_LANG[locale] ?? 'ru'} className={`${inter.variable} ${manrope.variable} ${jetbrainsMono.variable}`}>
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
        <FeatureFlagsDevPanel />
      </body>
    </html>
  );
}
