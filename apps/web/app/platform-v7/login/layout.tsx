import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Вход — Прозрачная Цена',
  description: 'Единый защищённый вход в рабочий контур «Прозрачной Цены».',
  alternates: {
    canonical: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/login',
  },
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};

export default function PlatformV7LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
