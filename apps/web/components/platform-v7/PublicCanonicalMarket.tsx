import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import { getPublicMarketLots, type PublicMarketLot, type PublicMarketReadResult } from '@/lib/public-market-server';
import { canonicalPublicLocale, type CanonicalPublicLocale } from './PublicCanonicalPrimitives';
import { CanonicalUxState } from './CanonicalUxState';

const COPY = {
  ru: {
    photo: 'Фото не опубликовано',
    hidden: 'Продавец скрыт',
    volume: 'Объём',
    price: 'Стартовая цена',
    region: 'Регион',
    grade: 'Класс / сорт',
    ends: 'До закрытия',
    details: 'Войти и посмотреть',
    access: 'Доступ к торгам',
    buy: 'Купить',
    sell: 'Продать',
    selected: 'Выбранный лот',
    source: 'Источник: обезличенные данные публичного рынка',
    declared: 'Наличие заявлено продавцом',
    quality: 'Качество — по данным продавца',
    emptyTitle: 'Активных опубликованных лотов сейчас нет',
    emptyText: 'Публичный рынок показывает только разрешённые к публикации обезличенные лоты.',
    unavailableTitle: 'Рынок временно недоступен',
    unavailableText: 'Актуальные данные рынка сейчас недоступны. Мы не показываем неподтверждённые данные.',
    noMatchTitle: 'По запросу ничего не найдено',
    noMatchText: 'Измени запрос или вернись ко всем опубликованным лотам.',
  },
  en: {
    photo: 'Photo not published',
    hidden: 'Seller hidden',
    volume: 'Volume',
    price: 'Starting price',
    region: 'Region',
    grade: 'Grade',
    ends: 'Closes in',
    details: 'Sign in and view',
    access: 'Trading access',
    buy: 'Buy',
    sell: 'Sell',
    selected: 'Selected lot',
    source: 'Source: anonymised public market data',
    declared: 'Availability declared by seller',
    quality: 'Quality — seller-provided data',
    emptyTitle: 'No active published lots right now',
    emptyText: 'The public market shows only anonymised lots permitted for publication.',
    unavailableTitle: 'Market is temporarily unavailable',
    unavailableText: 'Current market data is unavailable. We do not show unconfirmed data.',
    noMatchTitle: 'No matching lots',
    noMatchText: 'Change the query or return to all published lots.',
  },
  zh: {
    photo: '未发布照片',
    hidden: '卖方已隐藏',
    volume: '数量',
    price: '起始价格',
    region: '地区',
    grade: '等级',
    ends: '距关闭',
    details: '登录查看',
    access: '获取交易权限',
    buy: '购买',
    sell: '出售',
    selected: '所选批次',
    source: '来源：公开市场匿名数据',
    declared: '库存由卖方申报',
    quality: '质量 — 卖方提供的数据',
    emptyTitle: '当前没有有效的公开批次',
    emptyText: '公开市场仅展示获准发布的匿名批次。',
    unavailableTitle: '市场暂时不可用',
    unavailableText: '当前市场数据暂不可用；我们不会展示未经确认的数据。',
    noMatchTitle: '未找到匹配批次',
    noMatchText: '修改搜索条件或返回全部已发布批次。',
  },
} as const;

export async function CanonicalMarketPreview({ locale, limit = 4 }: { locale: string; limit?: number }) {
  const lang = canonicalPublicLocale(locale);
  const market = await getPublicMarketLots();
  if (!market.available) return <MarketPreviewState locale={lang} kind='unavailable' limit={limit} />;
  if (market.items.length === 0) return <MarketPreviewState locale={lang} kind='empty' limit={limit} />;
  return (
    <div className='pc-cp-market-grid pc-cp-market-grid--preview' data-testid='canonical-market-preview'>
      {market.items.slice(0, limit).map((lot, index) => <MarketCard key={lot.publicRef} lot={lot} publicIndex={index} locale={lang} />)}
    </div>
  );
}

