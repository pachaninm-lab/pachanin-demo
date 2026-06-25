import Link from 'next/link';
import { CircleHelp, LogIn, LogOut, Wheat } from 'lucide-react';
import { CockpitHero, PremiumCtaButton, StatusPill, type PremiumTone } from '@/components/platform-v7/premium';

type Field = { label: string; placeholder: string; type?: string };
type RegisterSearchParams = Record<string, string | string[] | undefined>;

const ROLE_OPTIONS = [
  { value: 'seller', label: 'Продавец' },
  { value: 'buyer', label: 'Покупатель' },
  { value: 'logistics', label: 'Логистика' },
  { value: 'elevator', label: 'Элеватор' },
  { value: 'lab', label: 'Лаборатория' },
  { value: 'surveyor', label: 'Сюрвейер' },
  { value: 'bank', label: 'Банк' },
  { value: 'arbitrator', label: 'Арбитр' },
  { value: 'operator', label: 'Оператор' },
] as const;

const PARTICIPANT_FIELDS: readonly Field[] = [
  { label: 'Тип участника', placeholder: 'Юр. лицо / ИП / КФХ' },
  { label: 'Название организации', placeholder: 'ООО «АгроГрейн»' },
  { label: 'Регион', placeholder: 'Тамбовская область' },
];

const REQUISITE_FIELDS: readonly Field[] = [
  { label: 'ИНН', placeholder: '10 или 12 цифр' },
  { label: 'КПП', placeholder: '9 цифр (для юр. лица)' },
  { label: 'ОГРН / ОГРНИП', placeholder: '13 или 15 цифр' },
  { label: 'ФИО ответственного', placeholder: 'Иванов Иван Иванович' },
  { label: 'Должность', placeholder: 'Директор / Уполномоченный' },
  { label: 'Телефон', placeholder: '+7 ___ ___-__-__', type: 'tel' },
  { label: 'Email', placeholder: 'name@company.ru', type: 'email' },
  { label: 'Пароль', placeholder: '••••••••', type: 'password' },
];

const STATUSES: readonly { label: string; tone: PremiumTone }[] = [
  { label: 'Заявка создана', tone: 'info' },
  { label: 'Ожидает проверки', tone: 'warning' },
  { label: 'Требуется уточнение', tone: 'warning' },
  { label: 'Допущен', tone: 'success' },
  { label: 'Отклонён', tone: 'danger' },
  { label: 'Заблокирован', tone: 'danger' },
];

const pageShell: React.CSSProperties = {
  display: 'grid',
  gap: 16,
  maxWidth: 980,
  margin: '0 auto',
  padding: 'max(10px, env(safe-area-inset-top)) 0 28px',
};

const registerHeader: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 30,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 12,
  margin: '0 0 2px',
  padding: '10px 14px',
  border: '1px solid var(--pc-prem-border, rgba(15,23,42,0.09))',
  borderRadius: 22,
  background: 'rgba(255,255,255,0.92)',
  boxShadow: '0 14px 34px rgba(15,23,42,0.07)',
  backdropFilter: 'blur(18px)',
};

const brandLink: React.CSSProperties = {
  minWidth: 0,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
  color: 'var(--pc-prem-text, #0F1419)',
  textDecoration: 'none',
};

const brandMark: React.CSSProperties = {
  flex: '0 0 auto',
  display: 'inline-grid',
  placeItems: 'center',
  width: 40,
  height: 40,
  borderRadius: 14,
  color: '#087a3b',
  background: 'linear-gradient(145deg, rgba(0, 122, 47, .12), rgba(0, 122, 47, .03))',
  boxShadow: 'inset 0 0 0 1px rgba(0,122,47,.08)',
};

const brandText: React.CSSProperties = {
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
  fontSize: 18,
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.03em',
};

const headerActions: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
  flexWrap: 'wrap',
};

const headerAction: React.CSSProperties = {
  minHeight: 40,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  padding: '0 13px',
  borderRadius: 14,
  border: '1px solid var(--pc-prem-border, rgba(15,23,42,0.09))',
  background: 'rgba(255,255,255,0.86)',
  color: 'var(--pc-prem-text, #0F1419)',
  fontSize: 13,
  fontWeight: 850,
  textDecoration: 'none',
};

const exitAction: React.CSSProperties = {
  ...headerAction,
  color: '#087a3b',
  background: 'rgba(0,122,47,0.07)',
  borderColor: 'rgba(0,122,47,0.16)',
};

const fieldStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 12,
  border: '1px solid var(--pc-prem-border, rgba(15,23,42,0.09))',
  background: 'var(--pc-prem-surface, #fff)',
  padding: '0 12px',
  fontSize: 14,
  color: 'var(--pc-prem-text, #0F1419)',
  width: '100%',
};
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--pc-prem-text-muted, #64748B)' };
const card: React.CSSProperties = {
  background: 'var(--pc-prem-surface, #fff)',
  border: '1px solid var(--pc-prem-border, rgba(15,23,42,0.09))',
  borderRadius: 18,
  padding: 18,
  display: 'grid',
  gap: 12,
};
const micro: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: 'var(--pc-prem-text-muted, #64748B)',
};

function getSelectedRole(searchParams?: RegisterSearchParams) {
  const rawRole = Array.isArray(searchParams?.role) ? searchParams?.role[0] : searchParams?.role;
  return ROLE_OPTIONS.some((role) => role.value === rawRole) ? rawRole : 'seller';
}

function RegisterHeader() {
  return (
    <header style={registerHeader} aria-label='Навигация регистрации участника'>
      <Link href='/platform-v7' style={brandLink} aria-label='На главную Прозрачная Цена'>
        <span style={brandMark}><Wheat size={24} strokeWidth={2.4} /></span>
        <span style={brandText}>Прозрачная Цена</span>
      </Link>
      <nav style={headerActions} aria-label='Действия регистрации'>
        <Link href='/platform-v7/support?role=operator' style={headerAction}><CircleHelp size={16} />Помощь</Link>
        <Link href='/platform-v7/login' style={headerAction}><LogIn size={16} />Войти</Link>
        <Link href='/platform-v7' style={exitAction}><LogOut size={16} />Выход</Link>
      </nav>
    </header>
  );
}

function FieldGroup({ title, fields }: { title: string; fields: readonly Field[] }) {
  return (
    <section style={card} aria-label={title}>
      <span style={micro}>{title}</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {fields.map((f) => (
          <label key={f.label} style={{ display: 'grid', gap: 5 }}>
            <span style={labelStyle}>{f.label}</span>
            <input style={fieldStyle} type={f.type ?? 'text'} placeholder={f.placeholder} />
          </label>
        ))}
      </div>
    </section>
  );
}

function RoleField({ selectedRole }: { selectedRole: string }) {
  return (
    <section style={card} aria-label='Роль участника'>
      <span style={micro}>Роль участника</span>
      <label style={{ display: 'grid', gap: 5 }}>
        <span style={labelStyle}>Заявляемая роль</span>
        <select style={fieldStyle} defaultValue={selectedRole}>
          {ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
        </select>
      </label>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--pc-prem-text-muted, #64748B)', lineHeight: 1.5 }}>
        Роль указывается в заявке. Доступ в рабочий кабинет открывается только после проверки и допуска участника.
      </p>
    </section>
  );
}

export default async function RegisterPage({ searchParams }: { searchParams?: Promise<RegisterSearchParams> | RegisterSearchParams }) {
  const params = await Promise.resolve(searchParams ?? {});
  const selectedRole = getSelectedRole(params);

  return (
    <main style={pageShell}>
      <RegisterHeader />

      <CockpitHero
        eyebrow='Регистрация участника'
        title='Подключение компании к'
        accent='контуру сделки'
        lead='Профиль, реквизиты, ответственный и согласия. После отправки заявка уходит на проверку участника — доступ в кабинет открывается после статуса «Допущен».'
        aside={<StatusPill tone='info'>Заявка → проверка → допуск</StatusPill>}
      />

      <RoleField selectedRole={selectedRole} />
      <FieldGroup title='Участник' fields={PARTICIPANT_FIELDS} />
      <FieldGroup title='Реквизиты и ответственный' fields={REQUISITE_FIELDS} />

      <section style={card} aria-label='Согласия'>
        <span style={micro}>Согласия</span>
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: 'var(--pc-prem-text, #0F1419)' }}>
          <input type='checkbox' /> Согласен с правилами платформы
        </label>
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: 'var(--pc-prem-text, #0F1419)' }}>
          <input type='checkbox' /> Согласен на обработку персональных данных
        </label>
      </section>

      <section style={card} aria-label='Статусы проверки заявки'>
        <span style={micro}>Статусы проверки заявки</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STATUSES.map((s) => (
            <StatusPill key={s.label} tone={s.tone}>{s.label}</StatusPill>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--pc-prem-text-muted, #64748B)', lineHeight: 1.5 }}>
          Текущий статус заявки и причина уточнения видны участнику после отправки. Проверка участника — часть pre-integration контура; внешние подтверждения ожидают подключения.
        </p>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
        <PremiumCtaButton href='/platform-v7/onboarding' glyph='shield-check'>Отправить заявку на проверку</PremiumCtaButton>
        <PremiumCtaButton href='/platform-v7/login' variant='ghost'>Уже есть доступ — войти</PremiumCtaButton>
      </div>
    </main>
  );
}
