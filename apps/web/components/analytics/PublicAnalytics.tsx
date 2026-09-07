'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import {
  PUBLIC_PRODUCT_ANALYTICS_DOM_EVENTS,
  SESSION_REPLAY_ENABLED,
  analyticsAllowedForPath,
  isEphemeralPublicAnalyticsId,
  posthogPublicAnalyticsAllowedForPath,
  sanitizePublicProductAnalyticsDetail,
  type PublicProductAnalyticsCaptureInput,
} from '../../lib/analytics/analytics-boundary';

const PUBLIC_ANALYTICS_SESSION_KEY = 'pc-public-analytics-tab-v1';
const MAX_POSTHOG_EVENTS_PER_ROUTE = 120;

function viewportGroup(): 'mobile' | 'tablet' | 'desktop' {
  if (window.innerWidth < 720) return 'mobile';
  if (window.innerWidth < 1100) return 'tablet';
  return 'desktop';
}

function ephemeralTabId(): string | null {
  try {
    const stored = window.sessionStorage.getItem(PUBLIC_ANALYTICS_SESSION_KEY);
    if (isEphemeralPublicAnalyticsId(stored)) return stored;

    // Не user identity и не security token: только короткая метка вкладки до её закрытия.
    // Randomness здесь намеренно не используется, чтобы analytics ID нельзя было принять
    // за криптографический идентификатор или долговечный пользовательский профиль.
    const originPart = Math.floor(window.performance.timeOrigin).toString(36);
    const nowPart = Math.max(1, Math.floor(window.performance.now() * 1000)).toString(36);
    const candidate = `tab-${originPart}-${nowPart}`;
    if (!isEphemeralPublicAnalyticsId(candidate)) return null;
    window.sessionStorage.setItem(PUBLIC_ANALYTICS_SESSION_KEY, candidate);
    return candidate;
  } catch {
    return null;
  }
}

type PublicAnalyticsProps = {
  counterId?: string;
  locale: string;
  capturePublicProductAnalyticsAction?: (input: PublicProductAnalyticsCaptureInput) => Promise<void>;
};

/**
 * Аналитика, ограниченная публичной границей.
 *
 * Yandex остаётся на исторической public-only allowlist. PostHog получает
 * отдельную, ещё более явную server-authoritative границу: браузер отправляет
 * только очищенный event в наш Next.js Server Action и никогда не соединяется
 * с PostHog напрямую. Session replay, autocapture и долговечная user identity
 * здесь отсутствуют.
 */
export function PublicAnalytics({
  counterId,
  locale,
  capturePublicProductAnalyticsAction,
}: PublicAnalyticsProps): JSX.Element | null {
  const pathname = usePathname();

  useEffect(() => {
    if (!capturePublicProductAnalyticsAction || !posthogPublicAnalyticsAllowedForPath(pathname)) return;
    const distinctId = ephemeralTabId();
    if (!distinctId) return;

    const normalizedLocale = locale === 'en' || locale === 'zh' ? locale : 'ru';
    let sent = 0;

    const capture = (detail: unknown) => {
      if (sent >= MAX_POSTHOG_EVENTS_PER_ROUTE) return;
      const source = typeof detail === 'object' && detail !== null && !Array.isArray(detail)
        ? detail as Record<string, unknown>
        : {};
      const enriched = {
        ...source,
        locale: source.locale === 'ru' || source.locale === 'en' || source.locale === 'zh'
          ? source.locale
          : normalizedLocale,
        viewport_group: source.viewport_group === 'mobile'
          || source.viewport_group === 'tablet'
          || source.viewport_group === 'desktop'
          ? source.viewport_group
          : viewportGroup(),
      };
      const sanitized = sanitizePublicProductAnalyticsDetail(enriched);
      if (!sanitized) return;
      sent += 1;
      void capturePublicProductAnalyticsAction({
        distinctId,
        name: sanitized.name,
        properties: sanitized.properties,
      }).catch(() => undefined);
    };

    const receive = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      capture(event.detail);
    };

    for (const eventName of PUBLIC_PRODUCT_ANALYTICS_DOM_EVENTS) {
      window.addEventListener(eventName, receive);
    }
    capture({ name: 'public_page_view', source: 'public_analytics_bridge' });

    return () => {
      for (const eventName of PUBLIC_PRODUCT_ANALYTICS_DOM_EVENTS) {
        window.removeEventListener(eventName, receive);
      }
    };
  }, [capturePublicProductAnalyticsAction, locale, pathname]);

  // Hooks выше работают независимо от Yandex: exact /platform-v7 разрешён для
  // PostHog, но по-прежнему запрещён исторической Yandex boundary.
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
