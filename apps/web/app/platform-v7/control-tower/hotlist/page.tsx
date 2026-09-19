import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Горячая очередь · Прозрачная Цена',
  description: 'Совместимый вход в канонический ролевой центр управления исполнением.',
  robots: { index: false, follow: false },
};

export default function ControlTowerHotlistPage() {
  redirect('/platform-v7/control-tower');
}
