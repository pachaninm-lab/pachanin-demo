import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { ArrowLeft, ArrowRight, Banknote, Building2, ClipboardCheck, FileCheck2, FlaskConical, Landmark, MessageCircleQuestion, Scale, ShieldCheck, Truck, Wheat, type LucideIcon } from 'lucide-react';
import { BrandMark } from '@/components/v7r/BrandMark';

type LocaleKey = 'ru' | 'en' | 'zh';
type StageState = 'done' | 'active' | 'pending';
type StageCopy = { title: string; owner: string; status: string; text: string };
type RoleCopy = { role: string; access: string; responsibility: string };

const STAGE_ICONS = [Wheat, Truck, Building2, FlaskConical, FileCheck2, Landmark] as const;
const STAGE_STATES: readonly StageState[] = ['done', 'active', 'pending', 'pending', 'pending', 'pending'];
const ROLE_ICONS = [Wheat, ClipboardCheck, Building2, FlaskConical, Banknote, Scale] as const;

const COPY = {
  ru: {
    metaTitle: 'Контур сделки — Прозрачная Цена',
    metaDescription: 'Рабочая карта исполнения сделки: цена, рейс, приёмка, качество, документы, расчёт, спор и доказательства.',
    brand: 'Прозрачная Цена', brandSub: 'Рабочий контур исполнения сделки', brandHome: 'Прозрачная Цена — на главную',
    pageNav: 'Навигация страницы контура сделки', pageActions: 'Действия страницы', back: 'Назад на главную', question: 'Задать вопрос',
    heroKicker: 'Карта исполнения сделки', heroTitle: 'После цены начинается контроль исполнения',
    heroText: 'Платформа связывает рейс, приёмку, качество, документы, расчёт, спор и доказательства в одном рабочем процессе. Каждое действие имеет ответственного, статус и основание.',
    register: 'Подключить организацию', contact: 'Обсудить подключение', statusLabel: 'Текущий статус',
    deal: { id: 'DL-9102', crop: 'Пшеница 4 класс', volume: '240 т', amount: '2 964 000 ₽', route: 'Хозяйство → элеватор → покупатель', current: 'На контроле качество, документы и основание для расчёта' },
    stagesTitle: 'Этапы исполнения', stagesText: 'Каждый этап показывает статус, ответственного участника и основание перехода к следующему действию.',
    stages: [
      { title: 'Условия сделки', owner: 'Продавец · покупатель', status: 'Зафиксировано', text: 'Цена, объём, базис поставки и допустимые показатели качества фиксируются до рейса.' },
      { title: 'Рейс', owner: 'Логистика', status: 'В работе', text: 'Маршрут, транспорт, водитель и контрольные точки исполнения находятся в едином контуре.' },
      { title: 'Приёмка', owner: 'Элеватор', status: 'Ожидает факт', text: 'Вес, факт поставки, расхождения и связь партии с документами фиксируются до расчёта.' },
      { title: 'Качество', owner: 'Лаборатория', status: 'На проверке', text: 'Показатели качества учитываются до формирования окончательного основания для оплаты.' },
      { title: 'Документы', owner: 'Стороны сделки', status: 'На сверке', text: 'СДИЗ, ЭДО, транспортные документы и акты сверяются с событиями исполнения.' },
      { title: 'Расчёт', owner: 'Банк / финконтур', status: 'После оснований', text: 'Платформа показывает основание для расчёта, но не заявляет автоматический выпуск денег без банковского подтверждения.' },
    ],
    moneyKicker: 'Основание для расчёта', moneyTitle: 'Оплата привязана к подтверждённым событиям',
    moneyText: 'Платформа показывает, какие условия закрыты и какие документы или данные требуются до расчёта. Финансовое действие выполняется только при подтверждённых основаниях и банковских правилах.',
    moneyStatus: 'Ожидается подтверждение качества и комплекта документов.', bankAction: 'Открыть банковский контур',
    rolesTitle: 'Ролевые слои', rolesText: 'Участник получает только тот объём информации и действий, который относится к его зоне ответственности.',
    roles: [
      { role: 'Продавец', access: 'партия, рейс, приёмка, документы и основание для оплаты', responsibility: 'закрывает документы и устраняет расхождения' },
      { role: 'Покупатель', access: 'факт поставки, качество, документы и финансовые условия', responsibility: 'подтверждает исполнение или инициирует разбор' },
      { role: 'Элеватор', access: 'приёмка, вес, статус партии и связанные документы', responsibility: 'фиксирует фактические данные по партии' },
      { role: 'Лаборатория', access: 'пробы, показатели качества и протокол исследования', responsibility: 'подтверждает показатели качества' },
      { role: 'Банк', access: 'подтверждённые основания для расчёта', responsibility: 'проверяет условия для финансового шага' },
      { role: 'Арбитр', access: 'доказательства, документы, события и журнал действий', responsibility: 'рассматривает спор на основании фактов' },
    ],
    proofKicker: 'Доказательная база', proofTitle: 'Спор разбирается по следу сделки', proofText: 'Если возникают расхождения, участники работают не с разрозненной перепиской, а со связанным пакетом фактов.',
    evidence: ['маршрут и контрольные точки рейса', 'данные приёмки и веса', 'протокол качества', 'СДИЗ, ЭДО, транспортные документы и акты', 'журнал действий участников'],
    home: 'На главную', footerQuestion: 'Задать вопрос',
  },
  en: {
    metaTitle: 'Deal execution — Transparent Price',
    metaDescription: 'Execution map for one Deal: price, transport, acceptance, quality, documents, settlement, dispute and evidence.',
    brand: 'Transparent Price', brandSub: 'Deal execution workspace', brandHome: 'Transparent Price — home',
    pageNav: 'Deal execution page navigation', pageActions: 'Page actions', back: 'Back to home', question: 'Ask a question',
    heroKicker: 'Deal execution map', heroTitle: 'Execution control starts after the price is agreed',
    heroText: 'The platform connects transport, acceptance, quality, documents, settlement, disputes and evidence in one working process. Every action has an owner, a state and a basis.',
    register: 'Connect an organisation', contact: 'Discuss connection', statusLabel: 'Current Deal state',
    deal: { id: 'DL-9102', crop: 'Grade 4 wheat', volume: '240 t', amount: '2 964 000 ₽', route: 'Farm → elevator → buyer', current: 'Quality, documents and the settlement basis are under control' },
    stagesTitle: 'Execution stages', stagesText: 'Each stage shows the responsible participant, the current state and the basis for moving to the next action.',
    stages: [
      { title: 'Deal terms', owner: 'Seller · buyer', status: 'Recorded', text: 'Price, volume, delivery basis and permitted quality values are recorded before transport starts.' },
      { title: 'Transport', owner: 'Logistics', status: 'In progress', text: 'Route, vehicle, driver and execution checkpoints stay in one Deal context.' },
      { title: 'Acceptance', owner: 'Elevator', status: 'Awaiting facts', text: 'Weight, delivery fact, discrepancies and the link between the lot and documents are recorded before settlement.' },
      { title: 'Quality', owner: 'Laboratory', status: 'Under review', text: 'Quality indicators are considered before the final payment basis is formed.' },
      { title: 'Documents', owner: 'Deal parties', status: 'Being reconciled', text: 'Regulatory, EDI, transport documents and acts are reconciled with execution events.' },
      { title: 'Settlement', owner: 'Bank / finance', status: 'After grounds are confirmed', text: 'The platform shows the settlement basis but does not claim that money is released automatically without bank confirmation.' },
    ],
    moneyKicker: 'Settlement basis', moneyTitle: 'Payment is tied to confirmed events',
    moneyText: 'The platform shows which conditions are complete and which documents or facts are still required before settlement. A financial action occurs only on confirmed grounds and under bank rules.',
    moneyStatus: 'Quality and the document set still require confirmation.', bankAction: 'Open bank workspace',
    rolesTitle: 'Role layers', rolesText: 'Each participant receives only the information and actions that belong to that participant’s responsibility.',
    roles: [
      { role: 'Seller', access: 'lot, transport, acceptance, documents and payment basis', responsibility: 'closes document gaps and resolves discrepancies' },
      { role: 'Buyer', access: 'delivery fact, quality, documents and financial terms', responsibility: 'confirms execution or starts a review' },
      { role: 'Elevator', access: 'acceptance, weight, lot state and related documents', responsibility: 'records factual lot data' },
      { role: 'Laboratory', access: 'samples, quality indicators and test protocol', responsibility: 'confirms quality indicators' },
      { role: 'Bank', access: 'confirmed settlement grounds', responsibility: 'checks conditions for the financial step' },
      { role: 'Arbitrator', access: 'evidence, documents, events and the action log', responsibility: 'reviews a dispute against recorded facts' },
    ],
    proofKicker: 'Evidence layer', proofTitle: 'Disputes are reviewed against the Deal trail', proofText: 'When discrepancies arise, participants work with a linked package of facts rather than fragmented correspondence.',
    evidence: ['route and transport checkpoints', 'acceptance and weight data', 'quality protocol', 'regulatory, EDI, transport documents and acts', 'participant action log'],
    home: 'Home', footerQuestion: 'Ask a question',
  },
  zh: {
    metaTitle: '交易执行 — 透明价格',
    metaDescription: '一笔交易的执行地图：价格、运输、验收、质量、文件、结算、争议与证据。',
    brand: '透明价格', brandSub: '交易执行工作区', brandHome: '透明价格 — 返回首页',
    pageNav: '交易执行页面导航', pageActions: '页面操作', back: '返回首页', question: '提问',
    heroKicker: '交易执行地图', heroTitle: '价格确定后，执行控制才真正开始',
    heroText: '平台把运输、验收、质量、文件、结算、争议和证据连接在一个工作流程中。每个动作都有责任方、状态和依据。',
    register: '接入机构', contact: '沟通接入', statusLabel: '当前交易状态',
    deal: { id: 'DL-9102', crop: '四级小麦', volume: '240 吨', amount: '2 964 000 ₽', route: '农场 → 粮库 → 买方', current: '正在控制质量、文件和结算依据' },
    stagesTitle: '执行阶段', stagesText: '每个阶段都显示责任参与方、当前状态以及进入下一步的依据。',
    stages: [
      { title: '交易条件', owner: '卖方 · 买方', status: '已记录', text: '价格、数量、交付基础和允许的质量指标在运输前记录。' },
      { title: '运输', owner: '物流', status: '执行中', text: '路线、车辆、司机和执行检查点统一保留在同一交易上下文中。' },
      { title: '验收', owner: '粮库', status: '等待事实', text: '重量、到货事实、差异以及批次与文件之间的关联在结算前记录。' },
      { title: '质量', owner: '实验室', status: '审核中', text: '质量指标在形成最终付款依据之前纳入判断。' },
      { title: '文件', owner: '交易双方', status: '核对中', text: '监管、电子单据、运输文件和验收文件与执行事件进行核对。' },
      { title: '结算', owner: '银行 / 金融', status: '依据确认后', text: '平台展示结算依据，但不会在没有银行确认的情况下声称资金会自动释放。' },
    ],
    moneyKicker: '结算依据', moneyTitle: '付款与已确认事件绑定',
    moneyText: '平台展示哪些条件已经完成，以及结算前仍需要哪些文件或事实。金融动作只有在依据确认并符合银行规则后才执行。',
    moneyStatus: '质量和文件组合仍需要确认。', bankAction: '打开银行工作区',
    rolesTitle: '角色层', rolesText: '每个参与方只获得属于其责任范围的信息和操作。',
    roles: [
      { role: '卖方', access: '批次、运输、验收、文件和付款依据', responsibility: '补齐文件并处理差异' },
      { role: '买方', access: '到货事实、质量、文件和金融条件', responsibility: '确认执行或发起复核' },
      { role: '粮库', access: '验收、重量、批次状态和相关文件', responsibility: '记录批次事实数据' },
      { role: '实验室', access: '样本、质量指标和检测报告', responsibility: '确认质量指标' },
      { role: '银行', access: '已确认的结算依据', responsibility: '检查金融步骤的条件' },
      { role: '仲裁方', access: '证据、文件、事件和操作日志', responsibility: '依据记录事实审查争议' },
    ],
    proofKicker: '证据层', proofTitle: '争议沿交易轨迹审查', proofText: '出现差异时，参与方使用相互关联的事实包，而不是零散的通信记录。',
    evidence: ['路线和运输检查点', '验收与重量数据', '质量报告', '监管、电子单据、运输文件和验收文件', '参与方操作日志'],
    home: '首页', footerQuestion: '提问',
  },
} as const;

