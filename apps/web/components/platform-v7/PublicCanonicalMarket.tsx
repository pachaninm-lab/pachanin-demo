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
  selectedIndex,
}: {
  locale: string;
  query?: string;
  filters?: Readonly<{ crop?: string; region?: string; grade?: string }>;
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
  const items = indexed.filter(({ lot }) => {
    const searchable = [lot.culture, cultureLabel(lot.culture, lang), lot.grade || '', lot.region]
      .map((value) => value.toLocaleLowerCase(localeTag));
    if (normalizedQuery && !searchable.some((value) => value.includes(normalizedQuery))) return false;
    if (crop && cropVisualKey(lot.culture) !== crop) return false;
    if (region && !lot.region.toLocaleLowerCase(localeTag).includes(region)) return false;
    if (grade && !(lot.grade || '').toLocaleLowerCase(localeTag).includes(grade)) return false;
    return true;
  });

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
  const cereal=crop==='wheat'||crop==='barley'||crop==='rye'||crop==='oats'||crop==='generic';
  return (
    <svg className='pc-cp-crop-art' viewBox='0 0 180 110' preserveAspectRatio='xMidYMid slice' focusable='false' aria-hidden='true'>
      <path d='M0 82 C34 64 63 75 92 65 C123 54 150 61 180 45 V110 H0 Z' fill='#dceadb'/>
      <path d='M0 92 C36 77 71 87 103 76 C137 65 159 72 180 62 V110 H0 Z' fill='#bdd5bf' opacity='.9'/>
      {cereal ? <>
        <g stroke='#4e704c' strokeWidth='2.4' strokeLinecap='round'>
          <path d='M39 92 L48 35'/><path d='M66 96 L72 27'/><path d='M94 92 L101 39'/><path d='M124 96 L131 31'/><path d='M148 89 L151 45'/>
        </g>
        <g fill='#caa451'>
          <ellipse cx='48' cy='35' rx='5' ry='12' transform='rotate(-16 48 35)'/><ellipse cx='72' cy='27' rx='5' ry='13' transform='rotate(8 72 27)'/>
          <ellipse cx='101' cy='39' rx='5' ry='12' transform='rotate(-10 101 39)'/><ellipse cx='131' cy='31' rx='5' ry='13' transform='rotate(12 131 31)'/><ellipse cx='151' cy='45' rx='5' ry='11' transform='rotate(-5 151 45)'/>
        </g>
      </> : crop==='sunflower' ? <>
        <path d='M91 96 C89 73 91 53 94 31' stroke='#3f704a' strokeWidth='4' fill='none' strokeLinecap='round'/>
        <path d='M92 71 C77 62 68 62 58 65 C68 75 78 79 92 79' fill='#5f935e'/>
        <path d='M93 60 C107 51 120 50 130 54 C121 65 109 69 94 68' fill='#4f8454'/>
        <g fill='#e4bd3f' transform='translate(95 29)'>
          <ellipse rx='8' ry='22' transform='rotate(0)'/><ellipse rx='8' ry='22' transform='rotate(45)'/><ellipse rx='8' ry='22' transform='rotate(90)'/><ellipse rx='8' ry='22' transform='rotate(135)'/>
        </g>
        <circle cx='95' cy='29' r='13' fill='#6c4b29'/><circle cx='95' cy='29' r='8' fill='#8d632d'/>
      </> : crop==='corn' ? <>
        <path d='M91 100 C87 78 88 50 91 25' stroke='#44784d' strokeWidth='5' fill='none' strokeLinecap='round'/>
        <path d='M90 72 C70 58 55 56 43 61 C56 77 71 83 90 83' fill='#5e955f'/>
        <path d='M91 62 C109 46 127 43 141 50 C128 67 110 74 91 74' fill='#4d8555'/>
        <ellipse cx='95' cy='54' rx='11' ry='24' fill='#d9ad3d' transform='rotate(7 95 54)'/>
        <path d='M84 69 C87 54 88 42 86 33 C78 43 75 58 84 69 M106 69 C105 54 105 42 109 34 C117 48 116 60 106 69' fill='#689b61'/>
      </> : crop==='soybean' ? <>
        <path d='M89 98 C88 78 87 58 90 37 M89 65 L67 49 M89 73 L113 55' stroke='#4b7a50' strokeWidth='3' fill='none' strokeLinecap='round'/>
        <g fill='#6ea26b'><ellipse cx='63' cy='47' rx='14' ry='7' transform='rotate(25 63 47)'/><ellipse cx='117' cy='53' rx='14' ry='7' transform='rotate(-24 117 53)'/><ellipse cx='76' cy='69' rx='12' ry='6' transform='rotate(-16 76 69)'/></g>
        <g fill='#98b36a' stroke='#54764c' strokeWidth='1'><rect x='57' y='55' width='24' height='9' rx='5' transform='rotate(18 57 55)'/><rect x='104' y='64' width='25' height='9' rx='5' transform='rotate(-18 104 64)'/></g>
      </> : <>
        <path d='M90 99 C88 77 90 55 92 34' stroke='#4a7b50' strokeWidth='3' fill='none' strokeLinecap='round'/>
        <path d='M90 70 L69 55 M91 61 L113 48' stroke='#4a7b50' strokeWidth='2.5' fill='none' strokeLinecap='round'/>
        <g fill='#e3c73a'><circle cx='66' cy='52' r='5'/><circle cx='73' cy='48' r='5'/><circle cx='111' cy='45' r='5'/><circle cx='118' cy='49' r='5'/><circle cx='91' cy='33' r='6'/></g>
      </>}
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
