import './globals.css';
import type { Viewport } from 'next';
import { ReactNode } from 'react';
import Script from 'next/script';

export const metadata = {
  title: 'Прозрачная Цена',
  description: 'Цифровой контур исполнения зерновой сделки',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

const YM_ID = process.env.NEXT_PUBLIC_YM_ID;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        {children}
        {YM_ID ? (
          <>
            <Script id="yandex-metrika" strategy="afterInteractive">{`
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
                <img src={`https://mc.yandex.ru/watch/${YM_ID}`} style={{ position: 'absolute', left: -9999 }} alt="" />
              </div>
            </noscript>
          </>
        ) : null}
      </body>
    </html>
  );
}
