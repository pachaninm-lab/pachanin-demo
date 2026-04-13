import './globals.css';
import type { Viewport } from 'next';
import { ReactNode } from 'react';

export const metadata = {
  title: 'Прозрачная Цена',
  description: 'Цифровой контур исполнения зерновой сделки',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
