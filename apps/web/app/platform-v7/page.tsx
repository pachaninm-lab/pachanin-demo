import Link from 'next/link';

type Role = {
  readonly title: string;
  readonly text: string;
  readonly href: string;
  readonly icon: IconName;
};

type IconName =
  | 'leaf'
  | 'cart'
  | 'truck'
  | 'wheel'
  | 'bank'
  | 'shield'
  | 'operator'
  | 'user'
  | 'warehouse'
  | 'lab'
  | 'scale'
  | 'doc'
  | 'money'
  | 'lock'
  | 'box'
  | 'request'
  | 'home'
  | 'folder'
  | 'bell'
  | 'chat'
  | 'handshake'
  | 'grain'
  | 'puzzle';

const mobileRoles: readonly Role[] = [
  { title: 'Продавец', text: 'Размещайте зерно и управляйте сделками', href: '/platform-v7/seller', icon: 'leaf' },
  { title: 'Покупатель', text: 'Находите зерно и заключайте сделки', href: '/platform-v7/buyer', icon: 'cart' },
  { title: 'Логистика', text: 'Организуйте перевозки и маршруты', href: '/platform-v7/logistics', icon: 'truck' },
  { title: 'Водитель', text: 'Выполняйте рейсы и загрузки', href: '/platform-v7/driver/field', icon: 'wheel' },
  { title: 'Банк', text: 'Финансируйте сделки без рисков', href: '/platform-v7/bank', icon: 'bank' },
  { title: 'Сюрвейер', text: 'Проводите осмотры и экспертизы', href: '/platform-v7/surveyor', icon: 'shield' },
  { title: 'Оператор', text: 'Сопровождайте сделки и участников', href: '/platform-v7/support/operator', icon: 'operator' },
  { title: 'Руководитель', text: 'Контролируйте процессы и аналитику', href: '/platform-v7/executive', icon: 'user' },
];

const extraRoles: readonly Role[] = [
  { title: 'Элеватор', text: 'Приёмка, вес и отгрузка', href: '/platform-v7/elevator', icon: 'warehouse' },
  { title: 'Лаборатория', text: 'Анализы и качество', href: '/platform-v7/lab', icon: 'lab' },
  { title: 'Комплаенс', text: 'Допуск и риски', href: '/platform-v7/compliance', icon: 'lock' },
  { title: 'Арбитр', text: 'Споры и доказательства', href: '/platform-v7/arbitrator', icon: 'scale' },
];

const processSteps = [
  { label: 'Условия сделки', icon: 'handshake' },
  { label: 'Документы', icon: 'doc' },
  { label: 'Рейс', icon: 'truck' },
  { label: 'Приёмка', icon: 'warehouse' },
  { label: 'Качество', icon: 'grain' },
  { label: 'Основание для банка', icon: 'shield' },
  { label: 'Деньги', icon: 'money' },
  { label: 'Спор / Закрытие', icon: 'scale' },
] as const;

const bottomTabs = [
  { label: 'Главная', href: '/platform-v7', icon: 'home', active: true },
  { label: 'Сделки', href: '/platform-v7/deals', icon: 'folder', active: false },
  { label: 'Уведомления', href: '/platform-v7/notifications', icon: 'bell', active: false },
  { label: 'Чаты', href: '/platform-v7/support', icon: 'chat', active: false },
  { label: 'Профиль', href: '/platform-v7/profile', icon: 'user', active: false },
] as const;

