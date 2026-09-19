import { Suspense } from 'react';
import { ArrowRight, Clock3, LockKeyhole, MapPin, ShieldCheck } from 'lucide-react';
import { getPublicMarketLots, type PublicMarketLot } from '@/lib/public-market-server';
import styles from './PublicMarketTeaser.module.css';

type Locale = 'ru' | 'en' | 'zh';

const COPY = {
  ru: {
    eyebrow: 'Рынок сейчас',
    title: 'Опубликованные лоты фермеров',
    lead: 'Обезличенные лоты, разрешённые к публикации в торговом контуре платформы. Продавец и внутренние идентификаторы не раскрываются.',
    sellerHidden: 'Продавец скрыт',
    declared: 'Наличие: заявлено продавцом',
    unverified: 'Качество: по данным продавца',
    volume: 'Объём',
    startPrice: 'Стартовая цена',
    ends: 'Торги до',
    grade: 'Класс / сорт',
    fullAccess: 'Для участия потребуется регистрация и проверка организации.',
    details: 'Войти и посмотреть',
    bid: 'Получить доступ к торгам',
    register: 'Получить доступ к торгам',
    login: 'Войти',
    source: 'Источник факта: торговый контур платформы',
    loading: 'Загружаем актуальные лоты…',
    emptyTitle: 'Активных опубликованных лотов сейчас нет',
    emptyText: 'После регистрации продавец может разместить товар и опубликовать разрешённый к показу лот.',
    degradedTitle: 'Рынок временно недоступен',
    degradedText: 'Публикация лотов приостановлена до восстановления подтверждённого источника. Регистрация и вход остаются доступны.',
  },
  en: {
    eyebrow: 'Market now',
    title: 'Published farmer lots',
    lead: 'Anonymised lots admitted for publication in the platform trading circuit. Seller identity and internal identifiers are not disclosed.',
    sellerHidden: 'Seller hidden',
    declared: 'Availability: declared by seller',
    unverified: 'Quality: seller-provided data',
    volume: 'Volume',
    startPrice: 'Starting price',
    ends: 'Bidding until',
    grade: 'Grade',
    fullAccess: 'Participation requires registration and organisation verification.',
    details: 'Sign in and view',
    bid: 'Get trading access',
    register: 'Get trading access',
    login: 'Sign in',
    source: 'Fact source: platform trading circuit',
    loading: 'Loading current lots…',
    emptyTitle: 'No active published lots right now',
    emptyText: 'After registration, a seller can list product and publish a lot admitted for public display.',
    degradedTitle: 'Market is temporarily unavailable',
    degradedText: 'Lot publication is paused until the confirmed source is restored. Registration and sign-in remain available.',
  },
  zh: {
    eyebrow: '当前市场',
    title: '农户已发布批次',
    lead: '展示获准在平台交易闭环公开的匿名批次；卖方身份和内部标识不会披露。',
    sellerHidden: '卖方已隐藏',
    declared: '库存：卖方申报',
    unverified: '质量：卖方提供的数据',
    volume: '数量',
    startPrice: '起始价格',
    ends: '竞价截止',
    grade: '等级',
    fullAccess: '参与交易需要完成注册和机构审核。',
    details: '登录查看',
    bid: '获取交易权限',
    register: '获取交易权限',
    login: '登录',
    source: '事实来源：平台交易闭环',
    loading: '正在加载当前批次…',
    emptyTitle: '当前没有有效的公开批次',
    emptyText: '注册后，卖方可以发布商品，并公开符合展示条件的批次。',
    degradedTitle: '市场暂时不可用',
    degradedText: '在已确认的数据源恢复前，批次发布会暂停；注册和登录仍可使用。',
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
  const registerHref = `/platform-v7/register?lang=${encodeURIComponent(lang)}&intent=buy`;
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
  const items = market.items;

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
  const registerHref = `/platform-v7/register?lang=${encodeURIComponent(locale)}&intent=buy`;
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
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow', timeZoneName: 'short',
  }).format(new Date(value));
}
