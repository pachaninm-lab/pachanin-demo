import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { PublicLocaleLink } from '@/components/platform-v7/PublicLocaleLink';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';

type Locale = 'ru' | 'en' | 'zh';
type Card = Readonly<{ title: string; note: string; href: string }>;

type Copy = Readonly<{
  metadataTitle: string;
  metadataDescription: string;
  eyebrow: string;
  title: string;
  lead: string;
  domainNote: string;
  journeyTitle: string;
  journey: readonly string[];
  whatTitle: string;
  bullets: readonly string[];
  trustTitle: string;
  trustLead: string;
  trustLinks: readonly Card[];
  contactTitle: string;
  contactText: string;
  contactCta: string;
  legalTitle: string;
  legalText: string;
  home: string;
  brandHome: string;
  trustCenter: string;
  register: string;
  login: string;
  navDeal: string;
  navTrust: string;
  navContact: string;
  open: string;
}>;

const COPY: Record<Locale, Copy> = {
  ru: {
    metadataTitle: 'О платформе — Прозрачная Цена',
    metadataDescription: 'Прозрачная Цена объединяет участников и весь путь агросделки в растениеводстве — от товара и контрагента до логистики, качества, документов, расчёта и закрытия.',
    eyebrow: 'О платформе',
    title: 'Одна система для всей агросделки',
    lead: '«Прозрачная Цена» связывает товар или потребность, контрагента, условия, договор, услуги, поставку, качество, документы, расчёт и исключения в одной Сделке. Каждый участник видит только свой рабочий контекст и понимает следующий шаг.',
    domainNote: 'Процент-Агро.рф — публичный домен платформы «Прозрачная Цена».',
    journeyTitle: 'Как устроен путь Сделки',
    journey: ['Товар и условия', 'Рынок и контрагент', 'Сделка и договор', 'Сервисы и логистика', 'Приёмка и качество', 'Документы и расчёт', 'Закрытие и исключения'],
    whatTitle: 'Что получает участник',
    bullets: [
      'Одну рабочую историю вместо разрозненных чатов, таблиц, файлов и звонков.',
      'Понятную ответственность своей роли и следующий допустимый шаг.',
      'Связь между условиями, фактическим исполнением, документами и денежным результатом.',
      'Единый контекст для обычного пути Сделки и для отклонений, перерасчётов и разногласий.',
    ],
    trustTitle: 'Границы доверия встроены в саму Сделку',
    trustLead: 'Полномочия определяются ролью и организацией, основания остаются связаны с действиями и документами, а внешние контуры взаимодействуют с платформой через отдельные подключения. Гекта помогает понять факты и варианты, но не получает самостоятельного права принять критическое решение.',
    trustLinks: [
      { title: 'Как проходит Сделка', note: 'Посмотрите обычный путь и ситуации, когда исполнение отклоняется от согласованных условий.', href: '/platform-v7/how-it-works' },
      { title: 'Центр доверия', note: 'Как устроены полномочия, доказательства, данные и границы внешних контуров.', href: '/platform-v7/trust' },
      { title: 'Гекта в работе', note: 'Как Гекта объясняет факты, риски и следующий допустимый шаг внутри контекста Сделки.', href: '/platform-v7/ai-in-action' },
      { title: 'Задать вопрос', note: 'Отдельный канал помощи до регистрации. Обращение не создаёт аккаунт и не открывает кабинет.', href: '/platform-v7/contact' },
    ],
    contactTitle: 'Начните с рабочего кабинета своей роли',
    contactText: 'Регистрация — основной путь в платформу. Если до регистрации нужен ответ о ролях, документах или подключении организации, используйте отдельный канал помощи.',
    contactCta: 'Задать вопрос',
    legalTitle: 'Правила и документы',
    legalText: 'Юридические и информационные материалы вынесены в отдельные страницы, чтобы рабочая логика Сделки оставалась простой и понятной.',
    home: 'На главную', brandHome: 'Прозрачная Цена — на главную', trustCenter: 'Центр доверия', register: 'Зарегистрироваться', login: 'Войти',
    navDeal: 'Как работает', navTrust: 'Доверие', navContact: 'Контакты', open: 'Открыть',
  },
  en: {
    metadataTitle: 'About the platform — Transparent Price',
    metadataDescription: 'Transparent Price connects participants and the full crop Deal journey — from product and counterparty through logistics, quality, documents, settlement and closure.',
    eyebrow: 'About the platform',
    title: 'One system for the whole agricultural Deal',
    lead: 'Transparent Price connects product or demand, counterparty, terms, contract, services, delivery, quality, documents, settlement and exceptions in one Deal. Each participant sees their own working context and understands the next action.',
    domainNote: 'Процент-Агро.рф is the public domain of the Transparent Price platform.',
    journeyTitle: 'How the Deal journey is organised',
    journey: ['Product and terms', 'Market and counterparty', 'Deal and contract', 'Services and logistics', 'Acceptance and quality', 'Documents and settlement', 'Closure and exceptions'],
    whatTitle: 'What a participant gets',
    bullets: [
      'One working history instead of scattered chats, spreadsheets, files and calls.',
      'Clear responsibility for the role and the next permitted action.',
      'A direct connection between terms, actual execution, documents and monetary outcome.',
      'One context for both the ordinary Deal path and deviations, recalculations and disagreements.',
    ],
    trustTitle: 'Trust boundaries are built into the Deal itself',
    trustLead: 'Authority follows the role and organisation, evidence stays linked to actions and documents, and external systems interact through separate connections. Gekta helps explain facts and options but does not gain independent authority to make a critical decision.',
    trustLinks: [
      { title: 'How a Deal works', note: 'See the ordinary journey and situations where execution diverges from agreed terms.', href: '/platform-v7/how-it-works' },
      { title: 'Trust Center', note: 'How authority, evidence, data and external-system boundaries are organised.', href: '/platform-v7/trust' },
      { title: 'Gekta in action', note: 'How Gekta explains facts, risks and the next permitted action inside the Deal context.', href: '/platform-v7/ai-in-action' },
      { title: 'Ask a question', note: 'A separate pre-registration help channel. Contact does not create an account or open a workspace.', href: '/platform-v7/contact' },
    ],
    contactTitle: 'Start with the workspace for your role',
    contactText: 'Registration is the primary path into the platform. If you need an answer about roles, documents or organisation connection first, use the separate help channel.',
    contactCta: 'Ask a question',
    legalTitle: 'Rules and documents',
    legalText: 'Legal and information materials remain on separate pages so the working Deal experience stays simple and understandable.',
    home: 'Home', brandHome: 'Transparent Price — home', trustCenter: 'Trust Center', register: 'Register', login: 'Sign in',
    navDeal: 'How it works', navTrust: 'Trust', navContact: 'Contact', open: 'Open',
  },
  zh: {
    metadataTitle: '关于平台 — 透明价格',
    metadataDescription: '透明价格把种植业交易的参与方和完整流程连接起来，从商品与交易方到物流、质量、文件、结算与关闭。',
    eyebrow: '关于平台',
    title: '一套系统管理整笔农业交易',
    lead: '“透明价格”把商品或需求、交易方、条件、合同、服务、交付、质量、文件、结算和异常连接在同一笔交易中。每个参与方只看到与自己角色相关的工作上下文，并清楚下一步操作。',
    domainNote: 'Процент-Агро.рф 是“透明价格”平台的公开域名。',
    journeyTitle: '交易流程如何组织',
    journey: ['商品与条件', '市场与交易方', '交易与合同', '服务与物流', '验收与质量', '文件与结算', '关闭与异常'],
    whatTitle: '参与方获得什么',
    bullets: [
      '用一段统一工作历史取代分散的聊天、表格、文件和电话。',
      '清楚知道本角色的责任以及允许的下一步操作。',
      '把交易条件、实际履约、文件和资金结果直接关联。',
      '正常流程、偏差、重算和分歧都保留在同一交易上下文中。',
    ],
    trustTitle: '信任边界直接内置于交易流程',
    trustLead: '权限由角色和机构决定，依据始终与操作和文件关联；外部系统通过独立连接与平台交互。Gekta 帮助解释事实和可选方案，但不会获得独立做出关键决定的权限。',
    trustLinks: [
      { title: '交易如何运行', note: '查看普通交易路径，以及履约偏离约定条件时如何处理。', href: '/platform-v7/how-it-works' },
      { title: '信任中心', note: '了解权限、证据、数据以及外部系统边界如何组织。', href: '/platform-v7/trust' },
      { title: 'Gekta 实际运行', note: '了解 Gekta 如何在交易上下文中解释事实、风险和允许的下一步。', href: '/platform-v7/ai-in-action' },
      { title: '提出问题', note: '独立的注册前帮助渠道。提交问题不会创建账户，也不会打开工作空间。', href: '/platform-v7/contact' },
    ],
    contactTitle: '从你的角色工作空间开始',
    contactText: '注册是进入平台的主要路径。如果注册前需要了解角色、文件或机构接入，可以使用独立帮助渠道。',
    contactCta: '提出问题',
    legalTitle: '规则与文件',
    legalText: '法律和信息材料保留在独立页面，让交易工作流程保持简单、清晰。',
    home: '返回首页', brandHome: '透明价格 — 返回首页', trustCenter: '信任中心', register: '注册', login: '登录',
    navDeal: '如何运行', navTrust: '信任', navContact: '联系', open: '打开',
  },
};

