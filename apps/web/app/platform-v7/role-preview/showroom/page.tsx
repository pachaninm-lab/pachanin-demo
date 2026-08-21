import type { Metadata } from 'next';
import Link from 'next/link';
import { createHash, timingSafeEqual } from 'node:crypto';
import {
  ALL_ROLE_EXECUTION_COCKPITS,
  type RoleExecutionCockpitModel,
} from '@/lib/platform-v7/role-execution-cockpit';
import { RoleExecutionCockpitPage } from '@/components/platform-v7/RoleExecutionCockpit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Презентационный доступ — все кабинеты',
  robots: { index: false, follow: false, nocache: true },
};

const ACCESS_SHA256 = 'f0e62617bb9778e10107fc2f090db41ac66787829a001498d6e79d1b32ef915c';
const ACCESS_EXPIRES_AT = Date.parse('2026-08-21T17:50:00.000Z');

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

function validAccess(code: string): boolean {
  if (!code || Date.now() >= ACCESS_EXPIRES_AT) return false;
  const actual = Buffer.from(createHash('sha256').update(code, 'utf8').digest('hex'));
  const expected = Buffer.from(ACCESS_SHA256);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function presentationCockpit(cockpit: RoleExecutionCockpitModel): RoleExecutionCockpitModel {
  return {
    ...cockpit,
    statuses: [
      ...cockpit.statuses,
      { label: 'SHOWROOM · тестовые данные', tone: 'info' },
    ],
    operations: cockpit.operations.map((operation) => ({
      ...operation,
      action: {
        label: 'Демонстрация · действие отключено',
        disabled: true,
        tone: 'secondary',
      },
    })),
  };
}

function EmployeeShowroom() {
  return (
    <section style={panel}>
      <p style={eyebrow}>Сотрудник организации · SHOWROOM</p>
      <h2 style={sectionTitle}>Профиль сотрудника и доступ внутри организации</h2>
      <div style={factsGrid}>
        {[
          ['Организация', 'ООО «Золотое Поле Тест»'],
          ['Роль', 'GUEST · сотрудник организации'],
          ['Membership', 'ACTIVE · тестовый'],
          ['Рабочая поверхность', 'Профиль, команда, уведомления, назначенные задачи'],
          ['Сделка', 'Единая синтетическая презентационная сделка'],
          ['Ограничение', 'Нет реальных данных и нет боевых действий'],
        ].map(([label, value]) => (
          <article key={label} style={factCard}>
            <span style={factLabel}>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <div style={disabled}>Действия отключены в режиме показа</div>
    </section>
  );
}

export default async function PresentationShowroomPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; code?: string }>;
}) {
  const params = await searchParams;
  const code = typeof params.code === 'string' ? params.code : '';
  if (!validAccess(code)) {
    return (
      <main style={page}>
        <section style={denied}>
          <p style={eyebrow}>SHOWROOM</p>
          <h1 style={title}>Презентационный доступ закрыт</h1>
          <p style={lead}>Ссылка неверна или срок её действия закончился.</p>
        </section>
      </main>
    );
  }

  const selected: ShowroomRole = isShowroomRole(params.role) ? params.role : 'seller';
  const cockpit = selected === 'employee'
    ? null
    : presentationCockpit(ALL_ROLE_EXECUTION_COCKPITS[selected as CockpitRole]);
  const encodedCode = encodeURIComponent(code);

  return (
    <main style={page} data-testid='presentation-showroom'>
      <header style={hero}>
        <div>
          <p style={eyebrow}>SHOWROOM · временный презентационный доступ</p>
          <h1 style={title}>Все 13 кабинетов PC-CROP</h1>
          <p style={lead}>
            Синтетическая единая сделка. Никаких реальных клиентов, документов, денег или production-операций.
          </p>
        </div>
        <span style={expiry}>Доступ действует до 21.08.2026 20:50 МСК</span>
      </header>

      <section style={warning}>
        <strong>TEST / SHOWROOM</strong>
        <span>Это презентационный режим. Все потенциально изменяющие состояние действия отключены.</span>
      </section>

      <nav style={roleGrid} aria-label='Кабинеты режима показа'>
        {SHOWROOM_ROLES.map(([role, label], index) => {
          const active = role === selected;
          return (
            <Link
              key={role}
              href={`/platform-v7/role-preview/showroom?code=${encodedCode}&role=${role}`}
              style={{ ...roleCard, ...(active ? roleCardActive : {}) }}
              aria-current={active ? 'page' : undefined}
            >
              <span style={roleNumber}>{String(index + 1).padStart(2, '0')}</span>
              <strong>{label}</strong>
            </Link>
          );
        })}
      </nav>

      <section style={{ minWidth: 0 }}>
        {selected === 'employee' ? <EmployeeShowroom /> : cockpit ? <RoleExecutionCockpitPage cockpit={cockpit} /> : null}
      </section>
    </main>
  );
}

const page = { display: 'grid', gap: 16, padding: '24px', maxWidth: 1440, margin: '0 auto' } as const;
const hero = { display: 'flex', gap: 20, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', padding: 20, border: '1px solid var(--pc-border, #dbe2e8)', borderRadius: 22, background: 'var(--pc-bg-card, #fff)' } as const;
const denied = { padding: 28, border: '1px solid var(--pc-border, #dbe2e8)', borderRadius: 22, background: 'var(--pc-bg-card, #fff)' } as const;
const eyebrow = { margin: 0, color: '#0A7A5F', fontSize: 11, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '.08em' } as const;
const title = { margin: '8px 0', fontSize: 'clamp(28px,5vw,48px)', lineHeight: 1, letterSpacing: '-.04em' } as const;
const sectionTitle = { margin: '8px 0', fontSize: 'clamp(24px,4vw,38px)', lineHeight: 1.05 } as const;
const lead = { margin: 0, maxWidth: 820, lineHeight: 1.55, color: 'var(--pc-text-secondary, #475569)' } as const;
const expiry = { padding: '8px 10px', borderRadius: 10, background: '#F1F5F9', fontWeight: 800, fontSize: 12 } as const;
const warning = { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '12px 14px', borderRadius: 14, background: '#FFF7D6', border: '1px solid #E9CF69', color: '#5F4B00' } as const;
const roleGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 10 } as const;
const roleCard = { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 9, alignItems: 'center', minHeight: 56, padding: '10px 12px', borderRadius: 14, border: '1px solid var(--pc-border, #dbe2e8)', background: 'var(--pc-bg-card, #fff)', color: 'inherit', textDecoration: 'none' } as const;
const roleCardActive = { border: '2px solid #0A7A5F', background: '#EFFAF6' } as const;
const roleNumber = { fontSize: 10, fontWeight: 950, color: '#0A7A5F' } as const;
const panel = { display: 'grid', gap: 16, padding: 20, borderRadius: 22, background: 'var(--pc-bg-card, #fff)', border: '1px solid var(--pc-border, #dbe2e8)' } as const;
const factsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 } as const;
const factCard = { display: 'grid', gap: 5, padding: 14, borderRadius: 14, border: '1px solid var(--pc-border, #dbe2e8)', background: 'var(--pc-bg-subtle, #f8fafc)' } as const;
const factLabel = { fontSize: 10, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--pc-text-muted, #64748B)' } as const;
const disabled = { padding: 12, borderRadius: 12, textAlign: 'center', fontWeight: 900, background: '#F1F5F9', color: '#64748B' } as const;
