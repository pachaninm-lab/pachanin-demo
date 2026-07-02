import Link from 'next/link';
import { LogIn, LogOut } from 'lucide-react';
import { BrandMark } from '@/components/v7r/BrandMark';
import { RegisterForm } from '@/components/platform-v7/RegisterForm';

type RegisterSearchParams = Record<string, string | string[] | undefined>;

const ROLE_VALUES = ['seller','buyer','logistics','elevator','lab','surveyor','bank','arbitrator','operator'] as const;

const pageShell: React.CSSProperties = {
  display: 'grid',
  gap: 14,
  width: '100%',
  maxWidth: 980,
  margin: '0 auto',
  padding: 'max(10px, env(safe-area-inset-top)) 0 28px',
};

function getSelectedRole(searchParams?: RegisterSearchParams) {
  const rawRole = Array.isArray(searchParams?.role) ? searchParams?.role[0] : searchParams?.role;
  return ROLE_VALUES.includes(rawRole as typeof ROLE_VALUES[number]) ? (rawRole as string) : 'seller';
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


export default async function RegisterPage({ searchParams }: { searchParams?: Promise<RegisterSearchParams> | RegisterSearchParams }) {
  const params = await Promise.resolve(searchParams ?? {});
  const selectedRole = getSelectedRole(params);

  return (
    <main className='p7-register-page' style={pageShell}>
      <style>{registerCss}</style>
      <RegisterHeader />
      <RegisterHero />
      <RegisterForm initialRole={selectedRole} />
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
  .pc-shell-root-v4:has(.p7-register-page) .pc-v4-main { padding: 0 12px 24px !important; }
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
  .pc-shell-root-v4:has(.p7-register-page) .pc-v4-main { padding: 0 10px 22px !important; }
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
