import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import {
  ArrowLeft,
  Bot,
  Database,
  FileCheck2,
  KeyRound,
  ServerCog,
  ShieldCheck,
} from 'lucide-react';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import { PublicLocaleLink } from '@/components/platform-v7/PublicLocaleLink';

type Locale = 'ru' | 'en' | 'zh';

type Copy = Readonly<{
  metadataTitle: string;
  metadataDescription: string;
  back: string;
  nav: Readonly<{ controls: string; data: string; ai: string; evidence: string }>;
  eyebrow: string;
  title: string;
  lead: string;
  verifiedLabel: string;
  verifiedText: string;
  domains: ReadonlyArray<Readonly<{ id: string; title: string; text: string; points: readonly string[] }>>;
  claimsTitle: string;
  claimsLead: string;
  claims: readonly string[];
  contactTitle: string;
  contactText: string;
  contact: string;
  privacy: string;
}>;

const COPY: Record<Locale, Copy> = {
  ru: {
    metadataTitle: 'Trust Center — безопасность, данные и ИИ',
    metadataDescription: 'Публичные правила полномочий, доказательств, обработки данных, доступности и использования TAI в платформе Прозрачная Цена.',
    back: 'Вернуться на главную',
    nav: { controls: 'Контроль', data: 'Данные', ai: 'TAI', evidence: 'Заявления' },
    eyebrow: 'Enterprise Trust Center',
    title: 'Безопасность и доверие проверяются по правилам, а не по рекламным обещаниям',
    lead: 'Здесь собраны публичные границы платформы: кто принимает решения, как сохраняются основания, что видит ИИ и какие заявления не делаются без подтверждающих материалов.',
    verifiedLabel: 'Принцип публикации',
    verifiedText: 'Показываются только подтверждаемые свойства платформы. Сертификаты, внешняя доступность и подключение конкретного провайдера не заявляются без отдельного доказательства.',
    domains: [
      {
        id: 'controls',
        title: 'Роли, полномочия и критические действия',
        text: 'Доступные данные и действия определяются организационным контуром и ролью участника.',
        points: [
          'Критические решения подтверждает уполномоченный участник.',
          'URL, клиентское состояние и выбранная в браузере роль не являются источником полномочий.',
          'Действие сохраняется вместе с участником, основанием и результатом.',
        ],
      },
      {
        id: 'data',
        title: 'Данные, документы и доказательства',
        text: 'Сделка связывает события, версии документов, качество, решения и денежные последствия.',
        points: [
          'История изменений остаётся частью доказательственного контура Сделки.',
          'Организация видит ответственность и следующий шаг в пределах своей роли.',
          'Публичные страницы не открывают данные частного кабинета или чужих организаций.',
        ],
      },
      {
        id: 'ai',
        title: 'Граница использования TAI',
        text: 'TAI — интеллектуальный слой анализа, а не самостоятельный владелец решения.',
        points: [
          'ИИ сопоставляет условия, события, документы и источники.',
          'ИИ объясняет риск и показывает допустимые варианты действий.',
          'TAI не получает самостоятельного права менять Сделку, переводить деньги или подтверждать критическое действие.',
        ],
      },
      {
        id: 'availability',
        title: 'Доступность и внешние контуры',
        text: 'Внутреннее состояние платформы и внешние интеграции рассматриваются раздельно.',
        points: [
          'Работающий внутренний сервис не доказывает доступность банка, ФГИС, ЭДО или лабораторной системы.',
          'Внешнее подключение считается подтверждённым только после реального обмена и эксплуатационного контроля.',
          'Неподтверждённый статус не преобразуется в положительное состояние интерфейсом.',
        ],
      },
    ],
    claimsTitle: 'Что платформа не заявляет без доказательств',
    claimsLead: 'Эти ограничения защищают клиента от формальной зрелости и ложной уверенности.',
    claims: [
      'ISO, SOC 2 или иная сертификация — без опубликованного подтверждения.',
      'SLA и география доступности — без принятого договорного обязательства.',
      'Подключение конкретного банка, государственного сервиса, ЭДО или LIMS — без подтверждённого production-обмена.',
      'Клиент, партнёр, экономический эффект или процент улучшения — без разрешённого кейса и измеримых исходных данных.',
    ],
    contactTitle: 'Нужны материалы для проверки организации?',
    contactText: 'Запроси применимые политики, архитектурные границы и условия подключения. Ответ должен соответствовать конкретному контуру организации и договору.',
    contact: 'Связаться с платформой',
    privacy: 'Политика обработки данных',
  },
  en: {
    metadataTitle: 'Trust Center — security, data and AI',
    metadataDescription: 'Public authority, evidence, data-processing, availability and TAI boundaries for the Transparent Price platform.',
    back: 'Back to the homepage',
    nav: { controls: 'Controls', data: 'Data', ai: 'TAI', evidence: 'Claims' },
    eyebrow: 'Enterprise Trust Center',
    title: 'Security and trust are verified through operating rules, not marketing claims',
    lead: 'This page states the public platform boundaries: who makes decisions, how evidence is retained, what AI can see and which claims require separate proof.',
    verifiedLabel: 'Publication principle',
    verifiedText: 'Only verifiable platform properties are displayed. Certifications, external availability and named-provider connections are not claimed without separate evidence.',
    domains: [
      {
        id: 'controls',
        title: 'Roles, authority and critical actions',
        text: 'Available data and actions are determined by the organisation context and participant role.',
        points: [
          'Critical decisions are confirmed by an authorised participant.',
          'A URL, client state or browser-selected role is not a source of authority.',
          'An action remains connected to the participant, evidence and outcome.',
        ],
      },
      {
        id: 'data',
        title: 'Data, documents and evidence',
        text: 'The Deal connects events, document versions, quality, decisions and monetary consequences.',
        points: [
          'Change history remains part of the Deal evidence workflow.',
          'The organisation sees responsibility and the next step within its role.',
          'Public pages do not expose private-cabinet data or data from another organisation.',
        ],
      },
      {
        id: 'ai',
        title: 'TAI usage boundary',
        text: 'TAI is an intelligence layer for analysis, not an independent decision owner.',
        points: [
          'AI compares terms, events, documents and sources.',
          'AI explains risk and presents permitted action options.',
          'TAI has no independent authority to change a Deal, move money or confirm a critical action.',
        ],
      },
      {
        id: 'availability',
        title: 'Availability and external systems',
        text: 'Internal platform state and external integrations are evaluated separately.',
        points: [
          'A healthy internal service does not prove availability of a bank, registry, EDI or laboratory system.',
          'An external connection is confirmed only after real exchange and operational monitoring.',
          'An unconfirmed state is never converted into a positive UI status.',
        ],
      },
    ],
    claimsTitle: 'What the platform does not claim without evidence',
    claimsLead: 'These boundaries protect the customer from formal maturity and false confidence.',
    claims: [
      'ISO, SOC 2 or other certification without published proof.',
      'SLA or availability geography without an accepted contractual commitment.',
      'A live bank, government, EDI or LIMS connection without confirmed production exchange.',
      'A customer, partner, economic impact or improvement percentage without an authorised case and measurable baseline.',
    ],
    contactTitle: 'Need review materials for your organisation?',
    contactText: 'Request the applicable policies, architecture boundaries and connection terms. The response must match the organisation context and contract.',
    contact: 'Contact the platform',
    privacy: 'Data-processing policy',
  },
  zh: {
    metadataTitle: '信任中心 — 安全、数据与 AI',
    metadataDescription: '透明价格平台公开的权限、证据、数据处理、可用性与 TAI 边界。',
    back: '返回主页',
    nav: { controls: '控制', data: '数据', ai: 'TAI', evidence: '声明' },
    eyebrow: '企业信任中心',
    title: '安全与信任通过运行规则验证，而不是通过营销承诺',
    lead: '本页说明平台的公开边界：谁作出决定、如何保存依据、AI 可以看到什么，以及哪些声明需要单独证明。',
    verifiedLabel: '发布原则',
    verifiedText: '仅展示可验证的平台属性。没有单独证据时，不声明认证、外部可用性或特定服务商已连接。',
    domains: [
      {
        id: 'controls',
        title: '角色、权限与关键操作',
        text: '可用数据和操作由机构范围与参与方角色决定。',
        points: [
          '关键决定由获授权的参与方确认。',
          'URL、客户端状态或浏览器选择的角色不是权限来源。',
          '操作与参与方、依据和结果保持关联。',
        ],
      },
      {
        id: 'data',
        title: '数据、文件与证据',
        text: '交易连接事件、文件版本、质量、决定与资金后果。',
        points: [
          '变更历史始终属于交易证据流程。',
          '机构在其角色范围内查看责任与下一步。',
          '公共页面不会公开私人工作区或其他机构的数据。',
        ],
      },
      {
        id: 'ai',
        title: 'TAI 使用边界',
        text: 'TAI 是分析智能层，而不是独立决策主体。',
        points: [
          'AI 对照条件、事件、文件与来源。',
          'AI 解释风险并提供允许的操作选项。',
          'TAI 无权独立修改交易、转移资金或确认关键操作。',
        ],
      },
      {
        id: 'availability',
        title: '可用性与外部系统',
        text: '平台内部状态与外部集成分别评估。',
        points: [
          '内部服务正常不代表银行、登记系统、电子文件或实验室系统可用。',
          '外部连接仅在真实交换和运行监控后确认。',
          '未确认状态不会被界面转换为正面状态。',
        ],
      },
    ],
    claimsTitle: '没有证据时平台不会作出的声明',
    claimsLead: '这些边界保护客户，避免形式化成熟度和错误信心。',
    claims: [
      '没有公开证明时，不声明 ISO、SOC 2 或其他认证。',
      '没有已接受的合同承诺时，不声明 SLA 或可用地区。',
      '没有确认的生产交换时，不声明银行、政府、电子文件或 LIMS 已上线连接。',
      '没有授权案例和可衡量基准时，不声明客户、合作伙伴、经济效果或改善比例。',
    ],
    contactTitle: '你的机构需要审查材料吗？',
    contactText: '可以申请适用政策、架构边界与接入条件，回复必须与具体机构范围和合同一致。',
    contact: '联系平台',
    privacy: '数据处理政策',
  },
};