export default function PlatformV7RootPage() {
  return (
    <main data-testid='platform-v7-root-execution-cockpit' className='pc-v7-entry-page'>
      <style>{entryCss}</style>

      <div aria-hidden='true' className='entry-desktop-bg' />
      <div aria-hidden='true' className='entry-mobile-bg entry-mobile-field' />
      <div aria-hidden='true' className='entry-mobile-bg entry-mobile-elevator' />
      <div aria-hidden='true' className='entry-mobile-bg entry-mobile-route' />
      <div aria-hidden='true' className='entry-mobile-bg entry-mobile-truck' />
      <div aria-hidden='true' className='entry-soft' />

      <header className='entry-desktop-header'>
        <Link href='/platform-v7' className='entry-desktop-brand' aria-label='Прозрачная Цена'>
          <BrandMark />
          <span><strong>Прозрачная Цена</strong><small>Цифровой контур исполнения зерновой сделки</small></span>
        </Link>
        <nav aria-label='Разделы платформы'>
          <Link href='/platform-v7/about'>О платформе</Link>
          <Link href='/platform-v7/roles'>Роли</Link>
          <Link href='/platform-v7/security'>Безопасность</Link>
          <Link href='/platform-v7/connectors'>Интеграции</Link>
          <Link href='/platform-v7/support'>Поддержка</Link>
        </nav>
        <div className='entry-desktop-login'><span>RU⌄</span><Link href='/platform-v7/login'>Войти в систему</Link></div>
      </header>

      <section className='entry-hero' aria-label='Первый экран'>
        <div className='entry-copy'>
          <header className='entry-mobile-brand-row'>
            <Link href='/platform-v7' className='entry-mobile-brand' aria-label='Прозрачная Цена'>
              <BrandMark />
              <strong>Прозрачная Цена</strong>
            </Link>
            <Link href='/platform-v7/notifications' className='entry-mobile-bell' aria-label='Уведомления'>
              <span />
              <Icon name='bell' />
            </Link>
          </header>

          <span className='entry-kicker'>Платформа исполнения зерновой сделки по ролям</span>
          <h1 className='entry-title'><span>Одна сделка.</span><span>Полный контроль.</span></h1>
          <p className='entry-lead'>Качество, логистика, документы и деньги — в одном прозрачном процессе.</p>

          <div className='entry-actions'>
            <Link href='/platform-v7/seller/batches/new' className='entry-primary-action'>
              <Icon name='doc' />
              <span>Создать сделку</span>
              <b aria-hidden='true'>→</b>
            </Link>
            <Link href='/platform-v7/lots/create' className='entry-secondary-action'><Icon name='box' />Выставить партию</Link>
            <Link href='/platform-v7/procurement' className='entry-secondary-action'><Icon name='request' />Создать запрос на закупку</Link>
          </div>

          <Link href='/platform-v7/execution-map' className='entry-how'><span>▷</span>Как это работает</Link>
          <p className='entry-note'>После входа каждый участник получает доступ только к своему личному кабинету и рабочим действиям своей роли.</p>
        </div>

        <aside className='entry-process' aria-label='Единый процесс исполнения'>
          <strong>Единый управляемый процесс исполнения</strong>
          <div className='entry-process-row'>
            {processSteps.map((step, index) => (
              <div key={step.label} className='entry-process-step'>
                <span className='entry-process-icon'><Icon name={step.icon} /></span>
                <span className='entry-process-number'>{index + 1}</span>
                <span className='entry-process-label'>{step.label}</span>
              </div>
            ))}
          </div>
          <div className='entry-process-proof'>
            <span><Icon name='shield' />Прозрачность и контроль в реальном времени</span>
            <span><Icon name='doc' />Доказательная база на каждом этапе</span>
            <span><Icon name='lock' />Доступ по ролям и полномочиям</span>
          </div>
        </aside>
      </section>

      <section className='entry-roles' aria-label='Выберите свою роль'>
        <h2>Выберите свою роль</h2>

        <div className='entry-desktop-role-groups'>
          <RoleGroup title='Основные участники' icon='user' roles={mobileRoles.slice(0, 2)} />
          <RoleGroup title='Исполнение' icon='truck' roles={[mobileRoles[2], mobileRoles[3], extraRoles[0], extraRoles[1], mobileRoles[5]]} />
          <RoleGroup title='Контроль и управление' icon='shield' roles={[mobileRoles[4], mobileRoles[6], mobileRoles[7]]} />
        </div>

        <div className='entry-mobile-role-grid'>
          {mobileRoles.map((role) => <RoleCard key={role.href} role={role} />)}
        </div>

        <details className='entry-more-roles'>
          <summary>Ещё роли</summary>
          <div>
            {extraRoles.map((role) => <RoleCard key={role.href} role={role} small />)}
          </div>
        </details>
      </section>

      <section className='entry-trust' aria-label='Прозрачность'>
        <span className='entry-trust-shield'><Icon name='shield' /></span>
        <span className='entry-trust-copy'><strong>Прозрачность на каждом этапе</strong><small>Все участники видят актуальные данные и статус сделки в реальном времени.</small></span>
        <span className='entry-trust-chart' aria-hidden='true'><i /><i /><i /></span>
      </section>

      <section className='entry-desktop-trust-strip' aria-label='Доверие и контроль'>
        <div><Icon name='lock' /><strong>Ролевая изоляция</strong><span>Доступ только к своим данным и операциям</span></div>
        <div><Icon name='doc' /><strong>Журнал действий</strong><span>События фиксируются и не теряются</span></div>
        <div><Icon name='shield' /><strong>Доказательная база</strong><span>Файлы, документы, подписи, отметки о времени</span></div>
        <div><Icon name='puzzle' /><strong>Готовность к интеграциям</strong><span>ФГИС, ЭДО, ЭПД, банк</span></div>
        <div><Icon name='shield' /><strong>Надёжность и безопасность</strong><span>Контролируемый предпилотный контур</span></div>
      </section>

      <section className='entry-desktop-integration-note'>
        <span>Внешние контуры подключаются по договорам и доступам. Текущий контур готов к подключению внешних систем.</span>
        <Link href='/platform-v7/connectors'>Подробнее об интеграциях →</Link>
      </section>

      <nav className='entry-bottom-tabs' aria-label='Мобильная навигация'>
        {bottomTabs.map((tab) => (
          <Link key={tab.label} href={tab.href} className={tab.active ? 'active' : undefined}>
            <Icon name={tab.icon} />
            <small>{tab.label}</small>
          </Link>
        ))}
      </nav>
    </main>
  );
}

