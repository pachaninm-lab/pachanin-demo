import Link from 'next/link';
import { PLATFORM_V7_ROLE_GROUPS, platformV7RolesByGroup } from '@/lib/platform-v7/role-directory';

const preferredRoleTitles = [
  'Продавец',
  'Покупатель',
  'Логистика',
  'Водитель',
  'Банк',
  'Сюрвейер',
  'Оператор',
  'Руководитель',
  'Элеватор',
  'Лаборатория',
  'Комплаенс',
  'Арбитр',
] as const;

const navItems = [
  { label: 'Главная', href: '/platform-v7', icon: '⌂', active: true },
  { label: 'Сделки', href: '/platform-v7/deals', icon: '□', active: false },
  { label: 'Уведомления', href: '/platform-v7/notifications', icon: '○', active: false },
  { label: 'Чаты', href: '/platform-v7/support', icon: '◌', active: false },
  { label: 'Профиль', href: '/platform-v7/profile', icon: '◯', active: false },
] as const;

export default function PlatformV7RootPage() {
  const allRoles = PLATFORM_V7_ROLE_GROUPS.flatMap((group) => platformV7RolesByGroup(group));
  const orderedRoles = preferredRoleTitles
    .map((title) => allRoles.find((role) => role.title === title))
    .filter((role): role is (typeof allRoles)[number] => Boolean(role));
  const visibleRoles = orderedRoles.slice(0, 8);
  const secondaryRoles = orderedRoles.slice(8);

  return (
    <main data-testid='platform-v7-root-execution-cockpit' className='pc-v7-entry-page'>
      <style>{entryCss}</style>

      <section aria-label='Главная страница Прозрачной Цены' className='pc-v7-entry-shell'>
        <div aria-hidden='true' className='pc-v7-bg pc-v7-bg-field' />
        <div aria-hidden='true' className='pc-v7-bg pc-v7-bg-elevator' />
        <div aria-hidden='true' className='pc-v7-bg pc-v7-bg-route' />
        <div aria-hidden='true' className='pc-v7-bg pc-v7-bg-truck' />
        <div aria-hidden='true' className='pc-v7-bg-soft' />

        <header className='pc-v7-brand-row'>
          <Link href='/platform-v7' className='pc-v7-brand' aria-label='Прозрачная Цена'>
            <span className='pc-v7-logo' aria-hidden='true'>
              <span className='pc-v7-logo-letter'>П</span>
              <span className='pc-v7-logo-line' />
            </span>
            <span className='pc-v7-brand-name'>Прозрачная Цена</span>
          </Link>
          <Link href='/platform-v7/notifications' className='pc-v7-notify' aria-label='Уведомления'>
            <span className='pc-v7-notify-dot' />
            <span aria-hidden='true'>♧</span>
          </Link>
        </header>

        <section aria-label='Главное действие' className='pc-v7-hero'>
          <h1 className='pc-v7-title'>
            <span>Одна сделка.</span>
            <span className='pc-v7-title-accent'>Полный контроль.</span>
          </h1>
          <p className='pc-v7-lead'>Качество, логистика, документы и деньги — в одном прозрачном процессе.</p>
          <Link href='/platform-v7/seller/batches/new' className='pc-v7-cta'>
            <span>Создать сделку</span>
            <span aria-hidden='true'>→</span>
          </Link>
        </section>

        <section aria-label='Выберите свою роль' className='pc-v7-role-section'>
          <h2 className='pc-v7-section-title'>Выберите свою роль</h2>
          <div className='pc-v7-role-grid'>
            {visibleRoles.map((role) => (
              <Link key={role.href} href={role.href} className='pc-v7-role-card'>
                <RoleGlyph title={role.title} />
                <strong>{role.title}</strong>
                <span>{shortRoleFocus(role.title)}</span>
              </Link>
            ))}
          </div>

          {secondaryRoles.length ? (
            <details className='pc-v7-more-roles'>
              <summary>Ещё роли</summary>
              <div className='pc-v7-more-grid'>
                {secondaryRoles.map((role) => (
                  <Link key={role.href} href={role.href} className='pc-v7-more-role'>
                    <span className='pc-v7-more-dot' style={{ background: role.tone }} />
                    <span>
                      <strong>{role.title}</strong>
                      <small>{role.focus}</small>
                    </span>
                  </Link>
                ))}
              </div>
            </details>
          ) : null}
        </section>

        <section aria-label='Прозрачность исполнения' className='pc-v7-trust'>
          <span className='pc-v7-shield' aria-hidden='true'>✓</span>
          <span className='pc-v7-trust-copy'>
            <strong>Прозрачность на каждом этапе</strong>
            <small>Участники видят актуальные данные и статус сделки в своём контуре.</small>
          </span>
          <span className='pc-v7-mini-flow' aria-hidden='true'>
            <i />
            <i />
            <i />
          </span>
        </section>

        <nav aria-label='Основная навигация' className='pc-v7-bottom-tabs'>
          {navItems.map((item) => (
            <Link key={item.label} href={item.href} className={item.active ? 'active' : undefined}>
              <span aria-hidden='true'>{item.icon}</span>
              <small>{item.label}</small>
            </Link>
          ))}
        </nav>
      </section>
    </main>
  );
}

