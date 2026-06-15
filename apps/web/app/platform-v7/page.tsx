import Link from 'next/link';
import type { CSSProperties } from 'react';

type IconName = 'leaf' | 'cart' | 'truck' | 'wheel' | 'bank' | 'shield' | 'operator' | 'user' | 'warehouse' | 'lab' | 'lock' | 'scale' | 'doc' | 'box' | 'request' | 'home' | 'folder' | 'bell' | 'chat';

type RoleCard = {
  readonly title: string;
  readonly text: string;
  readonly href: string;
  readonly icon: IconName;
};

const primaryRoles: readonly RoleCard[] = [
  { title: 'Продавец', text: 'Размещайте зерно и управляйте сделками', href: '/platform-v7/seller', icon: 'leaf' },
  { title: 'Покупатель', text: 'Находите зерно и заключайте сделки', href: '/platform-v7/buyer', icon: 'cart' },
  { title: 'Логистика', text: 'Организуйте перевозки и маршруты', href: '/platform-v7/logistics', icon: 'truck' },
  { title: 'Водитель', text: 'Выполняйте рейсы и загрузки', href: '/platform-v7/driver/field', icon: 'wheel' },
  { title: 'Банк', text: 'Финансируйте сделки без лишних рисков', href: '/platform-v7/bank', icon: 'bank' },
  { title: 'Сюрвейер', text: 'Проводите осмотры и экспертизы', href: '/platform-v7/surveyor', icon: 'shield' },
  { title: 'Оператор', text: 'Сопровождайте сделки и участников', href: '/platform-v7/support/operator', icon: 'operator' },
  { title: 'Руководитель', text: 'Контролируйте процессы и аналитику', href: '/platform-v7/executive', icon: 'user' },
];

const extraRoles: readonly RoleCard[] = [
  { title: 'Элеватор', text: 'Приёмка, вес и отгрузка', href: '/platform-v7/elevator', icon: 'warehouse' },
  { title: 'Лаборатория', text: 'Анализы и качество', href: '/platform-v7/lab', icon: 'lab' },
  { title: 'Комплаенс', text: 'Допуск, риски и правила', href: '/platform-v7/compliance', icon: 'lock' },
  { title: 'Арбитр', text: 'Споры и доказательства', href: '/platform-v7/arbitrator', icon: 'scale' },
];

const bottomTabs = [
  { label: 'Главная', href: '/platform-v7', icon: 'home', active: true },
  { label: 'Сделки', href: '/platform-v7/deals', icon: 'folder', active: false },
  { label: 'Уведомления', href: '/platform-v7/notifications', icon: 'bell', active: false },
  { label: 'Чаты', href: '/platform-v7/support', icon: 'chat', active: false },
  { label: 'Профиль', href: '/platform-v7/profile', icon: 'user', active: false },
] as const;

const roleGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 10,
  width: '100%',
  minWidth: 0,
};

const roleTileStyle: CSSProperties = {
  minWidth: 0,
  width: '100%',
  minHeight: 118,
  padding: '13px 5px 10px',
  borderRadius: 15,
  border: '1px solid rgba(15,23,42,.065)',
  background: 'rgba(255,255,255,.94)',
  boxShadow: '0 10px 22px rgba(15,23,42,.055)',
  color: '#061A16',
  textDecoration: 'none',
  display: 'grid',
  gridTemplateColumns: '1fr',
  justifyItems: 'center',
  alignContent: 'start',
  gap: 7,
  textAlign: 'center',
};

