import './globals.css';
import '../styles/platform-v7-spacing-system.css';
import './platform-v7/_styles/fixed-header-contract.css';
import './platform-v7/_styles/public-supporting-shell.css';
import './platform-v7/_styles/public-header-accessibility.css';
import type { Metadata, Viewport } from 'next';
import { ReactNode } from 'react';
import Script from 'next/script';
import { headers } from 'next/headers';
import { Inter, Manrope, JetBrains_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { FeatureFlagsDevPanel } from '@/components/platform-v7/FeatureFlagsDevPanel';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
  preload: false,
});

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-manrope',
  display: 'swap',
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  preload: false,
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
const LEAN_PUBLIC_ENTRY_PATHS = new Set([
  '/platform-v7',
  '/platform-v7/login',
  '/platform-v7/forgot-password',
  '/pc-public-entry/platform-v7',
  '/pc-public-entry/platform-v7/login',
  '/pc-public-entry/platform-v7/forgot-password',
]);
const serviceWorkerRecoveryScript = `(function(){var version='2026-07-19-contact-dock-v3';var parameter='pc-sw-recovery';var controlled=false;try{controlled=!!('serviceWorker'in navigator&&navigator.serviceWorker.controller);}catch(e){}var tasks=[];try{if('serviceWorker'in navigator){tasks.push(navigator.serviceWorker.getRegistrations().then(function(items){return Promise.all(items.map(function(item){return item.unregister();}));}));}}catch(e){}try{if('caches'in window){tasks.push(caches.keys().then(function(keys){return Promise.all(keys.map(function(key){return caches.delete(key);}));}}catch(e){}Promise.all(tasks).catch(function(){}).then(function(){try{var url=new URL(window.location.href);var recovered=url.searchParams.get(parameter)===version;if(controlled&&!recovered){url.searchParams.set(parameter,version);window.location.replace(url.toString());return;}if(recovered){url.searchParams.delete(parameter);window.history.replaceState(window.history.state,'',url.pathname+(url.search||'')+url.hash);}}catch(e){}});})();`;
const themeScript = `(function(){try{var t=localStorage.getItem('pc-theme');if(t==='dark'||t==='light'||t==='high-contrast'){document.documentElement.setAttribute('data-theme',t);}else{document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`;

function normalizePath(value: string | null) {
  return (value || '').split('?')[0].replace(/\/$/, '') || '/';
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const pathname = normalizePath((await headers()).get('x-pc-pathname'));
  const leanPublicEntry = LEAN_PUBLIC_ENTRY_PATHS.has(pathname)
    || pathname === '/platform-v7/staff'
    || pathname.startsWith('/platform-v7/staff/');
  const content = leanPublicEntry
    ? children
    : <NextIntlClientProvider locale={locale} messages={await getMessages()}>{children}</NextIntlClientProvider>;
  const showDevPanel = !leanPublicEntry && process.env.NEXT_PUBLIC_DEV_MODE === 'true';
  const fontVariables = leanPublicEntry ? '' : `${inter.variable} ${manrope.variable} ${jetbrainsMono.variable}`;

  return (
    <html
      lang={HTML_LANG[locale] ?? 'ru'}
      translate='no'
      data-theme='light'
      suppressHydrationWarning
      className={`notranslate${fontVariables ? ` ${fontVariables}` : ''}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: serviceWorkerRecoveryScript }} />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <meta name='google' content='notranslate' />
        <meta name='googlebot' content='notranslate' />
        <meta httpEquiv='Content-Language' content={HTML_LANG[locale] ?? 'ru'} />
      </head>
      <body translate='no' className='notranslate'>
        {content}
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
