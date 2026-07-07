import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isAppLocale } from './locale';

export default getRequestConfig(async () => {
  let locale = DEFAULT_LOCALE;

  try {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
    if (isAppLocale(cookieLocale)) locale = cookieLocale;
  } catch {
    locale = DEFAULT_LOCALE;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
