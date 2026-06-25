import Link from 'next/link';
import { LogIn, LogOut } from 'lucide-react';
import { PremiumCtaButton, StatusPill, type PremiumTone } from '@/components/platform-v7/premium';
import { BrandMark } from '@/components/v7r/BrandMark';

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
  gap: 14,
  width: '100%',
  maxWidth: 980,
  margin: '0 auto',
  padding: 'max(10px, env(safe-area-inset-top)) 0 28px',
};

const fieldStyle: React.CSSProperties = {
  minHeight: 46,
  borderRadius: 15,
  border: '1px solid rgba(15, 23, 42, 0.10)',
  background: 'rgba(255,255,255,0.94)',
  padding: '0 14px',
  fontSize: 15,
  color: '#111827',
  width: '100%',
  boxShadow: 'inset 0 1px 0 rgba(15,23,42,0.03)',
};
const labelStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 800, color: '#66758A' };
const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.92)',
  border: '1px solid rgba(15, 23, 42, 0.08)',
  borderRadius: 26,
  padding: 18,
  display: 'grid',
  gap: 13,
  boxShadow: '0 16px 38px rgba(15,23,42,0.055)',
};
const micro: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#66758A',
};

function getSelectedRole(searchParams?: RegisterSearchParams) {
  const rawRole = Array.isArray(searchParams?.role) ? searchParams?.role[0] : searchParams?.role;
  return ROLE_OPTIONS.some((role) => role.value === rawRole) ? rawRole : 'seller';
}

function RegisterHeader() {
  return (
    <header className='p7-register-header' aria-label='Навигация регистрации участника'>
      <Link href='/platform-v7' className='p7-register-brand' aria-label='На главную Прозрачная Цена'>
        <span className='p7-register-brand-mark'><BrandMark size={44} /></span>
        <span className='p7-register-brand-text'>Прозрачная Цена</span>
      </Link>
      <nav className='p7-register-actions' aria-label='Действия регистрации'>
        <Link href='/platform-v7/login' className='p7-register-action'><LogIn size={16} />Войти</Link>
        <Link href='/platform-v7' className='p7-register-action p7-register-action-exit'><LogOut size={16} />Выход</Link>
      </nav>
    </header>
  );
}

function RegisterHero() {
  return (
    <section className='p7-register-hero' aria-labelledby='p7-register-title'>
      <span className='p7-register-kicker'>Регистрация участника</span>
      <h1 id='p7-register-title'>
        <span>Подключение компании к</span>
        <span>контуру сделки</span>
      </h1>
      <p>Профиль, реквизиты, ответственный и согласия. После отправки заявка проходит проверку. Доступ в кабинет открывается после статуса «Допущен».</p>
      <span className='p7-register-journey'><span />Заявка → проверка → допуск</span>
    </section>
  );
}

function FieldGroup({ title, fields }: { title: string; fields: readonly Field[] }) {
  return (
    <section style={card} aria-label={title}>
      <span style={micro}>{title}</span>
      <div className='p7-register-field-grid'>
        {fields.map((f) => (
          <label key={f.label} style={{ display: 'grid', gap: 6 }}>
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
      <label style={{ display: 'grid', gap: 6 }}>
        <span style={labelStyle}>Заявляемая роль</span>
        <select style={fieldStyle} defaultValue={selectedRole}>
          {ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
        </select>
      </label>
      <p style={{ margin: 0, fontSize: 13, color: '#66758A', lineHeight: 1.45 }}>
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
      <style>{registerCss}</style>
      <RegisterHeader />
      <RegisterHero />

      <RoleField selectedRole={selectedRole} />
      <FieldGroup title='Участник' fields={PARTICIPANT_FIELDS} />
      <FieldGroup title='Реквизиты и ответственный' fields={REQUISITE_FIELDS} />

      <section style={card} aria-label='Согласия'>
        <span style={micro}>Согласия</span>
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: '#111827' }}>
          <input type='checkbox' /> Согласен с правилами платформы
        </label>
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: '#111827' }}>
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
        <p style={{ margin: 0, fontSize: 12.5, color: '#66758A', lineHeight: 1.5 }}>
          Текущий статус заявки и причина уточнения видны участнику после отправки. Проверка участника — часть pre-integration контура; внешние подтверждения ожидают подключения.
        </p>
      </section>

      <div className='p7-register-cta-grid'>
        <PremiumCtaButton href='/platform-v7/onboarding' glyph='shield-check'>Отправить заявку на проверку</PremiumCtaButton>
        <PremiumCtaButton href='/platform-v7/login' variant='ghost'>Уже есть доступ — войти</PremiumCtaButton>
      </div>
    </main>
  );
}