const DOMAIN_ICONS = [KeyRound, Database, Bot, ServerCog] as const;

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
      canonical: '/trust',
      languages: { ru: '/trust?lang=ru', en: '/trust?lang=en', zh: '/trust?lang=zh' },
    },
    robots: { index: true, follow: true },
  };
}

export default async function TrustCenterPage() {
  const locale = localeOf(await getLocale());
  const copy = COPY[locale];
  const nav = (
    <>
      <a href='#controls'>{copy.nav.controls}</a>
      <a href='#data'>{copy.nav.data}</a>
      <a href='#ai'>{copy.nav.ai}</a>
      <a href='#claims'>{copy.nav.evidence}</a>
    </>
  );

  return (
    <div className='pc-trust-page'>
      <style>{STYLES}</style>
      <PublicSiteHeader
        ariaLabel={copy.eyebrow}
        brandHomeLabel={copy.back}
        navLabel={copy.eyebrow}
        menuLabel={copy.eyebrow}
        nav={nav}
        showMobileMenu
        localeControl={<PublicLocaleLink />}
        actions={<a className='pc-trust-back' href='/platform-v7'><ArrowLeft aria-hidden='true' size={17} />{copy.back}</a>}
      />

      <main>
        <section className='pc-trust-hero' aria-labelledby='pc-trust-title'>
          <span>{copy.eyebrow}</span>
          <h1 id='pc-trust-title'>{copy.title}</h1>
          <p>{copy.lead}</p>
          <div className='pc-trust-principle'>
            <ShieldCheck aria-hidden='true' />
            <div><strong>{copy.verifiedLabel}</strong><p>{copy.verifiedText}</p></div>
          </div>
        </section>

        <section className='pc-trust-domains' aria-label={copy.eyebrow}>
          {copy.domains.map((domain, index) => {
            const Icon = DOMAIN_ICONS[index] ?? ShieldCheck;
            return (
              <article key={domain.id} id={domain.id}>
                <div className='pc-trust-domain-head'><Icon aria-hidden='true' /><h2>{domain.title}</h2></div>
                <p>{domain.text}</p>
                <ul>{domain.points.map((point) => <li key={point}><FileCheck2 aria-hidden='true' />{point}</li>)}</ul>
              </article>
            );
          })}
        </section>

        <section id='claims' className='pc-trust-claims' aria-labelledby='pc-trust-claims-title'>
          <span>{copy.eyebrow}</span>
          <h2 id='pc-trust-claims-title'>{copy.claimsTitle}</h2>
          <p>{copy.claimsLead}</p>
          <ul>{copy.claims.map((claim) => <li key={claim}>{claim}</li>)}</ul>
        </section>

        <section className='pc-trust-contact'>
          <div><h2>{copy.contactTitle}</h2><p>{copy.contactText}</p></div>
          <div>
            <a className='pc-trust-primary' href={`/platform-v7/contact?lang=${locale}`}>{copy.contact}</a>
            <a href={`/platform-v7/privacy?lang=${locale}`}>{copy.privacy}</a>
          </div>
        </section>
      </main>
    </div>
  );
}

