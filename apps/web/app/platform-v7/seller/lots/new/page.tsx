import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Новый лот продавца · Прозрачная Цена',
  description: 'Совместимый вход в канонический импорт партии и создание аукционного лота.',
  robots: { index: false, follow: false },
};

export default function SellerNewLotPage() {
  redirect('/platform-v7/auction/import');
}
