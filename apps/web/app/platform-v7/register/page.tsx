import '@/styles/platform-v7-public-register.css';
import '@/styles/platform-v7-public-register-official.css';
import Link from 'next/link';
import { Home, Languages, LogIn } from 'lucide-react';
import { BrandMark } from '@/components/v7r/BrandMark';
import { RegisterFormClientPublic } from './RegisterFormClientPublic';

type Locale = 'ru' | 'en' | 'zh';
type RegisterSearchParams = Record<string, string | string[] | undefined>;

const PAGE_COPY = {
  ru: {
    nav: 'Навигация страницы регистрации',
    login: 'Войти',
    home: 'На главную',
    language: 'Сменить язык',
    kicker: 'Регистрация на платформе',
    title: 'Регистрация организации и пользователя',
    lead: 'Укажите достоверные сведения об организации и заявителе. После отправки заявки подтвердите адрес электронной почты и дождитесь результата проверки. Выберите предполагаемый формат участия — права доступа предоставляются только после проверки и одобрения заявки.',
  },
  en: {
    nav: 'Registration page navigation',
    login: 'Sign in',
    home: 'Home',
    language: 'Change language',
    kicker: 'Platform registration',
    title: 'Organization and user registration',
    lead: 'Provide accurate organization and applicant details. After submitting the application, confirm the email address and wait for the review result. Select the intended participation type; access rights are granted only after the application has been reviewed and approved.',
  },
  zh: {
    nav: '注册页面导航',
    login: '登录',
    home: '首页',
    language: '切换语言',
    kicker: '平台注册',
    title: '组织和用户注册',
    lead: '请填写真实、准确的组织和申请人信息。提交申请后，请确认电子邮箱并等待审核结果。请选择计划参与的平台身份；访问权限仅在申请审核并获批准后授予。',
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

        <RegisterFormClientPublic
          locale={locale}
          verifyToken={verifyToken || undefined}
          initialStatusToken={statusToken || undefined}
        />
      </div>
    </main>
  );
}
