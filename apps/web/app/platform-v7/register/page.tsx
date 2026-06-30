import type { Metadata } from 'next';
import Link from 'next/link';
import { LogIn, LogOut } from 'lucide-react';
import { PremiumCtaButton, StatusPill, type PremiumTone } from '@/components/platform-v7/premium';
import { BrandMark } from '@/components/v7r/BrandMark';

export const metadata: Metadata = {
  title: 'Регистрация участника — Прозрачная Цена',
  description:
    'Подключение компании к controlled pilot / pre-integration контуру исполнения зерновой сделки. Форма заявки доступна пользователям, но не является SEO-посадочной страницей.',
  alternates: {
    canonical: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/register',
  },
  robots: {
    index: false,
    follow: true,
  },
};

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
    <main className='p7-register-page' style={pageShell}>
      <style>{registerCss}</style>
      <RegisterHeader />
      <RegisterHero />
      <FieldGroup title='Данные участника' fields={PARTICIPANT_FIELDS} />
      <FieldGroup title='Реквизиты и ответственный' fields={REQUISITE_FIELDS} />
      <RoleField selectedRole={selectedRole} />
      <section style={card} aria-label='Статусы заявки'>
        <span style={micro}>Статусы проверки</span>
        <div className='p7-register-status-grid'>
          {STATUSES.map((status) => <StatusPill key={status.label} tone={status.tone}>{status.label}</StatusPill>)}
        </div>
      </section>
      <section className='p7-register-submit' style={card} aria-label='Отправка заявки'>
        <p>Отправка заявки в текущем контуре носит проверочный характер. Боевой допуск требует KYC/KYB, договоров, регламентов и подтверждения внешних контуров.</p>
        <PremiumCtaButton href='/platform-v7/contact' tone='primary'>Отправить заявку на проверку</PremiumCtaButton>
      </section>
    </main>
  );
}

const registerCss = `
.p7-register-page{color:#111827}.p7-register-header{position:sticky;top:10px;z-index:20;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;min-height:64px;padding:10px;border-radius:24px;background:rgba(255,255,255,.94);border:1px solid rgba(15,23,42,.08);box-shadow:0 16px 38px rgba(15,23,42,.06);backdrop-filter:blur(16px)}.p7-register-brand{display:inline-flex;align-items:center;gap:10px;text-decoration:none;color:#111827;font-weight:950;min-width:0}.p7-register-brand-text{font-size:17px;letter-spacing:-.035em}.p7-register-brand-mark{display:grid;place-items:center;width:44px;height:44px;border-radius:16px;background:rgba(10,122,95,.08)}.p7-register-actions{display:flex;gap:8px;align-items:center}.p7-register-action{min-height:42px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:0 13px;border-radius:14px;border:1px solid rgba(15,23,42,.1);background:#fff;color:#334155;text-decoration:none;font-size:13px;font-weight:900}.p7-register-action-exit{background:#0A7A5F;color:#fff;border-color:#0A7A5F}.p7-register-hero{position:relative;overflow:hidden;border-radius:30px;border:1px solid rgba(15,23,42,.08);background:linear-gradient(135deg,#fff,#f3faf6);padding:clamp(22px,4vw,42px);box-shadow:0 18px 46px rgba(15,23,42,.06)}.p7-register-kicker{display:inline-flex;width:fit-content;margin-bottom:12px;padding:7px 10px;border-radius:999px;background:rgba(10,122,95,.09);color:#0A7A5F;font-size:11px;font-weight:950;letter-spacing:.06em;text-transform:uppercase}.p7-register-hero h1{display:grid;gap:2px;margin:0;font-size:clamp(32px,6vw,64px);line-height:.98;letter-spacing:-.06em;color:#0f172a}.p7-register-hero p{max-width:680px;margin:14px 0 0;color:#64748b;font-size:15px;line-height:1.52;font-weight:650}.p7-register-journey{display:inline-flex;align-items:center;gap:9px;margin-top:18px;padding:10px 12px;border-radius:999px;background:#fff;border:1px solid rgba(15,23,42,.08);color:#334155;font-size:12px;font-weight:900}.p7-register-journey span{width:8px;height:8px;border-radius:999px;background:#0A7A5F;box-shadow:0 0 0 5px rgba(10,122,95,.1)}.p7-register-field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.p7-register-status-grid{display:flex;gap:8px;flex-wrap:wrap}.p7-register-submit p{margin:0;color:#66758A;font-size:13px;line-height:1.5}@media(max-width:760px){.p7-register-header{grid-template-columns:1fr}.p7-register-actions{display:grid;grid-template-columns:1fr 1fr}.p7-register-field-grid{grid-template-columns:1fr}.p7-register-page{padding-left:4px!important;padding-right:4px!important}}
`;
