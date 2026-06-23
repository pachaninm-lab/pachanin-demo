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
  HelpCircle,
  Landmark,
  Leaf,
  LockKeyhole,
  LogIn,
  Menu,
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
  { label: 'Цена', text: 'Согласованы базовые условия', Icon: Leaf },
  { label: 'Сделка', text: 'Зафиксированы стороны и допуски', Icon: ClipboardCheck },
  { label: 'Рейс', text: 'Назначены маршрут и исполнитель', Icon: Truck },
  { label: 'Приёмка', text: 'Подтверждены вес и факт поставки', Icon: Building2 },
  { label: 'Документы', text: 'Собран обязательный комплект', Icon: FileCheck2 },
  { label: 'Оплата', text: 'Расчёт идёт по подтверждённым событиям', Icon: Banknote },
  { label: 'Спор', text: 'Есть доказательная база', Icon: Scale },
];

const roles: RoleCard[] = [
  { title: 'Продавец', text: 'Партия, рейс, приёмка и основание для оплаты.', href: '/platform-v7/login', Icon: Wheat, cta: 'Доступ после единого входа' },
  { title: 'Покупатель', text: 'Поставка, качество, документы и риски оплаты.', href: '/platform-v7/login', Icon: UserRound, cta: 'Доступ после единого входа' },
  { title: 'Логистика', text: 'Рейсы, водители, статусы движения и отклонения.', href: '/platform-v7/login', Icon: Truck, cta: 'Доступ после единого входа' },
  { title: 'Элеватор', text: 'Приёмка, отгрузка, хранение, вес и статусы партии.', href: '/platform-v7/login', Icon: Building2, cta: 'Доступ после единого входа' },
  { title: 'Банк', text: 'Проверяемое основание для финансирования и расчётов.', href: '/platform-v7/login', Icon: Landmark, cta: 'Доступ после единого входа' },
  { title: 'Лаборатория', text: 'Анализы, показатели качества и связка с приёмкой.', href: '/platform-v7/login', Icon: FlaskConical, cta: 'Доступ после единого входа' },
  { title: 'Сюрвейер', text: 'Осмотр, фиксация фактов и независимый доказательный слой.', href: '/platform-v7/login', Icon: ShieldCheck, cta: 'Доступ после единого входа' },
  { title: 'Арбитр', text: 'Спор, расхождения, evidence pack и решение по фактам.', href: '/platform-v7/login', Icon: Scale, cta: 'Доступ после единого входа' },
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
          <span className='entry-brand-mark'><Wheat size={30} strokeWidth={2.4} /></span>
          <span><strong>Прозрачная Цена</strong><small>Контур исполнения агросделки</small></span>
        </Link>

        <nav className='entry-desktop-nav' aria-label='Разделы главной страницы'>
          <Link href='/platform-v7/open'>Как это работает</Link>
          <a href='#control'>Что контролирует</a>
          <a href='#roles'>Роли</a>
          <Link href='/platform-v7/docs'>Документы</Link>
        </nav>

        <div className='entry-header-actions'>
          <Link href='/platform-v7/login' className='entry-login'><LogIn size={17} />Войти</Link>
          <Link href='/platform-v7/open' className='entry-demo'>Демо</Link>
          <Link href='/platform-v7/support' className='entry-icon-button' aria-label='Помощь'><HelpCircle size={21} /></Link>
          <details className='entry-menu'>
            <summary className='entry-icon-button entry-menu-button' aria-label='Открыть меню'><Menu size={22} /></summary>
            <nav className='entry-menu-panel' aria-label='Меню'>
              <Link href='/platform-v7/open'>Как это работает</Link>
              <a href='#control'>Что контролирует</a>
              <a href='#roles'>Роли</a>
              <Link href='/platform-v7/docs'>Документы</Link>
              <Link href='/platform-v7/login'>Войти в кабинет</Link>
            </nav>
          </details>
        </div>
      </header>

      <section className='entry-hero' aria-labelledby='entry-hero-title'>
        <div className='entry-hero-copy'>
          <span className='entry-kicker'>Публичный вход в execution-контур</span>
          <h1 id='entry-hero-title'>После цены начинается главный риск сделки</h1>
          <p>Контролируйте качество, вес, логистику, документы, приёмку, оплату и спор в одном цифровом контуре.</p>

          <div className='entry-hero-actions'>
            <Link href='/platform-v7/open' className='entry-primary-cta'>Посмотреть, как работает<ArrowRight size={20} /></Link>
            <a href='#roles' className='entry-secondary-cta'>Выбрать роль</a>
            <Link href='/platform-v7/login' className='entry-text-cta'>Войти в кабинет</Link>
          </div>

          <div className='entry-status-note'>
            Controlled pilot · внешние подключения к банку, ЭДО, ФГИС/ЭПД требуют доступов, договоров и проверки на реальных сделках.
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

      <section className='entry-section entry-process-section' aria-labelledby='process-title'>
        <div className='entry-section-head compact'>
          <h2 id='process-title'>Как проходит сделка</h2>
          <p>Каждый этап показывает статус, блокер, ответственного и следующий шаг.</p>
        </div>
        <div className='entry-process-row'>{processSteps.map((step, index) => <ProcessTile key={step.label} step={step} index={index} />)}</div>
      </section>

      <section id='roles' className='entry-section' aria-labelledby='roles-title'>
        <div className='entry-section-head'>
          <h2 id='roles-title'>Выберите свою роль в сделке</h2>
          <p>Показываем сценарий роли до перехода в рабочий кабинет. Операционные действия доступны после входа.</p>
        </div>
        <div className='entry-role-grid'>{roles.map((role) => <RoleTile key={role.title} role={role} />)}</div>
      </section>

      <section className='entry-trust-strip' aria-label='Доверие и контроль'>
        {trustItems.map((item) => <TrustTile key={item.title} item={item} />)}
        <Link href='/platform-v7/open' className='entry-trust-cta'>Запросить демонстрацию</Link>
      </section>
    </main>
  );
}

