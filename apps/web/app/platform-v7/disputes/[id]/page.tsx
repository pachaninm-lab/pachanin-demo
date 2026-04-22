import { DisputeDetailRuntime } from '@/components/v7r/DisputeDetailRuntime';

export default function PlatformV7DisputeDetailPage({ params }: { params: { id: string } }) {
  return <DisputeDetailRuntime disputeId={params.id} />;
}
