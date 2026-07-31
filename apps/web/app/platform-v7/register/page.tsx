import '@/styles/platform-v7-public-register.css';
import Link from 'next/link';
import { Home, Languages, LogIn } from 'lucide-react';
import { BrandMark } from '@/components/v7r/BrandMark';
import { RegisterFormClient } from './RegisterFormClient';

type Locale = 'ru' | 'en' | 'zh';
type RegisterSearchParams = Record<string, string | string[] | undefined>;

const PAGE_COPY = {
  ru: {
    nav: 'Навигация регистрации',
    login: 'Войти',
    home: 'Главная',
    language: 'Сменить язык',
    kicker: 'P0 · Первый клиентский доступ',
    title: 'Подключение организации к платформе',
    lead: 'Заполни реальные данные. После отправки потребуется подтвердить email и дождаться серверного допуска. Выбор рабочего пространства не выдаёт роль и не открывает личный кабинет.',
  },
  en: {
    nav: 'Registration navigation',
    login: 'Sign in',
    home: 'Home',
    language: 'Change language',
    kicker: 'P0 · First customer access',
    title: 'Connect an organization to the platform',
    lead: 'Enter real data. After submission, confirm the email and wait for server-side admission. Selecting a workspace does not grant a role or open a workspace.',
  },
  zh: {
    nav: '注册导航',
    login: '登录',
    home: '首页',
    language: '切换语言',
    kicker: 'P0 · 首位客户访问',
    title: '将组织接入平台',
    lead: '请填写真实信息。提交后需确认电子邮箱并等待服务器审核。选择工作空间不会授予角色，也不会直接开放个人工作区。',
  },
} satisfies Record<Locale, Record<string, string>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function localeFrom(value: string | undefined): Locale {
  return value === 'en' || value === 'zh' ? value : 'ru';
}

function nextLocale(locale: Locale): Locale {
  return locale === 'ru' ? 'en' : locale === 'en' ? 'zh' : 'ru';
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: Promise<RegisterSearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const locale = localeFrom(first(params.lang));
  const verifyToken = String(first(params.verify) || '').trim().slice(0, 512);
  const statusToken = String(first(params.statusToken) || '').trim().slice(0, 512);
  const copy = PAGE_COPY[locale];
  const next = nextLocale(locale);
  const localeQuery = new URLSearchParams({ lang: next });
  if (verifyToken) localeQuery.set('verify', verifyToken);
  if (statusToken) localeQuery.set('statusToken', statusToken);

  return (
    <main className='p0-register-page'>
      <div className='p0-register-shell'>
        <header className='p0-register-header' aria-label={copy.nav}>
          <Link className='p0-register-brand' href='/platform-v7' aria-label={copy.home}>
            <BrandMark size={42} />
            <span>Прозрачная Цена</span>
          </Link>
          <nav className='p0-register-header-actions' aria-label={copy.nav}>
            <a
              href={`/platform-v7/register?${localeQuery.toString()}`}
              aria-label={copy.language}
              title={copy.language}
            >
              <Languages size={17} aria-hidden='true' />
              <span>{locale.toUpperCase()}</span>
            </a>
            <Link href='/platform-v7/login'>
              <LogIn size={17} aria-hidden='true' />
              <span>{copy.login}</span>
            </Link>
            <Link href='/platform-v7'>
              <Home size={17} aria-hidden='true' />
              <span>{copy.home}</span>
            </Link>
          </nav>
        </header>

        <section className='p0-register-hero' aria-labelledby='p0-register-title'>
          <small>{copy.kicker}</small>
          <h1 id='p0-register-title'>{copy.title}</h1>
          <p>{copy.lead}</p>
        </section>

        <RegisterFormClient
          locale={locale}
          verifyToken={verifyToken || undefined}
          initialStatusToken={statusToken || undefined}
        />
      </div>
    </main>
  );
}
