import { DealDetailRuntime } from '@/components/v7r/DealDetailRuntime';

export default function PlatformV7DealDetailPage({ params }: { params: { id: string } }) {
  return <DealDetailRuntime id={params.id} />;
}