export async function CanonicalMarketResults({
  locale,
  query = '',
  filters = {},
  sort = '',
  selectedIndex,
}: {
  locale: string;
  query?: string;
  filters?: Readonly<{ crop?: string; region?: string; grade?: string }>;
  sort?: string;
  selectedIndex?: number | null;
}) {
  const lang = canonicalPublicLocale(locale);
  const market = await getPublicMarketLots();
  if (!market.available) return <MarketEmptyLayout locale={lang} kind='unavailable' />;
  if (market.items.length === 0) return <MarketEmptyLayout locale={lang} kind='empty' />;

  const localeTag = lang === 'ru' ? 'ru-RU' : lang === 'zh' ? 'zh-CN' : 'en-US';
  const normalizedQuery = query.trim().toLocaleLowerCase(localeTag);
  const crop = normalizeCropFilter(filters.crop);
  const region = String(filters.region || '').trim().toLocaleLowerCase(localeTag);
  const grade = String(filters.grade || '').trim().toLocaleLowerCase(localeTag);
  const indexed = market.items.map((lot, index) => ({ lot, index }));
  const filtered = indexed.filter(({ lot }) => {
    const searchable = [lot.culture, cultureLabel(lot.culture, lang), lot.grade || '', lot.region]
      .map((value) => value.toLocaleLowerCase(localeTag));
    if (normalizedQuery && !searchable.some((value) => value.includes(normalizedQuery))) return false;
    if (crop && cropVisualKey(lot.culture) !== crop) return false;
    if (region && !lot.region.toLocaleLowerCase(localeTag).includes(region)) return false;
    if (grade && !(lot.grade || '').toLocaleLowerCase(localeTag).includes(grade)) return false;
    return true;
  });
  const items = sortMarketItems(filtered, normalizeMarketSort(sort));

  if (items.length === 0) return <MarketState locale={lang} kind='noMatch' />;

  const selected = items.find((item) => item.index === selectedIndex) ?? items[0]!;
  return (
    <div className='pc-cp-market-layout' data-testid='canonical-market-results'>
      <div className='pc-cp-market-grid'>
        {items.map(({ lot, index }) => <MarketCard key={lot.publicRef} lot={lot} publicIndex={index} locale={lang} selected={index === selected.index} />)}
      </div>
      <MarketAside lot={selected.lot} publicIndex={selected.index} locale={lang} authority={market} />
    </div>
  );
}


