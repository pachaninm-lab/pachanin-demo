import './globals.css';
import '@/styles/platform-v7-dark-role-fixes.css';
import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { ReactNode } from 'react';
import Script from 'next/script';
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
  variable: '--font-jetbrains-mono',
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

const YM_ID = process.env.NEXT_PUBLIC_YM_ID;
const HTML_LANG: Record<string, string> = { ru: 'ru', en: 'en', zh: 'zh-CN' };
const PUBLIC_PLATFORM_PATHS = new Set([
  '/platform-v7',
  '/platform-v7/open',
  '/platform-v7/login',
  '/platform-v7/forgot-password',
  '/platform-v7/register',
  '/platform-v7/help',
  '/platform-v7/pricing',
  '/platform-v7/roadmap',
  '/platform-v7/deal-flow',
  '/platform-v7/demo',
  '/platform-v7/contact',
  '/platform-v7/request',
  '/platform-v7/docs',
]);

function normalizePath(value: string | null) {
  return (value || '').split('?')[0].replace(/\/$/, '') || '/';
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const allMessages = await getMessages() as Record<string, unknown>;
  const requestHeaders = headers();
  const pathname = normalizePath(requestHeaders.get('x-pc-pathname'));
  const isPublicPlatformPath = PUBLIC_PLATFORM_PATHS.has(pathname);
  const messages = isPublicPlatformPath
    ? { publicEntry: allMessages.publicEntry }
    : allMessages;
  const showDevPanel = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

  return (
    <html
      lang={HTML_LANG[locale] ?? 'ru'}
      translate='no'
      suppressHydrationWarning
      className={`notranslate ${inter.variable} ${manrope.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <meta name='google' content='notranslate' />
        <meta name='googlebot' content='notranslate' />
        <meta httpEquiv='Content-Language' content={HTML_LANG[locale] ?? 'ru'} />
      </head>
      <body translate='no' className='notranslate'>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
        {showDevPanel ? <FeatureFlagsDevPanel /> : null}
        {YM_ID ? (
          <>
            <Script id='yandex-metrika' strategy='afterInteractive'>{`
              (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
              m[i].l=1*new Date();
              for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
              k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
              (window,document,'script','https://mc.yandex.ru/metrika/tag.js','ym');
              ym(${YM_ID},'init',{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});
            `}</Script>
            <noscript>
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://mc.yandex.ru/watch/${YM_ID}`} style={{ position: 'absolute', left: -9999 }} alt='' />
              </div>
            </noscript>
          </>
        ) : null}
      </body>
    </html>
  );
}
