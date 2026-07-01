import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Building2,
  Calculator,
  ClipboardCheck,
  FileCheck2,
  FlaskConical,
  Landmark,
  Leaf,
  LockKeyhole,
  LogIn,
  MessageCircleQuestion,
  PlayCircle,
  Scale,
  ShieldCheck,
  Truck,
  UserRound,
  Wheat,
  type LucideIcon,
} from 'lucide-react';
import { PlatformV7IntelligenceStrip } from '@/components/v7r/PlatformV7IntelligenceStrip';

type Card = { title: string; text: string; Icon: LucideIcon };
type RoleCard = Card & { href: string; cta: string };

const controlCards: Card[] = [
  { title: 'Деньги', text: 'Основание для расчёта видно до выпуска оплаты.', Icon: Banknote },
  { title: 'Документы', text: 'СДИЗ, ЭДО, транспортные документы и акты связаны с событиями сделки.', Icon: FileCheck2 },
  { title: 'Логистика', text: 'Рейс, водитель, маршрут и контрольные точки находятся в одном контуре.', Icon: Truck },
  { title: 'Качество', text: 'Приёмка и лабораторные показатели учитываются до окончательного расчёта.', Icon: FlaskConical },
];

const processSteps: Card[] = [
  { title: 'Цена', text: 'Цена, объём, базис и допуски качества зафиксированы до рейса.', Icon: Leaf },
  { title: 'Сделка', text: 'Стороны, партия и условия исполнения сведены в единый контур.', Icon: ClipboardCheck },
  { title: 'Рейс', text: 'Маршрут, водитель, транспорт и контрольные точки назначены.', Icon: Truck },
  { title: 'Приёмка', text: 'Вес, факт поставки и расхождения фиксируются на элеваторе.', Icon: Building2 },
  { title: 'Документы', text: 'Документы сверяются с событиями исполнения.', Icon: FileCheck2 },
  { title: 'Расчёт', text: 'Оплата проводится после подтверждения оснований.', Icon: Banknote },
  { title: 'Спор', text: 'Разбор ведётся по зафиксированным данным.', Icon: Scale },
];

const roles: RoleCard[] = [
  { title: 'Оператор', text: 'Сделки, блокеры, SLA и контрольные действия.', href: '/platform-v7/login?role=operator', Icon: ClipboardCheck, cta: 'Войти как оператор' },
  { title: 'Покупатель', text: 'Поставка, качество, документы и риски оплаты.', href: '/platform-v7/login?role=buyer', Icon: UserRound, cta: 'Войти как покупатель' },
  { title: 'Продавец', text: 'Партия, рейс, приёмка и основание для оплаты.', href: '/platform-v7/login?role=seller', Icon: Wheat, cta: 'Войти как продавец' },
  { title: 'Логистика', text: 'Рейсы, водители, движение и отклонения по маршруту.', href: '/platform-v7/login?role=logistics', Icon: Truck, cta: 'Войти как логистика' },
  { title: 'Водитель', text: 'Маршрут, точки рейса, фото и офлайн-доказательства.', href: '/platform-v7/login?role=driver', Icon: Truck, cta: 'Войти как водитель' },
  { title: 'Элеватор', text: 'Приёмка, хранение, вес и статусы партии.', href: '/platform-v7/login?role=elevator', Icon: Building2, cta: 'Войти как элеватор' },
  { title: 'Лаборатория', text: 'Анализы, показатели качества и связь с приёмкой.', href: '/platform-v7/login?role=lab', Icon: FlaskConical, cta: 'Войти как лаборатория' },
  { title: 'Сюрвейер', text: 'Осмотр, фиксация фактов и независимый доказательный слой.', href: '/platform-v7/login?role=surveyor', Icon: ShieldCheck, cta: 'Войти как сюрвейер' },
  { title: 'Банк', text: 'Основания для финансирования и расчётов по подтверждённым событиям.', href: '/platform-v7/login?role=bank', Icon: Landmark, cta: 'Войти как банк' },
  { title: 'Комплаенс', text: 'Доступы, действия участников и контроль правил.', href: '/platform-v7/login?role=compliance', Icon: ShieldCheck, cta: 'Войти как комплаенс' },
  { title: 'Арбитр', text: 'Спор, расхождения, пакет доказательств и решение по фактам.', href: '/platform-v7/login?role=arbitrator', Icon: Scale, cta: 'Войти как арбитр' },
  { title: 'Руководитель', text: 'Расчёты, блокеры, роли, споры и ход исполнения.', href: '/platform-v7/login?role=executive', Icon: Banknote, cta: 'Войти как руководитель' },
];

