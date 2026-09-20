import Link from 'next/link';
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
    details: 'Открыть лот',
    access: 'Доступ к торгам',
    selected: 'Выбранный лот',
    source: 'Источник: публичная обезличенная проекция PostgreSQL',
    declared: 'Наличие заявлено продавцом',
    quality: 'Качество — по данным продавца',
    emptyTitle: 'Активных опубликованных лотов сейчас нет',
    emptyText: 'Публичный рынок показывает только лоты, которые сервер разрешил к обезличенной публикации.',
    unavailableTitle: 'Рынок временно недоступен',
    unavailableText: 'Сервер не подтвердил актуальную публичную проекцию. Мы не подменяем её примерными данными.',
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
    details: 'Open lot',
    access: 'Trading access',
    selected: 'Selected lot',
    source: 'Source: public anonymised PostgreSQL projection',
    declared: 'Availability declared by seller',
    quality: 'Quality — seller-provided data',
    emptyTitle: 'No active published lots right now',
    emptyText: 'The public market shows only lots the server has admitted to anonymised publication.',
    unavailableTitle: 'Market is temporarily unavailable',
    unavailableText: 'The server did not confirm a current public projection. We do not replace it with sample data.',
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
    details: '打开批次',
    access: '获取交易权限',
    selected: '所选批次',
    source: '来源：PostgreSQL 公共匿名投影',
    declared: '库存由卖方申报',
    quality: '质量 — 卖方提供的数据',
    emptyTitle: '当前没有有效的公开批次',
    emptyText: '公开市场仅展示服务器允许匿名公开的批次。',
    unavailableTitle: '市场暂时不可用',
    unavailableText: '服务器未确认当前公共投影；我们不会用示例数据替代。',
    noMatchTitle: '未找到匹配批次',
    noMatchText: '修改搜索条件或返回全部已发布批次。',
  },
} as const;

export async function CanonicalMarketPreview({ locale, limit = 3 }: { locale: string; limit?: number }) {
  const lang = canonicalPublicLocale(locale);
  const market = await getPublicMarketLots();
  if (!market.available) return <MarketState locale={lang} kind='unavailable' />;
  if (market.items.length === 0) return <MarketState locale={lang} kind='empty' />;
  return (
    <div className='pc-cp-market-grid pc-cp-market-grid--preview' data-testid='canonical-market-preview'>
      {market.items.slice(0, limit).map((lot) => <MarketCard key={lot.publicRef} lot={lot} locale={lang} />)}
    </div>
  );
}

export async function CanonicalMarketResults({
  locale,
  query = '',
  selectedRef,
}: {
  locale: string;
  query?: string;
  selectedRef?: string;
}) {
  const lang = canonicalPublicLocale(locale);
  const market = await getPublicMarketLots();
  if (!market.available) return <MarketState locale={lang} kind='unavailable' />;
  if (market.items.length === 0) return <MarketState locale={lang} kind='empty' />;

  const normalizedQuery = query.trim().toLocaleLowerCase(lang === 'ru' ? 'ru-RU' : lang === 'zh' ? 'zh-CN' : 'en-US');
  const items = normalizedQuery
    ? market.items.filter((lot) => [lot.culture, lot.grade || '', lot.region].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)))
    : market.items;

  if (items.length === 0) return <MarketState locale={lang} kind='noMatch' />;

  const selected = items.find((lot) => lot.publicRef === selectedRef) ?? items[0]!;
  return (
    <div className='pc-cp-market-layout' data-testid='canonical-market-results'>
      <div className='pc-cp-market-grid'>
        {items.map((lot) => <MarketCard key={lot.publicRef} lot={lot} locale={lang} selected={lot.publicRef === selected.publicRef} />)}
      </div>
      <MarketAside lot={selected} locale={lang} authority={market} />
    </div>
  );
}

