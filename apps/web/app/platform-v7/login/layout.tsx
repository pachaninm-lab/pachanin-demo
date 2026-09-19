import '@/styles/platform-v7-public-header.css';
import '@/styles/platform-v7-public-auth.css';
import '@/styles/platform-v7-public-mobile-safe-area.css';
import '@/styles/platform-v7-i18n-cjk.css';
import '@/styles/platform-v7-public-webkit-safe.css';
import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { getPublicLoginCopy } from '@/i18n/public-login-copy';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const { form } = getPublicLoginCopy(locale);
  return {
    title: `${form.title} — Прозрачная Цена`,
    description: form.lead,
    alternates: {
      canonical: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/login',
    },
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default function PlatformV7LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
