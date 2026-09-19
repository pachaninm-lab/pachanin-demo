import '@/styles/platform-v7-public-header.css';
import '@/styles/platform-v7-public-auth.css';
import '@/styles/platform-v7-public-mobile-safe-area.css';
import '@/styles/platform-v7-i18n-cjk.css';
import '@/styles/platform-v7-public-webkit-safe.css';
import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import LoginPage from '@/app/platform-v7/login/page';
import { getPublicLoginCopy } from '@/i18n/public-login-copy';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const { form } = getPublicLoginCopy(locale);
  return {
    title: `${form.title} — Прозрачная Цена`,
    description: form.lead,
    alternates: { canonical: '/platform-v7/login' },
    robots: { index: false, follow: true },
  };
}

export default LoginPage;