export async function CanonicalPublicLotDetail({ locale, publicRef }: { locale: string; publicRef: string }) {
  const lang = canonicalPublicLocale(locale);
  const market = await getPublicMarketLots();
  if (!market.available) return <MarketState locale={lang} kind='unavailable' />;
  const lot = market.items.find((item) => item.publicRef === publicRef);
  if (!lot) return <MarketState locale={lang} kind='empty' />;
  const copy = COPY[lang];
  const suffix = `?lang=${lang}`;

  return (
    <>
      <section className='pc-cp-lot-hero'>
        <div className='pc-cp-container'>
          <div className='pc-cp-lot-layout'>
            <div className='pc-cp-lot-image' role='img' aria-label={copy.photo}>{copy.photo}</div>
            <article className='pc-cp-card pc-cp-lot-summary'>
              <div>
                <span className='pc-cp-chip'><LockKeyhole size={13} aria-hidden='true' />{copy.hidden}</span>
                <h1>{cultureLabel(lot.culture, lang)}{lot.grade ? ` · ${lot.grade}` : ''}</h1>
              </div>
              <div className='pc-cp-lot-meta'>
                <Metric label={copy.volume} value={formatVolume(lot.volumeTons, lang)} />
                <Metric label={copy.price} value={formatPrice(lot.startPriceKopecksPerTon, lang)} />
                <Metric label={copy.region} value={lot.region} />
                <Metric label={copy.ends} value={formatDate(lot.auctionEndsAt, lang)} />
              </div>
              <div className='pc-cp-actions'>
                <Link className='pc-cp-button' href={`/platform-v7/register${suffix}&intent=buy`}>{copy.access}<ArrowRight size={16} aria-hidden='true' /></Link>
                <Link className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/market${suffix}`}>{lang === 'ru' ? 'Назад на рынок' : lang === 'en' ? 'Back to market' : '返回市场'}</Link>
              </div>
              <small className='pc-cp-lead' style={{ fontSize: 12 }}>{copy.source}</small>
            </article>
          </div>
        </div>
      </section>

      <section className='pc-cp-section'>
        <div className='pc-cp-container'>
          <div className='pc-cp-section-head'>
            <span className='pc-cp-eyebrow'>{lang === 'ru' ? 'Публичные данные лота' : lang === 'en' ? 'Public lot data' : '公开批次数据'}</span>
            <h2>{lang === 'ru' ? 'Только подтверждённая публичная проекция' : lang === 'en' ? 'Only the confirmed public projection' : '仅展示已确认的公开投影'}</h2>
            <p>{lang === 'ru' ? 'Данные организации, внутренние идентификаторы, документы и непубличные условия сделки здесь намеренно не раскрываются.' : lang === 'en' ? 'Organisation data, internal identifiers, documents and non-public Deal terms are intentionally not exposed here.' : '机构数据、内部标识、文件和非公开交易条件不会在此披露。'}</p>
          </div>
          <div className='pc-cp-detail-grid'>
            <Detail title={copy.declared} text={lang === 'ru' ? 'Статус PUBLIC_ALLOWED подтверждён серверной публичной проекцией.' : lang === 'en' ? 'PUBLIC_ALLOWED is confirmed by the server-side public projection.' : 'PUBLIC_ALLOWED 状态由服务器端公共投影确认。'} />
            <Detail title={copy.quality} text={lang === 'ru' ? 'Независимая верификация в публичной проекции отсутствует; интерфейс не выдаёт её за выполненную.' : lang === 'en' ? 'No independent verification is present in the public projection; the UI does not imply otherwise.' : '公共投影中没有独立核验；界面不会暗示已完成核验。'} />
            <Detail title={lang === 'ru' ? 'Логистика' : lang === 'en' ? 'Logistics' : '物流'} text={unpublished(lang)} />
            <Detail title={lang === 'ru' ? 'Документы и расчёт' : lang === 'en' ? 'Documents and settlement' : '文件与结算'} text={unpublished(lang)} />
          </div>
        </div>
      </section>
    </>
  );
}

function MarketCard({ lot, locale, selected = false }: { lot: PublicMarketLot; locale: CanonicalPublicLocale; selected?: boolean }) {
  const copy = COPY[locale];
  const suffix = `?lang=${locale}`;
  return (
    <Link className='pc-cp-card pc-cp-lot-card' href={`/platform-v7/market/${encodeURIComponent(lot.publicRef)}${suffix}`} data-selected={selected ? 'true' : undefined}>
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
        <div className='pc-cp-lot-foot'><span><ShieldCheck size={13} aria-hidden='true' /> {copy.declared}</span><strong>{copy.details} →</strong></div>
      </div>
    </Link>
  );
}

function MarketAside({ lot, locale, authority }: { lot: PublicMarketLot; locale: CanonicalPublicLocale; authority: PublicMarketReadResult }) {
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
      <Link className='pc-cp-button' href={`/platform-v7/market/${encodeURIComponent(lot.publicRef)}?lang=${locale}`}>{copy.details}<ArrowRight size={16} aria-hidden='true' /></Link>
      <small style={{ color: 'var(--pc-cp-muted)', lineHeight: 1.45 }}>{copy.source}{authority.authority?.observedAt ? ` · ${formatObserved(authority.authority.observedAt, locale)}` : ''}</small>
    </aside>
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
function unpublished(locale: CanonicalPublicLocale) {
  return locale === 'ru' ? 'Не опубликовано в публичном контуре. Детали доступны только авторизованным участникам с подтверждёнными полномочиями.' : locale === 'en' ? 'Not published in the public circuit. Details are available only to authorised participants with confirmed authority.' : '未在公开范围发布。详细信息仅向已确认权限的授权参与方开放。';
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
