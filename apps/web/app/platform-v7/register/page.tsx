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
        Доступ в кабинет открывается только после проверки и допуска. Выбор роли здесь не обходит role-lock и не создаёт рабочую сессию.
      </p>
    </section>
  );
}

export default async function RegisterPage({ searchParams }: { searchParams?: Promise<RegisterSearchParams> | RegisterSearchParams }) {
  const params = await Promise.resolve(searchParams ?? {});
  const selectedRole = getSelectedRole(params);

  return (
    <main style={{ display: 'grid', gap: 16, maxWidth: 980, margin: '0 auto', padding: '8px 0 28px' }}>
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
