import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Лоты покупателя · Прозрачная Цена',
  description: 'Совместимый вход в канонический аукционный контур лотов и ставок.',
  robots: { index: false, follow: false },
};

export default function BuyerLotsPage() {
  redirect('/platform-v7/auction');
}
