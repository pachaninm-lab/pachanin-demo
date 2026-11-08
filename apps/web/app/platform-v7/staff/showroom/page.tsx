import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import { parseStaffCapabilitiesContract } from '@/lib/platform-v7/staff-capabilities';
import {
  ALL_ROLE_EXECUTION_COCKPITS,
  type RoleExecutionCockpitModel,
} from '@/lib/platform-v7/role-execution-cockpit';
import { RoleExecutionCockpitPage } from '@/components/platform-v7/RoleExecutionCockpit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Режим показа — все кабинеты',
  robots: { index: false, follow: false, nocache: true },
};

const API_ORIGIN = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

const SHOWROOM_ROLES = [
  ['operator', 'Оператор'],
  ['buyer', 'Покупатель'],
  ['seller', 'Продавец'],
  ['logistics', 'Логистика'],
  ['driver', 'Водитель'],
  ['surveyor', 'Сюрвейер'],
  ['elevator', 'Элеватор'],
  ['lab', 'Лаборатория'],
  ['bank', 'Банк'],
  ['employee', 'Сотрудник организации'],
  ['arbitrator', 'Арбитр'],
  ['compliance', 'Комплаенс'],
  ['executive', 'Руководитель'],
] as const;

type ShowroomRole = (typeof SHOWROOM_ROLES)[number][0];
type CockpitRole = keyof typeof ALL_ROLE_EXECUTION_COCKPITS;

function isShowroomRole(value: unknown): value is ShowroomRole {
  return typeof value === 'string' && SHOWROOM_ROLES.some(([role]) => role === value);
}

function showroomCockpit(cockpit: RoleExecutionCockpitModel): RoleExecutionCockpitModel {
  return {
    ...cockpit,
    statuses: [
      ...cockpit.statuses,
      { label: 'SHOWROOM · тестовые данные', tone: 'info' },
    ],
    operations: cockpit.operations.map((operation) => ({
      ...operation,
      action: {
        label: 'Показ действия · без выполнения',
        disabled: true,
        tone: 'secondary',
      },
    })),
  };
}

