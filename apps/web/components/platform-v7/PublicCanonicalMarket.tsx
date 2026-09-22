import type { ReactNode } from 'react';
import { ArrowRight, Info, LockKeyhole, PackageSearch } from 'lucide-react';
import { getPublicMarketLots, type PublicMarketLot, type PublicMarketReadResult } from '@/lib/public-market-server';
import {
  PUBLIC_CROPS, cropForCulture, filterPublicLots, findPublicLot,
  marketApplicationHref, marketHref, publicMarketContext,
  type PublicCrop, type PublicMarketContext,
} from '@/lib/platform-v7/public-market-navigation';
import { canonicalPublicLocale, type CanonicalPublicLocale } from './PublicCanonicalPrimitives';
import { PublicMarketDeadline } from './PublicMarketDeadline';

const COPY = {
  ru: {
    hidden: 'Продавец скрыт', volume: 'Объём', price: 'Стартовая цена', region: 'Регион',
    grade: 'Класс / сорт', ends: 'До закрытия', details: 'Войти', access: 'Подать заявку на подключение',
    buy: 'Купить', sell: 'Продать', selected: 'Предложение', catalogue: 'Выберите культуру',
    category: 'Продажа и закупка', offers: 'Опубликованные предложения',
    source: 'Источник: обезличенные данные публичного рынка',
    declared: 'Наличие заявлено продавцом', quality: 'Качество — по данным продавца',
    emptyTitle: 'Опубликованных предложений пока нет',
    emptyText: 'Публичный рынок показывает только разрешённые к публикации обезличенные лоты.',
    unavailableTitle: 'Не удалось загрузить предложения',
    unavailableText: 'Повторите попытку. Каталог культур доступен независимо от загрузки предложений.',
    noMatchTitle: 'По выбранным условиям предложений нет',
    noMatchText: 'Измените условия поиска или сбросьте фильтры.',
    missingTitle: 'Это предложение больше не опубликовано',
    missingText: 'Вернитесь к результатам поиска, чтобы выбрать другое предложение.',
    invalidTitle: 'Ссылка на предложение устарела',
    invalidText: 'Этот адрес не определяет конкретный лот. Выберите предложение на рынке.',
    retry: 'Повторить', reset: 'Сбросить фильтры', back: 'Вернуться к предложениям',
    photo: 'Фото культуры, не партии', noPhoto: 'Изображение культуры не добавлено',
    unpublished: 'Не опубликовано для публичного просмотра',
  },
  en: {
    hidden: 'Seller hidden', volume: 'Volume', price: 'Starting price', region: 'Region',
    grade: 'Grade', ends: 'Closes in', details: 'Sign in', access: 'Apply for platform access',
    buy: 'Buy', sell: 'Sell', selected: 'Offer', catalogue: 'Choose a crop',
    category: 'Sale and purchase', offers: 'Published offers',
    source: 'Source: anonymised public market data',
    declared: 'Availability declared by seller', quality: 'Quality — seller-provided data',
    emptyTitle: 'No published offers yet',
    emptyText: 'The public market shows only anonymised lots permitted for publication.',
    unavailableTitle: 'Could not load offers',
    unavailableText: 'Please try again. The crop catalogue remains available while offers cannot be loaded.',
    noMatchTitle: 'No offers match the selected conditions',
    noMatchText: 'Change your search conditions or reset the filters.',
    missingTitle: 'This offer is no longer published',
    missingText: 'Return to your search results to choose another offer.',
    invalidTitle: 'This offer link is out of date',
    invalidText: 'This address does not identify a specific lot. Choose an offer from the market.',
    retry: 'Try again', reset: 'Reset filters', back: 'Back to offers',
    photo: 'Crop photo, not the lot', noPhoto: 'Crop image not added',
    unpublished: 'Not published for public view',
  },
  zh: {
    hidden: '卖方已隐藏', volume: '数量', price: '起始价格', region: '地区',
    grade: '等级', ends: '距截止', details: '登录', access: '申请接入平台',
    buy: '采购', sell: '销售', selected: '供求信息', catalogue: '选择作物',
    category: '销售与采购', offers: '已发布的供求信息',
    source: '来源：公开市场匿名数据',
    declared: '库存由卖方申报', quality: '质量 — 卖方提供的数据',
    emptyTitle: '暂无已发布的供求信息',
    emptyText: '公开市场仅展示获准发布的匿名批次。',
    unavailableTitle: '未能加载供求信息',
    unavailableText: '请重试。供求信息无法加载时，仍可浏览作物目录。',
    noMatchTitle: '没有符合所选条件的供求信息',
    noMatchText: '请修改搜索条件或重置筛选。',
    missingTitle: '此供求信息已不再公开',
    missingText: '请返回搜索结果，选择其他供求信息。',
    invalidTitle: '此供求信息链接已失效',
    invalidText: '此地址无法确定具体批次。请在市场中重新选择。',
    retry: '重试', reset: '重置筛选', back: '返回供求信息',
    photo: '作物照片，非本批次', noPhoto: '尚未添加作物图片',
    unpublished: '未公开发布',
  },
} as const;