const trustItems: Card[] = [
  { title: 'Статус без догадок', text: 'Единая картина по этапам и участникам.', Icon: ShieldCheck },
  { title: 'Юридически значимый след', text: 'События и документы связаны с исполнением сделки.', Icon: BadgeCheck },
  { title: 'Контроль документов', text: 'Комплектность, версии, сроки и ответственные под контролем.', Icon: LockKeyhole },
  { title: 'Основа для расчётов', text: 'Расчёт опирается на подтверждённые события.', Icon: Calculator },
];

const heroSignals = [
  ['Цена', 'согласована'],
  ['Рейс', 'в работе'],
  ['Приёмка', 'ожидает факт'],
  ['Документы', 'на сверке'],
  ['Расчёт', 'после оснований'],
] as const;

export default function PlatformV7RootPage() {
  return (
    <main data-testid='platform-v7-root-execution-cockpit' className='pc-v7-entry-page pc-v7-public-entry'>
      <style>{css}</style>
      <header className='entry-header' aria-label='Публичная навигация'>
        <Link href='/platform-v7' className='entry-brand' aria-label='Прозрачная Цена'>
          <span className='entry-brand-mark'><Wheat size={26} strokeWidth={2.45} /></span>
          <span><strong>Прозрачная Цена</strong><small>Контур исполнения сделки</small></span>
        </Link>
        <nav className='entry-nav' aria-label='Разделы главной страницы'>
          <a href='#process'>Как проходит</a>
          <a href='#control'>Контроль</a>
          <a href='#roles'>Роли</a>
          <Link href='/platform-v7/demo'>Демо</Link>
          <Link href='/platform-v7/contact'>Вопрос</Link>
          <Link href='/platform-v7/docs'>Документы</Link>
        </nav>
        <div className='entry-header-actions'>
          <Link href='/platform-v7/login' className='entry-login'><LogIn size={16} />Войти</Link>
          <Link href='/platform-v7/register' className='entry-header-register'>Регистрация</Link>
        </div>
      </header>

      <section className='entry-hero' aria-labelledby='entry-hero-title'>
        <div className='entry-hero-copy'>
          <span className='entry-kicker'>Единый вход в контур исполнения</span>
          <h1 id='entry-hero-title'>
            <span>Главный риск сделки</span>
            <span>начинается после</span>
            <span>согласования цены</span>
          </h1>
          <p>
            Прозрачная Цена — цифровой контур исполнения зерновой сделки: рейс, приёмка, качество,
            документы, деньги, спор и доказательства в одном процессе.
          </p>
          <div className='entry-hero-actions'>
            <Link href='/platform-v7/register' className='entry-primary-cta'>Подключить организацию<ArrowRight size={20} /></Link>
            <Link href='/platform-v7/demo' className='entry-secondary-cta'><PlayCircle size={18} />Посмотреть демо-сделку</Link>
            <Link href='/platform-v7/contact' className='entry-register-cta'><MessageCircleQuestion size={18} />Задать вопрос</Link>
          </div>
        </div>

        <div className='entry-hero-visual' aria-hidden='true'>
          <div className='entry-visual-card entry-visual-main'>
            <span className='entry-visual-label'>Контур сделки</span>
            <strong>DL-9102</strong>
            <small>исполнение под контролем</small>
            <div className='entry-signal-list'>
              {heroSignals.map(([label, value]) => (
                <span key={label}><b>{label}</b><em>{value}</em></span>
              ))}
            </div>
          </div>
          <div className='entry-route-line' />
          <div className='entry-floating-card docs'><FileCheck2 size={22} /><span>Документы</span><b>на сверке</b></div>
          <div className='entry-floating-card quality'><FlaskConical size={22} /><span>Качество</span><b>ожидает акт</b></div>
          <div className='entry-floating-card money'><Banknote size={22} /><span>Расчёт</span><b>после оснований</b></div>
        </div>
      </section>

      <section id='control' className='entry-section' aria-labelledby='control-title'>
        <SectionHead title='Что контролирует платформа' text='После согласования цены под контролем остаётся главное: рейс, приёмка, документы, качество и основание для оплаты.' />
        <div className='entry-control-grid'>{controlCards.map((item) => <ControlTile key={item.title} item={item} />)}</div>
      </section>

      <section id='process' className='entry-section entry-process-section' aria-labelledby='process-title'>
        <SectionHead title='Как проходит сделка' text='На каждом этапе видно, что уже подтверждено, что требует действия и кто отвечает за следующий шаг.' compact />
        <div className='entry-process-row'>{processSteps.map((step, index) => <ProcessTile key={step.title} step={step} index={index} />)}</div>
      </section>

      <PlatformV7IntelligenceStrip />

      <section id='roles' className='entry-section' aria-labelledby='roles-title'>
        <SectionHead title='Выберите свою роль в сделке' text='Сначала выберите роль участника сделки. После этого вход выполняется по логину, паролю и организации.' />
        <div className='entry-role-grid'>{roles.map((role) => <RoleTile key={role.title} role={role} />)}</div>
      </section>

      <section className='entry-trust-strip' aria-label='Доверие и контроль'>
        {trustItems.map((item) => <TrustTile key={item.title} item={item} />)}
        <Link href='/platform-v7/register' className='entry-trust-cta'>Подключить организацию</Link>
      </section>
    </main>
  );
}