const STYLES = `
.pc-trust-page{--green:#087a3b;--dark:#07572e;--ink:#102019;--muted:#526159;--line:#cfdcd4;min-height:100dvh;padding-top:64px;background:#f6f9f7;color:var(--ink);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.pc-trust-page main{width:min(1120px,calc(100% - 32px));margin:0 auto;padding:64px 0 80px}.pc-trust-back{min-height:44px;display:inline-flex;align-items:center;gap:7px;padding:0 13px;border:1px solid #c6d5cb;border-radius:11px;background:#fff;color:#173d2b;font-size:13px;font-weight:720;text-decoration:none}.pc-trust-hero{max-width:900px}.pc-trust-hero>span,.pc-trust-claims>span{color:var(--green);font-size:13px;font-weight:780;letter-spacing:.04em;text-transform:uppercase}.pc-trust-hero h1{max-width:17ch;margin:14px 0 0;font-size:clamp(42px,5.4vw,68px);line-height:1;letter-spacing:-.052em;text-wrap:balance}.pc-trust-hero>p{max-width:68ch;margin:22px 0 0;color:var(--muted);font-size:18px;line-height:1.55}.pc-trust-principle{display:grid;grid-template-columns:44px minmax(0,1fr);gap:13px;margin-top:28px;padding:18px;border:1px solid #bdd5c6;border-radius:15px;background:#eaf5ee}.pc-trust-principle>svg{width:22px;height:22px;padding:10px;border-radius:11px;background:#fff;color:var(--green)}.pc-trust-principle div{display:grid;gap:5px}.pc-trust-principle strong{font-size:15px}.pc-trust-principle p{margin:0;color:#365546;font-size:13px;line-height:1.5}.pc-trust-domains{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:42px}.pc-trust-domains article{scroll-margin-top:88px;padding:22px;border:1px solid var(--line);border-radius:17px;background:#fff;box-shadow:0 12px 28px rgba(16,42,29,.045)}.pc-trust-domain-head{display:grid;grid-template-columns:42px minmax(0,1fr);align-items:center;gap:12px}.pc-trust-domain-head svg{width:20px;height:20px;padding:10px;border-radius:11px;background:#edf6f0;color:var(--green)}.pc-trust-domain-head h2{margin:0;font-size:19px;line-height:1.25}.pc-trust-domains article>p{margin:14px 0 0;color:var(--muted);font-size:14px;line-height:1.5}.pc-trust-domains ul{display:grid;gap:9px;margin:17px 0 0;padding:0;list-style:none}.pc-trust-domains li{display:grid;grid-template-columns:18px minmax(0,1fr);gap:8px;color:#314b3e;font-size:13px;line-height:1.45}.pc-trust-domains li svg{margin-top:1px;color:var(--green)}.pc-trust-claims{margin-top:42px;padding:28px;border:1px solid #dbcdb6;border-radius:18px;background:#fffaf1}.pc-trust-claims h2{margin:10px 0 0;font-size:clamp(26px,3vw,38px);line-height:1.08;letter-spacing:-.035em}.pc-trust-claims>p{max-width:65ch;margin:12px 0 0;color:#6b5a3e;line-height:1.5}.pc-trust-claims ul{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:20px 0 0;padding:0;list-style:none}.pc-trust-claims li{padding:14px;border:1px solid #e5d8c3;border-radius:12px;background:#fff;color:#5d4a2e;font-size:13px;line-height:1.48}.pc-trust-contact{display:flex;align-items:center;justify-content:space-between;gap:24px;margin-top:28px;padding:24px;border:1px solid var(--line);border-radius:18px;background:#fff}.pc-trust-contact h2{margin:0;font-size:23px;letter-spacing:-.025em}.pc-trust-contact p{max-width:65ch;margin:8px 0 0;color:var(--muted);font-size:13px;line-height:1.5}.pc-trust-contact>div:last-child{display:flex;flex:0 0 auto;gap:8px}.pc-trust-contact a{min-height:44px;display:inline-flex;align-items:center;justify-content:center;padding:0 14px;border:1px solid #bfd0c6;border-radius:11px;color:#173d2b;font-size:13px;font-weight:720;text-decoration:none}.pc-trust-contact .pc-trust-primary{border-color:var(--green);background:var(--green);color:#fff}.pc-trust-page a:focus-visible{outline:3px solid rgba(8,122,59,.24);outline-offset:2px}@media(max-width:767px){.pc-trust-page{padding-top:48px}.pc-trust-page main{width:min(100% - 24px,1120px);padding:34px 0 54px}.pc-trust-back{width:44px;padding:0;font-size:0}.pc-trust-back svg{width:18px;height:18px}.pc-trust-hero h1{max-width:100%;font-size:clamp(34px,10vw,45px)}.pc-trust-hero>p{font-size:15px;line-height:1.48}.pc-trust-domains{grid-template-columns:1fr;margin-top:28px}.pc-trust-domains article{padding:17px}.pc-trust-claims{padding:20px}.pc-trust-claims ul{grid-template-columns:1fr}.pc-trust-contact{align-items:stretch;flex-direction:column}.pc-trust-contact>div:last-child{display:grid;grid-template-columns:1fr}.pc-trust-contact a{width:100%}}@media(forced-colors:active){.pc-trust-principle,.pc-trust-domains article,.pc-trust-claims,.pc-trust-claims li,.pc-trust-contact,.pc-trust-contact a{border:2px solid ButtonText;background:Canvas;color:ButtonText}}
`;
