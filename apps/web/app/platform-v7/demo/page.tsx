import Link from 'next/link';
import { ArrowRight, BadgeCheck, Banknote, Building2, ClipboardCheck, FileCheck2, FlaskConical, Landmark, LockKeyhole, MapPinned, Scale, ShieldCheck, Truck, Wheat, type LucideIcon } from 'lucide-react';

const deal = {
  id: 'DL-DEMO-001',
  lot: 'Пшеница 4 класс · демо-партия',
  volume: '240 т',
  amount: '2 964 000 ₽',
  route: 'Хозяйство → элеватор → покупатель',
  status: 'Демо · синтетические данные',
};

type Step = { title: string; text: string; Icon: LucideIcon; state: 'done' | 'active' | 'locked' };
type Lens = { role: string; title: string; text: string; Icon: LucideIcon };

const steps: Step[] = [
  { title: 'Цена', text: 'Зафиксированы цена, объём, базис и допуски качества.', Icon: Wheat, state: 'done' },
  { title: 'Резерв', text: 'Деньги удержаны в демо-контуре до подтверждения событий.', Icon: Banknote, state: 'done' },
  { title: 'Рейс', text: 'Назначены маршрут, транспорт и контрольные точки.', Icon: Truck, state: 'active' },
  { title: 'Приёмка', text: 'Вес и факт поставки ждут подтверждения элеватора.', Icon: Building2, state: 'locked' },
  { title: 'Качество', text: 'Лабораторный протокол станет денежным условием.', Icon: FlaskConical, state: 'locked' },
  { title: 'Документы', text: 'СДИЗ, ЭДО и транспортные документы собираются в пакет.', Icon: FileCheck2, state: 'locked' },
  { title: 'Расчёт', text: 'Выпуск денег возможен только в рабочем контуре.', Icon: Landmark, state: 'locked' },
];

const roleLenses: Lens[] = [
  { role: 'Продавец', title: 'Видит основание для оплаты', text: 'Партия, рейс, приёмка, документы и что ещё блокирует расчёт.', Icon: Wheat },
  { role: 'Покупатель', title: 'Контролирует поставку и качество', text: 'События исполнения, риски отклонений и комплектность документов.', Icon: ClipboardCheck },
  { role: 'Логистика', title: 'Ведёт рейс по фактам', text: 'Маршрут, водитель, контрольные точки и отклонения без доступа к деньгам.', Icon: Truck },
  { role: 'Элеватор', title: 'Фиксирует приёмку', text: 'Вес, расхождения, статус партии и связь с документами.', Icon: Building2 },
  { role: 'Лаборатория', title: 'Даёт quality-gate', text: 'Показатели качества, протокол и влияние на финальное основание.', Icon: FlaskConical },
  { role: 'Банк', title: 'Видит только basis для расчёта', text: 'События, блокеры и подтверждения без коммерческой подмены сделки.', Icon: Landmark },
  { role: 'Арбитр', title: 'Разбирает спор по доказательствам', text: 'Фото, GPS, протоколы, документы и журнал действий.', Icon: Scale },
  { role: 'Комплаенс', title: 'Контролирует правила и обход', text: 'Доступы, риск обхода платформы и отклонения от процесса.', Icon: ShieldCheck },
];

const evidence: Omit<Lens, 'role'>[] = [
  { title: 'GPS-метка рейса', text: 'Маршрут и контрольные точки привязаны к сделке.', Icon: MapPinned },
  { title: 'Фото приёмки', text: 'Полевые материалы идут в evidence pack.', Icon: BadgeCheck },
  { title: 'Протокол качества', text: 'Показатели качества становятся условием расчёта.', Icon: FlaskConical },
  { title: 'Документы', text: 'СДИЗ, ЭДО, ТТН и акты сверяются с событиями.', Icon: FileCheck2 },
  { title: 'Журнал действий', text: 'Кто, когда и на каком основании изменил статус.', Icon: LockKeyhole },
];

