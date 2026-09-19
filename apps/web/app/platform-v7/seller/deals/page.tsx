import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PLATFORM_V7_DEALS_ROUTE } from '@/lib/platform-v7/routes';

export const metadata: Metadata = {
  title: 'Сделки продавца · Прозрачная Цена',
  description: 'Совместимый вход в канонический tenant-scoped реестр Сделок.',
  robots: { index: false, follow: false },
};

export default function SellerDealsPage() {
  redirect(PLATFORM_V7_DEALS_ROUTE);
}
