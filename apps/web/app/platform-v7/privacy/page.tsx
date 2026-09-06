import '@/styles/platform-v7-public-header.css';
import '@/styles/platform-v7-i18n-cjk.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { FileCheck2, LockKeyhole, ShieldCheck } from 'lucide-react';
import { PrivacyPortalPanel } from '@/components/platform-v7/PrivacyPortalPanel';
import { PublicLocaleLink } from '@/components/platform-v7/PublicLocaleLink';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';

type Locale = 'ru' | 'en' | 'zh';

type PrivacyCopy = Readonly<{
  metadataTitle: string;
  metadataDescription: string;
  brandHome: string;
  headerAria: string;
  menu: string;
  login: string;
  register: string;
  how: string;
  trust: string;
  about: string;
  eyebrow: string;
  title: string;
  lead: string;
  blocks: readonly Readonly<{ title: string; body: string }>[];
  relatedTitle: string;
  relatedLead: string;
  related: readonly Readonly<{ title: string; note: string; path: string }>[];
  open: string;
  minimizationTitle: string;
  minimizationText: string;
  rightsTitle: string;
  rightsLead: string;
  contact: string;
  terms: string;
}>;

const COPY: Record<Locale, PrivacyCopy> = {
  ru: {
    metadataTitle: 'Политика конфиденциальности — Прозрачная Цена',
    metadataDescription: 'Информация об обработке, ограничении доступа и защите данных пользователей и организаций платформы «Прозрачная Цена».',
    brandHome: 'Прозрачная Цена — на главную',
    headerAria: 'Навигация политики конфиденциальности',
    menu: 'Меню',
    login: 'Войти',
    register: 'Зарегистрироваться',
    how: 'Как работает',
    trust: 'Доверие',
    about: 'О платформе',
    eyebrow: 'Данные и приватность',
    title: 'Данные используются только в контексте конкретной операции',
    lead: 'Здесь описаны категории данных, цели обработки, границы доступа и права пользователя. Публичная страница не открывает данные Сделок и не назначает полномочия.',
    blocks: [
      { title: 'Какие данные используются', body: 'Платформа может обрабатывать данные учётной записи и контактов, сведения об организации и полномочиях пользователя, данные Сделок и документов, а также технические и защитные журналы, необходимые для работы, аудита и безопасности.' },
      { title: 'Для чего используются данные', body: 'Данные используются для регистрации и проверки доступа, сопровождения Сделки, отображения относящихся к ней фактов, документов и следующих действий, выполнения пользовательских запросов, предотвращения злоупотреблений, расследования инцидентов и поддержки пользователей.' },
      { title: 'Ограничение доступа', body: 'Доступ к данным ограничивается назначенными полномочиями, организацией пользователя и контекстом выполняемой операции. Критические действия проходят серверные проверки, а значимые события сохраняются в истории.' },
      { title: 'Хранение и удаление', body: 'Данные хранятся в объёме и в течение срока, необходимого для заявленной цели обработки, исполнения обязательств, обеспечения безопасности и выполнения требований законодательства. По завершении соответствующей цели данные удаляются, обезличиваются либо сохраняются только при наличии правового основания.' },
      { title: 'Передача внешним участникам', body: 'Передача данных банкам, перевозчикам, лабораториям, государственным информационным системам и другим участникам выполняется только когда это необходимо для соответствующей операции и при наличии применимого основания. Платформа не использует продажу персональных данных как способ монетизации.' },
      { title: 'Реквизиты оператора данных', body: 'Юридически значимые реквизиты оператора персональных данных публикуются только после их подтверждения официальными документами. Платформа не подставляет неподтверждённые наименование, ИНН, ОГРН или адрес. До публикации подтверждённых реквизитов запросы по правам субъекта данных можно направлять через встроенный портал ниже.' },
    ],
    relatedTitle: 'Связанные публичные разделы',
    relatedLead: 'Правила доверия, устройство платформы и официальный канал обращения доступны без перехода в закрытый кабинет.',
    related: [
      { title: 'Trust Center', note: 'Полномочия, доказательства, Гекта и границы внешних систем.', path: '/platform-v7/trust' },
      { title: 'О платформе', note: 'Как одна Сделка связывает участников, исполнение, документы и расчёт.', path: '/platform-v7/about' },
      { title: 'Контакты', note: 'Официальный канал вопросов по платформе и обработке обращения.', path: '/platform-v7/contact' },
    ],
    open: 'Открыть',
    minimizationTitle: 'Принцип минимизации',
    minimizationText: 'Платформа использует только данные, необходимые для конкретной операции, безопасности, доказательности и выполнения применимых требований, без избыточного сбора персональной информации.',
    rightsTitle: 'Права субъекта персональных данных · 152-ФЗ',
    rightsLead: 'Запрос по правам субъекта данных обрабатывается отдельно от регистрации, Сделки и назначения роли.',
    contact: 'Связаться с платформой',
    terms: 'Условия использования',
  },
  en: {
    metadataTitle: 'Privacy policy — Transparent Price',
    metadataDescription: 'Information about data processing, access boundaries and protection for users and organisations of the Transparent Price platform.',
    brandHome: 'Transparent Price — home',
    headerAria: 'Privacy policy navigation',
    menu: 'Menu',
    login: 'Sign in',
    register: 'Register',
    how: 'How it works',
    trust: 'Trust',
    about: 'About',
    eyebrow: 'Data and privacy',
    title: 'Data is used only in the context of a specific operation',
    lead: 'This page describes data categories, processing purposes, access boundaries and user rights. A public page does not expose Deal data or grant authority.',
    blocks: [
      { title: 'Data categories', body: 'The platform may process account and contact data, organisation and user-authority information, Deal and document data, and technical or security logs required for operation, audit and security.' },
      { title: 'Processing purposes', body: 'Data is used for registration and access checks, Deal execution, presentation of relevant facts, documents and next actions, user requests, abuse prevention, incident investigation and user support.' },
      { title: 'Access boundaries', body: 'Access is constrained by assigned authority, the user organisation and the current operation context. Critical actions are checked server-side and consequential events remain in the history.' },
      { title: 'Retention and deletion', body: 'Data is retained only to the extent and for the period required by the stated processing purpose, obligations, security and applicable legal requirements. When the purpose ends, data is deleted, anonymised or retained only where a legal basis remains.' },
      { title: 'Sharing with external participants', body: 'Data is shared with banks, carriers, laboratories, government information systems or other participants only where needed for the relevant operation and where an applicable basis exists. Personal-data sale is not used as a monetisation model.' },
      { title: 'Data-controller details', body: 'Legally significant data-controller details are published only after confirmation by official documents. The platform does not invent or substitute an unconfirmed legal name, tax identifier, registration number or address. Until confirmed details are published, data-subject requests can be submitted through the portal below.' },
    ],
    relatedTitle: 'Related public sections',
    relatedLead: 'Trust rules, the platform model and the official contact channel are available without entering a protected workspace.',
    related: [
      { title: 'Trust Center', note: 'Authority, evidence, Gekta and external-system boundaries.', path: '/platform-v7/trust' },
      { title: 'About', note: 'How one Deal connects participants, execution, documents and settlement.', path: '/platform-v7/about' },
      { title: 'Contact', note: 'Official channel for platform and data-processing inquiries.', path: '/platform-v7/contact' },
    ],
    open: 'Open',
    minimizationTitle: 'Data minimisation',
    minimizationText: 'The platform uses only data needed for the specific operation, security, evidence and applicable requirements, without collecting unnecessary personal information.',
    rightsTitle: 'Data-subject rights',
    rightsLead: 'A data-subject request is handled separately from registration, Deal execution and role assignment.',
    contact: 'Contact the platform',
    terms: 'Terms of use',
  },
  zh: {
    metadataTitle: '隐私政策 — 透明价格',
    metadataDescription: '透明价格平台关于用户与机构数据处理、访问边界和保护方式的信息。',
    brandHome: '透明价格 — 返回首页',
    headerAria: '隐私政策导航',
    menu: '菜单',
    login: '登录',
    register: '注册',
    how: '如何运行',
    trust: '信任',
    about: '关于平台',
    eyebrow: '数据与隐私',
    title: '数据仅在具体业务操作的上下文中使用',
    lead: '本页说明数据类别、处理目的、访问边界和用户权利。公开页面不会开放交易数据，也不会授予权限。',
    blocks: [
      { title: '使用哪些数据', body: '平台可能处理账户和联系方式、机构与用户权限信息、交易和文件数据，以及运行、审计和安全所需的技术与安全日志。' },
      { title: '数据用于什么目的', body: '数据用于注册与访问检查、交易履约、展示相关事实、文件和下一步操作、处理用户请求、防止滥用、调查事件以及提供用户支持。' },
      { title: '访问边界', body: '数据访问受已分配权限、用户所属机构和当前操作上下文限制。关键操作由服务器检查，重要事件保留在历史记录中。' },
      { title: '保存与删除', body: '数据仅在实现既定处理目的、履行义务、保障安全和满足适用法律要求所需的范围和期限内保存。相关目的结束后，数据将被删除、匿名化，或仅在仍有法律依据时继续保存。' },
      { title: '向外部参与方传输', body: '仅在具体业务操作需要且存在适用依据时，才向银行、承运方、实验室、政府信息系统或其他参与方传输数据。平台不以出售个人数据作为变现方式。' },
      { title: '数据控制方信息', body: '具有法律意义的数据控制方信息仅在官方文件确认后发布。平台不会虚构或替代未经确认的法定名称、税务标识、登记号或地址。在确认信息发布前，可通过下方入口提交数据主体权利请求。' },
    ],
    relatedTitle: '相关公开页面',
    relatedLead: '无需进入受保护工作区，即可查看信任规则、平台模式和官方联系渠道。',
    related: [
      { title: '信任中心', note: '权限、证据、Gekta 与外部系统边界。', path: '/platform-v7/trust' },
      { title: '关于平台', note: '一笔交易如何连接参与方、履约、文件与结算。', path: '/platform-v7/about' },
      { title: '联系', note: '平台和数据处理问题的官方联系渠道。', path: '/platform-v7/contact' },
    ],
    open: '打开',
    minimizationTitle: '数据最小化原则',
    minimizationText: '平台仅使用具体操作、安全、证据和适用要求所必需的数据，不进行不必要的个人信息收集。',
    rightsTitle: '数据主体权利',
    rightsLead: '数据主体请求与注册、交易履约和角色分配分开处理。',
    contact: '联系平台',
    terms: '使用条款',
  },
};

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
      canonical: '/platform-v7/privacy',
      languages: {
        ru: '/platform-v7/privacy?lang=ru',
        en: '/platform-v7/privacy?lang=en',
        zh: '/platform-v7/privacy?lang=zh',
      },
    },
    robots: { index: false, follow: true },
  };
}