export default function PlatformV7DemoPage() {
  return (
    <main className='p7-demo-page' data-testid='platform-v7-demo-public-workspace'>
      <style>{css}</style>
      <header className='p7-demo-header' aria-label='Навигация демо-сделки'>
        <Link href='/platform-v7' className='p7-demo-brand' aria-label='На главную Прозрачная Цена'><span><Wheat size={24} /></span><strong>Прозрачная Цена</strong></Link>
        <nav className='p7-demo-nav' aria-label='Действия демо'><Link href='/platform-v7/contact'>Задать вопрос</Link><Link href='/platform-v7/register'>Подключить организацию</Link><Link href='/platform-v7/login'>Войти</Link></nav>
      </header>

      <section className='p7-demo-hero' aria-labelledby='p7-demo-title'>
        <div className='p7-demo-copy'>
          <span className='p7-demo-kicker'>Демо · без регистрации · без доступа в ЛК</span>
          <h1 id='p7-demo-title'>Демо-сделка: от цены до безопасного расчёта</h1>
          <p>Показываем, как платформа ведёт зерновую сделку после согласования цены: логистика, приёмка, качество, документы, деньги, спор и доказательства в одном контуре.</p>
          <div className='p7-demo-actions'><Link href='/platform-v7/register' className='p7-demo-primary'>Подключить организацию<ArrowRight size={18} /></Link><Link href='/platform-v7/contact' className='p7-demo-secondary'>Задать вопрос</Link></div>
        </div>
        <aside className='p7-demo-deal-card' aria-label='Параметры демо-сделки'>
          <span>{deal.status}</span>
          <strong>{deal.id}</strong>
          <dl><div><dt>Партия</dt><dd>{deal.lot}</dd></div><div><dt>Объём</dt><dd>{deal.volume}</dd></div><div><dt>Сумма</dt><dd>{deal.amount}</dd></div><div><dt>Маршрут</dt><dd>{deal.route}</dd></div></dl>
        </aside>
      </section>

      <section className='p7-demo-section' aria-labelledby='p7-demo-map-title'>
        <div className='p7-demo-section-head'><span>01</span><h2 id='p7-demo-map-title'>Живая карта сделки</h2><p>Это не вход в систему. Это публичный sandbox-view с синтетическими данными и заблокированными рабочими действиями.</p></div>
        <div className='p7-demo-rail'>{steps.map((step, index) => <StepCard key={step.title} step={step} index={index} />)}</div>
      </section>

      <section className='p7-demo-section p7-demo-money' aria-labelledby='p7-demo-money-title'>
        <div><span className='p7-demo-kicker'>Money gate</span><h2 id='p7-demo-money-title'>Деньги не выпускаются по обещанию</h2><p>В рабочем контуре расчёт должен опираться на подтверждённые события: приёмку, качество и комплект документов. В демо все денежные действия заблокированы.</p></div>
        <div className='p7-demo-money-card'><b>Резерв</b><strong>{deal.amount}</strong><small>Статус: удержано до приёмки и комплекта документов</small><div><button disabled>Выпуск денег недоступен в демо</button><button disabled>Возврат недоступен в демо</button><button disabled>Спор недоступен в демо</button></div></div>
      </section>

      <section className='p7-demo-section' aria-labelledby='p7-demo-lens-title'>
        <div className='p7-demo-section-head'><span>02</span><h2 id='p7-demo-lens-title'>Ролевой просмотр без входа в ЛК</h2><p>Каждая роль видит свой слой сделки. Демо не создаёт сессию, не меняет роль и не открывает реальные кабинеты.</p></div>
        <div className='p7-demo-lens-grid'>{roleLenses.map((item) => <LensCard key={item.role} item={item} />)}</div>
      </section>

      <section className='p7-demo-section' aria-labelledby='p7-demo-evidence-title'>
        <div className='p7-demo-section-head'><span>03</span><h2 id='p7-demo-evidence-title'>Доказательства вместо телефонного спора</h2><p>Платформа собирает проверяемый след сделки: факты, документы, события и ответственных.</p></div>
        <div className='p7-demo-evidence-grid'>{evidence.map((item) => <EvidenceCard key={item.title} item={item} />)}</div>
      </section>

      <section className='p7-demo-final' aria-label='Следующее действие'>
        <div><span className='p7-demo-kicker'>Следующий шаг</span><h2>Хотите проверить на своей сделке?</h2><p>Оставьте вопрос или заявку. Боевые действия, банк, ФГИС и ЭДО подключаются только после допуска организации и live-интеграций.</p></div>
        <div><Link href='/platform-v7/register' className='p7-demo-primary'>Подключить организацию</Link><Link href='/platform-v7/contact' className='p7-demo-secondary'>Задать вопрос</Link></div>
      </section>
    </main>
  );
}

function StepCard({ step, index }: { step: Step; index: number }) { const Icon = step.Icon; return <article className={`p7-demo-step ${step.state}`}><span>{String(index + 1).padStart(2, '0')}</span><Icon size={23} /><strong>{step.title}</strong><p>{step.text}</p></article>; }
function LensCard({ item }: { item: Lens }) { const Icon = item.Icon; return <article className='p7-demo-lens'><Icon size={24} /><span>{item.role}</span><strong>{item.title}</strong><p>{item.text}</p></article>; }
function EvidenceCard({ item }: { item: Omit<Lens, 'role'> }) { const Icon = item.Icon; return <article className='p7-demo-evidence'><Icon size={24} /><strong>{item.title}</strong><p>{item.text}</p></article>; }

