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
  title: string;
  lead: string;
  domainNote: string;
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
  status: string;
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
    metadataDescription: 'Прозрачная Цена помогает участникам агросделки в растениеводстве провести одну Сделку от условий и выбора контрагента до поставки, качества, документов, расчёта и закрытия.',
    title: 'Что такое «Прозрачная Цена»',
    lead: '«Прозрачная Цена» помогает провести агросделку в растениеводстве в одном месте: согласовать условия, выбрать контрагента, организовать поставку, принять товар, проверить качество и документы и понять, когда можно переходить к расчёту.',
    domainNote: 'Процент-Агро.рф — публичный домен платформы «Прозрачная Цена».',
    whatTitle: 'Что получает участник',
    bullets: [
      'Понимает, где находится Сделка сейчас и что нужно сделать дальше.',
      'Видит свою ответственность, связанные документы и подтверждённые события.',
      'Работает с логистикой, приёмкой, качеством и расчётными основаниями в одном контексте.',
      'Если появляется отклонение, видит причину, доказательства, ответственного и разрешённый следующий шаг.',
    ],
    trustTitle: 'Что подтверждено, а что требует подключения',
    trustLead: 'Платформа не выдаёт внешнюю систему за подключённую. Банк, государственная система, ЭДО, 1С или лабораторный контур считаются доступными только после подтверждения для конкретной организации.',
    trustLinks: [
      { title: 'Как проходит Сделка', note: 'Обычный путь Сделки и отдельно отмеченные примеры отклонений — без доступа к реальным данным.', href: '/platform-v7/how-it-works' },
      { title: 'Центр доверия', note: 'Полномочия, доказательства, данные, внешние подключения и границы Гекты.', href: '/platform-v7/trust' },
      { title: 'Гекта в работе', note: 'Как Гекта объясняет факты, риски и следующий разрешённый шаг — без самостоятельных полномочий.', href: '/platform-v7/ai-in-action' },
      { title: 'Задать вопрос', note: 'Отдельный канал помощи. Обращение не является регистрацией и не открывает кабинет.', href: '/platform-v7/contact' },
    ],
    contactTitle: 'Нужна помощь до регистрации?',
    contactText: 'Можно задать вопрос о платформе, ролях, документах или будущем подключении организации. Для рабочего кабинета используется отдельная регистрация.',
    contactCta: 'Задать вопрос',
    legalTitle: 'Правила и документы',
    legalText: 'Юридические и информационные страницы публикуются отдельно. Неподтверждённые реквизиты, статусы подключений и договорные обещания не подставляются автоматически.',
    home: 'На главную', status: 'Центр доверия', register: 'Зарегистрироваться', login: 'Войти',
    navDeal: 'Как работает', navTrust: 'Доверие', navContact: 'Контакты', open: 'Открыть',
  },
  en: {
    metadataTitle: 'About the platform — Transparent Price',
    metadataDescription: 'Transparent Price helps crop-trade participants run one Deal from terms and counterparty selection through delivery, quality, documents, settlement and closure.',
    title: 'What Transparent Price is',
    lead: 'Transparent Price helps participants run a crop Deal in one place: agree terms, choose a counterparty, organise delivery, accept the product, verify quality and documents, and see when settlement can proceed.',
    domainNote: 'Процент-Агро.рф is the public domain of the Transparent Price platform.',
    whatTitle: 'What a participant gets',
    bullets: [
      'A clear view of the current Deal stage and what needs to happen next.',
      'Role-specific responsibility, linked documents and confirmed execution events.',
      'Logistics, acceptance, quality and settlement grounds in one context.',
      'If a deviation occurs: cause, evidence, owner and the next permitted step.',
    ],
    trustTitle: 'What is confirmed and what still needs a connection',
    trustLead: 'The platform never presents an external system as connected by default. A bank, government system, EDI, 1C or laboratory circuit is available only after confirmation for the organisation.',
    trustLinks: [
      { title: 'How a Deal works', note: 'The ordinary journey plus clearly labelled deviation examples, without access to real Deal data.', href: '/platform-v7/how-it-works' },
      { title: 'Trust Center', note: 'Authority, evidence, data, external-connection and Gekta boundaries.', href: '/platform-v7/trust' },
      { title: 'Gekta in action', note: 'How Gekta explains facts, risks and the next permitted step without gaining independent authority.', href: '/platform-v7/ai-in-action' },
      { title: 'Ask a question', note: 'A separate help channel. Contact does not register a user or open a workspace.', href: '/platform-v7/contact' },
    ],
    contactTitle: 'Need help before registration?',
    contactText: 'Ask about the platform, roles, documents or a future organisation connection. A separate registration flow is used to obtain a workspace.',
    contactCta: 'Ask a question',
    legalTitle: 'Rules and documents',
    legalText: 'Legal and information pages remain separate. Unverified legal details, connection status or contractual promises are never filled in automatically.',
    home: 'Home', status: 'Trust Center', register: 'Register', login: 'Sign in',
    navDeal: 'How it works', navTrust: 'Trust', navContact: 'Contact', open: 'Open',
  },
  zh: {
    metadataTitle: '关于平台 — 透明价格',
    metadataDescription: '透明价格帮助种植业交易参与方在同一笔交易中管理条件、交易方选择、交付、质量、文件、结算与关闭。',
    title: '什么是“透明价格”',
    lead: '“透明价格”帮助参与方在一个地方完成种植业交易：确定条件、选择交易方、组织交付、验收商品、核验质量和文件，并看清何时可以进入结算。',
    domainNote: 'Процент-Агро.рф 是“透明价格”平台的公开域名。',
    whatTitle: '参与方获得什么',
    bullets: [
      '清楚看到交易当前阶段以及下一步需要完成什么。',
      '看到与自身角色相关的责任、文件和已确认履约事件。',
      '在同一上下文中处理物流、验收、质量和结算依据。',
      '发生偏差时看到原因、证据、责任方以及允许的下一步。',
    ],
    trustTitle: '哪些内容已确认，哪些仍需要接入',
    trustLead: '平台不会默认把外部系统显示为已连接。银行、政府系统、电子文件、1C 或实验室系统只有在机构接入被确认后才会显示为可用。',
    trustLinks: [
      { title: '交易如何运行', note: '普通交易路径以及明确标记的偏差示例，不访问真实交易数据。', href: '/platform-v7/how-it-works' },
      { title: '信任中心', note: '权限、证据、数据、外部连接和 Gekta 的边界。', href: '/platform-v7/trust' },
      { title: 'Gekta 实际运行', note: '了解 Gekta 如何解释事实、风险和允许的下一步，同时不获得独立权限。', href: '/platform-v7/ai-in-action' },
      { title: '提出问题', note: '独立帮助渠道。提交问题不会完成注册，也不会打开工作空间。', href: '/platform-v7/contact' },
    ],
    contactTitle: '注册前需要帮助？',
    contactText: '可以询问平台、角色、文件或未来的机构接入。获得工作空间需要使用独立注册流程。',
    contactCta: '提出问题',
    legalTitle: '规则与文件',
    legalText: '法律与信息页面保持独立。未经确认的法律信息、接入状态或合同承诺不会自动展示。',
    home: '返回首页', status: '信任中心', register: '注册', login: '登录',
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
    <>
      <PublicSiteHeader
        ariaLabel={copy.title}
        brandHomeLabel={copy.home}
        navLabel={copy.title}
        menuLabel={copy.navDeal}
        nav={nav}
        showMobileMenu
        localeControl={<PublicLocaleLink />}
        actions={(
          <>
            <Link href={`/platform-v7/login${lang}`} className='pc-site-action p7-about-login' aria-label={copy.login}>{copy.login}</Link>
            <Link href={`/platform-v7/register${lang}`} className='pc-site-action p7-about-register' aria-label={copy.register}>{copy.register}</Link>
          </>
        )}
      />
      <style>{ABOUT_HEADER_CSS}</style>

      <main style={{ display: 'grid', gap: 16, maxWidth: 1040, margin: '0 auto', padding: '88px 16px 56px' }}>
        <section style={sectionStyle}>
          <h1 style={{ fontSize: 'clamp(30px, 5vw, 48px)', lineHeight: 1.05, fontWeight: 850, color: 'var(--pc-text-primary, #0F1419)', margin: 0 }}>{copy.title}</h1>
          <p style={leadStyle}>{copy.lead}</p>
          <p style={mutedStyle}>{copy.domainNote}</p>
          <Link href={`/platform-v7/register${lang}`} style={primaryLinkStyle}>{copy.register}</Link>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>{copy.whatTitle}</h2>
          {copy.bullets.map((text) => <Bullet key={text} text={text} />)}
        </section>

        <section style={sectionStyle}>
          <div><h2 style={sectionTitleStyle}>{copy.trustTitle}</h2><p style={mutedStyle}>{copy.trustLead}</p></div>
          <div style={gridStyle}>{copy.trustLinks.map((item) => <PublicLink key={item.href} item={item} open={copy.open} locale={locale} />)}</div>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>{copy.contactTitle}</h2>
          <p style={mutedStyle}>{copy.contactText}</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href={`/platform-v7/register${lang}`} style={primaryLinkStyle}>{copy.register}</Link>
            <Link href={`/platform-v7/contact${lang}`} style={secondaryLinkStyle}>{copy.contactCta}</Link>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>{copy.legalTitle}</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {LEGAL_LINKS.map((item) => <Link key={item.href} href={`${item.href}${lang}`} style={pillStyle}>{item.label}</Link>)}
          </div>
          <p style={mutedStyle}>{copy.legalText}</p>
        </section>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href={`/platform-v7${lang}`} style={secondaryLinkStyle}>{copy.home}</Link>
          <Link href={`/platform-v7/trust${lang}`} style={secondaryLinkStyle}>{copy.status}</Link>
        </div>
      </main>
    </>
  );
}