export async function CanonicalPublicLotView({ locale, lotIndex }: { locale: string; lotIndex: number }) {
  const lang = canonicalPublicLocale(locale);
  const copy = COPY[lang];
  const market = await getPublicMarketLots();
  if (!market.available) return <PublicLotUnavailableView locale={lang} kind='unavailable' />;
  const lot = Number.isInteger(lotIndex) && lotIndex >= 0 ? market.items[lotIndex] : undefined;
  if (!lot) return <PublicLotUnavailableView locale={lang} kind='empty' />;

  const unavailable = lang === 'ru'
    ? 'Не опубликовано для публичного просмотра'
    : lang === 'en'
      ? 'Not published for public view'
      : '未公开发布';

  return (
    <div data-testid='canonical-public-lot-view'>
      <div className='pc-cp-lot-breadcrumb'>
        <a href={`/platform-v7?lang=${lang}`}>{lang === 'ru' ? 'Главная' : lang === 'en' ? 'Home' : '首页'}</a>
        <span>→</span>
        <a href={`/platform-v7/market?lang=${lang}`}>{lang === 'ru' ? 'Рынок' : lang === 'en' ? 'Market' : '市场'}</a>
        <span>→</span>
        <strong>{cultureLabel(lot.culture, lang)}{lot.grade ? `, ${lot.grade}` : ''}</strong>
      </div>

      <div className='pc-cp-lot-layout'>
        <div className='pc-cp-lot-image' data-crop={cropVisualKey(lot.culture)} role='img' aria-label={lang === 'ru' ? 'Иллюстрация культуры, фото партии не опубликовано' : lang === 'en' ? 'Crop illustration; lot photo not published' : '作物示意图；批次照片未公开'}>
          <CropArt crop={cropVisualKey(lot.culture)} />
          <span>{lang === 'ru' ? 'Фото партии не опубликовано' : lang === 'en' ? 'Lot photo not published' : '批次照片未公开'}</span>
        </div>

        <article className='pc-cp-card pc-cp-lot-summary'>
          <div>
            <span className='pc-cp-chip pc-cp-chip--ok'>{lang === 'ru' ? 'Публичный лот' : lang === 'en' ? 'Public lot' : '公开批次'}</span>
            <h1>{cultureLabel(lot.culture, lang)}{lot.grade ? `, ${lot.grade}` : ''}</h1>
            <p className='pc-cp-lead'><LockKeyhole size={15} aria-hidden='true' /> {copy.hidden}</p>
          </div>
          <div className='pc-cp-lot-meta pc-cp-lot-meta--detail'>
            <Metric label={copy.volume} value={formatVolume(lot.volumeTons, lang)} />
            <Metric label={copy.price} value={formatPrice(lot.startPriceKopecksPerTon, lang)} />
            <Metric label={copy.region} value={lot.region} />
            <Metric label={copy.ends} value={formatRemaining(lot.auctionEndsAt, lang)} />
          </div>
          <div className='pc-cp-actions'>
            <a className='pc-cp-button' href={`/platform-v7/register?lang=${lang}&intent=buy`}>{copy.access}<ArrowRight size={16} aria-hidden='true' /></a>
            <a className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/login?lang=${lang}`}>{copy.details}</a>
          </div>
          <small className='pc-cp-lot-source'>{copy.source}{market.authority?.observedAt ? ` · ${formatObserved(market.authority.observedAt, lang)}` : ''}</small>
        </article>
      </div>

      <div className='pc-cp-lot-detail-grid'>
        <Detail title={lang === 'ru' ? 'Основные параметры' : lang === 'en' ? 'Core parameters' : '主要参数'} text={`${copy.volume}: ${formatVolume(lot.volumeTons, lang)} · ${copy.region}: ${lot.region} · ${copy.ends}: ${formatRemaining(lot.auctionEndsAt, lang)}`} />
        <Detail title={lang === 'ru' ? 'Качество' : lang === 'en' ? 'Quality' : '质量'} text={lot.independentVerification === null ? `${copy.quality}. ${unavailable}: ${lang === 'ru' ? 'независимое подтверждение' : lang === 'en' ? 'independent verification' : '独立核验'}.` : copy.quality} />
        <Detail title={lang === 'ru' ? 'Документы' : lang === 'en' ? 'Documents' : '文件'} text={`${unavailable}. ${lang === 'ru' ? 'Документы доступны только участникам с подтверждёнными полномочиями.' : lang === 'en' ? 'Documents are available only to participants with confirmed authority.' : '文件仅向具有已确认权限的参与方开放。'}`} />
        <Detail title={lang === 'ru' ? 'Контрагент' : lang === 'en' ? 'Counterparty' : '交易对手'} text={`${copy.hidden}. ${lang === 'ru' ? 'Название организации и внутренние идентификаторы не раскрываются.' : lang === 'en' ? 'Organisation name and internal identifiers are not disclosed.' : '机构名称和内部标识不会披露。'}`} />
      </div>
    </div>
  );
}


function PublicLotUnavailableView({ locale, kind }: { locale: CanonicalPublicLocale; kind: 'empty' | 'unavailable' }) {
  const copy=COPY[locale];
  const title=kind==='unavailable'?copy.unavailableTitle:copy.emptyTitle;
  const text=kind==='unavailable'?copy.unavailableText:copy.emptyText;
  const hidden=locale==='ru'?'Недоступно для публичного просмотра':locale==='en'?'Unavailable for public view':'暂无公开数据';
  return (
    <div data-testid='canonical-public-lot-view' data-market-state={kind}>
      <div className='pc-cp-lot-breadcrumb'>
        <a href={`/platform-v7?lang=${locale}`}>{locale==='ru'?'Главная':locale==='en'?'Home':'首页'}</a><span>→</span>
        <a href={`/platform-v7/market?lang=${locale}`}>{locale==='ru'?'Рынок':locale==='en'?'Market':'市场'}</a><span>→</span><strong>{hidden}</strong>
      </div>
      <div className='pc-cp-lot-layout'>
        <div className='pc-cp-lot-image' role='img' aria-label={hidden}><span>{copy.photo}</span></div>
        <article className='pc-cp-card pc-cp-lot-summary'>
          <div><span className='pc-cp-chip pc-cp-chip--warn'>{hidden}</span><h1>{locale==='ru'?'Карточка лота':locale==='en'?'Lot card':'批次卡片'}</h1><p className='pc-cp-lead'>{title}</p></div>
          <div className='pc-cp-lot-meta pc-cp-lot-meta--detail'>
            <Metric label={copy.volume} value='—'/><Metric label={copy.price} value='—'/><Metric label={copy.region} value='—'/><Metric label={copy.ends} value='—'/>
          </div>
          <p className='pc-cp-lead'>{text}</p>
          <div className='pc-cp-actions'><a className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/market?lang=${locale}`}>{locale==='ru'?'Вернуться на рынок':locale==='en'?'Back to market':'返回市场'}</a></div>
        </article>
      </div>
      <div className='pc-cp-lot-detail-grid'>
        <Detail title={locale==='ru'?'Основные параметры':locale==='en'?'Core parameters':'主要参数'} text={hidden}/>
        <Detail title={locale==='ru'?'Качество':locale==='en'?'Quality':'质量'} text={hidden}/>
        <Detail title={locale==='ru'?'Документы':locale==='en'?'Documents':'文件'} text={hidden}/>
        <Detail title={locale==='ru'?'Контрагент':locale==='en'?'Counterparty':'交易对手'} text={copy.hidden}/>
      </div>
    </div>
  );
}

