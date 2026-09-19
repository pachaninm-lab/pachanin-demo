import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { Bot, Building2, FileCheck2, KeyRound, Network, ShieldCheck } from 'lucide-react';
import { PublicLocaleLink } from '@/components/platform-v7/PublicLocaleLink';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';

type Locale = 'ru' | 'en' | 'zh';
type TrustCard = Readonly<{ title: string; text: string; points: readonly string[] }>;
type TrustStep = Readonly<{ label: string; title: string; text: string }>;

type Copy = Readonly<{
  metadataTitle: string;
  metadataDescription: string;
  eyebrow: string;
  title: string;
  lead: string;
  principle: string;
  principleText: string;
  facts: readonly [string, string, string];
  boundariesTitle: string;
  boundariesLead: string;
  boundaries: readonly [TrustCard, TrustCard, TrustCard, TrustCard];
  pathTitle: string;
  pathLead: string;
  path: readonly [TrustStep, TrustStep, TrustStep];
  finalTitle: string;
  finalText: string;
  claimBoundary: string;
  register: string;
  registerShort: string;
  login: string;
  contact: string;
  privacy: string;
  home: string;
  brandHome: string;
  navHow: string;
  navAbout: string;
  navContact: string;
}>;

const COPY: Record<Locale, Copy> = {
  ru: {
    metadataTitle: 'Доверие в Сделке — Прозрачная Цена',
    metadataDescription: 'Как в «Прозрачной Цене» устроены полномочия, основания действий, внешние системы и границы Гекты внутри одной Сделки.',
    eyebrow: 'Доверие в одной Сделке',
    title: 'Понятно, кто может действовать, на каком основании и где проходит граница платформы',
    lead: 'Доверие здесь строится не вокруг отдельного рейтинга или рекламного бейджа. Оно следует из архитектуры Сделки: роль определяет доступные действия, критический шаг связан с основанием, а внешние системы и Гекта не получают чужих полномочий.',
    principle: 'Главный принцип',
    principleText: 'Экран помогает понять Сделку, но право на критическое действие остаётся у участника, которому оно принадлежит по роли и организационному контуру.',
    facts: ['Роль → доступные действия', 'Основание → действие → история', 'Гекта → объяснение, не решение'],
    boundariesTitle: 'Четыре границы, которые держат Сделку в порядке',
    boundariesLead: 'Вместо абстрактного обещания безопасности пользователь видит, где находятся полномочия, данные, внешние системы и интеллектуальная помощь.',
    boundaries: [
      {
        title: 'Полномочия принадлежат участнику, а не экрану',
        text: 'Организация и роль задают рабочий контекст конкретного участника.',
        points: [
          'Публичный выбор роли не назначает права.',
          'URL и состояние браузера не являются источником полномочий.',
          'Критические решения подтверждает уполномоченный участник.',
        ],
      },
      {
        title: 'У Сделки одна связная история',
        text: 'Условия, исполнение, документы, качество, решения и денежные последствия остаются в одном контексте.',
        points: [
          'Изменение связано с автором, основанием и результатом.',
          'Версии документов не отрываются от событий Сделки.',
          'Публичная поверхность не раскрывает данные частного кабинета или другой организации.',
        ],
      },
      {
        title: 'Внешние системы остаются отдельными контурами',
        text: 'Банк, ФНС, ФГИС, ЭДО, 1С и лабораторные системы сохраняют собственную предметную ответственность.',
        points: [
          'Банк отвечает за движение денег, а не интерфейс платформы.',
          'Источник внешнего факта сохраняется вместе с его контекстом.',
          'Адаптер передаёт только необходимое и не расширяет полномочия участника.',
        ],
      },
      {
        title: 'Гекта помогает понять, но не становится стороной Сделки',
        text: 'Интеллектуальный слой работает с фактами, документами и контекстом конкретного шага.',
        points: [
          'Гекта сопоставляет условия, события, документы и источники.',
          'Гекта объясняет риск и показывает допустимые варианты действий.',
          'У Гекты нет самостоятельного права изменить Сделку, перевести деньги или принять критическое решение.',
        ],
      },
    ],
    pathTitle: 'Как это выглядит для обычного пользователя',
    pathLead: 'Не нужно читать техническую документацию, чтобы понять причину критического шага: рабочий интерфейс показывает цепочку от условия к факту и следующему действию.',
    path: [
      { label: '01', title: 'Условие', text: 'Что стороны согласовали по товару, поставке, качеству, документам и расчёту.' },
      { label: '02', title: 'Факт', text: 'Что произошло в исполнении и какие материалы относятся именно к этой Сделке.' },
      { label: '03', title: 'Действие', text: 'Что может сделать эта роль дальше и на каком основании меняется результат.' },
    ],
    finalTitle: 'Перейти от публичного объяснения к своей организации',
    finalText: 'Регистрация — основной путь в платформу. После неё рабочий контекст строится вокруг организации и роли; публичные примеры на этой странице прав не назначают.',
    claimBoundary: 'Платформа не заявляет без доказательств о внешнем статусе, подтверждении или доступности подключения.',
    register: 'Зарегистрироваться',
    registerShort: 'Регистрация',
    login: 'Войти',
    contact: 'Задать вопрос',
    privacy: 'Обработка данных',
    home: 'На главную',
    brandHome: 'Прозрачная Цена — на главную',
    navHow: 'Как работает',
    navAbout: 'О платформе',
    navContact: 'Контакты',
  },
  en: {
    metadataTitle: 'Trust inside a Deal — Transparent Price',
    metadataDescription: 'How Transparent Price structures authority, action grounds, external systems and Gekta boundaries inside one Deal.',
    eyebrow: 'Trust inside one Deal',
    title: 'See who may act, what grounds the action and where the platform boundary sits',
    lead: 'Trust is not presented as a separate score or marketing badge. It follows from the Deal architecture: the role determines available actions, a critical step stays linked to its grounds, and external systems and Gekta do not inherit another participant’s authority.',
    principle: 'Core principle',
    principleText: 'The interface helps explain the Deal, while authority for a critical action remains with the participant who owns that action through role and organisation context.',
    facts: ['Role → available actions', 'Grounds → action → history', 'Gekta → explanation, not decision'],
    boundariesTitle: 'Four boundaries that keep one Deal coherent',
    boundariesLead: 'Instead of an abstract security promise, the participant can see where authority, data, external systems and intelligence assistance belong.',
    boundaries: [
      {
        title: 'Authority belongs to the participant, not the screen',
        text: 'Organisation context and role define the participant’s working surface.',
        points: [
          'Choosing a role on a public page does not grant permissions.',
          'A URL or browser state is not a source of authority.',
          'Critical decisions are confirmed by the authorised participant.',
        ],
      },
      {
        title: 'A Deal keeps one connected history',
        text: 'Terms, execution, documents, quality, decisions and monetary consequences remain in the same context.',
        points: [
          'A change stays linked to its author, grounds and outcome.',
          'Document versions stay linked to Deal events.',
          'The public surface does not expose a private workspace or another organisation’s data.',
        ],
      },
      {
        title: 'External systems remain separate domains',
        text: 'Banks, registries, EDI, accounting and laboratory systems retain their own subject-matter responsibility.',
        points: [
          'The bank owns money movement rather than the platform interface.',
          'The source of an external fact stays attached to its context.',
          'An adapter passes only what is needed and does not expand participant authority.',
        ],
      },
      {
        title: 'Gekta helps explain without becoming a Deal party',
        text: 'The intelligence layer works with facts, documents and the context of a specific Deal step.',
        points: [
          'Gekta compares terms, events, documents and sources.',
          'Gekta explains risk and presents permitted action options.',
          'Gekta has no independent authority to change a Deal, move money or make a critical decision.',
        ],
      },
    ],
    pathTitle: 'What this means for an ordinary participant',
    pathLead: 'A participant should not need technical documentation to understand a critical step. The workspace shows a clear chain from the agreed term to the execution fact and the next action.',
    path: [
      { label: '01', title: 'Term', text: 'What the parties agreed for product, delivery, quality, documents and settlement.' },
      { label: '02', title: 'Fact', text: 'What happened during execution and which materials belong to this Deal.' },
      { label: '03', title: 'Action', text: 'What this role may do next and which grounds explain the change in outcome.' },
    ],
    finalTitle: 'Move from the public explanation to your organisation',
    finalText: 'Registration is the primary path into the platform. The working context then follows the organisation and role; public examples on this page do not grant permissions.',
    claimBoundary: 'The platform does not claim external status, confirmation or connection availability without evidence.',
    register: 'Register',
    registerShort: 'Register',
    login: 'Sign in',
    contact: 'Ask a question',
    privacy: 'Data processing',
    home: 'Home',
    brandHome: 'Transparent Price — home',
    navHow: 'How it works',
    navAbout: 'About',
    navContact: 'Contact',
  },
  zh: {
    metadataTitle: '交易中的信任 — 透明价格',
    metadataDescription: '了解“透明价格”如何在同一笔交易中组织权限、操作依据、外部系统与 Gekta 的边界。',
    eyebrow: '同一笔交易中的信任',
    title: '清楚知道谁可以操作、依据是什么，以及平台边界在哪里',
    lead: '信任不是单独的评分或营销标记，而是来自交易架构：角色决定可执行的操作，关键步骤始终与其依据关联，外部系统和 Gekta 也不会继承其他参与方的权限。',
    principle: '核心原则',
    principleText: '界面负责解释交易，而关键操作的权限仍属于通过机构范围和角色拥有该权限的参与方。',
    facts: ['角色 → 可执行操作', '依据 → 操作 → 历史', 'Gekta → 解释，不代替决定'],
    boundariesTitle: '四个边界让同一笔交易保持清晰',
    boundariesLead: '用户看到的不是抽象的安全承诺，而是权限、数据、外部系统和智能辅助分别属于哪里。',
    boundaries: [
      {
        title: '权限属于参与方，而不是界面',
        text: '机构范围和角色决定参与方的工作上下文。',
        points: [
          '在公开页面选择角色不会授予权限。',
          'URL 或浏览器状态不是权限来源。',
          '关键决定由获得授权的参与方确认。',
        ],
      },
      {
        title: '一笔交易保留一段关联历史',
        text: '条件、履约、文件、质量、决定和资金后果都保留在同一上下文中。',
        points: [
          '变更始终与操作人、依据和结果关联。',
          '文件版本与交易事件保持关联。',
          '公开页面不会公开私人工作空间或其他机构的数据。',
        ],
      },
      {
        title: '外部系统保持独立边界',
        text: '银行、登记系统、电子文件、财务和实验室系统保留各自的业务责任。',
        points: [
          '资金流动由银行负责，而不是由平台界面负责。',
          '外部事实的来源始终与其上下文一起保留。',
          '适配层只传递必要信息，不扩大参与方权限。',
        ],
      },
      {
        title: 'Gekta 负责解释，但不会成为交易参与方',
        text: '智能层使用事实、文件以及具体交易步骤的上下文。',
        points: [
          'Gekta 对照条件、事件、文件和来源。',
          'Gekta 解释风险并展示允许的操作选项。',
          'Gekta 没有独立权限自行修改交易、转移资金或作出关键决定。',
        ],
      },
    ],
    pathTitle: '普通参与方实际会看到什么',
    pathLead: '用户不需要阅读技术文档才能理解关键步骤。工作空间直接展示从约定条件到履约事实，再到下一步操作的清晰链条。',
    path: [
      { label: '01', title: '条件', text: '双方对商品、交付、质量、文件和结算达成了什么约定。' },
      { label: '02', title: '事实', text: '履约过程中发生了什么，以及哪些材料属于这笔交易。' },
      { label: '03', title: '操作', text: '当前角色下一步可以做什么，以及结果变化基于什么依据。' },
    ],
    finalTitle: '从公开说明进入你的机构',
    finalText: '注册是进入平台的主要路径。之后工作上下文由机构和角色决定；本页公开示例不会授予权限。',
    claimBoundary: '没有证据时，平台不会宣称外部状态、确认结果或连接可用性。',
    register: '注册',
    registerShort: '注册',
    login: '登录',
    contact: '提出问题',
    privacy: '数据处理',
    home: '返回首页',
    brandHome: '透明价格 — 返回首页',
    navHow: '如何运行',
    navAbout: '关于平台',
    navContact: '联系',
  },
};

