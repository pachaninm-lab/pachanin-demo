import { Suspense } from 'react';
import { ArrowRight, Clock3, LockKeyhole, MapPin, ShieldCheck } from 'lucide-react';
import { getPublicMarketLots, type PublicMarketLot } from '@/lib/public-market-server';
import styles from './PublicMarketTeaser.module.css';

type Locale = 'ru' | 'en' | 'zh';

const COPY = {
  ru: {
    eyebrow: 'Рынок сейчас',
    title: 'Опубликованные лоты фермеров',
    lead: 'На главной показываются только разрешённые к публикации лоты из канонического контура торгов. Продавец и внутренние идентификаторы скрыты.',
    sellerHidden: 'Продавец скрыт',
    declared: 'Наличие заявлено продавцом',
    unverified: 'Независимое подтверждение не получено',
    volume: 'Объём',
    startPrice: 'Стартовая цена',
    ends: 'Торги до',
    grade: 'Класс / сорт',
    fullAccess: 'Полная карточка, контрагент, предложение и ставка доступны только после входа.',
    details: 'Подробнее после входа',
    bid: 'Сделать ставку',
    register: 'Зарегистрироваться',
    login: 'Войти',
    source: 'Источник: PostgreSQL · обезличенная публичная проекция',
    loading: 'Загружаем актуальные лоты…',
    emptyTitle: 'Активных опубликованных лотов сейчас нет',
    emptyText: 'Демо-лоты не подставляются. После регистрации фермер может опубликовать лот из своей канонической партии.',
    degradedTitle: 'Рынок временно недоступен',
    degradedText: 'Платформа не показывает вымышленные карточки при сбое источника. Регистрация и вход остаются доступны.',
  },
  en: {
    eyebrow: 'Market now',
    title: 'Published farmer lots',
    lead: 'The home page shows only lots admitted for publication by the canonical trading authority. Seller identity and internal identifiers stay hidden.',
    sellerHidden: 'Seller hidden',
    declared: 'Availability declared by seller',
    unverified: 'No independent verification recorded',
    volume: 'Volume',
    startPrice: 'Starting price',
    ends: 'Bidding until',
    grade: 'Grade',
    fullAccess: 'Full lot details, counterparty, offers and bidding require sign-in.',
    details: 'View details after sign-in',
    bid: 'Place a bid',
    register: 'Register',
    login: 'Sign in',
    source: 'Source: PostgreSQL · anonymized public projection',
    loading: 'Loading current lots…',
    emptyTitle: 'No active published lots right now',
    emptyText: 'No demo lots are substituted. After registration, a farmer can publish a lot from canonical inventory.',
    degradedTitle: 'Market is temporarily unavailable',
    degradedText: 'The platform does not show fabricated cards when the authority is unavailable. Registration and sign-in remain available.',
  },
  zh: {
    eyebrow: '当前市场',
    title: '农户已发布批次',
    lead: '首页仅展示经规范交易权限允许公开的批次；卖方身份和内部标识不会公开。',
    sellerHidden: '卖方已隐藏',
    declared: '库存由卖方申报',
    unverified: '尚无独立核验记录',
    volume: '数量',
    startPrice: '起始价格',
    ends: '竞价截止',
    grade: '等级',
    fullAccess: '完整批次、交易方、报价和竞价功能仅在登录后开放。',
    details: '登录后查看详情',
    bid: '参与竞价',
    register: '注册',
    login: '登录',
    source: '来源：PostgreSQL · 匿名公开投影',
    loading: '正在加载当前批次…',
    emptyTitle: '当前没有有效的公开批次',
    emptyText: '系统不会填充演示批次。注册后，农户可从规范库存中发布批次。',
    degradedTitle: '市场暂时不可用',
    degradedText: '权威数据源不可用时，平台不会展示虚构卡片；注册和登录仍可使用。',
  },
} as const;

const CULTURES: Record<Locale, Record<string, string>> = {
  ru: { wheat: 'Пшеница', barley: 'Ячмень', corn: 'Кукуруза', maize: 'Кукуруза', sunflower: 'Подсолнечник', soybean: 'Соя', soy: 'Соя', rapeseed: 'Рапс', rye: 'Рожь', oats: 'Овёс' },
  en: { wheat: 'Wheat', barley: 'Barley', corn: 'Corn', maize: 'Maize', sunflower: 'Sunflower', soybean: 'Soybean', soy: 'Soy', rapeseed: 'Rapeseed', rye: 'Rye', oats: 'Oats' },
  zh: { wheat: '小麦', barley: '大麦', corn: '玉米', maize: '玉米', sunflower: '向日葵', soybean: '大豆', soy: '大豆', rapeseed: '油菜籽', rye: '黑麦', oats: '燕麦' },
};

