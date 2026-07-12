import '@/styles/platform-v7-public-header.css';
import '@/styles/platform-v7-public-auth.css';
import '@/styles/platform-v7-public-mobile-safe-area.css';
import '@/styles/platform-v7-i18n-cjk.css';
import '@/styles/platform-v7-public-webkit-safe.css';
import '@/styles/platform-v7-public-world-class.css';
import '@/styles/platform-v7-public-login-refined.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Вход — Прозрачная Цена',
  description: 'Единый вход в личный кабинет Прозрачной Цены: роли, сделки, документы, логистика, деньги и поддержка.',
  alternates: {
    canonical: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/login',
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function PlatformV7LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