const registerCss = `
.p7-register-header {
  position: sticky;
  top: max(8px, env(safe-area-inset-top));
  z-index: 30;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 13px 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 26px;
  background: rgba(255,255,255,0.93);
  box-shadow: 0 16px 38px rgba(15,23,42,0.055);
  backdrop-filter: blur(18px);
}
.p7-register-brand {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #111827;
  text-decoration: none;
}
.p7-register-brand-mark {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  overflow: visible;
}
.p7-register-brand-text {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 18px;
  line-height: 1;
  font-weight: 920;
  letter-spacing: -0.035em;
}
.p7-register-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
}
.p7-register-action {
  min-height: 42px;
  min-width: 92px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 12px;
  border-radius: 16px;
  border: 1px solid rgba(15,23,42,0.10);
  background: rgba(255,255,255,0.84);
  color: #111827;
  font-size: 13px;
  font-weight: 860;
  text-decoration: none;
  box-shadow: 0 8px 18px rgba(15,23,42,0.035);
  white-space: nowrap;
}
.p7-register-action-exit {
  color: #087a3b;
  background: rgba(8,122,59,0.08);
  border-color: rgba(8,122,59,0.18);
}
.p7-register-hero {
  display: grid;
  gap: 16px;
  padding: 26px 28px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 28px;
  background: rgba(255,255,255,0.93);
  box-shadow: 0 16px 38px rgba(15,23,42,0.055);
}
.p7-register-kicker {
  width: fit-content;
  padding: 9px 13px;
  border-radius: 999px;
  background: rgba(8,122,59,0.09);
  color: #087a3b;
  font-size: 13px;
  font-weight: 900;
}
.p7-register-hero h1 {
  display: grid;
  gap: 2px;
  margin: 0;
  color: #111827;
  font-size: clamp(35px, 6.6vw, 58px);
  line-height: 1.02;
  letter-spacing: -0.055em;
  font-weight: 930;
}
.p7-register-hero h1 span:last-child { color: #15975a; }
.p7-register-hero p {
  margin: 0;
  max-width: 760px;
  color: #66758A;
  font-size: clamp(16px, 2.35vw, 20px);
  line-height: 1.42;
  font-weight: 540;
}
.p7-register-journey {
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(8,122,59,0.08);
  color: #087a3b;
  font-size: 13px;
  font-weight: 900;
}
.p7-register-journey span {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #087a3b;
}
.p7-register-field-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}
.p7-register-cta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px;
}
@media (max-width: 720px) {
  .p7-register-header {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    padding: 12px;
    border-radius: 24px;
  }
  .p7-register-brand { gap: 8px; }
  .p7-register-brand-mark { width: 40px; height: 40px; }
  .p7-register-brand-text { font-size: 16px; }
  .p7-register-actions { gap: 6px; }
  .p7-register-action { min-width: 78px; min-height: 40px; font-size: 12.5px; padding: 0 9px; border-radius: 15px; }
}
@media (max-width: 374px) {
  .p7-register-header { padding: 10px; gap: 6px; }
  .p7-register-brand-mark { width: 36px; height: 36px; }
  .p7-register-brand-text { font-size: 14.5px; }
  .p7-register-actions { gap: 5px; }
  .p7-register-action { min-width: 68px; min-height: 38px; font-size: 11.5px; padding: 0 7px; }
  .p7-register-action svg { display: none; }
}
@media (max-width: 520px) {
  .p7-register-hero { padding: 22px 18px; border-radius: 26px; gap: 14px; }
  .p7-register-kicker { padding: 8px 12px; font-size: 12.5px; }
  .p7-register-hero h1 { font-size: clamp(31px, 8.4vw, 36px); line-height: 1.03; }
  .p7-register-hero p { font-size: 15.5px; line-height: 1.42; }
  .p7-register-journey { font-size: 12.5px; padding: 7px 11px; }
  .p7-register-field-grid { grid-template-columns: 1fr; }
}
`;
