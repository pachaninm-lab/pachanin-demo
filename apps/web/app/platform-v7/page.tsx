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

const navItems = [
  { label: 'Главная', href: '/platform-v7', icon: 'home', active: true },
  { label: 'Сделки', href: '/platform-v7/deals', icon: 'folder', active: false },
  { label: 'Уведомления', href: '/platform-v7/notifications', icon: 'bell', active: false },
  { label: 'Чаты', href: '/platform-v7/support', icon: 'chat', active: false },
  { label: 'Профиль', href: '/platform-v7/profile', icon: 'user', active: false },
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

      <div aria-hidden='true' className='pc-v7-desktop-bg' />
      <div aria-hidden='true' className='pc-v7-mobile-bg pc-v7-mobile-field' />
      <div aria-hidden='true' className='pc-v7-mobile-bg pc-v7-mobile-elevator' />
      <div aria-hidden='true' className='pc-v7-mobile-bg pc-v7-mobile-route' />
      <div aria-hidden='true' className='pc-v7-mobile-bg pc-v7-mobile-truck' />
      <div aria-hidden='true' className='pc-v7-bg-soft' />

      <section aria-label='Главный экран выбора роли' className='pc-v7-entry-hero'>
        <div className='pc-v7-hero-copy'>
          <span className='pc-v7-kicker'>Платформа исполнения зерновой сделки по ролям</span>
          <h1 className='pc-v7-title'>
            <span>Одна сделка.</span>
            <span className='pc-v7-title-accent'>Полный контроль.</span>
          </h1>
          <p className='pc-v7-lead'>Условия, документы, логистика, приёмка, качество, деньги, спор и доказательства — в одном управляемом процессе.</p>

          <div className='pc-v7-actions'>
            <Link href='/platform-v7/seller/batches/new' className='pc-v7-cta'>
              <InlineIcon name='doc' />
              <span>Создать сделку</span>
              <span aria-hidden='true' className='pc-v7-arrow'>→</span>
            </Link>
            <Link href='/platform-v7/lots/create' className='pc-v7-secondary-action'>
              <InlineIcon name='box' />
              <span>Выставить партию</span>
            </Link>
            <Link href='/platform-v7/procurement' className='pc-v7-secondary-action'>
              <InlineIcon name='request' />
              <span>Создать запрос на закупку</span>
            </Link>
          </div>

          <Link href='/platform-v7/execution-map' className='pc-v7-how'>
            <span aria-hidden='true'>▷</span>
            <span>Как это работает</span>
          </Link>
          <p className='pc-v7-access-note'>После входа каждый участник получает доступ только к своему кабинету и рабочим действиям своей роли.</p>
        </div>

        <aside className='pc-v7-process-card' aria-label='Единый процесс исполнения'>
          <strong>Единый управляемый процесс исполнения</strong>
          <div className='pc-v7-process-row'>
            {processSteps.map((step, index) => (
              <div key={step.label} className='pc-v7-process-step'>
                <span className='pc-v7-process-icon'><InlineIcon name={step.icon} /></span>
                <span className='pc-v7-process-number'>{index + 1}</span>
                <span className='pc-v7-process-label'>{step.label}</span>
              </div>
            ))}
          </div>
          <div className='pc-v7-process-proof'>
            <span><InlineIcon name='shield' />Прозрачность и контроль в реальном времени</span>
            <span><InlineIcon name='doc' />Доказательная база на каждом этапе</span>
            <span><InlineIcon name='lock' />Доступ по ролям и полномочиям</span>
          </div>
        </aside>
      </section>

      <section aria-label='Выберите свою роль' className='pc-v7-role-section'>
        <h2 className='pc-v7-section-title'>Выберите свою роль</h2>

        <div className='pc-v7-role-groups'>
          <RoleGroup title='Основные участники' icon='users' roles={orderedRoles.filter((role) => ['Продавец', 'Покупатель'].includes(role.title))} />
          <RoleGroup title='Исполнение' icon='truck' roles={orderedRoles.filter((role) => ['Логистика', 'Водитель', 'Элеватор', 'Лаборатория', 'Сюрвейер'].includes(role.title))} />
          <RoleGroup title='Контроль и управление' icon='shield' roles={orderedRoles.filter((role) => ['Банк', 'Оператор', 'Руководитель'].includes(role.title))} />
        </div>

        <div className='pc-v7-mobile-role-grid'>
          {visibleRoles.map((role) => (
            <RoleCard key={role.href} role={role} compact />
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

      <section aria-label='Доверие и контроль' className='pc-v7-trust-strip'>
        <div><InlineIcon name='lock' /><strong>Ролевая изоляция</strong><span>Каждый видит только свои данные и операции</span></div>
        <div><InlineIcon name='clipboard' /><strong>Журнал действий</strong><span>События фиксируются и не теряются</span></div>
        <div><InlineIcon name='evidence' /><strong>Доказательная база</strong><span>Файлы, документы, подписи, отметки о времени</span></div>
        <div><InlineIcon name='puzzle' /><strong>Готовность к интеграциям</strong><span>ФГИС, ЭДО, ЭПД, банк и внешние контуры</span></div>
        <div><InlineIcon name='shield' /><strong>Надёжность и безопасность</strong><span>Контур готовности без fake-live заявлений</span></div>
      </section>

      <section aria-label='Уточнение по внешним контурам' className='pc-v7-integration-note'>
        <span>Внешние контуры подключаются по договорам и доступам. Текущий контур готов к подключению внешних систем.</span>
        <Link href='/platform-v7/connectors'>Подробнее об интеграциях →</Link>
      </section>

      <nav aria-label='Основная мобильная навигация' className='pc-v7-bottom-tabs'>
        {navItems.map((item) => (
          <Link key={item.label} href={item.href} className={item.active ? 'active' : undefined}>
            <InlineIcon name={item.icon} />
            <small>{item.label}</small>
          </Link>
        ))}
      </nav>
    </main>
  );
}

function RoleGroup({ title, icon, roles }: { readonly title: string; readonly icon: IconName; readonly roles: ReadonlyArray<{ readonly title: string; readonly href: string }> }) {
  return (
    <div className='pc-v7-role-group'>
      <h3><InlineIcon name={icon} />{title}</h3>
      <div className='pc-v7-role-grid'>
        {roles.map((role) => (
          <RoleCard key={role.href} role={role} />
        ))}
      </div>
    </div>
  );
}

function RoleCard({ role, compact = false }: { readonly role: { readonly title: string; readonly href: string }; readonly compact?: boolean }) {
  return (
    <Link href={role.href} className={compact ? 'pc-v7-role-card pc-v7-role-card-compact' : 'pc-v7-role-card'}>
      <RoleGlyph title={role.title} />
      <strong>{role.title}</strong>
      <span>{shortRoleFocus(role.title)}</span>
      <i aria-hidden='true'>→</i>
    </Link>
  );
}

function shortRoleFocus(title: string) {
  if (title === 'Продавец') return 'Партии, документы, деньги';
  if (title === 'Покупатель') return 'RFQ, поставки, качество';
  if (title === 'Логистика') return 'Рейс, маршрут, документы';
  if (title === 'Водитель') return 'Рейс, маршрут, фото';
  if (title === 'Элеватор') return 'Приёмка, хранение, отгрузка';
  if (title === 'Лаборатория') return 'Анализы, качество, сертификаты';
  if (title === 'Банк') return 'Финансирование, документы';
  if (title === 'Сюрвейер') return 'Осмотр, отчёт, верификация';
  if (title === 'Оператор') return 'Мониторинг, поддержка';
  if (title === 'Руководитель') return 'Аналитика, управление';
  if (title === 'Комплаенс') return 'Допуск, риски, правила';
  if (title === 'Арбитр') return 'Споры, доказательства';
  return 'Контур действий';
}

type IconName =
  | 'handshake'
  | 'doc'
  | 'truck'
  | 'warehouse'
  | 'grain'
  | 'shield'
  | 'money'
  | 'scale'
  | 'lock'
  | 'box'
  | 'request'
  | 'users'
  | 'clipboard'
  | 'evidence'
  | 'puzzle'
  | 'home'
  | 'folder'
  | 'bell'
  | 'chat'
  | 'user';

function InlineIcon({ name }: { readonly name: IconName | string }) {
  const stroke = 'currentColor';
  if (name === 'doc' || name === 'request') return <svg viewBox='0 0 24 24' aria-hidden='true'><path d='M7 3h7l4 4v14H7Z' fill='none' stroke={stroke} strokeWidth='1.8' strokeLinejoin='round' /><path d='M14 3v5h5M9 13h6M9 17h5' fill='none' stroke={stroke} strokeWidth='1.8' strokeLinecap='round' /></svg>;
  if (name === 'truck') return <svg viewBox='0 0 24 24' aria-hidden='true'><path d='M3 7h11v9H3Zm11 3h4l3 3v3h-7Z' fill='none' stroke={stroke} strokeWidth='1.8' strokeLinejoin='round' /><circle cx='7' cy='18' r='1.6' fill='none' stroke={stroke} strokeWidth='1.8' /><circle cx='18' cy='18' r='1.6' fill='none' stroke={stroke} strokeWidth='1.8' /></svg>;
  if (name === 'warehouse') return <svg viewBox='0 0 24 24' aria-hidden='true'><path d='M3 11 12 5l9 6v9H3Z' fill='none' stroke={stroke} strokeWidth='1.8' strokeLinejoin='round' /><path d='M8 20v-7h8v7M8 15h8' fill='none' stroke={stroke} strokeWidth='1.8' strokeLinecap='round' /></svg>;
  if (name === 'grain') return <svg viewBox='0 0 24 24' aria-hidden='true'><path d='M12 21V5M8 8c0-3 4-4 4-4s4 1 4 4M8 12c0-3 4-4 4-4s4 1 4 4M8 16c0-3 4-4 4-4s4 1 4 4' fill='none' stroke={stroke} strokeWidth='1.7' strokeLinecap='round' strokeLinejoin='round' /></svg>;
  if (name === 'shield' || name === 'evidence') return <svg viewBox='0 0 24 24' aria-hidden='true'><path d='M12 3 20 7v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7Z' fill='none' stroke={stroke} strokeWidth='1.8' strokeLinejoin='round' /><path d='m8.5 12 2.2 2.2 4.8-5' fill='none' stroke={stroke} strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' /></svg>;
  if (name === 'money') return <svg viewBox='0 0 24 24' aria-hidden='true'><path d='M4 7h16v10H4Z' fill='none' stroke={stroke} strokeWidth='1.8' /><circle cx='12' cy='12' r='2.4' fill='none' stroke={stroke} strokeWidth='1.8' /><path d='M7 10v4M17 10v4' stroke={stroke} strokeWidth='1.8' strokeLinecap='round' /></svg>;
  if (name === 'scale') return <svg viewBox='0 0 24 24' aria-hidden='true'><path d='M12 4v17M6 7h12M8 7 4 15h8Zm8 0-4 8h8Z' fill='none' stroke={stroke} strokeWidth='1.7' strokeLinecap='round' strokeLinejoin='round' /></svg>;
  if (name === 'lock') return <svg viewBox='0 0 24 24' aria-hidden='true'><path d='M6 10h12v10H6Zm3 0V7a3 3 0 0 1 6 0v3' fill='none' stroke={stroke} strokeWidth='1.8' strokeLinejoin='round' /></svg>;
  if (name === 'handshake') return <svg viewBox='0 0 24 24' aria-hidden='true'><path d='m8 12 3 3c1 1 2 1 3 0l4-4M3 12l4-4 4 4M21 12l-4-4-4 4' fill='none' stroke={stroke} strokeWidth='1.7' strokeLinecap='round' strokeLinejoin='round' /></svg>;
  if (name === 'box') return <svg viewBox='0 0 24 24' aria-hidden='true'><path d='M4 8 12 4l8 4v9l-8 4-8-4Z' fill='none' stroke={stroke} strokeWidth='1.8' strokeLinejoin='round' /><path d='m4 8 8 4 8-4M12 12v9' fill='none' stroke={stroke} strokeWidth='1.8' /></svg>;
  if (name === 'users') return <svg viewBox='0 0 24 24' aria-hidden='true'><circle cx='9' cy='8' r='3' fill='none' stroke={stroke} strokeWidth='1.8' /><path d='M3 20c1-5 11-5 12 0M17 11a3 3 0 0 0 0-6M17 14c2 .4 3.5 2 4 5' fill='none' stroke={stroke} strokeWidth='1.8' strokeLinecap='round' /></svg>;
  if (name === 'clipboard') return <svg viewBox='0 0 24 24' aria-hidden='true'><path d='M8 4h8v3H8Zm-2 2h12v15H6Z' fill='none' stroke={stroke} strokeWidth='1.8' strokeLinejoin='round' /><path d='M9 12h6M9 16h6' stroke={stroke} strokeWidth='1.8' strokeLinecap='round' /></svg>;
  if (name === 'puzzle') return <svg viewBox='0 0 24 24' aria-hidden='true'><path d='M9 3h6v5h3v6h-5v3H7v-5H3V6h6Z' fill='none' stroke={stroke} strokeWidth='1.8' strokeLinejoin='round' /></svg>;
  if (name === 'home') return <svg viewBox='0 0 24 24' aria-hidden='true'><path d='m4 11 8-7 8 7v9H6v-6h12' fill='none' stroke={stroke} strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' /></svg>;
  if (name === 'folder') return <svg viewBox='0 0 24 24' aria-hidden='true'><path d='M3 7h7l2 3h9v9H3Z' fill='none' stroke={stroke} strokeWidth='1.8' strokeLinejoin='round' /></svg>;
  if (name === 'bell') return <svg viewBox='0 0 24 24' aria-hidden='true'><path d='M6 17h12l-2-3V9a4 4 0 0 0-8 0v5Zm4 3h4' fill='none' stroke={stroke} strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' /></svg>;
  if (name === 'chat') return <svg viewBox='0 0 24 24' aria-hidden='true'><path d='M5 6h14v10H9l-4 4Z' fill='none' stroke={stroke} strokeWidth='1.8' strokeLinejoin='round' /></svg>;
  if (name === 'user') return <svg viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='8' r='3' fill='none' stroke={stroke} strokeWidth='1.8' /><path d='M5 21c1.4-6 12.6-6 14 0' fill='none' stroke={stroke} strokeWidth='1.8' strokeLinecap='round' /></svg>;
  return <svg viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='8' fill='none' stroke={stroke} strokeWidth='1.8' /></svg>;
}

function RoleGlyph({ title }: { readonly title: string }) {
  const tone = '#0A7A43';
  if (title === 'Продавец') return <svg viewBox='0 0 40 40' aria-hidden='true'><path d='M31 9C18 10 9 18 9 31c13-1 22-9 22-22Z' fill='none' stroke={tone} strokeWidth='2.8' /><path d='M12 28 28 12' stroke={tone} strokeWidth='2.6' strokeLinecap='round' /></svg>;
  if (title === 'Покупатель') return <svg viewBox='0 0 40 40' aria-hidden='true'><path d='M10 12h4l3 15h13l3-10H16' fill='none' stroke={tone} strokeWidth='2.8' strokeLinecap='round' strokeLinejoin='round' /><circle cx='19' cy='32' r='2' fill={tone} /><circle cx='30' cy='32' r='2' fill={tone} /></svg>;
  if (title === 'Логистика') return <svg viewBox='0 0 40 40' aria-hidden='true'><path d='M8 14h17v14H8Z' fill='none' stroke={tone} strokeWidth='2.8' /><path d='M25 18h5l4 5v5h-9Z' fill='none' stroke={tone} strokeWidth='2.8' strokeLinejoin='round' /><circle cx='15' cy='31' r='2' fill={tone} /><circle cx='30' cy='31' r='2' fill={tone} /></svg>;
  if (title === 'Водитель') return <svg viewBox='0 0 40 40' aria-hidden='true'><circle cx='20' cy='20' r='14' fill='none' stroke={tone} strokeWidth='2.8' /><circle cx='20' cy='20' r='4' fill='none' stroke={tone} strokeWidth='2.8' /><path d='M9 20h9m4 0h9M20 9v7m0 8v7' stroke={tone} strokeWidth='2.5' strokeLinecap='round' /></svg>;
  if (title === 'Банк') return <svg viewBox='0 0 40 40' aria-hidden='true'><path d='M7 17 20 9l13 8Z' fill='none' stroke={tone} strokeWidth='2.8' strokeLinejoin='round' /><path d='M10 18v12m7-12v12m7-12v12m7-12v12M7 31h26' stroke={tone} strokeWidth='2.6' strokeLinecap='round' /></svg>;
  if (title === 'Сюрвейер') return <svg viewBox='0 0 40 40' aria-hidden='true'><path d='M20 7 31 12v8c0 8-5 12-11 14-6-2-11-6-11-14v-8Z' fill='none' stroke={tone} strokeWidth='2.8' /><path d='m14 20 4 4 8-9' fill='none' stroke={tone} strokeWidth='2.8' strokeLinecap='round' strokeLinejoin='round' /></svg>;
  if (title === 'Оператор') return <svg viewBox='0 0 40 40' aria-hidden='true'><path d='M10 24v-5a10 10 0 0 1 20 0v5' fill='none' stroke={tone} strokeWidth='2.8' strokeLinecap='round' /><path d='M10 24h5v8h-5Zm15 0h5v8h-5Z' fill='none' stroke={tone} strokeWidth='2.8' /></svg>;
  return <svg viewBox='0 0 40 40' aria-hidden='true'><circle cx='20' cy='13' r='5' fill='none' stroke={tone} strokeWidth='2.8' /><path d='M10 32c2-7 18-7 20 0' fill='none' stroke={tone} strokeWidth='2.8' strokeLinecap='round' /></svg>;
}

const entryCss = `
.pc-shell-root-v4:has(.pc-v7-entry-page) .pc-v4-main { max-width: none !important; margin: 0 !important; padding-left: 0 !important; padding-right: 0 !important; }
.pc-shell-root-v4:has(.pc-v7-entry-page) .pc-v4-pilot-note { display: none !important; }
.pc-v7-entry-page {
  --entry-green: #0A7A43;
  --entry-green-strong: #007A2F;
  --entry-ink: #0B1826;
  --entry-muted: #5F6B7A;
  --entry-border: rgba(25, 54, 39, .13);
  position: relative;
  overflow: hidden;
  min-height: calc(100dvh - var(--pc-header-offset, 92px));
  padding: clamp(22px, 4vw, 42px) clamp(18px, 3vw, 42px) calc(env(safe-area-inset-bottom) + 96px);
  background: radial-gradient(circle at 72% 9%, rgba(227, 170, 84, .24), transparent 32%), linear-gradient(180deg, #FFFCF6 0%, #FFFFFF 54%, #FDFBF5 100%);
  color: var(--entry-ink);
}
.pc-v7-desktop-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: .72;
  background:
    linear-gradient(90deg, rgba(255,255,255,.98) 0%, rgba(255,255,255,.92) 35%, rgba(255,249,236,.45) 58%, rgba(255,255,255,.96) 100%),
    linear-gradient(0deg, rgba(255,255,255,.86), rgba(255,255,255,.18) 42%, rgba(255,255,255,.70) 100%),
    repeating-linear-gradient(102deg, rgba(204,144,45,.26) 0 18px, rgba(231,190,92,.20) 18px 36px, rgba(255,255,255,.22) 36px 54px);
}
.pc-v7-desktop-bg::after {
  content: '';
  position: absolute;
  right: 3vw;
  top: 46px;
  width: min(52vw, 720px);
  height: 250px;
  opacity: .30;
  filter: blur(.2px);
  background: linear-gradient(180deg, rgba(55,64,55,.70), rgba(87,104,86,.26));
  clip-path: polygon(0 82%, 4% 45%, 11% 45%, 11% 26%, 21% 26%, 21% 45%, 28% 45%, 28% 82%, 34% 82%, 37% 45%, 44% 45%, 44% 20%, 56% 20%, 56% 45%, 63% 45%, 66% 82%, 72% 82%, 75% 45%, 82% 45%, 82% 25%, 92% 25%, 92% 45%, 98% 45%, 100% 82%);
}
.pc-v7-bg-soft,
.pc-v7-mobile-bg { display: none; }
.pc-v7-entry-hero,
.pc-v7-role-section,
.pc-v7-trust-strip,
.pc-v7-integration-note { position: relative; z-index: 1; max-width: 1600px; margin: 0 auto; }
.pc-v7-entry-hero { display: grid; grid-template-columns: minmax(360px, .72fr) minmax(520px, 1fr); gap: clamp(34px, 6vw, 92px); align-items: center; min-height: 520px; }
.pc-v7-hero-copy { display: grid; gap: 18px; align-content: center; }
.pc-v7-kicker { width: max-content; max-width: 100%; display: inline-flex; align-items: center; min-height: 34px; padding: 0 17px; border-radius: 999px; border: 1px solid rgba(33, 70, 49, .16); background: rgba(255,255,255,.72); color: #285E44; font-size: 14px; font-weight: 740; box-shadow: 0 10px 24px rgba(75, 55, 18, .05); }
.pc-v7-title { margin: 0; display: grid; color: #102033; font-family: Georgia, 'Times New Roman', serif; font-size: clamp(62px, 5.5vw, 92px); line-height: .92; letter-spacing: -.055em; font-weight: 700; }
.pc-v7-title-accent { color: var(--entry-green); }
.pc-v7-lead { margin: 0; max-width: 610px; color: #4F5D6E; font-size: clamp(18px, 1.35vw, 23px); line-height: 1.55; font-weight: 560; letter-spacing: -.012em; }
.pc-v7-actions { display: grid; grid-template-columns: minmax(280px, 390px) repeat(2, minmax(190px, 230px)); gap: 14px; align-items: center; margin-top: 4px; }
.pc-v7-cta,
.pc-v7-secondary-action { min-height: 58px; border-radius: 12px; display: inline-flex; align-items: center; gap: 12px; text-decoration: none; font-size: 16px; font-weight: 850; }
.pc-v7-cta { justify-content: flex-start; padding: 0 18px; color: #fff; background: linear-gradient(180deg, #0EA550 0%, #087D3D 100%); box-shadow: 0 16px 32px rgba(10,122,67,.22); }
.pc-v7-cta svg,
.pc-v7-secondary-action svg { width: 22px; height: 22px; flex: 0 0 auto; }
.pc-v7-arrow { margin-left: auto; font-size: 26px; line-height: 1; }
.pc-v7-secondary-action { justify-content: center; padding: 0 16px; color: #102033; background: rgba(255,255,255,.84); border: 1px solid var(--entry-border); box-shadow: 0 12px 22px rgba(75,55,18,.055); }
.pc-v7-how { width: max-content; display: inline-flex; align-items: center; gap: 11px; color: #26384B; text-decoration: none; font-size: 15px; font-weight: 760; }
.pc-v7-how span:first-child { width: 28px; height: 28px; border-radius: 999px; border: 1px solid var(--entry-border); display: inline-flex; align-items: center; justify-content: center; color: var(--entry-green); }
.pc-v7-access-note { margin: 0; max-width: 620px; display: grid; color: #607083; font-size: 13px; line-height: 1.48; font-weight: 540; }
.pc-v7-access-note::before { content: '🔒'; margin-right: 8px; }
.pc-v7-process-card { min-height: 390px; padding: 34px 34px 28px; border-radius: 34px; border: 1px solid rgba(255,255,255,.72); background: color-mix(in srgb, #FFF6E4 62%, transparent); backdrop-filter: blur(18px); box-shadow: 0 24px 70px rgba(72, 48, 12, .13); display: grid; gap: 26px; align-content: center; }
.pc-v7-process-card > strong { color: var(--entry-green); text-align: center; font-size: 18px; line-height: 1.2; font-weight: 860; }
.pc-v7-process-row { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 12px; align-items: start; }
.pc-v7-process-step { min-width: 0; display: grid; justify-items: center; gap: 10px; text-align: center; position: relative; }
.pc-v7-process-step:not(:last-child)::after { content: ''; position: absolute; top: 39px; left: calc(50% + 38px); width: calc(100% - 30px); border-top: 1px solid rgba(10,122,67,.34); }
.pc-v7-process-icon { width: 72px; height: 72px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; color: var(--entry-green); background: rgba(255,255,255,.72); border: 1px solid rgba(10,122,67,.15); box-shadow: 0 12px 26px rgba(76,52,14,.10); }
.pc-v7-process-icon svg { width: 31px; height: 31px; }
.pc-v7-process-number { width: 27px; height: 27px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; color: #6D5D45; background: rgba(255,255,255,.76); border: 1px solid rgba(106,76,30,.16); font-size: 12px; font-weight: 850; }
.pc-v7-process-label { min-height: 42px; color: #332E27; font-size: 13px; line-height: 1.25; font-weight: 650; }
.pc-v7-process-proof { border-top: 1px solid rgba(96,72,32,.14); padding-top: 18px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.pc-v7-process-proof span { display: grid; grid-template-columns: auto minmax(0,1fr); gap: 10px; align-items: center; color: #334233; font-size: 13px; line-height: 1.35; font-weight: 640; }
.pc-v7-process-proof svg { width: 28px; height: 28px; color: var(--entry-green); }
.pc-v7-role-section { display: grid; gap: 20px; margin-top: 6px; }
.pc-v7-section-title { margin: 0; color: #0E1827; font-size: 24px; line-height: 1.2; font-weight: 930; letter-spacing: -.03em; }
.pc-v7-role-groups { display: grid; grid-template-columns: 1fr 1.92fr 1.15fr; gap: 18px; }
.pc-v7-role-group { padding: 16px; border-radius: 16px; border: 1px solid var(--entry-border); background: rgba(255,255,255,.78); box-shadow: 0 12px 30px rgba(75,55,18,.055); display: grid; gap: 14px; }
.pc-v7-role-group h3 { margin: 0; display: inline-flex; align-items: center; gap: 10px; color: #263327; font-size: 15px; font-weight: 890; }
.pc-v7-role-group h3 svg { width: 20px; height: 20px; color: var(--entry-green); }
.pc-v7-role-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(116px, 1fr)); gap: 12px; }
.pc-v7-role-card { min-width: 0; min-height: 138px; padding: 18px 10px 12px; border-radius: 12px; border: 1px solid rgba(25,54,39,.12); background: rgba(255,255,255,.88); box-shadow: 0 10px 22px rgba(75,55,18,.045); color: #0E1827; text-decoration: none; display: grid; justify-items: center; align-content: start; gap: 8px; text-align: center; position: relative; }
.pc-v7-role-card svg { width: 36px; height: 36px; color: var(--entry-green); }
.pc-v7-role-card strong { font-size: 14px; line-height: 1.15; font-weight: 900; }
.pc-v7-role-card span { color: #627181; font-size: 11.5px; line-height: 1.35; font-weight: 560; }
.pc-v7-role-card i { position: absolute; right: 12px; bottom: 10px; color: var(--entry-green); font-style: normal; font-size: 17px; }
.pc-v7-mobile-role-grid,
.pc-v7-more-roles { display: none; }
.pc-v7-trust-strip { margin-top: 18px; padding: 18px 20px; border-radius: 16px; border: 1px solid var(--entry-border); background: rgba(255,255,255,.80); box-shadow: 0 12px 30px rgba(75,55,18,.052); display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 14px; }
.pc-v7-trust-strip div { display: grid; grid-template-columns: auto minmax(0,1fr); grid-template-rows: auto auto; column-gap: 12px; align-items: center; }
.pc-v7-trust-strip svg { grid-row: 1 / span 2; width: 36px; height: 36px; color: var(--entry-green); }
.pc-v7-trust-strip strong { color: #253328; font-size: 14px; line-height: 1.15; font-weight: 880; }
.pc-v7-trust-strip span { color: #63707F; font-size: 12px; line-height: 1.35; font-weight: 560; }
.pc-v7-integration-note { margin-top: 18px; min-height: 54px; padding: 0 18px; border-radius: 14px; border: 1px solid rgba(197,135,44,.22); background: rgba(255,248,237,.78); display: flex; align-items: center; justify-content: space-between; gap: 18px; color: #5E6170; font-size: 14px; line-height: 1.35; }
.pc-v7-integration-note a { color: var(--entry-green); text-decoration: none; font-weight: 780; white-space: nowrap; }
.pc-v7-bottom-tabs { display: none; }
@media (max-width: 980px) {
  .pc-shell-root-v4:has(.pc-v7-entry-page) .pc-v4-meta,
  .pc-shell-root-v4:has(.pc-v7-entry-page) .pc-v4-pilot-note { display: none !important; }
  .pc-shell-root-v4:has(.pc-v7-entry-page) .pc-v4-main { padding-left: 0 !important; padding-right: 0 !important; }
  .pc-v7-entry-page {
    min-height: calc(100dvh - var(--pc-header-offset, 82px));
    padding: 0 18px calc(env(safe-area-inset-bottom) + 18px);
    background: #FFFFFF;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .pc-v7-desktop-bg { display: none; }
  .pc-v7-mobile-bg { display: block; position: absolute; pointer-events: none; opacity: .045; filter: blur(.45px); z-index: 0; }
  .pc-v7-mobile-field { left: -60px; right: -60px; bottom: 70px; height: 220px; transform: rotate(-5deg); background: repeating-linear-gradient(105deg, rgba(0,139,46,.78) 0 18px, rgba(198,147,32,.55) 18px 36px); }
  .pc-v7-mobile-elevator { right: 12px; top: 88px; width: 126px; height: 178px; background: rgba(15,23,42,.34); clip-path: polygon(18% 100%,18% 30%,30% 30%,30% 12%,70% 12%,70% 30%,82% 30%,82% 100%); }
  .pc-v7-mobile-route { left: 34px; right: 24px; top: 250px; height: 124px; border-top: 9px solid rgba(0,139,46,.65); border-right: 9px solid rgba(0,139,46,.42); border-radius: 0 72px 0 0; transform: rotate(-9deg); }
  .pc-v7-mobile-truck { left: 26px; bottom: 132px; width: 86px; height: 42px; border-radius: 12px; background: rgba(15,23,42,.26); }
  .pc-v7-bg-soft { display: block; position: absolute; inset: 0; z-index: 0; background: linear-gradient(180deg, rgba(255,255,255,.985) 0%, rgba(255,255,255,.95) 50%, rgba(250,253,250,.98) 100%); pointer-events: none; }
  .pc-v7-entry-hero, .pc-v7-role-section, .pc-v7-trust-strip, .pc-v7-integration-note { width: min(100%, 430px); margin-left: auto; margin-right: auto; }
  .pc-v7-entry-hero { display: block; min-height: auto; padding-top: 30px; }
  .pc-v7-hero-copy { gap: 18px; }
  .pc-v7-kicker, .pc-v7-process-card, .pc-v7-how, .pc-v7-access-note, .pc-v7-secondary-action, .pc-v7-role-groups, .pc-v7-integration-note { display: none; }
  .pc-v7-title { font-family: inherit; font-size: clamp(42px, 11.5vw, 56px); line-height: .94; letter-spacing: -.075em; font-weight: 950; color: #061A16; }
  .pc-v7-title-accent { color: #008B2E; }
  .pc-v7-lead { max-width: 350px; color: #5E6875; font-size: clamp(17px, 4.8vw, 20px); line-height: 1.45; font-weight: 620; }
  .pc-v7-actions { display: block; margin-top: 0; }
  .pc-v7-cta { min-height: 62px; width: 100%; border-radius: 16px; justify-content: center; padding: 0 22px; font-size: 18px; background: linear-gradient(180deg,#00A83B 0%,#008B2E 100%); }
  .pc-v7-cta svg { display: none; }
  .pc-v7-arrow { margin-left: auto; font-size: 30px; }
  .pc-v7-role-section { margin-top: 22px; display: grid; gap: 12px; }
  .pc-v7-section-title { font-size: 19px; color: #061A16; }
  .pc-v7-mobile-role-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; }
  .pc-v7-role-card-compact { min-height: 132px; padding: 13px 6px 11px; border-radius: 15px; gap: 7px; background: rgba(255,255,255,.88); border: 1px solid rgba(15,23,42,.075); box-shadow: 0 8px 20px rgba(15,23,42,.052); }
  .pc-v7-role-card-compact svg { width: 36px; height: 36px; }
  .pc-v7-role-card-compact strong { font-size: 12.6px; color: #061A16; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .pc-v7-role-card-compact span { color: #66717C; font-size: 10.6px; line-height: 1.21; font-weight: 640; }
  .pc-v7-role-card-compact i { display: none; }
  .pc-v7-more-roles { display: block; border: 1px solid rgba(15,23,42,.075); border-radius: 16px; background: rgba(255,255,255,.78); padding: 0 12px; }
  .pc-v7-more-roles summary { cursor: pointer; min-height: 42px; display: flex; align-items: center; color: #0F2A23; font-size: 13px; line-height: 1.2; font-weight: 900; list-style: none; }
  .pc-v7-more-roles summary::-webkit-details-marker { display: none; }
  .pc-v7-more-grid { display: grid; gap: 8px; padding-bottom: 12px; }
  .pc-v7-more-role { min-width: 0; display: grid; grid-template-columns: auto minmax(0,1fr); gap: 9px; align-items: start; text-decoration: none; color: #061A16; padding: 10px; border-radius: 13px; background: #fff; border: 1px solid rgba(15,23,42,.06); }
  .pc-v7-more-dot { width: 9px; height: 9px; border-radius: 50%; margin-top: 5px; }
  .pc-v7-more-role span:last-child { display: grid; gap: 2px; min-width: 0; }
  .pc-v7-more-role strong { font-size: 13px; line-height: 1.12; font-weight: 950; }
  .pc-v7-more-role small { color: #66717C; font-size: 12px; line-height: 1.3; font-weight: 650; }
  .pc-v7-trust-strip { margin-top: 20px; width: min(100%, 430px); display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 12px; padding: 13px; border-radius: 18px; background: linear-gradient(180deg, rgba(241,252,244,.92) 0%, rgba(255,255,255,.92) 100%); border: 1px solid rgba(0,139,46,.12); box-shadow: 0 10px 24px rgba(15,23,42,.052); }
  .pc-v7-trust-strip div { display: none; }
  .pc-v7-trust-strip div:first-child { display: grid; grid-template-columns: auto minmax(0,1fr); grid-template-rows: auto auto; column-gap: 12px; align-items: center; }
  .pc-v7-trust-strip div:first-child::after { content: ''; width: 58px; height: 34px; border-radius: 10px; background: linear-gradient(90deg, rgba(0,139,46,.22) 0 18%, transparent 18% 30%, rgba(0,139,46,.42) 30% 52%, transparent 52% 64%, rgba(0,139,46,.78) 64% 100%); grid-column: 3; grid-row: 1 / span 2; }
  .pc-v7-trust-strip svg { width: 46px; height: 46px; color: #fff; background: linear-gradient(180deg,#19B84D 0%,#008B2E 100%); border-radius: 16px; padding: 10px; box-shadow: 0 9px 20px rgba(0,139,46,.22); }
  .pc-v7-trust-strip strong { color: #061A16; font-size: 14.5px; line-height: 1.14; font-weight: 950; letter-spacing: -.02em; }
  .pc-v7-trust-strip span { color: #5E6875; font-size: 12.2px; line-height: 1.34; font-weight: 620; }
  .pc-v7-bottom-tabs { position: relative; z-index: 1; width: min(100%, 430px); margin: 0 auto; padding: 9px 0 calc(env(safe-area-inset-bottom) + 10px); display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 3px; border-top: 1px solid rgba(15,23,42,.07); background: rgba(255,255,255,.965); box-shadow: 0 -12px 28px rgba(15,23,42,.055); }
  .pc-v7-bottom-tabs a { min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-height: 48px; text-decoration: none; color: #6B7280; }
  .pc-v7-bottom-tabs svg { width: 20px; height: 20px; }
  .pc-v7-bottom-tabs small { max-width: 100%; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10.5px; line-height: 1; font-weight: 760; }
  .pc-v7-bottom-tabs a.active { color: #008B2E; }
}
@media (max-width: 389px) {
  .pc-v7-entry-page { padding-left: 14px; padding-right: 14px; }
  .pc-v7-title { font-size: 41px; }
  .pc-v7-mobile-role-grid { gap: 8px; }
  .pc-v7-role-card-compact { min-height: 124px; padding-left: 4px; padding-right: 4px; }
  .pc-v7-role-card-compact strong { font-size: 11.8px; }
  .pc-v7-role-card-compact span { font-size: 10px; }
  .pc-v7-trust-strip div:first-child::after { display: none; }
}
`;
