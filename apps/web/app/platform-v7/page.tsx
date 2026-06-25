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
  Scale,
  ShieldCheck,
  Truck,
  UserRound,
  Wheat,
  type LucideIcon,
} from 'lucide-react';

type ControlCard = { title: string; text: string; Icon: LucideIcon };
type ProcessStep = { label: string; text: string; Icon: LucideIcon };
type RoleCard = { title: string; text: string; href: string; Icon: LucideIcon; cta: string };
type TrustItem = { title: string; text: string; Icon: LucideIcon };

const controlCards: ControlCard[] = [
  { title: 'Деньги', text: 'Видно, что блокирует оплату и когда расчёт можно продолжать.', Icon: Banknote },
  { title: 'Документы', text: 'Договор, СДИЗ, ЭДО, транспортные и приёмочные документы в одном следе.', Icon: FileCheck2 },
  { title: 'Логистика', text: 'Рейс, водитель, маршрут, точки контроля и отклонения от плана.', Icon: Truck },
  { title: 'Качество', text: 'Лаборатория, приёмка, расхождения и доказательства для спора.', Icon: FlaskConical },
];

const processSteps: ProcessStep[] = [
  { label: 'Цена', text: 'Цена, объём, базис и допуски качества зафиксированы до рейса.', Icon: Leaf },
  { label: 'Сделка', text: 'Стороны, партия и условия исполнения собраны в один контур.', Icon: ClipboardCheck },
  { label: 'Рейс', text: 'Маршрут, водитель, машина и контрольные точки назначены.', Icon: Truck },
  { label: 'Приёмка', text: 'Вес, факт поставки и расхождения фиксируются у элеватора.', Icon: Building2 },
  { label: 'Документы', text: 'СДИЗ, ЭДО, ТТН и акты сверяются с событиями сделки.', Icon: FileCheck2 },
  { label: 'Оплата', text: 'Банк видит основание: что подтверждено и что блокирует расчёт.', Icon: Banknote },
  { label: 'Спор', text: 'Evidence pack показывает факты, ответственных и основание решения.', Icon: Scale },
];

const roles: RoleCard[] = [
  { title: 'Оператор', text: 'Сделки, блокеры, SLA и ручные действия.', href: '/platform-v7/login?role=operator', Icon: ClipboardCheck, cta: 'Войти как оператор' },
  { title: 'Покупатель', text: 'Поставка, качество, документы и риски оплаты.', href: '/platform-v7/login?role=buyer', Icon: UserRound, cta: 'Войти как покупатель' },
  { title: 'Продавец', text: 'Партия, рейс, приёмка и основание для оплаты.', href: '/platform-v7/login?role=seller', Icon: Wheat, cta: 'Войти как продавец' },
  { title: 'Логистика', text: 'Рейсы, водители, статусы движения и отклонения.', href: '/platform-v7/login?role=logistics', Icon: Truck, cta: 'Войти как логистика' },
  { title: 'Водитель', text: 'Маршрут, точка, фото и офлайн-доказательства.', href: '/platform-v7/login?role=driver', Icon: Truck, cta: 'Войти как водитель' },
  { title: 'Элеватор', text: 'Приёмка, отгрузка, хранение, вес и статусы партии.', href: '/platform-v7/login?role=elevator', Icon: Building2, cta: 'Войти как элеватор' },
  { title: 'Лаборатория', text: 'Анализы, показатели качества и связка с приёмкой.', href: '/platform-v7/login?role=lab', Icon: FlaskConical, cta: 'Войти как лаборатория' },
  { title: 'Сюрвейер', text: 'Осмотр, фиксация фактов и независимый доказательный слой.', href: '/platform-v7/login?role=surveyor', Icon: ShieldCheck, cta: 'Войти как сюрвейер' },
  { title: 'Банк', text: 'Проверяемое основание для финансирования и расчётов.', href: '/platform-v7/login?role=bank', Icon: Landmark, cta: 'Войти как банк' },
  { title: 'Комплаенс', text: 'Риск обхода, доступы, действия и контроль правил.', href: '/platform-v7/login?role=compliance', Icon: ShieldCheck, cta: 'Войти как комплаенс' },
  { title: 'Арбитр', text: 'Спор, расхождения, evidence pack и решение по фактам.', href: '/platform-v7/login?role=arbitrator', Icon: Scale, cta: 'Войти как арбитр' },
  { title: 'Руководитель', text: 'Деньги, блокеры, роли, споры и карта исполнения.', href: '/platform-v7/login?role=executive', Icon: Banknote, cta: 'Войти как руководитель' },
];