const LEGAL_LINKS = [
  { label: 'Privacy', href: '/platform-v7/privacy' },
  { label: 'Terms', href: '/platform-v7/terms' },
  { label: 'Oferta', href: '/platform-v7/oferta' },
  { label: 'Docs', href: '/platform-v7/docs' },
] as const;

function localeOf(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = localeOf(await getLocale());
  const copy = COPY[locale];
  return {
    title: copy.metadataTitle,
    description: copy.metadataDescription,
    alternates: {
      canonical: '/platform-v7/about',
      languages: {
        ru: '/platform-v7/about?lang=ru',
        en: '/platform-v7/about?lang=en',
        zh: '/platform-v7/about?lang=zh',
      },
    },
    robots: { index: true, follow: true },
  };
}

export default async function AboutPage() {
  const locale = localeOf(await getLocale());
  const copy = COPY[locale];
  const lang = `?lang=${encodeURIComponent(locale)}`;
  const nav = (
    <>
      <Link href={`/platform-v7/how-it-works${lang}`}>{copy.navDeal}</Link>
      <Link href={`/platform-v7/trust${lang}`}>{copy.navTrust}</Link>
      <Link href={`/platform-v7/contact${lang}`}>{copy.navContact}</Link>
    </>
  );

  return (
    <div className='p7-about-page'>
      <PublicSiteHeader
        ariaLabel={copy.title}
        brandHomeLabel={copy.brandHome}
        navLabel={copy.title}
        menuLabel={copy.navDeal}
        nav={nav}
        showMobileMenu
        localeControl={<PublicLocaleLink />}
        actions={(
          <>
            <Link href={`/platform-v7/login${lang}`} className='entry-login p7-about-login' aria-label={copy.login}>{copy.login}</Link>
            <Link href={`/platform-v7/register${lang}`} className='pc-site-action p7-about-register' aria-label={copy.register}>{copy.register}</Link>
          </>
        )}
      />
      <style>{ABOUT_PAGE_CSS}</style>

      <main className='p7-about-shell'>
        <section className='p7-about-hero' aria-labelledby='p7-about-title'>
          <div className='p7-about-hero-copy'>
            <span className='p7-about-eyebrow'>{copy.eyebrow}</span>
            <h1 id='p7-about-title'>{copy.title}</h1>
            <p>{copy.lead}</p>
            <small>{copy.domainNote}</small>
            <div className='p7-about-actions'>
              <Link href={`/platform-v7/register${lang}`} className='p7-about-primary'>{copy.register}</Link>
              <Link href={`/platform-v7/how-it-works${lang}`} className='p7-about-secondary'>{copy.navDeal}</Link>
            </div>
          </div>

          <div className='p7-about-journey' aria-label={copy.journeyTitle}>
            <strong>{copy.journeyTitle}</strong>
            <ol>
              {copy.journey.map((step, index) => <li key={step}><i>{index + 1}</i><span>{step}</span></li>)}
            </ol>
          </div>
        </section>

        <section className='p7-about-section' aria-labelledby='p7-about-value-title'>
          <div className='p7-about-section-head'><span>01</span><h2 id='p7-about-value-title'>{copy.whatTitle}</h2></div>
          <div className='p7-about-outcomes'>{copy.bullets.map((text) => <Bullet key={text} text={text} />)}</div>
        </section>

        <section className='p7-about-section' aria-labelledby='p7-about-trust-title'>
          <div className='p7-about-section-head'><span>02</span><div><h2 id='p7-about-trust-title'>{copy.trustTitle}</h2><p>{copy.trustLead}</p></div></div>
          <div className='p7-about-links'>{copy.trustLinks.map((item) => <PublicLink key={item.href} item={item} open={copy.open} locale={locale} />)}</div>
        </section>

        <section className='p7-about-final' aria-labelledby='p7-about-final-title'>
          <div><span>03</span><h2 id='p7-about-final-title'>{copy.contactTitle}</h2><p>{copy.contactText}</p></div>
          <div className='p7-about-actions'>
            <Link href={`/platform-v7/register${lang}`} className='p7-about-primary'>{copy.register}</Link>
            <Link href={`/platform-v7/contact${lang}`} className='p7-about-secondary'>{copy.contactCta}</Link>
          </div>
        </section>

        <section className='p7-about-legal' aria-labelledby='p7-about-legal-title'>
          <div><h2 id='p7-about-legal-title'>{copy.legalTitle}</h2><p>{copy.legalText}</p></div>
          <nav aria-label={copy.legalTitle}>{LEGAL_LINKS.map((item) => <Link key={item.href} href={`${item.href}${lang}`}>{item.label}</Link>)}</nav>
        </section>

        <nav className='p7-about-bottom-nav' aria-label={copy.home}>
          <Link href={`/platform-v7${lang}`}>{copy.home}</Link>
          <Link href={`/platform-v7/trust${lang}`}>{copy.trustCenter}</Link>
        </nav>
      </main>
    </div>
  );
}

