import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isAppLocale } from './locale';

// Локаль без i18n-роутинга: сервер читает cookie и рендерит публичный контур
// сразу на выбранном языке. Немигрированные экраны добирает клиентский
// словарный рантайм (lib/platform-v7/i18n/translation-runtime.ts).
export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get(LOCALE_COOKIE)?.value;
  const locale = isAppLocale(raw) ? raw : DEFAULT_LOCALE;
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
