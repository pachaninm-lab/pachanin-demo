import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PLATFORM_V7_BANK_ROUTE } from '@/lib/platform-v7/routes';

export const metadata: Metadata = {
  title: 'Банковские события · Прозрачная Цена',
  description: 'Совместимый вход в каноническое рабочее место банка и подтверждённый журнал операций.',
  robots: { index: false, follow: false },
};

export default function PlatformV7BankEventsPage() {
  redirect(PLATFORM_V7_BANK_ROUTE);
}