function shortRoleFocus(title: string) {
  if (title === 'Продавец') return 'Размещайте зерно и управляйте сделками';
  if (title === 'Покупатель') return 'Находите зерно и заключайте сделки';
  if (title === 'Логистика') return 'Организуйте перевозки и маршруты';
  if (title === 'Водитель') return 'Выполняйте рейсы и загрузки';
  if (title === 'Банк') return 'Проверяйте сделки и основание расчёта';
  if (title === 'Сюрвейер') return 'Проводите осмотры и экспертизы';
  if (title === 'Оператор') return 'Сопровождайте сделки и участников';
  if (title === 'Руководитель') return 'Контролируйте процессы и аналитику';
  return 'Контур действий';
}

function RoleGlyph({ title }: { readonly title: string }) {
  const tone = '#008B2E';
  if (title === 'Продавец') {
    return <svg viewBox='0 0 40 40' aria-hidden='true'><path d='M31 9C18 10 9 18 9 31c13-1 22-9 22-22Z' fill='none' stroke={tone} strokeWidth='2.8' /><path d='M12 28 28 12' stroke={tone} strokeWidth='2.6' strokeLinecap='round' /></svg>;
  }
  if (title === 'Покупатель') {
    return <svg viewBox='0 0 40 40' aria-hidden='true'><path d='M10 12h4l3 15h13l3-10H16' fill='none' stroke={tone} strokeWidth='2.8' strokeLinecap='round' strokeLinejoin='round' /><circle cx='19' cy='32' r='2' fill={tone} /><circle cx='30' cy='32' r='2' fill={tone} /></svg>;
  }
  if (title === 'Логистика') {
    return <svg viewBox='0 0 40 40' aria-hidden='true'><path d='M8 14h17v14H8Z' fill='none' stroke={tone} strokeWidth='2.8' /><path d='M25 18h5l4 5v5h-9Z' fill='none' stroke={tone} strokeWidth='2.8' strokeLinejoin='round' /><circle cx='15' cy='31' r='2' fill={tone} /><circle cx='30' cy='31' r='2' fill={tone} /></svg>;
  }
  if (title === 'Водитель') {
    return <svg viewBox='0 0 40 40' aria-hidden='true'><circle cx='20' cy='20' r='14' fill='none' stroke={tone} strokeWidth='2.8' /><circle cx='20' cy='20' r='4' fill='none' stroke={tone} strokeWidth='2.8' /><path d='M9 20h9m4 0h9M20 9v7m0 8v7' stroke={tone} strokeWidth='2.5' strokeLinecap='round' /></svg>;
  }
  if (title === 'Банк') {
    return <svg viewBox='0 0 40 40' aria-hidden='true'><path d='M7 17 20 9l13 8Z' fill='none' stroke={tone} strokeWidth='2.8' strokeLinejoin='round' /><path d='M10 18v12m7-12v12m7-12v12m7-12v12M7 31h26' stroke={tone} strokeWidth='2.6' strokeLinecap='round' /></svg>;
  }
  if (title === 'Сюрвейер') {
    return <svg viewBox='0 0 40 40' aria-hidden='true'><path d='M20 7 31 12v8c0 8-5 12-11 14-6-2-11-6-11-14v-8Z' fill='none' stroke={tone} strokeWidth='2.8' /><path d='m14 20 4 4 8-9' fill='none' stroke={tone} strokeWidth='2.8' strokeLinecap='round' strokeLinejoin='round' /></svg>;
  }
  if (title === 'Оператор') {
    return <svg viewBox='0 0 40 40' aria-hidden='true'><path d='M10 24v-5a10 10 0 0 1 20 0v5' fill='none' stroke={tone} strokeWidth='2.8' strokeLinecap='round' /><path d='M10 24h5v8h-5Zm15 0h5v8h-5Z' fill='none' stroke={tone} strokeWidth='2.8' /></svg>;
  }
  return <svg viewBox='0 0 40 40' aria-hidden='true'><circle cx='20' cy='13' r='5' fill='none' stroke={tone} strokeWidth='2.8' /><path d='M10 32c2-7 18-7 20 0' fill='none' stroke={tone} strokeWidth='2.8' strokeLinecap='round' /></svg>;
}