const trustItems: TrustItem[] = [
  { title: 'Прозрачный статус сделки', text: 'Единая картина по этапам и участникам.', Icon: ShieldCheck },
  { title: 'Юридически значимый след', text: 'События и документы не живут отдельно от сделки.', Icon: BadgeCheck },
  { title: 'Контроль документов', text: 'Комплектность, версии, сроки и ответственные под контролем.', Icon: LockKeyhole },
  { title: 'Основа для расчётов', text: 'Деньги привязаны к подтверждаемым событиям, а не к звонкам.', Icon: Calculator },
];

export default function PlatformV7RootPage() {
  return (
    <main data-testid='platform-v7-root-execution-cockpit' className='pc-v7-entry-page pc-v7-public-entry'>
      <style>{entryCss}</style>

      <header className='entry-header' aria-label='Публичная навигация'>
        <Link href='/platform-v7' className='entry-brand' aria-label='Прозрачная Цена'>
          <span className='entry-brand-mark'><Wheat size={26} strokeWidth={2.45} /></span>
          <span><strong>Прозрачная Цена</strong><small>Контур исполнения сделки</small></span>
        </Link>

        <nav className='entry-desktop-nav' aria-label='Разделы главной страницы'>
          <a href='#process'>Как проходит</a>
          <a href='#control'>Что контролирует</a>
          <a href='#roles'>Роли</a>
          <Link href='/platform-v7/docs'>Документы</Link>
        </nav>

        <div className='entry-header-actions'>
          <Link href='/platform-v7/login' className='entry-login'><LogIn size={16} />Войти</Link>
          <Link href='/platform-v7/register' className='entry-header-register'>Регистрация</Link>
        </div>
      </header>

      <section className='entry-hero' aria-labelledby='entry-hero-title'>
        <div className='entry-hero-copy'>
          <span className='entry-kicker'>Единый вход в контур сделки</span>
          <h1 id='entry-hero-title' aria-label='Главный риск сделки начинается после согласования цены'>
            <span>Главный риск сделки</span>
            <span>начинается после</span>
            <span>согласования цены</span>
          </h1>
          <p>Прозрачная Цена — цифровой контур исполнения зерновой сделки: рейс, приёмка, качество, документы, деньги, спор и доказательства в одном процессе.</p>

          <div className='entry-hero-actions'>
            <a href='#roles' className='entry-primary-cta'>Выбрать роль<ArrowRight size={20} /></a>
            <Link href='/platform-v7/login' className='entry-secondary-cta'>Войти в кабинет</Link>
            <Link href='/platform-v7/register' className='entry-register-cta'>Зарегистрироваться</Link>
          </div>
        </div>

        <div className='entry-hero-visual' aria-hidden='true'>
          <div className='entry-route-line' />
          <div className='entry-floating-card docs'><FileCheck2 size={22} /><span>Документы</span><b>проверяются</b></div>
          <div className='entry-floating-card quality'><FlaskConical size={22} /><span>Качество</span><b>ожидает анализ</b></div>
          <div className='entry-floating-card money'><Banknote size={22} /><span>Оплата</span><b>зависит от событий</b></div>
        </div>
      </section>

      <section id='control' className='entry-section' aria-labelledby='control-title'>
        <div className='entry-section-head'>
          <h2 id='control-title'>Что контролирует платформа</h2>
          <p>Не поиск зерна ради поиска. Контур показывает, где сделка застряла и что нужно сделать дальше.</p>
        </div>
        <div className='entry-control-grid'>{controlCards.map((item) => <ControlTile key={item.title} item={item} />)}</div>
      </section>

      <section id='process' className='entry-section entry-process-section' aria-labelledby='process-title'>
        <div className='entry-section-head compact'>
          <h2 id='process-title'>Как проходит сделка</h2>
          <p>Каждый этап показывает статус, блокер, ответственного и следующий шаг.</p>
        </div>
        <div className='entry-process-row'>{processSteps.map((step, index) => <ProcessTile key={step.label} step={step} index={index} />)}</div>
      </section>

      <section id='roles' className='entry-section' aria-labelledby='roles-title'>
        <div className='entry-section-head'>
          <h2 id='roles-title'>Выберите свою роль в сделке</h2>
          <p>Роль выбирается здесь один раз. На странице входа останется только логин, пароль и организация.</p>
        </div>
        <div className='entry-role-grid'>{roles.map((role) => <RoleTile key={role.title} role={role} />)}</div>
      </section>

      <section className='entry-trust-strip' aria-label='Доверие и контроль'>
        {trustItems.map((item) => <TrustTile key={item.title} item={item} />)}
        <Link href='/platform-v7/register' className='entry-trust-cta'>Подключить организацию</Link>
      </section>
    </main>
  );
}