async function requirePlatformOwner() {
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value || '';
  if (!accessToken) {
    redirect('/platform-v7/login?next=%2Fplatform-v7%2Fstaff%2Fshowroom');
  }
  if (!API_ORIGIN) redirect('/platform-v7/staff');

  let response: Response;
  try {
    response = await fetch(`${API_ORIGIN}/staff/capabilities/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(6_000),
    });
  } catch {
    redirect('/platform-v7/staff');
  }

  if (response.status === 401) {
    redirect('/platform-v7/login?next=%2Fplatform-v7%2Fstaff%2Fshowroom');
  }
  if (!response.ok) redirect('/platform-v7/staff');

  const contract = parseStaffCapabilitiesContract(await response.json().catch(() => null));
  if (
    !contract
    || !contract.roles.includes('PLATFORM_OWNER')
    || contract.authenticationAssurance.mfaVerified !== true
  ) {
    redirect('/platform-v7/staff');
  }
  return contract.identity;
}

function EmployeeShowroom() {
  const facts = [
    ['Организация', 'ООО «Золотое Поле Тест»'],
    ['Роль', 'GUEST · сотрудник организации'],
    ['Membership', 'ACTIVE · тестовый'],
    ['Tenant', 'tenant-showroom · синтетический'],
    ['Доступ', 'Профиль, команда, уведомления, назначенные задачи'],
    ['Ограничение', 'Нет реальных сделок, документов, денег и внешних интеграций'],
  ] as const;

  return (
    <section style={employeePanel} data-testid='owner-showroom-employee'>
      <div>
        <p style={eyebrow}>Сотрудник организации · SHOWROOM</p>
        <h2 style={employeeTitle}>Профиль сотрудника и доступ внутри организации</h2>
        <p style={employeeText}>
          Синтетический сотрудник находится в тестовой организации продавца. Это отдельная поверхность профиля,
          а не способ получить чужую бизнес-роль.
        </p>
      </div>
      <div style={factsGrid}>
        {facts.map(([label, value]) => (
          <article key={label} style={factCard}>
            <span style={factLabel}>{label}</span>
            <strong style={factValue}>{value}</strong>
          </article>
        ))}
      </div>
      <div style={disabledAction}>Действия отключены в режиме показа</div>
    </section>
  );
}

export default async function OwnerShowroomPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const identity = await requirePlatformOwner();
  const params = await searchParams;
  const selected: ShowroomRole = isShowroomRole(params.role) ? params.role : 'seller';
  const cockpit = selected === 'employee'
    ? null
    : showroomCockpit(ALL_ROLE_EXECUTION_COCKPITS[selected as CockpitRole]);

  return (
    <main style={page} data-testid='owner-showroom'>
      <header style={hero}>
        <div>
          <p style={eyebrow}>SHOWROOM · только владелец платформы</p>
          <h1 style={title}>Все 13 кабинетов для показа</h1>
          <p style={lead}>
            Один вход владельца с MFA. Ниже — синтетическая единая сделка и тестовые данные. Реальные организации,
            документы, деньги и бизнес-API в этот экран не подмешиваются.
          </p>
          <small style={ownerLine}>Владелец: {identity.email}</small>
        </div>
        <Link href='/platform-v7/staff' style={exitLink}>Выйти из режима показа</Link>
      </header>

      <section style={warning} role='status'>
        <strong>TEST / SHOWROOM</strong>
        <span>Все кнопки, которые могли бы изменить состояние сделки, отключены. Это безопасная презентационная поверхность.</span>
      </section>

      <nav style={roleGrid} aria-label='Кабинеты режима показа'>
        {SHOWROOM_ROLES.map(([role, label], index) => {
          const active = role === selected;
          return (
            <Link
              key={role}
              href={`/platform-v7/staff/showroom?role=${role}`}
              style={{ ...roleCard, ...(active ? roleCardActive : {}) }}
              aria-current={active ? 'page' : undefined}
            >
              <span style={roleNumber}>{String(index + 1).padStart(2, '0')}</span>
              <strong>{label}</strong>
            </Link>
          );
        })}
      </nav>

      <section style={surfaceWrap}>
        {selected === 'employee' ? (
          <EmployeeShowroom />
        ) : cockpit ? (
          <RoleExecutionCockpitPage cockpit={cockpit} />
        ) : null}
      </section>
    </main>
  );
}

const page = { display: 'grid', gap: 16, padding: '24px', maxWidth: 1440, margin: '0 auto' } as const;
const hero = { display: 'flex', gap: 20, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', padding: 20, border: '1px solid var(--pc-border, #dbe2e8)', borderRadius: 22, background: 'var(--pc-bg-card, #fff)' } as const;
const eyebrow = { margin: 0, color: '#0A7A5F', fontSize: 11, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '.08em' } as const;
const title = { margin: '8px 0', fontSize: 'clamp(28px,5vw,48px)', lineHeight: 1, letterSpacing: '-.04em' } as const;
const lead = { margin: 0, maxWidth: 820, lineHeight: 1.55, color: 'var(--pc-text-secondary, #475569)' } as const;
const ownerLine = { display: 'block', marginTop: 10, color: 'var(--pc-text-muted, #64748B)' } as const;
const exitLink = { textDecoration: 'none', fontWeight: 900, color: '#0A7A5F', border: '1px solid #0A7A5F', borderRadius: 12, padding: '10px 14px' } as const;
const warning = { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '12px 14px', borderRadius: 14, background: '#FFF7D6', border: '1px solid #E9CF69', color: '#5F4B00' } as const;
const roleGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 10 } as const;
const roleCard = { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 9, alignItems: 'center', minHeight: 56, padding: '10px 12px', borderRadius: 14, border: '1px solid var(--pc-border, #dbe2e8)', background: 'var(--pc-bg-card, #fff)', color: 'inherit', textDecoration: 'none' } as const;
const roleCardActive = { border: '2px solid #0A7A5F', background: '#EFFAF6' } as const;
const roleNumber = { fontSize: 10, fontWeight: 950, color: '#0A7A5F' } as const;
const surfaceWrap = { minWidth: 0 } as const;
const employeePanel = { display: 'grid', gap: 16, padding: 20, borderRadius: 22, background: 'var(--pc-bg-card, #fff)', border: '1px solid var(--pc-border, #dbe2e8)' } as const;
const employeeTitle = { margin: '8px 0', fontSize: 'clamp(24px,4vw,38px)', lineHeight: 1.05 } as const;
const employeeText = { margin: 0, color: 'var(--pc-text-secondary, #475569)', lineHeight: 1.55 } as const;
const factsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 } as const;
const factCard = { display: 'grid', gap: 5, padding: 14, borderRadius: 14, border: '1px solid var(--pc-border, #dbe2e8)', background: 'var(--pc-bg-subtle, #f8fafc)' } as const;
const factLabel = { fontSize: 10, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--pc-text-muted, #64748B)' } as const;
const factValue = { fontSize: 14, lineHeight: 1.4 } as const;
const disabledAction = { padding: 12, borderRadius: 12, textAlign: 'center', fontWeight: 900, background: '#F1F5F9', color: '#64748B' } as const;