function SectionHead({ title, text, compact }: { title: string; text: string; compact?: boolean }) {
  return <div className={compact ? 'entry-section-head compact' : 'entry-section-head'}><h2>{title}</h2><p>{text}</p></div>;
}
function ControlTile({ item }: { item: Card }) { const Icon = item.Icon; return <article className='entry-control-tile'><Icon size={31} strokeWidth={2.25} /><strong>{item.title}</strong><span>{item.text}</span></article>; }
function ProcessTile({ step, index }: { step: Card; index: number }) { const Icon = step.Icon; return <article className='entry-process-tile'><span className='entry-process-index'>{index + 1}</span><span className='entry-process-icon'><Icon size={21} strokeWidth={2.2} /></span><strong>{step.title}</strong><small>{step.text}</small></article>; }
function RoleTile({ role }: { role: RoleCard }) { const Icon = role.Icon; return <Link href={role.href} className='entry-role-tile'><Icon size={27} strokeWidth={2.25} /><strong>{role.title}</strong><span>{role.text}</span><em>{role.cta}</em></Link>; }
function TrustTile({ item }: { item: Card }) { const Icon = item.Icon; return <article className='entry-trust-item'><Icon size={26} strokeWidth={2.25} /><strong>{item.title}</strong><span>{item.text}</span></article>; }

