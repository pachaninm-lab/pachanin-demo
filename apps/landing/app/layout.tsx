import type { Metadata } from 'next';
import './globals.css';
import './brand-logo.css';
import './worldclass-polish.css';

export const metadata: Metadata = {
  title: 'Прозрачная Цена — карта потерь зерновой сделки',
  description:
    'Цифровой контур исполнения зерновой сделки: цена, логистика, приёмка, документы, деньги, спор и доказательства. Сбер-контур, AI-анализ рисков и controlled pilot для АПК.',
  keywords:
    'Прозрачная Цена, зерновая сделка, карта потерь сделки, АПК, СберБизнес ID, СберКорус, Безопасные сделки Сбер, AI анализ сделки, Минсельхоз, СДИЗ, ФГИС Зерно, ЭДО, ЭПД, МЧД, логистика зерна, приёмка, расчёты, controlled pilot',
  openGraph: {
    title: 'Прозрачная Цена — карта потерь зерновой сделки',
    description:
      'Не marketplace и не CRM. Контур исполнения сделки: от цены и допуска до денег, документов, AI-анализа рисков и доказательств.',
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
