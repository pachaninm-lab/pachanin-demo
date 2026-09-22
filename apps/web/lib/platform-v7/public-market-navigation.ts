/** Public presentation context only. Never a role, tenant or private object selector. */
export const PUBLIC_CROPS = ['wheat', 'barley', 'corn', 'sunflower', 'soybean', 'rapeseed', 'rye', 'oats'] as const;
export type PublicCrop = typeof PUBLIC_CROPS[number];
export type PublicMarketSort = '' | 'closing' | 'price-asc' | 'price-desc' | 'volume-desc';
export type PublicMarketLocale = 'ru' | 'en' | 'zh';
export type PublicMarketContext = Readonly<{ q: string; crop: PublicCrop | ''; region: string; grade: string; sort: PublicMarketSort }>;
export type PublicQuery = Readonly<Record<string, unknown>>;
export const PUBLIC_CROP_LABELS: Readonly<Record<PublicMarketLocale, Readonly<Record<PublicCrop, string>>>> = {
  ru: { wheat:'Пшеница', barley:'Ячмень', corn:'Кукуруза', sunflower:'Подсолнечник', soybean:'Соя', rapeseed:'Рапс', rye:'Рожь', oats:'Овёс' },
  en: { wheat:'Wheat', barley:'Barley', corn:'Corn', sunflower:'Sunflower', soybean:'Soybean', rapeseed:'Rapeseed', rye:'Rye', oats:'Oats' },
  zh: { wheat:'小麦', barley:'大麦', corn:'玉米', sunflower:'向日葵', soybean:'大豆', rapeseed:'油菜籽', rye:'黑麦', oats:'燕麦' },
};
const MARKET_PATH = '/platform-v7/market';
const ORIGIN = 'https://public-context.invalid';
const PUBLIC_REF = /^market-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function text(value: unknown, limit: number): string {
  return typeof value === 'string' && value.length <= limit && !/[\u0000-\u001f\u007f]/u.test(value) ? value.trim() : '';
}
function localeOf(value: unknown): PublicMarketLocale { return value === 'en' || value === 'zh' ? value : 'ru'; }
export function publicCrop(value: unknown): PublicCrop | '' {
  return typeof value === 'string' && PUBLIC_CROPS.some((crop) => crop === value) ? value as PublicCrop : '';
}
export function publicLotReference(value: unknown): string | null {
  return typeof value === 'string' && value.length === 43 && PUBLIC_REF.test(value) ? value.toLowerCase() : null;
}
export function publicMarketSort(value: unknown): PublicMarketSort {
  return value === 'closing' || value === 'price-asc' || value === 'price-desc' || value === 'volume-desc' ? value : '';
}
export function publicMarketContext(params: PublicQuery = {}): PublicMarketContext {
  // Repeated query fields are ambiguous. Do not coerce arrays/objects into a destination.
  return Object.freeze({ q:text(params.q,120), crop:publicCrop(params.crop), region:text(params.region,80), grade:text(params.grade,80), sort:publicMarketSort(params.sort) });
}
export function cropForCulture(value: string): PublicCrop | '' {
  const normalized = value.trim().toLowerCase();
  const aliases: readonly (readonly [PublicCrop, readonly string[]])[] = [
    ['wheat', ['wheat', 'пшеница', '小麦']], ['barley', ['barley', 'ячмень', '大麦']],
    ['corn', ['corn', 'maize', 'кукуруза', '玉米']], ['sunflower', ['sunflower', 'подсолнечник', '向日葵']],
    ['soybean', ['soybean', 'soy', 'соя', '大豆']], ['rapeseed', ['rapeseed', 'рапс', '油菜籽']],
    ['rye', ['rye', 'рожь', '黑麦']], ['oats', ['oats', 'овёс', 'овес', '燕麦']],
  ];
  return aliases.find(([, names]) => names.includes(normalized))?.[0] ?? '';
}
function marketParams(locale: unknown, context: PublicQuery): URLSearchParams {
  const safe=publicMarketContext(context); const query=new URLSearchParams({lang:localeOf(locale)});
  for(const key of ['q','crop','region','grade','sort'] as const) if(safe[key]) query.set(key,safe[key]);
  return query;
}
export function marketHref(locale: PublicMarketLocale, context: PublicQuery = {}, lot?: unknown): string {
  const query=marketParams(locale,context); const ref=publicLotReference(lot);
  if(ref) query.set('lot',ref);
  return `${MARKET_PATH}?${query.toString()}`;
}
export function publicMarketReturn(value: unknown, locale: PublicMarketLocale): string | null {
  if (typeof value !== 'string' || value.length > 4096 || !value.startsWith(`${MARKET_PATH}?`) || /[\\\u0000-\u001f\u007f]/u.test(value)) return null;
  try {
    const url = new URL(value, ORIGIN);
    if (url.origin !== ORIGIN || url.pathname !== MARKET_PATH || url.hash || url.username || url.password) return null;
    for (const key of ['lang','q', 'crop', 'region', 'grade', 'sort', 'lot']) if (url.searchParams.getAll(key).length > 1) return null;
    const params: Record<string, string> = Object.fromEntries(url.searchParams);
    return marketHref(locale, publicMarketContext(params), publicLotReference(url.searchParams.get('lot')));
  } catch { return null; }
}
export function marketApplicationHref(locale: PublicMarketLocale, intent: 'sell' | 'buy', context: PublicQuery = {}, lot?: unknown, selectedCrop?: unknown): string {
  if(intent!=='sell'&&intent!=='buy') throw new TypeError('Unsupported public market intent');
  const safe=publicMarketContext(context); const query=new URLSearchParams({lang:localeOf(locale),intent});
  const crop=publicCrop(selectedCrop) || safe.crop;
  if(crop) query.set('crop',crop);
  const ref=publicLotReference(lot); if(ref) query.set('lot',ref);
  // Product selection and return filters are separate: going back must not add a new crop filter.
  query.set('returnTo',marketHref(locale,safe));
  return `/platform-v7/register?${query.toString()}`;
}
export function publicMarketRegistrationContext(input: PublicQuery): Readonly<{filters:PublicMarketContext;lotRef:string|null;selectedCrop:PublicCrop|''}> | null {
  const selectedCrop=publicCrop(input.crop); const lotRef=publicLotReference(input.lot);
  const back=publicMarketReturn(input.returnTo,localeOf(input.lang));
  if(!back&&!selectedCrop&&!lotRef) return null;
  const params=back?Object.fromEntries(new URL(back,ORIGIN).searchParams):{crop:selectedCrop};
  return Object.freeze({filters:publicMarketContext(params),lotRef,selectedCrop});
}
export function publicMarketLocaleHref(locale: PublicMarketLocale, input: PublicQuery): string {
  const query=marketParams(locale,input);
  // Legacy/malformed links remain missing on a locale switch, never turn into a different lot.
  if(Object.prototype.hasOwnProperty.call(input,'lot')) query.set('lot',publicLotReference(input.lot)??'invalid');
  return `${MARKET_PATH}?${query.toString()}`;
}

