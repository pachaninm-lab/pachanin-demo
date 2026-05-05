import type { Metadata } from 'next';
import { SupportIndexPage } from '@/components/platform-v7/SupportIndexPage';

export const metadata: Metadata = {
  title: 'Центр поддержки исполнения сделки',
  description: 'Контур обращений, связанных со сделкой, деньгами, документами, рейсом и блокерами.',
};

export default function SupportPage() {
  return <SupportIndexPage />;
}
