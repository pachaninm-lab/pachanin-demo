import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Вход — Прозрачная Цена',
  description: 'Единый вход в личный кабинет Прозрачной Цены.',
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
