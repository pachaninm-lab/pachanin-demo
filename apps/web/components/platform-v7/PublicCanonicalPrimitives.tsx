import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  BadgeCheck,
  BookOpenCheck,
  Bot,
  Building2,
  CircleDollarSign,
  FileCheck2,
  Home,
  Layers3,
  LogIn,
  PackageSearch,
  Scale,
  Search,
  ShieldCheck,
  Store,
  UserRound,
} from 'lucide-react';
import { PublicLocaleLink } from './PublicLocaleLink';
import { PublicSiteHeader } from './PublicSiteHeader';

export type CanonicalPublicLocale = 'ru' | 'en' | 'zh';
export type CanonicalDealState = 'normal' | 'deviation' | 'dispute';

export function canonicalPublicLocale(value: string): CanonicalPublicLocale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

const NAV = {
  ru: [
    ['Рынок', '/platform-v7/market'],
    ['Как проходит Сделка', '/platform-v7/how-it-works'],
    ['Возможности', '/platform-v7/capabilities'],
    ['Гекта', '/platform-v7/gekta'],
    ['Доверие', '/platform-v7/trust'],
    ['О платформе', '/platform-v7/about'],
  ],
  en: [
    ['Market', '/platform-v7/market'],
    ['How the Deal works', '/platform-v7/how-it-works'],
    ['Capabilities', '/platform-v7/capabilities'],
    ['Gekta', '/platform-v7/gekta'],
    ['Trust', '/platform-v7/trust'],
    ['About', '/platform-v7/about'],
  ],
  zh: [
    ['市场', '/platform-v7/market'],
    ['交易如何进行', '/platform-v7/how-it-works'],
    ['功能', '/platform-v7/capabilities'],
    ['Gekta', '/platform-v7/gekta'],
    ['信任', '/platform-v7/trust'],
    ['关于平台', '/platform-v7/about'],
  ],
} as const;

const ACTIONS = {
  ru: { login: 'Войти', register: 'Регистрация', brand: 'Прозрачная Цена — на главную', nav: 'Навигация платформы', menu: 'Открыть меню' },
  en: { login: 'Sign in', register: 'Register', brand: 'Transparent Price — home', nav: 'Platform navigation', menu: 'Open menu' },
  zh: { login: '登录', register: '注册', brand: '透明价格 — 首页', nav: '平台导航', menu: '打开菜单' },
} as const;

export const CANONICAL_DEAL_STAGES = {
  ru: ['Лот', 'Торги', 'Обязательства', 'Доставка', 'Приёмка / качество', 'Документы / расчёт', 'Закрытие / спор'],
  en: ['Lot', 'Trading', 'Commitments', 'Delivery', 'Acceptance / quality', 'Documents / settlement', 'Closure / dispute'],
  zh: ['批次', '交易', '义务', '交付', '验收 / 质量', '文件 / 结算', '关闭 / 争议'],
} as const;

export const CANONICAL_ROLES = {
  ru: ['Продавец', 'Покупатель', 'Логистика', 'Водитель', 'Элеватор', 'Лаборатория', 'Сюрвейер', 'Банк', 'Сотрудник подключённой организации'],
  en: ['Seller', 'Buyer', 'Logistics', 'Driver', 'Elevator', 'Laboratory', 'Surveyor', 'Bank', 'Employee of a connected organisation'],
  zh: ['卖方', '买方', '物流', '司机', '粮库', '实验室', '检验机构', '银行', '已接入机构员工'],
} as const;

export const TRUST_MODEL = {
  ru: [
    ['Полномочия', 'Кто вправе действовать в этом контексте и от имени какой организации.'],
    ['Основание', 'Какое условие, документ или подтверждённое событие разрешает действие.'],
    ['Источник', 'Откуда получен факт и в какой версии он относится к Сделке.'],
    ['Решение', 'Какое действие принято, кем и какой следующий шаг разрешён.'],
  ],
  en: [
    ['Authority', 'Who may act in this context and for which organisation.'],
    ['Basis', 'Which condition, document or confirmed event permits the action.'],
    ['Source', 'Where the fact came from and which Deal version it belongs to.'],
    ['Decision', 'What was decided, by whom, and which next step is permitted.'],
  ],
  zh: [
    ['权限', '谁有权在当前上下文中代表哪个机构执行操作。'],
    ['依据', '哪个条件、文件或已确认事件允许该操作。'],
    ['来源', '事实来自哪里，以及属于交易的哪个版本。'],
    ['决定', '作出了什么决定、由谁作出，以及允许的下一步是什么。'],
  ],
} as const;

