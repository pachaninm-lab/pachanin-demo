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
    ends: 'Торги до',
    details: 'Войти и посмотреть',
    access: 'Доступ к торгам',
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
    ends: 'Bidding until',
    details: 'Sign in and view',
    access: 'Trading access',
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
    ends: '竞价截止',
    details: '登录查看',
    access: '获取交易权限',
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
  selectedIndex,
}: {
  locale: string;
  query?: string;
  selectedIndex?: number | null;
}) {
  const lang = canonicalPublicLocale(locale);
  const market = await getPublicMarketLots();
  if (!market.available) return <MarketEmptyLayout locale={lang} kind='unavailable' />;
  if (market.items.length === 0) return <MarketEmptyLayout locale={lang} kind='empty' />;

  const normalizedQuery = query.trim().toLocaleLowerCase(lang === 'ru' ? 'ru-RU' : lang === 'zh' ? 'zh-CN' : 'en-US');
  const indexed = market.items.map((lot, index) => ({ lot, index }));
  const items = normalizedQuery
    ? indexed.filter(({ lot }) => [lot.culture, lot.grade || '', lot.region].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)))
    : indexed;

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
        <div className='pc-cp-lot-image' role='img' aria-label={lang === 'ru' ? 'Иллюстрация культуры, фото партии не опубликовано' : lang === 'en' ? 'Crop illustration; lot photo not published' : '作物示意图；批次照片未公开'}>
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
            <Metric label={copy.ends} value={formatDate(lot.auctionEndsAt, lang)} />
          </div>
          <div className='pc-cp-actions'>
            <a className='pc-cp-button' href={`/platform-v7/register?lang=${lang}&intent=buy`}>{copy.access}<ArrowRight size={16} aria-hidden='true' /></a>
            <a className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/login?lang=${lang}`}>{copy.details}</a>
          </div>
          <small className='pc-cp-lot-source'>{copy.source}{market.authority?.observedAt ? ` · ${formatObserved(market.authority.observedAt, lang)}` : ''}</small>
        </article>
      </div>

      <div className='pc-cp-lot-detail-grid'>
        <Detail title={lang === 'ru' ? 'Основные параметры' : lang === 'en' ? 'Core parameters' : '主要参数'} text={`${copy.volume}: ${formatVolume(lot.volumeTons, lang)} · ${copy.region}: ${lot.region} · ${copy.ends}: ${formatDate(lot.auctionEndsAt, lang)}`} />
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
  const registerHref = `/platform-v7/register?lang=${locale}&intent=buy`;
  const detailHref = `/platform-v7/market?lang=${locale}&lot=${publicIndex}`;
  return (
    <article className='pc-cp-card pc-cp-lot-card' data-selected={selected ? 'true' : undefined}>
      <div className='pc-cp-lot-media'>{copy.photo}</div>
      <div className='pc-cp-lot-body'>
        <div>
          <span className='pc-cp-chip'><LockKeyhole size={12} aria-hidden='true' />{copy.hidden}</span>
          <div className='pc-cp-lot-title'>{cultureLabel(lot.culture, locale)}{lot.grade ? ` · ${lot.grade}` : ''}</div>
        </div>
        <div className='pc-cp-lot-meta'>
          <Metric label={copy.volume} value={formatVolume(lot.volumeTons, locale)} />
          <Metric label={copy.price} value={formatPrice(lot.startPriceKopecksPerTon, locale)} />
          <Metric label={copy.region} value={lot.region} />
          <Metric label={copy.ends} value={formatDate(lot.auctionEndsAt, locale)} />
        </div>
        <div className='pc-cp-lot-foot'><span><ShieldCheck size={13} aria-hidden='true' /> {copy.declared}</span></div>
        <div className='pc-cp-actions' data-testid='canonical-public-market-lot-actions'>
          <a className='pc-cp-button pc-cp-button--secondary' href={detailHref}>{locale === 'ru' ? 'Подробнее' : locale === 'en' ? 'Details' : '详情'}<ArrowRight size={15} aria-hidden='true' /></a>
          <a className='pc-cp-button' href={registerHref}>{copy.access}</a>
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
        <Row label={copy.ends} value={formatDate(lot.auctionEndsAt, locale)} />
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
  return (
    <article className='pc-cp-card pc-cp-lot-card pc-cp-lot-card--empty' aria-label={unavailable}>
      <div className='pc-cp-lot-media pc-cp-lot-media--empty' data-visual-index={index} aria-hidden='true'/>
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
function formatDate(value: string, locale: CanonicalPublicLocale) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale === 'zh' ? 'zh-CN' : 'ru-RU', { day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow' }).format(new Date(value));
}
function formatObserved(value: string, locale: CanonicalPublicLocale) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale === 'zh' ? 'zh-CN' : 'ru-RU', { day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow' }).format(new Date(value));
}