function PublicLink({ item, open, locale }: { item: Card; open: string; locale: Locale }) {
  return (
    <Link href={`${item.href}?lang=${encodeURIComponent(locale)}`} style={{ textDecoration: 'none', background: '#F8FAFB', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18, display: 'grid', gap: 8, minHeight: 44 }}>
      <strong style={{ fontSize: 16, color: 'var(--pc-text-primary, #0F1419)' }}>{item.title}</strong>
      <span style={{ fontSize: 12, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.6 }}>{item.note}</span>
      <span style={{ fontSize: 12, fontWeight: 800, color: '#0A7A5F' }}>{open} →</span>
    </Link>
  );
}

function Bullet({ text }: { text: string }) {
  return <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: 'var(--pc-text-secondary, #475569)', lineHeight: 1.6 }}><span aria-hidden='true' style={{ fontWeight: 900 }}>•</span><span>{text}</span></div>;
}

const ABOUT_HEADER_CSS = `
.pc-site-header:has(.p7-about-register) .p7-about-login,
.pc-site-header:has(.p7-about-register) .p7-about-register{width:auto;padding:0 12px;white-space:nowrap}
.pc-site-header:has(.p7-about-register) .p7-about-register{background:#087a3b;border-color:#087a3b;color:#fff;font-weight:800}
.pc-site-header:has(.p7-about-register) .p7-about-register:hover,
.pc-site-header:has(.p7-about-register) .p7-about-register:focus-visible{background:#07572e;color:#fff}
@media(max-width:560px){
  .pc-site-header:has(.p7-about-register){gap:6px;padding-inline:10px}
  .pc-site-header:has(.p7-about-register) .pc-site-brand-text{display:none}
  .pc-site-header:has(.p7-about-register) .pc-site-actions{gap:4px}
  .pc-site-header:has(.p7-about-register) .p7-about-login{display:none!important}
  .pc-site-header:has(.p7-about-register) .p7-about-register{min-height:44px;padding:0 10px;font-size:13px}
}
@media(max-width:340px){
  .pc-site-header:has(.p7-about-register) .p7-about-register{padding:0 8px;font-size:12px}
}
@media(forced-colors:active){
  .pc-site-header:has(.p7-about-register) .p7-about-register{border:2px solid ButtonText}
}
`;

const sectionStyle = { background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18, display: 'grid', gap: 12 } as const;
const sectionTitleStyle = { fontSize: 20, lineHeight: 1.2, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)', margin: 0 } as const;
const leadStyle = { margin: '8px 0 0', fontSize: 15, color: 'var(--pc-text-secondary, #475569)', lineHeight: 1.65 } as const;
const mutedStyle = { margin: 0, fontSize: 13, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.7 } as const;
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 } as const;
const primaryLinkStyle = { width: 'fit-content', textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800, minHeight: 44, display: 'inline-flex', alignItems: 'center' } as const;
const secondaryLinkStyle = { width: 'fit-content', textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--pc-border, #E4E6EA)', background: '#fff', color: 'var(--pc-text-primary, #0F1419)', fontSize: 13, fontWeight: 700, minHeight: 44, display: 'inline-flex', alignItems: 'center' } as const;
const pillStyle = { textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '8px 10px', borderRadius: 999, background: '#F8FAFB', border: '1px solid var(--pc-border, #E4E6EA)', color: 'var(--pc-text-secondary, #475569)', fontSize: 12, fontWeight: 800 } as const;