function BrandMark() {
  return <span className='entry-brand-mark'><span>П</span><i /></span>;
}

function RoleGroup({ title, icon, roles }: { readonly title: string; readonly icon: IconName; readonly roles: readonly Role[] }) {
  return <div className='entry-role-group'><h3><Icon name={icon} />{title}</h3><div>{roles.map((role) => <RoleCard key={role.href} role={role} desktop />)}</div></div>;
}

function RoleCard({ role, desktop = false, small = false }: { readonly role: Role; readonly desktop?: boolean; readonly small?: boolean }) {
  return (
    <Link href={role.href} className={desktop ? 'entry-role-card desktop' : small ? 'entry-role-card small' : 'entry-role-card'}>
      <Icon name={role.icon} />
      <strong>{role.title}</strong>
      <span>{role.text}</span>
      {desktop ? <i aria-hidden='true'>→</i> : null}
    </Link>
  );
}

function Icon({ name }: { readonly name: IconName | string }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (name === 'leaf') return <svg viewBox='0 0 40 40'><path d='M31 9C18 10 9 18 9 31c13-1 22-9 22-22Z' {...p} strokeWidth='2.8' /><path d='M12 28 28 12' {...p} strokeWidth='2.6' /></svg>;
  if (name === 'cart') return <svg viewBox='0 0 40 40'><path d='M10 12h4l3 15h13l3-10H16' {...p} strokeWidth='2.8' /><circle cx='19' cy='32' r='2' fill='currentColor' /><circle cx='30' cy='32' r='2' fill='currentColor' /></svg>;
  if (name === 'truck') return <svg viewBox='0 0 40 40'><path d='M8 14h17v14H8Z' {...p} strokeWidth='2.8' /><path d='M25 18h5l4 5v5h-9Z' {...p} strokeWidth='2.8' /><circle cx='15' cy='31' r='2' fill='currentColor' /><circle cx='30' cy='31' r='2' fill='currentColor' /></svg>;
  if (name === 'wheel') return <svg viewBox='0 0 40 40'><circle cx='20' cy='20' r='14' {...p} strokeWidth='2.8' /><circle cx='20' cy='20' r='4' {...p} strokeWidth='2.8' /><path d='M9 20h9m4 0h9M20 9v7m0 8v7' {...p} strokeWidth='2.5' /></svg>;
  if (name === 'bank') return <svg viewBox='0 0 40 40'><path d='M7 17 20 9l13 8Z' {...p} strokeWidth='2.8' /><path d='M10 18v12m7-12v12m7-12v12m7-12v12M7 31h26' {...p} strokeWidth='2.6' /></svg>;
  if (name === 'operator') return <svg viewBox='0 0 40 40'><path d='M10 24v-5a10 10 0 0 1 20 0v5' {...p} strokeWidth='2.8' /><path d='M10 24h5v8h-5Zm15 0h5v8h-5Z' {...p} strokeWidth='2.8' /></svg>;
  if (name === 'user') return <svg viewBox='0 0 40 40'><circle cx='20' cy='13' r='5' {...p} strokeWidth='2.8' /><path d='M10 32c2-7 18-7 20 0' {...p} strokeWidth='2.8' /></svg>;
  if (name === 'shield') return <svg viewBox='0 0 40 40'><path d='M20 7 31 12v8c0 8-5 12-11 14-6-2-11-6-11-14v-8Z' {...p} strokeWidth='2.8' /><path d='m14 20 4 4 8-9' {...p} strokeWidth='2.8' /></svg>;
  if (name === 'warehouse') return <svg viewBox='0 0 40 40'><path d='M7 19 20 10l13 9v14H7Z' {...p} strokeWidth='2.6' /><path d='M13 33V22h14v11M13 26h14' {...p} strokeWidth='2.4' /></svg>;
  if (name === 'lab') return <svg viewBox='0 0 40 40'><path d='M16 8h8M18 8v10L10 32h20l-8-14V8' {...p} strokeWidth='2.6' /></svg>;
  if (name === 'scale') return <svg viewBox='0 0 40 40'><path d='M20 8v24M10 13h20M13 13 8 25h10Zm14 0-5 12h10Z' {...p} strokeWidth='2.5' /></svg>;
  if (name === 'grain') return <svg viewBox='0 0 40 40'><path d='M20 34V8M14 13c0-5 6-6 6-6s6 1 6 6M14 20c0-5 6-6 6-6s6 1 6 6M14 27c0-5 6-6 6-6s6 1 6 6' {...p} strokeWidth='2.4' /></svg>;
  if (name === 'doc' || name === 'request') return <svg viewBox='0 0 24 24'><path d='M7 3h7l4 4v14H7Z' {...p} /><path d='M14 3v5h5M9 13h6M9 17h5' {...p} /></svg>;
  if (name === 'money') return <svg viewBox='0 0 24 24'><path d='M4 7h16v10H4Z' {...p} /><circle cx='12' cy='12' r='2.4' {...p} /></svg>;
  if (name === 'lock') return <svg viewBox='0 0 24 24'><path d='M6 10h12v10H6Zm3 0V7a3 3 0 0 1 6 0v3' {...p} /></svg>;
  if (name === 'box') return <svg viewBox='0 0 24 24'><path d='M4 8 12 4l8 4v9l-8 4-8-4Z' {...p} /><path d='m4 8 8 4 8-4M12 12v9' {...p} /></svg>;
  if (name === 'handshake') return <svg viewBox='0 0 24 24'><path d='m8 12 3 3c1 1 2 1 3 0l4-4M3 12l4-4 4 4M21 12l-4-4-4 4' {...p} /></svg>;
  if (name === 'puzzle') return <svg viewBox='0 0 24 24'><path d='M9 3h6v5h3v6h-5v3H7v-5H3V6h6Z' {...p} /></svg>;
  if (name === 'home') return <svg viewBox='0 0 24 24'><path d='m4 11 8-7 8 7v9H6v-6h12' {...p} /></svg>;
  if (name === 'folder') return <svg viewBox='0 0 24 24'><path d='M3 7h7l2 3h9v9H3Z' {...p} /></svg>;
  if (name === 'bell') return <svg viewBox='0 0 24 24'><path d='M6 17h12l-2-3V9a4 4 0 0 0-8 0v5Zm4 3h4' {...p} /></svg>;
  if (name === 'chat') return <svg viewBox='0 0 24 24'><path d='M5 6h14v10H9l-4 4Z' {...p} /></svg>;
  return <svg viewBox='0 0 24 24'><circle cx='12' cy='12' r='8' {...p} /></svg>;
}