const css = `
.pc-shell-root-v4:has(.p7-demo-page){--pc-header-offset:0px!important;background:#f7faf6!important}.pc-shell-root-v4:has(.p7-demo-page) .pc-v4-header,.pc-shell-root-v4:has(.p7-demo-page) .pc-v4-bottomnav,.pc-shell-root-v4:has(.p7-demo-page) .pc-v4-drawer,.pc-shell-root-v4:has(.p7-demo-page) .pc-v4-pilot-note{display:none!important}.pc-shell-root-v4:has(.p7-demo-page) .pc-v4-main{max-width:none!important;margin:0!important;padding:0!important;background:#f7faf6!important;min-height:100svh!important}
.p7-demo-page{min-height:100svh;color:#071611;background:radial-gradient(circle at 82% 10%,rgba(0,122,47,.1),transparent 30%),linear-gradient(180deg,#fbfcf9 0%,#f3f7f1 58%,#fff 100%);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:12px clamp(14px,4vw,56px) 46px}.p7-demo-page *{box-sizing:border-box}.p7-demo-page a{color:inherit;text-decoration:none}.p7-demo-header{position:sticky;top:10px;z-index:20;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:14px;min-height:62px;padding:10px 12px 10px 14px;border:1px solid rgba(7,22,17,.08);border-radius:24px;background:rgba(255,255,255,.92);box-shadow:0 16px 42px rgba(7,22,17,.08);backdrop-filter:blur(16px)}.p7-demo-brand{display:inline-flex;align-items:center;gap:10px;font-weight:950;letter-spacing:-.03em}.p7-demo-brand span{display:grid;place-items:center;width:40px;height:40px;border-radius:14px;color:#087a3b;background:rgba(0,122,47,.08)}.p7-demo-nav{display:flex;align-items:center;gap:8px}.p7-demo-nav a{min-height:40px;display:inline-flex;align-items:center;justify-content:center;padding:0 14px;border-radius:14px;border:1px solid rgba(7,22,17,.1);font-size:13px;font-weight:900}.p7-demo-nav a:nth-child(2){color:#fff;background:#087a3b;border-color:#087a3b}.p7-demo-hero{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(320px,.95fr);gap:20px;padding:34px 0 20px}.p7-demo-copy,.p7-demo-deal-card,.p7-demo-section,.p7-demo-final{border:1px solid rgba(7,22,17,.075);border-radius:32px;background:rgba(255,255,255,.78);box-shadow:0 18px 48px rgba(7,22,17,.065);backdrop-filter:blur(14px)}.p7-demo-copy{padding:clamp(24px,4vw,44px)}.p7-demo-kicker{display:inline-flex;width:fit-content;margin-bottom:14px;padding:8px 12px;border-radius:999px;background:rgba(0,122,47,.08);color:#087a3b;font-size:11px;font-weight:950;letter-spacing:.055em;text-transform:uppercase}.p7-demo-copy h1{margin:0;max-width:780px;font-size:clamp(36px,5vw,72px);line-height:.98;letter-spacing:-.055em}.p7-demo-copy p,.p7-demo-section-head p,.p7-demo-money p,.p7-demo-final p{margin:16px 0 0;color:#4e5d56;font-size:16px;line-height:1.5;font-weight:640}.p7-demo-actions,.p7-demo-final>div:last-child{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}.p7-demo-primary,.p7-demo-secondary{min-height:52px;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 18px;border-radius:17px;font-size:14px;font-weight:950}.p7-demo-primary{color:#fff!important;background:#087a3b;box-shadow:0 18px 34px rgba(0,122,47,.2)}.p7-demo-secondary{color:#087a3b!important;background:rgba(255,255,255,.86);border:1px solid rgba(0,122,47,.22)}.p7-demo-deal-card{padding:24px;display:grid;align-content:start;gap:16px}.p7-demo-deal-card>span{width:fit-content;padding:8px 11px;border-radius:999px;color:#087a3b;background:rgba(0,122,47,.08);font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.055em}.p7-demo-deal-card>strong{font-size:34px;letter-spacing:-.045em}.p7-demo-deal-card dl{display:grid;gap:10px;margin:0}.p7-demo-deal-card div{padding:13px;border-radius:18px;background:rgba(247,250,246,.88);border:1px solid rgba(7,22,17,.06)}.p7-demo-deal-card dt{color:#6b7771;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.07em}.p7-demo-deal-card dd{margin:5px 0 0;font-size:15px;font-weight:850}.p7-demo-section{padding:clamp(20px,3vw,30px);margin-top:18px}.p7-demo-section-head{display:grid;grid-template-columns:auto minmax(0,1fr);gap:5px 14px;margin-bottom:18px}.p7-demo-section-head span{grid-row:1/3;display:grid;place-items:center;width:46px;height:46px;border-radius:16px;color:#087a3b;background:rgba(0,122,47,.08);font-weight:950}.p7-demo-section h2,.p7-demo-final h2{margin:0;font-size:clamp(25px,3vw,42px);line-height:1.05;letter-spacing:-.045em}.p7-demo-section-head p{margin:0;max-width:760px}.p7-demo-rail{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:10px}.p7-demo-step{position:relative;min-height:158px;padding:15px;border-radius:22px;border:1px solid rgba(7,22,17,.08);background:#fff;display:grid;align-content:start;gap:8px}.p7-demo-step:not(:last-child)::after{content:'';position:absolute;right:-10px;top:44px;width:16px;height:3px;border-radius:999px;background:#087a3b}.p7-demo-step span{color:#087a3b;font-size:11px;font-weight:950}.p7-demo-step svg{color:#087a3b}.p7-demo-step strong{font-size:15px;font-weight:950;letter-spacing:-.03em}.p7-demo-step p,.p7-demo-lens p,.p7-demo-evidence p{margin:0;color:#68746e;font-size:12px;line-height:1.35;font-weight:650}.p7-demo-step.active{box-shadow:0 18px 36px rgba(0,122,47,.13);border-color:rgba(0,122,47,.24)}.p7-demo-step.locked{opacity:.72}.p7-demo-money{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,.9fr);gap:18px;align-items:stretch}.p7-demo-money-card{padding:20px;border-radius:24px;background:#071611;color:#fff;display:grid;gap:12px}.p7-demo-money-card b{color:#a9d9bd;font-size:12px;text-transform:uppercase;letter-spacing:.08em}.p7-demo-money-card strong{font-size:42px;letter-spacing:-.055em}.p7-demo-money-card small{color:#dbe8df;font-size:13px;font-weight:700}.p7-demo-money-card div{display:grid;gap:8px}.p7-demo-money-card button{min-height:42px;border:1px solid rgba(255,255,255,.16);border-radius:14px;background:rgba(255,255,255,.08);color:rgba(255,255,255,.72);font-weight:900}.p7-demo-lens-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.p7-demo-lens,.p7-demo-evidence{padding:17px;border-radius:22px;border:1px solid rgba(7,22,17,.075);background:#fff;display:grid;gap:8px}.p7-demo-lens svg,.p7-demo-evidence svg{color:#087a3b}.p7-demo-lens span{color:#087a3b;font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.07em}.p7-demo-lens strong,.p7-demo-evidence strong{font-size:16px;font-weight:950;letter-spacing:-.035em}.p7-demo-evidence-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.p7-demo-final{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:center;margin-top:18px;padding:clamp(22px,3vw,34px);background:linear-gradient(135deg,#071611,#0a3a26);color:#fff}.p7-demo-final p{color:#dbe8df}.p7-demo-final .p7-demo-secondary{background:rgba(255,255,255,.1);color:#fff!important;border-color:rgba(255,255,255,.22)}
@media (max-width:980px){.p7-demo-page{padding:8px 12px 34px}.p7-demo-header{grid-template-columns:1fr}.p7-demo-nav{display:grid;grid-template-columns:1fr 1fr 1fr}.p7-demo-hero,.p7-demo-money,.p7-demo-final{grid-template-columns:1fr}.p7-demo-rail{display:flex;overflow-x:auto;gap:10px;padding-bottom:8px}.p7-demo-step{flex:0 0 180px}.p7-demo-step::after{display:none}.p7-demo-lens-grid,.p7-demo-evidence-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.p7-demo-final>div:last-child{margin-top:0}}@media (max-width:520px){.p7-demo-nav{grid-template-columns:1fr}.p7-demo-copy h1{font-size:34px}.p7-demo-lens-grid,.p7-demo-evidence-grid{grid-template-columns:1fr}.p7-demo-primary,.p7-demo-secondary{width:100%}.p7-demo-deal-card>strong{font-size:28px}.p7-demo-money-card strong{font-size:32px}}
`;
