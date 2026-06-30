import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { LoginHeaderExitButton } from '@/components/platform-v7/LoginHeaderExitButton';

export const metadata: Metadata = {
  title: 'Вход — Прозрачная Цена',
  description: 'Служебная страница входа в controlled pilot / pre-integration контур Прозрачной Цены.',
  alternates: {
    canonical: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/login',
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function PlatformV7LoginLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <LoginHeaderExitButton />
      {children}
    </>
  );
}
