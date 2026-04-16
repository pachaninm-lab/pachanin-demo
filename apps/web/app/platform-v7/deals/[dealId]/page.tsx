import { LiveDealDetailRuntime } from '@/components/v7r/LiveDealDetailRuntime';

export default function PlatformV7DealDetailPage({ params }: { params: { dealId: string } }) {
  return <LiveDealDetailRuntime id={params.dealId} />;
}
