import '@/styles/platform-v7-public-header.css';
import '@/styles/platform-v7-public-auth.css';
import '@/styles/platform-v7-public-mobile-safe-area.css';
import '@/styles/platform-v7-i18n-cjk.css';
import '@/styles/platform-v7-public-webkit-safe.css';
import type { Metadata } from 'next';
import LoginPage from '@/app/platform-v7/login/page';

export const metadata: Metadata = {
  title: 'Вход — Прозрачная Цена',
  description: 'Единый вход в личный кабинет Прозрачной Цены.',
  alternates: { canonical: '/platform-v7/login' },
  robots: { index: false, follow: true },
};

export default LoginPage;
