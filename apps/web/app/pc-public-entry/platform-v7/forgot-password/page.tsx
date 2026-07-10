import '@/styles/platform-v7-public-header.css';
import '@/styles/platform-v7-public-auth.css';
import '@/styles/platform-v7-public-mobile-safe-area.css';
import '@/styles/platform-v7-i18n-cjk.css';
import '@/styles/platform-v7-public-webkit-safe.css';
import type { Metadata } from 'next';
import ForgotPasswordPage from '@/app/platform-v7/forgot-password/page';

export const metadata: Metadata = {
  title: 'Восстановление доступа — Прозрачная Цена',
  description: 'Восстановление доступа к единому личному кабинету Прозрачной Цены.',
  alternates: { canonical: '/platform-v7/forgot-password' },
  robots: { index: false, follow: true },
};

export default ForgotPasswordPage;