function localeKey(locale: string): LocaleKey {
  return locale === 'en' || locale === 'zh' ? locale : 'ru';
}

export async function generateMetadata(): Promise<Metadata> {
  const t = COPY[localeKey(await getLocale())];
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: { canonical: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/deal-flow' },
  };
}

export default async function PlatformV7DealFlowPage() {
  const lang = localeKey(await getLocale());
  const t = COPY[lang];
  return (
    <main className='p7-deal-flow-page' data-testid='platform-v7-deal-flow-page' data-lang={lang} data-p7-no-translate='true'>
      <style>{css}</style>
      <header className='p7-flow-header' aria-label={t.pageNav}>
        <Link href='/platform-v7' className='p7-flow-brand' aria-label={t.brandHome}>
          <BrandMark size={40} />
          <span><strong>{t.brand}</strong><small>{t.brandSub}</small></span>
        </Link>
        <nav className='p7-flow-actions' aria-label={t.pageActions}>
          <Link href='/platform-v7' aria-label={t.back}><ArrowLeft size={21} /></Link>
          <Link href='/platform-v7/contact' aria-label={t.question}><MessageCircleQuestion size={21} /></Link>
        </nav>
      </header>

      <section className='p7-flow-hero' aria-labelledby='flow-title'>
        <div className='p7-flow-hero-copy'>
          <span className='p7-flow-kicker'>{t.heroKicker}</span>
          <h1 id='flow-title'>{t.heroTitle}</h1>
          <p>{t.heroText}</p>
          <div className='p7-flow-hero-actions'><Link href='/platform-v7/register'>{t.register}<ArrowRight size={18} /></Link><Link href='/platform-v7/contact'>{t.contact}</Link></div>
        </div>
        <aside className='p7-flow-status' aria-label={t.statusLabel}>
          <span>{t.statusLabel}</span>
          <strong>{t.deal.current}</strong>
          <p>{t.deal.id} · {t.deal.crop} · {t.deal.volume} · {t.deal.amount}</p>
          <small>{t.deal.route}</small>
        </aside>
      </section>

      <section className='p7-flow-section' aria-labelledby='stages-title'>
        <SectionHead n='01' title={t.stagesTitle} text={t.stagesText} id='stages-title' />
        <div className='p7-stage-grid'>{t.stages.map((stage, index) => <StageCard key={stage.title} stage={stage} index={index} Icon={STAGE_ICONS[index]!} state={STAGE_STATES[index]!} />)}</div>
      </section>

      <section className='p7-money-section' aria-labelledby='money-title'>
        <div><span className='p7-flow-kicker'>{t.moneyKicker}</span><h2 id='money-title'>{t.moneyTitle}</h2><p>{t.moneyText}</p></div>
        <div className='p7-money-card'><Banknote size={28} /><strong>{t.deal.amount}</strong><p>{t.moneyStatus}</p><Link href='/platform-v7/bank'>{t.bankAction}</Link></div>
      </section>

      <section className='p7-flow-section' aria-labelledby='roles-title'>
        <SectionHead n='02' title={t.rolesTitle} text={t.rolesText} id='roles-title' />
        <div className='p7-role-grid'>{t.roles.map((role, index) => <RoleCard key={role.role} role={role} Icon={ROLE_ICONS[index]!} />)}</div>
      </section>

      <section className='p7-proof-section' aria-labelledby='proof-title'>
        <div><span className='p7-flow-kicker'>{t.proofKicker}</span><h2 id='proof-title'>{t.proofTitle}</h2><p>{t.proofText}</p></div>
        <ul>{t.evidence.map((item) => <li key={item}><ShieldCheck size={18} />{item}</li>)}</ul>
      </section>

      <footer className='p7-flow-footer'><Link href='/platform-v7'>{t.home}</Link><Link href='/platform-v7/contact'>{t.footerQuestion}</Link></footer>
    </main>
  );
}