function ControlTile({ item }: { item: ControlCard }) {
  const Icon = item.Icon;
  return <article className='entry-control-tile'><Icon size={31} strokeWidth={2.25} /><strong>{item.title}</strong><span>{item.text}</span></article>;
}

function ProcessTile({ step, index }: { step: ProcessStep; index: number }) {
  const Icon = step.Icon;
  return (
    <article className='entry-process-tile'>
      <span className='entry-process-index'>{index + 1}</span>
      <span className='entry-process-icon'><Icon size={21} strokeWidth={2.2} /></span>
      <strong>{step.label}</strong>
      <small>{step.text}</small>
    </article>
  );
}

function RoleTile({ role }: { role: RoleCard }) {
  const Icon = role.Icon;
  return (
    <Link href={role.href} className='entry-role-tile'>
      <Icon size={27} strokeWidth={2.25} />
      <strong>{role.title}</strong>
      <span>{role.text}</span>
      <em>{role.cta}</em>
    </Link>
  );
}

function TrustTile({ item }: { item: TrustItem }) {
  const Icon = item.Icon;
  return <article className='entry-trust-item'><Icon size={26} strokeWidth={2.25} /><strong>{item.title}</strong><span>{item.text}</span></article>;
}

const entryCss = `
.pc-v7-public-entry {
  min-height: 100vh;
  overflow-x: hidden;
  color: #071611;
  background:
    radial-gradient(circle at 86% 10%, rgba(0, 122, 47, .10), transparent 30%),
    radial-gradient(circle at 10% 34%, rgba(181, 132, 43, .08), transparent 26%),
    linear-gradient(180deg, #fbfcf9 0%, #f3f7f1 54%, #ffffff 100%);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.pc-v7-public-entry * { box-sizing: border-box; }
.pc-v7-public-entry a { color: inherit; text-decoration: none; }
.entry-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: minmax(220px, auto) 1fr auto;
  align-items: center;
  gap: 24px;
  min-height: 70px;
  padding: 12px clamp(18px, 4vw, 56px);
  background: rgba(255, 255, 255, .92);
  border-bottom: 1px solid rgba(6, 26, 22, .08);
  backdrop-filter: blur(18px);
}
.entry-brand { display: inline-flex; align-items: center; gap: 12px; min-width: 0; }
.entry-brand-mark {
  display: inline-grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 15px;
  color: #087a3b;
  background: linear-gradient(145deg, rgba(0, 122, 47, .12), rgba(0, 122, 47, .03));
  box-shadow: inset 0 0 0 1px rgba(0,122,47,.08);
}
.entry-brand strong { display: block; font-size: 18px; line-height: 1.05; letter-spacing: -.03em; }
.entry-brand small { display: block; margin-top: 3px; color: #66736e; font-size: 12px; font-weight: 650; }
.entry-desktop-nav { display: flex; justify-content: center; gap: 24px; color: #17251f; font-size: 14px; font-weight: 760; }
.entry-desktop-nav a { opacity: .84; transition: opacity .15s ease, color .15s ease; }
.entry-desktop-nav a:hover { color: #087a3b; opacity: 1; }
.entry-header-actions { display: flex; align-items: center; justify-content: flex-end; gap: 9px; }
.entry-login, .entry-header-register {
  min-height: 42px;
  border-radius: 15px;
  border: 1px solid rgba(7, 22, 17, .10);
  background: rgba(255, 255, 255, .86);
  color: #071611;
  font-size: 14px;
  font-weight: 900;
}
.entry-login { display: inline-flex; align-items: center; gap: 8px; padding: 0 15px; }
.entry-header-register { display: inline-flex; align-items: center; justify-content: center; padding: 0 16px; color: #087a3b; background: rgba(0,122,47,.07); border-color: rgba(0,122,47,.18); }
.entry-hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, .96fr) minmax(390px, 1.04fr);
  align-items: stretch;
  gap: 20px;
  padding: clamp(26px, 4.8vw, 68px) clamp(18px, 4vw, 56px) 28px;
  overflow: hidden;
}
.entry-hero::before {
  content: '';
  position: absolute;
  inset: auto -10vw -70px 36vw;
  height: 360px;
  background:
    linear-gradient(90deg, rgba(255,255,255,.97) 0%, rgba(255,255,255,.68) 33%, rgba(255,255,255,.15) 100%),
    repeating-linear-gradient(112deg, rgba(191, 148, 55, .23) 0 3px, transparent 3px 16px),
    linear-gradient(180deg, rgba(218, 177, 72, .27), rgba(255,255,255,0));
  pointer-events: none;
}
.entry-hero-copy {
  position: relative;
  z-index: 2;
  align-self: center;
  max-width: 700px;
  padding: clamp(24px, 3vw, 40px);
  border: 1px solid rgba(7, 22, 17, .075);
  border-radius: 34px;
  background: rgba(255,255,255,.74);
  box-shadow: 0 20px 52px rgba(7, 22, 17, .07);
  backdrop-filter: blur(14px);
}
.entry-kicker {
  display: inline-flex;
  width: fit-content;
  margin-bottom: 18px;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(0, 122, 47, .08);
  color: #087a3b;
  font-size: 12px;
  font-weight: 950;
  letter-spacing: .045em;
  text-transform: uppercase;
}
.entry-hero h1 {
  display: grid;
  gap: 1px;
  margin: 0;
  max-width: 760px;
  font-size: clamp(38px, 4.5vw, 66px);
  line-height: .99;
  letter-spacing: -.052em;
  font-weight: 900;
  text-wrap: balance;
}
.entry-hero h1 span { display: block; }
.entry-hero h1 span:last-child { color: #087a3b; }
.entry-hero p { margin: 18px 0 0; max-width: 620px; color: #3e4a45; font-size: clamp(16.5px, 1.25vw, 19px); line-height: 1.44; font-weight: 620; text-wrap: pretty; }
.entry-hero-actions { display: grid; grid-template-columns: 1.1fr .9fr 1fr; align-items: center; gap: 10px; margin-top: 24px; }
.entry-primary-cta, .entry-secondary-cta, .entry-register-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 56px;
  border-radius: 17px;
  padding: 0 18px;
  font-size: 15.5px;
  font-weight: 950;
  text-align: center;
}
.pc-v7-public-entry .entry-primary-cta { gap: 9px; color: #fff !important; background: #087a3b; box-shadow: 0 18px 38px rgba(0, 122, 47, .22); }
.pc-v7-public-entry .entry-secondary-cta { color: #087a3b !important; background: rgba(255,255,255,.82); border: 1px solid rgba(0, 122, 47, .24); }
.pc-v7-public-entry .entry-register-cta { color: #09251b !important; background: rgba(0, 122, 47, .08); border: 1px solid rgba(0, 122, 47, .16); }
.entry-hero-visual {
  position: relative;
  min-height: 430px;
  border-radius: 34px;
  overflow: hidden;
  border: 1px solid rgba(7, 22, 17, .07);
  background:
    radial-gradient(circle at 74% 28%, rgba(255,255,255,.15), transparent 20%),
    linear-gradient(90deg, rgba(255,255,255,.98) 0%, rgba(255,255,255,.36) 42%, rgba(255,255,255,.08) 100%),
    linear-gradient(180deg, #eef5ec 0%, #f4d77f 62%, #f8edd0 100%);
  box-shadow: 0 24px 70px rgba(8, 20, 14, .10);
}
.entry-hero-visual::before { content: ''; position: absolute; right: 8%; bottom: 22%; width: 66%; height: 46%; background: linear-gradient(90deg, transparent 0 12%, rgba(70, 82, 78, .34) 12% 14%, transparent 14% 28%, rgba(70, 82, 78, .34) 28% 30%, transparent 30% 44%, rgba(70, 82, 78, .34) 44% 46%, transparent 46%), linear-gradient(180deg, rgba(42, 55, 50, .24), rgba(255,255,255,.08)); border-radius: 34px 34px 10px 10px; box-shadow: 0 -58px 0 -32px rgba(58, 76, 70, .28), -130px 20px 0 -14px rgba(58, 76, 70, .22); }
.entry-hero-visual::after { content: ''; position: absolute; right: 9%; bottom: 16%; width: 245px; height: 78px; border-radius: 22px 10px 10px 16px; background: linear-gradient(90deg, #f8faf7 0 58%, #dfe7dc 58% 100%); box-shadow: 0 18px 42px rgba(7, 22, 17, .18), 24px 63px 0 -31px #1b241f, 164px 63px 0 -31px #1b241f; }
.entry-route-line { position: absolute; left: 10%; right: 12%; top: 43%; height: 7px; border-radius: 999px; background: linear-gradient(90deg, rgba(0,122,47,.1), rgba(0,122,47,.75), rgba(0,122,47,.18)); box-shadow: 0 0 0 9px rgba(255,255,255,.38); transform: rotate(-9deg); }
.entry-floating-card { position: absolute; display: grid; grid-template-columns: auto 1fr; gap: 5px 10px; align-items: center; min-width: 165px; padding: 12px 14px; border-radius: 18px; border: 1px solid rgba(7,22,17,.08); background: rgba(255,255,255,.84); color: #087a3b; box-shadow: 0 16px 36px rgba(7, 22, 17, .11); backdrop-filter: blur(10px); }
.entry-floating-card span { color: #223029; font-size: 13px; font-weight: 900; }
.entry-floating-card b { grid-column: 2; color: #7c8580; font-size: 11px; font-weight: 750; }
.entry-floating-card.docs { left: 7%; top: 18%; }
.entry-floating-card.quality { right: 10%; top: 20%; }
.entry-floating-card.money { left: 43%; bottom: 14%; }
.entry-section { padding: 26px clamp(18px, 4vw, 56px); }
.entry-section-head { display: flex; align-items: end; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
.entry-section-head.compact { justify-content: center; text-align: center; display: grid; }
.entry-section h2 { margin: 0; color: #071611; font-size: clamp(25px, 2.6vw, 40px); line-height: 1.05; letter-spacing: -.045em; font-weight: 950; }
.entry-section-head p { margin: 0; max-width: 610px; color: #66736e; font-size: 15px; line-height: 1.45; font-weight: 650; }
.entry-control-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.entry-control-tile, .entry-role-tile, .entry-process-tile, .entry-trust-item { border: 1px solid rgba(7, 22, 17, .075); background: rgba(255,255,255,.80); box-shadow: 0 14px 34px rgba(7, 22, 17, .06); }
.entry-control-tile { min-height: 174px; padding: 21px; border-radius: 24px; display: grid; align-content: start; gap: 13px; color: #087a3b; }
.entry-control-tile strong { color: #071611; font-size: 20px; font-weight: 950; letter-spacing: -.035em; }
.entry-control-tile span { color: #59665f; font-size: 14px; line-height: 1.42; font-weight: 650; }
.entry-process-section { padding-top: 16px; }
.entry-process-row { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 10px; }
.entry-process-tile { position: relative; min-height: 138px; padding: 15px 11px; border-radius: 22px; text-align: center; display: grid; justify-items: center; align-content: start; gap: 8px; }
.entry-process-tile:not(:last-child)::after { content: '→'; position: absolute; right: -10px; top: 39px; color: #087a3b; font-weight: 900; z-index: 1; }
.entry-process-index { color: #087a3b; font-size: 12px; font-weight: 950; }
.entry-process-icon { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 16px; color: #087a3b; background: rgba(0,122,47,.08); }
.entry-process-tile strong { font-size: 14px; font-weight: 950; letter-spacing: -.025em; }
.entry-process-tile small { color: #6b746f; font-size: 11.5px; line-height: 1.27; font-weight: 650; }
.entry-role-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.entry-role-tile { min-height: 172px; padding: 18px; border-radius: 24px; display: grid; align-content: start; gap: 10px; color: #087a3b; transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease; }
.entry-role-tile:hover { transform: translateY(-2px); border-color: rgba(0,122,47,.24); box-shadow: 0 18px 42px rgba(0,122,47,.11); }
.entry-role-tile strong { color: #071611; font-size: 18px; font-weight: 950; letter-spacing: -.035em; }
.entry-role-tile span { color: #5d6862; font-size: 13px; line-height: 1.38; font-weight: 640; }
.entry-role-tile em { margin-top: auto; color: #087a3b; font-size: 12.5px; font-style: normal; font-weight: 900; }
.entry-trust-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)) auto; gap: 0; align-items: stretch; margin: 22px clamp(18px, 4vw, 56px) 44px; border: 1px solid rgba(0, 122, 47, .13); border-radius: 28px; overflow: hidden; background: rgba(246, 250, 245, .92); box-shadow: 0 18px 44px rgba(7, 22, 17, .07); }
.entry-trust-item { display: grid; grid-template-columns: auto 1fr; gap: 5px 12px; padding: 21px; border: 0; border-right: 1px solid rgba(7, 22, 17, .08); background: transparent; color: #087a3b; box-shadow: none; }
.entry-trust-item strong { color: #173027; font-size: 15px; font-weight: 950; letter-spacing: -.025em; }
.entry-trust-item span { grid-column: 2; color: #66736e; font-size: 12.5px; line-height: 1.35; font-weight: 650; }
.entry-trust-cta { align-self: stretch; display: inline-flex; align-items: center; justify-content: center; min-width: 220px; padding: 0 24px; background: #087a3b; color: #fff !important; font-size: 15px; font-weight: 950; }
@media (max-width: 980px) {
  .entry-header { grid-template-columns: 1fr auto; min-height: 64px; padding: 9px 16px; gap: 10px; }
  .entry-desktop-nav, .entry-header-register { display: none; }
  .entry-login { min-height: 44px; padding: 0 16px; border-radius: 15px; }
  .entry-login svg { display: none; }
  .entry-brand { gap: 10px; }
  .entry-brand-mark { width: 40px; height: 40px; border-radius: 14px; }
  .entry-brand small { display: none; }
  .entry-hero { grid-template-columns: 1fr; padding: 18px 14px 12px; gap: 0; }
  .entry-hero::before { inset: auto -20vw 6px 0; height: 210px; opacity: .42; }
  .entry-hero-copy { max-width: none; padding: 22px 20px 20px; border-radius: 28px; }
  .entry-kicker { margin-bottom: 12px; padding: 7px 11px; font-size: 10px; letter-spacing: .045em; }
  .entry-hero h1 { font-size: clamp(32px, 8.9vw, 40px); line-height: 1.015; letter-spacing: -.044em; max-width: 100%; gap: 2px; }
  .entry-hero p { margin-top: 14px; font-size: 15.6px; line-height: 1.42; }
  .entry-hero-actions { grid-template-columns: 1fr; gap: 9px; margin-top: 20px; }
  .entry-primary-cta, .entry-secondary-cta, .entry-register-cta { width: 100%; min-height: 54px; border-radius: 18px; }
  .entry-hero-visual { display: none; }
  .entry-section { padding: 18px 14px; }
  .entry-section-head, .entry-section-head.compact { display: grid; align-items: start; justify-content: stretch; text-align: left; gap: 8px; margin-bottom: 14px; }
  .entry-section h2 { font-size: clamp(27px, 8vw, 36px); letter-spacing: -.052em; }
  .entry-section-head p { font-size: 14.5px; line-height: 1.44; }
  .entry-control-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .entry-control-tile { min-height: 150px; padding: 16px; border-radius: 21px; }
  .entry-control-tile strong { font-size: 17px; }
  .entry-control-tile span { font-size: 12.5px; }
  .entry-process-row { display: flex; gap: 10px; overflow-x: auto; scroll-snap-type: x mandatory; padding: 0 2px 8px; -webkit-overflow-scrolling: touch; }
  .entry-process-row::-webkit-scrollbar { display: none; }
  .entry-process-tile { flex: 0 0 176px; min-height: 142px; scroll-snap-align: start; text-align: left; justify-items: start; padding: 15px; }
  .entry-process-tile:not(:last-child)::after { display: none; }
  .entry-process-index { position: absolute; top: 15px; right: 15px; }
  .entry-role-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .entry-role-tile { min-height: 142px; padding: 14px; border-radius: 21px; gap: 8px; }
  .entry-role-tile strong { font-size: 16px; }
  .entry-role-tile span { font-size: 12px; line-height: 1.32; }
  .entry-role-tile em { font-size: 11px; }
  .entry-trust-strip { grid-template-columns: 1fr; margin: 18px 14px 34px; border-radius: 24px; }
  .entry-trust-item { border-right: 0; border-bottom: 1px solid rgba(7,22,17,.08); padding: 17px; }
  .entry-trust-cta { min-height: 58px; min-width: 0; }
}
@media (max-width: 420px) {
  .entry-header { min-height: 60px; padding: 8px 14px; }
  .entry-brand strong { font-size: 17px; }
  .entry-brand-mark { width: 38px; height: 38px; }
  .entry-login { min-height: 42px; padding: 0 15px; }
  .entry-hero { padding: 12px 0 10px; }
  .entry-hero-copy { border-radius: 27px; padding: 21px 17px 19px; }
  .entry-kicker { margin-bottom: 11px; font-size: 9.7px; }
  .entry-hero h1 { font-size: clamp(30px, 8.55vw, 34px); line-height: 1.02; letter-spacing: -.041em; }
  .entry-hero p { margin-top: 13px; font-size: 15px; line-height: 1.4; }
  .entry-primary-cta, .entry-secondary-cta, .entry-register-cta { min-height: 52px; font-size: 15px; }
  .entry-control-grid { grid-template-columns: 1fr; }
}
`;
