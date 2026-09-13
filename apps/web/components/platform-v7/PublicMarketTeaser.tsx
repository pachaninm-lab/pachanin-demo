import { ArrowRight, BadgeCheck, Clock3, LockKeyhole, MapPin, Scale } from 'lucide-react';
import { getPublicMarketTeaser } from '@/lib/public-market-server';
import styles from './PublicMarketTeaser.module.css';

type Locale = 'ru' | 'en' | 'zh';

type Props = Readonly<{
  locale: Locale;
  registerHref: string;
  loginHref: string;
}>;

const COPY = {
  ru: {
    eyebrow: 'Рынок · живые лоты',
    title: 'Предложения фермеров уже на главной',
    lead: 'Показываем только разрешённые к публикации лоты и только обезличенные данные. Продавец, документы, полная карточка и действие по лоту открываются после регистрации.',
    verified: 'Проверенный источник',
    anonymous: 'Продавец скрыт до регистрации',
    lotLabel: 'Публичный лот',
    volume: 'Объём',
    region: 'Регион',
    startPrice: 'Стартовая цена',
    ends: 'Торги до',
    open: 'Открыть лот и предложить цену',
    loginPrefix: 'Уже зарегистрированы?',
    login: 'Войти',
    emptyTitle: 'Активных допущенных лотов пока нет',
    emptyText: 'Как только фермер публикует допущенный лот, он автоматически появляется здесь — без ручного переноса и без раскрытия продавца.',
    unavailableTitle: 'Рынок временно не отдан публичному экрану',
    unavailableText: 'Мы не подставляем демонстрационные данные: при недоступности PostgreSQL-витрины публичный рынок закрывается безопасно.',
    register: 'Зарегистрироваться',
    currency: '₽/т',
    tons: 'т',
    timezone: 'МСК',
  },
  en: {
    eyebrow: 'Market · live lots',
    title: 'Farmer offers are visible on the homepage',
    lead: 'Only lots authorised for publication are shown, with anonymised data only. Seller identity, documents, the full lot card and lot actions require registration.',
    verified: 'Verified source',
    anonymous: 'Seller hidden until registration',
    lotLabel: 'Public lot',
    volume: 'Volume',
    region: 'Region',
    startPrice: 'Starting price',
    ends: 'Bidding ends',
    open: 'Open lot and make an offer',
    loginPrefix: 'Already registered?',
    login: 'Sign in',
    emptyTitle: 'No active admitted lots yet',
    emptyText: 'When a farmer publishes an admitted lot, it appears here automatically without manual copying or disclosure of the seller.',
    unavailableTitle: 'The public market feed is temporarily unavailable',
    unavailableText: 'No demo data is substituted: if the PostgreSQL projection is unavailable, the public market fails closed.',
    register: 'Register',
    currency: 'RUB/t',
    tons: 't',
    timezone: 'MSK',
  },
  zh: {
    eyebrow: '市场 · 实时批次',
    title: '农户报价直接展示在首页',
    lead: '这里只展示获准发布且已匿名化的批次。卖方身份、文件、完整批次卡片以及出价等操作需注册后查看。',
    verified: '来源已核验',
    anonymous: '注册前隐藏卖方身份',
    lotLabel: '公开批次',
    volume: '数量',
    region: '地区',
    startPrice: '起始价格',
    ends: '竞价截止',
    open: '查看批次并报价',
    loginPrefix: '已经注册？',
    login: '登录',
    emptyTitle: '当前暂无已准入的活跃批次',
    emptyText: '农户发布获准批次后，它会自动出现在这里，无需人工搬运，也不会公开卖方身份。',
    unavailableTitle: '公共市场数据暂时不可用',
    unavailableText: '平台不会用演示数据替代真实数据；PostgreSQL 公共投影不可用时，市场会安全关闭。',
    register: '注册',
    currency: '卢布/吨',
    tons: '吨',
    timezone: 'MSK',
  },
} as const;

