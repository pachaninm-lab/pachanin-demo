import './globals.css';
import { ReactNode } from 'react';

export const metadata = {
  title: 'Прозрачная Цена',
  description: 'Цифровой контур исполнения зерновой сделки'
};

const purgeClientCachesScript = `
(function () {
  try {
    if (typeof window === 'undefined') return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        regs.forEach(function (reg) { reg.unregister(); });
      }).catch(function () {});
    }
    if ('caches' in window) {
      caches.keys().then(function (keys) {
        keys.forEach(function (key) { caches.delete(key); });
      }).catch(function () {});
    }
  } catch (e) {}
})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <script dangerouslySetInnerHTML={{ __html: purgeClientCachesScript }} />
        {children}
      </body>
    </html>
  );
}
