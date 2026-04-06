import './globals.css';
import { ReactNode } from 'react';
import { ThemeProvider } from '../components/theme-provider';
import { OfflineBanner } from '../components/offline-banner';
import { SessionWatcher } from '../components/session-watcher';
import { DemoBanner } from '../components/demo-banner';

export const metadata = {
  title: 'Прозрачная Цена',
  description: 'Цифровой контур исполнения зерновой сделки'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <ThemeProvider>
          {children}
          <OfflineBanner />
          <SessionWatcher />
          <DemoBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
