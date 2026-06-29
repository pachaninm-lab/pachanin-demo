import Link from 'next/link';
import { ArrowRight, Banknote, Building2, ClipboardCheck, FileCheck2, FlaskConical, Landmark, LockKeyhole, MessageCircleQuestion, Scale, ShieldCheck, Truck, Wheat, type LucideIcon } from 'lucide-react';

const deal = {
  id: 'DL-DEMO-001',
  crop: 'Пшеница 4 класс',
  volume: '240 т',
  amount: '2 964 000 ₽',
  route: 'Хозяйство → элеватор → покупатель',
  blocker: 'ожидается подтверждение качества и комплекта документов',
};

type Gate = { title: string; status: 'done' | 'active' | 'locked'; owner: string; text: string; Icon: LucideIcon };
type RoleView = { role: string; sees: string; action: string; Icon: LucideIcon };

const gates: Gate[] = [
  { title: 'Цена и допуск', status: 'done', owner: 'Стороны сделки', text: 'Цена, объём, базис и допуски качества зафиксированы до рейса.', Icon: Wheat },
  { title: 'Рейс и приёмка', status: 'done', owner: 'Логистика · элеватор', text: 'Рейс назначен. Элеватор подтверждает вес, факт поставки и расхождения.', Icon: Truck },
  { title: 'Качество', status: 'active', owner: 'Лаборатория', text: 'Протокол качества решает, можно ли двигать сделку к расчёту.', Icon: FlaskConical },
  { title: 'Документы', status: 'locked', owner: 'Продавец · покупатель', text: 'СДИЗ, ЭДО, ТТН и акты должны совпасть с событиями сделки.', Icon: FileCheck2 },
  { title: 'Основание оплаты', status: 'locked', owner: 'Банк', text: 'Деньги выпускаются только после подтверждённых событий и документов.', Icon: Landmark },
];

const roleViews: RoleView[] = [
  { role: 'Продавец', sees: 'какой факт мешает оплате', action: 'закрывает документы и расхождения', Icon: Wheat },
  { role: 'Покупатель', sees: 'что реально принято и какого качества', action: 'подтверждает поставку или фиксирует спор', Icon: ClipboardCheck },
  { role: 'Элеватор', sees: 'приёмку, вес и статус партии', action: 'даёт факт для документов', Icon: Building2 },
  { role: 'Лаборатория', sees: 'пробу и показатели качества', action: 'закрывает quality-gate', Icon: FlaskConical },
  { role: 'Банк', sees: 'только основание для расчёта', action: 'проверяет подтверждения', Icon: Landmark },
  { role: 'Арбитр', sees: 'фото, GPS, протоколы и журнал', action: 'разбирает спор по доказательствам', Icon: Scale },
];

const proof = ['маршрут и контрольные точки рейса', 'факт приёмки и вес', 'протокол качества', 'СДИЗ, ЭДО, ТТН и акты', 'журнал действий участников'];

