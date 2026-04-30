import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Прозрачная Цена — Цифровой контур зерновой сделки',
  description:
    'Не витрина объявлений, а цифровой контур исполнения внебиржевой зерновой сделки. Цена, логистика, приёмка, документы и деньги — в одной системе.',
  keywords: 'зерно, сделки, агробизнес, прозрачная цена, логистика, ФГИС, цифровизация АПК',
  openGraph: {
    title: 'Прозрачная Цена — Цифровой контур зерновой сделки',
    description: 'Цена, логистика, приёмка, документы и деньги — в одной системе.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
