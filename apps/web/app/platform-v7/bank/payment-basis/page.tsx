import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Проверка основания выплаты · Прозрачная Цена',
  description: 'Канонический вход в серверную проверку основания выплаты по конкретной Сделке.',
  robots: { index: false, follow: false },
};

// Keep the shared entry on its permitted URI while using the canonical
// authenticated, read-only review and its existing query normalization.
export { default } from '../release-safety/page';
