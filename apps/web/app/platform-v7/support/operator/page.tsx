import type { Metadata } from 'next';
import { SupportOperatorQueueClient } from '@/components/platform-v7/SupportOperatorQueueClient';

export const metadata: Metadata = { title: 'Операторская очередь поддержки', description: 'Очередь обращений поддержки исполнения сделки.' };

export default function SupportOperatorPage() {
  return <SupportOperatorQueueClient />;
}