function SectionHead({ n, title, text, id }: { n: string; title: string; text: string; id: string }) { return <div className='p7-section-head'><span>{n}</span><h2 id={id}>{title}</h2><p>{text}</p></div>; }
function StageCard({ stage, index, Icon, state }: { stage: StageCopy; index: number; Icon: LucideIcon; state: StageState }) { return <article className={`p7-stage-card ${state}`}><span className='p7-stage-num'>{String(index + 1).padStart(2, '0')}</span><Icon size={24} /><strong>{stage.title}</strong><em>{stage.owner}</em><p>{stage.text}</p><small>{stage.status}</small></article>; }
function RoleCard({ role, Icon }: { role: RoleCopy; Icon: LucideIcon }) { return <article className='p7-role-layer'><Icon size={24} /><strong>{role.role}</strong><p>{role.access}</p><small>{role.responsibility}</small></article>; }

const css = `
.pc-shell-root-v4:has(.p7-deal-flow-page){--pc-header-offset:0px!important;background:#f6faf4!important}
.pc-shell-root-v4:has(.p7-deal-flow-page) .pc-v4-header,.pc-shell-root-v4:has(.p7-deal-flow-page) .pc-v4-bottomnav,.pc-shell-root-v4:has(.p7-deal-flow-page) .pc-v4-drawer,.pc-shell-root-v4:has(.p7-deal-flow-page) .pc-v4-pilot-note,.pc-shell-root-v4:has(.p7-deal-flow-page) .pc-v7-role-dock,.pc-shell-root-v4:has(.p7-deal-flow-page) .p7-mobile-action-rail,.pc-shell-root-v4:has(.p7-deal-flow-page) .p7-mobile-tool-panel{display:none!important}
.pc-shell-root-v4:has(.p7-deal-flow-page) .pc-v4-main{max-width:none!important;margin:0!important;padding:0!important;background:#f6faf4!important;min-height:100svh!important;overflow-x:hidden!important}
.p7-deal-flow-page{width:100%;max-width:100%;min-width:0;min-height:100svh;padding:10px clamp(14px,4vw,56px) calc(env(safe-area-inset-bottom) + 112px);color:#071611;background:linear-gradient(180deg,#fbfcf9 0%,#f3f8f1 58%,#fff 100%);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow-x:hidden}
.p7-deal-flow-page *{box-sizing:border-box;min-width:0;overflow-wrap:anywhere}.p7-deal-flow-page a{color:inherit;text-decoration:none;max-width:100%}
.p7-flow-header{position:sticky;top:max(8px,env(safe-area-inset-top));z-index:40;min-height:64px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;padding:8px 12px;border:1px solid rgba(7,22,17,.08);border-radius:22px;background:rgba(255,255,255,.98);box-shadow:0 10px 24px rgba(7,22,17,.075);backdrop-filter:blur(18px)}
.p7-flow-brand{display:flex;align-items:center;gap:10px;min-width:0}.p7-flow-brand svg,.p7-flow-brand img{flex:0 0 auto}.p7-flow-brand span{min-width:0}.p7-flow-brand strong{display:block;font-size:18px;line-height:1.05;font-weight:950;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.p7-flow-brand small{display:block;color:#61716b;font-size:12px;font-weight:760;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.p7-flow-actions{display:flex;gap:8px;flex:0 0 auto}.p7-flow-actions a{width:44px;height:44px;display:grid;place-items:center;border-radius:15px;border:1px solid rgba(7,22,17,.1);background:#fff}
.p7-flow-hero{width:100%;max-width:1220px;margin:0 auto;padding:clamp(28px,5vw,72px) 0 26px;display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,.46fr);gap:22px;align-items:stretch}.p7-flow-hero-copy{min-width:0}
.p7-flow-kicker{display:inline-flex;width:fit-content;max-width:100%;margin-bottom:14px;padding:8px 12px;border-radius:999px;background:rgba(0,122,47,.08);color:#087a3b;font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.08em;line-height:1.2}.p7-flow-hero h1{margin:0;max-width:820px;font-size:clamp(40px,5.8vw,76px);line-height:.98;letter-spacing:-.056em}.p7-flow-hero p,.p7-section-head p,.p7-money-section p,.p7-proof-section p{color:#43514b;font-size:16px;line-height:1.52;font-weight:620}.p7-flow-hero-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}.p7-flow-hero-actions a{min-height:52px;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 18px;border-radius:17px;border:1px solid rgba(7,22,17,.1);background:#fff;font-weight:950;text-align:center}.p7-flow-hero-actions a:first-child{background:#087a3b;color:#fff;border-color:#087a3b}
.p7-flow-status,.p7-stage-card,.p7-role-layer,.p7-money-card{border:1px solid rgba(7,22,17,.08);border-radius:28px;background:rgba(255,255,255,.92);box-shadow:0 18px 44px rgba(7,22,17,.07);overflow:hidden}.p7-flow-status{padding:22px;display:grid;gap:10px}.p7-flow-status span,.p7-case-card span{color:#087a3b;font-weight:950;font-size:12px;text-transform:uppercase}.p7-flow-status strong{font-size:clamp(24px,3.4vw,34px);line-height:1.08}.p7-flow-status p{margin:0}.p7-flow-status small{color:#61716b;font-weight:800}
.p7-flow-section,.p7-money-section,.p7-proof-section{width:100%;max-width:1220px;margin:20px auto 0}.p7-section-head{display:grid;gap:8px;margin-bottom:16px}.p7-section-head span{color:#087a3b;font-size:12px;font-weight:950}.p7-section-head h2,.p7-money-section h2,.p7-proof-section h2{margin:0;font-size:clamp(30px,4vw,52px);line-height:1.02;letter-spacing:-.05em}.p7-stage-grid,.p7-role-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.p7-stage-card,.p7-role-layer{padding:20px;display:grid;gap:10px}.p7-stage-card svg,.p7-role-layer svg{color:#071611}.p7-stage-num{font-size:12px;color:#087a3b;font-weight:950}.p7-stage-card strong,.p7-role-layer strong{font-size:20px;line-height:1.12;font-weight:950}.p7-stage-card em,.p7-role-layer small{font-style:normal;color:#61716b;font-weight:800}.p7-stage-card p,.p7-role-layer p{margin:0;color:#43514b;font-size:14px;line-height:1.45}.p7-stage-card small{width:fit-content;max-width:100%;padding:7px 10px;border-radius:999px;background:rgba(0,122,47,.08);color:#087a3b;font-weight:950;line-height:1.15}
.p7-money-section{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;align-items:stretch;padding:22px;border-radius:30px;background:linear-gradient(135deg,rgba(0,122,47,.08),rgba(255,255,255,.82));border:1px solid rgba(7,22,17,.08);overflow:hidden}.p7-money-card{padding:20px}.p7-money-card strong{display:block;margin-top:8px;font-size:34px;line-height:1.05}.p7-money-card a{display:inline-flex;margin-top:10px;min-height:42px;align-items:center;justify-content:center;border-radius:14px;background:#087a3b;color:#fff;padding:0 14px;font-weight:950;text-align:center}.p7-proof-section{display:grid;grid-template-columns:minmax(0,.85fr) minmax(300px,.55fr);gap:18px;align-items:start}.p7-proof-section ul{margin:0;padding:0;list-style:none;display:grid;gap:10px}.p7-proof-section li{display:flex;gap:9px;align-items:center;border:1px solid rgba(7,22,17,.08);border-radius:17px;background:#fff;padding:12px;font-weight:850}.p7-proof-section li svg{color:#087a3b;flex:0 0 auto}.p7-flow-footer{max-width:1220px;margin:28px auto 0;display:flex;gap:10px;justify-content:center}.p7-flow-footer a{min-height:44px;display:inline-flex;align-items:center;justify-content:center;border-radius:15px;border:1px solid rgba(7,22,17,.1);padding:0 14px;background:#fff;font-weight:950;text-align:center}
@media(max-width:900px){.p7-flow-hero,.p7-money-section,.p7-proof-section{grid-template-columns:1fr}.p7-stage-grid,.p7-role-grid{grid-template-columns:1fr 1fr}.p7-flow-hero{padding-top:28px}.p7-flow-status{max-width:100%}}
@media(max-width:560px){.p7-deal-flow-page{padding:10px 12px calc(env(safe-area-inset-bottom) + 138px)}.p7-flow-header{min-height:64px;border-radius:20px;padding:8px 9px}.p7-flow-brand small{display:none}.p7-flow-brand strong{font-size:16px}.p7-flow-brand svg{width:40px!important;height:40px!important}.p7-flow-actions{gap:6px}.p7-flow-actions a{width:40px;height:40px;border-radius:14px}.p7-flow-hero{gap:14px;padding:22px 0 22px}.p7-flow-kicker{margin-bottom:12px;padding:7px 10px;font-size:10.5px;letter-spacing:.08em}.p7-flow-hero h1{font-size:clamp(36px,9.8vw,42px);line-height:1.02;letter-spacing:-.055em}.p7-flow-hero p,.p7-section-head p,.p7-money-section p,.p7-proof-section p{font-size:15px;line-height:1.44}.p7-flow-hero-actions{display:grid;grid-template-columns:1fr;gap:9px;margin-top:18px;max-width:100%}.p7-flow-hero-actions a{width:100%;min-height:52px;border-radius:17px;padding:0 14px}.p7-flow-status,.p7-stage-card,.p7-role-layer,.p7-money-card{border-radius:24px}.p7-flow-status{padding:18px;gap:8px}.p7-flow-status strong{font-size:clamp(26px,7.2vw,34px);line-height:1.12}.p7-flow-status p,.p7-flow-status small{font-size:13.5px;line-height:1.35}.p7-flow-section,.p7-money-section,.p7-proof-section{margin-top:18px}.p7-section-head{margin-bottom:12px}.p7-section-head h2,.p7-money-section h2,.p7-proof-section h2{font-size:clamp(32px,8.4vw,38px);line-height:1.04}.p7-stage-grid,.p7-role-grid{grid-template-columns:1fr;gap:12px}.p7-stage-card,.p7-role-layer{padding:18px;gap:9px}.p7-stage-card strong,.p7-role-layer strong{font-size:19px}.p7-stage-card p,.p7-role-layer p{font-size:14px;line-height:1.42}.p7-stage-card small{padding:7px 10px}.p7-money-section{padding:18px;border-radius:24px;gap:12px}.p7-money-card{padding:18px}.p7-money-card strong{font-size:30px}.p7-money-card a{width:100%;min-height:48px}.p7-proof-section{gap:12px}.p7-proof-section li{align-items:flex-start;line-height:1.35}.p7-flow-footer{flex-direction:column;margin-top:22px}.p7-flow-footer a{justify-content:center}}
@media(max-width:380px){.p7-deal-flow-page{padding-left:10px;padding-right:10px}.p7-flow-header{gap:8px}.p7-flow-brand{gap:8px}.p7-flow-brand strong{font-size:15px}.p7-flow-actions a{width:38px;height:38px}.p7-flow-hero h1{font-size:34px}.p7-flow-status,.p7-stage-card,.p7-role-layer,.p7-money-section,.p7-money-card{border-radius:22px}.p7-stage-card,.p7-role-layer,.p7-flow-status,.p7-money-card{padding:16px}.p7-section-head h2,.p7-money-section h2,.p7-proof-section h2{font-size:30px}.p7-money-card strong{font-size:27px}}
`;
