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
  exploreTitle: string;
  exploreLead: string;
  exploreLinks: readonly Card[];
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
    metadataDescription: 'Прозрачная Цена помогает участникам агросделки в растениеводстве вести одну Сделку от условий и выбора контрагента до поставки, качества, документов, расчёта и закрытия.',
    title: 'О платформе',
    lead: '«Прозрачная Цена» — единый цифровой контур агросделки в растениеводстве. Он связывает участников, условия, исполнение, качество, документы, расчётные основания и исключения в одной истории Сделки.',
    domainNote: 'Процент-Агро.рф — публичный домен платформы «Прозрачная Цена».',
    whatTitle: 'Что получает участник',
    bullets: [
      'Понимает, где находится Сделка сейчас и какое действие требуется дальше.',
      'Видит свою ответственность, связанные документы и подтверждённые события исполнения.',
      'Работает с поставкой, логистикой, приёмкой, качеством и расчётными основаниями в одном контексте.',
      'При отклонении видит причину, доказательства, ответственного и разрешённый следующий шаг.',
    ],
    trustTitle: 'Доверие без лишних обещаний',
    trustLead: 'Публичные страницы отделяют возможности платформы от внешних подключений. Банк, государственная система, ЭДО, 1С или лабораторный контур не считаются подключёнными без подтверждения для конкретной организации.',
    trustLinks: [
      { title: 'Как проходит Сделка', note: 'Обычный путь сделки и отдельно отмеченные примеры отклонений — без доступа к реальным данным.', href: '/platform-v7/how-it-works' },
      { title: 'Центр доверия', note: 'Правила полномочий, доказательств, данных, внешних подключений и Гекты.', href: '/platform-v7/trust' },
      { title: 'Состояние системы', note: 'Подтверждаемые внутренние сигналы и честная граница внешних систем.', href: '/platform-v7/status' },
      { title: 'Задать вопрос', note: 'Отдельный канал помощи. Обращение не является регистрацией и не открывает кабинет.', href: '/platform-v7/contact' },
    ],
    exploreTitle: 'Основные публичные разделы',
    exploreLead: 'Материалы объясняют отдельные части агросделки. Некоторые исторические адреса страниц содержат слово grain, но позиционирование платформы охватывает сделки растениеводства, а не только зерно.',
    exploreLinks: [
      { title: 'Исполнение сделки', note: 'Условия, поставка, приёмка, документы, расчёт и доказательства.', href: '/platform-v7/secure-grain-deal' },
      { title: 'Логистика', note: 'Перевозка, водитель, маршрут, контрольные точки и подтверждение доставки.', href: '/platform-v7/grain-logistics' },
      { title: 'Качество и приёмка', note: 'Вес, показатели качества, расхождения и подтверждающие материалы.', href: '/platform-v7/grain-quality' },
      { title: 'Документы', note: 'Комплектность и связь документов с фактическим исполнением Сделки.', href: '/platform-v7/grain-documents' },
      { title: 'Расчётные основания', note: 'Что должно быть подтверждено до финансового действия.', href: '/platform-v7/grain-payment' },
      { title: 'Государственные данные', note: 'Внешний обмен показывается как доступный только после подтверждённого подключения.', href: '/platform-v7/fgis-zerno' },
    ],
    contactTitle: 'Нужна помощь до регистрации?',
    contactText: 'Можно задать вопрос о платформе, ролях, документах или будущем подключении организации. Для получения рабочего кабинета используется отдельная регистрация.',
    contactCta: 'Задать вопрос',
    legalTitle: 'Правила и документы',
    legalText: 'Юридические и информационные страницы публикуются отдельно от маркетинговых формулировок. Неподтверждённые реквизиты, статусы подключений и договорные обещания не подставляются автоматически.',
    home: 'На главную', status: 'Состояние системы', register: 'Зарегистрироваться', login: 'Войти',
    navDeal: 'Как работает', navTrust: 'Доверие', navContact: 'Контакты', open: 'Открыть',
  },
  en: {
    metadataTitle: 'About the platform — Transparent Price',
    metadataDescription: 'Transparent Price helps crop-trade participants run one Deal from terms and counterparty selection through delivery, quality, documents, settlement grounds and closure.',
    title: 'About the platform',
    lead: 'Transparent Price is a unified digital crop-trade workflow. It links participants, terms, execution, quality, documents, settlement grounds and exceptions in one Deal history.',
    domainNote: 'Процент-Агро.рф is the public domain of the Transparent Price platform.',
    whatTitle: 'What a participant gets',
    bullets: [
      'A clear view of the current Deal stage and the next required action.',
      'Role-specific responsibility, linked documents and verified execution events.',
      'Delivery, logistics, acceptance, quality and settlement grounds in one context.',
      'For deviations: cause, evidence, owner and the next permitted step.',
    ],
    trustTitle: 'Trust without overclaiming',
    trustLead: 'Public pages separate platform capability from external connectivity. A bank, government system, EDI, 1C or laboratory circuit is not presented as connected until it is confirmed for the organisation.',
    trustLinks: [
      { title: 'How a Deal works', note: 'The ordinary journey plus clearly labelled deviation examples, without access to real Deal data.', href: '/platform-v7/how-it-works' },
      { title: 'Trust Center', note: 'Authority, evidence, data, external-connection and Gekta boundaries.', href: '/platform-v7/trust' },
      { title: 'System status', note: 'Verifiable internal signals and an explicit external-system boundary.', href: '/platform-v7/status' },
      { title: 'Ask a question', note: 'A separate help channel. Contact does not register a user or open a workspace.', href: '/platform-v7/contact' },
    ],
    exploreTitle: 'Main public sections',
    exploreLead: 'These pages explain individual parts of an agricultural Deal. Some historical route names still contain “grain”, but platform positioning covers crop transactions rather than grain only.',
    exploreLinks: [
      { title: 'Deal execution', note: 'Terms, delivery, acceptance, documents, settlement and evidence.', href: '/platform-v7/secure-grain-deal' },
      { title: 'Logistics', note: 'Transport, driver, route, checkpoints and delivery evidence.', href: '/platform-v7/grain-logistics' },
      { title: 'Quality and acceptance', note: 'Weight, quality indicators, discrepancies and supporting evidence.', href: '/platform-v7/grain-quality' },
      { title: 'Documents', note: 'Document completeness and relationship to actual Deal execution.', href: '/platform-v7/grain-documents' },
      { title: 'Settlement grounds', note: 'What must be confirmed before a financial action.', href: '/platform-v7/grain-payment' },
      { title: 'Government data', note: 'External exchange is shown as available only after a confirmed connection.', href: '/platform-v7/fgis-zerno' },
    ],
    contactTitle: 'Need help before registration?',
    contactText: 'Ask about the platform, roles, documents or a future organisation connection. A separate registration flow is used to obtain a workspace.',
    contactCta: 'Ask a question',
    legalTitle: 'Rules and documents',
    legalText: 'Legal and information pages remain separate from marketing copy. Unverified legal details, connection status or contractual promises are never filled in automatically.',
    home: 'Home', status: 'System status', register: 'Register', login: 'Sign in',
    navDeal: 'How it works', navTrust: 'Trust', navContact: 'Contact', open: 'Open',
  },
  zh: {
    metadataTitle: '关于平台 — 透明价格',
    metadataDescription: '透明价格帮助种植业交易参与方在同一笔交易中管理条件、交易方选择、交付、质量、文件、结算依据和关闭。',
    title: '关于平台',
    lead: '“透明价格”是种植业农业交易的统一数字流程，把参与方、条件、履约、质量、文件、结算依据和异常情况连接到同一笔交易历史中。',
    domainNote: 'Процент-Агро.рф 是“透明价格”平台的公开域名。',
    whatTitle: '参与方获得什么',
    bullets: [
      '清楚看到交易当前阶段以及下一步需要完成的操作。',
      '看到与自身角色相关的责任、文件和已确认履约事件。',
      '在同一上下文中处理交付、物流、验收、质量和结算依据。',
      '发生偏差时看到原因、证据、责任方以及允许的下一步。',
    ],
    trustTitle: '信任来自可验证边界，而不是夸大承诺',
    trustLead: '公开页面将平台能力与外部连接分开。银行、政府系统、电子文件、1C 或实验室系统只有在机构接入被确认后，才会显示为已连接。',
    trustLinks: [
      { title: '交易如何运行', note: '普通交易路径以及明确标记的偏差示例，不访问真实交易数据。', href: '/platform-v7/how-it-works' },
      { title: '信任中心', note: '权限、证据、数据、外部连接和 Gekta 的边界。', href: '/platform-v7/trust' },
      { title: '系统状态', note: '可验证的内部信号以及明确的外部系统边界。', href: '/platform-v7/status' },
      { title: '提出问题', note: '独立帮助渠道。提交问题不会完成注册，也不会打开工作空间。', href: '/platform-v7/contact' },
    ],
    exploreTitle: '主要公开页面',
    exploreLead: '这些页面解释农业交易的各个部分。部分历史地址仍包含 grain 一词，但平台定位覆盖种植业交易，而不仅限于粮食。',
    exploreLinks: [
      { title: '交易履约', note: '条件、交付、验收、文件、结算与证据。', href: '/platform-v7/secure-grain-deal' },
      { title: '物流', note: '运输、司机、路线、检查点和交付证明。', href: '/platform-v7/grain-logistics' },
      { title: '质量与验收', note: '重量、质量指标、差异和证明材料。', href: '/platform-v7/grain-quality' },
      { title: '文件', note: '文件完整性以及与实际履约的关联。', href: '/platform-v7/grain-documents' },
      { title: '结算依据', note: '金融操作前必须确认哪些事实。', href: '/platform-v7/grain-payment' },
      { title: '政府数据', note: '只有接入确认后，外部交换才显示为可用。', href: '/platform-v7/fgis-zerno' },
    ],
    contactTitle: '注册前需要帮助？',
    contactText: '可以询问平台、角色、文件或未来的机构接入。获得工作空间需要使用独立注册流程。',
    contactCta: '提出问题',
    legalTitle: '规则与文件',
    legalText: '法律与信息页面和营销文案保持分离。未经确认的法律信息、接入状态或合同承诺不会自动展示。',
    home: '返回首页', status: '系统状态', register: '注册', login: '登录',
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
          <div><h2 style={sectionTitleStyle}>{copy.exploreTitle}</h2><p style={mutedStyle}>{copy.exploreLead}</p></div>
          <div style={gridStyle}>{copy.exploreLinks.map((item) => <PublicLink key={item.href} item={item} open={copy.open} locale={locale} />)}</div>
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
          <Link href={`/platform-v7/status${lang}`} style={secondaryLinkStyle}>{copy.status}</Link>
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
  .pc-site-header:has(.p7-about-register) .p7-about-login{width:44px;min-width:44px;padding:0;font-size:0}
  .pc-site-header:has(.p7-about-register) .p7-about-login::before{content:'↪';font-size:18px;line-height:1}
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