function PublicLink({ item, open, locale }: { item: Card; open: string; locale: Locale }) {
  return (
    <Link href={`${item.href}?lang=${encodeURIComponent(locale)}`} className='p7-about-link-card'>
      <strong>{item.title}</strong><span>{item.note}</span><b>{open} →</b>
    </Link>
  );
}

function Bullet({ text }: { text: string }) {
  return <article className='p7-about-outcome'><i aria-hidden='true'>✓</i><span>{text}</span></article>;
}

const ABOUT_PAGE_CSS = `
.p7-about-page{min-height:100vh;background:#f7faf8;color:#102019;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.p7-about-shell{width:min(1180px,calc(100% - 40px));margin:0 auto;padding:112px 0 64px;display:grid;gap:0}
.p7-about-hero{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(360px,.95fr);gap:64px;align-items:center;padding:52px 0 74px}
.p7-about-hero-copy{min-width:0}.p7-about-eyebrow{display:block;margin-bottom:12px;color:#087a3b;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.p7-about-hero h1{max-width:12ch;margin:0;color:#102019;font-size:clamp(46px,5.2vw,68px);font-weight:760;line-height:.98;letter-spacing:-.05em;text-wrap:balance}
.p7-about-hero-copy>p{max-width:62ch;margin:22px 0 0;color:#526159;font-size:18px;line-height:1.58}.p7-about-hero-copy>small{display:block;margin-top:12px;color:#6b7972;font-size:12px;line-height:1.5}
.p7-about-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}.p7-about-primary,.p7-about-secondary{min-height:48px;display:inline-flex;align-items:center;justify-content:center;padding:0 18px;border-radius:12px;font-size:14px;font-weight:760;text-decoration:none}
.p7-about-primary{background:#087a3b;color:#fff;border:1px solid #087a3b}.p7-about-primary:hover{background:#07572e}.p7-about-secondary{background:#fff;color:#173429;border:1px solid #cfddd5}.p7-about-secondary:hover{border-color:#96b5a4;background:#f2f7f4}
.p7-about-journey{overflow:hidden;border:1px solid #cfddd5;border-radius:20px;background:#fff;box-shadow:0 24px 64px rgba(16,42,29,.08)}.p7-about-journey>strong{display:block;padding:18px 20px;border-bottom:1px solid #dce5e0;color:#19382a;font-size:14px}
.p7-about-journey ol{margin:0;padding:8px 18px 16px;list-style:none}.p7-about-journey li{display:grid;grid-template-columns:32px minmax(0,1fr);align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid #e5ece8}.p7-about-journey li:last-child{border-bottom:0}.p7-about-journey i{width:30px;height:30px;display:grid;place-items:center;border-radius:50%;background:#edf6f0;color:#087a3b;font-size:11px;font-style:normal;font-weight:800}.p7-about-journey span{color:#2d493b;font-size:14px;font-weight:650;line-height:1.35}
.p7-about-section{padding:76px 0;border-top:1px solid #dfe8e3}.p7-about-section-head{display:grid;grid-template-columns:44px minmax(0,1fr);gap:18px;align-items:start;margin-bottom:28px}.p7-about-section-head>span,.p7-about-final>div>span{width:40px;height:40px;display:grid;place-items:center;border-radius:12px;background:#10291e;color:#fff;font-size:11px;font-weight:800}.p7-about-section h2,.p7-about-final h2,.p7-about-legal h2{margin:0;color:#152d22;font-size:clamp(30px,3.2vw,42px);font-weight:740;line-height:1.08;letter-spacing:-.035em}.p7-about-section-head p{max-width:76ch;margin:12px 0 0;color:#58685f;font-size:15px;line-height:1.58}
.p7-about-outcomes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-left:62px}.p7-about-outcome{min-width:0;display:grid;grid-template-columns:34px minmax(0,1fr);gap:11px;align-items:start;padding:18px;border:1px solid #d5e1da;border-radius:15px;background:#fff}.p7-about-outcome i{width:30px;height:30px;display:grid;place-items:center;border-radius:9px;background:#edf6f0;color:#087a3b;font-style:normal;font-weight:900}.p7-about-outcome span{color:#40564b;font-size:14px;line-height:1.55}
.p7-about-links{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-left:62px}.p7-about-link-card{min-width:0;min-height:156px;display:grid;align-content:start;gap:8px;padding:20px;border:1px solid #d5e1da;border-radius:16px;background:#fff;color:inherit;text-decoration:none;transition:transform 160ms ease,border-color 160ms ease,box-shadow 160ms ease}.p7-about-link-card:hover{transform:translateY(-2px);border-color:#a9c3b5;box-shadow:0 14px 34px rgba(16,42,29,.06)}.p7-about-link-card strong{color:#1a3528;font-size:16px;line-height:1.3}.p7-about-link-card span{color:#5b6a62;font-size:13px;line-height:1.55}.p7-about-link-card b{margin-top:auto;color:#087a3b;font-size:12px}
.p7-about-final{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:28px;align-items:end;padding:54px 48px;border-radius:24px;background:#10291e;color:#fff}.p7-about-final>div:first-child{display:grid;grid-template-columns:44px minmax(0,1fr);gap:14px}.p7-about-final h2{color:#fff;grid-column:2}.p7-about-final p{grid-column:2;max-width:68ch;margin:0;color:#c3d2ca;font-size:14px;line-height:1.58}.p7-about-final .p7-about-actions{margin:0}.p7-about-final .p7-about-secondary{background:transparent;border-color:#597568;color:#fff}
.p7-about-legal{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px;align-items:center;padding:42px 0;border-bottom:1px solid #dfe8e3}.p7-about-legal h2{font-size:22px}.p7-about-legal p{max-width:68ch;margin:8px 0 0;color:#64736b;font-size:13px;line-height:1.55}.p7-about-legal nav,.p7-about-bottom-nav{display:flex;gap:8px;flex-wrap:wrap}.p7-about-legal a,.p7-about-bottom-nav a{min-height:44px;display:inline-flex;align-items:center;padding:0 12px;border:1px solid #d5e1da;border-radius:999px;background:#fff;color:#334c40;font-size:12px;font-weight:700;text-decoration:none}.p7-about-bottom-nav{padding-top:20px}
@media(max-width:900px){.p7-about-hero{grid-template-columns:1fr;gap:30px}.p7-about-hero h1{max-width:15ch}.p7-about-outcomes,.p7-about-links{margin-left:0}.p7-about-final{grid-template-columns:1fr;align-items:start}.p7-about-legal{grid-template-columns:1fr}}
@media(max-width:600px){.p7-about-shell{width:min(100% - 28px,1180px);padding-top:88px}.p7-about-hero{padding:32px 0 50px}.p7-about-hero h1{font-size:clamp(36px,11vw,44px);line-height:1.02}.p7-about-hero-copy>p{font-size:16px;line-height:1.52}.p7-about-actions{display:grid;grid-template-columns:1fr}.p7-about-primary,.p7-about-secondary{width:100%}.p7-about-section{padding:54px 0}.p7-about-section-head{grid-template-columns:36px minmax(0,1fr);gap:12px}.p7-about-section-head>span,.p7-about-final>div>span{width:34px;height:34px}.p7-about-section h2,.p7-about-final h2{font-size:30px}.p7-about-outcomes,.p7-about-links{grid-template-columns:1fr}.p7-about-link-card{min-height:0}.p7-about-final{padding:32px 22px;border-radius:18px}.p7-about-final>div:first-child{grid-template-columns:36px minmax(0,1fr);gap:10px}.p7-about-legal{padding:34px 0}}
@media(prefers-reduced-motion:reduce){.p7-about-link-card{transition:none}.p7-about-link-card:hover{transform:none}}
@media(forced-colors:active){.p7-about-journey,.p7-about-outcome,.p7-about-link-card,.p7-about-final,.p7-about-primary,.p7-about-secondary,.p7-about-legal a,.p7-about-bottom-nav a{border:1px solid CanvasText}.p7-about-final{background:Canvas;color:CanvasText}.p7-about-final h2,.p7-about-final p{color:CanvasText}}
`;