export function CanonicalPublicHeader({
  locale,
  activePath,
  actions = true,
  localeControl,
}: {
  locale: string;
  activePath?: string;
  actions?: boolean | ReactNode;
  localeControl?: ReactNode;
}) {
  const lang = canonicalPublicLocale(locale);
  const copy = ACTIONS[lang];
  const suffix = `?lang=${encodeURIComponent(lang)}`;
  const nav = (
    <>
      {NAV[lang].map(([label, href]) => (
        <Link key={href} href={`${href}${suffix}`} data-active={activePath === href ? 'true' : undefined}>{label}</Link>
      ))}
      <Link className='pc-cp-mobile-only' href={`/platform-v7/login${suffix}`}><LogIn size={16} aria-hidden='true' />{copy.login}</Link>
      <Link className='pc-cp-mobile-only' href={`/platform-v7/register${suffix}`}><UserRound size={16} aria-hidden='true' />{copy.register}</Link>
    </>
  );
  return (
    <PublicSiteHeader
      ariaLabel={copy.nav}
      brandHomeLabel={copy.brand}
      brandHomeHref={`/platform-v7${suffix}`}
      navLabel={copy.nav}
      menuLabel={copy.menu}
      nav={nav}
      showMobileMenu
      localeControl={localeControl ?? <PublicLocaleLink />}
      actions={actions === false ? <span className='pc-canonical-header-actions' /> : actions === true ? (
        <div className='pc-canonical-header-actions'>
          <Link className='entry-login' href={`/platform-v7/login${suffix}`}>{copy.login}</Link>
          <Link className='pc-v6-header-cta' href={`/platform-v7/register${suffix}`}>{copy.register}</Link>
        </div>
      ) : actions}
    />
  );
}

export function CanonicalDealSpine({
  locale,
  currentIndex = 0,
  id,
}: {
  locale: string;
  currentIndex?: number;
  id?: string;
}) {
  const lang = canonicalPublicLocale(locale);
  const stages = CANONICAL_DEAL_STAGES[lang];
  const safeIndex = Math.max(0, Math.min(stages.length - 1, currentIndex));
  return (
    <div className='pc-cp-deal-spine' role='list' tabIndex={0} aria-label={lang === 'ru' ? 'Семь этапов Сделки' : lang === 'en' ? 'Seven Deal stages' : '交易七个阶段'} id={id}>
      {stages.map((stage, index) => (
        <div className='pc-cp-stage' role='listitem' key={stage} data-state={index < safeIndex ? 'done' : index === safeIndex ? 'current' : 'pending'}>
          <i>{index + 1}</i><strong>{stage}</strong>
        </div>
      ))}
    </div>
  );
}

export function CanonicalTrustLedger({ locale }: { locale: string }) {
  const lang = canonicalPublicLocale(locale);
  return (
    <div className='pc-cp-trust-grid'>
      {TRUST_MODEL[lang].map(([title, text], index) => (
        <article className='pc-cp-card pc-cp-trust-card' key={title}>
          <i>{index + 1}</i><strong>{title}</strong><p>{text}</p>
        </article>
      ))}
    </div>
  );
}

const STATE_COPY = {
  ru: { normal: 'Норма', deviation: 'Отклонение', dispute: 'Спор' },
  en: { normal: 'Normal', deviation: 'Deviation', dispute: 'Dispute' },
  zh: { normal: '正常', deviation: '偏差', dispute: '争议' },
} as const;

export function CanonicalStateTabs({
  locale,
  state,
}: {
  locale: string;
  state: CanonicalDealState;
}) {
  const lang = canonicalPublicLocale(locale);
  return (
    <div className='pc-cp-state-tabs' role='tablist' aria-label={lang === 'ru' ? 'Состояние Сделки' : lang === 'en' ? 'Deal state' : '交易状态'}>
      {(['normal', 'deviation', 'dispute'] as const).map((item) => (
        <span key={item} role='tab' aria-selected={state === item} className='pc-cp-state-tab' data-state={item} data-active={state === item ? 'true' : 'false'}>
          {STATE_COPY[lang][item]}
        </span>
      ))}
    </div>
  );
}

export function CanonicalStateLens({
  locale,
  state,
  happened,
  actor,
  basis,
  settlement,
  next,
}: {
  locale: string;
  state: CanonicalDealState;
  happened: ReactNode;
  actor: ReactNode;
  basis: ReactNode;
  settlement: ReactNode;
  next: ReactNode;
}) {
  const lang = canonicalPublicLocale(locale);
  const labels = lang === 'ru'
    ? ['Что произошло', 'Кто действует', 'Основание', 'Что с расчётом', 'Следующий шаг']
    : lang === 'en'
      ? ['What happened', 'Who acts', 'Basis', 'Settlement', 'Next step']
      : ['发生了什么', '谁来处理', '依据', '结算影响', '下一步'];
  const values = [happened, actor, basis, settlement, next];
  return (
    <section className='pc-cp-card pc-cp-state-shell'>
      <CanonicalStateTabs locale={lang} state={state} />
      <div className='pc-cp-state-grid'>
        {labels.map((label, index) => <div className='pc-cp-state-cell' key={label}><span>{label}</span><strong>{values[index]}</strong></div>)}
      </div>
    </section>
  );
}