export type PublicSortableLot = Readonly<{ publicRef: string; culture: string; grade: string | null; region: string; auctionEndsAt: string; startPriceKopecksPerTon: string; volumeTons: string }>;
function decimalUnits(value: string): bigint | null {
  if (!/^(?:0|[1-9][0-9]{0,19})(?:\.[0-9]{1,6})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole!) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
}
function integerUnits(value: string): bigint | null { return /^(?:0|[1-9][0-9]{0,18})$/.test(value) ? BigInt(value) : null; }
function compareNullable(a: bigint | number | null, b: bigint | number | null, descending = false): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  const result = a === b ? 0 : a < b ? -1 : 1;
  return descending ? -result : result;
}
export function filterPublicLots<T extends PublicSortableLot>(lots: readonly T[], context: PublicMarketContext, locale: PublicMarketLocale): T[] {
  const safe = publicMarketContext(context);
  const tag = locale === 'ru' ? 'ru-RU' : locale === 'zh' ? 'zh-CN' : 'en-US';
  const lower = (value: string) => value.toLocaleLowerCase(tag);
  const query = lower(safe.q);
  const labels: Record<PublicCrop, readonly string[]> = {
    wheat: ['wheat', 'пшеница', '小麦'], barley: ['barley', 'ячмень', '大麦'], corn: ['corn', 'maize', 'кукуруза', '玉米'],
    sunflower: ['sunflower', 'подсолнечник', '向日葵'], soybean: ['soybean', 'soy', 'соя', '大豆'],
    rapeseed: ['rapeseed', 'рапс', '油菜籽'], rye: ['rye', 'рожь', '黑麦'], oats: ['oats', 'овёс', 'овес', '燕麦'],
  };
  const filtered = lots.filter((lot) => {
    const crop = cropForCulture(lot.culture);
    const searchable = [lot.culture, lot.grade ?? '', lot.region, ...(crop ? labels[crop] : [])].map(lower);
    return (!query || searchable.some((part) => part.includes(query)))
      && (!safe.crop || crop === safe.crop)
      && (!safe.region || lower(lot.region).includes(lower(safe.region)))
      && (!safe.grade || lower(lot.grade ?? '').includes(lower(safe.grade)));
  });
  if (!safe.sort) return filtered;
  return filtered.sort((a, b) => {
    if (safe.sort === 'closing') {
      const left = Date.parse(a.auctionEndsAt), right = Date.parse(b.auctionEndsAt);
      return compareNullable(Number.isFinite(left) ? left : null, Number.isFinite(right) ? right : null);
    }
    if (safe.sort === 'volume-desc') return compareNullable(decimalUnits(a.volumeTons), decimalUnits(b.volumeTons), true);
    return compareNullable(integerUnits(a.startPriceKopecksPerTon), integerUnits(b.startPriceKopecksPerTon), safe.sort === 'price-desc');
  });
}
export function findPublicLot<T extends { publicRef: string }>(lots: readonly T[], reference: unknown): T | null {
  const ref = publicLotReference(reference);
  if (!ref) return null;
  const matches = lots.filter((lot) => publicLotReference(lot.publicRef) === ref);
  return matches.length === 1 ? matches[0]! : null;
}
export function publicDeadline(value: string, now: number, locale: PublicMarketLocale): string {
  const target = Date.parse(value);
  if (!Number.isFinite(target) || !Number.isFinite(now)) return locale === 'ru' ? 'Срок не указан' : locale === 'en' ? 'Deadline unavailable' : '截止时间不可用';
  if (target <= now) return locale === 'ru' ? 'Время вышло' : locale === 'en' ? 'Time elapsed' : '时间已到';
  const total = Math.ceil((target - now) / 60000);
  const days = Math.floor(total / 1440);
  const hours = Math.floor(total % 1440 / 60).toString().padStart(2, '0');
  const minutes = (total % 60).toString().padStart(2, '0');
  return `${days ? `${days}${locale === 'ru' ? ' д' : locale === 'en' ? 'd' : '天'} ` : ''}${hours}:${minutes}`;
}
