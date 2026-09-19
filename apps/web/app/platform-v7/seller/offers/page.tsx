import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Предложения продавца · Прозрачная Цена',
  description: 'Совместимый вход в server-authoritative контур ответа продавца на RFQ.',
  robots: { index: false, follow: false },
};

export default function PlatformV7SellerOffersPage() {
  redirect('/platform-v7/seller/rfq');
}
