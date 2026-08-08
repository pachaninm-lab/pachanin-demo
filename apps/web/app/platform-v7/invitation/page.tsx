import '@/styles/platform-v7-public-register.css';
import Link from 'next/link';
import { Home, Languages, LogIn } from 'lucide-react';
import { BrandMark } from '@/components/v7r/BrandMark';
import { InvitationAcceptClient } from './InvitationAcceptClient';

type Locale = 'ru' | 'en' | 'zh';

const COPY = {
  ru: { nav: 'Навигация приглашения', home: 'Главная', login: 'Войти', language: 'Сменить язык', kicker: 'P0 · Доступ сотрудника', title: 'Приглашение в организацию', lead: 'Проверь и прими одноразовое приглашение. Доступ появится только после серверной проверки токена и membership.' },
  en: { nav: 'Invitation navigation', home: 'Home', login: 'Sign in', language: 'Change language', kicker: 'P0 · Employee access', title: 'Organization invitation', lead: 'Review and accept the single-use invitation. Access is created only after the server verifies the token and membership.' },
  zh: { nav: '邀请导航', home: '首页', login: '登录', language: '切换语言', kicker: 'P0 · 员工访问', title: '组织邀请', lead: '查看并接受一次性邀请。只有服务器验证令牌和 membership 后才会创建访问权限。' },
} as const;

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function localeFrom(value?: string): Locale { return value === 'en' || value === 'zh' ? value : 'ru'; }
function nextLocale(locale: Locale): Locale { return locale === 'ru' ? 'en' : locale === 'en' ? 'zh' : 'ru'; }

export default async function InvitationPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) || {};
  const locale = localeFrom(first(params.lang));
  const token = String(first(params.token) || '').trim().slice(0, 512);
  const copy = COPY[locale];
  const languageQuery = new URLSearchParams({ lang: nextLocale(locale) });
  if (token) languageQuery.set('token', token);

  return (
    <main className='p0-register-page'>
      <div className='p0-register-shell'>
        <header className='p0-register-header' aria-label={copy.nav}>
          <Link className='p0-register-brand' href='/platform-v7' aria-label={copy.home}>
            <BrandMark size={42} />
            <span>Прозрачная Цена</span>
          </Link>
          <nav className='p0-register-header-actions' aria-label={copy.nav}>
            <a href={`/platform-v7/invitation?${languageQuery.toString()}`} aria-label={copy.language} title={copy.language}>
              <Languages size={17} aria-hidden='true' /><span>{locale.toUpperCase()}</span>
            </a>
            <Link href='/platform-v7/login'><LogIn size={17} aria-hidden='true' /><span>{copy.login}</span></Link>
            <Link href='/platform-v7'><Home size={17} aria-hidden='true' /><span>{copy.home}</span></Link>
          </nav>
        </header>
        <section className='p0-register-hero' aria-labelledby='invitation-title'>
          <small>{copy.kicker}</small>
          <h1 id='invitation-title'>{copy.title}</h1>
          <p>{copy.lead}</p>
        </section>
        <InvitationAcceptClient token={token} locale={locale} />
      </div>
    </main>
  );
}
