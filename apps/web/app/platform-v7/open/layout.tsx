import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Служебный вход — Прозрачная Цена',
  description: 'Служебный шлюз входа и ролевого перехода в controlled pilot / pre-integration контур Прозрачной Цены.',
  alternates: {
    canonical: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/open',
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function PlatformV7OpenLayout({ children }: { children: ReactNode }) {
  return children;
}
