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
    follow: false,
  },
};

export default function PlatformV7LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
