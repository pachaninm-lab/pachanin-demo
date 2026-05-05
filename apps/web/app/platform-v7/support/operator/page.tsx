import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SupportOperatorQueueClient } from '@/components/platform-v7/SupportOperatorQueueClient';

export const metadata: Metadata = { title: 'Операторская очередь поддержки', description: 'Очередь обращений поддержки исполнения сделки.' };

export default function SupportOperatorPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Загрузка очереди поддержки…</div>}>
      <SupportOperatorQueueClient />
    </Suspense>
  );
}
