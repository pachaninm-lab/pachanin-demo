import Link from 'next/link';
import { LogIn, LogOut, ShieldCheck } from 'lucide-react';
import { PremiumCtaButton, StatusPill, type PremiumTone } from '@/components/platform-v7/premium';
import { BrandMark } from '@/components/v7r/BrandMark';

type Field = { label: string; type?: string };
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
  { label: 'Тип участника' },
  { label: 'Название организации' },
  { label: 'Регион' },
];

const REQUISITE_FIELDS: readonly Field[] = [
  { label: 'ИНН' },
  { label: 'КПП' },
  { label: 'ОГРН / ОГРНИП' },
  { label: 'ФИО ответственного' },
  { label: 'Должность' },
  { label: 'Телефон', type: 'tel' },
  { label: 'Email', type: 'email' },
  { label: 'Пароль', type: 'password' },
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

function getGovIdStatus(searchParams?: RegisterSearchParams) {
  const raw = Array.isArray(searchParams?.gov_id) ? searchParams?.gov_id[0] : searchParams?.gov_id;
  if (raw === 'not-configured') return 'Контур подтверждения подготовлен. Для включения нужны параметры промышленного провайдера.';
  if (raw === 'callback-received') return 'Ответ провайдера получен. Следующий шаг — серверная обработка и сверка организации.';
  if (raw === 'state-error') return 'Проверка state не прошла. Повторите подтверждение.';
  if (raw === 'code-missing') return 'Код подтверждения не получен. Повторите вход через провайдера.';
  return null;
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
            <input style={fieldStyle} type={f.type ?? 'text'} />
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
        Роль указывается в заявке. Выбор роли здесь не обходит role-lock — доступ в рабочий кабинет открывается только после проверки и допуска участника.
      </p>
    </section>
  );
}

function GovIdentityBlock({ status }: { status: string | null }) {
  return (
    <section style={card} aria-label='Подтверждение организации'>
      <span style={micro}>Подтверждение организации</span>
      <div style={{ display: 'grid', gap: 8 }}>
        <Link href='/api/platform-v7/gov-id/start?flow=register' style={{ textDecoration: 'none', minHeight: 46, borderRadius: 15, border: '1px solid rgba(10,122,95,0.22)', background: 'rgba(10,122,95,0.08)', color: '#0A7A5F', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 900 }}><ShieldCheck size={17} />Подтвердить через гос-ID</Link>
        <p style={{ margin: 0, fontSize: 12.5, color: '#66758A', lineHeight: 1.5 }}>Подтверждение не выдаёт роль автоматически. После возврата проверяются организация, ИНН, представитель и заявленная роль.</p>
        {status ? <p style={{ margin: 0, fontSize: 12.5, color: '#0A7A5F', lineHeight: 1.5 }}>{status}</p> : null}
      </div>
    </section>
  );
}

export default async function RegisterPage(
  props: { searchParams?: Promise<Promise<RegisterSearchParams> | RegisterSearchParams> }
) {
  const searchParams = await props.searchParams;
  const params = await Promise.resolve(searchParams ?? {});
  const selectedRole = getSelectedRole(params);
  const govIdStatus = getGovIdStatus(params);

  return (
    <main className='p7-register-page' style={pageShell}>
      <style>{registerCss}</style>
      <RegisterHeader />
      <RegisterHero />

      <GovIdentityBlock status={govIdStatus} />
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
          Текущий статус заявки и причина уточнения видны участнику после отправки. Проверка участника — часть контролируемого запуска контура; внешние подтверждения ожидают подключения.
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
.pc-shell-root-v4:has(.p7-register-page) {
  --pc-header-offset: 0px !important;
  background: #f7faf6 !important;
}
.pc-shell-root-v4:has(.p7-register-page) .pc-v4-header,
.pc-shell-root-v4:has(.p7-register-page) .pc-v4-bottomnav,
.pc-shell-root-v4:has(.p7-register-page) .pc-v4-drawer,
.pc-shell-root-v4:has(.p7-register-page) .pc-v4-pilot-note {
  display: none !important;
}
.pc-shell-root-v4:has(.p7-register-page) .pc-v4-main {
  max-width: none !important;
  margin: 0 !important;
  padding: 0 24px 28px !important;
  background: #f7faf6 !important;
  min-height: 100svh !important;
}
.p7-register-header {
  position: sticky;
  top: max(8px, env(safe-area-inset-top));
  z-index: 30;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 58px;
  padding: 8px 10px;
  border-radius: 20px;
  background: rgba(255,255,255,0.95);
  border: 1px solid rgba(15,23,42,0.08);
  box-shadow: 0 10px 30px rgba(15,23,42,0.08);
  backdrop-filter: blur(12px);
}
.p7-register-brand { display: inline-flex; align-items: center; gap: 10px; min-width: 0; text-decoration: none; color: #0F1419; }
.p7-register-brand-mark { display: inline-grid; place-items: center; width: 44px; height: 44px; flex: 0 0 auto; }
.p7-register-brand-text { font-weight: 950; font-size: 18px; letter-spacing: -0.035em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.p7-register-actions { display: inline-flex; align-items: center; gap: 8px; }
.p7-register-action { min-height: 40px; padding: 0 12px; border-radius: 14px; display: inline-flex; align-items: center; gap: 7px; text-decoration: none; color: #0F1419; background: #fff; border: 1px solid rgba(15,23,42,0.10); font-weight: 900; font-size: 13px; }
.p7-register-action-exit { color: #B91C1C; }
.p7-register-hero { border-radius: 30px; padding: 22px; background: linear-gradient(135deg,#FFFFFF 0%,#F8FAFB 58%,#EFF8F0 100%); border: 1px solid rgba(15,23,42,0.08); display: grid; gap: 11px; box-shadow: 0 18px 46px rgba(15,23,42,0.06); }
.p7-register-kicker { color: #0A7A5F; font-size: 11px; font-weight: 950; text-transform: uppercase; letter-spacing: .1em; }
.p7-register-hero h1 { margin: 0; display: grid; gap: 0; color: #0F1419; font-size: clamp(34px, 8vw, 68px); line-height: .95; letter-spacing: -0.065em; font-weight: 950; }
.p7-register-hero p { margin: 0; color: #66758A; line-height: 1.55; font-size: 14px; max-width: 760px; }
.p7-register-journey { display: inline-flex; align-items: center; gap: 8px; color: #0A7A5F; font-weight: 900; font-size: 13px; }
.p7-register-journey span { width: 9px; height: 9px; border-radius: 999px; background: #0A7A5F; }
.p7-register-field-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap: 10px; }
.p7-register-cta-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(230px,1fr)); gap: 10px; }
@media(max-width: 640px) {
  .pc-shell-root-v4:has(.p7-register-page) .pc-v4-main { padding: 0 10px 22px !important; }
  .p7-register-header { top: max(6px, env(safe-area-inset-top)); border-radius: 17px; min-height: 54px; }
  .p7-register-brand-text { font-size: 16px; }
  .p7-register-action { min-height: 38px; padding: 0 10px; font-size: 12px; }
  .p7-register-action svg { width: 15px; height: 15px; }
  .p7-register-hero { padding: 18px; border-radius: 24px; }
}
`;