function MarketCard({ lot, publicIndex, locale, selected = false }: { lot: PublicMarketLot; publicIndex: number; locale: CanonicalPublicLocale; selected?: boolean }) {
  const copy = COPY[locale];
  const buyHref = `/platform-v7/register?lang=${locale}&intent=buy`;
  const sellHref = `/platform-v7/register?lang=${locale}&intent=sell`;
  const detailHref = `/platform-v7/market?lang=${locale}&lot=${publicIndex}`;
  return (
    <article className='pc-cp-card pc-cp-lot-card' data-selected={selected ? 'true' : undefined}>
      <div className='pc-cp-lot-media' data-crop={cropVisualKey(lot.culture)} aria-hidden='true'>
        <CropArt crop={cropVisualKey(lot.culture)} />
        <span className='pc-cp-lot-media-caption'>{cultureLabel(lot.culture, locale)}</span>
      </div>
      <div className='pc-cp-lot-body'>
        <div>
          <span className='pc-cp-chip'><LockKeyhole size={12} aria-hidden='true' />{copy.hidden}</span>
          <a className='pc-cp-lot-title' href={detailHref}>{cultureLabel(lot.culture, locale)}{lot.grade ? ` · ${lot.grade}` : ''}</a>
        </div>
        <div className='pc-cp-lot-meta'>
          <Metric label={copy.volume} value={formatVolume(lot.volumeTons, locale)} />
          <Metric label={copy.price} value={formatPrice(lot.startPriceKopecksPerTon, locale)} />
          <Metric label={copy.region} value={lot.region} />
          <Metric label={copy.ends} value={formatRemaining(lot.auctionEndsAt, locale)} />
        </div>
        <div className='pc-cp-lot-foot'><span><ShieldCheck size={13} aria-hidden='true' /> {copy.declared}</span></div>
        <div className='pc-cp-actions' data-testid='canonical-public-market-lot-actions'>
          <a className='pc-cp-button' href={buyHref}>{copy.buy}<ArrowRight size={15} aria-hidden='true' /></a>
          <a className='pc-cp-button pc-cp-button--secondary' href={sellHref}>{copy.sell}<ArrowRight size={15} aria-hidden='true' /></a>
        </div>
      </div>
    </article>
  );
}

function MarketAside({ lot, publicIndex, locale, authority }: { lot: PublicMarketLot; publicIndex: number; locale: CanonicalPublicLocale; authority: PublicMarketReadResult }) {
  const copy = COPY[locale];
  return (
    <aside className='pc-cp-card pc-cp-market-aside' aria-label={copy.selected}>
      <span className='pc-cp-eyebrow'>{copy.selected}</span>
      <h2>{cultureLabel(lot.culture, locale)}{lot.grade ? ` · ${lot.grade}` : ''}</h2>
      <dl>
        <Row label={copy.volume} value={formatVolume(lot.volumeTons, locale)} />
        <Row label={copy.price} value={formatPrice(lot.startPriceKopecksPerTon, locale)} />
        <Row label={copy.region} value={lot.region} />
        <Row label={copy.ends} value={formatRemaining(lot.auctionEndsAt, locale)} />
      </dl>
      <div className='pc-cp-chip pc-cp-chip--ok'><ShieldCheck size={13} aria-hidden='true' />{copy.declared}</div>
      <p className='pc-cp-lead' style={{ fontSize: 12 }}>{copy.quality}</p>
      <a className='pc-cp-button' href={`/platform-v7/market?lang=${locale}&lot=${publicIndex}`}>{locale === 'ru' ? 'Открыть карточку' : locale === 'en' ? 'Open lot' : '打开批次'}<ArrowRight size={16} aria-hidden='true' /></a>
      <small style={{ color: 'var(--pc-cp-muted)', lineHeight: 1.45 }}>{copy.source}{authority.authority?.observedAt ? ` · ${formatObserved(authority.authority.observedAt, locale)}` : ''}</small>
    </aside>
  );
}


function MarketPreviewState({ locale, kind, limit }: { locale: CanonicalPublicLocale; kind: 'empty' | 'unavailable'; limit: number }) {
  const copy=COPY[locale];
  const title=kind==='unavailable'?copy.unavailableTitle:copy.emptyTitle;
  const text=kind==='unavailable'?copy.unavailableText:copy.emptyText;
  return (
    <div className='pc-cp-market-preview-state' data-market-state={kind}>
      <div className='pc-cp-market-preview-alert'><ShieldCheck size={16} aria-hidden='true'/><strong>{title}</strong><span>{text}</span></div>
      <div className='pc-cp-market-grid pc-cp-market-grid--preview pc-cp-market-grid--empty' data-testid='canonical-market-preview' tabIndex={0} aria-label={locale === 'ru' ? 'Публичные лоты: данных пока нет' : locale === 'en' ? 'Public lots: no data yet' : '公开批次：暂无数据'}>
        {Array.from({length:Math.max(1,Math.min(limit,4))},(_,index)=><EmptyLotCard key={index} locale={locale} index={index}/>)}
      </div>
    </div>
  );
}

