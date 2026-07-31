import '@/styles/platform-v7-public-header.css';
import '@/styles/platform-v7-public-auth.css';
import '@/styles/platform-v7-public-mobile-safe-area.css';
import '@/styles/platform-v7-i18n-cjk.css';
import '@/styles/platform-v7-public-webkit-safe.css';
import type { Metadata } from 'next';
import { ArrowLeft, Languages } from 'lucide-react';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import { ResetPasswordFormClient, type ResetPasswordCopy } from './ResetPasswordFormClient';

export const metadata: Metadata = {
  title: 'Установить новый пароль',
  robots: { index: false, follow: false, nocache: true },
};

type Locale = 'ru' | 'en' | 'zh';

type ResetPageCopy = ResetPasswordCopy & {
  publicNav: string;
  brandTagline: string;
  backHome: string;
  title: string;
  lead: string;
  language: string;
};

const COPY: Record<Locale, ResetPageCopy> = {
  ru: {
    publicNav: 'Навигация восстановления доступа',
    brandTagline: 'Цифровая платформа агросделок',
    backHome: 'На главную',
    title: 'Установить новый пароль',
    lead: 'Ссылка одноразовая. После смены пароля все прежние сессии будут отозваны.',
    language: 'Сменить язык',
    newPassword: 'Новый пароль',
    newPasswordPlaceholder: 'Не менее 12 символов',
    confirmPassword: 'Повтори пароль',
    confirmPasswordPlaceholder: 'Введи пароль ещё раз',
    showPassword: 'Показать пароль',
    hidePassword: 'Скрыть пароль',
    policy: 'Пароль: 12–128 символов и минимум три класса — строчные, прописные, цифры, специальные знаки.',
    mismatch: 'Пароли не совпадают.',
    invalid: 'Ссылка недействительна, истекла или уже использована.',
    unavailable: 'Сервис восстановления временно недоступен. Повтори запрос позже.',
    rateLimited: 'Слишком много попыток. Повтори позже.',
    submit: 'Сохранить новый пароль',
    loading: 'Сохраняем…',
    successTitle: 'Пароль изменён',
    successText: 'Теперь можно войти с новым паролем.',
    sessionsRevoked: 'Все прежние сессии и refresh-токены отозваны.',
    backToLogin: 'Перейти ко входу',
  },
  en: {
    publicNav: 'Access recovery navigation',
    brandTagline: 'Digital agricultural deal platform',
    backHome: 'Home',
    title: 'Set a new password',
    lead: 'The link is single-use. All previous sessions will be revoked after the password is changed.',
    language: 'Change language',
    newPassword: 'New password',
    newPasswordPlaceholder: 'At least 12 characters',
    confirmPassword: 'Repeat password',
    confirmPasswordPlaceholder: 'Enter the password again',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    policy: 'Use 12–128 characters and at least three classes: lowercase, uppercase, digits and symbols.',
    mismatch: 'The passwords do not match.',
    invalid: 'The link is invalid, expired or has already been used.',
    unavailable: 'The recovery service is temporarily unavailable. Request a new link later.',
    rateLimited: 'Too many attempts. Try again later.',
    submit: 'Save new password',
    loading: 'Saving…',
    successTitle: 'Password changed',
    successText: 'You can now sign in with the new password.',
    sessionsRevoked: 'All previous sessions and refresh tokens have been revoked.',
    backToLogin: 'Go to sign in',
  },
  zh: {
    publicNav: '访问恢复导航',
    brandTagline: '农业交易数字平台',
    backHome: '返回首页',
    title: '设置新密码',
    lead: '该链接只能使用一次。密码更改后，所有旧会话都将被撤销。',
    language: '切换语言',
    newPassword: '新密码',
    newPasswordPlaceholder: '至少12个字符',
    confirmPassword: '再次输入密码',
    confirmPasswordPlaceholder: '重新输入密码',
    showPassword: '显示密码',
    hidePassword: '隐藏密码',
    policy: '密码长度为12–128个字符，并至少包含三类：小写字母、大写字母、数字和特殊符号。',
    mismatch: '两次输入的密码不一致。',
    invalid: '链接无效、已过期或已被使用。',
    unavailable: '恢复服务暂时不可用。请稍后重新申请链接。',
    rateLimited: '尝试次数过多。请稍后再试。',
    submit: '保存新密码',
    loading: '正在保存…',
    successTitle: '密码已更改',
    successText: '现在可以使用新密码登录。',
    sessionsRevoked: '所有旧会话和刷新令牌均已撤销。',
    backToLogin: '前往登录',
  },
};

function localeFrom(value: string | undefined): Locale {
  return value === 'en' || value === 'zh' ? value : 'ru';
}

function nextLocale(locale: Locale): Locale {
  return locale === 'ru' ? 'en' : locale === 'en' ? 'zh' : 'ru';
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const tokenValue = Array.isArray(params.token) ? params.token[0] : params.token;
  const langValue = Array.isArray(params.lang) ? params.lang[0] : params.lang;
  const token = String(tokenValue || '').trim().slice(0, 512);
  const locale = localeFrom(langValue);
  const copy = COPY[locale];
  const next = nextLocale(locale);
  const localeQuery = new URLSearchParams({ lang: next });
  if (token) localeQuery.set('token', token);

  return (
    <main className='pc-v7-public-entry pc-recovery-page'>
      <PublicSiteHeader
        ariaLabel={copy.publicNav}
        tagline={copy.brandTagline}
        localeControl={(
          <a
            className='pc-site-locale-switch'
            href={`/platform-v7/reset-password?${localeQuery.toString()}`}
            aria-label={copy.language}
            title={copy.language}
          >
            <Languages size={16} strokeWidth={2.35} aria-hidden='true' />
            <span>{locale.toUpperCase()}</span>
          </a>
        )}
        actions={(
          <a className='pc-site-action' href='/platform-v7' aria-label={copy.backHome} title={copy.backHome}>
            <ArrowLeft size={20} aria-hidden='true' />
            <span>{copy.backHome}</span>
          </a>
        )}
      />

      <section className='pc-recovery-shell' aria-labelledby='pc-reset-title'>
        <div className='pc-recovery-heading'>
          <h1 id='pc-reset-title'>{copy.title}</h1>
          <p>{copy.lead}</p>
        </div>
        <ResetPasswordFormClient token={token} copy={copy} />
      </section>
    </main>
  );
}
