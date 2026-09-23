import {
  publicCrop, publicLotReference, publicMarketReturn,
  type PublicMarketLocale,
} from './public-market-navigation';

const REGISTER_PATH = '/platform-v7/register';
const INTENTS = new Set(['sell', 'buy', 'execution', 'finance', 'employee']);

function publicContextQuery(rawSearch: string, locale: PublicMarketLocale): URLSearchParams {
  const source = new URLSearchParams(rawSearch);
  const single = (name: string) => {
    const values = source.getAll(name);
    return values.length === 1 ? values[0] : null;
  };
  const safeLocale: PublicMarketLocale = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const query = new URLSearchParams({ lang: safeLocale });
  const intent = single('intent');
  if (intent && INTENTS.has(intent)) query.set('intent', intent);
  const crop = publicCrop(single('crop'));
  if (crop) query.set('crop', crop);
  const lot = publicLotReference(single('lot'));
  if (lot) query.set('lot', lot);
  const returnTo = publicMarketReturn(single('returnTo'), safeLocale);
  if (returnTo) query.set('returnTo', returnTo);
  return query;
}

/** Only public, bounded navigation hints can travel through registration mail. */
export function publicRegistrationContextSearch(rawSearch: string, locale: PublicMarketLocale): string {
  return publicContextQuery(rawSearch, locale).toString();
}

export function registrationContextEndpoint(
  action: 'register' | 'resend', rawSearch: string, locale: PublicMarketLocale,
): string {
  const path = action === 'register' ? '/api/auth/register' : '/api/auth/registration/resend';
  return `${path}?${publicRegistrationContextSearch(rawSearch, locale)}`;
}

export function appendPublicRegistrationContext(
  url: URL, rawSearch: string, locale: PublicMarketLocale,
): void {
  publicContextQuery(rawSearch, locale).forEach((value, key) => url.searchParams.set(key, value));
}

/** Keep navigation hints after email verification without carrying its spent secret. */
export function verifiedRegistrationContinuationHref(
  rawSearch: string,
  statusToken: string,
  locale: PublicMarketLocale,
): string {
  if (!statusToken || statusToken.length > 512 || /[\u0000-\u001f\u007f]/u.test(statusToken)) {
    throw new TypeError('Invalid registration status token');
  }
  const query = publicContextQuery(rawSearch, locale);
  query.set('statusToken', statusToken);
  return `${REGISTER_PATH}?${query.toString()}`;
}