export default function PlatformV7DemoPage() {
  return (
    <main className='p7-demo-page' data-testid='platform-v7-demo-public-workspace'>
      <style>{css}</style>
      <header className='p7-demo-header' aria-label='Демо-навигация'>
        <Link href='/platform-v7' className='p7-demo-brand' aria-label='На главную'><span><Wheat size={22} /></span><strong>Прозрачная Цена</strong></Link>
        <nav aria-label='Действия демо'><Link href='/platform-v7/contact'>Задать вопрос</Link><Link href='/platform-v7/register'>Подключить организацию</Link></nav>
      </header>

      <section className='p7-demo-hero' aria-labelledby='p7-demo-title'>
        <div className='p7-demo-hero-copy'>
          <span className='p7-demo-kicker'>Демо · 2 минуты · без регистрации</span>
          <h1 id='p7-demo-title'>Посмотрите, где сделка может застрять после цены</h1>
          <p>Цена согласована. Но расчёт нельзя делать по обещанию: платформа показывает, какие факты, документы и подтверждения нужны до выпуска денег.</p>
          <div className='p7-demo-actions'><a href='#scenario' className='p7-demo-primary'>Смотреть сценарий<ArrowRight size={18} /></a><Link href='/platform-v7/contact' className='p7-demo-secondary'><MessageCircleQuestion size={18} />Задать вопрос</Link></div>
        </div>
        <aside className='p7-demo-case' aria-label='Демо-сделка'>
          <span>Синтетическая сделка</span><strong>{deal.id}</strong>
          <dl><div><dt>Партия</dt><dd>{deal.crop}</dd></div><div><dt>Объём</dt><dd>{deal.volume}</dd></div><div><dt>Сумма</dt><dd>{deal.amount}</dd></div><div><dt>Маршрут</dt><dd>{deal.route}</dd></div></dl>
        </aside>
      </section>

      <section id='scenario' className='p7-demo-card' aria-labelledby='scenario-title'>
        <SectionHead n='01' title='Сценарий сделки' text='Демо показывает не кабинеты, а логику исполнения: что уже подтверждено, где стоп и кто закрывает следующий шаг.' id='scenario-title' />
        <div className='p7-demo-timeline'>{gates.map((gate, index) => <GateCard key={gate.title} gate={gate} index={index} />)}</div>
      </section>

      <section className='p7-demo-money' aria-labelledby='money-title'>
        <div><span className='p7-demo-kicker'>Текущий стоп</span><h2 id='money-title'>Деньги удержаны до подтверждений</h2><p>Сейчас сделка не закрыта: {deal.blocker}. Это отличие от обычной доски объявлений: платформа ведёт исполнение сделки, а не только показывает цену.</p></div>
        <div className='p7-demo-money-box'><small>Резерв</small><strong>{deal.amount}</strong><p>В демо денежные действия заблокированы. В рабочем контуре они требуют подтверждённых событий и документов.</p><button disabled>Выпуск денег недоступен в демо</button></div>
      </section>

      <section className='p7-demo-card' aria-labelledby='roles-title'>
        <SectionHead n='02' title='Что понимает каждая сторона' text='Участник видит свой слой одной сделки и следующий ответственный шаг.' id='roles-title' />
        <div className='p7-demo-role-list'>{roleViews.map((item) => <RoleCard key={item.role} item={item} />)}</div>
      </section>

      <section className='p7-demo-proof' aria-labelledby='proof-title'>
        <div><span className='p7-demo-kicker'>Доказательства</span><h2 id='proof-title'>Спор разбирается по фактам, а не по звонкам</h2><p>В один пакет собираются события сделки, документы и действия участников. Так видно, где причина задержки и кто должен её закрыть.</p></div>
        <ul>{proof.map((item) => <li key={item}><ShieldCheck size={18} />{item}</li>)}</ul>
      </section>

      <section className='p7-demo-final' aria-label='Следующий шаг'>
        <div><LockKeyhole size={24} /><h2>Реальные кабинеты закрыты</h2><p>Демо не создаёт сессию, не меняет роль и не открывает рабочие маршруты. Для проверки на своей сделке нужна заявка организации.</p></div>
        <div className='p7-demo-actions'><Link href='/platform-v7/register' className='p7-demo-primary'>Подключить организацию</Link><Link href='/platform-v7/contact' className='p7-demo-secondary'>Задать вопрос</Link></div>
      </section>
    </main>
  );
}

function SectionHead({ n, title, text, id }: { n: string; title: string; text: string; id: string }) { return <div className='p7-demo-section-head'><span>{n}</span><div><h2 id={id}>{title}</h2><p>{text}</p></div></div>; }
function GateCard({ gate, index }: { gate: Gate; index: number }) { const Icon = gate.Icon; const statusText = gate.status === 'done' ? 'закрыто' : gate.status === 'active' ? 'текущий шаг' : 'ждёт'; return <article className={`p7-demo-gate ${gate.status}`}><div><span>{String(index + 1).padStart(2, '0')}</span><Icon size={22} /></div><strong>{gate.title}</strong><p>{gate.text}</p><small>{gate.owner} · {statusText}</small></article>; }
function RoleCard({ item }: { item: RoleView }) { const Icon = item.Icon; return <article className='p7-demo-role-card'><Icon size={22} /><div><strong>{item.role}</strong><p>Видит: {item.sees}. Действие: {item.action}.</p></div></article>; }

