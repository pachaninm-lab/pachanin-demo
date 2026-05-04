import type { Metadata } from 'next';
import './globals.css';
import './brand-logo.css';
import './worldclass-polish.css';

export const metadata: Metadata = {
  title: 'Прозрачная Цена — карта потерь зерновой сделки',
  description:
    'Цифровой контур исполнения зерновой сделки: цена, логистика, приёмка, документы, деньги, спор и доказательства. Предпилотный контур для АПК с проверкой в контролируемом пилоте.',
  keywords:
    'Прозрачная Цена, зерновая сделка, карта потерь сделки, АПК, СберБизнес ID, СберКорус, безопасные расчёты, анализ рисков сделки, Минсельхоз, СДИЗ, ФГИС Зерно, ЭДО, ЭПД, МЧД, логистика зерна, приёмка, расчёты, контролируемый пилот',
  openGraph: {
    title: 'Прозрачная Цена — карта потерь зерновой сделки',
    description:
      'Цифровой контур исполнения сделки: от цены и допуска до денег, документов, рисков и доказательств.',
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
