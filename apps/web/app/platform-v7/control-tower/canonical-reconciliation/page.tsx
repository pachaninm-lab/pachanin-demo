import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Сверка показателей · Прозрачная Цена',
  description: 'Совместимый вход в канонический серверный контур отчётности.',
  robots: { index: false, follow: false },
};

export default function PlatformV7CanonicalReconciliationPage() {
  redirect('/platform-v7/reports');
}