const CARD_ICONS = [KeyRound, FileCheck2, Network, Bot] as const;
const CARD_IDS = ['controls', 'history', 'external', 'ai'] as const;

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
      canonical: '/platform-v7/trust',
      languages: {
        ru: '/platform-v7/trust?lang=ru',
        en: '/platform-v7/trust?lang=en',
        zh: '/platform-v7/trust?lang=zh',
      },
    },
    robots: { index: true, follow: true },
  };
}

export default async function PlatformV7TrustPage() {
  const locale = localeOf(await getLocale());
  const copy = COPY[locale];
  const lang = `?lang=${encodeURIComponent(locale)}`;
  const nav = (
    <>
      <Link href={`/platform-v7/how-it-works${lang}`}>{copy.navHow}</Link>
      <Link href={`/platform-v7/about${lang}`}>{copy.navAbout}</Link>
      <Link href={`/platform-v7/contact${lang}`}>{copy.navContact}</Link>
      <Link href={`/platform-v7/login${lang}`} className='pc-trust-nav-login'>{copy.login}</Link>
    </>
  );

  return (
    <div className='pc-trust-page'>
      <PublicSiteHeader
        ariaLabel={copy.eyebrow}
        brandHomeLabel={copy.brandHome}
        navLabel={copy.eyebrow}
        menuLabel={copy.navHow}
        nav={nav}
        showMobileMenu
        localeControl={<PublicLocaleLink />}
        actions={(
          <>
            <Link href={`/platform-v7/login${lang}`} className='entry-login pc-trust-header-login' aria-label={copy.login}>{copy.login}</Link>
            <Link href={`/platform-v7/register${lang}`} className='pc-v6-header-cta pc-trust-header-register' aria-label={copy.register}>
              <span className='pc-trust-register-full'>{copy.register}</span>
              <span className='pc-trust-register-short' aria-hidden='true'>{copy.registerShort}</span>
            </Link>
          </>
        )}
      />
      <style>{TRUST_PAGE_CSS}</style>

      <main className='pc-trust-shell'>
        <section className='pc-trust-hero' aria-labelledby='pc-trust-title'>
          <div className='pc-trust-hero-copy'>
            <span className='pc-trust-eyebrow'>{copy.eyebrow}</span>
            <h1 id='pc-trust-title'>{copy.title}</h1>
            <p>{copy.lead}</p>
            <div className='pc-trust-actions'>
              <Link href={`/platform-v7/register${lang}`} className='pc-trust-primary'>{copy.register}</Link>
              <Link href={`/platform-v7/how-it-works${lang}`} className='pc-trust-secondary'>{copy.navHow}</Link>
            </div>
          </div>

          <aside className='pc-trust-principle' aria-label={copy.principle}>
            <ShieldCheck aria-hidden='true' />
            <div><span>{copy.principle}</span><strong>{copy.principleText}</strong></div>
            <ul>{copy.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
          </aside>
        </section>

        <section id='boundaries' className='pc-trust-section' aria-labelledby='pc-trust-boundaries-title'>
          <div className='pc-trust-section-head'>
            <span>01</span>
            <div><h2 id='pc-trust-boundaries-title'>{copy.boundariesTitle}</h2><p>{copy.boundariesLead}</p></div>
          </div>
          <div className='pc-trust-grid pc-trust-domains'>
            {copy.boundaries.map((card, index) => {
              const Icon = CARD_ICONS[index] ?? Building2;
              return (
                <article key={card.title} id={CARD_IDS[index]}>
                  <Icon aria-hidden='true' />
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>
                  <ul>{card.points.map((point) => <li key={point}><i aria-hidden='true'>✓</i><span>{point}</span></li>)}</ul>
                </article>
              );
            })}
          </div>
        </section>

        <section id='deal-trust-path' className='pc-trust-section pc-trust-path-section' aria-labelledby='pc-trust-path-title'>
          <div className='pc-trust-section-head'>
            <span>02</span>
            <div><h2 id='pc-trust-path-title'>{copy.pathTitle}</h2><p>{copy.pathLead}</p></div>
          </div>
          <ol className='pc-trust-path'>
            {copy.path.map((step) => (
              <li key={step.label}>
                <i>{step.label}</i>
                <div><strong>{step.title}</strong><p>{step.text}</p></div>
              </li>
            ))}
          </ol>
        </section>

        <section className='pc-trust-final' aria-labelledby='pc-trust-final-title'>
          <div><span>03</span><h2 id='pc-trust-final-title'>{copy.finalTitle}</h2><p>{copy.finalText}</p></div>
          <div className='pc-trust-actions'>
            <Link href={`/platform-v7/register${lang}`} className='pc-trust-primary'>{copy.register}</Link>
            <Link href={`/platform-v7/contact${lang}`} className='pc-trust-secondary pc-trust-contact-link'>{copy.contact}</Link>
          </div>
        </section>

        <p id='claims' className='pc-trust-claims'>{copy.claimBoundary}</p>

        <nav className='pc-trust-bottom-nav' aria-label={copy.eyebrow}>
          <Link className='pc-trust-back' href={`/platform-v7${lang}`}>{copy.home}</Link>
          <Link href={`/platform-v7/privacy${lang}`}>{copy.privacy}</Link>
        </nav>
      </main>
    </div>
  );
}

const TRUST_PAGE_CSS = `
.pc-trust-page{min-height:100dvh;background:#f7faf8;color:#102019;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.pc-trust-page .pc-site-brand{min-height:44px}.pc-trust-shell{width:min(1180px,calc(100% - 40px));margin:0 auto;padding:112px 0 64px}.pc-trust-hero{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(340px,.95fr);gap:56px;align-items:center;padding:50px 0 72px}.pc-trust-eyebrow{display:block;margin-bottom:12px;color:#087a3b;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.pc-trust-hero h1{max-width:14ch;margin:0;color:#102019;font-size:clamp(44px,5.2vw,66px);font-weight:760;line-height:.99;letter-spacing:-.05em;text-wrap:balance}.pc-trust-hero-copy>p{max-width:65ch;margin:22px 0 0;color:#526159;font-size:18px;line-height:1.58}.pc-trust-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}.pc-trust-primary,.pc-trust-secondary{box-sizing:border-box;min-height:48px;display:inline-flex;align-items:center;justify-content:center;padding:0 18px;border-radius:12px;font-size:14px;font-weight:760;text-decoration:none}.pc-trust-primary{border:1px solid #087a3b;background:#087a3b;color:#fff}.pc-trust-primary:hover{border-color:#07572e;background:#07572e}.pc-trust-secondary{border:1px solid #cbd9d1;background:#fff;color:#18372a}.pc-trust-secondary:hover{border-color:#96b5a4;background:#f2f7f4}.pc-trust-register-short{display:none}.pc-site-nav .pc-trust-nav-login{display:none}.pc-trust-principle{display:grid;grid-template-columns:48px minmax(0,1fr);gap:14px;padding:24px;border:1px solid #c9dbd1;border-radius:22px;background:#fff;box-shadow:0 24px 64px rgba(16,42,29,.08)}.pc-trust-principle>svg{width:24px;height:24px;padding:12px;border-radius:13px;background:#edf6f0;color:#087a3b}.pc-trust-principle>div{display:grid;gap:7px}.pc-trust-principle>div>span{color:#087a3b;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.pc-trust-principle>div>strong{color:#19382a;font-size:16px;line-height:1.45}.pc-trust-principle ul{grid-column:1/-1;display:grid;gap:8px;margin:8px 0 0;padding:0;list-style:none}.pc-trust-principle li{min-height:44px;display:flex;align-items:center;padding:0 13px;border-radius:11px;background:#f2f7f4;color:#375346;font-size:13px;font-weight:680;line-height:1.35}.pc-trust-section{scroll-margin-top:82px;padding:72px 0;border-top:1px solid #dfe8e3}.pc-trust-section-head{display:grid;grid-template-columns:44px minmax(0,1fr);gap:18px;align-items:start;margin-bottom:30px}.pc-trust-section-head>span,.pc-trust-final>div:first-child>span{width:40px;height:40px;display:grid;place-items:center;border-radius:12px;background:#10291e;color:#fff;font-size:11px;font-weight:800}.pc-trust-section h2,.pc-trust-final h2{margin:0;color:#152d22;font-size:clamp(30px,3.2vw,42px);font-weight:740;line-height:1.08;letter-spacing:-.035em}.pc-trust-section-head p{max-width:74ch;margin:12px 0 0;color:#58685f;font-size:15px;line-height:1.58}.pc-trust-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-left:62px}.pc-trust-grid article{min-width:0;padding:22px;border:1px solid #d5e1da;border-radius:17px;background:#fff}.pc-trust-grid article>svg{width:20px;height:20px;padding:10px;border-radius:11px;background:#edf6f0;color:#087a3b}.pc-trust-grid h3{margin:16px 0 0;color:#1a3528;font-size:18px;line-height:1.28;letter-spacing:-.015em}.pc-trust-grid article>p{margin:9px 0 0;color:#596a61;font-size:13px;line-height:1.55}.pc-trust-grid ul{display:grid;gap:9px;margin:16px 0 0;padding:0;list-style:none}.pc-trust-grid li{display:grid;grid-template-columns:24px minmax(0,1fr);gap:8px;align-items:start;color:#3f574b;font-size:13px;line-height:1.5}.pc-trust-grid li i{width:22px;height:22px;display:grid;place-items:center;border-radius:7px;background:#f0f6f2;color:#087a3b;font-style:normal;font-size:11px;font-weight:900}.pc-trust-path-section{padding-bottom:76px}.pc-trust-path{position:relative;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:0 0 0 62px;padding:0;list-style:none}.pc-trust-path::before{content:'';position:absolute;top:28px;left:10%;right:10%;height:1px;background:#c9d8d0}.pc-trust-path li{position:relative;z-index:1;min-width:0;padding:20px;border:1px solid #d5e1da;border-radius:17px;background:#fff}.pc-trust-path li>i{width:56px;height:56px;display:grid;place-items:center;border-radius:16px;background:#10291e;color:#fff;font-size:12px;font-style:normal;font-weight:800}.pc-trust-path li>div{margin-top:18px}.pc-trust-path strong{color:#173429;font-size:18px}.pc-trust-path p{margin:8px 0 0;color:#5a6a62;font-size:13px;line-height:1.55}.pc-trust-final{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:28px;align-items:end;padding:50px 46px;border-radius:24px;background:#10291e;color:#fff}.pc-trust-final>div:first-child{display:grid;grid-template-columns:44px minmax(0,1fr);gap:14px}.pc-trust-final h2{grid-column:2;color:#fff}.pc-trust-final p{grid-column:2;max-width:68ch;margin:0;color:#c4d3cb;font-size:14px;line-height:1.58}.pc-trust-final .pc-trust-actions{margin:0}.pc-trust-final .pc-trust-secondary{border-color:#5b7569;background:transparent;color:#fff}.pc-trust-claims{max-width:78ch;margin:18px 0 0;color:#627269;font-size:12px;line-height:1.55}.pc-trust-bottom-nav{display:flex;gap:8px;flex-wrap:wrap;padding-top:18px}.pc-trust-bottom-nav a{min-height:44px;display:inline-flex;align-items:center;padding:0 13px;border:1px solid #d5e1da;border-radius:999px;background:#fff;color:#334c40;font-size:12px;font-weight:700;text-decoration:none}.pc-trust-page a:focus-visible{outline:3px solid rgba(8,122,59,.24);outline-offset:2px}@media(max-width:900px){.pc-trust-hero{grid-template-columns:1fr;gap:30px}.pc-trust-hero h1{max-width:16ch}.pc-trust-grid,.pc-trust-path{margin-left:0}.pc-trust-final{grid-template-columns:1fr;align-items:start}}@media(max-width:600px){.pc-trust-shell{width:min(100% - 28px,1180px);padding-top:88px}.pc-trust-hero{padding:32px 0 50px}.pc-trust-hero h1{max-width:100%;font-size:clamp(34px,10.7vw,43px);line-height:1.03}.pc-trust-hero-copy>p{font-size:16px;line-height:1.52}.pc-trust-actions{display:grid;grid-template-columns:1fr}.pc-trust-primary,.pc-trust-secondary{width:100%}.pc-trust-principle{grid-template-columns:42px minmax(0,1fr);padding:18px;border-radius:18px}.pc-trust-principle>svg{width:20px;height:20px;padding:10px}.pc-trust-section{padding:52px 0}.pc-trust-section-head{grid-template-columns:36px minmax(0,1fr);gap:12px}.pc-trust-section-head>span,.pc-trust-final>div:first-child>span{width:34px;height:34px}.pc-trust-section h2,.pc-trust-final h2{font-size:30px}.pc-trust-grid{grid-template-columns:1fr}.pc-trust-grid article{padding:18px}.pc-trust-path{grid-template-columns:1fr}.pc-trust-path::before{display:none}.pc-trust-path li{display:grid;grid-template-columns:48px minmax(0,1fr);gap:12px;padding:16px}.pc-trust-path li>i{width:48px;height:48px;border-radius:14px}.pc-trust-path li>div{margin-top:0}.pc-trust-final{padding:32px 22px;border-radius:18px}.pc-trust-final>div:first-child{grid-template-columns:36px minmax(0,1fr);gap:10px}}@media(max-width:430px){.pc-trust-page .pc-site-header[data-public-site-header='canonical'] .pc-trust-header-login{display:none!important}.pc-trust-page .pc-site-header[data-public-site-header='canonical'] .pc-trust-header-register{min-width:44px!important;padding-inline:8px!important;font-size:12px!important}.pc-trust-register-full{display:none}.pc-trust-register-short{display:inline}.pc-site-mobile-nav .pc-trust-nav-login{display:flex}}@media(prefers-reduced-motion:reduce){.pc-trust-page *{scroll-behavior:auto!important;transition:none!important}}@media(forced-colors:active){.pc-trust-principle,.pc-trust-grid article,.pc-trust-path li,.pc-trust-final,.pc-trust-primary,.pc-trust-secondary,.pc-trust-bottom-nav a{border:1px solid CanvasText}.pc-trust-final{background:Canvas;color:CanvasText}.pc-trust-final h2,.pc-trust-final p{color:CanvasText}}
`;