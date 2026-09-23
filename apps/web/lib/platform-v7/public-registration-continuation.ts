import {
  publicCrop, publicLotReference, publicMarketReturn,
  type PublicMarketLocale,
} from './public-market-navigation';

const REGISTER_PATH = '/platform-v7/register';
const INTENTS = new Set(['sell', 'buy', 'execution', 'finance', 'employee']);

/** Keep navigation hints after email verification without carrying its spent secret. */
export function verifiedRegistrationContinuationHref(
  rawSearch: string,
  statusToken: string,
  locale: PublicMarketLocale,
): string {
  if (!statusToken || statusToken.length > 512 || /[\u0000-\u001f\u007f]/u.test(statusToken)) {
    throw new TypeError('Invalid registration status token');
  }
  const source = new URLSearchParams(rawSearch);
  const single = (name: string) => {
    const values = source.getAll(name);
    return values.length === 1 ? values[0] : null;
  };
  const safeLocale: PublicMarketLocale = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const query = new URLSearchParams({ lang: safeLocale, statusToken });
  const intent = single('intent');
  if (intent && INTENTS.has(intent)) query.set('intent', intent);
  const crop = publicCrop(single('crop'));
  if (crop) query.set('crop', crop);
  const lot = publicLotReference(single('lot'));
  if (lot) query.set('lot', lot);
  const returnTo = publicMarketReturn(single('returnTo'), safeLocale);
  if (returnTo) query.set('returnTo', returnTo);
  return `${REGISTER_PATH}?${query.toString()}`;
}
