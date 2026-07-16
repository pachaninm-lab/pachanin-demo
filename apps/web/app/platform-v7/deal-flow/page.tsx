import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Banknote, Building2, ClipboardCheck, FileCheck2, FlaskConical, Landmark, MessageCircleQuestion, Scale, ShieldCheck, Truck, Wheat, type LucideIcon } from 'lucide-react';
import { BrandMark } from '@/components/v7r/BrandMark';

export const metadata: Metadata = {
  title: 'Контур сделки — Прозрачная Цена',
  description: 'Рабочая карта исполнения зерновой сделки: цена, рейс, приёмка, качество, документы, расчёт, спор и доказательства.',
  alternates: { canonical: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/deal-flow' },
};

type Stage = { title: string; owner: string; status: string; text: string; Icon: LucideIcon; state: 'done' | 'active' | 'pending' };
type RoleLayer = { role: string; access: string; responsibility: string; Icon: LucideIcon };

const deal = {
  id: 'DL-9102',
  crop: 'Пшеница 4 класс',
  volume: '240 т',
  amount: '2 964 000 ₽',
  route: 'Хозяйство → элеватор → покупатель',
  current: 'На контроле качество, документы и основание для расчёта',
};

const stages: Stage[] = [
  { title: 'Условия сделки', owner: 'Продавец · покупатель', status: 'Зафиксировано', text: 'Цена, объём, базис поставки и допустимые показатели качества фиксируются до рейса.', Icon: Wheat, state: 'done' },
  { title: 'Рейс', owner: 'Логистика', status: 'В работе', text: 'Маршрут, транспорт, водитель и контрольные точки исполнения находятся в едином контуре.', Icon: Truck, state: 'active' },
  { title: 'Приёмка', owner: 'Элеватор', status: 'Ожидает факт', text: 'Вес, факт поставки, расхождения и связь партии с документами фиксируются до расчёта.', Icon: Building2, state: 'pending' },
  { title: 'Качество', owner: 'Лаборатория', status: 'На проверке', text: 'Показатели качества учитываются до формирования окончательного основания для оплаты.', Icon: FlaskConical, state: 'pending' },
  { title: 'Документы', owner: 'Стороны сделки', status: 'На сверке', text: 'СДИЗ, ЭДО, транспортные документы и акты сверяются с событиями исполнения.', Icon: FileCheck2, state: 'pending' },
  { title: 'Расчёт', owner: 'Банк / финконтур', status: 'После оснований', text: 'Платформа показывает основание для расчёта, но не заявляет автоматический выпуск денег без банковского подтверждения.', Icon: Landmark, state: 'pending' },
];

const roles: RoleLayer[] = [
  { role: 'Продавец', access: 'партия, рейс, приёмка, документы и основание для оплаты', responsibility: 'закрывает документы и устраняет расхождения', Icon: Wheat },
  { role: 'Покупатель', access: 'факт поставки, качество, документы и финансовые условия', responsibility: 'подтверждает исполнение или инициирует разбор', Icon: ClipboardCheck },
  { role: 'Элеватор', access: 'приёмка, вес, статус партии и связанные документы', responsibility: 'фиксирует фактические данные по партии', Icon: Building2 },
  { role: 'Лаборатория', access: 'пробы, показатели качества и протокол исследования', responsibility: 'подтверждает показатели качества', Icon: FlaskConical },
  { role: 'Банк', access: 'подтверждённые основания для расчёта', responsibility: 'проверяет условия для финансового шага', Icon: Banknote },
  { role: 'Арбитр', access: 'доказательства, документы, события и журнал действий', responsibility: 'рассматривает спор на основании фактов', Icon: Scale },
];

const evidence = ['маршрут и контрольные точки рейса', 'данные приёмки и веса', 'протокол качества', 'СДИЗ, ЭДО, транспортные документы и акты', 'журнал действий участников'];

export default function PlatformV7DealFlowPage() {
  return (
    <main className='p7-deal-flow-page' data-testid='platform-v7-deal-flow-page'>
      <style>{css}</style>
      <header className='p7-flow-header' aria-label='Навигация страницы контура сделки'>
        <Link href='/platform-v7' className='p7-flow-brand' aria-label='Прозрачная Цена — на главную'>
          <BrandMark size={40} />
          <span><strong>Прозрачная Цена</strong><small>Рабочий контур исполнения сделки</small></span>
        </Link>
        <nav className='p7-flow-actions' aria-label='Действия страницы'>
          <Link href='/platform-v7' aria-label='Назад на главную'><ArrowLeft size={21} /></Link>
          <Link href='/platform-v7/contact' aria-label='Задать вопрос'><MessageCircleQuestion size={21} /></Link>
        </nav>
      </header>

      <section className='p7-flow-hero' aria-labelledby='flow-title'>
        <div className='p7-flow-hero-copy'>
          <span className='p7-flow-kicker'>Карта исполнения сделки</span>
          <h1 id='flow-title'>После цены начинается контроль исполнения</h1>
          <p>Платформа связывает рейс, приёмку, качество, документы, расчёт, спор и доказательства в одном рабочем процессе. Каждое действие имеет ответственного, статус и основание.</p>
          <div className='p7-flow-hero-actions'><Link href='/platform-v7/register'>Подключить организацию<ArrowRight size={18} /></Link><Link href='/platform-v7/contact'>Обсудить подключение</Link></div>
        </div>
        <aside className='p7-flow-status' aria-label='Состояние сделки'>
          <span>Текущий статус</span>
          <strong>{deal.current}</strong>
          <p>{deal.id} · {deal.crop} · {deal.volume} · {deal.amount}</p>
          <small>{deal.route}</small>
        </aside>
      </section>

      <section className='p7-flow-section' aria-labelledby='stages-title'>
        <SectionHead n='01' title='Этапы исполнения' text='Каждый этап показывает статус, ответственного участника и основание перехода к следующему действию.' id='stages-title' />
        <div className='p7-stage-grid'>{stages.map((stage, index) => <StageCard key={stage.title} stage={stage} index={index} />)}</div>
      </section>

      <section className='p7-money-section' aria-labelledby='money-title'>
        <div><span className='p7-flow-kicker'>Основание для расчёта</span><h2 id='money-title'>Оплата привязана к подтверждённым событиям</h2><p>Платформа показывает, какие условия закрыты и какие документы или данные требуются до расчёта. Финансовое действие выполняется только при подтверждённых основаниях и банковских правилах.</p></div>
        <div className='p7-money-card'><Banknote size={28} /><strong>{deal.amount}</strong><p>Ожидается подтверждение качества и комплекта документов.</p><Link href='/platform-v7/bank'>Открыть банковский контур</Link></div>
      </section>

      <section className='p7-flow-section' aria-labelledby='roles-title'>
        <SectionHead n='02' title='Ролевые слои' text='Участник получает только тот объём информации и действий, который относится к его зоне ответственности.' id='roles-title' />
        <div className='p7-role-grid'>{roles.map((role) => <RoleCard key={role.role} role={role} />)}</div>
      </section>

      <section className='p7-proof-section' aria-labelledby='proof-title'>
        <div><span className='p7-flow-kicker'>Доказательная база</span><h2 id='proof-title'>Спор разбирается по следу сделки</h2><p>Если возникают расхождения, участники работают не с разрозненной перепиской, а со связанным пакетом фактов.</p></div>
        <ul>{evidence.map((item) => <li key={item}><ShieldCheck size={18} />{item}</li>)}</ul>
      </section>

      <footer className='p7-flow-footer'><Link href='/platform-v7'>На главную</Link><Link href='/platform-v7/contact'>Задать вопрос</Link></footer>
    </main>
  );
}

function SectionHead({ n, title, text, id }: { n: string; title: string; text: string; id: string }) { return <div className='p7-section-head'><span>{n}</span><h2 id={id}>{title}</h2><p>{text}</p></div>; }
function StageCard({ stage, index }: { stage: Stage; index: number }) { const Icon = stage.Icon; return <article className={`p7-stage-card ${stage.state}`}><span className='p7-stage-num'>{String(index + 1).padStart(2, '0')}</span><Icon size={24} /><strong>{stage.title}</strong><em>{stage.owner}</em><p>{stage.text}</p><small>{stage.status}</small></article>; }
function RoleCard({ role }: { role: RoleLayer }) { const Icon = role.Icon; return <article className='p7-role-layer'><Icon size={24} /><strong>{role.role}</strong><p>{role.access}</p><small>{role.responsibility}</small></article>; }

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