function MarketEmptyLayout({ locale, kind }: { locale: CanonicalPublicLocale; kind: 'empty' | 'unavailable' }) {
  const copy=COPY[locale];
  const title=kind==='unavailable'?copy.unavailableTitle:copy.emptyTitle;
  const text=kind==='unavailable'?copy.unavailableText:copy.emptyText;
  const noLot=locale==='ru'?'Лот не выбран':locale==='en'?'No lot selected':'未选择批次';
  const noData=locale==='ru'?'Публичные данные не подтверждены':locale==='en'?'Public data is not confirmed':'公开数据未确认';
  return (
    <div className='pc-cp-market-layout pc-cp-market-layout--empty' data-market-state={kind}>
      <div>
        <div className='pc-cp-market-preview-alert pc-cp-market-preview-alert--wide'><ShieldCheck size={16} aria-hidden='true'/><strong>{title}</strong><span>{text}</span></div>
        <div className='pc-cp-market-grid pc-cp-market-grid--empty'>
          {Array.from({length:9},(_,index)=><EmptyLotCard key={index} locale={locale} index={index}/>)}
        </div>
      </div>
      <aside className='pc-cp-card pc-cp-market-aside pc-cp-market-aside--empty' aria-label={noLot}>
        <span className='pc-cp-eyebrow'>{copy.selected}</span>
        <h2>{noLot}</h2>
        <div className='pc-cp-lot-media pc-cp-lot-media--empty' aria-hidden='true'/>
        <div className='pc-cp-chip pc-cp-chip--warn'>{noData}</div>
        <dl>
          <Row label={copy.volume} value='—'/>
          <Row label={copy.price} value='—'/>
          <Row label={copy.region} value='—'/>
          <Row label={copy.ends} value='—'/>
        </dl>
        <p className='pc-cp-lead' style={{fontSize:12}}>{text}</p>
      </aside>
    </div>
  );
}

function EmptyLotCard({ locale, index }: { locale: CanonicalPublicLocale; index: number }) {
  const unavailable=locale==='ru'?'Данные лота недоступны':locale==='en'?'Lot data unavailable':'批次数据不可用';
  const waiting=locale==='ru'?'Ожидаем подтверждённую публикацию':locale==='en'?'Awaiting confirmed publication':'等待确认发布';
  const crop=EMPTY_CROP_VISUALS[index % EMPTY_CROP_VISUALS.length]!;
  return (
    <article className='pc-cp-card pc-cp-lot-card pc-cp-lot-card--empty' aria-label={unavailable}>
      <div className='pc-cp-lot-media pc-cp-lot-media--empty' data-crop={crop} data-visual-index={index} aria-hidden='true'><CropArt crop={crop}/></div>
      <div className='pc-cp-lot-body'>
        <span className='pc-cp-chip pc-cp-chip--warn'>{unavailable}</span>
        <div className='pc-cp-lot-title'>{waiting}</div>
        <div className='pc-cp-empty-lines' aria-hidden='true'><i/><i/><i/></div>
      </div>
    </article>
  );
}

function MarketState({ locale, kind }: { locale: CanonicalPublicLocale; kind: 'empty' | 'unavailable' | 'noMatch' }) {
  const copy = COPY[locale];
  const title = kind === 'empty' ? copy.emptyTitle : kind === 'unavailable' ? copy.unavailableTitle : copy.noMatchTitle;
  const description = kind === 'empty' ? copy.emptyText : kind === 'unavailable' ? copy.unavailableText : copy.noMatchText;
  return (
    <div data-market-state={kind}>
      <CanonicalUxState
        kind={kind === 'unavailable' ? 'unavailable' : 'empty'}
        title={title}
        description={description}
        actionHref={kind === 'noMatch' ? `/platform-v7/market?lang=${locale}` : undefined}
        actionLabel={kind === 'noMatch' ? (locale === 'ru' ? 'Все лоты' : locale === 'en' ? 'All lots' : '全部批次') : undefined}
      />
    </div>
  );
}

type CropVisual = 'wheat' | 'barley' | 'corn' | 'sunflower' | 'soybean' | 'rapeseed' | 'rye' | 'oats' | 'generic';
type MarketSort = '' | 'closing' | 'price-asc' | 'price-desc' | 'volume-desc';

function normalizeMarketSort(value: string | undefined): MarketSort {
  return value === 'closing' || value === 'price-asc' || value === 'price-desc' || value === 'volume-desc' ? value : '';
}

function sortMarketItems<T extends { lot: PublicMarketLot; index: number }>(items: readonly T[], sort: MarketSort): T[] {
  const result=[...items];
  if (!sort) return result;
  return result.sort((left,right)=>{
    let order=0;
    if(sort==='closing'){
      const a=new Date(left.lot.auctionEndsAt).getTime();
      const b=new Date(right.lot.auctionEndsAt).getTime();
      order=(Number.isFinite(a)?a:Number.MAX_SAFE_INTEGER)-(Number.isFinite(b)?b:Number.MAX_SAFE_INTEGER);
    } else if(sort==='volume-desc'){
      const a=Number(left.lot.volumeTons);
      const b=Number(right.lot.volumeTons);
      order=(Number.isFinite(b)?b:0)-(Number.isFinite(a)?a:0);
    } else {
      try {
        const a=BigInt(left.lot.startPriceKopecksPerTon);
        const b=BigInt(right.lot.startPriceKopecksPerTon);
        order=a===b?0:a<b?-1:1;
      } catch {
        order=0;
      }
      if(sort==='price-desc') order*=-1;
    }
    return order || left.index-right.index;
  });
}

const EMPTY_CROP_VISUALS: readonly CropVisual[] = ['wheat','sunflower','corn','soybean','rapeseed','barley','oats','rye'];

function normalizeCropFilter(value: string | undefined): CropVisual | '' {
  const normalized = String(value || '').trim().toLowerCase();
  return EMPTY_CROP_VISUALS.includes(normalized as CropVisual) ? normalized as CropVisual : '';
}

