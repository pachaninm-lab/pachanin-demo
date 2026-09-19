import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Административный контур · Прозрачная Цена',
  description: 'Совместимый вход в канонический ролевой центр управления.',
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  redirect('/platform-v7/control-tower');
}
