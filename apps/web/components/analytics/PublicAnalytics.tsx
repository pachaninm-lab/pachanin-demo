'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { analyticsAllowedForPath, SESSION_REPLAY_ENABLED } from '../../lib/analytics/analytics-boundary';

/**
 * Аналитика, ограниченная публичной границей.
 *
 * Раньше сниппет стоял прямо в корневом layout, поэтому попадал в разметку
 * каждой страницы, включая кабинет: приватные разделы наследовали его просто
 * потому, что вложенные layout'ы не объявляют свой <html>. Теперь решение
 * принимается по текущему пути, и на запрещённом пути не рендерится ничего —
 * ни скрипта, ни noscript-пикселя.
 *
 * Пиксель вынесен из layout отдельно и по своей причине: это картинка, а не
 * скрипт, поэтому CSP её не останавливает. Пока он стоял в корневом layout,
 * клиент с отключённым JavaScript отправлял третьей стороне адрес страницы
 * кабинета.
 *
 * SESSION_REPLAY_ENABLED здесь не переменная настройки, а утверждение: запись
 * сессий не включается, пока не доказана безопасная граница.
 */
export function PublicAnalytics({ counterId }: { counterId?: string }): JSX.Element | null {
  const pathname = usePathname();

  if (!counterId || !/^\d+$/u.test(counterId)) return null;
  if (!analyticsAllowedForPath(pathname)) return null;

  const options = [
    'clickmap:true',
    'trackLinks:true',
    'accurateTrackBounce:true',
    `webvisor:${SESSION_REPLAY_ENABLED}`,
  ].join(',');

  return (
    <>
      <Script id='yandex-metrika' strategy='afterInteractive'>
        {`
              (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
              m[i].l=1*new Date();
              for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
              k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
              (window,document,'script','https://mc.yandex.ru/metrika/tag.js','ym');
              ym(${counterId},'init',{${options}});
            `}
      </Script>
      <noscript>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://mc.yandex.ru/watch/${counterId}`} style={{ position: 'absolute', left: -9999 }} alt='' />
        </div>
      </noscript>
    </>
  );
}