const css = `
.pc-shell-root-v4:has(.p7-demo-page){--pc-header-offset:0px!important;background:#f4f8f2!important}.pc-shell-root-v4:has(.p7-demo-page) .pc-v4-header,.pc-shell-root-v4:has(.p7-demo-page) .pc-v4-bottomnav,.pc-shell-root-v4:has(.p7-demo-page) .pc-v4-drawer,.pc-shell-root-v4:has(.p7-demo-page) .pc-v4-pilot-note,.pc-shell-root-v4:has(.p7-demo-page) .pc-v7-role-dock,.pc-shell-root-v4:has(.p7-demo-page) .pc-v7-assistant-widget,.pc-shell-root-v4:has(.p7-demo-page) .p7-mobile-action-rail,.pc-shell-root-v4:has(.p7-demo-page) .p7-mobile-tool-panel{display:none!important}.pc-shell-root-v4:has(.p7-demo-page) .pc-v4-main{max-width:none!important;margin:0!important;padding:0!important;padding-bottom:0!important;background:#f4f8f2!important;min-height:100svh!important;contain:none!important}
.p7-demo-page{min-height:100svh;color:#071611;background:linear-gradient(180deg,#fbfcf8 0%,#f1f6ef 52%,#fff 100%);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:12px clamp(14px,4vw,54px) 42px}.p7-demo-page *{box-sizing:border-box}.p7-demo-page a{color:inherit;text-decoration:none}.p7-demo-header{position:sticky;top:10px;z-index:40;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;min-height:62px;padding:10px 12px 10px 14px;border:1px solid rgba(7,22,17,.08);border-radius:24px;background:rgba(255,255,255,.94);box-shadow:0 14px 36px rgba(7,22,17,.08);backdrop-filter:blur(16px)}.p7-demo-brand{display:inline-flex;align-items:center;gap:10px;font-weight:950}.p7-demo-brand span{display:grid;place-items:center;width:40px;height:40px;border-radius:14px;color:#087a3b;background:rgba(0,122,47,.08)}.p7-demo-header nav{display:flex;gap:8px}.p7-demo-header nav a{min-height:40px;display:inline-flex;align-items:center;justify-content:center;padding:0 14px;border-radius:14px;border:1px solid rgba(7,22,17,.1);font-size:13px;font-weight:900}.p7-demo-header nav a:last-child{color:#fff;background:#087a3b;border-color:#087a3b}.p7-demo-hero{display:grid;grid-template-columns:minmax(0,1.02fr) minmax(330px,.78fr);gap:18px;padding:28px 0 18px}.p7-demo-hero-copy,.p7-demo-case,.p7-demo-card,.p7-demo-money,.p7-demo-proof,.p7-demo-final{border:1px solid rgba(7,22,17,.075);border-radius:30px;background:rgba(255,255,255,.84);box-shadow:0 18px 46px rgba(7,22,17,.065)}.p7-demo-hero-copy{padding:clamp(24px,4vw,42px)}.p7-demo-kicker{display:inline-flex;width:fit-content;margin-bottom:14px;padding:8px 12px;border-radius:999px;background:rgba(0,122,47,.08);color:#087a3b;font-size:11px;font-weight:950;letter-spacing:.055em;text-transform:uppercase}.p7-demo-hero h1{margin:0;max-width:760px;font-size:clamp(36px,4.7vw,64px);line-height:1;letter-spacing:-.055em}.p7-demo-hero p,.p7-demo-section-head p,.p7-demo-money p,.p7-demo-proof p,.p7-demo-final p{margin:16px 0 0;color:#536058;font-size:16px;line-height:1.48;font-weight:650}.p7-demo-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}.p7-demo-primary,.p7-demo-secondary{min-height:52px;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 18px;border-radius:17px;font-size:14px;font-weight:950}.p7-demo-primary{color:#fff!important;background:#087a3b}.p7-demo-secondary{color:#087a3b!important;background:#fff;border:1px solid rgba(0,122,47,.22)}.p7-demo-case{padding:22px;display:grid;gap:14px;align-content:start}.p7-demo-case>span{width:fit-content;padding:8px 11px;border-radius:999px;background:rgba(0,122,47,.08);color:#087a3b;font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.055em}.p7-demo-case>strong{font-size:34px;letter-spacing:-.045em}.p7-demo-case dl{display:grid;gap:10px;margin:0}.p7-demo-case dl div{padding:13px;border-radius:18px;background:#f8faf7;border:1px solid rgba(7,22,17,.06)}.p7-demo-case dt{color:#6b7771;font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.08em}.p7-demo-case dd{margin:5px 0 0;font-size:15px;font-weight:900}.p7-demo-card,.p7-demo-proof,.p7-demo-final{padding:clamp(20px,3vw,30px);margin-top:18px}.p7-demo-section-head{display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px 14px;margin-bottom:18px}.p7-demo-section-head>span{display:grid;place-items:center;width:54px;height:54px;border-radius:18px;color:#087a3b;background:rgba(0,122,47,.08);font-size:19px;font-weight:950}.p7-demo-card h2,.p7-demo-money h2,.p7-demo-proof h2,.p7-demo-final h2{margin:0;font-size:clamp(26px,3.1vw,42px);line-height:1.05;letter-spacing:-.045em}.p7-demo-section-head p{margin:0}.p7-demo-timeline{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.p7-demo-gate{min-height:206px;padding:16px;border-radius:22px;border:1px solid rgba(7,22,17,.08);background:#fff;display:grid;align-content:start;gap:10px}.p7-demo-gate>div{display:flex;align-items:center;justify-content:space-between;color:#087a3b}.p7-demo-gate span{font-size:12px;font-weight:950}.p7-demo-gate strong{font-size:17px;font-weight:950}.p7-demo-gate p,.p7-demo-role-card p{margin:0;color:#65716b;font-size:13px;line-height:1.4;font-weight:650}.p7-demo-gate small{margin-top:auto;color:#087a3b;font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.055em}.p7-demo-gate.active{border-color:rgba(0,122,47,.28);box-shadow:0 18px 32px rgba(0,122,47,.12)}.p7-demo-money{display:grid;grid-template-columns:minmax(0,1fr) minmax(310px,.72fr);gap:18px;align-items:stretch;margin-top:18px;padding:clamp(22px,3vw,32px)}.p7-demo-money-box{padding:20px;border-radius:24px;background:#071611;color:#fff;display:grid;gap:12px}.p7-demo-money-box small{color:#a9d9bd;font-size:12px;text-transform:uppercase;letter-spacing:.08em;font-weight:950}.p7-demo-money-box strong{font-size:clamp(34px,4vw,48px);letter-spacing:-.055em}.p7-demo-money-box p{margin:0;color:#dbe8df;font-size:13px}.p7-demo-money-box button{min-height:46px;border:1px solid rgba(255,255,255,.18);border-radius:15px;background:rgba(255,255,255,.08);color:rgba(255,255,255,.72);font-weight:950}.p7-demo-role-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.p7-demo-role-card{display:grid;grid-template-columns:34px minmax(0,1fr);gap:12px;padding:16px;border-radius:20px;border:1px solid rgba(7,22,17,.075);background:#fff}.p7-demo-role-card svg{color:#087a3b}.p7-demo-role-card strong{font-size:15px;font-weight:950;color:#087a3b;text-transform:uppercase;letter-spacing:.055em}.p7-demo-proof{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,.68fr);gap:18px}.p7-demo-proof ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}.p7-demo-proof li{min-height:46px;display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:16px;border:1px solid rgba(7,22,17,.075);background:#fff;font-weight:850}.p7-demo-proof li svg{color:#087a3b;flex:0 0 auto}.p7-demo-final{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:center;background:linear-gradient(135deg,#071611,#0a3a26);color:#fff}.p7-demo-final svg{color:#a9d9bd}.p7-demo-final p{color:#dbe8df}.p7-demo-final .p7-demo-secondary{background:rgba(255,255,255,.1);color:#fff!important;border-color:rgba(255,255,255,.22)}
@media(max-width:980px){.p7-demo-page{padding:8px 12px 28px}.p7-demo-header,.p7-demo-hero,.p7-demo-money,.p7-demo-proof,.p7-demo-final{grid-template-columns:1fr}.p7-demo-header nav{display:grid;grid-template-columns:1fr 1fr}.p7-demo-timeline{grid-template-columns:1fr}.p7-demo-gate{min-height:auto}.p7-demo-role-list{grid-template-columns:1fr}.p7-demo-final .p7-demo-actions{margin-top:0}}@media(max-width:520px){.p7-demo-header{top:6px;border-radius:20px}.p7-demo-header nav{grid-template-columns:1fr}.p7-demo-hero{padding-top:14px}.p7-demo-hero-copy,.p7-demo-case,.p7-demo-card,.p7-demo-money,.p7-demo-proof,.p7-demo-final{border-radius:24px}.p7-demo-hero h1{font-size:34px}.p7-demo-primary,.p7-demo-secondary{width:100%}.p7-demo-case>strong{font-size:27px}.p7-demo-section-head{grid-template-columns:1fr}.p7-demo-section-head>span{width:48px;height:48px}.p7-demo-money-box strong{font-size:34px}}
`;
