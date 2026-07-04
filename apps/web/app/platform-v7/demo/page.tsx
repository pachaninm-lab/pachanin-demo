import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Banknote, Building2, CircleHelp, ClipboardCheck, FileCheck2, FlaskConical, Landmark, MessageCircleQuestion, Scale, ShieldCheck, Truck, Wheat, type LucideIcon } from 'lucide-react';
import { BrandMark } from '@/components/v7r/BrandMark';

export const metadata: Metadata = {
  title: 'Демо-сделка — контроль исполнения зерновой сделки',
  description: 'Демонстрационный сценарий Прозрачной Цены: рейс, приёмка, качество, документы, расчёт и доказательства после согласования цены.',
  alternates: { canonical: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/demo' },
};

type Stage = { title: string; owner: string; status: string; text: string; Icon: LucideIcon; state: 'done' | 'active' | 'pending' };
type RoleLayer = { role: string; access: string; responsibility: string; Icon: LucideIcon };

const deal = {
  id: 'DL-DEMO-001',
  crop: 'Пшеница 4 класс',
  volume: '240 т',
  amount: '2 964 000 ₽',
  route: 'Хозяйство → элеватор → покупатель',
  current: 'Ожидается подтверждение качества и комплекта документов',
};

const stages: Stage[] = [
  { title: 'Условия сделки', owner: 'Продавец · покупатель', status: 'Выполнено', text: 'Цена, объём, базис поставки и допустимые показатели качества зафиксированы до рейса.', Icon: Wheat, state: 'done' },
  { title: 'Рейс', owner: 'Логистика', status: 'Выполнено', text: 'Назначены маршрут, транспорт, водитель и контрольные точки исполнения.', Icon: Truck, state: 'done' },
  { title: 'Приёмка', owner: 'Элеватор', status: 'Выполнено', text: 'Фиксируются факт поставки, вес, расхождения и связь партии с документами.', Icon: Building2, state: 'done' },
  { title: 'Качество', owner: 'Лаборатория', status: 'На проверке', text: 'Показатели качества проверяются до формирования окончательного основания для расчёта.', Icon: FlaskConical, state: 'active' },
  { title: 'Документы', owner: 'Стороны сделки', status: 'Ожидает', text: 'СДИЗ, ЭДО, транспортные документы и акты должны соответствовать событиям сделки.', Icon: FileCheck2, state: 'pending' },
  { title: 'Расчёт', owner: 'Банк', status: 'Ожидает', text: 'Основание для оплаты формируется после подтверждения приёмки, качества и документов.', Icon: Landmark, state: 'pending' },
];

const roles: RoleLayer[] = [
  { role: 'Продавец', access: 'статус партии, документы, приёмка и основание для оплаты', responsibility: 'закрывает документы и устраняет расхождения', Icon: Wheat },
  { role: 'Покупатель', access: 'факт поставки, качество, комплект документов и финансовые условия', responsibility: 'подтверждает исполнение или инициирует разбор расхождений', Icon: ClipboardCheck },
  { role: 'Элеватор', access: 'приёмка, вес, статус партии и связанные документы', responsibility: 'фиксирует фактические данные по партии', Icon: Building2 },
  { role: 'Лаборатория', access: 'пробы, показатели качества и протокол исследования', responsibility: 'подтверждает показатели качества', Icon: FlaskConical },
  { role: 'Банк', access: 'подтверждённые основания для расчёта', responsibility: 'проверяет наличие условий для оплаты', Icon: Landmark },
  { role: 'Арбитр', access: 'доказательства, документы, события и журнал действий', responsibility: 'рассматривает спор на основании зафиксированных данных', Icon: Scale },
];

const evidence = ['маршрут и контрольные точки рейса', 'данные приёмки и веса', 'протокол качества', 'СДИЗ, ЭДО, транспортные документы и акты', 'журнал действий участников'];

export default function PlatformV7DemoPage() {
  return (
    <main className='p7-demo-page' data-testid='platform-v7-demo-public-workspace'>
      <style>{css}</style>

      <header className='p7-demo-header' aria-label='Навигация демонстрационной страницы'>
        <Link href='/platform-v7' className='p7-demo-brand' aria-label='Прозрачная Цена — на главную'>
          <BrandMark size={44} />
          <span className='p7-demo-brand-text'><strong>Прозрачная Цена</strong><small>Контур исполнения сделки</small></span>
        </Link>
        <nav className='p7-demo-header-actions' aria-label='Действия демонстрационной страницы'>
          <Link href='/platform-v7' className='p7-demo-icon-button' aria-label='Назад на главную'><ArrowLeft size={22} /></Link>
          <Link href='/platform-v7/contact' className='p7-demo-icon-button question' aria-label='Задать вопрос'><CircleHelp size={22} /></Link>
        </nav>
      </header>

      <section className='p7-demo-hero' aria-labelledby='demo-title'>
        <div className='p7-demo-copy'>
          <span className='p7-kicker'>Демо · без регистрации · без доступа в ЛК</span>
          <h1 id='demo-title'>Как платформа контролирует исполнение зерновой сделки</h1>
          <p>На условном примере показан путь сделки после согласования цены: рейс, приёмка, качество, документы, расчёт и доказательная база. Рабочие кабинеты и реальные данные не открываются.</p>
          <div className='p7-demo-actions'><a href='#case' className='p7-primary'>Перейти к примеру<ArrowRight size={18} /></a><Link href='/platform-v7/contact' className='p7-secondary'><MessageCircleQuestion size={18} />Задать вопрос</Link></div>
        </div>
        <aside className='p7-demo-status' aria-label='Текущий статус демонстрационной сделки'>
          <span>Демо · синтетические данные</span>
          <strong>{deal.current}</strong>
          <p>Расчёт не выполняется до подтверждения оснований. Это демонстрационный сценарий на условных данных.</p>
        </aside>
      </section>

      <section id='case' className='p7-case-grid' aria-label='Параметры демонстрационной сделки'>
        <article className='p7-case-card main'><span>Сделка</span><strong>{deal.id}</strong><p>{deal.crop} · {deal.volume}</p></article>
        <article className='p7-case-card'><span>Сумма</span><strong>{deal.amount}</strong><p>Действия с деньгами недоступны в демо.</p></article>
        <article className='p7-case-card'><span>Маршрут</span><strong>{deal.route}</strong><p>Контроль ведётся по событиям исполнения.</p></article>
      </section>

      <section className='p7-section' aria-labelledby='stages-title'>
        <SectionHead n='01' title='Карта исполнения сделки' text='Каждый этап показывает статус, ответственного участника и основание перехода к следующему действию.' id='stages-title' />
        <div className='p7-stage-grid'>{stages.map((stage, index) => <StageCard key={stage.title} stage={stage} index={index} />)}</div>
      </section>

      <section className='p7-money-section' aria-labelledby='money-title'>
        <div><span className='p7-kicker'>Основание для расчёта</span><h2 id='money-title'>Оплата зависит от подтверждённых событий</h2><p>Платформа показывает, какие условия уже закрыты и какие документы или данные требуются до расчёта. В демонстрационном режиме финансовые действия заблокированы.</p></div>
        <div className='p7-money-card'><Banknote size={28} /><strong>{deal.amount}</strong><p>Ожидается подтверждение качества и комплекта документов.</p><button disabled>Выпуск денег недоступен в демо</button></div>
      </section>

      <section className='p7-section' aria-labelledby='roles-title'>
        <SectionHead n='02' title='Ролевые слои сделки' text='Участник получает только тот объём информации, который относится к его зоне ответственности.' id='roles-title' />
        <div className='p7-role-grid'>{roles.map((role) => <RoleCard key={role.role} role={role} />)}</div>
      </section>

      <section className='p7-proof-section' aria-labelledby='proof-title'>
        <div><span className='p7-kicker'>Доказательная база</span><h2 id='proof-title'>Спор разбирается по следу сделки</h2><p>Если возникают расхождения, участники видят не переписку вразнобой, а связанный пакет фактов.</p></div>
        <ul>{evidence.map((item) => <li key={item}><ShieldCheck size={18} />{item}</li>)}</ul>
      </section>

      <p style={{ margin: '16px 0 0', textAlign: 'center', color: '#66736e', fontSize: 13, fontWeight: 700 }}>Демо не создаёт сессию, не меняет роль и не открывает реальные кабинеты.</p>
      <footer className='p7-demo-footer'><Link href='/platform-v7'>На главную</Link><Link href='/platform-v7/contact'>Задать вопрос</Link></footer>
    </main>
  );
}

function SectionHead({ n, title, text, id }: { n: string; title: string; text: string; id: string }) { return <div className='p7-section-head'><span>{n}</span><h2 id={id}>{title}</h2><p>{text}</p></div>; }
function StageCard({ stage, index }: { stage: Stage; index: number }) { const Icon = stage.Icon; return <article className={`p7-stage-card ${stage.state}`}><span className='p7-stage-num'>{String(index + 1).padStart(2, '0')}</span><Icon size={24} /><strong>{stage.title}</strong><em>{stage.owner}</em><p>{stage.text}</p><small>{stage.status}</small></article>; }
function RoleCard({ role }: { role: RoleLayer }) { const Icon = role.Icon; return <article className='p7-role-layer'><Icon size={24} /><strong>{role.role}</strong><p>{role.access}</p><small>{role.responsibility}</small></article>; }

const css = `
.pc-shell-root-v4:has(.p7-demo-page){--pc-header-offset:0px!important;background:#f6faf4!important}.pc-shell-root-v4:has(.p7-demo-page) .pc-v4-header,.pc-shell-root-v4:has(.p7-demo-page) .pc-v4-bottomnav,.pc-shell-root-v4:has(.p7-demo-page) .pc-v4-drawer,.pc-shell-root-v4:has(.p7-demo-page) .pc-v4-pilot-note,.pc-shell-root-v4:has(.p7-demo-page) .pc-v7-role-dock,.pc-shell-root-v4:has(.p7-demo-page) .pc-v7-assistant-widget,.pc-shell-root-v4:has(.p7-demo-page) .p7-mobile-action-rail,.pc-shell-root-v4:has(.p7-demo-page) .p7-mobile-tool-panel{display:none!important}.pc-shell-root-v4:has(.p7-demo-page) .pc-v4-main{max-width:none!important;margin:0!important;padding:0!important;background:#f6faf4!important;min-height:100svh!important}.p7-demo-page{min-height:100svh;padding:10px clamp(14px,4vw,56px) 42px;color:#071611;background:linear-gradient(180deg,#fbfcf9 0%,#f3f8f1 58%,#fff 100%);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.p7-demo-page *{box-sizing:border-box}.p7-demo-page a{color:inherit;text-decoration:none}.p7-demo-header{position:sticky!important;top:8px;z-index:40;height:64px!important;min-height:64px!important;max-height:64px!important;display:block!important;padding:8px 106px 8px 12px!important;border:1px solid rgba(7,22,17,.08);border-radius:22px;background:rgba(255,255,255,.98);box-shadow:0 10px 24px rgba(7,22,17,.075);backdrop-filter:blur(18px);overflow:hidden}.p7-demo-brand{height:48px;min-width:0;max-width:100%;display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;align-items:center!important;gap:10px;overflow:hidden}.p7-demo-brand>span[aria-hidden]{width:44px!important;height:44px!important;min-width:44px!important;flex:0 0 44px!important}.p7-demo-brand-text{display:block;min-width:0;overflow:hidden}.p7-demo-brand-text strong{display:block;font-size:18px;line-height:1.05;font-weight:950;letter-spacing:-.035em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.p7-demo-brand-text small{display:block;margin-top:3px;color:#66736e;font-size:11px;line-height:1.05;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.p7-demo-header-actions{position:absolute!important;right:10px!important;top:50%!important;transform:translateY(-50%)!important;z-index:5!important;height:44px!important;display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;align-items:center!important;justify-content:flex-end!important;gap:7px!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important}.p7-demo-icon-button{width:42px!important;height:42px!important;min-width:42px!important;max-width:42px!important;flex:0 0 42px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;border-radius:15px;border:1px solid rgba(7,22,17,.10);background:rgba(255,255,255,.94);box-shadow:0 7px 18px rgba(7,22,17,.075);color:#071611}.p7-demo-icon-button.question{color:#087a3b;background:rgba(0,122,47,.09);border-color:rgba(0,122,47,.18)}.p7-demo-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,.55fr);gap:18px;padding:18px 0}.p7-demo-copy,.p7-demo-status,.p7-case-card,.p7-section,.p7-money-section,.p7-proof-section{border:1px solid rgba(7,22,17,.075);border-radius:30px;background:rgba(255,255,255,.86);box-shadow:0 18px 46px rgba(7,22,17,.065)}.p7-demo-copy{padding:clamp(24px,4vw,44px)}.p7-kicker{display:inline-flex;width:fit-content;margin-bottom:14px;padding:8px 12px;border-radius:999px;background:rgba(0,122,47,.08);color:#087a3b;font-size:11px;font-weight:950;letter-spacing:.055em;text-transform:uppercase}.p7-demo-copy h1{margin:0;max-width:850px;font-size:clamp(36px,4.8vw,68px);line-height:1;letter-spacing:-.055em}.p7-demo-copy p,.p7-demo-status p,.p7-section-head p,.p7-money-section p,.p7-proof-section p{margin:16px 0 0;color:#536058;font-size:16px;line-height:1.48;font-weight:650}.p7-demo-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}.p7-primary,.p7-secondary{min-height:52px;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 18px;border-radius:17px;font-size:14px;font-weight:950}.p7-primary{color:#fff!important;background:#087a3b;box-shadow:0 18px 34px rgba(0,122,47,.18)}.p7-secondary{color:#087a3b!important;background:#fff;border:1px solid rgba(0,122,47,.22)}.p7-demo-status{padding:24px;align-self:stretch;display:grid;align-content:center}.p7-demo-status span,.p7-case-card span{color:#087a3b;font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.07em}.p7-demo-status strong{margin-top:12px;font-size:30px;line-height:1.08;letter-spacing:-.045em}.p7-case-grid{display:grid;grid-template-columns:1.1fr .8fr 1.1fr;gap:12px;margin:0 0 18px}.p7-case-card{padding:20px}.p7-case-card.main{background:#071611;color:#fff}.p7-case-card.main span{color:#a9d9bd}.p7-case-card strong{display:block;margin-top:10px;font-size:28px;line-height:1.05;letter-spacing:-.045em}.p7-case-card p{margin:10px 0 0;color:#66736e;font-size:14px;font-weight:700}.p7-case-card.main p{color:#dbe8df}.p7-section,.p7-money-section,.p7-proof-section{padding:clamp(20px,3vw,30px);margin-top:18px}.p7-section-head{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin-bottom:18px}.p7-section-head>span{display:grid;place-items:center;width:54px;height:54px;border-radius:18px;color:#087a3b;background:rgba(0,122,47,.08);font-size:19px;font-weight:950;grid-row:span 2}.p7-section-head h2,.p7-money-section h2,.p7-proof-section h2{margin:0;font-size:clamp(26px,3.1vw,42px);line-height:1.05;letter-spacing:-.045em}.p7-section-head p{margin:0}.p7-stage-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.p7-stage-card{min-height:190px;padding:16px;border-radius:22px;border:1px solid rgba(7,22,17,.08);background:#fff;display:grid;align-content:start;gap:8px}.p7-stage-card svg{color:#087a3b}.p7-stage-num{color:#087a3b;font-size:12px;font-weight:950}.p7-stage-card strong{font-size:17px;font-weight:950}.p7-stage-card em{color:#087a3b;font-size:11px;font-style:normal;font-weight:950;text-transform:uppercase;letter-spacing:.055em}.p7-stage-card p,.p7-role-layer p{margin:0;color:#65716b;font-size:13px;line-height:1.4;font-weight:650}.p7-stage-card small{margin-top:auto;color:#6b746f;font-size:12px;font-weight:850}.p7-stage-card.active{border-color:rgba(0,122,47,.28);box-shadow:0 18px 32px rgba(0,122,47,.12)}.p7-money-section,.p7-proof-section{display:grid;grid-template-columns:minmax(0,1fr) minmax(310px,.68fr);gap:18px;align-items:start}.p7-money-card{padding:20px;border-radius:24px;background:#071611;color:#fff;display:grid;gap:12px}.p7-money-card svg{color:#a9d9bd}.p7-money-card strong{font-size:clamp(34px,4vw,48px);letter-spacing:-.055em}.p7-money-card p{margin:0;color:#dbe8df;font-size:13px}.p7-money-card button{min-height:46px;border:1px solid rgba(255,255,255,.18);border-radius:15px;background:rgba(255,255,255,.08);color:rgba(255,255,255,.72);font-weight:950}.p7-role-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.p7-role-layer{padding:17px;border-radius:22px;border:1px solid rgba(7,22,17,.075);background:#fff;display:grid;gap:8px}.p7-role-layer svg{color:#087a3b}.p7-role-layer strong{font-size:15px;font-weight:950;color:#087a3b;text-transform:uppercase;letter-spacing:.055em}.p7-role-layer small{color:#071611;font-size:12px;line-height:1.35;font-weight:850}.p7-proof-section ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr;gap:8px}.p7-proof-section li{min-height:46px;display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:16px;border:1px solid rgba(7,22,17,.075);background:#fff;font-weight:850}.p7-proof-section li svg{color:#087a3b;flex:0 0 auto}.p7-demo-footer{display:flex;gap:10px;justify-content:center;margin-top:18px}.p7-demo-footer a{min-height:48px;display:inline-flex;align-items:center;justify-content:center;padding:0 18px;border-radius:16px;background:#fff;border:1px solid rgba(0,122,47,.18);font-weight:950;color:#087a3b}.p7-demo-footer a:last-child{background:#087a3b;color:#fff!important}@media(max-width:1180px){.p7-stage-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.p7-case-grid{grid-template-columns:1fr 1fr}.p7-case-card.main{grid-column:1/-1}.p7-role-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:860px){.p7-demo-page{padding:8px 12px 34px}.p7-demo-header{height:64px!important;min-height:64px!important;max-height:64px!important;padding:8px 98px 8px 10px!important;border-radius:20px;top:6px}.p7-demo-brand-text strong{font-size:18px}.p7-demo-brand-text small{font-size:11px}.p7-demo-icon-button{width:40px!important;height:40px!important;min-width:40px!important;max-width:40px!important;flex-basis:40px!important;border-radius:14px}.p7-demo-hero,.p7-money-section,.p7-proof-section{grid-template-columns:1fr}.p7-role-grid,.p7-proof-section ul{grid-template-columns:1fr}.p7-stage-grid{grid-template-columns:1fr 1fr}}@media(max-width:520px){.p7-demo-page{padding-left:8px;padding-right:8px}.p7-demo-header{margin:0 0 8px;padding-right:94px!important}.p7-demo-brand{gap:8px}.p7-demo-brand>span[aria-hidden]{width:42px!important;height:42px!important;min-width:42px!important;flex-basis:42px!important}.p7-demo-brand-text small{display:none}.p7-demo-header-actions{right:8px!important;gap:6px!important}.p7-demo-copy h1{font-size:36px}.p7-stage-grid,.p7-case-grid{grid-template-columns:1fr}.p7-demo-copy,.p7-demo-status,.p7-section,.p7-money-section,.p7-proof-section{border-radius:26px;padding:20px;margin-left:0;margin-right:0}.p7-primary,.p7-secondary{width:100%}.p7-section-head{grid-template-columns:1fr}.p7-section-head>span{grid-row:auto;width:48px;height:48px}.p7-demo-footer{padding:0 12px}.p7-demo-footer a{flex:1}}@media(max-width:374px){.p7-demo-brand-text strong{font-size:16px}.p7-demo-brand>span[aria-hidden]{width:38px!important;height:38px!important;min-width:38px!important;flex-basis:38px!important}.p7-demo-icon-button{width:38px!important;height:38px!important;min-width:38px!important;max-width:38px!important;flex-basis:38px!important}.p7-demo-header{gap:6px!important;padding-left:8px!important;padding-right:90px!important}}
`;