const entryCss = `
.pc-shell-root-v4:has(.pc-v7-entry-page) .pc-v4-header,
.pc-shell-root-v4:has(.pc-v7-entry-page) .pc-v4-bottomnav,
.pc-shell-root-v4:has(.pc-v7-entry-page) .pc-v4-pilot-note,
.pc-shell-root-v4:has(.pc-v7-entry-page) .pc-v4-meta { display: none !important; }
.pc-shell-root-v4:has(.pc-v7-entry-page) .pc-v4-main { max-width: none !important; margin: 0 !important; padding: 0 !important; }
.pc-shell-root-v4:has(.pc-v7-entry-page) { background: #fff !important; }
.pc-v7-entry-page{--green:#008B2E;--deep:#061A16;--muted:#5E6875;--border:rgba(15,23,42,.075);position:relative;overflow:hidden;min-height:100dvh;padding:28px 42px 42px;background:radial-gradient(circle at 72% 12%,rgba(226,171,89,.24),transparent 33%),linear-gradient(180deg,#FFFCF6,#fff 56%,#FEFCF7);color:var(--deep)}
.pc-v7-entry-page svg{display:block}.entry-desktop-bg{position:absolute;inset:0;pointer-events:none;opacity:.72;background:linear-gradient(90deg,rgba(255,255,255,.99),rgba(255,255,255,.92) 34%,rgba(255,246,225,.48) 58%,rgba(255,255,255,.97)),repeating-linear-gradient(102deg,rgba(204,144,45,.24) 0 18px,rgba(231,190,92,.18) 18px 36px,rgba(255,255,255,.22) 36px 54px)}.entry-desktop-bg:after{content:'';position:absolute;right:3vw;top:96px;width:min(52vw,720px);height:250px;opacity:.28;background:linear-gradient(180deg,rgba(55,64,55,.70),rgba(87,104,86,.26));clip-path:polygon(0 82%,4% 45%,11% 45%,11% 26%,21% 26%,21% 45%,28% 45%,28% 82%,34% 82%,37% 45%,44% 45%,44% 20%,56% 20%,56% 45%,63% 45%,66% 82%,72% 82%,75% 45%,82% 45%,82% 25%,92% 25%,92% 45%,98% 45%,100% 82%)}
.entry-desktop-header,.entry-hero,.entry-roles,.entry-trust,.entry-desktop-trust-strip,.entry-desktop-integration-note,.entry-bottom-tabs{position:relative;z-index:1}.entry-desktop-header{max-width:1600px;margin:0 auto 38px;display:flex;align-items:flex-start;justify-content:space-between;gap:28px}.entry-desktop-brand{display:flex;gap:14px;text-decoration:none;color:#102033}.entry-desktop-brand strong{display:block;font-size:28px;line-height:1;font-weight:950}.entry-desktop-brand small{display:block;margin-top:8px;max-width:260px;color:#364557;font-size:16px;line-height:1.25;font-weight:560}.entry-desktop-header nav{display:flex;gap:48px;align-items:center;padding-top:16px}.entry-desktop-header nav a{color:#102033;text-decoration:none;font-size:16px;font-weight:650}.entry-desktop-login{display:flex;align-items:center;gap:22px;padding-top:8px}.entry-desktop-login span{font-size:16px;font-weight:700}.entry-desktop-login a{min-height:50px;padding:0 22px;border-radius:10px;border:1px solid rgba(10,122,67,.55);display:inline-flex;align-items:center;color:#0A7A43;text-decoration:none;font-size:16px;font-weight:820;background:rgba(255,255,255,.68)}
.entry-brand-mark{width:64px;height:64px;border-radius:15px;background:linear-gradient(145deg,#08231D,#174A3D 55%,#ECFFF1);box-shadow:0 12px 24px rgba(0,139,46,.20);display:inline-flex;align-items:center;justify-content:center;position:relative;overflow:hidden;flex:0 0 auto}.entry-brand-mark span{color:#fff;font-size:38px;line-height:1;font-weight:950;letter-spacing:-.08em}.entry-brand-mark i{position:absolute;left:13px;right:10px;bottom:13px;height:22px;border-left:2px solid rgba(255,255,255,.72);border-bottom:2px solid rgba(255,255,255,.72);background:linear-gradient(135deg,transparent 45%,#00A83B 46% 55%,transparent 56%)}
.entry-hero{max-width:1600px;margin:0 auto;display:grid;grid-template-columns:minmax(420px,.72fr) minmax(620px,1fr);gap:90px;align-items:center;min-height:520px}.entry-copy{display:grid;gap:20px}.entry-mobile-brand-row{display:none}.entry-kicker{width:max-content;max-width:100%;min-height:34px;padding:0 17px;border-radius:999px;border:1px solid rgba(33,70,49,.16);background:rgba(255,255,255,.72);color:#285E44;display:inline-flex;align-items:center;font-size:14px;font-weight:740}.entry-title{margin:0;display:grid;color:#102033;font-family:Georgia,'Times New Roman',serif;font-size:clamp(62px,5.5vw,92px);line-height:.92;letter-spacing:-.055em;font-weight:700}.entry-title span:last-child{color:#0A7A43}.entry-lead{margin:0;max-width:610px;color:#4F5D6E;font-size:clamp(18px,1.35vw,23px);line-height:1.55;font-weight:560}.entry-actions{display:grid;grid-template-columns:minmax(300px,390px) repeat(2,minmax(190px,230px));gap:14px;align-items:center}.entry-primary-action,.entry-secondary-action{min-height:58px;border-radius:12px;display:inline-flex;align-items:center;gap:12px;text-decoration:none;font-size:16px;font-weight:850}.entry-primary-action{justify-content:flex-start;padding:0 18px;color:#fff;background:linear-gradient(180deg,#0EA550,#087D3D);box-shadow:0 16px 32px rgba(10,122,67,.22)}.entry-primary-action svg,.entry-secondary-action svg{width:22px;height:22px}.entry-primary-action b{margin-left:auto;font-size:26px}.entry-secondary-action{justify-content:center;padding:0 16px;color:#102033;background:rgba(255,255,255,.84);border:1px solid rgba(25,54,39,.13);box-shadow:0 12px 22px rgba(75,55,18,.055)}.entry-how{width:max-content;display:inline-flex;align-items:center;gap:11px;color:#26384B;text-decoration:none;font-size:15px;font-weight:760}.entry-how span{width:28px;height:28px;border-radius:999px;border:1px solid rgba(25,54,39,.13);display:inline-flex;align-items:center;justify-content:center;color:#0A7A43}.entry-note{margin:0;max-width:620px;color:#607083;font-size:13px;line-height:1.48}.entry-note:before{content:'🔒';margin-right:8px}
.entry-process{min-height:390px;padding:34px;border-radius:34px;border:1px solid rgba(255,255,255,.72);background:rgba(255,246,228,.62);backdrop-filter:blur(18px);box-shadow:0 24px 70px rgba(72,48,12,.13);display:grid;gap:26px;align-content:center}.entry-process>strong{text-align:center;color:#0A7A43;font-size:18px;font-weight:860}.entry-process-row{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:12px}.entry-process-step{display:grid;justify-items:center;gap:10px;text-align:center;position:relative}.entry-process-step:not(:last-child):after{content:'';position:absolute;top:39px;left:calc(50% + 38px);width:calc(100% - 30px);border-top:1px solid rgba(10,122,67,.34)}.entry-process-icon{width:72px;height:72px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;color:#0A7A43;background:rgba(255,255,255,.72);border:1px solid rgba(10,122,67,.15);box-shadow:0 12px 26px rgba(76,52,14,.10)}.entry-process-icon svg{width:31px;height:31px}.entry-process-number{width:27px;height:27px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;color:#6D5D45;background:rgba(255,255,255,.76);border:1px solid rgba(106,76,30,.16);font-size:12px;font-weight:850}.entry-process-label{min-height:42px;color:#332E27;font-size:13px;line-height:1.25;font-weight:650}.entry-process-proof{border-top:1px solid rgba(96,72,32,.14);padding-top:18px;display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.entry-process-proof span{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center;color:#334233;font-size:13px;line-height:1.35}.entry-process-proof svg{width:28px;height:28px;color:#0A7A43}
.entry-roles{max-width:1600px;margin:18px auto 0;display:grid;gap:20px}.entry-roles h2{margin:0;font-size:24px;line-height:1.2;font-weight:930;letter-spacing:-.03em}.entry-desktop-role-groups{display:grid;grid-template-columns:1fr 1.92fr 1.15fr;gap:18px}.entry-role-group{padding:16px;border-radius:16px;border:1px solid rgba(25,54,39,.13);background:rgba(255,255,255,.78);box-shadow:0 12px 30px rgba(75,55,18,.055);display:grid;gap:14px}.entry-role-group h3{margin:0;display:flex;align-items:center;gap:10px;color:#263327;font-size:15px;font-weight:890}.entry-role-group h3 svg{width:20px;height:20px;color:#0A7A43}.entry-role-group>div{display:grid;grid-template-columns:repeat(auto-fit,minmax(116px,1fr));gap:12px}.entry-role-card{min-width:0;min-height:138px;padding:18px 10px 12px;border-radius:12px;border:1px solid rgba(25,54,39,.12);background:rgba(255,255,255,.88);box-shadow:0 10px 22px rgba(75,55,18,.045);color:#0E1827;text-decoration:none;display:grid;justify-items:center;align-content:start;gap:8px;text-align:center;position:relative}.entry-role-card svg{width:36px;height:36px;color:#0A7A43}.entry-role-card strong{font-size:14px;line-height:1.15;font-weight:900}.entry-role-card span{color:#627181;font-size:11.5px;line-height:1.35}.entry-role-card i{position:absolute;right:12px;bottom:10px;color:#0A7A43;font-style:normal}.entry-mobile-role-grid,.entry-more-roles{display:none}.entry-trust{display:none}.entry-desktop-trust-strip{max-width:1600px;margin:18px auto 0;padding:18px 20px;border-radius:16px;border:1px solid rgba(25,54,39,.13);background:rgba(255,255,255,.80);box-shadow:0 12px 30px rgba(75,55,18,.052);display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px}.entry-desktop-trust-strip div{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;column-gap:12px;align-items:center}.entry-desktop-trust-strip svg{grid-row:1/span 2;width:36px;height:36px;color:#0A7A43}.entry-desktop-trust-strip strong{font-size:14px;font-weight:880}.entry-desktop-trust-strip span{color:#63707F;font-size:12px;line-height:1.35}.entry-desktop-integration-note{max-width:1600px;margin:18px auto 0;min-height:54px;padding:0 18px;border-radius:14px;border:1px solid rgba(197,135,44,.22);background:rgba(255,248,237,.78);display:flex;align-items:center;justify-content:space-between;gap:18px;color:#5E6170;font-size:14px}.entry-desktop-integration-note a{color:#0A7A43;text-decoration:none;font-weight:780;white-space:nowrap}.entry-bottom-tabs{display:none}
@media(max-width:980px){.pc-v7-entry-page{padding:0 18px calc(env(safe-area-inset-bottom) + 18px);display:flex;flex-direction:column;align-items:center;background:#fff;min-height:100dvh}.entry-desktop-header,.entry-desktop-bg,.entry-kicker,.entry-process,.entry-how,.entry-note,.entry-secondary-action,.entry-desktop-role-groups,.entry-desktop-trust-strip,.entry-desktop-integration-note{display:none}.entry-mobile-bg{display:block;position:absolute;pointer-events:none;opacity:.045;filter:blur(.45px);z-index:0}.entry-mobile-field{left:-60px;right:-60px;bottom:70px;height:220px;transform:rotate(-5deg);background:repeating-linear-gradient(105deg,rgba(0,139,46,.78) 0 18px,rgba(198,147,32,.55) 18px 36px)}.entry-mobile-elevator{right:12px;top:88px;width:126px;height:178px;background:rgba(15,23,42,.34);clip-path:polygon(18% 100%,18% 30%,30% 30%,30% 12%,70% 12%,70% 30%,82% 30%,82% 100%)}.entry-mobile-route{left:34px;right:24px;top:250px;height:124px;border-top:9px solid rgba(0,139,46,.65);border-right:9px solid rgba(0,139,46,.42);border-radius:0 72px 0 0;transform:rotate(-9deg)}.entry-mobile-truck{left:26px;bottom:132px;width:86px;height:42px;border-radius:12px;background:rgba(15,23,42,.26)}.entry-soft{display:block;position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.985),rgba(255,255,255,.95) 50%,rgba(250,253,250,.98));pointer-events:none}.entry-hero,.entry-roles,.entry-trust,.entry-bottom-tabs{width:min(100%,430px);margin-left:auto;margin-right:auto}.entry-hero{display:block;min-height:auto;padding-top:28px}.entry-copy{gap:18px}.entry-mobile-brand-row{display:flex;align-items:center;justify-content:space-between;gap:12px}.entry-mobile-brand{display:inline-flex;align-items:center;gap:12px;color:#061A16;text-decoration:none}.entry-mobile-brand .entry-brand-mark{width:46px;height:46px;border-radius:13px}.entry-mobile-brand .entry-brand-mark span{font-size:27px}.entry-mobile-brand .entry-brand-mark i{left:10px;right:8px;bottom:10px;height:18px}.entry-mobile-brand strong{font-size:22px;line-height:1.04;font-weight:950;letter-spacing:-.045em}.entry-mobile-bell{width:42px;height:42px;border-radius:16px;display:inline-flex;align-items:center;justify-content:center;color:#061A16;text-decoration:none;border:1px solid rgba(15,23,42,.06);background:rgba(255,255,255,.76);position:relative;box-shadow:0 8px 18px rgba(15,23,42,.04)}.entry-mobile-bell span{position:absolute;top:7px;right:7px;width:10px;height:10px;border-radius:50%;background:#008B2E;box-shadow:0 0 0 3px #fff}.entry-mobile-bell svg{width:22px;height:22px}.entry-title{font-family:inherit;font-size:clamp(42px,11.5vw,56px);line-height:.94;letter-spacing:-.075em;font-weight:950;color:#061A16}.entry-title span:last-child{color:#008B2E}.entry-lead{max-width:350px;color:#5E6875;font-size:clamp(17px,4.8vw,20px);line-height:1.45;font-weight:620}.entry-actions{display:block}.entry-primary-action{min-height:62px;width:100%;border-radius:16px;justify-content:center;padding:0 22px;font-size:18px;background:linear-gradient(180deg,#00A83B,#008B2E)}.entry-primary-action svg{display:none}.entry-primary-action b{margin-left:auto;font-size:30px}.entry-roles{margin-top:22px;display:grid;gap:12px}.entry-roles h2{font-size:19px;color:#061A16}.entry-mobile-role-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.entry-role-card{min-height:132px;padding:13px 6px 11px;border-radius:15px;gap:7px;background:rgba(255,255,255,.88);border:1px solid rgba(15,23,42,.075);box-shadow:0 8px 20px rgba(15,23,42,.052)}.entry-role-card svg{width:36px;height:36px;color:#008B2E}.entry-role-card strong{font-size:12.6px;color:#061A16;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}.entry-role-card span{color:#66717C;font-size:10.6px;line-height:1.21;font-weight:640}.entry-role-card i{display:none}.entry-more-roles{display:block;border:1px solid rgba(15,23,42,.075);border-radius:16px;background:rgba(255,255,255,.78);padding:0 12px}.entry-more-roles summary{cursor:pointer;min-height:42px;display:flex;align-items:center;color:#0F2A23;font-size:13px;font-weight:900;list-style:none}.entry-more-roles summary::-webkit-details-marker{display:none}.entry-more-roles>div{display:grid;gap:8px;padding-bottom:12px}.entry-role-card.small{min-height:92px;display:grid;grid-template-columns:auto 1fr;justify-items:start;text-align:left;align-items:center;padding:10px}.entry-role-card.small svg{width:28px;height:28px}.entry-trust{margin-top:20px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;padding:13px;border-radius:18px;background:linear-gradient(180deg,rgba(241,252,244,.92),rgba(255,255,255,.92));border:1px solid rgba(0,139,46,.12);box-shadow:0 10px 24px rgba(15,23,42,.052)}.entry-trust-shield{width:46px;height:46px;border-radius:16px;display:inline-flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(180deg,#19B84D,#008B2E);box-shadow:0 9px 20px rgba(0,139,46,.22)}.entry-trust-shield svg{width:28px;height:28px}.entry-trust-copy{display:grid;gap:3px}.entry-trust-copy strong{font-size:14.5px;line-height:1.14;font-weight:950}.entry-trust-copy small{color:#5E6875;font-size:12.2px;line-height:1.34}.entry-trust-chart{width:58px;height:34px;display:flex;align-items:end;gap:5px;opacity:.65}.entry-trust-chart i{display:block;width:12px;border-radius:5px 5px 3px 3px;background:#008B2E}.entry-trust-chart i:nth-child(1){height:13px;opacity:.35}.entry-trust-chart i:nth-child(2){height:22px;opacity:.55}.entry-trust-chart i:nth-child(3){height:31px}.entry-bottom-tabs{position:relative;z-index:1;margin:0 auto;padding:9px 0 calc(env(safe-area-inset-bottom) + 10px);display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:3px;border-top:1px solid rgba(15,23,42,.07);background:rgba(255,255,255,.965);box-shadow:0 -12px 28px rgba(15,23,42,.055)}.entry-bottom-tabs a{min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:48px;text-decoration:none;color:#6B7280}.entry-bottom-tabs svg{width:20px;height:20px}.entry-bottom-tabs small{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px;line-height:1;font-weight:760}.entry-bottom-tabs a.active{color:#008B2E}}
@media(max-width:389px){.pc-v7-entry-page{padding-left:14px;padding-right:14px}.entry-title{font-size:41px}.entry-mobile-role-grid{gap:8px}.entry-role-card{min-height:124px;padding-left:4px;padding-right:4px}.entry-role-card strong{font-size:11.8px}.entry-role-card span{font-size:10px}.entry-trust-chart{display:none}}
`;