export function PublicMarketTeaser({ locale }: { locale: string }) {
  const lang = localeOf(locale);
  const copy = COPY[lang];
  const registerHref = `/platform-v7/register?lang=${encodeURIComponent(lang)}`;
  const loginHref = `/platform-v7/login?lang=${encodeURIComponent(lang)}`;

  return (
    <section id='market' className={styles.section} aria-labelledby='public-market-title' data-testid='public-market-teaser'>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>{copy.eyebrow}</span>
          <h2 id='public-market-title'>{copy.title}</h2>
          <p>{copy.lead}</p>
        </div>
        <div className={styles.accessNote}>
          <LockKeyhole aria-hidden='true' size={18} />
          <span>{copy.fullAccess}</span>
        </div>
      </div>

      <Suspense fallback={<MarketLoading text={copy.loading} />}>
        <PublicMarketLotResults locale={lang} />
      </Suspense>

      <div className={styles.footer}>
        <div className={styles.source}>
          <ShieldCheck aria-hidden='true' size={17} />
          <span>{copy.source}</span>
        </div>
        <div className={styles.actions}>
          <a className={styles.secondary} href={loginHref}>{copy.login}</a>
          <a className={styles.primary} href={registerHref}>{copy.register}<ArrowRight aria-hidden='true' size={17} /></a>
        </div>
      </div>
    </section>
  );
}

async function PublicMarketLotResults({ locale }: { locale: Locale }) {
  const copy = COPY[locale];
  const market = await getPublicMarketLots();
  const items = market.items.slice(0, 6);

  if (!market.available) {
    return <MarketState title={copy.degradedTitle} text={copy.degradedText} />;
  }
  if (items.length === 0) {
    return <MarketState title={copy.emptyTitle} text={copy.emptyText} />;
  }
  return (
    <div className={styles.grid}>
      {items.map((lot) => (
        <LotCard key={lot.publicRef} lot={lot} locale={locale} />
      ))}
    </div>
  );
}

function LotCard({ lot, locale }: { lot: PublicMarketLot; locale: Locale }) {
  const copy = COPY[locale];
  const culture = cultureLabel(lot.culture, locale);
  const registerHref = `/platform-v7/register?lang=${encodeURIComponent(locale)}`;
  const loginHref = `/platform-v7/login?lang=${encodeURIComponent(locale)}`;
  return (
    <article className={styles.card} data-testid='public-market-lot-card'>
      <div className={styles.cardTop}>
        <div>
          <span className={styles.culture}>{culture}</span>
          {lot.grade ? <strong>{copy.grade}: {lot.grade}</strong> : null}
        </div>
        <span className={styles.privateBadge}><LockKeyhole aria-hidden='true' size={13} />{copy.sellerHidden}</span>
      </div>

      <div className={styles.metrics}>
        <div><span>{copy.volume}</span><strong>{formatVolume(lot.volumeTons, locale)}</strong></div>
        <div><span>{copy.startPrice}</span><strong>{formatPrice(lot.startPriceKopecksPerTon, locale)}</strong></div>
      </div>

      <div className={styles.meta}>
        <span><MapPin aria-hidden='true' size={15} />{lot.region}</span>
        <span><Clock3 aria-hidden='true' size={15} />{copy.ends}: {formatDate(lot.auctionEndsAt, locale)}</span>
      </div>

      <div className={styles.disclosure}>
        <ShieldCheck aria-hidden='true' size={16} />
        <span><b>{copy.declared}</b><small>{copy.unverified}</small></span>
      </div>

      <div className={styles.meta} data-testid='public-market-lot-actions'>
        <div className={styles.actions}>
          <a className={styles.secondary} href={loginHref}>{copy.details}</a>
          <a className={styles.primary} href={registerHref}>{copy.bid}<ArrowRight aria-hidden='true' size={16} /></a>
        </div>
      </div>
    </article>
  );
}

function MarketLoading({ text }: { text: string }) {
  return (
    <div className={styles.state} data-testid='public-market-teaser-loading' aria-busy='true'>
      <ShieldCheck aria-hidden='true' size={22} />
      <div><strong>{text}</strong></div>
    </div>
  );
}

function MarketState({ title, text }: { title: string; text: string }) {
  return (
    <div className={styles.state} data-testid='public-market-teaser-state'>
      <ShieldCheck aria-hidden='true' size={22} />
      <div><strong>{title}</strong><span>{text}</span></div>
    </div>
  );
}

function localeOf(locale: string): Locale {
  return locale === 'en' || locale === 'zh' ? locale : 'ru';
}

function cultureLabel(value: string, locale: Locale): string {
  const key = value.trim().toLowerCase();
  return CULTURES[locale][key] ?? value.trim().replace(/[_-]+/g, ' ');
}

function formatVolume(value: string, locale: Locale): string {
  const normalized = locale === 'ru' ? value.replace('.', ',') : value;
  return locale === 'zh' ? `${normalized} 吨` : `${normalized} ${locale === 'en' ? 't' : 'т'}`;
}

function formatPrice(value: string, locale: Locale): string {
  const kopecks = BigInt(value);
  const rubles = kopecks / 100n;
  const remainder = kopecks % 100n;
  const formatter = new Intl.NumberFormat(locale === 'en' ? 'en-US' : locale === 'zh' ? 'zh-CN' : 'ru-RU');
  const base = formatter.format(rubles);
  const decimal = remainder === 0n ? '' : `${locale === 'ru' ? ',' : '.'}${remainder.toString().padStart(2, '0')}`;
  return `${base}${decimal} ₽/${locale === 'zh' ? '吨' : locale === 'en' ? 't' : 'т'}`;
}

function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale === 'zh' ? 'zh-CN' : 'ru-RU', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow',
  }).format(new Date(value));
}