const entryCss = `
.pc-shell-root-v4 .pc-v4-header { display: none !important; }
.pc-shell-root-v4 .pc-v4-main { max-width: none !important; margin: 0 !important; padding: 0 !important; }
.pc-shell-root-v4 { background: #F8FAF7 !important; }
.pc-v7-entry-page {
  width: 100%;
  min-width: 0;
  min-height: 100dvh;
  padding: clamp(8px, 2.8vw, 18px) 12px 28px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  background: linear-gradient(180deg, #F8FAF7 0%, #FFFFFF 100%);
}
.pc-v7-entry-shell {
  position: relative;
  overflow: hidden;
  width: min(100%, 430px);
  border-radius: 30px;
  border: 1px solid rgba(0, 139, 46, .10);
  background: #fff;
  box-shadow: 0 24px 72px rgba(15, 23, 42, .10);
  padding: 22px 16px 0;
  display: grid;
  gap: 18px;
}
.pc-v7-bg { position: absolute; pointer-events: none; opacity: .052; filter: blur(.35px); }
.pc-v7-bg-field {
  left: -80px;
  right: -80px;
  bottom: 72px;
  height: 210px;
  transform: rotate(-5deg);
  background: repeating-linear-gradient(105deg, rgba(0,139,46,.78) 0 18px, rgba(198,147,32,.58) 18px 36px);
}
.pc-v7-bg-elevator {
  right: 18px;
  top: 84px;
  width: 130px;
  height: 190px;
  background: rgba(15,23,42,.42);
  clip-path: polygon(18% 100%,18% 30%,30% 30%,30% 12%,70% 12%,70% 30%,82% 30%,82% 100%);
}
.pc-v7-bg-route {
  left: 36px;
  right: 28px;
  top: 245px;
  height: 125px;
  border-top: 9px solid rgba(0,139,46,.70);
  border-right: 9px solid rgba(0,139,46,.45);
  border-radius: 0 72px 0 0;
  transform: rotate(-9deg);
}
.pc-v7-bg-truck {
  left: 30px;
  bottom: 132px;
  width: 86px;
  height: 42px;
  border-radius: 12px;
  background: rgba(15,23,42,.32);
}
.pc-v7-bg-soft {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(255,255,255,.97) 0%, rgba(255,255,255,.93) 52%, rgba(250,253,250,.965) 100%);
  pointer-events: none;
}
.pc-v7-brand-row,
.pc-v7-hero,
.pc-v7-role-section,
.pc-v7-trust,
.pc-v7-bottom-tabs { position: relative; z-index: 1; }
.pc-v7-brand-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.pc-v7-brand { min-width: 0; display: inline-flex; align-items: center; gap: 12px; color: #061A16; text-decoration: none; }
.pc-v7-logo { width: 48px; height: 48px; flex: 0 0 auto; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; position: relative; overflow: hidden; background: linear-gradient(145deg,#08231D 0%,#174A3D 55%,#ECFFF1 100%); box-shadow: 0 12px 24px rgba(0,139,46,.22); }
.pc-v7-logo-letter { color: #fff; font-size: 28px; line-height: 1; font-weight: 950; letter-spacing: -.08em; }
.pc-v7-logo-line { position: absolute; left: 10px; right: 8px; bottom: 10px; height: 18px; border-left: 2px solid rgba(255,255,255,.72); border-bottom: 2px solid rgba(255,255,255,.72); background: linear-gradient(135deg, transparent 45%, #00A83B 46% 55%, transparent 56%); }
.pc-v7-brand-name { min-width: 0; color: #061A16; font-size: clamp(20px, 5vw, 24px); line-height: 1.04; font-weight: 950; letter-spacing: -.045em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pc-v7-notify { width: 44px; height: 44px; flex: 0 0 auto; border-radius: 17px; display: inline-flex; align-items: center; justify-content: center; text-decoration: none; color: #061A16; border: 1px solid rgba(15,23,42,.08); background: rgba(255,255,255,.76); font-size: 22px; font-weight: 900; position: relative; box-shadow: 0 8px 18px rgba(15,23,42,.045); }
.pc-v7-notify-dot { position: absolute; top: 8px; right: 8px; width: 10px; height: 10px; border-radius: 50%; background: #008B2E; box-shadow: 0 0 0 3px #fff; }
.pc-v7-hero { display: grid; gap: 17px; padding-top: 26px; }
.pc-v7-title { margin: 0; display: grid; gap: 1px; color: #061A16; font-size: clamp(43px, 11.2vw, 58px); line-height: .94; letter-spacing: -.078em; font-weight: 950; }
.pc-v7-title-accent { color: #008B2E; }
.pc-v7-lead { margin: 0; max-width: 360px; color: #5E6875; font-size: clamp(17px, 4.6vw, 20px); line-height: 1.43; font-weight: 720; letter-spacing: -.018em; }
.pc-v7-cta { min-height: 62px; border-radius: 17px; padding: 0 22px; display: inline-flex; align-items: center; justify-content: center; gap: 18px; text-decoration: none; color: #fff; background: linear-gradient(180deg,#00A83B 0%,#008B2E 100%); box-shadow: 0 16px 34px rgba(0,139,46,.26); font-size: 19px; font-weight: 950; letter-spacing: -.02em; }
.pc-v7-cta span:last-child { margin-left: auto; font-size: 30px; line-height: 1; transform: translateY(-1px); }
.pc-v7-role-section { display: grid; gap: 12px; }
.pc-v7-section-title { margin: 0; color: #061A16; font-size: 20px; line-height: 1.2; font-weight: 950; letter-spacing: -.035em; }
.pc-v7-role-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.pc-v7-role-card { min-width: 0; min-height: 132px; padding: 13px 6px 11px; border-radius: 16px; display: grid; justify-items: center; align-content: start; gap: 7px; text-align: center; text-decoration: none; color: #061A16; background: rgba(255,255,255,.88); border: 1px solid rgba(15,23,42,.075); box-shadow: 0 8px 20px rgba(15,23,42,.052); backdrop-filter: blur(10px); }
.pc-v7-role-card svg { width: 36px; height: 36px; display: block; }
.pc-v7-role-card strong { max-width: 100%; color: #061A16; font-size: 12.6px; line-height: 1.08; font-weight: 950; letter-spacing: -.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pc-v7-role-card span { color: #66717C; font-size: 10.6px; line-height: 1.21; font-weight: 690; }
.pc-v7-more-roles { border: 1px solid rgba(15,23,42,.075); border-radius: 16px; background: rgba(255,255,255,.78); padding: 0 12px; }
.pc-v7-more-roles summary { cursor: pointer; min-height: 42px; display: flex; align-items: center; color: #0F2A23; font-size: 13px; line-height: 1.2; font-weight: 900; list-style: none; }
.pc-v7-more-roles summary::-webkit-details-marker { display: none; }
.pc-v7-more-grid { display: grid; gap: 8px; padding-bottom: 12px; }
.pc-v7-more-role { min-width: 0; display: grid; grid-template-columns: auto minmax(0,1fr); gap: 9px; align-items: start; text-decoration: none; color: #061A16; padding: 10px; border-radius: 13px; background: #fff; border: 1px solid rgba(15,23,42,.06); }
.pc-v7-more-dot { width: 9px; height: 9px; border-radius: 50%; margin-top: 5px; }
.pc-v7-more-role span:last-child { display: grid; gap: 2px; min-width: 0; }
.pc-v7-more-role strong { font-size: 13px; line-height: 1.12; font-weight: 950; }
.pc-v7-more-role small { color: #66717C; font-size: 12px; line-height: 1.3; font-weight: 650; }
.pc-v7-trust { display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 12px; padding: 13px; border-radius: 18px; background: linear-gradient(180deg, rgba(241,252,244,.92) 0%, rgba(255,255,255,.92) 100%); border: 1px solid rgba(0,139,46,.14); box-shadow: 0 10px 24px rgba(15,23,42,.052); }
.pc-v7-shield { width: 46px; height: 46px; border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; color: #fff; background: linear-gradient(180deg,#19B84D 0%,#008B2E 100%); box-shadow: 0 9px 20px rgba(0,139,46,.22); font-size: 24px; font-weight: 950; }
.pc-v7-trust-copy { min-width: 0; display: grid; gap: 3px; }
.pc-v7-trust-copy strong { color: #061A16; font-size: 14.5px; line-height: 1.14; font-weight: 950; letter-spacing: -.02em; }
.pc-v7-trust-copy small { color: #5E6875; font-size: 12.2px; line-height: 1.34; font-weight: 670; }
.pc-v7-mini-flow { width: 58px; height: 34px; display: flex; align-items: end; gap: 5px; opacity: .65; }
.pc-v7-mini-flow i { display: block; width: 12px; border-radius: 5px 5px 3px 3px; background: #008B2E; }
.pc-v7-mini-flow i:nth-child(1) { height: 13px; opacity: .35; }
.pc-v7-mini-flow i:nth-child(2) { height: 22px; opacity: .55; }
.pc-v7-mini-flow i:nth-child(3) { height: 31px; opacity: .9; }
.pc-v7-bottom-tabs { margin: 0 -16px; padding: 9px 10px calc(env(safe-area-inset-bottom) + 10px); display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 3px; border-top: 1px solid rgba(15,23,42,.07); background: rgba(255,255,255,.965); box-shadow: 0 -12px 28px rgba(15,23,42,.055); }
.pc-v7-bottom-tabs a { min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-height: 48px; text-decoration: none; color: #6B7280; font-size: 18px; line-height: 1; font-weight: 850; }
.pc-v7-bottom-tabs a small { max-width: 100%; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10.5px; line-height: 1; font-weight: 760; }
.pc-v7-bottom-tabs a.active { color: #008B2E; }
@media (max-width: 389px) {
  .pc-v7-entry-page { padding-left: 10px; padding-right: 10px; }
  .pc-v7-entry-shell { padding-left: 14px; padding-right: 14px; border-radius: 26px; }
  .pc-v7-title { font-size: 41px; }
  .pc-v7-role-grid { gap: 8px; }
  .pc-v7-role-card { min-height: 122px; padding-left: 4px; padding-right: 4px; }
  .pc-v7-role-card strong { font-size: 11.8px; }
  .pc-v7-role-card span { font-size: 10px; }
  .pc-v7-trust { grid-template-columns: auto minmax(0,1fr); }
  .pc-v7-mini-flow { display: none; }
}
`;
