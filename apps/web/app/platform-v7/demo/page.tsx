import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Banknote, Building2, ClipboardCheck, FileCheck2, FlaskConical, Landmark, LockKeyhole, MessageCircleQuestion, Scale, ShieldCheck, Truck, Wheat, type LucideIcon } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Демо-сделка — контроль исполнения зерновой сделки',
  description:
    'Демонстрационный сценарий Прозрачной Цены: рейс, приёмка, качество, документы, расчёт и доказательства после согласования цены. Без доступа к рабочим кабинетам и реальным данным.',
  alternates: {
    canonical: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/demo',
  },
  openGraph: {
    title: 'Демо-сделка — контроль исполнения зерновой сделки',
    description:
      'Посмотрите демонстрационный путь зерновой сделки после цены: логистика, приёмка, качество, документы, расчёт и доказательства.',
    url: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/demo',
    siteName: 'Прозрачная Цена',
    locale: 'ru_RU',
    type: 'website',
  },
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
        <Link href='/platform-v7' className='p7-demo-brand' aria-label='На главную страницу'><span><Wheat size={22} /></span><strong>Прозрачная Цена</strong></Link>
        <nav aria-label='Действия'><Link href='/platform-v7/contact'>Задать вопрос</Link><Link href='/platform-v7/register'>Подключить организацию</Link></nav>
      </header>

      <section className='p7-demo-hero' aria-labelledby='demo-title'>
        <div className='p7-demo-copy'>
          <span className='p7-kicker'>Демонстрационный режим · без регистрации</span>
          <h1 id='demo-title'>Как платформа контролирует исполнение зерновой сделки</h1>
          <p>На условном примере показан путь сделки после согласования цены: рейс, приёмка, качество, документы, расчёт и доказательная база. Рабочие кабинеты и реальные данные не открываются.</p>
          <div className='p7-demo-actions'><a href='#case' className='p7-primary'>Перейти к примеру<ArrowRight size={18} /></a><Link href='/platform-v7/contact' className='p7-secondary'><MessageCircleQuestion size={18} />Задать вопрос</Link></div>
        </div>
        <aside className='p7-demo-status' aria-label='Текущий статус демонстрационной сделки'>
          <span>Текущий статус</span>
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
        <div className='p7-money-card'><Banknote size={28} /><strong>{deal.amount}</strong><p>Ожидается подтверждение качества и комплекта документов.</p><button disabled>Финансовые действия недоступны в демо</button></div>
      </section>

      <section className='p7-section' aria-labelledby='roles-title'>
        <SectionHead n='02' title='Ролевые слои сделки' text='Участник получает только тот объём информации, который относится к его зоне ответственности.' id='roles-title' />
        <div className='p7-role-grid'>{roles.map((role) => <RoleCard key={role.role} role={role} />)}</div>
      </section>

      <section className='p7-proof-section' aria-labelledby='proof-title'>
        <div><span className='p7-kicker'>Доказательная база</span><h2 id='proof-title'>Спор разбирается по следу сделки</h2><p>Если возникают расхождения, участники видят не переписку вразнобой, а связанный пакет фактов.</p></div>
        <ul>{evidence.map((item) => <li key={item}><ShieldCheck size={18} />{item}</li>)}</ul>
      </section>

      <footer className='p7-demo-footer'><Link href='/platform-v7'>На главную</Link><Link href='/platform-v7/contact'>Задать вопрос</Link></footer>
    </main>
  );
}

function SectionHead({ n, title, text, id }: { n: string; title: string; text: string; id: string }) { return <div className='p7-section-head'><span>{n}</span><h2 id={id}>{title}</h2><p>{text}</p></div>; }
function StageCard({ stage, index }: { stage: Stage; index: number }) { const Icon = stage.Icon; return <article className={`p7-stage-card ${stage.state}`}><span className='p7-stage-num'>{String(index + 1).padStart(2, '0')}</span><Icon size={24} /><strong>{stage.title}</strong><em>{stage.owner}</em><p>{stage.text}</p><small>{stage.status}</small></article>; }
function RoleCard({ role }: { role: RoleLayer }) { const Icon = role.Icon; return <article className='p7-role-layer'><Icon size={24} /><strong>{role.role}</strong><p>{role.access}</p><small>{role.responsibility}</small></article>; }