const CROP_LABELS: Record<CanonicalPublicLocale, Record<PublicCrop, string>> = {
  ru: { wheat:'Пшеница', barley:'Ячмень', corn:'Кукуруза', sunflower:'Подсолнечник', soybean:'Соя', rapeseed:'Рапс', rye:'Рожь', oats:'Овёс' },
  en: { wheat:'Wheat', barley:'Barley', corn:'Corn', sunflower:'Sunflower', soybean:'Soybean', rapeseed:'Rapeseed', rye:'Rye', oats:'Oats' },
  zh: { wheat:'小麦', barley:'大麦', corn:'玉米', sunflower:'向日葵', soybean:'大豆', rapeseed:'油菜籽', rye:'黑麦', oats:'燕麦' },
};

/** Categories are navigation, not offers. They never carry price, seller, status or time. */
export function CanonicalCropCatalogue({ locale, context = publicMarketContext() }: { locale: string; context?: PublicMarketContext }) {
  const lang = canonicalPublicLocale(locale);
  const copy = COPY[lang];
  return <section className='pc-cp-crop-catalog' aria-label={copy.catalogue} data-testid='canonical-crop-catalogue'>
    <h2 className='pc-cp-market-subtitle'>{copy.catalogue}</h2>
    <div className='pc-cp-crop-grid'>
      {PUBLIC_CROPS.map((crop) => {
        const selectedContext = publicMarketContext({ ...context, crop });
        return <article className='pc-cp-card pc-cp-crop-card' key={crop} data-crop-category={crop}>
          <a className='pc-cp-crop-photo-link' href={marketHref(lang, selectedContext)} aria-label={CROP_LABELS[lang][crop]}>
            <CropPhoto crop={crop} locale={lang} />
          </a>
          <div className='pc-cp-crop-body'>
            <h3><a href={marketHref(lang, selectedContext)}>{CROP_LABELS[lang][crop]}</a></h3>
            <p>{copy.category}</p>
            <div className='pc-cp-actions'>
              <a className='pc-cp-button pc-cp-button--secondary' href={marketApplicationHref(lang, 'sell', selectedContext)}>{copy.sell}<ArrowRight size={16} aria-hidden='true' /></a>
              <a className='pc-cp-button' href={marketApplicationHref(lang, 'buy', selectedContext)}>{copy.buy}<ArrowRight size={16} aria-hidden='true' /></a>
            </div>
          </div>
        </article>;
      })}
    </div>
  </section>;
}

export async function CanonicalMarketPreview({ locale, limit = 4 }: { locale: string; limit?: number }) {
  const lang = canonicalPublicLocale(locale);
  const context = publicMarketContext();
  const market = await getPublicMarketLots();
  const count = Number.isFinite(limit) ? Math.max(1, Math.min(8, Math.floor(limit))) : 4;
  return <div data-testid='canonical-market-preview'>
    <CanonicalCropCatalogue locale={lang} context={context} />
    <section className='pc-cp-published-offers' aria-label={COPY[lang].offers}>
      <h3 className='pc-cp-market-subtitle'>{COPY[lang].offers}</h3>
      {!market.available ? <MarketState locale={lang} kind='unavailable' context={context} />
        : market.items.length === 0 ? <MarketState locale={lang} kind='empty' context={context} />
          : <div className='pc-cp-market-grid pc-cp-market-grid--preview'>{market.items.slice(0, count).map((lot) => <MarketCard key={lot.publicRef} lot={lot} locale={lang} context={context} />)}</div>}
    </section>
  </div>;
}

