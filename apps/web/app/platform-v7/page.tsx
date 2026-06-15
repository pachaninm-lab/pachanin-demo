import Link from 'next/link';
import { getPlatformV7EntryCockpitState } from '@/lib/platform-v7/runtime/entry-cockpit-state';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
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
  { label: 'Уведомления', href: '/platform-v7/notifications', icon: '◌', active: false },
  { label: 'Чаты', href: '/platform-v7/support', icon: '◍', active: false },
  { label: 'Профиль', href: '/platform-v7/profile', icon: '○', active: false },
] as const;

export default function PlatformV7RootPage() {
  const cockpit = getPlatformV7EntryCockpitState();
  const primary = cockpit.primaryBlocker;
  const money = cockpit.lanes.find((item) => item.label === 'Деньги');
  const allRoles = PLATFORM_V7_ROLE_GROUPS.flatMap((group) => platformV7RolesByGroup(group));
  const orderedRoles = preferredRoleTitles
    .map((title) => allRoles.find((role) => role.title === title))
    .filter((role): role is (typeof allRoles)[number] => Boolean(role));
  const visibleRoles = orderedRoles.slice(0, 8);
  const secondaryRoles = orderedRoles.slice(8);

  return (
    <main data-testid='platform-v7-root-execution-cockpit' style={page}>
      <section aria-label='Мобильный вход в платформу' style={phoneSurface}>
        <div aria-hidden='true' style={backgroundImage}>
          <div style={fieldBand} />
          <div style={elevatorShape} />
          <div style={routeLine} />
          <div style={truckShape} />
        </div>
        <div aria-hidden='true' style={softOverlay} />

        <header style={topBar}>
          <Link href='/platform-v7' style={brandLink} aria-label='Прозрачная Цена'>
            <span style={logoMark}>
              <span style={logoLetter}>П</span>
              <span style={logoChart} />
            </span>
            <span style={brandName}>Прозрачная Цена</span>
          </Link>
          <Link href='/platform-v7/notifications' style={bellLink} aria-label='Уведомления'>
            <span style={bellDot} />
            <span aria-hidden='true'>♧</span>
          </Link>
        </header>

        <section aria-label='Главное действие' style={heroSection}>
          <h1 style={heroTitle}>
            <span>Одна сделка.</span>
            <span style={heroAccent}>Полный контроль.</span>
          </h1>
          <p style={heroLead}>Качество, логистика, документы и деньги — в одном прозрачном процессе.</p>
          <Link href='/platform-v7/seller/batches/new' style={primaryCta}>
            <span>Создать сделку</span>
            <span aria-hidden='true' style={ctaArrow}>→</span>
          </Link>
        </section>

        <section aria-label='Выберите свою роль' style={roleSection}>
          <h2 style={roleSectionTitle}>Выберите свою роль</h2>
          <div style={mobileRoleGrid}>
            {visibleRoles.map((role) => (
              <Link key={role.href} href={role.href} style={mobileRoleCard}>
                <RoleGlyph title={role.title} tone='#008B2E' />
                <strong style={mobileRoleTitle}>{role.title}</strong>
                <span style={mobileRoleText}>{shortRoleFocus(role.title)}</span>
              </Link>
            ))}
          </div>

          {secondaryRoles.length ? (
            <details style={moreRoles}>
              <summary style={moreRolesSummary}>Ещё роли исполнения и контроля</summary>
              <div style={secondaryRoleGrid}>
                {secondaryRoles.map((role) => (
                  <Link key={role.href} href={role.href} style={secondaryRoleCard}>
                    <span style={{ ...secondaryRoleDot, background: role.tone }} />
                    <span style={secondaryRoleBody}>
                      <strong style={secondaryRoleTitle}>{role.title}</strong>
                      <span style={secondaryRoleText}>{role.focus}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </details>
          ) : null}
        </section>

        <section aria-label='Прозрачность на каждом этапе' style={trustBanner}>
          <div style={trustShield}>✓</div>
          <div style={trustCopy}>
            <strong style={trustTitle}>Прозрачность на каждом этапе</strong>
            <span style={trustText}>Участники видят свой статус, блокеры, документы и следующее действие.</span>
          </div>
          <div aria-hidden='true' style={trustChart}>
            <span />
            <span />
            <span />
          </div>
        </section>

        <nav aria-label='Основная навигация' style={bottomNav}>
          {navItems.map((item) => (
            <Link key={item.label} href={item.href} style={item.active ? bottomNavItemActive : bottomNavItem}>
              <span style={bottomNavIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </section>

      <section style={pathCard} aria-label='Путь исполнения сделки'>
        {cockpit.executionPath.map((step, index) => (
          <div key={step} style={pathStep}>
            <span style={pathNumber}>{index + 1}</span>
            <span style={pathText}>{step}</span>
          </div>
        ))}
      </section>

      <CollapsibleSection title='Рабочий контур — От причины к деньгам за один экран' summary='деньги · блокеры · ответственный' defaultOpen={false}>
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={moneyCard}>
              <span style={cardLabel}>Остановлено сейчас</span>
              <strong style={moneyValue}>{money?.value ?? '0 ₽'}</strong>
              <span style={cardText}>{money?.state ?? 'нет активных стопов'}</span>
            </div>
            <div style={maturityCard}>
              <strong style={maturityTitle}>Контролируемый предпилотный контур</strong>
              <span style={cardText}>{cockpit.maturityNotice}</span>
            </div>
            <div style={{ flex: '1 1 240px', minWidth: 220 }}>
              {primary ? (
                <Link href={primary.href} style={controlAction}>Открыть главный блокер</Link>
              ) : (
                <span style={disabledAction}>Нет активных стопов</span>
              )}
            </div>
          </div>

          <section style={workGrid} aria-label='Очередь блокеров и ролевой вход'>
            <section style={panel} aria-label='Очередь блокеров'>
              <div style={sectionHead}>
                <div>
                  <div style={eyebrow}>Очередь снятия</div>
                  <h2 style={h2}>{cockpit.blockers.length ? '3 действия вместо длинной ленты' : 'Нет активных стопов'}</h2>
                </div>
                <Link href='/platform-v7/control-tower' style={ghostAction}>Центр управления</Link>
              </div>
              {cockpit.blockers.length ? cockpit.blockers.map((item, index) => (
                <Link key={item.id} href={item.href} style={{ ...blockerCard, borderColor: toneBorder(item.tone), background: toneBg(item.tone) }}>
                  <span style={rank}>#{index + 1}</span>
                  <span style={blockerBody}>
                    <strong style={blockerTitle}>{item.id} · {item.title}</strong>
                    <span style={cardText}>{item.cause}</span>
                    <span style={cardText}>Держит: {item.money} · Ответственный: {item.owner}</span>
                  </span>
                  <span style={{ ...dot, background: toneDot(item.tone) }} />
                </Link>
              )) : <div style={emptyState}>Нет активных стопов по текущему контуру.</div>}
            </section>

            <section style={panel} aria-label='Ролевой вход'>
              <div style={eyebrow}>Ролевой вход</div>
              <h2 style={h2}>Каждая сторона видит своё действие</h2>
              {cockpit.roleEntrypoints.map((item) => (
                <Link key={item.role} href={item.href} style={roleCard}>
                  <strong style={roleTitle}>{item.role}</strong>
                  <span style={cardText}>{item.focus}</span>
                  <span style={roleAction}>{item.action}</span>
                </Link>
              ))}
            </section>
          </section>
        </div>
      </CollapsibleSection>
    </main>
  );
}

function shortRoleFocus(title: string) {
  if (title === 'Продавец') return 'Размещайте партии и управляйте сделками';
  if (title === 'Покупатель') return 'Находите партии и заключайте сделки';
  if (title === 'Логистика') return 'Организуйте перевозки и маршруты';
  if (title === 'Водитель') return 'Выполняйте рейсы и загрузки';
  if (title === 'Банк') return 'Проверяйте основание для расчётов';
  if (title === 'Сюрвейер') return 'Проводите осмотры и экспертизы';
  if (title === 'Оператор') return 'Сопровождайте сделки и участников';
  if (title === 'Руководитель') return 'Контролируйте процессы и аналитику';
  return 'Откройте свой контур действий';
}

function RoleGlyph({ title, tone }: { readonly title: string; readonly tone: string }) {
  if (title === 'Продавец') {
    return <svg viewBox='0 0 40 40' style={roleIconSvg} aria-hidden='true'><path d='M31 9C18 10 9 18 9 31c13-1 22-9 22-22Z' fill='none' stroke={tone} strokeWidth='2.8' /><path d='M12 28 28 12' stroke={tone} strokeWidth='2.6' strokeLinecap='round' /></svg>;
  }
  if (title === 'Покупатель') {
    return <svg viewBox='0 0 40 40' style={roleIconSvg} aria-hidden='true'><path d='M10 12h4l3 15h13l3-10H16' fill='none' stroke={tone} strokeWidth='2.8' strokeLinecap='round' strokeLinejoin='round' /><circle cx='19' cy='32' r='2' fill={tone} /><circle cx='30' cy='32' r='2' fill={tone} /></svg>;
  }
  if (title === 'Логистика') {
    return <svg viewBox='0 0 40 40' style={roleIconSvg} aria-hidden='true'><path d='M8 14h17v14H8Z' fill='none' stroke={tone} strokeWidth='2.8' /><path d='M25 18h5l4 5v5h-9Z' fill='none' stroke={tone} strokeWidth='2.8' strokeLinejoin='round' /><circle cx='15' cy='31' r='2' fill={tone} /><circle cx='30' cy='31' r='2' fill={tone} /></svg>;
  }
  if (title === 'Водитель') {
    return <svg viewBox='0 0 40 40' style={roleIconSvg} aria-hidden='true'><circle cx='20' cy='20' r='14' fill='none' stroke={tone} strokeWidth='2.8' /><circle cx='20' cy='20' r='4' fill='none' stroke={tone} strokeWidth='2.8' /><path d='M9 20h9m4 0h9M20 9v7m0 8v7' stroke={tone} strokeWidth='2.5' strokeLinecap='round' /></svg>;
  }
  if (title === 'Банк') {
    return <svg viewBox='0 0 40 40' style={roleIconSvg} aria-hidden='true'><path d='M7 17 20 9l13 8Z' fill='none' stroke={tone} strokeWidth='2.8' strokeLinejoin='round' /><path d='M10 18v12m7-12v12m7-12v12m7-12v12M7 31h26' stroke={tone} strokeWidth='2.6' strokeLinecap='round' /></svg>;
  }
  if (title === 'Сюрвейер') {
    return <svg viewBox='0 0 40 40' style={roleIconSvg} aria-hidden='true'><path d='M20 7 31 12v8c0 8-5 12-11 14-6-2-11-6-11-14v-8Z' fill='none' stroke={tone} strokeWidth='2.8' /><path d='m14 20 4 4 8-9' fill='none' stroke={tone} strokeWidth='2.8' strokeLinecap='round' strokeLinejoin='round' /></svg>;
  }
  if (title === 'Оператор') {
    return <svg viewBox='0 0 40 40' style={roleIconSvg} aria-hidden='true'><path d='M10 24v-5a10 10 0 0 1 20 0v5' fill='none' stroke={tone} strokeWidth='2.8' strokeLinecap='round' /><path d='M10 24h5v8h-5Zm15 0h5v8h-5Z' fill='none' stroke={tone} strokeWidth='2.8' /><path d='M25 32h-5' stroke={tone} strokeWidth='2.6' strokeLinecap='round' /></svg>;
  }
  return <svg viewBox='0 0 40 40' style={roleIconSvg} aria-hidden='true'><circle cx='20' cy='13' r='5' fill='none' stroke={tone} strokeWidth='2.8' /><path d='M10 32c2-7 18-7 20 0' fill='none' stroke={tone} strokeWidth='2.8' strokeLinecap='round' /></svg>;
}

function toneBorder(tone: string) {
  if (tone === 'red') return '#FECACA';
  if (tone === 'amber') return '#FED7AA';
  return '#BFDBFE';
}

function toneBg(tone: string) {
  if (tone === 'red') return 'linear-gradient(180deg,#FFF7F7 0%,#FFFFFF 100%)';
  if (tone === 'amber') return 'linear-gradient(180deg,#FFFBEB 0%,#FFFFFF 100%)';
  return 'linear-gradient(180deg,#EFF6FF 0%,#FFFFFF 100%)';
}

function toneDot(tone: string) {
  if (tone === 'red') return '#DC2626';
  if (tone === 'amber') return '#D97706';
  return '#2563EB';
}

const page = { display: 'grid', gap: 16, padding: '0 0 28px', justifyItems: 'center' } as const;
const phoneSurface = { position: 'relative', overflow: 'hidden', width: 'min(100%, 430px)', minHeight: 'min(900px, 100dvh)', borderRadius: 34, padding: '20px 16px 0', background: '#FFFFFF', border: '1px solid rgba(15,23,42,.08)', boxShadow: '0 30px 90px rgba(15,23,42,.14)', display: 'grid', alignContent: 'start', gap: 20 } as const;
const backgroundImage = { position: 'absolute', inset: 0, opacity: .06, filter: 'blur(.2px)', pointerEvents: 'none' } as const;
const fieldBand = { position: 'absolute', left: -40, right: -40, bottom: 76, height: 220, background: 'repeating-linear-gradient(108deg, rgba(0,139,46,.55) 0 18px, rgba(236,172,31,.42) 18px 36px)', transform: 'rotate(-4deg)' } as const;
const elevatorShape = { position: 'absolute', right: 26, top: 92, width: 126, height: 180, borderRadius: 22, background: 'linear-gradient(180deg, rgba(15,23,42,.35), rgba(15,23,42,.10))', clipPath: 'polygon(18% 100%,18% 28%,30% 28%,30% 12%,70% 12%,70% 28%,82% 28%,82% 100%)' } as const;
const routeLine = { position: 'absolute', left: 44, right: 34, top: 248, height: 150, borderTop: '10px solid rgba(0,139,46,.7)', borderRight: '10px solid rgba(0,139,46,.45)', borderRadius: '0 80px 0 0', transform: 'rotate(-10deg)' } as const;
const truckShape = { position: 'absolute', left: 28, bottom: 168, width: 92, height: 44, borderRadius: 12, background: 'rgba(15,23,42,.28)', boxShadow: '68px 9px 0 -12px rgba(15,23,42,.24)' } as const;
const softOverlay = { position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(255,255,255,.96) 0%, rgba(255,255,255,.92) 42%, rgba(250,253,250,.94) 100%)', pointerEvents: 'none' } as const;
const topBar = { position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 } as const;
const brandLink = { textDecoration: 'none', color: '#071A16', display: 'inline-flex', alignItems: 'center', gap: 12, minWidth: 0 } as const;
const logoMark = { width: 46, height: 46, borderRadius: 13, background: 'linear-gradient(145deg,#0C1F1B 0%,#173D35 58%,#E7FFF0 100%)', boxShadow: '0 10px 22px rgba(0,139,46,.20)', position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flex: '0 0 auto' } as const;
const logoLetter = { color: '#FFFFFF', fontSize: 27, lineHeight: 1, fontWeight: 950, letterSpacing: '-.08em' } as const;
const logoChart = { position: 'absolute', left: 10, right: 8, bottom: 10, height: 18, borderLeft: '2px solid rgba(255,255,255,.78)', borderBottom: '2px solid rgba(255,255,255,.78)', background: 'linear-gradient(135deg, transparent 46%, #00A83B 47% 54%, transparent 55%)' } as const;
const brandName = { color: '#071A16', fontSize: 19, lineHeight: 1.05, fontWeight: 950, letterSpacing: '-.04em', whiteSpace: 'nowrap' } as const;
const bellLink = { width: 40, height: 40, borderRadius: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: '#071A16', background: 'rgba(255,255,255,.72)', border: '1px solid rgba(15,23,42,.08)', position: 'relative', fontSize: 22, fontWeight: 900 } as const;
const bellDot = { position: 'absolute', right: 9, top: 8, width: 9, height: 9, borderRadius: 999, background: '#008B2E', boxShadow: '0 0 0 3px #fff' } as const;
const heroSection = { position: 'relative', zIndex: 1, display: 'grid', gap: 18, paddingTop: 18 } as const;
const heroTitle = { margin: 0, display: 'grid', gap: 2, color: '#061A16', fontSize: 'clamp(42px, 10.5vw, 56px)', lineHeight: .96, letterSpacing: '-.075em', fontWeight: 950 } as const;
const heroAccent = { color: '#008B2E' } as const;
const heroLead = { margin: 0, maxWidth: 340, color: '#5B6773', fontSize: 18, lineHeight: 1.48, fontWeight: 650, letterSpacing: '-.015em' } as const;
const primaryCta = { minHeight: 62, borderRadius: 16, background: 'linear-gradient(180deg,#00A83B 0%,#008B2E 100%)', color: '#FFFFFF', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 22px', boxShadow: '0 16px 32px rgba(0,139,46,.26)', fontSize: 18, fontWeight: 950, letterSpacing: '-.015em' } as const;
const ctaArrow = { fontSize: 30, lineHeight: 1, transform: 'translateY(-1px)' } as const;
const roleSection = { position: 'relative', zIndex: 1, display: 'grid', gap: 12 } as const;
const roleSectionTitle = { margin: 0, color: '#071A16', fontSize: 19, lineHeight: 1.2, fontWeight: 950, letterSpacing: '-.035em' } as const;
const mobileRoleGrid = { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 } as const;
const mobileRoleCard = { minHeight: 126, textDecoration: 'none', color: '#071A16', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 7, padding: '14px 8px 12px', borderRadius: 15, background: 'rgba(255,255,255,.78)', border: '1px solid rgba(15,23,42,.07)', boxShadow: '0 8px 22px rgba(15,23,42,.055)', backdropFilter: 'blur(10px)' } as const;
const roleIconSvg = { width: 38, height: 38, display: 'block' } as const;
const mobileRoleTitle = { color: '#061A16', fontSize: 13.5, lineHeight: 1.12, fontWeight: 950, textAlign: 'center', letterSpacing: '-.02em' } as const;
const mobileRoleText = { color: '#66717C', fontSize: 11.3, lineHeight: 1.25, fontWeight: 650, textAlign: 'center' } as const;
const moreRoles = { border: '1px solid rgba(15,23,42,.07)', borderRadius: 16, background: 'rgba(255,255,255,.70)', padding: '0 12px' } as const;
const moreRolesSummary = { cursor: 'pointer', listStyle: 'none', minHeight: 42, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#0F2A23', fontSize: 13, fontWeight: 900 } as const;
const secondaryRoleGrid = { display: 'grid', gap: 8, padding: '0 0 12px' } as const;
const secondaryRoleCard = { textDecoration: 'none', color: '#071A16', display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: 10, alignItems: 'start', padding: 10, borderRadius: 13, background: '#FFFFFF', border: '1px solid rgba(15,23,42,.06)' } as const;
const secondaryRoleDot = { width: 10, height: 10, borderRadius: 999, marginTop: 5 } as const;
const secondaryRoleBody = { minWidth: 0, display: 'grid', gap: 2 } as const;
const secondaryRoleTitle = { color: '#071A16', fontSize: 13, lineHeight: 1.15, fontWeight: 950 } as const;
const secondaryRoleText = { color: '#66717C', fontSize: 12, lineHeight: 1.3, fontWeight: 650 } as const;
const trustBanner = { position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', alignItems: 'center', gap: 12, padding: 13, borderRadius: 18, background: 'linear-gradient(180deg, rgba(241,252,244,.92) 0%, rgba(255,255,255,.90) 100%)', border: '1px solid rgba(0,139,46,.12)', boxShadow: '0 12px 26px rgba(15,23,42,.055)' } as const;
const trustShield = { width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(180deg,#19B84D 0%,#008B2E 100%)', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 22px rgba(0,139,46,.22)', fontSize: 25, fontWeight: 950 } as const;
const trustCopy = { minWidth: 0, display: 'grid', gap: 3 } as const;
const trustTitle = { color: '#071A16', fontSize: 15, lineHeight: 1.15, fontWeight: 950, letterSpacing: '-.025em' } as const;
const trustText = { color: '#5B6773', fontSize: 12.5, lineHeight: 1.35, fontWeight: 650 } as const;
const trustChart = { width: 66, height: 44, display: 'flex', alignItems: 'end', gap: 6, opacity: .55 } as const;
const bottomNav = { position: 'sticky', zIndex: 2, bottom: 0, margin: '0 -16px', padding: '10px 12px 14px', minHeight: 76, display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 4, background: 'rgba(255,255,255,.94)', borderTop: '1px solid rgba(15,23,42,.07)', boxShadow: '0 -14px 30px rgba(15,23,42,.06)', backdropFilter: 'blur(18px)' } as const;
const bottomNavItem = { textDecoration: 'none', color: '#6B7280', display: 'grid', justifyItems: 'center', gap: 3, fontSize: 11.5, lineHeight: 1.1, fontWeight: 750 } as const;
const bottomNavItemActive = { ...bottomNavItem, color: '#008B2E', fontWeight: 950 } as const;
const bottomNavIcon = { width: 25, height: 25, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, lineHeight: 1 } as const;
const eyebrow = { color: '#0A7A5F', fontSize: 11, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '.08em' } as const;
const h2 = { margin: 0, color: '#0F1419', fontSize: 20, lineHeight: 1.15, letterSpacing: '-.025em', fontWeight: 950 } as const;
const moneyCard = { background: '#fff', border: '1px solid rgba(37,99,235,.16)', borderRadius: 20, padding: 16, display: 'grid', gap: 6 } as const;
const maturityCard = { background: 'rgba(255,255,255,.72)', border: '1px solid #D7DEE3', borderRadius: 20, padding: 16, display: 'grid', gap: 7 } as const;
const maturityTitle = { color: '#0F1419', fontSize: 15, lineHeight: 1.2, fontWeight: 950 } as const;
const disabledAction = { minHeight: 46, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 15, background: '#F1F5F9', color: 'var(--pc-text-muted, #64748B)', fontSize: 14, fontWeight: 900 } as const;
const controlAction = { minHeight: 46, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 15, background: '#008B2E', color: '#FFFFFF', textDecoration: 'none', padding: '0 16px', fontSize: 14, fontWeight: 950 } as const;
const ghostAction = { textDecoration: 'none', minHeight: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '8px 11px', borderRadius: 12, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', fontSize: 12, fontWeight: 850, whiteSpace: 'nowrap' } as const;
const pathCard = { width: 'min(100%, 980px)', background: '#0F1419', borderRadius: 22, padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(118px,1fr))', gap: 8 } as const;
const pathStep = { display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', alignItems: 'center', gap: 8, minHeight: 44, padding: '8px 9px', borderRadius: 14, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.10)' } as const;
const pathNumber = { width: 22, height: 22, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', color: '#0F1419', fontSize: 11, fontWeight: 950 } as const;
const pathText = { color: '#F8FAFC', fontSize: 12, lineHeight: 1.2, fontWeight: 850 } as const;
const cardLabel = { color: 'var(--pc-text-muted, #64748B)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.07em' } as const;
const moneyValue = { color: '#0F1419', fontSize: 34, lineHeight: 1, fontWeight: 950, letterSpacing: '-.045em' } as const;
const cardText = { color: 'var(--pc-text-muted, #64748B)', fontSize: 13, lineHeight: 1.4, fontWeight: 700 } as const;
const workGrid = { display: 'grid', gridTemplateColumns: 'minmax(0,1.08fr) minmax(280px,.92fr)', gap: 12, alignItems: 'start' } as const;
const panel = { background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 24, padding: 16, display: 'grid', gap: 10 } as const;
const sectionHead = { display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 10 } as const;
const blockerCard = { textDecoration: 'none', display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: 12, borderRadius: 18, border: '1px solid' } as const;
const blockerBody = { minWidth: 0, display: 'grid', gap: 5 } as const;
const rank = { width: 32, height: 32, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', color: '#0F1419', fontSize: 12, fontWeight: 950 } as const;
const blockerTitle = { color: '#0F1419', fontSize: 15, lineHeight: 1.25, fontWeight: 950, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as const;
const dot = { width: 10, height: 10, borderRadius: 999, boxShadow: '0 0 0 4px rgba(15,23,42,.04)' } as const;
const roleCard = { textDecoration: 'none', color: 'inherit', display: 'grid', gap: 8, padding: 13, borderRadius: 16, border: '1px solid var(--pc-border, #E4E6EA)', background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFC 100%)' } as const;
const roleTitle = { color: '#0F1419', fontSize: 15, lineHeight: 1.2, fontWeight: 950 } as const;
const roleAction = { color: '#0A7A5F', fontSize: 12, lineHeight: 1.35, fontWeight: 850 } as const;
const emptyState = { minHeight: 74, borderRadius: 18, padding: 14, border: '1px dashed #CBD5E1', background: '#F8FAFC', color: 'var(--pc-text-muted, #64748B)', fontSize: 13, lineHeight: 1.45, fontWeight: 750 } as const;
