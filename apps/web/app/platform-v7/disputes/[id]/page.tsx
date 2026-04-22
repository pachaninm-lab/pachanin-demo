import type { Metadata } from 'next';
import { DisputeDetailRuntime } from '@/components/v7r/DisputeDetailRuntime';

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  return {
    title: `Спор ${params.id}`,
    description: `Карточка спора ${params.id}: удержание, доказательства, SLA и следующий владелец действия.`,
  };
}

export default function PlatformV7DisputeDetailPage({ params }: { params: { id: string } }) {
  return <DisputeDetailRuntime disputeId={params.id} />;
}