export async function CanonicalMarketResults({ locale, query = '', filters = {}, sort = '', selectedRef = null }: {
  locale: string; query?: string; filters?: Readonly<{ crop?: string; region?: string; grade?: string }>;
  sort?: string; selectedRef?: string | null;
}) {
  const lang = canonicalPublicLocale(locale);
  const context = publicMarketContext({ q: query, ...filters, sort });
  const market = await getPublicMarketLots();
  if (!market.available) return <MarketState locale={lang} kind='unavailable' context={context} />;
  if (market.items.length === 0) return <MarketState locale={lang} kind='empty' context={context} />;
  const items = filterPublicLots(market.items, context, lang);
  if (items.length === 0) return <MarketState locale={lang} kind='noMatch' context={context} />;
  const selected = findPublicLot(items, selectedRef) ?? items[0]!;
  return <div className='pc-cp-market-layout' data-testid='canonical-market-results'>
    <div className='pc-cp-market-grid'>{items.map((lot) => <MarketCard key={lot.publicRef} lot={lot} locale={lang} context={context} selected={lot.publicRef === selected.publicRef} />)}</div>
    <MarketAside lot={selected} locale={lang} context={context} authority={market} />
  </div>;
}

export async function CanonicalPublicLotView({ locale, lotRef, context = publicMarketContext() }: {
  locale: string; lotRef: string | null; context?: PublicMarketContext;
}) {
  const lang = canonicalPublicLocale(locale);
  const copy = COPY[lang];
  // Numeric legacy addresses have no stable identity. Never resolve them by position.
  if (!lotRef) return <PublicLotUnavailableView locale={lang} kind='invalidLink' context={context} />;
  const market = await getPublicMarketLots();
  if (!market.available) return <PublicLotUnavailableView locale={lang} kind='unavailable' context={context} lotRef={lotRef} />;
  const lot = findPublicLot(market.items, lotRef);
  if (!lot) return <PublicLotUnavailableView locale={lang} kind='notPublished' context={context} />;
  const applicationContext = publicMarketContext({ ...context, crop: cropForCulture(lot.culture) || context.crop });
  const now = Date.now();
  return <div data-testid='canonical-public-lot-view'>
    <nav className='pc-cp-lot-breadcrumb' aria-label={lang === 'ru' ? 'Путь к предложению' : lang === 'en' ? 'Offer path' : '供求信息路径'}>
      <a href={`/platform-v7?lang=${lang}`}>{lang === 'ru' ? 'Главная' : lang === 'en' ? 'Home' : '首页'}</a><span aria-hidden='true'>→</span>
      <a href={marketHref(lang, context)}>{copy.back}</a><span aria-hidden='true'>→</span>
      <strong>{cultureLabel(lot.culture, lang)}{lot.grade ? `, ${lot.grade}` : ''}</strong>
    </nav>
    <div className='pc-cp-lot-layout'>
      <figure className='pc-cp-lot-image' data-crop={cropForCulture(lot.culture) || 'generic'}>
        <CropPhoto crop={cropForCulture(lot.culture)} locale={lang} />
        <figcaption>{copy.photo}</figcaption>
      </figure>
      <article className='pc-cp-card pc-cp-lot-summary'>
        <div><span className='pc-cp-chip'>{copy.selected}</span><h1>{cultureLabel(lot.culture, lang)}{lot.grade ? `, ${lot.grade}` : ''}</h1><p className='pc-cp-lead'><LockKeyhole size={15} aria-hidden='true' /> {copy.hidden}</p></div>
        <div className='pc-cp-lot-meta pc-cp-lot-meta--detail'>
          <Metric label={copy.volume} value={formatVolume(lot.volumeTons, lang)} />
          <Metric label={copy.price} value={formatPrice(lot.startPriceKopecksPerTon, lang)} />
          <Metric label={copy.region} value={lot.region} />
          <Metric label={copy.ends} value={<PublicMarketDeadline endsAt={lot.auctionEndsAt} initialNow={now} locale={lang} />} />
        </div>
        <p className='pc-cp-lot-disclosure'>{copy.declared}. {copy.quality}.</p>
        <div className='pc-cp-actions'>
          <a className='pc-cp-button' href={marketApplicationHref(lang, 'buy', applicationContext, lot.publicRef)}>{copy.access}<ArrowRight size={16} aria-hidden='true' /></a>
          <a className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/login?lang=${lang}`}>{copy.details}</a>
        </div>
        <p className='pc-cp-lot-source'>{copy.source}{market.authority?.observedAt ? ` · ${formatObserved(market.authority.observedAt, lang)}` : ''}</p>
      </article>
    </div>
    <div className='pc-cp-lot-detail-grid'>
      <Detail title={lang === 'ru' ? 'Основные параметры' : lang === 'en' ? 'Core parameters' : '主要参数'} text={<>{copy.volume}: {formatVolume(lot.volumeTons, lang)} · {copy.region}: {lot.region}</>} />
      <Detail title={lang === 'ru' ? 'Качество' : lang === 'en' ? 'Quality' : '质量'} text={`${copy.quality}. ${lang === 'ru' ? 'Независимое подтверждение не опубликовано.' : lang === 'en' ? 'Independent verification has not been published.' : '尚未发布独立核验结果。'}`} />
      <Detail title={lang === 'ru' ? 'Документы' : lang === 'en' ? 'Documents' : '文件'} text={lang === 'ru' ? 'Документы доступны только участникам с подтверждёнными полномочиями.' : lang === 'en' ? 'Documents are available only to participants with confirmed authority.' : '文件仅向具有已确认权限的参与方开放。'} />
      <Detail title={lang === 'ru' ? 'Контрагент' : lang === 'en' ? 'Counterparty' : '交易对手'} text={`${copy.hidden}. ${copy.unpublished}.`} />
    </div>
  </div>;
}

function PublicLotUnavailableView({ locale, kind, context, lotRef }: {
  locale: CanonicalPublicLocale; kind: 'unavailable' | 'notPublished' | 'invalidLink'; context: PublicMarketContext; lotRef?: string;
}) {
  const copy = COPY[locale];
  const title = kind === 'invalidLink' ? copy.invalidTitle : kind === 'notPublished' ? copy.missingTitle : copy.unavailableTitle;
  const description = kind === 'invalidLink' ? copy.invalidText : kind === 'notPublished' ? copy.missingText : copy.unavailableText;
  return <div data-testid='canonical-public-lot-view' data-market-state={kind}>
    <article className='pc-cp-card pc-cp-market-state'><h1>{title}</h1><p>{description}</p>
      <div className='pc-cp-actions'>
        {kind === 'unavailable' ? <a className='pc-cp-button' href={marketHref(locale, context, lotRef)}>{copy.retry}</a> : null}
        <a className='pc-cp-button pc-cp-button--secondary' href={marketHref(locale, context)}>{copy.back}</a>
      </div>
    </article>
  </div>;
}

function MarketCard({ lot, locale, context, selected = false }: { lot: PublicMarketLot; locale: CanonicalPublicLocale; context: PublicMarketContext; selected?: boolean }) {
  const copy = COPY[locale];
  const detailHref = marketHref(locale, context, lot.publicRef);
  const applicationContext = publicMarketContext({ ...context, crop: cropForCulture(lot.culture) || context.crop });
  return <article className='pc-cp-card pc-cp-lot-card' data-selected={selected ? 'true' : undefined}>
    <div className='pc-cp-lot-media' data-crop={cropForCulture(lot.culture) || 'generic'}><CropPhoto crop={cropForCulture(lot.culture)} locale={locale} /><span className='pc-cp-lot-media-caption'>{copy.photo}</span></div>
    <div className='pc-cp-lot-body'>
      <div><span className='pc-cp-chip'><LockKeyhole size={12} aria-hidden='true' />{copy.hidden}</span><a className='pc-cp-lot-title' href={detailHref}>{cultureLabel(lot.culture, locale)}{lot.grade ? ` · ${lot.grade}` : ''}</a></div>
      <div className='pc-cp-lot-meta'>
        <Metric label={copy.volume} value={formatVolume(lot.volumeTons, locale)} />
        <Metric label={copy.price} value={formatPrice(lot.startPriceKopecksPerTon, locale)} />
        <Metric label={copy.region} value={lot.region} />
        <Metric label={copy.ends} value={<PublicMarketDeadline endsAt={lot.auctionEndsAt} initialNow={Date.now()} locale={locale} />} />
      </div>
      <div className='pc-cp-lot-foot'><span><Info size={15} aria-hidden='true' />{copy.declared}</span></div>
      <div className='pc-cp-actions' data-testid='canonical-public-market-lot-actions'>
        <a className='pc-cp-button' href={marketApplicationHref(locale, 'buy', applicationContext, lot.publicRef)}>{copy.buy}<ArrowRight size={16} aria-hidden='true' /></a>
        <a className='pc-cp-button pc-cp-button--secondary' href={detailHref}>{locale === 'ru' ? 'Условия' : locale === 'en' ? 'Details' : '详情'}<ArrowRight size={16} aria-hidden='true' /></a>
      </div>
    </div>
  </article>;
}

function MarketAside({ lot, locale, context, authority }: { lot: PublicMarketLot; locale: CanonicalPublicLocale; context: PublicMarketContext; authority: PublicMarketReadResult }) {
  const copy = COPY[locale];
  return <aside className='pc-cp-card pc-cp-market-aside' aria-label={copy.selected}>
    <span className='pc-cp-eyebrow'>{copy.selected}</span><h2>{cultureLabel(lot.culture, locale)}{lot.grade ? ` · ${lot.grade}` : ''}</h2>
    <dl><Row label={copy.volume} value={formatVolume(lot.volumeTons, locale)} /><Row label={copy.price} value={formatPrice(lot.startPriceKopecksPerTon, locale)} /><Row label={copy.region} value={lot.region} /><Row label={copy.ends} value={<PublicMarketDeadline endsAt={lot.auctionEndsAt} initialNow={Date.now()} locale={locale} />} /></dl>
    <p className='pc-cp-lot-disclosure'>{copy.declared}. {copy.quality}.</p>
    <a className='pc-cp-button' href={marketHref(locale, context, lot.publicRef)}>{locale === 'ru' ? 'Открыть карточку' : locale === 'en' ? 'Open offer' : '打开供求信息'}<ArrowRight size={16} aria-hidden='true' /></a>
    <p className='pc-cp-lot-source'>{copy.source}{authority.authority?.observedAt ? ` · ${formatObserved(authority.authority.observedAt, locale)}` : ''}</p>
  </aside>;
}

function MarketState({ locale, kind, context }: { locale: CanonicalPublicLocale; kind: 'empty' | 'unavailable' | 'noMatch'; context: PublicMarketContext }) {
  const copy = COPY[locale];
  const title = kind === 'empty' ? copy.emptyTitle : kind === 'unavailable' ? copy.unavailableTitle : copy.noMatchTitle;
  const description = kind === 'empty' ? copy.emptyText : kind === 'unavailable' ? copy.unavailableText : copy.noMatchText;
  const href = kind === 'unavailable' ? marketHref(locale, context) : kind === 'noMatch' ? marketHref(locale, publicMarketContext()) : marketApplicationHref(locale, 'sell', context);
  const label = kind === 'unavailable' ? copy.retry : kind === 'noMatch' ? copy.reset : copy.sell;
  return <article className='pc-cp-card pc-cp-market-state' data-market-state={kind}>
    <div><h3>{title}</h3><p>{description}</p></div><a className='pc-cp-button pc-cp-button--secondary' href={href}>{label}<ArrowRight size={16} aria-hidden='true' /></a>
  </article>;
}

function CropPhoto({ crop, locale }: { crop: PublicCrop | ''; locale: CanonicalPublicLocale }) {
  if (!crop) return <div className='pc-cp-crop-photo pc-cp-crop-photo--missing'><PackageSearch size={32} aria-hidden='true' /><span>{COPY[locale].noPhoto}</span></div>;
  return <img className='pc-cp-crop-photo' src={`/platform-v7/crops/${crop}-640.webp`} srcSet={`/platform-v7/crops/${crop}-320.webp 320w, /platform-v7/crops/${crop}-640.webp 640w, /platform-v7/crops/${crop}-960.webp 960w`} sizes='(max-width: 600px) calc(100vw - 40px), (max-width: 1000px) 45vw, 300px' width={640} height={400} loading='lazy' decoding='async' alt={CROP_LABELS[locale][crop]} />;
}
function Metric({ label, value }: { label: string; value: ReactNode }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function Row({ label, value }: { label: string; value: ReactNode }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function Detail({ title, text }: { title: string; text: ReactNode }) { return <article className='pc-cp-card pc-cp-detail-block'><h3>{title}</h3><p>{text}</p></article>; }
function cultureLabel(value: string, locale: CanonicalPublicLocale) {
  const crop = cropForCulture(value);
  return crop ? CROP_LABELS[locale][crop] : value.trim().replace(/[_-]+/g, ' ');
}
function formatVolume(value: string, locale: CanonicalPublicLocale) {
  const normalized = locale === 'ru' ? value.replace('.', ',') : value;
  return locale === 'zh' ? `${normalized} 吨` : `${normalized} ${locale === 'en' ? 't' : 'т'}`;
}
function formatPrice(value: string, locale: CanonicalPublicLocale) {
  try {
    const kopecks = BigInt(value), rubles = kopecks / 100n, remainder = kopecks % 100n;
    const formatter = new Intl.NumberFormat(locale === 'en' ? 'en-US' : locale === 'zh' ? 'zh-CN' : 'ru-RU');
    const decimal = remainder === 0n ? '' : `${locale === 'ru' ? ',' : '.'}${remainder.toString().padStart(2, '0')}`;
    return `${formatter.format(rubles)}${decimal} ₽/${locale === 'zh' ? '吨' : locale === 'en' ? 't' : 'т'}`;
  } catch { return locale === 'ru' ? 'Недоступно' : locale === 'en' ? 'Unavailable' : '不可用'; }
}
function formatObserved(value: string, locale: CanonicalPublicLocale) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale === 'zh' ? 'zh-CN' : 'ru-RU', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', timeZone:'Europe/Moscow' }).format(new Date(value));
}
