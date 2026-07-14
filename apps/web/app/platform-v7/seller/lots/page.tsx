import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Лоты продавца · Прозрачная Цена',
  description: 'Совместимый вход в канонический аукционный контур лотов и торгов.',
  robots: { index: false, follow: false },
};

export default function SellerLotsPage() {
  redirect('/platform-v7/auction');
}