function ControlTile({ item }: { item: ControlCard }) {
  const Icon = item.Icon;
  return <article className='entry-control-tile'><Icon size={33} strokeWidth={2.25} /><strong>{item.title}</strong><span>{item.text}</span></article>;
}

function ProcessTile({ step, index }: { step: ProcessStep; index: number }) {
  const Icon = step.Icon;
  return (
    <article className='entry-process-tile'>
      <span className='entry-process-index'>{index + 1}</span>
      <span className='entry-process-icon'><Icon size={22} strokeWidth={2.2} /></span>
      <strong>{step.label}</strong>
      <small>{step.text}</small>
    </article>
  );
}

function RoleTile({ role }: { role: RoleCard }) {
  const Icon = role.Icon;
  return (
    <Link href={role.href} className='entry-role-tile'>
      <Icon size={31} strokeWidth={2.25} />
      <strong>{role.title}</strong>
      <span>{role.text}</span>
      <em>{role.cta}</em>
    </Link>
  );
}

function TrustTile({ item }: { item: TrustItem }) {
  const Icon = item.Icon;
  return <article className='entry-trust-item'><Icon size={27} strokeWidth={2.25} /><strong>{item.title}</strong><span>{item.text}</span></article>;
}

const entryCss = `
.pc-v7-public-entry {
  min-height: 100vh;
  overflow-x: hidden;
  color: #071611;
  background:
    radial-gradient(circle at 84% 12%, rgba(0, 122, 47, .10), transparent 31%),
    linear-gradient(180deg, #fbfcf9 0%, #f3f7f1 52%, #ffffff 100%);
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
  gap: 28px;
  min-height: 74px;
  padding: 14px clamp(18px, 4vw, 58px);
  background: rgba(255, 255, 255, .88);
  border-bottom: 1px solid rgba(6, 26, 22, .08);
  backdrop-filter: blur(16px);
}

.entry-brand { display: inline-flex; align-items: center; gap: 12px; min-width: 0; }
.entry-brand-mark {
  display: inline-grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 15px;
  color: #007a2f;
  background: linear-gradient(145deg, rgba(0, 122, 47, .11), rgba(0, 122, 47, .02));
}
.entry-brand strong { display: block; font-size: 18px; line-height: 1.05; letter-spacing: -.03em; }
.entry-brand small { display: block; margin-top: 3px; color: #66736e; font-size: 12px; font-weight: 650; }

.entry-desktop-nav { display: flex; justify-content: center; gap: 26px; color: #17251f; font-size: 14px; font-weight: 700; }
.entry-desktop-nav a { opacity: .82; transition: opacity .15s ease, color .15s ease; }
.entry-desktop-nav a:hover { color: #007a2f; opacity: 1; }

.entry-header-actions { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
.entry-login, .entry-demo, .entry-icon-button {
  min-height: 44px;
  border-radius: 15px;
  border: 1px solid rgba(7, 22, 17, .1);
  background: rgba(255, 255, 255, .8);
  color: #062017;
  font-size: 14px;
  font-weight: 800;
}
.entry-login { display: inline-flex; align-items: center; gap: 8px; padding: 0 16px; color: #007a2f; }
.entry-demo { display: inline-flex; align-items: center; padding: 0 18px; background: #007a2f; color: #fff; border-color: #007a2f; }
.entry-icon-button { display: inline-grid; place-items: center; width: 44px; cursor: pointer; }
.entry-icon-button:hover { border-color: rgba(0, 122, 47, .35); color: #007a2f; }
.entry-menu { position: relative; display: none; }
.entry-menu > summary { list-style: none; }
.entry-menu > summary::-webkit-details-marker { display: none; }
.entry-menu-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 10px);
  z-index: 30;
  display: grid;
  gap: 2px;
  min-width: 220px;
  padding: 8px;
  border-radius: 16px;
  border: 1px solid rgba(7, 22, 17, .1);
  background: rgba(255, 255, 255, .98);
  box-shadow: 0 18px 42px rgba(7, 22, 17, .14);
  backdrop-filter: blur(12px);
}
.entry-menu-panel a {
  padding: 11px 12px;
  border-radius: 11px;
  color: #17251f;
  font-size: 15px;
  font-weight: 800;
}
.entry-menu-panel a:hover { background: rgba(0, 122, 47, .08); color: #007a2f; }

.entry-hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, .9fr) minmax(420px, 1.1fr);
  align-items: stretch;
  gap: 20px;
  min-height: 520px;
  padding: clamp(28px, 5vw, 72px) clamp(18px, 4vw, 58px) 34px;
  overflow: hidden;
}
.entry-hero::before {
  content: '';
  position: absolute;
  inset: auto -10vw -70px 36vw;
  height: 360px;
  background:
    linear-gradient(90deg, rgba(255,255,255,.97) 0%, rgba(255,255,255,.68) 33%, rgba(255,255,255,.15) 100%),
    repeating-linear-gradient(112deg, rgba(191, 148, 55, .24) 0 3px, transparent 3px 16px),
    linear-gradient(180deg, rgba(218, 177, 72, .28), rgba(255,255,255,0));
  filter: blur(.2px);
  opacity: .92;
  pointer-events: none;
}

.entry-hero-copy { position: relative; z-index: 2; align-self: center; max-width: 680px; }
.entry-kicker {
  display: inline-flex;
  width: fit-content;
  margin-bottom: 18px;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(0, 122, 47, .08);
  color: #007a2f;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: .035em;
  text-transform: uppercase;
}
.entry-hero h1 {
  margin: 0;
  max-width: 760px;
  font-size: clamp(44px, 5.7vw, 86px);
  line-height: .97;
  letter-spacing: -.065em;
  font-weight: 950;
}
.entry-hero p {
  margin: 22px 0 0;
  max-width: 575px;
  color: #3e4a45;
  font-size: clamp(18px, 1.55vw, 23px);
  line-height: 1.42;
  font-weight: 560;
}
.entry-hero-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 30px; }
.entry-primary-cta, .entry-secondary-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 56px;
  border-radius: 17px;
  padding: 0 22px;
  font-size: 16px;
  font-weight: 900;
}
.entry-primary-cta { gap: 10px; min-width: 244px; color: #fff; background: #007a2f; box-shadow: 0 18px 38px rgba(0, 122, 47, .22); }
.entry-secondary-cta { min-width: 170px; color: #007a2f; background: rgba(255,255,255,.68); border: 1px solid rgba(0, 122, 47, .26); }
.entry-text-cta { color: #007a2f; font-size: 15px; font-weight: 850; }
.entry-status-note {
  margin-top: 18px;
  max-width: 620px;
  padding: 12px 14px;
  border: 1px solid rgba(7, 22, 17, .08);
  border-radius: 16px;
  background: rgba(255,255,255,.68);
  color: #66736e;
  font-size: 12.5px;
  line-height: 1.45;
  font-weight: 650;
}

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
.entry-hero-visual::before {
  content: '';
  position: absolute;
  right: 8%;
  bottom: 22%;
  width: 66%;
  height: 46%;
  background:
    linear-gradient(90deg, transparent 0 12%, rgba(70, 82, 78, .34) 12% 14%, transparent 14% 28%, rgba(70, 82, 78, .34) 28% 30%, transparent 30% 44%, rgba(70, 82, 78, .34) 44% 46%, transparent 46%),
    linear-gradient(180deg, rgba(42, 55, 50, .24), rgba(255,255,255,.08));
  border-radius: 34px 34px 10px 10px;
  box-shadow: 0 -58px 0 -32px rgba(58, 76, 70, .28), -130px 20px 0 -14px rgba(58, 76, 70, .22);
}
.entry-hero-visual::after {
  content: '';
  position: absolute;
  right: 9%;
  bottom: 16%;
  width: 245px;
  height: 78px;
  border-radius: 22px 10px 10px 16px;
  background: linear-gradient(90deg, #f8faf7 0 58%, #dfe7dc 58% 100%);
  box-shadow: 0 18px 42px rgba(7, 22, 17, .18), 24px 63px 0 -31px #1b241f, 164px 63px 0 -31px #1b241f;
}
.entry-route-line {
  position: absolute;
  left: 10%;
  right: 12%;
  top: 43%;
  height: 7px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(0,122,47,.1), rgba(0,122,47,.75), rgba(0,122,47,.18));
  box-shadow: 0 0 0 9px rgba(255,255,255,.38);
  transform: rotate(-9deg);
}
.entry-floating-card {
  position: absolute;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 5px 10px;
  align-items: center;
  min-width: 165px;
  padding: 12px 14px;
  border-radius: 18px;
  border: 1px solid rgba(7,22,17,.08);
  background: rgba(255,255,255,.82);
  color: #007a2f;
  box-shadow: 0 16px 36px rgba(7, 22, 17, .11);
  backdrop-filter: blur(10px);
}
.entry-floating-card span { color: #223029; font-size: 13px; font-weight: 900; }
.entry-floating-card b { grid-column: 2; color: #7c8580; font-size: 11px; font-weight: 750; }
.entry-floating-card.docs { left: 7%; top: 18%; }
.entry-floating-card.quality { right: 10%; top: 20%; }
.entry-floating-card.money { left: 43%; bottom: 14%; }

.entry-section { padding: 28px clamp(18px, 4vw, 58px); }
.entry-section-head { display: flex; align-items: end; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
.entry-section-head.compact { justify-content: center; text-align: center; display: grid; }
.entry-section h2 { margin: 0; color: #071611; font-size: clamp(25px, 2.6vw, 40px); line-height: 1.05; letter-spacing: -.045em; font-weight: 950; }
.entry-section-head p { margin: 0; max-width: 570px; color: #66736e; font-size: 15px; line-height: 1.45; font-weight: 650; }
.entry-control-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.entry-control-tile, .entry-role-tile, .entry-process-tile, .entry-trust-item {
  border: 1px solid rgba(7, 22, 17, .075);
  background: rgba(255,255,255,.78);
  box-shadow: 0 14px 34px rgba(7, 22, 17, .06);
}
.entry-control-tile {
  min-height: 184px;
  padding: 22px;
  border-radius: 24px;
  display: grid;
  align-content: start;
  gap: 13px;
  color: #007a2f;
}
.entry-control-tile strong { color: #071611; font-size: 20px; font-weight: 950; letter-spacing: -.035em; }
.entry-control-tile span { color: #59665f; font-size: 14px; line-height: 1.42; font-weight: 650; }

.entry-process-section { padding-top: 18px; }
.entry-process-row { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 10px; }
.entry-process-tile {
  position: relative;
  min-height: 144px;
  padding: 16px 12px;
  border-radius: 22px;
  text-align: center;
  display: grid;
  justify-items: center;
  align-content: start;
  gap: 8px;
}
.entry-process-tile:not(:last-child)::after {
  content: '→';
  position: absolute;
  right: -10px;
  top: 39px;
  color: #007a2f;
  font-weight: 900;
  z-index: 1;
}
.entry-process-index { color: #9aa49f; font-size: 11px; font-weight: 900; }
.entry-process-icon { display: grid; place-items: center; width: 46px; height: 46px; border-radius: 16px; color: #007a2f; background: rgba(0,122,47,.08); }
.entry-process-tile strong { font-size: 14px; font-weight: 950; letter-spacing: -.025em; }
.entry-process-tile small { color: #6b746f; font-size: 11.5px; line-height: 1.27; font-weight: 650; }

.entry-role-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.entry-role-tile {
  min-height: 178px;
  padding: 18px;
  border-radius: 24px;
  display: grid;
  align-content: start;
  gap: 10px;
  color: #007a2f;
  transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease;
}
.entry-role-tile:hover { transform: translateY(-2px); border-color: rgba(0,122,47,.24); box-shadow: 0 18px 42px rgba(0,122,47,.11); }
.entry-role-tile strong { color: #071611; font-size: 18px; font-weight: 950; letter-spacing: -.035em; }
.entry-role-tile span { color: #5d6862; font-size: 13px; line-height: 1.38; font-weight: 640; }
.entry-role-tile em { margin-top: auto; color: #007a2f; font-size: 12.5px; font-style: normal; font-weight: 900; }

.entry-trust-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr)) auto;
  gap: 0;
  align-items: stretch;
  margin: 24px clamp(18px, 4vw, 58px) 46px;
  border: 1px solid rgba(0, 122, 47, .13);
  border-radius: 28px;
  overflow: hidden;
  background: rgba(246, 250, 245, .92);
  box-shadow: 0 18px 44px rgba(7, 22, 17, .07);
}
.entry-trust-item { display: grid; grid-template-columns: auto 1fr; gap: 5px 12px; padding: 22px; border: 0; border-right: 1px solid rgba(7, 22, 17, .08); background: transparent; color: #007a2f; box-shadow: none; }
.entry-trust-item strong { color: #173027; font-size: 15px; font-weight: 950; letter-spacing: -.025em; }
.entry-trust-item span { grid-column: 2; color: #66736e; font-size: 12.5px; line-height: 1.35; font-weight: 650; }
.entry-trust-cta { align-self: stretch; display: inline-flex; align-items: center; justify-content: center; min-width: 220px; padding: 0 24px; background: #007a2f; color: #fff; font-size: 15px; font-weight: 950; }

@media (max-width: 980px) {
  .entry-header { grid-template-columns: 1fr auto; min-height: 68px; padding: 12px 16px; gap: 12px; }
  .entry-desktop-nav, .entry-demo { display: none; }
  .entry-menu { display: inline-block; }
  .entry-login { padding: 0 12px; }
  .entry-login svg { display: none; }

  .entry-hero { grid-template-columns: 1fr; min-height: 0; padding: 28px 16px 18px; gap: 18px; }
  .entry-hero::before { inset: auto -20vw 6px 0; height: 250px; opacity: .62; }
  .entry-hero-copy { max-width: none; }
  .entry-kicker { margin-bottom: 12px; font-size: 10px; }
  .entry-hero h1 { font-size: clamp(40px, 12vw, 58px); max-width: 430px; }
  .entry-hero p { margin-top: 16px; font-size: 18px; line-height: 1.38; }
  .entry-hero-actions { display: grid; gap: 10px; margin-top: 22px; }
  .entry-primary-cta, .entry-secondary-cta { width: 100%; min-height: 56px; }
  .entry-text-cta { justify-self: center; min-height: 40px; display: inline-flex; align-items: center; }
  .entry-status-note { font-size: 11.8px; }
  .entry-hero-visual { min-height: 255px; border-radius: 28px; }
  .entry-floating-card { min-width: 134px; padding: 10px 11px; border-radius: 15px; }
  .entry-floating-card span { font-size: 12px; }
  .entry-floating-card b { font-size: 10px; }
  .entry-floating-card.docs { left: 5%; top: 15%; }
  .entry-floating-card.quality { right: 4%; top: 22%; }
  .entry-floating-card.money { left: 31%; bottom: 10%; }

  .entry-section { padding: 20px 16px; }
  .entry-section-head, .entry-section-head.compact { display: grid; align-items: start; justify-content: stretch; text-align: left; gap: 8px; margin-bottom: 14px; }
  .entry-section h2 { font-size: 27px; }
  .entry-section-head p { font-size: 13.5px; }
  .entry-control-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .entry-control-tile { min-height: 156px; padding: 16px; border-radius: 20px; }
  .entry-control-tile strong { font-size: 17px; }
  .entry-control-tile span { font-size: 12.5px; }

  .entry-process-row { display: grid; grid-template-columns: 1fr; gap: 12px; overflow: visible; padding-bottom: 0; scroll-snap-type: none; }
  .entry-process-tile { min-width: 0; width: 100%; min-height: auto; grid-template-columns: auto auto minmax(0, 1fr); justify-items: start; align-items: center; text-align: left; padding: 16px; }
  .entry-process-tile:not(:last-child)::after { display: none; }
  .entry-process-index { grid-column: 1; }
  .entry-process-icon { grid-column: 2; }
  .entry-process-tile strong { grid-column: 3; font-size: 16px; }
  .entry-process-tile small { grid-column: 3; font-size: 12.5px; }

  .entry-role-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .entry-role-tile { min-height: 164px; padding: 15px; border-radius: 20px; }
  .entry-role-tile strong { font-size: 16px; }
  .entry-role-tile span { font-size: 12.2px; }
  .entry-role-tile em { font-size: 11.5px; }

  .entry-trust-strip { grid-template-columns: 1fr; margin: 18px 16px 34px; border-radius: 24px; }
  .entry-trust-item { border-right: 0; border-bottom: 1px solid rgba(7,22,17,.08); padding: 17px; }
  .entry-trust-cta { min-height: 58px; min-width: 0; }
}

@media (max-width: 420px) {
  .entry-brand strong { font-size: 16px; }
  .entry-brand small { font-size: 11px; }
  .entry-brand-mark { width: 38px; height: 38px; }
  .entry-icon-button { width: 42px; min-height: 42px; }
  .entry-control-grid { grid-template-columns: 1fr; }
  .entry-role-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (prefers-reduced-motion: reduce) {
  .pc-v7-public-entry *, .pc-v7-public-entry *::before, .pc-v7-public-entry *::after {
    transition-duration: .001ms !important;
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
  }
}
`;
