import { headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE, isAppLocale } from './locale';
import { publicEntryMessages } from './public-entry-messages';

const LOCALE_HEADER = 'x-pc-locale';

export default getRequestConfig(async () => {
  let locale = DEFAULT_LOCALE;

  try {
    const headerStore = await headers();
    const headerLocale = headerStore.get(LOCALE_HEADER);
    if (isAppLocale(headerLocale)) locale = headerLocale;
  } catch {
    locale = DEFAULT_LOCALE;
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
