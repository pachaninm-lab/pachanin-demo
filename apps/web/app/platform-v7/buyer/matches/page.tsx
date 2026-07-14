import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PLATFORM_V7_BUYER_RFQ_ROUTE } from '@/lib/platform-v7/routes';

export const metadata: Metadata = {
  title: 'Подбор для покупателя · Прозрачная Цена',
  description: 'Совместимый вход в каноническую границу закупочного запроса без фиктивного процента совпадения.',
  robots: { index: false, follow: false },
};

export default function BuyerMatchesPage() {
  redirect(PLATFORM_V7_BUYER_RFQ_ROUTE);
}
