import './globals.css';
import { ReactNode } from 'react';

export const metadata = {
  title: 'Прозрачная Цена',
  description: 'Цифровой контур исполнения зерновой сделки'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
