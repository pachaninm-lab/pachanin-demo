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
import { PublicGektaChatButton } from './PublicGektaChatButton';
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
    ['Сделка', '/platform-v7/how-it-works'],
    ['Возможности', '/platform-v7/capabilities'],
    ['Гекта', '/platform-v7/gekta'],
    ['Доверие', '/platform-v7/trust'],
  ],
  en: [
    ['Market', '/platform-v7/market'],
    ['Deal', '/platform-v7/how-it-works'],
    ['Capabilities', '/platform-v7/capabilities'],
    ['Gekta', '/platform-v7/gekta'],
    ['Trust', '/platform-v7/trust'],
  ],
  zh: [
    ['市场', '/platform-v7/market'],
    ['交易', '/platform-v7/how-it-works'],
    ['功能', '/platform-v7/capabilities'],
    ['Gekta', '/platform-v7/gekta'],
    ['信任', '/platform-v7/trust'],
  ],
} as const;

const ACTIONS = {
  ru: { login: 'Войти', register: 'Регистрация', about: 'О платформе', primary: 'Разделы', utility: 'Аккаунт и помощь', brand: 'Прозрачная Цена — на главную', nav: 'Навигация платформы', menu: 'Открыть меню' },
  en: { login: 'Sign in', register: 'Register', about: 'About', primary: 'Sections', utility: 'Account and help', brand: 'Transparent Price — home', nav: 'Platform navigation', menu: 'Open menu' },
  zh: { login: '登录', register: '注册', about: '关于平台', primary: '主要栏目', utility: '账户与帮助', brand: '透明价格 — 首页', nav: '平台导航', menu: '打开菜单' },
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
    ['Полномочия', 'Видно, кто вправе действовать и от какой организации.'],
    ['Основание', 'У важного действия есть понятное основание: документ, условие или событие.'],
    ['Источник', 'Понятно, откуда пришёл факт и к какой версии Сделки он относится.'],
    ['Решение', 'Зафиксировано, кто принял решение и какой следующий шаг разрешён.'],
  ],
  en: [
    ['Authority', 'See who is allowed to act and for which organisation.'],
    ['Basis', 'Every important action has a clear basis: a document, condition or event.'],
    ['Source', 'See where a fact came from and which Deal version it belongs to.'],
    ['Decision', 'See who made the decision and which next step is allowed.'],
  ],
  zh: [
    ['权限', '清楚看到谁有权操作，以及代表哪个机构。'],
    ['依据', '每个重要操作都有明确依据：文件、条件或事件。'],
    ['来源', '清楚看到事实来自哪里，以及对应哪个交易版本。'],
    ['决定', '记录谁作出决定，以及允许执行的下一步。'],
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
  const navIcons = {
    '/platform-v7/market': Store,
    '/platform-v7/how-it-works': Layers3,
    '/platform-v7/capabilities': PackageSearch,
    '/platform-v7/gekta': Bot,
    '/platform-v7/trust': ShieldCheck,
  } as const;
  const nav = (
    <>
      <span className='pc-site-mobile-primary-label'>{copy.primary}</span>
      {NAV[lang].map(([label, href]) => {
        const Icon = navIcons[href];
        return (
        <a
          key={href}
          className={href === '/platform-v7/gekta' ? 'pc-site-nav-gekta' : undefined}
          href={`${href}${suffix}`}
          data-active={activePath === href ? 'true' : undefined}
        >
          <span className='pc-site-nav-item-icon' aria-hidden='true'><Icon size={18} /></span>
          <span>{label}</span>
        </a>
        );
      })}
      <div className='pc-site-mobile-utility pc-cp-mobile-only' aria-label={copy.utility}>
        <span className='pc-site-mobile-utility-label'>{copy.utility}</span>
        <PublicGektaChatButton locale={lang} variant='mobile' className='pc-site-mobile-gekta' />
        <a href={`/platform-v7/about${suffix}`}><Building2 size={16} aria-hidden='true' />{copy.about}</a>
        <a href={`/platform-v7/login${suffix}`}><LogIn size={16} aria-hidden='true' />{copy.login}</a>
        <a href={`/platform-v7/register${suffix}`}><UserRound size={16} aria-hidden='true' />{copy.register}</a>
      </div>
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
          <PublicGektaChatButton locale={lang} variant='header' />
          <a className='entry-login' href={`/platform-v7/login${suffix}`}>{copy.login}</a>
          <a className='pc-v6-header-cta' href={`/platform-v7/register${suffix}`}>{copy.register}</a>
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
  currentIndex?: number | null;
  id?: string;
}) {
  const lang = canonicalPublicLocale(locale);
  const stages = CANONICAL_DEAL_STAGES[lang];
  const safeIndex = typeof currentIndex === 'number' && Number.isInteger(currentIndex)
    && currentIndex >= 0 && currentIndex < stages.length ? currentIndex : null;
  const label = safeIndex === null
    ? (lang === 'ru' ? 'Схема из семи этапов; прогресс не подтверждён' : lang === 'en' ? 'Seven-stage outline; progress unconfirmed' : '七阶段示意；进度未确认')
    : (lang === 'ru' ? 'Семь этапов Сделки' : lang === 'en' ? 'Seven Deal stages' : '交易七个阶段');
  return (
    <div className='pc-cp-deal-spine' role='list' tabIndex={0} aria-label={label} id={id}>
      {stages.map((stage, index) => (
        <div className='pc-cp-stage' role='listitem' key={stage} data-state={safeIndex === null ? 'unknown' : index < safeIndex ? 'done' : index === safeIndex ? 'current' : 'pending'} aria-current={index === safeIndex ? 'step' : undefined}>
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
  state: CanonicalDealState | null;
}) {
  const lang = canonicalPublicLocale(locale);
  const ariaLabel = lang === 'ru' ? 'Состояние Сделки' : lang === 'en' ? 'Deal state' : '交易状态';
  return (
    <div className='pc-cp-state-tabs' role='list' aria-label={ariaLabel}>
      {(['normal', 'deviation', 'dispute'] as const).map((item) => {
        const label = STATE_COPY[lang][item];
        const active = state === item;
        return (
          <span
            key={item}
            role='listitem'
            className='pc-cp-state-tab'
            data-state={item}
            data-active={active ? 'true' : 'false'}
            aria-current={active ? 'true' : undefined}
          >
            {label}
          </span>
        );
      })}
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
  state: CanonicalDealState | null;
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
      {state === null ? <p data-canonical-state='unconfirmed'>{lang === 'ru'
        ? 'Общее состояние не подтверждено. Проверяйте факты и подробные этапы сделки.'
        : lang === 'en'
          ? 'Overall state is unconfirmed. Review the facts and detailed Deal stages.'
          : '总体状态尚未确认。请查看事实和交易的详细阶段。'}</p> : null}
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
    ? { k: 'Помощник по Сделке', t: 'Гекта', p: 'Показывает состояние Сделки, риски и основания по доступным данным. Критическое решение принимает человек по правилам платформы.', chips: ['Данные Сделки', 'Документы', 'Логистика', 'Качество', 'Расчёт', 'Риски'] }
    : lang === 'en'
      ? { k: 'Deal assistant', t: 'Gekta', p: 'Shows Deal state, risk and evidence from data available to the user. Critical decisions remain with people under platform rules.', chips: ['Deal data', 'Documents', 'Logistics', 'Quality', 'Settlement', 'Risk'] }
      : { k: '交易助手', t: 'Gekta', p: '基于参与方可访问的数据展示交易状态、风险和依据。关键决定由人员按平台规则作出。', chips: ['交易数据', '文件', '物流', '质量', '结算', '风险'] };
  return (
    <section className='pc-cp-gekta-strip'>
      <div className='pc-cp-gekta-brand'>
        <span>{c.k}</span><strong>{c.t}</strong><p>{c.p}</p>
        <div className='pc-cp-gekta-actions'>
          <PublicGektaChatButton locale={lang} variant='section' />
          <a href={`/platform-v7/gekta?lang=${lang}`}>{lang === 'ru' ? 'Открыть Гекту' : lang === 'en' ? 'Open Gekta' : '打开 Gekta'}</a>
        </div>
      </div>
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
      {items.map(([label, href, Icon, center]) => <a href={`${href}?lang=${lang}`} key={href} data-active={active === href ? 'true' : 'false'} data-center={center ? 'true' : 'false'}><Icon aria-hidden='true' /><span>{label}</span></a>)}
    </nav>
  );
}

export function CanonicalFooter({ locale }: { locale: string }) {
  const lang = canonicalPublicLocale(locale);
  const description = lang === 'ru'
    ? 'Одна Сделка — от лота и торгов до исполнения, документов, расчёта и закрытия.'
    : lang === 'en'
      ? 'One Deal from lot and trading through execution, documents, settlement and closure.'
      : '一笔交易贯穿批次、交易、履约、文件、结算和关闭。';
  return (
    <footer className='pc-cp-footer'>
      <div className='pc-cp-container pc-cp-footer-grid'>
        <div><strong>Прозрачная Цена</strong><p>{description}</p></div>
        <nav aria-label={ACTIONS[lang].nav}>
          {NAV[lang].map(([label, href]) => <a key={href} href={`${href}?lang=${lang}`}>{label}</a>)}
          <a href={`/platform-v7/about?lang=${lang}`}>{ACTIONS[lang].about}</a>
          <a href={`/platform-v7/contact?lang=${lang}`}>{lang === 'ru' ? 'Контакты' : lang === 'en' ? 'Contact' : '联系'}</a>
          <a href={`/platform-v7/privacy?lang=${lang}`}>{lang === 'ru' ? 'Конфиденциальность' : lang === 'en' ? 'Privacy' : '隐私'}</a>
          <a href={`/platform-v7/terms?lang=${lang}`}>{lang === 'ru' ? 'Условия' : lang === 'en' ? 'Terms' : '条款'}</a>
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