const roleIconStyle: CSSProperties = { width: 31, height: 31, color: '#008B2E' };
const roleTitleStyle: CSSProperties = { maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#061A16', fontSize: 12.1, lineHeight: 1.05, fontWeight: 920, letterSpacing: '-.035em' };
const roleTextStyle: CSSProperties = { color: '#66717C', fontSize: 10.1, lineHeight: 1.22, fontWeight: 560 };

export default function PlatformV7RootPage() {
  return (
    <main data-testid='platform-v7-root-execution-cockpit' className='pc-v7-entry-page pc-v7-entry-exact'>
      <style>{entryCss}</style>

      <div aria-hidden='true' className='entry-mobile-bg field' />
      <div aria-hidden='true' className='entry-mobile-bg elevator' />
      <div aria-hidden='true' className='entry-mobile-bg route' />
      <div aria-hidden='true' className='entry-soft' />

      <section className='entry-hero' aria-label='Главный экран'>
        <div className='entry-copy'>
          <h1 className='entry-title'><span>Одна сделка.</span><span>Полный контроль.</span></h1>
          <p className='entry-lead'>Качество, логистика, документы и деньги — в одном прозрачном процессе.</p>

          <div className='entry-actions'>
            <Link href='/platform-v7/seller/batches/new' className='entry-primary-action'>
              <span>Создать сделку</span>
              <b aria-hidden='true'>→</b>
            </Link>
            <div className='entry-auth-actions' aria-label='Вход и регистрация'>
              <Link href='/platform-v7/register'>Регистрация</Link>
              <Link href='/platform-v7/login'>Войти</Link>
              <Link href='/platform-v7/lots/create'>Выставить партию</Link>
              <Link href='/platform-v7/procurement'>Запрос на закупку</Link>
            </div>
          </div>
        </div>
      </section>

      <section className='entry-roles' aria-label='Выберите свою роль'>
        <h2>Выберите свою роль</h2>
        <div className='entry-role-grid-exact' style={roleGridStyle}>
          {primaryRoles.map((role) => <RoleTile key={role.href} role={role} />)}
        </div>
        <details className='entry-more-roles-exact'>
          <summary>Ещё роли</summary>
          <div>
            {extraRoles.map((role) => <RoleRow key={role.href} role={role} />)}
          </div>
        </details>
      </section>

      <section className='entry-trust' aria-label='Прозрачность'>
        <span className='entry-trust-shield'><Icon name='shield' /></span>
        <span className='entry-trust-copy'><strong>Прозрачность на каждом этапе</strong><small>Все участники видят актуальные данные и статус сделки в одном контуре.</small></span>
        <span className='entry-trust-chart' aria-hidden='true'><i /><i /><i /></span>
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

function RoleTile({ role }: { readonly role: RoleCard }) {
  return (
    <Link href={role.href} className='entry-role-tile-exact' style={roleTileStyle}>
      <span style={roleIconStyle}><Icon name={role.icon} /></span>
      <strong style={roleTitleStyle}>{role.title}</strong>
      <span style={roleTextStyle}>{role.text}</span>
    </Link>
  );
}

function RoleRow({ role }: { readonly role: RoleCard }) {
  return (
    <Link href={role.href} className='entry-role-row-exact'>
      <Icon name={role.icon} />
      <strong>{role.title}</strong>
      <span>{role.text}</span>
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
  if (name === 'lock') return <svg viewBox='0 0 24 24'><path d='M6 10h12v10H6Zm3 0V7a3 3 0 0 1 6 0v3' {...p} /></svg>;
  if (name === 'home') return <svg viewBox='0 0 24 24'><path d='m4 11 8-7 8 7v9H6v-6h12' {...p} /></svg>;
  if (name === 'folder') return <svg viewBox='0 0 24 24'><path d='M3 7h7l2 3h9v9H3Z' {...p} /></svg>;
  if (name === 'bell') return <svg viewBox='0 0 24 24'><path d='M6 17h12l-2-3V9a4 4 0 0 0-8 0v5Zm4 3h4' {...p} /></svg>;
  if (name === 'chat') return <svg viewBox='0 0 24 24'><path d='M5 6h14v10H9l-4 4Z' {...p} /></svg>;
  if (name === 'doc' || name === 'request') return <svg viewBox='0 0 24 24'><path d='M7 3h7l4 4v14H7Z' {...p} /><path d='M14 3v5h5M9 13h6M9 17h5' {...p} /></svg>;
  if (name === 'box') return <svg viewBox='0 0 24 24'><path d='M4 8 12 4l8 4v9l-8 4-8-4Z' {...p} /><path d='m4 8 8 4 8-4M12 12v9' {...p} /></svg>;
  return <svg viewBox='0 0 24 24'><circle cx='12' cy='12' r='8' {...p} /></svg>;
}

const entryCss = `
.pc-shell-root-v4:has(.pc-v7-entry-exact){background:#fff!important}.pc-shell-root-v4:has(.pc-v7-entry-exact) .pc-v4-bottomnav,.pc-shell-root-v4:has(.pc-v7-entry-exact) .pc-v4-pilot-note,.pc-shell-root-v4:has(.pc-v7-entry-exact) .pc-v4-meta,.pc-shell-root-v4:has(.pc-v7-entry-exact) .pc-v4-top>button.pc-v4-iconbtn:first-child,.pc-shell-root-v4:has(.pc-v7-entry-exact) .pc-v4-drawer,.pc-shell-root-v4:has(.pc-v7-entry-exact) .pc-v4-search,.pc-shell-root-v4:has(.pc-v7-entry-exact) .pc-v4-stage,.pc-shell-root-v4:has(.pc-v7-entry-exact) .pc-v4-theme-toggle{display:none!important}.pc-shell-root-v4:has(.pc-v7-entry-exact) .pc-v4-main{max-width:none!important;margin:0!important;padding:calc(env(safe-area-inset-top) + 96px) 0 0!important}.pc-shell-root-v4:has(.pc-v7-entry-exact) .pc-v4-header{background:rgba(255,255,255,.985)!important;border-bottom:0!important;box-shadow:none!important}.pc-shell-root-v4:has(.pc-v7-entry-exact) .pc-v4-header-inner{width:min(100%,430px)!important;margin:0 auto!important;padding:calc(env(safe-area-inset-top) + 14px) 18px 8px!important}.pc-shell-root-v4:has(.pc-v7-entry-exact) .pc-v4-top{grid-template-columns:minmax(0,1fr) auto!important;gap:12px!important}.pc-shell-root-v4:has(.pc-v7-entry-exact) .pc-v4-brand{justify-self:start!important;gap:12px!important}.pc-shell-root-v4:has(.pc-v7-entry-exact) .pc-v4-brand>span[aria-hidden]{width:48px!important;height:48px!important}.pc-shell-root-v4:has(.pc-v7-entry-exact) .pc-v4-title{font-size:22px!important;font-weight:920!important;letter-spacing:-.045em!important;color:#061A16!important}.pc-shell-root-v4:has(.pc-v7-entry-exact) .pc-v4-actions>div:last-child .pc-v4-iconbtn{min-width:44px!important;min-height:44px!important;border:0!important;background:transparent!important;box-shadow:none!important;color:#061A16!important}.pc-shell-root-v4:has(.pc-v7-entry-exact) .pc-v4-actions>div:last-child .pc-v4-iconbtn span{background:#008B2E!important;border-color:#fff!important}.pc-v7-entry-exact{--green:#008B2E;--deep:#061A16;position:relative;min-height:100dvh;overflow:hidden;padding:0 18px calc(env(safe-area-inset-bottom) + 108px);display:flex;flex-direction:column;align-items:center;background:#fff;color:var(--deep);font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',Inter,system-ui,sans-serif}.pc-v7-entry-exact svg{display:block;width:100%;height:100%}.entry-mobile-bg{position:absolute;pointer-events:none;opacity:.04;filter:blur(.7px);z-index:0}.entry-mobile-bg.field{left:-60px;right:-60px;bottom:70px;height:220px;transform:rotate(-5deg);background:repeating-linear-gradient(105deg,rgba(0,139,46,.78) 0 18px,rgba(198,147,32,.55) 18px 36px)}.entry-mobile-bg.elevator{right:12px;top:88px;width:126px;height:178px;background:rgba(15,23,42,.25);clip-path:polygon(18% 100%,18% 30%,30% 30%,30% 12%,70% 12%,70% 30%,82% 30%,82% 100%)}.entry-mobile-bg.route{left:34px;right:24px;top:250px;height:124px;border-top:9px solid rgba(0,139,46,.45);border-right:9px solid rgba(0,139,46,.28);border-radius:0 72px 0 0;transform:rotate(-9deg)}.entry-soft{position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.99),rgba(255,255,255,.965) 52%,rgba(250,253,250,.99));pointer-events:none}.entry-hero,.entry-roles,.entry-trust,.entry-bottom-tabs{position:relative;z-index:1;width:min(100%,430px);margin-left:auto;margin-right:auto}.entry-hero{display:block;padding-top:42px}.entry-copy{display:grid;gap:18px}.entry-title{margin:0;display:grid;gap:2px;max-width:360px;font-size:clamp(38px,10vw,44px);line-height:.94;letter-spacing:-.07em;font-weight:950;color:#061A16}.entry-title span:last-child{color:var(--green);white-space:nowrap}.entry-lead{margin:0;max-width:360px;color:#5F6874;font-size:clamp(16.5px,4.35vw,18px);line-height:1.48;font-weight:560;letter-spacing:-.022em}.entry-actions{display:grid;gap:10px;margin-top:18px}.entry-primary-action{min-height:64px;width:100%;border-radius:16px;display:flex;align-items:center;justify-content:center;gap:14px;padding:0 28px;color:#fff;text-decoration:none;background:linear-gradient(180deg,#00A83B,#008B2E);box-shadow:0 16px 34px rgba(0,139,46,.22);font-size:18px;font-weight:900}.entry-primary-action b{margin-left:auto;font-size:31px;line-height:1;font-weight:760}.entry-auth-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:8px 14px}.entry-auth-actions a{color:#5F6874;font-size:12px;font-weight:760;text-decoration:none}.entry-roles{margin-top:22px;display:grid;gap:12px}.entry-roles h2{margin:0;font-size:19px;line-height:1.16;font-weight:920;letter-spacing:-.038em;color:#061A16}.entry-role-grid-exact{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:10px!important}.entry-role-tile-exact{display:grid!important;grid-template-columns:1fr!important}.entry-more-roles-exact{display:none}.entry-trust{margin-top:20px;min-height:92px;display:grid;grid-template-columns:auto minmax(0,1fr) 58px;align-items:center;gap:13px;padding:13px;border-radius:18px;background:linear-gradient(180deg,rgba(241,252,244,.9),rgba(255,255,255,.94));border:1px solid rgba(0,139,46,.11);box-shadow:0 10px 24px rgba(15,23,42,.052)}.entry-trust-shield{width:48px;height:48px;border-radius:16px;display:inline-flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(180deg,#19B84D,#008B2E);box-shadow:0 9px 20px rgba(0,139,46,.22)}.entry-trust-shield svg{width:28px;height:28px}.entry-trust-copy{display:grid;gap:3px}.entry-trust-copy strong{font-size:14.6px;line-height:1.12;font-weight:920}.entry-trust-copy small{color:#5F6874;font-size:12px;line-height:1.34;font-weight:560}.entry-trust-chart{width:58px;height:34px;display:flex;align-items:end;gap:5px;opacity:.65}.entry-trust-chart i{display:block;width:12px;border-radius:5px 5px 3px 3px;background:var(--green)}.entry-trust-chart i:nth-child(1){height:13px;opacity:.35}.entry-trust-chart i:nth-child(2){height:22px;opacity:.55}.entry-trust-chart i:nth-child(3){height:31px}.entry-bottom-tabs{position:fixed;z-index:50;left:50%;bottom:0;transform:translateX(-50%);width:min(100%,430px);padding:9px 0 calc(env(safe-area-inset-bottom) + 10px);display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:3px;border-radius:24px 24px 0 0;border-top:1px solid rgba(15,23,42,.07);background:rgba(255,255,255,.975);box-shadow:0 -12px 28px rgba(15,23,42,.055);backdrop-filter:blur(18px)}.entry-bottom-tabs a{min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:49px;text-decoration:none;color:#6B7280}.entry-bottom-tabs svg{width:20px;height:20px}.entry-bottom-tabs small{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.7px;line-height:1;font-weight:720}.entry-bottom-tabs a.active{color:var(--green)}
@media(max-width:389px){.pc-shell-root-v4:has(.pc-v7-entry-exact) .pc-v4-header-inner{padding-left:14px!important;padding-right:14px!important}.pc-v7-entry-exact{padding-left:14px;padding-right:14px}.entry-title{font-size:38px}.entry-role-grid-exact{gap:8px!important}.entry-role-tile-exact{min-height:112px!important;padding-left:4px!important;padding-right:4px!important}.entry-role-tile-exact strong{font-size:11.4px!important}.entry-role-tile-exact span:not(:first-child){font-size:9.55px!important}.entry-trust-chart{display:none}}
@media(min-width:641px){.entry-mobile-bg,.entry-soft{display:none}.pc-shell-root-v4:has(.pc-v7-entry-exact) .pc-v4-header{display:none!important}.pc-shell-root-v4:has(.pc-v7-entry-exact) .pc-v4-main{padding:32px 42px 42px!important}.pc-v7-entry-exact{display:block;min-height:100dvh;padding:28px 42px 42px;background:linear-gradient(180deg,#FFFCF6,#fff 56%,#FEFCF7)}.entry-hero{width:auto;max-width:1200px;margin:0 auto}.entry-title{font-size:72px;max-width:760px}.entry-lead{font-size:21px;max-width:620px}.entry-actions{grid-template-columns:minmax(300px,390px);max-width:760px}.entry-roles{width:auto;max-width:1200px;margin:28px auto 0}.entry-role-grid-exact{grid-template-columns:repeat(8,minmax(0,1fr))!important}.entry-bottom-tabs{display:none}.entry-more-roles-exact{display:block;margin-top:4px}.entry-more-roles-exact summary{cursor:pointer;color:#0F2A23;font-size:13px;font-weight:900}.entry-more-roles-exact>div{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:10px}.entry-role-row-exact{min-height:76px;padding:12px;border-radius:14px;background:#fff;border:1px solid rgba(15,23,42,.07);text-decoration:none;color:#061A16;display:grid;gap:5px}.entry-role-row-exact svg{width:28px;height:28px;color:#008B2E}.entry-trust{width:auto;max-width:1200px;margin:24px auto 0}}
`;
