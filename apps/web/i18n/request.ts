import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isAppLocale } from './locale';
import { publicEntryMessages } from './public-entry-messages';

const LOCALE_HEADER = 'x-pc-locale';

export default getRequestConfig(async () => {
  let locale = DEFAULT_LOCALE;
  let headerLocaleResolved = false;

  try {
    const headerStore = await headers();
    const headerLocale = headerStore.get(LOCALE_HEADER);
    if (isAppLocale(headerLocale)) {
      locale = headerLocale;
      headerLocaleResolved = true;
    }
  } catch {
    locale = DEFAULT_LOCALE;
  }

  if (!headerLocaleResolved) {
    try {
      const cookieStore = await cookies();
      const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
      if (isAppLocale(cookieLocale)) locale = cookieLocale;
    } catch {
      locale = DEFAULT_LOCALE;
    }
  }

  const baseMessages = (await import(`../messages/${locale}.json`)).default;

  return {
    locale,
    messages: {
      ...baseMessages,
      publicEntry: publicEntryMessages[locale],
    },
  };
});