export async function PublicMarketTeaser({ locale, registerHref, loginHref }: Props) {
  const snapshot = await getPublicMarketTeaser();
  const copy = COPY[locale];

  return (
    <section id='market' className={`pc-v6-section ${styles.section}`} aria-labelledby='public-market-title' data-testid='platform-v7-public-market'>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>{copy.eyebrow}</span>
          <h2 id='public-market-title'>{copy.title}</h2>
          <p>{copy.lead}</p>
        </div>
        <div className={styles.privacyNote}><LockKeyhole aria-hidden='true' size={18} /><span>{copy.anonymous}</span></div>
      </div>

      {snapshot.state === 'unavailable' ? (
        <MarketState title={copy.unavailableTitle} text={copy.unavailableText} registerHref={registerHref} registerLabel={copy.register} />
      ) : snapshot.items.length === 0 ? (
        <MarketState title={copy.emptyTitle} text={copy.emptyText} registerHref={registerHref} registerLabel={copy.register} />
      ) : (
        <div className={styles.grid}>
          {snapshot.items.map((lot, index) => (
            <article key={`${lot.culture}:${lot.region}:${lot.auctionEndsAt}:${index}`} className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <span className={styles.lotLabel}>{copy.lotLabel}</span>
                  <h3>{lot.culture}{lot.grade ? <small>{lot.grade}</small> : null}</h3>
                </div>
                <span className={styles.verified}><BadgeCheck aria-hidden='true' size={16} />{copy.verified}</span>
              </div>

              <dl className={styles.metrics}>
                <div><dt><Scale aria-hidden='true' size={16} />{copy.volume}</dt><dd>{formatDecimal(lot.volumeTons)} {copy.tons}</dd></div>
                <div><dt><MapPin aria-hidden='true' size={16} />{copy.region}</dt><dd>{lot.region}</dd></div>
                <div className={styles.price}><dt>{copy.startPrice}</dt><dd>{formatRubles(lot.startPriceKopecksPerTon, locale)} <small>{copy.currency}</small></dd></div>
                <div><dt><Clock3 aria-hidden='true' size={16} />{copy.ends}</dt><dd>{formatEndsAt(lot.auctionEndsAt, locale)} · {copy.timezone}</dd></div>
              </dl>

              <div className={styles.cardFooter}>
                <a className={styles.primary} href={registerHref}>{copy.open}<ArrowRight aria-hidden='true' size={17} /></a>
                <span>{copy.loginPrefix} <a href={loginHref}>{copy.login}</a></span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function MarketState({ title, text, registerHref, registerLabel }: Readonly<{ title: string; text: string; registerHref: string; registerLabel: string }>) {
  return (
    <div className={styles.state}>
      <div><strong>{title}</strong><p>{text}</p></div>
      <a href={registerHref}>{registerLabel}<ArrowRight aria-hidden='true' size={17} /></a>
    </div>
  );
}

function formatDecimal(value: string): string {
  return value.replace(/(\.\d*?[1-9])0+$/u, '$1').replace(/\.0+$/u, '');
}

function formatRubles(kopecksText: string, locale: Locale): string {
  try {
    const kopecks = BigInt(kopecksText);
    const whole = kopecks / 100n;
    const remainder = kopecks % 100n;
    const language = locale === 'en' ? 'en-US' : locale === 'zh' ? 'zh-CN' : 'ru-RU';
    const formatted = new Intl.NumberFormat(language, { maximumFractionDigits: 0 }).format(whole);
    return remainder === 0n ? formatted : `${formatted},${remainder.toString().padStart(2, '0')}`;
  } catch {
    return '—';
  }
}

function formatEndsAt(value: string, locale: Locale): string {
  const language = locale === 'en' ? 'en-GB' : locale === 'zh' ? 'zh-CN' : 'ru-RU';
  return new Intl.DateTimeFormat(language, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Moscow',
  }).format(new Date(value));
}
