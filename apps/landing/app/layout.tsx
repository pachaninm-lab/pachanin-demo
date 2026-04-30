import type { Metadata } from 'next';
import './globals.css';
import './brand-logo.css';

export const metadata: Metadata = {
  title: 'Прозрачная Цена — контур исполнения зерновой сделки',
  description:
    'Цифровой контур исполнения внебиржевой зерновой сделки: условия, логистика, приёмка, документы, деньги, спор и доказательства. Предпилотная версия для controlled pilot.',
  keywords:
    'зерно, зерновая сделка, АПК, СДИЗ, ФГИС Зерно, ЭДО, логистика зерна, приёмка, расчёты, controlled pilot, Прозрачная Цена',
  openGraph: {
    title: 'Прозрачная Цена — контур исполнения зерновой сделки',
    description:
      'Не marketplace и не CRM. Контур исполнения сделки: от цены и допуска до денег, документов и доказательств.',
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
