import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PLATFORM_V7_BANK_ROUTE } from '@/lib/platform-v7/routes';

export const metadata: Metadata = {
  title: 'Банковское событие · Прозрачная Цена',
  description: 'Совместимый вход в каноническое рабочее место банка без клиентского журнала событий.',
  robots: { index: false, follow: false },
};

export default function BankEventPage() {
  redirect(PLATFORM_V7_BANK_ROUTE);
}
