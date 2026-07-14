import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Лот покупателя · Прозрачная Цена',
  description: 'Совместимый вход в канонический аукционный контур без локальных ставок и фиктивного лота.',
  robots: { index: false, follow: false },
};

export default function PlatformV7BuyerLotPage() {
  redirect('/platform-v7/auction');
}
