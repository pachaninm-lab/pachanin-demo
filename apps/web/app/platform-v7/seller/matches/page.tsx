import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Подбор покупателей · Прозрачная Цена',
  description: 'Совместимый вход в контур запросов покупателей без фиктивного процента совпадения.',
  robots: { index: false, follow: false },
};

export default function SellerMatchesPage() {
  redirect('/platform-v7/seller/rfq');
}