function cropVisualKey(value: string): CropVisual {
  const key=value.trim().toLowerCase();
  if(key==='wheat'||key==='пшеница'||key==='小麦') return 'wheat';
  if(key==='barley'||key==='ячмень'||key==='大麦') return 'barley';
  if(key==='corn'||key==='maize'||key==='кукуруза'||key==='玉米') return 'corn';
  if(key==='sunflower'||key==='подсолнечник'||key==='向日葵') return 'sunflower';
  if(key==='soybean'||key==='soy'||key==='соя'||key==='大豆') return 'soybean';
  if(key==='rapeseed'||key==='рапс'||key==='油菜籽') return 'rapeseed';
  if(key==='rye'||key==='рожь'||key==='黑麦') return 'rye';
  if(key==='oats'||key==='овёс'||key==='овес'||key==='燕麦') return 'oats';
  return 'generic';
}

function CropArt({ crop }: { crop: CropVisual }) {
  const palette = crop === 'sunflower' || crop === 'rapeseed'
    ? { sky:'#f6f2dc', far:'#dfe8cf', near:'#bfd7c1', stem:'#476f4e', leaf:'#6e9769', accent:'#dfbd48', accentDark:'#80602e' }
    : crop === 'corn'
      ? { sky:'#f2f2dd', far:'#dbe8cf', near:'#bdd6c0', stem:'#44734d', leaf:'#5f925d', accent:'#d8b24c', accentDark:'#8f6f2f' }
      : crop === 'soybean'
        ? { sky:'#eef4eb', far:'#d8e7d7', near:'#bfd6c4', stem:'#4c7652', leaf:'#6f9b6b', accent:'#9cb56d', accentDark:'#58734e' }
        : { sky:'#eef4ec', far:'#d9e7d8', near:'#bdd4bf', stem:'#4e704f', leaf:'#73936a', accent:'#c8a451', accentDark:'#826d3f' };
  const stems = [
    {x:30,y:97,top:37,lean:-4},
    {x:58,y:99,top:29,lean:2},
    {x:88,y:96,top:42,lean:-2},
    {x:121,y:99,top:31,lean:4},
    {x:151,y:95,top:45,lean:-1},
  ];
  const cereal = crop==='wheat'||crop==='barley'||crop==='rye'||crop==='generic';
  return (
    <svg className='pc-cp-crop-art' viewBox='0 0 180 110' preserveAspectRatio='xMidYMid slice' focusable='false' aria-hidden='true'>
      <rect width='180' height='110' fill={palette.sky}/>
      <circle cx='144' cy='22' r='19' fill='#fff4bf' opacity='.72'/>
      <path d='M0 67 C30 58 55 63 78 57 C105 49 128 55 180 41 V110 H0 Z' fill={palette.far}/>
      <path d='M0 82 C31 69 65 76 97 66 C129 56 153 63 180 53 V110 H0 Z' fill={palette.near}/>
      <path d='M0 102 C36 87 69 94 104 84 C139 74 161 80 180 73' fill='none' stroke='#8db395' strokeWidth='2' opacity='.5'/>
      <path d='M8 109 C40 92 72 98 105 89 C137 80 158 84 177 78' fill='none' stroke='#ecf5ed' strokeWidth='1.5' opacity='.9'/>

      {cereal ? (
        <g>
          {stems.map(({x,y,top,lean},index)=>(
            <g key={x} transform={`translate(${x} 0)`}>
              <path d={`M0 ${y} C${lean} 76 ${lean} 56 ${lean} ${top+5}`} fill='none' stroke={palette.stem} strokeWidth='2.4' strokeLinecap='round'/>
              <path d={`M${lean-1} 72 C${lean-12} 65 ${lean-15} 61 ${lean-17} 56 C${lean-6} 58 ${lean} 63 ${lean+1} 69`} fill={palette.leaf} opacity='.9'/>
              <g transform={`translate(${lean} ${top}) rotate(${index%2===0?-8:7})`}>
                <path d='M0 15 V-13' stroke={palette.accentDark} strokeWidth='1.3' strokeLinecap='round'/>
                {[-9,-5,-1,3,7].map((dy)=>(
                  <g key={dy}>
                    <ellipse cx='-3.8' cy={dy} rx='3.3' ry='6.5' fill={palette.accent} transform={`rotate(-35 -3.8 ${dy})`}/>
                    <ellipse cx='3.8' cy={dy+1} rx='3.3' ry='6.5' fill={palette.accent} transform={`rotate(35 3.8 ${dy+1})`}/>
                  </g>
                ))}
                {crop==='barley' ? <g stroke='#9c8248' strokeWidth='.8' opacity='.9'>
                  {[-9,-5,-1,3,7].map((dy)=><path key={dy} d={`M-5 ${dy-2} L-13 ${dy-12} M5 ${dy-1} L13 ${dy-11}`}/>)}
                </g> : null}
                {crop==='rye' ? <path d='M0 -15 L0 -24' stroke='#6f673c' strokeWidth='1'/> : null}
              </g>
            </g>
          ))}
        </g>
      ) : crop==='oats' ? (
        <g stroke={palette.stem} strokeLinecap='round'>
          {[44,86,128].map((x,index)=>(
            <g key={x} transform={`translate(${x} 0)`}>
              <path d='M0 99 C-2 78 0 57 1 36' fill='none' strokeWidth='2.2'/>
              <path d='M1 48 L-15 36 M2 54 L17 41 M1 61 L-12 54 M2 66 L14 58' fill='none' strokeWidth='1.3'/>
              <g fill='#c9aa63' stroke='none'>
                <ellipse cx='-17' cy='34' rx='3.5' ry='6' transform='rotate(-24 -17 34)'/>
                <ellipse cx='19' cy='39' rx='3.5' ry='6' transform='rotate(22 19 39)'/>
                <ellipse cx='-14' cy='52' rx='3.2' ry='5.5' transform='rotate(-20 -14 52)'/>
                <ellipse cx='16' cy='56' rx='3.2' ry='5.5' transform='rotate(20 16 56)'/>
              </g>
              {index===1?<path d='M0 75 C-12 67 -17 65 -23 67 C-15 75 -8 78 0 80' fill={palette.leaf} stroke='none'/>:null}
            </g>
          ))}
        </g>
      ) : crop==='sunflower' ? (
        <g>
          <path d='M92 101 C89 78 91 54 94 30' stroke={palette.stem} strokeWidth='4.5' fill='none' strokeLinecap='round'/>
          <path d='M92 72 C75 62 64 61 54 65 C66 78 79 82 92 80' fill={palette.leaf}/>
          <path d='M93 61 C108 50 122 49 134 54 C124 67 110 72 94 69' fill='#5f8e61'/>
          <g transform='translate(95 29)' fill={palette.accent}>
            {[0,30,60,90,120,150].map((angle)=><ellipse key={angle} rx='7' ry='20' transform={`rotate(${angle})`}/>)}
          </g>
          <circle cx='95' cy='29' r='13.5' fill='#76502d'/>
          <circle cx='95' cy='29' r='9.5' fill='#94703c'/>
          <g fill='#4f3927' opacity='.55'>
            <circle cx='91' cy='25' r='1.2'/><circle cx='98' cy='24' r='1.2'/><circle cx='101' cy='30' r='1.2'/><circle cx='93' cy='32' r='1.2'/>
          </g>
        </g>
      ) : crop==='corn' ? (
        <g>
          <path d='M91 102 C88 77 89 50 92 22' stroke={palette.stem} strokeWidth='5' fill='none' strokeLinecap='round'/>
          <path d='M90 79 C67 62 52 59 38 65 C53 82 69 88 91 89' fill={palette.leaf}/>
          <path d='M91 65 C111 47 129 44 145 51 C132 70 112 78 91 77' fill='#54865b'/>
          <path d='M91 48 C78 38 70 34 60 34 C69 47 78 52 91 55' fill='#6e9b66'/>
          <ellipse cx='98' cy='54' rx='11.5' ry='25' fill={palette.accent} transform='rotate(7 98 54)'/>
          <g fill='#b58e36' opacity='.7'>
            {[43,50,57,64].map((cy)=><g key={cy}><circle cx='94' cy={cy} r='1.5'/><circle cx='100' cy={cy+1} r='1.5'/><circle cx='104' cy={cy-1} r='1.4'/></g>)}
          </g>
          <path d='M87 72 C89 55 90 42 87 31 C78 45 77 59 87 72 M108 72 C107 55 107 42 112 32 C120 48 118 62 108 72' fill='#699761'/>
          <path d='M98 30 C103 23 107 20 112 18' stroke='#8b5f38' strokeWidth='1.5' fill='none'/>
        </g>
      ) : crop==='soybean' ? (
        <g>
          <path d='M89 101 C88 79 88 57 91 34 M89 66 L65 48 M90 72 L116 52 M89 82 L70 76' stroke={palette.stem} strokeWidth='3' fill='none' strokeLinecap='round'/>
          <g fill={palette.leaf}>
            <ellipse cx='61' cy='45' rx='15' ry='7.5' transform='rotate(26 61 45)'/><ellipse cx='72' cy='43' rx='13' ry='6.5' transform='rotate(-18 72 43)'/>
            <ellipse cx='119' cy='49' rx='15' ry='7.5' transform='rotate(-25 119 49)'/><ellipse cx='108' cy='46' rx='13' ry='6.5' transform='rotate(18 108 46)'/>
            <ellipse cx='67' cy='74' rx='13' ry='6.5' transform='rotate(12 67 74)'/>
          </g>
          <g fill='#9eb06d' stroke='#607550' strokeWidth='1'>
            <rect x='54' y='54' width='25' height='9' rx='5' transform='rotate(19 54 54)'/><rect x='105' y='62' width='26' height='9' rx='5' transform='rotate(-19 105 62)'/><rect x='73' y='82' width='23' height='8' rx='4' transform='rotate(7 73 82)'/>
          </g>
          <g fill='#6f854f' opacity='.8'><circle cx='64' cy='60' r='1.3'/><circle cx='71' cy='61' r='1.3'/><circle cx='116' cy='68' r='1.3'/><circle cx='123' cy='66' r='1.3'/></g>
        </g>
      ) : (
        <g>
          <path d='M91 101 C89 78 91 55 93 31 M91 70 L67 54 M92 61 L118 46 M91 79 L112 70' stroke={palette.stem} strokeWidth='3' fill='none' strokeLinecap='round'/>
          <path d='M91 75 C77 69 67 68 57 71 C67 79 78 82 91 83' fill={palette.leaf}/>
          <path d='M92 63 C107 55 119 55 130 59 C120 68 107 71 93 70' fill='#668e62'/>
          <g fill={palette.accent}>
            {[[64,50],[71,46],[75,54],[114,42],[121,47],[116,53],[91,31],[96,36],[86,37]].map(([cx,cy])=><circle key={`${cx}-${cy}`} cx={cx} cy={cy} r='4.6'/>)}
          </g>
          <g fill='#fff2a8' opacity='.7'>
            <circle cx='64' cy='50' r='1.5'/><circle cx='71' cy='46' r='1.5'/><circle cx='114' cy='42' r='1.5'/><circle cx='91' cy='31' r='1.5'/>
          </g>
        </g>
      )}
      <path d='M0 106 H180' stroke='rgba(255,255,255,.55)' strokeWidth='1'/>
    </svg>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}
function Row({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}
function Detail({ title, text }: { title: string; text: string }) {
  return <article className='pc-cp-card pc-cp-detail-block'><h3>{title}</h3><p>{text}</p></article>;
}
function cultureLabel(value: string, locale: CanonicalPublicLocale) {
  const key = value.trim().toLowerCase();
  const maps: Record<CanonicalPublicLocale, Record<string,string>> = {
    ru: { wheat:'Пшеница',barley:'Ячмень',corn:'Кукуруза',maize:'Кукуруза',sunflower:'Подсолнечник',soybean:'Соя',soy:'Соя',rapeseed:'Рапс',rye:'Рожь',oats:'Овёс' },
    en: { wheat:'Wheat',barley:'Barley',corn:'Corn',maize:'Maize',sunflower:'Sunflower',soybean:'Soybean',soy:'Soy',rapeseed:'Rapeseed',rye:'Rye',oats:'Oats' },
    zh: { wheat:'小麦',barley:'大麦',corn:'玉米',maize:'玉米',sunflower:'向日葵',soybean:'大豆',soy:'大豆',rapeseed:'油菜籽',rye:'黑麦',oats:'燕麦' },
  };
  return maps[locale][key] ?? value.trim().replace(/[_-]+/g,' ');
}
function formatVolume(value: string, locale: CanonicalPublicLocale) {
  const normalized = locale === 'ru' ? value.replace('.', ',') : value;
  return locale === 'zh' ? `${normalized} 吨` : `${normalized} ${locale === 'en' ? 't' : 'т'}`;
}
function formatPrice(value: string, locale: CanonicalPublicLocale) {
  try {
    const kopecks = BigInt(value);
    const rubles = kopecks / 100n;
    const remainder = kopecks % 100n;
    const formatter = new Intl.NumberFormat(locale === 'en' ? 'en-US' : locale === 'zh' ? 'zh-CN' : 'ru-RU');
    const decimal = remainder === 0n ? '' : `${locale === 'ru' ? ',' : '.'}${remainder.toString().padStart(2,'0')}`;
    return `${formatter.format(rubles)}${decimal} ₽/${locale === 'zh' ? '吨' : locale === 'en' ? 't' : 'т'}`;
  } catch {
    return locale === 'ru' ? 'Недоступно' : locale === 'en' ? 'Unavailable' : '不可用';
  }
}
function formatRemaining(value: string, locale: CanonicalPublicLocale) {
  const target = new Date(value).getTime();
  const remaining = target - Date.now();
  if (!Number.isFinite(target) || remaining <= 0) {
    return locale === 'ru' ? 'Закрыто' : locale === 'en' ? 'Closed' : '已关闭';
  }
  const totalMinutes = Math.max(1, Math.ceil(remaining / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (locale === 'zh') {
    if (days > 0) return `${days}天 ${hours}小时`;
    if (hours > 0) return `${hours}小时 ${minutes}分`;
    return `${minutes}分`;
  }
  if (locale === 'en') {
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
  if (days > 0) return `${days} д ${hours} ч`;
  if (hours > 0) return `${hours} ч ${minutes} мин`;
  return `${minutes} мин`;
}
function formatObserved(value: string, locale: CanonicalPublicLocale) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale === 'zh' ? 'zh-CN' : 'ru-RU', { day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow' }).format(new Date(value));
}