const css = `
.pc-v7-public-entry{
  --entry-green:#087a3b;
  --entry-green-dark:#055c2d;
  --entry-ink:#071611;
  --entry-muted:#5e6b66;
  --entry-line:rgba(7,22,17,.09);
  --entry-card:rgba(255,255,255,.86);
  --entry-header-height:72px;
  min-height:100vh;
  padding-top:var(--entry-header-height);
  overflow-x:hidden;
  color:var(--entry-ink);
  background:
    radial-gradient(circle at 12% 0%,rgba(0,122,47,.13),transparent 30%),
    radial-gradient(circle at 92% 8%,rgba(196,145,42,.10),transparent 34%),
    linear-gradient(180deg,#fbfcf9 0%,#f2f7f0 54%,#fff 100%);
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
}
.pc-v7-public-entry *{box-sizing:border-box}
.pc-v7-public-entry a{color:inherit;text-decoration:none}
.entry-header{
  position:fixed;top:0;left:0;right:0;z-index:1400;
  display:grid;grid-template-columns:minmax(238px,auto) 1fr auto;align-items:center;gap:22px;
  min-height:var(--entry-header-height);padding:12px clamp(18px,4vw,58px);
  background:rgba(255,255,255,.94);border-bottom:1px solid rgba(6,26,22,.08);
  box-shadow:0 16px 38px rgba(7,22,17,.08);backdrop-filter:blur(18px);
}
.entry-brand{display:inline-flex;align-items:center;gap:12px;min-width:0}.entry-brand-mark{display:inline-grid;place-items:center;width:42px;height:42px;border-radius:15px;color:var(--entry-green);background:rgba(0,122,47,.08)}.entry-brand strong{display:block;font-size:18px;line-height:1.05;letter-spacing:-.03em}.entry-brand small{display:block;margin-top:3px;color:#66736e;font-size:12px;font-weight:650}.entry-nav{display:flex;justify-content:center;gap:18px;color:#17251f;font-size:14px;font-weight:760}.entry-nav a:hover{color:var(--entry-green)}.entry-header-actions{display:flex;align-items:center;justify-content:flex-end;gap:9px}.entry-login,.entry-header-register{min-height:42px;border-radius:15px;border:1px solid rgba(7,22,17,.10);background:rgba(255,255,255,.86);font-size:14px;font-weight:900;display:inline-flex;align-items:center;justify-content:center}.entry-login{gap:8px;padding:0 15px}.entry-header-register{padding:0 16px;color:var(--entry-green);background:rgba(0,122,47,.07);border-color:rgba(0,122,47,.16)}
.entry-hero{max-width:1220px;margin:0 auto;min-height:calc(100svh - var(--entry-header-height));padding:clamp(34px,5vw,74px) clamp(18px,4vw,46px) 34px;display:grid;grid-template-columns:minmax(0,1.02fr) minmax(360px,.82fr);gap:clamp(26px,5vw,70px);align-items:center;position:relative}.entry-hero::before{content:"";position:absolute;inset:42px 0 auto 42%;height:420px;border-radius:999px;background:linear-gradient(135deg,rgba(0,122,47,.10),rgba(196,145,42,.10));filter:blur(34px);pointer-events:none}.entry-hero-copy{position:relative;z-index:1;display:grid;gap:20px;max-width:760px}.entry-kicker{width:max-content;display:inline-flex;align-items:center;min-height:34px;padding:0 14px;border-radius:999px;background:rgba(0,122,47,.09);color:var(--entry-green-dark);font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.entry-hero h1{margin:0;display:grid;gap:2px;font-size:clamp(50px,7.3vw,92px);line-height:.94;letter-spacing:-.067em;color:var(--entry-ink)}.entry-hero h1 span:last-child{color:var(--entry-green-dark)}.entry-hero p{max-width:720px;margin:0;color:#43514b;font-size:clamp(18px,2vw,23px);line-height:1.42;font-weight:520}.entry-hero-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:6px}.entry-primary-cta,.entry-secondary-cta,.entry-register-cta{min-height:54px;border-radius:18px;padding:0 20px;display:inline-flex;align-items:center;justify-content:center;gap:10px;font-size:15px;font-weight:950;border:1px solid transparent;transition:transform .18s ease,box-shadow .18s ease}.entry-primary-cta{color:#fff;background:linear-gradient(135deg,#087a3b,#0b6a37);box-shadow:0 20px 42px rgba(0,122,47,.24)}.entry-secondary-cta{color:#0b5f31;background:#fff;border-color:rgba(0,122,47,.18);box-shadow:0 14px 34px rgba(7,22,17,.08)}.entry-register-cta{color:#17251f;background:rgba(255,255,255,.62);border-color:rgba(7,22,17,.10)}.entry-primary-cta:hover,.entry-secondary-cta:hover,.entry-register-cta:hover{transform:translateY(-1px)}
.entry-hero-visual{position:relative;z-index:1;min-height:520px;border-radius:42px;background:linear-gradient(145deg,rgba(255,255,255,.92),rgba(245,249,242,.80));border:1px solid rgba(7,22,17,.08);box-shadow:0 30px 80px rgba(7,22,17,.13);overflow:hidden}.entry-hero-visual::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(7,22,17,.035) 1px,transparent 1px),linear-gradient(rgba(7,22,17,.035) 1px,transparent 1px);background-size:34px 34px;mask-image:linear-gradient(180deg,rgba(0,0,0,.9),transparent)}.entry-route-line{position:absolute;left:58px;right:58px;top:260px;height:3px;border-radius:999px;background:linear-gradient(90deg,rgba(0,122,47,.08),rgba(0,122,47,.82),rgba(196,145,42,.52));box-shadow:0 0 0 10px rgba(0,122,47,.06)}.entry-visual-card{position:absolute;left:42px;right:42px;top:42px;padding:24px;border-radius:30px;background:rgba(255,255,255,.92);border:1px solid rgba(7,22,17,.08);box-shadow:0 18px 45px rgba(7,22,17,.10)}.entry-visual-label{display:block;color:var(--entry-green);font-size:12px;font-weight:950;text-transform:uppercase;letter-spacing:.08em}.entry-visual-main strong{display:block;margin-top:8px;font-size:44px;letter-spacing:-.055em}.entry-visual-main small{display:block;margin-top:2px;color:var(--entry-muted);font-weight:760}.entry-signal-list{display:grid;gap:8px;margin-top:18px}.entry-signal-list span{display:grid;grid-template-columns:96px 1fr;gap:10px;align-items:center;padding:10px 12px;border-radius:16px;background:#f8fbf7;border:1px solid rgba(7,22,17,.06)}.entry-signal-list b{font-size:13px}.entry-signal-list em{font-style:normal;color:#5a6762;font-size:13px;font-weight:750}.entry-floating-card{position:absolute;display:grid;gap:6px;min-width:132px;padding:16px;border-radius:22px;background:#fff;border:1px solid rgba(7,22,17,.08);box-shadow:0 16px 42px rgba(7,22,17,.12);color:var(--entry-green)}.entry-floating-card span{color:#2b3832;font-size:13px;font-weight:900}.entry-floating-card b{color:#6a756f;font-size:12px}.entry-floating-card.docs{left:42px;bottom:54px}.entry-floating-card.quality{left:50%;bottom:92px;transform:translateX(-50%)}.entry-floating-card.money{right:42px;bottom:54px}
.entry-section{max-width:1220px;margin:0 auto;padding:48px clamp(18px,4vw,46px)}.entry-section-head{display:flex;align-items:end;justify-content:space-between;gap:28px;margin-bottom:22px}.entry-section-head.compact{margin-bottom:18px}.entry-section-head h2{max-width:650px;margin:0;font-size:clamp(34px,4.5vw,58px);line-height:1;letter-spacing:-.055em}.entry-section-head p{max-width:500px;margin:0;color:#60706a;font-size:17px;line-height:1.48}.entry-control-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.entry-control-tile,.entry-process-tile,.entry-role-tile,.entry-trust-item{border:1px solid var(--entry-line);background:var(--entry-card);box-shadow:0 18px 46px rgba(7,22,17,.07);backdrop-filter:blur(12px)}.entry-control-tile{min-height:230px;padding:24px;border-radius:30px;display:grid;align-content:start;gap:14px;color:var(--entry-green)}.entry-control-tile strong{color:var(--entry-ink);font-size:22px;letter-spacing:-.03em}.entry-control-tile span{color:#61716b;line-height:1.45;font-weight:560}.entry-process-row{display:grid;grid-template-columns:repeat(7,minmax(132px,1fr));gap:10px}.entry-process-tile{position:relative;min-height:176px;padding:18px;border-radius:24px;display:grid;align-content:start;gap:10px}.entry-process-tile:not(:last-child)::after{content:"";position:absolute;right:-9px;top:50%;width:12px;height:2px;background:rgba(0,122,47,.28)}.entry-process-index{width:28px;height:28px;border-radius:999px;background:rgba(0,122,47,.09);color:var(--entry-green);display:grid;place-items:center;font-size:12px;font-weight:950}.entry-process-icon{color:var(--entry-green)}.entry-process-tile strong{font-size:18px}.entry-process-tile small{color:#68746f;line-height:1.38;font-size:13px;font-weight:570}.entry-role-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.entry-role-tile{min-height:196px;padding:20px;border-radius:28px;display:grid;align-content:start;gap:10px;color:var(--entry-green);transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}.entry-role-tile:hover{transform:translateY(-2px);border-color:rgba(0,122,47,.28);box-shadow:0 24px 58px rgba(7,22,17,.11)}.entry-role-tile strong{color:var(--entry-ink);font-size:20px;letter-spacing:-.03em}.entry-role-tile span{color:#65736e;line-height:1.42;font-weight:560}.entry-role-tile em{margin-top:auto;color:var(--entry-green-dark);font-size:13px;font-style:normal;font-weight:900}.entry-trust-strip{max-width:1220px;margin:16px auto 70px;padding:18px clamp(18px,4vw,46px);display:grid;grid-template-columns:repeat(4,minmax(0,1fr)) auto;gap:12px}.entry-trust-item{min-height:128px;padding:18px;border-radius:24px;display:grid;align-content:start;gap:8px;color:var(--entry-green)}.entry-trust-item strong{color:var(--entry-ink);font-size:16px}.entry-trust-item span{color:#66736e;font-size:13px;line-height:1.35}.entry-trust-cta{min-height:128px;min-width:190px;border-radius:24px;display:grid;place-items:center;text-align:center;padding:18px;background:linear-gradient(135deg,#087a3b,#075f31);color:#fff;font-weight:950;box-shadow:0 20px 42px rgba(0,122,47,.22)}
@media (max-width:1080px){.entry-header{grid-template-columns:1fr auto}.entry-nav{display:none}.entry-hero{grid-template-columns:1fr;min-height:0}.entry-hero-visual{min-height:420px}.entry-control-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.entry-role-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.entry-trust-strip{grid-template-columns:repeat(2,minmax(0,1fr))}.entry-trust-cta{min-height:92px}}
@media (max-width:720px){.pc-v7-public-entry{--entry-header-height:70px}.entry-header{padding:10px 14px;gap:10px}.entry-brand small,.entry-header-register{display:none}.entry-brand-mark{width:40px;height:40px}.entry-brand strong{font-size:17px}.entry-login{min-height:42px;padding:0 16px}.entry-hero{padding:26px 14px 20px}.entry-hero-copy{padding:22px 20px;border-radius:28px;background:rgba(255,255,255,.88);border:1px solid rgba(7,22,17,.08);box-shadow:0 16px 42px rgba(7,22,17,.07)}.entry-hero h1{font-size:42px;line-height:1.02}.entry-hero p{font-size:17px}.entry-hero-actions{display:grid}.entry-primary-cta,.entry-secondary-cta,.entry-register-cta{width:100%;min-height:54px}.entry-hero-visual{display:none}.entry-section{padding:22px 14px}.entry-section-head{display:grid;gap:10px;margin-bottom:14px}.entry-section-head h2{font-size:32px}.entry-section-head p{font-size:14.5px}.entry-control-grid{grid-template-columns:1fr}.entry-control-tile{min-height:156px;border-radius:22px;padding:18px}.entry-process-row{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px;-webkit-overflow-scrolling:touch}.entry-process-row::-webkit-scrollbar{display:none}.entry-process-tile{flex:0 0 176px;scroll-snap-align:start;min-height:142px}.entry-process-tile:not(:last-child)::after{display:none}.entry-role-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.entry-role-tile{min-height:142px;padding:14px;border-radius:21px}.entry-role-tile strong{font-size:16px}.entry-role-tile span{font-size:12px}.entry-trust-strip{display:grid;grid-template-columns:1fr;margin:18px 14px 34px;padding:0;gap:10px}.entry-trust-item{min-height:0;border-radius:20px}.entry-trust-cta{min-height:54px;border-radius:18px}}
@media (max-width:374px){.entry-header{padding:8px 12px}.entry-brand{gap:8px}.entry-brand-mark{width:38px;height:38px}.entry-brand strong{font-size:16px}.entry-login{min-width:84px;height:42px;padding:0 14px}.entry-hero h1{font-size:38px}}
`;