export default async function PrivacyPage() {
  const locale = localeOf(await getLocale());
  const copy = COPY[locale];
  const chrome = await getTranslations('publicEntry.chrome');
  const suffix = `?lang=${locale}`;
  const home = `/platform-v7${suffix}`;
  const nav = (
    <>
      <Link href={`${home}#deal-path`}>{copy.how}</Link>
      <Link href={`/platform-v7/trust${suffix}`}>{copy.trust}</Link>
      <Link href={`/platform-v7/about${suffix}`}>{copy.about}</Link>
    </>
  );

  return (
    <div className='p7-privacy-page'>
      <style>{CSS}</style>
      <a className='pc-skip-link' href='#main-content'>{chrome('skipToContent')}</a>
      <PublicSiteHeader
        ariaLabel={copy.headerAria}
        brandHomeLabel={copy.brandHome}
        navLabel={copy.headerAria}
        menuLabel={copy.menu}
        nav={nav}
        showMobileMenu
        localeControl={<PublicLocaleLink />}
        actions={(
          <div className='pc-v6-header-actions'>
            <Link href={`/platform-v7/login${suffix}`} className='entry-login'>{copy.login}</Link>
            <Link href={`/platform-v7/register${suffix}`} className='pc-v6-header-cta'>{copy.register}</Link>
          </div>
        )}
      />

      <main id='main-content' tabIndex={-1}>
        <section className='p7-privacy-hero' aria-labelledby='p7-privacy-title'>
          <span>{copy.eyebrow}</span>
          <h1 id='p7-privacy-title'>{copy.title}</h1>
          <p>{copy.lead}</p>
        </section>

        <section className='p7-privacy-blocks' aria-label={copy.title}>
          {copy.blocks.map((block, index) => (
            <article key={block.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div><h2>{block.title}</h2><p>{block.body}</p></div>
            </article>
          ))}
        </section>

        <section className='p7-privacy-related' aria-labelledby='p7-privacy-related-title'>
          <div className='p7-privacy-section-head'>
            <span><ShieldCheck aria-hidden='true' />{copy.relatedTitle}</span>
            <h2 id='p7-privacy-related-title'>{copy.relatedLead}</h2>
          </div>
          <div className='p7-privacy-related-grid'>
            {copy.related.map((item) => (
              <Link key={item.path} href={`${item.path}${suffix}`}>
                <strong>{item.title}</strong><p>{item.note}</p><span>{copy.open} →</span>
              </Link>
            ))}
          </div>
        </section>

        <section className='p7-privacy-minimization'>
          <LockKeyhole aria-hidden='true' />
          <div><h2>{copy.minimizationTitle}</h2><p>{copy.minimizationText}</p></div>
        </section>

        <section className='p7-privacy-rights' aria-labelledby='p7-privacy-rights-title'>
          <div className='p7-privacy-section-head'>
            <span><FileCheck2 aria-hidden='true' />{copy.rightsTitle}</span>
            <h2 id='p7-privacy-rights-title'>{copy.rightsLead}</h2>
          </div>
          <PrivacyPortalPanel />
        </section>

        <div className='p7-privacy-actions'>
          <Link href={`/platform-v7/contact${suffix}`} className='p7-privacy-primary'>{copy.contact}</Link>
          <Link href={`/platform-v7/terms${suffix}`}>{copy.terms}</Link>
        </div>
      </main>
    </div>
  );
}

const CSS = `
.p7-privacy-page{--green:#087a3b;--dark:#07572e;--ink:#102019;--muted:#526159;--line:#d4dfd8;min-height:100dvh;padding-top:64px;background:linear-gradient(180deg,#f8fbf9 0%,#f3f7f4 55%,#fff 100%);color:var(--ink);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.p7-privacy-page *{box-sizing:border-box}.p7-privacy-page main{width:min(1120px,calc(100% - 32px));margin:0 auto;padding:56px 0 80px}.p7-privacy-page .entry-login,.p7-privacy-page .pc-v6-header-cta{min-height:44px;display:inline-flex;align-items:center;justify-content:center;padding:0 12px;border-radius:11px;text-decoration:none;font-size:13px;font-weight:760;white-space:nowrap}.p7-privacy-page .entry-login{border:1px solid #c6d5cb;background:#fff;color:#173d2b}.p7-privacy-page .pc-v6-header-cta{border:1px solid var(--green);background:var(--green);color:#fff}.p7-privacy-hero{max-width:880px}.p7-privacy-hero>span,.p7-privacy-section-head>span{display:inline-flex;align-items:center;gap:7px;color:var(--green);font-size:12px;font-weight:800;letter-spacing:.045em;text-transform:uppercase}.p7-privacy-hero h1{max-width:18ch;margin:13px 0 0;font-size:clamp(40px,5vw,64px);line-height:1.01;letter-spacing:-.05em;text-wrap:balance}.p7-privacy-hero p{max-width:70ch;margin:20px 0 0;color:var(--muted);font-size:17px;line-height:1.55}.p7-privacy-blocks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;margin-top:34px}.p7-privacy-blocks article{display:grid;grid-template-columns:38px minmax(0,1fr);gap:12px;padding:20px;border:1px solid var(--line);border-radius:17px;background:#fff;box-shadow:0 12px 30px rgba(16,42,29,.045)}.p7-privacy-blocks article>span{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:#edf6f0;color:var(--green);font-size:11px;font-weight:850}.p7-privacy-blocks h2,.p7-privacy-minimization h2{margin:0;font-size:18px;line-height:1.25}.p7-privacy-blocks p,.p7-privacy-minimization p{margin:8px 0 0;color:var(--muted);font-size:13px;line-height:1.56}.p7-privacy-related,.p7-privacy-rights{margin-top:30px;padding:24px;border:1px solid var(--line);border-radius:19px;background:#fff}.p7-privacy-section-head{display:grid;gap:8px}.p7-privacy-section-head h2{max-width:38ch;margin:0;font-size:clamp(24px,3vw,34px);line-height:1.1;letter-spacing:-.03em}.p7-privacy-related-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:18px}.p7-privacy-related-grid a{display:grid;gap:7px;min-height:150px;padding:16px;border:1px solid var(--line);border-radius:14px;background:#f8faf9;color:inherit;text-decoration:none}.p7-privacy-related-grid strong{font-size:16px}.p7-privacy-related-grid p{margin:0;color:var(--muted);font-size:12.5px;line-height:1.48}.p7-privacy-related-grid a>span{align-self:end;color:var(--green);font-size:12px;font-weight:800}.p7-privacy-minimization{display:grid;grid-template-columns:46px minmax(0,1fr);gap:14px;margin-top:18px;padding:20px;border:1px solid #bfd7c8;border-radius:17px;background:#edf7f0}.p7-privacy-minimization>svg{width:22px;height:22px;padding:11px;border-radius:12px;background:#fff;color:var(--green)}.p7-privacy-rights .p7-privacy-section-head{margin-bottom:18px}.p7-privacy-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:22px}.p7-privacy-actions a{min-height:44px;display:inline-flex;align-items:center;justify-content:center;padding:0 14px;border:1px solid var(--line);border-radius:11px;background:#fff;color:#173d2b;text-decoration:none;font-size:13px;font-weight:760}.p7-privacy-actions .p7-privacy-primary{border-color:var(--green);background:var(--green);color:#fff}.p7-privacy-page a:focus-visible,.p7-privacy-page button:focus-visible,.p7-privacy-page input:focus-visible,.p7-privacy-page textarea:focus-visible{outline:3px solid rgba(8,122,59,.25);outline-offset:2px}@media(max-width:760px){.p7-privacy-page main{width:min(100% - 24px,1120px);padding:34px 0 54px}.p7-privacy-hero h1{max-width:100%;font-size:clamp(33px,10vw,45px)}.p7-privacy-hero p{font-size:15px}.p7-privacy-blocks{grid-template-columns:1fr;margin-top:25px}.p7-privacy-related,.p7-privacy-rights{padding:18px}.p7-privacy-related-grid{grid-template-columns:1fr}.p7-privacy-related-grid a{min-height:0}.p7-privacy-actions{display:grid;grid-template-columns:1fr}.p7-privacy-actions a{width:100%}}@media(max-width:560px){.p7-privacy-page .entry-login{display:none}.p7-privacy-page .pc-v6-header-cta{padding-inline:10px;font-size:12px}}@media(forced-colors:active){.p7-privacy-blocks article,.p7-privacy-related,.p7-privacy-related-grid a,.p7-privacy-minimization,.p7-privacy-rights,.p7-privacy-actions a{border:2px solid ButtonText;background:Canvas;color:ButtonText}}
`;