export function CanonicalGektaStrip({ locale }: { locale: string }) {
  const lang = canonicalPublicLocale(locale);
  const c = lang === 'ru'
    ? { k: 'Аграрный интеллект', t: 'Гекта', p: 'Объясняет контекст Сделки, риски, основания и допустимый следующий шаг. Критическое решение остаётся за человеком и правилами платформы.', chips: ['Контекст Сделки', 'Документы', 'Логистика', 'Качество', 'Расчёт', 'Риски'] }
    : lang === 'en'
      ? { k: 'Agricultural intelligence', t: 'Gekta', p: 'Explains Deal context, risks, evidence and the permitted next step. Critical decisions remain with people and platform rules.', chips: ['Deal context', 'Documents', 'Logistics', 'Quality', 'Settlement', 'Risk'] }
      : { k: '农业智能', t: 'Gekta', p: '解释交易上下文、风险、依据和允许的下一步。关键决定仍由人员和平台规则控制。', chips: ['交易上下文', '文件', '物流', '质量', '结算', '风险'] };
  return (
    <section className='pc-cp-gekta-strip'>
      <div className='pc-cp-gekta-brand'><span>{c.k}</span><strong>{c.t}</strong><p>{c.p}</p></div>
      <div className='pc-cp-gekta-chips'>{c.chips.map((chip) => <span key={chip}>{chip}</span>)}</div>
    </section>
  );
}

export function CanonicalBottomNav({ locale, active }: { locale: string; active?: string }) {
  const lang = canonicalPublicLocale(locale);
  const items = lang === 'ru'
    ? [
      ['Главная', '/platform-v7', Home, false],
      ['Рынок', '/platform-v7/market', Store, false],
      ['Регистрация', '/platform-v7/register', UserRound, true],
      ['Сделка', '/platform-v7/how-it-works', Layers3, false],
      ['Войти', '/platform-v7/login', LogIn, false],
    ] as const
    : lang === 'en'
      ? [
        ['Home', '/platform-v7', Home, false],
        ['Market', '/platform-v7/market', Store, false],
        ['Register', '/platform-v7/register', UserRound, true],
        ['Deal', '/platform-v7/how-it-works', Layers3, false],
        ['Sign in', '/platform-v7/login', LogIn, false],
      ] as const
      : [
        ['首页', '/platform-v7', Home, false],
        ['市场', '/platform-v7/market', Store, false],
        ['注册', '/platform-v7/register', UserRound, true],
        ['交易', '/platform-v7/how-it-works', Layers3, false],
        ['登录', '/platform-v7/login', LogIn, false],
      ] as const;
  return (
    <nav className='pc-cp-bottom-nav' aria-label={lang === 'ru' ? 'Мобильная навигация' : lang === 'en' ? 'Mobile navigation' : '移动导航'}>
      {items.map(([label, href, Icon, center]) => <Link href={`${href}?lang=${lang}`} key={href} data-active={active === href ? 'true' : 'false'} data-center={center ? 'true' : 'false'}><Icon aria-hidden='true' /><span>{label}</span></Link>)}
    </nav>
  );
}

export function CanonicalFooter({ locale }: { locale: string }) {
  const lang = canonicalPublicLocale(locale);
  const description = lang === 'ru'
    ? 'Единый контур агросделки: от лота и торгов до исполнения, документов, расчёта и закрытия.'
    : lang === 'en'
      ? 'One agricultural Deal flow from lot and trading through execution, documents, settlement and closure.'
      : '统一农业交易流程：从批次和交易到履约、文件、结算和关闭。';
  return (
    <footer className='pc-cp-footer'>
      <div className='pc-cp-container pc-cp-footer-grid'>
        <div><strong>Прозрачная Цена</strong><p>{description}</p></div>
        <nav aria-label={ACTIONS[lang].nav}>
          {NAV[lang].map(([label, href]) => <Link key={href} href={`${href}?lang=${lang}`}>{label}</Link>)}
          <Link href={`/platform-v7/contact?lang=${lang}`}>{lang === 'ru' ? 'Контакты' : lang === 'en' ? 'Contact' : '联系'}</Link>
          <Link href={`/platform-v7/privacy?lang=${lang}`}>{lang === 'ru' ? 'Конфиденциальность' : lang === 'en' ? 'Privacy' : '隐私'}</Link>
          <Link href={`/platform-v7/terms?lang=${lang}`}>{lang === 'ru' ? 'Условия' : lang === 'en' ? 'Terms' : '条款'}</Link>
        </nav>
      </div>
    </footer>
  );
}

export const CAPABILITIES = [
  [PackageSearch, 'market'],
  [Search, 'trading'],
  [BadgeCheck, 'commitments'],
  [Building2, 'delivery'],
  [BookOpenCheck, 'acceptance'],
  [FileCheck2, 'documents'],
  [CircleDollarSign, 'settlement'],
  [Scale, 'dispute'],
  [ShieldCheck, 'trust'],
  [Bot, 'gekta'],
  [Layers3, 'roles'],
  [Store, 'history'],
] as const;