const css = `
.pc-shell-root-v4:has(.p7-demo-page){--pc-header-offset:0px!important;background:#f6faf4!important}.pc-shell-root-v4:has(.p7-demo-page) .pc-v4-header,.pc-shell-root-v4:has(.p7-demo-page) .pc-v4-bottomnav,.pc-shell-root-v4:has(.p7-demo-page) .pc-v4-drawer,.pc-shell-root-v4:has(.p7-demo-page) .pc-v4-pilot-note,.pc-shell-root-v4:has(.p7-demo-page) .pc-v7-role-dock,.pc-shell-root-v4:has(.p7-demo-page) .pc-v7-assistant-widget,.pc-shell-root-v4:has(.p7-demo-page) .p7-mobile-action-rail,.pc-shell-root-v4:has(.p7-demo-page) .p7-mobile-tool-panel{display:none!important}.pc-shell-root-v4:has(.p7-demo-page) .pc-v4-main{max-width:none!important;margin:0!important;padding:0!important;background:#f6faf4!important;min-height:100svh!important}.p7-demo-page{min-height:100svh;padding:12px clamp(14px,4vw,56px) 42px;color:#071611;background:linear-gradient(180deg,#fbfcf9 0%,#f3f8f1 58%,#fff 100%);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.p7-demo-page *{box-sizing:border-box}.p7-demo-page a{color:inherit;text-decoration:none}.p7-demo-header{position:sticky;top:10px;z-index:20;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:14px;min-height:62px;padding:10px 12px 10px 14px;border:1px solid rgba(7,22,17,.08);border-radius:24px;background:rgba(255,255,255,.93);box-shadow:0 16px 42px rgba(7,22,17,.08);backdrop-filter:blur(16px)}.p7-demo-brand{display:inline-flex;align-items:center;gap:10px;font-weight:950;letter-spacing:-.03em}.p7-demo-brand span{display:grid;place-items:center;width:40px;height:40px;border-radius:14px;color:#087a3b;background:rgba(0,122,47,.08)}.p7-demo-header nav{display:flex;align-items:center;gap:8px}.p7-demo-header nav a{min-height:40px;display:inline-flex;align-items:center;justify-content:center;padding:0 14px;border-radius:14px;border:1px solid rgba(7,22,17,.1);font-size:13px;font-weight:900}.p7-demo-header nav a:last-child{background:#087a3b;color:#fff;border-color:#087a3b}.p7-demo-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(290px,.42fr);gap:18px;padding:34px 0 20px}.p7-demo-copy,.p7-demo-status,.p7-case-card,.p7-section,.p7-money-section,.p7-proof-section{border:1px solid rgba(7,22,17,.075);border-radius:32px;background:rgba(255,255,255,.80);box-shadow:0 18px 48px rgba(7,22,17,.065);backdrop-filter:blur(14px)}.p7-demo-copy{padding:clamp(24px,4vw,46px)}.p7-kicker{display:inline-flex;width:fit-content;margin-bottom:14px;padding:8px 12px;border-radius:999px;background:rgba(0,122,47,.08);color:#087a3b;font-size:11px;font-weight:950;letter-spacing:.055em;text-transform:uppercase}.p7-demo-copy h1{margin:0;max-width:880px;font-size:clamp(36px,5.8vw,78px);line-height:.98;letter-spacing:-.06em}.p7-demo-copy p,.p7-demo-status p,.p7-section-head p,.p7-money-section p,.p7-proof-section p{margin:16px 0 0;color:#4e5d56;font-size:16px;line-height:1.5;font-weight:640}.p7-demo-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}.p7-primary,.p7-secondary{min-height:48px;display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:16px;padding:0 17px;font-weight:950}.p7-primary{background:#087a3b;color:#fff!important;box-shadow:0 18px 34px rgba(0,122,47,.20)}.p7-secondary{border:1px solid rgba(7,22,17,.10);background:#fff}.p7-demo-status{padding:24px;align-self:stretch;display:grid;align-content:center}.p7-demo-status span,.p7-case-card span,.p7-section-head span{color:#087a3b;font-size:12px;font-weight:950;text-transform:uppercase;letter-spacing:.05em}.p7-demo-status strong{display:block;margin-top:10px;font-size:clamp(22px,2.5vw,34px);line-height:1.05;letter-spacing:-.045em}.p7-case-grid{display:grid;grid-template-columns:1.2fr .7fr 1fr;gap:12px;margin-top:8px}.p7-case-card{padding:20px}.p7-case-card strong{display:block;margin-top:8px;font-size:25px;letter-spacing:-.045em}.p7-case-card p{margin:8px 0 0;color:#66736e;font-size:13px;font-weight:700}.p7-section,.p7-money-section,.p7-proof-section{margin-top:18px;padding:22px}.p7-section-head{display:grid;gap:8px;margin-bottom:16px}.p7-section-head h2,.p7-money-section h2,.p7-proof-section h2{margin:0;font-size:clamp(27px,3.4vw,48px);line-height:1.03;letter-spacing:-.052em}.p7-stage-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}.p7-stage-card{min-height:224px;padding:15px;border-radius:22px;border:1px solid rgba(7,22,17,.075);background:#fff;display:grid;align-content:start;gap:8px;position:relative;overflow:hidden}.p7-stage-card.done{background:linear-gradient(180deg,#fff,rgba(242,249,243,.88))}.p7-stage-card.active{border-color:rgba(0,122,47,.28);box-shadow:0 16px 32px rgba(0,122,47,.09)}.p7-stage-num{color:#b5c2bb;font-size:12px;font-weight:950}.p7-stage-card svg,.p7-role-layer svg,.p7-proof-section svg{color:#087a3b}.p7-stage-card strong,.p7-role-layer strong{font-size:16px;font-weight:950;letter-spacing:-.035em}.p7-stage-card em{font-style:normal;color:#6a7670;font-size:11.5px;font-weight:850}.p7-stage-card p{margin:0;color:#65716b;font-size:12px;line-height:1.34;font-weight:640}.p7-stage-card small{margin-top:auto;width:fit-content;padding:6px 9px;border-radius:999px;background:rgba(0,122,47,.08);color:#087a3b;font-size:11px;font-weight:950}.p7-money-section{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,.34fr);gap:16px;align-items:stretch}.p7-money-card{border-radius:24px;background:#071611;color:#fff;padding:20px;display:grid;gap:10px;align-content:center}.p7-money-card svg{color:#7fe0a1}.p7-money-card strong{font-size:31px;letter-spacing:-.05em}.p7-money-card p{margin:0;color:rgba(255,255,255,.74);font-size:13px}.p7-money-card button{min-height:42px;border:0;border-radius:14px;background:rgba(255,255,255,.12);color:#fff;font-weight:900}.p7-role-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.p7-role-layer{padding:16px;border-radius:22px;border:1px solid rgba(7,22,17,.075);background:#fff;display:grid;gap:8px}.p7-role-layer p{margin:0;color:#4e5d56;font-size:13px;line-height:1.34;font-weight:700}.p7-role-layer small{color:#6d7872;font-size:12px;line-height:1.35}.p7-proof-section{display:grid;grid-template-columns:minmax(0,.7fr) minmax(300px,1fr);gap:18px}.p7-proof-section ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.p7-proof-section li{display:flex;align-items:center;gap:9px;padding:13px;border-radius:16px;background:#fff;border:1px solid rgba(7,22,17,.075);font-size:13px;font-weight:850}.p7-demo-footer{display:flex;justify-content:center;gap:10px;margin-top:22px}.p7-demo-footer a{min-height:42px;display:inline-flex;align-items:center;padding:0 14px;border-radius:14px;background:#fff;border:1px solid rgba(7,22,17,.08);font-weight:900}
@media (max-width:1180px){.p7-stage-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.p7-case-grid{grid-template-columns:1fr 1fr}.p7-case-card.main{grid-column:1/-1}}@media (max-width:860px){.p7-demo-page{padding:8px 12px 34px}.p7-demo-header,.p7-demo-hero,.p7-money-section,.p7-proof-section{grid-template-columns:1fr}.p7-demo-header nav{justify-content:stretch}.p7-demo-header nav a{flex:1}.p7-role-grid,.p7-proof-section ul{grid-template-columns:1fr}.p7-stage-grid{grid-template-columns:1fr 1fr}}@media (max-width:520px){.p7-demo-copy h1{font-size:36px}.p7-stage-grid,.p7-case-grid{grid-template-columns:1fr}.p7-demo-copy,.p7-demo-status,.p7-section,.p7-money-section,.p7-proof-section{border-radius:26px;padding:20px}.p7-demo-header{grid-template-columns:1fr}.p7-demo-header nav{display:grid;grid-template-columns:1fr}}
`;
